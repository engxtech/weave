import { GoogleGenerativeAI } from '@google/generative-ai';
import ffmpeg from 'fluent-ffmpeg';
import fs from 'fs/promises';
import path from 'path';

export class BackgroundService {
  private genAI: GoogleGenerativeAI;

  constructor() {
    this.genAI = new GoogleGenerativeAI(process.env.GEMINI_API_KEY || '');
  }

  async processBackground(inputPath: string, config: any): Promise<{
    outputPath: string;
    backgroundType: string;
    processingTime: number;
  }> {
    const startTime = Date.now();
    console.log('🎨 Starting background processing with config:', config);
    
    const outputDir = path.join('uploads', 'background');
    await fs.mkdir(outputDir, { recursive: true });

    const outputPath = path.join(outputDir, `background_${Date.now()}.mp4`);

    // Determine action based on config - default to 'replace' for background replacement
    let action = config.action;
    if (!action) {
      // If no action specified, determine based on other config parameters
      if (config.backgroundColor || config.processingEngine) {
        action = 'replace'; // Background replacement
      } else {
        action = 'replace'; // Default fallback
      }
    }

    try {
      if (action === 'remove') {
        await this.removeBackground(inputPath, outputPath, config);
      } else if (action === 'replace') {
        await this.replaceBackground(inputPath, outputPath, config);
      } else if (action === 'blur') {
        await this.blurBackground(inputPath, outputPath, config);
      } else {
        throw new Error(`Invalid background action: ${action}`);
      }
      
      const processingTime = Date.now() - startTime;
      
      return {
        outputPath,
        backgroundType: action,
        processingTime
      };
    } catch (error) {
      console.error('Background processing failed:', error);
      throw error;
    }
  }

  private async removeBackground(inputPath: string, outputPath: string, config: any): Promise<void> {
    // Extract frames for segmentation
    const framesDir = path.join('uploads', 'temp_frames', `frames_${Date.now()}`);
    await fs.mkdir(framesDir, { recursive: true });
    
    // Extract frames at lower rate for efficiency
    await new Promise((resolve, reject) => {
      ffmpeg(inputPath)
        .outputOptions([
          '-vf', 'fps=5', // 5 frames per second
          '-q:v', '2'
        ])
        .output(path.join(framesDir, 'frame_%04d.jpg'))
        .on('end', resolve)
        .on('error', reject)
        .run();
    });

    // Analyze frames for segmentation
    const model = this.genAI.getGenerativeModel({ model: 'gemini-2.0-flash-exp' });
    const frames = await fs.readdir(framesDir);
    
    // Process first frame to get mask
    const firstFrame = frames[0];
    const imagePath = path.join(framesDir, firstFrame);
    const imageBuffer = await fs.readFile(imagePath);
    const imageBase64 = imageBuffer.toString('base64');

    const result = await model.generateContent([
      {
        inlineData: {
          data: imageBase64,
          mimeType: 'image/jpeg'
        }
      },
      `Analyze this frame for background removal.
      
      Identify:
      1. Main subject (person/object) boundaries
      2. Background areas to remove
      3. Edge quality for clean separation
      
      Return segmentation data:
      {
        "subject": {
          "type": "person|object",
          "boundingBox": { "x": number, "y": number, "width": number, "height": number },
          "confidence": 0-1
        },
        "backgroundComplexity": "simple|moderate|complex",
        "edgeQuality": 0-1
      }`
    ]);

    // Apply chromakey or AI-based removal
    const segmentationData = JSON.parse(result.response.text());
    
    // Use green screen removal if background is simple
    if (config.greenScreen || segmentationData.backgroundComplexity === 'simple') {
      await this.applyChromaKey(inputPath, outputPath, config.keyColor || 'green');
    } else {
      // Use AI-based masking (simplified version)
      await this.applyAIMask(inputPath, outputPath, segmentationData);
    }
    
    // Cleanup
    for (const frame of frames) {
      await fs.unlink(path.join(framesDir, frame));
    }
    await fs.rmdir(framesDir);
  }

  private async replaceBackground(inputPath: string, outputPath: string, config: any): Promise<void> {
    const backgroundColor = config.backgroundColor || '#0000ff'; // Default to blue
    const backgroundPath = config.backgroundImage || config.backgroundVideo;
    
    // For now, create a simple solid color background replacement
    // This is a simplified version that creates a colored background
    return new Promise((resolve, reject) => {
      // Convert hex color to FFmpeg format (remove # and use 0x prefix)
      const ffmpegColor = backgroundColor.replace('#', '0x');
      
      ffmpeg(inputPath)
        .complexFilter([
          // Create a solid color background with proper syntax
          `color=c=${ffmpegColor}:s=1920x1080:d=10[bg]`,
          // Scale input video to fit
          '[0:v]scale=1920:1080:force_original_aspect_ratio=decrease,pad=1920:1080:(ow-iw)/2:(oh-ih)/2[fg]',
          // Overlay the video on the colored background
          '[bg][fg]overlay=(W-w)/2:(H-h)/2:shortest=1[out]'
        ])
        .outputOptions([
          '-map', '[out]',
          '-map', '0:a?', // Copy audio if it exists
          '-c:v', 'libx264',
          '-preset', 'fast',
          '-crf', '23',
          '-c:a', 'copy',
          '-t', '10' // Limit to 10 seconds for demo
        ])
        .output(outputPath)
        .on('end', () => {
          console.log('✅ Background replacement completed');
          resolve();
        })
        .on('error', reject)
        .run();
    });
  }

  private async blurBackground(inputPath: string, outputPath: string, config: any): Promise<void> {
    const blurStrength = config.blurStrength || 15;
    
    return new Promise((resolve, reject) => {
      ffmpeg(inputPath)
        .complexFilter([
          `[0:v]split=2[bg][fg]`,
          `[bg]scale=iw:ih,boxblur=${blurStrength}:${blurStrength}[blurred]`,
          `[blurred][fg]overlay=0:0[out]`
        ])
        .outputOptions([
          '-map', '[out]',
          '-map', '0:a',
          '-c:v', 'libx264',
          '-preset', 'medium',
          '-crf', '23',
          '-c:a', 'copy'
        ])
        .output(outputPath)
        .on('end', () => {
          console.log('✅ Background blur applied');
          resolve();
        })
        .on('error', reject)
        .run();
    });
  }

  private async applyChromaKey(inputPath: string, outputPath: string, keyColor: string): Promise<void> {
    const colorKey = keyColor === 'green' ? '0x00FF00' : '0x0000FF';
    
    return new Promise((resolve, reject) => {
      ffmpeg(inputPath)
        .complexFilter([
          `[0:v]chromakey=${colorKey}:0.3:0.1[ckout]`,
          '[ckout]format=yuva420p[out]'
        ])
        .outputOptions([
          '-map', '[out]',
          '-map', '0:a',
          '-c:v', 'libx264',
          '-preset', 'medium',
          '-crf', '23',
          '-c:a', 'copy'
        ])
        .output(outputPath)
        .on('end', () => resolve())
        .on('error', reject)
        .run();
    });
  }

  private async applyAIMask(inputPath: string, outputPath: string, segmentationData: any): Promise<void> {
    // Simplified AI masking using bounding box
    const { x, y, width, height } = segmentationData.subject.boundingBox;
    
    return new Promise((resolve, reject) => {
      ffmpeg(inputPath)
        .complexFilter([
          `[0:v]crop=${width}:${height}:${x}:${y},format=yuva420p[fg]`,
          `[0:v]drawbox=${x}:${y}:${width}:${height}:black@1:t=fill[bg]`,
          '[bg][fg]overlay=${x}:${y}[out]'
        ])
        .outputOptions([
          '-map', '[out]',
          '-map', '0:a',
          '-c:v', 'libx264',
          '-preset', 'medium',
          '-crf', '23',
          '-c:a', 'copy'
        ])
        .output(outputPath)
        .on('end', () => resolve())
        .on('error', reject)
        .run();
    });
  }

  private async generateAIBackground(prompt: string): Promise<string> {
    const model = this.genAI.getGenerativeModel({ model: 'gemini-2.0-flash-exp' });
    
    const result = await model.generateContent([
      `Generate a professional background image description for: "${prompt}"
      
      Consider:
      - Professional appearance
      - Good lighting
      - Minimal distractions
      - Suitable for video calls
      
      Describe the ideal background in detail.`
    ]);
    
    // In a real implementation, this would generate an actual image
    // For now, we'll use a placeholder
    const backgroundPath = path.join('uploads', 'background', `ai_bg_${Date.now()}.jpg`);
    
    // Create a simple colored background as placeholder
    await new Promise((resolve, reject) => {
      ffmpeg()
        .input('color=c=0x4A90E2:s=1920x1080:d=1')
        .inputOptions(['-f', 'lavfi'])
        .outputOptions([
          '-frames:v', '1',
          '-update', '1'
        ])
        .output(backgroundPath)
        .on('end', resolve)
        .on('error', reject)
        .run();
    });
    
    return backgroundPath;
  }
}