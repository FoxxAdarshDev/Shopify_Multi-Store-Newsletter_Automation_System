import type { Express } from "express";
import { createServer, type Server } from "http";
import cookieParser from 'cookie-parser';
import { storage } from "./storage";
import { emailService } from "./services/email";
import { shopifyService } from "./services/shopify";
import { popupGeneratorService } from "./services/popup-generator";
import { 
  insertStoreSchema, insertPopupConfigSchema, updatePopupConfigSchema, insertSubscriberSchema, insertEmailSettingsSchema,
  loginSchema, resetPasswordSchema, setPasswordSchema, updatePermissionsSchema, updateUserPreferencesSchema
} from "@shared/schema";
import { encrypt, decrypt } from "./utils/encryption";
import { z } from "zod";
import { authenticateSession, requireAdmin, requirePermission, optionalAuth, type AuthRequest } from "./middleware/auth";

// 🚀 REQUEST-BASED URL DETECTION (Netflix/Uber/Google Pattern) - DEPLOYMENT-AGNOSTIC
const getBaseUrlFromRequest = (req: any): string => {
  // Extract protocol (handles reverse proxies, load balancers, CDNs correctly)
  const protocol = req.headers['x-forwarded-proto'] || 
                   (req.headers['x-forwarded-ssl'] === 'on' ? 'https' :
                   (req.connection?.encrypted ? 'https' : 'http'));
  
  // Extract host (handles load balancers, proxies correctly) 
  const host = req.headers['x-forwarded-host'] || 
               req.headers['host'] || 
               req.get('host');
  
  const baseUrl = `${protocol}://${host}`;
  console.log(`🔗 REQUEST-BASED URL: ${baseUrl} (Protocol: ${protocol}, Host: ${host})`);
  return baseUrl;
};

export async function registerRoutes(app: Express): Promise<Server> {
  // Middleware
  app.use(cookieParser());
  
  // Dynamic newsletter script route - MUST come before static middleware
  app.get('/api/newsletter-script.js', async (req, res) => {
    try {
      const baseUrl = getBaseUrlFromRequest(req);
      const script = await popupGeneratorService.getNewsletterScript(baseUrl);
      
      res.type('application/javascript');
      res.set('Cache-Control', 'no-store, max-age=0, must-revalidate');
      res.set('Pragma', 'no-cache');
      res.set('Expires', '0');
      res.send(script);
    } catch (error) {
      console.error('Error serving newsletter script:', error);
      res.status(500).send('// Script generation failed');
    }
  });
  
  // Clean expired sessions periodically
  setInterval(() => {
    storage.cleanExpiredSessions().catch(console.error);
  }, 60 * 60 * 1000); // Every hour

  // Authentication Routes
  app.post('/api/auth/login', async (req, res) => {
    try {
      const { email, password } = loginSchema.parse(req.body);
      
      const user = await storage.getUserByEmail(email);
      if (!user || !user.password) {
        return res.status(401).json({ message: 'Invalid credentials' });
      }

      if (!user.isActive) {
        return res.status(401).json({ message: 'Account is inactive' });
      }

      const isValidPassword = await storage.verifyPassword(password, user.password);
      if (!isValidPassword) {
        return res.status(401).json({ message: 'Invalid credentials' });
      }

      const { sessionId, expiresAt } = await storage.createSession(user.id);
      
      res.cookie('sessionId', sessionId, {
        httpOnly: true,
        secure: process.env.NODE_ENV === 'production',
        sameSite: 'strict',
        expires: expiresAt
      });

      res.json({
        user: {
          id: user.id,
          email: user.email,
          role: user.role,
          permissions: user.permissions
        },
        sessionExpiresAt: expiresAt
      });
    } catch (error) {
      console.error('Login error:', error);
      res.status(400).json({ message: 'Login failed' });
    }
  });

  app.post('/api/auth/logout', authenticateSession, async (req: AuthRequest, res) => {
    try {
      if (req.sessionId) {
        await storage.deleteSession(req.sessionId);
      }
      res.clearCookie('sessionId');
      res.json({ message: 'Logged out successfully' });
    } catch (error) {
      console.error('Logout error:', error);
      res.status(500).json({ message: 'Logout failed' });
    }
  });

  app.get('/api/auth/user', authenticateSession, async (req: AuthRequest, res) => {
    try {
      const sessionData = await storage.getSession(req.sessionId!);
      res.json({
        user: req.user,
        sessionExpiresAt: sessionData?.expiresAt
      });
    } catch (error) {
      console.error('Get user error:', error);
      res.status(500).json({ message: 'Failed to fetch user data' });
    }
  });

  app.post('/api/auth/forgot-password', async (req, res) => {
    try {
      const { email } = resetPasswordSchema.parse(req.body);
      
      const user = await storage.getUserByEmail(email);
      if (!user) {
        // Don't reveal if user exists or not
        return res.json({ message: 'If an account with this email exists, a reset link has been sent.' });
      }

      const resetToken = storage.generateResetToken();
      const resetTokenExpiry = new Date(Date.now() + 24 * 60 * 60 * 1000); // 24 hours
      
      await storage.updateUser(user.id, {
        resetToken,
        resetTokenExpiry
      });

      await emailService.sendPasswordResetEmail(email, resetToken, false);
      
      res.json({ message: 'If an account with this email exists, a reset link has been sent.' });
    } catch (error) {
      console.error('Forgot password error:', error);
      res.status(500).json({ message: 'Failed to process password reset request' });
    }
  });

  app.post('/api/auth/reset-password', async (req, res) => {
    try {
      const { token, password } = setPasswordSchema.parse(req.body);
      
      const allUsers = await storage.getUsers();
      const userWithToken = allUsers.find(u => u.resetToken === token && 
        u.resetTokenExpiry && new Date() < u.resetTokenExpiry);
      
      if (!userWithToken) {
        return res.status(400).json({ message: 'Invalid or expired reset token' });
      }

      await storage.updateUser(userWithToken.id, {
        password,
        resetToken: null,
        resetTokenExpiry: null,
        isActive: true,
        isEmailVerified: true
      });

      res.json({ message: 'Password set successfully. You can now login.' });
    } catch (error) {
      console.error('Reset password error:', error);
      res.status(400).json({ message: 'Failed to reset password' });
    }
  });

  // Admin Routes
  app.post('/api/admin/create-member', authenticateSession, requireAdmin, async (req: AuthRequest, res) => {
    try {
      const { email, permissions } = req.body;
      
      const existingUser = await storage.getUserByEmail(email);
      if (existingUser) {
        return res.status(400).json({ message: 'User already exists' });
      }

      const newMember = await storage.createMemberInvitation(email, permissions || {});
      
      // 🚀 USE REQUEST-BASED URL DETECTION - Deployment-Agnostic!
      const baseUrl = getBaseUrlFromRequest(req);
      await emailService.sendPasswordResetEmail(email, newMember.resetToken!, true, baseUrl);
      
      res.json({ message: 'Member invitation sent successfully', memberId: newMember.id });
    } catch (error) {
      console.error('Create member error:', error);
      res.status(500).json({ message: 'Failed to create member' });
    }
  });

  app.get('/api/admin/members', authenticateSession, requireAdmin, async (req: AuthRequest, res) => {
    try {
      const users = await storage.getUsers();
      const members = users.filter(u => u.role === 'member').map(u => ({
        id: u.id,
        email: u.email,
        isActive: u.isActive,
        isEmailVerified: u.isEmailVerified,
        lastLoginAt: u.lastLoginAt,
        permissions: u.permissions,
        createdAt: u.createdAt
      }));
      
      res.json(members);
    } catch (error) {
      console.error('Get members error:', error);
      res.status(500).json({ message: 'Failed to fetch members' });
    }
  });

  app.put('/api/admin/members/:id/permissions', authenticateSession, requireAdmin, async (req: AuthRequest, res) => {
    try {
      const { id } = req.params;
      const { permissions } = updatePermissionsSchema.parse(req.body);
      
      const updatedUser = await storage.updateUser(id, { permissions });
      if (!updatedUser) {
        return res.status(404).json({ message: 'Member not found' });
      }
      
      res.json({ message: 'Permissions updated successfully' });
    } catch (error) {
      console.error('Update permissions error:', error);
      res.status(500).json({ message: 'Failed to update permissions' });
    }
  });

  app.delete('/api/admin/members/:id', authenticateSession, requireAdmin, async (req: AuthRequest, res) => {
    try {
      const { id } = req.params;
      
      const success = await storage.deleteUser(id);
      if (!success) {
        return res.status(404).json({ message: 'Member not found' });
      }
      
      res.json({ message: 'Member deleted successfully' });
    } catch (error) {
      console.error('Delete member error:', error);
      res.status(500).json({ message: 'Failed to delete member' });
    }
  });

  // Get dashboard stats
  app.get("/api/dashboard/stats", authenticateSession, async (req: AuthRequest, res) => {
    try {
      const userId = req.user!.id;
      
      const stores = await storage.getStoresByUserId(userId);
      const stats = await storage.getSubscriberStats();
      
      res.json({
        activeStores: stores.filter(s => s.isConnected).length,
        totalSubscribers: stats.total,
        conversionRate: stats.total > 0 ? ((stats.couponsUsed / stats.total) * 100).toFixed(1) : "0.0",
        couponsUsed: stats.couponsUsed,
      });
    } catch (error) {
      console.error("Dashboard stats error:", error);
      res.status(500).json({ message: "Failed to fetch dashboard stats" });
    }
  });

  // Store management
  app.get("/api/stores", authenticateSession, async (req: AuthRequest, res) => {
    try {
      const userId = req.user!.id;
      const stores = await storage.getStoresByUserId(userId);
      
      // Get subscriber counts for each store
      const storesWithStats = await Promise.all(
        stores.map(async (store) => {
          const stats = await storage.getSubscriberStats(store.id);
          return {
            ...store,
            // Mask the Shopify access token in responses
            shopifyAccessToken: store.shopifyAccessToken ? 
              store.shopifyAccessToken.substring(0, 10) + '•'.repeat(40) : undefined,
            subscriberCount: stats.total,
            conversionRate: stats.total > 0 ? ((stats.couponsUsed / stats.total) * 100).toFixed(1) : "0.0",
          };
        })
      );
      
      res.json(storesWithStats);
    } catch (error) {
      console.error("Get stores error:", error);
      res.status(500).json({ message: "Failed to fetch stores" });
    }
  });

  app.post("/api/stores", authenticateSession, requirePermission('manage_stores'), async (req: AuthRequest, res) => {
    try {
      const userId = req.user!.id;
      const data = insertStoreSchema.parse({ ...req.body, userId });
      
      // Encrypt the Shopify access token before saving
      if (data.shopifyAccessToken) {
        data.shopifyAccessToken = encrypt(data.shopifyAccessToken);
      }
      
      const store = await storage.createStore(data);
      
      // Create default popup config
      const defaultPopupConfig = {
        storeId: store.id,
        title: "LOOKING FOR EXCLUSIVE OFFERS?",
        subtitle: "Sign up with your business email ID to receive a one-time 15% discount code for your next order.",
        buttonText: "SUBMIT",
        fields: {
          email: true,
          name: false,
          phone: false,
          company: false,
          address: false
        },
        emailValidation: {
          companyEmailsOnly: true,
          allowedDomains: [],
          blockedDomains: ["gmail.com", "yahoo.com", "hotmail.com", "outlook.com"]
        },
        discountCode: "WELCOME15",
        discountPercentage: 15,
        displayTrigger: "immediate",
        animation: "slide-in",
        suppressAfterSubscription: true,
        isActive: true,
      };
      
      await storage.createPopupConfig(defaultPopupConfig);
      
      res.json(store);
    } catch (error) {
      console.error("Create store error:", error);
      res.status(400).json({ message: "Failed to create store" });
    }
  });

  app.put("/api/stores/:id", authenticateSession, requirePermission('manage_stores'), async (req: AuthRequest, res) => {
    try {
      const storeId = req.params.id;
      const updates = req.body;
      
      // Encrypt Shopify access token if provided
      if (updates.shopifyAccessToken) {
        updates.shopifyAccessToken = encrypt(updates.shopifyAccessToken);
      }
      
      const store = await storage.updateStore(storeId, updates);
      if (!store) {
        return res.status(404).json({ message: "Store not found" });
      }
      
      // Mask the token in response
      const response = {
        ...store,
        shopifyAccessToken: store.shopifyAccessToken ? 
          store.shopifyAccessToken.substring(0, 10) + '•'.repeat(40) : undefined
      };
      
      res.json(response);
    } catch (error) {
      console.error("Update store error:", error);
      res.status(400).json({ message: "Failed to update store" });
    }
  });

  app.delete("/api/stores/:id", authenticateSession, requirePermission('manage_stores'), async (req: AuthRequest, res) => {
    try {
      const storeId = req.params.id;
      const deleted = await storage.deleteStore(storeId);
      
      if (!deleted) {
        return res.status(404).json({ message: "Store not found" });
      }
      
      res.json({ message: "Store deleted successfully" });
    } catch (error) {
      console.error("Delete store error:", error);
      res.status(500).json({ message: "Failed to delete store" });
    }
  });

  // Popup configuration
  app.get("/api/stores/:storeId/popup", authenticateSession, async (req: AuthRequest, res) => {
    try {
      const { storeId } = req.params;
      
      const config = await storage.getPopupConfig(storeId);
      if (!config) {
        return res.status(404).json({ message: "Popup configuration not found" });
      }
      
      res.json(config);
    } catch (error) {
      console.error("Get popup config error:", error);
      res.status(500).json({ message: "Failed to fetch popup configuration" });
    }
  });

  app.put("/api/stores/:storeId/popup", authenticateSession, requirePermission('manage_popups'), async (req: AuthRequest, res) => {
    try {
      const { storeId } = req.params;
      const updates = updatePopupConfigSchema.parse(req.body);
      
      const config = await storage.updatePopupConfig(storeId, updates);
      if (!config) {
        return res.status(404).json({ message: "Popup configuration not found" });
      }
      
      res.json(config);
    } catch (error) {
      console.error("Update popup config error:", error);
      res.status(400).json({ message: "Failed to update popup configuration" });
    }
  });

  // Subscribers
  app.get("/api/stores/:storeId/subscribers", authenticateSession, requirePermission('view_subscribers'), async (req: AuthRequest, res) => {
    try {
      const { storeId } = req.params;
      const subscribers = await storage.getSubscribersByStoreId(storeId);
      
      res.json(subscribers);
    } catch (error) {
      console.error("Get subscribers error:", error);
      res.status(500).json({ message: "Failed to fetch subscribers" });
    }
  });

  app.post("/api/stores/:storeId/subscribers", optionalAuth, async (req: AuthRequest, res) => {
    try {
      const { storeId } = req.params;
      const subscriberData = insertSubscriberSchema.parse({ ...req.body, storeId });
      
      // Check if subscriber already exists
      const existingSubscriber = await storage.getSubscriberByEmail(storeId, subscriberData.email);
      if (existingSubscriber) {
        if (existingSubscriber.isActive) {
          return res.status(400).json({ message: "Email already subscribed" });
        } else {
          // Reactivate existing subscriber
          await storage.updateSubscriber(existingSubscriber.id, {
            isActive: true,
            subscribedAt: new Date(),
            unsubscribedAt: null
          });
          return res.json({ message: "Successfully resubscribed" });
        }
      }
      
      // Get popup config for discount info
      const popupConfig = await storage.getPopupConfig(storeId);
      const discountCode = popupConfig?.discountCode || "WELCOME15";
      const discountPercentage = popupConfig?.discountPercentage || 15;
      
      const subscriber = await storage.createSubscriber({
        ...subscriberData,
        discountCodeSent: discountCode
      });
      
      // Get store info for email and Shopify integration
      const store = await storage.getStore(storeId);
      if (store) {
        // Tag customer in Shopify if integration is available
        if (store.shopifyUrl && store.shopifyAccessToken) {
          try {
            console.log(`🏷️ Tagging Shopify customer: ${subscriber.email}`);
            const shopifyConfig = {
              shopUrl: store.shopifyUrl,
              accessToken: store.shopifyAccessToken
            };
            
            const tagResult = await shopifyService.tagNewsletterSubscriber(
              shopifyConfig,
              subscriber.email,
              {
                firstName: subscriber.name?.split(' ')[0] || '',
                lastName: subscriber.name?.split(' ').slice(1).join(' ') || '',
                phone: subscriber.phone || '',
                company: subscriber.company || ''
              }
            );
            
            if (tagResult.success) {
              console.log(`✅ Successfully tagged Shopify customer ${subscriber.email} as newsletter-subscriber`);
            } else {
              console.error(`❌ Failed to tag Shopify customer: ${tagResult.message}`);
            }
          } catch (error) {
            console.error('Error tagging Shopify customer:', error);
            // Don't fail the subscription if Shopify tagging fails
          }
        }
        
        // Send welcome email with discount code
        await emailService.sendWelcomeEmail(
          storeId,
          subscriber.email,
          subscriber.name,
          discountCode,
          discountPercentage
        );
        
        // Send admin notification
        await emailService.sendAdminNotification(
          storeId,
          subscriber.email,
          store.name
        );
      }
      
      res.json(subscriber);
    } catch (error) {
      console.error("Create subscriber error:", error);
      res.status(400).json({ message: "Failed to create subscriber" });
    }
  });

  app.put("/api/subscribers/:id", authenticateSession, requirePermission('manage_subscribers'), async (req: AuthRequest, res) => {
    try {
      const { id } = req.params;
      const updates = req.body;
      
      const subscriber = await storage.updateSubscriber(id, updates);
      if (!subscriber) {
        return res.status(404).json({ message: "Subscriber not found" });
      }
      
      res.json(subscriber);
    } catch (error) {
      console.error("Update subscriber error:", error);
      res.status(400).json({ message: "Failed to update subscriber" });
    }
  });

  app.delete("/api/subscribers/:id", authenticateSession, requirePermission('manage_subscribers'), async (req: AuthRequest, res) => {
    try {
      const { id } = req.params;
      
      const subscriber = await storage.updateSubscriber(id, {
        isActive: false,
        unsubscribedAt: new Date()
      });
      
      if (!subscriber) {
        return res.status(404).json({ message: "Subscriber not found" });
      }
      
      res.json({ message: "Subscriber unsubscribed successfully" });
    } catch (error) {
      console.error("Unsubscribe error:", error);
      res.status(500).json({ message: "Failed to unsubscribe" });
    }
  });

  // Store-specific subscriber delete endpoint
  app.delete("/api/stores/:storeId/subscribers/:id", authenticateSession, requirePermission('manage_subscribers'), async (req: AuthRequest, res) => {
    try {
      const { storeId, id } = req.params;
      
      // First verify the subscriber belongs to this store
      const subscriber = await storage.getSubscriber(id);
      if (!subscriber) {
        return res.status(404).json({ message: "Subscriber not found" });
      }
      
      if (subscriber.storeId !== storeId) {
        return res.status(403).json({ message: "Subscriber does not belong to this store" });
      }
      
      // Delete subscriber and get session info
      const deletionResult = await storage.deleteSubscriber(id);
      
      if (!deletionResult) {
        return res.status(404).json({ message: "Subscriber not found" });
      }
      
      res.json({ 
        message: "Subscriber deleted successfully", 
        sessionId: deletionResult.sessionId 
      });
    } catch (error) {
      console.error("Store-specific delete error:", error);
      res.status(500).json({ message: "Failed to delete subscriber" });
    }
  });

  // Sync coupon usage from Shopify for all subscribers in a store
  app.post("/api/stores/:storeId/sync-coupon-usage", authenticateSession, requirePermission('manage_subscribers'), async (req: AuthRequest, res) => {
    try {
      const { storeId } = req.params;
      
      // Verify user owns this store
      const store = await storage.getStore(storeId);
      if (!store || store.userId !== req.user!.id) {
        return res.status(404).json({ message: "Store not found" });
      }

      // Check if store has Shopify connection
      if (!store.shopifyUrl || !store.shopifyAccessToken) {
        return res.status(400).json({ message: "Store is not connected to Shopify" });
      }

      // Get popup config to know which discount code to check
      const popupConfig = await storage.getPopupConfig(storeId);
      if (!popupConfig || !popupConfig.discountCode) {
        return res.status(400).json({ message: "No discount code configured for this store" });
      }

      // Get all subscribers for this store who have not used their coupon yet
      const allSubscribers = await storage.getSubscribersByStoreId(storeId);
      const pendingSubscribers = allSubscribers.filter(
        sub => sub.discountCodeSent && !sub.discountCodeUsed
      );

      if (pendingSubscribers.length === 0) {
        return res.json({ 
          message: "No subscribers with pending coupon usage found",
          totalChecked: 0,
          updatedCount: 0 
        });
      }

      const shopifyConfig = {
        shopUrl: store.shopifyUrl,
        accessToken: store.shopifyAccessToken
      };

      let updatedCount = 0;
      const syncResults = [];

      // Check each subscriber's coupon usage
      for (const subscriber of pendingSubscribers) {
        try {
          const syncResult = await shopifyService.syncSubscriberCouponUsage(
            shopifyConfig,
            subscriber.email,
            popupConfig.discountCode
          );

          if (syncResult.hasUsedCoupon) {
            // Update subscriber to mark coupon as used
            await storage.updateSubscriber(subscriber.id, {
              discountCodeUsed: true
            });
            updatedCount++;

            syncResults.push({
              email: subscriber.email,
              status: 'updated',
              orderInfo: syncResult.orderInfo
            });
          } else {
            syncResults.push({
              email: subscriber.email,
              status: 'no_usage_found'
            });
          }
        } catch (error) {
          console.error(`Failed to sync coupon usage for ${subscriber.email}:`, error);
          syncResults.push({
            email: subscriber.email,
            status: 'error',
            error: error instanceof Error ? error.message : String(error)
          });
        }
      }

      res.json({
        message: `Coupon usage sync completed. Updated ${updatedCount} out of ${pendingSubscribers.length} subscribers.`,
        totalChecked: pendingSubscribers.length,
        updatedCount,
        results: syncResults
      });

    } catch (error) {
      console.error("Sync coupon usage error:", error);
      res.status(500).json({ message: "Failed to sync coupon usage from Shopify" });
    }
  });

  // Email settings
  app.get("/api/stores/:storeId/email-settings", authenticateSession, requirePermission('manage_email_settings'), async (req: AuthRequest, res) => {
    try {
      const { storeId } = req.params;
      
      // Verify user owns this store
      const store = await storage.getStore(storeId);
      if (!store || store.userId !== req.user!.id) {
        return res.status(404).json({ message: "Store not found" });
      }
      
      const settings = await storage.getEmailSettings(storeId);
      
      if (!settings) {
        return res.status(404).json({ message: "Email settings not configured" });
      }
      
      // Don't send password back to client
      const { smtpPassword, ...safeSettings } = settings;
      res.json(safeSettings);
    } catch (error) {
      console.error("Get email settings error:", error);
      res.status(500).json({ message: "Failed to fetch email settings" });
    }
  });

  // Store-specific email settings PUT route
  app.put("/api/stores/:storeId/email-settings", authenticateSession, requirePermission('manage_email_settings'), async (req: AuthRequest, res) => {
    try {
      const { storeId } = req.params;
      
      // Verify user owns this store
      const store = await storage.getStore(storeId);
      if (!store || store.userId !== req.user!.id) {
        return res.status(404).json({ message: "Store not found" });
      }
      
      const settingsData = insertEmailSettingsSchema.parse({ ...req.body, storeId });
      
      const existingSettings = await storage.getEmailSettings(storeId);
      
      let settings;
      if (existingSettings) {
        settings = await storage.updateEmailSettings(storeId, {
          ...settingsData,
          isConfigured: true
        });
      } else {
        settings = await storage.createEmailSettings({
          ...settingsData,
          isConfigured: true
        });
      }
      
      if (!settings) {
        return res.status(500).json({ message: "Failed to save email settings" });
      }
      
      // Don't send password back to client
      const { smtpPassword, ...safeSettings } = settings;
      res.json(safeSettings);
    } catch (error) {
      console.error("Update email settings error:", error);
      res.status(500).json({ message: "Failed to update email settings" });
    }
  });

  // Legacy email settings route - DEPRECATED (returns 410 Gone)
  app.put("/api/email-settings", authenticateSession, requirePermission('manage_email_settings'), async (req: AuthRequest, res) => {
    res.status(410).json({ 
      message: "This endpoint is deprecated. Use /api/stores/:storeId/email-settings instead.",
      deprecated: true,
      replacement: "/api/stores/:storeId/email-settings"
    });
  });

  // User Preferences routes
  app.get("/api/user-preferences", authenticateSession, async (req: AuthRequest, res) => {
    try {
      const userId = req.user!.id;
      const preferences = await storage.getUserPreferences(userId);
      
      if (!preferences) {
        // Return default preferences if none exist
        const defaults = {
          adminNotificationEmail: "admin@foxxbioprocess.com",
          enableAnalytics: true,
          sendWelcomeEmail: true,
          enableDoubleOptIn: false,
          validateDiscountCode: true,
          notifyOnSubscriptions: true,
          dailySubscriberSummary: false,
          alertOnUnsubscribeRate: true,
        };
        return res.json(defaults);
      }
      
      res.json(preferences);
    } catch (error) {
      console.error("Get user preferences error:", error);
      res.status(500).json({ message: "Failed to fetch user preferences" });
    }
  });

  app.put("/api/user-preferences", authenticateSession, async (req: AuthRequest, res) => {
    try {
      const userId = req.user!.id;
      const preferencesData = updateUserPreferencesSchema.parse(req.body);
      
      const existingPreferences = await storage.getUserPreferences(userId);
      
      let preferences;
      if (existingPreferences) {
        preferences = await storage.updateUserPreferences(userId, preferencesData);
      } else {
        preferences = await storage.createUserPreferences({ ...preferencesData, userId });
      }
      
      if (!preferences) {
        return res.status(500).json({ message: "Failed to save user preferences" });
      }
      
      res.json(preferences);
    } catch (error) {
      console.error("Update user preferences error:", error);
      res.status(400).json({ message: "Failed to update user preferences" });
    }
  });

  // Shopify integration
  app.post("/api/stores/:storeId/shopify/connect", authenticateSession, requirePermission('manage_integrations'), async (req: AuthRequest, res) => {
    try {
      const { storeId } = req.params;
      const { shopifyUrl, shopifyStoreName, customDomain, accessToken } = req.body;
      
      // Determine which field is being updated to set the primary shopifyUrl
      let finalShopifyUrl = shopifyUrl;
      let finalShopifyStoreName = null;
      let finalCustomDomain = null;
      
      if (shopifyStoreName) {
        // If user provided a store name, ensure it has .myshopify.com
        finalShopifyStoreName = shopifyStoreName.endsWith('.myshopify.com') 
          ? shopifyStoreName 
          : `${shopifyStoreName}.myshopify.com`;
        finalShopifyUrl = finalShopifyStoreName;
        console.log(`Processing shopify store name: "${shopifyStoreName}" -> "${finalShopifyStoreName}"`);
      } else if (customDomain) {
        finalCustomDomain = customDomain;
        finalShopifyUrl = customDomain.startsWith('http') ? customDomain : `https://${customDomain}`;
        console.log(`Processing custom domain: "${customDomain}" -> "${finalShopifyUrl}"`);
      }
      
      // Check if this is just a URL update (when accessToken is empty)
      const isUrlOnlyUpdate = !accessToken || accessToken.trim() === '';
      
      if (isUrlOnlyUpdate) {
        // Just update the URL without verifying connection
        console.log('URL-only update detected, skipping Shopify verification');
        
        // Get current store to preserve existing values
        const currentStore = await storage.getStore(storeId);
        if (!currentStore) {
          return res.status(404).json({ message: "Store not found" });
        }
        
        const updateData: any = {
          shopifyUrl: finalShopifyUrl,
          // Only update the field that was actually sent, preserve the other
          shopifyStoreName: finalShopifyStoreName || currentStore.shopifyStoreName,
          customDomain: finalCustomDomain || currentStore.customDomain,
          // Keep existing connection status if just updating URL
        };
        const store = await storage.updateStore(storeId, updateData);
        
        if (!store) {
          return res.status(404).json({ message: "Store not found" });
        }
        
        return res.json(store);
      }
      
      // Full connection setup with new access token
      // Sanitize access token - remove any non-ASCII characters that could cause ByteString errors
      const sanitizedAccessToken = accessToken ? accessToken.replace(/[^\x00-\x7F]/g, '').trim() : '';
      
      if (!sanitizedAccessToken) {
        return res.status(400).json({ message: "Invalid access token format. Please ensure the token contains only standard characters." });
      }
      
      // Clear any existing problematic connection data first
      await storage.updateStore(storeId, {
        shopifyAccessToken: null,
        isConnected: false,
        isVerified: false
      });
      
      // Debug logging to understand what's being processed
      console.log('Original access token length:', accessToken?.length || 0);
      console.log('Sanitized access token length:', sanitizedAccessToken.length);
      console.log('Contains non-ASCII:', accessToken !== sanitizedAccessToken);
      
      // Validate Shopify connection with the fresh sanitized data
      const isValid = await shopifyService.verifyConnection({ shopUrl: finalShopifyUrl, accessToken: sanitizedAccessToken });
      
      if (!isValid) {
        return res.status(400).json({ message: "Invalid Shopify credentials. Please check your store URL and access token." });
      }
      
      // Encrypt the sanitized access token before storing
      const encryptedToken = encrypt(sanitizedAccessToken);
      
      // Get current store to preserve existing values
      const currentStore = await storage.getStore(storeId);
      if (!currentStore) {
        return res.status(404).json({ message: "Store not found" });
      }
      
      // Update store with Shopify info
      const store = await storage.updateStore(storeId, {
        shopifyUrl: finalShopifyUrl,
        // Only update the field that was actually sent, preserve the other
        shopifyStoreName: finalShopifyStoreName || currentStore.shopifyStoreName,
        customDomain: finalCustomDomain || currentStore.customDomain,
        shopifyAccessToken: encryptedToken,
        isConnected: true
      });
      
      if (!store) {
        return res.status(404).json({ message: "Store not found" });
      }
      
      res.json(store);
    } catch (error) {
      console.error("Shopify connect error:", error);
      res.status(500).json({ message: "Failed to connect to Shopify" });
    }
  });

  app.post("/api/stores/:storeId/shopify/verify", authenticateSession, requirePermission('manage_integrations'), async (req: AuthRequest, res) => {
    try {
      const { storeId } = req.params;
      
      const store = await storage.getStore(storeId);
      if (!store || !store.shopifyAccessToken) {
        return res.status(400).json({ message: "Store not connected to Shopify" });
      }
      
      // Check if discount code exists in Shopify
      const discountExists = await shopifyService.verifyDiscountCode(
        store.shopifyUrl,
        store.shopifyAccessToken,
        "WELCOME15"
      );
      
      // Update verification and connection status
      await storage.updateStore(storeId, { 
        isVerified: discountExists,
        isConnected: true  // If we can verify, connection is working
      });
      
      res.json({ 
        verified: discountExists,
        message: discountExists ? "Shopify integration verified" : "Discount code not found in Shopify"
      });
    } catch (error) {
      console.error("Shopify verify error:", error);
      res.status(500).json({ message: "Failed to verify Shopify integration" });
    }
  });

  // Newsletter Script Generation
  app.get("/api/stores/:storeId/integration-script", async (req: AuthRequest, res) => {
    try {
      const { storeId } = req.params;
      const { regenerate } = req.query; // Allow explicit regeneration
      
      const store = await storage.getStore(storeId);
      if (!store) {
        return res.status(404).json({ message: "Store not found" });
      }
      
      const config = await storage.getPopupConfig(storeId);
      if (!config) {
        return res.status(404).json({ message: "Popup configuration not found" });
      }
      
      // Check if we should use existing script version or generate new one
      const shouldGenerateNew = regenerate === 'true' || !store.activeScriptVersion || !store.activeScriptTimestamp;
      
      // Auto-detect current domain from request
      const protocol = req.get('X-Forwarded-Proto') || req.protocol || 'https';
      const host = req.get('X-Forwarded-Host') || req.get('host');
      const baseUrl = `${protocol}://${host}`;

      let script;
      if (shouldGenerateNew) {
        // Generate new script with new version/timestamp
        script = popupGeneratorService.generateIntegrationScript(storeId, store.shopifyUrl, baseUrl);
        
        // Extract and store the new script version and timestamp
        const scriptVersionMatch = script.match(/script\.setAttribute\('data-script-version',\s*'([^']+)'\)/);
        const generatedAtMatch = script.match(/script\.setAttribute\('data-generated-at',\s*'([^']+)'\)/);
        
        if (scriptVersionMatch && generatedAtMatch) {
          const scriptVersion = scriptVersionMatch[1];
          const generatedAt = generatedAtMatch[1];
          
          await storage.updateStore(storeId, {
            activeScriptVersion: scriptVersion,
            activeScriptTimestamp: generatedAt
          });
        }
      } else {
        // Use existing stored version to generate consistent script
        script = popupGeneratorService.generateIntegrationScriptWithVersion(
          storeId, 
          store.shopifyUrl, 
          store.activeScriptVersion || 'v1.0.0',
          store.activeScriptTimestamp || new Date().toISOString(),
          baseUrl
        );
      }
      
      res.setHeader("Content-Type", "text/plain");
      res.send(script);
    } catch (error) {
      console.error("Generate integration script error:", error);
      res.status(500).json({ message: "Failed to generate integration script" });
    }
  });

  // Serve Newsletter Script
  app.get("/js/newsletter-popup.js", async (req, res) => {
    try {
      // Auto-detect current domain from request
      const protocol = req.get('X-Forwarded-Proto') || req.protocol || 'https';
      const host = req.get('X-Forwarded-Host') || req.get('host');
      const baseUrl = `${protocol}://${host}`;
      
      const script = popupGeneratorService.getNewsletterScript(baseUrl);
      res.setHeader("Content-Type", "application/javascript");
      res.setHeader("Cache-Control", "public, max-age=30"); // 30 second cache for faster updates
      res.send(script);
    } catch (error) {
      console.error("Serve newsletter script error:", error);
      res.status(500).json({ message: "Failed to serve newsletter script" });
    }
  });

  // API endpoint for popup configuration (public, used by script)
  app.get("/api/popup-config/:storeId", async (req, res) => {
    try {
      const { storeId } = req.params;
      const origin = req.get('origin') || req.get('referer');
      
      // Get store and verify domain
      const store = await storage.getStore(storeId);
      if (!store) {
        return res.status(404).json({ message: "Store not found" });
      }
      
      // Basic domain verification - allow if origin matches store domain or custom domain
      if (origin) {
        const originHostname = new URL(origin).hostname;
        // Ensure store URL has protocol for URL parsing
        const normalizedStoreUrl = store.shopifyUrl.startsWith('http') ? store.shopifyUrl : `https://${store.shopifyUrl}`;
        const storeHostname = new URL(normalizedStoreUrl).hostname;
        const customDomainHostname = store.customDomain ? new URL(store.customDomain).hostname : null;
        
        const isAuthorized = originHostname === storeHostname || 
                           originHostname === customDomainHostname ||
                           originHostname.includes(storeHostname) ||
                           (customDomainHostname && originHostname.includes(customDomainHostname));
                           
        if (!isAuthorized) {
          console.log(`CORS blocked: origin=${originHostname}, store=${storeHostname}, custom=${customDomainHostname}`);
          return res.status(403).json({ message: "Domain not authorized" });
        }
      }
      
      const config = await storage.getPopupConfig(storeId);
      if (!config) {
        return res.status(404).json({ message: "Popup configuration not found" });
      }
      
      // Return safe configuration for public use
      const publicConfig = {
        id: config.id,
        storeId: config.storeId,
        title: config.title,
        subtitle: config.subtitle,
        buttonText: config.buttonText,
        fields: config.fields,
        emailValidation: config.emailValidation,
        cartValidation: config.cartValidation,
        discountCode: config.discountCode,
        discountPercentage: config.discountPercentage,
        displayTrigger: config.displayTrigger,
        animation: config.animation,
        suppressAfterSubscription: config.suppressAfterSubscription,
        showExitIntentIfNotSubscribed: config.showExitIntentIfNotSubscribed,
        isActive: config.isActive,
        // Include verification status so popup can check without authentication
        isVerified: store.isVerified || false,
        hasActiveScript: !!(store.activeScriptVersion && store.activeScriptTimestamp),
        // Include social links for the popup script
        socialLinks: store.socialLinks || {}
      };
      
      res.setHeader("Access-Control-Allow-Origin", origin || "*");
      res.setHeader("Access-Control-Allow-Methods", "GET");
      res.setHeader("Cache-Control", "no-cache, no-store, must-revalidate");
      res.setHeader("Pragma", "no-cache");
      res.setHeader("Expires", "0");
      res.json(publicConfig);
    } catch (error) {
      console.error("Get public popup config error:", error);
      res.status(500).json({ message: "Failed to fetch popup configuration" });
    }
  });

  // Generate checkout validation script
  app.get("/api/stores/:storeId/checkout-validation-script", authenticateSession, async (req: AuthRequest, res) => {
    try {
      const { storeId } = req.params;
      
      // Verify user owns this store
      const store = await storage.getStore(storeId);
      if (!store || store.userId !== req.user!.id) {
        return res.status(404).json({ message: "Store not found" });
      }
      
      const config = await storage.getPopupConfig(storeId);
      if (!config) {
        return res.status(404).json({ message: "Popup configuration not found" });
      }
      
      // Generate checkout validation script
      const discountCodes = config.discountCode ? [config.discountCode] : ['WELCOME50'];
      const maxAmount = config.cartValidation?.maximumAmount || 100000; // Default $1000
      
      const script = popupGeneratorService.generateCheckoutValidationScript(storeId, discountCodes, maxAmount);
      
      res.setHeader("Content-Type", "application/javascript");
      res.setHeader("Cache-Control", "no-cache, no-store, must-revalidate");
      res.send(script);
    } catch (error) {
      console.error("Generate checkout validation script error:", error);
      res.status(500).json({ message: "Failed to generate checkout validation script" });
    }
  });

  // Check if email is actively subscribed (used by popup script)
  app.get("/api/stores/:storeId/check-subscription/:email", async (req, res) => {
    try {
      const { storeId, email } = req.params;
      
      // Get store to verify request
      const store = await storage.getStore(storeId);
      if (!store) {
        return res.status(404).json({ isSubscribed: false });
      }
      
      // Check if subscriber exists and is active
      const subscriber = await storage.getSubscriberByEmail(storeId, email);
      const isActivelySubscribed = subscriber && subscriber.isActive;
      
      res.setHeader("Access-Control-Allow-Origin", "*");
      res.setHeader("Access-Control-Allow-Methods", "GET");
      res.json({ isSubscribed: !!isActivelySubscribed });
    } catch (error) {
      console.error("Check subscription error:", error);
      res.json({ isSubscribed: false });
    }
  });

  // Clear session storage for deleted subscribers (used by popup script)
  app.post("/api/stores/:storeId/clear-session", async (req, res) => {
    try {
      const { storeId } = req.params;
      const { sessionId } = req.body;
      
      // Get store to verify request
      const store = await storage.getStore(storeId);
      if (!store) {
        return res.status(404).json({ success: false, message: "Store not found" });
      }
      
      // This is a signal to the popup script to clear its session storage
      // The actual clearing happens on the client side
      res.setHeader("Access-Control-Allow-Origin", "*");
      res.setHeader("Access-Control-Allow-Methods", "POST");
      res.json({ 
        success: true, 
        message: "Clear session signal sent",
        clearSession: true 
      });
    } catch (error) {
      console.error("Clear session error:", error);
      res.json({ success: false, clearSession: false });
    }
  });

  // Public subscriber endpoint (used by script)
  app.post("/api/subscribe/:storeId", async (req, res) => {
    try {
      const { storeId } = req.params;
      const origin = req.get('origin') || req.get('referer');
      
      // Get store and verify domain
      const store = await storage.getStore(storeId);
      if (!store) {
        return res.status(404).json({ message: "Store not found" });
      }
      
      // Basic domain verification
      if (origin && !origin.includes(store.shopifyUrl.replace(/^https?:\/\//, ''))) {
        return res.status(403).json({ message: "Domain not authorized" });
      }
      
      const subscriberData = insertSubscriberSchema.parse({ ...req.body, storeId });
      
      // Check if subscriber already exists
      const existingSubscriber = await storage.getSubscriberByEmail(storeId, subscriberData.email);
      if (existingSubscriber && existingSubscriber.isActive) {
        return res.status(400).json({ message: "Email already subscribed" });
      }
      
      // Get popup config for discount info
      const popupConfig = await storage.getPopupConfig(storeId);
      const discountCode = popupConfig?.discountCode || "WELCOME15";
      const discountPercentage = popupConfig?.discountPercentage || 15;
      
      let subscriber;
      if (existingSubscriber && !existingSubscriber.isActive) {
        // Reactivate existing subscriber
        subscriber = await storage.updateSubscriber(existingSubscriber.id, {
          isActive: true,
          subscribedAt: new Date(),
          unsubscribedAt: null,
          discountCodeSent: discountCode,
          sessionId: subscriberData.sessionId
        });
      } else {
        // Create new subscriber
        subscriber = await storage.createSubscriber({
          ...subscriberData,
          discountCodeSent: discountCode
        });
      }
      
      // Send welcome email
      if (store && subscriber) {
        await emailService.sendWelcomeEmail(
          storeId,
          subscriber.email,
          subscriber.name,
          discountCode,
          discountPercentage
        );
        
        await emailService.sendAdminNotification(
          storeId,
          subscriber.email,
          store.name
        );
      }
      
      res.setHeader("Access-Control-Allow-Origin", origin || "*");
      res.setHeader("Access-Control-Allow-Methods", "POST");
      res.json({ 
        message: "Successfully subscribed", 
        discountCode,
        discountPercentage 
      });
    } catch (error) {
      console.error("Create subscriber error:", error);
      res.status(400).json({ message: "Failed to create subscriber" });
    }
  });

  // CORS preflight for popup config endpoint
  app.options("/api/popup-config/:storeId", async (req, res) => {
    const origin = req.get('origin') || req.get('referer');
    res.setHeader("Access-Control-Allow-Origin", origin || "*");
    res.setHeader("Access-Control-Allow-Methods", "GET, OPTIONS");
    res.setHeader("Access-Control-Allow-Headers", "Content-Type, Authorization");
    res.status(200).send();
  });

  // Script installation verification
  app.get("/api/stores/:storeId/verify-installation", authenticateSession, async (req: AuthRequest, res) => {
    try {
      const { storeId } = req.params;
      
      const store = await storage.getStore(storeId);
      if (!store) {
        return res.status(404).json({ message: "Store not found" });
      }
      
      // Only check the main domain (custom domain takes priority over shopifyUrl)
      const urlsToCheck = [];
      
      // Priority: custom domain first, then shopify URL
      if (store.customDomain) {
        urlsToCheck.push(store.customDomain);
      } else if (store.shopifyUrl) {
        urlsToCheck.push(store.shopifyUrl);
      }
      
      console.log(`Checking script installation for store ${storeId} on URLs:`, urlsToCheck);
      
      let foundOnAnyUrl = false;
      let lastError = null;
      let checkedUrls = [];
      
      for (const url of urlsToCheck) {
        try {
          console.log(`Checking ${url}...`);
          const response = await fetch(url, { 
            headers: {
              'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36'
            }
          });
          
          if (!response.ok) {
            console.log(`${url} returned ${response.status}`);
            continue;
          }
          
          const html = await response.text();
          const hasNewsletterScript = html.includes('newsletter-script.js');
          
          // Get current script values to compare with installed version
          const baseUrl = req.get('Host') ? `${req.get('X-Forwarded-Proto') || 'https'}://${req.get('Host')}` : 'http://localhost:5000';
          const currentValues = getCurrentScriptValues(storeId, store.shopifyUrl, baseUrl, store);
          
          // Check if the script has the store ID in the setAttribute call (since it's dynamically set)
          const hasStoreId = html.includes(`script.setAttribute('data-store-id', '${storeId}')`) || 
                            html.includes(`script.setAttribute("data-store-id", "${storeId}")`) ||
                            html.includes(`data-store-id="${storeId}"`);
          
          // Check if script has store domain and MATCHES current value
          const hasStoreDomain = html.includes(`script.setAttribute('data-store-domain', '${currentValues.storeDomain}')`) || 
                                 html.includes(`script.setAttribute("data-store-domain", "${currentValues.storeDomain}")`) ||
                                 html.includes(`data-store-domain="${currentValues.storeDomain}"`);
          
          // Check for additional script attributes to ensure it's our complete script
          const hasPopupConfig = html.includes(`data-popup-config`) || 
                                html.includes(`script.setAttribute('data-popup-config'`) ||
                                html.includes(`script.setAttribute("data-popup-config"`);
          
          const hasIntegrationType = html.includes(`data-integration-type`) ||
                                   html.includes(`script.setAttribute('data-integration-type'`) ||
                                   html.includes(`script.setAttribute("data-integration-type"`);
          
          // Check if script version EXACTLY MATCHES current generated version
          const hasMatchingScriptVersion = currentValues.scriptVersion && (
            html.includes(`script.setAttribute('data-script-version', '${currentValues.scriptVersion}')`) ||
            html.includes(`script.setAttribute("data-script-version", "${currentValues.scriptVersion}")`) ||
            html.includes(`data-script-version="${currentValues.scriptVersion}"`)
          );
          
          // Check if generated timestamp EXACTLY MATCHES current timestamp
          const hasMatchingGeneratedAt = currentValues.generatedAt && (
            html.includes(`script.setAttribute('data-generated-at', '${currentValues.generatedAt}')`) ||
            html.includes(`script.setAttribute("data-generated-at", "${currentValues.generatedAt}")`) ||
            html.includes(`data-generated-at="${currentValues.generatedAt}"`)
          );
          
          // Check for any script version/timestamp (for existence detection)
          const hasAnyScriptVersion = html.includes(`data-script-version`) ||
                                     html.includes(`script.setAttribute('data-script-version'`) ||
                                     html.includes(`script.setAttribute("data-script-version"`);
          
          const hasAnyGeneratedAt = html.includes(`data-generated-at`) ||
                                   html.includes(`script.setAttribute('data-generated-at'`) ||
                                   html.includes(`script.setAttribute("data-generated-at"`);
          
          // Check if the script URL matches the current domain
          const hasCorrectScriptUrl = html.includes(`script.src = '${baseUrl}/api/newsletter-script.js`) ||
                                     html.includes(`script.src='${baseUrl}/api/newsletter-script.js`);
          
          // STRICT VALIDATION: All attributes must exist AND BOTH script version AND timestamp must match exactly
          const hasBasicAttributes = hasStoreDomain && hasPopupConfig && hasIntegrationType;
          const hasCorrectVersion = hasMatchingScriptVersion && hasMatchingGeneratedAt; // Check BOTH version AND timestamp
          const hasCorrectDomain = hasCorrectScriptUrl;
          
          // Complete validation: script exists + store ID + all attributes + correct version + correct domain
          const isValidInstallation = hasNewsletterScript && hasStoreId && hasBasicAttributes && hasCorrectVersion && hasCorrectDomain;
          
          // Outdated script: has all basic attributes but script version doesn't match current generation
          const hasOutdatedScript = hasNewsletterScript && hasStoreId && hasBasicAttributes && hasAnyScriptVersion && !hasCorrectVersion;
          
          let validationLevel = 'incomplete';
          let message = '';
          
          if (isValidInstallation) {
            validationLevel = 'complete';
            message = 'Script is up-to-date and properly installed';
          } else if (hasOutdatedScript) {
            validationLevel = 'outdated';
            message = 'Script is installed but outdated - please update to latest version';
          } else if (hasNewsletterScript) {
            validationLevel = 'incomplete';
            message = 'Script found but missing required attributes';
          } else {
            validationLevel = 'missing';
            message = 'Newsletter script not found';
          }
          
          console.log(`${url} - Newsletter script: ${hasNewsletterScript}, Store ID: ${hasStoreId}, Store domain: ${hasStoreDomain}, Popup config: ${hasPopupConfig}, Integration type: ${hasIntegrationType}, Script version match: ${hasMatchingScriptVersion}, Timestamp match: ${hasMatchingGeneratedAt}, Correct domain: ${hasCorrectDomain} | Validation: ${validationLevel}`);
          
          checkedUrls.push({
            url,
            hasNewsletterScript,
            hasStoreId,
            hasStoreDomain,
            hasPopupConfig,
            hasIntegrationType,
            hasScriptVersion: hasAnyScriptVersion,
            hasGeneratedAt: hasAnyGeneratedAt,
            hasMatchingScriptVersion,
            hasMatchingGeneratedAt,
            hasCorrectDomain,
            validationLevel,
            message,
            success: isValidInstallation,
            currentValues,
            isOutdated: hasOutdatedScript
          });
          
          if (isValidInstallation) {
            foundOnAnyUrl = true;
            console.log(`Script verified successfully on ${url}`);
            break;
          }
        } catch (fetchError) {
          const errorMessage = fetchError instanceof Error ? fetchError.message : 'Unknown error';
          console.log(`Error checking ${url}:`, errorMessage);
          lastError = fetchError;
          checkedUrls.push({
            url,
            error: errorMessage
          });
        }
      }
      
      await storage.updateStore(storeId, { isVerified: foundOnAnyUrl });
      
      // Check if any URL has an outdated script
      const hasOutdatedScript = checkedUrls.some(result => result.isOutdated);
      const successfulResult = checkedUrls.find(result => result.success);
      const outdatedResult = checkedUrls.find(result => result.isOutdated);
      
      if (foundOnAnyUrl) {
        res.json({ 
          installed: true,
          message: "Script is properly installed and up-to-date",
          checkedUrls
        });
      } else if (hasOutdatedScript) {
        res.json({ 
          installed: false,
          isOutdated: true,
          message: "Script is installed but outdated - please update to the latest version",
          checkedUrls,
          debug: {
            storeId,
            urlsChecked: urlsToCheck,
            outdatedScriptFound: true,
            lastError: lastError instanceof Error ? lastError.message : 'No current error'
          }
        });
      } else {
        res.json({ 
          installed: false,
          message: urlsToCheck.length === 0 
            ? "No URLs configured to check" 
            : "Script not found on any configured URL",
          checkedUrls,
          debug: {
            storeId,
            urlsChecked: urlsToCheck,
            lastError: lastError instanceof Error ? lastError.message : 'Unknown error occurred'
          }
        });
      }
    } catch (error) {
      console.error("Verify installation error:", error);
      res.status(500).json({ message: "Failed to verify installation" });
    }
  });

  // Helper function to get current script values for verification
  function getCurrentScriptValues(storeId: string, shopifyUrl: string, baseUrl: string, store: any) {
    // Use stored script version and timestamp if available
    if (store.activeScriptVersion && store.activeScriptTimestamp) {
      return {
        scriptVersion: store.activeScriptVersion,
        generatedAt: store.activeScriptTimestamp,
        storeDomain: shopifyUrl.replace(/^https?:\/\//, '')
      };
    }
    
    // Fallback to generating new values if not stored (backward compatibility)
    const script = popupGeneratorService.generateIntegrationScript(storeId, shopifyUrl, baseUrl);
    
    // Extract values from the generated script
    const scriptVersionMatch = script.match(/script\.setAttribute\('data-script-version',\s*'([^']+)'\)/);
    const generatedAtMatch = script.match(/script\.setAttribute\('data-generated-at',\s*'([^']+)'\)/);
    const storeDomainMatch = script.match(/script\.setAttribute\('data-store-domain',\s*'([^']+)'\)/);
    
    return {
      scriptVersion: scriptVersionMatch ? scriptVersionMatch[1] : null,
      generatedAt: generatedAtMatch ? generatedAtMatch[1] : null,
      storeDomain: storeDomainMatch ? storeDomainMatch[1] : null
    };
  }

  // Integration Script Generation
  app.get("/api/stores/:storeId/integration-script", authenticateSession, async (req: AuthRequest, res) => {
    try {
      const { storeId } = req.params;
      
      const store = await storage.getStore(storeId);
      if (!store) {
        return res.status(404).json({ message: "Store not found" });
      }
      
      // Use SCRIPTENV secret for domain detection
      let baseUrl;
      const scriptEnv = process.env.SCRIPTENV;
      
      if (scriptEnv === 'production') {
        // Production environment - get from request headers
        const protocol = req.get('X-Forwarded-Proto') || (req.secure ? 'https' : 'http');  
        const host = req.get('Host');
        baseUrl = host ? `${protocol}://${host}` : 'https://your-production-domain.com';
      } else if (scriptEnv === 'dev') {
        // Development environment - use current request
        const protocol = req.get('X-Forwarded-Proto') || (req.secure ? 'https' : 'http');  
        const host = req.get('Host');
        baseUrl = host ? `${protocol}://${host}` : 'http://localhost:5000';
      } else {
        // Fallback to localhost if SCRIPTENV not set
        baseUrl = 'http://localhost:5000';
      }
      
      console.log('Script baseUrl determined:', baseUrl);
      
      const script = popupGeneratorService.generateIntegrationScript(storeId, store.shopifyUrl, baseUrl);
      res.send(script);
    } catch (error) {
      console.error("Generate integration script error:", error);
      res.status(500).json({ message: "Failed to generate integration script" });
    }
  });

  // Service worker file download
  app.get("/api/stores/:storeId/download-file", authenticateSession, async (req: AuthRequest, res) => {
    try {
      const { storeId } = req.params;
      
      const store = await storage.getStore(storeId);
      if (!store) {
        return res.status(404).json({ message: "Store not found" });
      }
      
      // Use SCRIPTENV secret for domain detection (same logic as integration script)
      let baseUrl;
      const scriptEnv = process.env.SCRIPTENV;
      
      if (scriptEnv === 'production') {
        const protocol = req.get('X-Forwarded-Proto') || (req.secure ? 'https' : 'http');  
        const host = req.get('Host');
        baseUrl = host ? `${protocol}://${host}` : 'https://your-production-domain.com';
      } else if (scriptEnv === 'dev') {
        const protocol = req.get('X-Forwarded-Proto') || (req.secure ? 'https' : 'http');  
        const host = req.get('Host');
        baseUrl = host ? `${protocol}://${host}` : 'http://localhost:5000';
      } else {
        baseUrl = 'http://localhost:5000';
      }
      
      const serviceWorkerContent = popupGeneratorService.generateIntegrationFile(storeId, store.shopifyUrl, baseUrl);
      
      res.setHeader('Content-Type', 'application/javascript');
      res.setHeader('Content-Disposition', 'attachment; filename="webpushr-sw.js"');
      res.send(serviceWorkerContent);
    } catch (error) {
      console.error("Download file error:", error);
      res.status(500).json({ message: "Failed to generate download file" });
    }
  });

  // Public endpoint to serve popup configuration (for the script)
  app.get("/api/popup-config/:storeId", async (req, res) => {
    try {
      const { storeId } = req.params;
      const origin = req.get('Origin') || req.get('Referer')?.match(/https?:\/\/[^\/]+/)?.[0];
      
      const popupConfig = await storage.getPopupConfig(storeId);
      if (!popupConfig) {
        return res.status(404).json({ message: "Popup configuration not found" });
      }

      // Get store for domain verification
      const store = await storage.getStore(storeId);
      if (!store) {
        return res.status(404).json({ message: "Store not found" });
      }

      // Basic domain verification - allow requests from the configured store domain
      if (origin) {
        const originDomain = new URL(origin).hostname;
        const storeDomain = store.shopifyUrl.replace(/^https?:\/\//, '');
        
        if (!originDomain.includes(storeDomain) && !storeDomain.includes(originDomain)) {
          return res.status(403).json({ message: "Domain not authorized" });
        }
      }

      res.setHeader("Access-Control-Allow-Origin", origin || "*");
      res.setHeader("Access-Control-Allow-Methods", "GET");
      res.json(popupConfig);
    } catch (error) {
      console.error("Get popup config error:", error);
      res.status(500).json({ message: "Failed to fetch popup configuration" });
    }
  });

  // Utility function to detect current domain from HTTP request (same logic as integration script)
  function detectApiBaseUrlFromRequest(req: any): string {
    // Auto-detect current domain from request headers (same as integration script)
    const protocol = req.get('X-Forwarded-Proto') || req.protocol || 'https';
    const host = req.get('X-Forwarded-Host') || req.get('host');
    const baseUrl = `${protocol}://${host}`;
    
    console.log('Email template domain detection from request:', { protocol, host, baseUrl });
    return baseUrl;
  }

  // Email Templates Management - Store specific
  app.get("/api/stores/:storeId/email-template", authenticateSession, async (req: AuthRequest, res) => {
    try {
      const { storeId } = req.params;
      
      // Verify user owns this store
      const store = await storage.getStore(storeId);
      if (!store || store.userId !== req.user!.id) {
        return res.status(404).json({ message: "Store not found" });
      }
      
      // Disable caching to ensure fresh domain detection
      res.set('Cache-Control', 'no-store, no-cache, must-revalidate');
      res.set('Pragma', 'no-cache');
      res.set('Expires', '0');
      
      const template = await storage.getEmailTemplate(storeId);
      
      // Always detect the current domain from HTTP request (same logic as integration script)
      const apiBaseUrl = detectApiBaseUrlFromRequest(req);
      console.log('Email template API baseUrl determined:', apiBaseUrl);
      
      if (!template) {
        // Return default template if none exists - store only path, not full URL
        const defaultTemplate = {
          templateName: "Welcome Email Template",
          subject: "Thank You for Registering – Here's Your 15% Discount!",
          headerLogo: "/assets/images/foxx-logo.png",
          headerText: "Foxx Bioprocess",
          bodyContent: `Dear [First Name],

Thank you for registering your email with Foxx Bioprocess. We're excited to have you as part of our community!

As a token of our appreciation, here's a 15% discount code you can use on your next purchase through our website:

[DISCOUNT_CODE]

Simply apply this code at checkout on www.foxxbioprocess.com to enjoy your savings.

We look forward to supporting your Single-Use Technology needs with the world's first and largest Bioprocess SUT library.

Happy shopping!
Warm regards,
Team Foxx Bioprocess`,
          footerText: "© 2024 Foxx Bioprocess. All rights reserved.",
          footerNote: "You have received this mail because your e-mail ID is registered with us. This is a system-generated e-mail, please don't reply to this message.",
          socialMediaLinks: {
            website: "https://www.foxxbioprocess.com",
            linkedin: "",
            twitter: "",
            facebook: "",
            instagram: ""
          },
          primaryColor: "#0071b9",
          secondaryColor: "#00c68c",
          isActive: true
        };
        res.json(defaultTemplate);
      } else {
        // Return the template as-is from database - let frontend handle domain display
        console.log('GET: Returning template with headerLogo from database:', template.headerLogo);
        res.json(template);
      }
    } catch (error) {
      console.error("Get email template error:", error);
      res.status(500).json({ message: "Failed to fetch email template" });
    }
  });

  // Store-specific email template PUT route
  app.put("/api/stores/:storeId/email-template", authenticateSession, async (req: AuthRequest, res) => {
    try {
      const { storeId } = req.params;
      const templateData = req.body;
      
      // Verify user owns this store
      const store = await storage.getStore(storeId);
      if (!store || store.userId !== req.user!.id) {
        return res.status(404).json({ message: "Store not found" });
      }
      
      // Use the same request-based domain detection as GET endpoint
      const apiBaseUrl = detectApiBaseUrlFromRequest(req);
      console.log('Email template PUT API baseUrl determined:', apiBaseUrl);
      
      // Simply save whatever headerLogo the user provided - let frontend handle domain detection
      console.log('PUT: Received headerLogo from frontend:', templateData.headerLogo);
      console.log('PUT: Saving headerLogo as-is without modification');
      
      // Check if template exists
      const existingTemplate = await storage.getEmailTemplate(storeId);
      
      let result;
      if (existingTemplate) {
        result = await storage.updateEmailTemplate(storeId, templateData);
      } else {
        result = await storage.createEmailTemplate({
          ...templateData,
          storeId: storeId
        });
      }
      
      res.json(result);
    } catch (error) {
      console.error("Update email template error:", error);
      res.status(500).json({ message: "Failed to update email template" });
    }
  });

  // Legacy email template route (kept for backward compatibility)
  app.put("/api/email-template", authenticateSession, async (req: AuthRequest, res) => {
    try {
      const templateData = req.body;
      
      // Use the same request-based domain detection as GET endpoint
      const apiBaseUrl = detectApiBaseUrlFromRequest(req);
      console.log('Email template PUT API baseUrl determined:', apiBaseUrl);
      
      // Simply save whatever headerLogo the user provided - let frontend handle domain detection
      console.log('PUT: Received headerLogo from frontend:', templateData.headerLogo);
      console.log('PUT: Saving headerLogo as-is without modification');
      
      // Check if template exists
      const existingTemplate = await storage.getEmailTemplate(req.user!.id);
      
      let result;
      if (existingTemplate) {
        result = await storage.updateEmailTemplate(req.user!.id, templateData);
      } else {
        result = await storage.createEmailTemplate({
          ...templateData,
          userId: req.user!.id
        });
      }
      
      res.json(result);
    } catch (error) {
      console.error("Update email template error:", error);
      res.status(500).json({ message: "Failed to update email template" });
    }
  });

  app.post("/api/email-template/preview", authenticateSession, async (req: AuthRequest, res) => {
    try {
      const templateForm = req.body;
      
      // Use the same request-based domain detection for consistent URL generation
      const baseUrl = detectApiBaseUrlFromRequest(req);
      console.log('Email template preview API baseUrl determined:', baseUrl);
      console.log('Preview templateForm footerNote:', templateForm.footerNote);
      
      const html = emailService.generatePreviewEmail(templateForm, baseUrl);
      res.json({ html });
    } catch (error) {
      console.error("Generate email preview error:", error);
      res.status(500).json({ message: "Failed to generate email preview" });
    }
  });

  app.get("/api/stores/:storeId/email-click-stats", authenticateSession, async (req: AuthRequest, res) => {
    try {
      const { storeId } = req.params;
      
      // Verify user owns this store
      const store = await storage.getStore(storeId);
      if (!store || store.userId !== req.user!.id) {
        return res.status(404).json({ message: "Store not found" });
      }

      const stats = await storage.getEmailClickStats(storeId);

      res.json({
        clickRate: stats.clickRate,
        totalEmails: stats.totalEmails,
        totalClicks: stats.totalClicks
      });
    } catch (error) {
      console.error("Get email click stats error:", error);
      res.status(500).json({ message: "Failed to fetch email click stats" });
    }
  });

  // Email Click Tracking Route - Store-specific tracking
  app.get("/track/:trackingId", async (req, res) => {
    try {
      const { trackingId } = req.params;
      const ipAddress = req.ip || req.connection.remoteAddress;
      const userAgent = req.get('User-Agent');

      console.log('Track click for trackingId:', trackingId, 'from IP:', ipAddress);

      // Get the tracking record to verify it exists and get store-specific data
      const trackingRecord = await storage.getEmailClickTracking(trackingId);
      if (!trackingRecord) {
        console.log('Tracking record not found for:', trackingId);
        return res.redirect(302, 'https://www.foxxbioprocess.com');
      }

      // Record the click with store context
      await storage.recordEmailClick(trackingId, ipAddress, userAgent);
      console.log('Click recorded for store:', trackingRecord.storeId);

      // Use the original URL from the database and add UTM parameters
      const baseUrl = trackingRecord.originalUrl;
      const redirectUrl = `${baseUrl}?utm_source=${trackingRecord.utmSource}&utm_medium=${trackingRecord.utmMedium}&utm_campaign=${trackingRecord.utmCampaign}&tracking_id=${trackingId}`;
      
      console.log('Redirecting to store-specific URL:', redirectUrl);
      res.redirect(302, redirectUrl);
    } catch (error) {
      console.error("Email click tracking error:", error);
      // Fallback redirect to main website
      res.redirect(302, 'https://www.foxxbioprocess.com');
    }
  });

  // Get detailed email click analytics for a store
  app.get("/api/stores/:storeId/email-analytics", authenticateSession, async (req: AuthRequest, res) => {
    try {
      const { storeId } = req.params;
      
      // Verify user owns this store
      const store = await storage.getStore(storeId);
      if (!store || store.userId !== req.user!.id) {
        return res.status(404).json({ message: "Store not found" });
      }

      // Get detailed click tracking data
      const clickData = await storage.getEmailClicksByStore(storeId);
      const stats = await storage.getEmailClickStats(storeId);

      res.json({
        stats,
        clickData
      });
    } catch (error) {
      console.error("Get email analytics error:", error);
      res.status(500).json({ message: "Failed to fetch email analytics" });
    }
  });

  // Delete single email analytics record
  app.delete("/api/email-analytics/:id", authenticateSession, async (req: AuthRequest, res) => {
    try {
      const { id } = req.params;
      
      const success = await storage.deleteEmailClickTracking(id);
      if (!success) {
        return res.status(404).json({ message: "Email analytics record not found" });
      }
      
      res.json({ message: "Email analytics record deleted successfully" });
    } catch (error) {
      console.error("Delete email analytics error:", error);
      res.status(500).json({ message: "Failed to delete email analytics record" });
    }
  });

  // Bulk delete email analytics records
  app.delete("/api/stores/:storeId/email-analytics/bulk", authenticateSession, async (req: AuthRequest, res) => {
    try {
      const { storeId } = req.params;
      const { ids } = req.body;
      
      if (!Array.isArray(ids) || ids.length === 0) {
        return res.status(400).json({ message: "Invalid or empty IDs array" });
      }
      
      // Verify user owns this store
      const store = await storage.getStore(storeId);
      if (!store || store.userId !== req.user!.id) {
        return res.status(404).json({ message: "Store not found" });
      }
      
      const deletedCount = await storage.bulkDeleteEmailClickTracking(ids);
      
      res.json({ 
        message: `Successfully deleted ${deletedCount} email analytics records`,
        deletedCount 
      });
    } catch (error) {
      console.error("Bulk delete email analytics error:", error);
      res.status(500).json({ message: "Failed to delete email analytics records" });
    }
  });

  // Delete single email analytics record
  app.delete("/api/email-analytics/:id", authenticateSession, async (req: AuthRequest, res) => {
    try {
      const { id } = req.params;
      
      // Get the email analytics record to verify ownership
      const trackingRecord = await storage.getEmailClickTrackingById(id);
      if (!trackingRecord) {
        return res.status(404).json({ message: "Email analytics record not found" });
      }

      // Verify user owns the store associated with this record
      const store = await storage.getStore(trackingRecord.storeId);
      if (!store || store.userId !== req.user!.id) {
        return res.status(403).json({ message: "Access denied" });
      }

      const success = await storage.deleteEmailClickTracking(id);
      if (!success) {
        return res.status(404).json({ message: "Email analytics record not found" });
      }

      res.json({ message: "Email analytics record deleted successfully" });
    } catch (error) {
      console.error("Delete email analytics error:", error);
      res.status(500).json({ message: "Failed to delete email analytics record" });
    }
  });

  // Bulk delete email analytics records
  app.delete("/api/stores/:storeId/email-analytics/bulk", authenticateSession, async (req: AuthRequest, res) => {
    try {
      const { storeId } = req.params;
      const { ids } = req.body;

      if (!Array.isArray(ids) || ids.length === 0) {
        return res.status(400).json({ message: "Invalid or empty IDs array" });
      }

      // Verify user owns this store
      const store = await storage.getStore(storeId);
      if (!store || store.userId !== req.user!.id) {
        return res.status(404).json({ message: "Store not found" });
      }

      const deletedCount = await storage.bulkDeleteEmailClickTracking(ids);
      res.json({ 
        message: `Successfully deleted ${deletedCount} email analytics records`,
        deletedCount 
      });
    } catch (error) {
      console.error("Bulk delete email analytics error:", error);
      res.status(500).json({ message: "Failed to bulk delete email analytics records" });
    }
  });

  // Serve the newsletter popup JavaScript file

  const httpServer = createServer(app);
  return httpServer;
}