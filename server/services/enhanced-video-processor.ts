import { GoogleGenerativeAI } from '@google/generative-ai';
import { spawn } from 'child_process';
import path from 'path';
import fs from 'fs';
import { nanoid } from 'nanoid';

export interface EnhancedProcessingOptions {
  targetAspectRatio: '9:16' | '16:9' | '1:1' | '4:3';
  quality: 'high' | 'medium' | 'low';
  trackingMode: 'auto' | 'person-focus' | 'center-crop' | 'custom';
  personTracking: {
    enabled: boolean;
    priority: 'primary-speaker' | 'all-people' | 'movement-based';
    smoothing: number;
    zoomLevel: number;
  };
}

export interface FrameCropData {
  frameNumber: number;
  timestamp: number;
  originalPath: string;
  croppedPath: string;
  cropArea: {
    x: number;
    y: number;
    width: number;
    height: number;
  };
  aiAnalysis: {
    focusAreas: Array<{
      type: string;
      bbox: { x: number; y: number; width: number; height: number };
      confidence: number;
      description: string;
    }>;
    primaryFocus: {
      x: number;
      y: number;
      width: number;
      height: number;
      confidence: number;
      reason: string;
    };
    sceneDescription: string;
  };
}

export interface EnhancedVideoResult {
  outputPath: string;
  processedFrames: number;
  totalFrames: number;
  frameAnalyses: FrameCropData[];
  processingTime: number;
}

export class EnhancedVideoProcessor {
  private ai: GoogleGenerativeAI;
  private tempDir: string;

  constructor(apiKey: string) {
    this.ai = new GoogleGenerativeAI(apiKey);
    this.tempDir = path.join(process.cwd(), 'temp_enhanced');
    this.ensureTempDir();
  }

  private ensureTempDir() {
    if (!fs.existsSync(this.tempDir)) {
      fs.mkdirSync(this.tempDir, { recursive: true });
    }
  }

  async processVideoFrameByFrame(
    inputPath: string,
    outputPath: string,
    options: EnhancedProcessingOptions,
    progressCallback?: (progress: number) => void
  ): Promise<EnhancedVideoResult> {
    const startTime = Date.now();
    console.log('Starting enhanced frame-by-frame AI processing...');
    
    if (progressCallback) progressCallback(2);

    // Get video metadata
    const videoInfo = await this.getVideoInfo(inputPath);
    console.log('Video info:', videoInfo);
    
    if (progressCallback) progressCallback(5);

    // Create unique processing directory
    const processingId = nanoid();
    const frameDir = path.join(this.tempDir, `frames_${processingId}`);
    const croppedDir = path.join(this.tempDir, `cropped_${processingId}`);
    
    fs.mkdirSync(frameDir, { recursive: true });
    fs.mkdirSync(croppedDir, { recursive: true });
    
    try {
      // Extract all frames from video
      await this.extractAllFrames(inputPath, frameDir, videoInfo);
      if (progressCallback) progressCallback(15);

      // Process each frame with AI analysis and cropping
      const frameAnalyses = await this.processFramesWithAI(
        frameDir, 
        croppedDir, 
        videoInfo, 
        options, 
        progressCallback
      );
      if (progressCallback) progressCallback(80);

      // Reassemble video from cropped frames
      await this.reassembleVideoFromFrames(croppedDir, inputPath, outputPath, videoInfo, options);
      if (progressCallback) progressCallback(95);

      const processingTime = Date.now() - startTime;
      
      if (progressCallback) progressCallback(100);

      return {
        outputPath,
        processedFrames: frameAnalyses.length,
        totalFrames: videoInfo.totalFrames,
        frameAnalyses,
        processingTime
      };

    } finally {
      // Cleanup temporary directories
      if (fs.existsSync(frameDir)) {
        fs.rmSync(frameDir, { recursive: true, force: true });
      }
      if (fs.existsSync(croppedDir)) {
        fs.rmSync(croppedDir, { recursive: true, force: true });
      }
    }
  }

  private async getVideoInfo(inputPath: string): Promise<{
    width: number;
    height: number;
    duration: number;
    fps: number;
    totalFrames: number;
  }> {
    return new Promise((resolve, reject) => {
      const ffprobe = spawn('ffprobe', [
        '-v', 'quiet',
        '-print_format', 'json',
        '-show_format',
        '-show_streams',
        inputPath
      ]);

      let output = '';
      ffprobe.stdout.on('data', (data) => {
        output += data.toString();
      });

      ffprobe.on('close', (code) => {
        if (code === 0) {
          try {
            const info = JSON.parse(output);
            const videoStream = info.streams.find((s: any) => s.codec_type === 'video');
            const duration = parseFloat(info.format.duration);
            const fps = eval(videoStream.r_frame_rate);
            
            resolve({
              width: videoStream.width,
              height: videoStream.height,
              duration,
              fps,
              totalFrames: Math.floor(duration * fps)
            });
          } catch (error) {
            reject(new Error(`Failed to parse video info: ${error}`));
          }
        } else {
          reject(new Error(`ffprobe failed with code ${code}`));
        }
      });
    });
  }

  private async extractAllFrames(
    inputPath: string,
    outputDir: string,
    videoInfo: { fps: number; duration: number }
  ): Promise<void> {
    console.log('Extracting frames every 1 second for individual AI analysis...');
    
    return new Promise((resolve, reject) => {
      // Extract frame every 1 second (1 fps) for better accuracy
      const frameRate = 1; // 1 frame per second = 1 frame every 1 second
      
      const ffmpeg = spawn('ffmpeg', [
        '-i', inputPath,
        '-vf', `fps=${frameRate}`, // Extract 2 frames per second
        '-q:v', '2', // High quality
        path.join(outputDir, 'frame_%06d.jpg'),
        '-y'
      ]);

      ffmpeg.stderr.on('data', (data) => {
        console.log('FFmpeg frame extraction:', data.toString());
      });

      ffmpeg.on('close', (code) => {
        if (code === 0) {
          const frameCount = fs.readdirSync(outputDir).filter(f => f.endsWith('.jpg')).length;
          console.log(`Extracted ${frameCount} frames for AI analysis`);
          resolve();
        } else {
          reject(new Error(`Frame extraction failed with code ${code}`));
        }
      });

      ffmpeg.on('error', reject);
    });
  }

  private async processFramesWithAI(
    frameDir: string,
    croppedDir: string,
    videoInfo: any,
    options: EnhancedProcessingOptions,
    progressCallback?: (progress: number) => void
  ): Promise<FrameCropData[]> {
    const frameFiles = fs.readdirSync(frameDir)
      .filter(f => f.endsWith('.jpg'))
      .sort();

    console.log(`Processing ${frameFiles.length} frames with individual AI analysis...`);
    
    const frameAnalyses: FrameCropData[] = [];
    const progressStep = 65 / frameFiles.length; // 65% progress range for this step
    
    for (let i = 0; i < frameFiles.length; i++) {
      const frameFile = frameFiles[i];
      const framePath = path.join(frameDir, frameFile);
      const frameNumber = parseInt(frameFile.match(/frame_(\d+)\.jpg/)?.[1] || '0');
      const timestamp = (frameNumber - 1) * 0.5; // Each frame represents 0.5 seconds
      
      try {
        console.log(`Processing frame ${i + 1}/${frameFiles.length}: ${frameFile}`);
        
        // Analyze frame with Gemini AI
        const aiAnalysis = await this.analyzeFrameWithGemini(framePath, options);
        
        // Calculate crop area for target aspect ratio
        const cropArea = this.calculateOptimalCrop(aiAnalysis, videoInfo, options);
        
        // Crop the frame based on AI analysis
        const croppedPath = path.join(croppedDir, frameFile);
        await this.cropFrame(framePath, croppedPath, cropArea);
        
        frameAnalyses.push({
          frameNumber,
          timestamp,
          originalPath: framePath,
          croppedPath,
          cropArea,
          aiAnalysis
        });
        
        if (progressCallback && i % 5 === 0) {
          progressCallback(15 + (i * progressStep));
        }
        
      } catch (error) {
        console.error(`Failed to process frame ${frameFile}:`, error);
        // Skip this frame or use fallback processing
      }
    }

    return frameAnalyses;
  }

  private async analyzeFrameWithGemini(
    framePath: string,
    options: EnhancedProcessingOptions
  ): Promise<any> {
    const model = this.ai.getGenerativeModel({ model: 'gemini-1.5-flash' });
    
    const imageData = fs.readFileSync(framePath);
    const base64Image = imageData.toString('base64');
    
    const prompt = `Analyze this video frame for intelligent cropping to ${options.targetAspectRatio} aspect ratio.

Focus on: ${options.personTracking.priority}
Zoom level: ${options.personTracking.zoomLevel}

Identify:
1. Primary subject/person that should be the focus
2. Important elements that must stay in frame
3. Optimal crop area that maintains the subject while fitting ${options.targetAspectRatio}

Respond in JSON:
{
  "focusAreas": [
    {
      "type": "person|face|object|text",
      "bbox": {"x": number, "y": number, "width": number, "height": number},
      "confidence": number,
      "description": "description"
    }
  ],
  "primaryFocus": {
    "x": number,
    "y": number,
    "width": number,
    "height": number,
    "confidence": number,
    "reason": "why this is the main focus"
  },
  "sceneDescription": "brief scene description"
}

All coordinates relative to the image dimensions.`;

    try {
      const result = await model.generateContent([
        prompt,
        {
          inlineData: {
            data: base64Image,
            mimeType: 'image/jpeg'
          }
        }
      ]);

      const responseText = result.response.text();
      const jsonMatch = responseText.match(/\{[\s\S]*\}/);
      
      if (jsonMatch) {
        return JSON.parse(jsonMatch[0]);
      } else {
        throw new Error('No valid JSON in response');
      }
    } catch (error) {
      console.error('Gemini analysis failed:', error);
      // Return fallback analysis
      return {
        focusAreas: [{
          type: 'person',
          bbox: { x: 320, y: 180, width: 640, height: 480 },
          confidence: 0.5,
          description: 'Fallback center focus'
        }],
        primaryFocus: {
          x: 320, y: 180, width: 640, height: 480,
          confidence: 0.5, reason: 'Fallback center crop'
        },
        sceneDescription: 'Fallback analysis'
      };
    }
  }

  private calculateOptimalCrop(
    aiAnalysis: any,
    videoInfo: any,
    options: EnhancedProcessingOptions
  ): { x: number; y: number; width: number; height: number } {
    const targetAspectRatio = this.getAspectRatioValue(options.targetAspectRatio);
    const primaryFocus = aiAnalysis.primaryFocus;
    
    // Calculate crop dimensions
    let cropWidth, cropHeight;
    
    if (targetAspectRatio < (videoInfo.width / videoInfo.height)) {
      // Cropping width (landscape to portrait)
      cropHeight = videoInfo.height;
      cropWidth = cropHeight * targetAspectRatio;
    } else {
      // Cropping height (portrait to landscape)
      cropWidth = videoInfo.width;
      cropHeight = cropWidth / targetAspectRatio;
    }
    
    // Center crop around AI-detected focus area
    const focusCenterX = primaryFocus.x + primaryFocus.width / 2;
    const focusCenterY = primaryFocus.y + primaryFocus.height / 2;
    
    let cropX = Math.max(0, Math.min(videoInfo.width - cropWidth, focusCenterX - cropWidth / 2));
    let cropY = Math.max(0, Math.min(videoInfo.height - cropHeight, focusCenterY - cropHeight / 2));
    
    return {
      x: Math.round(cropX),
      y: Math.round(cropY),
      width: Math.round(cropWidth),
      height: Math.round(cropHeight)
    };
  }

  private async cropFrame(
    inputPath: string,
    outputPath: string,
    cropArea: { x: number; y: number; width: number; height: number }
  ): Promise<void> {
    return new Promise((resolve, reject) => {
      const ffmpeg = spawn('ffmpeg', [
        '-i', inputPath,
        '-vf', `crop=${cropArea.width}:${cropArea.height}:${cropArea.x}:${cropArea.y}`,
        '-q:v', '2',
        outputPath,
        '-y'
      ]);

      ffmpeg.on('close', (code) => {
        if (code === 0) {
          resolve();
        } else {
          reject(new Error(`Frame cropping failed with code ${code}`));
        }
      });

      ffmpeg.on('error', reject);
    });
  }

  private async reassembleVideoFromFrames(
    croppedDir: string,
    originalVideoPath: string,
    outputPath: string,
    videoInfo: any,
    options: EnhancedProcessingOptions
  ): Promise<void> {
    console.log('Reassembling video from AI-cropped frames at original duration...');
    
    return new Promise((resolve, reject) => {
      const targetSize = this.getTargetSize(options.targetAspectRatio, options.quality);
      
      // Use original frame rate to maintain video duration
      const originalFps = videoInfo.fps;
      
      const ffmpeg = spawn('ffmpeg', [
        '-framerate', '2', // Input framerate (we extracted at 2 fps)
        '-i', path.join(croppedDir, 'frame_%06d.jpg'),
        '-i', originalVideoPath, // For audio
        '-c:v', 'libx264',
        '-preset', 'medium',
        '-crf', '23',
        '-pix_fmt', 'yuv420p',
        '-vf', `fps=${originalFps},scale=${targetSize.width}:${targetSize.height}:force_original_aspect_ratio=decrease,pad=${targetSize.width}:${targetSize.height}:(ow-iw)/2:(oh-ih)/2`,
        '-c:a', 'aac',
        '-b:a', '128k',
        '-map', '0:v:0',
        '-map', '1:a:0?', // Map audio if available
        '-t', videoInfo.duration.toString(), // Maintain original duration
        outputPath,
        '-y'
      ]);

      ffmpeg.stderr.on('data', (data) => {
        const output = data.toString();
        console.log('FFmpeg reassembly:', output.substring(0, 100));
      });

      ffmpeg.on('close', (code) => {
        if (code === 0) {
          console.log('Video reassembly completed successfully');
          resolve();
        } else {
          reject(new Error(`Video reassembly failed with code ${code}`));
        }
      });

      ffmpeg.on('error', reject);
    });
  }

  private getAspectRatioValue(aspectRatio: string): number {
    switch (aspectRatio) {
      case '9:16': return 9 / 16;
      case '16:9': return 16 / 9;
      case '1:1': return 1;
      case '4:3': return 4 / 3;
      default: return 9 / 16;
    }
  }

  private getTargetSize(aspectRatio: string, quality: string): { width: number; height: number } {
    const qualityMultiplier = quality === 'high' ? 1 : quality === 'medium' ? 0.75 : 0.5;
    
    switch (aspectRatio) {
      case '9:16':
        return { 
          width: Math.round(1080 * qualityMultiplier), 
          height: Math.round(1920 * qualityMultiplier) 
        };
      case '1:1':
        return { 
          width: Math.round(1080 * qualityMultiplier), 
          height: Math.round(1080 * qualityMultiplier) 
        };
      case '4:3':
        return { 
          width: Math.round(1440 * qualityMultiplier), 
          height: Math.round(1080 * qualityMultiplier) 
        };
      case '16:9':
        return { 
          width: Math.round(1920 * qualityMultiplier), 
          height: Math.round(1080 * qualityMultiplier) 
        };
      default:
        return { 
          width: Math.round(1080 * qualityMultiplier), 
          height: Math.round(1920 * qualityMultiplier) 
        };
    }
  }
}

export const createEnhancedVideoProcessor = (apiKey: string): EnhancedVideoProcessor => {
  return new EnhancedVideoProcessor(apiKey);
};