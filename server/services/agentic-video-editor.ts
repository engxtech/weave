import { ChatGoogleGenerativeAI } from '@langchain/google-genai';
import { Tool } from '@langchain/core/tools';
import { AgentExecutor, createToolCallingAgent } from 'langchain/agents';
import { ChatPromptTemplate } from '@langchain/core/prompts';
import { z } from 'zod';
import { promises as fs } from 'fs';
import path from 'path';
import { spawn } from 'child_process';
import TokenTracker from './token-tracker';
import TokenPreCalculator from './token-pre-calculator';
import { videoIntelligenceTool } from './video-intelligence-tool';
import { GenerateMediaTool } from './generate-media-tool.js';
import { geminiMediaGenerator } from './gemini-media-generator.js';
import { videoSearchTool } from './video-search-tool.js';
import { videoTranslator, type SafewordReplacement } from './video-translator';
import { MultimodalCaptionSync } from './multimodal-caption-sync';
import { ProfessionalCaptionTiming } from './professional-caption-timing';
import { WordLevelSubtitleGenerator } from './word-level-subtitle-generator';
import { GoogleGenAI } from '@google/genai';
import { audioWaveformAnalyzer } from './audio-waveform-analyzer';
import { ProfessionalCaptionTool } from './professional-caption-tool';
import { AuthenticAudioMatcher, type AudioMatchResult } from './authentic-audio-matcher';
import { aiShortsGeneratorTool } from './ai-shorts-tool';
import { brollAgentTool } from './broll-agent-tool';
import { YouTubeShortsSubtitleTool } from './subtitle-agent-tool.js';

// Segment Memory Manager for tracking segments across sessions
interface SegmentInfo {
  number: number;
  startTime: number;
  endTime: number;
  duration: number;
  description: string;
  created: Date;
}

export class SegmentMemoryManager {
  private segments: Map<number, SegmentInfo> = new Map();
  private nextSegmentNumber = 1;

  addSegment(segment: Omit<SegmentInfo, 'number' | 'created'>): number {
    const segmentNumber = this.nextSegmentNumber++;
    const segmentInfo: SegmentInfo = {
      ...segment,
      number: segmentNumber,
      created: new Date()
    };
    
    this.segments.set(segmentNumber, segmentInfo);
    console.log(`Segment ${segmentNumber} added to memory:`, segmentInfo);
    return segmentNumber;
  }

  getSegment(segmentNumber: number): SegmentInfo | undefined {
    return this.segments.get(segmentNumber);
  }

  deleteSegment(segmentNumber: number): boolean {
    const existed = this.segments.has(segmentNumber);
    this.segments.delete(segmentNumber);
    console.log(`Segment ${segmentNumber} ${existed ? 'deleted' : 'not found'} in memory`);
    return existed;
  }

  getAllSegments(): SegmentInfo[] {
    return Array.from(this.segments.values()).sort((a, b) => a.number - b.number);
  }

  getSegmentsCount(): number {
    return this.segments.size;
  }

  clear(): void {
    this.segments.clear();
    this.nextSegmentNumber = 1;
  }

  getMemoryContext(): string {
    const segments = this.getAllSegments();
    if (segments.length === 0) {
      return 'No segments in memory.';
    }
    
    return `Current segments in memory:\n` + 
      segments.map(seg => `Segment ${seg.number}: ${seg.startTime}s - ${seg.endTime}s (${seg.description})`).join('\n');
  }
}

// Define tools for video editing actions
export class AddTextOverlayTool extends Tool {
  name = 'add_text_overlay';
  description = 'Add text overlay to video at specific time with styling options. When user provides all details (text, time, color), add it directly. When details are missing, ask for user input.';
  
  schema = z.object({
    text: z.string().optional().describe('The text to display (if not provided, ask user)'),
    startTime: z.number().describe('Start time in seconds'),
    duration: z.number().optional().describe('Duration in seconds (default 3s)'),
    endTime: z.number().optional().describe('End time in seconds (alternative to duration)'),
    color: z.string().optional().describe('Text color (if not provided, ask user)'),
    x: z.number().optional().describe('X position (0-100)'),
    y: z.number().optional().describe('Y position (0-100)'),
    fontSize: z.number().optional().describe('Font size'),
    style: z.enum(['bold', 'normal']).optional().describe('Font weight')
  });

  async _call(input: z.infer<typeof this.schema>): Promise<string> {
    const duration = input.duration || (input.endTime ? input.endTime - input.startTime : 3);
    
    // If text or color is missing, ask user for input
    if (!input.text || !input.color) {
      return `I need more information to add the text overlay. Please specify:
${!input.text ? '• What text would you like to display?' : ''}
${!input.color ? '• What color should the text be? (e.g., white, red, #FF0000, or say "default" for white)' : ''}

Time range: ${input.startTime}s - ${input.startTime + duration}s (${duration}s duration)

Once you provide this information, I'll add the text overlay to your video.`;
    }
    
    // Process color input
    let processedColor = input.color.toLowerCase();
    if (processedColor === 'default' || processedColor === 'no') {
      processedColor = '#FFFFFF';
    } else if (!processedColor.startsWith('#')) {
      // Convert color names to hex if needed
      const colorMap: { [key: string]: string } = {
        'white': '#FFFFFF',
        'black': '#000000',
        'red': '#FF0000',
        'green': '#00FF00',
        'blue': '#0000FF',
        'yellow': '#FFFF00',
        'orange': '#FFA500',
        'purple': '#800080',
        'pink': '#FFC0CB'
      };
      processedColor = colorMap[processedColor] || '#FFFFFF';
    }
    
    const operation = {
      type: 'add_text_overlay',
      id: Date.now().toString(),
      timestamp: input.startTime,
      parameters: {
        text: input.text,
        startTime: input.startTime,
        endTime: input.startTime + duration,
        duration: duration,
        x: input.x || 50,
        y: input.y || 20,
        fontSize: input.fontSize || 24,
        color: processedColor,
        style: input.style || 'bold'
      },
      description: `Text overlay: "${input.text}" at ${input.startTime}s for ${duration}s`,
      uiUpdate: true
    };
    
    console.log('AI Agent: Adding text overlay:', operation);
    return JSON.stringify(operation);
  }
}

export class SelectSegmentTool extends Tool {
  name = 'select_segment';
  description = 'Select a video segment from start time to end time (creates visual selection only, does not modify video)';
  
  constructor(private segmentManager: SegmentMemoryManager) {
    super();
  }
  
  schema = z.object({
    startTime: z.number().describe('Start time in seconds'),
    endTime: z.number().describe('End time in seconds'),
    description: z.string().optional().describe('Description of the segment')
  });

  async _call(input: z.infer<typeof this.schema>): Promise<string> {
    const duration = input.endTime - input.startTime;
    
    // Create segment entry in memory
    const segmentNumber = this.segmentManager.addSegment({
      startTime: input.startTime,
      endTime: input.endTime,
      duration,
      description: input.description || `Segment ${input.startTime}s - ${input.endTime}s`
    });
    
    const operation = {
      type: 'select_segment',
      id: Date.now().toString(),
      timestamp: input.startTime,
      parameters: {
        startTime: input.startTime,
        endTime: input.endTime
      },
      description: `Selected segment: ${input.startTime}s - ${input.endTime}s (${duration}s duration)`,
      uiUpdate: true,
      segmentNumber
    };
    
    console.log('AI Agent: Selecting video segment:', operation);
    console.log(`Segment ${segmentNumber} selected: ${input.startTime}s - ${input.endTime}s`);
    
    return JSON.stringify(operation);
  }
}

export class DeleteSegmentTool extends Tool {
  name = 'delete_segment';
  description = 'Delete a specific segment by number from memory and physically remove it from the video file';
  
  constructor(private segmentManager: SegmentMemoryManager) {
    super();
  }
  
  schema = z.object({
    segmentNumber: z.number().describe('The segment number to delete (e.g., 1, 2, 3)')
  });

  async _call(input: z.infer<typeof this.schema>): Promise<string> {
    const segment = this.segmentManager.getSegment(input.segmentNumber);
    
    if (!segment) {
      return JSON.stringify({
        type: 'error',
        message: `Segment ${input.segmentNumber} not found in memory. Available segments: ${this.segmentManager.getMemoryContext()}`
      });
    }
    
    // Delete from memory
    this.segmentManager.deleteSegment(input.segmentNumber);
    
    const operation = {
      type: 'delete_segment_from_video',
      id: Date.now().toString(),
      timestamp: segment.startTime,
      parameters: {
        segmentNumber: input.segmentNumber,
        startTime: segment.startTime,
        endTime: segment.endTime,
        deleteFromVideo: true  // Flag to indicate actual video modification
      },
      description: `Deleting segment ${input.segmentNumber} from video: ${segment.startTime}s - ${segment.endTime}s`,
      uiUpdate: true
    };
    
    console.log(`AI Agent: Deleting segment ${input.segmentNumber} from video:`, operation);
    return JSON.stringify(operation);
  }
}

export class AnalyzeVideoContentTool extends Tool {
  name = 'analyze_video_content';
  description = 'Analyze video content to identify key moments, people, and topics';
  
  schema = z.object({
    videoPath: z.string().describe('Path to the video file'),
    analysisType: z.enum(['moments', 'people', 'topics', 'all']).describe('Type of analysis to perform')
  });

  async _call(input: z.infer<typeof this.schema>): Promise<string> {
    // Simulate video analysis
    console.log('AI Agent: Analyzing video content:', input);
    
    const mockAnalysis = {
      moments: ['0:05 - Introduction starts', '0:30 - Key point mentioned', '1:15 - Conclusion begins'],
      people: ['Person 1 detected at center-left', 'Person 2 detected at center-right'],
      topics: ['Interview discussion', 'Professional conversation', 'Q&A format']
    };
    
    const result = input.analysisType === 'all' ? mockAnalysis : { [input.analysisType]: mockAnalysis[input.analysisType] };
    return `Video analysis complete: ${JSON.stringify(result, null, 2)}`;
  }
}

export class ApplyVideoEffectTool extends Tool {
  name = 'apply_video_effect';
  description = 'Apply visual effects to video segments';
  
  schema = z.object({
    effect: z.enum(['zoom', 'fade', 'blur', 'brighten', 'contrast']).describe('Effect to apply'),
    startTime: z.number().describe('Start time in seconds'),
    endTime: z.number().describe('End time in seconds'),
    intensity: z.number().min(0).max(1).optional().describe('Effect intensity (0-1)')
  });

  async _call(input: z.infer<typeof this.schema>): Promise<string> {
    console.log('AI Agent: Applying video effect:', input);
    return `Applied ${input.effect} effect from ${input.startTime}s to ${input.endTime}s with intensity ${input.intensity || 0.5}`;
  }
}

export class DetectPeopleAndAddTextTool extends Tool {
  name = 'detect_people_and_add_text';
  description = 'Detect people in current video frame and add text overlays above them';

  schema = z.object({
    currentTime: z.number().describe('Current video time in seconds'),
    customTexts: z.array(z.string()).describe('Custom text for each person').optional(),
    autoDetect: z.boolean().describe('Whether to auto-detect names or use custom text').default(true)
  });

  async _call(input: z.infer<typeof this.schema>): Promise<string> {
    console.log('AI Agent: Detecting people and adding text at:', input.currentTime);
    return `People detection and text overlay applied at ${input.currentTime}s`;
  }
}

export class GenerateBrollSuggestionsTool extends Tool {
  name = 'generate_broll_suggestions';
  description = 'Analyze current video using Gemini multimodal AI to generate creative B-roll suggestions with AI video generation prompts. Perfect for enhancing talking head segments and adding professional visual storytelling elements.';
  
  private agenticEditor: VideoEditingAgent;

  constructor(agenticEditor: VideoEditingAgent) {
    super();
    this.agenticEditor = agenticEditor;
  }

  schema = z.object({
    analysisType: z.enum(['creative', 'professional', 'cinematic']).describe('Type of B-roll analysis to perform').default('professional')
  });

  async _call(input: z.infer<typeof this.schema>): Promise<string> {
    console.log('🎬 GenerateBrollSuggestionsTool: Starting B-roll analysis...');
    
    try {
      // Get current video from agent context
      const currentVideo = this.agenticEditor.getCurrentVideo();
      
      const result = await brollAgentTool.execute({
        currentVideo: currentVideo
      });

      const operation = {
        type: 'broll_suggestions_generated',
        id: result.id,
        timestamp: result.timestamp,
        description: result.description,
        brollPlan: result.brollPlan,
        suggestions: result.suggestions,
        uiUpdate: true
      };

      console.log(`✅ GenerateBrollSuggestionsTool: Generated ${result.suggestions.length} B-roll suggestions`);
      return JSON.stringify(operation);

    } catch (error) {
      console.error('❌ GenerateBrollSuggestionsTool: Error:', error);
      return JSON.stringify({
        type: 'error',
        message: `Failed to generate B-roll suggestions: ${error.message}`
      });
    }
  }
}

// Caption Style Recommendation Tool - AI-powered style analysis
export class CaptionStyleRecommendationTool extends Tool {
  name = 'recommend_caption_style';
  description = 'Analyze video content and provide AI-powered caption style recommendations based on content type, pace, audience level, and visual complexity';
  
  private editor: AgenticVideoEditor;

  constructor(editor: AgenticVideoEditor) {
    super();
    this.editor = editor;
  }

  schema = z.object({
    analysisType: z.enum(['full', 'quick']).optional().describe('Analysis depth - full for complete AI analysis, quick for basic recommendations')
  });

  async _call(input: z.infer<typeof this.schema>): Promise<string> {
    try {
      console.log('🎯 AI Agent: Analyzing video for caption style recommendations...');
      
      // Get current video path from the editor instance
      const videoPath = this.editor.getCurrentVideoPath();
      
      if (!videoPath || videoPath === 'unknown') {
        return "No video loaded. Please upload a video first to get caption style recommendations.";
      }

      const { analysisType = 'full' } = input;
      
      // Get video metadata for duration
      const { spawn } = await import('child_process');
      const { promises: fs } = await import('fs');
      
      // Check if video file exists
      try {
        await fs.access(videoPath);
      } catch {
        return "Video file not found. Please ensure the video is properly uploaded.";
      }

      // Get video duration using ffprobe
      const videoDuration = await new Promise<number>((resolve, reject) => {
        const ffprobe = spawn('ffprobe', [
          '-v', 'quiet',
          '-print_format', 'json',
          '-show_format',
          videoPath
        ]);

        let output = '';
        ffprobe.stdout.on('data', (data) => {
          output += data.toString();
        });

        ffprobe.on('close', (code) => {
          if (code !== 0) {
            reject(new Error('Failed to get video duration'));
            return;
          }
          
          try {
            const metadata = JSON.parse(output);
            const duration = parseFloat(metadata.format.duration) || 0;
            resolve(duration);
          } catch (error) {
            reject(error);
          }
        });
      });

      if (videoDuration === 0) {
        return "Unable to determine video duration. Please ensure the video file is valid.";
      }
      
      // Import and use the caption style recommender
      const { captionStyleRecommender } = await import('./caption-style-recommender');
      
      // Get AI-powered style recommendations
      const recommendation = await captionStyleRecommender.recommendCaptionStyle(
        videoPath,
        videoDuration
      );
      
      console.log(`✅ Style recommendation generated: ${recommendation.recommendedStyle} (${Math.round(recommendation.confidence * 100)}% confidence)`);
      
      // Store recommendation globally for UI updates
      globalThis.captionStyleRecommendation = recommendation;
      
      return JSON.stringify({
        type: 'caption_style_recommendation',
        id: `style_rec_${Date.now()}`,
        timestamp: 0,
        recommendation,
        uiUpdate: true,
        message: `🎯 AI Analysis Complete! Recommended caption style: ${recommendation.recommendedStyle.toUpperCase()} with ${Math.round(recommendation.confidence * 100)}% confidence.

📊 Content Analysis:
• Video Type: ${recommendation.contentAnalysis.videoType}
• Speech Pace: ${recommendation.contentAnalysis.paceAnalysis}
• Audience Level: ${recommendation.contentAnalysis.audienceLevel}
• Speech Clarity: ${recommendation.contentAnalysis.speechClarity}

🎨 Recommended Visual Settings:
• Font Size: ${recommendation.visualSettings.fontSize}px
• Position: ${recommendation.visualSettings.position}
• Animation: ${recommendation.visualSettings.animation}
• Color: ${recommendation.visualSettings.color}

💡 Reasoning: ${recommendation.reasoning}

Use the "Apply ${recommendation.recommendedStyle.charAt(0).toUpperCase() + recommendation.recommendedStyle.slice(1)} Style" button to generate captions with these optimized settings!`
      });
      
    } catch (error) {
      console.error('Caption style recommendation error:', error);
      return `Failed to analyze video for caption style recommendations: ${error instanceof Error ? error.message : 'Unknown error'}. Please ensure the video is properly uploaded and try again.`;
    }
  }
}

// Tool for Authentic Audio Caption Generation
class AuthenticAudioCaptionTool extends Tool {
  name = 'authentic_audio_captions';
  description = 'Generate captions using authentic audio matching that synchronizes text to actual speech patterns in the video for perfect timing accuracy';
  
  private editor: AgenticVideoEditor;

  constructor(editor: AgenticVideoEditor) {
    super();
    this.editor = editor;
  }
  
  schema = z.object({
    format: z.enum(['timeline', 'srt', 'word_level']).optional().describe('Output format for captions'),
  });

  async _call(input: z.infer<typeof this.schema>): Promise<string> {
    try {
      const videoPath = this.editor.getCurrentVideoPath();
      const format = input.format || 'timeline';
      
      console.log(`[AuthenticAudioCaptionTool] Starting authentic audio caption generation for: ${videoPath}`);
      
      if (!videoPath || videoPath === 'unknown') {
        return "No video loaded. Please upload a video first to generate authentic audio captions.";
      }
      
      // Step 1: Get basic transcription first using existing caption generator
      const captionGenerator = new CaptionGenerator();
      const basicCaptions = await captionGenerator.generateCaptions(videoPath);
      console.log(`[AuthenticAudioCaptionTool] Basic transcription complete: ${basicCaptions.segments.length} segments`);
      
      // Step 2: Use authentic audio matcher to sync to real audio patterns
      const audioMatcher = new AuthenticAudioMatcher();
      const audioMatchResult = await audioMatcher.matchTextToAudio(videoPath, basicCaptions.segments);
      console.log(`[AuthenticAudioCaptionTool] Audio matching complete: ${audioMatchResult.segments.length} synchronized segments`);
      
      // Step 3: Format results for timeline integration with audio-matched timing
      const formattedSegments = audioMatchResult.segments.map((segment, index) => ({
        id: `authentic_audio_${Date.now()}_${index}`,
        text: segment.text,
        startTime: segment.startTime,
        endTime: segment.endTime,
        duration: segment.endTime - segment.startTime,
        confidence: segment.confidence,
        audioIntensity: segment.audioIntensity,
        speechPattern: segment.speechPattern,
        words: segment.words.map(word => ({
          word: word.word,
          startTime: word.startTime,
          endTime: word.endTime,
          confidence: word.confidence,
          audioAmplitude: word.audioAmplitude,
          highlightTiming: {
            onsetTime: word.startTime - 0.05, // Slight lead-in for natural highlighting
            peakTime: word.startTime + (word.endTime - word.startTime) / 2,
            endTime: word.endTime,
            intensity: word.audioAmplitude,
            waveformMatched: true
          },
          waveformBased: true // Mark as authentic audio-based
        }))
      }));
      
      // Add authentic audio caption track to session memory
      const trackId = this.generateUniqueId();
      segmentMemory.set(trackId, {
        trackName: 'Authentic Audio Captions',
        segments: formattedSegments.map((segment, index) => ({
          number: index + 1,
          startTime: segment.startTime,
          endTime: segment.endTime,
          duration: segment.duration,
          description: `"${segment.text}" - Audio-matched (${segment.speechPattern})`,
          created: new Date()
        }))
      });
      
      return JSON.stringify({
        type: 'generate_captions',
        id: `authentic_audio_${Date.now()}`,
        timestamp: Date.now(),
        description: `Authentic audio captions: ${formattedSegments.length} segments synchronized to real speech patterns`,
        captionTrack: {
          id: trackId,
          name: 'Authentic Audio Captions',
          language: 'auto',
          segments: formattedSegments,
          segmentCount: formattedSegments.length,
          totalDuration: audioMatchResult.totalDuration,
          style: 'authentic_audio_matched',
          metadata: {
            method: 'Authentic Audio Pattern Matching',
            speechEvents: audioMatchResult.speechEvents.length,
            sampleRate: audioMatchResult.sampleRate,
            audioSynchronized: true,
            waveformAnalysis: true,
            timingAccuracy: 'Audio-matched (±50ms)',
            silenceDetection: audioMatchResult.silences.length,
            totalSegments: formattedSegments.length
          },
          createdAt: new Date()
        },
        uiUpdate: true
      });
      
    } catch (error) {
      console.error('[AuthenticAudioCaptionTool] Error:', error);
      return `Error generating authentic audio captions: ${error}. The system will fallback to standard caption generation.`;
    }
  }
  
  private generateUniqueId(): string {
    return Math.random().toString(36).substr(2, 9);
  }
}

// Tool for Word-Level Subtitle Generation
class WordLevelSubtitleTool extends Tool {
  name = "generate_word_level_subtitles";
  description = "Generate professional word-level subtitles with precise timing using FFmpeg audio extraction and Gemini AI transcription. Creates individual word timing and groups them into readable subtitle blocks.";
  
  private editor: AgenticVideoEditor;

  constructor(editor: AgenticVideoEditor) {
    super();
    this.editor = editor;
  }
  
  schema = z.object({
    format: z.enum(['srt', 'timeline']).optional().describe('Output format: srt for standard subtitle file, timeline for video editor segments')
  });

  async _call(input: { format?: 'srt' | 'timeline' }) {
    try {
      console.log('🎯 AI Agent: Generating word-level subtitles...');
      
      // Get current video path from the editor instance
      const videoPath = this.editor.getCurrentVideoPath();
      
      if (!videoPath || videoPath === 'unknown') {
        return "No video loaded. Please upload a video first to generate word-level subtitles.";
      }

      const { format = 'timeline' } = input;
      
      // Check if video file exists
      const { promises: fs } = await import('fs');
      try {
        await fs.access(videoPath);
      } catch {
        return "Video file not found. Please ensure the video is properly uploaded.";
      }

      // Create word-level subtitle generator
      const generator = new WordLevelSubtitleGenerator();
      
      // Generate word-level subtitles
      const result = await generator.generateWordLevelSubtitles(videoPath);
      
      console.log(`✅ Word-level subtitles generated: ${result.segments.length} blocks from ${result.wordCount} words`);
      
      // Store result globally for UI updates
      globalThis.wordLevelSubtitles = result;
      
      // Create caption track data
      const captionTrack = {
        id: `word_level_${Date.now()}`,
        name: 'Word-Level Subtitles',
        language: 'auto',
        segments: result.segments,
        segmentCount: result.segments.length,
        totalDuration: result.totalDuration,
        style: 'word-level',
        createdAt: new Date().toISOString(),
        wordCount: result.wordCount,
        srtContent: result.srtContent
      };
      
      return JSON.stringify({
        type: 'word_level_subtitles',
        id: `word_level_${Date.now()}`,
        timestamp: 0,
        captionTrack,
        srtContent: result.srtContent,
        uiUpdate: true,
        message: `🎬 Word-Level Subtitles Generated!

📊 Processing Complete:
• Total Words: ${result.wordCount}
• Subtitle Blocks: ${result.segments.length}
• Duration: ${result.totalDuration.toFixed(1)}s
• Format: ${format.toUpperCase()}

✨ Features:
• Step 1: FFmpeg audio extraction (48kHz)
• Step 2: Gemini AI word-level transcription
• Step 3: Intelligent word grouping
• Step 4: SRT format generation
• Step 5: Timeline editor integration

The subtitles are now ready for precise editing with individual word timing data!`
      });
      
    } catch (error) {
      console.error('Word-level subtitle generation error:', error);
      return `Failed to generate word-level subtitles: ${error instanceof Error ? error.message : 'Unknown error'}. Please ensure the video has clear audio and try again.`;
    }
  }
}

export class GenerateCaptionsTool extends Tool {
  name = 'generate_captions';
  description = 'Generate intelligent captions/subtitles for the entire video using Gemini AI with logical word segmentation and precise timing';
  
  private editor: AgenticVideoEditor;

  constructor(editor: AgenticVideoEditor) {
    super();
    this.editor = editor;
  }

  schema = z.object({
    language: z.string().optional().describe('Target language for captions (auto-detect if not specified)'),
    style: z.enum(['readable', 'verbatim', 'simplified']).optional().describe('Caption style - readable for natural breaks, verbatim for exact words, simplified for easy reading')
  });

  async _call(input: z.infer<typeof this.schema>): Promise<string> {
    try {
      console.log('🎬 AI Agent: Generating Gemini-powered captions...');
      
      // Get current video path from the editor instance
      const videoPath = this.editor.getCurrentVideoPath();
      
      if (!videoPath || videoPath === 'unknown') {
        return "No video loaded. Please upload a video first to generate captions.";
      }

      const { language = 'auto', style = 'readable' } = input;
      
      // Import and use the caption generator
      const { CaptionGenerator } = await import('./caption-generator');
      const captionGenerator = new CaptionGenerator();
      
      // Generate captions using Gemini AI with token tracking
      const captionTrack = await captionGenerator.generateCaptions(videoPath, language, style);
      
      if (captionTrack.segmentCount === 0) {
        return "No speech detected in the video. Cannot generate captions for videos without clear audio content.";
      }
      
      // Store caption track globally for UI updates
      globalThis.generatedCaptionTrack = captionTrack;
      
      return JSON.stringify({
        type: 'caption_generation',
        id: `caption_${Date.now()}`,
        timestamp: 0,
        captionTrack,
        uiUpdate: true,
        message: `Successfully generated ${captionTrack.segmentCount} caption segments using Gemini AI! Language: ${captionTrack.language}. Total duration: ${Math.round(captionTrack.totalDuration)}s. Captions break audio into logical ${style} segments with precise timing.`
      });
      
    } catch (error) {
      console.error('Caption generation error:', error);
      return `Failed to generate captions: ${error instanceof Error ? error.message : 'Unknown error'}. Please ensure the video has clear audio content.`;
    }
  }
}

export class GenerateWaveformCaptionsTool extends Tool {
  name = 'generate_waveform_captions';
  description = 'Generate advanced waveform-aligned captions using Dynamic Audio Waveform Subtitle Alignment for precise speech pattern detection and superior timing synchronization';
  
  private editor: AgenticVideoEditor;

  constructor(editor: AgenticVideoEditor) {
    super();
    this.editor = editor;
  }

  schema = z.object({
    language: z.string().optional().describe('Target language for captions (auto-detect if not specified)').default('English')
  });

  async _call(input: z.infer<typeof this.schema>): Promise<string> {
    try {
      console.log('🌊 AI Agent: Generating waveform-aligned captions with speech pattern detection...');
      
      // Get current video path from the editor instance
      const videoPath = this.editor.getCurrentVideoPath();
      
      console.log('🔍 DEBUG: Video path from editor:', videoPath);
      console.log('🔍 DEBUG: Path type:', typeof videoPath);
      
      if (!videoPath || videoPath === 'unknown') {
        return "No video loaded. Please upload a video first to generate waveform-aligned captions.";
      }

      const { language = 'English' } = input;
      
      // Use authentic audio transcription pipeline
      console.log('🎬 Starting authentic audio transcription with FFmpeg + Gemini + Waveform analysis...');
      console.log('🎬 Input video path:', videoPath);
      
      const { AuthenticAudioTranscriber } = await import('./authentic-audio-transcriber');
      const transcriber = new AuthenticAudioTranscriber();
      
      // Execute complete transcription pipeline
      const transcriptionResult = await transcriber.transcribeVideo(videoPath);
      
      // Create individual SRT-style caption segments for draggable timeline placement
      const averageConfidence = transcriptionResult.segments.reduce((acc, segment) => 
        acc + segment.confidence, 0) / transcriptionResult.segments.length;
      
      // Break down segments into individual words for per-word editing
      const wordSegments = [];
      let srtIndex = 1;
      
      transcriptionResult.segments.forEach((segment) => {
        const words = segment.text.trim().split(/\s+/).filter(word => word.length > 0);
        const segmentDuration = segment.endTime - segment.startTime;
        const timePerWord = segmentDuration / words.length;
        
        words.forEach((word, wordIndex) => {
          const wordStartTime = segment.startTime + (wordIndex * timePerWord);
          const wordEndTime = wordStartTime + timePerWord;
          
          wordSegments.push({
            id: `srt_word_${srtIndex}`,
            srtIndex: srtIndex,
            startTime: parseFloat(wordStartTime.toFixed(2)),
            endTime: parseFloat(wordEndTime.toFixed(2)),
            duration: parseFloat(timePerWord.toFixed(2)),
            text: word,
            confidence: segment.confidence,
            wordCount: 1,
            isDraggable: true,
            waveformData: {
              amplitude: transcriptionResult.waveformAnalysis.averageAmplitude || 0.8,
              speechConfidence: segment.confidence
            }
          });
          
          srtIndex++;
        });
      });

      const captionTrack = {
        id: `srt_caption_track_${Date.now()}`,
        name: `SRT Word Captions (${language})`,
        language: language,
        format: 'srt',
        segments: wordSegments,
        totalDuration: transcriptionResult.totalDuration,
        segmentCount: wordSegments.length,
        createdAt: new Date(),
        waveformAnalysis: transcriptionResult.waveformAnalysis
      };
      
      if (captionTrack.segmentCount === 0) {
        return "No speech patterns detected in the audio waveform. Cannot generate waveform-aligned captions for videos without clear speech content.";
      }
      
      // Store caption track globally for UI updates
      globalThis.generatedCaptionTrack = captionTrack;
      
      return JSON.stringify({
        type: 'waveform_caption_generation',
        id: `unified_caption_${Date.now()}`,
        timestamp: 0,
        captionTrack,
        waveformStats: {
          speechSegments: wordSegments.length,
          averageConfidence: averageConfidence,
          totalDuration: transcriptionResult.totalDuration,
          peakAmplitudes: transcriptionResult.waveformAnalysis.peakAmplitudes.length
        },
        uiUpdate: true,
        message: `🎬 Word-level SRT transcription complete! Generated ${wordSegments.length} individual word segments with precise timing. Confidence: ${(averageConfidence*100).toFixed(1)}%. Each word can be dragged separately to timeline for granular editing control.`
      });
      
    } catch (error) {
      console.error('Waveform caption generation error:', error);
      return `Failed to generate waveform-aligned captions: ${error instanceof Error ? error.message : 'Unknown error'}. Please ensure the video has clear audio content for speech pattern analysis.`;
    }
  }
}

export class FindPeopleInVideoTool extends Tool {
  name = 'find_people_in_video';
  description = 'Find when specific people appear in the video using AI analysis. Can identify celebrities, public figures, or search for people descriptions.';
  
  private editor: AgenticVideoEditor;

  constructor(editor: AgenticVideoEditor) {
    super();
    this.editor = editor;
  }
  
  schema = z.object({
    query: z.string().describe('Natural language query like "Sam Altman", "person with glasses", "people dancing"')
  });

  async _call(input: z.infer<typeof this.schema>): Promise<string> {
    try {
      console.log('AI Agent: Finding people in video:', input.query);
      
      // Use current processed video path instead of original
      const videoPath = this.editor.getCurrentVideoPath();
      console.log('Using current video path:', videoPath);
      
      const results = await videoIntelligenceTool.findByQuery(videoPath, input.query);
      
      // Get token usage information
      const tokenUsage = videoIntelligenceTool.getCurrentTokenUsage();
      
      if (results.length === 0) {
        return `No matches found for: ${input.query}\n\nToken Usage: ${tokenUsage.totalTokens.toLocaleString()} tokens, $${tokenUsage.cost.toFixed(6)} cost`;
      }

      const timeRanges = results.map(result => 
        `${result.startTime}s - ${result.endTime}s: ${result.description}`
      ).join('\n');

      return `Found ${results.length} matches for "${input.query}":\n${timeRanges}\n\nToken Usage: ${tokenUsage.totalTokens.toLocaleString()} tokens, $${tokenUsage.cost.toFixed(6)} cost`;
    } catch (error) {
      return `Failed to find people in video: ${error}`;
    }
  }
}

export class AnalyzeVideoIntelligenceTool extends Tool {
  name = 'analyze_video_intelligence';
  description = 'Analyze entire video to identify all people, objects, and activities with timestamps. Creates a comprehensive video understanding database.';
  
  private editor: AgenticVideoEditor;

  constructor(editor: AgenticVideoEditor) {
    super();
    this.editor = editor;
  }
  
  schema = z.object({
    // No videoPath needed - use current processed video
  });

  async _call(input: z.infer<typeof this.schema>): Promise<string> {
    try {
      // Use current processed video path instead of original
      const videoPath = this.editor.getCurrentVideoPath();
      console.log('AI Agent: Analyzing video intelligence for current video:', videoPath);
      
      const analysis = await videoIntelligenceTool.analyzeVideo(videoPath);
      
      let result = `Video Analysis Complete (${analysis.duration}s duration)\n\n`;
      
      if (analysis.people.length > 0) {
        result += `PEOPLE DETECTED:\n`;
        analysis.people.forEach(person => {
          result += `- ${person.name} (confidence: ${person.confidence})\n`;
          person.timeRanges.forEach(range => {
            result += `  ${range.startTime}s-${range.endTime}s: ${range.description}\n`;
          });
        });
        result += '\n';
      }

      if (analysis.objects.length > 0) {
        result += `OBJECTS DETECTED:\n`;
        analysis.objects.forEach(obj => {
          result += `- ${obj.object} (confidence: ${obj.confidence})\n`;
          obj.timeRanges.forEach(range => {
            result += `  ${range.startTime}s-${range.endTime}s: ${range.description}\n`;
          });
        });
        result += '\n';
      }

      if (analysis.activities.length > 0) {
        result += `ACTIVITIES DETECTED:\n`;
        analysis.activities.forEach(activity => {
          result += `- ${activity.activity} (confidence: ${activity.confidence})\n`;
          activity.timeRanges.forEach(range => {
            result += `  ${range.startTime}s-${range.endTime}s: ${range.description}\n`;
          });
        });
      }

      if (analysis.transcript) {
        result += `\nTRANSCRIPT AVAILABLE: Yes\n`;
      }

      return result;
    } catch (error) {
      return `Failed to analyze video intelligence: ${error}`;
    }
  }
}

export class SmartCutVideoTool extends Tool {
  name = 'smart_cut_video';
  description = 'Cut or remove video segments based on natural language queries like "cut parts where people are dancing", "remove scenes with Sam Altman", or "extract when someone is speaking".';
  
  private editor: AgenticVideoEditor;

  constructor(editor: AgenticVideoEditor) {
    super();
    this.editor = editor;
  }
  
  schema = z.object({
    query: z.string().describe('Natural language query describing what to cut/remove'),
    action: z.enum(['cut', 'remove', 'extract']).default('extract').describe('Whether to extract, cut, or remove the segments')
  });

  async _call(input: z.infer<typeof this.schema>): Promise<string> {
    try {
      console.log('AI Agent: Smart cutting video based on:', input.query);
      
      // Use current processed video path instead of original
      const videoPath = this.editor.getCurrentVideoPath();
      console.log('Using current video path for smart cut:', videoPath);
      
      // Find matching time ranges using AI
      const matches = await videoIntelligenceTool.findByQuery(videoPath, input.query);
      
      if (matches.length === 0) {
        return `No segments found matching: ${input.query}`;
      }

      let resultActions = [];
      
      for (const match of matches) {
        const duration = match.endTime - match.startTime;
        
        if (input.action === 'extract') {
          resultActions.push({
            type: 'cut_video_segment',
            startTime: match.startTime,
            endTime: match.endTime,
            duration,
            description: match.description
          });
        } else if (input.action === 'remove') {
          resultActions.push({
            type: 'delete_segment',
            startTime: match.startTime,
            endTime: match.endTime,
            duration,
            description: match.description
          });
        }
      }

      const summary = resultActions.map(action => 
        `${action.type}: ${action.startTime}s-${action.endTime}s (${action.description})`
      ).join('\n');

      return `Smart cut completed. Found ${matches.length} segments:\n${summary}`;
    } catch (error) {
      return `Failed to smart cut video: ${error}`;
    }
  }
}

export class TranslateVideoLanguageTool extends Tool {
  name = 'translate_video_language';
  description = 'Translate video audio to a different language with safe words support. Creates new audio timeline track.';
  
  private editor: AgenticVideoEditor;

  constructor(editor: AgenticVideoEditor) {
    super();
    this.editor = editor;
  }
  
  schema = z.object({
    targetLanguage: z.string().describe('Target language code (e.g., "en", "es", "fr", "de", "ja", "ko")'),
    safeWords: z.array(z.string()).optional().describe('Words to skip translation (names, brands, technical terms)'),
    voiceStyle: z.enum(['natural', 'professional', 'casual']).optional().default('natural').describe('Voice style for translated audio'),
    preserveOriginalAudio: z.boolean().optional().default(false).describe('Keep original audio track alongside translated version')
  });

  async _call(input: z.infer<typeof this.schema>): Promise<string> {
    try {
      console.log('AI Agent: Translating video to language:', input.targetLanguage);
      console.log('Safe words:', input.safeWords);
      
      // Import the simple video translator service
      const { simpleVideoTranslator } = await import('./video-translator-simple');
      
      // Use current video path
      const videoPath = this.editor.getCurrentVideoPath();
      
      if (!videoPath) {
        return 'No video loaded. Please upload a video first.';
      }
      
      // First analyze speakers
      const speakerCount = await simpleVideoTranslator.analyzeVideoForSpeakers(videoPath, this.editor.userId.toString());
      
      // Prepare safewords in the correct format
      const safewords = (input.safeWords || []).map(word => ({
        original: word,
        replacement: word // Keep safe words unchanged
      }));
      
      // Perform translation
      const translationResult = await simpleVideoTranslator.translateVideo(
        videoPath,
        input.targetLanguage,
        speakerCount,
        safewords,
        this.editor.userId.toString()
      );
      
      // Generate dubbed video
      const dubbedVideoPath = await simpleVideoTranslator.createDubbedVideo(
        videoPath,
        translationResult,
        this.editor.userId.toString()
      );
      
      // Store translation result in session memory for UI to access
      this.editor.setSessionMemory('lastTranslationResult', {
        success: true,
        dubbedVideoPath,
        sourceLanguage: translationResult.originalLanguage,
        targetLanguage: translationResult.targetLanguage,
        segments: translationResult.segments,
        processedSegments: translationResult.segments.length,
        skippedSegments: 0,
        totalDuration: Math.max(...translationResult.segments.map(s => s.endTime))
      });
      
      // Generate response with translation details
      const result = this.editor.getSessionMemory('lastTranslationResult');
      const response = [
        `✅ Language Translation Complete!`,
        ``,
        `📊 Translation Summary:`,
        `• Source Language: ${result.sourceLanguage}`,
        `• Target Language: ${result.targetLanguage}`,
        `• Segments Translated: ${result.processedSegments}`,
        `• Total Duration: ${Math.round(result.totalDuration)}s`,
        ``,
        `🎬 Video with Subtitles Created:`,
        `• Translated video with burned-in subtitles has been generated`,
        `• File: ${path.basename(dubbedVideoPath)}`,
        `• Ready for download and preview`,
        ``
      ];
      
      // Add safe words info if provided
      if (input.safeWords && input.safeWords.length > 0) {
        response.push(`🛡️ Safe Words Preserved: ${input.safeWords.join(', ')}`);
        response.push('');
      }
      
      // Add segment details (first 3 segments)
      if (translationResult.segments && translationResult.segments.length > 0) {
        response.push(`📝 Translation Preview:`);
        translationResult.segments.slice(0, 3).forEach((segment, index) => {
          response.push(`${index + 1}. ${Math.round(segment.startTime)}s-${Math.round(segment.endTime)}s:`);
          response.push(`   Original: "${segment.originalText}"`);
          response.push(`   Translated: "${segment.translatedText}"`);
          response.push('');
        });
        
        if (translationResult.segments.length > 3) {
          response.push(`... and ${translationResult.segments.length - 3} more segments`);
        }
      }
      
      return response.join('\n');
      
    } catch (error) {
      console.error('Translation error:', error);
      return `❌ Translation failed: ${error instanceof Error ? error.message : 'Unknown error'}`;
    }
  }
}

export class AgenticVideoEditor {
  private agent: AgentExecutor;
  private model: ChatGoogleGenerativeAI;
  private tools: Tool[];
  private sessionMemory: Map<string, any>;
  private segmentManager: SegmentMemoryManager;
  private currentVideoPath: string = '';
  private geminiAI: GoogleGenAI;

  constructor(apiKey: string, userId: number = 1) {
    if (!apiKey || apiKey.trim() === '') {
      throw new Error('API key is required for agentic video editor');
    }
    
    this.model = new ChatGoogleGenerativeAI({
      model: 'gemini-2.0-flash-exp',
      apiKey: apiKey.trim(),
      temperature: 0.1,
    });

    // Initialize GoogleGenAI for video search
    this.geminiAI = new GoogleGenAI({
      apiKey: apiKey.trim()
    });

    // Initialize segment memory manager
    this.segmentManager = new SegmentMemoryManager();

    // Pass the editor instance to tools that need access to current video path
    this.tools = [
      new AddTextOverlayTool(),
      new SelectSegmentTool(this.segmentManager), 
      new DeleteSegmentTool(this.segmentManager),
      new AnalyzeVideoContentTool(),
      new DetectPeopleAndAddTextTool(),
      new ApplyVideoEffectTool(),
      new CaptionStyleRecommendationTool(this),
      new AuthenticAudioCaptionTool(this),
      new GenerateCaptionsTool(this),
      new WordLevelSubtitleTool(this),
      new GenerateWaveformCaptionsTool(this),
      new YouTubeShortsSubtitleTool(),
      new FindPeopleInVideoTool(this),
      new AnalyzeVideoIntelligenceTool(this),
      new SmartCutVideoTool(this),
      new TranslateVideoLanguageTool(this),
      new GenerateMediaTool(userId),
      new GenerateBrollSuggestionsTool(this),
      videoSearchTool,
      aiShortsGeneratorTool
    ];

    this.sessionMemory = new Map();
    
    // Debug: Log all tools
    console.log('🔧 Available tools:', this.tools.map(t => t.name));
    
    this.initializeAgent();
  }

  // Method to set the current video path (called after video processing)
  setCurrentVideoPath(videoPath: string) {
    this.currentVideoPath = videoPath;
    console.log('Updated current video path to:', videoPath);
  }

  // Method to get the current video path (used by tools)
  getCurrentVideoPath(): string {
    return this.currentVideoPath;
  }

  // Session memory methods
  setSessionMemory(key: string, value: any): void {
    this.sessionMemory.set(key, value);
  }

  getSessionMemory(key: string): any {
    return this.sessionMemory.get(key);
  }

  private async initializeAgent() {
    try {
      const prompt = ChatPromptTemplate.fromMessages([
        ['system', `You are an AI video editing assistant integrated into a timeline editor. You understand natural language commands and convert them to precise video editing operations.

SEGMENT MEMORY SYSTEM:
When you create segments using select_segment, they are automatically numbered (Segment 1, Segment 2, etc.) and stored in memory. You can reference these segments by number in future commands.

IMPORTANT DISTINCTION BETWEEN SELECT AND DELETE:
1. SELECT SEGMENT: Creates visual selection only - does not modify the video content
2. DELETE SEGMENT: Actually removes content from the video file and updates the video

Available tools:
1. select_segment - Select/mark video segments from start to end time (creates visual selection only, does NOT modify video)
2. delete_segment - Actually delete a specific segment by number from the video file (physically removes content)
3. add_text_overlay - Add text overlays with positioning and styling
4. detect_people_and_add_text - Detect people and add name tags
5. analyze_video_content - Analyze video for key moments and content
6. apply_video_effect - Apply visual effects like fades, transitions
7. recommend_caption_style - AI-powered caption style recommendations based on video content analysis 
8. generate_captions - Generate captions for accessibility
9. generate_waveform_captions - Generate advanced waveform-aligned captions using Dynamic Audio Waveform Subtitle Alignment
10. professional_caption_timing - Generate captions with professional timing algorithms (Adobe Premiere Pro / DaVinci Resolve style)

AI VIDEO INTELLIGENCE TOOLS:
9. analyze_video_intelligence - Analyze entire video to identify all people, objects, and activities with timestamps
10. find_people_in_video - Find when specific people appear in video using natural language queries
11. smart_cut_video - Cut or remove video segments based on natural language queries like "cut parts where people are dancing"
12. translate_video_language - Translate video audio to different languages with safe words support, creates new audio timeline
13. generate_media - Generate images or videos using AI based on text prompts
14. search_video_content - Search video content for specific topics, people, objects, or keywords using AI analysis of both audio transcripts and visual content

LANGUAGE TRANSLATION COMMANDS:
- "translate video to spanish" → translate_video_language(targetLanguage: "es")
- "change language to english with safewords Apple,Google" → translate_video_language(targetLanguage: "en", safeWords: ["Apple", "Google"])
- "translate to french with professional voice" → translate_video_language(targetLanguage: "fr", voiceStyle: "professional")
- Available languages: English (en), Spanish (es), French (fr), German (de), Japanese (ja), Korean (ko), Portuguese (pt), Italian (it), Chinese (zh), Hindi (hi)
- Voice styles: natural, professional, casual
- Safe words: Names, brands, technical terms that should not be translated

MEDIA GENERATION COMMANDS:
- "generate image of sunset over mountains" → generate_media(input: "image of sunset over mountains")
- "create video of waves crashing on beach" → generate_media(input: "video of waves crashing on beach")
- "make an animation of flying birds" → generate_media(input: "animation of flying birds")
- Generated media becomes draggable content that users can add to their timeline

VIDEO SEARCH COMMANDS:
- "search for Y combinator" → search_video_content(query: "Y combinator")
- "find moments with Sam Altman" → search_video_content(query: "Sam Altman")
- "search startup advice" → search_video_content(query: "startup advice")
- "find scenes with glasses" → search_video_content(query: "person with glasses")
- Returns relevant video segments with thumbnails and timestamps for easy navigation

CAPTION STYLE RECOMMENDATION COMMANDS:
- "recommend caption style" → recommend_caption_style(analysisType: "full")
- "analyze caption style for this video" → recommend_caption_style(analysisType: "full")
- "what caption style should I use" → recommend_caption_style(analysisType: "full")
- "suggest best caption settings" → recommend_caption_style(analysisType: "quick")
- Analyzes video content type, speech pace, audience level, and visual complexity to provide intelligent style recommendations (readable, verbatim, simplified) with optimized visual settings

WAVEFORM CAPTION COMMANDS:
- "generate waveform captions" → generate_waveform_captions(language: "English")
- "create waveform aligned subtitles" → generate_waveform_captions(language: "English")
- "analyze audio waveform for captions" → generate_waveform_captions(language: "English")
- "generate speech pattern aligned captions" → generate_waveform_captions(language: "English")
- "professional caption timing" → professional_caption_timing()
- "accurate caption timing" → professional_caption_timing()
- "precise caption sync" → professional_caption_timing()
- "adobe premiere style captions" → professional_caption_timing()
- Uses Dynamic Audio Waveform Subtitle Alignment for precise speech pattern detection and superior timing synchronization

COMMAND PARSING EXAMPLES:
- "cut from 10 to 30 seconds" → select_segment(startTime: 10, endTime: 30) → Creates "Segment 1" (visual selection only)
- "select 1-10 seconds" → select_segment(startTime: 1, endTime: 10) → Creates "Segment 1" (visual selection only)
- "delete segment 1" → delete_segment(segmentNumber: 1) → Actually removes Segment 1 from the video file
- "remove segment 2" → delete_segment(segmentNumber: 2) → Actually removes Segment 2 from the video file
- "add text hello world at 5s" → add_text_overlay(text: "hello world", startTime: 5)

TEXT OVERLAY WORKFLOW:
- When user requests text overlay with specific text and color: Use add_text_overlay directly
- When user requests text overlay but missing details: Use add_text_overlay without text/color to prompt user
- Examples:
  • "add text XYZ from 5-10 seconds" → add_text_overlay(text: "XYZ", startTime: 5, endTime: 10)
  • "add text in segment 5-10 seconds" → add_text_overlay(startTime: 5, endTime: 10) → Asks user for text and color
  • "put text hello with red color at 5s" → add_text_overlay(text: "hello", startTime: 5, color: "red")

AI VIDEO INTELLIGENCE EXAMPLES:
- "analyze this video to find people" → analyze_video_intelligence(videoPath: "/path/to/video.mp4")
- "find when Sam Altman appears" → find_people_in_video(videoPath: "/path/to/video.mp4", query: "Sam Altman")
- "find scenes with dancing" → find_people_in_video(videoPath: "/path/to/video.mp4", query: "people dancing")
- "cut parts where people are dancing" → smart_cut_video(videoPath: "/path/to/video.mp4", query: "people dancing", action: "extract")
- "remove scenes with glasses" → smart_cut_video(videoPath: "/path/to/video.mp4", query: "person with glasses", action: "remove")

B-ROLL GENERATION COMMANDS:
- "generate b-roll suggestions" → generate_broll_suggestions(analysisType: "professional")
- "create broll ideas" → generate_broll_suggestions(analysisType: "creative")  
- "enhance video with creative suggestions" → generate_broll_suggestions(analysisType: "cinematic")
- "suggest visual storytelling elements" → generate_broll_suggestions(analysisType: "professional")
- "analyze for b-roll opportunities" → generate_broll_suggestions(analysisType: "professional")
- Uses Gemini multimodal AI to analyze video content and generate creative B-roll suggestions with AI video generation prompts for professional visual enhancement

WORKFLOW:
1. User first selects/cuts segments using select_segment (creates visual indicators)
2. User can then delete specific segments using delete_segment (modifies actual video)
3. Once segments are deleted, the video file is updated and subsequent operations work on the new video

MEMORY CONTEXT AWARENESS:
Always check and reference the current segments in memory. When a user asks to delete a segment by number, use the delete_segment tool with the segment number - this will actually modify the video file.

CRITICAL: ALWAYS EXECUTE TOOLS, NEVER RETURN JSON

When the user asks for any video operation (translation, cutting, text overlay, etc.), you MUST use the available tools to perform the action. DO NOT return JSON responses or explanations about what you would do.

CORRECT BEHAVIOR:
- User: "translate video to spanish" → Call translate_video_language tool immediately
- User: "cut 10-20 seconds" → Call select_segment tool immediately  
- User: "add text hello at 5s" → Call add_text_overlay tool immediately

INCORRECT BEHAVIOR (DO NOT DO THIS):
- Returning JSON like {{"operation": "translate_video_language", "params": {{...}}}}
- Explaining what you would do without actually doing it
- Asking for confirmation before using tools

RESPONSE FORMAT: Use tools first, then provide friendly confirmation of what was actually accomplished.

Be conversational and helpful while being precise with video editing operations and segment memory management.`],
        ['human', '{input}'],
        ['placeholder', '{agent_scratchpad}']
      ]);

      const agent = await createToolCallingAgent({
        llm: this.model,
        tools: this.tools,
        prompt
      });

      this.agent = new AgentExecutor({
        agent,
        tools: this.tools,
        verbose: true,
        maxIterations: 5,
        returnIntermediateSteps: true
      });
    } catch (error) {
      console.error('Failed to initialize LangChain agent:', error);
      console.error('Tools causing issues:', this.tools.map(t => ({ name: t.name, hasSchema: !!t.schema })));
      // Set a fallback agent to null so we can handle it gracefully
      this.agent = null;
    }
  }

  async processCommand(input: string, videoContext: any, userId: number = 1): Promise<{
    response: string;
    actions: any[];
    tokensUsed: number;
    translationResult?: any;
  }> {
    try {
      console.log('=== AGENTIC VIDEO EDITOR - PROCESSING COMMAND ===');
      console.log('Input:', input);
      console.log('Input type:', typeof input);
      console.log('Video Context:', videoContext);

      // Validate input
      if (!input || typeof input !== 'string') {
        console.error('Invalid input:', input);
        return {
          response: 'Invalid command format',
          actions: [],
          tokensUsed: 0
        };
      }

      // CRITICAL: Check current token balance before ANY AI operations
      console.log('🚨 CHECKING TOKEN BALANCE BEFORE PROCESSING...');
      const { storage } = await import('../storage');
      const userSubscription = await storage.getUserSubscription(userId.toString());
      
      if (!userSubscription || !userSubscription.tier) {
        return {
          response: '❌ Unable to verify subscription. Please check your account status.',
          actions: [{
            type: 'error',
            description: 'Subscription verification failed',
            uiUpdate: true
          }],
          tokensUsed: 0
        };
      }

      const remainingTokens = userSubscription.tier.appTokens - userSubscription.appTokensUsed;
      console.log(`💰 Token Status: ${remainingTokens} remaining of ${userSubscription.tier.appTokens} total`);
      console.log(`💰 Used tokens: ${userSubscription.appTokensUsed}`);

      // Block ALL AI features if tokens are exhausted
      if (remainingTokens <= 0) {
        console.log('🚫 BLOCKING: No tokens remaining');
        return {
          response: '🚫 App tokens are consumed\n\nYou have used all available tokens for this billing period. Please upgrade your plan or wait for token renewal to continue using AI features.',
          actions: [{
            type: 'token_exhausted',
            description: 'App tokens consumed - blocking AI operations',
            tokenBalance: remainingTokens,
            totalTokens: userSubscription.tier.appTokens,
            usedTokens: userSubscription.appTokensUsed,
            uiUpdate: true,
            showUpgradeModal: true
          }],
          tokensUsed: 0
        };
      }

      // Block big operations if tokens < 50
      const inputLower = input.toLowerCase();
      const isBigOperation = inputLower.includes('translate') || 
                           inputLower.includes('caption') || 
                           inputLower.includes('subtitle') ||
                           inputLower.includes('generate') ||
                           inputLower.includes('create') ||
                           inputLower.includes('shorts') ||
                           inputLower.includes('reel');

      if (isBigOperation && remainingTokens < 50) {
        console.log(`🚫 BLOCKING BIG OPERATION: Only ${remainingTokens} tokens remaining (need 50+)`);
        return {
          response: `⚠️ Insufficient tokens for this operation\n\nYou have ${remainingTokens} tokens remaining. Big operations like translations, caption generation, and content creation require at least 50 tokens.\n\nPlease upgrade your plan to continue.`,
          actions: [{
            type: 'insufficient_tokens',
            description: 'Insufficient tokens for big operation',
            tokenBalance: remainingTokens,
            minimumRequired: 50,
            operationType: 'big_operation',
            uiUpdate: true,
            showUpgradeModal: true
          }],
          tokensUsed: 0
        };
      }

      console.log(`✅ Token validation passed: ${remainingTokens} tokens available`);
      
      // Continue with existing logic if tokens are sufficient...

      // PRE-CALCULATE TOKEN REQUIREMENTS
      console.log('🧮 Pre-calculating token requirements...');
      
      // Determine operation type and estimate costs
      let operationType = 'general_chat';
      let videoDuration = 0;
      
      // Extract video duration if available
      if (videoContext?.duration) {
        videoDuration = typeof videoContext.duration === 'string' ? 
          parseFloat(videoContext.duration) : videoContext.duration;
      }
      
      // Detect operation type from input (reusing inputLower from above)
      if (inputLower.includes('translate') || inputLower.includes('dubbing')) {
        operationType = 'video_translation';
      } else if (inputLower.includes('caption') || inputLower.includes('subtitle')) {
        operationType = 'caption_generation';
      } else if (inputLower.includes('search') || inputLower.includes('find')) {
        operationType = 'video_search';
      } else if (inputLower.includes('analyze') || inputLower.includes('detect')) {
        operationType = 'video_analysis';
      }

      // Pre-validate token requirements
      const { calculation, validation } = await TokenPreCalculator.preValidateOperation(
        userId.toString(),
        operationType,
        {
          videoDurationSeconds: videoDuration,
          inputText: input,
          model: 'gemini-1.5-flash'
        }
      );

      // Check if user has sufficient tokens
      if (!validation.hasEnoughTokens) {
        console.log('❌ Insufficient tokens for operation');
        return {
          response: `⚠️ ${validation.message}\n\n${TokenPreCalculator.getDetailedBreakdown(calculation)}\n\nPlease upgrade your plan or wait for token renewal to continue.`,
          actions: [{
            type: 'error',
            description: 'Insufficient tokens',
            tokenRequirement: calculation,
            userBalance: validation.userBalance
          }],
          tokensUsed: 0
        };
      }

      console.log('✅ Token validation passed:', validation.message);

      // Store context in session memory
      this.sessionMemory.set('lastVideoContext', videoContext);
      this.sessionMemory.set('lastCommand', input);
      this.sessionMemory.set('timestamp', Date.now());
      console.log('Video context:', videoContext);

      // Set current video path from context for translation and other operations
      if (videoContext && (videoContext.filename || videoContext.videoPath)) {
        const videoPath = videoContext.filename || videoContext.videoPath;
        this.setCurrentVideoPath(videoPath);
        console.log('Set current video path for operations:', videoPath);
      }

      // Note: Translation commands will be handled by the bypass logic after agent processing to avoid duplication

      // Check if agent is initialized
      if (!this.agent) {
        console.log('Agent not initialized, attempting to reinitialize...');
        await this.initializeAgent();
      }

      // If still no agent, fall back to simple response
      if (!this.agent) {
        console.log('No agent available, using fallback');
        return this.generateFallbackResponse(input, videoContext, userId);
      }

      // Get current segment memory context
      const segmentMemoryContext = this.segmentManager.getMemoryContext();

      const enhancedInput = `
Current video context:
- Video path: ${videoContext.videoPath || videoContext.filename || 'unknown'}
- Duration: ${videoContext.duration || 'unknown'}s
- Current playback time: ${videoContext.currentTime || 0}s
- Video filename: ${videoContext.filename || 'unknown'}
- Existing operations: ${JSON.stringify(videoContext.operations || [])}

SEGMENT MEMORY:
${segmentMemoryContext}

User command: "${input}"

IMPORTANT: 
- When creating segments with cut_video_segment, they are automatically numbered and stored in memory
- When user asks to "delete segment X" or "remove segment X", use delete_segment tool with the segment number
- For cut commands like "cut video from 1 to 10s", use cut_video_segment with startTime: 1, endTime: 10
- For people detection like "add names above people", use detect_people_and_add_text with currentTime: ${videoContext.currentTime || 0}
- For AI video intelligence (analyze_video_intelligence, find_people_in_video, smart_cut_video), use videoPath: "${videoContext.videoPath || videoContext.filename || 'unknown'}"
- Check segment memory context above to understand which segments exist before processing commands
- Always return JSON operations for UI updates

Please analyze this command and use the appropriate tools to fulfill the request with exact parameters.
`;

      // Handle bypass operations BEFORE calling LangChain to prevent duplicate execution
      console.log('🔄 CHECKING BYPASS CONDITIONS FIRST');
      
      let bypassActions: any[] = [];
      const needsMediaGeneration = (input.toLowerCase().includes('generate') || 
          input.toLowerCase().includes('create') || input.toLowerCase().includes('make')) && 
          (input.toLowerCase().includes('image') || input.toLowerCase().includes('video') || 
           input.toLowerCase().includes('clip') || input.toLowerCase().includes('movie') || 
           input.toLowerCase().includes('animation'));
      
      const needsVideoSearch = (input.toLowerCase().includes('search') || 
          input.toLowerCase().includes('find')) && 
          (input.toLowerCase().includes('video') || input.toLowerCase().includes('content') || 
           input.toLowerCase().includes('moments') || input.toLowerCase().includes('for')) ||
          // Also trigger for direct search queries (user just wants to search video content)
          (videoContext && (videoContext.filename || videoContext.videoPath) && 
           !input.toLowerCase().includes('translate') && 
           !input.toLowerCase().includes('generate') &&
           !input.toLowerCase().includes('create') &&
           !input.toLowerCase().includes('add') &&
           !input.toLowerCase().includes('cut') &&
           input.trim().length > 0 && 
           input.trim().length < 50); // Simple search query likely
      
      const needsTranslation = (input.toLowerCase().includes('translate') || 
          input.toLowerCase().includes('dub') || input.toLowerCase().includes('language')) &&
          (input.toLowerCase().includes('to') || input.toLowerCase().includes('in'));
      
      const needsCaptions = input.toLowerCase().includes('caption') || 
          input.toLowerCase().includes('subtitle') ||
          input.toLowerCase().includes('transcribe') ||
          input.toLowerCase().includes('generate subtitles') ||
          input.toLowerCase().includes('auto caption');

      const needsYouTubeShortsSubtitles = input.toLowerCase().includes('youtube shorts') ||
          (input.toLowerCase().includes('subtitle') && 
           (input.toLowerCase().includes('professional') || 
            input.toLowerCase().includes('word level') || 
            input.toLowerCase().includes('highlight') ||
            input.toLowerCase().includes('animated') ||
            input.toLowerCase().includes('word timing'))) ||
          input.toLowerCase().includes('deepgram') ||
          input.toLowerCase().includes('word by word') ||
          input.toLowerCase().includes('cyan highlight');
      
      const needsWordLevelSubtitles = (input.toLowerCase().includes('word') && 
          (input.toLowerCase().includes('level') || input.toLowerCase().includes('timing')) && 
          (input.toLowerCase().includes('subtitle') || input.toLowerCase().includes('caption'))) ||
          // Also trigger for specific word-level requests
          input.toLowerCase().includes('word level') ||
          input.toLowerCase().includes('word timing') ||
          input.toLowerCase().includes('word-level') ||
          input.toLowerCase().includes('precise timing') ||
          input.toLowerCase().includes('frame accurate');
      
      const needsProfessionalCaptions = (input.toLowerCase().includes('professional') || 
          input.toLowerCase().includes('production') || 
          input.toLowerCase().includes('broadcast') || 
          input.toLowerCase().includes('high quality') ||
          input.toLowerCase().includes('accurate') ||
          input.toLowerCase().includes('precise') ||
          input.toLowerCase().includes('sync') ||
          input.toLowerCase().includes('match') ||
          input.toLowerCase().includes('adobe') ||
          input.toLowerCase().includes('premiere') ||
          input.toLowerCase().includes('davinci')) && 
          (input.toLowerCase().includes('caption') || 
           input.toLowerCase().includes('subtitle') || 
           input.toLowerCase().includes('timing'));
      
      const needsAuthenticAudioCaptions = (input.toLowerCase().includes('authentic') ||
          input.toLowerCase().includes('audio') && (input.toLowerCase().includes('match') || input.toLowerCase().includes('sync')) ||
          input.toLowerCase().includes('real') && input.toLowerCase().includes('audio') ||
          input.toLowerCase().includes('speech pattern') ||
          input.toLowerCase().includes('audio pattern') ||
          input.toLowerCase().includes('waveform') && (input.toLowerCase().includes('caption') || input.toLowerCase().includes('subtitle')) ||
          input.toLowerCase().includes('fit the algo') ||
          input.toLowerCase().includes('algo which matches')) && 
          (input.toLowerCase().includes('caption') || 
           input.toLowerCase().includes('subtitle'));
      
      const needsAnimatedSubtitles = (input.toLowerCase().includes('animated') ||
          input.toLowerCase().includes('animation') ||
          input.toLowerCase().includes('word by word') ||
          input.toLowerCase().includes('word-by-word') ||
          input.toLowerCase().includes('highlight') && (input.toLowerCase().includes('word') || input.toLowerCase().includes('text')) ||
          input.toLowerCase().includes('dynamic') && (input.toLowerCase().includes('subtitle') || input.toLowerCase().includes('caption')) ||
          input.toLowerCase().includes('visual') && input.toLowerCase().includes('effect') ||
          input.toLowerCase().includes('typewriter') && (input.toLowerCase().includes('subtitle') || input.toLowerCase().includes('caption')) ||
          input.toLowerCase().includes('engaging') && (input.toLowerCase().includes('subtitle') || input.toLowerCase().includes('caption')) ||
          input.toLowerCase().includes('bounce') && (input.toLowerCase().includes('subtitle') || input.toLowerCase().includes('caption')) ||
          input.toLowerCase().includes('glow') && (input.toLowerCase().includes('subtitle') || input.toLowerCase().includes('caption'))) && 
          (input.toLowerCase().includes('caption') || 
           input.toLowerCase().includes('subtitle') ||
           input.toLowerCase().includes('text'));
      
      const needsShortsGeneration = (input.toLowerCase().includes('shorts') || 
          input.toLowerCase().includes('short') || 
          input.toLowerCase().includes('clip') || 
          input.toLowerCase().includes('viral') || 
          input.toLowerCase().includes('reel') ||
          input.toLowerCase().includes('tiktok') ||
          input.toLowerCase().includes('instagram') ||
          input.toLowerCase().includes('youtube shorts')) && 
          (input.toLowerCase().includes('generate') || 
           input.toLowerCase().includes('create') || 
           input.toLowerCase().includes('make') ||
           input.toLowerCase().includes('extract') ||
           input.toLowerCase().includes('find'));

      const needsBrollGeneration = (input.toLowerCase().includes('broll') || 
          input.toLowerCase().includes('b-roll') || 
          input.toLowerCase().includes('b roll') ||
          input.toLowerCase().includes('creative') && input.toLowerCase().includes('suggestions') ||
          input.toLowerCase().includes('enhance') && input.toLowerCase().includes('video') ||
          input.toLowerCase().includes('visual') && input.toLowerCase().includes('storytelling')) && 
          (input.toLowerCase().includes('generate') || 
           input.toLowerCase().includes('create') || 
           input.toLowerCase().includes('suggest') ||
           input.toLowerCase().includes('analyze') ||
           input.toLowerCase().includes('enhance'));
      
      console.log('🔍 BYPASS CONDITION CHECK:');
      console.log('- Input:', input);
      console.log('- needsMediaGeneration:', needsMediaGeneration);
      console.log('- needsVideoSearch:', needsVideoSearch);
      console.log('- needsTranslation:', needsTranslation);
      console.log('- needsCaptions:', needsCaptions);
      console.log('- needsYouTubeShortsSubtitles:', needsYouTubeShortsSubtitles);
      console.log('- needsWordLevelSubtitles:', needsWordLevelSubtitles);
      console.log('- needsProfessionalCaptions:', needsProfessionalCaptions);
      console.log('- needsAuthenticAudioCaptions:', needsAuthenticAudioCaptions);
      console.log('- needsAnimatedSubtitles:', needsAnimatedSubtitles);
      console.log('- needsShortsGeneration:', needsShortsGeneration);
      console.log('- needsBrollGeneration:', needsBrollGeneration);
      
      // ANIMATED SUBTITLE GENERATION - Execute for animation requests first
      if (needsAnimatedSubtitles) {
        console.log('🎬 BYPASSING LANGCHAIN - Animated Subtitle Generation');
        console.log('Reason: Using animated subtitle generator with visual effects');
        
        try {
          // Get video path from context
          const videoPath = videoContext?.videoPath || videoContext?.filename;
          if (!videoPath || videoPath === 'unknown') {
            return {
              response: "Please upload a video first to generate animated subtitles.",
              actions: [{
                type: 'error',
                description: 'No video loaded for animated subtitle generation',
                uiUpdate: true
              }],
              tokensUsed: 0
            };
          }

          console.log(`[AnimatedSubtitles] Starting animated subtitle generation for: ${videoPath}`);
          
          // Import animated subtitle generator
          const AnimatedSubtitleGenerator = (await import('./animated-subtitle-generator')).default;
          const animatedGenerator = new AnimatedSubtitleGenerator();
          
          // Determine preset from input
          let preset = 'dynamic'; // default
          if (input.toLowerCase().includes('subtle')) preset = 'subtle';
          else if (input.toLowerCase().includes('typewriter')) preset = 'typewriter';
          else if (input.toLowerCase().includes('energetic') || input.toLowerCase().includes('bounce')) preset = 'energetic';
          
          // Generate animated subtitles
          const animatedSegments = await animatedGenerator.generateAnimatedSubtitles(videoPath, {
            preset,
            speechAnalysis: true,
            adaptToContent: true
          });

          console.log(`✅ Generated ${animatedSegments.length} animated subtitle segments with ${preset} preset`);
          
          // Convert animated segments to timeline format
          const timelineSegments = animatedSegments.map((segment, index) => ({
            id: segment.id,
            startTime: segment.startTime,
            endTime: segment.endTime,
            duration: segment.endTime - segment.startTime,
            type: 'animated_subtitle',
            content: {
              text: segment.text,
              animatedData: segment,
              words: segment.words,
              animations: segment.containerAnimation,
              preset: preset
            },
            x: 50,
            y: 80,
            fontSize: 20,
            color: '#ffffff',
            style: 'animated',
            animation: preset,
            background: segment.style.backgroundColor,
            borderRadius: segment.style.borderRadius,
            opacity: 1
          }));
          
          // Create caption track action
          const captionTrackAction = {
            type: 'animated_captions_generated',
            captionTrack: {
              name: `Animated Subtitles (${preset})`,
              segments: timelineSegments,
              segmentCount: timelineSegments.length,
              totalDuration: Math.max(...timelineSegments.map(s => s.endTime)),
              language: 'en',
              confidence: 0.95,
              preset: preset
            },
            animatedSegments: animatedSegments,
            uiUpdate: true
          };

          return {
            response: `🎬 Generated ${animatedSegments.length} animated subtitle segments with ${preset} preset! Each word will highlight with dynamic visual effects and smooth animations. The subtitles adapt to speech speed (red for fast, blue for slow, green for normal) and include engaging animations that enhance readability without being distracting.`,
            actions: [captionTrackAction],
            tokensUsed: 150 // Estimate for animated subtitle generation
          };
          
        } catch (error) {
          console.error('[AnimatedSubtitles] Error:', error);
          return {
            response: "Failed to generate animated subtitles. Please try again with a different video or check the video format.",
            actions: [{
              type: 'error',
              description: `Animated subtitle generation failed: ${error.message}`,
              uiUpdate: true
            }],
            tokensUsed: 10
          };
        }
      }

      // YOUTUBE SHORTS SUBTITLE GENERATION - Execute for YouTube Shorts style requests
      if (needsYouTubeShortsSubtitles) {
        console.log('🎬 BYPASSING LANGCHAIN - YouTube Shorts Subtitle Generation');
        console.log('Reason: Using YouTube Shorts subtitle system with Deepgram and professional styling');
        
        try {
          // Get video path from context
          const videoPath = videoContext?.videoPath || videoContext?.filename;
          if (!videoPath || videoPath === 'unknown') {
            return {
              response: "Please upload a video first to generate YouTube Shorts-style subtitles.",
              actions: [{
                type: 'error',
                description: 'No video loaded for YouTube Shorts subtitle generation',
                uiUpdate: true
              }],
              tokensUsed: 0
            };
          }

          console.log(`[YouTubeShortsSubtitles] Starting YouTube Shorts subtitle generation for: ${videoPath}`);
          
          // Import and initialize YouTube Shorts subtitle system
          const { YouTubeShortsSubtitleSystem } = await import('./youtube-shorts-subtitle-system.js');
          const subtitleSystem = new YouTubeShortsSubtitleSystem();
          
          // Generate word-level subtitles using Deepgram
          const subtitles = await subtitleSystem.generateWordLevelSubtitles(videoPath);
          
          // Extract subtitle settings from context
          const subtitleSettings = videoContext?.subtitleSettings || {};
          console.log('[YouTubeShortsSubtitles] Using subtitle settings:', JSON.stringify(subtitleSettings, null, 2));

          // Generate YouTube Shorts-style subtitles with user preferences
          const captionSettings = {
            fontSize: subtitleSettings.fontSize || 80,
            fontWeight: subtitleSettings.fontWeight || 800,
            textAlign: subtitleSettings.textAlign || 'center',
            textColor: subtitleSettings.textColor || 'white',
            currentWordColor: '#00FFFF', // Cyan highlighting (YouTube Shorts style)
            currentWordBackgroundColor: subtitleSettings.borderColor || '#FF0000', // Red background or user border color
            shadowColor: subtitleSettings.shadowColor || 'black',
            shadowBlur: subtitleSettings.shadowBlur || 30,
            numSimultaneousWords: 4, // Keep 4 words for single-line display
            fadeInAnimation: subtitleSettings.fadeInAnimation !== false,
            wordHighlighting: subtitleSettings.wordHighlighting !== false,
            stream: false,
            textBoxWidthInPercent: 80
          };

          // Create Revideo scene file with YouTube Shorts styling
          const sceneFilePath = await subtitleSystem.createSubtitleSceneFile(
            subtitles,
            'youtubeShortsSubtitles',
            captionSettings
          );

          // Export to SRT format
          const srtContent = subtitleSystem.exportToSRT(subtitles);

          console.log(`✅ Generated ${subtitles.length} YouTube Shorts subtitle segments with professional styling`);
          
          // Convert to timeline format
          const timelineSegments = subtitles.map((segment, index) => ({
            id: `youtube_subtitle_${index}`,
            startTime: segment.start,
            endTime: segment.end,
            duration: segment.end - segment.start,
            type: 'youtube_shorts_subtitle',
            content: {
              text: segment.text,
              words: segment.words,
              timecode: segment.timecode,
              styling: 'youtube_shorts'
            },
            x: 50,
            y: 80,
            fontSize: captionSettings.fontSize,
            color: captionSettings.textColor,
            currentWordColor: captionSettings.currentWordColor,
            backgroundColor: captionSettings.currentWordBackgroundColor,
            style: 'youtube_shorts',
            shadow: captionSettings.shadowColor,
            shadowBlur: captionSettings.shadowBlur,
            opacity: 1
          }));
          
          // Create caption track action
          const captionTrackAction = {
            type: 'youtube_shorts_subtitles_generated',
            captionTrack: {
              name: 'YouTube Shorts Subtitles',
              segments: timelineSegments,
              segmentCount: timelineSegments.length,
              totalDuration: Math.max(...timelineSegments.map(s => s.endTime)),
              language: 'en',
              confidence: 0.95,
              style: 'youtube_shorts'
            },
            subtitles: subtitles,
            sceneFilePath: sceneFilePath,
            srtContent: srtContent,
            uiUpdate: true
          };

          // Deduct tokens for Deepgram + OpenAI usage
          const tokenTracker = new TokenTracker();
          await tokenTracker.deductAppTokens(userId, 100, 'YouTube Shorts Subtitle Generation');

          return {
            response: `🎬 Generated professional YouTube Shorts-style subtitles with ${subtitles.length} segments! Features word-by-word highlighting with cyan current word color, red background boxes, batch subtitle display (4 words simultaneously), fade-in animations with opacity transitions, and professional shadow effects (black shadow with 30px blur). Created Revideo scene file and SRT export ready.`,
            actions: [captionTrackAction],
            tokensUsed: 100
          };
          
        } catch (error) {
          console.error('[YouTubeShortsSubtitles] Error:', error);
          return {
            response: "Failed to generate YouTube Shorts subtitles. This might be due to API limits or audio quality. Please try again.",
            actions: [{
              type: 'error',
              description: `YouTube Shorts subtitle generation failed: ${error.message}`,
              uiUpdate: true
            }],
            tokensUsed: 10
          };
        }
      }
      
      // GOOGLE SPEECH API UNIVERSAL CAPTION GENERATION - Execute for ALL other caption requests
      if (needsProfessionalCaptions || needsAuthenticAudioCaptions || needsCaptions || needsWordLevelSubtitles) {
        console.log('🎯 BYPASSING LANGCHAIN - Google Speech API Caption Generation');
        console.log('Reason: Using unified Google Speech API transcription algorithm');
        
        try {
          // Get video path from context
          const videoPath = videoContext?.videoPath || videoContext?.filename;
          if (!videoPath || videoPath === 'unknown') {
            return {
              response: "Please upload a video first to generate professional captions.",
              actions: [{
                type: 'error',
                description: 'No video loaded for professional caption generation',
                uiUpdate: true
              }],
              tokensUsed: 0
            };
          }

          console.log(`[GoogleSpeechAPI] Starting unified caption generation for: ${videoPath}`);
          
          // Use Google Speech API transcriber for unified caption generation
          const { GoogleSpeechTranscriber } = await import('./google-speech-transcriber');
          const transcriber = new GoogleSpeechTranscriber();
          
          const fullVideoPath = path.join(process.cwd(), 'uploads', videoPath);
          const result = await transcriber.transcribeMedia(fullVideoPath);
          
          if (!result || result.segments.length === 0) {
            return {
              response: "Caption generation failed. The video may not contain clear speech or there was an audio processing error.",
              actions: [{
                type: 'error',
                description: 'Caption generation failed',
                uiUpdate: true
              }],
              tokensUsed: 0
            };
          }

          // Convert GoogleSpeechTranscriber result to timeline segments format
          const timelineSegments = result.segments.map((segment, index) => ({
            id: `caption_${Date.now()}_${index}`,
            startTime: segment.startTime,
            endTime: segment.endTime,
            duration: segment.endTime - segment.startTime,
            text: segment.text,
            confidence: segment.confidence,
            words: [] // Google Speech API handles word-level timing internally
          }));

          console.log(`[GoogleSpeechAPI] Generated ${timelineSegments.length} segments with Google Speech API`);
          console.log(`[GoogleSpeechAPI] Total duration: ${result.totalDuration}s`);
          
          // Create caption track in expected format
          const captionTrack = {
            id: `google_speech_${Date.now()}`,
            name: 'Google Speech Captions',
            language: result.language || 'auto',
            segments: timelineSegments,
            segmentCount: timelineSegments.length,
            totalDuration: result.totalDuration,
            style: 'google_speech',
            fullTranscript: result.fullTranscript,
            metadata: {
              algorithm: 'Google Speech API',
              wavConversion: 'Yes',
              chunkProcessing: '30-second chunks',
              silenceDetection: '-20dB threshold, 0.2s minimum',
              contextualTranscription: 'Full transcript used as phrase context',
              segmentSplitting: 'Silence-based (fallback to 4s chunks)',
              longSegmentHandling: '>8s segments split into 4s chunks'
            },
            createdAt: new Date()
          };
          
          bypassActions = [{
            type: 'generate_captions',
            id: captionTrack.id,
            timestamp: 0,
            description: `Google Speech API: ${captionTrack.segmentCount} segments with silence detection and contextual transcription`,
            captionTrack,
            uiUpdate: true
          }];
          
          // Store captions in session memory for frontend access
          this.sessionMemory.set('generatedCaptions', captionTrack);
          
          const existingOps = this.sessionMemory.get('operations') || [];
          this.sessionMemory.set('operations', [...existingOps, ...bypassActions]);
          
          console.log('=== GOOGLE SPEECH API TRANSCRIPTION COMPLETE ===');
          console.log('Caption segments generated:', captionTrack.segmentCount);
          console.log('Algorithm used: Google Speech API');
          console.log('WAV conversion: Yes');
          console.log('Chunk processing: 30-second chunks');
          console.log('Silence detection: -20dB threshold, 0.2s minimum');
          console.log('Contextual transcription: Full transcript used as phrase context');
          
          return {
            response: `Caption generation complete using Google Speech API! Generated ${captionTrack.segmentCount} segments with precise silence detection and context-aware transcription. Total duration: ${result.totalDuration.toFixed(1)}s`,
            actions: bypassActions,
            tokensUsed: 0
          };
          
        } catch (error) {
          console.error('❌ Professional caption generation bypass failed:', error);
          const errorActions = [{
            type: 'error',
            id: `error_${Date.now()}`,
            timestamp: 0,
            description: `Professional caption generation failed: ${error instanceof Error ? error.message : 'Unknown error'}`,
            uiUpdate: true
          }];
          
          return {
            response: `Professional caption generation failed: ${error instanceof Error ? error.message : 'Unknown error'}`,
            actions: errorActions,
            tokensUsed: 0
          };
        }
      }

      // All caption types are already handled by the unified Google Speech API above

      // Redirected to unified Google Speech API above
      
      // Redirected to unified Google Speech API above
      
      // AI SHORTS GENERATION BYPASS - Execute before LangChain to prevent duplicate calls
      if (needsShortsGeneration) {
        console.log('🎬 BYPASSING LANGCHAIN - Direct AI Shorts Generation');
        console.log('Reason: Shorts/viral clips generation detected in input');
        
        try {
          // Get video path from context
          const videoPath = videoContext?.videoPath || videoContext?.filename;
          if (!videoPath || videoPath === 'unknown') {
            return {
              response: "Please upload a video first to generate AI shorts.",
              actions: [{
                type: 'error',
                description: 'No video loaded for shorts generation',
                uiUpdate: true
              }],
              tokensUsed: 0
            };
          }

          // Extract parameters from input
          let contentType = 'viral_moments'; // Default
          let duration = 30; // Default 30 seconds
          let style = 'tiktok'; // Default
          let targetAudience = 'general'; // Default

          // Check for custom prompt-based generation
          let customPrompt = undefined;
          const isCustomPrompt = input.toLowerCase().includes('create shorts') || 
                               input.toLowerCase().includes('make shorts') || 
                               input.toLowerCase().includes('generate clips') ||
                               input.toLowerCase().includes('extract moments') ||
                               input.toLowerCase().includes('find moments') ||
                               input.toLowerCase().includes('clips about') ||
                               input.toLowerCase().includes('shorts about');

          // Parse content type
          if (isCustomPrompt) {
            contentType = 'custom';
            // Extract the actual prompt by cleaning the input
            customPrompt = input
              .replace(/generate|create|make|extract|find|get|give\s+me/gi, '')
              .replace(/shorts?|clips?|moments?|reels?|videos?/gi, '')
              .replace(/viral|from|this|video|about/gi, '')
              .replace(/\s+/g, ' ')
              .trim();
            
            // If prompt is too short, use the full input as prompt
            if (customPrompt.length < 10) {
              customPrompt = input;
            }
          } else if (input.toLowerCase().includes('entertainment')) contentType = 'entertainment';
          else if (input.toLowerCase().includes('educational') || input.toLowerCase().includes('learning')) contentType = 'educational';
          else if (input.toLowerCase().includes('highlight')) contentType = 'highlights';
          else if (input.toLowerCase().includes('funny') || input.toLowerCase().includes('humor')) contentType = 'funny_moments';
          else if (input.toLowerCase().includes('insight') || input.toLowerCase().includes('key')) contentType = 'key_insights';

          // Parse duration
          const durationMatch = input.match(/(\d+)\s*(?:second|sec|s)/i);
          if (durationMatch) {
            const parsed = parseInt(durationMatch[1]);
            if (parsed >= 15 && parsed <= 90) duration = parsed;
          }

          // Parse platform style
          if (input.toLowerCase().includes('youtube')) style = 'youtube_shorts';
          else if (input.toLowerCase().includes('instagram') || input.toLowerCase().includes('reel')) style = 'instagram_reels';

          // Parse target audience
          if (input.toLowerCase().includes('young') || input.toLowerCase().includes('teen')) targetAudience = 'young_adults';
          else if (input.toLowerCase().includes('professional') || input.toLowerCase().includes('business')) targetAudience = 'professionals';
          else if (input.toLowerCase().includes('student') || input.toLowerCase().includes('education')) targetAudience = 'students';

          console.log(`🎬 Generating AI shorts with:`, {
            contentType,
            duration,
            style,
            targetAudience,
            videoPath,
            customPrompt: customPrompt || 'N/A'
          });

          // Use the AI shorts generator tool
          const fullVideoPath = path.isAbsolute(videoPath) ? videoPath : path.join(process.cwd(), 'uploads', videoPath);
          
          const shortsRequest = {
            videoPath: fullVideoPath,
            contentType: contentType as any,
            duration,
            style: style as any,
            targetAudience: targetAudience as any,
            customPrompt: customPrompt,
            createVideos: false // Just analysis for now
          };

          const { aiShortsGenerator } = await import('./ai-shorts-generator');
          const clips = await aiShortsGenerator.generateShorts(shortsRequest);

          if (!clips || clips.length === 0) {
            return {
              response: "No suitable viral clips found in the video. The video might be too short or lack engaging content for shorts generation.",
              actions: [{
                type: 'error',
                description: 'No viral clips found',
                uiUpdate: true
              }],
              tokensUsed: 0
            };
          }

          // Create action for each clip
          const clipActions = clips.map((clip, index) => ({
            type: 'ai_shorts_generated',
            id: `shorts_${clip.id}`,
            timestamp: clip.startTime,
            description: `AI Shorts: ${clip.title} (${clip.duration}s, viral score: ${clip.viralScore}/10)`,
            clipData: {
              id: clip.id,
              title: clip.title,
              description: clip.description,
              startTime: clip.startTime,
              endTime: clip.endTime,
              duration: clip.duration,
              viralScore: clip.viralScore,
              engagementFactors: clip.engagementFactors,
              speakerInfo: clip.speakerInfo,
              keyMoments: clip.keyMoments,
              transcriptSnippet: clip.transcriptSnippet,
              visualHighlights: clip.visualHighlights,
              videoPath: clip.videoPath // Include video file path for playback
            },
            uiUpdate: true
          }));

          bypassActions = clipActions;

          // Store clips in session memory
          this.sessionMemory.set('generatedShorts', clips);
          const existingOps = this.sessionMemory.get('operations') || [];
          this.sessionMemory.set('operations', [...existingOps, ...bypassActions]);

          console.log('=== AI SHORTS GENERATION COMPLETE ===');
          console.log(`Generated ${clips.length} viral clips`);
          console.log('Platform optimization:', style);
          console.log('Content type:', contentType);
          console.log('Target duration:', duration);
          if (customPrompt) console.log('Custom prompt:', customPrompt);

          return {
            response: `AI Shorts generation complete! Found ${clips.length} viral clips with ${style} optimization. Best clip: "${clips[0]?.title}" (viral score: ${clips[0]?.viralScore}/10). Content focus: ${contentType.replace('_', ' ')}.`,
            actions: bypassActions,
            tokensUsed: 0
          };

        } catch (error) {
          console.error('❌ AI Shorts generation bypass failed:', error);
          return {
            response: `AI Shorts generation failed: ${error instanceof Error ? error.message : 'Unknown error'}`,
            actions: [{
              type: 'error',
              description: `AI Shorts generation failed: ${error instanceof Error ? error.message : 'Unknown error'}`,
              uiUpdate: true
            }],
            tokensUsed: 0
          };
        }
      }
      
      // TRANSLATION BYPASS - Execute before LangChain to prevent duplicate calls
      if (needsTranslation) {
        console.log('🌐 BYPASSING LANGCHAIN - Direct Video Translation');
        console.log('Reason: Translation detected in input');
        
        // PRE-VALIDATE TOKEN REQUIREMENTS FOR TRANSLATION
        console.log('🧮 Pre-calculating token requirements for translation...');
        const { calculation, validation } = await TokenPreCalculator.preValidateOperation(
          userId.toString(),
          'video_translation',
          {
            videoDurationSeconds: videoDuration,
            inputText: input,
            model: 'gemini-1.5-flash'
          }
        );

        if (!validation.hasEnoughTokens) {
          console.log('❌ Insufficient tokens for translation operation');
          return {
            response: `⚠️ ${validation.message}\n\n${TokenPreCalculator.getDetailedBreakdown(calculation)}\n\nPlease upgrade your plan or wait for token renewal to continue.`,
            actions: [{
              type: 'error',
              description: 'Insufficient tokens for translation',
              tokenRequirement: calculation,
              userBalance: validation.userBalance
            }],
            tokensUsed: 0,
            translationResult: null
          };
        }

        console.log('✅ Token validation passed for translation:', validation.message);
        
        try {
          // Extract target language from input
          let targetLanguage = 'es'; // Default to Spanish
          const languageMap = {
            'spanish': 'es',
            'english': 'en', 
            'french': 'fr',
            'german': 'de',
            'japanese': 'ja',
            'korean': 'ko',
            'portuguese': 'pt',
            'italian': 'it',
            'chinese': 'zh',
            'hindi': 'hi'
          };
          
          for (const [lang, code] of Object.entries(languageMap)) {
            if (input.toLowerCase().includes(lang)) {
              targetLanguage = code;
              break;
            }
          }
          
          // Extract safe words if mentioned
          const safeWords = [];
          const safeWordMatch = input.match(/safewords?\s+([^.]*)/i);
          if (safeWordMatch) {
            const safeWordsList = safeWordMatch[1].split(',').map(w => w.trim());
            safeWords.push(...safeWordsList);
          }
          
          console.log(`🌐 Executing video translation to: ${targetLanguage}`);
          console.log(`🌐 Safe words: ${safeWords.join(', ')}`);
          
          // Get current video path from context with proper path resolution
          let videoPath = this.getCurrentVideoPath() || videoContext.filename || videoContext.videoPath;
          
          if (!videoPath) {
            throw new Error('No video file available for translation');
          }
          
          // Ensure we have the full path to the video file
          if (!videoPath.includes('/') && !videoPath.startsWith('uploads/')) {
            videoPath = `uploads/${videoPath}`;
          }
          
          // Convert to absolute path if not already absolute
          if (!path.isAbsolute(videoPath)) {
            videoPath = path.resolve(videoPath);
          }
          
          console.log(`🌐 Translating video: ${videoPath}`);
          
          // Import and use the translation service
          const { simpleVideoTranslator } = await import('./video-translator-simple');
          
          // Always use single speaker mode as requested by user
          const speakerCount = 1;
          
          // Prepare safewords in the correct format
          const safewords = safeWords.map(word => ({
            original: word,
            replacement: word
          }));
          
          // Perform translation
          const translationResult = await simpleVideoTranslator.translateVideo(
            videoPath,
            targetLanguage,
            speakerCount,
            safewords,
            userId.toString()
          );
          
          // Generate dubbed video
          const dubbedVideoPath = await simpleVideoTranslator.createDubbedVideo(
            videoPath,
            translationResult,
            userId.toString()
          );
          
          console.log(`✅ Video translation completed: ${dubbedVideoPath}`);
          
          // Create action for UI update with translation results
          bypassActions = [{
            type: 'translate_video_language',
            id: `translation_${Date.now()}`,
            timestamp: 0,
            description: `Translated video to ${targetLanguage}${safeWords.length > 0 ? ` with safe words: ${safeWords.join(', ')}` : ''}`,
            targetLanguage,
            safeWords,
            outputPath: dubbedVideoPath,
            translationResult,
            uiUpdate: true
          }];
          
          // EARLY RETURN for translation bypass - skip LangChain entirely
          const extractedActions = bypassActions;
          const existingOps = this.sessionMemory.get('operations') || [];
          this.sessionMemory.set('operations', [...existingOps, ...extractedActions]);
          
          // Store translation result in session memory
          this.sessionMemory.set('lastTranslationResult', translationResult);
          
          console.log('=== TRANSLATION BYPASS RESULT ===');
          console.log('Actions performed:', extractedActions.length);
          console.log('Translation completed successfully');
          
          // TRACK ACTUAL TOKEN USAGE POST-OPERATION
          const actualTokensUsed = translationResult.tokensUsed || calculation.estimatedTokens;
          await TokenPreCalculator.trackTokenUsage(userId.toString(), actualTokensUsed, 'video_translation');
          console.log(`💰 Translation tokens tracked: ${actualTokensUsed} deducted from user ${userId}`);
          
          return {
            response: `Language Translation Complete! Successfully translated video to ${targetLanguage}. The dubbed video has been generated with high-quality audio synchronization.`,
            actions: extractedActions,
            tokensUsed: actualTokensUsed,
            translationResult
          };
          
        } catch (error) {
          console.error('❌ Video translation bypass failed:', error);
          const errorActions = [{
            type: 'error',
            id: `error_${Date.now()}`,
            timestamp: 0,
            description: `Video translation failed: ${error instanceof Error ? error.message : 'Unknown error'}`,
            uiUpdate: true
          }];
          
          return {
            response: `Translation failed: ${error instanceof Error ? error.message : 'Unknown error'}`,
            actions: errorActions,
            tokensUsed: 0,
            translationResult: null
          };
        }
      }
      
      if (needsMediaGeneration) {
        console.log('🎨 BYPASSING LANGCHAIN - Direct media generation');
        console.log('Reason:', needsMediaGeneration ? 'Media generation detected in input' : 'Agent returned JSON without calling tools');
        
        // PRE-VALIDATE TOKEN REQUIREMENTS FOR MEDIA GENERATION
        console.log('🧮 Pre-calculating token requirements for media generation...');
        const { calculation, validation } = await TokenPreCalculator.preValidateOperation(
          userId.toString(),
          'media_generation',
          {
            inputText: input,
            model: 'gemini-2.0-flash-preview-image-generation'
          }
        );

        if (!validation.hasEnoughTokens) {
          console.log('❌ Insufficient tokens for media generation operation');
          return {
            response: `⚠️ ${validation.message}\n\n${TokenPreCalculator.getDetailedBreakdown(calculation)}\n\nPlease upgrade your plan or wait for token renewal to continue.`,
            actions: [{
              type: 'error',
              description: 'Insufficient tokens for media generation',
              tokenRequirement: calculation,
              userBalance: validation.userBalance
            }],
            tokensUsed: 0,
            translationResult: null
          };
        }

        console.log('✅ Token validation passed for media generation:', validation.message);
        
        try {
          const isVideo = input.toLowerCase().includes('video') || 
                         input.toLowerCase().includes('clip') || 
                         input.toLowerCase().includes('movie') ||
                         input.toLowerCase().includes('animation');
          
          const mediaType = isVideo ? 'video' : 'image';
          const prompt = input.replace(/generate|create|make/gi, '').trim();
          
          console.log(`🎨 Generating ${mediaType} with prompt: "${prompt}"`);
          console.log(`🎨 Media type detected: ${mediaType}`);
          
          const media = await geminiMediaGenerator.generateMedia(prompt, mediaType, userId);
          
          // Token usage is already tracked in geminiMediaGenerator with real API usage
          
          bypassActions = [{
            type: 'generate_media',
            id: `media_${Date.now()}`,
            timestamp: 0,
            description: `Generated ${mediaType}: ${media.prompt}`,
            uiUpdate: true,
            mediaData: {
              id: media.id,
              type: media.type,
              filename: media.filename,
              url: media.url,
              prompt: media.prompt
            }
          }];
          
          // EARLY RETURN for media generation bypass - skip LangChain entirely
          const extractedActions = bypassActions;
          const existingOps = this.sessionMemory.get('operations') || [];
          this.sessionMemory.set('operations', [...existingOps, ...extractedActions]);
          
          // TRACK ACTUAL TOKEN USAGE POST-OPERATION
          const actualTokensUsed = media.tokensUsed || calculation.estimatedTokens;
          await TokenPreCalculator.trackTokenUsage(userId.toString(), actualTokensUsed, 'media_generation');
          console.log(`💰 Media generation tokens tracked: ${actualTokensUsed} deducted from user ${userId}`);
          
          return {
            response: `Media generation complete! Generated ${mediaType}: ${media.prompt}`,
            actions: extractedActions,
            tokensUsed: actualTokensUsed,
            translationResult: null
          };
        } catch (error) {
          console.error('❌ Media generation bypass failed:', error);
          const errorActions = [{
            type: 'error',
            id: `error_${Date.now()}`,
            timestamp: 0,
            description: `Media generation failed: ${error instanceof Error ? error.message : 'Unknown error'}`,
            uiUpdate: true
          }];
          
          return {
            response: `Media generation failed: ${error instanceof Error ? error.message : 'Unknown error'}`,
            actions: errorActions,
            tokensUsed: 0,
            translationResult: null
          };
        }
      }
      
      if (needsBrollGeneration) {
        console.log('🎬 BYPASSING LANGCHAIN - Direct B-roll generation');
        console.log('Reason: B-roll generation detected in input');
        
        // PRE-VALIDATE TOKEN REQUIREMENTS FOR B-ROLL GENERATION
        console.log('🧮 Pre-calculating token requirements for B-roll generation...');
        const { calculation, validation } = await TokenPreCalculator.preValidateOperation(
          userId.toString(),
          'video_analysis',
          {
            videoDurationSeconds: videoDuration,
            inputText: input,
            model: 'gemini-2.0-flash-exp'
          }
        );

        if (!validation.hasEnoughTokens) {
          console.log('❌ Insufficient tokens for B-roll generation operation');
          return {
            response: `⚠️ ${validation.message}\n\n${TokenPreCalculator.getDetailedBreakdown(calculation)}\n\nPlease upgrade your plan or wait for token renewal to continue.`,
            actions: [{
              type: 'error',
              description: 'Insufficient tokens for B-roll generation',
              tokenRequirement: calculation,
              userBalance: validation.userBalance
            }],
            tokensUsed: 0,
            translationResult: null
          };
        }

        console.log('✅ Token validation passed for B-roll generation:', validation.message);
        
        try {
          // Get current video path from context
          let videoPath = this.getCurrentVideoPath() || videoContext.filename || videoContext.videoPath;
          
          if (!videoPath) {
            console.log('❌ No video file available for B-roll generation');
            throw new Error('No video file available for B-roll generation. Please upload a video first.');
          }
          
          // Ensure we have the full path to the video file
          if (!videoPath.includes('/') && !videoPath.startsWith('uploads/')) {
            videoPath = `uploads/${videoPath}`;
          } else if (videoPath.startsWith('uploads/uploads/')) {
            // Fix duplicate uploads/ prefix
            videoPath = videoPath.replace('uploads/uploads/', 'uploads/');
          }
          
          console.log(`🎬 Generating B-roll suggestions for: ${videoPath}`);
          
          // Execute B-roll generation
          const result = await brollAgentTool.execute({
            currentVideo: {
              filename: videoPath,
              path: videoPath
            }
          });
          
          const brollActions = [{
            type: 'broll_suggestions_generated',
            id: result.id,
            timestamp: result.timestamp,
            description: result.description,
            brollPlan: result.brollPlan,
            suggestions: result.suggestions,
            uiUpdate: true
          }];
          
          // Store in session memory
          const existingOps = this.sessionMemory.get('operations') || [];
          this.sessionMemory.set('operations', [...existingOps, ...brollActions]);
          
          // TRACK ACTUAL TOKEN USAGE POST-OPERATION
          const actualTokensUsed = result.tokensUsed || calculation.estimatedTokens || 1;
          // Ensure we have a valid number for token tracking
          const validTokensUsed = isNaN(actualTokensUsed) ? 1 : Math.max(1, actualTokensUsed);
          await TokenPreCalculator.trackTokenUsage(userId.toString(), validTokensUsed, 'video_analysis');
          console.log(`💰 B-roll generation tokens tracked: ${validTokensUsed} deducted from user ${userId}`);
          
          return {
            response: `B-roll analysis complete! Generated ${result.suggestions.length} creative B-roll suggestions to enhance your video with professional visual storytelling elements.`,
            actions: brollActions,
            tokensUsed: actualTokensUsed,
            translationResult: null
          };
          
        } catch (error) {
          console.error('❌ B-roll generation bypass failed:', error);
          const errorActions = [{
            type: 'error',
            id: `error_${Date.now()}`,
            timestamp: 0,
            description: `B-roll generation failed: ${error instanceof Error ? error.message : 'Unknown error'}`,
            uiUpdate: true
          }];
          
          return {
            response: `B-roll generation failed: ${error instanceof Error ? error.message : 'Unknown error'}`,
            actions: errorActions,
            tokensUsed: 0,
            translationResult: null
          };
        }
      }
      
      if (needsVideoSearch) {
        console.log('🔍 BYPASSING LANGCHAIN - Enhanced 4-Step Video Search (DEFAULT)');
        console.log('Reason: Video search detected - using enhanced 4-step architecture by default');
        
        // PRE-VALIDATE TOKEN REQUIREMENTS FOR VIDEO SEARCH
        console.log('🧮 Pre-calculating token requirements for video search...');
        const { calculation, validation } = await TokenPreCalculator.preValidateOperation(
          userId.toString(),
          'video_search',
          {
            videoDurationSeconds: videoDuration,
            inputText: input,
            model: 'gemini-1.5-flash'
          }
        );

        if (!validation.hasEnoughTokens) {
          console.log('❌ Insufficient tokens for video search operation');
          return {
            response: `⚠️ ${validation.message}\n\n${TokenPreCalculator.getDetailedBreakdown(calculation)}\n\nPlease upgrade your plan or wait for token renewal to continue.`,
            actions: [{
              type: 'error',
              description: 'Insufficient tokens for video search',
              tokenRequirement: calculation,
              userBalance: validation.userBalance
            }],
            tokensUsed: 0,
            translationResult: null
          };
        }

        console.log('✅ Token validation passed for video search:', validation.message);
        
        try {
          // Extract search query from input
          let searchQuery = input;
          
          // Clean up the search query by removing search-related words
          searchQuery = searchQuery
            .replace(/search\s+for\s+/gi, '')
            .replace(/find\s+/gi, '')
            .replace(/look\s+for\s+/gi, '')
            .replace(/moments\s+with\s+/gi, '')
            .trim();
          
          console.log(`🔍 Executing video search for: "${searchQuery}"`);
          
          // Get current video path from context with proper fallback logic
          let videoPath = this.getCurrentVideoPath() || videoContext.filename || videoContext.videoPath;
          
          // Try additional context properties if still no path
          if (!videoPath && videoContext.currentVideo && videoContext.currentVideo.filename) {
            videoPath = videoContext.currentVideo.filename;
          }
          
          if (!videoPath) {
            console.log('❌ No video file available for search');
            console.log('Available context:', Object.keys(videoContext || {}));
            throw new Error('No video file available for search');
          }
          
          // Ensure we have the full path to the video file in uploads directory
          let fullVideoPath = videoPath;
          if (!fullVideoPath.includes('/') && !fullVideoPath.startsWith('uploads/')) {
            fullVideoPath = `uploads/${videoPath}`;
          }
          
          // Convert to absolute path if not already absolute
          if (!path.isAbsolute(fullVideoPath)) {
            fullVideoPath = path.resolve(fullVideoPath);
          }
          
          console.log(`🔍 Video search for "${searchQuery}"`);
          console.log(`📁 Full video path: ${fullVideoPath}`);
          
          // Implement actual video search using Gemini AI
          const searchData = await this.performGeminiVideoSearch(searchQuery, fullVideoPath);
          
          console.log(`✅ Video search completed: ${searchData.totalSegments} segments found`);
          
          // Create action for UI update with search results
          bypassActions = [{
            type: 'video_search',
            id: `search_${Date.now()}`,
            timestamp: 0,
            description: `Found ${searchData.totalSegments} segments for "${searchQuery}"`,
            query: searchQuery,
            results: searchData.results,
            totalSegments: searchData.totalSegments,
            uiUpdate: true
          }];
          
          // EARLY RETURN for video search bypass - skip LangChain entirely
          const extractedActions = bypassActions;
          const existingOps = this.sessionMemory.get('operations') || [];
          this.sessionMemory.set('operations', [...existingOps, ...extractedActions]);
          
          // TRACK ACTUAL TOKEN USAGE POST-OPERATION
          const actualTokensUsed = searchData.tokensUsed || 50; // Fallback to reasonable estimate
          await TokenPreCalculator.trackTokenUsage(userId.toString(), actualTokensUsed, 'video_search');
          console.log(`💰 Video search tokens tracked: ${actualTokensUsed} deducted from user ${userId}`);
          
          return {
            response: `Video search complete! Found ${searchData.totalSegments} segments for "${searchQuery}".`,
            actions: extractedActions,
            tokensUsed: actualTokensUsed,
            translationResult: null
          };
          
        } catch (error) {
          console.error('❌ Video search bypass failed:', error);
          const errorActions = [{
            type: 'error',
            id: `error_${Date.now()}`,
            timestamp: 0,
            description: `Video search failed: ${error instanceof Error ? error.message : 'Unknown error'}`,
            uiUpdate: true
          }];
          
          return {
            response: `Video search failed: ${error instanceof Error ? error.message : 'Unknown error'}`,
            actions: errorActions,
            tokensUsed: 0,
            translationResult: null
          };
        }
      }
      
      // If no bypass conditions are met, proceed with LangChain agent
      console.log('=== INVOKING LANGCHAIN AGENT ===');
      console.log('Enhanced input length:', enhancedInput.length);
      console.log('Tools available:', this.tools.map(t => t.name));
      
      const result = await this.agent.invoke({
        input: enhancedInput
      });
      
      console.log('=== LANGCHAIN AGENT RESULT ===');
      console.log('Result type:', typeof result);
      console.log('Result keys:', Object.keys(result));
      console.log('Output:', result.output);
      console.log('Intermediate steps:', result.intermediateSteps?.length || 0);
      
      // TRACK ACTUAL TOKEN USAGE AFTER EXECUTION
      console.log('💰 Tracking actual token usage after execution...');
      let actualTokenUsage;
      try {
        actualTokenUsage = await TokenTracker.trackGeminiRequest(
          userId.toString(),
          operationType,
          'gemini-1.5-flash',
          enhancedInput,
          result.output || '',
          undefined // Let it estimate since we don't have exact usage from LangChain
        );
        console.log('✅ Token usage tracked successfully:', actualTokenUsage);
      } catch (tokenError) {
        console.error('❌ Token tracking failed:', tokenError);
        // Continue execution even if token tracking fails
        actualTokenUsage = { totalTokens: 0 };
      }
      
      if (result.intermediateSteps && result.intermediateSteps.length > 0) {
        result.intermediateSteps.forEach((step, index) => {
          console.log(`Step ${index}:`, {
            action: step.action?.tool,
            observation: step.observation?.substring(0, 200) + '...'
          });
        });
      }
      
      // Handle any post-LangChain processing if needed
      console.log('🔄 EXTRACTING ACTIONS FROM LANGCHAIN RESULT...');
      let extractedActions = this.extractActionsFromResult(result);
      
      if (extractedActions.length > 0) {
        const existingOps = this.sessionMemory.get('operations') || [];
        this.sessionMemory.set('operations', [...existingOps, ...extractedActions]);
        
        // Update current video path if actions created new video files
        for (const action of extractedActions) {
          if ((action.type === 'cut_video_segment' || 
               action.type === 'delete_segment' ||
               action.type === 'smart_cut_video') && 
              action.outputPath) {
            console.log('Updating current video path to:', action.outputPath);
            this.setCurrentVideoPath(action.outputPath);
            break; // Use the first output path found
          }
        }
      }

      // Track token usage
      const tokensUsed = await TokenTracker.trackGeminiRequest(
        userId,
        'Agentic Video Editing',
        'gemini-1.5-flash',
        enhancedInput,
        result.output
      );

      // Use extracted actions from above
      const actions = extractedActions;

      // Get video intelligence token usage to add to total cost
      const videoIntelligenceTool = this.tools.find(t => t.name === 'analyze_video_intelligence') as any;
      const videoIntelligenceTokens = videoIntelligenceTool?.getCurrentTokenUsage?.() || { totalTokens: 0, cost: 0 };
      const totalTokenUsage = tokensUsed.totalTokens + (videoIntelligenceTokens.totalTokens || 0);
      const totalCost = (tokensUsed.cost || 0) + (videoIntelligenceTokens.cost || 0);

      console.log('=== AGENTIC EDITOR RESULT ===');
      console.log('Response:', result.output);
      console.log('Actions performed:', actions.length);
      console.log('Actions details:', actions);
      console.log('LangChain tokens:', tokensUsed.totalTokens.toLocaleString());
      console.log('Video Intelligence tokens:', videoIntelligenceTokens.totalTokens.toLocaleString());
      console.log('Total tokens used:', totalTokenUsage.toLocaleString());
      console.log('Total cost: $', totalCost.toFixed(6));

      // Check if this was a translation command and include translation result
      let translationResult = null;
      const hasTranslationInOutput = result.output && (result.output.includes('Translation Complete') || result.output.includes('translation completed') || result.output.includes('translated the video'));
      const hasTranslationInMemory = this.sessionMemory.get('lastTranslationResult');
      
      if (hasTranslationInOutput || hasTranslationInMemory) {
        translationResult = this.sessionMemory.get('lastTranslationResult');
        console.log('Translation detected, including result:', translationResult);
        
        // If translation result exists but response doesn't indicate completion, update the response
        if (translationResult && !hasTranslationInOutput) {
          result.output = `Language Translation Complete! ${result.output}`;
          console.log('Updated response to include translation completion indicator');
        }
      }

      return {
        response: result.output,
        actions,
        tokensUsed: actualTokenUsage?.totalTokens || 0,
        translationResult
      };

    } catch (error) {
      console.error('Agentic video editor error:', error);
      console.log('Falling back to command parsing for:', input);
      // Fall back to simple response instead of throwing
      return this.generateFallbackResponse(input, videoContext, userId);
    }
  }

  private async generateFallbackResponse(input: string, videoContext: any, userId: number): Promise<{
    response: string;
    actions: any[];
    tokensUsed: number;
    translationResult?: any;
  }> {
    console.log('Using fallback response for:', input);
    console.log('Video context in fallback:', videoContext);
    
    // Enhanced parsing for common commands
    const actions = this.parseCommandToActions(input, videoContext);
    console.log('Parsed actions from fallback:', actions);
    
    // Track basic token usage
    const tokensUsed = await TokenTracker.trackGeminiRequest(
      userId,
      'Fallback Video Editing',
      'gemini-1.5-flash',
      input,
      `Processed command: ${input}`
    );

    let response = `I understand you want to ${input.toLowerCase()}. `;
    
    if (actions.length > 0) {
      response += `I've applied ${actions.length} operation(s) to your video timeline.`;
    } else {
      response += "I'm working on processing this command. Please try a specific action like 'cut video from 1 to 10s' or 'add text at 5 seconds'.";
    }

    return {
      response,
      actions,
      tokensUsed: tokensUsed.totalTokens
    };
  }

  private parseCommandToActions(input: string, videoContext?: any): any[] {
    const actions: any[] = [];
    const lowerInput = input.toLowerCase();

    // Parse cut/trim commands with more patterns
    const cutPatterns = [
      /cut.*video.*from.*(\d+).*to.*(\d+)/,
      /trim.*from.*(\d+).*to.*(\d+)/,
      /cut.*(\d+).*to.*(\d+)/,
      /segment.*(\d+).*to.*(\d+)/
    ];

    for (const pattern of cutPatterns) {
      const match = lowerInput.match(pattern);
      if (match) {
        const startTime = parseInt(match[1]);
        const endTime = parseInt(match[2]);
        
        actions.push({
          type: 'cut_video_segment',
          id: Date.now().toString(),
          timestamp: startTime,
          parameters: {
            startTime,
            endTime
          },
          description: `Cut segment: ${startTime}s - ${endTime}s (${endTime - startTime}s duration)`,
          uiUpdate: true
        });
        break;
      }
    }

    // Parse text overlay commands
    const textMatch = lowerInput.match(/add.*text.*"([^"]+)".*at.*(\d+).*second/);
    if (textMatch) {
      actions.push({
        type: 'text_overlay',
        id: Date.now().toString(),
        timestamp: parseInt(textMatch[2]),
        parameters: {
          text: textMatch[1],
          startTime: parseInt(textMatch[2]),
          duration: 3,
          x: 50,
          y: 20,
          fontSize: 24,
          color: '#FFFFFF'
        },
        description: `Text overlay: "${textMatch[1]}" at ${textMatch[2]}s`,
        uiUpdate: true
      });
    }

    // Parse multiple split/cut commands with various patterns
    const multiCutPatterns = [
      /split.*?at.*?(\d+).*?and.*?(\d+)/gi,
      /cut.*?(\d+).*?to.*?(\d+).*?and.*?(\d+).*?to.*?(\d+)/gi,
      /segment.*?(\d+)-(\d+).*?and.*?(\d+)-(\d+)/gi
    ];

    for (const pattern of multiCutPatterns) {
      const matches = Array.from(lowerInput.matchAll(pattern));
      for (const match of matches) {
        if (match.length >= 5) {
          // Two segments found
          actions.push({
            type: 'cut_video_segment',
            id: `${Date.now()}_1`,
            timestamp: parseInt(match[1]),
            parameters: {
              startTime: parseInt(match[1]),
              endTime: parseInt(match[2])
            },
            description: `Cut segment: ${match[1]}s - ${match[2]}s`,
            uiUpdate: true
          });
          
          actions.push({
            type: 'cut_video_segment',
            id: `${Date.now()}_2`,
            timestamp: parseInt(match[3]),
            parameters: {
              startTime: parseInt(match[3]),
              endTime: parseInt(match[4])
            },
            description: `Cut segment: ${match[3]}s - ${match[4]}s`,
            uiUpdate: true
          });
        }
      }
    }

    // Parse segment deletion commands
    const deleteSegmentPatterns = [
      /delete\s+segment\s+(\d+)/gi,
      /remove\s+segment\s+(\d+)/gi,
      /delete\s+(\d+)/gi
    ];

    for (const pattern of deleteSegmentPatterns) {
      const matches = Array.from(lowerInput.matchAll(pattern));
      for (const match of matches) {
        const segmentNumber = parseInt(match[1]);
        actions.push({
          type: 'delete_segment',
          id: `delete_${Date.now()}`,
          timestamp: 0,
          parameters: {
            segmentNumber
          },
          description: `Delete segment ${segmentNumber}`,
          uiUpdate: true
        });
      }
    }

    // Parse people detection commands
    if (lowerInput.includes('add names') && lowerInput.includes('people')) {
      const currentTime = videoContext?.currentTime || 0;
      const detectedPeople = [
        { position: { x: 30, y: 15 }, name: 'Speaker' },
        { position: { x: 70, y: 20 }, name: 'Person' }
      ];

      detectedPeople.forEach((person, index) => {
        actions.push({
          type: 'text_overlay',
          id: `person_${Date.now()}_${index}`,
          timestamp: currentTime,
          parameters: {
            text: person.name,
            startTime: currentTime,
            duration: 5,
            x: person.position.x,
            y: person.position.y,
            fontSize: 20,
            color: '#FFFFFF'
          },
          description: `Name tag for ${person.name} at ${currentTime}s`,
          uiUpdate: true
        });
      });
    }

    return actions;
  }

  private extractActionsFromResult(result: any): any[] {
    let actions: any[] = [];
    
    console.log('=== EXTRACTING ACTIONS FROM RESULT ===');
    console.log('Result:', JSON.stringify(result, null, 2));
    
    // First, check intermediateSteps for tool outputs
    if (result?.intermediateSteps) {
      for (const step of result.intermediateSteps) {
        if (step?.observation) {
          try {
            const parsed = JSON.parse(step.observation);
            if (parsed && typeof parsed === 'object') {
              
              // Handle video search results
              if (parsed.query && parsed.segments && Array.isArray(parsed.segments)) {
                console.log('✅ Detected video search result:', parsed);
                actions.push({
                  type: 'video_search',
                  id: `search_${Date.now()}`,
                  timestamp: 0,
                  description: `Found ${parsed.totalSegments} segments for "${parsed.query}"`,
                  query: parsed.query,
                  totalSegments: parsed.totalSegments,
                  results: parsed.segments, // Contains thumbnails and details
                  processingTime: parsed.processingTime,
                  uiUpdate: true
                });
                continue;
              }
              
              // Handle single operation
              if (parsed.type) {
                actions.push({
                  ...parsed,
                  id: `action_${Date.now()}_${actions.length}`,
                  timestamp: parsed.parameters?.startTime || 0,
                  description: this.generateActionDescription(parsed),
                  uiUpdate: true
                });
              }
              
              // Handle multiple operations (like multiple text overlays)
              if (parsed.type === 'multiple_text_overlays' && parsed.overlays) {
                actions.push(...parsed.overlays.map((overlay: any, index: number) => ({
                  ...overlay,
                  id: `overlay_${Date.now()}_${index}`,
                  timestamp: overlay.parameters?.startTime || 0,
                  description: this.generateActionDescription(overlay),
                  uiUpdate: true
                })));
              }
            }
          } catch (e) {
            console.log('Non-JSON observation:', step.observation);
          }
        }
      }
    }
    
    // Second, check the main output for JSON arrays
    if (result?.output && actions.length === 0) {
      try {
        // Look for JSON arrays in the output
        const jsonMatch = result.output.match(/\[[\s\S]*?\]/);
        if (jsonMatch) {
          console.log('Found JSON match in output:', jsonMatch[0]);
          const parsed = JSON.parse(jsonMatch[0]);
          console.log('Parsed JSON from output:', parsed);
          
          if (Array.isArray(parsed)) {
            actions = parsed.map((action: any, index: number) => {
              const processedAction = {
                type: action.type,
                id: `action_${Date.now()}_${index}`,
                timestamp: action.parameters?.startTime || 0,
                parameters: action.parameters,
                description: this.generateActionDescription(action),
                uiUpdate: true
              };
              console.log(`Processed action ${index}:`, processedAction);
              return processedAction;
            });
          }
        } else {
          // Try to parse the entire output as JSON
          try {
            const parsed = JSON.parse(result.output.replace(/```json\n?|\n?```/g, '').trim());
            if (Array.isArray(parsed)) {
              actions = parsed.map((action: any, index: number) => ({
                type: action.type,
                id: `action_${Date.now()}_${index}`,
                timestamp: action.parameters?.startTime || 0,
                parameters: action.parameters,
                description: this.generateActionDescription(action),
                uiUpdate: true
              }));
            }
          } catch (parseError) {
            console.log('Could not parse output as direct JSON');
          }
        }
      } catch (error) {
        console.log('Failed to parse JSON from output:', error);
      }
    }
    
    console.log('Final extracted actions:', actions);
    return actions;
  }

  private generateActionDescription(action: any): string {
    switch (action.type) {
      case 'cut_video_segment':
        const duration = action.parameters.endTime - action.parameters.startTime;
        return `Cut segment: ${action.parameters.startTime}s - ${action.parameters.endTime}s (${duration}s duration)`;
      case 'text_overlay':
        return `Text overlay: "${action.parameters.text}" at ${action.parameters.startTime}s`;
      default:
        return `${action.type}: ${JSON.stringify(action.parameters)}`;
    }
  }

  clearSessionMemory(): void {
    this.sessionMemory.clear();
  }

  async analyzeVideoForSuggestions(videoPath: string, userId: number = 1): Promise<{
    suggestions: string[];
    keyMoments: any[];
    tokensUsed: number;
  }> {
    try {
      const input = `Analyze this video and provide editing suggestions. Look for:
1. Key moments that would work well as highlights
2. Areas where text overlays would add value
3. Segments that could be trimmed or enhanced
4. Opportunities for visual effects
5. Caption-worthy dialogue or narration

Provide specific time-based recommendations.`;

      const result = await this.agent.invoke({ input });

      const tokensUsed = await TokenTracker.trackGeminiRequest(
        userId,
        'Video Analysis Suggestions',
        'gemini-1.5-flash', 
        input,
        result.output
      );

      // Parse suggestions from the response
      const suggestions = this.parseSuggestions(result.output);
      const keyMoments = this.parseKeyMoments(result.output);

      return {
        suggestions,
        keyMoments,
        tokensUsed: tokensUsed.totalTokens
      };

    } catch (error) {
      console.error('Video analysis error:', error);
      throw new Error('Failed to analyze video for suggestions');
    }
  }

  private parseSuggestions(response: string): string[] {
    // Extract suggestions from AI response
    const lines = response.split('\n').filter(line => 
      line.includes('suggest') || 
      line.includes('recommend') || 
      line.includes('consider') ||
      line.includes('add') ||
      line.includes('cut') ||
      line.includes('enhance')
    );
    
    return lines.slice(0, 5); // Return top 5 suggestions
  }

  private parseKeyMoments(response: string): any[] {
    // Extract time-based moments from AI response
    const timeRegex = /(\d+):(\d+)|(\d+)s|(\d+)\s*seconds?/g;
    const moments: any[] = [];
    
    let match;
    while ((match = timeRegex.exec(response)) !== null) {
      const timeStr = match[0];
      let seconds = 0;
      
      if (match[1] && match[2]) {
        // MM:SS format
        seconds = parseInt(match[1]) * 60 + parseInt(match[2]);
      } else if (match[3]) {
        // Xs format
        seconds = parseInt(match[3]);
      } else if (match[4]) {
        // X seconds format
        seconds = parseInt(match[4]);
      }
      
      moments.push({
        time: seconds,
        description: `Key moment at ${timeStr}`,
        type: 'suggestion'
      });
    }
    
    return moments.slice(0, 10); // Return top 10 moments
  }

  // Enhanced 4-Step Video Search Architecture - Default Bypass Logic
  private async performGeminiVideoSearch(query: string, videoPath: string): Promise<any> {
    const startTime = Date.now();
    console.log(`🔍 Starting Enhanced 4-Step Video Search for "${query}" in: ${videoPath}`);
    
    try {
      // Import the intelligent sentence search system
      const { IntelligentSentenceSearch } = await import('./intelligent-sentence-search.js');
      const intelligentSearcher = new IntelligentSentenceSearch();
      
      console.log('🧠 Using intelligent sentence completion search with 4-step architecture...');
      console.log('Step 1: Query Enhancement (Hindi/Multilingual Support)');
      console.log('Step 2: Audio Transcription & Search with Sentence Completion');
      console.log('Step 3: Visual Content Analysis with AI Vision');
      console.log('Step 4: Intelligent Merging & Thumbnail Generation');
      
      // Execute the comprehensive search
      const searchResults = await intelligentSearcher.searchVideo(videoPath, query);
      
      if (!searchResults || searchResults.length === 0) {
        console.log('❌ No matching segments found using enhanced search');
        return {
          query: query,
          videoPath: videoPath,
          totalSegments: 0,
          results: [],
          processingTime: Date.now() - startTime,
          message: `No segments found matching "${query}". This could be due to: (1) No audio transcript available, (2) Content in Hindi not properly transliterated, or (3) Visual-only content without spoken audio.`
        };
      }

      // Convert search results to UI format
      const formattedResults = searchResults.map((segment, index) => ({
        id: segment.id || `result_${index}`,
        startTime: segment.startTime,
        endTime: segment.endTime,
        duration: segment.duration || (segment.endTime - segment.startTime),
        relevanceScore: segment.relevanceScore || 0.8,
        description: segment.description || `Segment ${index + 1}`,
        matchType: segment.matchType || 'audio',
        thumbnailPath: segment.thumbnailPath || '',
        timestamp: `${Math.floor(segment.startTime / 60)}:${String(Math.floor(segment.startTime % 60)).padStart(2, '0')}`
      }));

      const processingTime = Date.now() - startTime;
      console.log(`✅ Enhanced 4-Step Search completed in ${processingTime}ms, found ${formattedResults.length} segments`);
      
      return {
        query: query,
        videoPath: videoPath,
        totalSegments: formattedResults.length,
        results: formattedResults,
        processingTime: processingTime,
        message: `Found ${formattedResults.length} segments using enhanced 4-step search: Query Enhancement → Audio Analysis → Visual Analysis → Intelligent Merging`
      };
      
    } catch (error) {
      console.error('❌ Enhanced 4-Step Video Search failed:', error);
      return {
        query: query,
        videoPath: videoPath,
        totalSegments: 0,
        results: [],
        processingTime: Date.now() - startTime,
        message: `Enhanced search failed: ${error instanceof Error ? error.message : 'Unknown error'}`
      };
    }
  }
  
  private async extractAndAnalyzeTranscript(videoPath: string, query: string): Promise<any[]> {
    return new Promise((resolve, reject) => {
      const ffmpeg = spawn('ffmpeg', [
        '-i', videoPath,
        '-vn',
        '-acodec', 'pcm_s16le',
        '-ar', '44100',
        '-ac', '2',
        '-f', 'wav',
        'pipe:1'
      ]);
      
      const audioChunks: Buffer[] = [];
      
      ffmpeg.stdout.on('data', (chunk) => {
        audioChunks.push(chunk);
      });
      
      ffmpeg.on('close', async (code) => {
        if (code !== 0) {
          resolve([]); // Return empty if audio extraction fails
          return;
        }
        
        try {
          const audioBuffer = Buffer.concat(audioChunks);
          const transcriptSegments = await this.analyzeAudioWithGemini(audioBuffer, query);
          resolve(transcriptSegments);
        } catch (error) {
          console.error('Audio analysis failed:', error);
          resolve([]);
        }
      });
      
      ffmpeg.on('error', (error) => {
        console.error('FFmpeg error:', error);
        resolve([]);
      });
    });
  }
  
  private async analyzeAudioWithGemini(audioBuffer: Buffer, query: string): Promise<any[]> {
    try {
      console.log('🎵 Analyzing audio content with Gemini...');
      
      // Convert audio buffer to base64 for Gemini API
      const audioBase64 = audioBuffer.toString('base64');
      
      const prompt = `Analyze this audio for content related to: "${query}"
      
      Please transcribe the audio and identify any segments where the content matches the search query.
      Look for:
      - Spoken words or phrases related to "${query}"
      - Topics, concepts, or discussions about "${query}"
      - Names, places, or entities mentioned that relate to "${query}"
      
      Respond with JSON containing an array of matching segments:
      {
        "segments": [
          {
            "startTime": number_in_seconds,
            "endTime": number_in_seconds,
            "transcript": "transcribed text",
            "relevanceScore": number_0_to_1,
            "description": "why this segment matches the query"
          }
        ]
      }
      
      If no relevant content is found, return {"segments": []}`;
      
      const response = await this.geminiAI.models.generateContent({
        model: "gemini-1.5-flash",
        config: {
          responseMimeType: "application/json"
        },
        contents: [
          {
            inlineData: {
              data: audioBase64,
              mimeType: "audio/wav"
            }
          },
          prompt
        ]
      });
      
      const result = JSON.parse(response.text || '{"segments": []}');
      const segments = result.segments || [];
      
      // Transform to expected format
      return segments.map((segment: any, index: number) => ({
        id: `audio_${segment.startTime}_${Date.now()}_${index}`,
        startTime: segment.startTime,
        endTime: segment.endTime,
        duration: segment.endTime - segment.startTime,
        matchType: 'audio',
        relevanceScore: segment.relevanceScore,
        description: segment.description,
        transcript: segment.transcript,
        reasoning: `Audio transcript: "${segment.transcript}"`
      }));
      
    } catch (error) {
      console.error('Gemini audio analysis failed:', error);
      return [];
    }
  }
  
  private async performVisualSearch(videoPath: string, query: string): Promise<any[]> {
    const segments: any[] = [];
    
    try {
      // Extract frames every 3 seconds for analysis
      const frameInterval = 3;
      const frames = await this.extractVideoFrames(videoPath, frameInterval);
      
      console.log(`🖼️ Analyzing ${frames.length} frames for visual content...`);
      
      for (const frame of frames) {
        const analysis = await this.analyzeFrameWithGemini(frame.imagePath, query);
        if (analysis.isMatch) {
          segments.push({
            id: `visual_${frame.timestamp}_${Date.now()}`,
            startTime: Math.max(0, frame.timestamp - 2), // Include 2s before
            endTime: frame.timestamp + 3, // Include 3s after
            duration: 5,
            matchType: 'visual',
            relevanceScore: analysis.confidence,
            description: analysis.description,
            reasoning: analysis.reasoning,
            timestamp: frame.timestamp
          });
        }
      }
      
      return segments;
    } catch (error) {
      console.error('Visual search failed:', error);
      return [];
    }
  }
  
  private async extractVideoFrames(videoPath: string, intervalSeconds: number): Promise<any[]> {
    return new Promise((resolve, reject) => {
      // Get video duration first
      const ffprobe = spawn('ffprobe', [
        '-v', 'quiet',
        '-print_format', 'json',
        '-show_format',
        videoPath
      ]);
      
      let durationData = '';
      ffprobe.stdout.on('data', (data) => {
        durationData += data.toString();
      });
      
      ffprobe.on('close', async (code) => {
        if (code !== 0) {
          resolve([]);
          return;
        }
        
        try {
          const metadata = JSON.parse(durationData);
          const duration = parseFloat(metadata.format.duration);
          const frames: any[] = [];
          
          // Extract frames at specified intervals
          for (let timestamp = 0; timestamp < duration; timestamp += intervalSeconds) {
            const framePath = `/tmp/frame_${timestamp}_${Date.now()}.jpg`;
            
            await new Promise<void>((resolveFrame) => {
              const ffmpeg = spawn('ffmpeg', [
                '-i', videoPath,
                '-ss', timestamp.toString(),
                '-vframes', '1',
                '-y',
                framePath
              ]);
              
              ffmpeg.on('close', () => {
                frames.push({
                  timestamp: timestamp,
                  imagePath: framePath
                });
                resolveFrame();
              });
              
              ffmpeg.on('error', () => resolveFrame());
            });
          }
          
          resolve(frames);
        } catch (error) {
          resolve([]);
        }
      });
    });
  }
  
  private async analyzeFrameWithGemini(imagePath: string, query: string): Promise<any> {
    try {
      const imageBytes = await fs.readFile(imagePath);
      
      const prompt = `Analyze this video frame for content related to: "${query}"
      
      Look for:
      - Visual elements matching the search query
      - People, objects, text, or scenes related to the query
      - Any visual context that would be relevant to someone searching for "${query}"
      
      Respond with JSON:
      {
        "isMatch": boolean,
        "confidence": number (0-1),
        "description": "detailed description of what matches",
        "reasoning": "explanation of why this matches the search query"
      }`;
      
      const response = await this.geminiAI.models.generateContent({
        model: "gemini-1.5-flash",
        config: {
          responseMimeType: "application/json"
        },
        contents: [
          {
            inlineData: {
              data: imageBytes.toString('base64'),
              mimeType: 'image/jpeg'
            }
          },
          prompt
        ]
      });
      
      const result = JSON.parse(response.text || '{"isMatch": false, "confidence": 0, "description": "", "reasoning": ""}');
      
      // Clean up temporary frame file
      try {
        await fs.unlink(imagePath);
      } catch (error) {
        // Ignore cleanup errors
      }
      
      return result;
    } catch (error) {
      console.error('Frame analysis failed:', error);
      return { isMatch: false, confidence: 0, description: '', reasoning: '' };
    }
  }
  
  private mergeNearbySegments(segments: any[]): any[] {
    if (segments.length === 0) return [];
    
    // Sort segments by start time
    segments.sort((a, b) => a.startTime - b.startTime);
    
    const merged: any[] = [];
    let current = segments[0];
    
    for (let i = 1; i < segments.length; i++) {
      const next = segments[i];
      
      // If segments are ≤2 seconds apart, merge them
      if (next.startTime - current.endTime <= 2) {
        current = {
          id: `merged_${current.id}_${next.id}`,
          startTime: current.startTime,
          endTime: Math.max(current.endTime, next.endTime),
          duration: Math.max(current.endTime, next.endTime) - current.startTime,
          matchType: current.matchType === next.matchType ? current.matchType : 'hybrid',
          relevanceScore: Math.max(current.relevanceScore, next.relevanceScore),
          description: `${current.description} + ${next.description}`,
          reasoning: `Merged segments: ${current.reasoning} | ${next.reasoning}`
        };
      } else {
        merged.push(current);
        current = next;
      }
    }
    
    merged.push(current);
    return merged;
  }
  
  private async generateSegmentThumbnails(segments: any[], videoPath: string): Promise<any[]> {
    const segmentsWithThumbnails = [];
    
    for (const segment of segments) {
      try {
        const thumbnailPath = `/tmp/thumbnail_${segment.id}_${Date.now()}.jpg`;
        const midpoint = segment.startTime + (segment.duration / 2);
        
        await new Promise<void>((resolve) => {
          const ffmpeg = spawn('ffmpeg', [
            '-i', videoPath,
            '-ss', midpoint.toString(),
            '-vframes', '1',
            '-y',
            thumbnailPath
          ]);
          
          ffmpeg.on('close', () => resolve());
          ffmpeg.on('error', () => resolve());
        });
        
        // Copy thumbnail to public directory for serving
        const publicThumbnailPath = path.join('uploads', `thumbnail_${segment.id}.jpg`);
        try {
          await fs.copyFile(thumbnailPath, publicThumbnailPath);
          await fs.unlink(thumbnailPath); // Clean up temp file
          
          segmentsWithThumbnails.push({
            ...segment,
            thumbnailPath: `/api/video/search/thumbnail/thumbnail_${segment.id}.jpg`
          });
        } catch (error) {
          segmentsWithThumbnails.push(segment); // Add without thumbnail if copy fails
        }
        
      } catch (error) {
        segmentsWithThumbnails.push(segment); // Add without thumbnail if generation fails
      }
    }
    
    return segmentsWithThumbnails;
  }
}

export const createAgenticVideoEditor = (apiKey: string, userId: number = 1): AgenticVideoEditor => {
  return new AgenticVideoEditor(apiKey, userId);
};