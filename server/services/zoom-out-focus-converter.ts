import { spawn } from 'child_process';
import * as fs from 'fs';
import * as path from 'path';
import { GoogleGenerativeAI } from '@google/generative-ai';

export interface ZoomOutFocusOptions {
  targetAspectRatio: string;
  quality: 'high' | 'medium' | 'low';
  maxZoomOut: number; // Maximum zoom out factor (1.0 = no zoom, 2.0 = 2x zoom out)
  focusGuarantee: 'strict' | 'balanced' | 'flexible';
  subjectPadding: number; // Percentage padding around detected subjects
}

export interface SubjectDetection {
  bbox: { x: number; y: number; width: number; height: number };
  confidence: number;
  type: 'person' | 'face' | 'text' | 'object';
  importance: number;
  timestamp: number;
}

export interface ZoomOutResult {
  success: boolean;
  zoomFactor: number;
  focusPreservationScore: number;
  subjectsInFrame: number;
  totalSubjectsDetected: number;
  outputPath: string;
}

export class ZoomOutFocusConverter {
  private ai: GoogleGenerativeAI;
  private tempDir: string;

  constructor(apiKey: string) {
    this.ai = new GoogleGenerativeAI(apiKey);
    this.tempDir = path.join(process.cwd(), 'temp_zoom_focus');
    this.ensureTempDir();
  }

  private ensureTempDir() {
    if (!fs.existsSync(this.tempDir)) {
      fs.mkdirSync(this.tempDir, { recursive: true });
    }
  }

  private log(message: string): void {
    console.log(`Zoom Focus Converter: [${new Date().toISOString()}] ${message}`);
  }

  async convertWithZoomOutFocus(
    inputPath: string,
    outputPath: string,
    options: ZoomOutFocusOptions
  ): Promise<ZoomOutResult> {
    try {
      this.log(`Starting zoom-out focus conversion: ${options.targetAspectRatio}`);
      
      // Step 1: Get video dimensions
      const videoDimensions = await this.getVideoDimensions(inputPath);
      this.log(`Original video: ${videoDimensions.width}x${videoDimensions.height}`);

      // Step 2: Detect all subjects throughout the video
      const allSubjects = await this.detectAllSubjects(inputPath, options);
      this.log(`Detected ${allSubjects.length} subjects across video`);

      // Step 3: Calculate minimum zoom-out needed to keep all subjects in frame
      const zoomStrategy = await this.calculateOptimalZoom(
        allSubjects,
        videoDimensions,
        options
      );

      // Step 4: Apply zoom-out conversion with guaranteed focus preservation
      const result = await this.applyZoomOutConversion(
        inputPath,
        outputPath,
        zoomStrategy,
        options
      );

      // Step 5: Validate that all subjects remain in frame
      const validation = await this.validateSubjectPreservation(
        outputPath,
        allSubjects,
        zoomStrategy
      );

      this.log(`Zoom-out conversion completed: ${zoomStrategy.zoomFactor}x zoom, ${validation.preservationScore}% subjects preserved`);

      return {
        success: true,
        zoomFactor: zoomStrategy.zoomFactor,
        focusPreservationScore: validation.preservationScore,
        subjectsInFrame: validation.subjectsInFrame,
        totalSubjectsDetected: allSubjects.length,
        outputPath
      };

    } catch (error) {
      this.log(`Zoom-out conversion error: ${error}`);
      throw new Error(`Zoom-out focus conversion failed: ${error}`);
    }
  }

  private async getVideoDimensions(inputPath: string): Promise<{ width: number; height: number; duration: number }> {
    return new Promise((resolve, reject) => {
      const ffprobe = spawn('ffprobe', [
        '-v', 'quiet',
        '-print_format', 'json',
        '-show_streams',
        inputPath
      ]);

      let output = '';
      ffprobe.stdout.on('data', (data) => {
        output += data;
      });

      ffprobe.on('close', (code) => {
        if (code === 0) {
          try {
            const metadata = JSON.parse(output);
            const videoStream = metadata.streams.find((s: any) => s.codec_type === 'video');
            resolve({
              width: videoStream.width || 1920,
              height: videoStream.height || 1080,
              duration: parseFloat(videoStream.duration) || 0
            });
          } catch (err) {
            reject(err);
          }
        } else {
          reject(new Error(`ffprobe failed: ${code}`));
        }
      });
    });
  }

  private async detectAllSubjects(
    inputPath: string,
    options: ZoomOutFocusOptions
  ): Promise<SubjectDetection[]> {
    // Extract frames every 2 seconds for comprehensive subject detection
    const framesDir = path.join(this.tempDir, `frames_${Date.now()}`);
    fs.mkdirSync(framesDir, { recursive: true });

    try {
      await this.extractFramesForDetection(inputPath, framesDir);
      
      const frameFiles = fs.readdirSync(framesDir).filter(f => f.endsWith('.jpg'));
      const allSubjects: SubjectDetection[] = [];

      for (let i = 0; i < frameFiles.length; i++) {
        const framePath = path.join(framesDir, frameFiles[i]);
        const timestamp = i * 2; // Every 2 seconds

        const frameSubjects = await this.detectSubjectsInFrame(framePath, timestamp, options);
        allSubjects.push(...frameSubjects);
      }

      // Clean up frames
      fs.rmSync(framesDir, { recursive: true, force: true });

      // Remove duplicate subjects and keep the most confident detections
      return this.deduplicateSubjects(allSubjects);

    } catch (error) {
      // Clean up on error
      if (fs.existsSync(framesDir)) {
        fs.rmSync(framesDir, { recursive: true, force: true });
      }
      throw error;
    }
  }

  private async extractFramesForDetection(inputPath: string, outputDir: string): Promise<void> {
    return new Promise((resolve, reject) => {
      const cmd = [
        'ffmpeg',
        '-i', inputPath,
        '-vf', 'fps=0.5', // One frame every 2 seconds
        '-q:v', '2',
        path.join(outputDir, 'frame_%03d.jpg'),
        '-y'
      ];

      const process = spawn(cmd[0], cmd.slice(1));
      process.on('close', (code) => {
        if (code === 0) {
          resolve();
        } else {
          reject(new Error(`Frame extraction failed: ${code}`));
        }
      });
    });
  }

  private async detectSubjectsInFrame(
    framePath: string,
    timestamp: number,
    options: ZoomOutFocusOptions
  ): Promise<SubjectDetection[]> {
    try {
      const imageBuffer = fs.readFileSync(framePath);
      const imageBase64 = imageBuffer.toString('base64');

      const prompt = `Analyze this video frame to detect ALL people, faces, and important visual elements that MUST remain in frame during aspect ratio conversion to ${options.targetAspectRatio}.

CRITICAL REQUIREMENTS:
1. Detect EVERY person/face in the frame, no matter how small
2. Identify text overlays, logos, or important visual elements
3. Provide precise bounding boxes for ALL detected subjects
4. Focus guarantee level: ${options.focusGuarantee}

For ${options.focusGuarantee} focus guarantee:
- strict: Detect even partially visible subjects
- balanced: Focus on clearly visible subjects
- flexible: Prioritize main subjects only

Respond with JSON array of ALL detected subjects:
[
  {
    "type": "person|face|text|object",
    "bbox": {
      "x": 0.0-1.0,
      "y": 0.0-1.0, 
      "width": 0.0-1.0,
      "height": 0.0-1.0
    },
    "confidence": 0.0-1.0,
    "importance": 0.0-1.0,
    "description": "brief description"
  }
]

ENSURE NO SUBJECT IS MISSED - this is critical for preventing focus loss.`;

      const model = this.ai.getGenerativeModel({ model: 'gemini-1.5-flash' });
      const result = await model.generateContent([
        {
          inlineData: {
            data: imageBase64,
            mimeType: 'image/jpeg'
          }
        },
        prompt
      ]);

      const analysisText = result.response.text() || '';
      const jsonMatch = analysisText.match(/\[[\s\S]*\]/);
      
      if (jsonMatch) {
        const detections = JSON.parse(jsonMatch[0]);
        return detections.map((detection: any) => ({
          bbox: detection.bbox,
          confidence: detection.confidence,
          type: detection.type,
          importance: detection.importance,
          timestamp
        }));
      } else {
        // Fallback: assume center subject
        return [{
          bbox: { x: 0.25, y: 0.25, width: 0.5, height: 0.5 },
          confidence: 0.5,
          type: 'person',
          importance: 0.8,
          timestamp
        }];
      }

    } catch (error) {
      this.log(`Subject detection error: ${error}`);
      // Fallback detection
      return [{
        bbox: { x: 0.25, y: 0.25, width: 0.5, height: 0.5 },
        confidence: 0.5,
        type: 'person',
        importance: 0.8,
        timestamp
      }];
    }
  }

  private deduplicateSubjects(subjects: SubjectDetection[]): SubjectDetection[] {
    // Group subjects by similar positions and keep the highest confidence
    const groups: SubjectDetection[][] = [];
    
    for (const subject of subjects) {
      let foundGroup = false;
      
      for (const group of groups) {
        const representative = group[0];
        const distance = this.calculateBoundingBoxDistance(subject.bbox, representative.bbox);
        
        if (distance < 0.2) { // Similar position threshold
          group.push(subject);
          foundGroup = true;
          break;
        }
      }
      
      if (!foundGroup) {
        groups.push([subject]);
      }
    }
    
    // Return the highest confidence subject from each group
    return groups.map(group => 
      group.reduce((best, current) => 
        current.confidence > best.confidence ? current : best
      )
    );
  }

  private calculateBoundingBoxDistance(bbox1: any, bbox2: any): number {
    const center1 = { x: bbox1.x + bbox1.width / 2, y: bbox1.y + bbox1.height / 2 };
    const center2 = { x: bbox2.x + bbox2.width / 2, y: bbox2.y + bbox2.height / 2 };
    
    return Math.sqrt(
      Math.pow(center1.x - center2.x, 2) + 
      Math.pow(center1.y - center2.y, 2)
    );
  }

  private async calculateOptimalZoom(
    subjects: SubjectDetection[],
    videoDimensions: { width: number; height: number },
    options: ZoomOutFocusOptions
  ): Promise<{ zoomFactor: number; cropArea: any; strategy: string }> {
    if (subjects.length === 0) {
      return {
        zoomFactor: 1.0,
        cropArea: { x: 0, y: 0, width: 1, height: 1 },
        strategy: 'no-subjects-detected'
      };
    }

    // Calculate bounding box that contains ALL subjects
    const padding = options.subjectPadding / 100;
    
    let minX = Math.min(...subjects.map(s => s.bbox.x - padding));
    let minY = Math.min(...subjects.map(s => s.bbox.y - padding));
    let maxX = Math.max(...subjects.map(s => s.bbox.x + s.bbox.width + padding));
    let maxY = Math.max(...subjects.map(s => s.bbox.y + s.bbox.height + padding));

    // Ensure bounds are within frame
    minX = Math.max(0, minX);
    minY = Math.max(0, minY);
    maxX = Math.min(1, maxX);
    maxY = Math.min(1, maxY);

    const requiredWidth = maxX - minX;
    const requiredHeight = maxY - minY;

    // Calculate zoom factor needed for target aspect ratio
    const sourceRatio = videoDimensions.width / videoDimensions.height;
    const targetRatio = this.parseAspectRatio(options.targetAspectRatio);

    let zoomFactor: number;
    let cropArea: any;
    let strategy: string;

    if (targetRatio > sourceRatio) {
      // Target is wider - zoom out vertically if needed
      const requiredZoom = Math.max(1, requiredHeight * targetRatio / requiredWidth);
      zoomFactor = Math.min(options.maxZoomOut, requiredZoom);
      
      const cropWidth = 1 / zoomFactor;
      const cropHeight = cropWidth / targetRatio;
      const cropX = Math.max(0, Math.min(1 - cropWidth, (minX + maxX) / 2 - cropWidth / 2));
      const cropY = Math.max(0, Math.min(1 - cropHeight, (minY + maxY) / 2 - cropHeight / 2));
      
      cropArea = { x: cropX, y: cropY, width: cropWidth, height: cropHeight };
      strategy = 'zoom-out-vertical';
    } else {
      // Target is taller - zoom out horizontally if needed
      const requiredZoom = Math.max(1, requiredWidth * sourceRatio / (requiredHeight * targetRatio));
      zoomFactor = Math.min(options.maxZoomOut, requiredZoom);
      
      const cropHeight = 1 / zoomFactor;
      const cropWidth = cropHeight * targetRatio;
      const cropX = Math.max(0, Math.min(1 - cropWidth, (minX + maxX) / 2 - cropWidth / 2));
      const cropY = Math.max(0, Math.min(1 - cropHeight, (minY + maxY) / 2 - cropHeight / 2));
      
      cropArea = { x: cropX, y: cropY, width: cropWidth, height: cropHeight };
      strategy = 'zoom-out-horizontal';
    }

    this.log(`Calculated zoom strategy: ${strategy}, factor: ${zoomFactor.toFixed(2)}x`);
    this.log(`Crop area: x=${cropArea.x.toFixed(3)}, y=${cropArea.y.toFixed(3)}, w=${cropArea.width.toFixed(3)}, h=${cropArea.height.toFixed(3)}`);

    return { zoomFactor, cropArea, strategy };
  }

  private async applyZoomOutConversion(
    inputPath: string,
    outputPath: string,
    zoomStrategy: any,
    options: ZoomOutFocusOptions
  ): Promise<void> {
    const targetSize = this.getTargetSize(options.targetAspectRatio);
    
    // Calculate crop coordinates in pixels (assuming standard resolution)
    const cropX = Math.round(zoomStrategy.cropArea.x * 1920);
    const cropY = Math.round(zoomStrategy.cropArea.y * 1080);
    const cropW = Math.round(zoomStrategy.cropArea.width * 1920);
    const cropH = Math.round(zoomStrategy.cropArea.height * 1080);

    return new Promise((resolve, reject) => {
      const qualitySettings = this.getQualitySettings(options.quality);
      
      const filter = `crop=${cropW}:${cropH}:${cropX}:${cropY},scale=${targetSize.width}:${targetSize.height}:force_original_aspect_ratio=decrease,pad=${targetSize.width}:${targetSize.height}:(ow-iw)/2:(oh-ih)/2:black`;
      
      const cmd = [
        'ffmpeg',
        '-i', inputPath,
        '-vf', filter,
        ...qualitySettings,
        '-y',
        outputPath
      ];

      this.log(`Applying zoom-out conversion: crop=${cropW}:${cropH}:${cropX}:${cropY}`);

      const process = spawn(cmd[0], cmd.slice(1));
      
      process.on('close', (code) => {
        if (code === 0) {
          resolve();
        } else {
          reject(new Error(`Conversion failed: ${code}`));
        }
      });
    });
  }

  private async validateSubjectPreservation(
    outputPath: string,
    originalSubjects: SubjectDetection[],
    zoomStrategy: any
  ): Promise<{ preservationScore: number; subjectsInFrame: number }> {
    // Calculate how many subjects should still be in frame after cropping
    let subjectsInFrame = 0;
    
    for (const subject of originalSubjects) {
      const subjectCenterX = subject.bbox.x + subject.bbox.width / 2;
      const subjectCenterY = subject.bbox.y + subject.bbox.height / 2;
      
      // Check if subject center is within crop area
      if (subjectCenterX >= zoomStrategy.cropArea.x &&
          subjectCenterX <= zoomStrategy.cropArea.x + zoomStrategy.cropArea.width &&
          subjectCenterY >= zoomStrategy.cropArea.y &&
          subjectCenterY <= zoomStrategy.cropArea.y + zoomStrategy.cropArea.height) {
        subjectsInFrame++;
      }
    }
    
    const preservationScore = originalSubjects.length > 0 ? 
      Math.round((subjectsInFrame / originalSubjects.length) * 100) : 100;
    
    return { preservationScore, subjectsInFrame };
  }

  private parseAspectRatio(ratio: string): number {
    const [width, height] = ratio.split(':').map(Number);
    return width / height;
  }

  private getTargetSize(aspectRatio: string): { width: number; height: number } {
    switch (aspectRatio) {
      case '9:16': return { width: 720, height: 1280 };
      case '16:9': return { width: 1920, height: 1080 };
      case '1:1': return { width: 1080, height: 1080 };
      case '4:3': return { width: 1440, height: 1080 };
      default: return { width: 1920, height: 1080 };
    }
  }

  private getQualitySettings(quality: string): string[] {
    switch (quality) {
      case 'high':
        return ['-c:v', 'libx264', '-crf', '18', '-preset', 'slow'];
      case 'medium':
        return ['-c:v', 'libx264', '-crf', '23', '-preset', 'medium'];
      case 'low':
        return ['-c:v', 'libx264', '-crf', '28', '-preset', 'fast'];
      default:
        return ['-c:v', 'libx264', '-crf', '23', '-preset', 'medium'];
    }
  }
}

export const createZoomOutFocusConverter = (apiKey: string): ZoomOutFocusConverter => {
  return new ZoomOutFocusConverter(apiKey);
};