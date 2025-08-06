import ffmpeg from 'fluent-ffmpeg';
import path from 'path';
import fs from 'fs';
import { GoogleGenAI } from '@google/generative-ai';
import { nanoid } from 'nanoid';

export interface ReframingOptions {
  targetAspectRatio: '9:16' | '16:9' | '1:1' | '4:3';
  quality: 'high' | 'medium' | 'low';
  aiTracking: boolean;
  customCrop?: {
    x: number;
    y: number;
    width: number;
    height: number;
  };
}

export interface SubjectDetection {
  confidence: number;
  x: number;
  y: number;
  width: number;
  height: number;
  type: 'person' | 'face' | 'object' | 'text';
}

export interface FrameAnalysis {
  timestamp: number;
  subjects: SubjectDetection[];
  recommendedCrop: {
    x: number;
    y: number;
    width: number;
    height: number;
  };
  confidence: number;
}

export class SmartReframingService {
  private genAI: GoogleGenAI;
  private tempDir: string;

  constructor() {
    const apiKey = process.env.GEMINI_API_KEY;
    if (!apiKey) {
      throw new Error('GEMINI_API_KEY environment variable is required');
    }
    this.genAI = new GoogleGenAI(apiKey);
    this.tempDir = path.join(process.cwd(), 'temp_reframing');
    this.ensureTempDir();
  }

  private ensureTempDir() {
    if (!fs.existsSync(this.tempDir)) {
      fs.mkdirSync(this.tempDir, { recursive: true });
    }
  }

  async analyzeVideoForReframing(videoPath: string): Promise<FrameAnalysis[]> {
    const frameDir = path.join(this.tempDir, `frames_${nanoid()}`);
    fs.mkdirSync(frameDir, { recursive: true });

    try {
      // Extract frames at key intervals for analysis
      await this.extractKeyFrames(videoPath, frameDir);
      
      // Analyze each frame with Gemini AI
      const frameFiles = fs.readdirSync(frameDir).filter(f => f.endsWith('.jpg'));
      const analyses: FrameAnalysis[] = [];

      for (let i = 0; i < frameFiles.length; i++) {
        const framePath = path.join(frameDir, frameFiles[i]);
        const timestamp = i * 1; // Assuming 1-second intervals for better accuracy
        
        try {
          const analysis = await this.analyzeFrameWithAI(framePath, timestamp);
          analyses.push(analysis);
        } catch (error) {
          console.error(`Failed to analyze frame ${frameFiles[i]}:`, error);
          // Fallback analysis
          analyses.push({
            timestamp,
            subjects: [],
            recommendedCrop: { x: 0, y: 0, width: 1920, height: 1080 },
            confidence: 0.1
          });
        }
      }

      return analyses;
    } finally {
      // Cleanup
      if (fs.existsSync(frameDir)) {
        fs.rmSync(frameDir, { recursive: true, force: true });
      }
    }
  }

  private async extractKeyFrames(videoPath: string, outputDir: string): Promise<void> {
    return new Promise((resolve, reject) => {
      ffmpeg(videoPath)
        .outputOptions([
          '-vf', 'fps=1/2', // Extract one frame every 2 seconds
          '-q:v', '2' // High quality
        ])
        .output(path.join(outputDir, 'frame_%03d.jpg'))
        .on('end', resolve)
        .on('error', reject)
        .run();
    });
  }

  private async analyzeFrameWithAI(framePath: string, timestamp: number): Promise<FrameAnalysis> {
    try {
      const model = this.genAI.getGenerativeModel({ model: 'gemini-1.5-flash' });
      
      // Read frame as base64
      const imageBuffer = fs.readFileSync(framePath);
      const base64Image = imageBuffer.toString('base64');
      
      const prompt = `
        Analyze this video frame for smart reframing to portrait orientation (9:16).
        
        Identify and locate:
        1. People/faces (primary subjects)
        2. Important objects or text
        3. Areas of visual interest
        
        For each detected subject, provide:
        - Type (person, face, object, text)
        - Confidence level (0-1)
        - Bounding box coordinates (x, y, width, height) as percentages of frame
        
        Recommend optimal crop area for portrait reframing that:
        - Keeps most important subjects in frame
        - Maintains good composition
        - Avoids cutting off people's heads/bodies
        
        Respond in JSON format:
        {
          "subjects": [
            {
              "type": "person|face|object|text",
              "confidence": 0.0-1.0,
              "x": 0-100,
              "y": 0-100,
              "width": 0-100,
              "height": 0-100
            }
          ],
          "recommendedCrop": {
            "x": 0-100,
            "y": 0-100,
            "width": 0-100,
            "height": 0-100
          },
          "confidence": 0.0-1.0
        }
      `;

      const result = await model.generateContent([
        {
          inlineData: {
            mimeType: 'image/jpeg',
            data: base64Image
          }
        },
        { text: prompt }
      ]);

      const response = await result.response;
      const text = response.text();
      
      // Extract JSON from response
      const jsonMatch = text.match(/\{[\s\S]*\}/);
      if (!jsonMatch) {
        throw new Error('No JSON found in AI response');
      }

      const analysis = JSON.parse(jsonMatch[0]);
      
      return {
        timestamp,
        subjects: analysis.subjects || [],
        recommendedCrop: analysis.recommendedCrop || { x: 25, y: 0, width: 50, height: 100 },
        confidence: analysis.confidence || 0.5
      };
    } catch (error) {
      console.error('AI frame analysis failed:', error);
      // Return fallback analysis focusing on center crop
      return {
        timestamp,
        subjects: [],
        recommendedCrop: { x: 25, y: 0, width: 50, height: 100 }, // Center crop for portrait
        confidence: 0.3
      };
    }
  }

  async reframeVideo(
    inputPath: string, 
    outputPath: string, 
    options: ReframingOptions,
    progressCallback?: (progress: number) => void
  ): Promise<void> {
    const { width, height } = this.getTargetResolution(options.targetAspectRatio);
    
    if (options.aiTracking) {
      // AI-powered dynamic reframing
      await this.applyDynamicReframing(inputPath, outputPath, options, progressCallback);
    } else if (options.customCrop) {
      // Manual crop
      await this.applyStaticCrop(inputPath, outputPath, options.customCrop, width, height);
    } else {
      // Smart center crop
      await this.applySmartCenterCrop(inputPath, outputPath, width, height);
    }
  }

  private async applyDynamicReframing(
    inputPath: string,
    outputPath: string,
    options: ReframingOptions,
    progressCallback?: (progress: number) => void
  ): Promise<void> {
    // Analyze video for subject tracking
    const analyses = await this.analyzeVideoForReframing(inputPath);
    
    if (progressCallback) progressCallback(30);
    
    // Generate crop filter based on analysis
    const cropFilter = this.generateDynamicCropFilter(analyses, options);
    const { width, height } = this.getTargetResolution(options.targetAspectRatio);
    
    return new Promise((resolve, reject) => {
      const command = ffmpeg(inputPath);
      
      command
        .outputOptions([
          '-vf', `${cropFilter},scale=${width}:${height}:flags=lanczos`,
          '-c:v', 'libx264',
          '-preset', this.getQualityPreset(options.quality),
          '-crf', this.getQualityCRF(options.quality),
          '-c:a', 'aac',
          '-b:a', '128k'
        ])
        .output(outputPath)
        .on('progress', (progress) => {
          if (progressCallback) {
            const totalProgress = 30 + (progress.percent || 0) * 0.7;
            progressCallback(Math.min(100, totalProgress));
          }
        })
        .on('end', () => {
          if (progressCallback) progressCallback(100);
          resolve();
        })
        .on('error', reject)
        .run();
    });
  }

  private generateDynamicCropFilter(analyses: FrameAnalysis[], options: ReframingOptions): string {
    if (analyses.length === 0) {
      return 'crop=iw*0.5625:ih:iw*0.21875:0'; // Default 9:16 center crop
    }

    // Create smooth interpolation between crop positions
    const crops = analyses.map(analysis => {
      const crop = analysis.recommendedCrop;
      const sourceWidth = 'iw';
      const sourceHeight = 'ih';
      
      return {
        time: analysis.timestamp,
        x: `${sourceWidth}*${crop.x/100}`,
        y: `${sourceHeight}*${crop.y/100}`,
        w: `${sourceWidth}*${crop.width/100}`,
        h: `${sourceHeight}*${crop.height/100}`
      };
    });

    // For now, use the most confident crop position
    const bestCrop = analyses.reduce((best, current) => 
      current.confidence > best.confidence ? current : best
    );

    const crop = bestCrop.recommendedCrop;
    return `crop=iw*${crop.width/100}:ih*${crop.height/100}:iw*${crop.x/100}:ih*${crop.y/100}`;
  }

  private async applyStaticCrop(
    inputPath: string,
    outputPath: string,
    crop: { x: number; y: number; width: number; height: number },
    targetWidth: number,
    targetHeight: number
  ): Promise<void> {
    return new Promise((resolve, reject) => {
      ffmpeg(inputPath)
        .outputOptions([
          '-vf', `crop=${crop.width}:${crop.height}:${crop.x}:${crop.y},scale=${targetWidth}:${targetHeight}:flags=lanczos`,
          '-c:v', 'libx264',
          '-preset', 'medium',
          '-crf', '23',
          '-c:a', 'aac'
        ])
        .output(outputPath)
        .on('end', resolve)
        .on('error', reject)
        .run();
    });
  }

  private async applySmartCenterCrop(
    inputPath: string,
    outputPath: string,
    targetWidth: number,
    targetHeight: number
  ): Promise<void> {
    return new Promise((resolve, reject) => {
      ffmpeg(inputPath)
        .outputOptions([
          '-vf', `scale=${targetWidth}:${targetHeight}:flags=lanczos:force_original_aspect_ratio=increase,crop=${targetWidth}:${targetHeight}`,
          '-c:v', 'libx264',
          '-preset', 'medium',
          '-crf', '23',
          '-c:a', 'aac'
        ])
        .output(outputPath)
        .on('end', resolve)
        .on('error', reject)
        .run();
    });
  }

  private getTargetResolution(aspectRatio: string): { width: number; height: number } {
    switch (aspectRatio) {
      case '9:16':
        return { width: 1080, height: 1920 };
      case '16:9':
        return { width: 1920, height: 1080 };
      case '1:1':
        return { width: 1080, height: 1080 };
      case '4:3':
        return { width: 1440, height: 1080 };
      default:
        return { width: 1080, height: 1920 };
    }
  }

  private getQualityPreset(quality: string): string {
    switch (quality) {
      case 'high': return 'slow';
      case 'medium': return 'medium';
      case 'low': return 'fast';
      default: return 'medium';
    }
  }

  private getQualityCRF(quality: string): string {
    switch (quality) {
      case 'high': return '18';
      case 'medium': return '23';
      case 'low': return '28';
      default: return '23';
    }
  }

  // Get video information
  async getVideoInfo(videoPath: string): Promise<{ width: number; height: number; duration: number }> {
    return new Promise((resolve, reject) => {
      ffmpeg.ffprobe(videoPath, (err, metadata) => {
        if (err) {
          reject(err);
          return;
        }

        const videoStream = metadata.streams.find(s => s.codec_type === 'video');
        if (!videoStream) {
          reject(new Error('No video stream found'));
          return;
        }

        resolve({
          width: videoStream.width || 1920,
          height: videoStream.height || 1080,
          duration: metadata.format.duration || 0
        });
      });
    });
  }
}

export const smartReframingService = new SmartReframingService();