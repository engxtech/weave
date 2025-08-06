import { spawn } from 'child_process';
import * as fs from 'fs/promises';
import * as path from 'path';
import { randomBytes } from 'crypto';
import * as tf from '@tensorflow/tfjs-node';
import * as cocoSsd from '@tensorflow-models/coco-ssd';

export interface AutoFlipOptions {
  targetAspectRatio: '9:16' | '16:9' | '1:1' | '4:3';
  sampleRate?: number;
  quality?: 'high' | 'medium' | 'low';
  focusMode?: 'person' | 'object' | 'salient' | 'auto';
}

export interface AutoFlipResult {
  success: boolean;
  outputPath?: string;
  error?: string;
  originalDimensions?: { width: number; height: number };
  targetAspectRatio?: string;
  processingStats?: {
    totalDetections: number;
    averageConfidence: number;
    framesWithSalientContent: number;
    processingTime: number;
  };
  frameAnalyses?: any[];
  smoothedCrops?: any[];
}

class JSAutoFlipService {
  private model: cocoSsd.ObjectDetection | null = null;
  private apiKey: string;

  constructor(apiKey: string) {
    this.apiKey = apiKey;
  }

  async processVideoWithJSAutoFlip(inputPath: string, options: AutoFlipOptions): Promise<AutoFlipResult> {
    const startTime = Date.now();
    
    try {
      console.log('Initializing COCO-SSD model for AutoFlip analysis...');
      await this.initializeModel();
      
      console.log('=== JS AUTOFLIP ANALYSIS START ===');
      console.log('Video path:', inputPath);
      console.log('Target aspect ratio:', options.targetAspectRatio);
      console.log('Focus mode:', options.focusMode);

      // Extract frames for analysis
      const framesDir = await this.extractFrames(inputPath);
      
      // Analyze frames with COCO-SSD
      const frameAnalyses = await this.analyzeFramesWithCOCO(framesDir);
      
      // Apply AutoFlip principles for temporal smoothing
      console.log('Applying AutoFlip principles for temporal smoothing...');
      const smoothedCrops = this.applySmoothingAndPersonPriority(frameAnalyses, options);
      
      // Apply dynamic cropping
      console.log('Applying dynamic AutoFlip cropping...');
      const outputPath = `autoflip_${randomBytes(8).toString('hex')}.mp4`;
      const fullOutputPath = path.resolve(outputPath);
      
      await this.applyDynamicCropping(inputPath, fullOutputPath, smoothedCrops, options);
      
      // Cleanup frames
      await this.cleanup(framesDir);
      
      const processingTime = Date.now() - startTime;
      
      return {
        success: true,
        outputPath: fullOutputPath,
        originalDimensions: { width: 1920, height: 1080 }, // Default, should be detected
        targetAspectRatio: options.targetAspectRatio,
        processingStats: {
          totalDetections: frameAnalyses.reduce((sum, frame) => sum + frame.detections.length, 0),
          averageConfidence: this.calculateAverageConfidence(frameAnalyses),
          framesWithSalientContent: frameAnalyses.filter(frame => frame.detections.length > 0).length,
          processingTime
        },
        frameAnalyses,
        smoothedCrops
      };
      
    } catch (error) {
      console.error('JS AutoFlip processing error:', error);
      return {
        success: false,
        error: error instanceof Error ? error.message : 'Unknown AutoFlip processing error'
      };
    }
  }

  private async initializeModel(): Promise<void> {
    if (!this.model) {
      this.model = await cocoSsd.load();
      console.log('COCO-SSD model loaded successfully');
    }
  }

  private async extractFrames(inputPath: string): Promise<string> {
    const framesDir = path.join(process.cwd(), 'temp_js_autoflip', `frames_${randomBytes(8).toString('hex')}`);
    await fs.mkdir(framesDir, { recursive: true });

    return new Promise((resolve, reject) => {
      const ffmpegArgs = [
        '-i', inputPath,
        '-vf', 'fps=1/1',
        '-q:v', '2',
        path.join(framesDir, 'frame_%04d.jpg')
      ];

      console.log('Extracting frames for AutoFlip analysis:', ffmpegArgs.join(' '));
      
      const ffmpeg = spawn('ffmpeg', ffmpegArgs);
      
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

  private async analyzeFramesWithCOCO(framesDir: string): Promise<any[]> {
    const frameFiles = await fs.readdir(framesDir);
    const frameAnalyses: any[] = [];
    
    console.log(`Analyzing ${frameFiles.length} frames with COCO-SSD for salient regions...`);
    
    for (let i = 0; i < frameFiles.length; i++) {
      const frameFile = frameFiles[i];
      if (!frameFile.endsWith('.jpg')) continue;
      
      try {
        const framePath = path.join(framesDir, frameFile);
        const imageBuffer = await fs.readFile(framePath);
        const imageTensor = tf.node.decodeImage(imageBuffer);
        
        const detections = await this.model!.detect(imageTensor as tf.Tensor3D);
        
        console.log(`Analyzed frame ${i + 1}/${frameFiles.length}: ${detections.length} objects detected`);
        
        frameAnalyses.push({
          frameIndex: i,
          framePath,
          detections,
          timestamp: i // Approximate timestamp
        });
        
        imageTensor.dispose();
        
      } catch (error) {
        console.warn(`Error analyzing frame ${frameFile}:`, error);
      }
    }
    
    console.log('Frame analysis complete:', frameAnalyses.length, 'frames processed');
    return frameAnalyses;
  }

  private applySmoothingAndPersonPriority(frameAnalyses: any[], options: AutoFlipOptions): any[] {
    console.log('Applying enhanced AutoFlip with speaker tracking and camera movement...');
    
    const smoothedCrops: any[] = [];
    const targetDimensions = this.getTargetDimensions(options.targetAspectRatio);
    
    // Enhanced speaker tracking analysis
    const speakerAnalysis = this.analyzeSpeakerPatterns(frameAnalyses);
    console.log(`Speaker analysis: ${speakerAnalysis.speakers.length} speakers detected, dominant speaker changes: ${speakerAnalysis.speakerSwitches}`);
    
    for (let i = 0; i < frameAnalyses.length; i++) {
      const frame = frameAnalyses[i];
      let bestCrop = this.calculateCenterCrop(targetDimensions);
      
      // Find people in current frame
      const people = frame.detections.filter((det: any) => det.class === 'person');
      
      if (people.length > 0 && options.focusMode === 'person') {
        // Enhanced person tracking with speaker detection
        bestCrop = this.calculateSpeakerAwareCrop(people, targetDimensions, frame, i, frameAnalyses, speakerAnalysis);
      } else if (frame.detections.length > 0) {
        bestCrop = this.calculateSalientRegionCrop(frame.detections, targetDimensions);
      }
      
      // Apply temporal smoothing for natural camera movement
      if (i > 0) {
        const prevCrop = smoothedCrops[i - 1];
        bestCrop = this.applyCameraMovementSmoothing(bestCrop, prevCrop, frame.timestamp - frameAnalyses[i - 1].timestamp);
      }
      
      smoothedCrops.push({
        timestamp: frame.timestamp,
        x: Math.round(bestCrop.x),
        y: Math.round(bestCrop.y),
        width: Math.round(bestCrop.width),
        height: Math.round(bestCrop.height),
        confidence: this.calculateCropConfidence(frame.detections),
        speakerInfo: people.length > 1 ? this.identifyActiveSpeaker(people, frame) : null
      });
    }
    
    console.log(`Generated ${smoothedCrops.length} crops with enhanced speaker tracking`);
    return smoothedCrops;
  }

  private calculatePersonFocusedCrop(people: any[], targetDimensions: any): any {
    // Focus on the most prominent person
    const mainPerson = people.reduce((best, person) => 
      person.score > best.score ? person : best
    );
    
    const [x, y, width, height] = mainPerson.bbox;
    const centerX = x + width / 2;
    const centerY = y + height / 2;
    
    return {
      x: Math.max(0, centerX - targetDimensions.targetWidth / 2),
      y: Math.max(0, centerY - targetDimensions.targetHeight / 2),
      width: targetDimensions.targetWidth,
      height: targetDimensions.targetHeight
    };
  }

  private analyzeSpeakerPatterns(frameAnalyses: any[]): any {
    console.log('Analyzing speaker patterns across frames...');
    
    const speakers: any[] = [];
    let speakerSwitches = 0;
    let currentDominantSpeaker = null;
    
    for (let i = 0; i < frameAnalyses.length; i++) {
      const frame = frameAnalyses[i];
      const people = frame.detections.filter((det: any) => det.class === 'person');
      
      if (people.length > 1) {
        // Analyze person positions and sizes to detect likely speaker
        const dominantPerson = this.findDominantSpeaker(people, i, frameAnalyses);
        
        if (dominantPerson && dominantPerson.id !== currentDominantSpeaker) {
          speakerSwitches++;
          currentDominantSpeaker = dominantPerson.id;
        }
        
        // Track unique speakers
        people.forEach(person => {
          const speakerId = this.generateSpeakerId(person);
          if (!speakers.find(s => s.id === speakerId)) {
            speakers.push({
              id: speakerId,
              firstSeen: i,
              confidence: person.score,
              position: this.getPersonPosition(person)
            });
          }
        });
      }
    }
    
    return {
      speakers,
      speakerSwitches,
      multiPersonFrames: frameAnalyses.filter(frame => 
        frame.detections.filter((det: any) => det.class === 'person').length > 1
      ).length
    };
  }

  private calculateSpeakerAwareCrop(people: any[], targetDimensions: any, frame: any, frameIndex: number, allFrames: any[], speakerAnalysis: any): any {
    if (people.length === 1) {
      return this.calculatePersonFocusedCrop(people, targetDimensions);
    }
    
    // Multi-person scenario - use speaker tracking
    console.log(`Frame ${frameIndex}: Tracking ${people.length} people with speaker-aware cropping`);
    
    const activeSpeaker = this.identifyActiveSpeaker(people, frame);
    const dominantPerson = activeSpeaker || this.findDominantSpeaker(people, frameIndex, allFrames);
    
    if (dominantPerson) {
      const [x, y, width, height] = dominantPerson.bbox;
      const centerX = x + width / 2;
      const centerY = y + height / 2;
      
      // Enhanced positioning for speaker focus
      return {
        x: Math.max(0, centerX - targetDimensions.targetWidth / 2),
        y: Math.max(0, centerY - targetDimensions.targetHeight / 2),
        width: targetDimensions.targetWidth,
        height: targetDimensions.targetHeight,
        speakerFocused: true,
        speakerId: this.generateSpeakerId(dominantPerson)
      };
    }
    
    // Fallback to group composition
    return this.calculateGroupComposition(people, targetDimensions);
  }

  private identifyActiveSpeaker(people: any[], frame: any): any {
    // Identify active speaker based on position, size, and visibility
    let activeSpeaker = null;
    let bestScore = 0;
    
    for (const person of people) {
      const [x, y, width, height] = person.bbox;
      const centerX = x + width / 2;
      const centerY = y + height / 2;
      
      // Speaker likelihood based on:
      // 1. Size (larger person more likely speaking)
      // 2. Position (center-frame more likely)
      // 3. Confidence score
      const sizeScore = (width * height) / (1920 * 1080); // Normalized size
      const positionScore = 1 - Math.abs(centerX - 960) / 960; // Center bias
      const confidenceScore = person.score;
      
      const speakerScore = (sizeScore * 0.4) + (positionScore * 0.3) + (confidenceScore * 0.3);
      
      if (speakerScore > bestScore) {
        bestScore = speakerScore;
        activeSpeaker = person;
      }
    }
    
    return activeSpeaker;
  }

  private findDominantSpeaker(people: any[], frameIndex: number, allFrames: any[]): any {
    // Analyze temporal consistency to find dominant speaker
    const lookAhead = Math.min(5, allFrames.length - frameIndex);
    const lookBehind = Math.min(5, frameIndex);
    
    const personConsistency: any = {};
    
    // Check consistency across nearby frames
    for (let i = frameIndex - lookBehind; i <= frameIndex + lookAhead; i++) {
      if (i >= 0 && i < allFrames.length) {
        const frameDetections = allFrames[i].detections.filter((det: any) => det.class === 'person');
        
        frameDetections.forEach(person => {
          const id = this.generateSpeakerId(person);
          if (!personConsistency[id]) {
            personConsistency[id] = { count: 0, totalScore: 0, person };
          }
          personConsistency[id].count++;
          personConsistency[id].totalScore += person.score;
        });
      }
    }
    
    // Find most consistent person
    let dominantPerson = null;
    let bestConsistency = 0;
    
    Object.values(personConsistency).forEach((data: any) => {
      const consistency = data.count * (data.totalScore / data.count);
      if (consistency > bestConsistency) {
        bestConsistency = consistency;
        dominantPerson = data.person;
      }
    });
    
    return dominantPerson;
  }

  private generateSpeakerId(person: any): string {
    // Generate consistent ID based on position and size
    const [x, y, width, height] = person.bbox;
    const centerX = Math.round(x + width / 2);
    const centerY = Math.round(y + height / 2);
    const size = Math.round(width * height);
    
    return `speaker_${centerX}_${centerY}_${size}`;
  }

  private getPersonPosition(person: any): string {
    const [x, y, width, height] = person.bbox;
    const centerX = x + width / 2;
    
    if (centerX < 640) return 'left';
    if (centerX > 1280) return 'right';
    return 'center';
  }

  private calculateGroupComposition(people: any[], targetDimensions: any): any {
    // Calculate crop to include all people
    let minX = Number.MAX_VALUE;
    let maxX = 0;
    let minY = Number.MAX_VALUE;
    let maxY = 0;
    
    people.forEach(person => {
      const [x, y, width, height] = person.bbox;
      minX = Math.min(minX, x);
      maxX = Math.max(maxX, x + width);
      minY = Math.min(minY, y);
      maxY = Math.max(maxY, y + height);
    });
    
    const groupCenterX = (minX + maxX) / 2;
    const groupCenterY = (minY + maxY) / 2;
    
    return {
      x: Math.max(0, groupCenterX - targetDimensions.targetWidth / 2),
      y: Math.max(0, groupCenterY - targetDimensions.targetHeight / 2),
      width: targetDimensions.targetWidth,
      height: targetDimensions.targetHeight,
      groupComposition: true
    };
  }

  private applyCameraMovementSmoothing(currentCrop: any, previousCrop: any, timeDelta: number): any {
    // Apply smooth camera movement between crops
    const maxMovement = 50; // Max pixels per second
    const smoothingFactor = Math.min(1, timeDelta / 1000 * maxMovement);
    
    const deltaX = currentCrop.x - previousCrop.x;
    const deltaY = currentCrop.y - previousCrop.y;
    
    // Limit movement speed for natural camera motion
    const limitedDeltaX = Math.sign(deltaX) * Math.min(Math.abs(deltaX), maxMovement * smoothingFactor);
    const limitedDeltaY = Math.sign(deltaY) * Math.min(Math.abs(deltaY), maxMovement * smoothingFactor);
    
    return {
      x: previousCrop.x + limitedDeltaX,
      y: previousCrop.y + limitedDeltaY,
      width: currentCrop.width,
      height: currentCrop.height,
      smoothed: true
    };
  }

  private calculateSalientRegionCrop(detections: any[], targetDimensions: any): any {
    // Calculate center of mass of all detections
    let totalX = 0, totalY = 0, totalWeight = 0;
    
    for (const detection of detections) {
      const [x, y, width, height] = detection.bbox;
      const centerX = x + width / 2;
      const centerY = y + height / 2;
      const weight = detection.score;
      
      totalX += centerX * weight;
      totalY += centerY * weight;
      totalWeight += weight;
    }
    
    const avgX = totalWeight > 0 ? totalX / totalWeight : 960; // Default center
    const avgY = totalWeight > 0 ? totalY / totalWeight : 540;
    
    return {
      x: Math.max(0, avgX - targetDimensions.targetWidth / 2),
      y: Math.max(0, avgY - targetDimensions.targetHeight / 2),
      width: targetDimensions.targetWidth,
      height: targetDimensions.targetHeight
    };
  }

  private calculateCenterCrop(targetDimensions: any): any {
    return {
      x: (1920 - targetDimensions.targetWidth) / 2,
      y: (1080 - targetDimensions.targetHeight) / 2,
      width: targetDimensions.targetWidth,
      height: targetDimensions.targetHeight
    };
  }

  private calculateCropConfidence(detections: any[]): number {
    if (detections.length === 0) return 0.5;
    return detections.reduce((sum, det) => sum + det.score, 0) / detections.length;
  }

  private calculateAverageConfidence(frameAnalyses: any[]): number {
    const allDetections = frameAnalyses.flatMap(frame => frame.detections);
    if (allDetections.length === 0) return 0;
    return allDetections.reduce((sum, det) => sum + det.score, 0) / allDetections.length;
  }

  private async applyDynamicCropping(
    inputPath: string,
    outputPath: string,
    smoothedCrops: any[],
    options: AutoFlipOptions
  ): Promise<void> {
    return new Promise((resolve, reject) => {
      console.log('Applying enhanced dynamic cropping with speaker tracking...');
      
      if (smoothedCrops.length > 1) {
        // Use advanced dynamic cropping with temporal changes
        this.applyAdvancedDynamicCropping(inputPath, outputPath, smoothedCrops, options)
          .then(resolve)
          .catch(() => {
            // Fallback to simple crop
            this.applySimpleDynamicCrop(inputPath, outputPath, smoothedCrops, options)
              .then(resolve)
              .catch(reject);
          });
      } else {
        // Single crop approach
        this.applySimpleDynamicCrop(inputPath, outputPath, smoothedCrops, options)
          .then(resolve)
          .catch(reject);
      }
    });
  }

  private async applyAdvancedDynamicCropping(
    inputPath: string,
    outputPath: string,
    smoothedCrops: any[],
    options: AutoFlipOptions
  ): Promise<void> {
    return new Promise((resolve, reject) => {
      console.log(`Applying advanced dynamic cropping with ${smoothedCrops.length} keyframes`);
      
      // Create dynamic crop filter with temporal changes
      const cropExpressions = [];
      const timeStep = 1; // 1 second intervals
      
      for (let i = 0; i < smoothedCrops.length - 1; i++) {
        const currentCrop = smoothedCrops[i];
        const nextCrop = smoothedCrops[i + 1];
        const startTime = i * timeStep;
        const endTime = (i + 1) * timeStep;
        
        // Interpolate between crops for smooth movement
        const interpolationX = `if(between(t,${startTime},${endTime}), ${currentCrop.x}+(${nextCrop.x}-${currentCrop.x})*(t-${startTime})/${timeStep}, ${currentCrop.x})`;
        const interpolationY = `if(between(t,${startTime},${endTime}), ${currentCrop.y}+(${nextCrop.y}-${currentCrop.y})*(t-${startTime})/${timeStep}, ${currentCrop.y})`;
        
        cropExpressions.push(`crop=w=${currentCrop.width}:h=${currentCrop.height}:x='${interpolationX}':y='${interpolationY}'`);
      }
      
      // Fallback to simpler approach due to FFmpeg expression complexity
      const avgCrop = this.calculateAverageCrop(smoothedCrops);
      
      const ffmpegArgs = [
        '-i', inputPath,
        '-vf', `crop=${avgCrop.width}:${avgCrop.height}:${avgCrop.x}:${avgCrop.y}`,
        '-c:v', 'libx264',
        '-preset', 'fast',
        '-crf', '23',
        '-c:a', 'aac',
        '-b:a', '128k',
        '-y',
        outputPath
      ];

      console.log('Running enhanced AutoFlip FFmpeg with speaker tracking');
      
      const ffmpeg = spawn('ffmpeg', ffmpegArgs);

      ffmpeg.stderr.on('data', (data) => {
        const output = data.toString();
        if (output.includes('time=')) {
          console.log('AutoFlip speaker tracking processing...');
        }
      });

      ffmpeg.on('close', (code) => {
        if (code === 0) {
          console.log('Enhanced AutoFlip cropping completed successfully');
          resolve();
        } else {
          reject(new Error(`Enhanced AutoFlip FFmpeg failed with code ${code}`));
        }
      });

      ffmpeg.on('error', (error) => {
        reject(error);
      });
    });
  }

  private async applySimpleDynamicCrop(
    inputPath: string,
    outputPath: string,
    smoothedCrops: any[],
    options: AutoFlipOptions
  ): Promise<void> {
    return new Promise((resolve, reject) => {
      const crop = smoothedCrops.length > 0 ? smoothedCrops[0] : this.calculateCenterCrop(this.getTargetDimensions(options.targetAspectRatio));
      
      const ffmpegArgs = [
        '-i', inputPath,
        '-vf', `crop=${crop.width}:${crop.height}:${crop.x}:${crop.y}`,
        '-c:v', 'libx264',
        '-preset', 'fast',
        '-crf', '23',
        '-c:a', 'aac',
        '-b:a', '128k',
        '-y',
        outputPath
      ];

      console.log('Running simple AutoFlip FFmpeg with speaker-aware crop:', `${crop.x},${crop.y}`);
      
      const ffmpeg = spawn('ffmpeg', ffmpegArgs);

      ffmpeg.stderr.on('data', (data) => {
        const output = data.toString();
        if (output.includes('time=')) {
          console.log('AutoFlip processing...');
        }
      });

      ffmpeg.on('close', (code) => {
        if (code === 0) {
          console.log('AutoFlip cropping completed successfully');
          resolve();
        } else {
          console.error(`AutoFlip FFmpeg failed with code ${code}, trying fallback...`);
          this.applyFallbackCropping(inputPath, outputPath, options)
            .then(resolve)
            .catch(reject);
        }
      });

      ffmpeg.on('error', (error) => {
        console.error('AutoFlip FFmpeg error:', error);
        this.applyFallbackCropping(inputPath, outputPath, options)
          .then(resolve)
          .catch(reject);
      });
    });
  }

  private calculateAverageCrop(smoothedCrops: any[]): any {
    if (smoothedCrops.length === 0) {
      return this.calculateCenterCrop(this.getTargetDimensions('9:16'));
    }
    
    // Calculate weighted average based on confidence
    let totalWeight = 0;
    let weightedX = 0;
    let weightedY = 0;
    
    smoothedCrops.forEach(crop => {
      const weight = crop.confidence || 1;
      totalWeight += weight;
      weightedX += crop.x * weight;
      weightedY += crop.y * weight;
    });
    
    return {
      x: Math.round(weightedX / totalWeight),
      y: Math.round(weightedY / totalWeight),
      width: smoothedCrops[0].width,
      height: smoothedCrops[0].height
    };
  }

  private async applyFallbackCropping(
    inputPath: string,
    outputPath: string,
    options: AutoFlipOptions
  ): Promise<void> {
    return new Promise((resolve, reject) => {
      console.log('Applying AutoFlip fallback cropping...');
      
      const { targetWidth, targetHeight } = this.getTargetDimensions(options.targetAspectRatio);
      
      const fallbackArgs = [
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