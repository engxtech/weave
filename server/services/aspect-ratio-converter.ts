import { spawn } from 'child_process';
import * as fs from 'fs';
import * as path from 'path';
import { nanoid } from 'nanoid';
import { GoogleGenerativeAI } from '@google/generative-ai';
import TokenTracker from './token-tracker';

export interface AspectRatioOptions {
  targetRatio: '9:16' | '16:9' | '1:1';
  cropStrategy: 'center' | 'smart' | 'person-focused';
  enhanceQuality: boolean;
  preserveAudio: boolean;
}

export interface PersonDetection {
  frame: number;
  timestamp: number;
  persons: Array<{
    bbox: { x: number; y: number; width: number; height: number };
    confidence: number;
    keypoints?: Array<{ x: number; y: number; confidence: number }>;
  }>;
}

export interface CropCoordinates {
  x: number;
  y: number;
  width: number;
  height: number;
}

export class AspectRatioConverter {
  private ai: GoogleGenerativeAI;
  private tempDir: string;

  constructor(apiKey: string) {
    this.ai = new GoogleGenerativeAI(apiKey);
    this.tempDir = path.join(process.cwd(), 'temp_aspect_conversion');
    this.ensureTempDir();
  }

  private ensureTempDir(): void {
    if (!fs.existsSync(this.tempDir)) {
      fs.mkdirSync(this.tempDir, { recursive: true });
    }
  }

  async convertToAspectRatio(
    inputVideoPath: string,
    options: AspectRatioOptions
  ): Promise<{ success: boolean; outputPath?: string; error?: string }> {
    let framesDir: string | null = null;
    
    try {
      console.log('Starting aspect ratio conversion...');
      console.log('Input:', inputVideoPath);
      console.log('Options:', options);

      // Verify input file exists
      if (!fs.existsSync(inputVideoPath)) {
        throw new Error(`Input video file not found: ${inputVideoPath}`);
      }

      const outputId = nanoid();
      const outputPath = path.join(process.cwd(), 'uploads', `aspect_${outputId}.mp4`);

      let personDetections: PersonDetection[] = [];
      
      // Only extract frames and detect people if using person-focused strategy
      if (options.cropStrategy === 'person-focused') {
        try {
          // Step 1: Extract frames for analysis
          framesDir = await this.extractFrames(inputVideoPath, outputId);
          
          // Step 2: Detect people in frames using AI (with timeout)
          const detectionPromise = this.detectPeopleInFrames(framesDir, inputVideoPath);
          const timeoutPromise = new Promise<PersonDetection[]>((_, reject) => {
            setTimeout(() => reject(new Error('AI detection timeout')), 30000);
          });
          
          personDetections = await Promise.race([detectionPromise, timeoutPromise]);
          console.log('Person detection completed, found', personDetections.length, 'detections');
          
        } catch (detectionError) {
          console.warn('Person detection failed, falling back to center crop:', detectionError);
          personDetections = [];
        }
      }
      
      // Step 3: Calculate dynamic crop coordinates (with fallback)
      const cropCoordinates = await this.calculateDynamicCrop(
        inputVideoPath, 
        personDetections, 
        options
      );
      
      // Step 4: Apply cropping to video
      await this.applyCroppingToVideo(
        inputVideoPath, 
        outputPath, 
        cropCoordinates, 
        options
      );
      
      // Step 5: Cleanup temporary files
      if (framesDir) {
        await this.cleanup(framesDir);
      }

      console.log('Aspect ratio conversion completed:', outputPath);
      
      return {
        success: true,
        outputPath: outputPath
      };

    } catch (error) {
      console.error('Aspect ratio conversion failed:', error);
      
      // Cleanup on error
      if (framesDir) {
        try {
          await this.cleanup(framesDir);
        } catch (cleanupError) {
          console.error('Cleanup failed:', cleanupError);
        }
      }
      
      return {
        success: false,
        error: error instanceof Error ? error.message : 'Conversion failed'
      };
    }
  }

  private async extractFrames(inputVideoPath: string, outputId: string): Promise<string> {
    const framesDir = path.join(this.tempDir, `frames_${outputId}`);
    
    if (!fs.existsSync(framesDir)) {
      fs.mkdirSync(framesDir, { recursive: true });
    }

    return new Promise((resolve, reject) => {
      console.log('Extracting frames for analysis...');
      
      // Extract one frame per second for analysis
      const args = [
        '-i', inputVideoPath,
        '-vf', 'fps=1',
        '-q:v', '2',
        path.join(framesDir, 'frame_%04d.jpg')
      ];

      const ffmpeg = spawn('ffmpeg', args);
      
      let errorOutput = '';

      ffmpeg.stderr.on('data', (data) => {
        errorOutput += data.toString();
      });

      ffmpeg.on('close', (code) => {
        if (code === 0) {
          console.log('Frames extracted successfully');
          resolve(framesDir);
        } else {
          console.error('Frame extraction failed:', errorOutput);
          reject(new Error(`Frame extraction failed with code ${code}`));
        }
      });

      ffmpeg.on('error', reject);
    });
  }

  private async detectPeopleInFrames(framesDir: string, videoPath: string): Promise<PersonDetection[]> {
    try {
      console.log('Detecting people in frames using AI...');
      
      const frameFiles = fs.readdirSync(framesDir)
        .filter(file => file.endsWith('.jpg'))
        .sort()
        .slice(0, 5); // Analyze fewer frames for better performance

      if (frameFiles.length === 0) {
        console.log('No frames found for analysis');
        return [];
      }

      const detections: PersonDetection[] = [];

      // Try to analyze first few frames, but don't fail completely if AI fails
      for (let i = 0; i < Math.min(frameFiles.length, 3); i++) {
        const frameFile = frameFiles[i];
        const framePath = path.join(framesDir, frameFile);
        
        try {
          const detection = await this.analyzeFrameForPeople(framePath, i);
          if (detection && detection.persons && detection.persons.length > 0) {
            detections.push(detection);
            console.log(`Found ${detection.persons.length} people in frame ${i}`);
          }
        } catch (error) {
          console.error(`Failed to analyze frame ${frameFile}:`, error);
          // Continue with other frames - don't break the entire process
        }
      }

      console.log(`Analyzed ${frameFiles.length} frames, found people in ${detections.length} frames`);
      
      // If no people detected, return empty array - will fall back to center crop
      return detections;

    } catch (error) {
      console.error('Person detection failed:', error);
      // Return empty array to fall back to center crop
      return [];
    }
  }

  private async analyzeFrameForPeople(framePath: string, frameIndex: number): Promise<PersonDetection | null> {
    try {
      const imageBytes = fs.readFileSync(framePath);
      
      const prompt = `Analyze this video frame and detect any people present. Be very specific and only detect actual human figures.

If you find people, respond with JSON in this exact format:
{
  "persons": [
    {
      "bbox": {"x": 25, "y": 10, "width": 50, "height": 80},
      "confidence": 0.95
    }
  ]
}

If no people are visible, respond with:
{
  "persons": []
}

The bbox coordinates should be percentages (0-100) relative to the image dimensions.`;

      const model = this.ai.getGenerativeModel({ 
        model: 'gemini-1.5-flash',
        generationConfig: {
          temperature: 0.1,
          topP: 0.1,
          topK: 1
        }
      });
      
      const result = await model.generateContent([
        {
          inlineData: {
            data: imageBytes.toString('base64'),
            mimeType: 'image/jpeg'
          }
        },
        prompt
      ]);

      const response = result.response.text();
      console.log(`Frame ${frameIndex} AI response:`, response);
      
      try {
        // Clean the response - remove any markdown formatting
        const cleanResponse = response.replace(/```json\n?|\n?```/g, '').trim();
        const analysis = JSON.parse(cleanResponse);
        
        if (analysis.persons && Array.isArray(analysis.persons)) {
          // Validate the person data
          const validPersons = analysis.persons.filter(person => {
            return person.bbox && 
                   typeof person.bbox.x === 'number' && 
                   typeof person.bbox.y === 'number' && 
                   typeof person.bbox.width === 'number' && 
                   typeof person.bbox.height === 'number' &&
                   person.bbox.width > 0 && 
                   person.bbox.height > 0;
          });
          
          if (validPersons.length > 0) {
            return {
              frame: frameIndex,
              timestamp: frameIndex,
              persons: validPersons
            };
          }
        }
      } catch (parseError) {
        console.error('Failed to parse AI response:', parseError, 'Response:', response);
      }

      return null;
    } catch (error) {
      console.error('Frame analysis failed:', error);
      return null;
    }
  }

  private async calculateDynamicCrop(
    videoPath: string,
    detections: PersonDetection[],
    options: AspectRatioOptions
  ): Promise<CropCoordinates> {
    console.log('Calculating dynamic crop coordinates...');
    
    // Get video dimensions
    const videoDimensions = await this.getVideoDimensions(videoPath);
    const { width: videoWidth, height: videoHeight } = videoDimensions;
    
    console.log('Video dimensions:', { videoWidth, videoHeight });
    
    // Calculate target dimensions for aspect ratio
    const targetAspectRatio = this.getAspectRatioValues(options.targetRatio);
    console.log('Target aspect ratio:', targetAspectRatio);
    console.log('Current video aspect ratio:', videoWidth / videoHeight);
    
    let targetWidth: number;
    let targetHeight: number;
    
    // For 9:16 (vertical), we want width/height = 9/16 = 0.5625
    // For 16:9 (horizontal), we want width/height = 16/9 = 1.7778
    // For 1:1 (square), we want width/height = 1
    
    if (options.targetRatio === '9:16') {
      // For vertical 9:16, crop to make it taller
      targetWidth = Math.min(videoWidth, Math.round(videoHeight * (9/16)));
      targetHeight = Math.round(targetWidth / (9/16));
      
      // Ensure we don't exceed video dimensions
      if (targetHeight > videoHeight) {
        targetHeight = videoHeight;
        targetWidth = Math.round(targetHeight * (9/16));
      }
    } else if (options.targetRatio === '16:9') {
      // For horizontal 16:9
      targetHeight = Math.min(videoHeight, Math.round(videoWidth / (16/9)));
      targetWidth = Math.round(targetHeight * (16/9));
      
      // Ensure we don't exceed video dimensions
      if (targetWidth > videoWidth) {
        targetWidth = videoWidth;
        targetHeight = Math.round(targetWidth / (16/9));
      }
    } else {
      // For 1:1 square
      const minDimension = Math.min(videoWidth, videoHeight);
      targetWidth = minDimension;
      targetHeight = minDimension;
    }

    // Final safety checks
    targetWidth = Math.max(10, Math.min(targetWidth, videoWidth));
    targetHeight = Math.max(10, Math.min(targetHeight, videoHeight));
    
    console.log('Calculated target dimensions:', { targetWidth, targetHeight });
    console.log('Target aspect ratio check:', targetWidth / targetHeight);

    if (options.cropStrategy === 'person-focused' && detections.length > 0) {
      console.log('Using person-focused cropping with', detections.length, 'detections');
      
      // Calculate optimal crop position based on person detections
      const personCenters = this.calculatePersonCenters(detections, videoWidth, videoHeight);
      
      if (personCenters.length > 0) {
        const optimalCenter = this.findOptimalCropCenter(personCenters, videoWidth, videoHeight);
        
        const cropX = Math.max(0, Math.min(
          optimalCenter.x - targetWidth / 2,
          videoWidth - targetWidth
        ));
        
        const cropY = Math.max(0, Math.min(
          optimalCenter.y - targetHeight / 2,
          videoHeight - targetHeight
        ));
        
        const result = {
          x: Math.round(cropX),
          y: Math.round(cropY),
          width: targetWidth,
          height: targetHeight
        };
        
        console.log('Person-focused crop coordinates:', result);
        return result;
      }
    }
    
    // Center crop fallback
    const result = {
      x: Math.round((videoWidth - targetWidth) / 2),
      y: Math.round((videoHeight - targetHeight) / 2),
      width: targetWidth,
      height: targetHeight
    };
    
    console.log('Center crop coordinates:', result);
    return result;
  }

  private calculatePersonCenters(
    detections: PersonDetection[],
    videoWidth: number,
    videoHeight: number
  ): Array<{ x: number; y: number; weight: number }> {
    const centers: Array<{ x: number; y: number; weight: number }> = [];
    
    detections.forEach(detection => {
      detection.persons.forEach(person => {
        const centerX = (person.bbox.x + person.bbox.width / 2) * videoWidth / 100;
        const centerY = (person.bbox.y + person.bbox.height / 2) * videoHeight / 100;
        
        centers.push({
          x: centerX,
          y: centerY,
          weight: person.confidence
        });
      });
    });
    
    return centers;
  }

  private findOptimalCropCenter(
    personCenters: Array<{ x: number; y: number; weight: number }>,
    videoWidth: number,
    videoHeight: number
  ): { x: number; y: number } {
    if (personCenters.length === 0) {
      return { x: videoWidth / 2, y: videoHeight / 2 };
    }
    
    // Weighted average of person centers
    let totalWeight = 0;
    let weightedX = 0;
    let weightedY = 0;
    
    personCenters.forEach(center => {
      weightedX += center.x * center.weight;
      weightedY += center.y * center.weight;
      totalWeight += center.weight;
    });
    
    return {
      x: weightedX / totalWeight,
      y: weightedY / totalWeight
    };
  }

  private async applyCroppingToVideo(
    inputPath: string,
    outputPath: string,
    cropCoords: CropCoordinates,
    options: AspectRatioOptions
  ): Promise<void> {
    return new Promise((resolve, reject) => {
      console.log('Applying cropping to video...');
      console.log('Crop coordinates:', cropCoords);
      
      // Validate crop coordinates
      if (cropCoords.width <= 0 || cropCoords.height <= 0) {
        console.error('Invalid crop dimensions detected:', cropCoords);
        reject(new Error(`Invalid crop dimensions: ${cropCoords.width}x${cropCoords.height}`));
        return;
      }
      
      if (cropCoords.x < 0 || cropCoords.y < 0) {
        console.error('Invalid crop position detected:', cropCoords);
        reject(new Error(`Invalid crop position: ${cropCoords.x},${cropCoords.y}`));
        return;
      }
      
      console.log('Crop coordinates validated successfully:', cropCoords);
      
      const args = [
        '-i', inputPath,
        '-vf', `crop=${cropCoords.width}:${cropCoords.height}:${cropCoords.x}:${cropCoords.y}`,
        '-c:v', 'libx264',
        '-preset', 'medium',
        '-crf', options.enhanceQuality ? '18' : '23',
        '-profile:v', 'high',
        '-level:v', '4.2',
        '-pix_fmt', 'yuv420p'
      ];
      
      if (options.preserveAudio) {
        args.push('-c:a', 'aac', '-b:a', '192k');
      } else {
        args.push('-an'); // Remove audio
      }
      
      args.push('-movflags', '+faststart', '-y', outputPath);
      
      console.log('FFmpeg crop command:', 'ffmpeg', args.join(' '));
      
      const ffmpeg = spawn('ffmpeg', args);
      
      let errorOutput = '';
      
      ffmpeg.stderr.on('data', (data) => {
        const output = data.toString();
        errorOutput += output;
        console.log('Crop FFmpeg:', output);
      });
      
      ffmpeg.on('close', (code) => {
        if (code === 0) {
          console.log('Video cropping completed successfully');
          resolve();
        } else {
          console.error('Video cropping failed:', errorOutput);
          reject(new Error(`Video cropping failed with code ${code}: ${errorOutput}`));
        }
      });
      
      ffmpeg.on('error', reject);
    });
  }

  private async getVideoDimensions(videoPath: string): Promise<{ width: number; height: number }> {
    return new Promise((resolve, reject) => {
      const args = [
        '-v', 'quiet',
        '-print_format', 'json',
        '-show_format',
        '-show_streams',
        videoPath
      ];
      
      const ffprobe = spawn('ffprobe', args);
      
      let output = '';
      
      ffprobe.stdout.on('data', (data) => {
        output += data.toString();
      });
      
      ffprobe.stderr.on('data', (data) => {
        console.log('ffprobe stderr:', data.toString());
      });
      
      ffprobe.on('close', (code) => {
        if (code !== 0) {
          reject(new Error(`ffprobe failed with code ${code}`));
          return;
        }
        
        try {
          const probe = JSON.parse(output);
          const videoStream = probe.streams.find((stream: any) => stream.codec_type === 'video');
          
          if (videoStream && videoStream.width && videoStream.height) {
            const dimensions = {
              width: parseInt(videoStream.width),
              height: parseInt(videoStream.height)
            };
            console.log('Detected video dimensions:', dimensions);
            resolve(dimensions);
          } else {
            // Fallback to regex parsing
            const match = output.match(/(\d+)x(\d+)/);
            if (match) {
              const dimensions = {
                width: parseInt(match[1]),
                height: parseInt(match[2])
              };
              console.log('Fallback video dimensions:', dimensions);
              resolve(dimensions);
            } else {
              reject(new Error('Could not determine video dimensions from probe output'));
            }
          }
        } catch (parseError) {
          console.error('Failed to parse ffprobe output:', parseError);
          reject(new Error('Failed to parse video dimensions'));
        }
      });
      
      ffprobe.on('error', reject);
    });
  }

  private getAspectRatioValues(ratio: string): number {
    const ratios = {
      '9:16': 9/16,
      '16:9': 16/9,
      '1:1': 1
    };
    const result = ratios[ratio as keyof typeof ratios] || 9/16;
    console.log('Aspect ratio calculation:', ratio, '=', result);
    return result;
  }

  private async cleanup(framesDir: string): Promise<void> {
    try {
      if (fs.existsSync(framesDir)) {
        fs.rmSync(framesDir, { recursive: true, force: true });
        console.log('Temporary frames cleaned up');
      }
    } catch (error) {
      console.error('Cleanup failed:', error);
    }
  }
}

export const createAspectRatioConverter = (apiKey: string): AspectRatioConverter => {
  return new AspectRatioConverter(apiKey);
};