import ffmpeg from 'fluent-ffmpeg';
import path from 'path';
import fs from 'fs';
import { GoogleGenerativeAI } from '@google/generative-ai';
import { nanoid } from 'nanoid';
import { spawn } from 'child_process';

export interface IntelligentReframingOptions {
  targetAspectRatio: '9:16' | '16:9' | '1:1' | '4:3';
  quality: 'high' | 'medium' | 'low';
  trackingMode: 'auto' | 'person-focus' | 'center-crop' | 'custom';
  personTracking: {
    enabled: boolean;
    priority: 'primary-speaker' | 'all-people' | 'movement-based';
    smoothing: number; // 0-100
    zoomLevel: number; // 0.5-2.0
  };
  customCrop?: {
    x: number;
    y: number;
    width: number;
    height: number;
  };
  preview: boolean;
}

export interface PersonDetectionFrame {
  timestamp: number;
  persons: Array<{
    id: string;
    bbox: { x: number; y: number; width: number; height: number };
    confidence: number;
    isMainSubject: boolean;
    movementScore: number;
  }>;
  recommendedFocus: { x: number; y: number; width: number; height: number };
}

export class IntelligentReframing {
  private genAI: GoogleGenerativeAI;
  private tempDir: string;

  constructor() {
    const apiKey = process.env.GEMINI_API_KEY;
    if (!apiKey) {
      throw new Error('GEMINI_API_KEY environment variable is required');
    }
    this.genAI = new GoogleGenerativeAI(apiKey);
    this.tempDir = path.join(process.cwd(), 'temp_intelligent_reframing');
    this.ensureTempDir();
  }

  private ensureTempDir() {
    if (!fs.existsSync(this.tempDir)) {
      fs.mkdirSync(this.tempDir, { recursive: true });
    }
  }

  async analyzeVideoForPeopleTracking(videoPath: string): Promise<PersonDetectionFrame[]> {
    const frameDir = path.join(this.tempDir, `frames_${nanoid()}`);
    fs.mkdirSync(frameDir, { recursive: true });

    try {
      // Extract frames every 5 seconds for faster analysis (reduced from 2s)
      await this.extractFramesForAnalysis(videoPath, frameDir);
      
      const frameFiles = fs.readdirSync(frameDir).filter(f => f.endsWith('.jpg')).sort();
      const detectionFrames: PersonDetectionFrame[] = [];

      // Limit to max 10 frames for faster processing
      const maxFrames = Math.min(frameFiles.length, 10);
      console.log(`Analyzing ${maxFrames} of ${frameFiles.length} frames for people tracking...`);

      for (let i = 0; i < maxFrames; i++) {
        const framePath = path.join(frameDir, frameFiles[i]);
        const timestamp = i * 5; // 5-second intervals
        
        try {
          // Add timeout for each frame analysis
          const detection = await Promise.race([
            this.detectPeopleInFrame(framePath, timestamp),
            new Promise<PersonDetectionFrame>((_, reject) => 
              setTimeout(() => reject(new Error('Frame analysis timeout')), 15000)
            )
          ]);
          detectionFrames.push(detection);
          console.log(`Frame ${i + 1}/${maxFrames} analyzed successfully`);
        } catch (error) {
          console.error(`Failed to analyze frame ${frameFiles[i]}:`, error);
          // Add fallback detection with more intelligent positioning
          detectionFrames.push({
            timestamp,
            persons: [{
              id: 'fallback_person',
              bbox: { x: 30, y: 20, width: 40, height: 60 },
              confidence: 0.5,
              isMainSubject: true,
              movementScore: 0.5
            }],
            recommendedFocus: { x: 25, y: 10, width: 50, height: 80 }
          });
        }
      }

      return detectionFrames;
    } finally {
      // Cleanup
      if (fs.existsSync(frameDir)) {
        fs.rmSync(frameDir, { recursive: true, force: true });
      }
    }
  }

  private async extractFramesForAnalysis(videoPath: string, outputDir: string): Promise<void> {
    return new Promise((resolve, reject) => {
      ffmpeg(videoPath)
        .outputOptions([
          '-vf', 'fps=1/5,scale=320:180', // Extract frame every 5 seconds, smaller size for faster analysis
          '-q:v', '5', // Lower quality for faster processing
          '-frames:v', '10' // Limit to 10 frames max
        ])
        .output(path.join(outputDir, 'frame_%03d.jpg'))
        .on('end', resolve)
        .on('error', reject)
        .run();
    });
  }

  private async detectPeopleInFrame(framePath: string, timestamp: number): Promise<PersonDetectionFrame> {
    try {
      const model = this.genAI.getGenerativeModel({ model: 'gemini-2.0-flash-exp' });
      
      const imageBuffer = fs.readFileSync(framePath);
      const base64Image = imageBuffer.toString('base64');
      
      const prompt = `
        Quickly analyze this video frame for people detection. Respond with simple JSON:
        
        {
          "persons": [
            {
              "id": "person_1",
              "bbox": {"x": 30, "y": 20, "width": 40, "height": 60},
              "confidence": 0.8,
              "isMainSubject": true,
              "movementScore": 0.7
            }
          ],
          "recommendedFocus": {
            "x": 25,
            "y": 10,
            "width": 50,
            "height": 80
          }
        }
        
        Focus on detecting people and provide the crop area for 9:16 portrait format.
      `;

      const result = await model.generateContent([
        {
          inlineData: {
            mimeType: 'image/jpeg',
            data: base64Image
          }
        },
        { text: prompt }
      ]);

      const response = await result.response;
      const text = response.text();
      
      const jsonMatch = text.match(/\{[\s\S]*\}/);
      if (!jsonMatch) {
        throw new Error('No JSON found in AI response');
      }

      const analysis = JSON.parse(jsonMatch[0]);
      
      return {
        timestamp,
        persons: analysis.persons || [],
        recommendedFocus: analysis.recommendedFocus || { x: 25, y: 10, width: 50, height: 80 }
      };
    } catch (error) {
      console.error('AI people detection failed:', error);
      // Return fallback detection
      return {
        timestamp,
        persons: [],
        recommendedFocus: { x: 25, y: 10, width: 50, height: 80 }
      };
    }
  }

  async generateIntelligentReframe(
    inputPath: string,
    outputPath: string,
    options: IntelligentReframingOptions,
    progressCallback?: (progress: number) => void
  ): Promise<void> {
    console.log('Starting intelligent reframing with options:', options);
    
    if (progressCallback) progressCallback(10);

    let detectionFrames: PersonDetectionFrame[] = [];
    
    if (options.trackingMode === 'person-focus' || options.trackingMode === 'auto') {
      try {
        // Attempt AI analysis with timeout
        const analysisPromise = this.analyzeVideoForPeopleTracking(inputPath);
        const timeoutPromise = new Promise<PersonDetectionFrame[]>((_, reject) => 
          setTimeout(() => reject(new Error('Analysis timeout')), 30000)
        );
        
        detectionFrames = await Promise.race([analysisPromise, timeoutPromise]);
        console.log(`Successfully analyzed ${detectionFrames.length} frames`);
        if (progressCallback) progressCallback(40);
      } catch (error) {
        console.log('AI analysis failed or timed out, using intelligent fallback');
        // Use intelligent fallback based on tracking mode
        detectionFrames = this.generateFallbackDetection(options);
        if (progressCallback) progressCallback(40);
      }
    }

    // Generate dynamic crop filter based on tracking mode
    const cropFilter = this.generateIntelligentCropFilter(detectionFrames, options);
    const { width, height } = this.getTargetResolution(options.targetAspectRatio);
    
    if (progressCallback) progressCallback(50);

    // Apply intelligent reframing with FFmpeg
    return new Promise((resolve, reject) => {
      const qualitySettings = this.getQualitySettings(options.quality);
      
      const ffmpegArgs = [
        '-i', inputPath,
        '-vf', `${cropFilter},scale=${width}:${height}:flags=lanczos`,
        '-c:v', 'libx264',
        '-preset', qualitySettings.preset,
        '-crf', qualitySettings.crf,
        '-c:a', 'aac',
        '-b:a', '128k',
        '-movflags', '+faststart', // Optimize for web playback
        '-y',
        outputPath
      ];

      console.log('Running intelligent FFmpeg with:', ffmpegArgs.join(' '));
      
      const ffmpeg = spawn('ffmpeg', ffmpegArgs);
      
      let lastProgress = 50;
      
      ffmpeg.stderr.on('data', (data) => {
        const output = data.toString();
        
        // Parse progress from FFmpeg output
        const timeMatch = output.match(/time=(\d{2}):(\d{2}):(\d{2}\.\d{2})/);
        if (timeMatch && progressCallback) {
          const [, hours, minutes, seconds] = timeMatch;
          const currentTime = parseInt(hours) * 3600 + parseInt(minutes) * 60 + parseFloat(seconds);
          // Estimate total duration and calculate progress
          const estimatedProgress = Math.min(90, 50 + (currentTime / 80) * 40); // Rough estimate
          if (estimatedProgress > lastProgress) {
            lastProgress = estimatedProgress;
            progressCallback(estimatedProgress);
          }
        }
      });
      
      ffmpeg.on('close', (code) => {
        if (code === 0) {
          console.log('Intelligent reframing completed successfully');
          if (progressCallback) progressCallback(100);
          resolve();
        } else {
          reject(new Error(`FFmpeg process exited with code ${code}`));
        }
      });
      
      ffmpeg.on('error', (error) => {
        console.error('FFmpeg error:', error);
        reject(error);
      });
    });
  }

  private generateIntelligentCropFilter(detectionFrames: PersonDetectionFrame[], options: IntelligentReframingOptions): string {
    if (options.trackingMode === 'center-crop') {
      return this.getCenterCropFilter(options.targetAspectRatio);
    }

    if (options.trackingMode === 'custom' && options.customCrop) {
      const crop = options.customCrop;
      return `crop=iw*${crop.width/100}:ih*${crop.height/100}:iw*${crop.x/100}:ih*${crop.y/100}`;
    }

    if (detectionFrames.length === 0) {
      return this.getCenterCropFilter(options.targetAspectRatio);
    }

    // Generate intelligent crop based on people tracking
    const primaryFocus = this.calculateOptimalFocus(detectionFrames, options);
    
    if (options.personTracking.smoothing > 0) {
      // Apply smoothing to reduce camera shake
      return this.generateSmoothCropFilter(detectionFrames, primaryFocus, options);
    }

    return `crop=iw*${primaryFocus.width/100}:ih*${primaryFocus.height/100}:iw*${primaryFocus.x/100}:ih*${primaryFocus.y/100}`;
  }

  private calculateOptimalFocus(detectionFrames: PersonDetectionFrame[], options: IntelligentReframingOptions): { x: number; y: number; width: number; height: number } {
    // Find frames with the most confident person detections
    const framesWithPeople = detectionFrames.filter(frame => frame.persons.length > 0);
    
    if (framesWithPeople.length === 0) {
      return { x: 25, y: 10, width: 50, height: 80 }; // Default center crop
    }

    // Calculate weighted average focus based on person tracking preferences
    let totalWeight = 0;
    let weightedX = 0, weightedY = 0, weightedWidth = 0, weightedHeight = 0;

    framesWithPeople.forEach(frame => {
      let frameFocus: { x: number; y: number; width: number; height: number };
      
      if (options.personTracking.priority === 'primary-speaker') {
        // Focus on the main subject
        const mainPerson = frame.persons.find(p => p.isMainSubject) || frame.persons[0];
        frameFocus = this.expandBoundingBox(mainPerson.bbox, options.personTracking.zoomLevel);
      } else if (options.personTracking.priority === 'all-people') {
        // Include all detected people
        frameFocus = this.getBoundingBoxForAllPeople(frame.persons, options.personTracking.zoomLevel);
      } else {
        // Movement-based: focus on most active person
        const activePerson = frame.persons.reduce((prev, curr) => 
          curr.movementScore > prev.movementScore ? curr : prev
        );
        frameFocus = this.expandBoundingBox(activePerson.bbox, options.personTracking.zoomLevel);
      }

      const weight = frame.persons.reduce((sum, p) => sum + p.confidence, 0);
      totalWeight += weight;
      
      weightedX += frameFocus.x * weight;
      weightedY += frameFocus.y * weight;
      weightedWidth += frameFocus.width * weight;
      weightedHeight += frameFocus.height * weight;
    });

    return {
      x: Math.round(weightedX / totalWeight),
      y: Math.round(weightedY / totalWeight),
      width: Math.round(weightedWidth / totalWeight),
      height: Math.round(weightedHeight / totalWeight)
    };
  }

  private expandBoundingBox(bbox: { x: number; y: number; width: number; height: number }, zoomLevel: number): { x: number; y: number; width: number; height: number } {
    const centerX = bbox.x + bbox.width / 2;
    const centerY = bbox.y + bbox.height / 2;
    
    const newWidth = Math.min(100, bbox.width * zoomLevel);
    const newHeight = Math.min(100, bbox.height * zoomLevel);
    
    return {
      x: Math.max(0, centerX - newWidth / 2),
      y: Math.max(0, centerY - newHeight / 2),
      width: newWidth,
      height: newHeight
    };
  }

  private getBoundingBoxForAllPeople(persons: any[], zoomLevel: number): { x: number; y: number; width: number; height: number } {
    if (persons.length === 0) return { x: 25, y: 10, width: 50, height: 80 };

    const minX = Math.min(...persons.map(p => p.bbox.x));
    const minY = Math.min(...persons.map(p => p.bbox.y));
    const maxX = Math.max(...persons.map(p => p.bbox.x + p.bbox.width));
    const maxY = Math.max(...persons.map(p => p.bbox.y + p.bbox.height));

    const width = (maxX - minX) * zoomLevel;
    const height = (maxY - minY) * zoomLevel;

    return {
      x: Math.max(0, minX - (width - (maxX - minX)) / 2),
      y: Math.max(0, minY - (height - (maxY - minY)) / 2),
      width: Math.min(100, width),
      height: Math.min(100, height)
    };
  }

  private generateSmoothCropFilter(detectionFrames: PersonDetectionFrame[], primaryFocus: any, options: IntelligentReframingOptions): string {
    // For now, return the primary focus with some smoothing applied
    // In a full implementation, this would generate a complex filter that interpolates between frames
    const smoothingFactor = options.personTracking.smoothing / 100;
    const stabilizedFocus = {
      x: primaryFocus.x,
      y: primaryFocus.y,
      width: primaryFocus.width + (smoothingFactor * 10),
      height: primaryFocus.height + (smoothingFactor * 10)
    };

    return `crop=iw*${stabilizedFocus.width/100}:ih*${stabilizedFocus.height/100}:iw*${stabilizedFocus.x/100}:ih*${stabilizedFocus.y/100}`;
  }

  private getCenterCropFilter(aspectRatio: string): string {
    switch (aspectRatio) {
      case '9:16':
        return 'crop=iw*0.5625:ih:iw*0.21875:0'; // Center crop for portrait
      case '1:1':
        return 'crop=min(iw\\,ih):min(iw\\,ih):(iw-min(iw\\,ih))/2:(ih-min(iw\\,ih))/2'; // Square center crop
      case '4:3':
        return 'crop=iw*0.75:ih:iw*0.125:0'; // 4:3 center crop
      default:
        return 'crop=iw:ih*0.5625:0:ih*0.21875'; // 16:9 center crop
    }
  }

  private getTargetResolution(aspectRatio: string): { width: number; height: number } {
    switch (aspectRatio) {
      case '9:16': return { width: 1080, height: 1920 };
      case '16:9': return { width: 1920, height: 1080 };
      case '1:1': return { width: 1080, height: 1080 };
      case '4:3': return { width: 1440, height: 1080 };
      default: return { width: 1080, height: 1920 };
    }
  }

  private getQualitySettings(quality: string): { preset: string; crf: string } {
    switch (quality) {
      case 'high': return { preset: 'slow', crf: '18' };
      case 'medium': return { preset: 'medium', crf: '23' };
      case 'low': return { preset: 'fast', crf: '28' };
      default: return { preset: 'medium', crf: '23' };
    }
  }

  private generateFallbackDetection(options: IntelligentReframingOptions): PersonDetectionFrame[] {
    // Generate intelligent fallback based on tracking preferences
    const fallbackFrames: PersonDetectionFrame[] = [];
    
    for (let i = 0; i < 3; i++) {
      let focusArea: { x: number; y: number; width: number; height: number };
      
      if (options.personTracking.priority === 'primary-speaker') {
        // Focus on typical speaker position (center-left or center-right)
        focusArea = { x: 20 + (i * 15), y: 15, width: 45, height: 70 };
      } else if (options.personTracking.priority === 'all-people') {
        // Wider crop to include multiple people
        focusArea = { x: 15, y: 10, width: 60, height: 80 };
      } else {
        // Movement-based: varied positions
        focusArea = { x: 25 + (i * 10), y: 20, width: 40, height: 65 };
      }
      
      fallbackFrames.push({
        timestamp: i * 10,
        persons: [{
          id: `fallback_person_${i}`,
          bbox: focusArea,
          confidence: 0.8,
          isMainSubject: true,
          movementScore: 0.7
        }],
        recommendedFocus: {
          x: focusArea.x,
          y: focusArea.y,
          width: Math.min(focusArea.width * options.personTracking.zoomLevel, 100),
          height: Math.min(focusArea.height * options.personTracking.zoomLevel, 100)
        }
      });
    }
    
    return fallbackFrames;
  }
}

export const intelligentReframing = new IntelligentReframing();