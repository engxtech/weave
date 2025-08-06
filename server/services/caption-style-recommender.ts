import { GoogleGenAI } from "@google/genai";
import * as fs from "fs";

export interface CaptionStyleRecommendation {
  recommendedStyle: 'readable' | 'verbatim' | 'simplified';
  confidence: number;
  reasoning: string;
  visualSettings: {
    fontSize: number;
    color: string;
    background: string;
    position: 'top' | 'center' | 'bottom';
    animation: 'fade-in' | 'slide-up' | 'slide-down' | 'zoom-in' | 'bounce';
  };
  contentAnalysis: {
    videoType: 'educational' | 'entertainment' | 'professional' | 'casual' | 'technical';
    paceAnalysis: 'fast' | 'moderate' | 'slow';
    audienceLevel: 'beginner' | 'intermediate' | 'advanced';
    speechClarity: 'clear' | 'moderate' | 'challenging';
  };
  alternativeStyles?: {
    style: 'readable' | 'verbatim' | 'simplified';
    reason: string;
    confidence: number;
  }[];
}

export class CaptionStyleRecommender {
  private geminiAI: GoogleGenAI;

  constructor() {
    this.geminiAI = new GoogleGenAI({ 
      apiKey: process.env.GEMINI_API_KEY || "" 
    });
  }

  async recommendCaptionStyle(
    videoPath: string,
    videoDuration: number,
    audioPath?: string
  ): Promise<CaptionStyleRecommendation> {
    try {
      console.log('[CaptionStyleRecommender] Analyzing video for caption style recommendations...');
      
      // Read video file for analysis
      const videoBuffer = fs.readFileSync(videoPath);
      
      // Build analysis prompt
      const prompt = this.buildAnalysisPrompt(videoDuration);
      
      const response = await this.geminiAI.models.generateContent({
        model: "gemini-2.0-flash-exp",
        contents: [
          {
            role: "user",
            parts: [
              {
                inlineData: {
                  data: videoBuffer.toString('base64'),
                  mimeType: "video/mp4"
                }
              },
              { text: prompt }
            ]
          }
        ],
        config: {
          responseMimeType: "application/json",
          responseSchema: {
            type: "object",
            properties: {
              recommendedStyle: {
                type: "string",
                enum: ["readable", "verbatim", "simplified"]
              },
              confidence: { type: "number" },
              reasoning: { type: "string" },
              visualSettings: {
                type: "object",
                properties: {
                  fontSize: { type: "number" },
                  color: { type: "string" },
                  background: { type: "string" },
                  position: {
                    type: "string",
                    enum: ["top", "center", "bottom"]
                  },
                  animation: {
                    type: "string",
                    enum: ["fade-in", "slide-up", "slide-down", "zoom-in", "bounce"]
                  }
                }
              },
              contentAnalysis: {
                type: "object",
                properties: {
                  videoType: {
                    type: "string",
                    enum: ["educational", "entertainment", "professional", "casual", "technical"]
                  },
                  paceAnalysis: {
                    type: "string",
                    enum: ["fast", "moderate", "slow"]
                  },
                  audienceLevel: {
                    type: "string",
                    enum: ["beginner", "intermediate", "advanced"]
                  },
                  speechClarity: {
                    type: "string",
                    enum: ["clear", "moderate", "challenging"]
                  }
                }
              },
              alternativeStyles: {
                type: "array",
                items: {
                  type: "object",
                  properties: {
                    style: {
                      type: "string",
                      enum: ["readable", "verbatim", "simplified"]
                    },
                    reason: { type: "string" },
                    confidence: { type: "number" }
                  }
                }
              }
            },
            required: ["recommendedStyle", "confidence", "reasoning", "visualSettings", "contentAnalysis"]
          }
        }
      });

      const recommendation = JSON.parse(response.text || '{}') as CaptionStyleRecommendation;
      
      console.log('[CaptionStyleRecommender] Style recommendation generated:', {
        style: recommendation.recommendedStyle,
        confidence: recommendation.confidence,
        videoType: recommendation.contentAnalysis?.videoType
      });

      return recommendation;

    } catch (error) {
      console.error('[CaptionStyleRecommender] Error generating style recommendation:', error);
      
      // Return fallback recommendation
      return {
        recommendedStyle: 'readable',
        confidence: 0.7,
        reasoning: 'Using default readable style due to analysis error',
        visualSettings: {
          fontSize: 24,
          color: '#FFFFFF',
          background: 'rgba(0, 0, 0, 0.7)',
          position: 'bottom',
          animation: 'fade-in'
        },
        contentAnalysis: {
          videoType: 'casual',
          paceAnalysis: 'moderate',
          audienceLevel: 'intermediate',
          speechClarity: 'moderate'
        }
      };
    }
  }

  private buildAnalysisPrompt(videoDuration: number): string {
    return `
You are an expert caption style analyst for video content. Analyze this video and recommend the optimal caption style and visual settings.

Video Duration: ${videoDuration} seconds

CAPTION STYLE ANALYSIS:

1. **readable**: Natural sentence breaks, easy to follow, good for general audiences
2. **verbatim**: Exact words including hesitations, good for legal/documentary content
3. **simplified**: Clean essential words only, good for fast-paced or complex content

VISUAL ANALYSIS REQUIREMENTS:
- Analyze video content type (educational, entertainment, professional, etc.)
- Assess speech pace and clarity
- Determine target audience level
- Evaluate visual complexity and optimal caption placement
- Consider accessibility needs

RECOMMENDATION CRITERIA:
- **Educational/Technical**: Prefer 'readable' with clear formatting
- **Fast-paced/Entertainment**: Consider 'simplified' for clarity
- **Professional/Legal**: May need 'verbatim' for accuracy
- **Casual/Social**: Usually 'readable' or 'simplified'

VISUAL SETTINGS GUIDANCE:
- **fontSize**: 16-32px based on video resolution and content density
- **color**: High contrast colors (#FFFFFF, #FFFF00 for visibility)
- **background**: Semi-transparent backgrounds for readability
- **position**: Bottom for most content, top for lower-third graphics
- **animation**: Subtle animations that don't distract from content

CONTENT ANALYSIS:
- **videoType**: Classify the primary content category
- **paceAnalysis**: Evaluate speaking speed and information density
- **audienceLevel**: Assess technical complexity and target audience
- **speechClarity**: Rate audio quality and pronunciation clarity

Provide specific reasoning for your recommendations based on the actual video content, visual elements, and audio characteristics you observe.

Return a comprehensive analysis with your primary recommendation and 1-2 alternative styles with reasoning.
`;
  }

  // Helper method to get quick style recommendation without full analysis
  async getQuickStyleRecommendation(contentType: string, speechPace: string): Promise<'readable' | 'verbatim' | 'simplified'> {
    const rules = {
      'educational-slow': 'readable',
      'educational-fast': 'simplified',
      'entertainment-fast': 'simplified',
      'entertainment-slow': 'readable',
      'professional-any': 'verbatim',
      'technical-any': 'readable',
      'casual-fast': 'simplified',
      'casual-slow': 'readable'
    };

    const key = `${contentType}-${speechPace}` as keyof typeof rules;
    return rules[key] || 'readable';
  }
}

export const captionStyleRecommender = new CaptionStyleRecommender();