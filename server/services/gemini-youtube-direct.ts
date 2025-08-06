import { GoogleGenerativeAI } from '@google/generative-ai';

interface ShortsRequest {
  youtubeUrl: string;
  style: 'viral' | 'entertaining' | 'humor' | 'educational' | 'news';
  duration: 15 | 30 | 60;
  aspectRatio: '9:16' | '16:9' | '1:1';
}

interface ShortsResponse {
  success: boolean;
  short?: {
    id: string;
    title: string;
    script: string;
    hook: string;
    keyMoments: Array<{
      timestamp: string;
      description: string;
    }>;
    description: string;
    hashtags: string[];
    style: string;
    editingNotes: string;
    videoUrl: string;
    thumbnailUrl: string;
    duration: number;
  };
  error?: string;
  debug?: any;
}

export class GeminiYouTubeProcessor {
  private ai: GoogleGenerativeAI;

  constructor(apiKey: string) {
    this.ai = new GoogleGenerativeAI(apiKey);
  }

  async createShortsFromYouTube(request: ShortsRequest): Promise<ShortsResponse> {
    try {
      console.log(`Processing YouTube URL: ${request.youtubeUrl}`);
      console.log(`Style: ${request.style}, Duration: ${request.duration}s`);

      const model = this.ai.getGenerativeModel({ model: "gemini-2.0-flash-exp" });
      
      const prompt = this.buildPrompt(request);
      
      console.log('Sending request to Gemini 2.0 Flash...');
      
      const result = await model.generateContent({
        contents: [{
          role: "user",
          parts: [{ text: prompt }]
        }],
        generationConfig: {
          temperature: 0.9,
          topK: 40,
          topP: 0.95,
          maxOutputTokens: 4096,
        }
      });

      const response = result.response.text();
      console.log('Gemini response received');
      
      // Parse the JSON response
      const analysis = this.parseGeminiResponse(response);
      
      if (!analysis) {
        throw new Error('Failed to parse Gemini response');
      }

      // Generate video with the analysis
      const shortId = `short_${Date.now()}`;
      const videoUrl = `/api/video/short/${shortId}`;
      const thumbnailUrl = this.generateThumbnail(request.style);

      const shortsResult: ShortsResponse = {
        success: true,
        short: {
          id: shortId,
          title: analysis.title,
          script: analysis.script,
          hook: analysis.hook,
          keyMoments: analysis.keyMoments || [],
          description: analysis.description,
          hashtags: analysis.hashtags || [],
          style: analysis.style || request.style,
          editingNotes: analysis.editingNotes || '',
          videoUrl,
          thumbnailUrl,
          duration: request.duration
        },
        debug: {
          originalResponse: response,
          parsedAnalysis: analysis
        }
      };

      // Create the actual video file
      this.createVideoFile(shortId, request, analysis);

      return shortsResult;

    } catch (error) {
      console.error('Gemini YouTube processing error:', error);
      
      return {
        success: false,
        error: error.message,
        debug: {
          apiKeyPresent: !!this.ai,
          errorType: error.constructor.name
        }
      };
    }
  }

  private buildPrompt(request: ShortsRequest): string {
    const styleDescriptions = {
      viral: 'viral content that hooks viewers instantly, creates FOMO, and encourages sharing',
      entertaining: 'entertaining content that keeps viewers engaged with fun elements and surprises',
      humor: 'humorous content with comedy timing, jokes, and funny moments',
      educational: 'educational content that teaches something valuable in an engaging way',
      news: 'news-style content that informs about current events or trending topics'
    };

    return `Analyze this YouTube video: ${request.youtubeUrl}

Create a ${request.style} ${request.duration}-second short video script based on the actual video content.

Style focus: ${styleDescriptions[request.style]}

Requirements:
- Use REAL content and moments from the video
- ${request.duration}-second timing with specific breakdowns
- ${request.style} style optimization
- Aspect ratio: ${request.aspectRatio}

Return ONLY valid JSON:
{
  "title": "Engaging ${request.style} title with emojis (based on actual video content)",
  "script": "Detailed ${request.duration}-second script with precise timing markers (0-5s: action, 5-10s: action, etc.)",
  "hook": "Opening line that immediately grabs attention based on video content",
  "keyMoments": [
    {"timestamp": "0:30", "description": "Specific moment from the original video"},
    {"timestamp": "1:15", "description": "Another key moment with timestamp"}
  ],
  "description": "Social media description referencing the original video",
  "hashtags": ["#${request.style}", "#shorts", "#trending", "3-5 more relevant tags"],
  "style": "${request.style}",
  "editingNotes": "Specific visual and audio editing suggestions for ${request.style} style"
}

Analyze the video thoroughly and create authentic content based on what you actually see and hear.`;
  }

  private parseGeminiResponse(response: string): any {
    try {
      // Clean the response
      let cleaned = response.replace(/```json\n?|\n?```/g, '').trim();
      
      // Handle cases where response starts with text before JSON
      const jsonStart = cleaned.indexOf('{');
      if (jsonStart > 0) {
        cleaned = cleaned.substring(jsonStart);
      }
      
      // Handle cases where response has text after JSON
      const jsonEnd = cleaned.lastIndexOf('}');
      if (jsonEnd < cleaned.length - 1) {
        cleaned = cleaned.substring(0, jsonEnd + 1);
      }
      
      return JSON.parse(cleaned);
    } catch (error) {
      console.error('JSON parsing error:', error);
      console.log('Raw response:', response.substring(0, 500));
      return null;
    }
  }

  private generateThumbnail(style: string): string {
    const colors = {
      viral: '#FF6B6B',
      entertaining: '#4ECDC4', 
      humor: '#FFE66D',
      educational: '#4285F4',
      news: '#34A853'
    };

    const color = colors[style] || '#4285F4';
    
    return `data:image/svg+xml;base64,${btoa(`
      <svg width="320" height="180" xmlns="http://www.w3.org/2000/svg">
        <rect width="320" height="180" fill="${color}"/>
        <text x="160" y="90" text-anchor="middle" fill="white" font-size="20" font-weight="bold">
          ${style.toUpperCase()}
        </text>
      </svg>
    `)}`;
  }

  private async createVideoFile(shortId: string, request: ShortsRequest, analysis: any): Promise<void> {
    // This will be implemented to create actual video files
    const fs = await import('fs');
    const path = await import('path');
    const { spawn } = await import('child_process');
    
    const outputDir = path.join(process.cwd(), 'temp_videos');
    await fs.promises.mkdir(outputDir, { recursive: true });
    
    const outputPath = path.join(outputDir, `${shortId}.mp4`);
    
    console.log(`Creating ${request.style} video: ${outputPath}`);
    
    const safeTitle = (analysis.title || 'Generated Short').replace(/['"]/g, '').substring(0, 40);
    
    // Create video with style-specific visuals
    const colors = {
      viral: '#FF6B6B',
      entertaining: '#4ECDC4',
      humor: '#FFE66D', 
      educational: '#4285F4',
      news: '#34A853'
    };
    
    const color = colors[request.style] || '#4285F4';
    const resolution = this.getResolution(request.aspectRatio);
    
    const visualFilter = `color=c=${color}:size=${resolution.width}x${resolution.height}:duration=${request.duration}`;
    const textOverlay = `drawtext=text='${safeTitle}':fontcolor=white:fontsize=24:x=(w-text_w)/2:y=(h-text_h)/2:box=1:boxcolor=black@0.5:boxborderw=5`;
    
    const ffmpeg = spawn('ffmpeg', [
      '-f', 'lavfi',
      '-i', visualFilter,
      '-vf', textOverlay,
      '-t', request.duration.toString(),
      '-pix_fmt', 'yuv420p',
      '-c:v', 'libx264',
      '-preset', 'ultrafast',
      '-y',
      outputPath
    ]);
    
    ffmpeg.on('close', (code) => {
      if (code === 0) {
        fs.promises.stat(outputPath).then(stats => {
          console.log(`${request.style} video created: ${Math.round(stats.size / 1024)}KB`);
        });
      }
    });
  }

  private getResolution(aspectRatio: string): { width: number; height: number } {
    switch (aspectRatio) {
      case '9:16': return { width: 720, height: 1280 };
      case '16:9': return { width: 1280, height: 720 };
      case '1:1': return { width: 1080, height: 1080 };
      default: return { width: 720, height: 1280 };
    }
  }
}

export const createGeminiYouTubeProcessor = (apiKey: string): GeminiYouTubeProcessor => {
  return new GeminiYouTubeProcessor(apiKey);
};