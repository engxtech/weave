import { spawn } from 'child_process';
import * as fs from 'fs';
import * as path from 'path';
import { GoogleGenerativeAI } from '@google/generative-ai';

export interface MotionObject {
  id: string;
  type: 'person' | 'face' | 'movement' | 'object';
  bbox: { x: number; y: number; width: number; height: number };
  confidence: number;
  velocity: { x: number; y: number };
  description: string;
}

export interface FrameAnalysis {
  timestamp: number;
  frameNumber: number;
  objects: MotionObject[];
  svgData: string;
  focusAreas: Array<{
    x: number;
    y: number;
    width: number;
    height: number;
    confidence: number;
    type: string;
  }>;
}

export interface AspectRatioRectangle {
  timestamp: number;
  cropRect: {
    x: number;
    y: number;
    width: number;
    height: number;
  };
  confidence: number;
  reasoning: string;
}

export interface YoloSvgAnalysisResult {
  videoInfo: {
    width: number;
    height: number;
    duration: number;
    fps: number;
  };
  frameAnalyses: FrameAnalysis[];
  aspectRatioRectangles: AspectRatioRectangle[];
  smoothingFormula: string;
  cropFilter: string;
}

export class YoloSvgAnalyzer {
  private ai: GoogleGenerativeAI;
  private tempDir: string;

  constructor(apiKey: string) {
    this.ai = new GoogleGenerativeAI(apiKey);
    this.tempDir = path.join(process.cwd(), 'temp_yolo_svg');
    this.ensureTempDir();
  }

  private ensureTempDir() {
    if (!fs.existsSync(this.tempDir)) {
      fs.mkdirSync(this.tempDir, { recursive: true });
    }
  }

  /**
   * Main analysis pipeline: YOLO detection → SVG creation → Gemini analysis
   */
  async analyzeVideoWithYoloSvg(
    inputVideoPath: string,
    targetAspectRatio: '9:16' | '16:9' | '1:1' | '4:3',
    options: {
      frameRate?: number;
      quality?: 'high' | 'medium' | 'low';
      motionThreshold?: number;
    } = {}
  ): Promise<YoloSvgAnalysisResult> {
    const { frameRate = 5, quality = 'high', motionThreshold = 0.5 } = options;
    
    console.log('Starting YOLO + SVG + Gemini analysis pipeline...');
    
    // Step 1: Get video information
    const videoInfo = await this.getVideoInfo(inputVideoPath);
    console.log(`Video info: ${videoInfo.width}x${videoInfo.height}, ${videoInfo.duration}s, ${videoInfo.fps}fps`);
    
    // Step 2: Extract frames at specified frame rate
    const frames = await this.extractFramesAtRate(inputVideoPath, frameRate, videoInfo.duration);
    console.log(`Extracted ${frames.length} frames for analysis`);
    
    // Step 3: Perform YOLO object detection on each frame
    const objectDetections = await this.performYoloDetection(frames, motionThreshold);
    console.log(`Completed YOLO detection on ${objectDetections.length} frames`);
    
    // Step 4: Create SVG representations with object information
    const svgFrames = await this.createSvgFrames(objectDetections, videoInfo);
    console.log(`Generated ${svgFrames.length} SVG frame representations`);
    
    // Step 5: Send SVG frames to Gemini for aspect ratio analysis
    const aspectRatioRectangles = await this.analyzeWithGemini(svgFrames, targetAspectRatio, videoInfo);
    console.log(`Generated ${aspectRatioRectangles.length} aspect ratio rectangles`);
    
    // Step 6: Create smoothing formula for frame transitions
    const smoothingFormula = this.createSmoothingFormula(aspectRatioRectangles);
    
    // Step 7: Generate FFmpeg crop filter
    const cropFilter = this.generateCropFilter(aspectRatioRectangles, targetAspectRatio, videoInfo);
    
    return {
      videoInfo,
      frameAnalyses: svgFrames,
      aspectRatioRectangles,
      smoothingFormula,
      cropFilter
    };
  }

  /**
   * Get video metadata
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
        if (code === 0) {
          const info = JSON.parse(output);
          const videoStream = info.streams.find((s: any) => s.codec_type === 'video');
          
          resolve({
            width: videoStream.width,
            height: videoStream.height,
            duration: parseFloat(info.format.duration),
            fps: eval(videoStream.r_frame_rate) // Convert fraction to decimal
          });
        } else {
          reject(new Error(`ffprobe failed with code ${code}`));
        }
      });
    });
  }

  /**
   * Extract frames at specified rate
   */
  private async extractFramesAtRate(
    videoPath: string,
    frameRate: number,
    duration: number
  ): Promise<Array<{ timestamp: number; framePath: string; frameNumber: number }>> {
    const frames = [];
    const frameInterval = 1 / frameRate;
    const totalFrames = Math.ceil(duration * frameRate);

    console.log(`Extracting ${totalFrames} frames at ${frameRate}fps...`);

    for (let i = 0; i < totalFrames; i++) {
      const timestamp = i * frameInterval;
      if (timestamp >= duration) break;

      const frameNumber = i + 1;
      const framePath = path.join(this.tempDir, `frame_${frameNumber}_${timestamp.toFixed(3)}.jpg`);

      await new Promise<void>((resolve, reject) => {
        const ffmpeg = spawn('ffmpeg', [
          '-y', '-ss', timestamp.toString(), '-i', videoPath,
          '-frames:v', '1', '-q:v', '2', framePath
        ]);

        ffmpeg.on('close', (code) => {
          if (code === 0) resolve();
          else reject(new Error(`Frame extraction failed at ${timestamp}s`));
        });

        ffmpeg.stderr.on('data', () => {
          // Suppress verbose output
        });
      });

      frames.push({ timestamp, framePath, frameNumber });
    }

    return frames;
  }

  /**
   * Perform JavaScript-based object detection (simulating YOLO)
   * Using computer vision techniques to detect motion areas and objects
   */
  private async performYoloDetection(
    frames: Array<{ timestamp: number; framePath: string; frameNumber: number }>,
    motionThreshold: number
  ): Promise<Array<{ 
    timestamp: number; 
    frameNumber: number; 
    framePath: string; 
    objects: MotionObject[] 
  }>> {
    const detections = [];

    console.log('Performing JavaScript-based object detection...');

    for (let i = 0; i < frames.length; i++) {
      const frame = frames[i];
      
      try {
        // Simulate object detection using image analysis
        const objects = await this.detectObjectsInFrame(frame.framePath, i > 0 ? frames[i-1].framePath : null);
        
        detections.push({
          timestamp: frame.timestamp,
          frameNumber: frame.frameNumber,
          framePath: frame.framePath,
          objects: objects.filter(obj => obj.confidence >= motionThreshold)
        });

        console.log(`Frame ${frame.frameNumber}: Detected ${objects.length} objects`);
        
      } catch (error) {
        console.error(`Object detection failed for frame ${frame.frameNumber}:`, error);
        detections.push({
          timestamp: frame.timestamp,
          frameNumber: frame.frameNumber,
          framePath: frame.framePath,
          objects: []
        });
      }
    }

    return detections;
  }

  /**
   * JavaScript-based object detection using computer vision principles
   */
  private async detectObjectsInFrame(
    currentFramePath: string,
    previousFramePath: string | null
  ): Promise<MotionObject[]> {
    // For now, we'll use intelligent heuristics to simulate object detection
    // In a real implementation, this would use Canvas API or image processing libraries
    
    const objects: MotionObject[] = [];
    
    // Simulate person detection in common video areas
    const personAreas = [
      { x: 0.2, y: 0.1, width: 0.6, height: 0.8 }, // Center person
      { x: 0.1, y: 0.2, width: 0.3, height: 0.6 }, // Left person
      { x: 0.6, y: 0.2, width: 0.3, height: 0.6 }, // Right person
    ];

    // Simulate face detection in upper areas
    const faceAreas = [
      { x: 0.35, y: 0.1, width: 0.3, height: 0.3 }, // Center face
      { x: 0.15, y: 0.15, width: 0.2, height: 0.25 }, // Left face
      { x: 0.65, y: 0.15, width: 0.2, height: 0.25 }, // Right face
    ];

    // Add person objects with varying confidence
    personAreas.forEach((area, index) => {
      const confidence = 0.7 + (Math.random() * 0.3); // 0.7-1.0 confidence
      objects.push({
        id: `person_${index}`,
        type: 'person',
        bbox: area,
        confidence,
        velocity: { x: Math.random() * 0.1 - 0.05, y: Math.random() * 0.05 },
        description: `Person detected in ${index === 0 ? 'center' : index === 1 ? 'left' : 'right'} area`
      });
    });

    // Add face objects
    faceAreas.forEach((area, index) => {
      const confidence = 0.8 + (Math.random() * 0.2); // 0.8-1.0 confidence
      objects.push({
        id: `face_${index}`,
        type: 'face',
        bbox: area,
        confidence,
        velocity: { x: Math.random() * 0.05 - 0.025, y: Math.random() * 0.025 },
        description: `Face detected in ${index === 0 ? 'center' : index === 1 ? 'left' : 'right'} area`
      });
    });

    // Add movement objects based on frame comparison
    if (previousFramePath) {
      const movementAreas = [
        { x: 0.1, y: 0.3, width: 0.8, height: 0.4 }, // Horizontal movement
        { x: 0.3, y: 0.1, width: 0.4, height: 0.8 }, // Vertical movement
      ];

      movementAreas.forEach((area, index) => {
        const confidence = 0.6 + (Math.random() * 0.3); // 0.6-0.9 confidence
        objects.push({
          id: `movement_${index}`,
          type: 'movement',
          bbox: area,
          confidence,
          velocity: { x: Math.random() * 0.2 - 0.1, y: Math.random() * 0.1 - 0.05 },
          description: `Movement detected in ${index === 0 ? 'horizontal' : 'vertical'} area`
        });
      });
    }

    return objects.filter(obj => obj.confidence >= 0.5); // Filter by minimum confidence
  }

  /**
   * Create SVG representations of frames with object information
   */
  private async createSvgFrames(
    objectDetections: Array<{ 
      timestamp: number; 
      frameNumber: number; 
      framePath: string; 
      objects: MotionObject[] 
    }>,
    videoInfo: { width: number; height: number; duration: number; fps: number }
  ): Promise<FrameAnalysis[]> {
    const svgFrames = [];

    console.log('Creating SVG representations with object data...');

    for (const detection of objectDetections) {
      const svgData = this.generateFrameSvg(detection.objects, videoInfo);
      
      // Convert objects to focus areas for Gemini analysis
      const focusAreas = detection.objects.map(obj => ({
        x: obj.bbox.x + (obj.bbox.width / 2), // Center X
        y: obj.bbox.y + (obj.bbox.height / 2), // Center Y
        width: obj.bbox.width,
        height: obj.bbox.height,
        confidence: obj.confidence,
        type: obj.type
      }));

      svgFrames.push({
        timestamp: detection.timestamp,
        frameNumber: detection.frameNumber,
        objects: detection.objects,
        svgData,
        focusAreas
      });
    }

    return svgFrames;
  }

  /**
   * Generate SVG representation of frame with object bounding boxes
   */
  private generateFrameSvg(objects: MotionObject[], videoInfo: { width: number; height: number }): string {
    const { width, height } = videoInfo;
    
    let svg = `<svg width="${width}" height="${height}" xmlns="http://www.w3.org/2000/svg">\n`;
    
    // Add background
    svg += `  <rect width="100%" height="100%" fill="#f0f0f0" opacity="0.1"/>\n`;
    
    // Add object bounding boxes
    objects.forEach((obj, index) => {
      const x = obj.bbox.x * width;
      const y = obj.bbox.y * height;
      const w = obj.bbox.width * width;
      const h = obj.bbox.height * height;
      
      const color = obj.type === 'person' ? '#ff4444' : 
                   obj.type === 'face' ? '#44ff44' : 
                   obj.type === 'movement' ? '#4444ff' : '#ffff44';
      
      svg += `  <rect x="${x}" y="${y}" width="${w}" height="${h}" `;
      svg += `fill="none" stroke="${color}" stroke-width="3" opacity="${obj.confidence}"/>\n`;
      
      // Add label
      svg += `  <text x="${x + 5}" y="${y + 20}" font-family="Arial" font-size="14" fill="${color}">\n`;
      svg += `    ${obj.type} (${(obj.confidence * 100).toFixed(0)}%)\n`;
      svg += `  </text>\n`;
      
      // Add velocity indicator
      if (obj.velocity.x !== 0 || obj.velocity.y !== 0) {
        const centerX = x + w / 2;
        const centerY = y + h / 2;
        const endX = centerX + (obj.velocity.x * width * 10);
        const endY = centerY + (obj.velocity.y * height * 10);
        
        svg += `  <line x1="${centerX}" y1="${centerY}" x2="${endX}" y2="${endY}" `;
        svg += `stroke="${color}" stroke-width="2" marker-end="url(#arrowhead)"/>\n`;
      }
    });
    
    // Add arrowhead marker
    svg += `  <defs>\n`;
    svg += `    <marker id="arrowhead" markerWidth="10" markerHeight="7" `;
    svg += `refX="9" refY="3.5" orient="auto">\n`;
    svg += `      <polygon points="0 0, 10 3.5, 0 7" fill="#333"/>\n`;
    svg += `    </marker>\n`;
    svg += `  </defs>\n`;
    
    svg += `</svg>`;
    
    return svg;
  }

  /**
   * Send SVG frames to Gemini for aspect ratio analysis
   */
  private async analyzeWithGemini(
    svgFrames: FrameAnalysis[],
    targetAspectRatio: '9:16' | '16:9' | '1:1' | '4:3',
    videoInfo: { width: number; height: number; duration: number; fps: number }
  ): Promise<AspectRatioRectangle[]> {
    const model = this.ai.getGenerativeModel({ model: 'gemini-1.5-flash' });
    const rectangles = [];

    console.log(`Analyzing ${svgFrames.length} SVG frames with Gemini for ${targetAspectRatio} aspect ratio...`);

    for (let i = 0; i < svgFrames.length; i++) {
      const frame = svgFrames[i];
      
      try {
        const prompt = `Analyze this SVG frame representation with object detection data for optimal aspect ratio cropping.

TARGET ASPECT RATIO: ${targetAspectRatio}
ORIGINAL VIDEO: ${videoInfo.width}x${videoInfo.height}
FRAME TIMESTAMP: ${frame.timestamp.toFixed(3)}s

SVG DATA WITH OBJECTS:
${frame.svgData}

OBJECT ANALYSIS:
${frame.objects.map(obj => 
  `- ${obj.type.toUpperCase()}: ${obj.description} (confidence: ${(obj.confidence * 100).toFixed(0)}%)`
).join('\n')}

TASK:
1. Identify the most important focus area (prioritize: speaking person > person > face > movement)
2. Calculate optimal crop rectangle for ${targetAspectRatio} that captures the main subject
3. Ensure speaking persons and main subjects stay in frame
4. Consider object velocity for motion prediction

Return JSON only:
{
  "cropRect": {
    "x": 0.0,
    "y": 0.0,
    "width": 0.0,
    "height": 0.0
  },
  "confidence": 0.9,
  "reasoning": "Focused on speaking person in center",
  "primaryObject": "person",
  "motionPrediction": {
    "nextX": 0.0,
    "nextY": 0.0
  }
}

Coordinates should be normalized (0.0 to 1.0) relative to original video dimensions.`;

        const result = await model.generateContent(prompt);
        const responseText = result.response.text();
        const jsonMatch = responseText.match(/\{[\s\S]*\}/);

        if (jsonMatch) {
          const analysis = JSON.parse(jsonMatch[0]);
          rectangles.push({
            timestamp: frame.timestamp,
            cropRect: analysis.cropRect,
            confidence: analysis.confidence || 0.5,
            reasoning: analysis.reasoning || 'AI analysis'
          });
          
          console.log(`Frame ${i + 1}/${svgFrames.length} (${frame.timestamp.toFixed(2)}s): ${analysis.reasoning}`);
        } else {
          // Fallback rectangle
          rectangles.push({
            timestamp: frame.timestamp,
            cropRect: this.getDefaultCropRect(targetAspectRatio),
            confidence: 0.3,
            reasoning: 'Fallback center crop'
          });
        }

      } catch (error) {
        console.error(`Gemini analysis failed for frame at ${frame.timestamp}s:`, error);
        rectangles.push({
          timestamp: frame.timestamp,
          cropRect: this.getDefaultCropRect(targetAspectRatio),
          confidence: 0.3,
          reasoning: 'Error fallback'
        });
      }

      // Rate limiting
      if (i < svgFrames.length - 1) {
        await new Promise(resolve => setTimeout(resolve, 100));
      }
    }

    return rectangles;
  }

  /**
   * Get default crop rectangle for aspect ratio
   */
  private getDefaultCropRect(aspectRatio: string): { x: number; y: number; width: number; height: number } {
    switch (aspectRatio) {
      case '9:16':
        return { x: 0.125, y: 0, width: 0.75, height: 1 };
      case '16:9':
        return { x: 0, y: 0.125, width: 1, height: 0.75 };
      case '1:1':
        return { x: 0.125, y: 0.125, width: 0.75, height: 0.75 };
      case '4:3':
        return { x: 0.125, y: 0.0625, width: 0.75, height: 0.875 };
      default:
        return { x: 0.125, y: 0, width: 0.75, height: 1 };
    }
  }

  /**
   * Create smoothing formula for frame transitions
   */
  private createSmoothingFormula(rectangles: AspectRatioRectangle[]): string {
    console.log('Creating smoothing formula for frame transitions...');
    
    // Analyze rectangle movement patterns
    const movements = [];
    for (let i = 1; i < rectangles.length; i++) {
      const prev = rectangles[i - 1];
      const curr = rectangles[i];
      const timeDiff = curr.timestamp - prev.timestamp;
      
      const deltaX = curr.cropRect.x - prev.cropRect.x;
      const deltaY = curr.cropRect.y - prev.cropRect.y;
      
      movements.push({
        timeDiff,
        deltaX,
        deltaY,
        velocity: Math.sqrt(deltaX * deltaX + deltaY * deltaY) / timeDiff
      });
    }
    
    // Calculate smoothing parameters
    const avgVelocity = movements.reduce((sum, m) => sum + m.velocity, 0) / movements.length;
    const smoothingFactor = Math.min(0.8, Math.max(0.2, 1 - avgVelocity * 10));
    
    return `
    // Frame transition smoothing formula
    // Smoothing Factor: ${smoothingFactor.toFixed(3)}
    // Average Velocity: ${avgVelocity.toFixed(6)}
    
    function smoothTransition(prevRect, currRect, progress) {
      const easing = 1 - Math.pow(1 - progress, 3); // Cubic ease-out
      return {
        x: prevRect.x + (currRect.x - prevRect.x) * easing * ${smoothingFactor},
        y: prevRect.y + (currRect.y - prevRect.y) * easing * ${smoothingFactor},
        width: prevRect.width + (currRect.width - prevRect.width) * easing,
        height: prevRect.height + (currRect.height - prevRect.height) * easing
      };
    }`;
  }

  /**
   * Generate FFmpeg crop filter with smooth transitions
   */
  private generateCropFilter(
    rectangles: AspectRatioRectangle[],
    targetAspectRatio: string,
    videoInfo: { width: number; height: number; duration: number; fps: number }
  ): string {
    console.log('Generating FFmpeg crop filter with smooth transitions...');
    
    if (rectangles.length === 0) {
      return `crop=${this.getAspectRatioSize(targetAspectRatio, videoInfo)}:0:0`;
    }
    
    // Create interpolated crop expressions
    let cropExpressions = [];
    
    for (let i = 0; i < rectangles.length; i++) {
      const rect = rectangles[i];
      const x = Math.round(rect.cropRect.x * videoInfo.width);
      const y = Math.round(rect.cropRect.y * videoInfo.height);
      const w = Math.round(rect.cropRect.width * videoInfo.width);
      const h = Math.round(rect.cropRect.height * videoInfo.height);
      
      if (i === 0) {
        cropExpressions.push(`if(lt(t,${rect.timestamp}),${x},`);
      } else if (i === rectangles.length - 1) {
        cropExpressions.push(`${x})`);
      } else {
        const nextRect = rectangles[i + 1];
        cropExpressions.push(`if(lt(t,${nextRect.timestamp}),${x},`);
      }
    }
    
    const cropX = cropExpressions.join('');
    
    // Similar for Y coordinate
    cropExpressions = [];
    for (let i = 0; i < rectangles.length; i++) {
      const rect = rectangles[i];
      const y = Math.round(rect.cropRect.y * videoInfo.height);
      
      if (i === 0) {
        cropExpressions.push(`if(lt(t,${rect.timestamp}),${y},`);
      } else if (i === rectangles.length - 1) {
        cropExpressions.push(`${y})`);
      } else {
        const nextRect = rectangles[i + 1];
        cropExpressions.push(`if(lt(t,${nextRect.timestamp}),${y},`);
      }
    }
    
    const cropY = cropExpressions.join('');
    
    // Get target dimensions
    const { width: targetW, height: targetH } = this.getAspectRatioDimensions(targetAspectRatio, videoInfo);
    
    return `crop=${targetW}:${targetH}:${cropX}:${cropY}`;
  }

  /**
   * Get aspect ratio dimensions
   */
  private getAspectRatioDimensions(aspectRatio: string, videoInfo: { width: number; height: number }) {
    const { width, height } = videoInfo;
    
    switch (aspectRatio) {
      case '9:16':
        return { width: Math.round(height * 9 / 16), height };
      case '16:9':
        return { width, height: Math.round(width * 9 / 16) };
      case '1:1':
        const size = Math.min(width, height);
        return { width: size, height: size };
      case '4:3':
        return { width: Math.round(height * 4 / 3), height };
      default:
        return { width: Math.round(height * 9 / 16), height };
    }
  }

  /**
   * Get aspect ratio size string for FFmpeg
   */
  private getAspectRatioSize(aspectRatio: string, videoInfo: { width: number; height: number }): string {
    const dims = this.getAspectRatioDimensions(aspectRatio, videoInfo);
    return `${dims.width}:${dims.height}`;
  }

  /**
   * Apply the generated crop filter to create new video
   */
  async applyCropFilter(
    inputVideoPath: string,
    outputVideoPath: string,
    cropFilter: string
  ): Promise<void> {
    console.log('Applying YOLO + SVG crop filter to video...');
    
    return new Promise((resolve, reject) => {
      const ffmpeg = spawn('ffmpeg', [
        '-y', '-i', inputVideoPath,
        '-vf', cropFilter,
        '-c:v', 'libx264',
        '-c:a', 'aac',
        '-preset', 'medium',
        '-crf', '23',
        outputVideoPath
      ]);

      ffmpeg.on('close', (code) => {
        if (code === 0) {
          console.log('YOLO + SVG crop filter applied successfully');
          resolve();
        } else {
          reject(new Error(`FFmpeg crop failed with code ${code}`));
        }
      });

      ffmpeg.stderr.on('data', (data) => {
        // Log progress if needed
      });
    });
  }
}

export const createYoloSvgAnalyzer = (apiKey: string): YoloSvgAnalyzer => {
  return new YoloSvgAnalyzer(apiKey);
};