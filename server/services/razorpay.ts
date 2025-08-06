import Razorpay from 'razorpay';
import crypto from 'crypto';

if (!process.env.RAZORPAY_KEY_ID || !process.env.RAZORPAY_KEY_SECRET) {
  throw new Error('Missing required Razorpay API keys: RAZORPAY_KEY_ID and RAZORPAY_KEY_SECRET');
}

const razorpay = new Razorpay({
  key_id: process.env.RAZORPAY_KEY_ID,
  key_secret: process.env.RAZORPAY_KEY_SECRET,
});

export interface RazorpayPlan {
  id: string;
  period: 'daily' | 'weekly' | 'monthly' | 'yearly';
  interval: number;
  item: {
    id: string;
    name: string;
    amount: string | number; // in paise
    currency: string;
    description?: string;
  };
}

export interface RazorpaySubscription {
  id: string;
  plan_id: string;
  customer_notify?: number | boolean;
  quantity?: number;
  total_count?: number;
  start_at?: number;
  status: string;
  current_start?: number | null;
  current_end?: number | null;
  created_at: number;
}

export class RazorpayService {
  // Create a plan for a subscription tier
  async createPlan(name: string, amount: number, currency: string = 'INR', period: 'monthly' | 'yearly' = 'monthly'): Promise<RazorpayPlan> {
    try {
      const plan = await razorpay.plans.create({
        period: period,
        interval: 1,
        item: {
          name: name,
          amount: amount * 100, // Convert to paise
          currency: currency,
          description: `${name} subscription plan`
        }
      });
      return plan;
    } catch (error) {
      console.error('Error creating Razorpay plan:', error);
      throw new Error(`Failed to create Razorpay plan: ${error}`);
    }
  }

  // Get all plans
  async getPlans(): Promise<RazorpayPlan[]> {
    try {
      const response = await razorpay.plans.all();
      return response.items;
    } catch (error) {
      console.error('Error fetching Razorpay plans:', error);
      throw new Error(`Failed to fetch Razorpay plans: ${error}`);
    }
  }

  // Get a specific plan
  async getPlan(planId: string): Promise<RazorpayPlan> {
    try {
      const plan = await razorpay.plans.fetch(planId);
      return plan;
    } catch (error) {
      console.error('Error fetching Razorpay plan:', error);
      throw new Error(`Failed to fetch Razorpay plan: ${error}`);
    }
  }

  // Create a subscription with proper Razorpay flow
  async createSubscription(
    planId: string, 
    options: {
      totalCount?: number; // Number of billing cycles (for yearly: 12)
      customerEmail?: string;
      customerName?: string;
      expireBy?: number; // Unix timestamp
    } = {}
  ): Promise<RazorpaySubscription> {
    try {
      const subscriptionData: any = {
        plan_id: planId,
        customer_notify: true,
        quantity: 1,
      };

      // Add total count for billing cycles (required by Razorpay)
      // Default to 1 if not specified to avoid API errors
      subscriptionData.total_count = options.totalCount || 1;

      // Add expiry time only (removed start_at parameter as requested)
      if (options.expireBy) {
        subscriptionData.expire_by = options.expireBy;
      }

      // Add customer details in notes
      if (options.customerEmail || options.customerName) {
        subscriptionData.notes = {
          customer_email: options.customerEmail,
          customer_name: options.customerName
        };
      }

      const subscription = await razorpay.subscriptions.create(subscriptionData);
      return subscription as RazorpaySubscription;
    } catch (error) {
      console.error('Error creating Razorpay subscription:', error);
      throw new Error(`Failed to create Razorpay subscription: ${error}`);
    }
  }

  // Get subscription details
  async getSubscription(subscriptionId: string): Promise<RazorpaySubscription> {
    try {
      const subscription = await razorpay.subscriptions.fetch(subscriptionId);
      return subscription as RazorpaySubscription;
    } catch (error) {
      console.error('Error fetching Razorpay subscription:', error);
      throw new Error(`Failed to fetch Razorpay subscription: ${error}`);
    }
  }

  // Cancel a subscription
  async cancelSubscription(subscriptionId: string): Promise<RazorpaySubscription> {
    try {
      const subscription = await razorpay.subscriptions.cancel(subscriptionId);
      return subscription as RazorpaySubscription;
    } catch (error) {
      console.error('Error cancelling Razorpay subscription:', error);
      throw new Error(`Failed to cancel Razorpay subscription: ${error}`);
    }
  }

  // Verify payment signature for subscription
  verifySubscriptionPayment(
    razorpayPaymentId: string,
    subscriptionId: string,
    razorpaySignature: string
  ): boolean {
    try {
      // Create signature using razorpay_payment_id + "|" + subscription_id
      const generatedSignature = crypto
        .createHmac('sha256', process.env.RAZORPAY_KEY_SECRET!)
        .update(`${razorpayPaymentId}|${subscriptionId}`)
        .digest('hex');
      
      return generatedSignature === razorpaySignature;
    } catch (error) {
      console.error('Error verifying subscription payment signature:', error);
      return false;
    }
  }

  // Verify webhook signature
  verifyWebhookSignature(body: string, signature: string, secret: string): boolean {
    try {
      return Razorpay.validateWebhookSignature(body, signature, secret);
    } catch (error) {
      console.error('Error verifying webhook signature:', error);
      return false;
    }
  }
}

export const razorpayService = new RazorpayService();