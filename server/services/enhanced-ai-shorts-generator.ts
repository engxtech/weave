import { GoogleGenerativeAI } from '@google/generative-ai';
import { spawn } from 'child_process';
import path from 'path';
import fs from 'fs';
import { nanoid } from 'nanoid';

export interface EnhancedShortsOptions {
  contentType: 'viral' | 'educational' | 'entertainment' | 'news' | 'comedy';
  aspectRatio: '9:16' | '16:9' | '1:1';
  duration: number; // Target short duration in seconds
  focusMode: 'auto' | 'speaking-person' | 'main-person' | 'action' | 'text' | 'object';
  quality: 'high' | 'medium' | 'low';
  geminiModel?: string; // User-selected Gemini model
  focusObject?: string; // Specific object to focus on when focusMode is 'object'
}

export interface IntelligentTimeInterval {
  originalStartTime: number;  // Position in original video
  originalEndTime: number;    // Position in original video
  newStartTime: number;       // Position in final short
  newEndTime: number;         // Position in final short
  duration: number;
  selectionReason: string;
  contentDescription: string;
  transcriptSnippet: string;
  focusStrategy: {
    x: number;
    y: number;
    width: number;
    height: number;
    reason: string;
    confidence: number;
  };
  engagementLevel: 'viral' | 'high' | 'medium';
  transitionType: 'cut' | 'fade' | 'zoom';
  subjectPositioning?: string;
  emotionalCues?: {
    audioEmotions?: string[];
  };
}

export interface IntelligentStoryline {
  concept: string;
  narrative: string;
  targetAudience: string;
  viralPotential: number;
  title: string;
  description: string;
  hashtags: string[];
  totalDuration: number;
  selectedTimeIntervals: IntelligentTimeInterval[];
  compressionRatio: string;
  qualityMetrics: {
    narrativeCoherence: number;
    emotionalImpact: number;
    shareability: number;
  };
}

export interface EnhancedShortsResult {
  success: boolean;
  videoUrl: string;
  storyline: IntelligentStoryline;
  processingTime: number;
  videoInfo: {
    width: number;
    height: number;
    duration: number;
    fps: number;
    selectedSegments: number;
    compressionRatio: number;
  };
}

export class EnhancedAIShortsGenerator {
  private ai: GoogleGenerativeAI;
  private tempDir: string;
  private uploadsDir: string;
  private startTime: number = 0;
  private currentAspectRatio: string = '9:16';

  constructor(apiKey: string) {
    this.ai = new GoogleGenerativeAI(apiKey);
    this.tempDir = path.join(process.cwd(), 'temp_ai_shorts');
    this.uploadsDir = path.join(process.cwd(), 'uploads');
    this.ensureTempDir();
  }

  private ensureTempDir() {
    if (!fs.existsSync(this.tempDir)) {
      fs.mkdirSync(this.tempDir, { recursive: true });
    }
  }

  private log(message: string) {
    const timestamp = new Date().toISOString();
    console.log(`AI Shorts Generator: [${timestamp}] ${message}`);
  }

  private getSelectedModel(options: EnhancedShortsOptions): string {
    const model = options.geminiModel || 'gemini-1.5-flash';
    this.log(`Using AI model: ${model}`);
    return model;
  }

  private getFocusAnalysisDescription(options: EnhancedShortsOptions): string {
    switch (options.focusMode) {
      case 'speaking-person':
        return 'Identify and focus on whoever is speaking or showing expressions in each moment';
      case 'main-person':
        return 'Consistently focus on the most prominent person throughout the video';
      case 'object':
        return `Focus on tracking and highlighting the ${options.focusObject || 'specified object'}`;
      case 'action':
        return 'Focus on areas with the most movement, gestures, and dynamic activity';
      case 'text':
        return 'Focus on any text, graphics, or visual information that appears';
      default:
        return 'Automatically detect and focus on the most important visual element in each frame';
    }
  }

  private getAspectRatioDescription(aspectRatio: string): string {
    switch (aspectRatio) {
      case '9:16':
        return 'Vertical/Portrait format for mobile viewing, TikTok, Instagram Stories';
      case '16:9':
        return 'Horizontal/Landscape format for YouTube, desktop viewing';
      case '1:1':
        return 'Square format for Instagram posts, general social media';
      case '4:3':
        return 'Classic TV format, older content compatibility';
      default:
        return 'Standard format';
    }
  }

  private getFocusInstructions(options: EnhancedShortsOptions): string {
    switch (options.focusMode) {
      case 'speaking-person':
        return `- PRIORITY: Focus on the person who is currently speaking or showing expressions
- When multiple people are visible, identify who is talking based on lip movement, gestures, and facial expressions
- Crop tightly on the speaker's face and upper body
- If speaker changes, smoothly transition focus to the new speaker
- Ignore silent or passive people in the background`;

      case 'main-person':
        return `- PRIORITY: Focus consistently on the most prominent/important person throughout the video
- Identify the main subject early and maintain focus on them
- Crop to include face and upper body of the main person
- Even when others speak, keep the main person in frame if possible
- Maintain consistent framing around the primary subject`;

      case 'object':
        const objectName = options.focusObject || 'specified object';
        return `- PRIORITY: Focus on the ${objectName} in the video
- Detect and track the ${objectName} throughout the scene
- Crop to ensure the ${objectName} is prominently visible and centered
- Include relevant context around the object (hands holding it, interaction with it)
- Follow the object's movement and ensure it remains the focal point`;

      case 'action':
        return `- PRIORITY: Focus on areas with the most movement and activity
- Detect hand gestures, body movements, and dynamic actions
- Crop to capture the full action sequence
- Follow movement patterns and ensure motion is clearly visible
- Prioritize areas where something is happening over static elements`;

      case 'text':
        return `- PRIORITY: Focus on any text, graphics, or visual information displayed
- Detect text overlays, signs, documents, or written content
- Crop to make text clearly readable and prominent
- Include sufficient context around text for understanding
- Prioritize areas where text or visual information appears`;

      default: // 'auto'
        return `- PRIORITY: Automatically detect the most important visual element in each frame
- Use AI to identify faces, movements, objects, and text
- Prioritize speaking persons > main subjects > important objects > actions
- Adapt focus dynamically based on what's most relevant in each moment
- Maintain visual interest and narrative coherence`;
    }
  }

  async generateIntelligentShorts(
    videoPath: string,
    options: EnhancedShortsOptions,
    progressCallback?: (progress: number, message: string) => void
  ): Promise<EnhancedShortsResult> {
    const sessionId = nanoid();
    this.startTime = Date.now();
    this.log(`Starting comprehensive AI video analysis with session: ${sessionId}`);
    
    try {
      // Step 1: Analyze complete video properties
      progressCallback?.(5, 'Analyzing complete video properties...');
      const videoInfo = await this.getVideoInfo(videoPath);
      this.log(`Complete video: ${videoInfo.width}x${videoInfo.height}, ${videoInfo.duration}s (${Math.floor(videoInfo.duration/60)}m ${Math.floor(videoInfo.duration%60)}s), ${videoInfo.fps}fps`);
      
      // Step 2: Extract complete audio for transcription
      progressCallback?.(10, 'Extracting complete audio track...');
      const audioPath = await this.extractAudio(videoPath, sessionId);
      
      // Step 3: Get full video transcript with timestamps
      progressCallback?.(20, 'Transcribing complete video with AI...');
      const fullTranscript = await this.transcribeCompleteVideo(audioPath, videoInfo.duration, options);
      
      // Step 4: Analyze complete video content with comprehensive frame sampling
      progressCallback?.(35, 'Analyzing complete video content...');
      const completeAnalysis = await this.analyzeCompleteVideoContent(videoPath, fullTranscript, videoInfo, sessionId, options);
      
      // Step 5: Create intelligent storyline for target duration
      progressCallback?.(50, `Creating ${options.duration}s ${options.contentType} storyline...`);
      const intelligentStoryline = await this.createIntelligentStoryline(
        fullTranscript, 
        completeAnalysis, 
        videoInfo, 
        options
      );
      
      // Step 6: Process selected video segments with AI-determined focus
      progressCallback?.(80, 'Processing intelligently selected segments...');
      const outputPath = await this.createIntelligentShortsVideo(videoPath, intelligentStoryline, options, sessionId);
      
      progressCallback?.(95, 'Finalizing intelligent short...');
      
      const result: EnhancedShortsResult = {
        success: true,
        videoUrl: `/api/video/${path.basename(outputPath)}`,
        storyline: intelligentStoryline,
        processingTime: Date.now() - this.startTime,
        videoInfo: {
          ...videoInfo,
          selectedSegments: intelligentStoryline.selectedTimeIntervals.length,
          compressionRatio: Math.round((options.duration / videoInfo.duration) * 100)
        }
      };
      
      progressCallback?.(100, 'Intelligent shorts generation complete!');
      this.log(`Intelligent processing completed: ${result.processingTime}ms`);
      this.log(`Created ${options.duration}s short from ${Math.floor(videoInfo.duration)}s video (${result.videoInfo.compressionRatio}% compression)`);
      
      return result;
      
    } catch (error) {
      this.log(`Error in intelligent shorts generation: ${error}`);
      throw new Error(`Failed to generate intelligent AI shorts: ${error}`);
    }
  }

  private async getVideoInfo(videoPath: string): Promise<{width: number, height: number, duration: number, fps: number}> {
    return new Promise((resolve, reject) => {
      const cmd = [
        'ffprobe', '-v', 'quiet', '-print_format', 'json', '-show_format', '-show_streams', videoPath
      ];
      
      const process = spawn(cmd[0], cmd.slice(1));
      let output = '';
      
      process.stdout.on('data', (data) => {
        output += data.toString();
      });
      
      process.on('close', (code) => {
        if (code === 0) {
          try {
            const info = JSON.parse(output);
            const videoStream = info.streams.find((s: any) => s.codec_type === 'video');
            resolve({
              width: parseInt(videoStream.width),
              height: parseInt(videoStream.height),
              duration: parseFloat(info.format.duration),
              fps: eval(videoStream.r_frame_rate) // e.g., "30/1" -> 30
            });
          } catch (error) {
            reject(new Error(`Failed to parse video info: ${error}`));
          }
        } else {
          reject(new Error(`FFprobe failed with code ${code}`));
        }
      });
    });
  }

  private async extractAudio(videoPath: string, sessionId: string): Promise<string> {
    const audioPath = path.join(this.tempDir, `audio_${sessionId}.wav`);
    
    return new Promise((resolve, reject) => {
      const cmd = [
        'ffmpeg', '-i', videoPath, '-vn', '-acodec', 'pcm_s16le', '-ar', '16000', '-ac', '1', '-y', audioPath
      ];
      
      const process = spawn(cmd[0], cmd.slice(1));
      process.on('close', (code) => {
        if (code === 0) {
          this.log(`Audio extracted to: ${audioPath}`);
          resolve(audioPath);
        } else {
          reject(new Error(`Audio extraction failed: ${code}`));
        }
      });
    });
  }

  private async transcribeCompleteVideo(audioPath: string, videoDuration: number, options: EnhancedShortsOptions): Promise<string> {
    try {
      this.log(`Transcribing complete ${Math.floor(videoDuration/60)}m ${Math.floor(videoDuration%60)}s video with Gemini AI...`);
      
      const audioBuffer = fs.readFileSync(audioPath);
      const audioBase64 = audioBuffer.toString('base64');
      
      const prompt = `Please provide a complete, accurate transcription of this ${Math.floor(videoDuration/60)} minute ${Math.floor(videoDuration%60)} second audio file.

REQUIREMENTS:
- Transcribe ALL spoken content from start to finish
- Maintain original language (do not translate)
- Include natural speech patterns, pauses, and emotions
- Add approximate timestamps every 10-15 seconds: [MM:SS]
- Identify different speakers if multiple people
- Note significant audio events: [MUSIC], [APPLAUSE], [LAUGHTER]

Format example:
[00:00] Speaker starts talking about topic...
[00:15] Continues with main points...
[00:30] [LAUGHTER] Jokes about something...

Provide the complete transcription:`;

      const selectedModel = this.getSelectedModel(options);
      const model = this.ai.getGenerativeModel({ model: selectedModel });
      const result = await model.generateContent([
        {
          inlineData: {
            data: audioBase64,
            mimeType: 'audio/wav'
          }
        },
        prompt
      ]);

      const fullTranscript = result.response.text() || '';
      this.log(`Complete transcription: ${fullTranscript.length} characters, ${Math.floor(videoDuration)}s video`);
      
      return fullTranscript;
      
    } catch (error) {
      this.log(`Error in complete transcription: ${error}`);
      throw new Error(`Failed to transcribe complete video: ${error}`);
    }
  }

  private async analyzeCompleteVideoContent(
    videoPath: string, 
    fullTranscript: string, 
    videoInfo: any,
    sessionId: string,
    options: EnhancedShortsOptions
  ): Promise<any> {
    try {
      this.log(`Analyzing complete ${Math.floor(videoInfo.duration/60)}m video content...`);
      
      // Extract frames throughout the entire video for comprehensive analysis
      const framesDir = path.join(this.tempDir, `frames_${sessionId}`);
      await fs.promises.mkdir(framesDir, { recursive: true });
      
      // Sample frames every 5-10 seconds for complete analysis
      const frameInterval = Math.max(5, Math.min(10, videoInfo.duration / 20)); // 20 frames max
      const totalFrames = Math.floor(videoInfo.duration / frameInterval);
      
      this.log(`Extracting ${totalFrames} frames (every ${frameInterval}s) for complete analysis`);
      
      const frameExtractionCmd = [
        'ffmpeg', '-i', videoPath,
        '-vf', `fps=1/${frameInterval}`,
        '-y',
        path.join(framesDir, 'frame_%03d.jpg')
      ];
      
      await new Promise((resolve, reject) => {
        const process = spawn(frameExtractionCmd[0], frameExtractionCmd.slice(1));
        process.on('close', (code) => {
          if (code === 0) resolve(undefined);
          else reject(new Error(`Frame extraction failed: ${code}`));
        });
      });
      
      // Analyze complete video with Gemini
      const analysisPrompt = `Analyze this complete video (${Math.floor(videoInfo.duration/60)}m ${Math.floor(videoInfo.duration%60)}s) for creating engaging short clips.

TRANSCRIPT:
${fullTranscript}

TASK: Identify the most engaging moments for short-form content creation.

ANALYSIS REQUIREMENTS:
1. **Focus Strategy (${options.focusMode.toUpperCase()})**: ${this.getFocusAnalysisDescription(options)}
2. Identify 8-12 key moments throughout the video with high engagement potential
3. For each moment, specify exact timestamp, engagement level, and why it's compelling
4. Determine optimal focus areas for each moment based on selected focus mode
5. Rate emotional intensity and viral potential
6. Identify natural transition points and narrative flow

RESPONSE FORMAT (JSON):
{
  "videoSummary": "Brief description of video content and themes",
  "totalEngagementScore": 0.0-1.0,
  "keyMoments": [
    {
      "timestamp": seconds,
      "endTime": seconds,
      "description": "What happens in this moment",
      "engagementLevel": "low/medium/high/viral",
      "emotionalIntensity": 0.0-1.0,
      "viralPotential": 0.0-1.0,
      "contentType": "comedy/educational/dramatic/action",
      "focusArea": {
        "x": 0.0-1.0,
        "y": 0.0-1.0, 
        "width": 0.0-1.0,
        "height": 0.0-1.0,
        "zoomLevel": 0.5-2.0,
        "confidence": 0.0-1.0,
        "reason": "Why focus here based on ${options.focusMode} mode"
      },
      "aspectRatioFocus": {
        "16:9": {"x": 0.0-1.0, "y": 0.0-1.0, "width": 0.0-1.0, "height": 0.0-1.0, "zoomLevel": 0.5-2.0, "reasoning": "Optimized for landscape viewing"},
        "9:16": {"x": 0.0-1.0, "y": 0.0-1.0, "width": 0.0-1.0, "height": 0.0-1.0, "zoomLevel": 0.5-2.0, "reasoning": "Optimized for vertical/mobile viewing"},
        "1:1": {"x": 0.0-1.0, "y": 0.0-1.0, "width": 0.0-1.0, "height": 0.0-1.0, "zoomLevel": 0.5-2.0, "reasoning": "Optimized for square social media"},
        "4:3": {"x": 0.0-1.0, "y": 0.0-1.0, "width": 0.0-1.0, "height": 0.0-1.0, "zoomLevel": 0.5-2.0, "reasoning": "Optimized for classic format"}
      },
      "subjectPosition": "left/center/right - where main subject appears in frame",
      "transcriptSnippet": "Key dialogue/audio",
      "transitionPotential": 0.0-1.0
    }
  ],
  "narrativeFlow": "How moments connect together",
  "bestSequences": ["List of moment combinations that work well together"]
}`;

      const selectedModel = this.getSelectedModel(options);
      const model = this.ai.getGenerativeModel({ model: selectedModel });
      const result = await model.generateContent(analysisPrompt);

      const analysisText = result.response.text() || '';
      this.log(`Raw analysis response length: ${analysisText.length} characters`);
      
      // Try multiple JSON extraction methods
      let jsonContent = '';
      
      // Method 1: Extract from code blocks
      const codeBlockMatch = analysisText.match(/```json\s*([\s\S]*?)\s*```/);
      if (codeBlockMatch) {
        jsonContent = codeBlockMatch[1];
      } else {
        // Method 2: Extract JSON object
        const jsonMatch = analysisText.match(/\{[\s\S]*\}/);
        if (jsonMatch) {
          jsonContent = jsonMatch[0];
        } else {
          this.log(`No JSON found in analysis response. Raw text: ${analysisText.substring(0, 500)}...`);
          throw new Error('No JSON found in analysis AI response');
        }
      }
      
      // Clean and repair JSON
      try {
        jsonContent = this.repairJson(jsonContent);
        const completeAnalysis = JSON.parse(jsonContent);
        this.log(`Complete analysis: ${completeAnalysis.keyMoments?.length || 0} key moments identified`);
        return completeAnalysis;
      } catch (parseError) {
        this.log(`Analysis JSON parse error: ${parseError}`);
        this.log(`Problematic JSON (first 1000 chars): ${jsonContent.substring(0, 1000)}`);
        throw new Error(`Failed to parse analysis JSON: ${parseError}`);
      }
      
    } catch (error) {
      this.log(`Error in complete video analysis: ${error}`);
      throw new Error(`Failed to analyze complete video: ${error}`);
    }
  }

  private async createIntelligentStoryline(
    fullTranscript: string,
    completeAnalysis: any,
    videoInfo: any,
    options: EnhancedShortsOptions
  ): Promise<IntelligentStoryline> {
    try {
      this.log(`Creating intelligent ${options.duration}s ${options.contentType} storyline from ${Math.floor(videoInfo.duration)}s video...`);
      
      const prompt = `Create an intelligent storyline for a ${options.duration}-second ${options.contentType} short from this ${Math.floor(videoInfo.duration/60)}m ${Math.floor(videoInfo.duration%60)}s video.

COMPLETE VIDEO ANALYSIS:
${JSON.stringify(completeAnalysis, null, 2)}

FULL TRANSCRIPT:
${fullTranscript}

INTELLIGENT STORYLINE REQUIREMENTS:
1. Analyze the ENTIRE ${Math.floor(videoInfo.duration)}s video to understand the complete narrative
2. Select the most compelling ${options.duration} seconds that tell a complete story
3. Choose specific time intervals from the original video (not consecutive - can jump around)
4. Ensure selected moments create a coherent ${options.contentType} narrative
5. Optimize for ${options.aspectRatio} aspect ratio with smart focus areas
6. Target high engagement and viral potential

EMOTIONAL & VISUAL CUE ANALYSIS:
Pay close attention to these cues when selecting segments:

AUDIO EMOTIONAL CUES:
- Laughter, giggles, chuckles (comedy gold)
- Surprise exclamations, gasps, "wow" moments  
- Excitement, enthusiasm in voice tone
- Important statements, quotable lines
- Vocal emphasis, dramatic pauses
- Reaction sounds (sighs, groans, cheers)

VISUAL EMOTIONAL CUES:
- Sudden facial expressions, reactions
- Funny faces, expressions, gestures
- Surprised looks, shock, amazement
- Hand gestures, body language
- Quick movements, sudden actions
- Eye contact with camera, direct engagement

SUBJECT POSITIONING ANALYSIS (REQUIRED):
For each segment, you MUST specify where the main subject appears in the frame:
- "left": Subject positioned on left side of frame (x coordinate < 0.4)
- "center": Subject centered in frame (x coordinate 0.4-0.6, optimal for most crops)
- "right": Subject positioned on right side of frame (x coordinate > 0.6)

CRITICAL: Always include "subjectPositioning" field with value "left", "center", or "right" for every segment

SELECTION CRITERIA for ${options.contentType}:
- Comedy: Funniest moments, laughter, reactions, visual gags, funny expressions, perfect timing
- Educational: Key learning points, demonstrations, clear explanations, "aha" moments
- Viral: Most shareable moments, emotional peaks, surprising content, quotable moments
- Entertainment: Most engaging scenes, personalities, energy, dramatic moments
- News: Most important facts, key statements, visual evidence, emphasis moments

RESPONSE FORMAT (JSON):
{
  "concept": "Overall story concept for the ${options.duration}s short",
  "narrative": "How selected moments connect into compelling story",
  "targetAudience": "Who this appeals to",
  "viralPotential": 0.0-1.0,
  "title": "Compelling title with emojis",
  "description": "Engaging description that hooks viewers",
  "hashtags": ["#relevant", "#trending", "#tags"],
  "totalDuration": ${options.duration},
  "selectedTimeIntervals": [
    {
      "originalStartTime": "seconds in original video",
      "originalEndTime": "seconds in original video", 
      "newStartTime": "position in ${options.duration}s short",
      "newEndTime": "position in ${options.duration}s short",
      "duration": "segment length",
      "selectionReason": "Why this specific interval was chosen (based on emotional/visual cues)",
      "contentDescription": "What happens in this segment",
      "transcriptSnippet": "Key dialogue/audio from original",
      "emotionalCues": {
        "audioEmotions": ["laughter", "surprise", "excitement", "emphasis"],
        "visualCues": ["facial_expression", "gesture", "eye_contact", "movement"],
        "intensity": 0.0-1.0
      },
      "subjectPositioning": "left/center/right - where main subject appears in frame",
      "focusStrategy": {
        "x": 0.0-1.0,
        "y": 0.0-1.0,
        "width": 0.0-1.0,
        "height": 0.0-1.0,
        "zoomLevel": 0.5-2.0,
        "reason": "Why focus on this area based on emotional cues and subject position",
        "confidence": 0.0-1.0,
        "aspectRatioCoordinates": {
          "9:16": {"x": 0.0-1.0, "y": 0.0-1.0, "width": 0.0-1.0, "height": 0.0-1.0, "zoomLevel": 0.5-2.0},
          "16:9": {"x": 0.0-1.0, "y": 0.0-1.0, "width": 0.0-1.0, "height": 0.0-1.0, "zoomLevel": 0.5-2.0},
          "1:1": {"x": 0.0-1.0, "y": 0.0-1.0, "width": 0.0-1.0, "height": 0.0-1.0, "zoomLevel": 0.5-2.0}
        }
      },
      "engagementLevel": "viral/high/medium",
      "transitionType": "cut/fade/zoom"
    }
  ],
  "compressionRatio": "${Math.round((options.duration / videoInfo.duration) * 100)}%",
  "qualityMetrics": {
    "narrativeCoherence": 0.0-1.0,
    "emotionalImpact": 0.0-1.0,
    "shareability": 0.0-1.0
  }
}`;

      const selectedModel = this.getSelectedModel(options);
      const model = this.ai.getGenerativeModel({ model: selectedModel });
      const result = await model.generateContent(prompt);

      const storyText = result.response.text() || '';
      this.log(`Raw storyline response length: ${storyText.length} characters`);
      
      // Try multiple JSON extraction methods
      let jsonContent = '';
      
      // Method 1: Extract from code blocks
      const codeBlockMatch = storyText.match(/```json\s*([\s\S]*?)\s*```/);
      if (codeBlockMatch) {
        jsonContent = codeBlockMatch[1];
      } else {
        // Method 2: Extract JSON object
        const jsonMatch = storyText.match(/\{[\s\S]*\}/);
        if (jsonMatch) {
          jsonContent = jsonMatch[0];
        } else {
          this.log(`No JSON found in storyline response. Raw text: ${storyText.substring(0, 500)}...`);
          throw new Error('No JSON found in storyline AI response');
        }
      }
      
      // Clean and repair JSON
      try {
        jsonContent = this.repairJson(jsonContent);
        const storyline = JSON.parse(jsonContent);
        this.log(`Intelligent storyline created: ${storyline.selectedTimeIntervals?.length || 0} time intervals selected`);
        this.log(`Story concept: ${storyline.concept}`);
        return storyline;
      } catch (parseError) {
        this.log(`Storyline JSON parse error: ${parseError}`);
        this.log(`Problematic JSON (first 1000 chars): ${jsonContent.substring(0, 1000)}`);
        throw new Error(`Failed to parse storyline JSON: ${parseError}`);
      }
      
    } catch (error) {
      this.log(`Error creating intelligent storyline: ${error}`);
      throw new Error(`Failed to create intelligent storyline: ${error}`);
    }
  }

  private async createIntelligentShortsVideo(
    inputPath: string,
    storyline: IntelligentStoryline,
    options: EnhancedShortsOptions,
    sessionId: string
  ): Promise<string> {
    try {
      this.log('Processing intelligently selected video segments...');
      
      const outputPath = path.join(this.uploadsDir, `ai_shorts_${sessionId}.mp4`);
      const intervals = storyline.selectedTimeIntervals || [];
      
      if (intervals.length === 0) {
        throw new Error('No intelligent time intervals provided for video creation');
      }
      
      this.log(`Processing ${intervals.length} intelligently selected time intervals from original video`);
      
      // Process each intelligently selected time interval
      const processedSegments: string[] = [];
      
      for (let i = 0; i < intervals.length; i++) {
        const interval = intervals[i];
        this.log(`Processing intelligent interval ${i + 1}/${intervals.length}:`);
        this.log(`  Original: ${interval.originalStartTime}s - ${interval.originalEndTime}s (${interval.duration}s)`);
        this.log(`  Target: ${interval.newStartTime}s - ${interval.newEndTime}s`);
        this.log(`  Reason: ${interval.selectionReason}`);
        
        const segmentPath = path.join(this.tempDir, `intelligent_segment_${sessionId}_${i}.mp4`);
        
        // Apply AI-determined focus coordinates with aspect ratio conversion for this specific segment
        const segmentFocusFilter = this.buildSegmentFocusFilter(interval, options);
        
        // Extract segment from original video using AI-selected timing and focus
        const segmentCmd = [
          'ffmpeg', '-i', inputPath,
          '-ss', interval.originalStartTime.toString(), // Use original video timing
          '-t', interval.duration.toString(),   // Extract specified duration
          '-vf', segmentFocusFilter,
          '-c:v', 'libx264', '-preset', 'fast',
          '-c:a', 'aac', '-b:a', '128k',
          '-y', segmentPath
        ];
        
        await new Promise((resolve, reject) => {
          const process = spawn(segmentCmd[0], segmentCmd.slice(1));
          let errorOutput = '';
          
          process.stderr?.on('data', (data) => {
            errorOutput += data.toString();
          });
          
          process.on('close', (code) => {
            if (code === 0) {
              processedSegments.push(segmentPath);
              this.log(`✓ Intelligent interval processed: ${interval.contentDescription}`);
              this.log(`  Focus: ${interval.focusStrategy?.reason || 'Default focus strategy'}`);
              this.log(`  Subject Position: ${interval.subjectPositioning || 'Not specified'}`);
              this.log(`  Emotional Cues: ${JSON.stringify(interval.emotionalCues?.audioEmotions || [])}`);
              this.log(`  Aspect ratio: ${options.aspectRatio} with AI-determined coordinates`);
              resolve(undefined);
            } else {
              this.log(`FFmpeg error for segment ${i}: ${errorOutput}`);
              reject(new Error(`Intelligent interval processing failed: ${code}`));
            }
          });
        });
      }
      
      // Merge intelligently processed segments (already focused and aspect-ratio converted)
      this.log('Merging intelligently focused segments into final short...');
      const concatListPath = path.join(this.tempDir, `intelligent_concat_${sessionId}.txt`);
      const concatContent = processedSegments.map(p => `file '${p}'`).join('\n');
      await fs.promises.writeFile(concatListPath, concatContent);
      
      // Merge focused segments with re-encoding to ensure compatibility
      const mergeCmd = [
        'ffmpeg', '-f', 'concat', '-safe', '0', '-i', concatListPath,
        '-c:v', 'libx264', '-preset', 'medium', '-crf', '23',
        '-c:a', 'aac', '-b:a', '128k',
        '-movflags', '+faststart',
        '-y', outputPath
      ];
      
      await new Promise((resolve, reject) => {
        const process = spawn(mergeCmd[0], mergeCmd.slice(1));
        let errorOutput = '';
        
        process.stderr?.on('data', (data) => {
          errorOutput += data.toString();
        });
        
        process.on('close', (code) => {
          if (code === 0) {
            this.log(`✓ Intelligent shorts creation completed: ${path.basename(outputPath)}`);
            resolve(undefined);
          } else {
            this.log(`FFmpeg merge error: ${errorOutput}`);
            reject(new Error(`Intelligent video merging failed: ${code}`));
          }
        });
      });
      
      // Log intelligent processing results
      const stats = await fs.promises.stat(outputPath);
      
      this.log(`=== INTELLIGENT SHORTS GENERATION COMPLETE ===`);
      this.log(`Output path: /api/video/${path.basename(outputPath)}`);
      this.log(`Processing time: ${Date.now() - this.startTime} ms`);
      this.log(`Time intervals processed: ${intervals.length}`);
      this.log(`Focus accuracy: ${(intervals.reduce((acc, i) => acc + i.focusStrategy.confidence, 0) / intervals.length * 100).toFixed(1)} %`);
      
      return outputPath;
      
    } catch (error) {
      this.log(`Error creating intelligent shorts video: ${error}`);
      throw new Error(`Failed to create intelligent shorts video: ${error}`);
    }
  }

  private buildSegmentFocusFilter(interval: any, options: EnhancedShortsOptions): string {
    try {
      // Get aspect ratio specific coordinates if available, otherwise use general focus area
      const aspectRatioCoords = interval.focusStrategy?.aspectRatioCoordinates?.[options.aspectRatio];
      const generalCoords = interval.focusStrategy?.coordinates;
      const coords = aspectRatioCoords || generalCoords;
      
      if (!coords || typeof coords.x !== 'number' || typeof coords.y !== 'number' || 
          typeof coords.width !== 'number' || typeof coords.height !== 'number') {
        
        this.log(`  Missing coordinates - available data: ${JSON.stringify(interval.focusStrategy || {}, null, 2)}`);
        this.log(`  Checking for focusArea coordinates...`);
        
        // Try to extract from focusArea if aspectRatioCoordinates not available
        const focusArea = interval.focusStrategy?.focusArea;
        if (focusArea && typeof focusArea.x === 'number' && typeof focusArea.y === 'number' && 
            typeof focusArea.width === 'number' && typeof focusArea.height === 'number') {
          this.log(`  Using general focusArea coordinates for ${options.aspectRatio}`);
          this.log(`  Subject positioning: ${interval.subjectPositioning || 'unknown'}`);
          this.log(`  Emotional cues: ${JSON.stringify(interval.emotionalCues || {})}`);
          const coords = focusArea;
          const safeCoords = this.validateAndClampCoordinates(coords);
          const zoomLevel = coords.zoomLevel || 1.0;
          return this.buildFocusFilterWithZoom(safeCoords, zoomLevel, options.aspectRatio);
        }
        
        // Try to use emotional/positioning data for intelligent fallback
        if (interval.subjectPositioning || interval.emotionalCues) {
          this.log(`  Using subject positioning (${interval.subjectPositioning}) for intelligent crop`);
          return this.buildPositionBasedCrop(interval.subjectPositioning, options.aspectRatio);
        }
        
        // Last resort: try to extract from raw focus strategy data
        const rawData = interval.focusStrategy;
        if (rawData && typeof rawData.x === 'number' && typeof rawData.y === 'number' && 
            typeof rawData.width === 'number' && typeof rawData.height === 'number') {
          this.log(`  Using raw focus strategy data for segment`);
          const safeCoords = this.validateAndClampCoordinates(rawData);
          const zoomLevel = rawData.zoomLevel || 1.0;
          return this.buildFocusFilterWithZoom(safeCoords, zoomLevel, options.aspectRatio);
        }
        
        this.log(`  Using fallback aspect ratio conversion for segment (no valid coordinates found)`);
        return this.getBasicAspectRatioFilter(options.aspectRatio);
      }

      const safeCoords = this.validateAndClampCoordinates(coords);
      const zoomLevel = coords.zoomLevel || 1.0;
      
      this.log(`  Applying segment-specific focus for ${options.aspectRatio}: ${coords.reasoning || 'AI-determined optimal crop'}`);
      this.log(`  Focus coordinates: x=${(safeCoords.x*100).toFixed(1)}%, y=${(safeCoords.y*100).toFixed(1)}%, w=${(safeCoords.width*100).toFixed(1)}%, h=${(safeCoords.height*100).toFixed(1)}%`);
      this.log(`  Zoom level: ${zoomLevel}x (confidence: ${(coords.confidence || 0.8)*100}%)`);
      
      return this.buildFocusFilterWithZoom(safeCoords, zoomLevel, options.aspectRatio);
    } catch (error) {
      this.log(`  Error building segment focus filter: ${error}. Using fallback.`);
      return this.getBasicAspectRatioFilter(options.aspectRatio);
    }
  }

  private getTargetScaleFilter(aspectRatio: string): string {
    switch (aspectRatio) {
      case '9:16':
        return 'scale=720:1280:force_original_aspect_ratio=increase,crop=720:1280:(ow-720)/2:(oh-1280)/2';
      case '1:1':
        return 'scale=720:720:force_original_aspect_ratio=increase,crop=720:720:(ow-720)/2:(oh-720)/2';
      case '4:3':
        return 'scale=960:720:force_original_aspect_ratio=increase,crop=960:720:(ow-960)/2:(oh-720)/2';
      default: // 16:9
        return 'scale=1280:720:force_original_aspect_ratio=increase,crop=1280:720:(ow-1280)/2:(oh-720)/2';
    }
  }

  private validateAndClampCoordinates(coords: any): { x: number, y: number, width: number, height: number } {
    // Validate and clamp coordinates to safe ranges
    const safeX = Math.max(0, Math.min(0.6, coords.x || 0.2));
    const safeY = Math.max(0, Math.min(0.6, coords.y || 0.2));  
    const safeWidth = Math.max(0.3, Math.min(0.8, coords.width || 0.6));
    const safeHeight = Math.max(0.3, Math.min(0.8, coords.height || 0.6));
    
    // Ensure crop area doesn't exceed bounds
    const maxX = Math.max(0, Math.min(1 - safeWidth, safeX));
    const maxY = Math.max(0, Math.min(1 - safeHeight, safeY));
    
    return { x: maxX, y: maxY, width: safeWidth, height: safeHeight };
  }

  private buildFocusFilterWithZoom(coords: { x: number, y: number, width: number, height: number }, zoomLevel: number, aspectRatio: string): string {
    // Apply zoom by adjusting the crop area size
    const zoomedWidth = coords.width / Math.max(0.5, Math.min(2.0, zoomLevel));
    const zoomedHeight = coords.height / Math.max(0.5, Math.min(2.0, zoomLevel));
    
    // Center the zoomed area around the original focus point
    const zoomedX = Math.max(0, Math.min(1 - zoomedWidth, coords.x - (zoomedWidth - coords.width) / 2));
    const zoomedY = Math.max(0, Math.min(1 - zoomedHeight, coords.y - (zoomedHeight - coords.height) / 2));
    
    // Apply intelligent crop with zoom, then scale to target aspect ratio
    const cropFilter = `crop=iw*${zoomedWidth}:ih*${zoomedHeight}:iw*${zoomedX}:ih*${zoomedY}`;
    const scaleFilter = this.getTargetScaleFilter(aspectRatio);
    
    return `${cropFilter},${scaleFilter}`;
  }

  private buildPositionBasedCrop(subjectPosition: string, aspectRatio: string): string {
    // Create intelligent crop based on subject positioning
    let x = 0.25, y = 0.15, width = 0.5, height = 0.7; // Default center crop
    
    switch (subjectPosition) {
      case 'left':
        x = 0.0; y = 0.15; width = 0.6; height = 0.7;
        this.log(`  Applied left-positioned subject crop`);
        break;
      case 'right':
        x = 0.4; y = 0.15; width = 0.6; height = 0.7;
        this.log(`  Applied right-positioned subject crop`);
        break;
      case 'center':
      default:
        x = 0.2; y = 0.15; width = 0.6; height = 0.7;
        this.log(`  Applied center-positioned subject crop`);
        break;
    }
    
    const cropFilter = `crop=iw*${width}:ih*${height}:iw*${x}:ih*${y}`;
    const scaleFilter = this.getTargetScaleFilter(aspectRatio);
    return `${cropFilter},${scaleFilter}`;
  }



  private repairJson(jsonContent: string): string {
    // Clean common JSON issues
    let cleaned = jsonContent
      .replace(/[\u0000-\u001F\u007F-\u009F]/g, '') // Remove control characters
      .replace(/,(\s*[}\]])/g, '$1') // Remove trailing commas
      .replace(/([{,]\s*)'([^']*)'(\s*:)/g, '$1"$2"$3') // Fix single quotes to double quotes for keys
      .replace(/:\s*'([^']*)'/g, ': "$1"') // Fix single quotes to double quotes for values
      .replace(/([{,]\s*)([a-zA-Z_][a-zA-Z0-9_]*)\s*:/g, '$1"$2":') // Quote unquoted property names
      .replace(/\n/g, ' ') // Replace newlines with spaces
      .replace(/\t/g, ' ') // Replace tabs with spaces
      .replace(/\s+/g, ' ') // Collapse multiple spaces
      .replace(/,\s*}/g, '}') // Remove trailing commas before closing braces
      .replace(/,\s*]/g, ']') // Remove trailing commas before closing brackets
      .trim();
    
    // Handle incomplete JSON structures
    const openBraces = (cleaned.match(/\{/g) || []).length;
    const closeBraces = (cleaned.match(/\}/g) || []).length;
    const openBrackets = (cleaned.match(/\[/g) || []).length;
    const closeBrackets = (cleaned.match(/\]/g) || []).length;
    
    // Add missing closing characters
    if (openBraces > closeBraces) {
      cleaned += '}'.repeat(openBraces - closeBraces);
    }
    if (openBrackets > closeBrackets) {
      cleaned += ']'.repeat(openBrackets - closeBrackets);
    }
    
    // Handle truncated strings by closing quotes
    const quotes = (cleaned.match(/"/g) || []).length;
    if (quotes % 2 !== 0) {
      cleaned += '"';
    }
    
    return cleaned;
  }

  private getBasicAspectRatioFilter(aspectRatio: string): string {
    switch (aspectRatio) {
      case '9:16':
        return 'scale=720:1280:force_original_aspect_ratio=increase,crop=720:1280:(ow-720)/2:(oh-1280)/2';
      case '1:1':
        return 'scale=720:720:force_original_aspect_ratio=increase,crop=720:720:(ow-720)/2:(oh-720)/2';
      case '4:3':
        return 'scale=960:720:force_original_aspect_ratio=increase,crop=960:720:(ow-960)/2:(oh-720)/2';
      default: // 16:9
        return 'scale=1280:720:force_original_aspect_ratio=increase,crop=1280:720:(ow-1280)/2:(oh-720)/2';
    }
  }

  private calculateIntelligentCrop(focusStrategy: any, aspectRatio: string): string {
    // Convert AI-determined focus coordinates to FFmpeg crop filter
    const targetAspect = aspectRatio === '9:16' ? 9/16 : aspectRatio === '16:9' ? 16/9 : 1;
    
    // Use AI-provided focus area as starting point
    const centerX = focusStrategy.x + (focusStrategy.width / 2);
    const centerY = focusStrategy.y + (focusStrategy.height / 2);
    
    // Calculate optimal crop dimensions based on target aspect ratio
    let cropWidth = focusStrategy.width;
    let cropHeight = focusStrategy.height;
    
    // Adjust to maintain aspect ratio while including focus area
    if (cropWidth / cropHeight > targetAspect) {
      cropHeight = cropWidth / targetAspect;
    } else {
      cropWidth = cropHeight * targetAspect;
    }
    
    // Ensure crop area stays within bounds and includes focus area
    cropWidth = Math.min(1.0, Math.max(0.3, cropWidth));
    cropHeight = Math.min(1.0, Math.max(0.3, cropHeight));
    
    const cropX = Math.max(0, Math.min(1 - cropWidth, centerX - cropWidth/2));
    const cropY = Math.max(0, Math.min(1 - cropHeight, centerY - cropHeight/2));
    
    // Convert to pixel coordinates (will be applied to actual video dimensions)
    return `crop=iw*${cropWidth}:ih*${cropHeight}:iw*${cropX}:ih*${cropY}`;
  }

  private getIntelligentAspectRatioFilter(aspectRatio: string, intervals: any[]): string {
    // Store current aspect ratio for coordinate calculation
    this.currentAspectRatio = aspectRatio;
    
    // Calculate average focus coordinates from all intervals, prioritizing aspect ratio specific ones
    const avgFocus = this.calculateAverageFocusCoordinates(intervals);
    
    this.log(`Using aspect ratio specific focus coordinates for ${aspectRatio}: x=${(avgFocus.x*100).toFixed(1)}%, y=${(avgFocus.y*100).toFixed(1)}%`);
    
    switch (aspectRatio) {
      case '9:16':
        return this.getFocusAwareCropFilter(720, 1280, avgFocus);
      case '1:1':
        return this.getFocusAwareCropFilter(720, 720, avgFocus);
      case '4:3':
        return this.getFocusAwareCropFilter(960, 720, avgFocus);
      default: // 16:9
        return this.getFocusAwareCropFilter(1280, 720, avgFocus);
    }
  }

  private calculateAverageFocusCoordinates(intervals: any[]): { x: number, y: number, width: number, height: number } {
    if (!intervals || intervals.length === 0) {
      return { x: 0.5, y: 0.5, width: 0.8, height: 0.8 };
    }

    let totalX = 0, totalY = 0, totalWidth = 0, totalHeight = 0;
    let validIntervals = 0;

    intervals.forEach(interval => {
      // Try to use aspect ratio specific coordinates first, then fall back to general coordinates
      const coords = interval.focusStrategy?.aspectRatioCoordinates?.[this.currentAspectRatio] || 
                     interval.focusStrategy?.coordinates;
      
      if (coords) {
        totalX += coords.x || 0.5;
        totalY += coords.y || 0.5;
        totalWidth += coords.width || 0.8;
        totalHeight += coords.height || 0.8;
        validIntervals++;
      }
    });

    if (validIntervals === 0) {
      return { x: 0.5, y: 0.5, width: 0.8, height: 0.8 };
    }

    return {
      x: totalX / validIntervals,
      y: totalY / validIntervals,
      width: totalWidth / validIntervals,
      height: totalHeight / validIntervals
    };
  }

  private getFocusAwareCropFilter(targetWidth: number, targetHeight: number, focus: { x: number, y: number, width: number, height: number }): string {
    this.log(`Applying focus-aware crop: center at (${(focus.x * 100).toFixed(1)}%, ${(focus.y * 100).toFixed(1)}%) with ${(focus.width * 100).toFixed(1)}x${(focus.height * 100).toFixed(1)}% area`);
    
    // Scale to fit target aspect ratio while preserving focus area
    const scaleFilter = `scale=${targetWidth}:${targetHeight}:force_original_aspect_ratio=increase`;
    
    // Calculate crop position based on focus coordinates
    const cropX = `(ow-${targetWidth})*${focus.x}`;
    const cropY = `(oh-${targetHeight})*${focus.y}`;
    const cropFilter = `crop=${targetWidth}:${targetHeight}:${cropX}:${cropY}`;
    
    return `${scaleFilter},${cropFilter}`;
  }

  private getAspectRatioFilter(aspectRatio: string): string {
    switch (aspectRatio) {
      case '9:16':
        return 'scale=1080:1920:force_original_aspect_ratio=increase,crop=1080:1920';
      case '16:9':
        return 'scale=1920:1080:force_original_aspect_ratio=increase,crop=1920:1080';
      case '1:1':
        return 'scale=1080:1080:force_original_aspect_ratio=increase,crop=1080:1080';
      default:
        return 'scale=1080:1920:force_original_aspect_ratio=increase,crop=1080:1920';
    }
  }
}

export const createEnhancedAIShortsGenerator = (apiKey: string): EnhancedAIShortsGenerator => {
  return new EnhancedAIShortsGenerator(apiKey);
};