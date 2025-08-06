import { storage } from '../storage';

export interface TokenUsage {
  action: string;
  model: string;
  inputTokens: number;
  outputTokens: number;
  totalTokens: number;
  estimatedCost: number;
  timestamp: Date;
}

// Gemini pricing per 1M tokens (as of 2024)
const GEMINI_PRICING = {
  'gemini-1.5-flash': {
    input: 0.075,  // $0.075 per 1M input tokens
    output: 0.30   // $0.30 per 1M output tokens
  },
  'gemini-1.5-pro': {
    input: 3.50,   // $3.50 per 1M input tokens  
    output: 10.50  // $10.50 per 1M output tokens
  },
  'gemini-2.0-flash-exp': {
    input: 0.075,  // Same as 1.5-flash for now
    output: 0.30
  }
};

export class TokenTracker {
  
  static estimateTokens(text: string): number {
    // Rough estimation: ~4 characters per token for English text
    return Math.ceil(text.length / 4);
  }

  static calculateCost(model: string, inputTokens: number, outputTokens: number): number {
    const pricing = GEMINI_PRICING[model as keyof typeof GEMINI_PRICING] || GEMINI_PRICING['gemini-1.5-flash'];
    
    const inputCost = (inputTokens / 1000000) * pricing.input;
    const outputCost = (outputTokens / 1000000) * pricing.output;
    
    return inputCost + outputCost;
  }

  // Convert dollar cost to app tokens: 1 token = $0.0005 (2,000 tokens per $1)
  static costToAppTokens(costInDollars: number): number {
    if (costInDollars <= 0) return 0;
    const tokens = Math.ceil(costInDollars / 0.0005); // 1 token = $0.0005
    return Math.max(1, tokens); // Minimum 1 token for any AI operation
  }

  static async deductAppTokensForAI(
    userId: string, 
    action: string, 
    model: string, 
    inputTokens: number, 
    outputTokens: number,
    description: string
  ): Promise<{ success: boolean; tokensDeducted: number; newBalance: number; cost: number }> {
    const totalTokens = inputTokens + outputTokens;
    const costInDollars = this.calculateCost(model, inputTokens, outputTokens);
    const appTokensToDeduct = this.costToAppTokens(costInDollars);

    console.log(`AI Operation - ${action}:`, {
      model,
      inputTokens,
      outputTokens, 
      totalTokens,
      cost: `$${costInDollars.toFixed(6)}`,
      appTokensToDeduct
    });

    // Check user's current app token balance
    const subscription = await storage.getUserSubscription(userId);
    console.log(`[TokenTracker] User ${userId} subscription:`, subscription);
    
    if (!subscription) {
      throw new Error('User subscription not found');
    }

    const currentBalance = (subscription.appTokensRemaining || 0);
    console.log(`[TokenTracker] Current balance calculation: ${subscription.appTokensRemaining} -> ${currentBalance}`);
    
    if (currentBalance < appTokensToDeduct) {
      throw new Error(`Insufficient app tokens. Required: ${appTokensToDeduct}, Available: ${currentBalance}`);
    }

    // Deduct app tokens from user's subscription
    const newTokensUsed = (subscription.appTokensUsed || 0) + appTokensToDeduct;
    const newRemaining = currentBalance - appTokensToDeduct;
    await storage.updateUserSubscription(subscription.id, {
      appTokensUsed: newTokensUsed,
      appTokensRemaining: newRemaining
    });

    // Record usage in app_token_usage table
    await storage.createAppTokenUsage({
      userId,
      subscriptionId: subscription.id,
      feature: action,
      tokensUsed: appTokensToDeduct,
      description: `${description} (AI Cost: $${costInDollars.toFixed(6)})`
    });

    const newBalance = newRemaining;

    console.log(`✅ Deducted ${appTokensToDeduct} app tokens for ${action}. New balance: ${newBalance}`);
    
    return {
      success: true,
      tokensDeducted: appTokensToDeduct,
      newBalance,
      cost: costInDollars
    };
  }

  // Track ALL Gemini API requests with precise $0.00005 per token consumption
  static async trackGeminiRequest(
    userId: number | string,
    action: string,
    model: string,
    inputText: string,
    outputText: string,
    actualUsage?: { inputTokens?: number; outputTokens?: number; totalTokens?: number }
  ): Promise<TokenUsage> {
    // Use actual token counts from API if available, otherwise estimate
    const inputTokens = actualUsage?.inputTokens || this.estimateTokens(inputText);
    const outputTokens = actualUsage?.outputTokens || this.estimateTokens(outputText);
    const totalTokens = actualUsage?.totalTokens || (inputTokens + outputTokens);
    
    console.log(`[TokenTracker] ${action} usage:`, {
      model,
      actualUsage: actualUsage ? 'from API' : 'estimated',
      inputTokens,
      outputTokens,
      totalTokens,
      inputText: inputText.substring(0, 100) + '...',
      outputText: outputText.substring(0, 100) + '...'
    });
    
    // Deduct app tokens for this AI operation
    await this.deductAppTokensForAI(
      userId.toString(),
      action,
      model,
      inputTokens,
      outputTokens,
      `${action} - ${model}`
    );

    return {
      action,
      model,
      inputTokens,
      outputTokens,
      totalTokens,
      estimatedCost: this.calculateCost(model, inputTokens, outputTokens),
      timestamp: new Date()
    };
  }

  // Legacy method for backward compatibility - now uses app tokens
  static async trackUsage(
    userId: number,
    action: string,
    model: string,
    inputText: string,
    outputText: string
  ): Promise<TokenUsage> {
    const inputTokens = this.estimateTokens(inputText);
    const outputTokens = this.estimateTokens(outputText);
    
    // Deduct app tokens for this AI operation
    await this.deductAppTokensForAI(
      userId.toString(),
      action,
      model,
      inputTokens,
      outputTokens,
      `${action} - ${model}`
    );

    return {
      action,
      model,
      inputTokens,
      outputTokens,
      totalTokens: inputTokens + outputTokens,
      estimatedCost: this.calculateCost(model, inputTokens, outputTokens),
      timestamp: new Date()
    };
  }
}

export default TokenTracker;