import { pgTable, text, serial, integer, boolean, jsonb, timestamp, varchar, index, decimal, bigint } from "drizzle-orm/pg-core";
import { createInsertSchema } from "drizzle-zod";
import { z } from "zod";

// Session storage table for OAuth authentication
export const sessions = pgTable(
  "sessions",
  {
    sid: varchar("sid").primaryKey(),
    sess: jsonb("sess").notNull(),
    expire: timestamp("expire").notNull(),
  },
  (table) => [index("IDX_session_expire").on(table.expire)],
);

// User storage table for OAuth authentication
export const users = pgTable("users", {
  id: varchar("id").primaryKey().notNull(), // OAuth provider user ID
  email: varchar("email").unique(),
  firstName: varchar("first_name"),
  lastName: varchar("last_name"),
  profileImageUrl: varchar("profile_image_url"),
  provider: varchar("provider"), // 'google' or 'facebook'
  isOnboarded: boolean("is_onboarded").default(false),
  createdAt: timestamp("created_at").defaultNow(),
  updatedAt: timestamp("updated_at").defaultNow(),
});

export const workflows = pgTable("workflows", {
  id: serial("id").primaryKey(),
  name: text("name").notNull(),
  userId: varchar("user_id").notNull(), // Changed to varchar to match OAuth user ID
  nodes: jsonb("nodes").notNull().default([]),
  edges: jsonb("edges").notNull().default([]),
  settings: jsonb("settings").default({}),
  createdAt: timestamp("created_at").defaultNow(),
  updatedAt: timestamp("updated_at").defaultNow(),
});

export const aiChats = pgTable("ai_chats", {
  id: serial("id").primaryKey(),
  workflowId: integer("workflow_id").notNull(),
  messages: jsonb("messages").notNull().default([]),
  createdAt: timestamp("created_at").defaultNow(),
});

export const userSettings = pgTable("user_settings", {
  id: serial("id").primaryKey(),
  userId: varchar("user_id").notNull(), // Changed to varchar to match OAuth user ID
  geminiApiKey: text("gemini_api_key"),
  geminiModel: text("gemini_model").default("gemini-2.0-flash-exp"),
  preferences: jsonb("preferences").default({}),
  tokensUsed: integer("tokens_used").default(0),
  estimatedCost: text("estimated_cost").default("$0.000000"),
});

// Subscription tiers
export const subscriptionTiers = pgTable("subscription_tiers", {
  id: serial("id").primaryKey(),
  name: varchar("name").notNull().unique(), // 'free', 'lite', 'pro', 'enterprise'
  displayName: varchar("display_name").notNull(), // 'Free', 'Lite', 'Pro', 'Enterprise'
  price: decimal("price", { precision: 10, scale: 2 }).notNull().default("0.00"),
  currency: varchar("currency").notNull().default("INR"),
  interval: varchar("interval").notNull().default("month"), // 'month', 'year'
  razorpayPlanIdMonthly: varchar("razorpay_plan_id_monthly"), // Razorpay monthly plan ID
  razorpayPlanIdYearly: varchar("razorpay_plan_id_yearly"), // Razorpay yearly plan ID
  features: jsonb("features").notNull().default({}),
  appTokens: integer("app_tokens").notNull().default(0), // Monthly app tokens
  maxVideoLength: integer("max_video_length").default(300), // seconds
  maxConcurrentJobs: integer("max_concurrent_jobs").default(1),
  aiCreditsPerMonth: integer("ai_credits_per_month").default(100),
  exportQuotaGB: decimal("export_quota_gb", { precision: 10, scale: 2 }).default("1.0"), // Monthly export quota in GB
  isActive: boolean("is_active").default(true),
  createdAt: timestamp("created_at").defaultNow(),
  updatedAt: timestamp("updated_at").defaultNow(),
});

// User subscriptions
export const userSubscriptions = pgTable("user_subscriptions", {
  id: serial("id").primaryKey(),
  userId: varchar("user_id").notNull(),
  tierId: integer("tier_id").notNull(),
  razorpayCustomerId: varchar("razorpay_customer_id"),
  razorpaySubscriptionId: varchar("razorpay_subscription_id"),
  razorpayPlanId: varchar("razorpay_plan_id"),
  status: varchar("status").notNull().default("active"), // 'active', 'cancelled', 'halted', 'completed'
  currentPeriodStart: timestamp("current_period_start"),
  currentPeriodEnd: timestamp("current_period_end"),
  cancelAtPeriodEnd: boolean("cancel_at_period_end").default(false),
  appTokensUsed: integer("app_tokens_used").default(0),
  appTokensRemaining: integer("app_tokens_remaining").default(0),
  exportUsedGB: decimal("export_used_gb", { precision: 10, scale: 3 }).default("0.000"), // Export usage in current period
  createdAt: timestamp("created_at").defaultNow(),
  updatedAt: timestamp("updated_at").defaultNow(),
});

// App token usage tracking
export const appTokenUsage = pgTable("app_token_usage", {
  id: serial("id").primaryKey(),
  userId: varchar("user_id").notNull(),
  subscriptionId: integer("subscription_id").notNull(),
  feature: varchar("feature").notNull(), // 'video_editing', 'ai_effects', 'exports', etc.
  tokensUsed: integer("tokens_used").notNull(),
  description: text("description"),
  metadata: jsonb("metadata").default({}),
  createdAt: timestamp("created_at").defaultNow(),
});

// Video export tracking
export const videoExports = pgTable("video_exports", {
  id: serial("id").primaryKey(),
  userId: varchar("user_id").notNull(),
  subscriptionId: integer("subscription_id").notNull(),
  filename: varchar("filename").notNull(),
  originalFilename: varchar("original_filename"),
  fileSizeBytes: bigint("file_size_bytes", { mode: "number" }).notNull(),
  fileSizeGB: decimal("file_size_gb", { precision: 10, scale: 3 }).notNull(),
  quality: varchar("quality").default("1080p"), // '720p', '1080p', '4K'
  format: varchar("format").default("mp4"), // 'mp4', 'mov', 'avi'
  duration: integer("duration_seconds"),
  metadata: jsonb("metadata").default({}),
  createdAt: timestamp("created_at").defaultNow(),
});

// Visual Remix Sessions table
export const visualRemixSessions = pgTable("visual_remix_sessions", {
  id: serial("id").primaryKey(),
  userId: varchar("user_id").notNull(),
  sessionName: varchar("session_name").notNull(),
  sessionData: jsonb("session_data").notNull().default({
    youtubeUrl: null,
    videoFile: null,
    videoAnalysis: null,
    subject: null,
    scene: null,
    style: null,
    scenes: [],
    storySequences: [],
    generatedImages: [],
    generatedVideos: [],
    settings: {}
  }),
  thumbnail: varchar("thumbnail"),
  lastAccessedAt: timestamp("last_accessed_at").defaultNow(),
  createdAt: timestamp("created_at").defaultNow(),
  updatedAt: timestamp("updated_at").defaultNow(),
});

// Visual Remix Gallery table for AI-generated items
export const visualRemixGallery = pgTable("visual_remix_gallery", {
  id: serial("id").primaryKey(),
  userId: varchar("user_id").notNull(),
  sessionId: integer("session_id"),
  type: varchar("type").notNull(), // 'image', 'video', 'scene', 'story'
  title: varchar("title").notNull(),
  description: text("description"),
  fileUrl: varchar("file_url").notNull(),
  thumbnailUrl: varchar("thumbnail_url"),
  prompt: text("prompt"),
  metadata: jsonb("metadata").default({}), // Additional data like dimensions, duration, etc.
  tags: text("tags").array().default([]),
  isPublic: boolean("is_public").default(false),
  createdAt: timestamp("created_at").defaultNow(),
});



// OAuth user schema for upsert operations
export const upsertUserSchema = createInsertSchema(users).pick({
  id: true,
  email: true,
  firstName: true,
  lastName: true,
  profileImageUrl: true,
  provider: true,
  isOnboarded: true,
});

export const insertWorkflowSchema = createInsertSchema(workflows).pick({
  name: true,
  nodes: true,
  edges: true,
  settings: true,
});

export const insertAiChatSchema = createInsertSchema(aiChats).pick({
  workflowId: true,
  messages: true,
});

export const insertUserSettingsSchema = createInsertSchema(userSettings).pick({
  userId: true,
  geminiApiKey: true,
  geminiModel: true,
  preferences: true,
  tokensUsed: true,
  estimatedCost: true,
});

export const insertSubscriptionTierSchema = createInsertSchema(subscriptionTiers).pick({
  name: true,
  displayName: true,
  price: true,
  currency: true,
  interval: true,
  razorpayPlanIdMonthly: true,
  razorpayPlanIdYearly: true,
  features: true,
  appTokens: true,
  maxVideoLength: true,
  maxConcurrentJobs: true,
  aiCreditsPerMonth: true,
  isActive: true,
});

export const insertUserSubscriptionSchema = createInsertSchema(userSubscriptions).pick({
  userId: true,
  tierId: true,
  razorpayCustomerId: true,
  razorpaySubscriptionId: true,
  razorpayPlanId: true,
  status: true,
  currentPeriodStart: true,
  currentPeriodEnd: true,
  cancelAtPeriodEnd: true,
  appTokensUsed: true,
  appTokensRemaining: true,
  exportUsedGB: true,
});

export const insertAppTokenUsageSchema = createInsertSchema(appTokenUsage).pick({
  userId: true,
  subscriptionId: true,
  feature: true,
  tokensUsed: true,
  description: true,
  metadata: true,
});

export const insertVisualRemixSessionSchema = createInsertSchema(visualRemixSessions).pick({
  userId: true,
  sessionName: true,
  sessionData: true,
  thumbnail: true,
});

export const insertVisualRemixGallerySchema = createInsertSchema(visualRemixGallery).pick({
  userId: true,
  sessionId: true,
  type: true,
  title: true,
  description: true,
  fileUrl: true,
  thumbnailUrl: true,
  prompt: true,
  metadata: true,
  tags: true,
  isPublic: true,
});



export type UpsertUser = z.infer<typeof upsertUserSchema>;
export type User = typeof users.$inferSelect;
export type InsertWorkflow = z.infer<typeof insertWorkflowSchema>;
export type Workflow = typeof workflows.$inferSelect;
export type InsertAiChat = z.infer<typeof insertAiChatSchema>;
export type AiChat = typeof aiChats.$inferSelect;
export type InsertUserSettings = z.infer<typeof insertUserSettingsSchema>;
export type UserSettings = typeof userSettings.$inferSelect;
export type InsertSubscriptionTier = z.infer<typeof insertSubscriptionTierSchema>;
export type SubscriptionTier = typeof subscriptionTiers.$inferSelect;
export type InsertUserSubscription = z.infer<typeof insertUserSubscriptionSchema>;
export type UserSubscription = typeof userSubscriptions.$inferSelect;
export type InsertAppTokenUsage = z.infer<typeof insertAppTokenUsageSchema>;
export type AppTokenUsage = typeof appTokenUsage.$inferSelect;
export type InsertVisualRemixSession = z.infer<typeof insertVisualRemixSessionSchema>;
export type VisualRemixSession = typeof visualRemixSessions.$inferSelect;
export type InsertVisualRemixGallery = z.infer<typeof insertVisualRemixGallerySchema>;
export type VisualRemixGallery = typeof visualRemixGallery.$inferSelect;

