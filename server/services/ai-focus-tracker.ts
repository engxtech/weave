import { GoogleGenerativeAI } from '@google/generative-ai';
import { spawn } from 'child_process';
import path from 'path';
import fs from 'fs';
import { nanoid } from 'nanoid';

export interface AIFocusTrackingOptions {
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

export interface AIFrameAnalysis {
  timestamp: number;
  frameNumber: number;
  focusAreas: Array<{
    type: 'person' | 'object' | 'text' | 'face';
    bbox: { x: number; y: number; width: number; height: number };
    confidence: number;
    description: string;
    importance: number;
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
  suggestedCropArea: {
    x: number;
    y: number;
    width: number;
    height: number;
  };
}

export interface AIVideoFocusAnalysis {
  videoInfo: {
    width: number;
    height: number;
    duration: number;
    fps: number;
    totalFrames: number;
  };
  frameAnalyses: AIFrameAnalysis[];
  dynamicCropPath: Array<{
    timestamp: number;
    cropArea: { x: number; y: number; width: number; height: number };
    confidence: number;
  }>;
  intelligentCropFilter: string;
}

export class AIFocusTracker {
  private ai: GoogleGenerativeAI;
  private tempDir: string;

  constructor(apiKey: string) {
    this.ai = new GoogleGenerativeAI(apiKey);
    this.tempDir = path.join(process.cwd(), 'temp_ai_focus_tracking');
    this.ensureTempDir();
  }

  private ensureTempDir() {
    if (!fs.existsSync(this.tempDir)) {
      fs.mkdirSync(this.tempDir, { recursive: true });
    }
  }

  async analyzeVideoWithAI(
    inputPath: string,
    options: AIFocusTrackingOptions,
    progressCallback?: (progress: number) => void
  ): Promise<AIVideoFocusAnalysis> {
    console.log('Starting AI-powered focus analysis with Gemini Vision...');
    
    if (progressCallback) progressCallback(5);

    // Get video metadata
    const videoInfo = await this.getVideoInfo(inputPath);
    console.log('Video info:', videoInfo);
    
    if (progressCallback) progressCallback(10);

    // Extract key frames for AI analysis (every 1 second for better accuracy)
    const frameDir = path.join(this.tempDir, `ai_frames_${nanoid()}`);
    fs.mkdirSync(frameDir, { recursive: true });
    
    try {
      await this.extractKeyFrames(inputPath, frameDir, videoInfo);
      if (progressCallback) progressCallback(25);

      // Analyze each frame with Gemini Vision API
      const frameAnalyses = await this.analyzeFramesWithGemini(frameDir, videoInfo, options, progressCallback);
      if (progressCallback) progressCallback(75);

      // Generate intelligent dynamic crop path
      const dynamicCropPath = this.calculateAIBasedCropPath(frameAnalyses, videoInfo, options);
      if (progressCallback) progressCallback(90);

      // Create intelligent crop filter
      const intelligentCropFilter = this.generateIntelligentCropFilter(dynamicCropPath, options);
      if (progressCallback) progressCallback(100);

      return {
        videoInfo,
        frameAnalyses,
        dynamicCropPath,
        intelligentCropFilter
      };
    } finally {
      // Cleanup extracted frames
      if (fs.existsSync(frameDir)) {
        fs.rmSync(frameDir, { recursive: true, force: true });
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

  private async extractKeyFrames(
    inputPath: string,
    outputDir: string,
    videoInfo: { fps: number; duration: number }
  ): Promise<void> {
    console.log('Extracting key frames for AI analysis...');
    
    return new Promise((resolve, reject) => {
      // Extract frame every 1 second for better accuracy
      const frameRate = 1; // 1 frame every 1 second
      
      const ffmpeg = spawn('ffmpeg', [
        '-i', inputPath,
        '-vf', `fps=${frameRate},scale=1280:720`, // Good resolution for AI analysis
        '-q:v', '2', // High quality for AI
        path.join(outputDir, 'frame_%05d.jpg'),
        '-y'
      ]);

      ffmpeg.on('close', (code) => {
        if (code === 0) {
          console.log('Key frame extraction completed');
          resolve();
        } else {
          reject(new Error(`Frame extraction failed with code ${code}`));
        }
      });

      ffmpeg.on('error', reject);
    });
  }

  private async analyzeFramesWithGemini(
    frameDir: string,
    videoInfo: any,
    options: AIFocusTrackingOptions,
    progressCallback?: (progress: number) => void
  ): Promise<AIFrameAnalysis[]> {
    const frameFiles = fs.readdirSync(frameDir)
      .filter(f => f.endsWith('.jpg'))
      .sort();

    console.log(`Analyzing ${frameFiles.length} frames with Gemini Vision API...`);
    
    const frameAnalyses: AIFrameAnalysis[] = [];
    const progressStep = 50 / frameFiles.length; // 50% progress range for this step
    
    for (let i = 0; i < frameFiles.length; i++) {
      const frameFile = frameFiles[i];
      const framePath = path.join(frameDir, frameFile);
      const timestamp = i * 1; // 1 second intervals for better accuracy
      
      try {
        console.log(`Analyzing frame ${i + 1}/${frameFiles.length} with Gemini...`);
        const analysis = await this.analyzeFrameWithGemini(framePath, timestamp, i, options);
        frameAnalyses.push(analysis);
        
        if (progressCallback && i % 3 === 0) {
          progressCallback(25 + (i * progressStep));
        }
      } catch (error) {
        console.error(`Failed to analyze frame ${frameFile} with Gemini:`, error);
        // Add fallback analysis
        frameAnalyses.push(this.getFallbackAnalysis(timestamp, i, videoInfo));
      }
    }

    return frameAnalyses;
  }

  private async analyzeFrameWithGemini(
    framePath: string,
    timestamp: number,
    frameNumber: number,
    options: AIFocusTrackingOptions
  ): Promise<AIFrameAnalysis> {
    const model = this.ai.getGenerativeModel({ model: 'gemini-1.5-flash' });
    
    // Read frame image
    const imageData = fs.readFileSync(framePath);
    const base64Image = imageData.toString('base64');
    
    const prompt = `Analyze this video frame for focus tracking and intelligent cropping. 

TASK: Identify where the camera's natural focus is and what should be the primary subject for cropping.

Please analyze:
1. People in the frame - detect faces, bodies, and their positions
2. Primary focus area - where is the camera/viewer attention naturally drawn
3. Important objects or text that should remain visible
4. Scene composition and suggested crop area for ${options.targetAspectRatio} aspect ratio

Tracking priority: ${options.personTracking.priority}
Zoom level: ${options.personTracking.zoomLevel}

Respond in JSON format:
{
  "focusAreas": [
    {
      "type": "person|object|text|face",
      "bbox": {"x": number, "y": number, "width": number, "height": number},
      "confidence": number,
      "description": "what this is",
      "importance": number
    }
  ],
  "primaryFocus": {
    "x": number,
    "y": number, 
    "width": number,
    "height": number,
    "confidence": number,
    "reason": "why this is the primary focus"
  },
  "sceneDescription": "brief description of the scene",
  "suggestedCropArea": {
    "x": number,
    "y": number,
    "width": number, 
    "height": number
  }
}

All coordinates should be in pixels relative to the 1280x720 frame.`;

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
      console.log(`Gemini analysis for frame ${frameNumber}:`, responseText.substring(0, 200) + '...');
      
      // Parse JSON response
      const jsonMatch = responseText.match(/\{[\s\S]*\}/);
      if (jsonMatch) {
        const analysis = JSON.parse(jsonMatch[0]);
        
        return {
          timestamp,
          frameNumber,
          focusAreas: analysis.focusAreas || [],
          primaryFocus: analysis.primaryFocus || {
            x: 320, y: 180, width: 640, height: 360,
            confidence: 0.5, reason: 'Default center focus'
          },
          sceneDescription: analysis.sceneDescription || 'Scene analysis',
          suggestedCropArea: analysis.suggestedCropArea || {
            x: 240, y: 0, width: 800, height: 720
          }
        };
      } else {
        throw new Error('No valid JSON found in Gemini response');
      }
    } catch (error) {
      console.error('Gemini analysis error:', error);
      return this.getFallbackAnalysis(timestamp, frameNumber, { width: 1280, height: 720 });
    }
  }

  private getFallbackAnalysis(timestamp: number, frameNumber: number, videoInfo: any): AIFrameAnalysis {
    return {
      timestamp,
      frameNumber,
      focusAreas: [{
        type: 'person',
        bbox: { x: 480, y: 200, width: 320, height: 400 },
        confidence: 0.6,
        description: 'Estimated person position',
        importance: 0.8
      }],
      primaryFocus: {
        x: 480, y: 200, width: 320, height: 400,
        confidence: 0.6, reason: 'Fallback center-right focus'
      },
      sceneDescription: 'Fallback analysis',
      suggestedCropArea: { x: 240, y: 0, width: 800, height: 720 }
    };
  }

  private calculateAIBasedCropPath(
    frameAnalyses: AIFrameAnalysis[],
    videoInfo: any,
    options: AIFocusTrackingOptions
  ): Array<{ timestamp: number; cropArea: { x: number; y: number; width: number; height: number }; confidence: number }> {
    console.log('Calculating AI-based dynamic crop path...');
    
    const targetAspectRatio = this.getAspectRatioValue(options.targetAspectRatio);
    const scaleFactorX = videoInfo.width / 1280; // Scale from analysis frame to original
    const scaleFactorY = videoInfo.height / 720;
    
    const cropPath = frameAnalyses.map(analysis => {
      // Use AI-detected primary focus area
      const focus = analysis.primaryFocus;
      
      // Scale to original video dimensions
      const scaledFocusX = focus.x * scaleFactorX;
      const scaledFocusY = focus.y * scaleFactorY;
      const scaledFocusWidth = focus.width * scaleFactorX;
      const scaledFocusHeight = focus.height * scaleFactorY;
      
      // Calculate crop area based on target aspect ratio and AI focus
      let cropWidth, cropHeight, cropX, cropY;
      
      if (targetAspectRatio < (videoInfo.width / videoInfo.height)) {
        // Cropping width (landscape to portrait)
        cropHeight = videoInfo.height;
        cropWidth = cropHeight * targetAspectRatio;
        
        // Center crop around AI-detected focus area
        const focusCenterX = scaledFocusX + scaledFocusWidth / 2;
        cropX = Math.max(0, Math.min(videoInfo.width - cropWidth, focusCenterX - cropWidth / 2));
        cropY = 0;
      } else {
        // Cropping height (portrait to landscape)
        cropWidth = videoInfo.width;
        cropHeight = cropWidth / targetAspectRatio;
        
        const focusCenterY = scaledFocusY + scaledFocusHeight / 2;
        cropX = 0;
        cropY = Math.max(0, Math.min(videoInfo.height - cropHeight, focusCenterY - cropHeight / 2));
      }
      
      return {
        timestamp: analysis.timestamp,
        cropArea: {
          x: Math.round(cropX),
          y: Math.round(cropY),
          width: Math.round(cropWidth),
          height: Math.round(cropHeight)
        },
        confidence: focus.confidence
      };
    });
    
    console.log(`Generated ${cropPath.length} AI-based crop positions`);
    return cropPath;
  }

  private generateIntelligentCropFilter(
    cropPath: Array<{ timestamp: number; cropArea: any; confidence: number }>,
    options: AIFocusTrackingOptions
  ): string {
    if (cropPath.length === 0) {
      return this.getDefaultCropFilter(options.targetAspectRatio);
    }

    // Apply smoothing based on user preference
    const smoothingFactor = options.personTracking.smoothing / 100;
    const smoothedPath = this.applySmoothingToCropPath(cropPath, smoothingFactor);
    
    // Weight by confidence scores
    const weightedCrop = this.calculateConfidenceWeightedCrop(smoothedPath);
    
    console.log('AI-generated intelligent crop filter:', weightedCrop);
    return `crop=${weightedCrop.width}:${weightedCrop.height}:${weightedCrop.x}:${weightedCrop.y}`;
  }

  private applySmoothingToCropPath(
    cropPath: Array<{ timestamp: number; cropArea: any; confidence: number }>,
    smoothingFactor: number
  ): Array<{ timestamp: number; cropArea: any; confidence: number }> {
    if (smoothingFactor === 0 || cropPath.length <= 1) {
      return cropPath;
    }
    
    const smoothed = [...cropPath];
    const windowSize = Math.max(1, Math.floor(smoothingFactor * 3));
    
    for (let i = windowSize; i < smoothed.length - windowSize; i++) {
      let totalWeight = 0;
      let weightedX = 0, weightedY = 0, weightedWidth = 0, weightedHeight = 0;
      
      for (let j = i - windowSize; j <= i + windowSize; j++) {
        const weight = cropPath[j].confidence;
        totalWeight += weight;
        weightedX += cropPath[j].cropArea.x * weight;
        weightedY += cropPath[j].cropArea.y * weight;
        weightedWidth += cropPath[j].cropArea.width * weight;
        weightedHeight += cropPath[j].cropArea.height * weight;
      }
      
      smoothed[i].cropArea = {
        x: Math.round(weightedX / totalWeight),
        y: Math.round(weightedY / totalWeight),
        width: Math.round(weightedWidth / totalWeight),
        height: Math.round(weightedHeight / totalWeight)
      };
    }
    
    return smoothed;
  }

  private calculateConfidenceWeightedCrop(
    cropPath: Array<{ timestamp: number; cropArea: any; confidence: number }>
  ): { x: number; y: number; width: number; height: number } {
    let totalWeight = 0;
    let weightedX = 0, weightedY = 0, weightedWidth = 0, weightedHeight = 0;
    
    cropPath.forEach(item => {
      const weight = item.confidence;
      totalWeight += weight;
      weightedX += item.cropArea.x * weight;
      weightedY += item.cropArea.y * weight;
      weightedWidth += item.cropArea.width * weight;
      weightedHeight += item.cropArea.height * weight;
    });
    
    return {
      x: Math.round(weightedX / totalWeight),
      y: Math.round(weightedY / totalWeight),
      width: Math.round(weightedWidth / totalWeight),
      height: Math.round(weightedHeight / totalWeight)
    };
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

  private getDefaultCropFilter(aspectRatio: string): string {
    switch (aspectRatio) {
      case '9:16':
        return 'scale=1080:1920:force_original_aspect_ratio=increase,crop=1080:1920';
      case '1:1':
        return 'scale=1080:1080:force_original_aspect_ratio=increase,crop=1080:1080';
      case '4:3':
        return 'scale=1440:1080:force_original_aspect_ratio=increase,crop=1440:1080';
      case '16:9':
        return 'scale=1920:1080:force_original_aspect_ratio=increase,crop=1920:1080';
      default:
        return 'scale=1080:1920:force_original_aspect_ratio=increase,crop=1080:1920';
    }
  }
}

export const createAIFocusTracker = (apiKey: string): AIFocusTracker => {
  return new AIFocusTracker(apiKey);
};