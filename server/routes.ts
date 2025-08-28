import type { Express } from "express";
import { createServer, type Server } from "http";
import { storage } from "./storage";
import { emailService } from "./services/email";
import { shopifyService } from "./services/shopify";
import { popupGeneratorService } from "./services/popup-generator";
import { insertStoreSchema, insertPopupConfigSchema, insertSubscriberSchema, insertEmailSettingsSchema } from "@shared/schema";
import { z } from "zod";

export async function registerRoutes(app: Express): Promise<Server> {
  // Get dashboard stats
  app.get("/api/dashboard/stats", async (req, res) => {
    try {
      // For demo purposes, using hardcoded user ID. In production, use authentication
      const userId = "demo-user-id";
      
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
  app.get("/api/stores", async (req, res) => {
    try {
      const userId = "demo-user-id";
      const stores = await storage.getStoresByUserId(userId);
      
      // Get subscriber counts for each store
      const storesWithStats = await Promise.all(
        stores.map(async (store) => {
          const stats = await storage.getSubscriberStats(store.id);
          return {
            ...store,
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

  app.post("/api/stores", async (req, res) => {
    try {
      const userId = "demo-user-id";
      const data = insertStoreSchema.parse({ ...req.body, userId });
      
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

  app.put("/api/stores/:id", async (req, res) => {
    try {
      const storeId = req.params.id;
      const updates = req.body;
      
      const store = await storage.updateStore(storeId, updates);
      if (!store) {
        return res.status(404).json({ message: "Store not found" });
      }
      
      res.json(store);
    } catch (error) {
      console.error("Update store error:", error);
      res.status(400).json({ message: "Failed to update store" });
    }
  });

  app.delete("/api/stores/:id", async (req, res) => {
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
  app.get("/api/stores/:id/popup-config", async (req, res) => {
    try {
      const storeId = req.params.id;
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

  app.put("/api/stores/:id/popup-config", async (req, res) => {
    try {
      const storeId = req.params.id;
      const updates = req.body;
      
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

  // Generate integration script
  app.get("/api/stores/:id/integration-script", async (req, res) => {
    try {
      const storeId = req.params.id;
      const config = await storage.getPopupConfig(storeId);
      
      if (!config) {
        return res.status(404).json({ message: "Popup configuration not found" });
      }
      
      const script = popupGeneratorService.generatePopupScript(storeId, config);
      
      res.setHeader('Content-Type', 'application/javascript');
      res.send(script);
    } catch (error) {
      console.error("Generate script error:", error);
      res.status(500).json({ message: "Failed to generate integration script" });
    }
  });

  // Download service worker file
  app.get("/api/integration-file", (req, res) => {
    const serviceWorker = popupGeneratorService.generateIntegrationFile();
    
    res.setHeader('Content-Type', 'application/javascript');
    res.setHeader('Content-Disposition', 'attachment; filename="webpushr-sw.js"');
    res.send(serviceWorker);
  });

  // Subscriber management
  app.get("/api/stores/:id/subscribers", async (req, res) => {
    try {
      const storeId = req.params.id;
      const subscribers = await storage.getSubscribersByStoreId(storeId);
      res.json(subscribers);
    } catch (error) {
      console.error("Get subscribers error:", error);
      res.status(500).json({ message: "Failed to fetch subscribers" });
    }
  });

  // Public subscription endpoint (used by popup)
  app.post("/api/subscribe", async (req, res) => {
    try {
      const { storeId, email, name, phone, company, address } = req.body;
      
      if (!storeId || !email) {
        return res.status(400).json({ message: "Store ID and email are required" });
      }
      
      // Check if subscriber already exists
      const existingSubscriber = await storage.getSubscriberByEmail(storeId, email);
      if (existingSubscriber) {
        return res.status(400).json({ message: "Email already subscribed" });
      }
      
      // Get store and popup config
      const store = await storage.getStore(storeId);
      if (!store) {
        return res.status(404).json({ message: "Store not found" });
      }
      
      const config = await storage.getPopupConfig(storeId);
      if (!config) {
        return res.status(404).json({ message: "Popup configuration not found" });
      }
      
      // Create subscriber
      const subscriber = await storage.createSubscriber({
        storeId,
        email,
        name: name || null,
        phone: phone || null,
        company: company || null,
        address: address || null,
        discountCodeSent: config.discountCode,
        discountCodeUsed: false,
        isActive: true,
      });
      
      // Send welcome email
      try {
        await emailService.sendWelcomeEmail(
          store.userId,
          email,
          name,
          config.discountCode,
          config.discountPercentage
        );
        
        // Send admin notification
        await emailService.sendAdminNotification(
          store.userId,
          email,
          store.name
        );
      } catch (emailError) {
        console.error("Email sending failed:", emailError);
        // Don't fail the subscription if email fails
      }
      
      res.json({
        message: "Successfully subscribed",
        subscriber: {
          id: subscriber.id,
          email: subscriber.email,
          discountCode: config.discountCode,
        },
      });
    } catch (error) {
      console.error("Subscribe error:", error);
      res.status(500).json({ message: "Subscription failed" });
    }
  });

  // Email settings
  app.get("/api/email-settings", async (req, res) => {
    try {
      const userId = "demo-user-id";
      const settings = await storage.getEmailSettings(userId);
      
      if (!settings) {
        return res.json({
          smtpHost: "smtp.gmail.com",
          smtpPort: 587,
          fromEmail: "updates@foxxbioprocess.com",
          fromName: "Foxx Bioprocess",
          isConfigured: false,
        });
      }
      
      // Don't return sensitive data
      const { smtpPassword, ...safeSettings } = settings;
      res.json(safeSettings);
    } catch (error) {
      console.error("Get email settings error:", error);
      res.status(500).json({ message: "Failed to fetch email settings" });
    }
  });

  app.post("/api/email-settings", async (req, res) => {
    try {
      const userId = "demo-user-id";
      const data = insertEmailSettingsSchema.parse({ ...req.body, userId });
      
      const existingSettings = await storage.getEmailSettings(userId);
      
      let settings;
      if (existingSettings) {
        settings = await storage.updateEmailSettings(userId, data);
      } else {
        settings = await storage.createEmailSettings(data);
      }
      
      if (!settings) {
        throw new Error("Failed to save email settings");
      }
      
      // Don't return sensitive data
      const { smtpPassword, ...safeSettings } = settings;
      res.json(safeSettings);
    } catch (error) {
      console.error("Save email settings error:", error);
      res.status(400).json({ message: "Failed to save email settings" });
    }
  });

  // Shopify integration
  app.post("/api/stores/:id/verify-shopify", async (req, res) => {
    try {
      const storeId = req.params.id;
      const { shopifyUrl, accessToken } = req.body;
      
      if (!shopifyUrl || !accessToken) {
        return res.status(400).json({ message: "Shopify URL and access token are required" });
      }
      
      // Test connection
      const isValid = await shopifyService.verifyConnection({
        shopUrl: shopifyUrl,
        accessToken: accessToken,
      });
      
      if (!isValid) {
        return res.status(400).json({ message: "Invalid Shopify credentials" });
      }
      
      // Update store
      const store = await storage.updateStore(storeId, {
        shopifyUrl,
        shopifyAccessToken: accessToken,
        isConnected: true,
        isVerified: true,
      });
      
      if (!store) {
        return res.status(404).json({ message: "Store not found" });
      }
      
      res.json({ message: "Shopify connection verified", store });
    } catch (error) {
      console.error("Verify Shopify error:", error);
      res.status(500).json({ message: "Failed to verify Shopify connection" });
    }
  });

  // Check discount usage
  app.post("/api/stores/:id/check-discount-usage", async (req, res) => {
    try {
      const storeId = req.params.id;
      const { customerEmail, discountCode } = req.body;
      
      const store = await storage.getStore(storeId);
      if (!store || !store.shopifyAccessToken) {
        return res.status(400).json({ message: "Shopify integration not configured" });
      }
      
      const hasUsed = await shopifyService.checkCustomerDiscountUsage(
        {
          shopUrl: store.shopifyUrl,
          accessToken: store.shopifyAccessToken,
        },
        customerEmail,
        discountCode
      );
      
      // Update subscriber record if discount was used
      if (hasUsed) {
        const subscriber = await storage.getSubscriberByEmail(storeId, customerEmail);
        if (subscriber && !subscriber.discountCodeUsed) {
          await storage.updateSubscriber(subscriber.id, {
            discountCodeUsed: true,
          });
        }
      }
      
      res.json({ hasUsed });
    } catch (error) {
      console.error("Check discount usage error:", error);
      res.status(500).json({ message: "Failed to check discount usage" });
    }
  });

  const httpServer = createServer(app);
  return httpServer;
}
