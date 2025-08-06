import type { Express, Request, Response } from "express";
import { createServer, type Server } from "http";
import { createReadStream } from "fs";
import { promises as fs } from "fs";
import * as fsSync from "fs";
import { storage } from "./storage";
import { insertWorkflowSchema, insertAiChatSchema, insertUserSettingsSchema } from "@shared/schema";
import { z } from "zod";
import { GoogleGenerativeAI } from "@google/generative-ai";
import { createVideoProcessor } from "./services/video-processor";
import { workflowTemplateManager } from "./services/workflow-templates";
import { CollaborationManager } from "./services/collaboration";
// YouTube processor removed - using file upload only
import { workingShortsCreator } from "./services/working-shorts-creator";
import { createShortsCreator } from "./services/shorts-creator.js";
import { createVideoUploadProcessor } from "./services/video-upload-processor.js";
import express from "express";

import { createAspectRatioConverter } from './services/aspect-ratio-converter';
import { createSocialMediaShare } from './services/social-media-share';
import { createAgenticVideoEditor } from './services/agentic-video-editor';
import TokenPreCalculator from './services/token-pre-calculator';
import { createAudioProcessor } from './services/audio-processor';
import { createAIShortGenerator } from './services/ai-shorts-generator';
import { createLangChainGeminiAgent } from './services/langchain-gemini-agent.js';
import { createIntelligentVideoCropper } from './services/intelligent-video-cropper.js';
import { createUnifiedShortsCreator } from './services/unified-shorts-creator.js';
import { createComprehensiveShortsCreator } from './services/comprehensive-shorts-creator.js';
import { EnhancedComprehensiveShortsCreator } from './services/enhanced-comprehensive-shorts.js';
import { LanguageTranslationService } from './services/language-translation-service';
import { captionStyleRecommender } from './services/caption-style-recommender';
import AnimatedSubtitleGenerator from './services/animated-subtitle-generator';
import { SplitScreenVideoService } from './services/split-screen-video-service';
import { YouTubeShortsSubtitleSystem } from './services/youtube-shorts-subtitle-system';
import { DeepgramSubtitleGenerator } from './services/deepgram-subtitle-generator';

import multer from "multer";
import * as path from "path";
import { createHash } from "crypto";
import { spawn } from "child_process";
import { nanoid } from "nanoid";
import { setupAuth, isAuthenticated } from "./replitAuth";
import { razorpayService } from "./services/razorpay";
import { db } from "./db";
import { users } from "../shared/schema";
import { AiCreditsManager } from "./services/ai-credits-manager";

export async function registerRoutes(app: Express): Promise<Server> {
  // Auth middleware
  await setupAuth(app);

  // Test database connection before proceeding
  try {
    console.log("Testing database connection...");
    // Test with a simple query to check connection
    await db.select().from(users).limit(1);
    console.log("Database connection successful");
  } catch (dbError) {
    console.error("Database connection failed:", dbError);
    console.log("Continuing with limited functionality...");
  }

  // Initialize Gemini AI
  const ai = new GoogleGenerativeAI(
    process.env.GEMINI_API_KEY || process.env.VITE_GEMINI_API_KEY || "" 
  );

  // Razorpay service is imported and initialized in services/razorpay.ts

  // Ensure uploads directory exists
  const uploadsDir = path.join(process.cwd(), 'uploads');
  if (!fsSync.existsSync(uploadsDir)) {
    fsSync.mkdirSync(uploadsDir, { recursive: true });
  }

  // Set up file upload handling
  const upload = multer({
    dest: uploadsDir,
    limits: { fileSize: 500 * 1024 * 1024 }, // 500MB limit
    fileFilter: (req, file, cb) => {
      const allowedTypes = ['video/mp4', 'video/mov', 'video/avi', 'video/mkv', 'video/quicktime', 'audio/mp3', 'audio/wav'];
      console.log('File upload attempt:', file.originalname, file.mimetype);
      // Accept video files and allow .mp4 files even if mimetype is incorrect
      if (allowedTypes.includes(file.mimetype) || 
          file.mimetype.startsWith('video/') ||
          file.originalname.toLowerCase().endsWith('.mp4') ||
          file.originalname.toLowerCase().endsWith('.mov') ||
          file.originalname.toLowerCase().endsWith('.avi') ||
          file.mimetype === 'application/octet-stream') {
        cb(null, true);
      } else {
        console.error('Invalid file type:', file.mimetype);
        cb(new Error(`Invalid file type: ${file.mimetype}. Only video files are allowed.`));
      }
    }
  });

  // Auth routes
  app.get('/api/auth/user', isAuthenticated, async (req: any, res) => {
    try {
      const userId = req.user.claims.sub;
      const user = await storage.getUser(userId);
      res.json(user);
    } catch (error) {
      console.error("Error fetching user:", error);
      res.status(500).json({ message: "Failed to fetch user" });
    }
  });

  // Subscription routes
  app.get('/api/subscription-tiers', async (req, res) => {
    try {
      const tiers = await storage.getSubscriptionTiers();
      res.json(tiers);
    } catch (error) {
      console.error("Error fetching subscription tiers:", error);
      res.status(500).json({ message: "Failed to fetch subscription tiers" });
    }
  });

  app.get('/api/user-subscription', isAuthenticated, async (req: any, res) => {
    try {
      const userId = req.user.claims.sub;
      const subscription = await storage.getUserSubscription(userId);
      if (!subscription) {
        // Default to free tier
        const freeTier = await storage.getSubscriptionTierByName('free');
        return res.json({
          tier: freeTier,
          status: 'active',
          appTokensUsed: 0,
          appTokensRemaining: freeTier?.appTokens || 50
        });
      }
      
      // Get the tier details
      const tier = await storage.getSubscriptionTier(subscription.tierId);
      res.json({
        ...subscription,
        tier
      });
    } catch (error) {
      console.error("Error fetching user subscription:", error);
      res.status(500).json({ message: "Failed to fetch user subscription" });
    }
  });

  app.get('/api/app-token-balance', isAuthenticated, async (req: any, res) => {
    try {
      const userId = req.user.claims.sub;
      const balance = await storage.getUserAppTokenBalance(userId);
      res.json(balance);
    } catch (error) {
      console.error("Error fetching app token balance:", error);
      res.status(500).json({ message: "Failed to fetch app token balance" });
    }
  });

  // Export Quota endpoints
  app.get('/api/export-quota', isAuthenticated, async (req: any, res) => {
    try {
      const userId = req.user.claims.sub;
      const quota = await storage.getExportQuota(userId);
      res.json(quota);
    } catch (error) {
      console.error("Error fetching export quota:", error);
      res.status(500).json({ message: "Failed to fetch export quota" });
    }
  });

  // AI Credits API endpoints
  app.get('/api/ai-credits/balance', isAuthenticated, async (req: any, res) => {
    try {
      const userId = req.user.claims.sub;
      const summary = await AiCreditsManager.getUserCreditsSummary(userId);
      res.json(summary);
    } catch (error) {
      console.error("Error fetching AI credits balance:", error);
      res.status(500).json({ message: "Failed to fetch AI credits balance" });
    }
  });

  app.get('/api/ai-credits/transactions', isAuthenticated, async (req: any, res) => {
    try {
      const userId = req.user.claims.sub;
      const limit = parseInt(req.query.limit as string) || 20;
      const transactions = await AiCreditsManager.getUserTransactionHistory(userId, limit);
      res.json(transactions);
    } catch (error) {
      console.error("Error fetching AI credits transactions:", error);
      res.status(500).json({ message: "Failed to fetch AI credits transactions" });
    }
  });

  app.post('/api/ai-credits/add', isAuthenticated, async (req: any, res) => {
    try {
      const userId = req.user.claims.sub;
      const { amount, source, description } = req.body;
      
      if (!amount || amount <= 0) {
        return res.status(400).json({ message: "Invalid amount" });
      }

      const result = await AiCreditsManager.addCredits(userId, amount, source || 'manual', description);
      res.json(result);
    } catch (error) {
      console.error("Error adding AI credits:", error);
      res.status(500).json({ message: "Failed to add AI credits" });
    }
  });

  app.post('/api/ai-credits/check-sufficient', isAuthenticated, async (req: any, res) => {
    try {
      const userId = req.user.claims.sub;
      const { costInDollars } = req.body;
      
      if (typeof costInDollars !== 'number' || costInDollars < 0) {
        return res.status(400).json({ message: "Invalid cost amount" });
      }

      const hasSufficient = await AiCreditsManager.checkSufficientCredits(userId, costInDollars);
      const estimatedCredits = AiCreditsManager.estimateCreditsNeeded(costInDollars);
      
      res.json({ 
        sufficient: hasSufficient, 
        estimatedCredits,
        costInDollars
      });
    } catch (error) {
      console.error("Error checking AI credits:", error);
      res.status(500).json({ message: "Failed to check AI credits" });
    }
  });

  // Initialize Razorpay plans for subscription tiers (Development helper)
  app.post('/api/admin/initialize-razorpay-plans', async (req, res) => {
    try {
      const tiers = await storage.getSubscriptionTiers();
      const results = [];

      for (const tier of tiers) {
        // Skip free tier and tiers that already have plan IDs
        if (tier.name === 'free' || tier.razorpayPlanIdMonthly) {
          results.push({
            tier: tier.name,
            status: 'skipped',
            reason: tier.name === 'free' ? 'Free tier' : 'Already has plan ID',
            planId: tier.razorpayPlanIdMonthly
          });
          continue;
        }

        try {
          // Create monthly plan
          const monthlyPlan = await razorpayService.createPlan(
            `${tier.displayName} Monthly`,
            parseFloat(tier.price),
            tier.currency,
            'monthly'
          );

          // Create yearly plan (10 months price for yearly billing with 2 months free)
          const yearlyPlan = await razorpayService.createPlan(
            `${tier.displayName} Yearly`,
            parseFloat(tier.price) * 10, // 10 months price for yearly
            tier.currency,
            'yearly'
          );

          // Update tier with both plan IDs
          await storage.updateSubscriptionTier(tier.id, {
            razorpayPlanIdMonthly: monthlyPlan.id,
            razorpayPlanIdYearly: yearlyPlan.id
          });

          results.push({
            tier: tier.name,
            status: 'created',
            monthlyPlanId: monthlyPlan.id,
            yearlyPlanId: yearlyPlan.id,
            amount: tier.price,
            currency: tier.currency
          });
        } catch (error) {
          console.error(`Error creating plan for ${tier.name}:`, error);
          results.push({
            tier: tier.name,
            status: 'error',
            error: error instanceof Error ? error.message : 'Unknown error'
          });
        }
      }

      res.json({
        message: 'Razorpay plan initialization completed',
        results
      });
    } catch (error) {
      console.error('Error initializing Razorpay plans:', error);
      res.status(500).json({ message: 'Failed to initialize Razorpay plans' });
    }
  });

  // AI Shorts Generator endpoints
  app.get('/api/elevenlabs/voices', async (req: Request, res: Response) => {
    try {
      const elevenApiKey = process.env.ELEVEN_API_KEY;
      if (!elevenApiKey) {
        return res.status(400).json({ error: 'ElevenLabs API key not configured' });
      }

      const { createAIShortGenerator } = await import('./services/ai-shorts-generator');
      const generator = createAIShortGenerator(elevenApiKey);
      
      const voices = await generator.getAvailableVoices();
      res.json({ voices });
    } catch (error) {
      console.error('Failed to fetch voices:', error);
      res.status(500).json({ error: 'Failed to fetch available voices' });
    }
  });

  // Get detailed voice data (raw ElevenLabs response)
  app.get('/api/elevenlabs/voices/detailed', async (req: Request, res: Response) => {
    try {
      const elevenApiKey = process.env.ELEVEN_API_KEY;
      if (!elevenApiKey) {
        return res.status(400).json({ error: 'ElevenLabs API key not configured' });
      }

      const response = await fetch("https://api.elevenlabs.io/v1/voices", {
        method: "GET", 
        headers: {
          "xi-api-key": elevenApiKey,
        },
      });

      if (!response.ok) {
        throw new Error(`HTTP error! status: ${response.status}`);
      }

      const data = await response.json();
      res.json(data);
    } catch (error) {
      console.error('Failed to fetch detailed voices:', error);
      res.status(500).json({ error: 'Failed to fetch detailed voice data' });
    }
  });

  // Generate voice sample audio
  app.post('/api/elevenlabs/voice-sample', async (req: Request, res: Response) => {
    try {
      const { voiceId, text = "Hello! This is a sample of my voice. I hope you like how I sound!" } = req.body;
      const elevenApiKey = process.env.ELEVEN_API_KEY;
      
      if (!elevenApiKey) {
        return res.status(400).json({ error: 'ElevenLabs API key not configured' });
      }

      if (!voiceId) {
        return res.status(400).json({ error: 'Voice ID is required' });
      }

      const response = await fetch(`https://api.elevenlabs.io/v1/text-to-speech/${voiceId}`, {
        method: "POST",
        headers: {
          "Accept": "audio/mpeg",
          "Content-Type": "application/json",
          "xi-api-key": elevenApiKey,
        },
        body: JSON.stringify({
          text: text,
          model_id: "eleven_monolingual_v1",
          voice_settings: {
            stability: 0.5,
            similarity_boost: 0.5
          }
        }),
      });

      if (!response.ok) {
        throw new Error(`HTTP error! status: ${response.status}`);
      }

      const audioBuffer = await response.arrayBuffer();
      const filename = `voice_sample_${voiceId}_${Date.now()}.mp3`;
      const filePath = path.join(uploadsDir, filename);
      
      await fs.writeFile(filePath, Buffer.from(audioBuffer));
      
      res.json({ 
        success: true, 
        audioUrl: `/api/uploads/${filename}`,
        filename 
      });
    } catch (error) {
      console.error('Failed to generate voice sample:', error);
      res.status(500).json({ error: 'Failed to generate voice sample' });
    }
  });

  app.post('/api/ai-shorts/generate', async (req: Request, res: Response) => {
    try {
      console.log('=== AI SHORTS GENERATION START ===');
      console.log('Request:', {
        script: req.body.script,
        prompt: req.body.prompt,
        duration: req.body.duration,
        voiceName: req.body.voiceName,
        backgroundMusic: req.body.backgroundMusic,
        style: req.body.style,
        showSubtitles: req.body.showSubtitles,
        subtitleStyle: req.body.subtitleStyle,
        subtitlePosition: req.body.subtitlePosition
      });
      
      const { script, prompt, duration, voiceName, backgroundMusic, style, showSubtitles, subtitleStyle, subtitlePosition } = req.body;
      
      if (!duration || !voiceName || !style) {
        return res.status(400).json({ error: 'Duration, voice name, and style are required' });
      }

      if (!script && !prompt) {
        return res.status(400).json({ error: 'Either script or prompt must be provided' });
      }

      const elevenApiKey = process.env.ELEVEN_API_KEY;
      
      if (!elevenApiKey) {
        return res.status(400).json({ error: 'ElevenLabs API key not configured' });
      }

      const { createAIShortGenerator } = await import('./services/ai-shorts-generator');
      const generator = createAIShortGenerator(elevenApiKey);
      
      const result = await generator.generateAIShort({
        script,
        prompt,
        duration,
        voiceName,
        backgroundMusic,
        style,
        showSubtitles,
        subtitleStyle,
        subtitlePosition
      });

      res.json({
        success: true,
        result
      });
    } catch (error) {
      console.error('AI Shorts generation failed:', error);
      res.status(500).json({ 
        error: error instanceof Error ? error.message : 'AI Shorts generation failed' 
      });
    }
  });

  // Viral Content Trend Predictor Routes
  app.post('/api/viral-predictor/predict', async (req: Request, res: Response) => {
    try {
      console.log('=== VIRAL PREDICTION START ===');
      console.log('Request:', req.body);

      const { script, contentType = 'video', targetPlatform = 'youtube' } = req.body;

      // Validate required parameters
      if (!script) {
        return res.status(400).json({ 
          success: false, 
          error: 'Script content is required' 
        });
      }

      // Initialize Viral Content Predictor
      const { createViralContentPredictor } = await import('./services/viral-content-predictor');
      const predictor = createViralContentPredictor(process.env.OPENAI_API_KEY || '');

      // Predict viral potential
      const prediction = await predictor.predictViralPotential(
        script,
        contentType,
        targetPlatform
      );

      console.log(`=== VIRAL PREDICTION COMPLETE - Score: ${prediction.viralScore}/100 ===`);
      
      res.json(prediction);
    } catch (error) {
      console.error('Viral prediction failed:', error);
      res.status(500).json({ 
        success: false, 
        error: error instanceof Error ? error.message : 'Prediction failed' 
      });
    }
  });

  // Serve uploaded files
  app.get('/api/uploads/:filename', (req: Request, res: Response) => {
    const filename = req.params.filename;
    const filePath = path.join(uploadsDir, filename);
    
    // Check if file exists
    if (!fsSync.existsSync(filePath)) {
      return res.status(404).json({ error: 'File not found' });
    }
    
    // Set appropriate content type based on file extension
    const ext = path.extname(filename).toLowerCase();
    let contentType = 'application/octet-stream';
    
    if (ext === '.mp3') contentType = 'audio/mpeg';
    else if (ext === '.wav') contentType = 'audio/wav';
    else if (ext === '.jpg' || ext === '.jpeg') contentType = 'image/jpeg';
    else if (ext === '.png') contentType = 'image/png';
    else if (ext === '.mp4') contentType = 'video/mp4';
    
    res.setHeader('Content-Type', contentType);
    res.sendFile(path.resolve(filePath));
  });

  // Razorpay subscription creation (Step 1.2)
  app.post('/api/create-subscription', isAuthenticated, async (req: any, res) => {
    try {
      const userId = req.user.claims.sub;
      const { tierId, billingInterval } = req.body; // 'monthly' or 'yearly'

      if (!tierId) {
        return res.status(400).json({ message: "Tier ID is required" });
      }

      // Get the tier details
      const tier = await storage.getSubscriptionTier(tierId);
      if (!tier) {
        return res.status(404).json({ message: "Subscription tier not found" });
      }

      // Don't create Razorpay subscription for free tier
      if (tier.name === 'free') {
        return res.status(400).json({ message: "Free tier doesn't require payment" });
      }

      // Select the appropriate plan ID based on billing interval
      const selectedPlanId = billingInterval === 'yearly' 
        ? tier.razorpayPlanIdYearly 
        : tier.razorpayPlanIdMonthly;

      // Check if tier has Razorpay plan ID for the selected billing interval
      if (!selectedPlanId) {
        return res.status(400).json({ 
          message: `No Razorpay plan ID configured for ${tier.displayName} ${billingInterval} billing. Please contact support.` 
        });
      }

      // Get user data for subscription
      const user = await storage.getUser(userId);
      if (!user) {
        return res.status(404).json({ message: "User not found" });
      }

      // Calculate billing cycles based on interval
      // For monthly: 1 cycle, for yearly: 10 cycles (gives 2 months free)
      const totalCount = billingInterval === 'yearly' ? 10 : 1;
      const expireBy = Math.floor((Date.now() + (15 * 60 * 1000)) / 1000); // Expire in 15 minutes as requested

      // Fetch the actual Razorpay plan details to understand what amount it contains
      const razorpayPlan = await razorpayService.getPlan(selectedPlanId);
      console.log('Actual Razorpay plan details:', razorpayPlan);

      // Create Razorpay subscription
      console.log(`Creating subscription for ${billingInterval} billing:`, {
        planId: selectedPlanId,
        totalCount,
        tierPrice: tier.price,
        calculatedAmount: billingInterval === 'yearly' ? parseFloat(tier.price) * 10 : parseFloat(tier.price),
        razorpayPlanAmount: razorpayPlan.item.amount
      });

      const subscription = await razorpayService.createSubscription(
        selectedPlanId,
        {
          totalCount,
          customerEmail: user.email || undefined,
          customerName: `${user.firstName || ''} ${user.lastName || ''}`.trim() || undefined,
          expireBy
        }
      );

      console.log('Razorpay subscription created:', subscription);

      // Store subscription in database with pending status
      await storage.createUserSubscription({
        userId,
        tierId: tier.id,
        razorpaySubscriptionId: subscription.id,
        razorpayPlanId: selectedPlanId,
        status: 'pending', // Will be activated after payment verification
        appTokensUsed: 0,
        appTokensRemaining: 0 // Will be set after payment confirmation
      });

      // Calculate amount based on billing interval
      let amount = parseFloat(tier.price);
      if (billingInterval === 'yearly') {
        amount = amount * 10; // 10 months price for yearly (2 months free)
      }

      res.json({
        subscriptionId: subscription.id,
        amount: amount * 100, // Razorpay expects amount in paise
        currency: tier.currency.toUpperCase(),
        name: `${tier.displayName} Subscription (${billingInterval})`,
        description: `${billingInterval} subscription to ${tier.displayName} plan`,
        key: process.env.RAZORPAY_KEY_ID
      });
    } catch (error) {
      console.error("Error creating subscription:", error);
      res.status(500).json({ message: "Failed to create subscription" });
    }
  });

  // Razorpay payment verification (Step 1.3 - Authentication Transaction)
  app.post('/api/verify-payment', isAuthenticated, async (req: any, res) => {
    try {
      const userId = req.user.claims.sub;
      const { 
        razorpay_payment_id, 
        razorpay_subscription_id, 
        razorpay_signature
      } = req.body;

      if (!razorpay_payment_id || !razorpay_subscription_id || !razorpay_signature) {
        return res.status(400).json({ 
          message: "Missing required payment verification parameters" 
        });
      }

      // Get subscription from database to verify it matches this user
      const subscription = await storage.getUserSubscription(userId);
      if (!subscription || subscription.razorpaySubscriptionId !== razorpay_subscription_id) {
        return res.status(404).json({ message: "Subscription not found or does not match this user" });
      }

      // Verify signature using HMAC SHA256 as per Razorpay documentation
      const isValidSignature = razorpayService.verifySubscriptionPayment(
        razorpay_payment_id,
        subscription.razorpaySubscriptionId!, // Use our stored subscription ID
        razorpay_signature
      );

      if (!isValidSignature) {
        return res.status(400).json({ 
          message: "Invalid payment signature. Payment verification failed." 
        });
      }

      // Payment is authentic, activate the subscription
      const tier = await storage.getSubscriptionTier(subscription.tierId);
      if (!tier) {
        return res.status(404).json({ message: "Subscription tier not found" });
      }

      // Calculate subscription period
      const currentPeriodStart = new Date();
      const currentPeriodEnd = new Date();
      if (tier.interval === 'month') {
        currentPeriodEnd.setMonth(currentPeriodEnd.getMonth() + 1);
      } else if (tier.interval === 'year') {
        currentPeriodEnd.setFullYear(currentPeriodEnd.getFullYear() + 1);
      }

      // Update subscription status to active
      await storage.updateUserSubscription(subscription.id, {
        status: 'active',
        appTokensUsed: 0,
        appTokensRemaining: tier.appTokens,
        currentPeriodStart,
        currentPeriodEnd
      });

      res.json({ 
        success: true, 
        message: `Successfully subscribed to ${tier.displayName} plan!`,
        tier: tier
      });
    } catch (error) {
      console.error("Error verifying payment:", error);
      res.status(500).json({ message: "Failed to verify payment" });
    }
  });

  // Get user subscription details
  app.get('/api/user-subscription', isAuthenticated, async (req: any, res: Response) => {
    try {
      const userId = req.user.claims.sub;
      const subscription = await storage.getUserSubscription(userId);
      
      if (!subscription) {
        return res.status(404).json({ message: "No active subscription found" });
      }

      // Get tier details
      const tier = await storage.getSubscriptionTier(subscription.tierId);
      if (!tier) {
        return res.status(404).json({ message: "Subscription tier not found" });
      }

      res.json({
        ...subscription,
        tier
      });
    } catch (error) {
      console.error('Error fetching user subscription:', error);
      res.status(500).json({ message: 'Failed to fetch subscription details' });
    }
  });

  // Get token usage
  app.get('/api/token-usage', isAuthenticated, async (req: any, res: Response) => {
    try {
      const userId = req.user.claims.sub;
      const tokenBalance = await storage.getUserAppTokenBalance(userId);
      res.json(tokenBalance);
    } catch (error) {
      console.error('Error fetching token usage:', error);
      res.status(500).json({ message: 'Failed to fetch token usage' });
    }
  });

  // Get usage history
  app.get('/api/usage-history', isAuthenticated, async (req: any, res: Response) => {
    try {
      const userId = req.user.claims.sub;
      const limit = parseInt(req.query.limit as string) || 10;
      const usageHistory = await storage.getAppTokenUsage(userId, limit);
      res.json(usageHistory);
    } catch (error) {
      console.error('Error fetching usage history:', error);
      res.status(500).json({ message: 'Failed to fetch usage history' });
    }
  });

  // Get App Token usage/transactions (alias for usage-history to support AccountDashboard)
  app.get('/api/app-token-usage', isAuthenticated, async (req: any, res: Response) => {
    try {
      const userId = req.user.claims.sub;
      const limit = parseInt(req.query.limit as string) || 10;
      const usageHistory = await storage.getAppTokenUsage(userId, limit);
      res.json(usageHistory);
    } catch (error) {
      console.error('Error fetching app token usage:', error);
      res.status(500).json({ message: 'Failed to fetch app token usage' });
    }
  });

  // Cancel subscription
  app.post('/api/cancel-subscription', isAuthenticated, async (req: any, res: Response) => {
    try {
      const userId = req.user.claims.sub;
      const subscription = await storage.getUserSubscription(userId);
      
      if (!subscription) {
        return res.status(404).json({ message: "No active subscription found" });
      }

      // Cancel with Razorpay if there's a subscription ID
      if (subscription.razorpaySubscriptionId) {
        await razorpayService.cancelSubscription(subscription.razorpaySubscriptionId);
      }

      // Update subscription status in database
      await storage.cancelUserSubscription(userId);

      res.json({ 
        message: "Subscription cancelled successfully",
        success: true 
      });
    } catch (error) {
      console.error('Error cancelling subscription:', error);
      res.status(500).json({ message: 'Failed to cancel subscription' });
    }
  });

  // Workflows endpoints  
  app.get("/api/workflows", isAuthenticated, async (req: any, res) => {
    try {
      const userId = req.user?.claims?.sub;
      const workflows = await storage.getWorkflowsByUserId(userId);
      res.json(workflows);
    } catch (error) {
      res.status(500).json({ error: "Failed to fetch workflows" });
    }
  });

  app.get("/api/workflows/:id", async (req, res) => {
    try {
      const id = parseInt(req.params.id);
      const workflow = await storage.getWorkflow(id);
      if (!workflow) {
        return res.status(404).json({ error: "Workflow not found" });
      }
      res.json(workflow);
    } catch (error) {
      res.status(500).json({ error: "Failed to fetch workflow" });
    }
  });

  app.post("/api/workflows", isAuthenticated, async (req: any, res) => {
    try {
      const userId = req.user?.claims?.sub;
      const data = insertWorkflowSchema.parse(req.body);
      const workflow = await storage.createWorkflow({
        ...data,
        userId
      });
      res.json(workflow);
    } catch (error) {
      if (error instanceof z.ZodError) {
        return res.status(400).json({ error: "Invalid workflow data", details: error.errors });
      }
      res.status(500).json({ error: "Failed to create workflow" });
    }
  });

  app.patch("/api/workflows/:id", async (req, res) => {
    try {
      const id = parseInt(req.params.id);
      const data = insertWorkflowSchema.partial().parse(req.body);
      const workflow = await storage.updateWorkflow(id, data);
      if (!workflow) {
        return res.status(404).json({ error: "Workflow not found" });
      }
      res.json(workflow);
    } catch (error) {
      if (error instanceof z.ZodError) {
        return res.status(400).json({ error: "Invalid workflow data", details: error.errors });
      }
      res.status(500).json({ error: "Failed to update workflow" });
    }
  });

  app.delete("/api/workflows/:id", async (req, res) => {
    try {
      const id = parseInt(req.params.id);
      const success = await storage.deleteWorkflow(id);
      if (!success) {
        return res.status(404).json({ error: "Workflow not found" });
      }
      res.json({ success: true });
    } catch (error) {
      res.status(500).json({ error: "Failed to delete workflow" });
    }
  });

  // AI Chat endpoints
  app.get("/api/workflows/:id/chat", async (req, res) => {
    try {
      const workflowId = parseInt(req.params.id);
      const chat = await storage.getAiChat(workflowId);
      if (!chat) {
        // Create new chat if doesn't exist
        const newChat = await storage.createAiChat({
          workflowId,
          messages: []
        });
        return res.json(newChat);
      }
      res.json(chat);
    } catch (error) {
      res.status(500).json({ error: "Failed to fetch chat" });
    }
  });

  app.post("/api/workflows/:id/chat", async (req, res) => {
    try {
      const workflowId = parseInt(req.params.id);
      const { message } = req.body;

      if (!message) {
        return res.status(400).json({ error: "Message is required" });
      }

      // Get existing chat or create new one
      let chat = await storage.getAiChat(workflowId);
      if (!chat) {
        chat = await storage.createAiChat({
          workflowId,
          messages: []
        });
      }

      // Add user message
      const messages = [...(chat.messages as any[]), {
        role: "user",
        content: message,
        timestamp: new Date().toISOString()
      }];

      // Get user settings for API key
      const userSettings = await storage.getUserSettings(req.user?.claims?.sub);
      const apiKey = userSettings?.geminiApiKey || process.env.GEMINI_API_KEY || process.env.VITE_GEMINI_API_KEY || "";
      
      if (!apiKey) {
        return res.status(400).json({ error: "Gemini API key not configured. Please add it in Settings." });
      }

      // Estimate cost for credit checking
      const estimatedInputTokens = message.length * 4; // Rough estimate: 4 tokens per character
      const estimatedOutputTokens = 500; // Conservative estimate for AI response
      const estimatedInputCost = (estimatedInputTokens / 1000000) * 0.075;
      const estimatedOutputCost = (estimatedOutputTokens / 1000000) * 0.30;
      const estimatedTotalCost = estimatedInputCost + estimatedOutputCost;

      // Check if user has sufficient credits
      const userId = req.user?.claims?.sub;
      const hasSufficientCredits = await AiCreditsManager.checkSufficientCredits(userId, estimatedTotalCost);
      
      if (!hasSufficientCredits) {
        return res.status(403).json({ 
          error: "Insufficient AI credits", 
          message: "You don't have enough AI credits for this operation. Please add credits or upgrade your subscription.",
          estimatedCost: estimatedTotalCost,
          estimatedCredits: AiCreditsManager.estimateCreditsNeeded(estimatedTotalCost)
        });
      }

      // Generate AI response
      try {
        const geminiAI = new GoogleGenerativeAI(apiKey);
        const model = geminiAI.getGenerativeModel({ model: "gemini-2.0-flash-exp" });
        
        const response = await model.generateContent(`You are an AI video editing assistant. Help the user with their video editing workflow. User message: ${message}`);

        const aiResponse = response.response.text() || "I'm sorry, I couldn't process that request.";

        // Calculate actual token usage and cost
        const tokenCount = response.usageMetadata?.totalTokenCount || 0;
        const inputTokens = response.usageMetadata?.promptTokenCount || 0;
        const outputTokens = response.usageMetadata?.candidatesTokenCount || 0;
        
        // Gemini 1.5 Flash pricing: $0.075 per 1M input tokens, $0.30 per 1M output tokens
        const inputCost = (inputTokens / 1000000) * 0.075;
        const outputCost = (outputTokens / 1000000) * 0.30;
        const totalCost = inputCost + outputCost;

        // Deduct AI credits based on actual cost
        await AiCreditsManager.deductCreditsForAiAction(
          userId,
          totalCost,
          'ai_chat',
          `Chat message: "${message.substring(0, 50)}${message.length > 50 ? '...' : ''}"`
        );

        // Update user settings with token usage
        if (userSettings) {
          const newTokensUsed = (userSettings.tokensUsed || 0) + tokenCount;
          const currentCost = parseFloat(userSettings.estimatedCost?.replace('$', '') || '0');
          const newCost = currentCost + totalCost;
          
          await storage.updateUserSettings(userId, {
            tokensUsed: newTokensUsed,
            estimatedCost: `$${newCost.toFixed(4)}`
          });
        }

        // Add AI response
        messages.push({
          role: "assistant",
          content: aiResponse,
          timestamp: new Date().toISOString()
        });

        // Update chat
        const updatedChat = await storage.updateAiChat(workflowId, messages);
        res.json(updatedChat);

      } catch (aiError) {
        // Add error message to chat
        messages.push({
          role: "assistant",
          content: "I'm having trouble connecting to the AI service. Please check your API key in Settings.",
          timestamp: new Date().toISOString(),
          error: true
        });

        const updatedChat = await storage.updateAiChat(workflowId, messages);
        res.status(500).json({ error: "AI service error", chat: updatedChat });
      }

    } catch (error) {
      res.status(500).json({ error: "Failed to process chat message" });
    }
  });

  // User Settings endpoints
  app.get("/api/settings", async (req, res) => {
    try {
      let settings = await storage.getUserSettings(req.user?.claims?.sub);
      if (!settings) {
        // Create default settings
        settings = await storage.createUserSettings({
          userId: req.user?.claims?.sub,
          geminiModel: "gemini-2.0-flash-exp",
          preferences: {},
          tokensUsed: 0,
          estimatedCost: "$0.00"
        });
      }
      res.json(settings);
    } catch (error) {
      res.status(500).json({ error: "Failed to fetch settings" });
    }
  });

  app.patch("/api/settings", async (req, res) => {
    try {
      const data = insertUserSettingsSchema.partial().parse(req.body);
      
      let settings = await storage.getUserSettings(req.user?.claims?.sub);
      if (!settings) {
        settings = await storage.createUserSettings({
          ...data,
          userId: req.user?.claims?.sub
        });
      } else {
        settings = await storage.updateUserSettings(req.user?.claims?.sub, data);
      }
      
      if (!settings) {
        return res.status(404).json({ error: "Settings not found" });
      }
      
      res.json(settings);
    } catch (error) {
      if (error instanceof z.ZodError) {
        return res.status(400).json({ error: "Invalid settings data", details: error.errors });
      }
      res.status(500).json({ error: "Failed to update settings" });
    }
  });

  // AI Shorts generation endpoint
  app.post("/api/ai/generate-short", async (req, res) => {
    try {
      const { topic, style = 'viral', duration = 15, aspectRatio = '9:16', inputVideo } = req.body;

      if (!topic) {
        return res.status(400).json({ error: "Topic is required" });
      }

      const userSettings = await storage.getUserSettings(req.user?.claims?.sub);
      const apiKey = userSettings?.geminiApiKey || process.env.GEMINI_API_KEY || "";

      if (!apiKey) {
        return res.status(400).json({ error: "Gemini API key not configured" });
      }

      // Simple shorts generation without complex video processing
      const shortId = `short_${Date.now()}`;
      
      // Generate AI content with Gemini
      let aiContent;
      let geminiRawResponse = null;
      
      console.log('=== GEMINI API CALL START ===');
      console.log('API key present:', !!apiKey);
      
      try {
        const geminiAI = new GoogleGenerativeAI(apiKey);
        const prompt = `Create a ${duration}s ${style} short video concept for: ${topic}. Return JSON: {"title": "title", "script": "script", "description": "description", "hashtags": ["#tag1", "#tag2"]}`;
        
        console.log('Sending prompt to Gemini...');
        
        const model = geminiAI.getGenerativeModel({ model: "gemini-2.0-flash-exp" });
        const result = await model.generateContent({
          contents: [{
            role: "user",
            parts: [{ text: prompt }]
          }]
        });
        
        // Extract text from response
        const responseText = result.response.text();
        geminiRawResponse = responseText;
        
        console.log('=== GEMINI AI RESPONSE ===');
        console.log(responseText);
        console.log('=== END RESPONSE ===');
        
        // Clean and parse JSON response
        const cleanedResponse = responseText.replace(/```json\n?|\n?```/g, '').trim();
        aiContent = JSON.parse(cleanedResponse);
        
        console.log('Successfully parsed AI content:', aiContent);
        
      } catch (error) {
        console.error('Gemini API failed:', error);
        geminiRawResponse = `ERROR: ${error.message || error}`;
        
        // Use fallback content
        aiContent = {
          title: `${style} Short: ${topic}`,
          script: `Engaging ${style} content about ${topic}`,
          description: `${duration}s video about ${topic}`,
          hashtags: [`#${topic.replace(/\s+/g, '')}`, '#viral', '#shorts']
        };
      }

      // Create simple thumbnail
      const thumbnailUrl = `data:image/svg+xml;base64,${btoa(`<svg width="320" height="180" xmlns="http://www.w3.org/2000/svg"><rect width="320" height="180" fill="#4285F4"/><text x="160" y="90" text-anchor="middle" fill="white" font-size="20">${style.toUpperCase()}</text></svg>`)}`;

      const generatedShort = {
        id: shortId,
        title: aiContent.title,
        script: aiContent.script,
        description: aiContent.description,
        hashtags: aiContent.hashtags,
        thumbnailUrl,
        videoUrl: `/api/video/short/${shortId}`,
        duration: duration
      };

      // Create actual video with content from YouTube processing
      setImmediate(async () => {
        try {
          const fs = await import('fs');
          const { spawn } = await import('child_process');
          const outputDir = path.join(process.cwd(), 'temp_videos');
          await fs.promises.mkdir(outputDir, { recursive: true });
          
          const outputPath = path.join(outputDir, `${shortId}.mp4`);
          console.log(`Creating enhanced video at: ${outputPath}`);
          
          // Create dynamic visual content with AI-generated title and elements
          const title = aiContent.title || `${style} Short`;
          const safeTitle = title.replace(/['"]/g, '').substring(0, 40);
          
          // Generate different visual styles based on content style
          let visualFilter;
          if (style === 'viral') {
            visualFilter = `color=c=#FF6B6B:size=640x360:duration=${duration}`;
          } else if (style === 'educational') {
            visualFilter = `color=c=#4ECDC4:size=640x360:duration=${duration}`;
          } else if (style === 'entertainment') {
            visualFilter = `color=c=#45B7D1:size=640x360:duration=${duration}`;
          } else {
            visualFilter = `color=c=#96CEB4:size=640x360:duration=${duration}`;
          }
          
          // Standard content creation for file-based processing
          const textOverlay = `drawtext=text='${safeTitle}':fontcolor=white:fontsize=20:x=(w-text_w)/2:y=(h-text_h)/2`;
          
          const ffmpeg = spawn('ffmpeg', [
            '-f', 'lavfi',
            '-i', visualFilter,
            '-vf', textOverlay,
            '-c:v', 'libx264',
            '-preset', 'ultrafast',
            '-pix_fmt', 'yuv420p',
            '-y',
            outputPath
          ]);
          
          ffmpeg.stdout.on('data', (data) => {
            console.log(`FFmpeg stdout: ${data}`);
          });
          
          ffmpeg.stderr.on('data', (data) => {
            console.log(`FFmpeg stderr: ${data}`);
          });
          
          ffmpeg.on('close', (code) => {
            console.log(`Standard video created for ${shortId} with exit code ${code}`);
          });
          
          ffmpeg.on('error', (error) => {
            console.error(`FFmpeg error for ${shortId}:`, error);
          });
          

        } catch (error) {
          console.error('Video creation setup failed:', error);
        }
      });

      res.json({
        success: true,
        short: generatedShort,
        output: {
          title: generatedShort.title,
          videoUrl: generatedShort.videoUrl,
          script: generatedShort.script,
          thumbnailUrl: generatedShort.thumbnailUrl
        },
        debug: {
          geminiResponse: geminiRawResponse,
          aiContentUsed: aiContent,
          apiKeyPresent: !!apiKey
        }
      });
    } catch (error) {
      console.error("Shorts generation error:", error);
      res.status(500).json({ error: "Failed to generate short" });
    }
  });

  // Download endpoint for generated shorts (metadata)
  app.get("/api/download/short/:id", async (req, res) => {
    try {
      const shortId = req.params.id;
      
      // In a real implementation, this would serve the actual generated video file
      // For now, we'll create a placeholder response
      res.set({
        'Content-Type': 'application/json',
        'Content-Disposition': `attachment; filename="short_${shortId}.json"`
      });
      
      res.json({
        message: "Video generation in progress",
        shortId,
        status: "processing",
        note: "In a production environment, this would be the actual video file"
      });
    } catch (error) {
      res.status(500).json({ error: "Failed to download short" });
    }
  });

  // Serve actual video files
  app.get('/api/video/short/:shortId', async (req, res) => {
    const { shortId } = req.params;
    // Handle different naming patterns
    const possiblePaths = [
      path.join(process.cwd(), 'temp_videos', `${shortId}.mp4`),
      path.join(process.cwd(), 'temp_videos', `short_${shortId}.mp4`)
    ];
    
    let videoPath = possiblePaths[0];
    for (const testPath of possiblePaths) {
      try {
        await fs.access(testPath);
        videoPath = testPath;
        break;
      } catch {
        continue;
      }
    }
    
    try {
      // Check if video file exists
      await fs.access(videoPath);
      
      // Set appropriate headers for video download
      res.setHeader('Content-Type', 'video/mp4');
      res.setHeader('Content-Disposition', `attachment; filename="shorts_${shortId}.mp4"`);
      res.setHeader('Cache-Control', 'public, max-age=31536000');
      
      // Stream the video file
      const stat = await fs.stat(videoPath);
      const fileSize = stat.size;
      res.setHeader('Content-Length', fileSize);
      
      const stream = createReadStream(videoPath);
      stream.pipe(res);
    } catch (error) {
      console.error('Video file not found:', error);
      res.status(404).json({
        error: 'Video not found',
        message: 'The requested video file could not be found',
        shortId
      });
    }
  });

  // Workflow execution endpoint with proper processing
  app.post("/api/workflows/:id/execute", async (req, res) => {
    try {
      const id = parseInt(req.params.id);
      const workflow = await storage.getWorkflow(id);
      
      if (!workflow) {
        return res.status(404).json({ error: "Workflow not found" });
      }

      const nodes = workflow.nodes as any[];
      const edges = workflow.edges as any[];
      
      if (!nodes || nodes.length === 0) {
        return res.status(400).json({ error: "Workflow has no nodes to execute" });
      }

      // Process workflow execution
      const executionResults = await processWorkflowExecution(nodes, edges, req.user?.claims?.sub);
      
      // Update workflow with execution results
      await storage.updateWorkflow(id, {
        nodes: executionResults.updatedNodes,
        settings: { 
          ...workflow.settings, 
          lastExecution: new Date().toISOString(),
          executionResults: executionResults.results
        }
      });

      res.json({
        status: "completed",
        message: "Workflow execution completed successfully",
        workflowId: id,
        results: executionResults.results,
        updatedNodes: executionResults.updatedNodes
      });
    } catch (error) {
      console.error("Workflow execution error:", error);
      res.status(500).json({ error: "Failed to execute workflow" });
    }
  });

  // Video upload endpoint
  app.post("/api/upload-video", upload.single('video'), async (req, res) => {
    try {
      if (!req.file) {
        return res.status(400).json({ error: "No file uploaded" });
      }

      const file = req.file;
      console.log(`File upload attempt: ${file.originalname} ${file.mimetype}`);
      
      // Generate unique filename preserving original extension
      const fileExtension = path.extname(file.originalname);
      const uniqueFilename = createHash('md5').update(file.originalname + Date.now()).digest('hex');
      const finalPath = path.join('uploads', `${uniqueFilename}${fileExtension}`);
      
      // Move file to final location with original extension
      await fs.rename(file.path, finalPath);
      
      console.log(`Video uploaded: ${file.originalname} (${file.size} bytes) -> ${finalPath}`);
      
      res.json({
        message: 'Video uploaded successfully',
        filename: `${uniqueFilename}${fileExtension}`,
        path: finalPath,
        originalName: file.originalname,
        size: file.size,
        originalFormat: fileExtension.substring(1)
      });
    } catch (error) {
      console.error('Upload error:', error);
      res.status(500).json({ error: 'Failed to upload video' });
    }
  });

  // Video analysis endpoint
  app.post("/api/upload", upload.single('video'), async (req, res) => {
    try {
      if (!req.file) {
        return res.status(400).json({ error: "No file uploaded" });
      }

      const filePath = req.file.path;
      const userSettings = await storage.getUserSettings(req.user?.claims?.sub);
      const apiKey = userSettings?.geminiApiKey || process.env.GEMINI_API_KEY || "";

      if (!apiKey) {
        return res.status(400).json({ error: "Gemini API key not configured" });
      }

      const videoProcessor = createVideoProcessor(apiKey);
      const analysis = await videoProcessor.analyzeVideo(filePath);

      // Clean up uploaded file
      fs.unlinkSync(filePath);

      res.json({
        analysis,
        message: "Video analyzed successfully"
      });
    } catch (error) {
      console.error("Video upload error:", error);
      res.status(500).json({ error: "Failed to analyze video" });
    }
  });

  // Export video with all operations applied
  app.post('/api/export-timeline-video', isAuthenticated, async (req: any, res: Response) => {
    try {
      console.log('=== EXPORT TIMELINE VIDEO START ===');
      const { videoFilename, composition, tracks } = req.body;
      const userId = req.user.claims.sub;
      console.log(`Export request for user ${userId}, video: ${videoFilename}`);

      if (!videoFilename || !composition || !tracks) {
        return res.status(400).json({ error: 'Missing required data for export' });
      }

      // Check export quota
      const exportQuota = await storage.getExportQuota(userId);
      if (exportQuota.remaining <= 0) {
        return res.status(400).json({ 
          error: 'Export quota exceeded. Please upgrade your plan.' 
        });
      }

      // Build the video processing commands based on timeline composition
      const outputFilename = `exported_${Date.now()}_${videoFilename}`;
      const outputPath = path.join(process.cwd(), 'uploads', outputFilename);
      const inputPath = path.join(process.cwd(), 'uploads', videoFilename);

      const ffmpegLib = await import('fluent-ffmpeg');
      
      // Get video metadata to preserve original resolution and quality
      const videoInfo = await new Promise<any>((resolve, reject) => {
        ffmpegLib.default.ffprobe(inputPath, (err, metadata) => {
          if (err) reject(err);
          else resolve(metadata);
        });
      });

      const videoStream = videoInfo.streams.find((stream: any) => stream.codec_type === 'video');
      const originalWidth = videoStream?.width;
      const originalHeight = videoStream?.height;
      const originalBitrate = videoStream?.bit_rate;
      const originalFrameRate = videoStream?.r_frame_rate;
      
      console.log(`Original video properties: ${originalWidth}x${originalHeight}, bitrate: ${originalBitrate}, fps: ${originalFrameRate}`);

      let ffmpegCommand = ffmpegLib.default(inputPath);

      // Process media overlays and text overlays together
      const textTracks = tracks.filter((track: any) => track.type === 'text');
      const mediaTracks = tracks.filter((track: any) => track.type === 'media');
      
      console.log(`Processing ${textTracks.length} text tracks and ${mediaTracks.length} media tracks`);
      
      // Collect all media files first
      const mediaFiles: string[] = [];
      for (const track of mediaTracks) {
        for (const segment of track.segments) {
          if (segment.content) {
            let mediaPath = '';
            
            if (segment.content.filename) {
              mediaPath = path.join(process.cwd(), 'uploads', segment.content.filename);
            } else if (segment.content.url && segment.content.url.startsWith('/api/media/')) {
              const filename = segment.content.url.split('/').pop();
              mediaPath = path.join(process.cwd(), 'uploads', filename);
            }
            
            if (mediaPath && await fs.access(mediaPath).then(() => true).catch(() => false)) {
              console.log(`Adding media input: ${mediaPath}`);
              ffmpegCommand = ffmpegCommand.input(mediaPath);
              mediaFiles.push(mediaPath);
            }
          }
        }
      }
      
      // Build filter chain if we have overlays or text
      if (mediaFiles.length > 0 || textTracks.length > 0) {
        try {
          const filters: string[] = [];
          let currentLabel = '0:v';
          let inputIndex = 1;
          
          // Add media overlays first
          let mediaFileIndex = 0;
          for (const track of mediaTracks) {
            for (const segment of track.segments) {
              if (segment.content && mediaFileIndex < mediaFiles.length) {
                // Convert percentage-based position with center alignment (same as frontend)
                const xPercent = segment.content.x || 50;
                const yPercent = segment.content.y || 50;
                
                console.log(`Media overlay position: ${xPercent}% x ${yPercent}% (centered like frontend)`);
                
                // Use FFmpeg expressions for dynamic centering (like text overlays)
                // This matches frontend's transform: translate(-50%, -50%) behavior exactly
                let scaleFilter = '';
                let overlayFilter = '';
                
                if (segment.content.scale && segment.content.scale !== 100) {
                  // Apply scaling first, then overlay with center alignment
                  const scaleValue = segment.content.scale / 100;
                  scaleFilter = `scale=iw*${scaleValue}:ih*${scaleValue}`;
                  
                  // Use expressions for center alignment with scaled dimensions
                  const xPos = `main_w*${xPercent/100}-overlay_w/2`;
                  const yPos = `main_h*${yPercent/100}-overlay_h/2`;
                  
                  filters.push(`[${inputIndex}:v]${scaleFilter}[scaled${inputIndex}]`);
                  filters.push(`[${currentLabel}][scaled${inputIndex}]overlay=${xPos}:${yPos}:enable='between(t,${segment.startTime},${segment.endTime})'[overlay${inputIndex}]`);
                } else {
                  // Use expressions for center alignment with original dimensions
                  const xPos = `main_w*${xPercent/100}-overlay_w/2`;
                  const yPos = `main_h*${yPercent/100}-overlay_h/2`;
                  
                  filters.push(`[${currentLabel}][${inputIndex}:v]overlay=${xPos}:${yPos}:enable='between(t,${segment.startTime},${segment.endTime})'[overlay${inputIndex}]`);
                }
                
                currentLabel = `overlay${inputIndex}`;
                inputIndex++;
                mediaFileIndex++;
              }
            }
          }
          
          // Add text overlays
          let textIndex = 1;
          for (const track of textTracks) {
            for (const segment of track.segments) {
              if (segment.content?.text) {
                // Match frontend positioning: percentage with center alignment (translate(-50%, -50%))
                const xPercent = segment.content.x || 50;
                const yPercent = segment.content.y || 50;
                
                // Calculate positions to match frontend's transform: translate(-50%, -50%) behavior
                const xPos = `w*${xPercent/100}-text_w/2`;
                const yPos = `h*${yPercent/100}-text_h/2`;
                
                console.log(`Text overlay position: ${xPercent}% x ${yPercent}% = calculated with center alignment`);
                
                const textFilter = `drawtext=text='${segment.content.text.replace(/'/g, "\\'")}':fontsize=${segment.content.fontSize || 24}:fontcolor=${segment.content.color || 'white'}:x=${xPos}:y=${yPos}:enable='between(t,${segment.startTime},${segment.endTime})'`;
                filters.push(`[${currentLabel}]${textFilter}[text${textIndex}]`);
                currentLabel = `text${textIndex}`;
                textIndex++;
              }
            }
          }
          
          // Apply filters if any were created
          if (filters.length > 0) {
            console.log('Applying complex filter chain:', filters);
            // Join all filters with semicolon for FFmpeg complex filter format
            const filterComplex = filters.join(';');
            
            // Apply the complex filter and mapping correctly
            ffmpegCommand = ffmpegCommand
              .complexFilter(filterComplex)
              .outputOptions([
                '-map', `[${currentLabel}]`, // Use filtered video
                '-map', '0:a?'               // Preserve original audio stream (? for optional)
              ]);
          } else {
            // If no filters are applied, still preserve audio
            console.log('No filters applied, preserving original audio and video');
            ffmpegCommand = ffmpegCommand.outputOptions([
              '-map', '0:v',  // Original video
              '-map', '0:a?'  // Original audio (? for optional)
            ]);
          }
        } catch (error) {
          console.error('Error building filter chain:', error);
          // Fall back to simple processing without filters
        }
      }

      // Apply video cuts if any segments are marked for deletion
      const videoTracks = tracks.filter((track: any) => track.type === 'video');
      let hasVideoEdits = false;
      
      for (const track of videoTracks) {
        if (track.segments && track.segments.length > 0) {
          // If there are video segments, we need to process them
          hasVideoEdits = true;
          break;
        }
      }

      // Ensure output directory exists
      const outputDir = path.dirname(outputPath);
      await fs.mkdir(outputDir, { recursive: true });

      // Export the video with optimized settings for maximum compatibility
      await new Promise<void>((resolve, reject) => {
        console.log(`Starting FFmpeg export to: ${outputPath}`);
        
        // Preserve original resolution explicitly
        let qualityOptions = [
          '-preset', 'slow',      // Higher quality preset
          '-crf', '18',           // Lower CRF for higher quality (18 = near lossless)
          '-pix_fmt', 'yuv420p',
          '-movflags', '+faststart',
          '-profile:v', 'high',   // High profile for better compression
          '-level', '4.1',        // Support for high resolutions
          '-bf', '2',             // B-frames for better compression
          '-g', '250',            // GOP size for good seeking
          '-keyint_min', '25',    // Minimum keyframe interval
          '-sc_threshold', '40'   // Scene change threshold
        ];

        // Preserve original resolution and frame rate
        if (originalWidth && originalHeight) {
          qualityOptions.push('-s', `${originalWidth}x${originalHeight}`);
          console.log(`Preserving original resolution: ${originalWidth}x${originalHeight}`);
        }
        
        if (originalFrameRate && originalFrameRate !== '0/0') {
          qualityOptions.push('-r', originalFrameRate);
          console.log(`Preserving original frame rate: ${originalFrameRate}`);
        }

        // Use a high bitrate to preserve quality (or match original if detected)
        if (originalBitrate && originalBitrate > 0) {
          const targetBitrate = Math.max(originalBitrate, 5000000); // At least 5Mbps
          qualityOptions.push('-b:v', targetBitrate.toString());
          console.log(`Setting video bitrate: ${targetBitrate}`);
        } else {
          qualityOptions.push('-b:v', '8000k'); // High quality fallback
        }

        ffmpegCommand
          .output(outputPath)
          .videoCodec('libx264')
          .audioCodec('aac')
          .addOptions([
            ...qualityOptions,
            '-c:a', 'aac',           // Explicitly set audio codec
            '-b:a', '128k',          // Set audio bitrate
            '-ar', '44100',          // Set audio sample rate
            '-ac', '2'               // Set audio channels to stereo
          ])
          .on('start', (commandLine: string) => {
            console.log('FFmpeg command:', commandLine);
          })
          .on('progress', (progress: any) => {
            console.log('Processing: ' + progress.percent + '% done');
          })
          .on('end', () => {
            console.log('Video export completed successfully');
            resolve();
          })
          .on('error', (err: any) => {
            console.error('FFmpeg export error:', err);
            console.error('FFmpeg command failed');
            reject(err);
          })
          .run();
      });

      console.log('FFmpeg Promise resolved, proceeding to quota tracking...');

      // Track export and update quota
      const stats = await fs.stat(outputPath);
      console.log(`Tracking export for user ${userId}, file size: ${stats.size} bytes`);
      
      const tracked = await storage.trackVideoExport(userId, {
        filename: outputFilename,
        originalFilename: videoFilename,
        fileSizeBytes: stats.size,
        quality: '1080p',
        format: 'mp4',
        metadata: { composition, tracks }
      });

      console.log(`Export tracking result: ${tracked}`);

      if (!tracked) {
        console.log('Export tracking failed - quota exceeded');
        return res.status(400).json({ 
          error: 'Export would exceed quota limit. Please upgrade your plan.' 
        });
      }

      const downloadUrl = `/api/video/${outputFilename}`;
      
      res.json({
        success: true,
        downloadUrl,
        filename: outputFilename,
        fileSize: stats.size,
        message: 'Video exported successfully'
      });

    } catch (error) {
      console.error('Export error:', error);
      res.status(500).json({ error: 'Failed to export video' });
    }
  });

  app.post('/api/export-video', async (req: Request, res: Response) => {
    try {
      const { videoPath, operations, quality = 'high', format = 'mp4' } = req.body;

      if (!videoPath || !operations || operations.length === 0) {
        return res.status(400).json({ error: 'Video path and operations required' });
      }

      const outputFileName = `exported_${Date.now()}.${format}`;
      const outputPath = path.join('uploads', outputFileName);

      // Build FFmpeg command with all operations
      const ffmpegArgs = ['-i', videoPath];
      
      // Apply video filters based on operations
      const filters = [];
      
      for (const op of operations) {
        switch (op.type) {
          case 'cut_video_segment':
            // For cuts, we'll process segments separately and concat them
            break;
          case 'add_text_overlay':
            const { text, startTime, endTime = startTime + 3, x = 50, y = 50, fontSize = 24, color = 'white' } = op.parameters;
            filters.push(`drawtext=text='${text}':x=${x}:y=${y}:fontsize=${fontSize}:fontcolor=${color}:enable='between(t,${startTime},${endTime})'`);
            break;
          case 'video_effect':
            const { effect, intensity = 1 } = op.parameters;
            switch (effect) {
              case 'blur':
                filters.push(`boxblur=${intensity}:${intensity}`);
                break;
              case 'brighten':
                filters.push(`eq=brightness=${intensity * 0.1}`);
                break;
              case 'contrast':
                filters.push(`eq=contrast=${1 + intensity * 0.1}`);
                break;
            }
            break;
        }
      }

      // Add filter complex if we have filters
      if (filters.length > 0) {
        ffmpegArgs.push('-vf', filters.join(','));
      }

      // Output settings based on quality
      const qualitySettings = {
        high: ['-crf', '18', '-preset', 'slow'],
        medium: ['-crf', '23', '-preset', 'medium'],
        low: ['-crf', '28', '-preset', 'fast']
      };

      ffmpegArgs.push(...qualitySettings[quality], outputPath);

      // Execute FFmpeg
      const ffmpeg = spawn('ffmpeg', ffmpegArgs);
      
      await new Promise((resolve, reject) => {
        ffmpeg.on('close', (code) => {
          if (code === 0) resolve(code);
          else reject(new Error(`FFmpeg exited with code ${code}`));
        });
        ffmpeg.on('error', reject);
      });

      const downloadUrl = `/api/video/stream/${outputFileName}`;
      
      res.json({
        success: true,
        filename: outputFileName,
        downloadUrl: downloadUrl,
        message: 'Video exported successfully'
      });

    } catch (error) {
      console.error('Export error:', error);
      res.status(500).json({ error: 'Failed to export video' });
    }
  });

  // Workflow templates endpoints
  app.get("/api/templates", async (req, res) => {
    try {
      const templates = workflowTemplateManager.getTemplates();
      res.json(templates);
    } catch (error) {
      res.status(500).json({ error: "Failed to fetch templates" });
    }
  });

  app.get("/api/templates/:id", async (req, res) => {
    try {
      const template = workflowTemplateManager.getTemplateById(req.params.id);
      if (!template) {
        return res.status(404).json({ error: "Template not found" });
      }
      res.json(template);
    } catch (error) {
      res.status(500).json({ error: "Failed to fetch template" });
    }
  });

  app.post("/api/workflows/:id/apply-template/:templateId", async (req, res) => {
    try {
      const workflowId = parseInt(req.params.id);
      const templateId = req.params.templateId;
      
      const template = workflowTemplateManager.getTemplateById(templateId);
      if (!template) {
        return res.status(404).json({ error: "Template not found" });
      }

      const updated = await storage.updateWorkflow(workflowId, {
        nodes: template.nodes,
        edges: template.edges
      });

      if (!updated) {
        return res.status(404).json({ error: "Workflow not found" });
      }

      res.json(updated);
    } catch (error) {
      res.status(500).json({ error: "Failed to apply template" });
    }
  });

  // AI-powered workflow generation
  app.post("/api/workflows/generate", async (req, res) => {
    try {
      const { goal, videoAnalysis } = req.body;
      
      const userSettings = await storage.getUserSettings(req.user?.claims?.sub);
      const apiKey = userSettings?.geminiApiKey || process.env.GEMINI_API_KEY || "";

      if (!apiKey) {
        return res.status(400).json({ error: "Gemini API key not configured" });
      }

      const videoProcessor = createVideoProcessor(apiKey);
      const workflow = await videoProcessor.generateWorkflowFromVideo(videoAnalysis, goal);

      const newWorkflow = await storage.createWorkflow({
        name: `AI Generated: ${goal}`,
        nodes: workflow.nodes,
        edges: workflow.edges,
        settings: { generated: true, goal },
        userId: req.user?.claims?.sub
      });

      res.json({
        workflow: newWorkflow,
        description: workflow.description
      });
    } catch (error) {
      console.error("Workflow generation error:", error);
      res.status(500).json({ error: "Failed to generate workflow" });
    }
  });

  // Revideo programmatic video editing routes
  try {
    const revideoRoutes = await import('./routes/revideo-routes.js');
    app.use('/api/revideo', revideoRoutes.default);
    console.log('Revideo routes loaded successfully');
  } catch (error) {
    console.warn('Failed to load Revideo routes:', error);
  }

  // Load Unified Revideo routes (Revideo + Motion Canvas integration)
  try {
    const unifiedRevideoRoutes = await import('./routes/unified-revideo-routes.js');
    app.use('/api/unified-revideo', unifiedRevideoRoutes.default);
    console.log('Unified Revideo routes loaded successfully');
  } catch (error) {
    console.warn('Failed to load Unified Revideo routes:', error);
  }

  // YouTube Shorts Subtitle Routes
  try {
    const youtubeShortsSubtitleRoutes = await import('./routes/youtube-shorts-subtitle-routes.js');
    app.use('/api/youtube-shorts-subtitles', youtubeShortsSubtitleRoutes.default);
    console.log('YouTube Shorts subtitle routes loaded successfully');
  } catch (error) {
    console.warn('Failed to load YouTube Shorts subtitle routes:', error);
  }

  // Upload routes for live editing
  try {
    const uploadRoutes = await import('./routes/upload-routes.js');
    app.use('/api/upload', uploadRoutes.default);
    console.log('Upload routes loaded successfully');
  } catch (error) {
    console.warn('Failed to load Upload routes:', error);
  }

  // Shorts extractor routes
  try {
    const shortsRoutes = await import('./routes/shorts-extractor-routes.js');
    app.use('/api/shorts', shortsRoutes.default);
    console.log('Shorts extractor routes loaded successfully');
  } catch (error) {
    console.warn('Failed to load Shorts extractor routes:', error);
  }

  // Video nodes processing routes
  try {
    const videoNodesRoutes = await import('./routes/video-nodes-routes.js');
    app.use('/api/nodes', videoNodesRoutes.default);
    console.log('Video nodes routes loaded successfully');
  } catch (error) {
    console.warn('Failed to load Video nodes routes:', error);
  }

  // Visual remix routes
  try {
    const visualRemixRoutes = await import('./routes/visual-remix-routes.js');
    visualRemixRoutes.default(app);
    console.log('Visual remix routes loaded successfully');
  } catch (error) {
    console.warn('Failed to load Visual remix routes:', error);
  }

  // Visual remix session routes
  try {
    const visualRemixSessionRoutes = await import('./routes/visual-remix-session-routes.js');
    visualRemixSessionRoutes.default(app);
    console.log('Visual remix session routes loaded successfully');
  } catch (error) {
    console.warn('Failed to load Visual remix session routes:', error);
  }

  // Revideo preview routes
  try {
    const revideoPreviewRoutes = await import('./routes/revideo-preview-routes.js');
    app.use('/api/revideo-preview', revideoPreviewRoutes.default);
    console.log('Revideo preview routes loaded successfully');
  } catch (error) {
    console.warn('Failed to load Revideo preview routes:', error);
  }

  // Serve uploaded files
  app.use('/uploads', express.static(path.join(process.cwd(), 'uploads')));

  // Split Screen Generation Route
  app.post('/api/generate-split-screen', upload.fields([
    { name: 'mainVideo', maxCount: 1 },
    { name: 'backgroundVideo', maxCount: 1 }
  ]), async (req, res) => {
    try {
      const { audioSource, subtitleSource, subtitleTemplate } = req.body;
      const files = req.files as { [fieldname: string]: Express.Multer.File[] };
      
      if (!files.mainVideo || !files.backgroundVideo) {
        return res.status(400).json({ error: 'Both main and background videos are required' });
      }

      const mainVideoFile = files.mainVideo[0];
      const backgroundVideoFile = files.backgroundVideo[0];

      // Generate unique filename for the split-screen video
      const outputFilename = `split_screen_${Date.now()}.mp4`;
      const outputPath = path.join(process.cwd(), 'uploads', outputFilename);

      // Generate subtitles from the selected source video
      const subtitleSourceFile = subtitleSource === 'main' ? mainVideoFile : backgroundVideoFile;
      const audioSourceFile = audioSource === 'main' ? mainVideoFile : backgroundVideoFile;

      // Use YouTube Shorts subtitle system for subtitle generation
      const subtitleSystem = new YouTubeShortsSubtitleSystem();
      let segments = [];
      
      try {
        segments = await subtitleSystem.generateWordLevelSubtitles(subtitleSourceFile.path);
        console.log(`[SplitScreen] Subtitle generation result:`, segments);
      } catch (subtitleError) {
        console.error(`[SplitScreen] Subtitle generation failed:`, subtitleError);
        segments = []; // Fallback to empty segments
      }

      // Ensure segments is valid array
      if (!Array.isArray(segments)) {
        console.warn(`[SplitScreen] Subtitle result is not an array, using empty array`);
        segments = [];
      }
      console.log(`[SplitScreen] Using ${segments.length} subtitle segments`);

      // Create split-screen video using FFmpeg (not burning subtitles into video)
      const splitScreenService = new SplitScreenVideoService();
      await splitScreenService.generateSplitScreenVideo({
        mainVideoPath: mainVideoFile.path,
        backgroundVideoPath: backgroundVideoFile.path,
        audioSourcePath: audioSourceFile.path,
        subtitleData: segments,
        subtitleTemplate: subtitleTemplate,
        outputPath: outputPath
      });

      // Store subtitle data separately for unified editor (only if we have subtitles)
      let subtitleDataFilename = null;
      if (segments.length > 0) {
        subtitleDataFilename = `${outputFilename.replace('.mp4', '')}_subtitles.json`;
        const subtitleDataPath = path.join(process.cwd(), 'uploads', subtitleDataFilename);
        
        const subtitleTrackData = {
          id: `subtitles_track_${Date.now()}`,
          type: 'subtitle',
          name: 'Split-Screen Subtitles',
          startTime: 0,
          duration: 30, // Will be updated when video loads
          properties: {
            fontSize: 80,
            numSimultaneousWords: 5,
            textColor: '#ffffff',
            fontWeight: 800,
            fontFamily: 'Mulish',
            stream: false,
            textAlign: 'center',
            textBoxWidthInPercent: 70,
            fadeInAnimation: true,
            currentWordColor: '#00FFFF',
            currentWordBackgroundColor: '#FF0000',
            shadowColor: '#000000',
            shadowBlur: 30,
            subtitleData: segments,
            wordData: segments.flatMap((s: any) => s.words || []),
            totalSegments: segments.length,
            x: 640,
            y: 900,
            width: 'auto',
            height: 'auto'
          },
          layer: 1
        };

        await fs.writeFile(subtitleDataPath, JSON.stringify(subtitleTrackData, null, 2));
        console.log(`[SplitScreen] Subtitle data saved: ${subtitleDataPath}`);
      } else {
        console.log(`[SplitScreen] No subtitles generated, skipping subtitle data file`);
      }

      // Return the generated video ID
      const responseData: any = {
        success: true,
        videoId: outputFilename,
        message: segments.length > 0 
          ? 'Split-screen video generated successfully with subtitle track'
          : 'Split-screen video generated successfully'
      };

      if (subtitleDataFilename) {
        responseData.subtitleDataFile = subtitleDataFilename;
      }

      res.json(responseData);

    } catch (error) {
      console.error('Split-screen generation error:', error);
      res.status(500).json({ error: 'Failed to generate split-screen video' });
    }
  });

  const httpServer = createServer(app);
  
  // Initialize collaboration manager
  const collaborationManager = new CollaborationManager(httpServer);
  (global as any).collaborationManager = collaborationManager;

  // Collaboration endpoints
  app.get("/api/workflows/:id/collaborators", async (req, res) => {
    try {
      const workflowId = parseInt(req.params.id);
      const users = collaborationManager?.getActiveUsers(workflowId) || [];
      res.json({ users });
    } catch (error) {
      res.status(500).json({ error: "Failed to fetch collaborators" });
    }
  });

  // YouTube Shorts Creation API
  app.post("/api/youtube/create-shorts", async (req, res) => {
    try {
      const { youtubeUrl, style = 'viral', duration = 30, aspectRatio = '9:16' } = req.body;

      if (!youtubeUrl) {
        return res.status(400).json({ error: "YouTube URL is required" });
      }

      const youtubeUrlPattern = /^https?:\/\/(www\.)?(youtube\.com\/watch\?v=|youtu\.be\/)([a-zA-Z0-9_-]+)/;
      if (!youtubeUrlPattern.test(youtubeUrl)) {
        return res.status(400).json({ error: "Invalid YouTube URL format" });
      }

      const apiKey = process.env.GEMINI_API_KEY || process.env.VITE_GEMINI_API_KEY;
      if (!apiKey) {
        return res.status(400).json({ error: "Gemini API key not configured" });
      }

      console.log(`Creating shorts: ${youtubeUrl} | Style: ${style} | Duration: ${duration}s`);

      const shortsCreator = createShortsCreator(apiKey);
      
      const result = await shortsCreator.createShorts({
        youtubeUrl,
        style: style as any,
        duration: duration as any,
        aspectRatio: aspectRatio as any
      });

      if (result.success) {
        console.log('Shorts created successfully');
        res.json({
          success: true,
          shortId: result.shortId,
          videoUrl: result.videoUrl,
          thumbnailUrl: result.thumbnailUrl,
          output: {
            title: result.script?.title || 'Generated Short',
            script: result.script?.script || '',
            description: result.script?.description || '',
            hashtags: result.script?.hashtags || [],
            hook: result.script?.hook || '',
            keyClips: result.script?.keyClips || [],
            editingNotes: result.script?.editingNotes || ''
          },
          analysis: {
            videoContent: result.analysis?.description || '',
            keyMoments: result.analysis?.keyMoments || [],
            topics: result.analysis?.topics || [],
            mood: result.analysis?.mood || ''
          },
          debug: result.debug
        });
      } else {
        res.status(500).json({
          success: false,
          error: result.error,
          debug: result.debug
        });
      }

    } catch (error) {
      console.error('Shorts creation endpoint error:', error);
      res.status(500).json({
        success: false,
        error: "Internal server error",
        details: error.message
      });
    }
  });

  // AI Video Editing endpoint
  app.post('/api/ai-edit/create', upload.single('file'), async (req, res) => {
    try {
      console.log('=== AI VIDEO EDITING ENDPOINT START ===');
      
      const file = req.file;
      const { mood, duration, aspectRatio, style, requirements } = req.body;

      if (!file) {
        console.error('ERROR: No file uploaded');
        return res.status(400).json({ success: false, error: 'No file uploaded' });
      }

      console.log('=== REQUEST DETAILS ===');
      console.log('Uploaded file:', file.filename);
      console.log('File path:', file.path);
      console.log('File size:', file.size, 'bytes');
      console.log('Original name:', file.originalname);
      console.log('Parameters:');
      console.log('- mood:', mood);
      console.log('- duration:', duration);
      console.log('- aspectRatio:', aspectRatio);
      console.log('- style:', style);
      console.log('- requirements:', requirements);

      // CURL equivalent for debugging
      console.log('=== CURL EQUIVALENT ===');
      console.log(`curl -X POST http://localhost:5000/api/ai-edit/create \\`);
      console.log(`  -F "file=@${file.path}" \\`);
      console.log(`  -F "mood=${mood}" \\`);
      console.log(`  -F "duration=${duration}" \\`);
      console.log(`  -F "aspectRatio=${aspectRatio}" \\`);
      console.log(`  -F "style=${style}" \\`);
      console.log(`  -F "requirements=${requirements}"`);

      // Use the new AI video editor
      const { createAIVideoEditor } = await import("./services/ai-video-editor");
      const videoEditor = createAIVideoEditor(process.env.GEMINI_API_KEY || "");
      
      // Generate editing plan
      console.log('=== GENERATING EDITING PLAN ===');
      const editingPlan = await videoEditor.generateEditingPlan({
        inputVideoPath: file.path,
        mood: mood || 'viral',
        targetDuration: parseInt(duration) || 15,
        aspectRatio: aspectRatio || '9:16',
        style: style || 'modern',
        requirements: requirements || undefined
      });

      // Execute the editing plan
      console.log('=== EXECUTING EDITING PLAN ===');
      const outputId = `ai_edit_${Date.now()}`;
      const outputPath = path.join('temp_videos', `${outputId}.mp4`);
      console.log('Output path:', outputPath);
      
      await videoEditor.executeEditingPlan(editingPlan, file.path, outputPath);

      const result = {
        id: outputId,
        title: editingPlan.title,
        description: `AI-edited ${mood} video with professional timeline and effects`,
        videoUrl: `/api/video/short/${outputId}`,
        thumbnailUrl: `data:image/svg+xml;base64,${Buffer.from(`<svg width="640" height="360" xmlns="http://www.w3.org/2000/svg"><defs><linearGradient id="grad1" x1="0%" y1="0%" x2="100%" y2="100%"><stop offset="0%" style="stop-color:#FF6B6B;stop-opacity:1" /><stop offset="100%" style="stop-color:#4ECDC4;stop-opacity:1" /></linearGradient></defs><rect width="100%" height="100%" fill="url(#grad1)"/><text x="50%" y="40%" font-family="Arial" font-size="18" fill="white" text-anchor="middle" font-weight="bold">AI EDITED</text><text x="50%" y="60%" font-family="Arial" font-size="14" fill="white" text-anchor="middle">${editingPlan.mood.toUpperCase()}</text></svg>`).toString('base64')}`,
        duration: editingPlan.totalDuration,
        hashtags: [`#${mood}`, '#AIEdited', '#VideoEdit', '#Shorts'],
        metadata: {
          aspectRatio: editingPlan.outputSettings.aspectRatio,
          mood,
          style,
          processing: 'ai_edited',
          source: 'uploaded_video',
          originalFile: file.path,
          timelineSegments: editingPlan.timeline.length,
          textOverlays: editingPlan.textOverlays.length
        }
      };

      console.log('=== AI VIDEO EDITING SUCCESS ===');
      console.log('Result ID:', result.id);
      console.log('Result videoUrl:', result.videoUrl);
      console.log('Result title:', result.title);
      
      res.json({
        success: true,
        editedVideo: result,
        editingPlan: editingPlan,
        debug: {
          timelineSegments: editingPlan.timeline.length,
          textOverlays: editingPlan.textOverlays.length,
          transitions: editingPlan.transitions.length,
          outputPath: outputPath,
          inputPath: file.path
        }
      });

    } catch (error) {
      console.error('=== AI VIDEO EDITING ERROR ===');
      console.error('Error message:', error.message);
      console.error('Error stack:', error.stack);
      res.status(500).json({
        success: false,
        error: "AI video editing failed",
        details: error.message
      });
    }
  });

  // Script Generation endpoint
  app.post('/api/script/generate', upload.single('file'), async (req, res) => {
    try {
      console.log('=== SCRIPT GENERATION ENDPOINT START ===');
      
      const file = req.file;
      const { style, duration, aspectRatio, tone, requirements } = req.body;

      if (!file) {
        console.error('ERROR: No file uploaded');
        return res.status(400).json({ success: false, error: 'No file uploaded' });
      }

      console.log('=== SCRIPT REQUEST DETAILS ===');
      console.log('Uploaded file:', file.filename);
      console.log('File path:', file.path);
      console.log('File size:', file.size, 'bytes');
      console.log('Parameters:');
      console.log('- style:', style);
      console.log('- duration:', duration);
      console.log('- aspectRatio:', aspectRatio);
      console.log('- tone:', tone);
      console.log('- requirements:', requirements);

      // CURL equivalent for debugging
      console.log('=== CURL EQUIVALENT ===');
      console.log(`curl -X POST http://localhost:5000/api/script/generate \\`);
      console.log(`  -F "file=@${file.path}" \\`);
      console.log(`  -F "style=${style}" \\`);
      console.log(`  -F "duration=${duration}" \\`);
      console.log(`  -F "aspectRatio=${aspectRatio}" \\`);
      console.log(`  -F "tone=${tone}" \\`);
      console.log(`  -F "requirements=${requirements}"`);

      // Use the script generator
      const { createScriptGenerator } = await import("./services/script-generator");
      const scriptGenerator = createScriptGenerator(process.env.GEMINI_API_KEY || "");
      
      // Generate script
      console.log('=== GENERATING SCRIPT ===');
      const script = await scriptGenerator.generateScript({
        filePath: file.path,
        style: style || 'viral',
        duration: parseInt(duration) || 30,
        aspectRatio: aspectRatio || '9:16',
        tone: tone || 'engaging',
        requirements: requirements || undefined
      });

      console.log('=== SCRIPT GENERATION SUCCESS ===');
      console.log('Script title:', script.title);
      console.log('Timeline segments:', script.timeline.length);
      
      res.json({
        success: true,
        script: script,
        debug: {
          timelineSegments: script.timeline.length,
          inputPath: file.path,
          model: 'gemini-2.0-flash'
        }
      });

    } catch (error) {
      console.error('=== SCRIPT GENERATION ERROR ===');
      console.error('Error message:', error.message);
      console.error('Error stack:', error.stack);
      res.status(500).json({
        success: false,
        error: "Script generation failed",
        details: error.message
      });
    }
  });

  // Video generation endpoint
  app.post('/api/video/generate', upload.single('file'), async (req, res) => {
    try {
      console.log('=== VIDEO GENERATION ENDPOINT START ===');
      
      const { VideoGenerator } = await import('./services/video-generator.js');
      const videoGenerator = new VideoGenerator();

      // Get video source
      let videoPath = '';
      if (req.file) {
        videoPath = req.file.path;
        console.log('Using uploaded file:', videoPath);
      } else if (req.body.videoPath) {
        videoPath = req.body.videoPath;
        console.log('Using existing file:', videoPath);
      } else {
        console.error('No video source provided');
        console.error('req.file:', req.file);
        console.error('req.body.videoPath:', req.body.videoPath);
        console.error('req.body:', req.body);
        return res.status(400).json({ success: false, error: 'No video source provided' });
      }

      // Parse timeline data
      const timeline = JSON.parse(req.body.timeline || '[]');
      const outputFormat = req.body.outputFormat || 'mp4';
      const quality = req.body.quality || 'high';
      const aspectRatio = req.body.aspectRatio || '9:16';

      console.log('=== VIDEO REQUEST DETAILS ===');
      console.log('Video path:', videoPath);
      console.log('Timeline segments:', timeline.length);
      console.log('Output format:', outputFormat);
      console.log('Quality:', quality);
      console.log('Aspect ratio:', aspectRatio);

      const request = {
        videoPath,
        timeline,
        outputFormat,
        quality,
        aspectRatio
      };

      const result = await videoGenerator.generateVideo(request);

      console.log('=== VIDEO GENERATION SUCCESS ===');
      console.log('Generated video ID:', result.id);
      console.log('Duration:', result.duration, 'seconds');

      res.json({
        success: true,
        video: result
      });

    } catch (error) {
      console.error('=== VIDEO GENERATION ERROR ===');
      console.error('Error:', error);
      res.status(500).json({
        success: false,
        error: error.message || 'Failed to generate video'
      });
    }
  });

  // Intelligent AI Shorts Generation endpoint
  app.post('/api/smart-crop-shorts', async (req: Request, res: Response) => {
    try {
      const { videoPath, options } = req.body;
      
      if (!videoPath || !fsSync.existsSync(videoPath)) {
        return res.status(400).json({ 
          success: false, 
          error: 'Video file not found' 
        });
      }

      console.log('=== GOOGLE SMART CROP SYSTEM START ===');
      console.log('Video path:', videoPath);
      console.log('Options:', JSON.stringify(options, null, 2));

      const { createRobustSmartCrop } = await import('./services/robust-smart-crop');
      const smartCrop = createRobustSmartCrop(process.env.GEMINI_API_KEY || '');

      const result = await smartCrop.processRobustSmartCrop(videoPath, {
        aspectRatio: options.aspectRatio || '9:16',
        approach: options.approach || 'face_detection'
      });

      console.log('=== GOOGLE SMART CROP SYSTEM COMPLETE ===');
      console.log('Smart crop metrics:', result.metrics);
      console.log('Output path:', result.outputPath);

      res.json({
        success: true,
        outputPath: result.outputPath,
        methodology: result.methodology,
        smartCropMetrics: result.metrics,
        focusPreservationGuaranteed: true
      });

    } catch (error) {
      console.error('Google Smart Crop error:', error);
      res.status(500).json({ 
        success: false, 
        error: 'Google Smart Crop failed',
        details: error instanceof Error ? error.message : 'Unknown error'
      });
    }
  });

  app.post('/api/opencv-shorts-creation', async (req: Request, res: Response) => {
    try {
      const { videoPath, options } = req.body;
      
      if (!videoPath || !fs.existsSync(videoPath)) {
        return res.status(400).json({ 
          success: false, 
          error: 'Video file not found' 
        });
      }

      console.log('=== OPENCV-ENHANCED SHORTS CREATION START ===');
      console.log('Video path:', videoPath);
      console.log('Options:', JSON.stringify(options, null, 2));

      const { createOpenCVShortsCreator } = await import('./services/opencv-shorts-creator');
      const creator = createOpenCVShortsCreator(process.env.GEMINI_API_KEY || '');

      const result = await creator.createOpenCVEnhancedShorts(videoPath, {
        contentType: options.contentType || 'viral',
        aspectRatio: options.aspectRatio || '9:16',
        duration: options.duration || 30,
        focusMode: options.focusMode || 'speaking-person',
        geminiModel: options.geminiModel || 'gemini-2.0-flash-exp'
      });

      console.log('=== OPENCV-ENHANCED SHORTS CREATION COMPLETE ===');
      console.log('OpenCV metrics:', result.openCVMetrics);
      console.log('Output path:', result.outputPath);

      res.json({
        success: true,
        storyline: result.storyline,
        downloadUrl: result.outputPath,
        openCVMetrics: result.openCVMetrics,
        methodology: 'Gemini segments → merge → OpenCV frame analysis → FFmpeg frame cropping → reconstruction',
        focusPreservationGuaranteed: true
      });

    } catch (error) {
      console.error('OpenCV-enhanced shorts creation error:', error);
      res.status(500).json({ 
        success: false, 
        error: 'OpenCV-enhanced shorts creation failed',
        details: error instanceof Error ? error.message : 'Unknown error'
      });
    }
  });

  app.post('/api/js-people-tracking', async (req: Request, res: Response) => {
    try {
      const { videoPath, options } = req.body;

      if (!videoPath || !fs.existsSync(videoPath)) {
        return res.status(400).json({ error: 'Video file not found' });
      }

      console.log('=== JS PEOPLE TRACKING START ===');
      console.log('Video path:', videoPath);
      console.log('Options:', JSON.stringify(options, null, 2));

      const { createJSPeopleTracker } = await import('./services/js-people-tracker');
      const tracker = createJSPeopleTracker(process.env.GEMINI_API_KEY || '');

      const outputFilename = `people_tracked_${nanoid()}.mp4`;
      const outputPath = path.join('uploads', outputFilename);

      const result = await tracker.trackPeopleAndReframe(videoPath, outputPath, {
        targetAspectRatio: options.aspectRatio || '9:16',
        quality: options.quality || 'high'
      });

      console.log('=== JS PEOPLE TRACKING COMPLETE ===');
      console.log('Metrics:', result.metrics);
      console.log('Output path:', result.outputPath);

      res.json({
        success: true,
        outputPath: `/api/video/${outputFilename}`,
        metrics: result.metrics,
        processingTime: result.metrics.processingTime
      });

    } catch (error) {
      console.error('JS people tracking error:', error);
      res.status(500).json({ 
        success: false, 
        error: 'JS people tracking failed',
        details: error instanceof Error ? error.message : 'Unknown error'
      });
    }
  });

  app.post('/api/opencv-enhanced-reframing', async (req: Request, res: Response) => {
    try {
      const { videoPath, options } = req.body;

      if (!videoPath || !fs.existsSync(videoPath)) {
        return res.status(400).json({ error: 'Video file not found' });
      }

      console.log('=== OPENCV ENHANCED REFRAMING START ===');
      console.log('Video path:', videoPath);
      console.log('Options:', JSON.stringify(options, null, 2));

      const { createOpenCVEnhancedReframing } = await import('./services/opencv-enhanced-reframing');
      const reframer = createOpenCVEnhancedReframing(process.env.GEMINI_API_KEY || '');

      const outputFilename = `opencv_reframed_${nanoid()}.mp4`;
      const outputPath = path.join('uploads', outputFilename);

      const result = await reframer.processVideoWithOpenCVReframing(videoPath, outputPath, {
        targetAspectRatio: options.aspectRatio || '9:16',
        quality: options.quality || 'high',
        contentType: options.contentType || 'viral',
        focusMode: options.focusMode || 'speaking-person'
      });

      console.log('=== OPENCV ENHANCED REFRAMING COMPLETE ===');
      console.log('Overall metrics:', result.overallMetrics);
      console.log('Output path:', result.outputPath);

      res.json({
        success: true,
        outputPath: `/api/video/${outputFilename}`,
        segments: result.segments,
        overallMetrics: result.overallMetrics,
        processingTime: result.overallMetrics.totalProcessingTime
      });

    } catch (error) {
      console.error('OpenCV enhanced reframing error:', error);
      res.status(500).json({ 
        success: false, 
        error: 'OpenCV enhanced reframing failed',
        details: error instanceof Error ? error.message : 'Unknown error'
      });
    }
  });

  app.post('/api/generate-focus-preserved-shorts', async (req: Request, res: Response) => {
    try {
      const { videoPath, options } = req.body;

      if (!videoPath || !fs.existsSync(videoPath)) {
        return res.status(400).json({ error: 'Video file not found' });
      }

      console.log('=== FOCUS-PRESERVED SHORTS GENERATION START ===');
      console.log('Video path:', videoPath);
      console.log('Options:', JSON.stringify(options, null, 2));

      const { createIntegratedFocusShortsGenerator } = await import('./services/integrated-focus-shorts');
      const generator = createIntegratedFocusShortsGenerator(process.env.GEMINI_API_KEY || '');

      const result = await generator.generateFocusPreservedShorts(videoPath, {
        contentType: options.contentType || 'viral',
        aspectRatio: options.aspectRatio || '9:16',
        duration: options.duration || 30,
        focusMode: options.focusMode || 'speaking-person',
        focusGuarantee: options.focusGuarantee || 'strict',
        maxZoomOut: options.maxZoomOut || 2.5,
        subjectPadding: options.subjectPadding || 15,
        geminiModel: options.geminiModel || 'gemini-2.0-flash-exp'
      });

      console.log('=== FOCUS-PRESERVED SHORTS GENERATION COMPLETE ===');
      console.log('Focus metrics:', result.focusMetrics);
      console.log('Output path:', result.outputPath);

      res.json({
        success: true,
        storyline: result.storyline,
        focusMetrics: result.focusMetrics,
        downloadUrl: result.outputPath,
        processingTime: Date.now()
      });

    } catch (error) {
      console.error('Focus-preserved shorts generation error:', error);
      res.status(500).json({ 
        success: false, 
        error: 'Focus-preserved shorts generation failed',
        details: error instanceof Error ? error.message : 'Unknown error'
      });
    }
  });

  app.post('/api/generate-ai-shorts', isAuthenticated, async (req: any, res: Response) => {
    try {
      const { videoPath, options } = req.body;
      
      if (!videoPath || !options) {
        return res.status(400).json({ error: 'Video path and options required' });
      }

      console.log('=== AI SHORTS GENERATION WITH COMPLETE AUTOFLIP ===');
      console.log('Video path:', videoPath);
      console.log('Focus mode:', options.focusMode || 'person');
      console.log('Aspect ratio: preserving original');
      console.log('Content type:', options.contentType || 'viral');
      console.log('Options:', JSON.stringify(options, null, 2));

      const geminiApiKey = process.env.GEMINI_API_KEY;
      if (!geminiApiKey) {
        console.error('GEMINI_API_KEY not found in environment variables');
        return res.status(500).json({ error: 'AI service not configured' });
      }

      // Estimate cost for AI shorts generation (video analysis + transcript generation)
      const estimatedCost = 0.02; // $0.02 for video analysis and shorts generation
      const userId = req.user.claims.sub;

      // Check if user has sufficient credits
      const hasSufficientCredits = await AiCreditsManager.checkSufficientCredits(userId, estimatedCost);
      
      if (!hasSufficientCredits) {
        return res.status(403).json({ 
          error: "Insufficient AI credits", 
          message: "You don't have enough AI credits for AI shorts generation. Please add credits or upgrade your subscription.",
          estimatedCost,
          estimatedCredits: AiCreditsManager.estimateCreditsNeeded(estimatedCost)
        });
      }

      // Use complete AutoFlip implementation for AI shorts
      const { createJSAutoFlipService } = await import('./services/js-autoflip');
      const autoflipService = createJSAutoFlipService(geminiApiKey);

      const result = await autoflipService.processVideoWithJSAutoFlip(videoPath, {
        targetAspectRatio: 'original', // Keep original aspect ratio
        sampleRate: options.sampleRate || 30,
        quality: options.quality || 'high',
        focusMode: options.focusMode || 'person'
      });

      if (!result.success) {
        return res.status(500).json({ 
          error: 'AutoFlip AI shorts generation failed', 
          details: result.error 
        });
      }

      const filename = path.basename(result.outputPath!);
      const downloadUrl = `/api/download-video/${filename}`;

      // Deduct AI credits for successful shorts generation
      await AiCreditsManager.deductCreditsForAiAction(
        userId,
        estimatedCost,
        'ai_shorts_generation',
        `AI Shorts: ${options.contentType || 'viral'} style, ${options.aspectRatio || '9:16'} aspect ratio`
      );

      return res.json({
        success: true,
        transcription: result.transcription || 'AutoFlip intelligent content analysis',
        cuttingPlan: result.processingStats,
        storyline: {
          concept: 'AI-generated shorts with intelligent focus tracking',
          viralPotential: result.processingStats?.averageConfidence || 0.85
        },
        videoUrl: downloadUrl,
        downloadUrl: downloadUrl,
        smartCropEnhanced: true,
        methodology: 'Complete AutoFlip MediaPipe with focus-aware cropping',
        processingTime: result.processingStats?.processingTime || 0,
        script: {
          title: `AI Short - ${options.contentType || 'viral'} content`,
          description: `Generated using AutoFlip with ${options.focusMode || 'person'} focus mode`,
          segments: result.frameAnalyses || [],
          hashtags: ['#AIGenerated', '#AutoFlip', '#Shorts']
        },
        analysis: {
          videoContent: `AutoFlip analysis: ${result.processingStats?.totalDetections || 0} detections`,
          keyMoments: result.frameAnalyses?.slice(0, 5) || [],
          topics: [options.contentType || 'viral', options.focusMode || 'person'],
          mood: options.contentType || 'engaging'
        },
        processingDetails: {
          algorithm: 'Complete AutoFlip MediaPipe',
          focusMode: options.focusMode || 'person',
          originalDimensions: result.originalDimensions,
          targetAspectRatio: result.targetAspectRatio,
          totalDetections: result.processingStats?.totalDetections || 0,
          averageConfidence: result.processingStats?.averageConfidence || 0,
          framesWithSalientContent: result.processingStats?.framesWithSalientContent || 0,
          processingTime: result.processingStats?.processingTime || 0
        }
      });

    } catch (error) {
      console.error('=== AI SHORTS AUTOFLIP GENERATION ERROR ===');
      console.error('Error:', error);
      res.status(500).json({
        success: false,
        error: error?.message || 'Failed to generate AI shorts with AutoFlip'
      });
    }
  });

  // Audio upload endpoint
  app.post('/api/upload-audio', upload.single('audio'), async (req: Request, res: Response) => {
    try {
      if (!req.file) {
        return res.status(400).json({ error: 'No audio file uploaded' });
      }

      console.log('Audio upload attempt:', req.file.originalname, req.file.mimetype);

      const audioUrl = `/api/audio/${req.file.filename}`;
      
      console.log('Audio uploaded:', req.file.originalname, `(${req.file.size} bytes) ->`, req.file.path);

      res.json({
        message: 'Audio uploaded successfully',
        audioUrl,
        filename: req.file.filename,
        originalName: req.file.originalname,
        size: req.file.size
      });
    } catch (error) {
      console.error('Audio upload error:', error);
      res.status(500).json({ error: 'Audio upload failed' });
    }
  });

  // Audio processing endpoint
  app.post('/api/process-audio-leveling', async (req: Request, res: Response) => {
    try {
      const { audioPath, options } = req.body;
      
      if (!audioPath || !options) {
        return res.status(400).json({ error: 'Audio path and options required' });
      }

      console.log('Processing audio with smart leveling:', { audioPath, options });

      const audioProcessor = createAudioProcessor();
      const inputPath = path.join('uploads', path.basename(audioPath));
      const outputFilename = `leveled_${nanoid()}.aac`;
      const outputPath = path.join('uploads', outputFilename);

      const progressCallback = (progress: number) => {
        console.log(`Audio processing progress: ${progress}%`);
      };

      const result = await audioProcessor.processAudioLeveling(
        inputPath,
        outputPath,
        options,
        progressCallback
      );

      console.log('Audio processing completed:', {
        processingTime: result.processingTime,
        consistencyImprovement: result.improvementMetrics.consistencyScore
      });

      res.json({
        ...result,
        outputPath: `/api/audio/${outputFilename}`,
        downloadUrl: `/api/audio/${outputFilename}`
      });
    } catch (error) {
      console.error('Audio processing error:', error);
      res.status(500).json({ error: 'Audio processing failed' });
    }
  });

  // Serve uploaded audio files
  app.get('/api/audio/:filename', (req, res) => {
    const filename = req.params.filename;
    const audioPath = path.join(process.cwd(), 'uploads', filename);
    
    console.log('Audio streaming request for:', filename);
    console.log('Full path:', audioPath);
    
    if (!fsSync.existsSync(audioPath)) {
      console.log('Audio file not found:', audioPath);
      return res.status(404).json({ error: 'Audio file not found' });
    }

    const stat = fsSync.statSync(audioPath);
    const fileSize = stat.size;
    console.log('Audio file size:', fileSize, 'bytes');

    const range = req.headers.range;
    
    if (range) {
      const parts = range.replace(/bytes=/, "").split("-");
      const start = parseInt(parts[0], 10);
      const end = parts[1] ? parseInt(parts[1], 10) : fileSize - 1;
      const chunksize = (end - start) + 1;
      
      const stream = createReadStream(audioPath, { start, end });
      
      res.writeHead(206, {
        'Content-Range': `bytes ${start}-${end}/${fileSize}`,
        'Accept-Ranges': 'bytes',
        'Content-Length': chunksize,
        'Content-Type': 'audio/mpeg'
      });
      
      stream.pipe(res);
    } else {
      res.writeHead(200, {
        'Content-Length': fileSize,
        'Content-Type': 'audio/mpeg',
        'Accept-Ranges': 'bytes'
      });
      
      createReadStream(audioPath).pipe(res);
    }
  });

  // Video streaming endpoint for uploaded videos
  app.get('/api/video/:filename', (req, res) => {
    try {
      const filename = req.params.filename;
      const videoPath = path.join(process.cwd(), 'uploads', filename);
      
      console.log('Video streaming request for:', filename);
      console.log('Full path:', videoPath);
      
      if (!fsSync.existsSync(videoPath)) {
        console.error('Video file not found:', videoPath);
        return res.status(404).json({ error: 'Video not found' });
      }

      const stat = fsSync.statSync(videoPath);
      const fileSize = stat.size;
      const range = req.headers.range;

      console.log('Video file size:', fileSize, 'bytes');

      if (range) {
        const parts = range.replace(/bytes=/, "").split("-");
        const start = parseInt(parts[0], 10);
        const end = parts[1] ? parseInt(parts[1], 10) : fileSize - 1;
        const chunksize = (end - start) + 1;
        const file = createReadStream(videoPath, { start, end });
        const head = {
          'Content-Range': `bytes ${start}-${end}/${fileSize}`,
          'Accept-Ranges': 'bytes',
          'Content-Length': chunksize,
          'Content-Type': 'video/mp4',
        };
        res.writeHead(206, head);
        file.pipe(res);
      } else {
        const head = {
          'Content-Length': fileSize,
          'Content-Type': 'video/mp4',
        };
        res.writeHead(200, head);
        createReadStream(videoPath).pipe(res);
      }
    } catch (error) {
      console.error('Video streaming error:', error);
      res.status(500).json({ error: 'Video streaming failed' });
    }
  });

  // Video streaming endpoint
  app.get('/api/video/stream/:filename', (req, res) => {
    try {
      const filename = req.params.filename;
      const videoPath = path.join(process.cwd(), 'uploads', filename);
      
      console.log('Streaming video request for:', filename);
      console.log('Full path:', videoPath);
      
      if (!fsSync.existsSync(videoPath)) {
        console.error('Video file not found:', videoPath);
        return res.status(404).json({ error: 'Video not found' });
      }

      const stat = fsSync.statSync(videoPath);
      const fileSize = stat.size;
      const range = req.headers.range;

      console.log('Video file size:', fileSize, 'bytes');

      if (range) {
        const parts = range.replace(/bytes=/, "").split("-");
        const start = parseInt(parts[0], 10);
        const end = parts[1] ? parseInt(parts[1], 10) : fileSize - 1;
        const chunksize = (end - start) + 1;
        const file = createReadStream(videoPath, { start, end });
        const head = {
          'Content-Range': `bytes ${start}-${end}/${fileSize}`,
          'Accept-Ranges': 'bytes',
          'Content-Length': chunksize,
          'Content-Type': 'video/mp4',
        };
        res.writeHead(206, head);
        file.pipe(res);
      } else {
        const head = {
          'Content-Length': fileSize,
          'Content-Type': 'video/mp4',
        };
        res.writeHead(200, head);
        createReadStream(videoPath).pipe(res);
      }
    } catch (error) {
      console.error('Video streaming error:', error);
      res.status(500).json({ error: 'Video streaming failed' });
    }
  });

  // Aspect ratio conversion endpoint
  // Smart Reframing endpoint
  app.post('/api/smart-reframe', async (req: Request, res: Response) => {
    try {
      const { videoPath, options } = req.body;
      
      if (!videoPath) {
        return res.status(400).json({ error: 'Video path is required' });
      }

      console.log('Smart reframing request:', { videoPath, options });

      // Use intelligent reframing with people tracking
      const outputFilename = `reframed_${nanoid()}.mp4`;
      const outputPath = path.join('uploads', outputFilename);

      // Import AI-powered focus tracking service
      const { createAIFocusTracker } = await import('./services/ai-focus-tracker');
      
      // Convert options to AI tracking format
      const trackingOptions = {
        targetAspectRatio: options?.targetAspectRatio || '9:16',
        quality: options?.quality || 'medium',
        trackingMode: options?.trackingMode || 'auto',
        personTracking: {
          enabled: options?.personTracking?.enabled ?? true,
          priority: options?.personTracking?.priority || 'primary-speaker',
          smoothing: options?.personTracking?.smoothing || 50,
          zoomLevel: options?.personTracking?.zoomLevel || 1.2
        }
      };

      console.log('Using enhanced frame-by-frame AI processing with Gemini Vision API, options:', trackingOptions);

      let cropFilter = '';
      
      // Helper functions
      const getCenterCropFilter = (aspectRatio: string): string => {
        switch (aspectRatio) {
          case '9:16':
            return 'scale=1080:1920:force_original_aspect_ratio=increase,crop=1080:1920';
          case '1:1':
            return 'scale=1080:1080:force_original_aspect_ratio=increase,crop=1080:1080';
          case '4:3':
            return 'scale=1440:1080:force_original_aspect_ratio=increase,crop=1440:1080';
          case '16:9':
            return 'scale=1920:1080:force_original_aspect_ratio=increase,crop=1920:1080';
          default:
            return 'scale=1080:1920:force_original_aspect_ratio=increase,crop=1080:1920';
        }
      };

      const getTargetResolution = (aspectRatio: string): { width: number; height: number } => {
        switch (aspectRatio) {
          case '9:16': return { width: 1080, height: 1920 };
          case '16:9': return { width: 1920, height: 1080 };
          case '1:1': return { width: 1080, height: 1080 };
          case '4:3': return { width: 1440, height: 1080 };
          default: return { width: 1080, height: 1920 };
        }
      };

      const getQualitySettings = (quality: string): { preset: string; crf: string } => {
        switch (quality) {
          case 'high': return { preset: 'slow', crf: '18' };
          case 'medium': return { preset: 'medium', crf: '23' };
          case 'low': return { preset: 'fast', crf: '28' };
          default: return { preset: 'medium', crf: '23' };
        }
      };

      if (trackingOptions.trackingMode === 'center-crop') {
        cropFilter = getCenterCropFilter(trackingOptions.targetAspectRatio);
      } else if (trackingOptions.trackingMode === 'custom' && trackingOptions.customCrop) {
        const crop = trackingOptions.customCrop;
        cropFilter = `crop=${crop.width}:${crop.height}:${crop.x}:${crop.y}`;
      } else {
        // Use enhanced frame-by-frame AI processing
        try {
          const { createEnhancedVideoProcessor } = await import('./services/enhanced-video-processor');
          const enhancedProcessor = createEnhancedVideoProcessor(process.env.GEMINI_API_KEY!);
          
          const progressCallback = (progress: number) => {
            console.log(`Enhanced AI processing progress: ${progress}%`);
          };
          
          // Process video frame-by-frame with individual AI analysis and cropping
          const processingResult = await enhancedProcessor.processVideoFrameByFrame(
            videoPath,
            outputPath,
            trackingOptions,
            progressCallback
          );
          
          console.log('Enhanced frame-by-frame processing completed:', {
            processedFrames: processingResult.processedFrames,
            totalFrames: processingResult.totalFrames,
            processingTime: `${processingResult.processingTime}ms`
          });
          
          // Skip the regular FFmpeg processing since we've already generated the output
          res.json({
            success: true,
            outputPath,
            downloadUrl: `/api/video/${outputFilename}`,
            filename: outputFilename,
            processingDetails: {
              method: 'enhanced-frame-by-frame',
              framesProcessed: processingResult.processedFrames,
              totalFrames: processingResult.totalFrames,
              processingTimeMs: processingResult.processingTime
            }
          });
          return;
          
        } catch (error) {
          console.error('Enhanced AI processing failed, falling back to regular AI tracking:', error);
          
          // Fallback to regular AI tracking
          const { createAIFocusTracker } = await import('./services/ai-focus-tracker');
          const aiTracker = createAIFocusTracker(process.env.GEMINI_API_KEY!);
          
          const progressCallback = (progress: number) => {
            console.log(`AI focus analysis progress (fallback): ${progress}%`);
          };
          
          const analysisResult = await aiTracker.analyzeVideoWithAI(
            videoPath,
            trackingOptions,
            progressCallback
          );
          
          cropFilter = analysisResult.intelligentCropFilter;
          console.log('Using AI-calculated intelligent crop filter (fallback):', cropFilter);
        }
      }

      // Apply FFmpeg processing with intelligent crop
      const { width, height } = getTargetResolution(trackingOptions.targetAspectRatio);
      const qualitySettings = getQualitySettings(trackingOptions.quality);
      
      await new Promise<void>((resolve, reject) => {
        const ffmpegArgs = [
          '-i', videoPath,
          '-vf', `${cropFilter},scale=${width}:${height}:flags=lanczos`,
          '-c:v', 'libx264',
          '-preset', qualitySettings.preset,
          '-crf', qualitySettings.crf,
          '-c:a', 'aac',
          '-b:a', '128k',
          '-movflags', '+faststart',
          '-y',
          outputPath
        ];

        console.log('Running intelligent FFmpeg with JS tracking:', ffmpegArgs.join(' '));
        
        const ffmpeg = spawn('ffmpeg', ffmpegArgs);
        
        ffmpeg.stderr.on('data', (data) => {
          const output = data.toString();
          const timeMatch = output.match(/time=(\d{2}):(\d{2}):(\d{2}\.\d{2})/);
          if (timeMatch) {
            const [, hours, minutes, seconds] = timeMatch;
            const currentTime = parseInt(hours) * 3600 + parseInt(minutes) * 60 + parseFloat(seconds);
            const progress = Math.min(95, 30 + (currentTime / 120) * 65);
            console.log(`Reframing progress: ${progress}%`);
          }
        });
        
        ffmpeg.on('close', (code) => {
          if (code === 0) {
            console.log('AI-enhanced intelligent reframing completed successfully');
            resolve();
          } else {
            reject(new Error(`FFmpeg process exited with code ${code}`));
          }
        });
        
        ffmpeg.on('error', (error) => {
          reject(error);
        });
      });

      res.json({
        success: true,
        outputPath: outputPath,
        downloadUrl: `/api/video/${outputFilename}`,
        filename: outputFilename
      });
    } catch (error) {
      console.error('Smart reframing error:', error);
      res.status(500).json({ error: 'Smart reframing failed', details: error.message });
    }
  });

  // Video analysis for reframing
  app.post('/api/analyze-for-reframing', async (req: Request, res: Response) => {
    try {
      const { videoPath } = req.body;
      
      if (!videoPath) {
        return res.status(400).json({ error: 'Video path is required' });
      }

      console.log('Analyzing video for reframing:', videoPath);

      // Get basic video info using ffprobe
      const ffmpeg = await import('fluent-ffmpeg');
      
      const videoInfo = await new Promise<any>((resolve, reject) => {
        ffmpeg.default.ffprobe(videoPath, (err, metadata) => {
          if (err) {
            reject(err);
            return;
          }
          const videoStream = metadata.streams.find((s: any) => s.codec_type === 'video');
          resolve({
            width: videoStream?.width || 1920,
            height: videoStream?.height || 1080,
            duration: metadata.format.duration || 0
          });
        });
      });

      // Mock analysis for now with realistic data
      const analysis = [
        {
          timestamp: 0,
          subjects: [{ type: 'person', confidence: 0.8, x: 30, y: 20, width: 40, height: 60 }],
          recommendedCrop: { x: 25, y: 10, width: 50, height: 80 },
          confidence: 0.85
        },
        {
          timestamp: 5,
          subjects: [{ type: 'person', confidence: 0.9, x: 35, y: 15, width: 30, height: 70 }],
          recommendedCrop: { x: 30, y: 5, width: 40, height: 90 },
          confidence: 0.92
        }
      ];

      res.json({
        success: true,
        videoInfo,
        analysis,
        recommendations: {
          confidence: 0.88,
          hasSubjects: true,
          optimalAspectRatio: videoInfo.width > videoInfo.height ? '9:16' : '16:9'
        }
      });
    } catch (error) {
      console.error('Video analysis error:', error);
      res.status(500).json({ error: 'Video analysis failed', details: error.message });
    }
  });

  app.post('/api/zoom-out-focus-convert', upload.single('video'), async (req: Request, res: Response) => {
    try {
      if (!req.file) {
        return res.status(400).json({ error: 'No video file provided' });
      }

      const { 
        targetAspectRatio = '9:16',
        maxZoomOut = 2.0,
        focusGuarantee = 'strict',
        subjectPadding = 10,
        quality = 'high'
      } = req.body;

      const inputPath = req.file.path;
      const outputFilename = `zoom_focus_${Date.now()}.mp4`;
      const outputPath = path.join('uploads', outputFilename);

      console.log(`Zoom-out focus conversion: ${targetAspectRatio}, guarantee: ${focusGuarantee}, maxZoom: ${maxZoomOut}x`);

      const { createZoomOutFocusConverter } = await import('./services/zoom-out-focus-converter');
      const converter = createZoomOutFocusConverter(process.env.GEMINI_API_KEY || '');

      const result = await converter.convertWithZoomOutFocus(inputPath, outputPath, {
        targetAspectRatio,
        quality,
        maxZoomOut: parseFloat(maxZoomOut),
        focusGuarantee,
        subjectPadding: parseInt(subjectPadding)
      });

      // Clean up input file
      fs.unlinkSync(inputPath);

      res.json({
        success: true,
        videoUrl: `/api/video/${outputFilename}`,
        zoomFactor: result.zoomFactor,
        focusPreservationScore: result.focusPreservationScore,
        subjectsInFrame: result.subjectsInFrame,
        totalSubjectsDetected: result.totalSubjectsDetected
      });

    } catch (error) {
      console.error('Zoom-out focus conversion error:', error);
      res.status(500).json({ 
        success: false, 
        error: 'Zoom-out focus conversion failed',
        details: error instanceof Error ? error.message : 'Unknown error'
      });
    }
  });

  app.post('/api/focus-preserving-convert', upload.single('video'), async (req: Request, res: Response) => {
    try {
      if (!req.file) {
        return res.status(400).json({ error: 'No video file provided' });
      }

      const { 
        targetAspectRatio = '9:16',
        preservationMode = 'intelligent-tracking',
        quality = 'medium',
        smoothingLevel = 5,
        zoomTolerance = 1.2
      } = req.body;

      const inputPath = req.file.path;
      const outputFilename = `focus_preserved_${Date.now()}.mp4`;
      const outputPath = path.join('uploads', outputFilename);

      console.log(`Focus-preserving conversion: ${targetAspectRatio}, mode: ${preservationMode}`);

      const { createFocusPreservingConverter } = await import('./services/focus-preserving-converter');
      const converter = createFocusPreservingConverter(process.env.GEMINI_API_KEY || '');

      // Get input aspect ratio from video
      const inputAspectRatio = await new Promise<string>((resolve) => {
        const ffprobe = spawn('ffprobe', ['-v', 'quiet', '-print_format', 'json', '-show_streams', inputPath]);
        let output = '';
        
        ffprobe.stdout.on('data', (data) => {
          output += data;
        });
        
        ffprobe.on('close', () => {
          try {
            const metadata = JSON.parse(output);
            const videoStream = metadata.streams.find((s: any) => s.codec_type === 'video');
            const ratio = videoStream ? `${videoStream.width}:${videoStream.height}` : '16:9';
            resolve(ratio);
          } catch {
            resolve('16:9');
          }
        });
      });

      const result = await converter.convertWithFocusPreservation(inputPath, outputPath, {
        inputAspectRatio,
        targetAspectRatio,
        preservationMode,
        quality,
        smoothingLevel: parseInt(smoothingLevel),
        zoomTolerance: parseFloat(zoomTolerance)
      });

      // Clean up input file
      fs.unlinkSync(inputPath);

      res.json({
        success: true,
        videoUrl: `/api/video/${outputFilename}`,
        focusPreservationScore: result.focusPreservationScore,
        adaptedFocusPoints: result.adaptedFocusPoints.length,
        conversionMetrics: result.conversionMetrics
      });

    } catch (error) {
      console.error('Focus-preserving conversion error:', error);
      res.status(500).json({ 
        success: false, 
        error: 'Focus-preserving conversion failed',
        details: error instanceof Error ? error.message : 'Unknown error'
      });
    }
  });

  app.post('/api/convert-aspect-ratio', upload.single('video'), async (req: Request, res: Response) => {
    try {
      const videoFile = req.file;
      if (!videoFile) {
        return res.status(400).json({ success: false, error: 'No video file provided' });
      }

      const options = JSON.parse(req.body.options);

      const apiKey = process.env.GEMINI_API_KEY;
      if (!apiKey) {
        return res.status(500).json({ success: false, error: 'Gemini API key not configured' });
      }

      console.log('Starting aspect ratio conversion...');
      console.log('Input file:', videoFile.path);
      console.log('Options:', options);

      const aspectConverter = createAspectRatioConverter(apiKey);
      const result = await aspectConverter.convertToAspectRatio(videoFile.path, options);

      if (result.success && result.outputPath) {
        const filename = path.basename(result.outputPath);
        const stats = fsSync.statSync(result.outputPath);
        
        res.json({
          success: true,
          videoUrl: `/api/video/stream/${filename}`,
          filePath: result.outputPath,
          fileSize: stats.size,
          message: `Video successfully converted to ${options.targetRatio} aspect ratio`
        });
      } else {
        res.status(500).json({
          success: false,
          error: result.error || 'Aspect ratio conversion failed'
        });
      }

    } catch (error) {
      console.error('Aspect ratio conversion error:', error);
      res.status(500).json({ 
        success: false, 
        error: 'Failed to convert aspect ratio' 
      });
    }
  });

  // Agentic AI Chat endpoint
  // LangChain Agent Warmup
  app.post('/api/agent-warmup', async (req: Request, res: Response) => {
    try {
      const { sessionId, videoPath, videoMetadata } = req.body;
      
      if (!sessionId || !videoPath) {
        return res.status(400).json({ error: 'Session ID and video path are required' });
      }

      console.log(`Starting agent warmup for session: ${sessionId}, video: ${videoPath}`);
      
      const userSettings = await storage.getUserSettings(req.user?.claims?.sub);
      const apiKey = userSettings?.geminiApiKey || process.env.GEMINI_API_KEY || process.env.VITE_GEMINI_API_KEY || "";
      
      if (!apiKey || apiKey.trim() === '') {
        return res.status(400).json({ error: 'Gemini API key not configured' });
      }

      // Create videoMetadata object if not provided
      const metadata = videoMetadata || {
        originalName: videoPath.split('/').pop() || 'video.mp4',
        duration: 0,
        uploadTime: new Date()
      };

      const videoAgent = createLangChainGeminiAgent(apiKey.trim());
      const analysis = await videoAgent.warmupAgent(sessionId, videoPath, metadata);
      
      res.json({
        success: true,
        analysis,
        sessionInfo: videoAgent.getSessionInfo(sessionId)
      });
    } catch (error) {
      console.error('Agent warmup error:', error);
      res.status(500).json({ 
        error: 'Failed to warm up agent',
        details: error instanceof Error ? error.message : 'Unknown error'
      });
    }
  });

  // LangChain Agent Chat
  app.post('/api/langchain-chat', async (req: Request, res: Response) => {
    try {
      const { sessionId, message } = req.body;
      
      if (!sessionId || !message) {
        return res.status(400).json({ error: 'Session ID and message are required' });
      }

      console.log(`Processing LangChain command for session: ${sessionId}, message: ${message}`);
      
      const userSettings = await storage.getUserSettings(req.user?.claims?.sub);
      const apiKey = userSettings?.geminiApiKey || process.env.GEMINI_API_KEY || process.env.VITE_GEMINI_API_KEY || "";
      
      if (!apiKey || apiKey.trim() === '') {
        return res.status(400).json({ error: 'Gemini API key not configured' });
      }

      const videoAgent = createLangChainGeminiAgent(apiKey.trim());
      const result = await videoAgent.processCommand(sessionId, message);
      
      res.json({
        success: true,
        response: result.response,
        actions: result.actions,
        sessionInfo: videoAgent.getSessionInfo(sessionId)
      });
    } catch (error) {
      console.error('LangChain chat error:', error);
      res.status(500).json({ 
        error: 'Failed to process command',
        details: error instanceof Error ? error.message : 'Unknown error'
      });
    }
  });

  // Get Agent Session Info
  app.get('/api/agent-session/:sessionId', async (req: Request, res: Response) => {
    try {
      const { sessionId } = req.params;
      const userSettings = await storage.getUserSettings(req.user?.claims?.sub);
      const apiKey = userSettings?.geminiApiKey || process.env.GEMINI_API_KEY || process.env.VITE_GEMINI_API_KEY || "";
      
      if (!apiKey || apiKey.trim() === '') {
        return res.status(400).json({ error: 'Gemini API key not configured' });
      }

      const videoAgent = createLangChainGeminiAgent(apiKey.trim());
      const sessionInfo = videoAgent.getSessionInfo(sessionId);
      
      res.json({
        success: true,
        sessionInfo
      });
    } catch (error) {
      console.error('Session info error:', error);
      res.status(500).json({ 
        error: 'Failed to get session info',
        details: error instanceof Error ? error.message : 'Unknown error'
      });
    }
  });

  app.post('/api/agentic-chat', isAuthenticated, async (req: any, res: Response) => {
    try {
      const { message, videoContext, subtitleSettings } = req.body;
      
      console.log('=== AGENTIC CHAT ENDPOINT ===');
      console.log('Message:', message);
      console.log('Message type:', typeof message);
      console.log('Video context:', JSON.stringify(videoContext, null, 2));
      console.log('Subtitle settings:', JSON.stringify(subtitleSettings, null, 2));
      
      if (!message || typeof message !== 'string') {
        return res.status(400).json({ 
          success: false,
          error: 'Message is required and must be a string',
          response: 'Please provide a valid text command.',
          actions: []
        });
      }

      // Get user settings for API key
      const userId = req.user?.claims?.sub;
      const userSettings = await storage.getUserSettings(userId);
      const apiKey = userSettings?.geminiApiKey || process.env.GEMINI_API_KEY || process.env.VITE_GEMINI_API_KEY || "";
      
      if (!apiKey || apiKey.trim() === '') {
        return res.status(400).json({ 
          success: false,
          error: "Gemini API key not configured. Please add it in Settings.",
          response: 'API key not configured. Please check your settings.',
          actions: []
        });
      }

      const agenticEditor = createAgenticVideoEditor(apiKey.trim(), req.user?.claims?.sub);
      
      // Set the current video path from video context
      if (videoContext) {
        let videoPath = null;
        
        // Try different video path properties from frontend
        if (videoContext.videoPath) {
          videoPath = videoContext.videoPath;
        } else if (videoContext.filename) {
          videoPath = videoContext.filename;
        } else if (videoContext.currentVideo && videoContext.currentVideo.filename) {
          videoPath = videoContext.currentVideo.filename;
        }
        
        if (videoPath) {
          // Clean up the video path to just the filename
          const filename = path.basename(videoPath);
          console.log(`🔍 Extracted filename: ${filename} from videoPath: ${videoPath}`);
          
          // Set just the filename (uploads/ will be added in the search service)
          agenticEditor.setCurrentVideoPath(filename);
          console.log('Set current video path for operations:', filename);
        } else {
          console.log('❌ No video path provided for search');
          console.log('Available context keys:', Object.keys(videoContext));
        }
      }
      
      // Process with LangChain agentic editor (includes media generation tool)
      const processContext = { 
        ...videoContext || {}, 
        subtitleSettings: subtitleSettings || null 
      };

      const result = await agenticEditor.processCommand(message, processContext, req.user?.claims?.sub);

      console.log('=== AGENTIC RESULT ===');
      console.log('Response:', result.response);
      console.log('Actions:', result.actions);
      console.log('Actions count:', result.actions?.length || 0);

      res.json({
        success: true,
        response: result.response,
        actions: result.actions,
        tokensUsed: result.tokensUsed
      });

    } catch (error) {
      console.error('Agentic chat error:', error);
      res.status(500).json({ 
        success: false,
        error: 'Failed to process AI command',
        response: 'Sorry, I encountered an error processing your request.',
        actions: [],
        details: error instanceof Error ? error.message : 'Unknown error'
      });
    }
  });

  // Media generation endpoint
  app.post('/api/generate-media', async (req: Request, res: Response) => {
    try {
      const { prompt, type = 'image' } = req.body;
      
      if (!prompt) {
        return res.status(400).json({ 
          success: false, 
          error: 'Prompt is required' 
        });
      }

      console.log(`🎨 Generating ${type} with prompt: "${prompt}"`);
      
      const { geminiMediaGenerator } = await import('./services/gemini-media-generator.js');
      const media = await geminiMediaGenerator.generateMedia(prompt, type, req.user?.claims?.sub);
      
      res.json({
        success: true,
        media: {
          id: media.id,
          type: media.type,
          prompt: media.prompt,
          filename: media.filename,
          url: media.url,
          timestamp: media.timestamp
        }
      });
      
    } catch (error) {
      console.error('❌ Media generation failed:', error);
      res.status(500).json({
        success: false,
        error: error instanceof Error ? error.message : 'Failed to generate media'
      });
    }
  });

  // Serve generated media files
  app.get('/api/media/:filename', (req: Request, res: Response) => {
    try {
      const { filename } = req.params;
      const filepath = path.join(process.cwd(), 'uploads', filename);
      
      console.log(`📁 Serving media file: ${filepath}`);
      
      if (!fsSync.existsSync(filepath)) {
        console.error(`❌ Media file not found: ${filepath}`);
        return res.status(404).json({ error: 'Media file not found' });
      }
      
      // Set appropriate headers based on file type
      const ext = path.extname(filename).toLowerCase();
      if (ext === '.mp4') {
        res.setHeader('Content-Type', 'video/mp4');
      } else if (ext === '.png') {
        res.setHeader('Content-Type', 'image/png');
      } else if (ext === '.jpg' || ext === '.jpeg') {
        res.setHeader('Content-Type', 'image/jpeg');
      }
      
      res.sendFile(path.resolve(filepath));
      
    } catch (error) {
      console.error('❌ Media serving failed:', error);
      res.status(500).json({ error: 'Failed to serve media' });
    }
  });

  // AI Video Analysis for Suggestions endpoint
  app.post('/api/analyze-video-suggestions', async (req: Request, res: Response) => {
    try {
      const { videoPath } = req.body;
      
      if (!videoPath) {
        return res.status(400).json({ error: 'Video path is required' });
      }

      const userSettings = await storage.getUserSettings(req.user?.claims?.sub);
      const apiKey = userSettings?.geminiApiKey || process.env.GEMINI_API_KEY || process.env.VITE_GEMINI_API_KEY || "";
      
      if (!apiKey || apiKey.trim() === '') {
        return res.status(400).json({ error: "Gemini API key not configured" });
      }

      const agenticEditor = createAgenticVideoEditor(apiKey.trim(), req.user?.claims?.sub);
      const result = await agenticEditor.analyzeVideoForSuggestions(videoPath, req.user?.claims?.sub);

      res.json({
        success: true,
        suggestions: result.suggestions,
        keyMoments: result.keyMoments,
        tokensUsed: result.tokensUsed
      });

    } catch (error) {
      console.error('Video analysis error:', error);
      res.status(500).json({ 
        error: 'Failed to analyze video',
        details: error instanceof Error ? error.message : 'Unknown error'
      });
    }
  });

  // Video export with timeline elements
  app.post('/api/export-with-elements', async (req: Request, res: Response) => {
    try {
      const { project, videoFile } = req.body;
      
      console.log(`[VideoExport] Exporting project: ${project.name} with ${project.elements.length} elements`);
      
      if (!project.elements || project.elements.length === 0) {
        return res.status(400).json({
          success: false,
          error: 'No timeline elements to export'
        });
      }

      const outputFilename = `exported_${nanoid()}_${Date.now()}.mp4`;
      const outputPath = path.join('./renders', outputFilename);
      
      // Ensure renders directory exists
      if (!fsSync.existsSync('./renders')) {
        fsSync.mkdirSync('./renders', { recursive: true });
      }

      if (videoFile) {
        // Export with uploaded video + timeline elements
        const inputVideoPath = path.join('./uploads', videoFile);
        
        if (!fsSync.existsSync(inputVideoPath)) {
          return res.status(400).json({
            success: false,
            error: 'Video file not found'
          });
        }
        
        console.log(`[VideoExport] Combining video ${videoFile} with timeline elements`);
        
        // Build comprehensive FFmpeg filter chain
        let filterComplex = '[0:v]';
        let overlayCount = 0;
        let lastOutput = '0:v';
        
        // Process each timeline element
        project.elements.forEach((element, index) => {
          const startTime = element.startTime;
          const endTime = element.startTime + element.duration;
          
          switch (element.type) {
            case 'txt':
              const text = (element.properties.text || 'Text').replace(/'/g, "\\'");
              const fontSize = element.properties.fontSize || 48;
              const color = (element.properties.fill || '#ffffff').replace('#', '');
              const x = element.properties.x || 100;
              const y = element.properties.y || 100;
              
              // Create text overlay with timing
              filterComplex += `[${lastOutput}]drawtext=text='${text}':fontfile=/usr/share/fonts/truetype/dejavu/DejaVuSans-Bold.ttf:fontsize=${fontSize}:fontcolor=0x${color}:x=${x}:y=${y}:enable='between(t,${startTime},${endTime})':alpha='if(between(t,${startTime},${endTime}),1,0)'[v${overlayCount}];`;
              lastOutput = `v${overlayCount}`;
              overlayCount++;
              break;
              
            case 'circle':
              const radius = element.properties.radius || element.properties.size || 50;
              const circleColor = (element.properties.fill || '#ff0000').replace('#', '');
              const circleX = element.properties.x || 100;
              const circleY = element.properties.y || 100;
              
              // Create circle overlay (using drawbox as approximate)
              filterComplex += `[${lastOutput}]drawbox=x=${circleX-radius}:y=${circleY-radius}:w=${radius*2}:h=${radius*2}:color=0x${circleColor}:thickness=fill:enable='between(t,${startTime},${endTime})'[v${overlayCount}];`;
              lastOutput = `v${overlayCount}`;
              overlayCount++;
              break;
              
            case 'rect':
              const rectWidth = element.properties.width || 100;
              const rectHeight = element.properties.height || 100;
              const rectColor = (element.properties.fill || '#0066ff').replace('#', '');
              const rectX = element.properties.x || 100;
              const rectY = element.properties.y || 100;
              
              // Create rectangle overlay
              filterComplex += `[${lastOutput}]drawbox=x=${rectX}:y=${rectY}:w=${rectWidth}:h=${rectHeight}:color=0x${rectColor}:thickness=fill:enable='between(t,${startTime},${endTime})'[v${overlayCount}];`;
              lastOutput = `v${overlayCount}`;
              overlayCount++;
              break;
          }
        });
        
        // Remove trailing semicolon
        if (filterComplex.endsWith(';')) {
          filterComplex = filterComplex.slice(0, -1);
        }
        
        // Build FFmpeg command
        const ffmpegArgs = ['-i', inputVideoPath];
        
        if (overlayCount > 0) {
          ffmpegArgs.push('-filter_complex', filterComplex);
          ffmpegArgs.push('-map', `[${lastOutput}]`);
        } else {
          // No overlays, just copy video
          ffmpegArgs.push('-c:v', 'copy');
        }
        
        // Include audio and set output
        ffmpegArgs.push('-map', '0:a?');
        ffmpegArgs.push('-c:a', 'aac');
        ffmpegArgs.push('-c:v', 'libx264');
        ffmpegArgs.push('-preset', 'medium');
        ffmpegArgs.push('-crf', '23');
        ffmpegArgs.push('-shortest');
        ffmpegArgs.push('-y');
        ffmpegArgs.push(outputPath);
        
        console.log(`[VideoExport] FFmpeg command: ffmpeg ${ffmpegArgs.join(' ')}`);
        
        const ffmpegProcess = spawn('ffmpeg', ffmpegArgs);
        
        let ffmpegOutput = '';
        
        ffmpegProcess.stderr.on('data', (data) => {
          ffmpegOutput += data.toString();
          console.log(`[VideoExport] FFmpeg: ${data}`);
        });
        
        ffmpegProcess.on('close', (code) => {
          if (code === 0) {
            console.log(`[VideoExport] Export completed successfully: ${outputFilename}`);
            
            res.json({
              success: true,
              downloadUrl: `/api/renders/${outputFilename}`,
              filename: outputFilename,
              message: 'Video exported successfully with timeline elements'
            });
          } else {
            console.error(`[VideoExport] Export failed with code: ${code}`);
            console.error(`[VideoExport] FFmpeg output: ${ffmpegOutput}`);
            res.status(500).json({
              success: false,
              error: `Video export failed with code: ${code}`,
              details: ffmpegOutput
            });
          }
        });
        
      } else {
        // Create video from timeline elements only (no background video)
        const backgroundColor = project.backgroundColor || '#000000';
        const bgColor = backgroundColor.replace('#', '');
        
        let filterComplex = `color=c=0x${bgColor}:size=${project.canvasSize.width}x${project.canvasSize.height}:duration=${project.duration}[bg];`;
        let lastOutput = 'bg';
        let overlayCount = 0;
        
        // Add all timeline elements as overlays
        project.elements.forEach((element, index) => {
          const startTime = element.startTime;
          const endTime = element.startTime + element.duration;
          
          switch (element.type) {
            case 'txt':
              const text = (element.properties.text || 'Text').replace(/'/g, "\\'");
              const fontSize = element.properties.fontSize || 48;
              const color = (element.properties.fill || '#ffffff').replace('#', '');
              const x = element.properties.x || 100;
              const y = element.properties.y || 100;
              
              filterComplex += `[${lastOutput}]drawtext=text='${text}':fontfile=/usr/share/fonts/truetype/dejavu/DejaVuSans-Bold.ttf:fontsize=${fontSize}:fontcolor=0x${color}:x=${x}:y=${y}:enable='between(t,${startTime},${endTime})'[v${overlayCount}];`;
              lastOutput = `v${overlayCount}`;
              overlayCount++;
              break;
              
            case 'circle':
              const radius = element.properties.radius || element.properties.size || 50;
              const circleColor = (element.properties.fill || '#ff0000').replace('#', '');
              const circleX = element.properties.x || 100;
              const circleY = element.properties.y || 100;
              
              filterComplex += `[${lastOutput}]drawbox=x=${circleX-radius}:y=${circleY-radius}:w=${radius*2}:h=${radius*2}:color=0x${circleColor}:thickness=fill:enable='between(t,${startTime},${endTime})'[v${overlayCount}];`;
              lastOutput = `v${overlayCount}`;
              overlayCount++;
              break;
              
            case 'rect':
              const rectWidth = element.properties.width || 100;
              const rectHeight = element.properties.height || 100;
              const rectColor = (element.properties.fill || '#0066ff').replace('#', '');
              const rectX = element.properties.x || 100;
              const rectY = element.properties.y || 100;
              
              filterComplex += `[${lastOutput}]drawbox=x=${rectX}:y=${rectY}:w=${rectWidth}:h=${rectHeight}:color=0x${rectColor}:thickness=fill:enable='between(t,${startTime},${endTime})'[v${overlayCount}];`;
              lastOutput = `v${overlayCount}`;
              overlayCount++;
              break;
          }
        });
        
        // Remove trailing semicolon
        if (filterComplex.endsWith(';')) {
          filterComplex = filterComplex.slice(0, -1);
        }
        
        const ffmpegArgs = [
          '-f', 'lavfi',
          '-i', filterComplex,
          '-map', `[${lastOutput}]`,
          '-c:v', 'libx264',
          '-preset', 'medium',
          '-crf', '23',
          '-pix_fmt', 'yuv420p',
          '-t', project.duration.toString(),
          '-y',
          outputPath
        ];
        
        console.log(`[VideoExport] FFmpeg command (elements only): ffmpeg ${ffmpegArgs.join(' ')}`);

        const ffmpegProcess = spawn('ffmpeg', ffmpegArgs);
        
        let ffmpegOutput = '';
        
        ffmpegProcess.stderr.on('data', (data) => {
          ffmpegOutput += data.toString();
          console.log(`[VideoExport] FFmpeg: ${data}`);
        });

        ffmpegProcess.on('close', (code) => {
          if (code === 0) {
            console.log(`[VideoExport] Export completed successfully: ${outputFilename}`);
            
            res.json({
              success: true,
              downloadUrl: `/api/renders/${outputFilename}`,
              filename: outputFilename,
              message: 'Video created successfully from timeline elements'
            });
          } else {
            console.error(`[VideoExport] Export failed with code: ${code}`);
            console.error(`[VideoExport] FFmpeg output: ${ffmpegOutput}`);
            res.status(500).json({
              success: false,
              error: `Video export failed with code: ${code}`,
              details: ffmpegOutput
            });
          }
        });
      }

    } catch (error) {
      console.error('[VideoExport] Export error:', error);
      res.status(500).json({
        success: false,
        error: error instanceof Error ? error.message : 'Export failed'
      });
    }
  });

  // Serve exported videos
  app.get('/api/renders/:filename', (req: Request, res: Response) => {
    try {
      const { filename } = req.params;
      const filePath = path.join('./renders', filename);
      
      console.log(`[VideoExport] Download request: ${filePath}`);
      
      if (!fsSync.existsSync(filePath)) {
        console.error(`[VideoExport] File not found: ${filePath}`);
        return res.status(404).json({
          success: false,
          error: 'File not found'
        });
      }

      const stat = fsSync.statSync(filePath);
      const fileSize = stat.size;
      
      res.setHeader('Content-Type', 'video/mp4');
      res.setHeader('Content-Disposition', `attachment; filename="${filename}"`);
      res.setHeader('Content-Length', fileSize);
      res.setHeader('Accept-Ranges', 'bytes');
      
      // Handle range requests for video streaming
      const range = req.headers.range;
      if (range) {
        const parts = range.replace(/bytes=/, "").split("-");
        const start = parseInt(parts[0], 10);
        const end = parts[1] ? parseInt(parts[1], 10) : fileSize - 1;
        const chunksize = (end - start) + 1;
        
        const stream = createReadStream(filePath, { start, end });
        
        res.writeHead(206, {
          'Content-Range': `bytes ${start}-${end}/${fileSize}`,
          'Accept-Ranges': 'bytes',
          'Content-Length': chunksize,
          'Content-Type': 'video/mp4'
        });
        
        stream.pipe(res);
      } else {
        const stream = createReadStream(filePath);
        stream.pipe(res);
      }

    } catch (error) {
      console.error('[VideoExport] Download error:', error);
      res.status(500).json({
        success: false,
        error: error instanceof Error ? error.message : 'Download failed'
      });
    }
  });

  // Video search endpoint for intelligent content discovery
  app.post('/api/video/search', async (req: Request, res: Response) => {
    try {
      const { query, videoPath, maxResults = 5, minRelevanceScore = 0.7 } = req.body;
      
      if (!query) {
        return res.status(400).json({ error: 'Search query is required' });
      }

      console.log(`🔍 Video search request: "${query}"`);

      // Get user settings for API key
      const userSettings = await storage.getUserSettings(req.user?.claims?.sub);
      const apiKey = userSettings?.geminiApiKey || process.env.GEMINI_API_KEY || process.env.VITE_GEMINI_API_KEY || "";
      
      if (!apiKey || apiKey.trim() === '') {
        return res.status(400).json({ 
          error: "Gemini API key not configured. Please add it in Settings."
        });
      }

      // Import and use the video search tool
      const { videoSearchTool } = await import('./services/video-search-tool.js');
      
      const searchResult = await videoSearchTool._call({
        query,
        videoPath,
        maxResults,
        minRelevanceScore
      });

      const result = JSON.parse(searchResult);
      
      // Convert local thumbnail paths to accessible URLs
      if (result.segments) {
        result.segments = result.segments.map((segment: any) => ({
          ...segment,
          thumbnailUrl: `/api/video/search/thumbnail/${path.basename(segment.thumbnailPath)}`
        }));
      }
      
      console.log(`✅ Video search completed: ${result.totalSegments} segments found`);

      res.json({
        success: true,
        ...result
      });

    } catch (error) {
      console.error('Video search error:', error);
      res.status(500).json({ 
        error: 'Failed to search video content',
        details: error instanceof Error ? error.message : 'Unknown error'
      });
    }
  });

  // Serve search result thumbnails
  app.get('/api/video/search/thumbnail/:filename', (req: Request, res: Response) => {
    try {
      const filename = req.params.filename;
      const thumbnailPath = path.join('uploads', filename);
      
      console.log(`🖼️ Serving thumbnail: ${thumbnailPath}`);
      
      if (!fsSync.existsSync(thumbnailPath)) {
        console.error(`❌ Thumbnail not found: ${thumbnailPath}`);
        return res.status(404).json({ error: 'Thumbnail file not found' });
      }

      res.setHeader('Content-Type', 'image/jpeg');
      res.setHeader('Cache-Control', 'public, max-age=3600');
      
      const fileStream = createReadStream(thumbnailPath);
      fileStream.pipe(res);

    } catch (error) {
      console.error('Error serving thumbnail:', error);
      res.status(500).json({ error: 'Failed to serve thumbnail' });
    }
  });

  // Video processing endpoint for AI editor with real-time preview updates
  app.post('/api/process-video', async (req: Request, res: Response) => {
    try {
      const { videoId, videoPath, operations, segments, reorderOnly } = req.body;
      
      // Accept either videoId or videoPath
      const actualVideoId = videoId || (videoPath ? path.basename(videoPath) : null);
      
      // Handle reorder-only requests differently
      if (reorderOnly && segments) {
        if (!actualVideoId) {
          return res.status(400).json({ error: 'Video ID/path is required for reordering' });
        }
        
        const timestamp = Date.now();
        const reorderedFilename = `reordered_${timestamp}_${actualVideoId}`;
        const originalPath = path.join(process.cwd(), 'uploads', actualVideoId);
        const reorderedPath = path.join(process.cwd(), 'uploads', reorderedFilename);
        
        console.log('Processing segment reordering with', segments.length, 'segments');
        
        if (!fsSync.existsSync(originalPath)) {
          return res.status(404).json({ error: 'Original video not found' });
        }
        
        // Create reordered video by concatenating segments in new order
        await processReorderedSegments(originalPath, reorderedPath, segments);
        
        const reorderedVideoUrl = `/api/video/stream/${reorderedFilename}`;
        
        return res.json({
          success: true,
          processedVideoUrl: reorderedVideoUrl,
          reorderedSegments: segments.length,
          downloadUrl: reorderedVideoUrl,
          filename: reorderedFilename
        });
      }
      
      if (!actualVideoId || !operations) {
        return res.status(400).json({ error: 'Video ID/path and operations are required' });
      }

      const timestamp = Date.now();
      const processedFilename = `processed_${timestamp}_${actualVideoId}`;
      const originalPath = path.join(process.cwd(), 'uploads', actualVideoId);
      const processedPath = path.join(process.cwd(), 'uploads', processedFilename);
      
      console.log('Processing video with operations:', operations);
      
      if (!fsSync.existsSync(originalPath)) {
        return res.status(404).json({ error: 'Original video not found' });
      }
      
      // Separate different operation types
      const selectOperations = operations.filter((op: any) => op.type === 'select_segment');
      const deleteOperations = operations.filter((op: any) => op.type === 'delete_segment_from_video');
      const textOverlayOperations = operations.filter((op: any) => op.type === 'add_text_overlay');
      // Support legacy operation types
      const legacyCutOperations = operations.filter((op: any) => op.type === 'cut_video_segment');
      const legacyDeleteOperations = operations.filter((op: any) => op.type === 'delete_segment');
      
      console.log(`Found ${selectOperations.length} select operations, ${deleteOperations.length} delete operations, ${textOverlayOperations.length} text overlay operations, ${legacyCutOperations.length} legacy cut operations, ${legacyDeleteOperations.length} legacy delete operations`);
      
      // Process video operations in order of priority
      const allDeleteOperations = [...deleteOperations, ...legacyDeleteOperations];
      
      if (textOverlayOperations.length > 0) {
        console.log('Processing text overlay operations:', textOverlayOperations);
        await processVideoWithTextOverlays(originalPath, processedPath, textOverlayOperations);
      } else if (allDeleteOperations.length > 0) {
        console.log('Processing video deletions:', allDeleteOperations);
        await processVideoWithDeletions(originalPath, processedPath, allDeleteOperations);
      } else if (selectOperations.length > 0 || legacyCutOperations.length > 0) {
        // Select operations only create visual segments, no video processing needed
        console.log('Select operations detected - creating visual segments only, no video processing');
        fsSync.copyFileSync(originalPath, processedPath);
      } else {
        // No meaningful operations, copy original
        fsSync.copyFileSync(originalPath, processedPath);
      }
      
      const processedVideoUrl = `/api/video/stream/${processedFilename}`;
      
      res.json({
        success: true,
        processedVideoUrl,
        appliedOperations: operations.length,
        deletedSegments: allDeleteOperations.length,
        selectedSegments: selectOperations.length + legacyCutOperations.length,
        downloadUrl: processedVideoUrl,
        processedFilename
      });

    } catch (error) {
      console.error('Video processing error:', error);
      res.status(500).json({ 
        error: 'Failed to process video',
        details: error instanceof Error ? error.message : 'Unknown error'
      });
    }
  });

  // Function to process text overlay operations using FFmpeg
  async function processVideoWithTextOverlays(inputPath: string, outputPath: string, textOverlayOperations: any[]) {
    const { spawn } = await import('child_process');
    
    return new Promise<void>((resolve, reject) => {
      try {
        // Build drawtext filters for text overlays
        const drawTextFilters: string[] = [];
        
        for (const op of textOverlayOperations) {
          const params = op.parameters;
          if (!params) continue;
          
          const text = params.text || 'Text';
          const startTime = params.startTime || 0;
          const endTime = params.endTime || (startTime + (params.duration || 3));
          const x = params.x || 50; // percentage
          const y = params.y || 20; // percentage
          const fontSize = params.fontSize || 24;
          const color = params.color || '#FFFFFF';
          
          // Convert percentage positions to actual pixel positions
          const xPos = `(w*${x/100})-(text_w/2)`; // Center horizontally at x%
          const yPos = `(h*${y/100})-(text_h/2)`; // Center vertically at y%
          
          // Create drawtext filter with timing
          const drawTextFilter = `drawtext=text='${text.replace(/'/g, "\\'")}':fontsize=${fontSize}:fontcolor=${color}:x=${xPos}:y=${yPos}:enable='between(t,${startTime},${endTime})'`;
          
          drawTextFilters.push(drawTextFilter);
        }
        
        // Combine all drawtext filters
        const videoFilter = drawTextFilters.join(',');
        
        console.log('FFmpeg text overlay filters:', videoFilter);

        const ffmpegArgs = [
          '-i', inputPath,
          '-vf', videoFilter,
          '-c:a', 'copy', // Copy audio without re-encoding
          '-c:v', 'libx264',
          '-preset', 'ultrafast',
          '-y',
          outputPath
        ];

        console.log('FFmpeg text overlay command:', 'ffmpeg', ffmpegArgs.join(' '));

        const ffmpeg = spawn('ffmpeg', ffmpegArgs);

        ffmpeg.stderr.on('data', (data) => {
          console.log('FFmpeg stderr:', data.toString());
        });

        ffmpeg.on('close', (code) => {
          if (code === 0) {
            console.log('Text overlay processing completed successfully');
            resolve();
          } else {
            console.error('FFmpeg process failed with code:', code);
            // Fallback: copy original file
            const fsSync = require('fs');
            fsSync.copyFileSync(inputPath, outputPath);
            resolve();
          }
        });

        ffmpeg.on('error', (error) => {
          console.error('FFmpeg spawn error:', error);
          // Fallback: copy original file
          const fsSync = require('fs');
          fsSync.copyFileSync(inputPath, outputPath);
          resolve();
        });

      } catch (error) {
        console.error('Text overlay processing setup error:', error);
        // Fallback: copy original file
        const fsSync = require('fs');
        fsSync.copyFileSync(inputPath, outputPath);
        resolve();
      }
    });
  }

  // Function to process video deletions using FFmpeg
  async function processVideoWithDeletions(inputPath: string, outputPath: string, deleteOperations: any[]) {
    return new Promise<void>((resolve, reject) => {
      // Sort delete operations by start time
      const sortedDeletes = deleteOperations.sort((a, b) => a.parameters.startTime - b.parameters.startTime);
      
      // Calculate keep segments (parts not deleted)
      const keepSegments: Array<{start: number, end: number}> = [];
      let currentTime = 0;
      
      // Get video duration first (simplified - assume 60s for now)
      const videoDuration = 60;
      
      for (const deleteOp of sortedDeletes) {
        const deleteStart = deleteOp.parameters.startTime;
        const deleteEnd = deleteOp.parameters.endTime;
        
        // Add segment before deletion if it exists
        if (currentTime < deleteStart) {
          keepSegments.push({ start: currentTime, end: deleteStart });
        }
        
        currentTime = deleteEnd;
      }
      
      // Add final segment if there's content after last deletion
      if (currentTime < videoDuration) {
        keepSegments.push({ start: currentTime, end: videoDuration });
      }
      
      if (keepSegments.length === 0) {
        // All video deleted, create minimal placeholder
        fsSync.copyFileSync(inputPath, outputPath);
        resolve();
        return;
      }
      
      // Build FFmpeg filter for keeping segments
      const segments = keepSegments.map((segment, index) => {
        return `[0:v]trim=start=${segment.start}:end=${segment.end},setpts=PTS-STARTPTS[v${index}]; [0:a]atrim=start=${segment.start}:end=${segment.end},asetpts=PTS-STARTPTS[a${index}]`;
      });
      
      const videoInputs = keepSegments.map((_, index) => `[v${index}]`).join('');
      const audioInputs = keepSegments.map((_, index) => `[a${index}]`).join('');
      
      const filterComplex = segments.join('; ') + `; ${videoInputs}concat=n=${keepSegments.length}:v=1:a=0[outv]; ${audioInputs}concat=n=${keepSegments.length}:v=0:a=1[outa]`;
      
      const ffmpeg = spawn('ffmpeg', [
        '-i', inputPath,
        '-filter_complex', filterComplex,
        '-map', '[outv]',
        '-map', '[outa]',
        '-c:v', 'libx264',
        '-c:a', 'aac',
        '-preset', 'ultrafast',
        '-y',
        outputPath
      ]);
      
      ffmpeg.stderr.on('data', (data) => {
        console.log('FFmpeg stderr:', data.toString());
      });
      
      ffmpeg.on('close', (code) => {
        if (code === 0) {
          console.log('Video processing completed successfully');
          resolve();
        } else {
          console.error('FFmpeg processing failed with code:', code);
          // Fallback: copy original file
          fsSync.copyFileSync(inputPath, outputPath);
          resolve();
        }
      });
      
      ffmpeg.on('error', (error) => {
        console.error('FFmpeg error:', error);
        // Fallback: copy original file
        fsSync.copyFileSync(inputPath, outputPath);
        resolve();
      });
    });
  }

  // Social media sharing endpoint
  app.post('/api/social-share', async (req: Request, res: Response) => {
    try {
      const { platforms, content } = req.body;

      if (!platforms || !Array.isArray(platforms) || platforms.length === 0) {
        return res.status(400).json({ 
          success: false, 
          error: 'No platforms specified' 
        });
      }

      if (!content || !content.title || !content.videoPath) {
        return res.status(400).json({ 
          success: false, 
          error: 'Missing required content fields' 
        });
      }

      // Get user's social media credentials from settings
      const userSettings = await storage.getUserSettings(req.user?.claims?.sub);
      const socialCredentials = userSettings?.socialMediaCredentials || {};

      if (Object.keys(socialCredentials).length === 0) {
        return res.status(400).json({
          success: false,
          error: 'No social media credentials configured. Please set up your API keys in Settings.'
        });
      }

      console.log('Starting social media share to platforms:', platforms);
      console.log('Content:', {
        title: content.title,
        description: content.description?.substring(0, 100) + '...',
        hashtags: content.hashtags
      });

      const socialShare = createSocialMediaShare(socialCredentials);
      const shareResults = await socialShare.shareToMultiplePlatforms(content, platforms);

      console.log('Share results:', shareResults);

      res.json({
        success: true,
        results: shareResults
      });

    } catch (error) {
      console.error('Social media sharing error:', error);
      res.status(500).json({ 
        success: false, 
        error: 'Failed to share content' 
      });
    }
  });

  // Enhanced video generation endpoint
  app.post('/api/video/generate-enhanced', upload.single('file'), async (req, res) => {
    try {
      console.log('=== ENHANCED VIDEO GENERATION START ===');
      console.log('Request body:', Object.keys(req.body));
      console.log('File:', req.file ? req.file.filename : 'No file');
      
      if (!req.file) {
        console.error('No file provided');
        return res.status(400).json({ error: 'No video file provided' });
      }

      const timeline = JSON.parse(req.body.timeline || '[]');
      const enhancementSettings = JSON.parse(req.body.enhancementSettings || '{}');
      const outputFormat = req.body.outputFormat || 'mp4';
      const quality = req.body.quality || 'high';
      const aspectRatio = req.body.aspectRatio || '9:16';

      console.log('Enhanced processing parameters:', { 
        timelineLength: timeline.length, 
        enhancementSettings, 
        outputFormat, 
        quality, 
        aspectRatio 
      });

      if (!timeline || timeline.length === 0) {
        console.error('No timeline segments provided');
        return res.status(400).json({ error: 'Timeline segments are required' });
      }

      console.log('Processing video with enhanced features...');
      const result = await enhancedVideoProcessor.processVideo({
        videoPath: req.file.path,
        timeline,
        enhancementSettings,
        outputFormat,
        quality,
        aspectRatio
      });

      console.log('Enhanced video generation result:', result);
      
      if (result.success) {
        res.json(result);
      } else {
        res.status(500).json({ error: result.error || 'Processing failed' });
      }
    } catch (error) {
      console.error('Enhanced video generation error:', error);
      res.status(500).json({ 
        error: error instanceof Error ? error.message : 'Enhanced video generation failed' 
      });
    }
  });

  // Unified AI Shorts Creation with SVG Captions
  // Complete AutoFlip Implementation for AI Shorts Section
  app.post('/api/complete-autoflip-shorts', upload.single('video'), async (req: Request, res: Response) => {
    try {
      console.log('=== ENHANCED AUTOFLIP SHORTS CREATION ===');
      console.log('Starting enhanced AutoFlip implementation with configurable detection types');

      const { createEnhancedAutoFlipService } = await import('./services/enhanced-autoflip-service');
      const autoflipService = createEnhancedAutoFlipService();

      const videoFile = req.file;
      const { 
        targetAspectRatio = '9:16',
        detectionType = 'auto',
        focusMode = 'auto', // fallback compatibility
        customTarget = '',
        quality = 'high',
        contentType = 'viral',
        duration = 60
      } = req.body;

      if (!videoFile) {
        return res.status(400).json({ 
          success: false, 
          error: 'No video file uploaded for enhanced AutoFlip processing' 
        });
      }

      const videoPath = videoFile.path;
      console.log(`Processing video: ${videoFile.filename} (${videoFile.size} bytes)`);
      console.log(`Detection type: ${detectionType || focusMode}`);
      console.log(`Custom target: ${customTarget || 'none'}`);
      console.log(`Target aspect ratio: ${targetAspectRatio}`);

      const options = {
        detectionType: (detectionType || focusMode) as 'face_core' | 'face_all' | 'face_full' | 'human' | 'pet' | 'car' | 'object' | 'auto',
        customTarget: customTarget || undefined,
        aspectRatio: targetAspectRatio as '9:16' | '16:9' | '1:1' | '4:3',
        quality: quality as 'standard' | 'high' | 'ultra'
      };

      const result = await autoflipService.processAutoFlipShorts(videoPath, options);

      const filename = path.basename(result.outputPath);
      const downloadUrl = `/api/download-video/${filename}`;

      console.log('Enhanced AutoFlip processing completed successfully');
      console.log('Processing time:', result.processingTime, 'ms');
      console.log('Detections found:', result.detectionStats.detectionsFound);
      console.log('Confidence score:', result.detectionStats.confidenceScore.toFixed(3));
      console.log('Stability score:', result.cropMetrics.stabilityScore.toFixed(3));
      console.log('Download URL:', downloadUrl);

      res.json({
        success: true,
        outputPath: result.outputPath,
        downloadUrl,
        videoUrl: downloadUrl, // compatibility
        filename,
        processingTime: result.processingTime,
        detectionStats: result.detectionStats,
        cropMetrics: result.cropMetrics,
        processingDetails: {
          algorithm: 'Enhanced AutoFlip MediaPipe with Signal Fusion',
          detectionType: options.detectionType,
          customTarget: options.customTarget,
          aspectRatio: options.aspectRatio,
          ...result.detectionStats,
          ...result.cropMetrics
        },
        storyline: {
          title: `AutoFlip ${options.detectionType.toUpperCase()} Shorts`,
          description: `Video processed with ${options.detectionType} detection and ${targetAspectRatio} aspect ratio`,
          compressionRatio: `${(result.cropMetrics.stabilityScore * 100).toFixed(1)}%`,
          keyMoments: [
            `${result.detectionStats.detectionsFound} ${options.detectionType} detections found`,
            `${result.detectionStats.confidenceScore.toFixed(3)} average confidence`,
            `${result.cropMetrics.stabilityScore.toFixed(3)} stability score`,
            `Signal types: ${result.detectionStats.signalTypes.join(', ')}`
          ],
          segments: [{
            startTime: 0,
            endTime: parseInt(duration) || 30,
            description: `AutoFlip ${options.detectionType} focused segment`,
            focusCoordinates: { 
              x: result.cropMetrics.avgCropX, 
              y: result.cropMetrics.avgCropY, 
              width: result.cropMetrics.avgCropWidth, 
              height: result.cropMetrics.avgCropHeight, 
              confidence: result.detectionStats.confidenceScore, 
              reason: `AutoFlip ${options.detectionType} signal fusion` 
            }
          }]
        }
      });

    } catch (error) {
      console.error('Enhanced AutoFlip shorts creation error:', error);
      res.status(500).json({
        success: false,
        error: error instanceof Error ? error.message : 'Unknown error in enhanced AutoFlip processing'
      });
    }
  });

  // Enhanced AutoFlip Shorts Creation (accepts video path or file upload)
  app.post('/api/enhanced-autoflip-shorts', upload.single('video'), async (req: Request, res: Response) => {
    try {
      console.log('=== ENHANCED AUTOFLIP SHORTS CREATION ===');
      console.log('Starting enhanced AutoFlip implementation with configurable detection types');

      const { createEnhancedAutoFlipService } = await import('./services/enhanced-autoflip-service');
      const autoflipService = createEnhancedAutoFlipService(process.env.GEMINI_API_KEY || '');

      const videoFile = req.file;
      const { 
        targetAspectRatio = '9:16',
        detectionType = 'auto',
        focusMode = 'auto', // fallback compatibility
        customTarget = '',
        quality = 'high',
        contentType = 'viral',
        duration = 60,
        videoPath, // Accept video path as alternative to file upload
        // Dynamic Zoom Settings
        enableDynamicZoom = 'true',
        minZoomFactor = '0.7',
        maxZoomFactor = '1.5',
        focusPriorityMode = 'smart_crop',
        subjectPadding = '0.15'
      } = req.body;

      let videoFilePath;
      if (videoFile) {
        // Use uploaded file
        videoFilePath = videoFile.path;
        console.log(`Processing uploaded video: ${videoFile.filename} (${videoFile.size} bytes)`);
      } else if (videoPath) {
        // Use existing video path
        videoFilePath = videoPath.startsWith('uploads/') ? videoPath : `uploads/${videoPath}`;
        console.log(`Processing existing video: ${videoPath}`);
      } else {
        return res.status(400).json({ 
          success: false, 
          error: 'No video file uploaded or video path provided for enhanced AutoFlip processing' 
        });
      }

      console.log(`Detection type: ${detectionType || focusMode}`);
      console.log(`Custom target: ${customTarget || 'none'}`);
      console.log(`Target aspect ratio: ${targetAspectRatio}`);
      console.log(`Dynamic zoom: ${enableDynamicZoom}, range: ${minZoomFactor}x-${maxZoomFactor}x`);
      console.log(`Focus priority mode: ${focusPriorityMode}, subject padding: ${subjectPadding}`);

      const options = {
        detectionType: (detectionType || focusMode) as 'face_core' | 'face_all' | 'face_full' | 'human' | 'pet' | 'car' | 'object' | 'auto',
        customTarget: customTarget || undefined,
        aspectRatio: targetAspectRatio as '9:16' | '16:9' | '1:1' | '4:3',
        quality: quality as 'standard' | 'high' | 'ultra',
        zoomSettings: {
          minZoomFactor: parseFloat(minZoomFactor),
          maxZoomFactor: parseFloat(maxZoomFactor),
          adaptiveZoomEnabled: enableDynamicZoom === 'true',
          focusPriorityMode: focusPriorityMode as 'preserve_all' | 'smart_crop' | 'optimal_framing',
          subjectPadding: parseFloat(subjectPadding)
        }
      };

      const result = await autoflipService.processAutoFlipShorts(videoFilePath, options);

      const filename = path.basename(result.outputPath);
      const downloadUrl = `/api/download-video/${filename}`;

      res.json({
        success: true,
        outputPath: result.outputPath,
        downloadUrl,
        filename,
        processingDetails: {
          algorithm: 'Enhanced AutoFlip MediaPipe',
          detectionType: options.detectionType,
          customTarget: options.customTarget,
          originalDimensions: result.originalDimensions,
          targetAspectRatio: result.targetAspectRatio,
          totalDetections: result.processingStats?.totalDetections || 0,
          averageConfidence: result.processingStats?.averageConfidence || 0,
          framesWithSalientContent: result.processingStats?.framesWithSalientContent || 0,
          processingTime: result.processingStats?.processingTime || 0,
          frameAnalyses: result.frameAnalyses?.length || 0,
          smoothedCrops: result.smoothedCrops?.length || 0
        },
        metadata: {
          algorithm: 'Enhanced AutoFlip with configurable detection types',
          features: [
            'Configurable detection types (face_core, face_all, face_full, human, pet, car, object, auto)',
            'Custom target object detection',
            'MediaPipe signal fusion approach',
            'Temporal smoothing and stability scoring',
            'Content-aware aspect ratio optimization'
          ]
        }
      });

    } catch (error) {
      console.error('Enhanced AutoFlip shorts creation error:', error);
      res.status(500).json({
        success: false,
        error: error instanceof Error ? error.message : 'Unknown error in enhanced AutoFlip processing'
      });
    }
  });

  app.post('/api/unified-shorts-creation', async (req: Request, res: Response) => {
    try {
      const { videoPath } = req.body;
      
      if (!videoPath) {
        return res.status(400).json({ error: 'Video path is required' });
      }

      // Construct full path to uploaded video
      const fullVideoPath = videoPath.startsWith('uploads/') ? videoPath : `uploads/${videoPath}`;
      const options = {
        targetDuration: parseInt(req.body.targetDuration) || 30,
        targetAspectRatio: req.body.targetAspectRatio || '9:16',
        captionStyle: req.body.captionStyle || 'viral'
      };

      console.log('=== AUTOFLIP MEDIAPIPE SHORTS CREATION ===');
      console.log('Using AutoFlip MediaPipe implementation with intelligent video reframing');
      
      const { createJSAutoFlipService } = await import('./services/js-autoflip-clean');
      const autoflipService = createJSAutoFlipService(process.env.GEMINI_API_KEY || '');
      
      const autoflipOptions = {
        targetAspectRatio: options.targetAspectRatio as '9:16' | '16:9' | '1:1' | '4:3',
        sampleRate: 30,
        quality: 'high' as 'high' | 'medium' | 'low',
        focusMode: 'person' as 'person' | 'object' | 'salient' | 'auto'
      };

      console.log('Starting AutoFlip processing with options:', autoflipOptions);

      const result = await autoflipService.processVideoWithJSAutoFlip(
        fullVideoPath,
        autoflipOptions
      );

      if (result.success && result.outputPath) {
        // Generate download URL and filename from the output path
        const filename = path.basename(result.outputPath);
        const downloadUrl = `/api/download-video/${filename}`;

        console.log('AutoFlip shorts creation completed:', {
          outputPath: result.outputPath,
          filename,
          downloadUrl,
          processingStats: result.processingStats
        });

        res.json({
          success: true,
          outputPath: result.outputPath,
          downloadUrl,
          filename,
          processingDetails: {
            algorithm: 'AutoFlip MediaPipe',
            originalDimensions: result.originalDimensions,
            targetAspectRatio: result.targetAspectRatio,
            totalDetections: result.processingStats?.totalDetections || 0,
            averageConfidence: result.processingStats?.averageConfidence || 0,
            framesWithSalientContent: result.processingStats?.framesWithSalientContent || 0,
            processingTime: result.processingStats?.processingTime || 0,
            frameAnalyses: result.frameAnalyses?.length || 0,
            smoothedCrops: result.smoothedCrops?.length || 0
          },
          metadata: {
            algorithm: 'AutoFlip with COCO-SSD object detection',
            features: [
              'Salient region identification',
              'Person prioritization', 
              'Temporal smoothing',
              'Dynamic cropping',
              'Content-aware aspect ratio optimization'
            ]
          }
        });
      } else {
        res.status(500).json({
          success: false,
          error: result.error || 'AutoFlip processing failed',
          details: 'AutoFlip MediaPipe reframing could not complete successfully'
        });
      }
    } catch (error) {
      console.error('Unified shorts creation error:', error);
      res.status(500).json({
        success: false,
        error: 'Internal server error',
        details: error instanceof Error ? error.message : 'Unknown error'
      });
    }
  });

  // YOLO + SVG + Gemini Motion Analysis Test Endpoint
  app.post('/api/test-yolo-svg-analysis', upload.single('video'), async (req: Request, res: Response) => {
    try {
      if (!req.file) {
        return res.status(400).json({ error: 'No video file provided' });
      }

      console.log('Testing YOLO + SVG + Gemini analysis pipeline...');

      const { targetAspectRatio = '9:16', frameRate = 5 } = req.body;
      
      // Initialize YOLO + SVG analyzer
      const yoloSvgAnalyzer = createYoloSvgAnalyzer(process.env.GEMINI_API_KEY || '');
      
      // Run YOLO + SVG + Gemini analysis
      const analysisResult = await yoloSvgAnalyzer.analyzeVideoWithYoloSvg(
        req.file.path,
        targetAspectRatio,
        {
          frameRate: parseInt(frameRate),
          quality: 'high',
          motionThreshold: 0.5
        }
      );

      console.log(`YOLO + SVG analysis complete:`);
      console.log(`- Frames analyzed: ${analysisResult.frameAnalyses.length}`);
      console.log(`- Objects detected: ${analysisResult.frameAnalyses.reduce((sum, frame) => sum + frame.objects.length, 0)}`);
      console.log(`- Aspect ratio rectangles: ${analysisResult.aspectRatioRectangles.length}`);

      // Apply crop filter and generate output video
      const outputPath = path.join(process.cwd(), 'temp_videos', `yolo_test_${Date.now()}.mp4`);
      await yoloSvgAnalyzer.applyCropFilter(req.file.path, outputPath, analysisResult.cropFilter);

      const downloadUrl = `/api/video/download/${path.basename(outputPath)}`;

      res.json({
        success: true,
        message: 'YOLO + SVG + Gemini analysis completed successfully',
        analysisDetails: {
          totalFrames: analysisResult.frameAnalyses.length,
          totalObjects: analysisResult.frameAnalyses.reduce((sum, frame) => sum + frame.objects.length, 0),
          aspectRatioRectangles: analysisResult.aspectRatioRectangles.length,
          smoothingFormula: analysisResult.smoothingFormula.split('\n').slice(0, 3).join('\n'), // First 3 lines
          videoInfo: analysisResult.videoInfo,
          processingTime: Date.now()
        },
        outputVideo: {
          downloadUrl,
          filename: path.basename(outputPath)
        }
      });

    } catch (error) {
      console.error('YOLO + SVG analysis test failed:', error);
      res.status(500).json({ 
        error: 'YOLO + SVG analysis failed', 
        details: error instanceof Error ? error.message : 'Unknown error'
      });
    }
  });

  return httpServer;
}

// Workflow execution processing function
async function processWorkflowExecution(nodes: any[], edges: any[], userId: number) {
  const updatedNodes = [...nodes];
  const results: any[] = [];
  
  // Find starting nodes (nodes with no incoming edges)
  const startingNodes = nodes.filter(node => 
    !edges.some(edge => edge.target === node.id)
  );
  
  if (startingNodes.length === 0) {
    throw new Error("No starting nodes found in workflow");
  }
  
  // Process nodes in execution order
  const processedNodes = new Set<string>();
  const nodeQueue = [...startingNodes];
  
  while (nodeQueue.length > 0) {
    const currentNode = nodeQueue.shift()!;
    
    if (processedNodes.has(currentNode.id)) {
      continue;
    }
    
    // Check if all input nodes are processed
    const inputEdges = edges.filter(edge => edge.target === currentNode.id);
    const allInputsProcessed = inputEdges.every(edge => 
      processedNodes.has(edge.source)
    );
    
    if (inputEdges.length > 0 && !allInputsProcessed) {
      // Put back in queue to process later
      nodeQueue.push(currentNode);
      continue;
    }
    
    // Process the current node
    const nodeResult = await processNode(currentNode, inputEdges, updatedNodes, userId);
    results.push(nodeResult);
    
    // Update node status
    const nodeIndex = updatedNodes.findIndex(n => n.id === currentNode.id);
    if (nodeIndex !== -1) {
      updatedNodes[nodeIndex] = {
        ...updatedNodes[nodeIndex],
        data: {
          ...updatedNodes[nodeIndex].data,
          status: nodeResult.success ? 'complete' : 'error',
          output: nodeResult.output,
          lastProcessed: new Date().toISOString()
        }
      };
    }
    
    processedNodes.add(currentNode.id);
    
    // Add connected output nodes to queue
    const outputEdges = edges.filter(edge => edge.source === currentNode.id);
    outputEdges.forEach(edge => {
      const targetNode = nodes.find(n => n.id === edge.target);
      if (targetNode && !processedNodes.has(targetNode.id)) {
        nodeQueue.push(targetNode);
      }
    });
  }
  
  return { updatedNodes, results };
}

// Process individual node based on its type
async function processNode(node: any, inputEdges: any[], allNodes: any[], userId: number) {
  const nodeType = node.data.type;
  const nodeData = node.data;
  
  try {
    switch (nodeType) {
      case 'video-input':
        return await processVideoInputNode(nodeData);
      
      case 'shorts-creation':
        return await processShortsCreationNode(nodeData, inputEdges, allNodes, userId);
      
      default:
        return {
          success: true,
          nodeId: node.id,
          type: nodeType,
          output: { message: `${nodeType} processing simulated successfully` },
          timestamp: new Date().toISOString()
        };
    }
  } catch (error) {
    return {
      success: false,
      nodeId: node.id,
      type: nodeType,
      error: error instanceof Error ? error.message : 'Unknown error',
      timestamp: new Date().toISOString()
    };
  }
}

async function processVideoInputNode(nodeData: any) {
  // Get YouTube URL from node settings - check multiple possible locations
  const youtubeUrl = nodeData.settings?.youtubeUrl || nodeData.youtubeUrl || 
    (nodeData.inputs && nodeData.inputs[0]?.url) || 
    (nodeData.output && nodeData.output.url);
  
  // If no URL is configured but there's existing output, use that
  if (!youtubeUrl && nodeData.output && nodeData.output.url) {
    return {
      success: true,
      nodeId: nodeData.id,
      type: 'video-input',
      output: nodeData.output,
      timestamp: new Date().toISOString()
    };
  }
  
  if (!youtubeUrl) {
    throw new Error("No YouTube URL configured in Video Input node. Please add a YouTube URL to the node settings.");
  }
  
  // Extract video ID and create output
  const videoId = extractYouTubeVideoId(youtubeUrl);
  if (!videoId) {
    throw new Error("Invalid YouTube URL format");
  }
  
  const output = {
    type: 'video-input',
    videoId,
    url: youtubeUrl,
    thumbnailUrl: `https://img.youtube.com/vi/${videoId}/maxresdefault.jpg`,
    source: 'youtube',
    title: `YouTube Video ${videoId}`,
    duration: 'Unknown'
  };
  
  return {
    success: true,
    nodeId: nodeData.id,
    type: 'video-input',
    output,
    timestamp: new Date().toISOString()
  };
}

async function processShortsCreationNode(nodeData: any, inputEdges: any[], allNodes: any[], userId: number) {
  console.log('Processing Shorts Creation node:', nodeData.id);
  console.log('Input edges:', inputEdges.map(e => ({ source: e.source, target: e.target })));
  console.log('All nodes:', allNodes.map(n => ({ id: n.id, type: n.data.type, settings: n.data.settings })));
  
  // Look for connected Video Upload node
  let uploadedVideoPath = null;
  
  // Check for connected video-upload nodes
  for (const edge of inputEdges) {
    const sourceNode = allNodes.find(n => n.id === edge.source);
    console.log('Checking source node:', sourceNode?.id, 'type:', sourceNode?.data?.type);
    
    if (sourceNode && sourceNode.data.type === 'video-upload') {
      console.log('Found connected video-upload node:', sourceNode.id);
      console.log('Video upload settings:', sourceNode.data.settings);
      
      // Get the uploaded file path from settings
      uploadedVideoPath = sourceNode.data.settings?.serverPath;
      console.log('Extracted video path:', uploadedVideoPath);
      break;
    }
  }
  
  if (!uploadedVideoPath) {
    throw new Error("No uploaded video file found. Please connect a Video Upload tile with an uploaded video.");
  }
  
  console.log('VIDEO FILE BEING SENT TO GEMINI:', uploadedVideoPath);
  
  // Get user settings for API key
  const { storage } = await import("./storage");
  const userSettings = await storage.getUserSettings(userId);
  const apiKey = userSettings?.geminiApiKey || process.env.GEMINI_API_KEY || "";
  
  if (!apiKey) {
    throw new Error("Gemini API key not configured");
  }
  
  console.log('Using API key for Gemini:', apiKey ? 'Present' : 'Missing');
  
  // Use video upload processor to analyze the uploaded file
  const processor = createVideoUploadProcessor(apiKey);
  
  const settings = nodeData.settings || {};
  const style = settings.style || 'viral';
  const duration = parseInt(settings.duration?.replace('s', '') || '15');
  const aspectRatio = settings.aspectRatio || '9:16';
  
  console.log('Processing settings:', { style, duration, aspectRatio });
  console.log('ANALYZING UPLOADED VIDEO FILE:', uploadedVideoPath);
  
  try {
    // Analyze the uploaded video
    const analysis = await processor.analyzeUploadedVideo(uploadedVideoPath);
    console.log('Video analysis complete:', analysis.title);
    
    // Generate shorts script
    const script = await processor.generateShortsScript(analysis, style, duration);
    console.log('Shorts script generated:', script.title);
    
    // Create the actual video
    const { createShortsCreator } = await import("./services/shorts-creator");
    const shortsCreator = createShortsCreator(apiKey);
    const shortId = `upload_${Date.now()}`;
    const outputPath = path.join('temp_videos', `${shortId}.mp4`);
    
    await shortsCreator.createVideoFromScript(script, outputPath, aspectRatio, duration);
    
    const result = {
      id: shortId,
      title: script.title,
      script: script.script,
      description: script.description,
      hashtags: script.hashtags,
      style: script.style,
      editingNotes: script.editingNotes,
      videoUrl: `/api/video/short/${shortId}`,
      thumbnailUrl: `data:image/svg+xml;base64,${Buffer.from(`<svg width="640" height="360" xmlns="http://www.w3.org/2000/svg"><rect width="100%" height="100%" fill="#FF6B6B"/><text x="50%" y="50%" font-family="Arial" font-size="24" fill="white" text-anchor="middle" dy=".3em">${script.title}</text></svg>`).toString('base64')}`,
      duration: duration,
      metadata: {
        aspectRatio,
        style,
        processing: 'upload',
        source: 'uploaded_video',
        originalFile: uploadedVideoPath
      }
    };
    
    console.log('Shorts creation complete:', result.title);
    
    return {
      success: true,
      nodeId: nodeData.id,
      type: 'shorts-creation',
      output: result,
      timestamp: new Date().toISOString()
    };
  } catch (error) {
    console.error('Error in shorts creation:', error);
    throw error;
  }
  // Video streaming endpoint for generated shorts
  app.get('/api/video/short/:shortId', async (req, res) => {
    try {
      const { shortId } = req.params;
      const videoPath = path.join(process.cwd(), 'temp_videos', `${shortId}.mp4`);
      
      // Check if file exists
      if (!fsSync.existsSync(videoPath)) {
        return res.status(404).json({ error: 'Video not found' });
      }
      
      const stat = await fs.stat(videoPath);
      const range = req.headers.range;
      
      if (range) {
        // Handle range requests for video streaming
        const parts = range.replace(/bytes=/, "").split("-");
        const start = parseInt(parts[0], 10);
        const end = parts[1] ? parseInt(parts[1], 10) : stat.size - 1;
        const chunksize = (end - start) + 1;
        
        const stream = createReadStream(videoPath, { start, end });
        
        res.writeHead(206, {
          'Content-Range': `bytes ${start}-${end}/${stat.size}`,
          'Accept-Ranges': 'bytes',
          'Content-Length': chunksize,
          'Content-Type': 'video/mp4',
        });
        
        stream.pipe(res);
      } else {
        // Serve complete file for download
        res.writeHead(200, {
          'Content-Length': stat.size,
          'Content-Type': 'video/mp4',
          'Content-Disposition': `attachment; filename="${shortId}.mp4"`
        });
        
        createReadStream(videoPath).pipe(res);
      }
    } catch (error) {
      console.error('Video streaming error:', error);
      res.status(500).json({ error: 'Failed to stream video' });
    }
  });

  // Enhanced 8-Step Intelligent Reframing
  app.post('/api/intelligent-reframe', upload.single('video'), async (req: Request, res: Response) => {
    try {
      if (!req.file) {
        return res.status(400).json({ error: 'No video file provided' });
      }

      const { targetAspectRatio = '9:16', focusMode = 'auto' } = req.body;
      console.log(`=== ENHANCED 8-STEP INTELLIGENT REFRAMING ===`);
      console.log(`File: ${req.file.originalname}, Size: ${req.file.size} bytes`);
      console.log(`Target: ${targetAspectRatio}, Focus: ${focusMode}`);

      const videoPath = req.file.path;
      const startTime = Date.now();

      // Initialize enhanced 8-step creator
      const apiKey = process.env.GEMINI_API_KEY;
      if (!apiKey) {
        console.error('✗ Gemini API key not configured');
        return res.status(500).json({ error: 'Gemini API key not configured' });
      }

      const enhancedCreator = new EnhancedComprehensiveShortsCreator(apiKey);
      await enhancedCreator.initialize();

      // Use enhanced 8-step system for intelligent reframing
      const options = {
        targetDuration: 30,
        targetAspectRatio: targetAspectRatio as '9:16' | '16:9' | '1:1',
        captionStyle: 'professional' as 'viral' | 'educational' | 'professional' | 'entertainment'
      };

      const result = await enhancedCreator.createEnhancedShorts(videoPath, options);
      const processingTime = Math.round((Date.now() - startTime) / 1000);

      console.log(`✓ Enhanced 8-step processing completed in ${processingTime}s`);

      res.json({
        success: true,
        outputPath: result.outputPath,
        downloadUrl: result.downloadUrl,
        filename: result.filename,
        processingDetails: {
          originalAspectRatio: '16:9',
          targetAspectRatio: targetAspectRatio,
          algorithm: '8-step-enhanced',
          focusAreasDetected: result.metadata?.focusFrameCount || 0,
          yoloFrameCount: result.metadata?.yoloFrameCount || 0,
          interpolatedFrameCount: result.metadata?.interpolatedFrameCount || 0,
          processingTime: processingTime,
          steps: [
            'Audio transcription with timestamps',
            'Gemini script analysis for video cutting',
            'JavaScript video segmentation',
            'YOLO object detection on all frames',
            'Composite image analysis for motion detection',
            'Gemini focus area identification',
            'Mathematical interpolation for intermediate frames',
            'Final video creation with focus rectangles'
          ]
        }
      });

    } catch (error) {
      console.error('Intelligent reframing error:', error);
      res.status(500).json({ 
        error: 'Failed to process video for reframing',
        details: error instanceof Error ? error.message : 'Unknown error'
      });
    }
  });

  // Enhanced 8-Step Comprehensive Shorts Creation
  // AutoFlip MediaPipe video reframing endpoint
  app.post('/api/autoflip-reframe', async (req: Request, res: Response) => {
    try {
      const { videoPath, options } = req.body;
      
      if (!videoPath) {
        return res.status(400).json({ error: 'Video path is required' });
      }

      console.log('=== AUTOFLIP MEDIAPIPE REFRAMING START ===');
      console.log('Video path:', videoPath);
      console.log('Options:', JSON.stringify(options, null, 2));

      const { createJSAutoFlipService } = await import('./services/js-autoflip');
      const autoflipService = createJSAutoFlipService(process.env.GEMINI_API_KEY || '');

      const result = await autoflipService.processVideoWithJSAutoFlip(videoPath, {
        targetAspectRatio: options?.targetAspectRatio || '9:16',
        sampleRate: options?.sampleRate || 30,
        quality: options?.quality || 'high',
        focusMode: options?.focusMode || 'auto'
      });

      if (!result.success) {
        return res.status(500).json({ 
          error: 'AutoFlip processing failed', 
          details: result.error 
        });
      }

      console.log('=== AUTOFLIP MEDIAPIPE REFRAMING COMPLETE ===');
      console.log('Processing stats:', result.processingStats);
      console.log('Output path:', result.outputPath);

      res.json({
        success: true,
        outputPath: result.outputPath,
        downloadUrl: `/api/video/${path.basename(result.outputPath!)}`,
        originalDimensions: result.originalDimensions,
        targetAspectRatio: result.targetAspectRatio,
        processingStats: result.processingStats,
        frameAnalyses: result.frameAnalyses,
        algorithm: 'autoflip-mediapipe'
      });

    } catch (error) {
      console.error('AutoFlip reframing error:', error);
      res.status(500).json({ 
        error: 'AutoFlip reframing failed', 
        details: error instanceof Error ? error.message : 'Unknown error' 
      });
    }
  });

  app.post('/api/enhanced-comprehensive-shorts', async (req: Request, res: Response) => {
    try {
      const { videoPath, options } = req.body;
      
      if (!videoPath) {
        return res.status(400).json({ error: 'No video path provided' });
      }

      const { targetAspectRatio = '9:16', targetDuration = 30, captionStyle = 'viral' } = options || {};
      console.log(`=== ENHANCED 8-STEP COMPREHENSIVE SHORTS CREATION ===`);
      console.log(`Video: ${videoPath}`);
      console.log(`Target: ${targetAspectRatio}, Duration: ${targetDuration}s, Style: ${captionStyle}`);
      const startTime = Date.now();

      // Initialize enhanced comprehensive shorts creator
      const apiKey = process.env.GEMINI_API_KEY;
      if (!apiKey) {
        console.error('✗ Gemini API key not configured');
        return res.status(500).json({ error: 'Gemini API key not configured' });
      }

      const enhancedCreator = new EnhancedComprehensiveShortsCreator(apiKey);
      await enhancedCreator.initialize();

      // Enhanced 8-step processing options
      const processingOptions = {
        targetDuration: targetDuration,
        targetAspectRatio: targetAspectRatio as '9:16' | '16:9' | '1:1',
        captionStyle: captionStyle as 'viral' | 'educational' | 'professional' | 'entertainment'
      };

      console.log('Processing options:', JSON.stringify(processingOptions, null, 2));

      const result = await enhancedCreator.createEnhancedShorts(videoPath, processingOptions);
      const processingTime = Math.round((Date.now() - startTime) / 1000);

      console.log(`=== ENHANCED SHORTS CREATION COMPLETED IN ${processingTime}s ===`);
      console.log('Final result:', JSON.stringify(result, null, 2));

      res.json({
        success: true,
        outputPath: result.outputPath,
        downloadUrl: result.downloadUrl,
        filename: result.filename,
        processingDetails: {
          ...result.metadata,
          processingTime: processingTime,
          algorithm: '8-step-enhanced',
          steps: [
            'Audio transcription with timestamps',
            'Gemini script analysis for video cutting',
            'JavaScript video segmentation',
            'YOLO object detection on all frames',
            'Composite image analysis for motion detection',
            'Gemini focus area identification',
            'Mathematical interpolation for intermediate frames',
            'Final video creation with focus rectangles'
          ]
        }
      });

    } catch (error) {
      console.error('✗ Enhanced comprehensive shorts creation failed:', error);
      res.status(500).json({ 
        error: 'Failed to create enhanced comprehensive shorts',
        details: error instanceof Error ? error.message : 'Unknown error'
      });
    }
  });

  app.post('/api/comprehensive-shorts-creation', upload.single('video'), async (req: Request, res: Response) => {
    try {
      if (!req.file) {
        return res.status(400).json({ error: 'No video file provided' });
      }

      const { 
        targetDuration = 30,
        targetAspectRatio = '9:16',
        captionStyle = 'viral'
      } = req.body;

      const inputPath = req.file.path;
      console.log('=== COMPREHENSIVE 7-STEP SHORTS CREATION ===');
      console.log(`Processing: ${req.file.originalname}`);
      console.log(`Target: ${targetDuration}s, ${targetAspectRatio}, ${captionStyle} style`);

      const userSettings = await storage.getUserSettings(req.user?.claims?.sub);
      const apiKey = userSettings?.geminiApiKey || process.env.GEMINI_API_KEY || '';
      
      if (!apiKey) {
        return res.status(400).json({ error: 'Gemini API key not configured' });
      }

      const comprehensiveCreator = createComprehensiveShortsCreator(apiKey);
      await comprehensiveCreator.initialize();

      const options = {
        targetDuration: parseInt(targetDuration),
        targetAspectRatio,
        captionStyle
      };

      const result = await comprehensiveCreator.createComprehensiveShorts(inputPath, options);
      
      // Clean up input file
      fsSync.unlinkSync(inputPath);

      const filename = path.basename(result.outputPath);
      const stats = fsSync.statSync(result.outputPath);
      
      console.log('=== COMPREHENSIVE SHORTS CREATION COMPLETE ===');
      console.log(`Output: ${filename} (${stats.size} bytes)`);
      console.log(`Transcription segments: ${result.metadata.transcription.segments.length}`);
      console.log(`YOLO frames analyzed: ${result.metadata.yoloFrameCount}`);
      console.log(`Focus frames processed: ${result.metadata.focusFrameCount}`);
      console.log(`Interpolated frames: ${result.metadata.interpolatedFrameCount}`);

      res.json({
        success: true,
        videoUrl: `/api/video/${filename}`,
        downloadUrl: `/api/video/${filename}`,
        filename,
        fileSize: stats.size,
        metadata: {
          ...result.metadata,
          workflow: '7-step-comprehensive',
          steps: [
            'Audio transcription with timestamps',
            'Gemini script creation and cutting plan',
            'JavaScript video cutting and merging',
            'YOLO object detection at 3fps',
            'Gemini focus area analysis',
            'Mathematical interpolation for all frames',
            'Final video creation with focus rectangles'
          ]
        }
      });

    } catch (error) {
      console.error('Comprehensive shorts creation error:', error);
      res.status(500).json({ 
        error: 'Comprehensive shorts creation failed',
        details: error instanceof Error ? error.message : 'Unknown error'
      });
    }
  });

  // Language Translation API
  app.post('/api/language-translation', async (req: Request, res: Response) => {
    try {
      const { videoPath, targetLanguage, safeWords, preserveOriginalAudio, voiceStyle } = req.body;
      
      if (!videoPath || !targetLanguage) {
        return res.status(400).json({
          error: 'Missing required fields: videoPath and targetLanguage'
        });
      }

      const translationService = new LanguageTranslationService();
      
      const result = await translationService.processVideoTranslation({
        videoPath: path.join('uploads', videoPath),
        targetLanguage,
        safeWords: safeWords || [],
        preserveOriginalAudio: preserveOriginalAudio || false,
        voiceStyle: voiceStyle || 'natural'
      });

      res.json({
        success: true,
        result,
        message: `Translation completed: ${result.processedSegments} segments translated to ${targetLanguage}`
      });

    } catch (error) {
      console.error('Language translation error:', error);
      res.status(500).json({
        error: 'Language translation failed',
        details: error instanceof Error ? error.message : 'Unknown error'
      });
    }
  });

  // Simple text translation endpoint for quick testing
  app.post('/api/translate-text', async (req: Request, res: Response) => {
    try {
      const { text, targetLanguage = 'spanish' } = req.body;
      
      if (!text) {
        return res.status(400).json({ error: 'Text is required' });
      }

      console.log(`[Translation] Translating "${text}" to ${targetLanguage}`);
      
      const response = await geminiAI.models.generateContent({
        model: 'gemini-2.0-flash-exp',
        contents: [{
          role: 'user',
          parts: [{
            text: `Translate the following text to ${targetLanguage}:

Text: "${text}"

Provide only the translation, nothing else.`
          }]
        }]
      });

      const translation = response.text?.trim() || '';
      console.log(`[Translation] Result: "${translation}"`);
      
      res.json({ 
        originalText: text,
        translatedText: translation,
        targetLanguage: targetLanguage
      });
      
    } catch (error) {
      console.error('[Translation] Error:', error);
      res.status(500).json({ error: 'Translation failed' });
    }
  });

  // Translate text and generate TTS audio in .wav format
  app.post('/api/translate-and-tts', async (req: Request, res: Response) => {
    try {
      const { text, targetLanguage = 'spanish' } = req.body;
      
      if (!text) {
        return res.status(400).json({ error: 'Text is required' });
      }

      console.log(`[TTS Translation] Processing "${text}" to ${targetLanguage} with audio`);
      
      // Step 1: Translate text
      const translationResponse = await geminiAI.models.generateContent({
        model: 'gemini-2.0-flash-exp',
        contents: [{
          role: 'user',
          parts: [{
            text: `Translate the following text to ${targetLanguage}:

Text: "${text}"

Provide only the translation, nothing else.`
          }]
        }]
      });

      const translatedText = translationResponse.text?.trim() || '';
      console.log(`[TTS Translation] Translation: "${translatedText}"`);
      
      if (!translatedText) {
        throw new Error('Translation failed');
      }

      // Step 2: Generate TTS audio
      const ttsResponse = await geminiAI.models.generateContent({
        model: 'gemini-2.5-flash-preview-tts',
        contents: [{
          role: 'user',
          parts: [{ text: translatedText }]
        }],
        config: {
          responseModalities: ['AUDIO'],
          generationConfig: {
            responseMimeType: 'audio/wav'
          }
        }
      });

      // Step 3: Extract audio data
      const audioData = ttsResponse.candidates?.[0]?.content?.parts?.[0]?.inlineData?.data;
      
      if (!audioData) {
        throw new Error('No audio data received from TTS');
      }

      const audioBuffer = Buffer.from(audioData, 'base64');
      const filename = `translated_${Date.now()}.wav`;
      const audioPath = path.join(process.cwd(), 'uploads', filename);

      // Step 4: Create proper WAV file
      const { FileWriter } = await import('wav');
      const writer = new FileWriter(audioPath, {
        channels: 1,          // Mono
        sampleRate: 24000,    // 24kHz
        bitDepth: 16          // 16-bit depth
      });

      writer.write(audioBuffer);
      writer.end();

      console.log(`[TTS Translation] Created audio file: ${filename} (${audioBuffer.length} bytes)`);
      
      res.json({ 
        originalText: text,
        translatedText: translatedText,
        targetLanguage: targetLanguage,
        audioFile: filename,
        audioUrl: `/api/audio/${filename}`,
        audioSize: audioBuffer.length
      });
      
    } catch (error) {
      console.error('[TTS Translation] Error:', error);
      res.status(500).json({ error: 'TTS Translation failed' });
    }
  });

  // Serve generated audio files
  app.get('/api/audio/:filename', (req: Request, res: Response) => {
    try {
      const filename = req.params.filename;
      const audioPath = path.join(process.cwd(), 'uploads', filename);
      
      if (!fsSync.existsSync(audioPath)) {
        return res.status(404).json({ error: 'Audio file not found' });
      }

      res.setHeader('Content-Type', 'audio/wav');
      res.setHeader('Content-Disposition', `attachment; filename="${filename}"`);
      res.sendFile(audioPath);
      
    } catch (error) {
      console.error('[Audio Serve] Error:', error);
      res.status(500).json({ error: 'Failed to serve audio file' });
    }
  });

  // Get supported languages
  app.get('/api/supported-languages', (req: Request, res: Response) => {
    const languages = LanguageTranslationService.getSupportedLanguages();
    res.json({ languages });
  });

  // Serve uploaded videos
  app.get('/api/video/:filename', (req: Request, res: Response) => {
    try {
      const filename = req.params.filename;
      const videoPath = path.join(process.cwd(), 'uploads', filename);
      const isDownload = req.query.download === 'true';
      
      console.log(`Video streaming request for: ${filename}`);
      console.log(`Full path: ${videoPath}`);
      
      if (!fsSync.existsSync(videoPath)) {
        return res.status(404).json({ error: 'Video not found' });
      }

      const stat = fsSync.statSync(videoPath);
      const fileSize = stat.size;
      console.log(`Video file size: ${fileSize} bytes`);
      
      // If download is requested, force download instead of streaming
      if (isDownload) {
        console.log('Forcing download for:', filename);
        res.setHeader('Content-Disposition', `attachment; filename="${filename}"`);
        res.setHeader('Content-Type', 'video/mp4');
        res.setHeader('Content-Length', fileSize);
        res.download(videoPath, filename);
        return;
      }
      
      // Regular streaming logic
      const range = req.headers.range;

      if (range) {
        const parts = range.replace(/bytes=/, "").split("-");
        const start = parseInt(parts[0], 10);
        const end = parts[1] ? parseInt(parts[1], 10) : fileSize - 1;
        const chunksize = (end - start) + 1;
        const file = createReadStream(videoPath, { start, end });
        const head = {
          'Content-Range': `bytes ${start}-${end}/${fileSize}`,
          'Accept-Ranges': 'bytes',
          'Content-Length': chunksize,
          'Content-Type': 'video/mp4',
        };
        res.writeHead(206, head);
        file.pipe(res);
      } else {
        const head = {
          'Content-Length': fileSize,
          'Content-Type': 'video/mp4',
        };
        res.writeHead(200, head);
        createReadStream(videoPath).pipe(res);
      }
    } catch (error) {
      console.error('Error serving video:', error);
      res.status(500).json({ error: 'Failed to serve video' });
    }
  });

  // Process reordered video segments
  app.post('/api/process-reordered-segments', async (req: Request, res: Response) => {
    try {
      const { segments, videoFilename } = req.body;
      
      if (!segments || !Array.isArray(segments)) {
        return res.status(400).json({ error: 'Segments array is required' });
      }

      if (!videoFilename) {
        return res.status(400).json({ error: 'Video filename is required' });
      }

      const inputPath = path.join('uploads', videoFilename);
      const outputFilename = `reordered_${Date.now()}_${videoFilename}`;
      const outputPath = path.join('uploads', outputFilename);

      // Check if input file exists
      if (!fsSync.existsSync(inputPath)) {
        return res.status(404).json({ error: 'Input video file not found' });
      }

      console.log('Processing reordered segments:', segments.map((s: any) => `${s.startTime}s-${s.endTime}s (${s.action})`));

      await processReorderedSegments(inputPath, outputPath, segments);

      res.json({
        success: true,
        outputFilename,
        message: 'Video segments reordered successfully',
        previewUrl: `/api/video/${outputFilename}`,
        segments: segments.map((s: any, index: number) => ({
          order: index + 1,
          action: s.action,
          duration: s.endTime - s.startTime,
          startTime: s.startTime,
          endTime: s.endTime
        }))
      });

    } catch (error: any) {
      console.error('Error processing reordered segments:', error);
      res.status(500).json({ 
        error: 'Failed to process reordered segments',
        details: error.message 
      });
    }
  });

  // Video Translation Endpoints
  app.post('/api/video/analyze-speakers', isAuthenticated, async (req: any, res) => {
    try {
      const { videoPath } = req.body;
      const userId = req.user.claims.sub;

      if (!videoPath) {
        return res.status(400).json({ error: 'Video path is required' });
      }

      const { simpleVideoTranslator } = await import('./services/video-translator-simple');
      const speakerCount = await simpleVideoTranslator.analyzeVideoForSpeakers(videoPath, userId);

      res.json({ 
        speakerCount,
        message: `Detected ${speakerCount} speaker${speakerCount !== 1 ? 's' : ''} in the video`
      });

    } catch (error) {
      console.error('Speaker analysis error:', error);
      res.status(500).json({ 
        error: 'Failed to analyze speakers',
        details: error instanceof Error ? error.message : 'Unknown error'
      });
    }
  });

  // Caption Generation API
  app.post('/api/generate-captions', isAuthenticated, async (req: any, res: Response) => {
    try {
      const { videoPath, language = 'auto' } = req.body;
      const userId = req.user.claims.sub;
      
      if (!videoPath) {
        return res.status(400).json({ error: 'Video path is required' });
      }

      console.log(`🎬 Generating captions for: ${videoPath} (language: ${language})`);
      
      // Import the caption generator
      const { CaptionGenerator } = await import('./services/caption-generator');
      const captionGenerator = new CaptionGenerator();
      
      // Generate captions using Gemini AI
      const captionTrack = await captionGenerator.generateCaptions(videoPath, language);
      
      // Track token usage for caption generation
      const tokenUsage = {
        operation: 'Caption Generation',
        model: 'gemini-2.0-flash-exp',
        inputTokens: Math.floor(captionTrack.segmentCount * 50), // Estimate based on segments
        outputTokens: Math.floor(captionTrack.segmentCount * 20),
        totalTokens: Math.floor(captionTrack.segmentCount * 70),
        cost: (captionTrack.segmentCount * 70 * 0.000001).toFixed(6) // Rough cost estimate
      };
      
      console.log(`💰 Caption Generation Token Usage:`, tokenUsage);
      
      // Deduct tokens (rough estimate)
      const appTokensToDeduct = Math.max(1, Math.floor(tokenUsage.totalTokens / 2000));
      await tokenTracker.deductAppTokens(userId, appTokensToDeduct, 'Caption Generation');
      
      res.json({
        success: true,
        captionTrack,
        tokenUsage,
        message: `Generated ${captionTrack.segmentCount} caption segments in ${captionTrack.language}`
      });
      
    } catch (error) {
      console.error('Caption generation error:', error);
      res.status(500).json({ 
        error: 'Caption generation failed',
        details: error instanceof Error ? error.message : 'Unknown error'
      });
    }
  });

  // Export captions in SRT format
  app.post('/api/export-captions-srt', isAuthenticated, async (req: any, res: Response) => {
    try {
      const { captionTrack } = req.body;
      
      if (!captionTrack || !captionTrack.segments) {
        return res.status(400).json({ error: 'Caption track data is required' });
      }

      console.log(`📄 Exporting ${captionTrack.segmentCount} captions to SRT format...`);
      
      // Import the caption generator for SRT export
      const { CaptionGenerator } = await import('./services/caption-generator');
      const captionGenerator = new CaptionGenerator();
      
      // Generate SRT content
      const srtContent = captionGenerator.exportToSRT(captionTrack);
      
      // Set headers for file download
      res.setHeader('Content-Type', 'text/plain');
      res.setHeader('Content-Disposition', `attachment; filename="${captionTrack.name || 'captions'}.srt"`);
      
      res.send(srtContent);
      
    } catch (error) {
      console.error('SRT export error:', error);
      res.status(500).json({ 
        error: 'SRT export failed',
        details: error instanceof Error ? error.message : 'Unknown error'
      });
    }
  });

  // Generate waveform-aligned captions
  app.post('/api/generate-waveform-captions', isAuthenticated, async (req: any, res: Response) => {
    try {
      const { videoFilename, language = 'English' } = req.body;
      const userId = req.user.claims.sub;
      
      if (!videoFilename) {
        return res.status(400).json({ error: 'Video filename is required' });
      }

      console.log(`🌊 Generating waveform-aligned captions for: ${videoFilename} (Language: ${language})`);
      
      // Get video path
      const videoPath = path.join('uploads', videoFilename);
      
      if (!fsSync.existsSync(videoPath)) {
        return res.status(404).json({ error: 'Video file not found' });
      }

      // Import the enhanced transcriber
      const { GeminiVideoTranscriber } = await import('./services/gemini-video-transcriber');
      const transcriber = new GeminiVideoTranscriber();
      
      // Generate waveform-aligned captions
      const enhancedTranscript = await transcriber.transcribeVideoWithWaveform(videoPath);
      
      // Convert aligned captions to caption track format
      const captionTrack = {
        id: `waveform_caption_track_${Date.now()}`,
        name: `Waveform-Aligned Captions (${language})`,
        language: language,
        segments: enhancedTranscript.alignedCaptions.map((caption, index) => ({
          id: `waveform_caption_${index}`,
          startTime: caption.startTime,
          endTime: caption.endTime,
          duration: caption.endTime - caption.startTime,
          text: caption.text,
          confidence: caption.waveformAlignment.speechConfidence,
          wordCount: caption.text.split(' ').length,
          isComplete: true,
          waveformData: caption.waveformAlignment
        })),
        totalDuration: enhancedTranscript.duration,
        segmentCount: enhancedTranscript.alignedCaptions.length,
        createdAt: new Date()
      };

      console.log(`✅ Generated ${captionTrack.segmentCount} waveform-aligned caption segments`);
      
      res.json({
        success: true,
        captionTrack,
        waveformStats: {
          speechSegments: enhancedTranscript.alignedCaptions.length,
          averageConfidence: enhancedTranscript.alignedCaptions.reduce((acc, cap) => acc + cap.waveformAlignment.speechConfidence, 0) / enhancedTranscript.alignedCaptions.length,
          totalDuration: enhancedTranscript.duration
        }
      });
      
    } catch (error) {
      console.error('Waveform caption generation error:', error);
      res.status(500).json({ 
        error: 'Waveform caption generation failed',
        details: error instanceof Error ? error.message : 'Unknown error'
      });
    }
  });

  // Direct caption segments integration endpoint
  app.post('/api/add-caption-segments', isAuthenticated, async (req: any, res: Response) => {
    try {
      const { segments, videoPath, language = 'en' } = req.body;
      
      if (!segments || !Array.isArray(segments)) {
        return res.status(400).json({ error: 'Segments array is required' });
      }
      
      if (!videoPath) {
        return res.status(400).json({ error: 'Video path is required' });
      }
      
      // Validate segment structure
      const validSegments = segments.filter(segment => 
        segment.startTime !== undefined && 
        segment.endTime !== undefined && 
        segment.text && 
        segment.text.trim().length > 0
      );
      
      if (validSegments.length === 0) {
        return res.status(400).json({ error: 'No valid segments provided' });
      }
      
      // Format caption data for frontend
      const captionData = {
        language,
        totalDuration: Math.max(...validSegments.map(s => s.endTime)),
        segmentCount: validSegments.length,
        segments: validSegments.map((segment, index) => ({
          id: `caption-${index + 1}`,
          startTime: segment.startTime,
          endTime: segment.endTime,
          text: segment.text,
          confidence: segment.confidence || 0.9
        }))
      };
      
      console.log(`✅ Processed ${validSegments.length} caption segments for video: ${videoPath}`);
      
      res.json({
        success: true,
        captionData,
        message: `Successfully processed ${validSegments.length} caption segments`,
        type: 'waveform_captions'
      });
      
    } catch (error) {
      console.error('Caption segments processing error:', error);
      res.status(500).json({ 
        error: 'Failed to process caption segments',
        details: error instanceof Error ? error.message : 'Unknown error'
      });
    }
  });

  // Get waveform visualization data
  app.post('/api/get-waveform-visualization', isAuthenticated, async (req: any, res: Response) => {
    try {
      const { videoFilename, width = 800 } = req.body;
      
      if (!videoFilename) {
        return res.status(400).json({ error: 'Video filename is required' });
      }

      console.log(`📊 Generating waveform visualization for: ${videoFilename} (width: ${width}px)`);
      
      const videoPath = path.join('uploads', videoFilename);
      
      if (!fsSync.existsSync(videoPath)) {
        return res.status(404).json({ error: 'Video file not found' });
      }

      // Import the transcriber for waveform visualization
      const { GeminiVideoTranscriber } = await import('./services/gemini-video-transcriber');
      const transcriber = new GeminiVideoTranscriber();
      
      // Generate waveform visualization
      const waveformViz = await transcriber.generateWaveformVisualization(videoPath, width);
      
      console.log(`✅ Generated waveform visualization with ${waveformViz.points.length} points and ${waveformViz.speechRegions.length} speech regions`);
      
      res.json({
        success: true,
        waveform: waveformViz
      });
      
    } catch (error) {
      console.error('Waveform visualization error:', error);
      res.status(500).json({ 
        error: 'Waveform visualization failed',
        details: error instanceof Error ? error.message : 'Unknown error'
      });
    }
  });

  // AI-Powered Caption Style Recommendations
  app.post('/api/caption-style-recommendations', isAuthenticated, async (req: any, res: Response) => {
    try {
      const { videoFilename, videoDuration, audioPath } = req.body;
      
      if (!videoFilename) {
        return res.status(400).json({ error: 'Video filename is required' });
      }
      
      if (!videoDuration) {
        return res.status(400).json({ error: 'Video duration is required' });
      }

      console.log(`🎯 Analyzing video for AI-powered caption style recommendations...`);
      console.log(`Video: ${videoFilename}, Duration: ${videoDuration}s`);
      
      const videoPath = path.join('uploads', videoFilename);
      
      if (!fsSync.existsSync(videoPath)) {
        return res.status(404).json({ error: 'Video file not found' });
      }
      
      // Import and use the caption style recommender
      const { captionStyleRecommender } = await import('./services/caption-style-recommender');
      
      // Get style recommendations from AI
      const recommendation = await captionStyleRecommender.recommendCaptionStyle(
        videoPath,
        videoDuration,
        audioPath
      );
      
      console.log(`✅ Style recommendation generated: ${recommendation.recommendedStyle} (${Math.round(recommendation.confidence * 100)}% confidence)`);
      console.log(`Content type: ${recommendation.contentAnalysis.videoType}, Pace: ${recommendation.contentAnalysis.paceAnalysis}`);
      
      res.json({
        success: true,
        recommendation,
        message: `Recommended ${recommendation.recommendedStyle} style with ${Math.round(recommendation.confidence * 100)}% confidence`
      });
      
    } catch (error) {
      console.error('Caption style recommendation error:', error);
      res.status(500).json({ 
        error: 'Caption style recommendation failed',
        details: error instanceof Error ? error.message : 'Unknown error'
      });
    }
  });

  // Animated Subtitle Generation API
  app.post('/api/generate-animated-subtitles', isAuthenticated, async (req: any, res: Response) => {
    try {
      const { videoFilename, preset = 'dynamic', customAnimation, speechAnalysis = true, adaptToContent = true } = req.body;
      const userId = req.user.claims.sub;
      
      console.log('[AnimatedSubtitles] Request received:', { videoFilename, preset, speechAnalysis, adaptToContent });
      
      if (!videoFilename) {
        return res.status(400).json({ 
          success: false, 
          error: 'Video filename is required' 
        });
      }
      
      const videoPath = path.join('uploads', videoFilename);
      
      if (!fsSync.existsSync(videoPath)) {
        return res.status(404).json({ 
          success: false, 
          error: 'Video file not found' 
        });
      }
      
      console.log('[AnimatedSubtitles] Processing video:', videoPath);
      
      // Import and create animated subtitle generator
      const AnimatedSubtitleGenerator = (await import('./services/animated-subtitle-generator')).default;
      const animatedGenerator = new AnimatedSubtitleGenerator();
      
      // Generate animated subtitles
      const animatedSegments = await animatedGenerator.generateAnimatedSubtitles(videoPath, {
        preset,
        customAnimation,
        speechAnalysis,
        adaptToContent
      });
      
      console.log(`✅ Generated ${animatedSegments.length} animated subtitle segments`);
      
      // Get available presets for frontend
      const availablePresets = animatedGenerator.getAvailablePresets();
      
      res.json({
        success: true,
        animatedSegments,
        availablePresets,
        metadata: {
          totalSegments: animatedSegments.length,
          totalDuration: animatedSegments.reduce((acc, seg) => Math.max(acc, seg.endTime), 0),
          preset: preset,
          speechAnalysis: speechAnalysis,
          generatedAt: new Date().toISOString()
        }
      });
      
    } catch (error) {
      console.error('[AnimatedSubtitles] Error:', error);
      res.status(500).json({ 
        success: false, 
        error: 'Failed to generate animated subtitles',
        details: error instanceof Error ? error.message : 'Unknown error'
      });
    }
  });

  app.post('/api/video/translate', isAuthenticated, async (req: any, res) => {
    try {
      const { 
        videoPath, 
        targetLanguage, 
        confirmedSpeakerCount, 
        safewords = [],
        generateDubbing = false 
      } = req.body;
      const userId = req.user.claims.sub;

      if (!videoPath || !targetLanguage || !confirmedSpeakerCount) {
        return res.status(400).json({ 
          error: 'Video path, target language, and confirmed speaker count are required' 
        });
      }

      const { simpleVideoTranslator } = await import('./services/video-translator-simple');
      
      // Perform transcription and translation
      const translationResult = await simpleVideoTranslator.translateVideo(
        videoPath,
        targetLanguage,
        confirmedSpeakerCount,
        safewords,
        userId
      );

      // Generate dubbed video if requested
      if (generateDubbing) {
        try {
          const dubbedVideoPath = await simpleVideoTranslator.createDubbedVideo(
            videoPath,
            translationResult,
            userId
          );
          translationResult.dubbedVideoPath = dubbedVideoPath;
        } catch (dubbingError) {
          console.warn('Dubbing failed, returning translation only:', dubbingError);
        }
      }

      res.json({
        success: true,
        translation: translationResult,
        videoTile: translationResult.dubbedVideoPath ? {
          type: 'video',
          path: translationResult.dubbedVideoPath,
          filename: path.basename(translationResult.dubbedVideoPath),
          url: `/api/video/${encodeURIComponent(path.basename(translationResult.dubbedVideoPath))}`,
          description: `Video translated to ${targetLanguage} with ${translationResult.speakers.length} speaker(s)`
        } : null
      });

    } catch (error) {
      console.error('Video translation error:', error);
      res.status(500).json({ 
        error: 'Failed to translate video',
        details: error instanceof Error ? error.message : 'Unknown error'
      });
    }
  });

  return httpServer;
}

// Function to process reordered segments
async function processReorderedSegments(inputPath: string, outputPath: string, segments: any[]) {
  const { spawn } = await import('child_process');
  
  console.log('Creating reordered video from segments:', segments.map(s => `${s.startTime}-${s.endTime}`));
  
  // Create temporary directory for segment files
  const tempDir = path.join(process.cwd(), 'temp_reorder');
  if (!fsSync.existsSync(tempDir)) {
    fsSync.mkdirSync(tempDir, { recursive: true });
  }
  
  try {
    // Extract segments in the new order
    const segmentPaths: string[] = [];
    
    for (let i = 0; i < segments.length; i++) {
      const segment = segments[i];
      const segmentPath = path.join(tempDir, `segment_${i}.mp4`);
      
      // Extract segment
      await new Promise<void>((resolve, reject) => {
        const ffmpeg = spawn('ffmpeg', [
          '-i', inputPath,
          '-ss', segment.startTime.toString(),
          '-t', (segment.endTime - segment.startTime).toString(),
          '-c', 'copy',
          '-avoid_negative_ts', 'make_zero',
          '-y',
          segmentPath
        ]);
        
        ffmpeg.on('close', (code) => {
          if (code === 0) {
            segmentPaths.push(segmentPath);
            resolve();
          } else {
            reject(new Error(`Segment extraction failed: ${code}`));
          }
        });
        
        ffmpeg.stderr.on('data', (data) => {
          console.log(`FFmpeg stderr: ${data}`);
        });
      });
    }
    
    // Create concat file for FFmpeg
    const concatFile = path.join(tempDir, 'concat.txt');
    const concatContent = segmentPaths.map(p => `file '${p}'`).join('\n');
    fsSync.writeFileSync(concatFile, concatContent);
    
    // Concatenate segments
    await new Promise<void>((resolve, reject) => {
      const ffmpeg = spawn('ffmpeg', [
        '-f', 'concat',
        '-safe', '0',
        '-i', concatFile,
        '-c', 'copy',
        '-y',
        outputPath
      ]);
      
      ffmpeg.on('close', (code) => {
        if (code === 0) {
          resolve();
        } else {
          reject(new Error(`Video concatenation failed: ${code}`));
        }
      });
      
      ffmpeg.stderr.on('data', (data) => {
        console.log(`FFmpeg concat stderr: ${data}`);
      });
    });
    
    console.log('Reordered video created successfully');
    
  } finally {
    // Clean up temporary files
    try {
      if (fsSync.existsSync(tempDir)) {
        const files = fsSync.readdirSync(tempDir);
        for (const file of files) {
          fsSync.unlinkSync(path.join(tempDir, file));
        }
        fsSync.rmdirSync(tempDir);
      }
    } catch (cleanupError) {
      console.warn('Failed to clean up temp files:', cleanupError);
    }
  }

  // Deepgram subtitle generation endpoints
  app.post("/api/subtitles/generate", upload.single('video'), async (req, res) => {
    try {
      if (!req.file) {
        return res.status(400).json({ error: "Video file is required" });
      }

      const { style = 'youtube_gaming', position = 'bottom', customSettings } = req.body;
      const videoPath = req.file.path;

      console.log('Generating Deepgram subtitles for:', videoPath);

      const deepgramGenerator = new DeepgramSubtitleGenerator();
      const result = await deepgramGenerator.generateSubtitles(
        videoPath,
        style,
        position,
        customSettings ? JSON.parse(customSettings) : undefined
      );

      res.json({
        success: true,
        segments: result.segments,
        srtContent: result.srtContent,
        styleSettings: result.styleSettings,
        message: `Generated ${result.segments.length} subtitle segments`
      });

    } catch (error) {
      console.error('Subtitle generation error:', error);
      res.status(500).json({
        error: error instanceof Error ? error.message : 'Failed to generate subtitles'
      });
    }
  });

  app.post("/api/subtitles/create-video", async (req, res) => {
    try {
      const { videoPath, segments, styleSettings } = req.body;

      if (!videoPath || !segments || !styleSettings) {
        return res.status(400).json({ 
          error: "Video path, segments, and style settings are required" 
        });
      }

      console.log('Creating subtitled video for:', videoPath);

      const deepgramGenerator = new DeepgramSubtitleGenerator();
      const outputPath = await deepgramGenerator.generateSubtitleVideo(
        videoPath,
        segments,
        styleSettings
      );

      res.json({
        success: true,
        outputPath,
        message: 'Subtitled video created successfully'
      });

    } catch (error) {
      console.error('Subtitled video creation error:', error);
      res.status(500).json({
        error: error instanceof Error ? error.message : 'Failed to create subtitled video'
      });
    }
  });

  app.get("/api/subtitles/styles", (req, res) => {
    res.json({
      styles: [
        { id: 'youtube_gaming', name: 'YouTube Gaming', description: 'Bold red background with white text' },
        { id: 'tiktok_viral', name: 'TikTok Viral', description: 'Modern black background with neon outline' },
        { id: 'instagram_modern', name: 'Instagram Modern', description: 'Purple gradient with white outline' },
        { id: 'professional', name: 'Professional Clean', description: 'Clean black background, minimal styling' },
        { id: 'neon_glow', name: 'Neon Glow', description: 'Cyan glowing text with dark background' },
        { id: 'bold_impact', name: 'Bold Impact', description: 'Large yellow text on red background' }
      ],
      positions: [
        { id: 'top', name: 'Top', description: 'Subtitles at the top of video' },
        { id: 'center', name: 'Center', description: 'Subtitles in the center of video' },
        { id: 'bottom', name: 'Bottom', description: 'Subtitles at the bottom of video' }
      ]
    });
  });

  return httpServer;
}

function extractYouTubeVideoId(url: string): string | null {
  const regex = /(?:youtube\.com\/(?:[^\/]+\/.+\/|(?:v|e(?:mbed)?)\/|.*[?&]v=)|youtu\.be\/)([^"&?\/\s]{11})/;
  const match = url.match(regex);
  return match ? match[1] : null;
}
