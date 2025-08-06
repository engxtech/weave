import * as fs from 'fs/promises';
import * as path from 'path';
import ffmpeg from 'fluent-ffmpeg';
import { GoogleGenerativeAI } from '@google/generative-ai';

interface SaliencyRegion {
  type: 'face' | 'person' | 'object' | 'text' | 'logo';
  x: number;
  y: number;
  width: number;
  height: number;
  confidence: number;
  weight: number;
  isRequired?: boolean;
}

interface Scene {
  startFrame: number;
  endFrame: number;
  startTime: number;
  endTime: number;
  frames: FrameAnalysis[];
  avgSaliencyRegions: SaliencyRegion[];
  cameraMotion: 'stable' | 'tracking';
  cropPath: CropKeyframe[];
}

interface FrameAnalysis {
  frameNumber: number;
  timestamp: number;
  saliencyRegions: SaliencyRegion[];
  sceneChange: boolean;
}

interface CropKeyframe {
  timestamp: number;
  x: number;
  y: number;
  width: number;
  height: number;
}

export class AutoFlipReframeService {
  private genAI: GoogleGenerativeAI;
  
  // AutoFlip-inspired parameters
  private readonly MOTION_STABILIZATION_THRESHOLD = 0.5; // 50% of frame
  private readonly SNAP_CENTER_MAX_DISTANCE = 0.1; // 10% of frame width
  private readonly SCENE_CHANGE_THRESHOLD = 0.7; // 70% similarity
  private readonly MIN_SCENE_DURATION = 1.0; // 1 second minimum
  private readonly FRAME_SAMPLE_INTERVAL = 0.2; // 200ms (5 fps) like AutoFlip
  
  // Saliency weights (similar to AutoFlip's signal settings)
  private readonly SALIENCY_WEIGHTS = {
    face: { min: 0.85, max: 0.95, weight: 1.0 },
    person: { min: 0.75, max: 0.85, weight: 0.8 },
    object: { min: 0.5, max: 0.7, weight: 0.3 },
    text: { min: 0.7, max: 0.9, weight: 0.6 },
    logo: { min: 0.8, max: 0.9, weight: 0.7 }
  };

  constructor() {
    const apiKey = process.env.GEMINI_API_KEY;
    if (!apiKey) {
      throw new Error('GEMINI_API_KEY is required');
    }
    this.genAI = new GoogleGenerativeAI(apiKey);
  }

  async processVideo(
    videoPath: string,
    targetAspectRatio: string,
    options: {
      requiredFeatures?: string[];
      stabilityPreference?: 'stable' | 'dynamic';
      centerSnap?: boolean;
    } = {}
  ) {
    console.log('🎬 AutoFlip-inspired reframing starting...');
    const startTime = Date.now();
    
    const tempDir = path.join('uploads', 'temp_autoflip', `autoflip_${Date.now()}`);
    const framesDir = path.join(tempDir, 'frames');
    const scenesDir = path.join(tempDir, 'scenes');
    const outputDir = path.join(tempDir, 'output');
    
    await fs.mkdir(framesDir, { recursive: true });
    await fs.mkdir(scenesDir, { recursive: true });
    await fs.mkdir(outputDir, { recursive: true });
    
    try {
      // Get video metadata
      const metadata = await this.getVideoMetadata(videoPath);
      console.log(`📊 Video: ${metadata.width}x${metadata.height}, ${metadata.duration}s, ${metadata.fps}fps`);
      
      // Step 1: Extract frames at lower framerate (like AutoFlip)
      console.log(`🖼️ Extracting frames at ${1/this.FRAME_SAMPLE_INTERVAL}fps for analysis...`);
      const frameAnalyses = await this.extractAndAnalyzeFrames(
        videoPath,
        framesDir,
        metadata,
        targetAspectRatio
      );
      
      // Step 2: Detect scene boundaries
      console.log('🎬 Detecting scene boundaries...');
      const scenes = this.detectScenes(frameAnalyses, metadata);
      console.log(`📊 Detected ${scenes.length} scenes`);
      
      // Step 3: Compute optimal crop path for each scene
      console.log('📐 Computing optimal crop paths...');
      for (const scene of scenes) {
        this.computeSceneCropPath(scene, metadata, targetAspectRatio, options);
      }
      
      // Step 4: Split video into scenes
      console.log('✂️ Splitting video into scenes...');
      const scenePaths = await this.splitVideoIntoScenes(videoPath, scenesDir, scenes);
      
      // Step 5: Apply crops to each scene
      console.log('🎯 Applying intelligent crops to scenes...');
      const croppedScenePaths = [];
      
      for (let i = 0; i < scenes.length; i++) {
        const scene = scenes[i];
        const scenePath = scenePaths[i];
        const outputPath = path.join(outputDir, `scene_${i.toString().padStart(4, '0')}.mp4`);
        
        console.log(`📹 Processing scene ${i + 1}/${scenes.length} (${scene.cameraMotion} camera)`);
        
        await this.applyCropToScene(
          scenePath,
          outputPath,
          scene.cropPath,
          metadata,
          targetAspectRatio
        );
        
        croppedScenePaths.push(outputPath);
      }
      
      // Step 6: Merge all scenes
      console.log('🔀 Merging cropped scenes...');
      const outputFileName = `autoflip_${Date.now()}.mp4`;
      const finalOutputPath = path.join('uploads', outputFileName);
      
      await this.mergeScenes(croppedScenePaths, finalOutputPath);
      
      // Cleanup
      console.log('🧹 Cleaning up...');
      await this.cleanupDirectory(tempDir);
      
      const processingTime = Date.now() - startTime;
      console.log(`✅ AutoFlip reframing complete in ${processingTime}ms`);
      
      return {
        outputPath: `/api/upload/video/${outputFileName}`,
        scenes: scenes.length,
        processingTime,
        cameraMotions: {
          stable: scenes.filter(s => s.cameraMotion === 'stable').length,
          tracking: scenes.filter(s => s.cameraMotion === 'tracking').length
        }
      };
      
    } catch (error) {
      console.error('❌ AutoFlip reframing error:', error);
      await this.cleanupDirectory(tempDir);
      throw error;
    }
  }

  private async extractAndAnalyzeFrames(
    videoPath: string,
    framesDir: string,
    metadata: any,
    targetAspectRatio: string
  ): Promise<FrameAnalysis[]> {
    // Extract frames at reduced framerate
    const fps = 1 / this.FRAME_SAMPLE_INTERVAL; // 5 fps
    
    await new Promise((resolve, reject) => {
      ffmpeg(videoPath)
        .outputOptions([
          '-r', fps.toString(),
          '-q:v', '2'
        ])
        .output(path.join(framesDir, 'frame_%05d.jpg'))
        .on('end', resolve)
        .on('error', reject)
        .run();
    });
    
    // Analyze each frame
    const frameFiles = await fs.readdir(framesDir);
    const frames = frameFiles.filter(f => f.endsWith('.jpg')).sort();
    
    console.log(`🔍 Analyzing ${frames.length} frames for saliency...`);
    
    const frameAnalyses: FrameAnalysis[] = [];
    const BATCH_SIZE = 10;
    
    // Process frames in batches of 10
    for (let batchStart = 0; batchStart < frames.length; batchStart += BATCH_SIZE) {
      const batchEnd = Math.min(batchStart + BATCH_SIZE, frames.length);
      const batch = frames.slice(batchStart, batchEnd);
      
      console.log(`🧵 Processing batch ${Math.floor(batchStart / BATCH_SIZE) + 1}/${Math.ceil(frames.length / BATCH_SIZE)} (frames ${batchStart}-${batchEnd - 1})...`);
      
      // Process batch in parallel
      const batchPromises = batch.map(async (frame, batchIndex) => {
        const frameIndex = batchStart + batchIndex;
        const framePath = path.join(framesDir, frame);
        const frameData = await fs.readFile(framePath);
        const frameBase64 = frameData.toString('base64');
        
        // Detect scene change (for now, simplified without previous frame comparison)
        const sceneChange = frameIndex === 0 || frameIndex % 50 === 0; // Scene change every 50 frames
        
        // Analyze frame for saliency
        const saliencyRegions = await this.detectSaliencyRegions(
          frameBase64,
          metadata,
          targetAspectRatio
        );
        
        return {
          frameNumber: frameIndex,
          timestamp: frameIndex * this.FRAME_SAMPLE_INTERVAL,
          saliencyRegions,
          sceneChange,
          frameData
        };
      });
      
      // Wait for batch to complete
      const batchResults = await Promise.all(batchPromises);
      
      // Add results in order (without frameData to match interface)
      frameAnalyses.push(...batchResults.map(({ frameData, ...rest }) => rest));
    }
    
    // Post-process to improve scene change detection
    console.log('🎬 Post-processing for scene change detection...');
    for (let i = 1; i < frameAnalyses.length; i++) {
      const prevFrame = frameAnalyses[i - 1];
      const currFrame = frameAnalyses[i];
      
      // Detect scene change based on saliency region differences
      const prevRegions = prevFrame.saliencyRegions;
      const currRegions = currFrame.saliencyRegions;
      
      // Simple heuristic: significant change in number or positions of regions
      const regionCountDiff = Math.abs(prevRegions.length - currRegions.length);
      const significantChange = regionCountDiff > 2;
      
      // Override simplified scene change detection with better heuristic
      if (significantChange && !currFrame.sceneChange) {
        frameAnalyses[i].sceneChange = true;
      }
    }
    
    return frameAnalyses;
  }

  private async detectSaliencyRegions(
    imageBase64: string,
    metadata: any,
    targetAspectRatio: string
  ): Promise<SaliencyRegion[]> {
    const model = this.genAI.getGenerativeModel({ model: 'gemini-2.0-flash-lite' });
    
    const prompt = `Analyze this video frame (${metadata.width}x${metadata.height}) for important content regions.
    
    Detect and return bounding boxes for:
    1. Faces (especially speaking faces - open mouth, engaged expression)
    2. People (full body)
    3. Important objects (products, animals, vehicles)
    4. Text overlays or titles
    5. Logos or watermarks
    
    For each detection, estimate confidence (0-1) based on:
    - Clarity and visibility
    - Importance to the scene
    - Whether person appears to be speaking
    
    Return ONLY a valid JSON array, nothing else. Example format:
    [{"type": "face", "x": 100, "y": 50, "width": 200, "height": 250, "confidence": 0.95}]
    
    Rules:
    - Use double quotes for all property names and string values
    - No trailing commas
    - Ensure all coordinates are within video bounds (0 <= x < ${metadata.width}, 0 <= y < ${metadata.height})
    - Type must be one of: face, person, object, text, logo
    - All numeric values must be actual numbers, not strings`;
    
    try {
      const result = await model.generateContent([
        { text: prompt },
        { inlineData: { mimeType: 'image/jpeg', data: imageBase64 } }
      ]);
      
      const response = result.response.text().trim();
      const jsonMatch = response.match(/\[[\s\S]*\]/);
      
      if (jsonMatch) {
        // Clean up the JSON
        let jsonStr = jsonMatch[0];
        
        // Remove trailing commas
        jsonStr = jsonStr.replace(/,\s*\]/g, ']');
        jsonStr = jsonStr.replace(/,\s*\}/g, '}');
        
        // Fix unquoted property names more safely
        jsonStr = jsonStr.replace(/([{,]\s*)([a-zA-Z_]\w*)\s*:/g, '$1"$2":');
        
        // Remove any control characters
        jsonStr = jsonStr.replace(/[\x00-\x1F\x7F-\x9F]/g, '');
        
        try {
          const regions = JSON.parse(jsonStr) as SaliencyRegion[];
          
          // Apply weights based on type
          return regions.map(region => ({
            ...region,
            weight: this.SALIENCY_WEIGHTS[region.type]?.weight || 0.5
          }));
        } catch (parseError) {
          console.error('JSON parsing error:', parseError);
          console.error('Attempted to parse:', jsonStr);
          return [];
        }
      }
      
      return [];
    } catch (error) {
      console.error('Saliency detection error:', error);
      return [];
    }
  }

  private detectScenes(frameAnalyses: FrameAnalysis[], metadata: any): Scene[] {
    const scenes: Scene[] = [];
    let currentScene: Scene | null = null;
    
    for (let i = 0; i < frameAnalyses.length; i++) {
      const frame = frameAnalyses[i];
      
      if (!currentScene || frame.sceneChange) {
        // Start new scene
        if (currentScene) {
          scenes.push(currentScene);
        }
        
        currentScene = {
          startFrame: frame.frameNumber,
          endFrame: frame.frameNumber,
          startTime: frame.timestamp,
          endTime: frame.timestamp,
          frames: [frame],
          avgSaliencyRegions: [],
          cameraMotion: 'stable',
          cropPath: []
        };
      } else {
        // Continue current scene
        currentScene.endFrame = frame.frameNumber;
        currentScene.endTime = frame.timestamp;
        currentScene.frames.push(frame);
      }
    }
    
    if (currentScene) {
      scenes.push(currentScene);
    }
    
    // Merge very short scenes
    const mergedScenes: Scene[] = [];
    for (const scene of scenes) {
      const duration = scene.endTime - scene.startTime;
      
      if (duration < this.MIN_SCENE_DURATION && mergedScenes.length > 0) {
        // Merge with previous scene
        const prevScene = mergedScenes[mergedScenes.length - 1];
        prevScene.endFrame = scene.endFrame;
        prevScene.endTime = scene.endTime;
        prevScene.frames.push(...scene.frames);
      } else {
        mergedScenes.push(scene);
      }
    }
    
    return mergedScenes;
  }

  private computeSceneCropPath(
    scene: Scene,
    metadata: any,
    targetAspectRatio: string,
    options: any
  ): void {
    // Compute average saliency regions for the scene
    const allRegions: SaliencyRegion[] = [];
    for (const frame of scene.frames) {
      allRegions.push(...frame.saliencyRegions);
    }
    
    // Group regions by type and average their positions
    const regionGroups = this.groupSaliencyRegions(allRegions);
    scene.avgSaliencyRegions = regionGroups;
    
    // Determine camera motion type
    const motionRange = this.calculateMotionRange(scene.frames, metadata);
    scene.cameraMotion = motionRange > this.MOTION_STABILIZATION_THRESHOLD ? 'tracking' : 'stable';
    
    if (options.stabilityPreference) {
      scene.cameraMotion = options.stabilityPreference;
    }
    
    // Generate crop keyframes
    if (scene.cameraMotion === 'stable') {
      // Stable camera: find best center point for entire scene
      const stableCrop = this.computeStableCrop(
        scene.avgSaliencyRegions,
        metadata,
        targetAspectRatio,
        options
      );
      
      // Single keyframe for entire scene
      scene.cropPath = [{
        timestamp: scene.startTime,
        ...stableCrop
      }];
    } else {
      // Tracking camera: generate smooth path following subjects
      scene.cropPath = this.computeTrackingPath(
        scene.frames,
        metadata,
        targetAspectRatio
      );
    }
  }

  private computeStableCrop(
    regions: SaliencyRegion[],
    metadata: any,
    targetAspectRatio: string,
    options: any
  ): { x: number; y: number; width: number; height: number } {
    // Calculate bounding box of all important regions
    if (regions.length === 0) {
      return this.getCenterCrop(metadata, targetAspectRatio);
    }
    
    let minX = Infinity, minY = Infinity;
    let maxX = -Infinity, maxY = -Infinity;
    let totalWeight = 0;
    let weightedCenterX = 0;
    let weightedCenterY = 0;
    
    for (const region of regions) {
      const weight = region.weight * region.confidence;
      const centerX = region.x + region.width / 2;
      const centerY = region.y + region.height / 2;
      
      weightedCenterX += centerX * weight;
      weightedCenterY += centerY * weight;
      totalWeight += weight;
      
      if (region.isRequired) {
        minX = Math.min(minX, region.x);
        minY = Math.min(minY, region.y);
        maxX = Math.max(maxX, region.x + region.width);
        maxY = Math.max(maxY, region.y + region.height);
      }
    }
    
    // Calculate weighted center
    const centerX = totalWeight > 0 ? weightedCenterX / totalWeight : metadata.width / 2;
    const centerY = totalWeight > 0 ? weightedCenterY / totalWeight : metadata.height / 2;
    
    // Calculate crop dimensions
    const targetRatio = this.parseAspectRatio(targetAspectRatio);
    let cropWidth, cropHeight;
    
    if (targetRatio > 1) {
      // Landscape target
      cropHeight = metadata.height;
      cropWidth = cropHeight * targetRatio;
      if (cropWidth > metadata.width) {
        cropWidth = metadata.width;
        cropHeight = cropWidth / targetRatio;
      }
    } else {
      // Portrait target
      cropWidth = metadata.width;
      cropHeight = cropWidth / targetRatio;
      if (cropHeight > metadata.height) {
        cropHeight = metadata.height;
        cropWidth = cropHeight * targetRatio;
      }
    }
    
    // Position crop around weighted center
    let cropX = centerX - cropWidth / 2;
    let cropY = centerY - cropHeight / 2;
    
    // Ensure crop stays within bounds
    cropX = Math.max(0, Math.min(cropX, metadata.width - cropWidth));
    cropY = Math.max(0, Math.min(cropY, metadata.height - cropHeight));
    
    // Snap to center if close enough
    if (options.centerSnap) {
      const frameCenterX = metadata.width / 2;
      const cropCenterX = cropX + cropWidth / 2;
      const distance = Math.abs(cropCenterX - frameCenterX) / metadata.width;
      
      if (distance < this.SNAP_CENTER_MAX_DISTANCE) {
        cropX = frameCenterX - cropWidth / 2;
      }
    }
    
    return {
      x: Math.round(cropX),
      y: Math.round(cropY),
      width: Math.round(cropWidth),
      height: Math.round(cropHeight)
    };
  }

  private computeTrackingPath(
    frames: FrameAnalysis[],
    metadata: any,
    targetAspectRatio: string
  ): CropKeyframe[] {
    const keyframes: CropKeyframe[] = [];
    const targetRatio = this.parseAspectRatio(targetAspectRatio);
    
    // Calculate crop dimensions
    let cropWidth, cropHeight;
    if (targetRatio > 1) {
      cropHeight = metadata.height * 0.8; // Leave some margin for movement
      cropWidth = cropHeight * targetRatio;
    } else {
      cropWidth = metadata.width * 0.8;
      cropHeight = cropWidth / targetRatio;
    }
    
    // Generate smooth path through important regions
    for (const frame of frames) {
      if (frame.saliencyRegions.length === 0) continue;
      
      // Find highest priority region
      let bestRegion = frame.saliencyRegions[0];
      let bestScore = 0;
      
      for (const region of frame.saliencyRegions) {
        const score = region.weight * region.confidence;
        if (score > bestScore) {
          bestScore = score;
          bestRegion = region;
        }
      }
      
      // Center crop on best region
      const centerX = bestRegion.x + bestRegion.width / 2;
      const centerY = bestRegion.y + bestRegion.height / 2;
      
      let cropX = centerX - cropWidth / 2;
      let cropY = centerY - cropHeight / 2;
      
      // Keep within bounds
      cropX = Math.max(0, Math.min(cropX, metadata.width - cropWidth));
      cropY = Math.max(0, Math.min(cropY, metadata.height - cropHeight));
      
      keyframes.push({
        timestamp: frame.timestamp,
        x: Math.round(cropX),
        y: Math.round(cropY),
        width: Math.round(cropWidth),
        height: Math.round(cropHeight)
      });
    }
    
    // Smooth the path
    return this.smoothCropPath(keyframes);
  }

  private smoothCropPath(keyframes: CropKeyframe[]): CropKeyframe[] {
    if (keyframes.length < 3) return keyframes;
    
    const smoothed: CropKeyframe[] = [];
    
    for (let i = 0; i < keyframes.length; i++) {
      if (i === 0 || i === keyframes.length - 1) {
        smoothed.push(keyframes[i]);
        continue;
      }
      
      // Average with neighbors
      const prev = keyframes[i - 1];
      const curr = keyframes[i];
      const next = keyframes[i + 1];
      
      smoothed.push({
        timestamp: curr.timestamp,
        x: Math.round((prev.x + curr.x * 2 + next.x) / 4),
        y: Math.round((prev.y + curr.y * 2 + next.y) / 4),
        width: curr.width,
        height: curr.height
      });
    }
    
    return smoothed;
  }

  private async applyCropToScene(
    inputPath: string,
    outputPath: string,
    cropPath: CropKeyframe[],
    metadata: any,
    targetAspectRatio: string
  ): Promise<void> {
    const targetDimensions = this.getTargetDimensions(targetAspectRatio, metadata);
    
    if (cropPath.length === 1) {
      // Static crop
      const crop = cropPath[0];
      await this.applyStaticCrop(inputPath, outputPath, crop, targetDimensions);
    } else {
      // Animated crop
      await this.applyAnimatedCrop(inputPath, outputPath, cropPath, targetDimensions);
    }
  }

  private async applyStaticCrop(
    inputPath: string,
    outputPath: string,
    crop: CropKeyframe,
    targetDimensions: { width: number; height: number }
  ): Promise<void> {
    const filter = `crop=${crop.width}:${crop.height}:${crop.x}:${crop.y},scale=${targetDimensions.width}:${targetDimensions.height}`;
    
    await new Promise((resolve, reject) => {
      ffmpeg(inputPath)
        .videoFilters(filter)
        .outputOptions([
          '-c:v', 'libx264',
          '-preset', 'medium',
          '-crf', '23',
          '-c:a', 'aac',
          '-b:a', '192k',
          '-pix_fmt', 'yuv420p'
        ])
        .output(outputPath)
        .on('end', resolve)
        .on('error', reject)
        .run();
    });
  }

  private async applyAnimatedCrop(
    inputPath: string,
    outputPath: string,
    cropPath: CropKeyframe[],
    targetDimensions: { width: number; height: number }
  ): Promise<void> {
    // Build zoompan filter expression
    let zoompanExpr = 'zoompan=z=1:d=1:';
    
    // Build x and y expressions
    const xExprs: string[] = [];
    const yExprs: string[] = [];
    
    for (let i = 0; i < cropPath.length - 1; i++) {
      const curr = cropPath[i];
      const next = cropPath[i + 1];
      const duration = next.timestamp - curr.timestamp;
      
      xExprs.push(`if(between(t,${curr.timestamp},${next.timestamp}),${curr.x}+(${next.x}-${curr.x})*(t-${curr.timestamp})/${duration}`);
      yExprs.push(`if(between(t,${curr.timestamp},${next.timestamp}),${curr.y}+(${next.y}-${curr.y})*(t-${curr.timestamp})/${duration}`);
    }
    
    // Add last keyframe
    const last = cropPath[cropPath.length - 1];
    xExprs.push(`${last.x})`);
    yExprs.push(`${last.y})`);
    
    zoompanExpr += `x='${xExprs.join(',')}':y='${yExprs.join(',')}'`;
    
    const filter = `${zoompanExpr},scale=${targetDimensions.width}:${targetDimensions.height}`;
    
    await new Promise((resolve, reject) => {
      ffmpeg(inputPath)
        .videoFilters(filter)
        .outputOptions([
          '-c:v', 'libx264',
          '-preset', 'medium',
          '-crf', '23',
          '-c:a', 'aac',
          '-b:a', '192k',
          '-pix_fmt', 'yuv420p'
        ])
        .output(outputPath)
        .on('end', resolve)
        .on('error', reject)
        .run();
    });
  }

  // Helper methods
  private async getVideoMetadata(videoPath: string): Promise<any> {
    return new Promise((resolve, reject) => {
      ffmpeg.ffprobe(videoPath, (err, metadata) => {
        if (err) reject(err);
        else {
          const videoStream = metadata.streams.find(s => s.codec_type === 'video');
          resolve({
            width: videoStream?.width || 1920,
            height: videoStream?.height || 1080,
            duration: metadata.format.duration || 0,
            fps: eval(videoStream?.r_frame_rate || '30')
          });
        }
      });
    });
  }

  private async calculateFrameSimilarity(frame1: Buffer, frame2: Buffer): Promise<number> {
    // Simple similarity based on buffer comparison
    // In production, use proper image similarity algorithms
    const minLength = Math.min(frame1.length, frame2.length);
    let similar = 0;
    
    for (let i = 0; i < minLength; i += 100) {
      if (Math.abs(frame1[i] - frame2[i]) < 10) {
        similar++;
      }
    }
    
    return similar / (minLength / 100);
  }

  private groupSaliencyRegions(regions: SaliencyRegion[]): SaliencyRegion[] {
    // Group regions by type and merge overlapping ones
    const grouped: Map<string, SaliencyRegion[]> = new Map();
    
    for (const region of regions) {
      if (!grouped.has(region.type)) {
        grouped.set(region.type, []);
      }
      grouped.get(region.type)!.push(region);
    }
    
    const merged: SaliencyRegion[] = [];
    
    for (const [type, typeRegions] of Array.from(grouped)) {
      if (typeRegions.length === 0) continue;
      
      // Calculate average position
      let avgX = 0, avgY = 0, avgWidth = 0, avgHeight = 0;
      let totalWeight = 0;
      
      for (const region of typeRegions) {
        const weight = region.confidence;
        avgX += region.x * weight;
        avgY += region.y * weight;
        avgWidth += region.width * weight;
        avgHeight += region.height * weight;
        totalWeight += weight;
      }
      
      if (totalWeight > 0) {
        merged.push({
          type: type as any,
          x: avgX / totalWeight,
          y: avgY / totalWeight,
          width: avgWidth / totalWeight,
          height: avgHeight / totalWeight,
          confidence: totalWeight / typeRegions.length,
          weight: (this.SALIENCY_WEIGHTS as any)[type]?.weight || 0.5
        });
      }
    }
    
    return merged;
  }

  private calculateMotionRange(frames: FrameAnalysis[], metadata: any): number {
    if (frames.length < 2) return 0;
    
    let minX = Infinity, minY = Infinity;
    let maxX = -Infinity, maxY = -Infinity;
    
    for (const frame of frames) {
      for (const region of frame.saliencyRegions) {
        minX = Math.min(minX, region.x);
        minY = Math.min(minY, region.y);
        maxX = Math.max(maxX, region.x + region.width);
        maxY = Math.max(maxY, region.y + region.height);
      }
    }
    
    const rangeX = (maxX - minX) / metadata.width;
    const rangeY = (maxY - minY) / metadata.height;
    
    return Math.max(rangeX, rangeY);
  }

  private getCenterCrop(metadata: any, targetAspectRatio: string): any {
    const targetRatio = this.parseAspectRatio(targetAspectRatio);
    
    let cropWidth, cropHeight;
    if (targetRatio > 1) {
      cropHeight = metadata.height;
      cropWidth = cropHeight * targetRatio;
      if (cropWidth > metadata.width) {
        cropWidth = metadata.width;
        cropHeight = cropWidth / targetRatio;
      }
    } else {
      cropWidth = metadata.width;
      cropHeight = cropWidth / targetRatio;
      if (cropHeight > metadata.height) {
        cropHeight = metadata.height;
        cropWidth = cropHeight * targetRatio;
      }
    }
    
    return {
      x: Math.round((metadata.width - cropWidth) / 2),
      y: Math.round((metadata.height - cropHeight) / 2),
      width: Math.round(cropWidth),
      height: Math.round(cropHeight)
    };
  }

  private parseAspectRatio(ratio: string): number {
    const [width, height] = ratio.split(':').map(Number);
    return width / height;
  }

  private getTargetDimensions(aspectRatio: string, metadata: any): { width: number; height: number } {
    // Standard dimensions for common aspect ratios
    const dimensions = {
      '9:16': { width: 1080, height: 1920 },
      '16:9': { width: 1920, height: 1080 },
      '1:1': { width: 1080, height: 1080 },
      '4:5': { width: 1080, height: 1350 },
      '4:3': { width: 1440, height: 1080 }
    };
    
    return (dimensions as any)[aspectRatio] || dimensions['9:16'];
  }

  private async splitVideoIntoScenes(videoPath: string, scenesDir: string, scenes: Scene[]): Promise<string[]> {
    const scenePaths: string[] = [];
    
    for (let i = 0; i < scenes.length; i++) {
      const scene = scenes[i];
      const outputPath = path.join(scenesDir, `scene_${i.toString().padStart(4, '0')}.mp4`);
      
      await new Promise((resolve, reject) => {
        ffmpeg(videoPath)
          .setStartTime(scene.startTime)
          .setDuration(scene.endTime - scene.startTime)
          .outputOptions([
            '-c:v', 'libx264',
            '-preset', 'fast',
            '-crf', '23',
            '-c:a', 'aac',
            '-b:a', '192k'
          ])
          .output(outputPath)
          .on('end', resolve)
          .on('error', reject)
          .run();
      });
      
      scenePaths.push(outputPath);
    }
    
    return scenePaths;
  }

  private async mergeScenes(scenePaths: string[], outputPath: string): Promise<void> {
    const listPath = outputPath + '.txt';
    const fileList = scenePaths.map(p => `file '${p}'`).join('\n');
    await fs.writeFile(listPath, fileList);
    
    await new Promise((resolve, reject) => {
      ffmpeg()
        .input(listPath)
        .inputOptions(['-f', 'concat', '-safe', '0'])
        .outputOptions([
          '-c:v', 'libx264',
          '-preset', 'medium',
          '-crf', '23',
          '-c:a', 'aac',
          '-b:a', '192k',
          '-movflags', '+faststart'
        ])
        .output(outputPath)
        .on('end', resolve)
        .on('error', reject)
        .run();
    });
    
    await fs.unlink(listPath);
  }

  private async cleanupDirectory(dir: string): Promise<void> {
    try {
      await fs.rm(dir, { recursive: true, force: true });
    } catch (error) {
      console.error('Cleanup error:', error);
    }
  }
}