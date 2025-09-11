import {
  users, stores, popupConfigs, subscribers, emailSettings, sessions, userPreferences,
  emailTemplates, emailClickTracking,
  type User, type InsertUser, type Session,
  type Store, type InsertStore,
  type PopupConfig, type InsertPopupConfig,
  type Subscriber, type InsertSubscriber,
  type EmailSettings, type InsertEmailSettings,
  type UserPreferences, type InsertUserPreferences,
  type EmailTemplate, type InsertEmailTemplate, type UpdateEmailTemplate,
  type EmailClickTracking, type InsertEmailClickTracking
} from "@shared/schema";
import { randomBytes, scrypt, timingSafeEqual } from 'crypto';
import { promisify } from 'util';

const scryptAsync = promisify(scrypt);
import { db } from "./db";
import { eq, and, desc, count, sql, inArray } from "drizzle-orm";

export interface IStorage {
  // Users
  getUser(id: string): Promise<User | undefined>;
  getUserByEmail(email: string): Promise<User | undefined>;
  createUser(user: InsertUser): Promise<User>;
  updateUser(id: string, updates: Partial<User>): Promise<User | undefined>;
  
  // Authentication
  hashPassword(password: string): Promise<string>;
  verifyPassword(password: string, hashedPassword: string): Promise<boolean>;
  generateResetToken(): string;
  createMemberInvitation(email: string, permissions: Record<string, boolean>): Promise<User>;
  
  // Session management
  createSession(userId: string): Promise<{ sessionId: string; expiresAt: Date }>;
  getSession(sessionId: string): Promise<{ userId: string; expiresAt: Date } | undefined>;
  deleteSession(sessionId: string): Promise<boolean>;
  cleanExpiredSessions(): Promise<void>;
  
  // Additional user methods
  getUsers(): Promise<User[]>;
  deleteUser(id: string): Promise<boolean>;

  // Stores
  getStore(id: string): Promise<Store | undefined>;
  getStoresByUserId(userId: string): Promise<Store[]>;
  createStore(store: InsertStore): Promise<Store>;
  updateStore(id: string, updates: Partial<Store>): Promise<Store | undefined>;
  deleteStore(id: string): Promise<boolean>;

  // Popup Configs
  getPopupConfig(storeId: string): Promise<PopupConfig | undefined>;
  createPopupConfig(config: InsertPopupConfig): Promise<PopupConfig>;
  updatePopupConfig(storeId: string, updates: Partial<PopupConfig>): Promise<PopupConfig | undefined>;

  // Subscribers
  getSubscriber(id: string): Promise<Subscriber | undefined>;
  getSubscriberByEmail(storeId: string, email: string): Promise<Subscriber | undefined>;
  getSubscribersByStoreId(storeId: string): Promise<Subscriber[]>;
  createSubscriber(subscriber: InsertSubscriber): Promise<Subscriber>;
  updateSubscriber(id: string, updates: Partial<Subscriber>): Promise<Subscriber | undefined>;
  deleteSubscriber(id: string): Promise<{ sessionId?: string } | null>;
  getSubscriberStats(storeId?: string): Promise<{
    total: number;
    active: number;
    unsubscribed: number;
    couponsUsed: number;
  }>;

  // Email Settings
  getEmailSettings(storeId: string): Promise<EmailSettings | undefined>;
  createEmailSettings(settings: InsertEmailSettings): Promise<EmailSettings>;
  updateEmailSettings(storeId: string, updates: Partial<EmailSettings>): Promise<EmailSettings | undefined>;

  // User Preferences  
  getUserPreferences(userId: string): Promise<UserPreferences | undefined>;
  createUserPreferences(preferences: InsertUserPreferences): Promise<UserPreferences>;
  updateUserPreferences(userId: string, updates: Partial<UserPreferences>): Promise<UserPreferences | undefined>;

  // Email Templates
  getEmailTemplate(storeId: string): Promise<EmailTemplate | undefined>;
  createEmailTemplate(template: InsertEmailTemplate): Promise<EmailTemplate>;
  updateEmailTemplate(storeId: string, updates: UpdateEmailTemplate): Promise<EmailTemplate | undefined>;

  // Email Click Tracking
  createEmailClickTracking(tracking: InsertEmailClickTracking): Promise<EmailClickTracking>;
  recordEmailClick(trackingId: string, ipAddress?: string, userAgent?: string): Promise<void>;
  getEmailClickStats(storeId: string): Promise<{clickRate: number; totalEmails: number; totalClicks: number}>;
  getEmailClicksByStore(storeId: string): Promise<EmailClickTracking[]>;
  getEmailClickTrackingById(id: string): Promise<EmailClickTracking | undefined>;
  deleteEmailClickTracking(id: string): Promise<boolean>;
  bulkDeleteEmailClickTracking(ids: string[]): Promise<number>;
  deleteEmailClickTrackingByEmail(email: string, storeId: string): Promise<boolean>;
}

export class DatabaseStorage implements IStorage {
  // Users
  async getUser(id: string): Promise<User | undefined> {
    const [user] = await db.select().from(users).where(eq(users.id, id));
    return user || undefined;
  }

  async getUserByEmail(email: string): Promise<User | undefined> {
    const [user] = await db.select().from(users).where(eq(users.email, email));
    return user || undefined;
  }

  async createUser(insertUser: InsertUser): Promise<User> {
    const userData = { ...insertUser };
    if (userData.password) {
      userData.password = await this.hashPassword(userData.password);
    }
    const [user] = await db.insert(users).values(userData).returning();
    return user;
  }

  async updateUser(id: string, updates: Partial<User>): Promise<User | undefined> {
    const updateData = { ...updates, updatedAt: new Date() };
    if (updateData.password) {
      updateData.password = await this.hashPassword(updateData.password);
    }
    const [updatedUser] = await db
      .update(users)
      .set(updateData)
      .where(eq(users.id, id))
      .returning();
    return updatedUser || undefined;
  }

  // Authentication
  async hashPassword(password: string): Promise<string> {
    const salt = randomBytes(32).toString('hex');
    const derivedKey = await scryptAsync(password, salt, 64) as Buffer;
    return `${salt}:${derivedKey.toString('hex')}`;
  }

  async verifyPassword(password: string, hashedPassword: string): Promise<boolean> {
    const [salt, key] = hashedPassword.split(':');
    const derivedKey = await scryptAsync(password, salt, 64) as Buffer;
    return timingSafeEqual(Buffer.from(key, 'hex'), derivedKey);
  }

  generateResetToken(): string {
    return randomBytes(32).toString('hex');
  }

  async createMemberInvitation(email: string, permissions: Record<string, boolean>): Promise<User> {
    const resetToken = this.generateResetToken();
    const resetTokenExpiry = new Date(Date.now() + 24 * 60 * 60 * 1000); // 24 hours
    
    // Extract username from email (before @ symbol)
    const username = email.split('@')[0];
    
    // Create temporary password that will be changed during setup
    const tempPassword = 'TEMP_' + resetToken.substring(0, 16);
    
    return await this.createUser({
      email,
      username,
      password: tempPassword,
      role: 'member',
      isActive: false,
      isEmailVerified: false,
      resetToken,
      resetTokenExpiry,
      permissions
    });
  }

  // Session management
  async createSession(userId: string): Promise<{ sessionId: string; expiresAt: Date }> {
    const sessionId = randomBytes(32).toString('hex');
    const expiresAt = new Date(Date.now() + 30 * 24 * 60 * 60 * 1000); // 30 days
    
    await db.insert(sessions).values({
      sid: sessionId,
      sess: { userId, expiresAt: expiresAt.toISOString() },
      expire: expiresAt
    });
    
    return { sessionId, expiresAt };
  }

  async getSession(sessionId: string): Promise<{ userId: string; expiresAt: Date } | undefined> {
    const [session] = await db.select().from(sessions).where(eq(sessions.sid, sessionId));
    if (!session || new Date() > session.expire) {
      if (session) {
        await this.deleteSession(sessionId);
      }
      return undefined;
    }
    
    const sessionData = session.sess as { userId: string; expiresAt: string };
    return {
      userId: sessionData.userId,
      expiresAt: new Date(sessionData.expiresAt)
    };
  }

  async deleteSession(sessionId: string): Promise<boolean> {
    const result = await db.delete(sessions).where(eq(sessions.sid, sessionId));
    return (result.rowCount || 0) > 0;
  }

  async cleanExpiredSessions(): Promise<void> {
    await db.delete(sessions).where(sql`expire < NOW()`);
  }

  // Additional user methods
  async getUsers(): Promise<User[]> {
    return await db.select().from(users).orderBy(desc(users.createdAt));
  }

  async deleteUser(id: string): Promise<boolean> {
    const result = await db.delete(users).where(eq(users.id, id));
    return (result.rowCount || 0) > 0;
  }

  // Stores
  async getStore(id: string): Promise<Store | undefined> {
    try {
      const [store] = await db.select().from(stores).where(eq(stores.id, id));
      return store || undefined;
    } catch (error: any) {
      if (error.code === '42703' || error.message?.includes('social_links')) {
        // Fallback for missing social_links column
        const result = await db.execute(sql`
          SELECT id, user_id as "userId", name, shopify_url as "shopifyUrl", 
                 shopify_store_name as "shopifyStoreName", custom_domain as "customDomain",
                 shopify_access_token as "shopifyAccessToken", is_connected as "isConnected",
                 is_verified as "isVerified", active_script_version as "activeScriptVersion",
                 active_script_timestamp as "activeScriptTimestamp", 
                 '{"linkedin":"","twitter":"","youtube":"","instagram":"","facebook":"","reddit":"","quora":""}'::jsonb as "socialLinks",
                 created_at as "createdAt", updated_at as "updatedAt"
          FROM stores WHERE id = ${id}
        `);
        const [store] = result.rows || result;
        return store as Store || undefined;
      }
      throw error;
    }
  }

  async getStoresByUserId(userId: string): Promise<Store[]> {
    try {
      return await db.select().from(stores).where(eq(stores.userId, userId)).orderBy(desc(stores.createdAt));
    } catch (error: any) {
      if (error.code === '42703' || error.message?.includes('social_links')) {
        // Fallback for missing social_links column
        const result = await db.execute(sql`
          SELECT id, user_id as "userId", name, shopify_url as "shopifyUrl", 
                 shopify_store_name as "shopifyStoreName", custom_domain as "customDomain",
                 shopify_access_token as "shopifyAccessToken", is_connected as "isConnected",
                 is_verified as "isVerified", active_script_version as "activeScriptVersion",
                 active_script_timestamp as "activeScriptTimestamp", 
                 '{"linkedin":"","twitter":"","youtube":"","instagram":"","facebook":"","reddit":"","quora":""}'::jsonb as "socialLinks",
                 created_at as "createdAt", updated_at as "updatedAt"
          FROM stores WHERE user_id = ${userId} ORDER BY created_at DESC
        `);
        return (result.rows || result) as Store[];
      }
      throw error;
    }
  }

  async createStore(store: InsertStore): Promise<Store> {
    const [newStore] = await db.insert(stores).values(store).returning();
    return newStore;
  }

  async updateStore(id: string, updates: Partial<Store>): Promise<Store | undefined> {
    const [updatedStore] = await db
      .update(stores)
      .set({ ...updates, updatedAt: new Date() })
      .where(eq(stores.id, id))
      .returning();
    return updatedStore || undefined;
  }

  async deleteStore(id: string): Promise<boolean> {
    const result = await db.delete(stores).where(eq(stores.id, id));
    return (result.rowCount || 0) > 0;
  }

  // Popup Configs
  async getPopupConfig(storeId: string): Promise<PopupConfig | undefined> {
    try {
      const [config] = await db.select().from(popupConfigs).where(eq(popupConfigs.storeId, storeId));
      return config || undefined;
    } catch (error) {
      // Handle missing column gracefully
      if (error instanceof Error && error.message.includes('show_exit_intent_if_not_subscribed')) {
        console.log('Using fallback query for missing column');
        const result = await db.execute(sql`
          SELECT id, store_id as "storeId", title, subtitle, button_text as "buttonText", 
                 fields, email_validation as "emailValidation", 
                 discount_code as "discountCode", discount_percentage as "discountPercentage", 
                 display_trigger as "displayTrigger", animation, 
                 suppress_after_subscription as "suppressAfterSubscription", 
                 is_active as "isActive", created_at as "createdAt", updated_at as "updatedAt",
                 COALESCE(show_exit_intent_if_not_subscribed, false) as "showExitIntentIfNotSubscribed"
          FROM popup_configs WHERE store_id = ${storeId}
        `);
        const rows = result.rows;
        return rows.length > 0 ? rows[0] as PopupConfig : undefined;
      }
      throw error;
    }
  }

  async createPopupConfig(config: InsertPopupConfig): Promise<PopupConfig> {
    const [newConfig] = await db.insert(popupConfigs).values(config).returning();
    return newConfig;
  }

  async updatePopupConfig(storeId: string, updates: Partial<PopupConfig>): Promise<PopupConfig | undefined> {
    try {
      const [updatedConfig] = await db
        .update(popupConfigs)
        .set({ ...updates, updatedAt: new Date() })
        .where(eq(popupConfigs.storeId, storeId))
        .returning();
      return updatedConfig || undefined;
    } catch (error) {
      // Handle missing column gracefully
      if (error instanceof Error && error.message.includes('show_exit_intent_if_not_subscribed')) {
        console.log('Using fallback update for missing column - removing new field');
        // Remove the new field from updates and proceed
        const { showExitIntentIfNotSubscribed, ...safeUpdates } = updates as any;
        
        // Build the update object without the missing column
        const updateData = { ...safeUpdates, updatedAt: new Date() };
        
        const [updatedConfig] = await db
          .update(popupConfigs)
          .set(updateData)
          .where(eq(popupConfigs.storeId, storeId))
          .returning();
        
        // Add the missing field back for the response with default value
        return updatedConfig ? { ...updatedConfig, showExitIntentIfNotSubscribed: showExitIntentIfNotSubscribed || false } : undefined;
      }
      throw error;
    }
  }

  // Subscribers
  async getSubscriber(id: string): Promise<Subscriber | undefined> {
    const [subscriber] = await db.select().from(subscribers).where(eq(subscribers.id, id));
    return subscriber || undefined;
  }

  async getSubscriberByEmail(storeId: string, email: string): Promise<Subscriber | undefined> {
    const [subscriber] = await db
      .select()
      .from(subscribers)
      .where(and(eq(subscribers.storeId, storeId), eq(subscribers.email, email)));
    return subscriber || undefined;
  }

  async getSubscribersByStoreId(storeId: string): Promise<Subscriber[]> {
    return await db
      .select()
      .from(subscribers)
      .where(and(eq(subscribers.storeId, storeId), eq(subscribers.isActive, true)))
      .orderBy(desc(subscribers.subscribedAt));
  }

  async createSubscriber(subscriber: InsertSubscriber): Promise<Subscriber> {
    const [newSubscriber] = await db.insert(subscribers).values(subscriber).returning();
    return newSubscriber;
  }

  async updateSubscriber(id: string, updates: Partial<Subscriber>): Promise<Subscriber | undefined> {
    const [updatedSubscriber] = await db
      .update(subscribers)
      .set(updates)
      .where(eq(subscribers.id, id))
      .returning();
    return updatedSubscriber || undefined;
  }

  async deleteSubscriber(id: string): Promise<{ sessionId?: string } | null> {
    // Get the subscriber first to retrieve session ID
    const subscriber = await this.getSubscriber(id);
    if (!subscriber) {
      return null;
    }

    // Delete the subscriber
    const result = await db.delete(subscribers).where(eq(subscribers.id, id));
    
    if ((result.rowCount || 0) > 0) {
      return { sessionId: subscriber.sessionId || undefined };
    }
    return null;
  }

  async getSubscriberStats(storeId?: string): Promise<{
    total: number;
    active: number;
    unsubscribed: number;
    couponsUsed: number;
  }> {
    const whereClause = storeId ? eq(subscribers.storeId, storeId) : undefined;
    
    const [totalResult] = await db
      .select({ count: count() })
      .from(subscribers)
      .where(whereClause);

    const [activeResult] = await db
      .select({ count: count() })
      .from(subscribers)
      .where(whereClause ? and(whereClause, eq(subscribers.isActive, true)) : eq(subscribers.isActive, true));

    const [unsubscribedResult] = await db
      .select({ count: count() })
      .from(subscribers)
      .where(whereClause ? and(whereClause, eq(subscribers.isActive, false)) : eq(subscribers.isActive, false));

    const [couponsUsedResult] = await db
      .select({ count: count() })
      .from(subscribers)
      .where(whereClause ? and(whereClause, eq(subscribers.discountCodeUsed, true)) : eq(subscribers.discountCodeUsed, true));

    return {
      total: activeResult.count, // Change to show only active subscribers in dashboard
      active: activeResult.count,
      unsubscribed: unsubscribedResult.count,
      couponsUsed: couponsUsedResult.count,
    };
  }

  // Email Settings
  async getEmailSettings(storeId: string): Promise<EmailSettings | undefined> {
    const [settings] = await db.select().from(emailSettings).where(eq(emailSettings.storeId, storeId));
    return settings || undefined;
  }

  async createEmailSettings(settings: InsertEmailSettings): Promise<EmailSettings> {
    const [newSettings] = await db.insert(emailSettings).values(settings).returning();
    return newSettings;
  }

  async updateEmailSettings(storeId: string, updates: Partial<EmailSettings>): Promise<EmailSettings | undefined> {
    const [updatedSettings] = await db
      .update(emailSettings)
      .set({ ...updates, updatedAt: new Date() })
      .where(eq(emailSettings.storeId, storeId))
      .returning();
    return updatedSettings || undefined;
  }

  // User Preferences
  async getUserPreferences(userId: string): Promise<UserPreferences | undefined> {
    const [preferences] = await db.select().from(userPreferences).where(eq(userPreferences.userId, userId));
    return preferences || undefined;
  }

  async createUserPreferences(preferences: InsertUserPreferences): Promise<UserPreferences> {
    const [newPreferences] = await db.insert(userPreferences).values(preferences).returning();
    return newPreferences;
  }

  async updateUserPreferences(userId: string, updates: Partial<UserPreferences>): Promise<UserPreferences | undefined> {
    const [updatedPreferences] = await db
      .update(userPreferences)
      .set({ ...updates, updatedAt: new Date() })
      .where(eq(userPreferences.userId, userId))
      .returning();
    return updatedPreferences || undefined;
  }

  // Email Templates
  async getEmailTemplate(storeId: string): Promise<EmailTemplate | undefined> {
    const [template] = await db
      .select()
      .from(emailTemplates)
      .where(eq(emailTemplates.storeId, storeId));
    return template || undefined;
  }

  async createEmailTemplate(template: InsertEmailTemplate): Promise<EmailTemplate> {
    const [newTemplate] = await db
      .insert(emailTemplates)
      .values(template)
      .returning();
    return newTemplate;
  }

  async updateEmailTemplate(storeId: string, updates: UpdateEmailTemplate): Promise<EmailTemplate | undefined> {
    const updateData = { ...updates, updatedAt: new Date() };
    const [updatedTemplate] = await db
      .update(emailTemplates)
      .set(updateData)
      .where(eq(emailTemplates.storeId, storeId))
      .returning();
    return updatedTemplate || undefined;
  }

  // Email Click Tracking
  async createEmailClickTracking(tracking: InsertEmailClickTracking): Promise<EmailClickTracking> {
    const [newTracking] = await db
      .insert(emailClickTracking)
      .values(tracking)
      .returning();
    return newTracking;
  }

  async recordEmailClick(trackingId: string, ipAddress?: string, userAgent?: string): Promise<void> {
    await db
      .update(emailClickTracking)
      .set({
        clickedAt: new Date(),
        isClicked: true,
        clickCount: sql`${emailClickTracking.clickCount} + 1`,
        ipAddress,
        userAgent,
      })
      .where(eq(emailClickTracking.trackingId, trackingId));
  }

  async getEmailClickStats(storeId: string): Promise<{clickRate: number; totalEmails: number; totalClicks: number}> {
    const [stats] = await db
      .select({
        totalEmails: count(emailClickTracking.id),
        totalClicks: count(sql`CASE WHEN ${emailClickTracking.isClicked} = true THEN 1 END`),
      })
      .from(emailClickTracking)
      .where(eq(emailClickTracking.storeId, storeId));
    
    const clickRate = stats.totalEmails > 0 ? (stats.totalClicks / stats.totalEmails) * 100 : 0;
    
    return {
      clickRate: Number(clickRate.toFixed(2)),
      totalEmails: stats.totalEmails,
      totalClicks: stats.totalClicks,
    };
  }

  async getEmailClicksByStore(storeId: string): Promise<EmailClickTracking[]> {
    return await db
      .select()
      .from(emailClickTracking)
      .where(eq(emailClickTracking.storeId, storeId))
      .orderBy(desc(emailClickTracking.createdAt));
  }

  async getEmailClickTracking(trackingId: string): Promise<EmailClickTracking | undefined> {
    const [tracking] = await db
      .select()
      .from(emailClickTracking)
      .where(eq(emailClickTracking.trackingId, trackingId))
      .limit(1);
    return tracking;
  }

  async getEmailClickTrackingById(id: string): Promise<EmailClickTracking | undefined> {
    const [tracking] = await db
      .select()
      .from(emailClickTracking)
      .where(eq(emailClickTracking.id, id))
      .limit(1);
    return tracking;
  }

  async deleteEmailClickTracking(id: string): Promise<boolean> {
    // Get the email analytics record to get subscriber email and store info
    const trackingRecord = await this.getEmailClickTrackingById(id);
    if (!trackingRecord) {
      return false;
    }

    // Delete the email analytics record
    const result = await db.delete(emailClickTracking).where(eq(emailClickTracking.id, id));
    
    if ((result.rowCount || 0) > 0) {
      // Also delete the subscriber with matching email in the same store
      const subscriber = await this.getSubscriberByEmail(trackingRecord.storeId, trackingRecord.subscriberEmail);
      if (subscriber) {
        await this.deleteSubscriber(subscriber.id);
      }
    }
    
    return (result.rowCount || 0) > 0;
  }

  async bulkDeleteEmailClickTracking(ids: string[]): Promise<number> {
    if (ids.length === 0) return 0;
    
    
    // First get all the tracking records to identify which subscribers to delete
    const trackingRecords = await db
      .select()
      .from(emailClickTracking)
      .where(inArray(emailClickTracking.id, ids));
    
    // Delete the email analytics records
    const result = await db.delete(emailClickTracking).where(
      inArray(emailClickTracking.id, ids)
    );
    
    const deletedCount = result.rowCount || 0;
    
    if (deletedCount > 0) {
      // Also delete associated subscribers
      for (const record of trackingRecords) {
        const subscriber = await this.getSubscriberByEmail(record.storeId, record.subscriberEmail);
        if (subscriber) {
          await this.deleteSubscriber(subscriber.id);
        }
      }
    }
    
    return deletedCount;
  }

  async deleteEmailClickTrackingByEmail(email: string, storeId: string): Promise<boolean> {
    const result = await db.delete(emailClickTracking).where(
      and(
        eq(emailClickTracking.subscriberEmail, email),
        eq(emailClickTracking.storeId, storeId)
      )
    );
    return (result.rowCount || 0) > 0;
  }
}

export const storage = new DatabaseStorage();
