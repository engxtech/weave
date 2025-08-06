import { spawn } from 'child_process';
import { GoogleGenerativeAI } from '@google/generative-ai';
import * as fs from 'fs';
import * as path from 'path';
import { promisify } from 'util';

const writeFile = promisify(fs.writeFile);
const readFile = promisify(fs.readFile);

interface VideoSegment {
  startTime: number;
  endTime: number;
  duration: number;
  actionCenterX: number;
  confidence: number;
  description: string;
}

interface CompositeFrameAnalysis {
  actionCenterX: number;
  actionCenterY: number;
  confidence: number;
  detectedObjects: string[];
  movementIntensity: number;
}

export class IntelligentVideoCropper {
  private ai: GoogleGenerativeAI;
  private tempDir: string;

  constructor(apiKey: string) {
    this.ai = new GoogleGenerativeAI(apiKey);
    this.tempDir = path.join(process.cwd(), 'temp_intelligent_crop');
    
    // Ensure temp directory exists
    if (!fs.existsSync(this.tempDir)) {
      fs.mkdirSync(this.tempDir, { recursive: true });
    }
  }

  /**
   * Main entry point for intelligent video cropping
   */
  async cropVideoIntelligently(
    inputPath: string,
    outputPath: string,
    options: {
      targetAspectRatio: '9:16' | '16:9' | '1:1';
      analysisMethod: 'composite' | 'gemini' | 'hybrid';
      segmentDuration?: number;
    }
  ): Promise<{
    success: boolean;
    outputPath?: string;
    segments: VideoSegment[];
    processingTime: number;
    analysisMethod: string;
  }> {
    const startTime = Date.now();
    console.log(`Starting intelligent video cropping: ${options.analysisMethod} method`);

    try {
      // Step 1: Segment the video into logical scenes
      const segments = await this.segmentVideo(inputPath, options.segmentDuration || 10);
      console.log(`Video segmented into ${segments.length} segments`);

      // Step 2: Analyze each segment to find center of action
      const analyzedSegments: VideoSegment[] = [];
      
      for (let i = 0; i < segments.length; i++) {
        const segment = segments[i];
        console.log(`Analyzing segment ${i + 1}/${segments.length} (${segment.startTime}s - ${segment.endTime}s)`);
        
        let actionCenter: CompositeFrameAnalysis;
        
        if (options.analysisMethod === 'composite') {
          actionCenter = await this.analyzeSegmentWithCompositeFrame(inputPath, segment);
        } else if (options.analysisMethod === 'gemini') {
          actionCenter = await this.analyzeSegmentWithGemini(inputPath, segment);
        } else {
          // Hybrid: try composite first, fallback to Gemini
          try {
            actionCenter = await this.analyzeSegmentWithCompositeFrame(inputPath, segment);
            if (actionCenter.confidence < 0.7) {
              console.log('Low confidence from composite analysis, using Gemini fallback');
              actionCenter = await this.analyzeSegmentWithGemini(inputPath, segment);
            }
          } catch (error) {
            console.log('Composite analysis failed, using Gemini fallback');
            actionCenter = await this.analyzeSegmentWithGemini(inputPath, segment);
          }
        }

        analyzedSegments.push({
          ...segment,
          actionCenterX: actionCenter.actionCenterX,
          confidence: actionCenter.confidence,
          description: actionCenter.detectedObjects.join(', ')
        });
      }

      // Step 3: Get video info for smooth processing
      const videoInfo = await this.getVideoInfo(inputPath);
      console.log(`Video info: ${videoInfo.width}x${videoInfo.height}, ${videoInfo.duration}s, ${videoInfo.fps} fps`);

      // Step 4: Generate smooth crop path for all frames
      const smoothCropPath = this.generateSmoothCropPath(analyzedSegments, videoInfo.duration, videoInfo.fps);
      console.log(`Generated smooth crop path with ${smoothCropPath.length} coordinate points`);

      // Step 5: Apply smooth crop to entire video
      await this.applySmoothCropToVideo(inputPath, outputPath, smoothCropPath, options.targetAspectRatio);

      const processingTime = Date.now() - startTime;
      console.log(`Intelligent cropping completed in ${processingTime}ms`);

      return {
        success: true,
        outputPath,
        segments: analyzedSegments,
        processingTime,
        analysisMethod: options.analysisMethod
      };

    } catch (error) {
      console.error('Intelligent cropping error:', error);
      return {
        success: false,
        segments: [],
        processingTime: Date.now() - startTime,
        analysisMethod: options.analysisMethod
      };
    }
  }

  /**
   * Step 1: Segment video into logical scenes using audio analysis
   */
  private async segmentVideo(inputPath: string, maxSegmentDuration: number): Promise<VideoSegment[]> {
    return new Promise((resolve, reject) => {
      // Get video duration first
      const durationCmd = spawn('ffprobe', [
        '-v', 'quiet',
        '-show_entries', 'format=duration',
        '-of', 'csv=p=0',
        inputPath
      ]);

      let durationOutput = '';
      durationCmd.stdout.on('data', (data) => {
        durationOutput += data.toString();
      });

      durationCmd.on('close', (code) => {
        if (code !== 0) {
          reject(new Error('Failed to get video duration'));
          return;
        }

        const totalDuration = parseFloat(durationOutput.trim());
        const segments: VideoSegment[] = [];

        // Create segments based on duration (simple approach)
        // In production, this would use audio analysis for scene detection
        let currentTime = 0;
        let segmentIndex = 0;

        while (currentTime < totalDuration) {
          const endTime = Math.min(currentTime + maxSegmentDuration, totalDuration);
          
          segments.push({
            startTime: currentTime,
            endTime: endTime,
            duration: endTime - currentTime,
            actionCenterX: 0.5, // Will be calculated later
            confidence: 0,
            description: `Segment ${segmentIndex + 1}`
          });

          currentTime = endTime;
          segmentIndex++;
        }

        resolve(segments);
      });
    });
  }

  /**
   * Step 2a: Analyze segment using composite frame approach (zero AI)
   */
  private async analyzeSegmentWithCompositeFrame(
    inputPath: string,
    segment: VideoSegment
  ): Promise<CompositeFrameAnalysis> {
    const compositeFramePath = path.join(this.tempDir, `composite_${segment.startTime}_${segment.endTime}.jpg`);

    return new Promise((resolve, reject) => {
      // Create composite frame using FFmpeg blend filter
      const ffmpeg = spawn('ffmpeg', [
        '-y',
        '-i', inputPath,
        '-ss', segment.startTime.toString(),
        '-t', segment.duration.toString(),
        '-filter_complex', 
        `[0:v]scale=1920:1080,tmix=frames=30:weights="1 1 1 1 1 1 1 1 1 1 1 1 1 1 1 1 1 1 1 1 1 1 1 1 1 1 1 1 1 1"[composite]`,
        '-map', '[composite]',
        '-frames:v', '1',
        '-q:v', '2',
        compositeFramePath
      ]);

      ffmpeg.on('close', async (code) => {
        if (code !== 0) {
          reject(new Error('Failed to create composite frame'));
          return;
        }

        try {
          // Analyze composite frame with computer vision (simplified blob detection)
          const analysis = await this.analyzeCompositeFrameCV(compositeFramePath);
          resolve(analysis);
        } catch (error) {
          reject(error);
        }
      });

      ffmpeg.stderr.on('data', (data) => {
        // Log FFmpeg errors if needed
        console.log(`FFmpeg composite: ${data}`);
      });
    });
  }

  /**
   * Computer vision analysis of composite frame (simplified approach)
   */
  private async analyzeCompositeFrameCV(compositeFramePath: string): Promise<CompositeFrameAnalysis> {
    // For this implementation, we'll use Gemini to analyze the composite frame
    // In production, you'd use OpenCV or similar CV library
    
    try {
      const imageBytes = await readFile(compositeFramePath);
      const model = this.ai.getGenerativeModel({ model: 'gemini-1.5-flash' });

      const prompt = `Analyze this composite/blended video frame to identify the center of action and movement.

This is a composite frame created by blending multiple frames from a video segment. The blurred/ghosted regions indicate movement and action.

Please identify:
1. The horizontal center of the main action/movement (as X coordinate from 0.0 to 1.0, where 0.0 is left edge, 1.0 is right edge)
2. The vertical center of the main action/movement (as Y coordinate from 0.0 to 1.0, where 0.0 is top edge, 1.0 is bottom edge)
3. Confidence in this analysis (0.0 to 1.0)
4. What objects/subjects are causing the movement
5. Overall movement intensity (0.0 to 1.0)

Focus on finding the center of the most blurred/ghosted areas, as these indicate movement.

Respond in JSON format:
{
  "actionCenterX": 0.5,
  "actionCenterY": 0.5,
  "confidence": 0.8,
  "detectedObjects": ["person", "car"],
  "movementIntensity": 0.7
}`;

      const result = await model.generateContent([
        {
          inlineData: {
            data: imageBytes.toString('base64'),
            mimeType: 'image/jpeg'
          }
        },
        prompt
      ]);

      const response = result.response.text() || '{}';
      
      // Extract JSON from response
      const jsonMatch = response.match(/\{[\s\S]*\}/);
      if (!jsonMatch) {
        throw new Error('No valid JSON found in response');
      }

      const analysis = JSON.parse(jsonMatch[0]);
      
      return {
        actionCenterX: analysis.actionCenterX || 0.5,
        actionCenterY: analysis.actionCenterY || 0.5,
        confidence: analysis.confidence || 0.5,
        detectedObjects: analysis.detectedObjects || ['unknown'],
        movementIntensity: analysis.movementIntensity || 0.5
      };

    } catch (error) {
      console.error('Composite frame analysis error:', error);
      // Fallback to center
      return {
        actionCenterX: 0.5,
        actionCenterY: 0.5,
        confidence: 0.3,
        detectedObjects: ['unknown'],
        movementIntensity: 0.5
      };
    }
  }

  /**
   * Step 2b: Analyze segment using Gemini AI directly
   */
  private async analyzeSegmentWithGemini(
    inputPath: string,
    segment: VideoSegment
  ): Promise<CompositeFrameAnalysis> {
    // Extract a few representative frames from the segment
    const frameAnalyses: CompositeFrameAnalysis[] = [];
    const frameCount = Math.min(3, Math.ceil(segment.duration)); // Extract up to 3 frames
    
    for (let i = 0; i < frameCount; i++) {
      const frameTime = segment.startTime + (segment.duration * i / (frameCount - 1 || 1));
      const analysis = await this.analyzeFrameWithGemini(inputPath, frameTime);
      frameAnalyses.push(analysis);
    }

    // Average the results
    const avgX = frameAnalyses.reduce((sum, a) => sum + a.actionCenterX, 0) / frameAnalyses.length;
    const avgY = frameAnalyses.reduce((sum, a) => sum + a.actionCenterY, 0) / frameAnalyses.length;
    const avgConfidence = frameAnalyses.reduce((sum, a) => sum + a.confidence, 0) / frameAnalyses.length;
    const avgIntensity = frameAnalyses.reduce((sum, a) => sum + a.movementIntensity, 0) / frameAnalyses.length;
    
    const allObjects = Array.from(new Set(frameAnalyses.flatMap(a => a.detectedObjects)));

    return {
      actionCenterX: avgX,
      actionCenterY: avgY,
      confidence: avgConfidence,
      detectedObjects: allObjects,
      movementIntensity: avgIntensity
    };
  }

  /**
   * Analyze single frame with Gemini
   */
  private async analyzeFrameWithGemini(inputPath: string, timestamp: number): Promise<CompositeFrameAnalysis> {
    const framePath = path.join(this.tempDir, `frame_${timestamp}.jpg`);

    return new Promise((resolve, reject) => {
      // Extract frame at timestamp
      const ffmpeg = spawn('ffmpeg', [
        '-y',
        '-i', inputPath,
        '-ss', timestamp.toString(),
        '-frames:v', '1',
        '-q:v', '2',
        framePath
      ]);

      ffmpeg.on('close', async (code) => {
        if (code !== 0) {
          reject(new Error('Failed to extract frame'));
          return;
        }

        try {
          const imageBytes = await readFile(framePath);
          const model = this.ai.getGenerativeModel({ model: 'gemini-1.5-flash' });

          const prompt = `Analyze this video frame to identify the main subject/action center.

Please identify:
1. The horizontal center of the main subject/action (X coordinate from 0.0 to 1.0)
2. The vertical center of the main subject/action (Y coordinate from 0.0 to 1.0)
3. Confidence in this analysis (0.0 to 1.0)
4. What objects/subjects are present
5. Estimated movement intensity if this were part of a video (0.0 to 1.0)

Respond in JSON format:
{
  "actionCenterX": 0.5,
  "actionCenterY": 0.5,
  "confidence": 0.8,
  "detectedObjects": ["person", "car"],
  "movementIntensity": 0.7
}`;

          const result = await model.generateContent([
            {
              inlineData: {
                data: imageBytes.toString('base64'),
                mimeType: 'image/jpeg'
              }
            },
            prompt
          ]);

          const response = result.response.text() || '{}';
          const jsonMatch = response.match(/\{[\s\S]*\}/);
          if (!jsonMatch) {
            throw new Error('No valid JSON found in response');
          }

          const analysis = JSON.parse(jsonMatch[0]);
          
          resolve({
            actionCenterX: analysis.actionCenterX || 0.5,
            actionCenterY: analysis.actionCenterY || 0.5,
            confidence: analysis.confidence || 0.5,
            detectedObjects: analysis.detectedObjects || ['unknown'],
            movementIntensity: analysis.movementIntensity || 0.5
          });

        } catch (error) {
          console.error('Frame analysis error:', error);
          resolve({
            actionCenterX: 0.5,
            actionCenterY: 0.5,
            confidence: 0.3,
            detectedObjects: ['unknown'],
            movementIntensity: 0.5
          });
        }
      });
    });
  }

  /**
   * Step 3: Generate smooth interpolated crop coordinates for all frames
   */
  private generateSmoothCropPath(segments: VideoSegment[], totalDuration: number, fps: number): Array<{
    time: number;
    cropX: number;
    cropY: number;
    confidence: number;
  }> {
    const cropPath: Array<{ time: number; cropX: number; cropY: number; confidence: number; }> = [];
    const totalFrames = Math.ceil(totalDuration * fps);
    
    console.log(`Generating smooth crop path for ${totalFrames} frames at ${fps} fps`);
    
    // Create interpolation points for every frame
    for (let frame = 0; frame < totalFrames; frame++) {
      const time = frame / fps;
      
      // Find the surrounding segments for interpolation
      const currentSegment = segments.find(s => time >= s.startTime && time <= s.endTime);
      
      if (currentSegment) {
        // Use exact segment coordinates
        cropPath.push({
          time,
          cropX: currentSegment.actionCenterX,
          cropY: 0.5, // Default center for Y
          confidence: currentSegment.confidence
        });
      } else {
        // Interpolate between segments
        const beforeSegment = segments.filter(s => s.endTime <= time).pop();
        const afterSegment = segments.find(s => s.startTime > time);
        
        if (beforeSegment && afterSegment) {
          // Linear interpolation between segments
          const totalDistance = afterSegment.startTime - beforeSegment.endTime;
          const currentDistance = time - beforeSegment.endTime;
          const ratio = currentDistance / totalDistance;
          
          const interpolatedX = beforeSegment.actionCenterX + 
            (afterSegment.actionCenterX - beforeSegment.actionCenterX) * ratio;
          
          cropPath.push({
            time,
            cropX: interpolatedX,
            cropY: 0.5,
            confidence: Math.min(beforeSegment.confidence, afterSegment.confidence) * 0.8 // Lower confidence for interpolated
          });
        } else if (beforeSegment) {
          // Use last known position
          cropPath.push({
            time,
            cropX: beforeSegment.actionCenterX,
            cropY: 0.5,
            confidence: beforeSegment.confidence * 0.9
          });
        } else if (afterSegment) {
          // Use next known position
          cropPath.push({
            time,
            cropX: afterSegment.actionCenterX,
            cropY: 0.5,
            confidence: afterSegment.confidence * 0.9
          });
        } else {
          // Default center position
          cropPath.push({
            time,
            cropX: 0.5,
            cropY: 0.5,
            confidence: 0.5
          });
        }
      }
    }
    
    // Apply smoothing to reduce jitter
    return this.smoothCropPath(cropPath);
  }

  /**
   * Apply smoothing algorithm to crop path
   */
  private smoothCropPath(cropPath: Array<{ time: number; cropX: number; cropY: number; confidence: number; }>): Array<{ time: number; cropX: number; cropY: number; confidence: number; }> {
    const smoothed = [...cropPath];
    const windowSize = 5; // Smoothing window
    
    for (let i = windowSize; i < smoothed.length - windowSize; i++) {
      let sumX = 0;
      let sumY = 0;
      let totalWeight = 0;
      
      // Weighted moving average
      for (let j = -windowSize; j <= windowSize; j++) {
        const weight = Math.exp(-Math.abs(j) / 2); // Gaussian-like weight
        const idx = i + j;
        
        sumX += smoothed[idx].cropX * weight;
        sumY += smoothed[idx].cropY * weight;
        totalWeight += weight;
      }
      
      smoothed[i].cropX = sumX / totalWeight;
      smoothed[i].cropY = sumY / totalWeight;
    }
    
    return smoothed;
  }

  /**
   * Get video information (width, height, duration, fps)
   */
  private async getVideoInfo(inputPath: string): Promise<{
    width: number;
    height: number;
    duration: number;
    fps: number;
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
        if (code !== 0) {
          reject(new Error('Failed to get video info'));
          return;
        }

        try {
          const info = JSON.parse(output);
          const videoStream = info.streams.find((s: any) => s.codec_type === 'video');
          
          if (!videoStream) {
            reject(new Error('No video stream found'));
            return;
          }

          resolve({
            width: parseInt(videoStream.width),
            height: parseInt(videoStream.height),
            duration: parseFloat(info.format.duration),
            fps: eval(videoStream.r_frame_rate) // Convert fraction to decimal
          });
        } catch (error) {
          reject(error);
        }
      });
    });
  }

  /**
   * Apply smooth crop to entire video using interpolated coordinates
   */
  private async applySmoothCropToVideo(
    inputPath: string,
    outputPath: string,
    cropPath: Array<{ time: number; cropX: number; cropY: number; confidence: number; }>,
    targetAspectRatio: '9:16' | '16:9' | '1:1'
  ): Promise<void> {
    // Get video dimensions first
    const videoInfo = await this.getVideoInfo(inputPath);
    const { width, height } = this.calculateCropDimensions(videoInfo.width, videoInfo.height, targetAspectRatio);
    
    // Generate dynamic crop filter with smooth transitions
    const cropFilter = this.generateDynamicCropFilter(cropPath, width, height, videoInfo.width, videoInfo.height);
    
    return new Promise((resolve, reject) => {
      const ffmpeg = spawn('ffmpeg', [
        '-y',
        '-i', inputPath,
        '-filter_complex', cropFilter,
        '-map', '[cropped]',
        '-c:a', 'copy',
        '-preset', 'fast',
        '-crf', '23',
        outputPath
      ]);

      ffmpeg.on('close', (code) => {
        if (code === 0) {
          console.log('Smooth crop applied successfully');
          resolve();
        } else {
          reject(new Error(`FFmpeg smooth crop failed with code ${code}`));
        }
      });

      ffmpeg.stderr.on('data', (data) => {
        process.stdout.write(`FFmpeg smooth crop: ${data}`);
      });
    });
  }

  /**
   * Calculate crop dimensions for target aspect ratio
   */
  private calculateCropDimensions(videoWidth: number, videoHeight: number, targetAspectRatio: '9:16' | '16:9' | '1:1'): {
    width: number;
    height: number;
  } {
    let targetRatio: number;
    
    switch (targetAspectRatio) {
      case '9:16':
        targetRatio = 9 / 16;
        break;
      case '16:9':
        targetRatio = 16 / 9;
        break;
      case '1:1':
        targetRatio = 1;
        break;
      default:
        targetRatio = videoWidth / videoHeight;
    }
    
    const currentRatio = videoWidth / videoHeight;
    
    if (currentRatio > targetRatio) {
      // Video is wider, crop width
      return {
        width: Math.floor(videoHeight * targetRatio),
        height: videoHeight
      };
    } else {
      // Video is taller, crop height
      return {
        width: videoWidth,
        height: Math.floor(videoWidth / targetRatio)
      };
    }
  }

  /**
   * Generate dynamic crop filter with smooth coordinate changes
   */
  private generateDynamicCropFilter(
    cropPath: Array<{ time: number; cropX: number; cropY: number; confidence: number; }>,
    cropWidth: number,
    cropHeight: number,
    videoWidth: number,
    videoHeight: number
  ): string {
    // Create expressions for dynamic cropping
    const maxX = videoWidth - cropWidth;
    const maxY = videoHeight - cropHeight;
    
    // Simplify for better performance if coordinates don't change much
    const avgX = cropPath.reduce((sum, point) => sum + point.cropX, 0) / cropPath.length;
    const variance = cropPath.reduce((sum, point) => sum + Math.pow(point.cropX - avgX, 2), 0) / cropPath.length;
    
    if (variance < 0.01) {
      // Low variance, use simple static crop
      const staticX = Math.max(0, Math.min(maxX, avgX * videoWidth - cropWidth / 2));
      const staticY = Math.max(0, Math.min(maxY, 0.5 * videoHeight - cropHeight / 2));
      return `[0:v]crop=${cropWidth}:${cropHeight}:${staticX}:${staticY}[cropped]`;
    }
    
    // For dynamic cropping, sample key points and use linear interpolation
    const keyPoints = this.sampleKeyPoints(cropPath, 10); // Sample 10 key points
    let xExpression = this.buildInterpolationExpression(keyPoints, 'cropX', cropWidth, videoWidth);
    let yExpression = Math.max(0, Math.min(maxY, 0.5 * videoHeight - cropHeight / 2)); // Static Y for now
    
    return `[0:v]crop=${cropWidth}:${cropHeight}:${xExpression}:${yExpression}[cropped]`;
  }

  /**
   * Sample key points from crop path for efficient processing
   */
  private sampleKeyPoints(cropPath: Array<{ time: number; cropX: number; cropY: number; confidence: number; }>, maxPoints: number): Array<{ time: number; cropX: number; cropY: number; confidence: number; }> {
    if (cropPath.length <= maxPoints) {
      return cropPath;
    }
    
    const step = Math.floor(cropPath.length / maxPoints);
    const sampled: Array<{ time: number; cropX: number; cropY: number; confidence: number; }> = [];
    
    for (let i = 0; i < cropPath.length; i += step) {
      sampled.push(cropPath[i]);
    }
    
    // Always include the last point
    if (sampled[sampled.length - 1] !== cropPath[cropPath.length - 1]) {
      sampled.push(cropPath[cropPath.length - 1]);
    }
    
    return sampled;
  }

  /**
   * Build FFmpeg interpolation expression
   */
  private buildInterpolationExpression(
    keyPoints: Array<{ time: number; cropX: number; cropY: number; confidence: number; }>,
    field: 'cropX' | 'cropY',
    cropSize: number,
    videoSize: number
  ): string {
    if (keyPoints.length === 1) {
      const value = Math.max(0, Math.min(videoSize - cropSize, keyPoints[0][field] * videoSize - cropSize / 2));
      return value.toString();
    }
    
    // Build piecewise linear interpolation
    const parts: string[] = [];
    
    for (let i = 0; i < keyPoints.length - 1; i++) {
      const current = keyPoints[i];
      const next = keyPoints[i + 1];
      
      const currentVal = Math.max(0, Math.min(videoSize - cropSize, current[field] * videoSize - cropSize / 2));
      const nextVal = Math.max(0, Math.min(videoSize - cropSize, next[field] * videoSize - cropSize / 2));
      
      if (i === 0) {
        parts.push(`if(lt(t,${next.time}),${currentVal}+(${nextVal}-${currentVal})*(t-${current.time})/(${next.time}-${current.time})`);
      } else {
        parts.push(`if(lt(t,${next.time}),${currentVal}+(${nextVal}-${currentVal})*(t-${current.time})/(${next.time}-${current.time})`);
      }
    }
    
    // Add final fallback
    const last = keyPoints[keyPoints.length - 1];
    const lastVal = Math.max(0, Math.min(videoSize - cropSize, last[field] * videoSize - cropSize / 2));
    
    return parts.join(',') + `,${lastVal}` + ')'.repeat(parts.length);
  }

}

export const createIntelligentVideoCropper = (apiKey: string): IntelligentVideoCropper => {
  return new IntelligentVideoCropper(apiKey);
};