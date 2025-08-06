import { GoogleGenerativeAI } from '@google/generative-ai';
import ffmpeg from 'fluent-ffmpeg';
import fs from 'fs/promises';
import path from 'path';

export class CutService {
  private genAI: GoogleGenerativeAI;

  constructor() {
    this.genAI = new GoogleGenerativeAI(process.env.GEMINI_API_KEY || '');
  }

  async processCut(inputPath: string, config: any): Promise<{
    outputPath: string;
    cutsApplied: number;
    removedDuration: number;
    finalDuration: number;
    processingTime: number;
  }> {
    const startTime = Date.now();
    console.log('✂️ Starting intelligent cut with config:', config);
    
    const outputDir = path.join('uploads', 'cut');
    await fs.mkdir(outputDir, { recursive: true });

    const outputPath = path.join(outputDir, `cut_${Date.now()}.mp4`);

    try {
      // Get video metadata
      const metadata = await this.getVideoMetadata(inputPath);
      
      // Extract audio for analysis
      const audioPath = await this.extractAudio(inputPath);
      
      // Analyze content for cuts
      const cutSegments = await this.analyzeContentForCuts(inputPath, audioPath, config, metadata, config.aiModel);
      
      // Apply cuts
      const result = await this.applyCuts(inputPath, outputPath, cutSegments, metadata);
      
      // Cleanup
      await fs.unlink(audioPath).catch(() => {});
      
      const processingTime = Date.now() - startTime;
      
      return {
        outputPath,
        cutsApplied: cutSegments.length,
        removedDuration: result.removedDuration,
        finalDuration: result.finalDuration,
        processingTime
      };
    } catch (error) {
      console.error('Cut processing failed:', error);
      throw error;
    }
  }

  private async getVideoMetadata(videoPath: string): Promise<any> {
    return new Promise((resolve, reject) => {
      ffmpeg.ffprobe(videoPath, (err, metadata) => {
        if (err) reject(err);
        else {
          const video = metadata.streams.find(s => s.codec_type === 'video');
          resolve({
            width: video?.width || 1920,
            height: video?.height || 1080,
            duration: metadata.format.duration || 0,
            fps: eval(video?.r_frame_rate || '30/1')
          });
        }
      });
    });
  }

  private async extractAudio(videoPath: string): Promise<string> {
    const audioPath = `temp_audio_${Date.now()}.wav`;
    
    await new Promise((resolve, reject) => {
      ffmpeg(videoPath)
        .outputOptions(['-vn', '-acodec', 'pcm_s16le', '-ar', '16000', '-ac', '1'])
        .output(audioPath)
        .on('end', resolve)
        .on('error', reject)
        .run();
    });
    
    return audioPath;
  }

  private async analyzeContentForCuts(videoPath: string, audioPath: string, config: any, metadata: any, aiModel?: string): Promise<any[]> {
    const model = this.genAI.getGenerativeModel({ model: aiModel || 'gemini-2.0-flash-exp' });
    
    // Extract frames for visual analysis if content removal is specified
    let framesPaths: string[] = [];
    
    if (config.contentToRemove) {
      console.log('🔍 Extracting frames for visual content analysis...');
      framesPaths = await this.extractFramesForAnalysis(videoPath);
      console.log(`📸 Extracted ${framesPaths.length} frames for analysis`);
    }
    
    // Read audio for analysis
    const audioBuffer = await fs.readFile(audioPath);
    const audioBase64 = audioBuffer.toString('base64');
    
    const cutTypes = {
      silences: config.removeSilences !== false,
      ums: config.removeUms !== false,
      repetitions: config.removeRepetitions !== false,
      tangents: config.removeTangents !== false
    };
    
    // Build content array for Gemini
    const contents: any[] = [];
    
    // Add frames for visual analysis if available
    if (framesPaths.length > 0 && config.contentToRemove) {
      for (const framePath of framesPaths) {
        const frameBuffer = await fs.readFile(framePath);
        contents.push({
          inlineData: {
            data: frameBuffer.toString('base64'),
            mimeType: 'image/jpeg'
          }
        });
      }
    }
    
    // Always add audio
    contents.push({
      inlineData: {
        data: audioBase64,
        mimeType: 'audio/wav'
      }
    });
    
    // Build analysis prompt
    let prompt = '';
    
    if (config.contentToRemove) {
      const frameCount = framesPaths.length;
      const videoDuration = metadata.duration;
      const frameInterval = videoDuration / frameCount;
      
      prompt = `You are analyzing ${frameCount} frames from a ${videoDuration.toFixed(1)} second video. Each frame is approximately ${frameInterval.toFixed(1)} seconds apart.
      
      USER REQUEST: "${config.contentToRemove}"
      
      IMPORTANT INSTRUCTIONS:
      1. Carefully examine each frame to detect if the requested content appears
      2. For people detection: Look for faces, body shapes, clothing, distinctive features
      3. For object detection: Look for specific items, logos, text, or visual elements
      4. When you find matching content, note the frame number and calculate the timestamp
      5. Frame numbering starts at 0. Frame N corresponds to timestamp: N * ${frameInterval.toFixed(2)} seconds
      6. Include segments where the content is partially visible or in the background
      7. Be thorough - it's better to remove more content than to miss some
      
      Analyze the audio track as well for mentions of the content to remove.
      
      Return a JSON array of ALL segments to cut:`;
    } else {
      prompt = `Analyze this audio for intelligent video cuts.
      
      CUTTING OBJECTIVES:
      ${cutTypes.silences ? '1. Remove long silences (>1.5 seconds)' : ''}
      ${cutTypes.ums ? '2. Remove filler words (um, uh, like, you know)' : ''}
      ${cutTypes.repetitions ? '3. Remove repetitive phrases' : ''}
      ${cutTypes.tangents ? '4. Remove off-topic tangents' : ''}
      
      Additional context: ${config.context || 'General content'}
      
      Identify segments to CUT with precise timestamps.
      
      Return JSON array of cuts:
      [
        {
          "start": seconds,
          "end": seconds,
          "reason": "silence|filler|repetition|tangent",
          "confidence": 0-1,
          "transcript": "what was said (if applicable)"
        }
      ]
      
      Be conservative - only cut clear issues that won't affect content flow.`;
    }
    
    // Add prompt to contents
    contents.push(prompt);
    
    // Add JSON format example for contentToRemove requests
    if (config.contentToRemove) {
      contents.push(`
      [
        {
          "start": seconds when person/object appears,
          "end": seconds when person/object disappears,
          "reason": "visual_appearance",
          "confidence": 0.8-1.0,
          "transcript": "what was being said during this segment"
        }
      ]`);
    }
    
    const result = await model.generateContent(contents);
    
    try {
      let responseText = result.response.text();
      
      // Extract JSON from markdown code blocks if present
      const codeBlockMatch = responseText.match(/```(?:json)?\s*([\s\S]*?)```/);
      if (codeBlockMatch) {
        responseText = codeBlockMatch[1].trim();
      }
      
      const cuts = JSON.parse(responseText);
      
      // Clean up frames
      if (framesPaths.length > 0) {
        await this.cleanupFrames(framesPaths);
      }
      
      console.log(`🔍 Detected ${cuts.length} segments to remove`);
      cuts.forEach((cut: any, i: number) => {
        console.log(`  ${i + 1}. ${cut.start.toFixed(1)}s - ${cut.end.toFixed(1)}s: ${cut.reason} (confidence: ${cut.confidence})`);
      });
      
      // Filter by confidence threshold
      return cuts.filter((cut: any) => cut.confidence >= (config.confidenceThreshold || 0.7));
    } catch (e) {
      console.error('Failed to parse cut analysis:', e);
      console.error('Raw response:', result.response.text());
      
      // Clean up frames on error
      if (framesPaths.length > 0) {
        await this.cleanupFrames(framesPaths);
      }
      
      return [];
    }
  }

  private async extractFramesForAnalysis(videoPath: string): Promise<string[]> {
    const frameDir = path.join('temp_frames', `cut_${Date.now()}`);
    await fs.mkdir(frameDir, { recursive: true });
    
    const framePaths: string[] = [];
    const frameRate = 1; // Extract 1 frame per second for thorough analysis
    
    await new Promise((resolve, reject) => {
      ffmpeg(videoPath)
        .outputOptions([
          '-vf', `fps=${frameRate}`,
          '-q:v', '2' // High quality JPEG
        ])
        .output(path.join(frameDir, 'frame_%04d.jpg'))
        .on('end', async () => {
          try {
            const files = await fs.readdir(frameDir);
            for (const file of files) {
              if (file.endsWith('.jpg')) {
                framePaths.push(path.join(frameDir, file));
              }
            }
            resolve(true);
          } catch (error) {
            reject(error);
          }
        })
        .on('error', reject)
        .run();
    });
    
    return framePaths;
  }

  private async cleanupFrames(framePaths: string[]): Promise<void> {
    if (framePaths.length === 0) return;
    
    try {
      const frameDir = path.dirname(framePaths[0]);
      await fs.rm(frameDir, { recursive: true, force: true });
    } catch (error) {
      console.error('Failed to cleanup frames:', error);
    }
  }

  private async applyCuts(
    inputPath: string, 
    outputPath: string, 
    cutSegments: any[],
    metadata: any
  ): Promise<{ removedDuration: number; finalDuration: number }> {
    if (cutSegments.length === 0) {
      // No cuts, just copy
      await new Promise((resolve, reject) => {
        ffmpeg(inputPath)
          .outputOptions(['-c', 'copy'])
          .output(outputPath)
          .on('end', resolve)
          .on('error', reject)
          .run();
      });
      
      return {
        removedDuration: 0,
        finalDuration: metadata.duration
      };
    }
    
    // Sort cuts by start time
    cutSegments.sort((a, b) => a.start - b.start);
    
    // Build segments to keep
    const keepSegments = [];
    let lastEnd = 0;
    
    for (const cut of cutSegments) {
      if (cut.start > lastEnd) {
        keepSegments.push({
          start: lastEnd,
          end: cut.start
        });
      }
      lastEnd = cut.end;
    }
    
    // Add final segment
    if (lastEnd < metadata.duration) {
      keepSegments.push({
        start: lastEnd,
        end: metadata.duration
      });
    }
    
    // Create filter complex for concatenation
    const inputs: string[] = [];
    const filters: string[] = [];
    
    for (let i = 0; i < keepSegments.length; i++) {
      const segment = keepSegments[i];
      filters.push(
        `[0:v]trim=${segment.start}:${segment.end},setpts=PTS-STARTPTS[v${i}];` +
        `[0:a]atrim=${segment.start}:${segment.end},asetpts=PTS-STARTPTS[a${i}]`
      );
      inputs.push(`[v${i}][a${i}]`);
    }
    
    const concatFilter = `${inputs.join('')}concat=n=${keepSegments.length}:v=1:a=1[outv][outa]`;
    
    return new Promise((resolve, reject) => {
      ffmpeg(inputPath)
        .complexFilter([
          ...filters,
          concatFilter
        ])
        .outputOptions([
          '-map', '[outv]',
          '-map', '[outa]',
          '-c:v', 'libx264',
          '-preset', 'medium',
          '-crf', '23',
          '-c:a', 'aac',
          '-b:a', '128k'
        ])
        .output(outputPath)
        .on('end', () => {
          const removedDuration = cutSegments.reduce((sum, cut) => sum + (cut.end - cut.start), 0);
          const finalDuration = metadata.duration - removedDuration;
          
          console.log(`✅ Cut complete: Removed ${removedDuration.toFixed(2)}s`);
          resolve({ removedDuration, finalDuration });
        })
        .on('error', reject)
        .run();
    });
  }
}