import { sql, relations } from "drizzle-orm";
import { pgTable, text, varchar, timestamp, boolean, integer, jsonb, index } from "drizzle-orm/pg-core";
import { createInsertSchema } from "drizzle-zod";
import { z } from "zod";

export const sessions = pgTable(
  "sessions",
  {
    sid: varchar("sid").primaryKey(),
    sess: jsonb("sess").notNull(),
    expire: timestamp("expire").notNull(),
  },
  (table) => [index("IDX_session_expire").on(table.expire)],
);

export const users = pgTable("users", {
  id: varchar("id").primaryKey().default(sql`gen_random_uuid()`),
  email: text("email").notNull().unique(),
  password: text("password"),
  role: text("role").notNull().default("member"), // 'admin' or 'member'
  isActive: boolean("is_active").default(true).notNull(),
  isEmailVerified: boolean("is_email_verified").default(false).notNull(),
  resetToken: text("reset_token"),
  resetTokenExpiry: timestamp("reset_token_expiry"),
  lastLoginAt: timestamp("last_login_at"),
  permissions: jsonb("permissions").default({}), // For member permissions control
  createdAt: timestamp("created_at").defaultNow().notNull(),
  updatedAt: timestamp("updated_at").defaultNow().notNull(),
});

export const stores = pgTable("stores", {
  id: varchar("id").primaryKey().default(sql`gen_random_uuid()`),
  userId: varchar("user_id").notNull().references(() => users.id, { onDelete: "cascade" }),
  name: text("name").notNull(),
  shopifyUrl: text("shopify_url").notNull(),
  shopifyStoreName: text("shopify_store_name"), // Store name for .myshopify.com format
  customDomain: text("custom_domain"), // Custom domain URL
  shopifyAccessToken: text("shopify_access_token"),
  isConnected: boolean("is_connected").default(false).notNull(),
  isVerified: boolean("is_verified").default(false).notNull(),
  activeScriptVersion: text("active_script_version"), // Current active script version for verification
  activeScriptTimestamp: text("active_script_timestamp"), // Timestamp of current active script
  createdAt: timestamp("created_at").defaultNow().notNull(),
  updatedAt: timestamp("updated_at").defaultNow().notNull(),
});

export const popupConfigs = pgTable("popup_configs", {
  id: varchar("id").primaryKey().default(sql`gen_random_uuid()`),
  storeId: varchar("store_id").notNull().references(() => stores.id, { onDelete: "cascade" }),
  title: text("title").notNull().default("LOOKING FOR EXCLUSIVE OFFERS?"),
  subtitle: text("subtitle").notNull().default("Sign up with your business email ID to receive a one-time 15% discount code for your next order."),
  buttonText: text("button_text").notNull().default("SUBMIT"),
  fields: jsonb("fields").notNull().default({
    email: true,
    name: false,
    phone: false,
    company: false,
    address: false
  }),
  emailValidation: jsonb("email_validation").notNull().default({
    companyEmailsOnly: true,
    allowedDomains: [],
    blockedDomains: ["gmail.com", "yahoo.com", "hotmail.com", "outlook.com"]
  }),
  discountCode: text("discount_code").notNull().default("WELCOME15"),
  discountPercentage: integer("discount_percentage").notNull().default(15),
  displayTrigger: text("display_trigger").notNull().default("immediate"),
  animation: text("animation").notNull().default("slide-in"),
  showExitIntentIfNotSubscribed: boolean("show_exit_intent_if_not_subscribed").default(false).notNull(),
  suppressAfterSubscription: boolean("suppress_after_subscription").default(true).notNull(),
  isActive: boolean("is_active").default(true).notNull(),
  createdAt: timestamp("created_at").defaultNow().notNull(),
  updatedAt: timestamp("updated_at").defaultNow().notNull(),
});

export const subscribers = pgTable("subscribers", {
  id: varchar("id").primaryKey().default(sql`gen_random_uuid()`),
  storeId: varchar("store_id").notNull().references(() => stores.id, { onDelete: "cascade" }),
  email: text("email").notNull(),
  name: text("name"),
  phone: text("phone"),
  company: text("company"),
  address: text("address"),
  discountCodeSent: text("discount_code_sent"),
  discountCodeUsed: boolean("discount_code_used").default(false).notNull(),
  isActive: boolean("is_active").default(true).notNull(),
  subscribedAt: timestamp("subscribed_at").defaultNow().notNull(),
  unsubscribedAt: timestamp("unsubscribed_at"),
});

export const emailSettings = pgTable("email_settings", {
  id: varchar("id").primaryKey().default(sql`gen_random_uuid()`),
  userId: varchar("user_id").notNull().references(() => users.id, { onDelete: "cascade" }),
  smtpHost: text("smtp_host").notNull().default("smtp.gmail.com"),
  smtpPort: integer("smtp_port").notNull().default(587),
  fromEmail: text("from_email").notNull(),
  fromName: text("from_name").notNull(),
  smtpUsername: text("smtp_username").notNull(),
  smtpPassword: text("smtp_password").notNull(),
  isConfigured: boolean("is_configured").default(false).notNull(),
  createdAt: timestamp("created_at").defaultNow().notNull(),
  updatedAt: timestamp("updated_at").defaultNow().notNull(),
});

export const userPreferences = pgTable("user_preferences", {
  id: varchar("id").primaryKey().default(sql`gen_random_uuid()`),
  userId: varchar("user_id").notNull().references(() => users.id, { onDelete: "cascade" }),
  adminNotificationEmail: text("admin_notification_email").notNull().default("admin@foxxbioprocess.com"),
  enableAnalytics: boolean("enable_analytics").default(true).notNull(),
  sendWelcomeEmail: boolean("send_welcome_email").default(true).notNull(),
  enableDoubleOptIn: boolean("enable_double_opt_in").default(false).notNull(),
  validateDiscountCode: boolean("validate_discount_code").default(true).notNull(),
  notifyOnSubscriptions: boolean("notify_on_subscriptions").default(true).notNull(),
  dailySubscriberSummary: boolean("daily_subscriber_summary").default(false).notNull(),
  alertOnUnsubscribeRate: boolean("alert_on_unsubscribe_rate").default(true).notNull(),
  createdAt: timestamp("created_at").defaultNow().notNull(),
  updatedAt: timestamp("updated_at").defaultNow().notNull(),
});

// Relations
export const usersRelations = relations(users, ({ many }) => ({
  stores: many(stores),
  emailSettings: many(emailSettings),
  userPreferences: many(userPreferences),
}));

export const storesRelations = relations(stores, ({ one, many }) => ({
  user: one(users, {
    fields: [stores.userId],
    references: [users.id],
  }),
  popupConfig: one(popupConfigs),
  subscribers: many(subscribers),
}));

export const popupConfigsRelations = relations(popupConfigs, ({ one }) => ({
  store: one(stores, {
    fields: [popupConfigs.storeId],
    references: [stores.id],
  }),
}));

export const subscribersRelations = relations(subscribers, ({ one }) => ({
  store: one(stores, {
    fields: [subscribers.storeId],
    references: [stores.id],
  }),
}));

export const emailSettingsRelations = relations(emailSettings, ({ one }) => ({
  user: one(users, {
    fields: [emailSettings.userId],
    references: [users.id],
  }),
}));

export const userPreferencesRelations = relations(userPreferences, ({ one }) => ({
  user: one(users, {
    fields: [userPreferences.userId],
    references: [users.id],
  }),
}));

// Insert schemas
export const insertUserSchema = createInsertSchema(users).omit({ id: true, createdAt: true, updatedAt: true });
export const loginSchema = z.object({
  email: z.string().email("Invalid email address"),
  password: z.string().min(1, "Password is required"),
});
export const resetPasswordSchema = z.object({
  email: z.string().email("Invalid email address"),
});
export const setPasswordSchema = z.object({
  token: z.string().min(1, "Reset token is required"),
  password: z.string().min(8, "Password must be at least 8 characters"),
});
export const updatePermissionsSchema = z.object({
  permissions: z.record(z.boolean()),
});
export const insertStoreSchema = createInsertSchema(stores).omit({ id: true, createdAt: true, updatedAt: true });
export const insertPopupConfigSchema = createInsertSchema(popupConfigs).omit({ id: true, createdAt: true, updatedAt: true });
export const updatePopupConfigSchema = createInsertSchema(popupConfigs).omit({ id: true, storeId: true, createdAt: true, updatedAt: true }).partial();
export const insertSubscriberSchema = createInsertSchema(subscribers).omit({ id: true, subscribedAt: true });
export const insertEmailSettingsSchema = createInsertSchema(emailSettings).omit({ id: true, createdAt: true, updatedAt: true });
export const insertUserPreferencesSchema = createInsertSchema(userPreferences).omit({ id: true, createdAt: true, updatedAt: true });
export const updateUserPreferencesSchema = createInsertSchema(userPreferences).omit({ id: true, userId: true, createdAt: true, updatedAt: true }).partial();

// Types
export type Session = typeof sessions.$inferSelect;
export type User = typeof users.$inferSelect;
export type InsertUser = z.infer<typeof insertUserSchema>;
export type LoginData = z.infer<typeof loginSchema>;
export type ResetPasswordData = z.infer<typeof resetPasswordSchema>;
export type SetPasswordData = z.infer<typeof setPasswordSchema>;
export type UpdatePermissionsData = z.infer<typeof updatePermissionsSchema>;
export type Store = typeof stores.$inferSelect;
export type InsertStore = z.infer<typeof insertStoreSchema>;
export type PopupConfig = typeof popupConfigs.$inferSelect;
export type InsertPopupConfig = z.infer<typeof insertPopupConfigSchema>;
export type UpdatePopupConfig = z.infer<typeof updatePopupConfigSchema>;
export type Subscriber = typeof subscribers.$inferSelect;
export type InsertSubscriber = z.infer<typeof insertSubscriberSchema>;
export type EmailSettings = typeof emailSettings.$inferSelect;
export type InsertEmailSettings = z.infer<typeof insertEmailSettingsSchema>;
export type UserPreferences = typeof userPreferences.$inferSelect;
export type InsertUserPreferences = z.infer<typeof insertUserPreferencesSchema>;
export type UpdateUserPreferences = z.infer<typeof updateUserPreferencesSchema>;
