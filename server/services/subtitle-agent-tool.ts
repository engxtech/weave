import { Tool } from '@langchain/core/tools';
import { YouTubeShortsSubtitleSystem } from './youtube-shorts-subtitle-system.js';
import fs from 'fs';
import path from 'path';

export class YouTubeShortsSubtitleTool extends Tool {
  name = 'youtube_shorts_subtitle_generator';
  description = `Generate professional YouTube Shorts-style subtitles with word-level timing and highlighting effects. 
  This tool uses Deepgram for precise transcription, OpenAI for script enhancement, and creates Revideo scenes with:
  - Word-by-word highlighting with cyan current word color
  - Red background boxes for current words  
  - Batch subtitle display (4 words simultaneously)
  - Fade-in animations with opacity transitions
  - Professional shadow effects (black shadow with 30px blur)
  - Customizable caption settings (fontSize: 80, fontWeight: 800)
  
  Use this when users request:
  - "Add subtitles", "generate subtitles", "create captions"
  - "YouTube Shorts style subtitles", "professional subtitles"
  - "Word-level timing", "highlight subtitles", "animated subtitles"
  - Any subtitle generation requests for video content`;

  private subtitleSystem: YouTubeShortsSubtitleSystem;

  constructor() {
    super();
    this.subtitleSystem = new YouTubeShortsSubtitleSystem();
  }

  async _call(input: string): Promise<string> {
    try {
      const parsedInput = JSON.parse(input);
      const { videoPath, action = 'generate', settings = {}, style = 'viral', subtitleSettings = {} } = parsedInput;

      console.log(`[SubtitleAgentTool] Processing action: ${action} for video: ${videoPath}`);

      switch (action) {
        case 'generate':
          return await this.generateSubtitles(videoPath, settings, subtitleSettings);
        
        case 'enhance_script':
          const { transcript } = parsedInput;
          return await this.enhanceScript(transcript, style);
        
        case 'get_presets':
          return this.getPresets();
        
        default:
          return await this.generateSubtitles(videoPath, settings, subtitleSettings);
      }

    } catch (error) {
      console.error('[SubtitleAgentTool] Error:', error);
      return JSON.stringify({
        success: false,
        error: error instanceof Error ? error.message : 'Subtitle generation failed',
        action: 'show_error',
        message: 'Failed to generate subtitles. Please check the video file and try again.'
      });
    }
  }

  private async generateSubtitles(videoPath: string, settings: any = {}, subtitleSettings: any = {}): Promise<string> {
    if (!videoPath) {
      return JSON.stringify({
        success: false,
        error: 'Video path is required',
        action: 'show_error',
        message: 'Please specify a video file to generate subtitles for.'
      });
    }

    // Check if video file exists (try common paths)
    const possiblePaths = [
      videoPath,
      path.join('uploads', videoPath),
      path.join('uploads', path.basename(videoPath))
    ];

    let actualVideoPath: string | null = null;
    for (const possiblePath of possiblePaths) {
      if (fs.existsSync(possiblePath)) {
        actualVideoPath = possiblePath;
        break;
      }
    }

    if (!actualVideoPath) {
      return JSON.stringify({
        success: false,
        error: 'Video file not found',
        action: 'show_error',
        message: `Video file not found at: ${videoPath}. Please upload a video first.`
      });
    }

    try {
      // Generate YouTube Shorts-style subtitles
      const subtitles = await this.subtitleSystem.generateWordLevelSubtitles(actualVideoPath);
      
      // Merge default settings with user preferences
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
        ...settings
      };

      console.log('[SubtitleAgentTool] Using caption settings:', captionSettings);

      // Create Revideo scene file
      const sceneFilePath = await this.subtitleSystem.createSubtitleSceneFile(
        subtitles,
        'youtubeShortsSubtitles',
        captionSettings
      );

      // Export to SRT format
      const srtContent = this.subtitleSystem.exportToSRT(subtitles);

      return JSON.stringify({
        success: true,
        action: 'subtitles_generated',
        data: {
          subtitles,
          sceneFilePath,
          srtContent,
          segmentCount: subtitles.length,
          videoPath: actualVideoPath
        },
        message: `🎬 Generated professional YouTube Shorts-style subtitles with ${subtitles.length} segments! Features word-by-word highlighting, cyan current word color, red backgrounds, and smooth fade-in animations.`,
        ui_elements: [
          {
            type: 'subtitle_segments',
            data: subtitles.map((segment, index) => ({
              id: `youtube_subtitle_${index}`,
              startTime: segment.start,
              endTime: segment.end,
              text: segment.text,
              wordCount: segment.words.length,
              timecode: segment.timecode,
              type: 'youtube_shorts_subtitle'
            }))
          },
          {
            type: 'download_button',
            label: 'Download SRT File',
            action: 'download_srt',
            data: { srtContent, filename: 'youtube_shorts_subtitles.srt' }
          },
          {
            type: 'revideo_scene',
            label: 'Revideo Scene Created',
            data: { scenePath: sceneFilePath, sceneType: 'youtube_shorts_subtitles' }
          }
        ]
      });

    } catch (error) {
      console.error('[SubtitleAgentTool] Generation error:', error);
      return JSON.stringify({
        success: false,
        error: error instanceof Error ? error.message : 'Unknown error',
        action: 'show_error',
        message: 'Failed to generate subtitles. This might be due to audio quality or API limits. Please try again.'
      });
    }
  }

  private async enhanceScript(transcript: string, style: string): Promise<string> {
    if (!transcript) {
      return JSON.stringify({
        success: false,
        error: 'Transcript is required',
        action: 'show_error',
        message: 'Please provide a transcript to enhance.'
      });
    }

    try {
      const enhancedScript = await this.subtitleSystem.generateEnhancedScript(transcript, style as any);

      return JSON.stringify({
        success: true,
        action: 'script_enhanced',
        data: {
          originalTranscript: transcript,
          enhancedScript,
          style
        },
        message: `✨ Enhanced script for ${style} style content using OpenAI GPT-4o-mini!`,
        ui_elements: [
          {
            type: 'script_comparison',
            data: {
              original: transcript,
              enhanced: enhancedScript,
              style
            }
          }
        ]
      });

    } catch (error) {
      console.error('[SubtitleAgentTool] Script enhancement error:', error);
      return JSON.stringify({
        success: false,
        error: error instanceof Error ? error.message : 'Script enhancement failed',
        action: 'show_error',
        message: 'Failed to enhance script. Please check your OpenAI API access.'
      });
    }
  }

  private getPresets(): string {
    const presets = {
      youtubeShorts: {
        name: 'YouTube Shorts Official',
        description: 'Exact styling from YouTube Shorts example',
        settings: {
          fontSize: 80,
          fontWeight: 800,
          textAlign: 'center',
          textColor: 'white',
          currentWordColor: '#00FFFF',
          currentWordBackgroundColor: '#FF0000',
          shadowColor: 'black',
          shadowBlur: 30,
          numSimultaneousWords: 4,
          fadeInAnimation: true,
          textBoxWidthInPercent: 80
        }
      },
      viral: {
        name: 'Viral Content',
        description: 'High-energy styling for viral content',
        settings: {
          fontSize: 90,
          fontWeight: 900,
          textAlign: 'center',
          textColor: '#FFFF00',
          currentWordColor: '#FF6600',
          currentWordBackgroundColor: '#000000',
          shadowColor: 'white',
          shadowBlur: 40,
          numSimultaneousWords: 3,
          fadeInAnimation: true,
          textBoxWidthInPercent: 70
        }
      },
      educational: {
        name: 'Educational Content',
        description: 'Clean, readable styling for educational videos',
        settings: {
          fontSize: 70,
          fontWeight: 700,
          textAlign: 'center',
          textColor: 'white',
          currentWordColor: '#4CAF50',
          currentWordBackgroundColor: 'rgba(0,0,0,0.8)',
          shadowColor: 'black',
          shadowBlur: 20,
          numSimultaneousWords: 5,
          fadeInAnimation: false,
          textBoxWidthInPercent: 85
        }
      }
    };

    return JSON.stringify({
      success: true,
      action: 'presets_listed',
      data: { presets },
      message: '🎨 Available subtitle styling presets',
      ui_elements: [
        {
          type: 'preset_selector',
          data: presets
        }
      ]
    });
  }
}

// Create a function to detect subtitle-related commands
export function detectSubtitleCommand(message: string): boolean {
  const subtitleKeywords = [
    'subtitle', 'subtitles', 'caption', 'captions',
    'transcribe', 'transcription', 'word timing',
    'youtube shorts', 'highlight text', 'animated text',
    'srt', 'word level', 'professional subtitles'
  ];

  const lowerMessage = message.toLowerCase();
  return subtitleKeywords.some(keyword => lowerMessage.includes(keyword));
}

// Create a function to parse subtitle commands
export function parseSubtitleCommand(message: string, videoContext: any = null): string {
  const lowerMessage = message.toLowerCase();
  
  // Determine action based on message content
  let action = 'generate';
  let style = 'viral';
  let settings = {};

  if (lowerMessage.includes('enhance') || lowerMessage.includes('improve')) {
    action = 'enhance_script';
  } else if (lowerMessage.includes('preset') || lowerMessage.includes('style')) {
    action = 'get_presets';
  }

  // Determine style
  if (lowerMessage.includes('educational')) {
    style = 'educational';
  } else if (lowerMessage.includes('entertainment')) {
    style = 'entertainment';
  } else if (lowerMessage.includes('viral')) {
    style = 'viral';
  }

  // Extract video path from context or message
  let videoPath = null;
  if (videoContext?.currentVideo?.filename) {
    videoPath = videoContext.currentVideo.filename;
  } else if (videoContext?.videoPath) {
    videoPath = videoContext.videoPath;
  }

  return JSON.stringify({
    action,
    videoPath,
    style,
    settings,
    message: message
  });
}