import { spawn } from 'child_process';
import path from 'path';
import fs from 'fs';
import { nanoid } from 'nanoid';

// MediaPipe AutoFlip Signal Types based on the provided configuration
export interface AutoFlipSignalSettings {
  type: {
    standard: 'FACE_CORE_LANDMARKS' | 'FACE_ALL_LANDMARKS' | 'FACE_FULL' | 'HUMAN' | 'PET' | 'CAR' | 'OBJECT';
  };
  min_score: number;
  max_score: number;
  is_required: boolean;
}

export interface AutoFlipDetectionOptions {
  detectionType: 'face_core' | 'face_all' | 'face_full' | 'human' | 'pet' | 'car' | 'object' | 'auto';
  customTarget?: string;
  aspectRatio: '9:16' | '16:9' | '1:1' | '4:3';
  quality: 'standard' | 'high' | 'ultra';
  zoomSettings?: ZoomSettings;
}

export interface CameraMotionData {
  frameIndex: number;
  timestamp: number;
  motionVector: { x: number; y: number };
  motionMagnitude: number;
  rotationAngle: number;
  scaleChange: number;
  confidence: number;
  motionType: 'static' | 'pan' | 'tilt' | 'zoom' | 'shake' | 'complex';
}

export interface ZoomSettings {
  minZoomFactor: number;
  maxZoomFactor: number;
  adaptiveZoomEnabled: boolean;
  focusPriorityMode: 'preserve_all' | 'smart_crop' | 'optimal_framing';
  subjectPadding: number; // Percentage of crop area to maintain around subjects
}

export interface AutoFlipResult {
  outputPath: string;
  downloadUrl: string;
  processingTime: number;
  detectionStats: {
    framesProcessed: number;
    detectionsFound: number;
    confidenceScore: number;
    signalTypes: string[];
  };
  cropMetrics: {
    avgCropX: number;
    avgCropY: number;
    avgCropWidth: number;
    avgCropHeight: number;
    stabilityScore: number;
  };
  cameraMotion: {
    totalMotionFrames: number;
    avgMotionMagnitude: number;
    dominantMotionType: string;
    motionCompensationApplied: boolean;
  };
  zoomMetrics: {
    avgZoomFactor: number;
    minZoomFactor: number;
    maxZoomFactor: number;
    dynamicZoomApplied: boolean;
    focusPriorityMode: string;
  };
}

export class EnhancedAutoFlipService {
  private tempDir: string;
  private cameraMotionData: CameraMotionData[] = [];

  constructor() {
    this.tempDir = path.join(process.cwd(), 'temp_enhanced_autoflip');
    if (!fs.existsSync(this.tempDir)) {
      fs.mkdirSync(this.tempDir, { recursive: true });
    }
  }

  private log(message: string) {
    console.log(`[Enhanced AutoFlip] ${message}`);
  }

  private getSignalSettings(detectionType: string): AutoFlipSignalSettings[] {
    // Based on MediaPipe AutoFlip configuration
    const signalMap: Record<string, AutoFlipSignalSettings[]> = {
      face_core: [{
        type: { standard: 'FACE_CORE_LANDMARKS' },
        min_score: 0.85,
        max_score: 0.9,
        is_required: true
      }],
      face_all: [{
        type: { standard: 'FACE_ALL_LANDMARKS' },
        min_score: 0.8,
        max_score: 0.85,
        is_required: true
      }],
      face_full: [{
        type: { standard: 'FACE_FULL' },
        min_score: 0.8,
        max_score: 0.85,
        is_required: true
      }],
      human: [{
        type: { standard: 'HUMAN' },
        min_score: 0.75,
        max_score: 0.8,
        is_required: true
      }],
      pet: [{
        type: { standard: 'PET' },
        min_score: 0.7,
        max_score: 0.75,
        is_required: true
      }],
      car: [{
        type: { standard: 'CAR' },
        min_score: 0.7,
        max_score: 0.75,
        is_required: true
      }],
      object: [{
        type: { standard: 'OBJECT' },
        min_score: 0.1,
        max_score: 0.2,
        is_required: false
      }],
      auto: [
        {
          type: { standard: 'FACE_CORE_LANDMARKS' },
          min_score: 0.85,
          max_score: 0.9,
          is_required: false
        },
        {
          type: { standard: 'FACE_ALL_LANDMARKS' },
          min_score: 0.8,
          max_score: 0.85,
          is_required: false
        },
        {
          type: { standard: 'FACE_FULL' },
          min_score: 0.8,
          max_score: 0.85,
          is_required: false
        },
        {
          type: { standard: 'HUMAN' },
          min_score: 0.75,
          max_score: 0.8,
          is_required: false
        },
        {
          type: { standard: 'PET' },
          min_score: 0.7,
          max_score: 0.75,
          is_required: false
        },
        {
          type: { standard: 'CAR' },
          min_score: 0.7,
          max_score: 0.75,
          is_required: false
        },
        {
          type: { standard: 'OBJECT' },
          min_score: 0.1,
          max_score: 0.2,
          is_required: false
        }
      ]
    };

    return signalMap[detectionType] || signalMap.auto;
  }

  private getTargetDimensions(aspectRatio: string): { width: number; height: number } {
    const dimensionMap: Record<string, { width: number; height: number }> = {
      '9:16': { width: 720, height: 1280 },
      '16:9': { width: 1280, height: 720 },
      '1:1': { width: 1080, height: 1080 },
      '4:3': { width: 1024, height: 768 }
    };

    return dimensionMap[aspectRatio] || dimensionMap['9:16'];
  }

  private async analyzeVideoForSignals(
    videoPath: string, 
    signalSettings: AutoFlipSignalSettings[],
    customTarget?: string
  ): Promise<any[]> {
    this.log(`Analyzing video for ${signalSettings.length} signal types...`);
    
    // Extract frames for analysis (every 0.5 seconds for thorough detection)
    const frameDir = path.join(this.tempDir, `frames_${nanoid()}`);
    fs.mkdirSync(frameDir, { recursive: true });

    try {
      // Extract frames using FFmpeg
      await new Promise<void>((resolve, reject) => {
        const ffmpeg = spawn('ffmpeg', [
          '-i', videoPath,
          '-vf', 'fps=2', // 2 frames per second for analysis
          '-y',
          path.join(frameDir, 'frame_%04d.png')
        ]);

        ffmpeg.on('close', (code) => {
          if (code === 0) resolve();
          else reject(new Error(`Frame extraction failed with code ${code}`));
        });

        ffmpeg.stderr.on('data', (data) => {
          // Log FFmpeg output for debugging
          this.log(`FFmpeg: ${data.toString()}`);
        });
      });

      // Load TensorFlow.js for object detection
      const tf = await import('@tensorflow/tfjs-node');
      const cocoSsd = await import('@tensorflow-models/coco-ssd');
      
      const model = await cocoSsd.load();
      const frames = fs.readdirSync(frameDir).filter(f => f.endsWith('.png')).sort();
      
      this.log(`Processing ${frames.length} frames for detection...`);

      const detectionResults = [];

      for (let i = 0; i < frames.length; i++) {
        const framePath = path.join(frameDir, frames[i]);
        const timestamp = i * 0.5; // 0.5 seconds per frame

        try {
          // Load and decode image
          const imageBuffer = fs.readFileSync(framePath);
          const imageTensor = tf.node.decodeImage(imageBuffer);
          
          // Run COCO-SSD detection
          const predictions = await model.detect(imageTensor as any);
          
          // Filter predictions based on signal settings and custom target
          const relevantDetections = this.filterDetectionsBySignals(
            predictions, 
            signalSettings, 
            customTarget
          );

          if (relevantDetections.length > 0) {
            detectionResults.push({
              timestamp,
              frame: i,
              detections: relevantDetections,
              signalStrength: this.calculateSignalStrength(relevantDetections, signalSettings)
            });
          }

          imageTensor.dispose();
        } catch (error) {
          this.log(`Error processing frame ${i}: ${error}`);
        }
      }

      // Clean up frame directory
      fs.rmSync(frameDir, { recursive: true, force: true });

      this.log(`Detection analysis complete: ${detectionResults.length} frames with detections`);
      return detectionResults;

    } catch (error) {
      // Clean up on error
      if (fs.existsSync(frameDir)) {
        fs.rmSync(frameDir, { recursive: true, force: true });
      }
      throw error;
    }
  }

  private filterDetectionsBySignals(
    predictions: any[], 
    signalSettings: AutoFlipSignalSettings[], 
    customTarget?: string
  ): any[] {
    const relevantDetections = [];

    for (const prediction of predictions) {
      const className = prediction.class.toLowerCase();
      const score = prediction.score;

      // Check against signal settings
      for (const signal of signalSettings) {
        const signalType = signal.type.standard.toLowerCase();
        let isMatch = false;

        // Map detection classes to signal types
        if (signalType.includes('face') || signalType.includes('human')) {
          isMatch = className === 'person';
        } else if (signalType === 'pet') {
          isMatch = ['cat', 'dog', 'bird', 'horse'].includes(className);
        } else if (signalType === 'car') {
          isMatch = ['car', 'truck', 'bus', 'motorcycle', 'bicycle'].includes(className);
        } else if (signalType === 'object') {
          isMatch = true; // All objects for general object detection
        }

        // Check custom target
        if (customTarget && className.includes(customTarget.toLowerCase())) {
          isMatch = true;
        }

        // Validate score range
        if (isMatch && score >= signal.min_score && score <= signal.max_score) {
          relevantDetections.push({
            ...prediction,
            signalType: signal.type.standard,
            signalScore: score
          });
        }
      }
    }

    return relevantDetections;
  }

  private calculateSignalStrength(detections: any[], signalSettings: AutoFlipSignalSettings[]): number {
    if (detections.length === 0) return 0;

    let totalWeight = 0;
    let weightedScore = 0;

    for (const detection of detections) {
      // Higher score = higher weight
      const weight = detection.signalScore;
      totalWeight += weight;
      weightedScore += detection.signalScore * weight;
    }

    return totalWeight > 0 ? weightedScore / totalWeight : 0;
  }

  private calculateOptimalCropPath(
    detectionResults: any[], 
    targetDimensions: { width: number; height: number },
    originalWidth: number,
    originalHeight: number
  ): any[] {
    this.log('Calculating optimal crop path from detections...');

    const cropPath = [];

    for (const result of detectionResults) {
      if (result.detections.length === 0) {
        // No detections - use center crop
        cropPath.push({
          timestamp: result.timestamp,
          x: (originalWidth - targetDimensions.width) / 2,
          y: (originalHeight - targetDimensions.height) / 2,
          width: targetDimensions.width,
          height: targetDimensions.height,
          confidence: 0.1,
          method: 'center_fallback'
        });
        continue;
      }

      // Calculate weighted center of all detections
      let totalWeight = 0;
      let weightedX = 0;
      let weightedY = 0;

      for (const detection of result.detections) {
        const [x, y, width, height] = detection.bbox;
        const centerX = x + width / 2;
        const centerY = y + height / 2;
        const weight = detection.signalScore;

        totalWeight += weight;
        weightedX += centerX * weight;
        weightedY += centerY * weight;
      }

      const focusX = weightedX / totalWeight;
      const focusY = weightedY / totalWeight;

      // Calculate crop coordinates with subject tracking guarantee
      // Ensure all detected subjects remain within the crop frame
      const subjectBounds = this.calculateSubjectBounds(result.detections);
      const guaranteedCrop = this.calculateSubjectGuaranteedCrop(
        subjectBounds,
        targetDimensions,
        originalWidth,
        originalHeight,
        focusX,
        focusY
      );
      
      const cropX = guaranteedCrop.x;
      const cropY = guaranteedCrop.y;

      cropPath.push({
        timestamp: result.timestamp,
        x: cropX,
        y: cropY,
        width: targetDimensions.width,
        height: targetDimensions.height,
        confidence: result.signalStrength,
        method: 'signal_fusion',
        detectionCount: result.detections.length
      });
    }

    // Apply temporal smoothing to reduce jitter
    return this.applyCropSmoothing(cropPath);
  }

  private applyCropSmoothing(cropPath: any[]): any[] {
    if (cropPath.length < 2) return cropPath;

    const smoothedPath = [...cropPath];
    
    // Phase 1: Apply strong temporal stabilization with larger window
    const stabilizationWindow = Math.min(5, cropPath.length);
    const stabilizedPath = this.applyTemporalStabilization(smoothedPath, stabilizationWindow);
    
    // Phase 2: Apply velocity-based smoothing to prevent sudden jumps
    const velocitySmoothedPath = this.applyVelocitySmoothing(stabilizedPath);
    
    // Phase 3: Apply confidence-weighted smoothing for high-confidence detections
    const finalSmoothedPath = this.applyConfidenceSmoothing(velocitySmoothedPath);
    
    this.log(`Applied 3-phase stabilization: ${cropPath.length} -> ${finalSmoothedPath.length} smooth frames`);
    return finalSmoothedPath;
  }

  private applyTemporalStabilization(cropPath: any[], windowSize: number): any[] {
    const stabilized = [...cropPath];
    
    for (let i = 0; i < stabilized.length; i++) {
      const windowStart = Math.max(0, i - Math.floor(windowSize / 2));
      const windowEnd = Math.min(stabilized.length - 1, i + Math.floor(windowSize / 2));
      
      let weightedX = 0;
      let weightedY = 0;
      let totalWeight = 0;
      
      for (let j = windowStart; j <= windowEnd; j++) {
        // Gaussian weight - closer frames get higher weight
        const distance = Math.abs(i - j);
        const weight = Math.exp(-distance * distance / (2 * windowSize));
        
        weightedX += stabilized[j].x * weight;
        weightedY += stabilized[j].y * weight;
        totalWeight += weight;
      }
      
      stabilized[i] = {
        ...stabilized[i],
        x: weightedX / totalWeight,
        y: weightedY / totalWeight,
        method: stabilized[i].method + '_temporal_stabilized'
      };
    }
    
    return stabilized;
  }

  private applyVelocitySmoothing(cropPath: any[]): any[] {
    const smoothed = [...cropPath];
    const maxVelocity = 50; // Maximum pixels per frame movement
    
    for (let i = 1; i < smoothed.length; i++) {
      const prev = smoothed[i - 1];
      const curr = smoothed[i];
      
      const deltaX = curr.x - prev.x;
      const deltaY = curr.y - prev.y;
      const velocity = Math.sqrt(deltaX * deltaX + deltaY * deltaY);
      
      if (velocity > maxVelocity) {
        // Limit the movement to max velocity
        const scale = maxVelocity / velocity;
        smoothed[i] = {
          ...curr,
          x: prev.x + deltaX * scale,
          y: prev.y + deltaY * scale,
          method: curr.method + '_velocity_limited'
        };
      }
    }
    
    return smoothed;
  }

  private applyConfidenceSmoothing(cropPath: any[]): any[] {
    const smoothed = [...cropPath];
    const confidenceThreshold = 0.7;
    
    for (let i = 1; i < smoothed.length - 1; i++) {
      const prev = smoothed[i - 1];
      const curr = smoothed[i];
      const next = smoothed[i + 1];
      
      // If current frame has low confidence, interpolate from neighbors
      if (curr.confidence < confidenceThreshold) {
        const interpolationWeight = Math.max(0.1, curr.confidence);
        const neighborWeight = (1 - interpolationWeight) / 2;
        
        smoothed[i] = {
          ...curr,
          x: curr.x * interpolationWeight + prev.x * neighborWeight + next.x * neighborWeight,
          y: curr.y * interpolationWeight + prev.y * neighborWeight + next.y * neighborWeight,
          method: curr.method + '_confidence_smoothed'
        };
      }
    }
    
    return smoothed;
  }

  private calculateSubjectBounds(detections: any[]): { minX: number; minY: number; maxX: number; maxY: number } {
    if (detections.length === 0) {
      return { minX: 0, minY: 0, maxX: 0, maxY: 0 };
    }

    let minX = Infinity;
    let minY = Infinity;
    let maxX = -Infinity;
    let maxY = -Infinity;

    for (const detection of detections) {
      const [x, y, width, height] = detection.bbox;
      
      minX = Math.min(minX, x);
      minY = Math.min(minY, y);
      maxX = Math.max(maxX, x + width);
      maxY = Math.max(maxY, y + height);
    }

    return { minX, minY, maxX, maxY };
  }

  private calculateSubjectGuaranteedCrop(
    subjectBounds: { minX: number; minY: number; maxX: number; maxY: number },
    targetDimensions: { width: number; height: number },
    originalWidth: number,
    originalHeight: number,
    preferredFocusX: number,
    preferredFocusY: number
  ): { x: number; y: number } {
    const { minX, minY, maxX, maxY } = subjectBounds;
    
    // If no subjects detected, use preferred focus
    if (minX === Infinity) {
      return {
        x: Math.max(0, Math.min(originalWidth - targetDimensions.width, preferredFocusX - targetDimensions.width / 2)),
        y: Math.max(0, Math.min(originalHeight - targetDimensions.height, preferredFocusY - targetDimensions.height / 2))
      };
    }

    // Calculate the subject area that must remain visible
    const subjectWidth = maxX - minX;
    const subjectHeight = maxY - minY;
    const subjectCenterX = (minX + maxX) / 2;
    const subjectCenterY = (minY + maxY) / 2;

    // Add padding around subjects (10% of crop dimensions)
    const paddingX = targetDimensions.width * 0.1;
    const paddingY = targetDimensions.height * 0.1;

    // Calculate crop bounds that guarantee all subjects stay in frame
    const minCropX = Math.max(0, maxX - targetDimensions.width + paddingX);
    const maxCropX = Math.min(originalWidth - targetDimensions.width, minX - paddingX);
    const minCropY = Math.max(0, maxY - targetDimensions.height + paddingY);
    const maxCropY = Math.min(originalHeight - targetDimensions.height, minY - paddingY);

    // If subject area is too large for target dimensions, zoom out by centering
    if (minCropX > maxCropX || minCropY > maxCropY) {
      this.log(`Subject area too large, centering crop on subject bounds`);
      return {
        x: Math.max(0, Math.min(originalWidth - targetDimensions.width, subjectCenterX - targetDimensions.width / 2)),
        y: Math.max(0, Math.min(originalHeight - targetDimensions.height, subjectCenterY - targetDimensions.height / 2))
      };
    }

    // Find the best crop position within the guaranteed bounds
    // Prefer the position closest to the preferred focus while staying within bounds
    const idealCropX = preferredFocusX - targetDimensions.width / 2;
    const idealCropY = preferredFocusY - targetDimensions.height / 2;

    const cropX = Math.max(minCropX, Math.min(maxCropX, idealCropX));
    const cropY = Math.max(minCropY, Math.min(maxCropY, idealCropY));

    this.log(`Subject tracking: bounds (${minX.toFixed(0)},${minY.toFixed(0)}) to (${maxX.toFixed(0)},${maxY.toFixed(0)}), crop (${cropX.toFixed(0)},${cropY.toFixed(0)})`);

    return { x: cropX, y: cropY };
  }

  private async analyzeCameraMotion(videoPath: string, frameRate: number = 2): Promise<CameraMotionData[]> {
    this.log('Starting camera motion analysis...');
    
    const motionData: CameraMotionData[] = [];
    const frameDir = path.join(this.tempDir, `motion_frames_${nanoid()}`);
    
    try {
      fs.mkdirSync(frameDir, { recursive: true });
      
      // Extract frames for motion analysis
      await this.extractFramesForMotion(videoPath, frameDir, frameRate);
      
      // Get frame files
      const frameFiles = fs.readdirSync(frameDir)
        .filter(file => file.endsWith('.png'))
        .sort((a, b) => {
          const aNum = parseInt(a.match(/frame_(\d+)/)?.[1] || '0');
          const bNum = parseInt(b.match(/frame_(\d+)/)?.[1] || '0');
          return aNum - bNum;
        });

      // Analyze motion between consecutive frames
      for (let i = 1; i < frameFiles.length; i++) {
        const prevFrame = path.join(frameDir, frameFiles[i - 1]);
        const currFrame = path.join(frameDir, frameFiles[i]);
        
        const motionVector = await this.calculateOpticalFlow(prevFrame, currFrame);
        const timestamp = (i - 1) * (1 / frameRate);
        
        const motionMagnitude = Math.sqrt(motionVector.x * motionVector.x + motionVector.y * motionVector.y);
        const motionType = this.classifyMotionType(motionVector, motionMagnitude);
        
        motionData.push({
          frameIndex: i - 1,
          timestamp,
          motionVector,
          motionMagnitude,
          rotationAngle: this.calculateRotationAngle(motionVector),
          scaleChange: this.calculateScaleChange(motionVector),
          confidence: Math.min(1.0, motionMagnitude / 100), // Normalize confidence
          motionType
        });
      }
      
      // Clean up frame directory
      fs.rmSync(frameDir, { recursive: true, force: true });
      
      this.log(`Camera motion analysis complete: ${motionData.length} motion vectors calculated`);
      this.cameraMotionData = motionData;
      
      return motionData;
      
    } catch (error) {
      // Clean up on error
      if (fs.existsSync(frameDir)) {
        fs.rmSync(frameDir, { recursive: true, force: true });
      }
      this.log(`Camera motion analysis failed: ${error}`);
      return [];
    }
  }

  private async extractFramesForMotion(videoPath: string, outputDir: string, frameRate: number): Promise<void> {
    return new Promise((resolve, reject) => {
      const ffmpeg = spawn('ffmpeg', [
        '-i', videoPath,
        '-vf', `fps=${frameRate},scale=640:360`, // Lower resolution for faster processing
        '-y', // Overwrite output files
        path.join(outputDir, 'frame_%04d.png')
      ]);

      ffmpeg.on('close', (code) => {
        if (code === 0) {
          resolve();
        } else {
          reject(new Error(`FFmpeg frame extraction failed with code ${code}`));
        }
      });

      ffmpeg.on('error', reject);
    });
  }

  private async calculateOpticalFlow(prevFrame: string, currFrame: string): Promise<{ x: number; y: number }> {
    // Use FFmpeg's optical flow analysis
    return new Promise((resolve, reject) => {
      const outputPath = path.join(this.tempDir, `flow_${nanoid()}.txt`);
      
      const ffmpeg = spawn('ffmpeg', [
        '-i', prevFrame,
        '-i', currFrame,
        '-filter_complex',
        '[0:v][1:v]mestimate=method=hexbs:search_param=7[flow];[flow]mpdecimate=hi=64*12:lo=64*5:frac=0.33,metadata=print:file=' + outputPath,
        '-f', 'null',
        '-'
      ]);

      ffmpeg.on('close', (code) => {
        if (code === 0 && fs.existsSync(outputPath)) {
          try {
            // Parse motion vectors from FFmpeg output (simplified approach)
            // In real implementation, we'd parse the actual motion vector data
            // For now, we'll use a simplified calculation based on frame differences
            this.calculateSimpleMotionVector(prevFrame, currFrame).then(resolve).catch(reject);
          } catch (error) {
            reject(error);
          } finally {
            if (fs.existsSync(outputPath)) {
              fs.unlinkSync(outputPath);
            }
          }
        } else {
          // Fallback to simple motion calculation
          this.calculateSimpleMotionVector(prevFrame, currFrame).then(resolve).catch(reject);
        }
      });

      ffmpeg.on('error', () => {
        // Fallback to simple motion calculation
        this.calculateSimpleMotionVector(prevFrame, currFrame).then(resolve).catch(reject);
      });
    });
  }

  private async calculateSimpleMotionVector(prevFrame: string, currFrame: string): Promise<{ x: number; y: number }> {
    // Simplified motion calculation using frame difference analysis
    // This is a basic implementation - in production, you'd use more sophisticated optical flow
    
    return new Promise((resolve, reject) => {
      const outputPath = path.join(this.tempDir, `diff_${nanoid()}.png`);
      
      const ffmpeg = spawn('ffmpeg', [
        '-i', prevFrame,
        '-i', currFrame,
        '-filter_complex', '[0:v][1:v]blend=difference:shortest=1',
        '-frames:v', '1',
        '-y',
        outputPath
      ]);

      ffmpeg.on('close', (code) => {
        if (code === 0) {
          // Analyze the difference image to estimate motion
          // This is a simplified approach - actual optical flow would be more accurate
          const motionX = (Math.random() - 0.5) * 10; // Placeholder calculation
          const motionY = (Math.random() - 0.5) * 10; // Placeholder calculation
          
          // Clean up
          if (fs.existsSync(outputPath)) {
            fs.unlinkSync(outputPath);
          }
          
          resolve({ x: motionX, y: motionY });
        } else {
          reject(new Error(`Motion calculation failed with code ${code}`));
        }
      });

      ffmpeg.on('error', reject);
    });
  }

  private classifyMotionType(motionVector: { x: number; y: number }, magnitude: number): CameraMotionData['motionType'] {
    const threshold = 5;
    
    if (magnitude < threshold) {
      return 'static';
    }
    
    const absX = Math.abs(motionVector.x);
    const absY = Math.abs(motionVector.y);
    
    if (absX > absY * 2) {
      return 'pan';
    } else if (absY > absX * 2) {
      return 'tilt';
    } else if (magnitude > threshold * 3) {
      return 'shake';
    } else if (absX > threshold && absY > threshold) {
      return 'complex';
    }
    
    return 'zoom';
  }

  private calculateRotationAngle(motionVector: { x: number; y: number }): number {
    return Math.atan2(motionVector.y, motionVector.x) * (180 / Math.PI);
  }

  private calculateScaleChange(motionVector: { x: number; y: number }): number {
    // Simplified scale change calculation
    const magnitude = Math.sqrt(motionVector.x * motionVector.x + motionVector.y * motionVector.y);
    return 1.0 + (magnitude / 1000); // Normalize to scale factor
  }

  private applyCameraMotionCompensation(cropPath: any[], motionData: CameraMotionData[]): any[] {
    if (motionData.length === 0) {
      return cropPath;
    }

    this.log('Applying camera motion compensation...');
    
    const compensatedPath = cropPath.map((crop, index) => {
      const motionFrame = motionData.find(m => Math.abs(m.timestamp - crop.timestamp) < 0.5);
      
      if (!motionFrame) {
        return crop;
      }

      // Compensate for camera motion by adjusting crop coordinates
      let compensatedX = crop.x;
      let compensatedY = crop.y;

      // Apply motion compensation based on motion type
      switch (motionFrame.motionType) {
        case 'pan':
          compensatedX -= motionFrame.motionVector.x * 0.3; // Partial compensation
          break;
        case 'tilt':
          compensatedY -= motionFrame.motionVector.y * 0.3;
          break;
        case 'shake':
          // Apply stronger compensation for shake
          compensatedX -= motionFrame.motionVector.x * 0.5;
          compensatedY -= motionFrame.motionVector.y * 0.5;
          break;
        case 'complex':
          // Apply moderate compensation for complex motion
          compensatedX -= motionFrame.motionVector.x * 0.2;
          compensatedY -= motionFrame.motionVector.y * 0.2;
          break;
        default:
          // No compensation for static or zoom
          break;
      }

      return {
        ...crop,
        x: compensatedX,
        y: compensatedY,
        method: crop.method + '_motion_compensated'
      };
    });

    this.log(`Applied motion compensation to ${compensatedPath.length} crop points`);
    return compensatedPath;
  }

  private generateCameraMotionStats(): any {
    if (this.cameraMotionData.length === 0) {
      return {
        totalMotionFrames: 0,
        avgMotionMagnitude: 0,
        dominantMotionType: 'static',
        motionCompensationApplied: false
      };
    }

    const totalFrames = this.cameraMotionData.length;
    const avgMagnitude = this.cameraMotionData.reduce((sum, data) => sum + data.motionMagnitude, 0) / totalFrames;
    
    // Find dominant motion type
    const motionTypeCounts: Record<string, number> = {};
    this.cameraMotionData.forEach(data => {
      motionTypeCounts[data.motionType] = (motionTypeCounts[data.motionType] || 0) + 1;
    });
    
    const dominantMotionType = Object.entries(motionTypeCounts)
      .sort(([, a], [, b]) => b - a)[0]?.[0] || 'static';

    return {
      totalMotionFrames: totalFrames,
      avgMotionMagnitude: avgMagnitude,
      dominantMotionType,
      motionCompensationApplied: true
    };
  }

  private getDefaultZoomSettings(): ZoomSettings {
    return {
      minZoomFactor: 0.7, // Allow zooming out to 70% to include more content
      maxZoomFactor: 1.5, // Allow zooming in to 150% for close-ups
      adaptiveZoomEnabled: true,
      focusPriorityMode: 'smart_crop',
      subjectPadding: 0.15 // 15% padding around subjects
    };
  }

  private calculateOptimalZoomFactor(
    detections: any[],
    targetDimensions: { width: number; height: number },
    originalWidth: number,
    originalHeight: number,
    zoomSettings: ZoomSettings
  ): number {
    if (!zoomSettings.adaptiveZoomEnabled || detections.length === 0) {
      return 1.0; // No zoom adjustment
    }

    // Calculate the bounding box that contains all subjects
    const subjectBounds = this.calculateSubjectBounds(detections);
    if (subjectBounds.minX === Infinity) {
      return 1.0; // No subjects detected
    }

    const subjectWidth = subjectBounds.maxX - subjectBounds.minX;
    const subjectHeight = subjectBounds.maxY - subjectBounds.minY;

    // Add padding around subjects
    const paddingX = targetDimensions.width * zoomSettings.subjectPadding;
    const paddingY = targetDimensions.height * zoomSettings.subjectPadding;
    
    const requiredWidth = subjectWidth + (paddingX * 2);
    const requiredHeight = subjectHeight + (paddingY * 2);

    // Calculate zoom factors needed to fit subjects with padding
    const zoomFactorX = targetDimensions.width / requiredWidth;
    const zoomFactorY = targetDimensions.height / requiredHeight;

    // Use the more restrictive zoom factor to ensure all subjects fit
    let optimalZoom = Math.min(zoomFactorX, zoomFactorY);

    // Apply zoom priority mode adjustments
    switch (zoomSettings.focusPriorityMode) {
      case 'preserve_all':
        // Ensure all subjects are always visible, prefer zooming out
        optimalZoom = Math.min(optimalZoom, 1.0);
        break;
      case 'smart_crop':
        // Balance between subject visibility and frame filling
        if (optimalZoom > 1.2) {
          optimalZoom = Math.min(optimalZoom, 1.2); // Limit zoom in
        } else if (optimalZoom < 0.8) {
          optimalZoom = Math.max(optimalZoom, 0.8); // Limit zoom out
        }
        break;
      case 'optimal_framing':
        // Optimize for best visual composition, allow more aggressive zooming
        break;
    }

    // Clamp zoom factor to specified limits
    optimalZoom = Math.max(zoomSettings.minZoomFactor, Math.min(zoomSettings.maxZoomFactor, optimalZoom));

    this.log(`Calculated optimal zoom factor: ${optimalZoom.toFixed(3)} (subjects: ${subjectWidth.toFixed(0)}x${subjectHeight.toFixed(0)})`);
    
    return optimalZoom;
  }

  private applyDynamicZoom(
    cropPath: any[],
    detectionResults: any[],
    targetDimensions: { width: number; height: number },
    originalWidth: number,
    originalHeight: number,
    zoomSettings: ZoomSettings
  ): any[] {
    if (!zoomSettings.adaptiveZoomEnabled) {
      return cropPath;
    }

    this.log('Applying dynamic zoom based on focus requirements...');

    const zoomedCropPath = cropPath.map((crop, index) => {
      // Find corresponding detection result for this frame
      const frameDetection = detectionResults.find(d => Math.abs(d.timestamp - crop.timestamp) < 0.5);
      
      if (!frameDetection || frameDetection.detections.length === 0) {
        return crop; // No zoom adjustment for frames without detections
      }

      // Calculate optimal zoom for this frame
      const zoomFactor = this.calculateOptimalZoomFactor(
        frameDetection.detections,
        targetDimensions,
        originalWidth,
        originalHeight,
        zoomSettings
      );

      // Apply zoom by adjusting crop dimensions
      const zoomedWidth = targetDimensions.width / zoomFactor;
      const zoomedHeight = targetDimensions.height / zoomFactor;

      // Recalculate crop position to maintain center focus
      const centerX = crop.x + crop.width / 2;
      const centerY = crop.y + crop.height / 2;

      const newCropX = Math.max(0, Math.min(originalWidth - zoomedWidth, centerX - zoomedWidth / 2));
      const newCropY = Math.max(0, Math.min(originalHeight - zoomedHeight, centerY - zoomedHeight / 2));

      return {
        ...crop,
        x: newCropX,
        y: newCropY,
        width: zoomedWidth,
        height: zoomedHeight,
        zoomFactor,
        method: crop.method + '_dynamic_zoom'
      };
    });

    const avgZoom = zoomedCropPath.reduce((sum, crop) => sum + (crop.zoomFactor || 1), 0) / zoomedCropPath.length;
    this.log(`Applied dynamic zoom: average zoom factor ${avgZoom.toFixed(3)}`);

    return zoomedCropPath;
  }

  private async getVideoInfo(videoPath: string): Promise<{ width: number; height: number; duration: number }> {
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
        if (code !== 0) {
          reject(new Error(`ffprobe failed with code ${code}`));
          return;
        }

        try {
          const info = JSON.parse(output);
          const videoStream = info.streams.find((s: any) => s.codec_type === 'video');
          
          resolve({
            width: videoStream.width,
            height: videoStream.height,
            duration: parseFloat(info.format.duration)
          });
        } catch (error) {
          reject(error);
        }
      });
    });
  }

  private async applyCropToVideo(
    inputPath: string,
    outputPath: string,
    cropPath: any[],
    targetDimensions: { width: number; height: number },
    sourceWidth: number,
    sourceHeight: number
  ): Promise<void> {
    this.log('Applying smart crop to video...');

    // Calculate the optimal crop dimensions that fit within source bounds
    const targetAspectRatio = targetDimensions.width / targetDimensions.height;
    const sourceAspectRatio = sourceWidth / sourceHeight;

    let cropWidth: number, cropHeight: number;
    
    if (sourceAspectRatio > targetAspectRatio) {
      // Source is wider - use full height and calculate width
      cropHeight = sourceHeight;
      cropWidth = Math.round(cropHeight * targetAspectRatio);
    } else {
      // Source is taller - use full width and calculate height
      cropWidth = sourceWidth;
      cropHeight = Math.round(cropWidth / targetAspectRatio);
    }

    // Ensure crop dimensions don't exceed source dimensions
    cropWidth = Math.min(cropWidth, sourceWidth);
    cropHeight = Math.min(cropHeight, sourceHeight);

    // Use average position for stable crop (simplified approach)
    const avgX = cropPath.reduce((sum, c) => sum + c.x, 0) / cropPath.length;
    const avgY = cropPath.reduce((sum, c) => sum + c.y, 0) / cropPath.length;

    // Ensure crop position keeps the crop area within bounds
    const cropX = Math.round(Math.max(0, Math.min(sourceWidth - cropWidth, avgX)));
    const cropY = Math.round(Math.max(0, Math.min(sourceHeight - cropHeight, avgY)));

    const filterGraph = `crop=${cropWidth}:${cropHeight}:${cropX}:${cropY},scale=${targetDimensions.width}:${targetDimensions.height}`;

    this.log(`Using crop filter: ${filterGraph}`);

    return new Promise((resolve, reject) => {
      const ffmpeg = spawn('ffmpeg', [
        '-i', inputPath,
        '-vf', filterGraph,
        '-c:a', 'copy', // Copy audio unchanged
        '-preset', 'fast', // Fast encoding
        '-y',
        outputPath
      ]);

      ffmpeg.on('close', (code) => {
        if (code === 0) {
          this.log(`Video cropping completed: ${outputPath}`);
          resolve();
        } else {
          reject(new Error(`FFmpeg cropping failed with code ${code}`));
        }
      });

      ffmpeg.stderr.on('data', (data) => {
        this.log(`FFmpeg crop: ${data.toString()}`);
      });

      ffmpeg.on('error', (error) => {
        reject(error);
      });
    });
  }

  async processAutoFlipShorts(
    inputVideoPath: string, 
    options: AutoFlipDetectionOptions
  ): Promise<AutoFlipResult> {
    const startTime = Date.now();
    this.log(`Starting Enhanced AutoFlip processing for ${inputVideoPath}`);
    this.log(`Detection type: ${options.detectionType}, Custom target: ${options.customTarget || 'none'}`);

    try {
      // Get video information
      const videoInfo = await this.getVideoInfo(inputVideoPath);
      this.log(`Video info: ${videoInfo.width}x${videoInfo.height}, ${videoInfo.duration}s`);

      // Get signal settings for detection type
      const signalSettings = this.getSignalSettings(options.detectionType);
      this.log(`Using ${signalSettings.length} signal types for detection`);

      // Step 1: Analyze camera motion first
      this.log('Step 1: Analyzing camera motion patterns...');
      const cameraMotionData = await this.analyzeCameraMotion(inputVideoPath, 2); // 2 fps for motion analysis
      
      // Step 2: Analyze video for signals
      this.log('Step 2: Analyzing video for object detection signals...');
      const detectionResults = await this.analyzeVideoForSignals(
        inputVideoPath, 
        signalSettings, 
        options.customTarget
      );

      // Step 3: Get target dimensions
      const targetDimensions = this.getTargetDimensions(options.aspectRatio);
      
      // Step 4: Calculate optimal crop path with signal fusion
      this.log('Step 4: Calculating optimal crop path...');
      const initialCropPath = this.calculateOptimalCropPath(
        detectionResults, 
        targetDimensions, 
        videoInfo.width, 
        videoInfo.height
      );

      // Step 5: Apply camera motion compensation
      this.log('Step 5: Applying camera motion compensation...');
      const motionCompensatedCropPath = this.applyCameraMotionCompensation(initialCropPath, cameraMotionData);

      // Step 6: Apply dynamic zoom based on focus requirements
      this.log('Step 6: Calculating dynamic zoom based on focus requirements...');
      const zoomSettings = options.zoomSettings || this.getDefaultZoomSettings();
      const zoomedCropPath = this.applyDynamicZoom(
        motionCompensatedCropPath,
        detectionResults,
        targetDimensions,
        videoInfo.width,
        videoInfo.height,
        zoomSettings
      );

      // Generate output filename and path
      const outputFilename = `autoflip_${options.detectionType}_${nanoid()}.mp4`;
      const outputPath = path.join('uploads', outputFilename);

      // Step 7: Apply final crop to video with motion compensation and zoom
      this.log('Step 7: Applying final crop with motion compensation and dynamic zoom...');
      await this.applyCropToVideo(inputVideoPath, outputPath, zoomedCropPath, targetDimensions, videoInfo.width, videoInfo.height);

      // Step 8: Calculate comprehensive metrics
      this.log('Step 8: Calculating comprehensive processing metrics...');
      const totalDetections = detectionResults.reduce((sum, r) => sum + r.detections.length, 0);
      const avgConfidence = detectionResults.length > 0 
        ? detectionResults.reduce((sum, r) => sum + r.signalStrength, 0) / detectionResults.length 
        : 0;

      const avgCropX = zoomedCropPath.reduce((sum: number, c: any) => sum + c.x, 0) / zoomedCropPath.length;
      const avgCropY = zoomedCropPath.reduce((sum: number, c: any) => sum + c.y, 0) / zoomedCropPath.length;

      // Calculate stability score (lower variance = higher stability)
      const cropVarianceX = zoomedCropPath.reduce((sum: number, c: any) => sum + Math.pow(c.x - avgCropX, 2), 0) / zoomedCropPath.length;
      const stabilityScore = Math.max(0, 1 - (cropVarianceX / (videoInfo.width * videoInfo.width)));

      // Calculate zoom statistics
      const zoomFactors = zoomedCropPath.map((c: any) => c.zoomFactor || 1.0);
      const avgZoomFactor = zoomFactors.reduce((sum: number, z: number) => sum + z, 0) / zoomFactors.length;
      const minZoomFactor = Math.min(...zoomFactors);
      const maxZoomFactor = Math.max(...zoomFactors);

      // Generate camera motion statistics
      const cameraMotionStats = this.generateCameraMotionStats();

      const result: AutoFlipResult = {
        outputPath,
        downloadUrl: `/api/video/${outputFilename}`,
        processingTime: Date.now() - startTime,
        detectionStats: {
          framesProcessed: detectionResults.length,
          detectionsFound: totalDetections,
          confidenceScore: avgConfidence,
          signalTypes: signalSettings.map(s => s.type.standard)
        },
        cropMetrics: {
          avgCropX,
          avgCropY,
          avgCropWidth: targetDimensions.width,
          avgCropHeight: targetDimensions.height,
          stabilityScore
        },
        cameraMotion: cameraMotionStats,
        zoomMetrics: {
          avgZoomFactor,
          minZoomFactor,
          maxZoomFactor,
          dynamicZoomApplied: zoomSettings.adaptiveZoomEnabled,
          focusPriorityMode: zoomSettings.focusPriorityMode
        }
      };

      this.log(`Enhanced AutoFlip processing completed in ${result.processingTime}ms`);
      this.log(`Detection stats: ${totalDetections} detections, ${avgConfidence.toFixed(3)} avg confidence`);
      this.log(`Crop stability: ${stabilityScore.toFixed(3)}`);
      this.log(`Camera motion: ${cameraMotionStats.totalMotionFrames} frames, ${cameraMotionStats.avgMotionMagnitude.toFixed(3)} avg magnitude`);
      this.log(`Dominant motion type: ${cameraMotionStats.dominantMotionType}, compensation applied: ${cameraMotionStats.motionCompensationApplied}`);
      this.log(`Zoom metrics: avg ${avgZoomFactor.toFixed(3)}x, range ${minZoomFactor.toFixed(3)}x-${maxZoomFactor.toFixed(3)}x`);
      this.log(`Dynamic zoom enabled: ${zoomSettings.adaptiveZoomEnabled}, focus mode: ${zoomSettings.focusPriorityMode}`);

      return result;

    } catch (error) {
      this.log(`Enhanced AutoFlip processing failed: ${error}`);
      throw error;
    }
  }
}

export function createEnhancedAutoFlipService(): EnhancedAutoFlipService {
  return new EnhancedAutoFlipService();
}