import { GoogleGenerativeAI } from '@google/generative-ai';
import * as fs from 'fs';
import * as path from 'path';

export interface GeneratedTextOverlay {
  text: string;
  startTime: number;
  duration: number;
  position: { x: number; y: number };
  style: {
    fontSize: number;
    color: string;
    backgroundColor?: string;
    fontWeight: 'normal' | 'bold';
    animation?: 'fade_in' | 'slide_up' | 'bounce' | 'typewriter';
  };
  context: string; // Why this text was suggested
  importance: number; // 1-10 priority score
}

export interface TextGenerationOptions {
  segmentDuration: number;
  videoStyle: 'viral' | 'educational' | 'entertainment' | 'news' | 'professional';
  textStyle: 'captions' | 'highlights' | 'commentary' | 'questions' | 'callouts';
  maxOverlays: number;
  targetAudience: 'general' | 'young' | 'professional' | 'educational';
}

export class TextOverlayGenerator {
  private ai: GoogleGenerativeAI;

  constructor(apiKey: string) {
    this.ai = new GoogleGenerativeAI(apiKey);
  }

  async generateTextOverlays(
    videoPath: string,
    segment: { startTime: number; endTime: number; description?: string },
    options: TextGenerationOptions
  ): Promise<GeneratedTextOverlay[]> {
    try {
      console.log('Generating text overlays for segment:', segment);
      
      // Analyze video segment content
      const videoAnalysis = await this.analyzeVideoSegment(videoPath, segment);
      
      // Generate text overlays based on analysis
      const overlays = await this.generateOverlaysFromAnalysis(videoAnalysis, segment, options);
      
      return overlays;
    } catch (error) {
      console.error('Text overlay generation failed:', error);
      return this.generateFallbackOverlays(segment, options);
    }
  }

  private async analyzeVideoSegment(
    videoPath: string,
    segment: { startTime: number; endTime: number; description?: string }
  ): Promise<any> {
    try {
      // Upload video file to Gemini for analysis
      const videoBytes = fs.readFileSync(videoPath);
      
      const prompt = `Analyze this video segment from ${segment.startTime}s to ${segment.endTime}s and provide:
1. Key visual elements and actions
2. Audio/speech content (if any)
3. Emotional tone and mood
4. Main subject or focus
5. Text-worthy moments for overlays
6. Suggested overlay timing and positioning

Respond in JSON format with structured analysis.`;

      const model = this.ai.getGenerativeModel({ model: 'gemini-2.0-flash-exp' });
      
      const result = await model.generateContent([
        {
          inlineData: {
            data: videoBytes.toString('base64'),
            mimeType: 'video/mp4'
          }
        },
        prompt
      ]);

      const response = result.response.text();
      console.log('Video analysis response:', response);

      try {
        return JSON.parse(response);
      } catch {
        return { 
          visualElements: ['video content'],
          audioContent: 'detected audio',
          mood: 'neutral',
          keyMoments: [{ time: segment.startTime + 1, description: 'key moment' }]
        };
      }
    } catch (error) {
      console.error('Video analysis error:', error);
      return this.getFallbackAnalysis(segment);
    }
  }

  private async generateOverlaysFromAnalysis(
    analysis: any,
    segment: { startTime: number; endTime: number; description?: string },
    options: TextGenerationOptions
  ): Promise<GeneratedTextOverlay[]> {
    const prompt = `Based on this video analysis, generate ${options.maxOverlays} text overlays for a ${options.videoStyle} video:

Analysis: ${JSON.stringify(analysis)}
Segment: ${segment.startTime}s to ${segment.endTime}s
Style: ${options.textStyle}
Audience: ${options.targetAudience}

Generate engaging text overlays that:
- Enhance viewer engagement
- Match the ${options.videoStyle} style
- Are appropriate for ${options.targetAudience} audience
- Use ${options.textStyle} approach

For each overlay, provide:
- text: The actual text to display
- startTime: When to show (relative to segment start, 0-${segment.endTime - segment.startTime})
- duration: How long to show (0.5-3 seconds)
- position: {x: 0-100, y: 0-100} percentage positioning
- style: fontSize (16-48), color (hex), backgroundColor (hex), fontWeight, animation
- context: Why this text enhances the video
- importance: 1-10 priority score

Respond with valid JSON array of overlay objects.`;

    try {
      const model = this.ai.getGenerativeModel({ 
        model: 'gemini-1.5-flash',
        generationConfig: {
          responseMimeType: 'application/json'
        }
      });

      const result = await model.generateContent(prompt);
      const response = result.response.text();
      
      console.log('Generated overlays response:', response);
      
      const overlays = JSON.parse(response);
      return this.validateAndFormatOverlays(overlays, segment, options);
    } catch (error) {
      console.error('Overlay generation error:', error);
      return this.generateFallbackOverlays(segment, options);
    }
  }

  private validateAndFormatOverlays(
    overlays: any[],
    segment: { startTime: number; endTime: number },
    options: TextGenerationOptions
  ): GeneratedTextOverlay[] {
    if (!Array.isArray(overlays)) {
      return this.generateFallbackOverlays(segment, options);
    }

    return overlays.slice(0, options.maxOverlays).map((overlay, index) => ({
      text: overlay.text || `Text ${index + 1}`,
      startTime: Math.max(0, Math.min(overlay.startTime || 0, segment.endTime - segment.startTime - 0.5)),
      duration: Math.max(0.5, Math.min(overlay.duration || 2, 3)),
      position: {
        x: Math.max(10, Math.min(overlay.position?.x || 50, 90)),
        y: Math.max(10, Math.min(overlay.position?.y || 50, 90))
      },
      style: {
        fontSize: Math.max(16, Math.min(overlay.style?.fontSize || 24, 48)),
        color: overlay.style?.color || this.getStyleColor(options.videoStyle, 'text'),
        backgroundColor: overlay.style?.backgroundColor || this.getStyleColor(options.videoStyle, 'background'),
        fontWeight: overlay.style?.fontWeight === 'normal' ? 'normal' : 'bold',
        animation: this.getStyleAnimation(options.videoStyle, overlay.style?.animation)
      },
      context: overlay.context || 'AI-generated text overlay',
      importance: Math.max(1, Math.min(overlay.importance || 5, 10))
    }));
  }

  private generateFallbackOverlays(
    segment: { startTime: number; endTime: number; description?: string },
    options: TextGenerationOptions
  ): GeneratedTextOverlay[] {
    const duration = segment.endTime - segment.startTime;
    const overlays: GeneratedTextOverlay[] = [];

    const fallbackTexts = this.getFallbackTexts(options);
    
    for (let i = 0; i < Math.min(options.maxOverlays, fallbackTexts.length); i++) {
      const text = fallbackTexts[i];
      const startTime = (duration / options.maxOverlays) * i;
      
      overlays.push({
        text,
        startTime,
        duration: Math.min(2, duration - startTime),
        position: { 
          x: 20 + (i * 15) % 60, 
          y: 20 + (i * 20) % 60 
        },
        style: {
          fontSize: 24,
          color: this.getStyleColor(options.videoStyle, 'text'),
          backgroundColor: this.getStyleColor(options.videoStyle, 'background'),
          fontWeight: 'bold',
          animation: this.getStyleAnimation(options.videoStyle)
        },
        context: 'Fallback text overlay',
        importance: 5
      });
    }

    return overlays;
  }

  private getFallbackTexts(options: TextGenerationOptions): string[] {
    const textsByStyle = {
      captions: ['Watch this!', 'Amazing moment', 'Key point', 'Important!'],
      highlights: ['🔥 Trending', '⭐ Featured', '💡 Pro tip', '🎯 Focus'],
      commentary: ['Interesting...', 'What happens next?', 'Notice this', 'Pay attention'],
      questions: ['Did you see that?', 'What do you think?', 'Guess what?', 'Can you spot it?'],
      callouts: ['NEW!', 'EXCLUSIVE', 'LIMITED TIME', 'DON\'T MISS']
    };

    const audienceTexts = {
      young: ['So cool!', 'OMG!', 'No way!', 'Epic!'],
      professional: ['Key insight', 'Important note', 'Consider this', 'Take note'],
      educational: ['Learn more', 'Remember this', 'Key concept', 'Study tip'],
      general: ['Check this out', 'Interesting fact', 'Good to know', 'Notice this']
    };

    return [
      ...textsByStyle[options.textStyle] || textsByStyle.highlights,
      ...audienceTexts[options.targetAudience] || audienceTexts.general
    ];
  }

  private getStyleColor(videoStyle: string, type: 'text' | 'background'): string {
    const colors = {
      viral: {
        text: '#ffffff',
        background: '#ff1744'
      },
      educational: {
        text: '#1a237e',
        background: '#e3f2fd'
      },
      entertainment: {
        text: '#ffffff',
        background: '#9c27b0'
      },
      news: {
        text: '#ffffff',
        background: '#1565c0'
      },
      professional: {
        text: '#212121',
        background: '#f5f5f5'
      }
    };

    return colors[videoStyle]?.[type] || colors.viral[type];
  }

  private getStyleAnimation(videoStyle: string, requested?: string): 'fade_in' | 'slide_up' | 'bounce' | 'typewriter' {
    if (requested && ['fade_in', 'slide_up', 'bounce', 'typewriter'].includes(requested)) {
      return requested as any;
    }

    const animations = {
      viral: 'bounce',
      educational: 'fade_in',
      entertainment: 'slide_up',
      news: 'typewriter',
      professional: 'fade_in'
    };

    return animations[videoStyle] || 'fade_in';
  }

  private getFallbackAnalysis(segment: { startTime: number; endTime: number; description?: string }) {
    return {
      visualElements: ['video content', 'movement', 'objects'],
      audioContent: segment.description || 'audio detected',
      mood: 'neutral',
      keyMoments: [
        { time: 0, description: 'segment start' },
        { time: (segment.endTime - segment.startTime) / 2, description: 'middle point' }
      ],
      suggestedOverlays: [
        { timing: 'early', position: 'top', type: 'intro' },
        { timing: 'late', position: 'bottom', type: 'conclusion' }
      ]
    };
  }

  async generateBatchOverlays(
    videoPath: string,
    segments: Array<{ startTime: number; endTime: number; description?: string }>,
    options: TextGenerationOptions
  ): Promise<GeneratedTextOverlay[][]> {
    const allOverlays: GeneratedTextOverlay[][] = [];

    for (const segment of segments) {
      const overlays = await this.generateTextOverlays(videoPath, segment, options);
      allOverlays.push(overlays);
    }

    return allOverlays;
  }
}

export const createTextOverlayGenerator = (apiKey: string): TextOverlayGenerator => {
  return new TextOverlayGenerator(apiKey);
};