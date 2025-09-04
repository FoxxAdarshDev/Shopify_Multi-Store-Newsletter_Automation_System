import {
  users, stores, popupConfigs, subscribers, emailSettings, sessions, userPreferences,
  type User, type InsertUser, type Session,
  type Store, type InsertStore,
  type PopupConfig, type InsertPopupConfig,
  type Subscriber, type InsertSubscriber,
  type EmailSettings, type InsertEmailSettings,
  type UserPreferences, type InsertUserPreferences
} from "@shared/schema";
import { randomBytes, scrypt, timingSafeEqual } from 'crypto';
import { promisify } from 'util';

const scryptAsync = promisify(scrypt);
import { db } from "./db";
import { eq, and, desc, count, sql } from "drizzle-orm";

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
  getSubscriberStats(storeId?: string): Promise<{
    total: number;
    active: number;
    unsubscribed: number;
    couponsUsed: number;
  }>;

  // Email Settings
  getEmailSettings(userId: string): Promise<EmailSettings | undefined>;
  createEmailSettings(settings: InsertEmailSettings): Promise<EmailSettings>;
  updateEmailSettings(userId: string, updates: Partial<EmailSettings>): Promise<EmailSettings | undefined>;

  // User Preferences  
  getUserPreferences(userId: string): Promise<UserPreferences | undefined>;
  createUserPreferences(preferences: InsertUserPreferences): Promise<UserPreferences>;
  updateUserPreferences(userId: string, updates: Partial<UserPreferences>): Promise<UserPreferences | undefined>;
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
    
    return await this.createUser({
      email,
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
    return result.rowCount > 0;
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
    return result.rowCount > 0;
  }

  // Stores
  async getStore(id: string): Promise<Store | undefined> {
    const [store] = await db.select().from(stores).where(eq(stores.id, id));
    return store || undefined;
  }

  async getStoresByUserId(userId: string): Promise<Store[]> {
    return await db.select().from(stores).where(eq(stores.userId, userId)).orderBy(desc(stores.createdAt));
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
    return result.rowCount > 0;
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
                 false as "showExitIntentIfNotSubscribed"
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
      total: totalResult.count,
      active: activeResult.count,
      unsubscribed: unsubscribedResult.count,
      couponsUsed: couponsUsedResult.count,
    };
  }

  // Email Settings
  async getEmailSettings(userId: string): Promise<EmailSettings | undefined> {
    const [settings] = await db.select().from(emailSettings).where(eq(emailSettings.userId, userId));
    return settings || undefined;
  }

  async createEmailSettings(settings: InsertEmailSettings): Promise<EmailSettings> {
    const [newSettings] = await db.insert(emailSettings).values(settings).returning();
    return newSettings;
  }

  async updateEmailSettings(userId: string, updates: Partial<EmailSettings>): Promise<EmailSettings | undefined> {
    const [updatedSettings] = await db
      .update(emailSettings)
      .set({ ...updates, updatedAt: new Date() })
      .where(eq(emailSettings.userId, userId))
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
}

export const storage = new DatabaseStorage();
