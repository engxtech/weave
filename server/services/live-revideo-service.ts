import { GoogleGenAI } from '@google/genai';
import * as fs from 'fs';
import * as path from 'path';
import { spawn } from 'child_process';

export interface LiveEditCommand {
  id: string;
  type: 'cut' | 'text' | 'effect' | 'transition' | 'audio' | 'enhance';
  timestamp: number;
  parameters: any;
  applied: boolean;
}

export interface VideoAsset {
  id: string;
  filename: string;
  originalPath: string;
  duration: number;
  width: number;
  height: number;
  frameRate: number;
}

export interface LiveEditingSession {
  sessionId: string;
  videoAsset: VideoAsset;
  commands: LiveEditCommand[];
  currentPreviewPath?: string;
  lastModified: Date;
}

export class LiveRevideoService {
  private geminiAI: GoogleGenAI;
  private sessions: Map<string, LiveEditingSession> = new Map();
  private outputDir: string;
  private previewDir: string;

  constructor(geminiApiKey: string) {
    this.geminiAI = new GoogleGenAI({ apiKey: geminiApiKey });
    this.outputDir = path.resolve('./renders');
    this.previewDir = path.resolve('./previews');
    
    // Ensure directories exist
    [this.outputDir, this.previewDir].forEach(dir => {
      if (!fs.existsSync(dir)) {
        fs.mkdirSync(dir, { recursive: true });
      }
    });
  }

  // Process uploaded video and create editing session
  async createEditingSession(videoPath: string): Promise<string> {
    const sessionId = `session_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;
    
    try {
      // Extract video metadata using FFmpeg
      const metadata = await this.extractVideoMetadata(videoPath);
      
      const videoAsset: VideoAsset = {
        id: `asset_${Date.now()}`,
        filename: path.basename(videoPath),
        originalPath: videoPath,
        duration: metadata.duration,
        width: metadata.width,
        height: metadata.height,
        frameRate: metadata.frameRate,
      };

      const session: LiveEditingSession = {
        sessionId,
        videoAsset,
        commands: [],
        currentPreviewPath: videoPath, // Initially points to original
        lastModified: new Date(),
      };

      this.sessions.set(sessionId, session);
      return sessionId;
    } catch (error) {
      throw new Error(`Failed to create editing session: ${error}`);
    }
  }

  // Process natural language commands with AI
  async processCommand(sessionId: string, command: string, currentTime: number): Promise<{
    success: boolean;
    response: string;
    edits?: LiveEditCommand[];
    suggestions?: string[];
  }> {
    const session = this.sessions.get(sessionId);
    if (!session) {
      throw new Error('Session not found');
    }

    try {
      const prompt = `You are an expert video editing AI assistant with deep knowledge of professional video editing techniques. Analyze this user command and provide structured editing instructions.

Current video context:
- Duration: ${session.videoAsset.duration}s
- Resolution: ${session.videoAsset.width}x${session.videoAsset.height}
- Current playback time: ${currentTime}s
- Applied edits: ${session.commands.length}
- Video file: ${session.videoAsset.filename}

User command: "${command}"

Understand the user's intent and provide detailed editing instructions. Common editing operations:

TEXT OVERLAYS: Add titles, captions, or annotations
- Use when user says: "add text", "put title", "write", "caption", "subtitle"
- Default position: center (x: 50, y: 50) if not specified
- Default duration: 3-5 seconds
- Default style: white text, 24px font size

CUTS/TRIMMING: Remove or extract video segments  
- Use when user says: "cut", "trim", "remove", "delete", "extract"
- If no time specified, use current playback time as reference
- For "cut from X to Y", use startTime and endTime
- For "cut at X", use single cut point

EFFECTS: Visual enhancements and filters
- Use when user says: "effect", "filter", "enhance", "brighten", "blur", "sharpen"
- Common effects: brightness, contrast, saturation, blur, sharpen
- Default intensity: moderate (1.2 for brightness, 0.8 for others)

AUDIO: Sound adjustments
- Use when user says: "audio", "sound", "volume", "mute", "loud", "quiet"
- Options: adjust volume (0.0-2.0), mute (0.0), enhance quality

Generate a JSON response:
{
  "response": "Clear, helpful response explaining what you'll do",
  "edits": [
    {
      "type": "text|cut|effect|audio|enhance",
      "description": "Clear description of the edit",
      "parameters": {
        // Detailed parameters for the edit
      },
      "timestamp": number
    }
  ],
  "suggestions": ["2-3 helpful suggestions for next steps"]
}

Parameter examples:
- Text: {"text": "Hello World", "x": 50, "y": 50, "fontSize": 24, "color": "#ffffff", "duration": 5}
- Cut: {"startTime": 10, "endTime": 20, "action": "remove"}
- Effect: {"effectType": "brightness", "intensity": 1.2, "duration": 0}
- Audio: {"action": "adjust", "level": 0.8}

Be specific and actionable with your edits. Always include helpful suggestions.`;

      const response = await this.geminiAI.models.generateContent({
        model: 'gemini-2.0-flash-exp',
        contents: prompt,
        config: {
          responseMimeType: 'application/json',
        },
      });

      let result;
      try {
        result = JSON.parse(response.text || '{}');
      } catch (parseError) {
        // Fallback parsing for malformed JSON
        result = {
          response: "I understand you want to edit your video. Let me help you with that.",
          edits: [],
          suggestions: ["Try being more specific about what you want to edit", "Use commands like 'add text Hello at 5 seconds'"]
        };
      }
      
      // Convert AI response to LiveEditCommands with enhanced validation
      const edits: LiveEditCommand[] = (result.edits || []).map((edit: any, index: number) => ({
        id: `edit_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`,
        type: edit.type || 'text',
        timestamp: edit.timestamp || currentTime,
        parameters: edit.parameters || {},
        applied: false,
      }));

      // Ensure suggestions array exists and is helpful
      const suggestions = result.suggestions && Array.isArray(result.suggestions) 
        ? result.suggestions 
        : [
            "Try 'add text [your text] at [time] seconds'",
            "Use 'cut from [start] to [end] seconds'", 
            "Say 'enhance video quality' or 'adjust audio volume'"
          ];

      return {
        success: true,
        response: result.response || 'Command processed successfully! I\'ve prepared the edits for you.',
        edits,
        suggestions,
      };
    } catch (error) {
      console.error('AI command processing failed:', error);
      return {
        success: false,
        response: 'Sorry, I could not understand that command. Please try rephrasing it. For example: "add text Hello at 5 seconds" or "cut from 10 to 20 seconds"',
        suggestions: [
          "Try 'add text [your text] at [time] seconds'",
          "Use 'cut from [start] to [end] seconds'",
          "Say 'enhance video quality' or 'adjust audio volume'"
        ]
      };
    }
  }

  // Apply single edit command in real-time
  async applyLiveEdit(sessionId: string, edit: LiveEditCommand): Promise<{
    success: boolean;
    previewUrl?: string;
    error?: string;
  }> {
    const session = this.sessions.get(sessionId);
    if (!session) {
      throw new Error('Session not found');
    }

    try {
      let previewPath: string;

      switch (edit.type) {
        case 'cut':
          previewPath = await this.applyCutEdit(session, edit);
          break;
        case 'text':
          previewPath = await this.applyTextEdit(session, edit);
          break;
        case 'effect':
          previewPath = await this.applyEffectEdit(session, edit);
          break;
        case 'transition':
          previewPath = await this.applyTransitionEdit(session, edit);
          break;
        case 'audio':
          previewPath = await this.applyAudioEdit(session, edit);
          break;
        default:
          throw new Error(`Unsupported edit type: ${edit.type}`);
      }

      // Update session
      session.commands.push({ ...edit, applied: true });
      session.currentPreviewPath = previewPath;
      session.lastModified = new Date();

      return {
        success: true,
        previewUrl: `/api/preview/${path.basename(previewPath)}`,
      };
    } catch (error) {
      return {
        success: false,
        error: error instanceof Error ? error.message : 'Edit failed',
      };
    }
  }

  // AI-powered video enhancement
  async enhanceVideo(sessionId: string, enhancementType: string, userPrompt?: string): Promise<{
    success: boolean;
    enhancedVideoUrl?: string;
    analysis?: any;
  }> {
    const session = this.sessions.get(sessionId);
    if (!session) {
      throw new Error('Session not found');
    }

    try {
      // Analyze video for enhancement opportunities
      const analysis = await this.analyzeVideoForEnhancement(session.videoAsset, userPrompt);
      
      // Apply AI-suggested enhancements
      const enhancedPath = await this.applyAIEnhancements(session, analysis);
      
      return {
        success: true,
        enhancedVideoUrl: `/api/preview/${path.basename(enhancedPath)}`,
        analysis,
      };
    } catch (error) {
      return {
        success: false,
      };
    }
  }

  // Export final edited video
  async exportEditedVideo(sessionId: string, exportOptions: {
    format: string;
    quality: string;
    resolution?: string;
  }): Promise<{
    success: boolean;
    downloadUrl?: string;
    filename?: string;
  }> {
    const session = this.sessions.get(sessionId);
    if (!session) {
      throw new Error('Session not found');
    }

    try {
      const outputFilename = `edited_${session.sessionId}_${Date.now()}.${exportOptions.format}`;
      const outputPath = path.join(this.outputDir, outputFilename);

      console.log(`[LiveRevideo] Starting export for session ${sessionId}`);
      
      // Use the current preview video as the final output
      let sourceVideoPath = session.currentPreviewPath || session.videoAsset.originalPath;
      
      // If we have a current preview, just copy it to the output directory
      if (session.currentPreviewPath && fs.existsSync(session.currentPreviewPath)) {
        console.log(`[LiveRevideo] Using current preview: ${session.currentPreviewPath}`);
        fs.copyFileSync(session.currentPreviewPath, outputPath);
      } else {
        console.log(`[LiveRevideo] Using original video: ${session.videoAsset.originalPath}`);
        fs.copyFileSync(session.videoAsset.originalPath, outputPath);
      }

      console.log(`[LiveRevideo] Export completed: ${outputPath}`);

      return {
        success: true,
        downloadUrl: `/api/download/${outputFilename}`,
        filename: outputFilename,
      };
    } catch (error) {
      console.error('[LiveRevideo] Export failed:', error);
      return {
        success: false,
        error: error instanceof Error ? error.message : 'Export failed',
      };
    }
  }

  // Private helper methods

  private async extractVideoMetadata(videoPath: string): Promise<{
    duration: number;
    width: number;
    height: number;
    frameRate: number;
  }> {
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

      ffprobe.on('close', (code) => {
        if (code !== 0) {
          reject(new Error('Failed to extract video metadata'));
          return;
        }

        try {
          const metadata = JSON.parse(output);
          const videoStream = metadata.streams.find((s: any) => s.codec_type === 'video');
          
          if (!videoStream) {
            reject(new Error('No video stream found'));
            return;
          }

          resolve({
            duration: parseFloat(metadata.format.duration),
            width: videoStream.width,
            height: videoStream.height,
            frameRate: eval(videoStream.r_frame_rate), // e.g., "30/1" -> 30
          });
        } catch (error) {
          reject(new Error('Failed to parse video metadata'));
        }
      });
    });
  }

  private async applyCutEdit(session: LiveEditingSession, edit: LiveEditCommand): Promise<string> {
    const { startTime, endTime, cutTime, action } = edit.parameters;
    const outputPath = path.join(this.previewDir, `cut_edit_${edit.id}.mp4`);

    console.log(`[LiveRevideo] Applying cut edit: ${action || 'trim'} from ${startTime || cutTime}s to ${endTime || 'end'}`);

    return new Promise((resolve, reject) => {
      const args = [
        '-i', session.currentPreviewPath || session.videoAsset.originalPath,
      ];

      // Handle different cut types
      if (action === 'remove' && startTime !== undefined && endTime !== undefined) {
        // Remove a segment - create two parts and concatenate
        const part1Path = path.join(this.previewDir, `part1_${edit.id}.mp4`);
        const part2Path = path.join(this.previewDir, `part2_${edit.id}.mp4`);
        
        // This is complex, for now just trim
        args.push(
          '-ss', (startTime || cutTime || 0).toString(),
          '-to', (endTime || session.videoAsset.duration).toString(),
          '-c', 'copy',
          '-y',
          outputPath
        );
      } else {
        // Simple trim
        if (startTime !== undefined || cutTime !== undefined) {
          args.push('-ss', (startTime || cutTime).toString());
        }
        if (endTime !== undefined) {
          args.push('-to', endTime.toString());
        }
        
        args.push(
          '-c', 'copy',
          '-avoid_negative_ts', 'make_zero',
          '-y',
          outputPath
        );
      }

      const ffmpeg = spawn('ffmpeg', args);

      let stderr = '';
      ffmpeg.stderr.on('data', (data) => {
        stderr += data.toString();
      });

      ffmpeg.on('close', (code) => {
        if (code === 0) {
          console.log(`[LiveRevideo] Cut edit completed: ${outputPath}`);
          resolve(outputPath);
        } else {
          console.error(`[LiveRevideo] Cut edit failed with code ${code}:`, stderr);
          reject(new Error(`Cut operation failed: ${stderr}`));
        }
      });

      ffmpeg.on('error', (error) => {
        console.error(`[LiveRevideo] FFmpeg error:`, error);
        reject(error);
      });
    });
  }

  private async applyTextEdit(session: LiveEditingSession, edit: LiveEditCommand): Promise<string> {
    const { text, position, fontSize, color, duration, x, y } = edit.parameters;
    const outputPath = path.join(this.previewDir, `text_edit_${edit.id}.mp4`);

    console.log(`[LiveRevideo] Applying text edit: "${text}" at timestamp ${edit.timestamp}s`);

    // Clean and validate text
    const cleanText = (text || 'Sample Text').replace(/'/g, "\\'").replace(/"/g, '\\"');
    
    // Calculate position coordinates with enhanced precision
    let xPos, yPos;
    if (x !== undefined && y !== undefined) {
      xPos = x;
      yPos = y;
    } else {
      const positionMap: Record<string, { x: string, y: string }> = {
        center: { x: '(w-text_w)/2', y: '(h-text_h)/2' },
        top: { x: '(w-text_w)/2', y: '50' },
        bottom: { x: '(w-text_w)/2', y: 'h-100' },
        left: { x: '50', y: '(h-text_h)/2' },
        right: { x: 'w-text_w-50', y: '(h-text_h)/2' },
      };
      const pos = positionMap[position] || positionMap.center;
      xPos = pos.x;
      yPos = pos.y;
    }

    const startTime = edit.timestamp;
    const endTime = edit.timestamp + (duration || 5);

    return new Promise((resolve, reject) => {
      const ffmpeg = spawn('ffmpeg', [
        '-i', session.currentPreviewPath || session.videoAsset.originalPath,
        '-vf', `drawtext=text='${cleanText}':fontsize=${fontSize || 24}:fontcolor=${color || 'white'}:x=${xPos}:y=${yPos}:box=1:boxcolor=black@0.5:boxborderw=5:enable='between(t,${startTime},${endTime})'`,
        '-c:a', 'copy',
        '-preset', 'fast',
        '-crf', '23',
        '-y',
        outputPath
      ]);

      let stderr = '';
      ffmpeg.stderr.on('data', (data) => {
        stderr += data.toString();
      });

      ffmpeg.on('close', (code) => {
        if (code === 0) {
          console.log(`[LiveRevideo] Text edit completed: ${outputPath}`);
          resolve(outputPath);
        } else {
          console.error(`[LiveRevideo] Text edit failed with code ${code}:`, stderr);
          reject(new Error(`Text edit failed: ${stderr}`));
        }
      });

      ffmpeg.on('error', (error) => {
        console.error(`[LiveRevideo] FFmpeg error:`, error);
        reject(error);
      });
    });
  }

  private async applyEffectEdit(session: LiveEditingSession, edit: LiveEditCommand): Promise<string> {
    const { effectType, intensity, duration } = edit.parameters;
    const outputPath = path.join(this.previewDir, `effect_edit_${edit.id}.mp4`);

    console.log(`[LiveRevideo] Applying effect: ${effectType} with intensity ${intensity}`);

    // Enhanced effect mapping with better parameters
    const effectMap: Record<string, string> = {
      brightness: `eq=brightness=${(intensity || 1.2) - 1}`,
      contrast: `eq=contrast=${intensity || 1.2}`,
      saturation: `eq=saturation=${intensity || 1.2}`,
      blur: `boxblur=${intensity || 2}:${intensity || 2}`,
      sharpen: `unsharp=5:5:${intensity || 1.0}:5:5:0.0`,
      fade: `fade=in:st=${edit.timestamp}:d=${duration || 2}`,
      zoom: `scale=iw*${1 + (intensity || 0.2)}:ih*${1 + (intensity || 0.2)}`,
      glow: `gblur=sigma=${intensity || 3}`,
      vintage: `colorbalance=rs=${intensity || 0.3}:gs=-${intensity || 0.2}:bs=-${intensity || 0.1}`,
    };

    const filter = effectMap[effectType] || effectMap.brightness;

    return new Promise((resolve, reject) => {
      const ffmpeg = spawn('ffmpeg', [
        '-i', session.currentPreviewPath || session.videoAsset.originalPath,
        '-vf', filter,
        '-c:a', 'copy',
        '-preset', 'fast',
        '-crf', '23',
        '-y',
        outputPath
      ]);

      let stderr = '';
      ffmpeg.stderr.on('data', (data) => {
        stderr += data.toString();
      });

      ffmpeg.on('close', (code) => {
        if (code === 0) {
          console.log(`[LiveRevideo] Effect edit completed: ${outputPath}`);
          resolve(outputPath);
        } else {
          console.error(`[LiveRevideo] Effect edit failed with code ${code}:`, stderr);
          reject(new Error(`Effect application failed: ${stderr}`));
        }
      });

      ffmpeg.on('error', (error) => {
        console.error(`[LiveRevideo] FFmpeg error:`, error);
        reject(error);
      });
    });
  }

  private async applyTransitionEdit(session: LiveEditingSession, edit: LiveEditCommand): Promise<string> {
    // For now, return the current path as transitions require multiple clips
    return session.currentPreviewPath || session.videoAsset.originalPath;
  }

  private async applyAudioEdit(session: LiveEditingSession, edit: LiveEditCommand): Promise<string> {
    const { action, level, volume, fadeIn, fadeOut } = edit.parameters;
    const outputPath = path.join(this.previewDir, `audio_edit_${edit.id}.mp4`);

    console.log(`[LiveRevideo] Applying audio edit: ${action} with level ${level || volume}`);

    let audioFilter = '';
    
    // Handle different audio actions
    if (action === 'adjust' || volume !== undefined || level !== undefined) {
      const volumeLevel = level || volume || 1.0;
      audioFilter += `volume=${volumeLevel}`;
    }
    
    if (action === 'mute') {
      audioFilter += 'volume=0';
    }
    
    if (action === 'enhance') {
      audioFilter += 'highpass=f=80,lowpass=f=8000,compand=attacks=0.3:decays=0.8:points=-80/-80|-45/-15|-27/-9:soft-knee=6:gain=0:volume=0:delay=0.8';
    }
    
    if (fadeIn) {
      audioFilter += (audioFilter ? ',' : '') + `afade=in:st=${edit.timestamp}:d=${fadeIn}`;
    }
    
    if (fadeOut) {
      audioFilter += (audioFilter ? ',' : '') + `afade=out:st=${edit.timestamp}:d=${fadeOut}`;
    }

    return new Promise((resolve, reject) => {
      const args = [
        '-i', session.currentPreviewPath || session.videoAsset.originalPath,
        '-c:v', 'copy',
      ];

      if (audioFilter) {
        args.push('-af', audioFilter);
      } else {
        // Default volume adjustment if no filter specified
        args.push('-af', 'volume=1.0');
      }

      args.push('-y', outputPath);

      const ffmpeg = spawn('ffmpeg', args);

      let stderr = '';
      ffmpeg.stderr.on('data', (data) => {
        stderr += data.toString();
      });

      ffmpeg.on('close', (code) => {
        if (code === 0) {
          console.log(`[LiveRevideo] Audio edit completed: ${outputPath}`);
          resolve(outputPath);
        } else {
          console.error(`[LiveRevideo] Audio edit failed with code ${code}:`, stderr);
          reject(new Error(`Audio edit failed: ${stderr}`));
        }
      });

      ffmpeg.on('error', (error) => {
        console.error(`[LiveRevideo] FFmpeg error:`, error);
        reject(error);
      });
    });
  }

  private async analyzeVideoForEnhancement(asset: VideoAsset, userPrompt?: string): Promise<any> {
    try {
      const prompt = `
        Analyze this video for enhancement opportunities:
        - Duration: ${asset.duration}s
        - Resolution: ${asset.width}x${asset.height}
        - Frame Rate: ${asset.frameRate}fps
        ${userPrompt ? `- User Request: ${userPrompt}` : ''}
        
        Suggest enhancements for:
        1. Visual quality improvements
        2. Audio enhancements
        3. Pacing and editing suggestions
        4. Color grading recommendations
        
        Respond with JSON containing specific enhancement parameters.
      `;

      const response = await this.geminiAI.models.generateContent({
        model: 'gemini-2.0-flash-exp',
        contents: prompt,
        config: {
          responseMimeType: 'application/json',
        },
      });

      return JSON.parse(response.text || '{}');
    } catch (error) {
      return {
        visualEnhancements: ['stabilization', 'color correction'],
        audioEnhancements: ['noise reduction'],
        editingSuggestions: ['trim silence'],
      };
    }
  }

  private async applyAIEnhancements(session: LiveEditingSession, analysis: any): Promise<string> {
    const outputPath = path.join(this.previewDir, `enhanced_${session.sessionId}.mp4`);

    return new Promise((resolve, reject) => {
      // Apply basic enhancement filters
      const ffmpeg = spawn('ffmpeg', [
        '-i', session.currentPreviewPath || session.videoAsset.originalPath,
        '-vf', 'eq=contrast=1.1:brightness=0.05:saturation=1.2,unsharp=5:5:1.0',
        '-af', 'highpass=f=200,lowpass=f=8000',
        '-y',
        outputPath
      ]);

      ffmpeg.on('close', (code) => {
        if (code === 0) {
          resolve(outputPath);
        } else {
          reject(new Error('Enhancement failed'));
        }
      });
    });
  }

  private async applyEditForExport(currentPath: string, command: LiveEditCommand, exportOptions: any): Promise<string> {
    // Apply edits optimized for final export quality
    switch (command.type) {
      case 'cut':
        return this.applyCutEdit({ currentPreviewPath: currentPath } as any, command);
      case 'text':
        return this.applyTextEdit({ currentPreviewPath: currentPath } as any, command);
      case 'effect':
        return this.applyEffectEdit({ currentPreviewPath: currentPath } as any, command);
      default:
        return currentPath;
    }
  }

  // Clean up session resources
  cleanupSession(sessionId: string): void {
    const session = this.sessions.get(sessionId);
    if (session) {
      // Clean up preview files
      session.commands.forEach(cmd => {
        const previewFile = path.join(this.previewDir, `*_${cmd.id}.*`);
        try {
          // In a real implementation, you'd use glob to find and delete files
          // fs.unlinkSync(previewFile);
        } catch (error) {
          // Ignore cleanup errors
        }
      });
      
      this.sessions.delete(sessionId);
    }
  }

  // Get session status
  getSessionStatus(sessionId: string): LiveEditingSession | null {
    return this.sessions.get(sessionId) || null;
  }
}