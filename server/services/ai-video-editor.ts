import { GoogleGenerativeAI } from '@google/generative-ai';
import TokenTracker from './token-tracker';
import { createUserContent } from './gemini-utils';
import { spawn } from 'child_process';
import { promises as fs } from 'fs';
import path from 'path';

export interface VideoEditingPlan {
  title: string;
  mood: string;
  totalDuration: number;
  timeline: TimelineSegment[];
  textOverlays: TextOverlay[];
  transitions: Transition[];
  audioSettings: AudioSettings;
  outputSettings: OutputSettings;
}

export interface TimelineSegment {
  id: string;
  startTime: number; // in seconds
  endTime: number;
  sourceStart: number; // start time in source video
  sourceEnd: number; // end time in source video
  action: 'cut' | 'speed_up' | 'slow_down' | 'zoom' | 'pan';
  speed?: number; // for speed changes
  zoom?: { start: number; end: number; centerX: number; centerY: number };
  description: string;
  importance: number; // 1-10
}

export interface TextOverlay {
  id: string;
  text: string;
  startTime: number;
  duration: number;
  position: { x: number; y: number };
  style: {
    fontSize: number;
    color: string;
    backgroundColor?: string;
    fontWeight: 'normal' | 'bold';
    animation?: 'fade_in' | 'slide_up' | 'bounce' | 'typewriter';
  };
}

export interface Transition {
  id: string;
  type: 'cut' | 'fade' | 'slide' | 'zoom' | 'blur';
  duration: number;
  position: number; // timeline position in seconds
}

export interface AudioSettings {
  backgroundMusic?: string;
  volumeAdjustments: Array<{
    startTime: number;
    endTime: number;
    volume: number; // 0-1
  }>;
  audioEffects: Array<{
    type: 'bass_boost' | 'echo' | 'normalize';
    intensity: number;
  }>;
}

export interface OutputSettings {
  resolution: { width: number; height: number };
  aspectRatio: '9:16' | '16:9' | '1:1';
  fps: 24 | 30 | 60;
  bitrate: string;
  format: 'mp4' | 'mov';
}

export interface VideoEditingRequest {
  inputVideoPath: string;
  mood: 'viral' | 'educational' | 'entertaining' | 'dramatic' | 'energetic' | 'calm' | 'professional';
  targetDuration: 15 | 30 | 60;
  aspectRatio: '9:16' | '16:9' | '1:1';
  style: 'modern' | 'cinematic' | 'social_media' | 'minimal' | 'dynamic';
  requirements?: string; // custom user requirements
}

export class AIVideoEditor {
  private ai: GoogleGenerativeAI;

  constructor(apiKey: string) {
    this.ai = new GoogleGenerativeAI(apiKey);
  }

  async generateEditingPlan(request: VideoEditingRequest, userId: number = 1): Promise<VideoEditingPlan> {
    console.log('=== AI VIDEO EDITOR - GENERATING EDITING PLAN ===');
    console.log('Mood:', request.mood);
    console.log('Duration:', request.targetDuration + 's');
    console.log('Input video path:', request.inputVideoPath);
    console.log('Aspect ratio:', request.aspectRatio);
    console.log('Style:', request.style);
    console.log('Requirements:', request.requirements);

    // Check file existence
    try {
      const fs = require('fs');
      const stats = fs.statSync(request.inputVideoPath);
      console.log('Video file size:', stats.size, 'bytes');
      console.log('File exists and accessible');
    } catch (error) {
      console.error('ERROR: Cannot access video file:', error);
      throw new Error(`Video file not accessible: ${request.inputVideoPath}`);
    }

    // First, analyze the input video
    const videoAnalysis = await this.analyzeVideoContent(request.inputVideoPath);
    
    // Generate comprehensive editing plan
    const editingPlan = await this.createEditingPlan(videoAnalysis, request);
    
    return editingPlan;
  }

  private async analyzeVideoContent(videoPath: string): Promise<any> {
    console.log('=== AI VIDEO EDITOR - ANALYZING VIDEO CONTENT ===');
    console.log('Video path:', videoPath);

    // Upload video to Gemini for analysis
    console.log('Uploading video to Gemini...');
    const uploadedFile = await this.ai.files.upload({
      file: videoPath,
      config: { mimeType: "video/mp4" },
    });

    console.log('=== GEMINI FILE UPLOAD SUCCESS ===');
    console.log('Uploaded file URI:', uploadedFile.uri);
    console.log('File name:', uploadedFile.name);
    console.log('MIME type:', uploadedFile.mimeType);

    const analysisPrompt = `Transcribe and analyze this video to create viral shorts content. Provide detailed JSON:

{
  "transcription": "Full transcription of speech/audio in the video",
  "duration": "total video duration in seconds",
  "mainTopic": "What is this video about?",
  "keyMoments": [
    {
      "timestamp": 15.5,
      "description": "what happens at this moment",
      "viralPotential": 9,
      "reason": "why this moment is engaging"
    }
  ],
  "bestSegments": [
    {
      "startTime": 5,
      "endTime": 20,
      "description": "compelling segment description",
      "viralPotential": 8,
      "reason": "why this would work as a short"
    }
  ],
  "mood": "energetic/calm/dramatic/funny/educational",
  "visualElements": ["key visual elements"],
  "audioQuality": "clear/muffled/background_music",
  "recommendations": {
    "hookMoments": [2.5, 15.3],
    "climaxMoment": 20.1,
    "textOverlayIdeas": ["Hook text", "Climax text", "CTA text"]
  }
}

Focus on identifying the most engaging and viral-worthy moments for short-form content.`;

    console.log('=== SENDING GEMINI ANALYSIS REQUEST ===');
    console.log('Model: gemini-1.5-flash');
    console.log('File URI:', uploadedFile.uri);
    console.log('Prompt length:', analysisPrompt.length, 'characters');

    const response = await this.ai.models.generateContent({
      model: "gemini-1.5-flash",
      contents: createUserContent([
        {
          fileData: {
            mimeType: uploadedFile.mimeType,
            fileUri: uploadedFile.uri,
          },
        },
        analysisPrompt
      ]),
    });

    console.log('=== GEMINI ANALYSIS RESPONSE ===');
    console.log('Response received');
    console.log('Candidates:', response.candidates?.length || 0);
    
    const analysisText = response.text || '';
    console.log('Raw response length:', analysisText.length);
    console.log('Raw response (first 500 chars):', analysisText.substring(0, 500));

    // Clean up uploaded file
    console.log('Cleaning up uploaded file...');
    await this.ai.files.delete(uploadedFile.name);

    const cleanedResponse = analysisText.replace(/```json\n?/g, '').replace(/```\n?/g, '').trim();
    console.log('Cleaned response:', cleanedResponse);
    
    try {
      const parsed = JSON.parse(cleanedResponse);
      console.log('=== PARSED ANALYSIS SUCCESS ===');
      console.log('Main topic:', parsed.mainTopic);
      console.log('Duration:', parsed.duration);
      console.log('Key moments:', parsed.keyMoments?.length || 0);
      return parsed;
    } catch (error) {
      console.error('=== JSON PARSE ERROR ===');
      console.error('Parse error:', error.message);
      console.error('Problematic response:', cleanedResponse);
      throw new Error('Failed to parse Gemini analysis response');
    }
  }

  private async createEditingPlan(videoAnalysis: any, request: VideoEditingRequest): Promise<VideoEditingPlan> {
    console.log('=== AI VIDEO EDITOR - CREATING EDITING PLAN ===');

    const planningPrompt = `Create a ${request.targetDuration}-second viral shorts editing plan that can become viral in ${request.aspectRatio} vertical style.

Video Analysis:
${JSON.stringify(videoAnalysis, null, 2)}

User Requirements:
- Mood: ${request.mood}
- Duration: ${request.targetDuration}s
- Aspect Ratio: ${request.aspectRatio}
- Style: ${request.style}
- Custom Requirements: ${request.requirements || 'None'}

Create a viral shorts editing plan in JSON format:
{
  "title": "Catchy viral title based on video content",
  "mood": "${request.mood}",
  "totalDuration": ${request.targetDuration},
  "timeline": [
    {
      "id": "segment_1",
      "startTime": 0,
      "endTime": 3,
      "sourceStart": 10.5,
      "sourceEnd": 13.5,
      "action": "cut",
      "speed": 1.0,
      "description": "Hook moment - grab attention",
      "importance": 10
    },
    {
      "id": "segment_2", 
      "startTime": 3,
      "endTime": 8,
      "sourceStart": 25.0,
      "sourceEnd": 30.0,
      "action": "speed_up",
      "speed": 1.2,
      "description": "Build up moment",
      "importance": 8
    }
  ],
  "textOverlays": [
    {
      "id": "text_1",
      "text": "POV: [Hook text]",
      "startTime": 0.5,
      "duration": 2.5,
      "position": {"x": 50, "y": 15},
      "style": {
        "fontSize": 36,
        "color": "#FFFFFF",
        "backgroundColor": "rgba(0,0,0,0.8)",
        "fontWeight": "bold",
        "animation": "slide_up"
      }
    }
  ],
  "transitions": [
    {
      "id": "trans_1",
      "type": "cut",
      "duration": 0.1,
      "position": 3.0
    }
  ],
  "audioSettings": {
    "volumeAdjustments": [
      {"startTime": 0, "endTime": ${request.targetDuration}, "volume": 0.9}
    ],
    "audioEffects": [
      {"type": "normalize", "intensity": 0.8}
    ]
  },
  "outputSettings": {
    "resolution": {"width": 1080, "height": 1920},
    "aspectRatio": "${request.aspectRatio}",
    "fps": 30,
    "bitrate": "8000k",
    "format": "mp4"
  }
}

Make it viral by focusing on:
1. Strong hook in first 3 seconds
2. Fast-paced editing
3. Engaging text overlays
4. Best moments from the analysis
Create exactly ${Math.ceil(request.targetDuration / 5)} timeline segments.`;

    console.log('=== SENDING PLANNING REQUEST ===');
    console.log('Planning prompt length:', planningPrompt.length);

    const response = await this.ai.models.generateContent({
      model: "gemini-1.5-flash",
      contents: createUserContent([planningPrompt]),
    });

    console.log('=== PLANNING RESPONSE ===');
    const planText = response.text || '';
    console.log('Plan response length:', planText.length);
    console.log('Plan response (first 500 chars):', planText.substring(0, 500));

    const cleanedPlan = planText.replace(/```json\n?/g, '').replace(/```\n?/g, '').trim();
    
    try {
      const parsed = JSON.parse(cleanedPlan);
      console.log('=== EDITING PLAN SUCCESS ===');
      console.log('Plan title:', parsed.title);
      console.log('Timeline segments:', parsed.timeline?.length || 0);
      console.log('Text overlays:', parsed.textOverlays?.length || 0);
      return parsed;
    } catch (error) {
      console.error('=== PLAN PARSE ERROR ===');
      console.error('Parse error:', error.message);
      throw new Error('Failed to parse editing plan');
    }
  }

  async executeEditingPlan(plan: VideoEditingPlan, inputVideoPath: string, outputPath: string): Promise<void> {
    console.log('AI VIDEO EDITOR - Executing editing plan...');
    console.log('AI VIDEO EDITOR - Timeline segments:', plan.timeline.length);
    console.log('AI VIDEO EDITOR - Text overlays:', plan.textOverlays.length);

    // Create temp directory for segments
    const tempDir = path.join(process.cwd(), 'temp_editing');
    await fs.mkdir(tempDir, { recursive: true });

    try {
      // Step 1: Cut video segments
      const segmentPaths = await this.cutVideoSegments(plan.timeline, inputVideoPath, tempDir);
      
      // Step 2: Apply effects to segments
      const processedSegments = await this.applyEffectsToSegments(segmentPaths, plan.timeline, tempDir);
      
      // Step 3: Create text overlay files
      const overlayFiles = await this.createTextOverlays(plan.textOverlays, tempDir);
      
      // Step 4: Merge everything into final video
      await this.mergeIntoFinalVideo(processedSegments, overlayFiles, plan, outputPath);
      
      console.log('AI VIDEO EDITOR - Editing plan executed successfully');
      
    } finally {
      // Clean up temp files
      await this.cleanupTempFiles(tempDir);
    }
  }

  private async cutVideoSegments(timeline: TimelineSegment[], inputVideo: string, tempDir: string): Promise<string[]> {
    console.log('AI VIDEO EDITOR - Cutting video segments...');
    const segmentPaths: string[] = [];

    for (let i = 0; i < timeline.length; i++) {
      const segment = timeline[i];
      const outputPath = path.join(tempDir, `segment_${i}.mp4`);
      
      await new Promise<void>((resolve, reject) => {
        const ffmpeg = spawn('ffmpeg', [
          '-i', inputVideo,
          '-ss', segment.sourceStart.toString(),
          '-t', (segment.sourceEnd - segment.sourceStart).toString(),
          '-c', 'copy',
          '-avoid_negative_ts', 'make_zero',
          '-y',
          outputPath
        ]);

        ffmpeg.on('close', (code) => {
          if (code === 0) {
            resolve();
          } else {
            reject(new Error(`Segment cutting failed: ${code}`));
          }
        });
      });

      segmentPaths.push(outputPath);
    }

    return segmentPaths;
  }

  private async applyEffectsToSegments(segmentPaths: string[], timeline: TimelineSegment[], tempDir: string): Promise<string[]> {
    console.log('AI VIDEO EDITOR - Applying effects to segments...');
    const processedPaths: string[] = [];

    for (let i = 0; i < segmentPaths.length; i++) {
      const segment = timeline[i];
      const inputPath = segmentPaths[i];
      const outputPath = path.join(tempDir, `processed_${i}.mp4`);

      let filterArgs: string[] = [];

      // Apply speed changes
      if (segment.speed && segment.speed !== 1.0) {
        filterArgs.push('-filter:v', `setpts=${1/segment.speed}*PTS`);
        filterArgs.push('-filter:a', `atempo=${segment.speed}`);
      }

      // Apply zoom if specified
      if (segment.zoom) {
        const zoom = segment.zoom;
        filterArgs.push('-filter:v', 
          `scale=iw*${zoom.end}:ih*${zoom.end},crop=iw/${zoom.end}:ih/${zoom.end}:${zoom.centerX}:${zoom.centerY}`);
      }

      await new Promise<void>((resolve, reject) => {
        const args = ['-i', inputPath, ...filterArgs, '-y', outputPath];
        const ffmpeg = spawn('ffmpeg', args);

        ffmpeg.on('close', (code) => {
          if (code === 0) {
            resolve();
          } else {
            reject(new Error(`Effect application failed: ${code}`));
          }
        });
      });

      processedPaths.push(outputPath);
    }

    return processedPaths;
  }

  private async createTextOverlays(overlays: TextOverlay[], tempDir: string): Promise<string[]> {
    console.log('AI VIDEO EDITOR - Creating text overlay filters...');
    // Return filter strings for FFmpeg drawtext filters
    return overlays.map(overlay => {
      const escapedText = overlay.text.replace(/'/g, "\\'").replace(/:/g, "\\:");
      return `drawtext=text='${escapedText}':fontsize=${overlay.style.fontSize}:fontcolor=${overlay.style.color}:x=${overlay.position.x}:y=${overlay.position.y}:enable='between(t,${overlay.startTime},${overlay.startTime + overlay.duration})'`;
    });
  }

  private async mergeIntoFinalVideo(segmentPaths: string[], overlayFilters: string[], plan: VideoEditingPlan, outputPath: string): Promise<void> {
    console.log('AI VIDEO EDITOR - Merging into final video...');

    // Create concat file for segments
    const concatFile = path.join(path.dirname(outputPath), 'concat_list.txt');
    const concatContent = segmentPaths.map(p => `file '${p}'`).join('\n');
    await fs.writeFile(concatFile, concatContent);

    // Build FFmpeg command
    const resolution = plan.outputSettings.resolution;
    const args = [
      '-f', 'concat',
      '-safe', '0',
      '-i', concatFile,
      '-vf', `scale=${resolution.width}:${resolution.height}${overlayFilters.length > 0 ? ',' + overlayFilters.join(',') : ''}`,
      '-c:v', 'libx264',
      '-c:a', 'aac',
      '-r', plan.outputSettings.fps.toString(),
      '-b:v', plan.outputSettings.bitrate,
      '-y',
      outputPath
    ];

    await new Promise<void>((resolve, reject) => {
      const ffmpeg = spawn('ffmpeg', args);

      ffmpeg.on('close', (code) => {
        if (code === 0) {
          resolve();
        } else {
          reject(new Error(`Final merge failed: ${code}`));
        }
      });
    });

    // Clean up concat file
    await fs.unlink(concatFile);
  }

  private async cleanupTempFiles(tempDir: string): Promise<void> {
    try {
      await fs.rmdir(tempDir, { recursive: true });
      console.log('AI VIDEO EDITOR - Temp files cleaned up');
    } catch (error) {
      console.warn('AI VIDEO EDITOR - Failed to clean temp files:', error);
    }
  }
}

export const createAIVideoEditor = (apiKey: string): AIVideoEditor => {
  return new AIVideoEditor(apiKey);
};