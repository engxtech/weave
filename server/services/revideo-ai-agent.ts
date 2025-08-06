import { RevideoService, RevideoRenderOptions } from './revideo-service.js';
import { GoogleGenAI } from '@google/genai';

export interface VideoAnalysisResult {
  videoType: 'educational' | 'entertainment' | 'business' | 'social' | 'tutorial';
  suggestedScene: 'example' | 'videoEditing' | 'subtitles' | 'transitions';
  recommendedAspectRatio: '16:9' | '9:16' | '1:1';
  colorScheme: 'warm' | 'cool' | 'cinematic' | 'vibrant';
  suggestedDuration: number;
  subtitleRecommendations: {
    fontSize: number;
    position: 'top' | 'center' | 'bottom';
    style: 'minimal' | 'bold' | 'highlighted';
  };
  animationStyle: 'subtle' | 'dynamic' | 'professional' | 'energetic';
}

export class RevideoAIAgent {
  private readonly geminiAI: GoogleGenAI;
  private readonly revideoService: RevideoService;

  constructor(geminiApiKey: string) {
    this.geminiAI = new GoogleGenAI({ apiKey: geminiApiKey });
    this.revideoService = new RevideoService();
  }

  async analyzeVideoContent(videoPath: string, userPrompt?: string): Promise<VideoAnalysisResult> {
    try {
      console.log('[Revideo AI] Analyzing video content for intelligent enhancement');

      const prompt = `
        Analyze this video content and provide intelligent recommendations for programmatic video editing using Revideo.
        
        User context: ${userPrompt || 'General video enhancement'}
        
        Please analyze and recommend:
        1. Video type classification
        2. Best Revideo scene to use (example, videoEditing, subtitles, transitions)
        3. Optimal aspect ratio for the content
        4. Color scheme that matches the mood
        5. Suggested duration
        6. Subtitle styling recommendations
        7. Animation style that fits the content
        
        Respond with JSON format:
        {
          "videoType": "educational|entertainment|business|social|tutorial",
          "suggestedScene": "example|videoEditing|subtitles|transitions",
          "recommendedAspectRatio": "16:9|9:16|1:1",
          "colorScheme": "warm|cool|cinematic|vibrant",
          "suggestedDuration": number,
          "subtitleRecommendations": {
            "fontSize": number,
            "position": "top|center|bottom",
            "style": "minimal|bold|highlighted"
          },
          "animationStyle": "subtle|dynamic|professional|energetic"
        }
      `;

      const response = await this.geminiAI.models.generateContent({
        model: 'gemini-2.0-flash-exp',
        contents: [{
          inlineData: {
            data: require('fs').readFileSync(videoPath).toString('base64'),
            mimeType: 'video/mp4'
          }
        }, prompt],
        config: {
          responseMimeType: 'application/json'
        }
      });

      const analysis = JSON.parse(response.text || '{}') as VideoAnalysisResult;
      console.log('[Revideo AI] Video analysis complete:', analysis);
      
      return analysis;
    } catch (error) {
      console.error('[Revideo AI] Analysis failed:', error);
      // Return default analysis
      return {
        videoType: 'entertainment',
        suggestedScene: 'subtitles',
        recommendedAspectRatio: '16:9',
        colorScheme: 'vibrant',
        suggestedDuration: 15,
        subtitleRecommendations: {
          fontSize: 48,
          position: 'bottom',
          style: 'bold'
        },
        animationStyle: 'dynamic'
      };
    }
  }

  async generateIntelligentVideo(videoPath: string, userPrompt: string): Promise<string> {
    try {
      console.log('[Revideo AI] Generating intelligent video with AI analysis');

      // Step 1: Analyze the video content
      const analysis = await this.analyzeVideoContent(videoPath, userPrompt);

      // Step 2: Generate intelligent subtitle content if needed
      let subtitleContent = '';
      if (analysis.suggestedScene === 'subtitles') {
        subtitleContent = await this.generateIntelligentSubtitles(videoPath, userPrompt);
      }

      // Step 3: Create render options based on AI analysis
      const renderOptions: RevideoRenderOptions = {
        primaryVideo: videoPath,
        selectedScene: analysis.suggestedScene,
        subtitleTextContent: subtitleContent,
        
        // Apply AI-recommended styling
        ...this.getStyleFromAnalysis(analysis),
        
        // Set output format based on analysis
        outputWidth: this.getWidthFromAspectRatio(analysis.recommendedAspectRatio),
        outputHeight: this.getHeightFromAspectRatio(analysis.recommendedAspectRatio),
        outputDuration: analysis.suggestedDuration,
        
        // Apply subtitle styling
        subtitleFontSize: analysis.subtitleRecommendations.fontSize,
        subtitleColor: analysis.subtitleRecommendations.style === 'highlighted' ? '#FFD700' : '#FFFFFF',
        subtitleBackgroundColor: 'rgba(0,0,0,0.8)',
      };

      // Step 4: Render the enhanced video
      const outputPath = await this.revideoService.renderVideoWithOptions(renderOptions);
      
      console.log('[Revideo AI] Intelligent video generation complete');
      return outputPath;

    } catch (error) {
      console.error('[Revideo AI] Intelligent video generation failed:', error);
      throw new Error(`AI video generation failed: ${error.message}`);
    }
  }

  async generateIntelligentSubtitles(videoPath: string, context: string): Promise<string> {
    try {
      console.log('[Revideo AI] Generating intelligent subtitles');

      const prompt = `
        Analyze this video and generate intelligent, engaging subtitles that enhance the viewing experience.
        
        Context: ${context}
        
        Create subtitles that:
        1. Are accurate to the audio content
        2. Use engaging, readable language
        3. Are appropriately timed
        4. Enhance the video's message
        5. Are suitable for the target audience
        
        Return just the subtitle text, no timestamps needed.
      `;

      const response = await this.geminiAI.models.generateContent({
        model: 'gemini-2.0-flash-exp',
        contents: [{
          inlineData: {
            data: require('fs').readFileSync(videoPath).toString('base64'),
            mimeType: 'video/mp4'
          }
        }, prompt]
      });

      return response.text || 'AI-Generated Content';
    } catch (error) {
      console.error('[Revideo AI] Subtitle generation failed:', error);
      return 'AI-Enhanced Video Content';
    }
  }

  async createCustomScene(sceneDescription: string): Promise<RevideoRenderOptions> {
    try {
      console.log('[Revideo AI] Creating custom scene from description:', sceneDescription);

      const prompt = `
        Based on this scene description: "${sceneDescription}"
        
        Generate Revideo render options that would create the described scene.
        Consider:
        - Appropriate colors for the mood
        - Animation style and timing
        - Text content
        - Scene type that best fits
        - Duration needed
        
        Respond with JSON:
        {
          "selectedScene": "example|videoEditing|subtitles|transitions",
          "titleText": "string",
          "subtitleText": "string",
          "primaryColor": "#hex",
          "secondaryColor": "#hex",
          "animationSpeed": number,
          "transitionDuration": number,
          "outputDuration": number,
          "subtitleFontSize": number
        }
      `;

      const response = await this.geminiAI.models.generateContent({
        model: 'gemini-2.0-flash-exp',
        contents: prompt,
        config: {
          responseMimeType: 'application/json'
        }
      });

      const sceneConfig = JSON.parse(response.text || '{}');
      console.log('[Revideo AI] Custom scene configuration generated:', sceneConfig);
      
      return sceneConfig as RevideoRenderOptions;
    } catch (error) {
      console.error('[Revideo AI] Custom scene creation failed:', error);
      throw new Error(`Custom scene creation failed: ${error.message}`);
    }
  }

  async optimizeForPlatform(videoPath: string, platform: 'youtube' | 'instagram' | 'tiktok' | 'linkedin'): Promise<string> {
    console.log(`[Revideo AI] Optimizing video for ${platform}`);

    const platformSpecs = {
      youtube: {
        aspectRatio: '16:9' as const,
        duration: 60,
        style: 'professional',
        colors: { primary: '#FF0000', secondary: '#FFFFFF' }
      },
      instagram: {
        aspectRatio: '1:1' as const,
        duration: 30,
        style: 'vibrant',
        colors: { primary: '#E4405F', secondary: '#FCAF45' }
      },
      tiktok: {
        aspectRatio: '9:16' as const,
        duration: 15,
        style: 'energetic',
        colors: { primary: '#FF0050', secondary: '#00F2EA' }
      },
      linkedin: {
        aspectRatio: '16:9' as const,
        duration: 45,
        style: 'professional',
        colors: { primary: '#0077B5', secondary: '#000000' }
      }
    };

    const spec = platformSpecs[platform];
    
    const options: RevideoRenderOptions = {
      primaryVideo: videoPath,
      selectedScene: 'videoEditing',
      outputWidth: this.getWidthFromAspectRatio(spec.aspectRatio),
      outputHeight: this.getHeightFromAspectRatio(spec.aspectRatio),
      outputDuration: spec.duration,
      primaryColor: spec.colors.primary,
      secondaryColor: spec.colors.secondary,
      titleText: `Optimized for ${platform.charAt(0).toUpperCase() + platform.slice(1)}`,
      animationSpeed: spec.style === 'energetic' ? 1.5 : 1.0,
    };

    return this.revideoService.renderVideoWithOptions(options);
  }

  private getStyleFromAnalysis(analysis: VideoAnalysisResult): Partial<RevideoRenderOptions> {
    const colorSchemes = {
      warm: { primary: '#FF6B6B', secondary: '#FFE66D' },
      cool: { primary: '#4ECDC4', secondary: '#45B7D1' },
      cinematic: { primary: '#2C3E50', secondary: '#E74C3C' },
      vibrant: { primary: '#8B5CF6', secondary: '#06B6D4' }
    };

    const animationSpeeds = {
      subtle: 0.8,
      dynamic: 1.2,
      professional: 1.0,
      energetic: 1.5
    };

    const scheme = colorSchemes[analysis.colorScheme];
    
    return {
      primaryColor: scheme.primary,
      secondaryColor: scheme.secondary,
      animationSpeed: animationSpeeds[analysis.animationStyle],
      transitionDuration: analysis.animationStyle === 'energetic' ? 0.5 : 1.0
    };
  }

  private getWidthFromAspectRatio(ratio: '16:9' | '9:16' | '1:1'): number {
    const ratios = {
      '16:9': 1920,
      '9:16': 1080,
      '1:1': 1080
    };
    return ratios[ratio];
  }

  private getHeightFromAspectRatio(ratio: '16:9' | '9:16' | '1:1'): number {
    const ratios = {
      '16:9': 1080,
      '9:16': 1920,
      '1:1': 1080
    };
    return ratios[ratio];
  }
}