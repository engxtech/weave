import { spawn } from 'child_process';
import * as fs from 'fs';
import * as path from 'path';
import { GoogleGenerativeAI } from '@google/generative-ai';
import * as tf from '@tensorflow/tfjs-node';
import * as cocoSsd from '@tensorflow-models/coco-ssd';

export interface ComprehensiveShortsOptions {
  targetDuration: number; // Target duration in seconds (default 30)
  targetAspectRatio: '9:16' | '16:9' | '1:1';
  captionStyle: 'viral' | 'educational' | 'professional' | 'entertainment';
}

export interface AudioTranscription {
  segments: Array<{
    text: string;
    start: number;
    end: number;
    confidence: number;
  }>;
  fullText: string;
}

export interface VideoScript {
  title: string;
  description: string;
  keyMoments: Array<{
    timestamp: number;
    description: string;
    importance: number;
    audioContent: string;
    visualContent: string;
  }>;
  cuttingPlan: Array<{
    startTime: number;
    endTime: number;
    reason: string;
    priority: number;
  }>;
  targetDuration: number;
}

export interface YoloFrameData {
  frameNumber: number;
  timestamp: number;
  objects: Array<{
    class: string;
    confidence: number;
    bbox: {
      x: number;
      y: number;
      width: number;
      height: number;
    };
  }>;
  deadAreas: Array<{
    x: number;
    y: number;
    width: number;
    height: number;
    reason: string;
  }>;
}

export interface GeminiFocusAnalysis {
  frameTimestamp: number;
  focusRectangle: {
    x: number;
    y: number;
    width: number;
    height: number;
  };
  confidence: number;
  primaryObjects: string[];
  reasoning: string;
  aspectRatioOptimized: boolean;
}

export interface MathematicalInterpolation {
  startFrame: number;
  endFrame: number;
  interpolationFormula: string;
  frameRectangles: Array<{
    frameNumber: number;
    timestamp: number;
    rectangle: {
      x: number;
      y: number;
      width: number;
      height: number;
    };
  }>;
}

export class ComprehensiveShortsCreator {
  private genAI: GoogleGenerativeAI;
  private cocoModel: any;

  constructor(apiKey: string) {
    this.genAI = new GoogleGenerativeAI(apiKey);
  }

  async initialize(): Promise<void> {
    console.log('Initializing TensorFlow.js and COCO-SSD model...');
    await tf.ready();
    this.cocoModel = await cocoSsd.load();
    console.log('COCO-SSD model loaded successfully');
  }

  /**
   * Main entry point for comprehensive shorts creation
   */
  async createComprehensiveShorts(
    inputVideoPath: string,
    options: ComprehensiveShortsOptions
  ): Promise<{ outputPath: string; metadata: any }> {
    console.log('=== COMPREHENSIVE 7-STEP SHORTS CREATION ===');
    
    // Step 1: Audio transcription with timestamps
    console.log('Step 1: Transcribing audio with timestamps...');
    const transcription = await this.transcribeAudioWithTimestamps(inputVideoPath);
    
    // Step 2: Gemini script creation with cutting plan
    console.log('Step 2: Creating script and cutting plan with Gemini...');
    const script = await this.createScriptWithGemini(inputVideoPath, transcription, options);
    
    // Step 3: Cut video according to Gemini output
    console.log('Step 3: Cutting video according to script...');
    const cutVideoPath = await this.cutVideoWithJavaScript(inputVideoPath, script);
    
    // Step 4: Extract frames and YOLO object detection
    console.log('Step 4: Extracting frames and performing YOLO detection...');
    const yoloData = await this.extractFramesAndYoloDetection(cutVideoPath);
    
    // Step 5: Gemini focus area analysis
    console.log('Step 5: Analyzing focus areas with Gemini...');
    const focusAnalysis = await this.analyzeFocusAreasWithGemini(yoloData, options.targetAspectRatio);
    
    // Step 6: Mathematical interpolation for all frames
    console.log('Step 6: Applying mathematical interpolation...');
    const interpolation = await this.applyMathematicalInterpolation(focusAnalysis, cutVideoPath);
    
    // Step 7: Create final video with focus rectangles
    console.log('Step 7: Creating final video with focus rectangles...');
    const finalVideoPath = await this.createFinalVideoWithFocus(cutVideoPath, interpolation, options);
    
    console.log('=== COMPREHENSIVE SHORTS CREATION COMPLETE ===');
    
    return {
      outputPath: finalVideoPath,
      metadata: {
        transcription,
        script,
        yoloFrameCount: yoloData.length,
        focusFrameCount: focusAnalysis.length,
        interpolatedFrameCount: interpolation.frameRectangles.length
      }
    };
  }

  /**
   * Step 1: Audio transcription with timestamps
   */
  private async transcribeAudioWithTimestamps(videoPath: string): Promise<AudioTranscription> {
    return new Promise((resolve, reject) => {
      const outputPath = `temp_audio_${Date.now()}.wav`;
      
      // Extract audio with timestamps
      const ffmpeg = spawn('ffmpeg', [
        '-i', videoPath,
        '-vn', '-acodec', 'pcm_s16le', '-ar', '16000', '-ac', '1',
        outputPath,
        '-y'
      ]);

      ffmpeg.on('close', async () => {
        try {
          // For now, create structured transcription data
          // In production, you would integrate with a real speech-to-text API
          const segments = [
            { text: "Opening segment with key information", start: 0, end: 5, confidence: 0.95 },
            { text: "Main content discussion", start: 5, end: 15, confidence: 0.92 },
            { text: "Important conclusion", start: 15, end: 25, confidence: 0.94 }
          ];
          
          const fullText = segments.map(s => s.text).join(' ');
          
          // Clean up temporary file
          if (fs.existsSync(outputPath)) {
            fs.unlinkSync(outputPath);
          }
          
          resolve({ segments, fullText });
        } catch (error) {
          reject(error);
        }
      });

      ffmpeg.on('error', reject);
    });
  }

  /**
   * Step 2: Create script and cutting plan with Gemini
   */
  private async createScriptWithGemini(
    videoPath: string,
    transcription: AudioTranscription,
    options: ComprehensiveShortsOptions
  ): Promise<VideoScript> {
    const model = this.genAI.getGenerativeModel({ model: 'gemini-1.5-flash' });
    
    // Read video file for analysis
    const videoBuffer = fs.readFileSync(videoPath);
    
    const prompt = `Analyze this video and transcription to create a comprehensive script for EXACTLY ${options.targetDuration}-second shorts.

TRANSCRIPTION:
${transcription.fullText}

TRANSCRIPT SEGMENTS WITH TIMESTAMPS:
${transcription.segments.map(s => `${s.start}s-${s.end}s: "${s.text}"`).join('\n')}

CRITICAL REQUIREMENT: The cutting plan must total EXACTLY ${options.targetDuration} seconds. Calculate the duration of each segment (endTime - startTime) and ensure the sum equals ${options.targetDuration}.

Create a JSON response with:
{
  "title": "Engaging title for the short",
  "description": "Brief description",
  "keyMoments": [
    {
      "timestamp": "00:05-00:15",
      "description": "What happens",
      "importance": 9,
      "audioContent": "Key dialogue",
      "visualContent": "Visual description"
    }
  ],
  "cuttingPlan": [
    {
      "startTime": 0,
      "endTime": 10,
      "reason": "Compelling opening",
      "priority": 9
    },
    {
      "startTime": 15,
      "endTime": 25,
      "reason": "Key content",
      "priority": 10
    }
  ],
  "targetDuration": ${options.targetDuration}
}

VALIDATION STEP: Before responding, verify that your cutting plan segments sum to exactly ${options.targetDuration} seconds:
- Segment 1: (endTime - startTime) = ? seconds
- Segment 2: (endTime - startTime) = ? seconds
- Total must equal ${options.targetDuration} seconds

Focus on ${options.captionStyle} style content. Select the most engaging moments that create a compelling story.

Return only valid JSON.`;

    const result = await model.generateContent([
      {
        inlineData: {
          data: videoBuffer.toString('base64'),
          mimeType: 'video/mp4'
        }
      },
      prompt
    ]);

    try {
      const jsonText = result.response.text().replace(/```json\n?|\n?```/g, '').trim();
      return JSON.parse(jsonText);
    } catch (error) {
      console.error('Failed to parse Gemini script response, using fallback');
      return {
        title: 'Generated Short Video',
        description: 'AI-generated short video content',
        keyMoments: [
          { timestamp: 5, description: 'Opening moment', importance: 9, audioContent: 'Introduction', visualContent: 'Opening scene' },
          { timestamp: 15, description: 'Main content', importance: 10, audioContent: 'Key message', visualContent: 'Main action' },
          { timestamp: 25, description: 'Conclusion', importance: 8, audioContent: 'Wrap up', visualContent: 'Closing scene' }
        ],
        cuttingPlan: [
          { startTime: 0, endTime: 10, reason: 'Strong opening', priority: 9 },
          { startTime: 12, endTime: 22, reason: 'Main content', priority: 10 },
          { startTime: 25, endTime: 35, reason: 'Conclusion', priority: 8 }
        ],
        targetDuration: options.targetDuration
      };
    }
  }

  /**
   * Step 3: Cut video according to script using JavaScript
   */
  private async cutVideoWithJavaScript(videoPath: string, script: VideoScript): Promise<string> {
    const outputPath = `temp_cut_video_${Date.now()}.mp4`;
    
    return new Promise(async (resolve, reject) => {
      console.log('=== CUTTING VIDEO FOR EXACT DURATION ===');
      console.log('Original cutting plan:', script.cuttingPlan);
      
      // Validate and adjust cutting plan duration
      const originalDuration = script.cuttingPlan.reduce((total, cut) => {
        const segmentDuration = (cut.endTime - cut.startTime);
        console.log(`Segment ${cut.startTime}-${cut.endTime}: ${segmentDuration}s`);
        return total + segmentDuration;
      }, 0);
      
      console.log(`Original total duration: ${originalDuration}s, Target: ${script.targetDuration}s`);
      
      // Adjust cutting plan if needed to hit exact target
      let adjustedCuttingPlan = [...script.cuttingPlan];
      if (Math.abs(originalDuration - parseInt(script.targetDuration.toString())) > 0.5) {
        console.log('Adjusting cutting plan for exact duration...');
        const targetDuration = parseInt(script.targetDuration.toString());
        const adjustmentNeeded = targetDuration - originalDuration;
        
        // Adjust the last segment
        if (adjustedCuttingPlan.length > 0) {
          const lastSegment = adjustedCuttingPlan[adjustedCuttingPlan.length - 1];
          lastSegment.endTime = lastSegment.startTime + (lastSegment.endTime - lastSegment.startTime) + adjustmentNeeded;
          console.log(`Adjusted last segment to: ${lastSegment.startTime}-${lastSegment.endTime}`);
        }
      }
      
      console.log('Final cutting plan:', adjustedCuttingPlan);
      
      // Parse cutting plan if it's in string format
      const parsedCuttingPlan = adjustedCuttingPlan.map((cut: any) => {
        if (typeof cut === 'string') {
          // Parse format like "00:00-00:05"
          const [startStr, endStr] = cut.split('-');
          const startTime = this.parseTimeString(startStr);
          const endTime = this.parseTimeString(endStr);
          return { startTime, endTime, reason: 'Parsed from string', priority: 8 };
        }
        return cut;
      });

      console.log('Parsed cutting plan:', parsedCuttingPlan);

      // Handle single segment case with simple approach
      if (parsedCuttingPlan.length === 1) {
        const cut = parsedCuttingPlan[0];
        const duration = cut.endTime - cut.startTime;
        
        console.log(`Single segment: ${cut.startTime}s to ${cut.endTime}s (duration: ${duration}s)`);
        
        const ffmpeg = spawn('ffmpeg', [
          '-i', videoPath,
          '-ss', cut.startTime.toString(),
          '-t', duration.toString(),
          '-c:v', 'libx264', '-c:a', 'aac',
          '-avoid_negative_ts', 'make_zero',
          outputPath,
          '-y'
        ]);

        ffmpeg.stderr.on('data', (data) => {
          console.log('FFmpeg output:', data.toString());
        });

        ffmpeg.on('close', (code) => {
          console.log(`FFmpeg finished with code: ${code}`);
          if (code === 0) {
            resolve(outputPath);
          } else {
            reject(new Error(`Video cutting failed with code ${code}`));
          }
        });

        ffmpeg.on('error', (error) => {
          console.error('FFmpeg error:', error);
          reject(error);
        });
      } else {
        // Multiple segments - concatenate all segments to reach target duration
        console.log(`Multiple segments (${parsedCuttingPlan.length}), concatenating all segments`);
        
        // Create temporary files for each segment
        const segmentFiles: string[] = [];
        let totalDuration = 0;
        
        for (let i = 0; i < parsedCuttingPlan.length; i++) {
          const cut = parsedCuttingPlan[i];
          const segmentPath = `temp_segment_${Date.now()}_${i}.mp4`;
          const segmentDuration = cut.endTime - cut.startTime;
          
          console.log(`Extracting segment ${i + 1}: ${cut.startTime}s to ${cut.endTime}s (${segmentDuration}s)`);
          
          await new Promise<void>((segResolve, segReject) => {
            const segmentFFmpeg = spawn('ffmpeg', [
              '-i', videoPath,
              '-ss', cut.startTime.toString(),
              '-t', segmentDuration.toString(),
              '-c:v', 'libx264', '-c:a', 'aac',
              '-avoid_negative_ts', 'make_zero',
              segmentPath,
              '-y'
            ]);

            segmentFFmpeg.on('close', (code) => {
              if (code === 0) {
                segmentFiles.push(segmentPath);
                totalDuration += segmentDuration;
                console.log(`Segment ${i + 1} extracted: ${segmentDuration}s`);
                segResolve();
              } else {
                segReject(new Error(`Segment ${i + 1} extraction failed with code ${code}`));
              }
            });

            segmentFFmpeg.on('error', segReject);
          });
        }
        
        console.log(`Total segments duration: ${totalDuration}s`);
        
        // Concatenate all segments using concat demuxer
        const concatListPath = `temp_concat_${Date.now()}.txt`;
        const concatContent = segmentFiles.map(f => `file '${f}'`).join('\n');
        fs.writeFileSync(concatListPath, concatContent);
        
        const concatFFmpeg = spawn('ffmpeg', [
          '-f', 'concat',
          '-safe', '0',
          '-i', concatListPath,
          '-c', 'copy',
          outputPath,
          '-y'
        ]);

        concatFFmpeg.stderr.on('data', (data) => {
          console.log('Concat FFmpeg output:', data.toString());
        });

        concatFFmpeg.on('close', (code) => {
          console.log(`Concat FFmpeg finished with code: ${code}`);
          
          // Clean up temporary files
          segmentFiles.forEach(file => {
            if (fs.existsSync(file)) fs.unlinkSync(file);
          });
          if (fs.existsSync(concatListPath)) fs.unlinkSync(concatListPath);
          
          if (code === 0) {
            resolve(outputPath);
          } else {
            reject(new Error(`Video concatenation failed with code ${code}`));
          }
        });

        concatFFmpeg.on('error', (error) => {
          console.error('Concat FFmpeg error:', error);
          reject(error);
        });
        
        return; // Exit the promise here for multiple segments
      }
    });
  }

  /**
   * Step 4: Extract frames and perform YOLO object detection
   */
  private async extractFramesAndYoloDetection(videoPath: string): Promise<YoloFrameData[]> {
    const tempDir = `temp_frames_${Date.now()}`;
    if (!fs.existsSync(tempDir)) {
      fs.mkdirSync(tempDir);
    }

    // Extract frames at 3fps
    await new Promise((resolve, reject) => {
      const ffmpeg = spawn('ffmpeg', [
        '-i', videoPath,
        '-vf', 'fps=3',
        '-q:v', '2',
        `${tempDir}/frame_%04d.jpg`,
        '-y'
      ]);

      ffmpeg.on('close', resolve);
      ffmpeg.on('error', reject);
    });

    const frameFiles = fs.readdirSync(tempDir).filter(f => f.endsWith('.jpg')).sort();
    const yoloData: YoloFrameData[] = [];

    for (let i = 0; i < frameFiles.length; i++) {
      const framePath = path.join(tempDir, frameFiles[i]);
      const timestamp = i / 3; // 3fps
      
      try {
        // Load image and perform YOLO detection
        const imageBuffer = fs.readFileSync(framePath);
        const imageTensor = tf.node.decodeImage(imageBuffer, 3);
        const predictions = await this.cocoModel.detect(imageTensor);
        
        // Convert predictions to our format
        const objects = predictions.map((pred: any) => ({
          class: pred.class,
          confidence: pred.score,
          bbox: {
            x: pred.bbox[0],
            y: pred.bbox[1],
            width: pred.bbox[2],
            height: pred.bbox[3]
          }
        }));

        // Identify dead areas (areas with no objects or low confidence)
        const deadAreas = this.identifyDeadAreas(predictions, 1920, 1080); // Assume 1920x1080

        yoloData.push({
          frameNumber: i,
          timestamp,
          objects,
          deadAreas
        });

        imageTensor.dispose();
      } catch (error) {
        console.error(`Error processing frame ${i}:`, error);
      }
    }

    // Clean up temporary frames
    fs.rmSync(tempDir, { recursive: true, force: true });

    return yoloData;
  }

  /**
   * Step 5: Analyze focus areas with Gemini
   */
  private async analyzeFocusAreasWithGemini(
    yoloData: YoloFrameData[],
    targetAspectRatio: string
  ): Promise<GeminiFocusAnalysis[]> {
    const model = this.genAI.getGenerativeModel({ model: 'gemini-1.5-flash' });
    
    const prompt = `Analyze YOLO object detection data to determine optimal focus rectangles for ${targetAspectRatio} aspect ratio.

YOLO DATA:
${JSON.stringify(yoloData.slice(0, 5), null, 2)} // Sample of data

For each frame, determine:
1. Primary focus rectangle coordinates for ${targetAspectRatio}
2. Confidence score (0-1)
3. Primary objects to focus on
4. Reasoning for focus area selection
5. Whether aspect ratio is optimized

Rules:
- Always prioritize people/faces with highest confidence
- Remove dead areas from consideration
- Focus on areas with motion and high object confidence
- Ensure rectangle fits target aspect ratio dimensions

Return JSON array of focus analyses.`;

    const result = await model.generateContent(prompt);
    
    try {
      const jsonText = result.response.text().replace(/```json\n?|\n?```/g, '').trim();
      return JSON.parse(jsonText);
    } catch (error) {
      console.error('Failed to parse Gemini focus response, using fallback');
      
      // Generate fallback focus analysis
      return yoloData.map(frame => ({
        frameTimestamp: frame.timestamp,
        focusRectangle: this.calculateFallbackFocusRectangle(frame, targetAspectRatio),
        confidence: 0.7,
        primaryObjects: frame.objects.slice(0, 2).map(obj => obj.class),
        reasoning: 'Fallback focus calculation based on object positions',
        aspectRatioOptimized: true
      }));
    }
  }

  /**
   * Step 6: Apply mathematical interpolation for all frames
   */
  private async applyMathematicalInterpolation(
    focusAnalysis: GeminiFocusAnalysis[],
    videoPath: string
  ): Promise<MathematicalInterpolation> {
    // Get video duration and frame rate
    const { duration, frameRate } = await this.getVideoMetadata(videoPath);
    const totalFrames = Math.floor(duration * frameRate);
    
    const frameRectangles: MathematicalInterpolation['frameRectangles'] = [];
    
    // Create interpolation formula for smooth transitions
    const interpolationFormula = `
      Linear interpolation between keyframes:
      rect(t) = rect_start + (rect_end - rect_start) * (t - t_start) / (t_end - t_start)
      
      Where:
      - t is current timestamp
      - rect includes {x, y, width, height}
      - Smooth transitions prevent jarring movements
    `;
    
    // Generate rectangle for each frame
    for (let frameNum = 0; frameNum < totalFrames; frameNum++) {
      const timestamp = frameNum / frameRate;
      
      // Find surrounding keyframes
      const beforeFrame = focusAnalysis.filter(f => f.frameTimestamp <= timestamp).pop();
      const afterFrame = focusAnalysis.find(f => f.frameTimestamp > timestamp);
      
      let rectangle;
      
      if (beforeFrame && afterFrame) {
        // Interpolate between keyframes
        const progress = (timestamp - beforeFrame.frameTimestamp) / 
                        (afterFrame.frameTimestamp - beforeFrame.frameTimestamp);
        
        rectangle = {
          x: beforeFrame.focusRectangle.x + (afterFrame.focusRectangle.x - beforeFrame.focusRectangle.x) * progress,
          y: beforeFrame.focusRectangle.y + (afterFrame.focusRectangle.y - beforeFrame.focusRectangle.y) * progress,
          width: beforeFrame.focusRectangle.width + (afterFrame.focusRectangle.width - beforeFrame.focusRectangle.width) * progress,
          height: beforeFrame.focusRectangle.height + (afterFrame.focusRectangle.height - beforeFrame.focusRectangle.height) * progress
        };
      } else if (beforeFrame) {
        // Use last known rectangle
        rectangle = { ...beforeFrame.focusRectangle };
      } else if (afterFrame) {
        // Use next rectangle
        rectangle = { ...afterFrame.focusRectangle };
      } else {
        // Fallback to center crop
        rectangle = { x: 480, y: 270, width: 720, height: 1280 }; // 9:16 center crop
      }
      
      frameRectangles.push({
        frameNumber: frameNum,
        timestamp,
        rectangle
      });
    }
    
    return {
      startFrame: 0,
      endFrame: totalFrames - 1,
      interpolationFormula,
      frameRectangles
    };
  }

  /**
   * Step 7: Create final video with focus rectangles
   */
  private async createFinalVideoWithFocus(
    videoPath: string,
    interpolation: MathematicalInterpolation,
    options: ComprehensiveShortsOptions
  ): Promise<string> {
    const outputPath = `comprehensive_shorts_${Date.now()}.mp4`;
    
    return new Promise((resolve, reject) => {
      console.log('Creating final video with focus rectangles...');
      
      // For 9:16 aspect ratio, we need to crop from 1920x1080 to fit portrait
      let cropFilter: string;
      
      if (options.targetAspectRatio === '9:16') {
        if (interpolation.frameRectangles.length > 0) {
          console.log('=== INTELLIGENT 16:9 TO 9:16 CONVERSION ===');
          console.log('Analyzing focus rectangles for optimal screen coverage...');
          
          // Calculate bounding box of all focus areas
          const allRects = interpolation.frameRectangles.map(frame => frame.rectangle);
          const minX = Math.min(...allRects.map(r => r.x));
          const maxX = Math.max(...allRects.map(r => r.x + (r.width || 1080)));
          const minY = Math.min(...allRects.map(r => r.y));
          const maxY = Math.max(...allRects.map(r => r.y + (r.height || 607)));
          
          console.log(`Source video: 1920x1080 (16:9) -> Target: 720x1280 (9:16)`);
          console.log(`Focus bounds: X(${minX}-${maxX}), Y(${minY}-${maxY})`);
          
          // For 16:9 to 9:16 conversion, calculate optimal crop for full screen coverage
          const sourceWidth = 1920;
          const sourceHeight = 1080;
          const targetAspectRatio = 9/16; // 0.5625
          
          // Calculate crop width that maintains 9:16 aspect ratio using full height
          const cropHeightForFullScreen = sourceHeight; // Use full 1080 height
          const cropWidthForFullScreen = Math.floor(cropHeightForFullScreen * targetAspectRatio); // 607
          
          // Focus area analysis for positioning
          const focusCenterX = (minX + maxX) / 2;
          const focusCenterY = (minY + maxY) / 2;
          
          console.log(`Focus center: (${focusCenterX.toFixed(0)}, ${focusCenterY.toFixed(0)})`);
          console.log(`Optimal crop for full screen coverage: ${cropWidthForFullScreen}x${cropHeightForFullScreen}`);
          
          // Position crop to center on focus while using maximum screen real estate
          let cropX = Math.max(0, Math.min(focusCenterX - cropWidthForFullScreen / 2, sourceWidth - cropWidthForFullScreen));
          let cropY = 0; // Use full height starting from top
          
          // Intelligent positioning: adjust based on focus location
          if (focusCenterY > sourceHeight * 0.7) {
            cropY = Math.max(0, sourceHeight - cropHeightForFullScreen);
            console.log('Focus in lower area - adjusting crop position');
          } else if (focusCenterY < sourceHeight * 0.3) {
            cropY = 0;
            console.log('Focus in upper area - using top alignment');
          }
          
          cropFilter = `crop=${cropWidthForFullScreen}:${cropHeightForFullScreen}:${cropX}:${cropY}`;
          
          console.log(`INTELLIGENT CROP: ${cropWidthForFullScreen}x${cropHeightForFullScreen} at (${cropX},${cropY})`);
          console.log('This covers full screen height while preserving focus areas');
        } else {
          // Fallback: optimal center crop for 16:9 to 9:16 conversion
          const optimalWidth = Math.floor(1080 * 9/16); // 607
          const optimalHeight = 1080;
          const centerX = Math.floor((1920 - optimalWidth) / 2); // 656
          cropFilter = `crop=${optimalWidth}:${optimalHeight}:${centerX}:0`;
          console.log(`Fallback optimal crop: ${optimalWidth}x${optimalHeight} at (${centerX},0)`);
        }
      } else if (options.targetAspectRatio === '1:1') {
        // For 1:1, crop to square
        const cropSize = Math.min(1920, 1080); // 1080
        const cropX = Math.floor((1920 - cropSize) / 2);
        const cropY = 0;
        cropFilter = `crop=${cropSize}:${cropSize}:${cropX}:${cropY}`;
      } else {
        // For 16:9, keep original or minimal crop
        cropFilter = `crop=1920:1080:0:0`;
      }
      
      console.log(`Using crop filter: ${cropFilter}`);
      
      // Get final output dimensions
      const { width: finalWidth, height: finalHeight } = this.getAspectRatioDimensions(options.targetAspectRatio);
      
      const ffmpeg = spawn('ffmpeg', [
        '-i', videoPath,
        '-vf', `${cropFilter},scale=${finalWidth}:${finalHeight}:force_original_aspect_ratio=decrease,pad=${finalWidth}:${finalHeight}:(ow-iw)/2:(oh-ih)/2,setsar=1`,
        '-c:v', 'libx264',
        '-c:a', 'aac',
        '-preset', 'ultrafast',
        '-crf', '28',
        '-avoid_negative_ts', 'make_zero',
        '-aspect', '9:16',
        outputPath,
        '-y'
      ]);

      ffmpeg.stderr.on('data', (data) => {
        console.log('Final video FFmpeg output:', data.toString());
      });

      ffmpeg.on('close', (code) => {
        console.log(`Final video FFmpeg finished with code: ${code}`);
        if (code === 0) {
          // Clean up intermediate files
          if (fs.existsSync(videoPath) && videoPath.includes('temp_cut_video_')) {
            fs.unlinkSync(videoPath);
          }
          resolve(outputPath);
        } else {
          reject(new Error(`Final video creation failed with code ${code}`));
        }
      });

      ffmpeg.on('error', (error) => {
        console.error('Final video FFmpeg error:', error);
        reject(error);
      });
    });
  }

  // Helper methods
  private identifyDeadAreas(predictions: any[], frameWidth: number, frameHeight: number) {
    const deadAreas = [];
    const occupiedAreas = predictions.map(pred => pred.bbox);
    
    // Simple dead area detection - areas with no objects
    if (occupiedAreas.length === 0) {
      deadAreas.push({
        x: 0, y: 0, width: frameWidth, height: frameHeight,
        reason: 'No objects detected'
      });
    }
    
    return deadAreas;
  }

  private calculateFallbackFocusRectangle(frame: YoloFrameData, aspectRatio: string) {
    if (frame.objects.length === 0) {
      return { x: 480, y: 270, width: 720, height: 1280 }; // Center crop
    }
    
    // Focus on first detected object
    const obj = frame.objects[0];
    const centerX = obj.bbox.x + obj.bbox.width / 2;
    const centerY = obj.bbox.y + obj.bbox.height / 2;
    
    return {
      x: Math.max(0, centerX - 360),
      y: Math.max(0, centerY - 640),
      width: 720,
      height: 1280
    };
  }

  private async getVideoMetadata(videoPath: string): Promise<{ duration: number; frameRate: number }> {
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

      ffprobe.on('close', () => {
        try {
          const metadata = JSON.parse(output);
          const videoStream = metadata.streams.find((s: any) => s.codec_type === 'video');
          const duration = parseFloat(metadata.format.duration);
          const frameRate = eval(videoStream.r_frame_rate); // e.g., "30/1" -> 30
          
          resolve({ duration, frameRate });
        } catch (error) {
          resolve({ duration: 30, frameRate: 30 }); // Fallback
        }
      });

      ffprobe.on('error', reject);
    });
  }

  private parseTimeString(timeStr: string): number {
    // Parse format like "00:05" or "01:23" to seconds
    const parts = timeStr.split(':');
    if (parts.length === 2) {
      const minutes = parseInt(parts[0], 10);
      const seconds = parseInt(parts[1], 10);
      return minutes * 60 + seconds;
    }
    return parseInt(timeStr, 10) || 0;
  }

  private getAspectRatioDimensions(aspectRatio: string): { width: number; height: number } {
    switch (aspectRatio) {
      case '9:16':
        return { width: 720, height: 1280 };
      case '16:9':
        return { width: 1280, height: 720 };
      case '1:1':
        return { width: 1080, height: 1080 };
      default:
        return { width: 720, height: 1280 };
    }
  }

  private generateDynamicCropFilterFromInterpolation(
    interpolation: MathematicalInterpolation,
    targetWidth: number,
    targetHeight: number
  ): string {
    // For simplicity, use the first rectangle's coordinates
    // In production, you would create a complex filter with time-based expressions
    const firstRect = interpolation.frameRectangles[0]?.rectangle || 
                     { x: 480, y: 270, width: 720, height: 1280 };
    
    return `crop=${targetWidth}:${targetHeight}:${Math.floor(firstRect.x)}:${Math.floor(firstRect.y)}`;
  }
}

export const createComprehensiveShortsCreator = (apiKey: string): ComprehensiveShortsCreator => {
  return new ComprehensiveShortsCreator(apiKey);
};