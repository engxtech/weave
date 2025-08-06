import { GoogleGenerativeAI } from '@google/generative-ai';
import { spawn } from 'child_process';
import path from 'path';
import fs from 'fs';
import { nanoid } from 'nanoid';

export interface FrameTrackingOptions {
  targetAspectRatio: '9:16' | '16:9' | '1:1' | '4:3';
  quality: 'high' | 'medium' | 'low';
}

export interface FrameFocusData {
  frameNumber: number;
  timestamp: number;
  focusCenter: { x: number; y: number };
  focusRegion: { x: number; y: number; width: number; height: number };
  confidence: number;
  detectedObjects: Array<{
    type: 'person' | 'face' | 'text' | 'object';
    bbox: { x: number; y: number; width: number; height: number };
    confidence: number;
  }>;
}

export interface VideoFocusResult {
  success: boolean;
  outputPath: string;
  totalFrames: number;
  processedFrames: number;
  averageConfidence: number;
  processingTime: number;
}

export class FrameByFrameTracker {
  private ai: GoogleGenerativeAI;
  private tempDir: string;

  constructor(apiKey: string) {
    this.ai = new GoogleGenerativeAI(apiKey);
    this.tempDir = path.join(process.cwd(), 'temp_frame_analysis');
    this.ensureTempDir();
  }

  private ensureTempDir() {
    if (!fs.existsSync(this.tempDir)) {
      fs.mkdirSync(this.tempDir, { recursive: true });
    }
  }

  private log(message: string): void {
    console.log(`Frame Tracker: [${new Date().toISOString()}] ${message}`);
  }

  async processVideoFrameByFrame(
    inputPath: string,
    outputPath: string,
    options: FrameTrackingOptions
  ): Promise<VideoFocusResult> {
    const startTime = Date.now();
    
    try {
      this.log('Starting frame-by-frame focus tracking and cropping');
      
      // Step 1: Extract all frames
      const framesDir = await this.extractAllFrames(inputPath);
      
      // Step 2: Analyze each frame with OpenCV-style focus detection
      const frameFocusData = await this.analyzeFrameFocus(framesDir);
      
      // Step 3: Calculate crop dimensions for each frame based on aspect ratio
      const cropData = this.calculateFrameCrops(frameFocusData, options);
      
      // Step 4: Apply FFmpeg frame-by-frame cropping
      const croppedFramesDir = await this.cropFramesIndividually(framesDir, cropData, options);
      
      // Step 5: Reconstruct video from cropped frames
      await this.reconstructVideoFromFrames(croppedFramesDir, inputPath, outputPath, options);
      
      // Cleanup
      this.cleanupTempDirectories([framesDir, croppedFramesDir]);
      
      const processingTime = Date.now() - startTime;
      const averageConfidence = frameFocusData.reduce((sum, f) => sum + f.confidence, 0) / frameFocusData.length;
      
      this.log(`Frame-by-frame processing completed in ${processingTime}ms`);
      
      return {
        success: true,
        outputPath,
        totalFrames: frameFocusData.length,
        processedFrames: frameFocusData.length,
        averageConfidence: Math.round(averageConfidence * 100) / 100,
        processingTime
      };
      
    } catch (error) {
      this.log(`Frame-by-frame processing failed: ${error}`);
      throw error;
    }
  }

  private async extractAllFrames(inputPath: string): Promise<string> {
    const framesDir = path.join(this.tempDir, `frames_${nanoid()}`);
    fs.mkdirSync(framesDir, { recursive: true });
    
    return new Promise((resolve, reject) => {
      this.log('Extracting all frames from video');
      
      const cmd = [
        'ffmpeg',
        '-i', inputPath,
        '-vf', 'fps=1', // Extract 1 frame per second for analysis
        path.join(framesDir, 'frame_%04d.jpg'),
        '-y'
      ];

      const process = spawn(cmd[0], cmd.slice(1));
      
      process.on('close', (code) => {
        if (code === 0) {
          const frameCount = fs.readdirSync(framesDir).length;
          this.log(`Extracted ${frameCount} frames for analysis`);
          resolve(framesDir);
        } else {
          reject(new Error(`Frame extraction failed: ${code}`));
        }
      });
    });
  }

  private async analyzeFrameFocus(framesDir: string): Promise<FrameFocusData[]> {
    const frameFiles = fs.readdirSync(framesDir)
      .filter(f => f.endsWith('.jpg'))
      .sort();
    
    this.log(`Analyzing focus in ${frameFiles.length} frames`);
    
    const frameFocusData: FrameFocusData[] = [];
    
    for (let i = 0; i < frameFiles.length; i++) {
      const frameFile = frameFiles[i];
      const framePath = path.join(framesDir, frameFile);
      
      try {
        const focusData = await this.analyzeFrameWithGemini(framePath, i);
        frameFocusData.push(focusData);
        
        if (i % 10 === 0) {
          this.log(`Analyzed ${i + 1}/${frameFiles.length} frames`);
        }
      } catch (error) {
        this.log(`Frame ${i} analysis failed: ${error}`);
        // Use fallback focus detection
        frameFocusData.push(this.getFallbackFrameFocus(i));
      }
    }
    
    return frameFocusData;
  }

  private async analyzeFrameWithGemini(
    framePath: string,
    frameNumber: number
  ): Promise<FrameFocusData> {
    const model = this.ai.getGenerativeModel({ model: 'gemini-1.5-flash' });
    
    const imageBytes = fs.readFileSync(framePath);
    const imageBase64 = imageBytes.toString('base64');
    
    const prompt = `Analyze this video frame for focus tracking. Identify the main focal point and all important objects.

REQUIRED: Detect camera focus using computer vision principles:
1. Identify the sharpest/most in-focus area of the frame
2. Detect all people, faces, text, and important objects
3. Determine the primary focus center point
4. Calculate bounding boxes for all detected elements

Respond with JSON:
{
  "focusCenter": {"x": 0.0-1.0, "y": 0.0-1.0},
  "focusRegion": {"x": 0.0-1.0, "y": 0.0-1.0, "width": 0.0-1.0, "height": 0.0-1.0},
  "confidence": 0.0-1.0,
  "detectedObjects": [
    {
      "type": "person|face|text|object",
      "bbox": {"x": 0.0-1.0, "y": 0.0-1.0, "width": 0.0-1.0, "height": 0.0-1.0},
      "confidence": 0.0-1.0
    }
  ]
}`;

    try {
      const result = await model.generateContent([
        {
          inlineData: {
            data: imageBase64,
            mimeType: 'image/jpeg'
          }
        },
        prompt
      ]);
      
      const response = result.response.text() || '';
      const jsonMatch = response.match(/\{[\s\S]*\}/);
      
      if (jsonMatch) {
        const data = JSON.parse(jsonMatch[0]);
        return {
          frameNumber,
          timestamp: frameNumber, // Assuming 1fps extraction
          focusCenter: data.focusCenter,
          focusRegion: data.focusRegion,
          confidence: data.confidence,
          detectedObjects: data.detectedObjects || []
        };
      } else {
        throw new Error('No valid JSON response');
      }
    } catch (error) {
      this.log(`Gemini analysis failed for frame ${frameNumber}: ${error}`);
      return this.getFallbackFrameFocus(frameNumber);
    }
  }

  private getFallbackFrameFocus(frameNumber: number): FrameFocusData {
    // Mathematical fallback focus detection (center-weighted)
    return {
      frameNumber,
      timestamp: frameNumber,
      focusCenter: { x: 0.5, y: 0.4 }, // Slightly above center for faces
      focusRegion: { x: 0.2, y: 0.1, width: 0.6, height: 0.8 },
      confidence: 0.6,
      detectedObjects: []
    };
  }

  private calculateFrameCrops(
    frameFocusData: FrameFocusData[],
    options: FrameTrackingOptions
  ): Array<{ x: number; y: number; width: number; height: number }> {
    const targetAspectRatio = this.getAspectRatioValue(options.targetAspectRatio);
    
    return frameFocusData.map(frameData => {
      const focus = frameData.focusRegion;
      
      // Calculate crop dimensions based on target aspect ratio
      let cropWidth = focus.width;
      let cropHeight = focus.height;
      
      const currentRatio = cropWidth / cropHeight;
      
      if (currentRatio > targetAspectRatio) {
        // Too wide, adjust height
        cropHeight = cropWidth / targetAspectRatio;
      } else {
        // Too tall, adjust width
        cropWidth = cropHeight * targetAspectRatio;
      }
      
      // Ensure crop area fits within frame bounds
      cropWidth = Math.min(cropWidth, 1.0);
      cropHeight = Math.min(cropHeight, 1.0);
      
      // Center crop around focus point
      let cropX = frameData.focusCenter.x - cropWidth / 2;
      let cropY = frameData.focusCenter.y - cropHeight / 2;
      
      // Clamp to frame boundaries
      cropX = Math.max(0, Math.min(1 - cropWidth, cropX));
      cropY = Math.max(0, Math.min(1 - cropHeight, cropY));
      
      return { x: cropX, y: cropY, width: cropWidth, height: cropHeight };
    });
  }

  private getAspectRatioValue(aspectRatio: string): number {
    switch (aspectRatio) {
      case '9:16': return 9 / 16;
      case '16:9': return 16 / 9;
      case '4:3': return 4 / 3;
      case '1:1': return 1;
      default: return 16 / 9;
    }
  }

  private async cropFramesIndividually(
    framesDir: string,
    cropData: Array<{ x: number; y: number; width: number; height: number }>,
    options: FrameTrackingOptions
  ): Promise<string> {
    const croppedFramesDir = path.join(this.tempDir, `cropped_${nanoid()}`);
    fs.mkdirSync(croppedFramesDir, { recursive: true });
    
    const frameFiles = fs.readdirSync(framesDir)
      .filter(f => f.endsWith('.jpg'))
      .sort();
    
    this.log(`Cropping ${frameFiles.length} frames individually`);
    
    const cropPromises = frameFiles.map(async (frameFile, index) => {
      const inputFrame = path.join(framesDir, frameFile);
      const outputFrame = path.join(croppedFramesDir, frameFile);
      const crop = cropData[index];
      
      if (!crop) return;
      
      return new Promise<void>((resolve, reject) => {
        // Use FFmpeg to crop this specific frame
        const cropFilter = `crop=iw*${crop.width}:ih*${crop.height}:iw*${crop.x}:ih*${crop.y}`;
        const scaleFilter = this.getTargetScaleFilter(options.targetAspectRatio);
        
        const cmd = [
          'ffmpeg',
          '-i', inputFrame,
          '-vf', `${cropFilter},${scaleFilter}`,
          '-q:v', '2', // High quality
          '-y',
          outputFrame
        ];

        const process = spawn(cmd[0], cmd.slice(1));
        
        process.on('close', (code) => {
          if (code === 0) {
            resolve();
          } else {
            reject(new Error(`Frame crop failed for ${frameFile}: ${code}`));
          }
        });
      });
    });
    
    await Promise.all(cropPromises);
    this.log(`Completed individual frame cropping`);
    
    return croppedFramesDir;
  }

  private getTargetScaleFilter(aspectRatio: string): string {
    switch (aspectRatio) {
      case '9:16':
        return 'scale=720:1280:force_original_aspect_ratio=increase,crop=720:1280:(ow-720)/2:(oh-1280)/2';
      case '1:1':
        return 'scale=720:720:force_original_aspect_ratio=increase,crop=720:720:(ow-720)/2:(oh-720)/2';
      case '4:3':
        return 'scale=960:720:force_original_aspect_ratio=increase,crop=960:720:(ow-960)/2:(oh-720)/2';
      default: // 16:9
        return 'scale=1280:720:force_original_aspect_ratio=increase,crop=1280:720:(ow-1280)/2:(oh-720)/2';
    }
  }

  private async reconstructVideoFromFrames(
    croppedFramesDir: string,
    originalVideoPath: string,
    outputPath: string,
    options: FrameTrackingOptions
  ): Promise<void> {
    return new Promise((resolve, reject) => {
      this.log('Reconstructing video from cropped frames');
      
      // Get original audio for synchronization
      const framePattern = path.join(croppedFramesDir, 'frame_%04d.jpg');
      
      const cmd = [
        'ffmpeg',
        '-framerate', '1', // Match extraction rate
        '-i', framePattern,
        '-i', originalVideoPath,
        '-c:v', 'libx264',
        '-preset', options.quality === 'high' ? 'slow' : 'medium',
        '-crf', options.quality === 'high' ? '18' : '23',
        '-c:a', 'aac',
        '-map', '0:v:0',
        '-map', '1:a:0',
        '-shortest',
        '-y',
        outputPath
      ];

      const process = spawn(cmd[0], cmd.slice(1));
      
      process.on('close', (code) => {
        if (code === 0) {
          this.log('Video reconstruction completed');
          resolve();
        } else {
          reject(new Error(`Video reconstruction failed: ${code}`));
        }
      });
    });
  }

  private cleanupTempDirectories(dirs: string[]): void {
    for (const dir of dirs) {
      if (fs.existsSync(dir)) {
        fs.rmSync(dir, { recursive: true, force: true });
      }
    }
  }
}

export const createFrameByFrameTracker = (apiKey: string): FrameByFrameTracker => {
  return new FrameByFrameTracker(apiKey);
};