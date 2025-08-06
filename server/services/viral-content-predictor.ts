import OpenAI from 'openai';
import * as fs from 'fs';
import * as path from 'path';

interface ViralMetrics {
  engagementScore: number;
  trendAlignment: number;
  emotionalImpact: number;
  shareability: number;
  timingScore: number;
  contentQuality: number;
  overallViralScore: number;
}

interface TrendData {
  keywords: string[];
  topics: string[];
  formats: string[];
  demographics: string[];
  platforms: string[];
  timestamp: string;
}

interface ViralPrediction {
  viralScore: number;
  confidence: number;
  metrics: ViralMetrics;
  recommendations: string[];
  trendInsights: string[];
  riskFactors: string[];
  optimalTiming: string[];
  targetAudience: string[];
}

export class ViralContentPredictor {
  private openai: OpenAI;
  private trendDatabase: TrendData[] = [];

  constructor(apiKey: string) {
    this.openai = new OpenAI({ apiKey });
    this.loadTrendDatabase();
  }

  private loadTrendDatabase() {
    // Initialize with current viral trends
    this.trendDatabase = [
      {
        keywords: ['ai', 'artificial intelligence', 'chatgpt', 'automation', 'future'],
        topics: ['technology', 'innovation', 'productivity', 'education'],
        formats: ['explainer', 'tutorial', 'reaction', 'prediction'],
        demographics: ['millennials', 'gen-z', 'professionals', 'students'],
        platforms: ['youtube', 'tiktok', 'instagram', 'twitter'],
        timestamp: new Date().toISOString()
      },
      {
        keywords: ['trending', 'viral', 'challenge', 'dance', 'meme'],
        topics: ['entertainment', 'culture', 'social', 'lifestyle'],
        formats: ['short-form', 'challenge', 'compilation', 'behind-scenes'],
        demographics: ['gen-z', 'teenagers', 'young-adults'],
        platforms: ['tiktok', 'instagram', 'youtube-shorts'],
        timestamp: new Date().toISOString()
      },
      {
        keywords: ['crypto', 'nft', 'blockchain', 'defi', 'web3'],
        topics: ['finance', 'technology', 'investment', 'innovation'],
        formats: ['analysis', 'news', 'tutorial', 'prediction'],
        demographics: ['millennials', 'investors', 'tech-enthusiasts'],
        platforms: ['twitter', 'youtube', 'reddit'],
        timestamp: new Date().toISOString()
      }
    ];
  }

  async predictViralPotential(
    script: string,
    contentType: 'video' | 'text' | 'image' = 'video',
    targetPlatform: string = 'youtube'
  ): Promise<ViralPrediction> {
    console.log('Analyzing viral potential for content...');

    try {
      // Step 1: Analyze content with AI
      const contentAnalysis = await this.analyzeContentWithAI(script, contentType, targetPlatform);
      
      // Step 2: Calculate viral metrics
      const metrics = await this.calculateViralMetrics(script, contentAnalysis);
      
      // Step 3: Generate recommendations
      const recommendations = await this.generateRecommendations(script, metrics, contentAnalysis);
      
      // Step 4: Analyze trends
      const trendInsights = this.analyzeTrendAlignment(script);
      
      // Step 5: Assess risks
      const riskFactors = await this.assessRiskFactors(script, contentAnalysis);
      
      // Step 6: Optimal timing analysis
      const optimalTiming = this.calculateOptimalTiming(targetPlatform);
      
      // Step 7: Target audience identification
      const targetAudience = this.identifyTargetAudience(script, contentAnalysis);

      const prediction: ViralPrediction = {
        viralScore: metrics.overallViralScore,
        confidence: this.calculateConfidence(metrics),
        metrics,
        recommendations,
        trendInsights,
        riskFactors,
        optimalTiming,
        targetAudience
      };

      console.log(`Viral prediction complete - Score: ${prediction.viralScore}/100`);
      return prediction;

    } catch (error) {
      console.error('Viral prediction failed:', error);
      throw error;
    }
  }

  private async analyzeContentWithAI(script: string, contentType: string, platform: string): Promise<any> {
    const prompt = `Analyze this ${contentType} content for ${platform} and provide detailed insights:

Content: "${script}"

Analyze the following aspects:
1. Emotional triggers and psychological hooks
2. Relevance to current trends and topics
3. Shareability factors and social proof potential
4. Content structure and pacing
5. Audience engagement potential
6. Platform-specific optimization
7. Novelty and uniqueness factors
8. Educational or entertainment value

Provide your analysis in JSON format with scores (0-100) for each aspect and detailed explanations.`;

    const response = await this.openai.chat.completions.create({
      model: 'gpt-4o-mini',
      messages: [
        {
          role: 'system',
          content: 'You are an expert viral content analyst with deep knowledge of social media algorithms, psychology, and trending patterns. Provide detailed, actionable insights.'
        },
        { role: 'user', content: prompt }
      ],
      response_format: { type: 'json_object' },
      temperature: 0.3
    });

    return JSON.parse(response.choices[0].message.content || '{}');
  }

  private async calculateViralMetrics(script: string, analysis: any): Promise<ViralMetrics> {
    // Calculate engagement score based on content hooks and triggers
    const engagementScore = this.calculateEngagementScore(script, analysis);
    
    // Analyze trend alignment
    const trendAlignment = this.calculateTrendAlignment(script);
    
    // Assess emotional impact
    const emotionalImpact = analysis.emotional_triggers?.score || 50;
    
    // Calculate shareability
    const shareability = analysis.shareability?.score || 50;
    
    // Timing relevance
    const timingScore = this.calculateTimingRelevance(script);
    
    // Content quality assessment
    const contentQuality = analysis.content_quality?.score || 50;
    
    // Overall viral score (weighted average)
    const overallViralScore = Math.round(
      (engagementScore * 0.25) +
      (trendAlignment * 0.2) +
      (emotionalImpact * 0.2) +
      (shareability * 0.15) +
      (timingScore * 0.1) +
      (contentQuality * 0.1)
    );

    return {
      engagementScore,
      trendAlignment,
      emotionalImpact,
      shareability,
      timingScore,
      contentQuality,
      overallViralScore
    };
  }

  private calculateEngagementScore(script: string, analysis: any): number {
    let score = 50; // Base score
    
    // Hook words and phrases
    const hookWords = ['did you know', 'shocking', 'amazing', 'incredible', 'secret', 'truth', 'revealed'];
    const hookCount = hookWords.filter(word => script.toLowerCase().includes(word)).length;
    score += hookCount * 5;
    
    // Question engagement
    const questionCount = (script.match(/\?/g) || []).length;
    score += questionCount * 3;
    
    // Emotional words
    const emotionalWords = ['love', 'hate', 'fear', 'excitement', 'surprise', 'anger', 'joy'];
    const emotionalCount = emotionalWords.filter(word => script.toLowerCase().includes(word)).length;
    score += emotionalCount * 4;
    
    // Length optimization (sweet spot for different platforms)
    const wordCount = script.split(' ').length;
    if (wordCount >= 50 && wordCount <= 100) score += 10;
    
    return Math.min(100, score);
  }

  private calculateTrendAlignment(script: string): number {
    let score = 0;
    const scriptLower = script.toLowerCase();
    
    this.trendDatabase.forEach(trend => {
      // Check keyword alignment
      const keywordMatches = trend.keywords.filter(keyword => 
        scriptLower.includes(keyword.toLowerCase())
      ).length;
      score += keywordMatches * 10;
      
      // Check topic alignment
      const topicMatches = trend.topics.filter(topic => 
        scriptLower.includes(topic.toLowerCase())
      ).length;
      score += topicMatches * 8;
    });
    
    return Math.min(100, score);
  }

  private calculateTimingRelevance(script: string): number {
    const currentHour = new Date().getHours();
    const scriptLower = script.toLowerCase();
    
    let score = 50; // Base score
    
    // Time-sensitive content
    if (scriptLower.includes('today') || scriptLower.includes('now') || scriptLower.includes('latest')) {
      score += 15;
    }
    
    // Seasonal relevance
    const month = new Date().getMonth();
    const seasonalWords = {
      'winter': [11, 0, 1], 'spring': [2, 3, 4], 'summer': [5, 6, 7], 'fall': [8, 9, 10]
    };
    
    Object.entries(seasonalWords).forEach(([season, months]) => {
      if (months.includes(month) && scriptLower.includes(season)) {
        score += 10;
      }
    });
    
    return Math.min(100, score);
  }

  private async generateRecommendations(script: string, metrics: ViralMetrics, analysis: any): Promise<string[]> {
    const recommendations: string[] = [];
    
    if (metrics.engagementScore < 70) {
      recommendations.push('Add more engaging hooks like "Did you know..." or "This will blow your mind"');
      recommendations.push('Include questions to encourage audience interaction');
    }
    
    if (metrics.trendAlignment < 60) {
      recommendations.push('Incorporate current trending topics and keywords');
      recommendations.push('Reference popular culture or recent events');
    }
    
    if (metrics.emotionalImpact < 65) {
      recommendations.push('Enhance emotional appeal with personal stories or surprising facts');
      recommendations.push('Use more vivid, descriptive language');
    }
    
    if (metrics.shareability < 70) {
      recommendations.push('Add a clear call-to-action for sharing');
      recommendations.push('Include memorable quotes or statistics');
    }
    
    // AI-generated specific recommendations
    const prompt = `Based on this content analysis, provide 3 specific, actionable recommendations to increase viral potential:

Content: "${script}"
Current viral score: ${metrics.overallViralScore}/100

Focus on concrete improvements for:
1. Hook optimization
2. Trend alignment  
3. Audience engagement

Provide recommendations as a JSON array of strings.`;

    try {
      const response = await this.openai.chat.completions.create({
        model: 'gpt-4o-mini',
        messages: [{ role: 'user', content: prompt }],
        response_format: { type: 'json_object' },
        temperature: 0.5
      });

      const aiRecommendations = JSON.parse(response.choices[0].message.content || '{"recommendations": []}');
      recommendations.push(...(aiRecommendations.recommendations || []));
    } catch (error) {
      console.error('Failed to generate AI recommendations:', error);
    }
    
    return recommendations;
  }

  private analyzeTrendAlignment(script: string): string[] {
    const insights: string[] = [];
    const scriptLower = script.toLowerCase();
    
    this.trendDatabase.forEach(trend => {
      const matchingKeywords = trend.keywords.filter(keyword => 
        scriptLower.includes(keyword.toLowerCase())
      );
      
      if (matchingKeywords.length > 0) {
        insights.push(`Aligns with ${trend.topics.join(', ')} trends via keywords: ${matchingKeywords.join(', ')}`);
      }
    });
    
    if (insights.length === 0) {
      insights.push('Content does not strongly align with current trending topics');
      insights.push('Consider incorporating AI, technology, or entertainment themes');
    }
    
    return insights;
  }

  private async assessRiskFactors(script: string, analysis: any): Promise<string[]> {
    const risks: string[] = [];
    
    // Content length risks
    const wordCount = script.split(' ').length;
    if (wordCount < 30) risks.push('Content may be too short to maintain engagement');
    if (wordCount > 150) risks.push('Content may be too long for short-form platforms');
    
    // Controversial content detection
    const controversialWords = ['controversial', 'debate', 'argument', 'politics', 'religion'];
    const hasControversial = controversialWords.some(word => script.toLowerCase().includes(word));
    if (hasControversial) risks.push('Content contains potentially controversial elements');
    
    // Oversaturation risk
    const commonTopics = ['ai', 'crypto', 'productivity', 'motivation'];
    const topicCount = commonTopics.filter(topic => script.toLowerCase().includes(topic)).length;
    if (topicCount > 2) risks.push('Topic may be oversaturated - consider unique angle');
    
    return risks;
  }

  private calculateOptimalTiming(platform: string): string[] {
    const timingMap: { [key: string]: string[] } = {
      'youtube': ['Tuesday-Thursday 2pm-4pm EST', 'Saturday-Sunday 9am-11am EST'],
      'tiktok': ['Tuesday-Thursday 6am-10am, 7pm-9pm EST'],
      'instagram': ['Monday-Wednesday 11am-1pm, 7pm-9pm EST'],
      'twitter': ['Monday-Friday 9am-3pm EST'],
      'default': ['Peak engagement: Tuesday-Thursday 2pm-4pm EST']
    };
    
    return timingMap[platform.toLowerCase()] || timingMap['default'];
  }

  private identifyTargetAudience(script: string, analysis: any): string[] {
    const audience: string[] = [];
    const scriptLower = script.toLowerCase();
    
    // Age demographics
    if (scriptLower.includes('tiktok') || scriptLower.includes('meme') || scriptLower.includes('viral')) {
      audience.push('Gen-Z (16-24)');
    }
    if (scriptLower.includes('career') || scriptLower.includes('productivity') || scriptLower.includes('business')) {
      audience.push('Millennials (25-40)');
    }
    if (scriptLower.includes('family') || scriptLower.includes('parenting') || scriptLower.includes('home')) {
      audience.push('Gen-X (41-56)');
    }
    
    // Interest-based
    if (scriptLower.includes('tech') || scriptLower.includes('ai') || scriptLower.includes('digital')) {
      audience.push('Tech enthusiasts');
    }
    if (scriptLower.includes('health') || scriptLower.includes('fitness') || scriptLower.includes('wellness')) {
      audience.push('Health-conscious individuals');
    }
    
    return audience.length > 0 ? audience : ['General audience (18-45)'];
  }

  private calculateConfidence(metrics: ViralMetrics): number {
    // Calculate confidence based on score consistency
    const scores = [
      metrics.engagementScore,
      metrics.trendAlignment,
      metrics.emotionalImpact,
      metrics.shareability,
      metrics.timingScore,
      metrics.contentQuality
    ];
    
    const average = scores.reduce((sum, score) => sum + score, 0) / scores.length;
    const variance = scores.reduce((sum, score) => sum + Math.pow(score - average, 2), 0) / scores.length;
    const standardDeviation = Math.sqrt(variance);
    
    // Lower deviation = higher confidence
    const confidence = Math.max(50, 100 - (standardDeviation * 2));
    return Math.round(confidence);
  }

  // Update trend database with new data
  async updateTrendDatabase(newTrends: TrendData[]) {
    this.trendDatabase.push(...newTrends);
    
    // Keep only recent trends (last 30 days)
    const thirtyDaysAgo = new Date();
    thirtyDaysAgo.setDate(thirtyDaysAgo.getDate() - 30);
    
    this.trendDatabase = this.trendDatabase.filter(trend => 
      new Date(trend.timestamp) > thirtyDaysAgo
    );
    
    console.log(`Trend database updated. Current trends: ${this.trendDatabase.length}`);
  }
}

export function createViralContentPredictor(openaiApiKey: string): ViralContentPredictor {
  return new ViralContentPredictor(openaiApiKey);
}