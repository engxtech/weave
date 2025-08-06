import { GoogleGenerativeAI } from '@google/generative-ai';
import ffmpeg from 'fluent-ffmpeg';
import fs from 'fs/promises';
import path from 'path';
import { AutoFlipReframeService } from './autoflip-reframe-service';

export class ReframeService {
  private genAI: GoogleGenerativeAI;
  private autoFlipService: AutoFlipReframeService;

  constructor() {
    this.genAI = new GoogleGenerativeAI(process.env.GEMINI_API_KEY || '');
    this.autoFlipService = new AutoFlipReframeService();
  }

  private async getVideoDuration(videoPath: string): Promise<number> {
    return new Promise((resolve, reject) => {
      ffmpeg.ffprobe(videoPath, (err, metadata) => {
        if (err) {
          reject(err);
        } else {
          resolve(metadata.format.duration || 0);
        }
      });
    });
  }

  async processReframe(inputPath: string, config: any): Promise<{
    outputPath: string;
    originalAspectRatio: string;
    targetAspectRatio: string;
    focusTracking: boolean;
    subjectsDetected: string[];
    processingTime: number;
  }> {
    const startTime = Date.now();
    console.log('🖼️ Starting reframe with config:', JSON.stringify(config, null, 2));
    console.log('🔍 Algorithm value:', config.algorithm);
    
    // Check if user wants to use AutoFlip-inspired algorithm
    if (config.algorithm === 'autoflip') {
      console.log('🎬 Using AutoFlip-inspired algorithm for better focus tracking...');
      const result = await this.autoFlipService.processVideo(
        inputPath,
        config.targetAspectRatio || '9:16',
        {
          requiredFeatures: config.focusSubject ? [config.focusSubject] : [],
          stabilityPreference: config.cameraMotion || 'dynamic',
          centerSnap: config.centerSnap !== false
        }
      );
      
      return {
        outputPath: result.outputPath,
        originalAspectRatio: config.originalAspectRatio || '16:9',
        targetAspectRatio: config.targetAspectRatio || '9:16',
        focusTracking: true,
        subjectsDetected: [],
        processingTime: result.processingTime
      };
    }
    
    // Otherwise use the standard algorithm
    console.log('🖼️ Using standard intelligent reframe algorithm...');
    
    // Convert URL path to file system path if needed
    let actualVideoPath = inputPath;
    if (inputPath.startsWith('/api/upload/video/')) {
      const filename = inputPath.replace('/api/upload/video/', '');
      actualVideoPath = path.join(process.cwd(), 'uploads', filename);
      console.log('Converted to file path:', actualVideoPath);
    }
    
    // Use segmentation approach if enabled (default: true)
    if (config.useSegmentation !== false) {
      return this.processSegmentedReframe(actualVideoPath, config, startTime);
    }
    
    const outputDir = path.join('uploads', 'reframed');
    await fs.mkdir(outputDir, { recursive: true });

    const outputPath = path.join(outputDir, `reframed_${Date.now()}.mp4`);

    try {
      // Get video metadata
      const metadata = await this.getVideoMetadata(actualVideoPath);
      
      // Analyze video for intelligent reframing
      const frameAnalysis = await this.analyzeVideoForReframing(
        actualVideoPath, 
        config.aspectRatio || '9:16',
        config.activeSpeakerDetection !== false,
        config.focusSubject || '',
        config.avoidSubject || '',
        metadata
      );
      
      // Apply intelligent reframing with subject tracking
      await this.applyIntelligentReframe(
        actualVideoPath, 
        outputPath, 
        metadata, 
        config, 
        frameAnalysis
      );
      
      const processingTime = Date.now() - startTime;
      
      return {
        outputPath,
        originalAspectRatio: `${metadata.width}:${metadata.height}`,
        targetAspectRatio: config.aspectRatio || '9:16',
        focusTracking: true,
        subjectsDetected: frameAnalysis.detectedSubjects || [],
        processingTime
      };
    } catch (error) {
      console.error('Reframe processing failed:', error);
      throw error;
    }
  }

  private async getVideoMetadata(videoPath: string): Promise<any> {
    return new Promise((resolve, reject) => {
      ffmpeg.ffprobe(videoPath, (err, metadata) => {
        if (err) reject(err);
        else {
          const video = metadata.streams.find(s => s.codec_type === 'video');
          resolve({
            width: video?.width || 1920,
            height: video?.height || 1080,
            duration: metadata.format.duration || 0,
            fps: eval(video?.r_frame_rate || '30/1')
          });
        }
      });
    });
  }

  private async analyzeVideoForReframing(
    videoPath: string, 
    targetRatio: string,
    activeSpeakerDetection: boolean,
    focusSubject: string,
    avoidSubject: string,
    metadata: any
  ): Promise<any> {
    const model = this.genAI.getGenerativeModel({ model: 'gemini-2.0-flash-exp' });
    
    // Extract frames at regular intervals for comprehensive analysis
    const framesDir = path.join('uploads', 'temp_frames', `frames_${Date.now()}`);
    await fs.mkdir(framesDir, { recursive: true });
    
    // Extract frames at intervals - more frames for shorter videos, fewer for longer ones
    const duration = await this.getVideoDuration(videoPath);
    const fps = duration < 30 ? 1 : duration < 120 ? 0.5 : 0.33; // 1fps for <30s, 0.5fps for <2min, 0.33fps for longer
    
    await new Promise((resolve, reject) => {
      ffmpeg(videoPath)
        .outputOptions([
          '-vf', `fps=${fps}`,
          '-q:v', '2'
        ])
        .output(path.join(framesDir, 'frame_%04d.jpg'))
        .on('end', resolve)
        .on('error', reject)
        .run();
    });

    const frames = await fs.readdir(framesDir);
    const frameAnalyses = [];
    const detectedSubjects = new Set<string>();

    // Limit frames to analyze to avoid rate limits
    const maxFramesToAnalyze = 10;
    const frameStep = Math.max(1, Math.floor(frames.length / maxFramesToAnalyze));
    const framesToAnalyze = frames.filter((_, index) => index % frameStep === 0).slice(0, maxFramesToAnalyze);
    
    console.log(`Analyzing ${framesToAnalyze.length} of ${frames.length} frames (every ${frameStep} frames)`);

    // Analyze selected frames for subjects and composition
    for (let idx = 0; idx < framesToAnalyze.length; idx++) {
      const frameIndex = idx * frameStep;
      const frame = framesToAnalyze[idx];
      const imagePath = path.join(framesDir, frame);
      const imageBuffer = await fs.readFile(imagePath);
      const imageBase64 = imageBuffer.toString('base64');
      
      // Add delay to avoid rate limits (100ms between requests)
      if (idx > 0) {
        await new Promise(resolve => setTimeout(resolve, 100));
      }

      const prompt = `Analyze this video frame and identify the main focus point for a 9:16 vertical video.
      
      IMPORTANT: Just give me the x,y coordinates of where to center the 9:16 crop.
      - If there are multiple people, identify the speaking person (open mouth, engaged expression)
      - If one person, focus on their face/upper body
      - If no people, focus on the most interesting part of the frame
      
      Return a simple JSON with:
      - frameTime: ${frameIndex}
      - focusPoint: {x, y} coordinates of where to center the 9:16 crop
      - detectedPeople: array of people positions [{x, y}]
      - speakingPersonIndex: index of speaking person (-1 if none)
      - confidence: 0 to 1
      
      Example: {"frameTime": 0, "focusPoint": {"x": 640, "y": 360}, "detectedPeople": [{"x": 500, "y": 300}, {"x": 800, "y": 350}], "speakingPersonIndex": 0, "confidence": 0.9}`;

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

        const responseText = result.response.text();
        
        // Check if response is empty or error
        if (!responseText || responseText.trim() === '') {
          console.warn(`Frame ${frameIndex}: Empty response from Gemini`);
          throw new Error('Empty response from Gemini');
        }
        
        console.log(`Frame ${frameIndex} Gemini response:`, responseText.substring(0, 200));
        
        // Extract JSON from response (handle cases where AI adds text)
        let analysis;
        try {
          // Clean the response - remove markdown code blocks if present
          let cleanResponse = responseText.trim();
          if (cleanResponse.includes('```json')) {
            cleanResponse = cleanResponse.replace(/```json\s*/g, '').replace(/```\s*/g, '');
          }
          if (cleanResponse.includes('```')) {
            cleanResponse = cleanResponse.replace(/```\s*/g, '');
          }
          
          // First try direct parsing
          analysis = JSON.parse(cleanResponse);
        } catch (e) {
          // Try to extract JSON from text
          const jsonMatch = responseText.match(/\{[\s\S]*\}/);
          if (jsonMatch) {
            try {
              analysis = JSON.parse(jsonMatch[0]);
            } catch (e2) {
              console.error(`Failed to parse JSON: ${jsonMatch[0]}`);
              throw new Error(`Failed to parse JSON from response`);
            }
          } else {
            console.error(`No JSON in response: ${responseText}`);
            throw new Error(`No JSON found in response`);
          }
        }
        
        // Validate the analysis has required fields
        if (!analysis.focusPoint || typeof analysis.frameTime !== 'number') {
          throw new Error('Invalid analysis format');
        }
        
        // Calculate the 9:16 crop box based on focus point
        analysis.optimalCrop = this.calculate916BoxFromFocusPoint(analysis.focusPoint, metadata);
        
        // Track detected subjects
        if (analysis.detectedPeople && analysis.detectedPeople.length > 0) {
          detectedSubjects.add('person');
          
          // Check if we have a speaking person
          if (analysis.speakingPersonIndex >= 0 && analysis.speakingPersonIndex < analysis.detectedPeople.length) {
            detectedSubjects.add('speaking_person');
            analysis.trackingFocus = 'speaking_person';
          }
        }
        
        frameAnalyses.push(analysis);
      } catch (error) {
        console.error(`Frame ${frameIndex} analysis failed:`, error);
        
        // Use center of frame as fallback focus point
        const centerFocusPoint = {
          x: metadata.width / 2,
          y: metadata.height / 2
        };
        
        frameAnalyses.push({
          frameTime: frameIndex,
          focusPoint: centerFocusPoint,
          optimalCrop: this.calculate916BoxFromFocusPoint(centerFocusPoint, metadata),
          confidence: 0.5
        });
      }
    }

    // Cleanup temp frames
    await fs.rm(framesDir, { recursive: true }).catch(() => {});

    // Smooth crop transitions between frames
    const smoothedCrops = this.smoothCropTransitions(frameAnalyses);

    return {
      frameAnalyses: smoothedCrops,
      detectedSubjects: Array.from(detectedSubjects),
      totalFrames: frames.length
    };
  }

  private smoothCropTransitions(frameAnalyses: any[]): any[] {
    // Apply smoothing to prevent jittery crops
    const smoothed = [...frameAnalyses];
    
    // Track zoom levels for smooth transitions
    for (let i = 1; i < smoothed.length - 1; i++) {
      const prev = smoothed[i - 1];
      const curr = smoothed[i];
      const next = smoothed[i + 1];
      
      // Smooth crop positions
      smoothed[i].optimalCrop = {
        x: Math.round((prev.optimalCrop.x + curr.optimalCrop.x * 2 + next.optimalCrop.x) / 4),
        y: Math.round((prev.optimalCrop.y + curr.optimalCrop.y * 2 + next.optimalCrop.y) / 4),
        width: Math.round((prev.optimalCrop.width + curr.optimalCrop.width * 2 + next.optimalCrop.width) / 4),
        height: Math.round((prev.optimalCrop.height + curr.optimalCrop.height * 2 + next.optimalCrop.height) / 4)
      };
      
      // Smooth zoom levels if present
      if (curr.suggestedZoom) {
        const prevZoom = prev.suggestedZoom || 1.0;
        const nextZoom = next.suggestedZoom || 1.0;
        smoothed[i].suggestedZoom = (prevZoom + curr.suggestedZoom * 2 + nextZoom) / 4;
      }
    }
    
    return smoothed;
  }
  
  private createSmoothCropTransitions(frameAnalyses: any[], targetDimensions: any, metadata: any): any[] {
    // Group similar crops to create smooth segments
    const segments: any[] = [];
    let currentSegment: any = null;
    
    frameAnalyses.forEach((analysis, idx) => {
      if (!currentSegment) {
        currentSegment = {
          startFrame: idx,
          startTime: (idx / (metadata.fps || 30)),
          crop: analysis.optimalCrop,
          zoom: analysis.suggestedZoom || 1.0,
          trackingFocus: analysis.trackingFocus
        };
      } else {
        // Check if crop is significantly different
        const cropDiff = Math.abs(analysis.optimalCrop.x - currentSegment.crop.x) +
                        Math.abs(analysis.optimalCrop.y - currentSegment.crop.y) +
                        Math.abs(analysis.optimalCrop.width - currentSegment.crop.width) +
                        Math.abs(analysis.optimalCrop.height - currentSegment.crop.height);
        
        const zoomDiff = Math.abs((analysis.suggestedZoom || 1.0) - currentSegment.zoom);
        
        // Create new segment if significant change
        if (cropDiff > 100 || zoomDiff > 0.3) {
          currentSegment.endFrame = idx - 1;
          currentSegment.endTime = ((idx - 1) / (metadata.fps || 30));
          segments.push(currentSegment);
          
          currentSegment = {
            startFrame: idx,
            startTime: (idx / (metadata.fps || 30)),
            crop: analysis.optimalCrop,
            zoom: analysis.suggestedZoom || 1.0,
            trackingFocus: analysis.trackingFocus
          };
        }
      }
    });
    
    // Add final segment
    if (currentSegment) {
      currentSegment.endFrame = frameAnalyses.length - 1;
      currentSegment.endTime = ((frameAnalyses.length - 1) / (metadata.fps || 30));
      segments.push(currentSegment);
    }
    
    return segments.length > 0 ? segments : [{
      startFrame: 0,
      endFrame: frameAnalyses.length - 1,
      startTime: 0,
      endTime: ((frameAnalyses.length - 1) / (metadata.fps || 30)),
      crop: this.calculateAverageCrop(frameAnalyses, targetDimensions, metadata),
      zoom: 1.0
    }];
  }

  private getDefaultCrop(targetRatio: string, metadata: any): any {
    // For 9:16, calculate the box that fills the screen
    if (targetRatio === '9:16') {
      const centerPoint = { x: metadata.width / 2, y: metadata.height / 2 };
      return this.calculate916BoxFromFocusPoint(centerPoint, metadata);
    }
    
    // For other ratios, use standard dimensions
    const ratioMap: Record<string, { width: number; height: number }> = {
      '16:9': { width: 1920, height: 1080 },
      '1:1': { width: 1080, height: 1080 },
      '4:5': { width: 1080, height: 1350 },
      '4:3': { width: 1440, height: 1080 }
    };
    
    const dimensions = ratioMap[targetRatio] || { width: 1080, height: 1920 };
    
    return {
      x: (metadata.width - dimensions.width) / 2,
      y: (metadata.height - dimensions.height) / 2,
      width: dimensions.width,
      height: dimensions.height
    };
  }

  private async applyIntelligentReframe(
    inputPath: string,
    outputPath: string,
    metadata: any,
    config: any,
    frameAnalysis: any
  ): Promise<void> {
    const { frameAnalyses, totalFrames } = frameAnalysis;
    const targetRatio = config.aspectRatio || '9:16';
    
    // Get target dimensions
    const targetDimensions = this.getTargetDimensions(targetRatio, metadata);
    
    // Use a simpler approach: find the average crop position
    const avgCrop = this.calculateAverageCrop(frameAnalyses, targetDimensions, metadata);
    
    // Log crop details for debugging
    console.log('Video metadata:', { width: metadata.width, height: metadata.height });
    console.log('Target dimensions:', targetDimensions);
    console.log('Calculated crop:', avgCrop);
    
    // Validate crop dimensions
    if (avgCrop.width <= 0 || avgCrop.height <= 0) {
      throw new Error(`Invalid crop dimensions: ${avgCrop.width}x${avgCrop.height}`);
    }
    
    // Ensure crop is within video bounds
    if (avgCrop.x + avgCrop.width > metadata.width || avgCrop.y + avgCrop.height > metadata.height) {
      throw new Error(`Crop exceeds video bounds: crop(${avgCrop.x},${avgCrop.y},${avgCrop.width},${avgCrop.height}) vs video(${metadata.width}x${metadata.height})`);
    }
    
    // Build simple crop filter
    const filterComplex = `[0:v]crop=${avgCrop.width}:${avgCrop.height}:${avgCrop.x}:${avgCrop.y},scale=${targetDimensions.width}:${targetDimensions.height}:force_original_aspect_ratio=decrease,pad=${targetDimensions.width}:${targetDimensions.height}:(ow-iw)/2:(oh-ih)/2[v]`;
    
    console.log('FFmpeg filter:', filterComplex);

    return new Promise((resolve, reject) => {
      ffmpeg(inputPath)
        .complexFilter(filterComplex)
        .outputOptions([
          '-map', '[v]',
          '-map', '0:a?',
          '-c:v', 'libx264',
          '-preset', 'medium',
          '-crf', '23',
          '-c:a', 'copy'
        ])
        .output(outputPath)
        .on('end', () => {
          console.log('✅ Intelligent reframe complete');
          resolve();
        })
        .on('error', (err) => {
          console.error('❌ Reframe error:', err);
          reject(err);
        })
        .run();
    });
  }
  
  private calculateAverageCrop(frameAnalyses: any[], targetDimensions: any, metadata: any): any {
    // Calculate target aspect ratio
    const targetAspectRatio = targetDimensions.width / targetDimensions.height;
    const sourceAspectRatio = metadata.width / metadata.height;
    
    let cropWidth, cropHeight;
    
    // Calculate crop that maintains target aspect ratio within source bounds
    if (targetAspectRatio > sourceAspectRatio) {
      // Target is wider than source - fit by width
      cropWidth = metadata.width;
      cropHeight = Math.round(metadata.width / targetAspectRatio);
      
      // Ensure crop height doesn't exceed video height
      if (cropHeight > metadata.height) {
        cropHeight = metadata.height;
        cropWidth = Math.round(metadata.height * targetAspectRatio);
      }
    } else {
      // Target is taller than source - fit by height
      cropHeight = metadata.height;
      cropWidth = Math.round(metadata.height * targetAspectRatio);
      
      // Ensure crop width doesn't exceed video width
      if (cropWidth > metadata.width) {
        cropWidth = metadata.width;
        cropHeight = Math.round(metadata.width / targetAspectRatio);
      }
    }
    
    // If we have no frame analyses, use center crop
    if (frameAnalyses.length === 0) {
      return {
        x: Math.round((metadata.width - cropWidth) / 2),
        y: Math.round((metadata.height - cropHeight) / 2),
        width: Math.round(cropWidth),
        height: Math.round(cropHeight)
      };
    }
    
    // Calculate average crop position from all analyzed frames
    let avgX = 0, avgY = 0, avgWidth = 0, avgHeight = 0;
    let validFrames = 0;
    
    for (const frame of frameAnalyses) {
      if (frame.optimalCrop) {
        avgX += frame.optimalCrop.x;
        avgY += frame.optimalCrop.y;
        avgWidth += frame.optimalCrop.width;
        avgHeight += frame.optimalCrop.height;
        validFrames++;
      }
    }
    
    if (validFrames === 0) {
      // Fallback to center crop using pre-calculated dimensions
      return {
        x: Math.round((metadata.width - cropWidth) / 2),
        y: Math.round((metadata.height - cropHeight) / 2),
        width: Math.round(cropWidth),
        height: Math.round(cropHeight)
      };
    }
    
    // Calculate averages
    avgX = Math.round(avgX / validFrames);
    avgY = Math.round(avgY / validFrames);
    avgWidth = Math.round(avgWidth / validFrames);
    avgHeight = Math.round(avgHeight / validFrames);
    
    // Ensure average dimensions don't exceed calculated max crop
    avgWidth = Math.min(avgWidth, cropWidth);
    avgHeight = Math.min(avgHeight, cropHeight);
    
    // Ensure crop is within bounds
    avgX = Math.max(0, Math.min(avgX, metadata.width - avgWidth));
    avgY = Math.max(0, Math.min(avgY, metadata.height - avgHeight));
    
    return {
      x: avgX,
      y: avgY,
      width: avgWidth,
      height: avgHeight
    };
  }



  private getTargetDimensions(targetRatio: string, metadata: any): { width: number; height: number } {
    const ratioMap: Record<string, { width: number; height: number }> = {
      '9:16': { width: 1080, height: 1920 },
      '16:9': { width: 1920, height: 1080 },
      '1:1': { width: 1080, height: 1080 },
      '4:5': { width: 1080, height: 1350 },
      '4:3': { width: 1440, height: 1080 }
    };
    
    return ratioMap[targetRatio] || ratioMap['9:16'];
  }

  private buildCropFilter(crop: any, targetDimensions: { width: number; height: number }): string {
    // Validate and round crop dimensions to integers
    const cropX = Math.max(0, Math.round(crop.x));
    const cropY = Math.max(0, Math.round(crop.y));
    const cropWidth = Math.max(10, Math.round(crop.width)); // Minimum 10px width
    const cropHeight = Math.max(10, Math.round(crop.height)); // Minimum 10px height
    
    // Ensure dimensions are even numbers (required by some codecs)
    const evenCropWidth = cropWidth % 2 === 0 ? cropWidth : cropWidth + 1;
    const evenCropHeight = cropHeight % 2 === 0 ? cropHeight : cropHeight + 1;
    
    // Build FFmpeg filter for cropping and scaling
    const filter = `crop=${evenCropWidth}:${evenCropHeight}:${cropX}:${cropY},scale=${targetDimensions.width}:${targetDimensions.height}:force_original_aspect_ratio=decrease,pad=${targetDimensions.width}:${targetDimensions.height}:(ow-iw)/2:(oh-ih)/2:black`;
    return filter;
  }

  private getAspectRatioValue(targetRatio: string): number {
    const ratioValues: Record<string, number> = {
      '9:16': 9 / 16,  // 0.5625 (portrait)
      '16:9': 16 / 9,  // 1.7778 (landscape)
      '1:1': 1,        // 1.0 (square)
      '4:5': 4 / 5,    // 0.8 (portrait)
      '4:3': 4 / 3     // 1.3333 (landscape)
    };
    
    return ratioValues[targetRatio] || ratioValues['9:16'];
  }

  private calculate916BoxFromFocusPoint(focusPoint: {x: number, y: number}, metadata: any): any {
    // Calculate the maximum 9:16 box that fits in the video
    const targetAspectRatio = 9 / 16; // 0.5625 (width/height for portrait)
    
    let cropWidth: number;
    let cropHeight: number;
    
    // For 9:16, we need to check which dimension is the limiting factor
    // Option 1: Use full video height
    cropHeight = metadata.height;
    cropWidth = cropHeight * targetAspectRatio; // height * (9/16)
    
    // Option 2: If that makes width too large, use full video width instead
    if (cropWidth > metadata.width) {
      cropWidth = metadata.width;
      cropHeight = cropWidth / targetAspectRatio; // width / (9/16) = width * (16/9)
    }
    
    // Center the crop on the focus point
    let cropX = focusPoint.x - cropWidth / 2;
    let cropY = focusPoint.y - cropHeight / 2;
    
    // Ensure crop stays within video bounds
    cropX = Math.max(0, Math.min(cropX, metadata.width - cropWidth));
    cropY = Math.max(0, Math.min(cropY, metadata.height - cropHeight));
    
    // Ensure even dimensions for codec compatibility
    const evenCropWidth = Math.floor(cropWidth / 2) * 2;
    const evenCropHeight = Math.floor(cropHeight / 2) * 2;
    
    console.log(`  calculate916Box: video ${metadata.width}x${metadata.height}, focus (${focusPoint.x}, ${focusPoint.y}), crop ${evenCropWidth}x${evenCropHeight} at (${Math.round(cropX)}, ${Math.round(cropY)})`);
    
    return {
      x: Math.round(cropX),
      y: Math.round(cropY),
      width: evenCropWidth,
      height: evenCropHeight
    };
  }

  private async processSegmentedReframe(
    videoPath: string, 
    config: any, 
    startTime: number
  ): Promise<{
    outputPath: string;
    originalAspectRatio: string;
    targetAspectRatio: string;
    focusTracking: boolean;
    subjectsDetected: string[];
    processingTime: number;
  }> {
    console.log('🎬 Starting intelligent frame-by-frame reframe processing');
    
    const targetRatio = config.aspectRatio || '9:16';
    const focusSubject = config.focusSubject || 'person';
    const avoidSubject = config.avoidSubject || '';
    
    // Create temporary directories
    const tempDir = path.join('uploads', 'temp_reframe', `reframe_${Date.now()}`);
    const framesDir = path.join(tempDir, 'frames');
    const segmentsDir = path.join(tempDir, 'segments');
    const reframedDir = path.join(tempDir, 'reframed');
    
    try {
      // Create directories
      await fs.mkdir(framesDir, { recursive: true });
      await fs.mkdir(segmentsDir, { recursive: true });
      await fs.mkdir(reframedDir, { recursive: true });
      
      // Get video metadata
      const metadata = await this.getVideoMetadata(videoPath);
      const fps = metadata.fps || 30;
      const duration = metadata.duration;
      
      console.log(`📊 Video info: ${duration}s duration, ${fps} fps`);
      
      // Step 1: Extract and analyze frames at 1 frame every 5 seconds
      console.log('🖼️ Extracting frames at 1 frame every 5 seconds for analysis...');
      const frameAnalyses = await this.extractAndAnalyzeFrames(
        videoPath,
        framesDir,
        targetRatio,
        focusSubject,
        avoidSubject,
        config
      );
      
      // Step 2: Group frames intelligently by coordinate proximity
      console.log('🧠 Intelligently grouping frames by coordinate proximity...');
      const frameSegments = this.groupFramesByCoordinates(frameAnalyses, fps);
      
      console.log(`📊 Created ${frameSegments.length} intelligent segments`);
      
      // Step 3: Split video into intelligent segments
      console.log('🔪 Splitting video into intelligent segments...');
      const segmentPaths = await this.splitVideoByTimestamps(videoPath, segmentsDir, frameSegments);
      
      // Step 4: Process each segment with its specific crop
      console.log('🎯 Processing each segment with optimized crop...');
      const reframedPaths = [];
      const allDetectedSubjects = new Set<string>();
      
      for (let i = 0; i < frameSegments.length; i++) {
        const segment = frameSegments[i];
        const segmentPath = segmentPaths[i];
        
        console.log(`📹 Processing segment ${i + 1}/${frameSegments.length} (${segment.startTime}s - ${segment.endTime}s)`);
        
        // Track detected subjects from all frames in segment
        segment.frames.forEach((frame: any) => {
          frame.detectedSubjects?.forEach((subject: string) => allDetectedSubjects.add(subject));
        });
        
        // Apply reframe to segment using its averaged crop coordinates
        const reframedSegmentPath = path.join(reframedDir, `reframed_${String(i).padStart(4, '0')}.mp4`);
        
        try {
          await this.reframeSegment(segmentPaths[i], reframedSegmentPath, segment.crop, targetRatio, metadata);
          reframedPaths.push(reframedSegmentPath);
        } catch (error) {
          const errorMsg = error instanceof Error ? error.message : String(error);
          
          if (errorMsg.includes('too small') || errorMsg.includes('corrupted')) {
            console.log(`  ⚠️  Skipping corrupted segment ${i}: ${errorMsg}`);
            // Continue processing other segments
            continue;
          } else {
            // Re-throw other errors
            console.error(`❌ Failed to reframe segment ${i}:`, error);
            throw error;
          }
        }
      }
      
      // Step 5: Merge all reframed segments
      console.log('🔀 Merging reframed segments...');
      
      if (reframedPaths.length === 0) {
        throw new Error('No segments were successfully reframed');
      }
      
      console.log(`  Merging ${reframedPaths.length} successfully processed segments`);
      
      const outputFileName = `reframed_${Date.now()}.mp4`;
      const outputPath = path.join('uploads', outputFileName);
      
      await this.mergeSegments(reframedPaths, outputPath);
      
      console.log('✅ Intelligent reframe complete');
      
      // Cleanup temporary files
      console.log('🧹 Cleaning up temporary files...');
      await this.cleanupTempDirectory(tempDir);
      
      const processingTime = Date.now() - startTime;
      
      return {
        outputPath: `/api/upload/video/${outputFileName}`,
        originalAspectRatio: `${metadata.width}:${metadata.height}`,
        targetAspectRatio: targetRatio,
        focusTracking: true,
        subjectsDetected: Array.from(allDetectedSubjects),
        processingTime
      };
      
    } catch (error) {
      console.error('❌ Intelligent reframe error:', error);
      
      // Cleanup on error
      try {
        await this.cleanupTempDirectory(tempDir);
      } catch (cleanupError) {
        console.error('Cleanup error:', cleanupError);
      }
      
      throw error;
    }
  }

  private async splitVideoIntoSegments(videoPath: string, segmentsDir: string, segmentFrames: number): Promise<void> {
    await new Promise((resolve, reject) => {
      ffmpeg(videoPath)
        .outputOptions([
          '-c', 'copy',
          '-f', 'segment',
          '-segment_frames', String(segmentFrames),
          '-reset_timestamps', '1'
        ])
        .output(path.join(segmentsDir, 'segment_%04d.mp4'))
        .on('end', resolve)
        .on('error', reject)
        .run();
    });
  }

  private async analyzeSegmentFrames(
    segmentPath: string,
    targetRatio: string,
    focusSubject: string,
    avoidSubject: string,
    startFrame: number,
    metadata: any,
    config: any
  ): Promise<any> {
    // Extract all frames from this segment
    const framesDir = path.join('uploads', 'temp_frames', `segment_frames_${Date.now()}`);
    await fs.mkdir(framesDir, { recursive: true });
    
    await new Promise((resolve, reject) => {
      ffmpeg(segmentPath)
        .outputOptions([
          '-r', '0.2',  // Extract 1 frame every 5 seconds
          '-q:v', '2'
        ])
        .output(path.join(framesDir, 'frame_%03d.jpg'))
        .on('end', resolve)
        .on('error', reject)
        .run();
    });
    
    const frames = await fs.readdir(framesDir);
    const frameAnalyses = [];
    const detectedSubjects = new Set<string>();
    
    // Analyze all frames in this segment
    for (let i = 0; i < frames.length; i++) {
      const frame = frames[i];
      const imagePath = path.join(framesDir, frame);
      const imageBuffer = await fs.readFile(imagePath);
      const imageBase64 = imageBuffer.toString('base64');
      
      const analysis = await this.analyzeFrame(
        imageBase64, 
        targetRatio, 
        focusSubject, 
        avoidSubject, 
        startFrame + (i * 5),
        metadata,
        config.aiModel
      );
      
      frameAnalyses.push(analysis);
      
      // Track detected subjects
      if (analysis.detectedPeople && analysis.detectedPeople.length > 0) {
        detectedSubjects.add('person');
        if (analysis.speakingPersonIndex >= 0) {
          detectedSubjects.add('speaking_person');
        }
      }
    }
    
    // Cleanup frames
    await this.cleanupTempDirectory(framesDir);
    
    return {
      analyses: frameAnalyses,
      detectedSubjects: Array.from(detectedSubjects)
    };
  }

  private async analyzeFrame(
    imageBase64: string,
    targetRatio: string,
    focusSubject: string,
    avoidSubject: string,
    frameIndex: number,
    metadata: any,
    aiModel?: string
  ): Promise<any> {
    const modelName = aiModel || 'gemini-2.0-flash-lite';
    const model = this.genAI.getGenerativeModel({ model: modelName });
    
    const prompt = `Analyze this video frame (${metadata.width}x${metadata.height}) for creating engaging short-form content.
    
    IMPORTANT: If there are multiple people, identify who is speaking by looking for:
    - Open mouth (talking)
    - Engaged facial expression
    - Gesturing or animated body language
    - Looking at camera or other people
    
    Focus on the SPEAKING person, not just any person.
    ${focusSubject === 'person' ? 'Track the speaking person if multiple people are present.' : ''}
    ${avoidSubject ? `Avoid cropping into: ${avoidSubject}` : ''}
    
    Return a JSON with:
    - frameTime: ${frameIndex}
    - focusPoint: x,y coordinates of the most important subject (usually speaking person's face)
    - detectedPeople: array of people detected with center positions {x, y}
    - speakingPersonIndex: index of speaking person in detectedPeople array (-1 if none)
    - confidence: 0 to 1
    
    Video dimensions: ${metadata.width}x${metadata.height}
    Ensure focusPoint coordinates are within bounds: x in [0,${metadata.width}], y in [0,${metadata.height}]
    
    Example: {"frameTime": 0, "focusPoint": {"x": 640, "y": 360}, "detectedPeople": [{"x": 400, "y": 350}, {"x": 800, "y": 350}], "speakingPersonIndex": 1, "confidence": 0.9}`;
    
    try {
      const result = await model.generateContent([
        { text: prompt },
        { inlineData: { mimeType: 'image/jpeg', data: imageBase64 } }
      ]);
      
      const response = result.response.text();
      
      // Parse JSON from response
      const jsonMatch = response.match(/\{[\s\S]*\}/);
      if (jsonMatch) {
        const data = JSON.parse(jsonMatch[0]);
        
        // Calculate 9:16 box from focus point
        const focusPoint = data.focusPoint || { x: metadata.width / 2, y: metadata.height / 2 };
        const optimalCrop = this.calculate916BoxFromFocusPoint(focusPoint, metadata);
        
        return {
          frameTime: data.frameTime,
          optimalCrop: optimalCrop,
          detectedPeople: data.detectedPeople || [],
          speakingPersonIndex: data.speakingPersonIndex || -1,
          confidence: data.confidence || 0
        };
      }
      
      throw new Error('No valid JSON found in response');
    } catch (error) {
      console.error(`Frame ${frameIndex} analysis error:`, error);
      
      // Return default crop on error
      const centerPoint = { x: metadata.width / 2, y: metadata.height / 2 };
      return {
        frameTime: frameIndex,
        optimalCrop: this.calculate916BoxFromFocusPoint(centerPoint, metadata),
        detectedPeople: [],
        speakingPersonIndex: -1,
        confidence: 0
      };
    }
  }

  private calculateSegmentCrop(segmentAnalysis: any, targetRatio: string, metadata: any): any {
    const analyses = segmentAnalysis.analyses || [];
    
    if (analyses.length === 0) {
      return this.getDefaultCrop(targetRatio, metadata);
    }
    
    // Find the most confident frame with speaking person
    let bestAnalysis = analyses[0];
    for (const analysis of analyses) {
      if (analysis.speakingPersonIndex >= 0 && analysis.confidence > bestAnalysis.confidence) {
        bestAnalysis = analysis;
      }
    }
    
    // Use the best analysis crop (already calculated as 9:16)
    return bestAnalysis.optimalCrop;
  }

  private async reframeSegment(
    segmentPath: string,
    outputPath: string,
    crop: any,
    targetRatio: string,
    metadata: any
  ): Promise<void> {
    // First verify the input segment exists and has sufficient content
    try {
      const segmentStats = await fs.stat(segmentPath);
      if (segmentStats.size < 10000) { // Skip segments smaller than 10KB
        throw new Error(`Input segment file too small (${segmentStats.size} bytes) - likely corrupted`);
      }
      console.log(`  Input segment size: ${segmentStats.size} bytes`);
    } catch (err) {
      throw new Error(`Failed to access input segment: ${err instanceof Error ? err.message : String(err)}`);
    }
    
    const targetDimensions = this.getTargetDimensions(targetRatio, metadata);
    const targetAspectRatio = targetDimensions.width / targetDimensions.height;
    
    // Validate crop is valid
    if (!crop || crop.x === undefined || crop.y === undefined || !crop.width || !crop.height) {
      console.error('Invalid crop data:', crop);
      throw new Error('Invalid crop data provided');
    }
    
    // Simple validation - just ensure crop is within bounds
    const validatedCrop = {
      x: Math.max(0, Math.min(crop.x, metadata.width - crop.width)),
      y: Math.max(0, Math.min(crop.y, metadata.height - crop.height)),
      width: crop.width,
      height: crop.height
    };
    
    console.log(`  9:16 Crop: x=${validatedCrop.x.toFixed(0)}, y=${validatedCrop.y.toFixed(0)}, w=${validatedCrop.width.toFixed(0)}, h=${validatedCrop.height.toFixed(0)}`);
    console.log(`  Video dimensions: ${metadata.width}x${metadata.height}`);
    console.log(`  Target dimensions: ${targetDimensions.width}x${targetDimensions.height}`);
    
    const filter = this.buildCropFilter(validatedCrop, targetDimensions);
    console.log(`  Filter: ${filter}`);
    
    await new Promise((resolve, reject) => {
      const ffmpegCmd = ffmpeg(segmentPath)
        .outputOptions([
          '-vf', filter,
          '-c:v', 'libx264',
          '-preset', 'medium',  // Changed from 'fast' to 'medium' for better quality
          '-crf', '23',
          '-c:a', 'aac',  // Re-encode audio to ensure compatibility
          '-b:a', '192k',
          '-r', '30',  // Output framerate
          '-pix_fmt', 'yuv420p',  // Ensure compatible pixel format
          '-movflags', '+faststart'  // Optimize for streaming
        ])
        .output(outputPath)
        .on('start', (cmd) => {
          console.log('  FFmpeg reframe command:', cmd);
        })
        .on('progress', (progress) => {
          if (progress.percent) {
            console.log(`  Reframing progress: ${progress.percent.toFixed(1)}%`);
          }
        })
        .on('end', async () => {
          // Verify output was created
          try {
            const outputStats = await fs.stat(outputPath);
            if (outputStats.size === 0) {
              reject(new Error('Output file is empty after reframing'));
              return;
            }
            console.log(`  ✅ Segment reframed successfully (${outputStats.size} bytes)`);
            resolve(null);
          } catch (err) {
            reject(new Error(`Failed to verify output: ${err instanceof Error ? err.message : String(err)}`));
          }
        })
        .on('error', (err) => {
          console.error('  ❌ FFmpeg reframe error:', err.message);
          reject(err);
        });
      
      ffmpegCmd.run();
    });
  }

  private async mergeSegments(segmentPaths: string[], outputPath: string): Promise<void> {
    // Create concat file
    const concatFile = path.join(path.dirname(segmentPaths[0]), 'concat.txt');
    const concatContent = segmentPaths.map(p => `file '${path.basename(p)}'`).join('\n');
    await fs.writeFile(concatFile, concatContent);
    
    await new Promise((resolve, reject) => {
      ffmpeg()
        .input(concatFile)
        .inputOptions(['-f', 'concat', '-safe', '0'])
        .outputOptions([
          '-c', 'copy',
          '-movflags', '+faststart'
        ])
        .output(outputPath)
        .on('end', resolve)
        .on('error', reject)
        .run();
    });
    
    // Cleanup concat file
    await fs.unlink(concatFile);
  }

  private async cleanupTempDirectory(dirPath: string): Promise<void> {
    try {
      const files = await fs.readdir(dirPath);
      
      // Delete all files in directory
      for (const file of files) {
        const filePath = path.join(dirPath, file);
        const stat = await fs.stat(filePath);
        
        if (stat.isDirectory()) {
          await this.cleanupTempDirectory(filePath);
        } else {
          await fs.unlink(filePath);
        }
      }
      
      // Remove the directory itself
      await fs.rmdir(dirPath);
      
      console.log(`✅ Cleaned up: ${dirPath}`);
    } catch (error) {
      console.error(`Failed to cleanup ${dirPath}:`, error);
    }
  }

  private async analyzeContentForCrop(videoPath: string, targetRatio: string): Promise<any> {
    const model = this.genAI.getGenerativeModel({ model: 'gemini-2.0-flash-exp' });
    
    // Extract key frames for analysis
    const framesDir = path.join('uploads', 'temp_frames', `frames_${Date.now()}`);
    await fs.mkdir(framesDir, { recursive: true });
    
    // Extract 5 frames across the video
    await new Promise((resolve, reject) => {
      ffmpeg(videoPath)
        .outputOptions([
          '-vf', 'select=eq(n\\,0)+eq(n\\,100)+eq(n\\,200)+eq(n\\,300)+eq(n\\,400)',
          '-vsync', 'vfr',
          '-q:v', '2'
        ])
        .output(path.join(framesDir, 'frame_%03d.jpg'))
        .on('end', resolve)
        .on('error', reject)
        .run();
    });

    const frames = await fs.readdir(framesDir);
    const cropSuggestions = [];

    for (const frame of frames) {
      const imagePath = path.join(framesDir, frame);
      const imageBuffer = await fs.readFile(imagePath);
      const imageBase64 = imageBuffer.toString('base64');

      const result = await model.generateContent([
        {
          inlineData: {
            data: imageBase64,
            mimeType: 'image/jpeg'
          }
        },
        `Analyze this video frame for optimal ${targetRatio} aspect ratio cropping.
        
        Identify the main subject/action and suggest crop coordinates that:
        1. Keep the primary subject/face centered
        2. Maintain visual interest and composition
        3. Avoid cutting important elements
        
        Return JSON:
        {
          "mainSubject": {
            "type": "person|object|scene",
            "position": { "x": center_x, "y": center_y },
            "importance": 0-1
          },
          "suggestedCrop": {
            "x": top_left_x,
            "y": top_left_y,
            "width": crop_width,
            "height": crop_height
          },
          "confidence": 0-1
        }`
      ]);

      try {
        const response = JSON.parse(result.response.text());
        cropSuggestions.push(response);
      } catch (e) {
        console.error('Failed to parse crop analysis:', e);
      }
    }

    // Cleanup frames
    for (const frame of frames) {
      await fs.unlink(path.join(framesDir, frame));
    }
    await fs.rmdir(framesDir);

    // Average the crop suggestions for smooth tracking
    return this.averageCropSuggestions(cropSuggestions);
  }

  private averageCropSuggestions(suggestions: any[]): any {
    if (suggestions.length === 0) return null;

    const avgCrop = {
      x: 0,
      y: 0,
      width: 0,
      height: 0
    };

    suggestions.forEach(s => {
      avgCrop.x += s.suggestedCrop.x;
      avgCrop.y += s.suggestedCrop.y;
      avgCrop.width += s.suggestedCrop.width;
      avgCrop.height += s.suggestedCrop.height;
    });

    const count = suggestions.length;
    return {
      x: Math.round(avgCrop.x / count),
      y: Math.round(avgCrop.y / count),
      width: Math.round(avgCrop.width / count),
      height: Math.round(avgCrop.height / count)
    };
  }

  private async applyReframe(
    inputPath: string, 
    outputPath: string, 
    metadata: any,
    config: any,
    cropData: any
  ): Promise<void> {
    const targetRatio = config.targetAspectRatio || '9:16';
    const [targetW, targetH] = targetRatio.split(':').map(Number);
    
    // Calculate output dimensions
    const targetAspect = targetW / targetH;
    const sourceAspect = metadata.width / metadata.height;
    
    let outputWidth, outputHeight, cropWidth, cropHeight, cropX, cropY;
    
    if (cropData && config.smartCrop) {
      // Use AI-suggested crop
      cropWidth = cropData.width;
      cropHeight = cropData.height;
      cropX = cropData.x;
      cropY = cropData.y;
      outputWidth = 1080; // Standard width for vertical
      outputHeight = Math.round(outputWidth / targetAspect);
    } else {
      // Center crop
      if (sourceAspect > targetAspect) {
        // Source is wider, crop sides
        cropHeight = metadata.height;
        cropWidth = Math.round(cropHeight * targetAspect);
        cropX = Math.round((metadata.width - cropWidth) / 2);
        cropY = 0;
      } else {
        // Source is taller, crop top/bottom
        cropWidth = metadata.width;
        cropHeight = Math.round(cropWidth / targetAspect);
        cropX = 0;
        cropY = Math.round((metadata.height - cropHeight) / 2);
      }
      
      outputWidth = targetW === 9 ? 1080 : 1920;
      outputHeight = Math.round(outputWidth / targetAspect);
    }

    return new Promise((resolve, reject) => {
      ffmpeg(inputPath)
        .outputOptions([
          '-vf', `crop=${cropWidth}:${cropHeight}:${cropX}:${cropY},scale=${outputWidth}:${outputHeight}`,
          '-c:v', 'libx264',
          '-preset', 'medium',
          '-crf', '23',
          '-c:a', 'copy'
        ])
        .output(outputPath)
        .on('end', () => {
          console.log('✅ Reframe complete');
          resolve();
        })
        .on('error', reject)
        .run();
    });
  }

  private async extractAndAnalyzeFrames(
    videoPath: string,
    framesDir: string,
    targetRatio: string,
    focusSubject: string,
    avoidSubject: string,
    config: any
  ): Promise<any[]> {
    // Extract 1 frame every 5 seconds
    await new Promise((resolve, reject) => {
      ffmpeg(videoPath)
        .outputOptions([
          '-r', '0.2',  // 1 frame every 5 seconds (0.2 fps)
          '-q:v', '2'
        ])
        .output(path.join(framesDir, 'frame_%05d.jpg'))
        .on('end', resolve)
        .on('error', reject)
        .run();
    });

    // Get all extracted frames
    const frameFiles = await fs.readdir(framesDir);
    const frames = frameFiles.filter(f => f.endsWith('.jpg')).sort();
    
    console.log(`📸 Analyzing ${frames.length} frames with AI...`);
    
    const frameAnalyses = [];
    for (let i = 0; i < frames.length; i++) {
      const framePath = path.join(framesDir, frames[i]);
      
      // Read frame and convert to base64
      const imageBuffer = await fs.readFile(framePath);
      const imageBase64 = imageBuffer.toString('base64');
      
      const frameAnalysis = await this.analyzeFrame(
        imageBase64,
        targetRatio,
        focusSubject,
        avoidSubject,
        i * 5, // frame index in seconds (every 5 seconds)
        { width: 1920, height: 1080 }, // default metadata
        config.aiModel
      );
      
      frameAnalyses.push({
        frameNumber: i,
        timestamp: i * 5, // seconds (every 5 seconds)
        crop: frameAnalysis.optimalCrop,
        zoom: frameAnalysis.suggestedZoom || 1.0,
        detectedSubjects: frameAnalysis.detectedPeople?.length > 0 ? ['person'] : [],
        ...frameAnalysis
      });
    }
    
    return frameAnalyses;
  }

  private groupFramesByCoordinates(frameAnalyses: any[], fps: number): any[] {
    const segments = [];
    let currentSegment = null;
    
    // Helper function to calculate similarity percentage between two frames
    const calculateSimilarity = (frame1: any, frame2: any): number => {
      if (!frame1.crop || !frame2.crop) return 0;
      
      // Use video dimensions as reference for percentage calculation
      const refWidth = 1920;
      const refHeight = 1080;
      
      // Calculate percentage differences for each dimension
      const xDiff = Math.abs(frame1.crop.x - frame2.crop.x) / refWidth * 100;
      const yDiff = Math.abs(frame1.crop.y - frame2.crop.y) / refHeight * 100;
      const widthDiff = Math.abs(frame1.crop.width - frame2.crop.width) / refWidth * 100;
      const heightDiff = Math.abs(frame1.crop.height - frame2.crop.height) / refHeight * 100;
      
      // Calculate zoom difference percentage (max zoom is typically 2.5)
      const zoom1 = frame1.zoom || 1.0;
      const zoom2 = frame2.zoom || 1.0;
      const zoomDiff = Math.abs(zoom1 - zoom2) / 2.5 * 100;
      
      // Calculate overall difference (average of all percentage differences)
      const avgDiff = (xDiff + yDiff + widthDiff + heightDiff + zoomDiff) / 5;
      
      // Convert to similarity percentage
      const similarity = 100 - avgDiff;
      
      return Math.max(0, Math.min(100, similarity));
    };
    
    // Helper function to calculate average crop for a segment
    const calculateSegmentAverageCrop = (frames: any[]): any => {
      if (frames.length === 0) return null;
      
      let sumX = 0, sumY = 0, sumWidth = 0, sumHeight = 0, sumZoom = 0;
      
      frames.forEach(frame => {
        sumX += frame.crop.x;
        sumY += frame.crop.y;
        sumWidth += frame.crop.width;
        sumHeight += frame.crop.height;
        sumZoom += frame.zoom || 1.0;
      });
      
      const count = frames.length;
      return {
        x: Math.round(sumX / count),
        y: Math.round(sumY / count),
        width: Math.round(sumWidth / count),
        height: Math.round(sumHeight / count),
        zoom: sumZoom / count
      };
    };
    
    console.log(`🔍 Analyzing ${frameAnalyses.length} frames for 90% similarity grouping...`);
    
    for (let i = 0; i < frameAnalyses.length; i++) {
      const frame = frameAnalyses[i];
      
      if (!currentSegment) {
        // Start new segment
        currentSegment = {
          startTime: frame.timestamp,
          endTime: frame.timestamp + 1,
          startFrame: Math.floor(frame.timestamp * fps),
          endFrame: Math.floor((frame.timestamp + 1) * fps),
          frames: [frame],
          crop: frame.crop,
          zoom: frame.zoom || 1.0
        };
      } else {
        // Calculate similarity with the average of current segment
        const segmentAvgCrop = calculateSegmentAverageCrop(currentSegment.frames);
        const avgFrame = { crop: segmentAvgCrop, zoom: segmentAvgCrop.zoom };
        const similarity = calculateSimilarity(frame, avgFrame);
        
        console.log(`  Frame ${i} (${frame.timestamp}s): ${similarity.toFixed(1)}% similar to segment avg`);
        
        // If frame is 90% or more similar, add to current segment
        if (similarity >= 90) {
          // Continue current segment
          currentSegment.endTime = frame.timestamp + 1;
          currentSegment.endFrame = Math.floor((frame.timestamp + 1) * fps);
          currentSegment.frames.push(frame);
        } else {
          // Finalize current segment with average crop values
          const finalAvgCrop = calculateSegmentAverageCrop(currentSegment.frames);
          currentSegment.crop = finalAvgCrop;
          currentSegment.zoom = finalAvgCrop.zoom;
          
          segments.push(currentSegment);
          console.log(`  ✅ Created segment ${segments.length}: ${currentSegment.startTime}s-${currentSegment.endTime}s (${currentSegment.frames.length} frames)`);
          
          // Start new segment
          currentSegment = {
            startTime: frame.timestamp,
            endTime: frame.timestamp + 1,
            startFrame: Math.floor(frame.timestamp * fps),
            endFrame: Math.floor((frame.timestamp + 1) * fps),
            frames: [frame],
            crop: frame.crop,
            zoom: frame.zoom || 1.0
          };
        }
      }
    }
    
    // Add final segment
    if (currentSegment && currentSegment.frames.length > 0) {
      const finalAvgCrop = calculateSegmentAverageCrop(currentSegment.frames);
      currentSegment.crop = finalAvgCrop;
      currentSegment.zoom = finalAvgCrop.zoom;
      segments.push(currentSegment);
      console.log(`  ✅ Created final segment ${segments.length}: ${currentSegment.startTime}s-${currentSegment.endTime}s (${currentSegment.frames.length} frames)`);
    }
    
    console.log(`📊 Total segments created: ${segments.length}`);
    
    return segments;
  }

  private async splitVideoByTimestamps(
    videoPath: string,
    segmentsDir: string,
    frameSegments: any[]
  ): Promise<string[]> {
    const segmentPaths = [];
    
    for (let i = 0; i < frameSegments.length; i++) {
      const segment = frameSegments[i];
      const segmentPath = path.join(segmentsDir, `segment_${String(i).padStart(4, '0')}.mp4`);
      
      const duration = segment.endTime - segment.startTime;
      console.log(`  Segment ${i}: ${segment.startTime}s - ${segment.endTime}s (${duration}s)`);
      
      // Skip segments that are too short
      if (duration < 0.5) {
        console.log(`  ⚠️  Skipping segment ${i}: too short (${duration}s)`);
        continue;
      }
      
      await new Promise((resolve, reject) => {
        ffmpeg(videoPath)
          .seekInput(segment.startTime)
          .duration(duration)
          .outputOptions([
            '-c:v', 'libx264',  // Re-encode video to avoid codec issues
            '-preset', 'fast',
            '-crf', '23',
            '-c:a', 'aac',  // Re-encode audio to ensure compatibility
            '-b:a', '192k',
            '-avoid_negative_ts', 'make_zero',
            '-r', '30',  // Force framerate
            '-pix_fmt', 'yuv420p'  // Force pixel format
          ])
          .output(segmentPath)
          .on('start', (cmd) => {
            console.log(`  Segment ${i} FFmpeg cmd:`, cmd);
          })
          .on('end', async () => {
            // Verify segment was created properly
            try {
              const stats = await fs.stat(segmentPath);
              if (stats.size === 0) {
                reject(new Error(`Segment ${i} is empty (0 bytes)`));
                return;
              }
              console.log(`  ✅ Created segment ${i} (${stats.size} bytes)`);
              resolve(null);
            } catch (err) {
              reject(new Error(`Failed to verify segment ${i}: ${err instanceof Error ? err.message : String(err)}`));
            }
          })
          .on('error', (err) => {
            console.error(`  ❌ Error creating segment ${i}:`, err.message);
            reject(err);
          })
          .run();
      });
      
      segmentPaths.push(segmentPath);
    }
    
    return segmentPaths;
  }
}