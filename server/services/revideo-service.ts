import { renderVideo } from '@revideo/renderer';
import { makeProject } from '@revideo/core';
import * as path from 'path';
import * as fs from 'fs';

export interface RevideoRenderOptions {
  // Video inputs
  primaryVideo?: string;
  secondaryVideo?: string;
  audioTrack?: string;
  
  // Text content
  titleText?: string;
  subtitleText?: string;
  subtitleTextContent?: string;
  
  // Animation settings
  animationSpeed?: number;
  transitionDuration?: number;
  
  // Style settings
  primaryColor?: string;
  secondaryColor?: string;
  backgroundColor?: string;
  
  // Output settings
  outputWidth?: number;
  outputHeight?: number;
  outputFrameRate?: number;
  outputDuration?: number;
  
  // Subtitle styling
  subtitleFontSize?: number;
  subtitleColor?: string;
  subtitleBackgroundColor?: string;
  
  // Audio settings
  audioVolume?: number;
  musicVolume?: number;
  
  // Scene selection
  selectedScene?: 'example' | 'videoEditing' | 'subtitles' | 'transitions';
}

export class RevideoService {
  private readonly projectPath = path.resolve('./revideo');
  private readonly outputDir = path.resolve('./renders');

  constructor() {
    // Ensure output directory exists
    if (!fs.existsSync(this.outputDir)) {
      fs.mkdirSync(this.outputDir, { recursive: true });
    }
  }

  async renderVideoWithOptions(options: RevideoRenderOptions): Promise<string> {
    try {
      console.log('[Revideo] Starting video render with options:', options);
      
      // Create dynamic project with user options
      const project = this.createDynamicProject(options);
      
      // Generate unique output filename
      const outputFilename = `revideo_render_${Date.now()}.mp4`;
      const outputPath = path.join(this.outputDir, outputFilename);
      
      // Configure render settings
      const renderConfig = {
        projectFile: project,
        outDir: this.outputDir,
        outName: outputFilename.replace('.mp4', ''),
        settings: {
          size: [options.outputWidth || 1920, options.outputHeight || 1080],
          fps: options.outputFrameRate || 30,
          duration: options.outputDuration || 10,
        }
      };
      
      console.log('[Revideo] Rendering video with config:', renderConfig);
      
      // Render the video
      await renderVideo(renderConfig);
      
      console.log('[Revideo] Video rendered successfully:', outputPath);
      return outputPath;
      
    } catch (error) {
      console.error('[Revideo] Render failed:', error);
      throw new Error(`Revideo render failed: ${error.message}`);
    }
  }

  private createDynamicProject(options: RevideoRenderOptions) {
    // Dynamically import scenes based on selection
    const selectedScene = options.selectedScene || 'example';
    
    const projectConfig = {
      scenes: [selectedScene],
      variables: {
        // Video inputs
        primaryVideo: options.primaryVideo || 'https://revideo-example-assets.s3.amazonaws.com/stars.mp4',
        secondaryVideo: options.secondaryVideo || '',
        audioTrack: options.audioTrack || '',
        
        // Text overlays
        titleText: options.titleText || 'AI Video Editor',
        subtitleText: options.subtitleText || 'Create professional videos with code',
        subtitleTextContent: options.subtitleTextContent || 'Welcome to AI Video Editor',
        
        // Animation settings
        animationSpeed: options.animationSpeed || 1.0,
        transitionDuration: options.transitionDuration || 1.0,
        
        // Style settings
        primaryColor: options.primaryColor || '#8B5CF6',
        secondaryColor: options.secondaryColor || '#06B6D4',
        backgroundColor: options.backgroundColor || '#0F172A',
        
        // Output settings
        outputWidth: options.outputWidth || 1920,
        outputHeight: options.outputHeight || 1080,
        outputFrameRate: options.outputFrameRate || 30,
        outputDuration: options.outputDuration || 10,
        
        // Subtitle settings
        subtitleFontSize: options.subtitleFontSize || 48,
        subtitleColor: options.subtitleColor || '#FFFFFF',
        subtitleBackgroundColor: options.subtitleBackgroundColor || 'rgba(0,0,0,0.8)',
        
        // Audio settings
        audioVolume: options.audioVolume || 0.8,
        musicVolume: options.musicVolume || 0.3,
      }
    };

    return makeProject(projectConfig);
  }

  async createVideoTemplate(templateType: 'social' | 'youtube' | 'presentation' | 'story'): Promise<RevideoRenderOptions> {
    const templates: Record<string, RevideoRenderOptions> = {
      social: {
        outputWidth: 1080,
        outputHeight: 1080, // Square format
        outputDuration: 15,
        selectedScene: 'videoEditing',
        primaryColor: '#FF6B6B',
        secondaryColor: '#4ECDC4',
        titleText: 'Social Media Post',
        subtitleText: 'Engaging content for your audience'
      },
      youtube: {
        outputWidth: 1920,
        outputHeight: 1080, // 16:9 format
        outputDuration: 30,
        selectedScene: 'subtitles',
        primaryColor: '#FF0000',
        secondaryColor: '#FFFFFF',
        titleText: 'YouTube Video',
        subtitleText: 'Professional content creation'
      },
      presentation: {
        outputWidth: 1920,
        outputHeight: 1080,
        outputDuration: 60,
        selectedScene: 'transitions',
        primaryColor: '#2E86AB',
        secondaryColor: '#A23B72',
        titleText: 'Business Presentation',
        subtitleText: 'Corporate communication'
      },
      story: {
        outputWidth: 1080,
        outputHeight: 1920, // 9:16 format
        outputDuration: 10,
        selectedScene: 'example',
        primaryColor: '#8B5CF6',
        secondaryColor: '#06B6D4',
        titleText: 'Story Content',
        subtitleText: 'Vertical storytelling'
      }
    };

    return templates[templateType] || templates.social;
  }

  async renderTemplateVideo(templateType: 'social' | 'youtube' | 'presentation' | 'story', customOptions?: Partial<RevideoRenderOptions>): Promise<string> {
    console.log(`[Revideo] Creating ${templateType} template video`);
    
    const templateOptions = await this.createVideoTemplate(templateType);
    const finalOptions = { ...templateOptions, ...customOptions };
    
    return this.renderVideoWithOptions(finalOptions);
  }

  async generateAIEnhancedVideo(baseVideo: string, enhancements: {
    addSubtitles?: boolean;
    addTransitions?: boolean;
    addMusic?: boolean;
    colorGrading?: string;
    aspectRatio?: '16:9' | '9:16' | '1:1';
  }): Promise<string> {
    console.log('[Revideo] Generating AI-enhanced video with enhancements:', enhancements);
    
    const options: RevideoRenderOptions = {
      primaryVideo: baseVideo,
      selectedScene: 'subtitles', // Default to subtitles scene
    };

    // Apply aspect ratio
    if (enhancements.aspectRatio) {
      const aspectRatios = {
        '16:9': { width: 1920, height: 1080 },
        '9:16': { width: 1080, height: 1920 },
        '1:1': { width: 1080, height: 1080 }
      };
      const ratio = aspectRatios[enhancements.aspectRatio];
      options.outputWidth = ratio.width;
      options.outputHeight = ratio.height;
    }

    // Select appropriate scene based on enhancements
    if (enhancements.addTransitions) {
      options.selectedScene = 'transitions';
    } else if (enhancements.addSubtitles) {
      options.selectedScene = 'subtitles';
    }

    // Apply color grading
    if (enhancements.colorGrading) {
      const colorSchemes = {
        'warm': { primary: '#FF6B6B', secondary: '#FFE66D' },
        'cool': { primary: '#4ECDC4', secondary: '#45B7D1' },
        'cinematic': { primary: '#2C3E50', secondary: '#E74C3C' },
        'vibrant': { primary: '#8B5CF6', secondary: '#06B6D4' }
      };
      const scheme = colorSchemes[enhancements.colorGrading] || colorSchemes.vibrant;
      options.primaryColor = scheme.primary;
      options.secondaryColor = scheme.secondary;
    }

    return this.renderVideoWithOptions(options);
  }

  // Helper method to get available templates
  getAvailableTemplates(): string[] {
    return ['social', 'youtube', 'presentation', 'story'];
  }

  // Helper method to get available scenes
  getAvailableScenes(): string[] {
    return ['example', 'videoEditing', 'subtitles', 'transitions'];
  }
}