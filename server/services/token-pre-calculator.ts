import { storage } from '../storage';

export interface TokenPreCalculation {
  estimatedInputTokens: number;
  estimatedOutputTokens: number;
  estimatedTotalTokens: number;
  estimatedCostDollars: number;
  estimatedAppTokens: number;
  operation: string;
  model: string;
}

export interface TokenValidation {
  hasEnoughTokens: boolean;
  userBalance: number;
  required: number;
  shortfall?: number;
  message?: string;
}

// Gemini pricing per 1M tokens (current rates)
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
    input: 0.075,  // Same as 1.5-flash
    output: 0.30
  },
  'gemini-2.5-flash': {
    input: 0.075,  // Same as 1.5-flash
    output: 0.30
  },
  'gemini-2.5-pro': {
    input: 3.50,   // Same as 1.5-pro
    output: 10.50
  }
};

export class TokenPreCalculator {
  
  // Enhanced token estimation for different content types
  static estimateTokens(content: string, contentType: 'text' | 'code' | 'structured' = 'text'): number {
    if (!content) return 0;
    
    let baseTokens: number;
    
    switch (contentType) {
      case 'code':
        // Code tends to have more tokens per character due to syntax
        baseTokens = Math.ceil(content.length / 3);
        break;
      case 'structured':
        // JSON, XML etc tend to be more token-dense
        baseTokens = Math.ceil(content.length / 3.5);
        break;
      default:
        // Regular text: ~4 characters per token
        baseTokens = Math.ceil(content.length / 4);
    }
    
    return Math.max(1, baseTokens);
  }

  // Estimate tokens for different video operations
  static estimateVideoAnalysisTokens(operation: string, videoDurationSeconds: number): TokenPreCalculation {
    const model = 'gemini-1.5-flash'; // Default model for video analysis
    let inputTokens = 0;
    let outputTokens = 0;

    switch (operation) {
      case 'video_search':
        // Base prompt + query + video processing overhead
        inputTokens = 200 + Math.ceil(videoDurationSeconds * 2); // ~2 tokens per second of video
        outputTokens = 150 + Math.ceil(videoDurationSeconds * 0.5); // Search results
        break;
        
      case 'caption_generation':
        // Transcription typically generates more output
        inputTokens = 150 + Math.ceil(videoDurationSeconds * 3);
        outputTokens = Math.ceil(videoDurationSeconds * 8); // ~8 tokens per second for transcription
        break;
        
      case 'video_translation':
        // Translation requires input + output in target language
        inputTokens = 300 + Math.ceil(videoDurationSeconds * 5);
        outputTokens = Math.ceil(videoDurationSeconds * 10);
        break;
        
      case 'video_analysis':
        // General video analysis
        inputTokens = 250 + Math.ceil(videoDurationSeconds * 1.5);
        outputTokens = 200 + Math.ceil(videoDurationSeconds * 2);
        break;
        
      default:
        // Default estimation
        inputTokens = 100 + Math.ceil(videoDurationSeconds * 1);
        outputTokens = 100 + Math.ceil(videoDurationSeconds * 1);
    }

    return this.calculateCostEstimate(operation, model, inputTokens, outputTokens);
  }

  // Estimate tokens for text-based operations
  static estimateTextOperationTokens(
    operation: string, 
    inputText: string, 
    model: string = 'gemini-1.5-flash',
    expectedOutputRatio: number = 1
  ): TokenPreCalculation {
    const inputTokens = this.estimateTokens(inputText);
    const outputTokens = Math.ceil(inputTokens * expectedOutputRatio);
    
    return this.calculateCostEstimate(operation, model, inputTokens, outputTokens);
  }

  // Calculate cost estimation
  static calculateCostEstimate(
    operation: string,
    model: string,
    inputTokens: number,
    outputTokens: number
  ): TokenPreCalculation {
    const pricing = GEMINI_PRICING[model as keyof typeof GEMINI_PRICING] || GEMINI_PRICING['gemini-1.5-flash'];
    
    const inputCost = (inputTokens / 1000000) * pricing.input;
    const outputCost = (outputTokens / 1000000) * pricing.output;
    const totalCost = inputCost + outputCost;
    
    // Convert to app tokens: 2000 tokens per $1
    const appTokens = totalCost > 0 ? Math.max(1, Math.ceil(totalCost * 2000)) : 0;

    return {
      estimatedInputTokens: inputTokens,
      estimatedOutputTokens: outputTokens,
      estimatedTotalTokens: inputTokens + outputTokens,
      estimatedCostDollars: totalCost,
      estimatedAppTokens: appTokens,
      operation,
      model
    };
  }

  // Check if user has enough tokens for operation
  static async validateUserTokens(userId: string, calculation: TokenPreCalculation): Promise<TokenValidation> {
    try {
      const subscription = await storage.getUserSubscription(userId);
      
      if (!subscription) {
        return {
          hasEnoughTokens: false,
          userBalance: 0,
          required: calculation.estimatedAppTokens,
          message: 'User subscription not found. Please check your account.'
        };
      }

      const userBalance = subscription.appTokensRemaining || 0;
      const required = calculation.estimatedAppTokens;
      const hasEnough = userBalance >= required;

      if (!hasEnough) {
        const shortfall = required - userBalance;
        return {
          hasEnoughTokens: false,
          userBalance,
          required,
          shortfall,
          message: `Insufficient tokens for ${calculation.operation}. Required: ${required} tokens, Available: ${userBalance} tokens. Need ${shortfall} more tokens.`
        };
      }

      return {
        hasEnoughTokens: true,
        userBalance,
        required,
        message: `✓ Sufficient tokens available for ${calculation.operation}. Cost: ${required} tokens.`
      };

    } catch (error) {
      console.error('Error validating user tokens:', error);
      return {
        hasEnoughTokens: false,
        userBalance: 0,
        required: calculation.estimatedAppTokens,
        message: 'Error checking token balance. Please try again.'
      };
    }
  }

  // Pre-validate operation with detailed breakdown
  static async preValidateOperation(
    userId: string,
    operation: string,
    parameters: {
      videoDurationSeconds?: number;
      inputText?: string;
      model?: string;
      expectedOutputRatio?: number;
    }
  ): Promise<{ calculation: TokenPreCalculation; validation: TokenValidation }> {
    
    let calculation: TokenPreCalculation;

    if (parameters.videoDurationSeconds !== undefined) {
      // Video-based operation
      calculation = this.estimateVideoAnalysisTokens(operation, parameters.videoDurationSeconds);
    } else if (parameters.inputText) {
      // Text-based operation
      calculation = this.estimateTextOperationTokens(
        operation,
        parameters.inputText,
        parameters.model || 'gemini-1.5-flash',
        parameters.expectedOutputRatio || 1
      );
    } else {
      // Default minimal operation
      calculation = this.calculateCostEstimate(operation, 'gemini-1.5-flash', 100, 100);
    }

    const validation = await this.validateUserTokens(userId, calculation);

    console.log(`[TokenPreCalculator] ${operation} pre-validation:`, {
      operation,
      model: calculation.model,
      estimatedTokens: calculation.estimatedTotalTokens,
      estimatedCost: `$${calculation.estimatedCostDollars.toFixed(6)}`,
      requiredAppTokens: calculation.estimatedAppTokens,
      userBalance: validation.userBalance,
      hasEnoughTokens: validation.hasEnoughTokens,
      message: validation.message
    });

    return { calculation, validation };
  }

  // Get detailed cost breakdown for user
  static getDetailedBreakdown(calculation: TokenPreCalculation): string {
    return `
Operation: ${calculation.operation}
Model: ${calculation.model}
Estimated Input Tokens: ${calculation.estimatedInputTokens.toLocaleString()}
Estimated Output Tokens: ${calculation.estimatedOutputTokens.toLocaleString()}
Total Tokens: ${calculation.estimatedTotalTokens.toLocaleString()}
Estimated Cost: $${calculation.estimatedCostDollars.toFixed(6)}
Required App Tokens: ${calculation.estimatedAppTokens}
`.trim();
  }

  // Track actual token usage and update user balance
  static async trackTokenUsage(userId: string, tokensUsed: number, operation: string): Promise<void> {
    try {
      // Validate tokensUsed input - prevent NaN from reaching database
      const validTokensUsed = isNaN(tokensUsed) ? 1 : Math.max(1, Math.floor(tokensUsed));
      console.log(`[TokenPreCalculator] Tracking ${validTokensUsed} tokens for user ${userId}, operation: ${operation}`);
      
      // Get current user subscription
      const user = await storage.getUser(userId);
      if (!user) {
        throw new Error('User not found for token tracking');
      }

      const subscription = await storage.getUserSubscription(userId);
      if (!subscription) {
        throw new Error('User subscription not found for token tracking');
      }

      // Calculate new token usage with validation
      const currentUsage = subscription.appTokensUsed || 0;
      const newTokensUsed = currentUsage + validTokensUsed;
      
      // Update subscription with new token usage
      await storage.updateUserSubscription(Number(subscription.id), {
        appTokensUsed: newTokensUsed
      });

      console.log(`[TokenPreCalculator] Successfully tracked tokens:`, {
        userId,
        operation,
        tokensUsed: validTokensUsed,
        previousUsage: subscription.appTokensUsed || 0,
        newUsage: newTokensUsed,
        tierLimit: subscription.tier?.appTokens || 0
      });

    } catch (error) {
      console.error('[TokenPreCalculator] Failed to track token usage:', error);
      // Don't throw error to avoid breaking the operation flow
    }
  }
}

export default TokenPreCalculator;