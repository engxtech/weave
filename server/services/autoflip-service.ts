import { spawn } from 'child_process';
import * as fs from 'fs/promises';
import * as path from 'path';
import { nanoid } from 'nanoid';

export interface AutoFlipOptions {
  targetAspectRatio: '9:16' | '16:9' | '1:1' | '4:3';
  sampleRate?: number;
  quality?: 'high' | 'medium' | 'low';
}

export interface SalientRegion {
  bbox: [number, number, number, number];
  confidence: number;
  normalized_bbox: [number, number, number, number];
  type: 'face' | 'pose' | 'hand';
}

export interface AutoFlipAnalysis {
  frame_idx: number;
  timestamp: number;
  salient_regions: {
    faces: SalientRegion[];
    poses: SalientRegion[];
    hands: SalientRegion[];
    overall_bbox: {
      normalized: [number, number, number, number];
      absolute: [number, number, number, number];
    } | null;
    confidence: number;
  };
  crop_info: {
    x: number;
    y: number;
    width: number;
    height: number;
    confidence: number;
    method: string;
    center_x?: number;
    center_y?: number;
  };
}

export interface AutoFlipResult {
  success: boolean;
  outputPath?: string;
  analysisPath?: string;
  originalDimensions: [number, number];
  targetAspectRatio: string;
  frameAnalyses: AutoFlipAnalysis[];
  processingStats: {
    totalFacesDetected: number;
    totalPosesDetected: number;
    averageConfidence: number;
    framesWithSalientContent: number;
  };
  error?: string;
}

export class AutoFlipService {
  private tempDir: string;

  constructor() {
    this.tempDir = path.join(process.cwd(), 'temp_autoflip');
  }

  private async ensureTempDir(): Promise<void> {
    try {
      await fs.access(this.tempDir);
    } catch {
      await fs.mkdir(this.tempDir, { recursive: true });
    }
  }

  async processVideoWithAutoFlip(
    videoPath: string,
    options: AutoFlipOptions
  ): Promise<AutoFlipResult> {
    await this.ensureTempDir();

    const analysisId = nanoid();
    const analysisPath = path.join(this.tempDir, `analysis_${analysisId}.json`);
    const outputPath = path.join(this.tempDir, `autoflip_${analysisId}.mp4`);

    console.log('=== AUTOFLIP MEDIAPIPE ANALYSIS START ===');
    console.log('Video path:', videoPath);
    console.log('Target aspect ratio:', options.targetAspectRatio);
    console.log('Sample rate:', options.sampleRate || 30);

    try {
      // Step 1: Run MediaPipe analysis
      const analysisResult = await this.runMediaPipeAnalysis(
        videoPath,
        analysisPath,
        options
      );

      if (!analysisResult.success) {
        return {
          success: false,
          error: analysisResult.error,
          originalDimensions: [0, 0],
          targetAspectRatio: options.targetAspectRatio,
          frameAnalyses: [],
          processingStats: {
            totalFacesDetected: 0,
            totalPosesDetected: 0,
            averageConfidence: 0,
            framesWithSalientContent: 0
          }
        };
      }

      // Step 2: Load analysis results
      const analysisData = JSON.parse(await fs.readFile(analysisPath, 'utf-8'));

      // Step 3: Apply AutoFlip cropping using FFmpeg
      await this.applyAutoFlipCropping(videoPath, outputPath, analysisData);

      console.log('=== AUTOFLIP PROCESSING COMPLETE ===');
      console.log('Analysis saved to:', analysisPath);
      console.log('Output video saved to:', outputPath);

      return {
        success: true,
        outputPath,
        analysisPath,
        originalDimensions: analysisData.original_dimensions,
        targetAspectRatio: analysisData.target_aspect_ratio,
        frameAnalyses: analysisData.frame_analyses,
        processingStats: analysisData.processing_stats
      };

    } catch (error) {
      console.error('AutoFlip processing error:', error);
      return {
        success: false,
        error: error instanceof Error ? error.message : 'Unknown error',
        originalDimensions: [0, 0],
        targetAspectRatio: options.targetAspectRatio,
        frameAnalyses: [],
        processingStats: {
          totalFacesDetected: 0,
          totalPosesDetected: 0,
          averageConfidence: 0,
          framesWithSalientContent: 0
        }
      };
    }
  }

  private async runMediaPipeAnalysis(
    videoPath: string,
    analysisPath: string,
    options: AutoFlipOptions
  ): Promise<{ success: boolean; error?: string }> {
    return new Promise((resolve) => {
      const pythonScript = path.join(process.cwd(), 'server', 'services', 'autoflip-mediapipe.py');
      
      const args = [
        pythonScript,
        videoPath,
        analysisPath,
        '--aspect-ratio', options.targetAspectRatio,
        '--sample-rate', (options.sampleRate || 30).toString()
      ];

      console.log('Running MediaPipe analysis:', 'python3', args.join(' '));

      const process = spawn('python3', args);
      
      let stdout = '';
      let stderr = '';

      process.stdout.on('data', (data) => {
        const output = data.toString();
        console.log('MediaPipe:', output.trim());
        stdout += output;
      });

      process.stderr.on('data', (data) => {
        const output = data.toString();
        console.error('MediaPipe Error:', output.trim());
        stderr += output;
      });

      process.on('close', (code) => {
        if (code === 0) {
          console.log('MediaPipe analysis completed successfully');
          resolve({ success: true });
        } else {
          console.error('MediaPipe analysis failed with code:', code);
          resolve({ 
            success: false, 
            error: `MediaPipe analysis failed: ${stderr || 'Unknown error'}` 
          });
        }
      });

      process.on('error', (error) => {
        console.error('Failed to start MediaPipe process:', error);
        resolve({ 
          success: false, 
          error: `Failed to start MediaPipe: ${error.message}` 
        });
      });
    });
  }

  private async applyAutoFlipCropping(
    inputPath: string,
    outputPath: string,
    analysisData: any
  ): Promise<void> {
    return new Promise((resolve, reject) => {
      const smoothedCrops = analysisData.smoothed_crops;
      
      if (!smoothedCrops || smoothedCrops.length === 0) {
        reject(new Error('No crop data available from AutoFlip analysis'));
        return;
      }

      // Generate crop filter based on smoothed transitions
      const cropFilters = smoothedCrops.map((crop: any, index: number) => {
        const startTime = crop.timestamp;
        const endTime = index < smoothedCrops.length - 1 
          ? smoothedCrops[index + 1].timestamp 
          : startTime + 1;
        
        return `between(t,${startTime},${endTime})*crop=${crop.width}:${crop.height}:${crop.x}:${crop.y}`;
      }).join('+');

      const ffmpegArgs = [
        '-i', inputPath,
        '-vf', `crop='${cropFilters}'`,
        '-c:a', 'copy',
        '-y',
        outputPath
      ];

      console.log('Applying AutoFlip cropping with FFmpeg:', ffmpegArgs.join(' '));

      const ffmpeg = spawn('ffmpeg', ffmpegArgs);

      ffmpeg.stderr.on('data', (data) => {
        const output = data.toString();
        const timeMatch = output.match(/time=(\d{2}):(\d{2}):(\d{2}\.\d{2})/);
        if (timeMatch) {
          const [, hours, minutes, seconds] = timeMatch;
          const currentTime = parseInt(hours) * 3600 + parseInt(minutes) * 60 + parseFloat(seconds);
          console.log(`AutoFlip cropping progress: ${currentTime}s`);
        }
      });

      ffmpeg.on('close', (code) => {
        if (code === 0) {
          console.log('AutoFlip cropping completed successfully');
          resolve();
        } else {
          reject(new Error(`FFmpeg process exited with code ${code}`));
        }
      });

      ffmpeg.on('error', (error) => {
        reject(error);
      });
    });
  }

  async generateAutoFlipPreview(
    analysisPath: string,
    originalVideoPath: string
  ): Promise<string> {
    const analysisData = JSON.parse(await fs.readFile(analysisPath, 'utf-8'));
    const previewId = nanoid();
    const previewPath = path.join(this.tempDir, `preview_${previewId}.json`);

    // Generate preview data with visual annotations
    const previewData = {
      originalVideo: originalVideoPath,
      analysisData,
      visualizations: analysisData.frame_analyses.map((analysis: AutoFlipAnalysis) => ({
        timestamp: analysis.timestamp,
        salientRegions: analysis.salient_regions,
        cropArea: analysis.crop_info,
        confidence: analysis.salient_regions.confidence
      }))
    };

    await fs.writeFile(previewPath, JSON.stringify(previewData, null, 2));
    return previewPath;
  }

  async cleanup(): Promise<void> {
    try {
      const files = await fs.readdir(this.tempDir);
      await Promise.all(
        files.map(file => fs.unlink(path.join(this.tempDir, file)))
      );
    } catch (error) {
      console.warn('Cleanup warning:', error);
    }
  }
}

export const createAutoFlipService = (): AutoFlipService => {
  return new AutoFlipService();
};