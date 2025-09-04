import type { Express } from "express";
import { createServer, type Server } from "http";
import cookieParser from 'cookie-parser';
import { storage } from "./storage";
import { emailService } from "./services/email";
import { shopifyService } from "./services/shopify";
import { popupGeneratorService } from "./services/popup-generator";
import { 
  insertStoreSchema, insertPopupConfigSchema, insertSubscriberSchema, insertEmailSettingsSchema,
  loginSchema, resetPasswordSchema, setPasswordSchema, updatePermissionsSchema
} from "@shared/schema";
import { encrypt, decrypt } from "./utils/encryption.js";
import { z } from "zod";
import { authenticateSession, requireAdmin, requirePermission, optionalAuth, type AuthRequest } from "./middleware/auth";

export async function registerRoutes(app: Express): Promise<Server> {
  // Middleware
  app.use(cookieParser());
  
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
      await emailService.sendPasswordResetEmail(email, newMember.resetToken!, true);
      
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
      const updates = insertPopupConfigSchema.parse(req.body);
      
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
      
      // Get store info for email
      const store = await storage.getStore(storeId);
      if (store) {
        // Send welcome email with discount code
        await emailService.sendWelcomeEmail(
          store.userId,
          subscriber.email,
          subscriber.name,
          discountCode,
          discountPercentage
        );
        
        // Send admin notification
        await emailService.sendAdminNotification(
          store.userId,
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

  // Email settings
  app.get("/api/email-settings", authenticateSession, requirePermission('manage_email_settings'), async (req: AuthRequest, res) => {
    try {
      const userId = req.user!.id;
      const settings = await storage.getEmailSettings(userId);
      
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

  app.put("/api/email-settings", authenticateSession, requirePermission('manage_email_settings'), async (req: AuthRequest, res) => {
    try {
      const userId = req.user!.id;
      const settingsData = insertEmailSettingsSchema.parse({ ...req.body, userId });
      
      const existingSettings = await storage.getEmailSettings(userId);
      
      let settings;
      if (existingSettings) {
        settings = await storage.updateEmailSettings(userId, {
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
      res.status(400).json({ message: "Failed to update email settings" });
    }
  });

  // Shopify integration
  app.post("/api/stores/:storeId/shopify/connect", authenticateSession, requirePermission('manage_integrations'), async (req: AuthRequest, res) => {
    try {
      const { storeId } = req.params;
      const { shopifyUrl, accessToken } = req.body;
      
      // Validate Shopify connection
      const isValid = await shopifyService.verifyConnection({ shopUrl: shopifyUrl, accessToken });
      
      if (!isValid) {
        return res.status(400).json({ message: "Invalid Shopify credentials. Please check your store URL and access token." });
      }
      
      // Encrypt the access token before storing
      const { encrypt } = await import('../utils/encryption.js');
      const encryptedToken = encrypt(accessToken);
      
      // Update store with Shopify info
      const store = await storage.updateStore(storeId, {
        shopifyUrl,
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
      
      const store = await storage.getStore(storeId);
      if (!store) {
        return res.status(404).json({ message: "Store not found" });
      }
      
      const config = await storage.getPopupConfig(storeId);
      if (!config) {
        return res.status(404).json({ message: "Popup configuration not found" });
      }
      
      const script = popupGeneratorService.generateIntegrationScript(storeId, store.shopifyUrl);
      
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
      const script = popupGeneratorService.getNewsletterScript();
      res.setHeader("Content-Type", "application/javascript");
      res.setHeader("Cache-Control", "public, max-age=300"); // 5 minute cache
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
      
      // Basic domain verification
      if (origin && !origin.includes(new URL(store.shopifyUrl).hostname)) {
        return res.status(403).json({ message: "Domain not authorized" });
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
        discountCode: config.discountCode,
        discountPercentage: config.discountPercentage,
        displayTrigger: config.displayTrigger,
        animation: config.animation,
        suppressAfterSubscription: config.suppressAfterSubscription,
        isActive: config.isActive
      };
      
      res.setHeader("Access-Control-Allow-Origin", origin || "*");
      res.setHeader("Access-Control-Allow-Methods", "GET");
      res.json(publicConfig);
    } catch (error) {
      console.error("Get public popup config error:", error);
      res.status(500).json({ message: "Failed to fetch popup configuration" });
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
      if (origin && !origin.includes(new URL(store.shopifyUrl).hostname)) {
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
          discountCodeSent: discountCode
        });
      } else {
        // Create new subscriber
        subscriber = await storage.createSubscriber({
          ...subscriberData,
          discountCodeSent: discountCode
        });
      }
      
      // Send welcome email
      if (store) {
        await emailService.sendWelcomeEmail(
          store.userId,
          subscriber.email,
          subscriber.name,
          discountCode,
          discountPercentage
        );
        
        await emailService.sendAdminNotification(
          store.userId,
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

  // Script installation verification
  app.get("/api/stores/:storeId/verify-installation", authenticateSession, async (req: AuthRequest, res) => {
    try {
      const { storeId } = req.params;
      
      const store = await storage.getStore(storeId);
      if (!store) {
        return res.status(404).json({ message: "Store not found" });
      }
      
      // Try to fetch the store's homepage and check for script
      try {
        const response = await fetch(store.shopifyUrl);
        const html = await response.text();
        const hasScript = html.includes('newsletter-popup.js') && 
                         html.includes(`data-store-id="${storeId}"`);
        
        await storage.updateStore(storeId, { isVerified: hasScript });
        
        res.json({ 
          installed: hasScript,
          message: hasScript ? "Script is properly installed" : "Script not found on site"
        });
      } catch (fetchError) {
        res.json({ 
          installed: false,
          message: "Could not verify installation - site may not be accessible"
        });
      }
    } catch (error) {
      console.error("Verify installation error:", error);
      res.status(500).json({ message: "Failed to verify installation" });
    }
  });

  const httpServer = createServer(app);
  return httpServer;
}