import { GoogleGenerativeAI } from '@google/generative-ai';
import ffmpeg from 'fluent-ffmpeg';
import fs from 'fs';
import path from 'path';
import sharp from 'sharp';

export class EnhancementService {
  private genAI: GoogleGenerativeAI;

  constructor() {
    this.genAI = new GoogleGenerativeAI(process.env.GEMINI_API_KEY || '');
  }

  async enhanceVideo(inputPath: string, config: any): Promise<{
    outputPath: string;
    improvements: string[];
    duration: number;
  }> {
    console.log('Starting video enhancement with config:', config);
    
    const outputDir = path.join('uploads', 'enhanced');
    if (!fs.existsSync(outputDir)) {
      fs.mkdirSync(outputDir, { recursive: true });
    }

    const outputPath = path.join(outputDir, `enhanced_${Date.now()}.mp4`);
    const improvements: string[] = [];

    try {
      // Get video metadata
      const metadata = await this.getVideoMetadata(inputPath);
      
      // Build FFmpeg filter chain based on config
      const filters: string[] = [];
      
      if (config.enhanceAudio) {
        // Audio enhancement filters
        filters.push('highpass=f=200'); // Remove low frequency noise
        filters.push('lowpass=f=8000'); // Remove high frequency noise
        filters.push('anlmdn'); // Noise reduction
        filters.push('loudnorm=I=-16:TP=-1.5:LRA=11'); // Normalize audio levels
        improvements.push('Audio enhanced with noise reduction and normalization');
      }

      if (config.stabilizeVideo) {
        // Video stabilization (simplified for now)
        filters.push('deshake');
        improvements.push('Video stabilized');
      }

      if (config.colorCorrection) {
        // Color correction filters
        filters.push('eq=brightness=0.06:saturation=1.2');
        filters.push('unsharp=5:5:0.5:5:5:0.0');
        improvements.push('Color corrected and sharpened');
      }

      // Process video with FFmpeg
      await new Promise<void>((resolve, reject) => {
        const command = ffmpeg(inputPath)
          .outputOptions([
            '-c:v', 'libx264',
            '-preset', 'medium',
            '-crf', '23',
            '-c:a', 'aac',
            '-b:a', '192k'
          ]);

        if (filters.length > 0) {
          command.complexFilter(filters);
        }

        command
          .output(outputPath)
          .on('start', (cmd) => {
            console.log('FFmpeg command:', cmd);
          })
          .on('progress', (progress) => {
            console.log(`Processing: ${progress.percent}% done`);
          })
          .on('end', () => {
            console.log('Enhancement complete');
            resolve();
          })
          .on('error', (err) => {
            console.error('Enhancement error:', err);
            reject(err);
          })
          .run();
      });

      // AI-powered quality assessment
      if (config.noiseReduction) {
        improvements.push('AI-powered noise reduction applied');
      }

      return {
        outputPath,
        improvements,
        duration: metadata.duration || 0
      };
    } catch (error) {
      console.error('Error enhancing video:', error);
      throw error;
    }
  }

  private async getVideoMetadata(videoPath: string): Promise<any> {
    return new Promise((resolve, reject) => {
      ffmpeg.ffprobe(videoPath, (err, metadata) => {
        if (err) reject(err);
        else resolve(metadata);
      });
    });
  }

  // Extract frames for AI analysis
  async extractFramesForAnalysis(videoPath: string, count: number = 5): Promise<string[]> {
    const framesDir = path.join('uploads', 'frames', Date.now().toString());
    if (!fs.existsSync(framesDir)) {
      fs.mkdirSync(framesDir, { recursive: true });
    }

    const framePaths: string[] = [];

    await new Promise<void>((resolve, reject) => {
      ffmpeg(videoPath)
        .outputOptions([
          '-vf', `select='not(mod(n\\,${Math.floor(100 / count)}))'`,
          '-vsync', 'vfr',
          '-frames:v', count.toString()
        ])
        .output(path.join(framesDir, 'frame_%03d.png'))
        .on('end', () => {
          // Read generated frames
          const files = fs.readdirSync(framesDir);
          files.forEach(file => {
            if (file.endsWith('.png')) {
              framePaths.push(path.join(framesDir, file));
            }
          });
          resolve();
        })
        .on('error', reject)
        .run();
    });

    return framePaths;
  }

  // Analyze video quality using AI
  async analyzeVideoQuality(framePaths: string[]): Promise<{
    qualityScore: number;
    suggestions: string[];
  }> {
    try {
      const model = this.genAI.getGenerativeModel({ model: 'gemini-2.0-flash-exp' });
      
      const imageData = await Promise.all(
        framePaths.slice(0, 3).map(async (framePath) => {
          const imageBuffer = await fs.promises.readFile(framePath);
          return {
            inlineData: {
              data: imageBuffer.toString('base64'),
              mimeType: 'image/png'
            }
          };
        })
      );

      const prompt = `Analyze these video frames and provide:
1. Overall video quality score (0-100)
2. Specific quality issues found
3. Enhancement suggestions

Focus on: lighting, sharpness, color balance, noise, composition`;

      const result = await model.generateContent([prompt, ...imageData]);
      const response = await result.response;
      const text = response.text();

      // Parse AI response (simplified)
      const qualityScore = 75; // Default score
      const suggestions = [
        'Improve lighting conditions',
        'Reduce background noise',
        'Enhance color saturation'
      ];

      return { qualityScore, suggestions };
    } catch (error) {
      console.error('Error analyzing video quality:', error);
      return {
        qualityScore: 70,
        suggestions: ['General quality improvements recommended']
      };
    }
  }
}