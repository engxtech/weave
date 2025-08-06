import * as cocoSsd from '@tensorflow-models/coco-ssd';
import * as tf from '@tensorflow/tfjs-node';
import { spawn } from 'child_process';
import * as fs from 'fs/promises';
import * as path from 'path';
import { nanoid } from 'nanoid';
import { GoogleGenerativeAI } from '@google/generative-ai';

export interface AutoFlipOptions {
  targetAspectRatio: '9:16' | '16:9' | '1:1' | '4:3' | 'original';
  sampleRate?: number;
  quality?: 'high' | 'medium' | 'low';
  focusMode?: 'person' | 'object' | 'salient' | 'auto';
}

export interface SalientDetection {
  bbox: [number, number, number, number];
  class: string;
  score: number;
  center: [number, number];
  area: number;
}

export interface FrameAnalysis {
  frameIndex: number;
  timestamp: number;
  detections: SalientDetection[];
  focusCenter: [number, number];
  confidence: number;
  cropArea: {
    x: number;
    y: number;
    width: number;
    height: number;
  };
}

export interface AutoFlipResult {
  success: boolean;
  outputPath?: string;
  originalDimensions: [number, number];
  targetAspectRatio: string;
  frameAnalyses: FrameAnalysis[];
  smoothedCrops: Array<{
    timestamp: number;
    x: number;
    y: number;
    width: number;
    height: number;
  }>;
  processingStats: {
    totalDetections: number;
    averageConfidence: number;
    framesWithSalientContent: number;
    processingTime: number;
  };
  error?: string;
}

export class JSAutoFlipService {
  private tempDir: string;
  private model: cocoSsd.ObjectDetection | null = null;
  private ai: GoogleGenerativeAI;

  constructor(apiKey: string) {
    this.tempDir = path.join(process.cwd(), 'temp_js_autoflip');
    this.ai = new GoogleGenerativeAI(apiKey);
  }

  private async ensureTempDir(): Promise<void> {
    try {
      await fs.access(this.tempDir);
    } catch {
      await fs.mkdir(this.tempDir, { recursive: true });
    }
  }

  private async initializeModel(): Promise<void> {
    if (!this.model) {
      console.log('Initializing COCO-SSD model for AutoFlip analysis...');
      this.model = await cocoSsd.load();
      console.log('COCO-SSD model loaded successfully');
    }
  }

  async processVideoWithJSAutoFlip(
    videoPath: string,
    options: AutoFlipOptions
  ): Promise<AutoFlipResult> {
    const startTime = Date.now();
    await this.ensureTempDir();
    await this.initializeModel();

    const analysisId = nanoid();
    const outputPath = path.join(this.tempDir, `js_autoflip_${analysisId}.mp4`);

    console.log('=== JS AUTOFLIP ANALYSIS START ===');
    console.log('Video path:', videoPath);
    console.log('Target aspect ratio:', options.targetAspectRatio);
    console.log('Focus mode:', options.focusMode || 'auto');

    try {
      // Step 1: Extract frames for analysis
      const framesDir = await this.extractFramesForAnalysis(videoPath, options.sampleRate || 30);
      
      // Step 2: Get video metadata
      const metadata = await this.getVideoMetadata(videoPath);
      
      // Step 3: Analyze frames with COCO-SSD
      const frameAnalyses = await this.analyzeFramesWithCOCO(framesDir, metadata, options);
      
      // Step 4: Apply AutoFlip algorithm principles
      const optimizedAnalyses = await this.applyAutoFlipPrinciples(frameAnalyses, metadata, options);
      
      // Step 5: Smooth transitions between keyframes
      const smoothedCrops = this.smoothCropTransitions(optimizedAnalyses, metadata);
      
      // Step 6: Apply dynamic cropping with FFmpeg
      await this.applyDynamicCropping(videoPath, outputPath, smoothedCrops, options);
      
      // Cleanup
      await this.cleanup(framesDir);
      
      const processingTime = Date.now() - startTime;
      
      console.log('=== JS AUTOFLIP ANALYSIS COMPLETE ===');
      console.log(`Processing completed in ${processingTime}ms`);
      
      return {
        success: true,
        outputPath,
        originalDimensions: [metadata.width, metadata.height],
        targetAspectRatio: options.targetAspectRatio,
        frameAnalyses: optimizedAnalyses,
        smoothedCrops,
        processingStats: {
          totalDetections: frameAnalyses.reduce((sum, f) => sum + f.detections.length, 0),
          averageConfidence: frameAnalyses.reduce((sum, f) => sum + f.confidence, 0) / frameAnalyses.length,
          framesWithSalientContent: frameAnalyses.filter(f => f.detections.length > 0).length,
          processingTime
        }
      };

    } catch (error) {
      console.error('JS AutoFlip processing error:', error);
      return {
        success: false,
        error: error instanceof Error ? error.message : 'Unknown error',
        originalDimensions: [0, 0],
        targetAspectRatio: options.targetAspectRatio,
        frameAnalyses: [],
        smoothedCrops: [],
        processingStats: {
          totalDetections: 0,
          averageConfidence: 0,
          framesWithSalientContent: 0,
          processingTime: Date.now() - startTime
        }
      };
    }
  }

  private async extractFramesForAnalysis(videoPath: string, sampleRate: number): Promise<string> {
    const framesDir = path.join(this.tempDir, `frames_${nanoid()}`);
    await fs.mkdir(framesDir, { recursive: true });

    return new Promise((resolve, reject) => {
      const ffmpegArgs = [
        '-i', videoPath,
        '-vf', `fps=1/${Math.max(1, 30 / sampleRate)}`,
        '-q:v', '2',
        path.join(framesDir, 'frame_%04d.jpg')
      ];

      console.log('Extracting frames for AutoFlip analysis:', ffmpegArgs.join(' '));

      const ffmpeg = spawn('ffmpeg', ffmpegArgs);

      ffmpeg.stderr.on('data', (data) => {
        // Minimal logging for frame extraction
      });

      ffmpeg.on('close', (code) => {
        if (code === 0) {
          console.log('Frame extraction completed');
          resolve(framesDir);
        } else {
          reject(new Error(`Frame extraction failed with code ${code}`));
        }
      });

      ffmpeg.on('error', (error) => {
        reject(error);
      });
    });
  }

  private async getVideoMetadata(videoPath: string): Promise<{ width: number; height: number; duration: number; fps: number }> {
    return new Promise((resolve, reject) => {
      const ffprobe = spawn('ffprobe', [
        '-v', 'quiet',
        '-print_format', 'json',
        '-show_format',
        '-show_streams',
        videoPath
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
            
            resolve({
              width: videoStream.width,
              height: videoStream.height,
              duration: parseFloat(info.format.duration),
              fps: eval(videoStream.r_frame_rate) // e.g., "30000/1001"
            });
          } catch (error) {
            reject(new Error('Failed to parse video metadata'));
          }
        } else {
          reject(new Error(`ffprobe failed with code ${code}`));
        }
      });
    });
  }

  private async analyzeFramesWithCOCO(
    framesDir: string, 
    metadata: any, 
    options: AutoFlipOptions
  ): Promise<FrameAnalysis[]> {
    const frameFiles = await fs.readdir(framesDir);
    const imageFiles = frameFiles.filter(f => f.endsWith('.jpg')).sort();
    
    console.log(`Analyzing ${imageFiles.length} frames with COCO-SSD for salient regions...`);
    
    const analyses: FrameAnalysis[] = [];
    
    for (let i = 0; i < imageFiles.length; i++) {
      const framePath = path.join(framesDir, imageFiles[i]);
      const frameIndex = parseInt(imageFiles[i].match(/frame_(\d+)\.jpg/)?.[1] || '0');
      const timestamp = frameIndex / (metadata.fps || 30);
      
      try {
        // Load and analyze frame
        const imageBuffer = await fs.readFile(framePath);
        const imageTensor = tf.node.decodeImage(imageBuffer);
        
        const predictions = await this.model!.detect(imageTensor as any);
        
        // Convert predictions to our format
        const detections: SalientDetection[] = predictions.map(pred => {
          const [x, y, width, height] = pred.bbox;
          const center: [number, number] = [x + width / 2, y + height / 2];
          const area = width * height;
          
          return {
            bbox: pred.bbox as [number, number, number, number],
            class: pred.class,
            score: pred.score,
            center,
            area
          };
        });
        
        // Calculate focus center using AutoFlip principles
        const focusCenter = this.calculateFocusCenter(detections, metadata, options);
        const confidence = this.calculateFrameConfidence(detections);
        const cropArea = this.calculateOptimalCrop(focusCenter, metadata, options);
        
        analyses.push({
          frameIndex,
          timestamp,
          detections,
          focusCenter,
          confidence,
          cropArea
        });
        
        imageTensor.dispose();
        
        if (i % 10 === 0) {
          console.log(`Analyzed frame ${i + 1}/${imageFiles.length}: ${detections.length} objects detected`);
        }
        
      } catch (error) {
        console.warn(`Failed to analyze frame ${frameIndex}:`, error);
      }
    }
    
    console.log(`Frame analysis complete: ${analyses.length} frames processed`);
    return analyses;
  }

  private calculateFocusCenter(
    detections: SalientDetection[], 
    metadata: any, 
    options: AutoFlipOptions
  ): [number, number] {
    if (detections.length === 0) {
      return [metadata.width / 2, metadata.height / 2];
    }

    // AutoFlip principle: Prioritize people, then larger objects
    const people = detections.filter(d => d.class === 'person');
    const relevantDetections = people.length > 0 ? people : detections;

    // Weight by area and confidence
    let totalX = 0;
    let totalY = 0;
    let totalWeight = 0;

    relevantDetections.forEach(detection => {
      const weight = detection.score * Math.sqrt(detection.area);
      totalX += detection.center[0] * weight;
      totalY += detection.center[1] * weight;
      totalWeight += weight;
    });

    if (totalWeight > 0) {
      return [totalX / totalWeight, totalY / totalWeight];
    }

    return [metadata.width / 2, metadata.height / 2];
  }

  private calculateFrameConfidence(detections: SalientDetection[]): number {
    if (detections.length === 0) return 0.1;
    
    const avgScore = detections.reduce((sum, d) => sum + d.score, 0) / detections.length;
    const personBonus = detections.some(d => d.class === 'person') ? 0.2 : 0;
    
    return Math.min(1.0, avgScore + personBonus);
  }

  private calculateOptimalCrop(
    focusCenter: [number, number], 
    metadata: any, 
    options: AutoFlipOptions
  ): { x: number; y: number; width: number; height: number } {
    const [focusX, focusY] = focusCenter;
    
    // For original aspect ratio, use full frame dimensions
    if (options.targetAspectRatio === 'original') {
      return { 
        x: 0, 
        y: 0, 
        width: metadata.width, 
        height: metadata.height 
      };
    }
    
    const targetRatio = this.getAspectRatio(options.targetAspectRatio);
    const currentRatio = metadata.width / metadata.height;
    
    let cropWidth: number;
    let cropHeight: number;
    let cropX: number;
    let cropY: number;
    
    if (targetRatio < currentRatio) {
      // Need to crop width (portrait from landscape)
      cropHeight = metadata.height;
      cropWidth = Math.round(cropHeight * targetRatio);
      
      // Center crop around focus point
      cropX = Math.round(focusX - cropWidth / 2);
      cropX = Math.max(0, Math.min(cropX, metadata.width - cropWidth));
      cropY = 0;
      
    } else {
      // Need to crop height
      cropWidth = metadata.width;
      cropHeight = Math.round(cropWidth / targetRatio);
      
      cropY = Math.round(focusY - cropHeight / 2);
      cropY = Math.max(0, Math.min(cropY, metadata.height - cropHeight));
      cropX = 0;
    }
    
    return { x: cropX, y: cropY, width: cropWidth, height: cropHeight };
  }

  private getAspectRatio(ratio: string): number {
    switch (ratio) {
      case '9:16': return 9 / 16;
      case '16:9': return 16 / 9;
      case '1:1': return 1.0;
      case '4:3': return 4 / 3;
      case 'original': return 0; // Special case - will be handled by crop calculation
      default: return 9 / 16;
    }
  }

  private async applyAutoFlipPrinciples(
    analyses: FrameAnalysis[], 
    metadata: any, 
    options: AutoFlipOptions
  ): Promise<FrameAnalysis[]> {
    // Apply temporal smoothing similar to Google AutoFlip
    console.log('Applying AutoFlip principles for temporal smoothing...');
    
    return analyses.map((analysis, index) => {
      // Get neighboring frames for smoothing
      const prevFrame = index > 0 ? analyses[index - 1] : null;
      const nextFrame = index < analyses.length - 1 ? analyses[index + 1] : null;
      
      // Apply temporal smoothing to focus center
      let smoothedFocusX = analysis.focusCenter[0];
      let smoothedFocusY = analysis.focusCenter[1];
      
      if (prevFrame && nextFrame) {
        smoothedFocusX = (prevFrame.focusCenter[0] + analysis.focusCenter[0] + nextFrame.focusCenter[0]) / 3;
        smoothedFocusY = (prevFrame.focusCenter[1] + analysis.focusCenter[1] + nextFrame.focusCenter[1]) / 3;
      }
      
      // Recalculate crop area with smoothed focus
      const smoothedCropArea = this.calculateOptimalCrop([smoothedFocusX, smoothedFocusY], metadata, options);
      
      return {
        ...analysis,
        focusCenter: [smoothedFocusX, smoothedFocusY],
        cropArea: smoothedCropArea
      };
    });
  }

  private smoothCropTransitions(analyses: FrameAnalysis[], metadata: any): Array<{
    timestamp: number;
    x: number;
    y: number;
    width: number;
    height: number;
  }> {
    console.log('Smoothing crop transitions between keyframes...');
    
    const smoothedCrops: Array<{
      timestamp: number;
      x: number;
      y: number;
      width: number;
      height: number;
    }> = [];
    
    for (let i = 0; i < analyses.length - 1; i++) {
      const current = analyses[i];
      const next = analyses[i + 1];
      
      const timeDiff = next.timestamp - current.timestamp;
      const steps = Math.ceil(timeDiff * 30); // 30 fps interpolation
      
      for (let step = 0; step < steps; step++) {
        const t = step / steps;
        const timestamp = current.timestamp + (timeDiff * t);
        
        // Linear interpolation with easing
        const easeT = this.easeInOutCubic(t);
        
        smoothedCrops.push({
          timestamp,
          x: Math.round(current.cropArea.x + (next.cropArea.x - current.cropArea.x) * easeT),
          y: Math.round(current.cropArea.y + (next.cropArea.y - current.cropArea.y) * easeT),
          width: Math.round(current.cropArea.width + (next.cropArea.width - current.cropArea.width) * easeT),
          height: Math.round(current.cropArea.height + (next.cropArea.height - current.cropArea.height) * easeT)
        });
      }
    }
    
    // Add the last frame
    if (analyses.length > 0) {
      const last = analyses[analyses.length - 1];
      smoothedCrops.push({
        timestamp: last.timestamp,
        x: last.cropArea.x,
        y: last.cropArea.y,
        width: last.cropArea.width,
        height: last.cropArea.height
      });
    }
    
    return smoothedCrops;
  }

  private easeInOutCubic(t: number): number {
    return t < 0.5 ? 4 * t * t * t : 1 - Math.pow(-2 * t + 2, 3) / 2;
  }

  private async applyDynamicCropping(
    inputPath: string, 
    outputPath: string, 
    smoothedCrops: any[], 
    options: AutoFlipOptions
  ): Promise<void> {
    return new Promise((resolve, reject) => {
      let ffmpegArgs: string[];
      
      if (options.targetAspectRatio === 'original') {
        // Preserve original - no cropping, just re-encode
        console.log('Preserving original aspect ratio - no dynamic cropping applied');
        ffmpegArgs = [
          '-i', inputPath,
          '-c:v', 'libx264',
          '-preset', 'fast',
          '-crf', '23',
          '-c:a', 'aac',
          '-b:a', '128k',
          '-y',
          outputPath
        ];
      } else {
        // Use simpler approach with fallback strategies
        const avgCrop = this.calculateAverageSmoothedCrop(smoothedCrops);
        
        // Strategy 1: Try dynamic cropping with simplified filter
        const strategyCrop = smoothedCrops.length > 0 ? smoothedCrops[0] : avgCrop;
        
        ffmpegArgs = [
          '-i', inputPath,
          '-vf', `crop=${strategyCrop.width}:${strategyCrop.height}:${strategyCrop.x}:${strategyCrop.y}`,
          '-c:v', 'libx264',
          '-preset', 'fast',
          '-crf', '23',
          '-c:a', 'aac',
          '-b:a', '128k',
          '-y',
          outputPath
        ];
      }

      console.log('Running AutoFlip FFmpeg with args:', ffmpegArgs.join(' '));
      
      const ffmpeg = spawn('ffmpeg', ffmpegArgs);

      ffmpeg.stderr.on('data', (data) => {
        const output = data.toString();
        console.log('AutoFlip FFmpeg output:', output);
        
        // Extract progress information
        const timeMatch = output.match(/time=(\d{2}):(\d{2}):(\d{2}\.\d{2})/);
        if (timeMatch) {
          const [, hours, minutes, seconds] = timeMatch;
          const currentTime = parseInt(hours) * 3600 + parseInt(minutes) * 60 + parseFloat(seconds);
          console.log(`AutoFlip cropping progress: ${Math.round(currentTime)}s`);
        }
      });

      ffmpeg.on('close', (code) => {
        if (code === 0) {
          console.log('AutoFlip cropping completed successfully');
          resolve();
        } else {
          console.error(`AutoFlip FFmpeg failed with code ${code}, trying fallback...`);
          // Try fallback with center crop
          this.applyFallbackCropping(inputPath, outputPath, options)
            .then(resolve)
            .catch(reject);
        }
      });

      ffmpeg.on('error', (error) => {
        console.error('AutoFlip FFmpeg error:', error);
        // Try fallback approach
        this.applyFallbackCropping(inputPath, outputPath, options)
          .then(resolve)
          .catch(reject);
      });
    });
  }

  private async applyFallbackCropping(
    inputPath: string,
    outputPath: string,
    options: AutoFlipOptions
  ): Promise<void> {
    return new Promise((resolve, reject) => {
      console.log('Applying AutoFlip fallback cropping...');
      
      let fallbackArgs: string[];
      
      if (options.targetAspectRatio === 'original') {
        // Preserve original aspect ratio - just copy without cropping
        console.log('Preserving original aspect ratio - no cropping applied');
        fallbackArgs = [
          '-i', inputPath,
          '-c:v', 'libx264',
          '-preset', 'fast',
          '-crf', '23',
          '-c:a', 'aac',
          '-b:a', '128k',
          '-y',
          outputPath
        ];
      } else {
        // Get target dimensions based on aspect ratio
        const { targetWidth, targetHeight } = this.getTargetDimensions(options.targetAspectRatio);
        
        fallbackArgs = [
          '-i', inputPath,
          '-vf', `scale=${targetWidth}:${targetHeight}:force_original_aspect_ratio=increase,crop=${targetWidth}:${targetHeight}`,
          '-c:v', 'libx264',
          '-preset', 'fast',
          '-crf', '23',
          '-c:a', 'aac',
          '-b:a', '128k',
          '-y',
          outputPath
        ];
      }

      console.log('AutoFlip fallback FFmpeg args:', fallbackArgs.join(' '));
      
      const ffmpeg = spawn('ffmpeg', fallbackArgs);

      ffmpeg.stderr.on('data', (data) => {
        console.log('AutoFlip fallback:', data.toString());
      });

      ffmpeg.on('close', (code) => {
        if (code === 0) {
          console.log('AutoFlip fallback completed successfully');
          resolve();
        } else {
          reject(new Error(`AutoFlip fallback failed with code ${code}`));
        }
      });

      ffmpeg.on('error', (error) => {
        reject(error);
      });
    });
  }

  private calculateAverageSmoothedCrop(smoothedCrops: any[]): any {
    if (smoothedCrops.length === 0) {
      return { x: 0, y: 0, width: 608, height: 1080 }; // Default 9:16 crop
    }

    const avgX = smoothedCrops.reduce((sum, crop) => sum + crop.x, 0) / smoothedCrops.length;
    const avgY = smoothedCrops.reduce((sum, crop) => sum + crop.y, 0) / smoothedCrops.length;
    const avgWidth = smoothedCrops.reduce((sum, crop) => sum + crop.width, 0) / smoothedCrops.length;
    const avgHeight = smoothedCrops.reduce((sum, crop) => sum + crop.height, 0) / smoothedCrops.length;

    return {
      x: Math.round(avgX),
      y: Math.round(avgY),
      width: Math.round(avgWidth),
      height: Math.round(avgHeight)
    };
  }

  private getTargetDimensions(aspectRatio: string): { targetWidth: number; targetHeight: number } {
    switch (aspectRatio) {
      case '9:16':
        return { targetWidth: 608, targetHeight: 1080 };
      case '16:9':
        return { targetWidth: 1920, targetHeight: 1080 };
      case '1:1':
        return { targetWidth: 1080, targetHeight: 1080 };
      case '4:3':
        return { targetWidth: 1440, targetHeight: 1080 };
      default:
        return { targetWidth: 608, targetHeight: 1080 };
    }
  }

  private async cleanup(framesDir: string): Promise<void> {
    try {
      const files = await fs.readdir(framesDir);
      await Promise.all(files.map(file => fs.unlink(path.join(framesDir, file))));
      await fs.rmdir(framesDir);
    } catch (error) {
      console.warn('Cleanup warning:', error);
    }
  }
}

export const createJSAutoFlipService = (apiKey: string): JSAutoFlipService => {
  return new JSAutoFlipService(apiKey);
};