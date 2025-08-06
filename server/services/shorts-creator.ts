import { createVideoAnalyzer, VideoAnalyzer } from './video-analyzer.js';
import { createAuthenticVideoProcessor, AuthenticVideoProcessor } from './authentic-video-processor.js';
import { spawn } from 'child_process';
import { promises as fs } from 'fs';
import path from 'path';

interface ShortsRequest {
  filePath: string;
  style: 'viral' | 'educational' | 'entertaining' | 'humor' | 'news';
  duration: 15 | 30 | 60;
  aspectRatio: '9:16' | '16:9' | '1:1';
}

interface ShortsResult {
  success: boolean;
  shortId?: string;
  videoUrl?: string;
  thumbnailUrl?: string;
  analysis?: any;
  script?: any;
  error?: string;
  debug?: any;
}

export class ShortsCreator {
  private videoAnalyzer: VideoAnalyzer;
  private authenticProcessor: AuthenticVideoProcessor;

  constructor(apiKey: string) {
    this.videoAnalyzer = createVideoAnalyzer(apiKey);
    this.authenticProcessor = createAuthenticVideoProcessor(apiKey);
  }

  async createShorts(request: ShortsRequest): Promise<ShortsResult> {
    const shortId = `short_${Date.now()}`;
    
    try {
      console.log(`Creating authentic ${request.style} shorts from file: ${request.filePath}`);
      
      // Use the new authentic video processor
      const result = await this.authenticProcessor.processVideoForShorts(
        request.filePath,
        request.style,
        request.duration
      );

      if (result.success && result.data) {
        const thumbnailUrl = this.generateThumbnail(request.style, result.data.metadata?.title || 'Authentic Short');
        
        console.log(`Authentic shorts creation completed: ${shortId}`);
        
        return {
          success: true,
          shortId,
          videoUrl: `/api/video/short/${shortId}`,
          thumbnailUrl,
          analysis: {
            transcription: result.data.transcription,
            segments: result.data.segments,
            metadata: result.data.metadata
          },
          script: {
            title: result.data.metadata?.title || 'Authentic Short',
            description: result.data.metadata?.description || '',
            segments: result.data.segments
          },
          debug: {
            authentic: true,
            transcribed: true,
            segmentsCut: true,
            videoPath: result.data.videoPath
          }
        };
      } else {
        throw new Error(result.error || 'Authentic video processing failed');
      }
      
    } catch (error) {
      console.error('Shorts creation error:', error);
      
      return {
        success: false,
        error: error.message,
        debug: {
          shortId,
          errorStep: 'analysis_or_generation',
          originalUrl: request.youtubeUrl
        }
      };
    }
  }

  private async createVideoFile(
    shortId: string, 
    request: ShortsRequest, 
    analysis: any, 
    script: any
  ): Promise<string> {
    const outputDir = path.join(process.cwd(), 'temp_videos');
    await fs.mkdir(outputDir, { recursive: true });
    
    const outputPath = path.join(outputDir, `${shortId}.mp4`);
    
    // Get video resolution based on aspect ratio
    const resolution = this.getResolution(request.aspectRatio);
    
    // Create style-specific visual
    const styleColors = {
      viral: '#FF6B6B',
      educational: '#4285F4',
      entertaining: '#4ECDC4',
      humor: '#FFE66D',
      news: '#34A853'
    };
    
    const color = styleColors[request.style] || '#4285F4';
    const safeTitle = (script.title || analysis.title || 'AI Generated Short')
      .replace(/['"]/g, '')
      .substring(0, 50);
    
    // Create video with enhanced visuals
    const visualFilter = `color=c=${color}:size=${resolution.width}x${resolution.height}:duration=${request.duration}`;
    const textOverlay = `drawtext=text='${safeTitle}':fontcolor=white:fontsize=28:x=(w-text_w)/2:y=(h-text_h)/2:box=1:boxcolor=black@0.7:boxborderw=8`;
    
    return new Promise((resolve, reject) => {
      console.log(`Creating ${request.style} video: ${outputPath}`);
      
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
      
      ffmpeg.stderr.on('data', (data) => {
        // FFmpeg writes progress to stderr
        const output = data.toString();
        if (output.includes('frame=')) {
          console.log('Video generation progress:', output.trim().split('\n').pop());
        }
      });
      
      ffmpeg.on('close', async (code) => {
        if (code === 0) {
          try {
            const stats = await fs.stat(outputPath);
            const sizeKB = Math.round(stats.size / 1024);
            console.log(`${request.style} video created: ${sizeKB}KB`);
            resolve(outputPath);
          } catch (error) {
            reject(new Error(`Video file not found after creation: ${error.message}`));
          }
        } else {
          reject(new Error(`FFmpeg process failed with code ${code}`));
        }
      });
      
      ffmpeg.on('error', (error) => {
        reject(new Error(`FFmpeg error: ${error.message}`));
      });
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

  private generateThumbnail(style: string, title: string): string {
    const colors = {
      viral: '#FF6B6B',
      educational: '#4285F4',
      entertaining: '#4ECDC4',
      humor: '#FFE66D',
      news: '#34A853'
    };
    
    const color = colors[style] || '#4285F4';
    const safeTitle = (title || style.toUpperCase())
      .replace(/[^\w\s\-]/g, '') // Remove special characters except dash
      .replace(/\s+/g, ' ') // Normalize spaces
      .trim()
      .substring(0, 20);
    
    const svgContent = `<svg width="320" height="180" xmlns="http://www.w3.org/2000/svg">
      <rect width="320" height="180" fill="${color}"/>
      <text x="160" y="90" text-anchor="middle" fill="white" font-size="18" font-weight="bold">
        ${safeTitle}
      </text>
      <text x="160" y="120" text-anchor="middle" fill="white" font-size="12">
        ${style.toUpperCase()} SHORTS
      </text>
    </svg>`;
    
    try {
      return `data:image/svg+xml;base64,${Buffer.from(svgContent).toString('base64')}`;
    } catch (error) {
      // Fallback to simple data URL if base64 encoding fails
      return `data:image/svg+xml;charset=utf-8,${encodeURIComponent(svgContent)}`;
    }
  }
}

export const createShortsCreator = (apiKey: string): ShortsCreator => {
  return new ShortsCreator(apiKey);
};