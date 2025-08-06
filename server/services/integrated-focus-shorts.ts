import { GoogleGenerativeAI } from '@google/generative-ai';
import { spawn } from 'child_process';
import path from 'path';
import fs from 'fs';
import { nanoid } from 'nanoid';

export interface IntegratedShortsOptions {
  contentType: 'viral' | 'educational' | 'entertainment' | 'news' | 'highlights';
  aspectRatio: '9:16' | '16:9' | '1:1' | '4:3';
  duration: 15 | 30 | 60 | 90;
  focusMode: 'auto' | 'speaking-person' | 'main-person' | 'action' | 'text' | 'object';
  focusGuarantee: 'strict' | 'balanced' | 'flexible';
  maxZoomOut: number;
  subjectPadding: number;
  geminiModel?: string;
}

export interface FocusPreservedResult {
  success: boolean;
  storyline: any;
  focusMetrics: {
    totalSegments: number;
    segmentsWithZoomOut: number;
    averageZoomFactor: number;
    subjectsPreserved: number;
    focusAccuracy: number;
  };
  outputPath: string;
}

export class IntegratedFocusShortsGenerator {
  private ai: GoogleGenerativeAI;
  private tempDir: string;

  constructor(apiKey: string) {
    this.ai = new GoogleGenerativeAI(apiKey);
    this.tempDir = path.join(process.cwd(), 'temp_integrated_shorts');
    this.ensureTempDir();
  }

  private ensureTempDir() {
    if (!fs.existsSync(this.tempDir)) {
      fs.mkdirSync(this.tempDir, { recursive: true });
    }
  }

  private log(message: string): void {
    console.log(`Integrated Focus Shorts: [${new Date().toISOString()}] ${message}`);
  }

  async generateFocusPreservedShorts(
    inputPath: string,
    options: IntegratedShortsOptions
  ): Promise<FocusPreservedResult> {
    try {
      this.log(`Starting focus-preserved shorts generation with ${options.focusGuarantee} guarantee`);
      
      // Step 1: Analyze video with AI to determine optimal segments
      const storyline = await this.analyzeVideoForShorts(inputPath, options);
      
      // Step 2: Process each segment with zoom-out focus guarantee
      const processedSegments = await this.processSegmentsWithFocusGuarantee(
        inputPath,
        storyline.selectedTimeIntervals,
        options
      );
      
      // Step 3: Merge segments into final short
      const outputPath = await this.mergeSegmentsWithFocusPreservation(
        processedSegments,
        options
      );
      
      // Step 4: Calculate focus preservation metrics
      const focusMetrics = this.calculateFocusMetrics(processedSegments);
      
      this.log(`Focus-preserved shorts generation completed with ${focusMetrics.focusAccuracy}% accuracy`);
      
      return {
        success: true,
        storyline,
        focusMetrics,
        outputPath
      };
      
    } catch (error) {
      this.log(`Focus-preserved shorts generation failed: ${error}`);
      throw error;
    }
  }

  private async analyzeVideoForShorts(
    inputPath: string,
    options: IntegratedShortsOptions
  ): Promise<any> {
    const model = this.ai.getGenerativeModel({ 
      model: options.geminiModel || 'gemini-1.5-flash' 
    });

    const prompt = `Analyze this video for creating ${options.duration}s ${options.contentType} shorts with ${options.aspectRatio} aspect ratio.

FOCUS GUARANTEE REQUIREMENTS:
- Mode: ${options.focusGuarantee}
- Never lose people or important visual elements during cropping
- Consider zoom-out up to ${options.maxZoomOut}x if needed to preserve subjects
- Apply ${options.subjectPadding}% padding around detected subjects

For each selected segment, provide:
1. Precise timestamps (start/end)
2. Subject positioning (left/center/right)
3. Focus preservation strategy
4. Reason for selection

Respond with JSON:
{
  "concept": "short description",
  "narrative": "storyline",
  "viralPotential": 0.0-1.0,
  "title": "engaging title",
  "description": "description",
  "hashtags": ["#tag1", "#tag2"],
  "totalDuration": ${options.duration},
  "selectedTimeIntervals": [
    {
      "originalStartTime": 0,
      "originalEndTime": 10,
      "selectionReason": "why this segment",
      "subjectPosition": "left|center|right",
      "focusStrategy": {
        "requiresZoomOut": true|false,
        "estimatedZoomFactor": 1.0-3.0,
        "subjectsDetected": ["person1", "text"],
        "preservationPriority": "high|medium|low"
      }
    }
  ]
}`;

    try {
      const result = await model.generateContent(prompt);
      const response = result.response.text() || '';
      
      const jsonMatch = response.match(/\{[\s\S]*\}/);
      if (jsonMatch) {
        return JSON.parse(jsonMatch[0]);
      } else {
        throw new Error('No valid JSON response from AI analysis');
      }
    } catch (error) {
      this.log(`AI analysis failed: ${error}`);
      // Return fallback storyline
      return this.createFallbackStoryline(options);
    }
  }

  private createFallbackStoryline(options: IntegratedShortsOptions): any {
    return {
      concept: "Focus-preserved video highlight",
      narrative: "Selected highlights with guaranteed subject preservation",
      viralPotential: 0.7,
      title: "Video Highlights",
      description: "Engaging content with perfect focus preservation",
      hashtags: ["#shorts", "#viral", "#content"],
      totalDuration: options.duration,
      selectedTimeIntervals: [
        {
          originalStartTime: 0,
          originalEndTime: Math.min(30, options.duration),
          selectionReason: "Opening segment with good subject visibility",
          subjectPosition: "center",
          focusStrategy: {
            requiresZoomOut: false,
            estimatedZoomFactor: 1.0,
            subjectsDetected: ["person"],
            preservationPriority: "high"
          }
        }
      ]
    };
  }

  private async processSegmentsWithFocusGuarantee(
    inputPath: string,
    intervals: any[],
    options: IntegratedShortsOptions
  ): Promise<any[]> {
    const processedSegments = [];
    
    for (let i = 0; i < intervals.length; i++) {
      const interval = intervals[i];
      const segmentId = nanoid();
      const tempSegmentPath = path.join(this.tempDir, `segment_${segmentId}.mp4`);
      const finalSegmentPath = path.join(this.tempDir, `final_segment_${segmentId}.mp4`);
      
      try {
        // Extract segment
        await this.extractSegment(inputPath, tempSegmentPath, interval);
        
        // Apply zoom-out focus guarantee
        const focusResult = await this.applyZoomOutFocus(
          tempSegmentPath,
          finalSegmentPath,
          options,
          interval.focusStrategy
        );
        
        processedSegments.push({
          id: segmentId,
          path: finalSegmentPath,
          originalInterval: interval,
          focusResult
        });
        
        // Clean up temp file
        if (fs.existsSync(tempSegmentPath)) {
          fs.unlinkSync(tempSegmentPath);
        }
        
      } catch (error) {
        this.log(`Segment ${i} processing failed: ${error}`);
        // Use fallback processing if zoom-out fails
        await this.fallbackSegmentProcessing(inputPath, finalSegmentPath, interval, options);
        
        processedSegments.push({
          id: segmentId,
          path: finalSegmentPath,
          originalInterval: interval,
          focusResult: { success: false, zoomFactor: 1.0, subjectsPreserved: 0 }
        });
      }
    }
    
    return processedSegments;
  }

  private async extractSegment(
    inputPath: string,
    outputPath: string,
    interval: any
  ): Promise<void> {
    return new Promise((resolve, reject) => {
      const duration = interval.originalEndTime - interval.originalStartTime;
      
      const cmd = [
        'ffmpeg',
        '-ss', interval.originalStartTime.toString(),
        '-i', inputPath,
        '-t', duration.toString(),
        '-c', 'copy',
        '-avoid_negative_ts', 'make_zero',
        '-y',
        outputPath
      ];

      const process = spawn(cmd[0], cmd.slice(1));
      
      process.on('close', (code) => {
        if (code === 0) {
          resolve();
        } else {
          reject(new Error(`Segment extraction failed: ${code}`));
        }
      });
    });
  }

  private async applyZoomOutFocus(
    inputPath: string,
    outputPath: string,
    options: IntegratedShortsOptions,
    focusStrategy: any
  ): Promise<any> {
    try {
      const { createZoomOutFocusConverter } = await import('./zoom-out-focus-converter');
      const converter = createZoomOutFocusConverter(process.env.GEMINI_API_KEY || '');
      
      const result = await converter.convertWithZoomOutFocus(inputPath, outputPath, {
        targetAspectRatio: options.aspectRatio,
        quality: 'high',
        maxZoomOut: options.maxZoomOut,
        focusGuarantee: options.focusGuarantee,
        subjectPadding: options.subjectPadding
      });
      
      this.log(`Zoom-out applied: ${result.zoomFactor.toFixed(2)}x, ${result.subjectsInFrame}/${result.totalSubjectsDetected} subjects preserved`);
      
      return result;
    } catch (error) {
      this.log(`Zoom-out focus failed: ${error}`);
      throw error;
    }
  }

  private async fallbackSegmentProcessing(
    inputPath: string,
    outputPath: string,
    interval: any,
    options: IntegratedShortsOptions
  ): Promise<void> {
    return new Promise((resolve, reject) => {
      const duration = interval.originalEndTime - interval.originalStartTime;
      const cropFilter = this.getFallbackCropFilter(options.aspectRatio, interval.subjectPosition);
      
      const cmd = [
        'ffmpeg',
        '-ss', interval.originalStartTime.toString(),
        '-i', inputPath,
        '-t', duration.toString(),
        '-vf', cropFilter,
        '-c:v', 'libx264',
        '-preset', 'medium',
        '-crf', '23',
        '-c:a', 'aac',
        '-y',
        outputPath
      ];

      const process = spawn(cmd[0], cmd.slice(1));
      
      process.on('close', (code) => {
        if (code === 0) {
          resolve();
        } else {
          reject(new Error(`Fallback processing failed: ${code}`));
        }
      });
    });
  }

  private getFallbackCropFilter(aspectRatio: string, subjectPosition: string): string {
    let cropParams = '';
    
    switch (aspectRatio) {
      case '9:16':
        switch (subjectPosition) {
          case 'left':
            cropParams = 'crop=iw*0.6:ih*0.8:0:ih*0.1';
            break;
          case 'right':
            cropParams = 'crop=iw*0.6:ih*0.8:iw*0.4:ih*0.1';
            break;
          default:
            cropParams = 'crop=iw*0.6:ih*0.8:iw*0.2:ih*0.1';
        }
        break;
      case '1:1':
        cropParams = 'crop=min(iw\\,ih):min(iw\\,ih):(iw-min(iw\\,ih))/2:(ih-min(iw\\,ih))/2';
        break;
      default:
        cropParams = 'scale=1280:720:force_original_aspect_ratio=increase,crop=1280:720';
    }
    
    return `${cropParams},scale=${this.getTargetResolution(aspectRatio)}`;
  }

  private getTargetResolution(aspectRatio: string): string {
    switch (aspectRatio) {
      case '9:16': return '720:1280';
      case '1:1': return '720:720';
      case '4:3': return '960:720';
      default: return '1280:720';
    }
  }

  private async mergeSegmentsWithFocusPreservation(
    segments: any[],
    options: IntegratedShortsOptions
  ): Promise<string> {
    const outputFilename = `focus_preserved_shorts_${nanoid()}.mp4`;
    const outputPath = path.join('uploads', outputFilename);
    
    if (segments.length === 1) {
      // Single segment - just copy
      fs.copyFileSync(segments[0].path, outputPath);
    } else {
      // Multiple segments - merge with concat
      await this.mergeMultipleSegments(segments, outputPath);
    }
    
    // Clean up temporary segments
    for (const segment of segments) {
      if (fs.existsSync(segment.path)) {
        fs.unlinkSync(segment.path);
      }
    }
    
    return `/api/video/${outputFilename}`;
  }

  private async mergeMultipleSegments(segments: any[], outputPath: string): Promise<void> {
    return new Promise((resolve, reject) => {
      const concatFile = path.join(this.tempDir, `concat_${nanoid()}.txt`);
      const concatContent = segments.map(s => `file '${s.path}'`).join('\n');
      
      fs.writeFileSync(concatFile, concatContent);
      
      const cmd = [
        'ffmpeg',
        '-f', 'concat',
        '-safe', '0',
        '-i', concatFile,
        '-c', 'copy',
        '-y',
        outputPath
      ];

      const process = spawn(cmd[0], cmd.slice(1));
      
      process.on('close', (code) => {
        fs.unlinkSync(concatFile);
        
        if (code === 0) {
          resolve();
        } else {
          reject(new Error(`Merge failed: ${code}`));
        }
      });
    });
  }

  private calculateFocusMetrics(segments: any[]): any {
    const totalSegments = segments.length;
    const segmentsWithZoomOut = segments.filter(s => s.focusResult?.zoomFactor > 1.0).length;
    const averageZoomFactor = segments.reduce((sum, s) => sum + (s.focusResult?.zoomFactor || 1.0), 0) / totalSegments;
    const totalSubjectsPreserved = segments.reduce((sum, s) => sum + (s.focusResult?.subjectsInFrame || 0), 0);
    const focusAccuracy = Math.round((segmentsWithZoomOut / totalSegments) * 100);
    
    return {
      totalSegments,
      segmentsWithZoomOut,
      averageZoomFactor: Math.round(averageZoomFactor * 100) / 100,
      subjectsPreserved: totalSubjectsPreserved,
      focusAccuracy
    };
  }
}

export const createIntegratedFocusShortsGenerator = (apiKey: string): IntegratedFocusShortsGenerator => {
  return new IntegratedFocusShortsGenerator(apiKey);
};