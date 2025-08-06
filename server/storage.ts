import { 
  users, 
  workflows, 
  aiChats, 
  userSettings, 
  subscriptionTiers,
  userSubscriptions,
  appTokenUsage,
  videoExports,
  visualRemixSessions,
  visualRemixGallery,
  type User, 
  type UpsertUser, 
  type Workflow, 
  type InsertWorkflow, 
  type AiChat, 
  type InsertAiChat, 
  type UserSettings, 
  type InsertUserSettings,
  type SubscriptionTier,
  type InsertSubscriptionTier,
  type UserSubscription,
  type InsertUserSubscription,
  type AppTokenUsage,
  type InsertAppTokenUsage,
  type VisualRemixSession,
  type InsertVisualRemixSession,
  type VisualRemixGallery,
  type InsertVisualRemixGallery,
} from "@shared/schema";
import { db } from "./db";
import { eq, desc, and } from "drizzle-orm";

export interface IStorage {
  // User methods (updated for OAuth)
  getUser(id: string): Promise<User | undefined>;
  upsertUser(user: UpsertUser): Promise<User>;
  
  // Workflow methods
  getWorkflow(id: number): Promise<Workflow | undefined>;
  getWorkflowsByUserId(userId: string): Promise<Workflow[]>;
  createWorkflow(workflow: InsertWorkflow & { userId: string }): Promise<Workflow>;
  updateWorkflow(id: number, workflow: Partial<InsertWorkflow>): Promise<Workflow | undefined>;
  deleteWorkflow(id: number): Promise<boolean>;
  
  // AI Chat methods
  getAiChat(workflowId: number): Promise<AiChat | undefined>;
  createAiChat(chat: InsertAiChat): Promise<AiChat>;
  updateAiChat(workflowId: number, messages: any[]): Promise<AiChat | undefined>;
  
  // User Settings methods
  getUserSettings(userId: string): Promise<UserSettings | undefined>;
  createUserSettings(settings: InsertUserSettings & { userId: string }): Promise<UserSettings>;
  updateUserSettings(userId: string, settings: Partial<InsertUserSettings>): Promise<UserSettings | undefined>;
  
  // Subscription Tier methods
  getSubscriptionTiers(): Promise<SubscriptionTier[]>;
  getSubscriptionTier(id: number): Promise<SubscriptionTier | undefined>;
  getSubscriptionTierByName(name: string): Promise<SubscriptionTier | undefined>;
  createSubscriptionTier(tier: InsertSubscriptionTier): Promise<SubscriptionTier>;
  updateSubscriptionTier(id: number, tier: Partial<InsertSubscriptionTier>): Promise<SubscriptionTier | undefined>;
  
  // User Subscription methods
  getUserSubscription(userId: string): Promise<UserSubscription | undefined>;
  createUserSubscription(subscription: InsertUserSubscription): Promise<UserSubscription>;
  updateUserSubscription(id: number, subscription: Partial<InsertUserSubscription>): Promise<UserSubscription | undefined>;
  cancelUserSubscription(userId: string): Promise<boolean>;
  
  // App Token Usage methods
  getAppTokenUsage(userId: string, limit?: number): Promise<AppTokenUsage[]>;
  createAppTokenUsage(usage: InsertAppTokenUsage): Promise<AppTokenUsage>;
  getUserAppTokenBalance(userId: string): Promise<{ used: number; remaining: number; total: number }>;
  consumeAppTokens(userId: string, feature: string, tokensUsed: number, description?: string): Promise<boolean>;
  
  // Export Quota methods
  getExportQuota(userId: string): Promise<{ used: number; total: number; remaining: number }>;
  trackVideoExport(userId: string, exportData: {
    filename: string;
    originalFilename?: string;
    fileSizeBytes: number;
    quality?: string;
    format?: string;
    duration?: number;
    metadata?: any;
  }): Promise<boolean>;
  
  // Visual Remix Session methods
  getVisualRemixSessions(userId: string): Promise<VisualRemixSession[]>;
  getVisualRemixSession(id: number): Promise<VisualRemixSession | undefined>;
  createVisualRemixSession(session: InsertVisualRemixSession): Promise<VisualRemixSession>;
  updateVisualRemixSession(id: number, session: Partial<InsertVisualRemixSession>): Promise<VisualRemixSession | undefined>;
  deleteVisualRemixSession(id: number): Promise<boolean>;
  
  // Visual Remix Gallery methods
  getVisualRemixGallery(userId: string, type?: string, sessionId?: number): Promise<VisualRemixGallery[]>;
  getVisualRemixGalleryItem(id: number): Promise<VisualRemixGallery | undefined>;
  addToVisualRemixGallery(item: InsertVisualRemixGallery): Promise<VisualRemixGallery>;
  deleteFromVisualRemixGallery(id: number): Promise<boolean>;
}

export class MemStorage implements IStorage {
  private users: Map<string, User>;
  private workflows: Map<number, Workflow>;
  private aiChats: Map<number, AiChat>;
  private userSettings: Map<string, UserSettings>;
  private currentWorkflowId: number;
  private currentChatId: number;
  private currentSettingsId: number;

  constructor() {
    this.users = new Map();
    this.workflows = new Map();
    this.aiChats = new Map();
    this.userSettings = new Map();
    this.currentWorkflowId = 1;
    this.currentChatId = 1;
    this.currentSettingsId = 1;
  }

  // User methods (OAuth-compatible)
  async getUser(id: string): Promise<User | undefined> {
    return this.users.get(id);
  }

  async upsertUser(userData: UpsertUser): Promise<User> {
    const now = new Date();
    const existingUser = this.users.get(userData.id!);
    
    const user: User = {
      ...userData,
      id: userData.id!,
      createdAt: existingUser?.createdAt || now,
      updatedAt: now,
    };
    
    this.users.set(userData.id!, user);
    return user;
  }

  // Workflow methods
  async getWorkflow(id: number): Promise<Workflow | undefined> {
    return this.workflows.get(id);
  }

  async getWorkflowsByUserId(userId: string): Promise<Workflow[]> {
    return Array.from(this.workflows.values()).filter(
      (workflow) => workflow.userId === userId,
    );
  }

  async createWorkflow(workflow: InsertWorkflow & { userId: string }): Promise<Workflow> {
    const id = this.currentWorkflowId++;
    const now = new Date();
    const newWorkflow: Workflow = { 
      ...workflow, 
      id,
      createdAt: now,
      updatedAt: now
    };
    this.workflows.set(id, newWorkflow);
    return newWorkflow;
  }

  async updateWorkflow(id: number, workflow: Partial<InsertWorkflow>): Promise<Workflow | undefined> {
    const existing = this.workflows.get(id);
    if (!existing) return undefined;
    
    const updated: Workflow = { 
      ...existing, 
      ...workflow,
      updatedAt: new Date()
    };
    this.workflows.set(id, updated);
    return updated;
  }

  async deleteWorkflow(id: number): Promise<boolean> {
    return this.workflows.delete(id);
  }

  // AI Chat methods
  async getAiChat(workflowId: number): Promise<AiChat | undefined> {
    return Array.from(this.aiChats.values()).find(
      (chat) => chat.workflowId === workflowId,
    );
  }

  async createAiChat(chat: InsertAiChat): Promise<AiChat> {
    const id = this.currentChatId++;
    const newChat: AiChat = { 
      ...chat, 
      id,
      createdAt: new Date()
    };
    this.aiChats.set(id, newChat);
    return newChat;
  }

  async updateAiChat(workflowId: number, messages: any[]): Promise<AiChat | undefined> {
    const existing = Array.from(this.aiChats.values()).find(
      (chat) => chat.workflowId === workflowId,
    );
    if (!existing) return undefined;
    
    const updated: AiChat = { 
      ...existing, 
      messages
    };
    this.aiChats.set(existing.id, updated);
    return updated;
  }

  // User Settings methods
  async getUserSettings(userId: string): Promise<UserSettings | undefined> {
    return this.userSettings.get(userId);
  }

  async createUserSettings(settings: InsertUserSettings & { userId: string }): Promise<UserSettings> {
    const id = this.currentSettingsId++;
    const newSettings: UserSettings = { 
      ...settings, 
      id,
      tokensUsed: settings.tokensUsed || 0,
      estimatedCost: settings.estimatedCost || "$0.00"
    };
    this.userSettings.set(settings.userId, newSettings);
    return newSettings;
  }

  async updateUserSettings(userId: string, settings: Partial<InsertUserSettings>): Promise<UserSettings | undefined> {
    const existing = this.userSettings.get(userId);
    if (!existing) return undefined;
    
    const updated: UserSettings = { ...existing, ...settings };
    this.userSettings.set(userId, updated);
    return updated;
  }
}

// Database Storage Implementation
export class DatabaseStorage implements IStorage {
  async getUser(id: string): Promise<User | undefined> {
    const [user] = await db.select().from(users).where(eq(users.id, id));
    return user || undefined;
  }

  async upsertUser(userData: UpsertUser): Promise<User> {
    const [user] = await db
      .insert(users)
      .values(userData)
      .onConflictDoUpdate({
        target: users.id,
        set: {
          ...userData,
          updatedAt: new Date(),
        },
      })
      .returning();
    return user;
  }

  async getWorkflow(id: number): Promise<Workflow | undefined> {
    const [workflow] = await db.select().from(workflows).where(eq(workflows.id, id));
    return workflow || undefined;
  }

  async getWorkflowsByUserId(userId: string): Promise<Workflow[]> {
    return await db.select().from(workflows).where(eq(workflows.userId, userId));
  }

  async createWorkflow(workflow: InsertWorkflow & { userId: string }): Promise<Workflow> {
    const [newWorkflow] = await db
      .insert(workflows)
      .values({
        ...workflow,
        createdAt: new Date(),
        updatedAt: new Date()
      })
      .returning();
    return newWorkflow;
  }

  async updateWorkflow(id: number, workflow: Partial<InsertWorkflow>): Promise<Workflow | undefined> {
    const [updated] = await db
      .update(workflows)
      .set({
        ...workflow,
        updatedAt: new Date()
      })
      .where(eq(workflows.id, id))
      .returning();
    return updated || undefined;
  }

  async deleteWorkflow(id: number): Promise<boolean> {
    const result = await db.delete(workflows).where(eq(workflows.id, id));
    return result.rowCount > 0;
  }

  async getAiChat(workflowId: number): Promise<AiChat | undefined> {
    const [chat] = await db.select().from(aiChats).where(eq(aiChats.workflowId, workflowId));
    return chat || undefined;
  }

  async createAiChat(chat: InsertAiChat): Promise<AiChat> {
    const [newChat] = await db
      .insert(aiChats)
      .values({
        ...chat,
        createdAt: new Date()
      })
      .returning();
    return newChat;
  }

  async updateAiChat(workflowId: number, messages: any[]): Promise<AiChat | undefined> {
    const [updated] = await db
      .update(aiChats)
      .set({ messages })
      .where(eq(aiChats.workflowId, workflowId))
      .returning();
    return updated || undefined;
  }

  async getUserSettings(userId: string): Promise<UserSettings | undefined> {
    const [settings] = await db.select().from(userSettings).where(eq(userSettings.userId, userId));
    return settings || undefined;
  }

  async createUserSettings(settings: InsertUserSettings & { userId: string }): Promise<UserSettings> {
    const [newSettings] = await db
      .insert(userSettings)
      .values(settings)
      .returning();
    return newSettings;
  }

  async updateUserSettings(userId: string, settings: Partial<InsertUserSettings>): Promise<UserSettings | undefined> {
    const [updated] = await db
      .update(userSettings)
      .set(settings)
      .where(eq(userSettings.userId, userId))
      .returning();
    return updated || undefined;
  }

  // Subscription Tier methods
  async getSubscriptionTiers(): Promise<SubscriptionTier[]> {
    return await db.select().from(subscriptionTiers);
  }

  async getSubscriptionTier(id: number): Promise<SubscriptionTier | undefined> {
    const [tier] = await db.select().from(subscriptionTiers).where(eq(subscriptionTiers.id, id));
    return tier || undefined;
  }

  async getSubscriptionTierByName(name: string): Promise<SubscriptionTier | undefined> {
    const [tier] = await db.select().from(subscriptionTiers).where(eq(subscriptionTiers.name, name));
    return tier || undefined;
  }

  async createSubscriptionTier(tier: InsertSubscriptionTier): Promise<SubscriptionTier> {
    const [newTier] = await db
      .insert(subscriptionTiers)
      .values({
        ...tier,
        createdAt: new Date(),
        updatedAt: new Date()
      })
      .returning();
    return newTier;
  }

  async updateSubscriptionTier(id: number, tier: Partial<InsertSubscriptionTier>): Promise<SubscriptionTier | undefined> {
    const [updated] = await db
      .update(subscriptionTiers)
      .set({
        ...tier,
        updatedAt: new Date()
      })
      .where(eq(subscriptionTiers.id, id))
      .returning();
    return updated || undefined;
  }

  // User Subscription methods
  async getUserSubscription(userId: string): Promise<(UserSubscription & { tier: SubscriptionTier }) | undefined> {
    console.log(`[Storage] Looking for active subscription for user: ${userId}`);
    
    const [result] = await db
      .select({
        id: userSubscriptions.id,
        userId: userSubscriptions.userId,
        tierId: userSubscriptions.tierId,
        razorpayCustomerId: userSubscriptions.razorpayCustomerId,
        razorpaySubscriptionId: userSubscriptions.razorpaySubscriptionId,
        razorpayPlanId: userSubscriptions.razorpayPlanId,
        status: userSubscriptions.status,
        currentPeriodStart: userSubscriptions.currentPeriodStart,
        currentPeriodEnd: userSubscriptions.currentPeriodEnd,
        cancelAtPeriodEnd: userSubscriptions.cancelAtPeriodEnd,
        appTokensUsed: userSubscriptions.appTokensUsed,
        appTokensRemaining: userSubscriptions.appTokensRemaining,
        exportUsedGB: userSubscriptions.exportUsedGB,
        createdAt: userSubscriptions.createdAt,
        updatedAt: userSubscriptions.updatedAt,
        tier: subscriptionTiers
      })
      .from(userSubscriptions)
      .leftJoin(subscriptionTiers, eq(userSubscriptions.tierId, subscriptionTiers.id))
      .where(
        and(
          eq(userSubscriptions.userId, userId),
          eq(userSubscriptions.status, 'active')
        )
      )
      .orderBy(desc(userSubscriptions.createdAt))
      .limit(1);
    
    console.log(`[Storage] Found subscription:`, result);
    console.log(`[Storage] App tokens remaining:`, result?.appTokensRemaining);
    
    return result || undefined;
  }

  async createUserSubscription(subscription: InsertUserSubscription): Promise<UserSubscription> {
    const [newSubscription] = await db
      .insert(userSubscriptions)
      .values({
        ...subscription,
        createdAt: new Date(),
        updatedAt: new Date()
      })
      .returning();
    return newSubscription;
  }

  async updateUserSubscription(id: number, subscription: Partial<InsertUserSubscription>): Promise<UserSubscription | undefined> {
    const [updated] = await db
      .update(userSubscriptions)
      .set({
        ...subscription,
        updatedAt: new Date()
      })
      .where(eq(userSubscriptions.id, id))
      .returning();
    return updated || undefined;
  }

  async cancelUserSubscription(userId: string): Promise<boolean> {
    const result = await db
      .update(userSubscriptions)
      .set({
        status: 'cancelled',
        cancelAtPeriodEnd: true,
        updatedAt: new Date()
      })
      .where(eq(userSubscriptions.userId, userId));
    return result.rowCount > 0;
  }

  // App Token Usage methods
  async getAppTokenUsage(userId: string, limit?: number): Promise<AppTokenUsage[]> {
    let query = db.select().from(appTokenUsage).where(eq(appTokenUsage.userId, userId));
    if (limit) {
      query = query.limit(limit);
    }
    return await query;
  }

  async createAppTokenUsage(usage: InsertAppTokenUsage): Promise<AppTokenUsage> {
    const [newUsage] = await db
      .insert(appTokenUsage)
      .values({
        ...usage,
        createdAt: new Date()
      })
      .returning();
    return newUsage;
  }

  async getUserAppTokenBalance(userId: string): Promise<{ used: number; remaining: number; total: number }> {
    // Get user's current subscription
    const subscription = await this.getUserSubscription(userId);
    if (!subscription) {
      // Default to free tier if no subscription
      const freeTier = await this.getSubscriptionTierByName('free');
      return {
        used: 0,
        remaining: freeTier?.appTokens || 2000, // Updated to 2000 tokens per $1
        total: freeTier?.appTokens || 2000
      };
    }

    const total = subscription.tier.appTokens || 0;
    const used = subscription.appTokensUsed || 0;
    const remaining = Math.max(0, total - used);

    return { used, remaining, total };
  }

  async getExportQuota(userId: string): Promise<{ used: number; total: number; remaining: number }> {
    const subscription = await this.getUserSubscription(userId);
    if (!subscription || !subscription.tier) {
      // Free tier default: 1GB
      return {
        used: 0,
        total: 1.0,
        remaining: 1.0
      };
    }

    const total = parseFloat(subscription.tier.exportQuotaGB?.toString() || "1.0");
    const used = parseFloat(subscription.exportUsedGB?.toString() || "0.0");
    const remaining = Math.max(0, total - used);

    return { used, remaining, total };
  }

  async trackVideoExport(userId: string, exportData: {
    filename: string;
    originalFilename?: string;
    fileSizeBytes: number;
    quality?: string;
    format?: string;
    duration?: number;
    metadata?: any;
  }): Promise<boolean> {
    console.log(`trackVideoExport called for user ${userId}, file size: ${exportData.fileSizeBytes} bytes`);
    
    const subscription = await this.getUserSubscription(userId);
    if (!subscription) {
      console.log('No subscription found for user');
      return false;
    }

    const fileSizeGB = exportData.fileSizeBytes / (1024 * 1024 * 1024); // Convert bytes to GB
    const currentUsed = parseFloat(subscription.exportUsedGB?.toString() || "0.0");
    const quotaLimit = parseFloat(subscription.tier?.exportQuotaGB?.toString() || "1.0");

    console.log(`Export tracking - File size: ${fileSizeGB.toFixed(6)}GB, Current used: ${currentUsed}GB, Quota limit: ${quotaLimit}GB`);

    // Check if export would exceed quota
    if (currentUsed + fileSizeGB > quotaLimit) {
      console.log('Export would exceed quota - rejecting');
      return false; // Export would exceed quota
    }

    try {
      // Record the export
      console.log('Recording export in videoExports table');
      await db.insert(videoExports).values({
        userId,
        subscriptionId: subscription.id,
        filename: exportData.filename,
        originalFilename: exportData.originalFilename,
        fileSizeBytes: exportData.fileSizeBytes,
        fileSizeGB: fileSizeGB.toFixed(3),
        quality: exportData.quality || "1080p",
        format: exportData.format || "mp4",
        duration: exportData.duration,
        metadata: exportData.metadata || {},
        createdAt: new Date()
      });

      // Update subscription export usage
      const newUsage = parseFloat((currentUsed + fileSizeGB).toFixed(3));
      console.log(`Updating subscription export usage from ${currentUsed}GB to ${newUsage}GB`);
      
      await this.updateUserSubscription(subscription.id, {
        exportUsedGB: newUsage
      });

      console.log('Export tracking completed successfully');
      return true;
    } catch (error) {
      console.error('Error in trackVideoExport:', error);
      return false;
    }
  }

  async consumeAppTokens(userId: string, feature: string, tokensUsed: number, description?: string): Promise<boolean> {
    const subscription = await this.getUserSubscription(userId);
    if (!subscription) return false;

    const currentUsed = subscription.appTokensUsed || 0;
    const totalTokens = subscription.appTokensRemaining || 0;

    if (currentUsed + tokensUsed > totalTokens) {
      return false; // Not enough tokens
    }

    // Update subscription token usage
    await this.updateUserSubscription(subscription.id, {
      appTokensUsed: currentUsed + tokensUsed
    });

    // Record the usage
    await this.createAppTokenUsage({
      userId,
      subscriptionId: subscription.id,
      feature,
      tokensUsed,
      description
    });

    return true;
  }
  
  // Visual Remix Session methods
  async getVisualRemixSessions(userId: string): Promise<VisualRemixSession[]> {
    return await db.select().from(visualRemixSessions).where(eq(visualRemixSessions.userId, userId));
  }
  
  async getVisualRemixSession(id: number): Promise<VisualRemixSession | undefined> {
    const [session] = await db.select().from(visualRemixSessions).where(eq(visualRemixSessions.id, id));
    return session || undefined;
  }
  
  async createVisualRemixSession(session: InsertVisualRemixSession): Promise<VisualRemixSession> {
    const [newSession] = await db
      .insert(visualRemixSessions)
      .values({
        ...session,
        createdAt: new Date(),
        updatedAt: new Date(),
        lastAccessedAt: new Date()
      })
      .returning();
    return newSession;
  }
  
  async updateVisualRemixSession(id: number, session: Partial<InsertVisualRemixSession>): Promise<VisualRemixSession | undefined> {
    const [updated] = await db
      .update(visualRemixSessions)
      .set({
        ...session,
        updatedAt: new Date(),
        lastAccessedAt: new Date()
      })
      .where(eq(visualRemixSessions.id, id))
      .returning();
    return updated || undefined;
  }
  
  async deleteVisualRemixSession(id: number): Promise<boolean> {
    const result = await db.delete(visualRemixSessions).where(eq(visualRemixSessions.id, id));
    return true;
  }
  
  // Visual Remix Gallery methods
  async getVisualRemixGallery(userId: string, type?: string, sessionId?: number): Promise<VisualRemixGallery[]> {
    let query = db.select().from(visualRemixGallery).where(eq(visualRemixGallery.userId, userId));
    
    if (type) {
      query = query.where(eq(visualRemixGallery.type, type));
    }
    
    if (sessionId) {
      query = query.where(eq(visualRemixGallery.sessionId, sessionId));
    }
    
    return await query;
  }
  
  async getVisualRemixGalleryItem(id: number): Promise<VisualRemixGallery | undefined> {
    const [item] = await db.select().from(visualRemixGallery).where(eq(visualRemixGallery.id, id));
    return item || undefined;
  }
  
  async addToVisualRemixGallery(item: InsertVisualRemixGallery): Promise<VisualRemixGallery> {
    const [newItem] = await db
      .insert(visualRemixGallery)
      .values({
        ...item,
        createdAt: new Date()
      })
      .returning();
    return newItem;
  }
  
  async deleteFromVisualRemixGallery(id: number): Promise<boolean> {
    await db.delete(visualRemixGallery).where(eq(visualRemixGallery.id, id));
    return true;
  }


}

export const storage = new DatabaseStorage();
