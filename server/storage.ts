import {
  users, stores, popupConfigs, subscribers, emailSettings,
  type User, type InsertUser,
  type Store, type InsertStore,
  type PopupConfig, type InsertPopupConfig,
  type Subscriber, type InsertSubscriber,
  type EmailSettings, type InsertEmailSettings
} from "@shared/schema";
import { db } from "./db";
import { eq, and, desc, count } from "drizzle-orm";

export interface IStorage {
  // Users
  getUser(id: string): Promise<User | undefined>;
  getUserByUsername(username: string): Promise<User | undefined>;
  createUser(user: InsertUser): Promise<User>;

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
}

export class DatabaseStorage implements IStorage {
  // Users
  async getUser(id: string): Promise<User | undefined> {
    const [user] = await db.select().from(users).where(eq(users.id, id));
    return user || undefined;
  }

  async getUserByUsername(username: string): Promise<User | undefined> {
    const [user] = await db.select().from(users).where(eq(users.username, username));
    return user || undefined;
  }

  async createUser(insertUser: InsertUser): Promise<User> {
    const [user] = await db.insert(users).values(insertUser).returning();
    return user;
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
    const [config] = await db.select().from(popupConfigs).where(eq(popupConfigs.storeId, storeId));
    return config || undefined;
  }

  async createPopupConfig(config: InsertPopupConfig): Promise<PopupConfig> {
    const [newConfig] = await db.insert(popupConfigs).values(config).returning();
    return newConfig;
  }

  async updatePopupConfig(storeId: string, updates: Partial<PopupConfig>): Promise<PopupConfig | undefined> {
    const [updatedConfig] = await db
      .update(popupConfigs)
      .set({ ...updates, updatedAt: new Date() })
      .where(eq(popupConfigs.storeId, storeId))
      .returning();
    return updatedConfig || undefined;
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
      .where(eq(subscribers.storeId, storeId))
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
}

export const storage = new DatabaseStorage();
