import { GoogleGenerativeAI } from '@google/generative-ai';
import ffmpeg from 'fluent-ffmpeg';
import fs from 'fs/promises';
import path from 'path';
import { spawn } from 'child_process';

export class EyeContactService {
  private genAI: GoogleGenerativeAI;

  constructor() {
    this.genAI = new GoogleGenerativeAI(process.env.GEMINI_API_KEY || '');
  }

  async processEyeContact(inputPath: string, config: any): Promise<{
    outputPath: string;
    facesDetected: number;
    correctionApplied: boolean;
    processingTime: number;
  }> {
    const startTime = Date.now();
    console.log('👁️ Starting eye contact correction with config:', config);
    
    const outputDir = path.join('uploads', 'eye-contact');
    await fs.mkdir(outputDir, { recursive: true });

    const outputPath = path.join(outputDir, `eye_contact_${Date.now()}.mp4`);

    try {
      // Step 1: Extract frames for face detection
      const framesDir = path.join(outputDir, `frames_${Date.now()}`);
      await fs.mkdir(framesDir, { recursive: true });
      
      await this.extractFrames(inputPath, framesDir);
      
      // Step 2: Analyze faces and eye gaze using Gemini Vision
      const eyeCorrections = await this.analyzeEyeGaze(framesDir);
      
      // Step 3: Apply eye contact corrections
      await this.applyEyeCorrections(inputPath, outputPath, eyeCorrections, config);
      
      // Cleanup
      await this.cleanupFrames(framesDir);
      
      const processingTime = Date.now() - startTime;
      
      return {
        outputPath,
        facesDetected: eyeCorrections.length,
        correctionApplied: eyeCorrections.length > 0,
        processingTime
      };
    } catch (error) {
      console.error('Eye contact processing failed:', error);
      throw error;
    }
  }

  private async extractFrames(videoPath: string, outputDir: string): Promise<void> {
    return new Promise((resolve, reject) => {
      ffmpeg(videoPath)
        .outputOptions([
          '-vf', 'fps=2', // Extract 2 frames per second
          '-q:v', '2'
        ])
        .output(path.join(outputDir, 'frame_%04d.jpg'))
        .on('end', () => resolve())
        .on('error', reject)
        .run();
    });
  }

  private async analyzeEyeGaze(framesDir: string): Promise<any[]> {
    const model = this.genAI.getGenerativeModel({ model: 'gemini-2.0-flash-exp' });
    const frames = await fs.readdir(framesDir);
    const corrections = [];

    for (const frame of frames.slice(0, 10)) { // Analyze first 10 frames for efficiency
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
        `Analyze this frame for faces and eye gaze direction.
        
        Return a JSON object with:
        {
          "faces": [
            {
              "id": number,
              "position": { "x": number, "y": number, "width": number, "height": number },
              "eyeGaze": {
                "direction": "camera|left|right|up|down",
                "confidence": number (0-1),
                "needsCorrection": boolean
              },
              "faceAngle": {
                "pitch": number,
                "yaw": number,
                "roll": number
              }
            }
          ]
        }
        
        Focus on:
        1. Detecting if eyes are looking at camera
        2. Natural eye contact appearance
        3. Face orientation and angle
        
        Only mark needsCorrection=true if eyes are clearly looking away from camera.`
      ]);

      try {
        const response = JSON.parse(result.response.text());
        if (response.faces && response.faces.length > 0) {
          corrections.push({
            frame: frame,
            frameNumber: parseInt(frame.match(/\d+/)?.[0] || '0'),
            faces: response.faces
          });
        }
      } catch (e) {
        console.error('Failed to parse face detection for frame:', frame);
      }
    }

    return corrections;
  }

  private async applyEyeCorrections(
    inputPath: string, 
    outputPath: string, 
    corrections: any[],
    config: any
  ): Promise<void> {
    // Build complex filter for eye corrections
    let filterComplex = [];
    let lastOutput = '0:v';

    for (const correction of corrections) {
      for (const face of correction.faces) {
        if (face.eyeGaze.needsCorrection) {
          // Apply subtle eye shift effect
          const xShift = face.eyeGaze.direction === 'left' ? 2 : 
                         face.eyeGaze.direction === 'right' ? -2 : 0;
          const yShift = face.eyeGaze.direction === 'up' ? 2 : 
                         face.eyeGaze.direction === 'down' ? -2 : 0;

          filterComplex.push(
            `[${lastOutput}]crop=${face.position.width}:${face.position.height}:${face.position.x}:${face.position.y},` +
            `rotate=${face.faceAngle.roll * Math.PI / 180}:c=none:ow=rotw(${face.faceAngle.roll * Math.PI / 180}):oh=roth(${face.faceAngle.roll * Math.PI / 180}),` +
            `overlay=${face.position.x + xShift}:${face.position.y + yShift}:enable='between(t,${correction.frameNumber/2},${(correction.frameNumber+1)/2})'[corrected${correction.frameNumber}]`
          );
          lastOutput = `corrected${correction.frameNumber}`;
        }
      }
    }

    return new Promise((resolve, reject) => {
      const ffmpegCmd = ffmpeg(inputPath)
        .outputOptions([
          '-c:v', 'libx264',
          '-preset', 'medium',
          '-crf', '23',
          '-c:a', 'copy'
        ]);

      if (filterComplex.length > 0) {
        ffmpegCmd.complexFilter(filterComplex.join(';'));
      }

      ffmpegCmd
        .output(outputPath)
        .on('end', () => {
          console.log('✅ Eye contact correction applied');
          resolve();
        })
        .on('error', reject)
        .run();
    });
  }

  private async cleanupFrames(framesDir: string): Promise<void> {
    try {
      const files = await fs.readdir(framesDir);
      await Promise.all(files.map(file => fs.unlink(path.join(framesDir, file))));
      await fs.rmdir(framesDir);
    } catch (error) {
      console.error('Cleanup error:', error);
    }
  }
}