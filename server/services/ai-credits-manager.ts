import { storage } from '../storage';
import type { 
  AiCredits, 
  InsertAiCredits, 
  AiCreditTransaction, 
  InsertAiCreditTransaction 
} from "@shared/schema";

export class AiCreditsManager {
  // Conversion rate: 10 credits = $1 USD
  private static readonly CREDITS_PER_DOLLAR = 10;

  /**
   * Initialize user AI credits record if it doesn't exist
   */
  static async initializeUserCredits(userId: string, initialCredits: number = 0): Promise<AiCredits> {
    try {
      // Check if user already has credits record
      const existingCredits = await storage.getUserCredits(userId);
      if (existingCredits) {
        return existingCredits;
      }

      // Create new credits record
      const newCredits = await storage.createUserCredits({
        userId,
        creditsBalance: initialCredits,
        creditsUsed: 0,
        lastTopup: new Date(),
      });

      return newCredits;
    } catch (error) {
      console.error('Failed to initialize user credits:', error);
      throw new Error('Could not initialize user credits');
    }
  }

  /**
   * Add credits to user account (for subscriptions, purchases, etc.)
   */
  static async addCredits(
    userId: string, 
    creditsToAdd: number, 
    description: string,
    metadata?: Record<string, any>
  ): Promise<AiCredits> {
    try {
      // Get current credits
      let userCredits = await storage.getUserCredits(userId);
      if (!userCredits) {
        userCredits = await this.initializeUserCredits(userId);
      }

      // Calculate new balance
      const newBalance = userCredits.creditsBalance + creditsToAdd;

      // Update credits record
      const updatedCredits = await storage.updateUserCredits(userId, {
        creditsBalance: newBalance,
        lastTopup: new Date(),
        updatedAt: new Date(),
      });

      // Record transaction
      await storage.createCreditTransaction({
        userId,
        type: 'topup',
        amount: creditsToAdd,
        description,
        balanceAfter: newBalance,
        metadata,
      });

      console.log(`💳 Added ${creditsToAdd} credits to user ${userId}. New balance: ${newBalance}`);
      return updatedCredits;
    } catch (error) {
      console.error('Failed to add credits:', error);
      throw new Error('Could not add credits to user account');
    }
  }

  /**
   * Check if user has sufficient credits for an AI action
   */
  static async checkSufficientCredits(userId: string, costInDollars: number): Promise<boolean> {
    try {
      const creditsRequired = Math.ceil(costInDollars * this.CREDITS_PER_DOLLAR);
      const userCredits = await storage.getUserCredits(userId);
      
      if (!userCredits) {
        return false;
      }

      return userCredits.creditsBalance >= creditsRequired;
    } catch (error) {
      console.error('Failed to check credits:', error);
      return false;
    }
  }

  /**
   * Deduct credits for AI action based on cost
   * This is the core function that implements: 10 credits deducted per $1 spent
   */
  static async deductCreditsForAiAction(
    userId: string,
    costInDollars: number,
    aiAction: string,
    description: string,
    metadata?: Record<string, any>
  ): Promise<{ success: boolean; newBalance: number; creditsDeducted: number }> {
    try {
      // Calculate credits to deduct (round up to ensure we never undercharge)
      const creditsToDeduct = Math.ceil(costInDollars * this.CREDITS_PER_DOLLAR);

      console.log(`💰 AI Action Cost: $${costInDollars.toFixed(6)} → ${creditsToDeduct} credits will be deducted`);

      // Get current credits
      let userCredits = await storage.getUserCredits(userId);
      if (!userCredits) {
        userCredits = await this.initializeUserCredits(userId);
      }

      // Check if sufficient credits
      if (userCredits.creditsBalance < creditsToDeduct) {
        console.log(`❌ Insufficient credits. Required: ${creditsToDeduct}, Available: ${userCredits.creditsBalance}`);
        return {
          success: false,
          newBalance: userCredits.creditsBalance,
          creditsDeducted: 0
        };
      }

      // Calculate new balances
      const newBalance = userCredits.creditsBalance - creditsToDeduct;
      const newCreditsUsed = userCredits.creditsUsed + creditsToDeduct;

      // Update credits record
      await storage.updateUserCredits(userId, {
        creditsBalance: newBalance,
        creditsUsed: newCreditsUsed,
        updatedAt: new Date(),
      });

      // Record transaction
      await storage.createCreditTransaction({
        userId,
        amount: creditsToDeduct,
        type: 'deduction',
        action: aiAction,
        description,
        balanceAfter: newBalance,
      });

      console.log(`✅ Deducted ${creditsToDeduct} credits for ${aiAction}. New balance: ${newBalance}`);
      
      return {
        success: true,
        newBalance,
        creditsDeducted: creditsToDeduct
      };
    } catch (error) {
      console.error('Failed to deduct credits:', error);
      throw new Error('Could not deduct credits for AI action');
    }
  }

  /**
   * Get user's current credit balance and usage stats
   */
  static async getUserCreditsSummary(userId: string): Promise<{
    balance: number;
    totalUsed: number;
    totalSpentDollars: number;
    lastTopup: Date | null;
  }> {
    try {
      const userCredits = await storage.getUserCredits(userId);
      if (!userCredits) {
        return {
          balance: 0,
          totalUsed: 0,
          totalSpentDollars: 0,
          lastTopup: null
        };
      }

      // Calculate total spent in dollars
      const totalSpentDollars = userCredits.creditsUsed / this.CREDITS_PER_DOLLAR;

      return {
        balance: userCredits.creditsBalance,
        totalUsed: userCredits.creditsUsed,
        totalSpentDollars,
        lastTopup: userCredits.lastTopup
      };
    } catch (error) {
      console.error('Failed to get credits summary:', error);
      throw new Error('Could not retrieve credits summary');
    }
  }

  /**
   * Get user's recent credit transactions
   */
  static async getUserTransactionHistory(
    userId: string, 
    limit: number = 20
  ): Promise<AiCreditTransaction[]> {
    try {
      return await storage.getUserCreditTransactions(userId, limit);
    } catch (error) {
      console.error('Failed to get transaction history:', error);
      throw new Error('Could not retrieve transaction history');
    }
  }

  /**
   * Convert dollar amount to credits
   */
  static convertDollarsToCredits(dollars: number): number {
    return Math.ceil(dollars * this.CREDITS_PER_DOLLAR);
  }

  /**
   * Convert credits to dollar amount
   */
  static convertCreditsToDollars(credits: number): number {
    return credits / this.CREDITS_PER_DOLLAR;
  }

  /**
   * Estimate credits needed for upcoming AI action
   */
  static estimateCreditsNeeded(estimatedCostInDollars: number): number {
    return this.convertDollarsToCredits(estimatedCostInDollars);
  }

  /**
   * Refund credits (for failed operations, cancellations, etc.)
   */
  static async refundCredits(
    userId: string,
    creditsToRefund: number,
    description: string,
    originalTransactionId?: number,
    metadata?: Record<string, any>
  ): Promise<AiCredits> {
    try {
      // Get current credits
      let userCredits = await storage.getUserCredits(userId);
      if (!userCredits) {
        userCredits = await this.initializeUserCredits(userId);
      }

      // Calculate new balance
      const newBalance = userCredits.creditsBalance + creditsToRefund;
      const newCreditsUsed = Math.max(0, userCredits.creditsUsed - creditsToRefund);

      // Update credits record
      const updatedCredits = await storage.updateUserCredits(userId, {
        creditsBalance: newBalance,
        creditsUsed: newCreditsUsed,
        updatedAt: new Date(),
      });

      // Record refund transaction
      await storage.createCreditTransaction({
        userId,
        type: 'refund',
        amount: creditsToRefund,
        description,
        balanceAfter: newBalance,
        metadata: {
          ...metadata,
          originalTransactionId
        },
      });

      console.log(`🔄 Refunded ${creditsToRefund} credits to user ${userId}. New balance: ${newBalance}`);
      return updatedCredits;
    } catch (error) {
      console.error('Failed to refund credits:', error);
      throw new Error('Could not refund credits');
    }
  }
}

export default AiCreditsManager;