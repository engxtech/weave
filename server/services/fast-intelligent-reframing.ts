import ffmpeg from 'fluent-ffmpeg';
import path from 'path';
import { spawn } from 'child_process';

export interface FastReframingOptions {
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
}

export class FastIntelligentReframing {
  async generateIntelligentReframe(
    inputPath: string,
    outputPath: string,
    options: FastReframingOptions,
    progressCallback?: (progress: number) => void
  ): Promise<void> {
    console.log('Starting fast intelligent reframing with options:', options);
    
    if (progressCallback) progressCallback(10);

    // Generate intelligent crop filter based on mode
    const cropFilter = this.generateSmartCropFilter(options);
    const { width, height } = this.getTargetResolution(options.targetAspectRatio);
    
    if (progressCallback) progressCallback(30);

    // Apply intelligent reframing with FFmpeg
    return new Promise((resolve, reject) => {
      const qualitySettings = this.getQualitySettings(options.quality);
      
      const ffmpegArgs = [
        '-i', inputPath,
        '-vf', cropFilter,
        '-c:v', 'libx264',
        '-preset', qualitySettings.preset,
        '-crf', qualitySettings.crf,
        '-c:a', 'aac',
        '-b:a', '128k',
        '-movflags', '+faststart',
        '-y',
        outputPath
      ];

      console.log('Running fast intelligent FFmpeg with:', ffmpegArgs.join(' '));
      
      const ffmpeg = spawn('ffmpeg', ffmpegArgs);
      
      let lastProgress = 30;
      
      let ffmpegOutput = '';
      
      ffmpeg.stderr.on('data', (data) => {
        const output = data.toString();
        ffmpegOutput += output;
        
        // Parse progress from FFmpeg output
        const timeMatch = output.match(/time=(\d{2}):(\d{2}):(\d{2}\.\d{2})/);
        if (timeMatch && progressCallback) {
          const [, hours, minutes, seconds] = timeMatch;
          const currentTime = parseInt(hours) * 3600 + parseInt(minutes) * 60 + parseFloat(seconds);
          const estimatedProgress = Math.min(95, 30 + (currentTime / 120) * 65);
          if (estimatedProgress > lastProgress) {
            lastProgress = estimatedProgress;
            progressCallback(estimatedProgress);
          }
        }
      });
      
      ffmpeg.on('close', (code) => {
        if (code === 0) {
          console.log('Fast intelligent reframing completed successfully');
          if (progressCallback) progressCallback(100);
          resolve();
        } else {
          console.error('FFmpeg stderr output:', ffmpegOutput);
          reject(new Error(`FFmpeg process exited with code ${code}. Error: ${ffmpegOutput.slice(-500)}`));
        }
      });
      
      ffmpeg.on('error', (error) => {
        console.error('FFmpeg error:', error);
        reject(error);
      });
    });
  }

  private generateSmartCropFilter(options: FastReframingOptions): string {
    if (options.trackingMode === 'center-crop') {
      return this.getCenterCropFilter(options.targetAspectRatio);
    }

    if (options.trackingMode === 'custom' && options.customCrop) {
      const crop = options.customCrop;
      return `crop=iw*${crop.width/100}:ih*${crop.height/100}:iw*${crop.x/100}:ih*${crop.y/100}`;
    }

    // Intelligent crop based on person tracking preferences
    return this.getPersonFocusCropFilter(options);
  }

  private getPersonFocusCropFilter(options: FastReframingOptions): string {
    const { priority, zoomLevel, smoothing } = options.personTracking;
    const { targetAspectRatio } = options;
    
    // Calculate the correct crop dimensions for target aspect ratio
    let cropRatio: number;
    switch (targetAspectRatio) {
      case '9:16': cropRatio = 9/16; break;  // 0.5625
      case '1:1': cropRatio = 1; break;
      case '4:3': cropRatio = 4/3; break;
      case '16:9': cropRatio = 16/9; break;
      default: cropRatio = 9/16; break;
    }
    
    let cropParams: { x: number; y: number; width: number; height: number };
    
    if (priority === 'primary-speaker') {
      // Focus on speaker position for 9:16 format
      if (targetAspectRatio === '9:16') {
        cropParams = {
          x: 15, // Slight left offset
          y: 0,  // Start from top
          width: 56.25, // Exact 9:16 ratio width (56.25% of 16:9)
          height: 100 // Full height
        };
      } else {
        cropParams = {
          x: 15,
          y: 5,
          width: 55 * zoomLevel,
          height: 85 * zoomLevel
        };
      }
    } else if (priority === 'all-people') {
      // Wider crop for multiple people
      if (targetAspectRatio === '9:16') {
        cropParams = {
          x: 21.875, // Center crop for 9:16
          y: 0,
          width: 56.25,
          height: 100
        };
      } else {
        cropParams = {
          x: 10,
          y: 5,
          width: 70 * zoomLevel,
          height: 90 * zoomLevel
        };
      }
    } else {
      // Movement-based: dynamic positioning
      if (targetAspectRatio === '9:16') {
        const offset = (smoothing / 100) * 10;
        cropParams = {
          x: 21.875 - offset, // Slight variation from center
          y: 0,
          width: 56.25,
          height: 100
        };
      } else {
        const offset = (smoothing / 100) * 10;
        cropParams = {
          x: 20 - offset,
          y: 10,
          width: 60 * zoomLevel,
          height: 80 * zoomLevel
        };
      }
    }

    // Ensure values stay within bounds
    cropParams.width = Math.min(100, Math.max(30, cropParams.width));
    cropParams.height = Math.min(100, Math.max(50, cropParams.height));
    cropParams.x = Math.max(0, Math.min(100 - cropParams.width, cropParams.x));
    cropParams.y = Math.max(0, Math.min(100 - cropParams.height, cropParams.y));

    return `crop=iw*${cropParams.width/100}:ih*${cropParams.height/100}:iw*${cropParams.x/100}:ih*${cropParams.y/100}`;
  }

  private getCenterCropFilter(aspectRatio: string): string {
    switch (aspectRatio) {
      case '9:16':
        // Use scale2ref for proper 9:16 conversion
        return 'scale=1080:1920:force_original_aspect_ratio=increase,crop=1080:1920';
      case '1:1':
        return 'scale=1080:1080:force_original_aspect_ratio=increase,crop=1080:1080';
      case '4:3':
        return 'scale=1440:1080:force_original_aspect_ratio=increase,crop=1440:1080';
      case '16:9':
        return 'scale=1920:1080:force_original_aspect_ratio=increase,crop=1920:1080';
      default:
        return 'scale=1080:1920:force_original_aspect_ratio=increase,crop=1080:1920';
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

  private getAspectRatioString(aspectRatio: string): string {
    switch (aspectRatio) {
      case '9:16': return '9:16';
      case '16:9': return '16:9';
      case '1:1': return '1:1';
      case '4:3': return '4:3';
      default: return '9:16';
    }
  }
}

export const fastIntelligentReframing = new FastIntelligentReframing();