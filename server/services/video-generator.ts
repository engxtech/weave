import * as fs from 'fs';
import * as path from 'path';
import { spawn } from 'child_process';
import { nanoid } from 'nanoid';

export interface VideoGenerationRequest {
  videoPath: string;
  timeline: Array<{
    startTime: number;
    endTime: number;
    action: string;
    description: string;
  }>;
  outputFormat: string;
  quality: string;
  aspectRatio: string;
}

export interface GeneratedVideo {
  id: string;
  title: string;
  videoUrl: string;
  duration: number;
  segments: number;
  timeline: any[];
}

export class VideoGenerator {
  constructor() {}

  async generateVideo(request: VideoGenerationRequest): Promise<GeneratedVideo> {
    const { videoPath, timeline, outputFormat, quality, aspectRatio } = request;
    
    console.log('=== VIDEO GENERATOR START ===');
    console.log('Input video path:', videoPath);
    console.log('Timeline segments:', timeline.length);
    console.log('Output format:', outputFormat);
    console.log('Quality:', quality);
    console.log('Aspect ratio:', aspectRatio);

    // Validate input video exists
    const fullVideoPath = path.resolve(videoPath);
    if (!fs.existsSync(fullVideoPath)) {
      throw new Error(`Input video not found: ${fullVideoPath}`);
    }

    // Generate output filename
    const videoId = nanoid();
    const outputFilename = `generated_video_${videoId}.${outputFormat}`;
    const outputPath = path.join('uploads', outputFilename);
    const fullOutputPath = path.resolve(outputPath);

    console.log('Output will be saved to:', fullOutputPath);

    // Get video resolution based on aspect ratio
    const resolution = this.getResolution(aspectRatio);
    console.log('Target resolution:', resolution);

    try {
      // Create segments from timeline
      const segments = await this.createVideoSegments(fullVideoPath, timeline, resolution, outputFormat);
      console.log('Created segments:', segments.length);

      // Merge segments into final video
      await this.mergeSegments(segments, fullOutputPath, resolution);
      console.log('Successfully merged segments into final video');

      // Cleanup temporary segments
      await this.cleanupSegments(segments);
      console.log('Cleaned up temporary files');

      // Get video duration
      const duration = await this.getVideoDuration(fullOutputPath);
      console.log('Final video duration:', duration, 'seconds');

      const result: GeneratedVideo = {
        id: videoId,
        title: `Generated Video (${timeline.length} segments)`,
        videoUrl: `/api/video/stream/${outputFilename}`,
        duration: duration,
        segments: timeline.length,
        timeline: timeline
      };

      console.log('=== VIDEO GENERATOR SUCCESS ===');
      console.log('Generated video:', result);

      return result;

    } catch (error) {
      console.error('=== VIDEO GENERATOR ERROR ===');
      console.error('Error:', error);
      throw new Error(`Video generation failed: ${error.message}`);
    }
  }

  private async createVideoSegments(
    inputPath: string, 
    timeline: any[], 
    resolution: { width: number; height: number },
    format: string
  ): Promise<string[]> {
    const segments: string[] = [];
    
    for (let i = 0; i < timeline.length; i++) {
      const segment = timeline[i];
      const segmentFile = path.resolve(`uploads/temp_segment_${i}_${Date.now()}.${format}`);
      
      console.log(`Creating segment ${i + 1}/${timeline.length}: ${segment.startTime}s to ${segment.endTime}s`);
      
      await this.extractSegment(
        inputPath, 
        segmentFile, 
        segment.startTime, 
        segment.endTime, 
        resolution
      );
      
      segments.push(segmentFile);
    }
    
    return segments;
  }

  private async extractSegment(
    inputPath: string, 
    outputPath: string, 
    startTime: number, 
    endTime: number, 
    resolution: { width: number; height: number }
  ): Promise<void> {
    return new Promise((resolve, reject) => {
      const duration = endTime - startTime;
      
      const args = [
        '-i', inputPath,
        '-ss', startTime.toString(),
        '-t', duration.toString(),
        '-vf', `scale=${resolution.width}:${resolution.height}:force_original_aspect_ratio=decrease,pad=${resolution.width}:${resolution.height}:(ow-iw)/2:(oh-ih)/2:black`,
        '-c:v', 'libx264',
        '-preset', 'fast',
        '-crf', '23',
        '-c:a', 'aac',
        '-y',
        outputPath
      ];

      console.log('FFmpeg command:', 'ffmpeg', args.join(' '));

      const ffmpeg = spawn('ffmpeg', args);
      
      ffmpeg.stderr.on('data', (data) => {
        console.log('FFmpeg stderr:', data.toString());
      });
      
      ffmpeg.on('close', (code) => {
        if (code === 0) {
          console.log(`Segment created successfully: ${outputPath}`);
          resolve();
        } else {
          reject(new Error(`FFmpeg exited with code ${code}`));
        }
      });
      
      ffmpeg.on('error', (error) => {
        reject(error);
      });
    });
  }

  private async mergeSegments(
    segments: string[], 
    outputPath: string, 
    resolution: { width: number; height: number }
  ): Promise<void> {
    return new Promise((resolve, reject) => {
      // Create a concat file list
      const concatFile = path.resolve(`uploads/concat_${Date.now()}.txt`);
      const concatContent = segments.map(segment => `file '${segment}'`).join('\n');
      
      fs.writeFileSync(concatFile, concatContent);
      console.log('Created concat file:', concatFile);
      
      const args = [
        '-f', 'concat',
        '-safe', '0',
        '-i', concatFile,
        '-c', 'copy',
        '-y',
        outputPath
      ];

      console.log('FFmpeg merge command:', 'ffmpeg', args.join(' '));

      const ffmpeg = spawn('ffmpeg', args);
      
      ffmpeg.stderr.on('data', (data) => {
        console.log('FFmpeg merge stderr:', data.toString());
      });
      
      ffmpeg.on('close', (code) => {
        // Cleanup concat file
        try {
          fs.unlinkSync(concatFile);
        } catch (error) {
          console.warn('Failed to cleanup concat file:', error);
        }
        
        if (code === 0) {
          console.log(`Video merged successfully: ${outputPath}`);
          resolve();
        } else {
          reject(new Error(`FFmpeg merge exited with code ${code}`));
        }
      });
      
      ffmpeg.on('error', (error) => {
        reject(error);
      });
    });
  }

  private async cleanupSegments(segments: string[]): Promise<void> {
    for (const segment of segments) {
      try {
        if (fs.existsSync(segment)) {
          fs.unlinkSync(segment);
          console.log('Deleted temporary segment:', segment);
        }
      } catch (error) {
        console.warn('Failed to delete segment:', segment, error);
      }
    }
  }

  private async getVideoDuration(videoPath: string): Promise<number> {
    return new Promise((resolve, reject) => {
      const args = [
        '-i', videoPath,
        '-f', 'null',
        '-'
      ];

      const ffmpeg = spawn('ffmpeg', args);
      let stderr = '';
      
      ffmpeg.stderr.on('data', (data) => {
        stderr += data.toString();
      });
      
      ffmpeg.on('close', () => {
        // Parse duration from stderr
        const durationMatch = stderr.match(/Duration: (\d{2}):(\d{2}):(\d{2}\.\d{2})/);
        if (durationMatch) {
          const hours = parseInt(durationMatch[1]);
          const minutes = parseInt(durationMatch[2]);
          const seconds = parseFloat(durationMatch[3]);
          const totalSeconds = hours * 3600 + minutes * 60 + seconds;
          resolve(Math.round(totalSeconds));
        } else {
          console.warn('Could not parse video duration, defaulting to 30 seconds');
          resolve(30);
        }
      });
      
      ffmpeg.on('error', (error) => {
        console.warn('Error getting video duration:', error);
        resolve(30); // Default duration
      });
    });
  }

  private getResolution(aspectRatio: string): { width: number; height: number } {
    switch (aspectRatio) {
      case '9:16':
        return { width: 720, height: 1280 };
      case '16:9':
        return { width: 1280, height: 720 };
      case '1:1':
        return { width: 720, height: 720 };
      default:
        return { width: 720, height: 1280 };
    }
  }
}

export const createVideoGenerator = (): VideoGenerator => {
  return new VideoGenerator();
};