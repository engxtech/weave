import { GoogleGenAI, Modality } from '@google/genai';
import { promises as fs } from 'fs';
import { spawn } from 'child_process';
import path from 'path';

interface BRollConfig {
  includeImages: boolean;
  includeVideos: boolean;
  clipsPerMinute: number;
  styleDescription: string;
  contentFocus: string;
}

interface BRollMoment {
  keyword: string;
  timestamp: number;
  duration: number;
  context: string;
  description: string;
  imagePath?: string;
  videoPath?: string;
}

export class BRollGenerationService {
  private genai: GoogleGenAI;

  constructor() {
    this.genai = new GoogleGenAI({ apiKey: process.env.GEMINI_API_KEY || '' });
  }

  async processBRoll(videoPath: string, config: any): Promise<any> {
    // Convert API path to file system path
    const fileSystemPath = videoPath.replace(/^\/api\/upload\/video\//, 'uploads/');
    
    const brollConfig: BRollConfig = {
      includeImages: config.includeImages !== false,
      includeVideos: config.includeVideos !== false,
      clipsPerMinute: config.clipsPerMinute || 3,
      styleDescription: config.styleDescription || 'Smooth and cinematic shots',
      contentFocus: config.contentFocus || ''
    };

    const result = await this.generateBRoll(fileSystemPath, brollConfig, config.aiModel);
    
    // Convert file paths to API paths
    const apiAssets = result.generatedAssets.map(asset => {
      const relativePath = asset.replace(/^uploads\//, '');
      return `/api/upload/${relativePath}`;
    });
    
    // Convert composite video path to API path if it exists
    const outputPath = result.compositeVideoPath 
      ? `/api/upload/${result.compositeVideoPath.replace(/^uploads\//, '')}`
      : videoPath;
    
    return {
      ...result,
      outputPath, // Use composite video with embedded B-roll
      brollAssets: apiAssets,
      moments: result.moments,
      success: true
    };
  }

  async generateBRoll(videoPath: string, config: BRollConfig, aiModel?: string): Promise<{
    moments: BRollMoment[];
    generatedAssets: string[];
    compositeVideoPath: string;
    processingTime: number;
  }> {
    const startTime = Date.now();
    console.log('=== B-ROLL GENERATION START ===');
    console.log('Video path:', videoPath);
    console.log('Config:', config);

    try {
      // Step 1: Transcribe video and detect keywords
      const transcription = await this.transcribeVideoWithTimestamps(videoPath, aiModel);
      
      // Step 2: Analyze content focus and find keyword moments
      const keywordMoments = await this.analyzeContentFocus(transcription, config.contentFocus, aiModel);
      
      // Step 3: Calculate how many B-roll clips to generate based on video duration
      const videoDuration = await this.getVideoDuration(videoPath);
      const totalClips = Math.floor((videoDuration / 60) * config.clipsPerMinute);
      const selectedMoments = keywordMoments.slice(0, totalClips);
      
      // Step 4: Generate B-roll assets for each moment
      const generatedAssets: string[] = [];
      const processedMoments: BRollMoment[] = [];
      
      for (const moment of selectedMoments) {
        if (config.includeImages) {
          const imagePath = await this.generateBRollImage(moment, config.styleDescription);
          if (imagePath) {
            moment.imagePath = imagePath;
            generatedAssets.push(imagePath);
          }
        }
        
        // For now, we'll generate static images that can be converted to video clips
        // Future enhancement: Generate actual video clips using Revideo
        if (config.includeVideos && moment.imagePath) {
          const videoPath = await this.convertImageToVideo(moment.imagePath, moment.duration);
          if (videoPath) {
            moment.videoPath = videoPath;
            generatedAssets.push(videoPath);
          }
        }
        
        processedMoments.push(moment);
      }

      // Step 5: Create composite video with B-roll overlays
      const compositeVideoPath = await this.createCompositeVideo(
        videoPath, 
        processedMoments,
        config
      );

      const processingTime = Date.now() - startTime;
      console.log('=== B-ROLL GENERATION COMPLETE ===');
      console.log(`Generated ${generatedAssets.length} assets in ${processingTime}ms`);

      return {
        moments: processedMoments,
        generatedAssets,
        compositeVideoPath,
        processingTime
      };

    } catch (error) {
      console.error('B-roll generation failed:', error);
      throw new Error(`Failed to generate B-roll: ${error instanceof Error ? error.message : 'Unknown error'}`);
    }
  }

  private async createCompositeVideo(
    originalVideoPath: string,
    moments: BRollMoment[],
    config: BRollConfig
  ): Promise<string> {
    console.log('Creating composite video with B-roll overlays...');
    
    if (moments.length === 0) {
      console.log('No B-roll moments to embed, returning original video');
      return originalVideoPath;
    }

    // Create output path
    const timestamp = Date.now();
    const outputPath = `uploads/broll/composite_${timestamp}.mp4`;
    
    // Ensure output directory exists
    await fs.mkdir('uploads/broll', { recursive: true });

    // Get video dimensions first
    const videoDimensions = await this.getVideoDimensions(originalVideoPath);
    const { width, height } = videoDimensions;

    // Build FFmpeg filter complex for overlaying B-roll
    let filterComplex = '';
    const inputs = ['-i', originalVideoPath];
    
    // Add each B-roll asset as input
    moments.forEach((moment, index) => {
      if (moment.imagePath || moment.videoPath) {
        const assetPath = moment.videoPath || moment.imagePath;
        inputs.push('-i', assetPath!);
      }
    });

    // Create overlay filters for each B-roll moment
    let currentFilter = '0:v'; // Start with original video
    let validOverlays = 0;
    
    moments.forEach((moment, index) => {
      if (moment.imagePath || moment.videoPath) {
        validOverlays++;
        const inputIndex = validOverlays;
        const prevFilter = currentFilter;
        currentFilter = `v${validOverlays}`;
        
        // Scale B-roll to exactly match video dimensions
        filterComplex += `[${inputIndex}:v]scale=${width}:${height}:force_original_aspect_ratio=decrease,`;
        filterComplex += `pad=${width}:${height}:(ow-iw)/2:(oh-ih)/2[broll${index}];`;
        
        // Overlay B-roll covering entire frame with fade in/out
        const fadeInStart = moment.timestamp;
        const fadeOutEnd = moment.timestamp + moment.duration;
        
        filterComplex += `[${prevFilter}][broll${index}]overlay=`;
        filterComplex += `x=0:y=0:`;
        filterComplex += `enable='between(t,${fadeInStart},${fadeOutEnd})':`;
        filterComplex += `format=auto[${currentFilter}];`;
      }
    });

    // If no valid overlays, return original
    if (validOverlays === 0) {
      console.log('No valid B-roll assets to overlay');
      return originalVideoPath;
    }

    // Build FFmpeg command
    const ffmpegArgs = [
      ...inputs,
      '-filter_complex', filterComplex.slice(0, -1), // Remove trailing semicolon
      '-map', `[${currentFilter}]`,
      '-map', '0:a?', // Include original audio if present
      '-c:v', 'libx264',
      '-preset', 'fast',
      '-crf', '23',
      '-c:a', 'copy',
      '-y',
      outputPath
    ];

    return new Promise((resolve, reject) => {
      console.log('FFmpeg command:', ffmpegArgs.join(' '));
      
      const ffmpegProcess = spawn('ffmpeg', ffmpegArgs);
      
      let errorOutput = '';
      ffmpegProcess.stderr.on('data', (data) => {
        errorOutput += data.toString();
      });

      ffmpegProcess.on('close', (code) => {
        if (code === 0) {
          console.log('Composite video created successfully:', outputPath);
          resolve(outputPath);
        } else {
          console.error('FFmpeg composite error:', errorOutput);
          reject(new Error(`Failed to create composite video: ${errorOutput}`));
        }
      });
    });
  }

  private async transcribeVideoWithTimestamps(videoPath: string, aiModel?: string): Promise<{
    text: string;
    segments: Array<{ text: string; start: number; end: number; }>
  }> {
    try {
      // Check if video file exists
      try {
        await fs.access(videoPath);
      } catch (error) {
        console.error(`Video file not found at: ${videoPath}`);
        throw new Error(`Video file not found: ${videoPath}`);
      }
      
      // Extract audio from video
      const audioPath = `temp_audio_${Date.now()}.wav`;
      
      await new Promise((resolve, reject) => {
        const ffmpegProcess = spawn('ffmpeg', [
          '-i', videoPath,
          '-vn',
          '-acodec', 'pcm_s16le',
          '-ar', '16000',
          '-ac', '1',
          '-y',
          audioPath
        ]);

        let errorOutput = '';
        ffmpegProcess.stderr.on('data', (data) => {
          errorOutput += data.toString();
        });

        ffmpegProcess.on('close', (code) => {
          if (code === 0) resolve(null);
          else {
            console.error('FFmpeg error:', errorOutput);
            reject(new Error(`Audio extraction failed with code ${code}`));
          }
        });
      });

      // Read audio file and transcribe with Gemini
      const audioBuffer = await fs.readFile(audioPath);
      const audioBase64 = audioBuffer.toString('base64');

      const response = await this.genai.models.generateContent({
        model: aiModel || 'gemini-2.0-flash-exp',
        contents: [
          {
            inlineData: {
              data: audioBase64,
              mimeType: 'audio/wav'
            }
          },
          `Transcribe this audio with precise word-level timestamps. For each sentence or phrase, provide:
          - The exact text
          - Start time in seconds
          - End time in seconds
          
          Focus on identifying key concepts, topics, and entities mentioned in the speech.
          
          Return as JSON format:
          {
            "text": "full transcription",
            "segments": [
              {"text": "segment text", "start": 0.0, "end": 2.5},
              ...
            ]
          }`
        ],
        config: {
          responseMimeType: 'application/json'
        }
      });

      // Cleanup temp file
      await fs.unlink(audioPath).catch(() => {});

      const result = JSON.parse(response.text || '{"text": "", "segments": []}');
      console.log('Transcription result:', {
        text: result.text?.substring(0, 200) + '...',
        segmentCount: result.segments?.length || 0,
        firstSegment: result.segments?.[0]
      });
      return result;

    } catch (error) {
      console.error('Video transcription failed:', error);
      return { text: '', segments: [] };
    }
  }

  private async analyzeContentFocus(transcription: any, contentFocus: string, aiModel?: string): Promise<BRollMoment[]> {
    try {
      // Extract keywords from content focus
      const keywordPattern = /'([^']+)'/g;
      const keywords: string[] = [];
      let match;
      
      while ((match = keywordPattern.exec(contentFocus)) !== null) {
        keywords.push(match[1].toLowerCase());
      }
      
      // If no quoted keywords, split by common delimiters
      if (keywords.length === 0 && contentFocus) {
        keywords.push(...contentFocus.toLowerCase().split(/[,\s]+/).filter(k => k.length > 0));
      }

      console.log('Detected keywords:', keywords);
      console.log('Transcription segments count:', transcription.segments?.length || 0);

      // Find moments where keywords are mentioned and merge adjacent segments
      const keywordSegments: Map<string, Array<{start: number; end: number; text: string; index: number}>> = new Map();
      
      // First pass: collect all segments containing keywords
      for (let i = 0; i < transcription.segments.length; i++) {
        const segment = transcription.segments[i];
        const segmentLower = segment.text.toLowerCase();
        
        for (const keyword of keywords) {
          if (segmentLower.includes(keyword)) {
            console.log(`Found keyword "${keyword}" in segment: "${segment.text}"`);
            if (!keywordSegments.has(keyword)) {
              keywordSegments.set(keyword, []);
            }
            keywordSegments.get(keyword)!.push({
              start: segment.start,
              end: segment.end,
              text: segment.text,
              index: i
            });
          }
        }
      }
      
      // Second pass: merge adjacent segments and create B-roll moments
      const moments: BRollMoment[] = [];
      
      for (const [keyword, segments] of Array.from(keywordSegments.entries())) {
        if (segments.length === 0) continue;
        
        // Sort segments by start time
        segments.sort((a: {start: number}, b: {start: number}) => a.start - b.start);
        
        // Group adjacent segments (within 3 seconds gap)
        const groups: Array<{start: number; end: number; text: string; indices: number[]}> = [];
        let currentGroup = {
          start: segments[0].start,
          end: segments[0].end,
          text: segments[0].text,
          indices: [segments[0].index]
        };
        
        for (let i = 1; i < segments.length; i++) {
          // If segments are close or adjacent, merge them
          if (segments[i].start - currentGroup.end <= 3 || Math.abs(segments[i].index - currentGroup.indices[currentGroup.indices.length - 1]) <= 2) {
            currentGroup.end = segments[i].end;
            currentGroup.text += ' ' + segments[i].text;
            currentGroup.indices.push(segments[i].index);
          } else {
            // Save current group and start new one
            groups.push(currentGroup);
            currentGroup = {
              start: segments[i].start,
              end: segments[i].end,
              text: segments[i].text,
              indices: [segments[i].index]
            };
          }
        }
        groups.push(currentGroup);
        
        // Create B-roll moments for each group
        for (const group of groups) {
          // Get extended context including surrounding segments
          const minIndex = Math.max(0, Math.min(...group.indices) - 1);
          const maxIndex = Math.min(transcription.segments.length - 1, Math.max(...group.indices) + 1);
          const contextSegments = transcription.segments.slice(minIndex, maxIndex + 1);
          const context = contextSegments.map((s: any) => s.text).join(' ');
          
          // Generate description for B-roll
          const description = await this.generateBRollDescription(keyword, context, aiModel);
          
          moments.push({
            keyword,
            timestamp: group.start,
            duration: group.end - group.start, // Full duration of topic discussion
            context,
            description
          });
        }
      }

      // Sort moments by timestamp
      moments.sort((a, b) => a.timestamp - b.timestamp);
      
      return moments;

    } catch (error) {
      console.error('Content focus analysis failed:', error);
      return [];
    }
  }

  private async generateBRollDescription(keyword: string, context: string, aiModel?: string): Promise<string> {
    try {
      const response = await this.genai.models.generateContent({
        model: aiModel || 'gemini-2.0-flash-exp',
        contents: `Given the keyword "${keyword}" mentioned in this context: "${context}"
        
        Generate a detailed visual description for a B-roll image that would enhance this moment in the video.
        The description should be specific, cinematic, and suitable for AI image generation.
        
        Keep it under 100 words and focus on visual elements, composition, lighting, and mood.`
      });

      return response.text || `Cinematic visualization of ${keyword}`;
    } catch (error) {
      console.error('B-roll description generation failed:', error);
      return `Professional visualization of ${keyword}`;
    }
  }

  private async generateBRollImage(moment: BRollMoment, styleDescription: string): Promise<string | null> {
    try {
      const prompt = `${moment.description}. Style: ${styleDescription || 'Professional and cinematic'}. High quality, 16:9 aspect ratio.`;
      
      console.log(`Generating B-roll image for "${moment.keyword}" at ${moment.timestamp}s`);
      console.log('Prompt:', prompt);

      const imagePath = path.join('uploads', 'broll', `broll_${moment.keyword}_${Date.now()}.png`);
      
      // Ensure directory exists
      await fs.mkdir(path.dirname(imagePath), { recursive: true });

      // Generate image using Gemini 2.0 Flash
      const response = await this.genai.models.generateContent({
        model: 'gemini-2.0-flash-preview-image-generation',
        contents: [{ role: 'user', parts: [{ text: prompt }] }],
        config: {
          responseModalities: [Modality.TEXT, Modality.IMAGE],
        },
      });

      const candidates = response.candidates;
      if (!candidates || candidates.length === 0) {
        throw new Error('No candidates in response');
      }

      const content = candidates[0].content;
      if (!content || !content.parts) {
        throw new Error('No content in response');
      }

      for (const part of content.parts) {
        if (part.inlineData && part.inlineData.data) {
          const imageData = Buffer.from(part.inlineData.data, 'base64');
          await fs.writeFile(imagePath, imageData);
          console.log(`B-roll image saved: ${imagePath}`);
          return imagePath;
        }
      }

      throw new Error('No image data in response');

    } catch (error) {
      console.error('B-roll image generation failed:', error);
      return null;
    }
  }

  private async convertImageToVideo(imagePath: string, duration: number): Promise<string | null> {
    try {
      const videoPath = imagePath.replace('.png', '.mp4');
      
      await new Promise((resolve, reject) => {
        const ffmpegProcess = spawn('ffmpeg', [
          '-loop', '1',
          '-i', imagePath,
          '-c:v', 'libx264',
          '-t', duration.toString(),
          '-pix_fmt', 'yuv420p',
          '-vf', 'scale=1920:1080,zoompan=z=\'zoom+0.001\':x=\'iw/2-(iw/zoom/2)\':y=\'ih/2-(ih/zoom/2)\':d=' + (duration * 25),
          '-y',
          videoPath
        ]);

        ffmpegProcess.on('close', (code) => {
          if (code === 0) resolve(null);
          else reject(new Error(`Video conversion failed with code ${code}`));
        });
      });

      console.log(`B-roll video created: ${videoPath}`);
      return videoPath;

    } catch (error) {
      console.error('Image to video conversion failed:', error);
      return null;
    }
  }

  private async getVideoDuration(videoPath: string): Promise<number> {
    return new Promise((resolve, reject) => {
      const ffprobeProcess = spawn('ffprobe', [
        '-v', 'error',
        '-show_entries', 'format=duration',
        '-of', 'default=noprint_wrappers=1:nokey=1',
        videoPath
      ]);

      let duration = '';
      ffprobeProcess.stdout.on('data', (data) => {
        duration += data.toString();
      });

      ffprobeProcess.on('close', (code) => {
        if (code === 0) {
          resolve(parseFloat(duration) || 60);
        } else {
          resolve(60); // Default to 60 seconds
        }
      });
    });
  }

  private async getVideoDimensions(videoPath: string): Promise<{ width: number; height: number }> {
    return new Promise((resolve, reject) => {
      const ffprobeProcess = spawn('ffprobe', [
        '-v', 'error',
        '-select_streams', 'v:0',
        '-show_entries', 'stream=width,height',
        '-of', 'json',
        videoPath
      ]);

      let output = '';
      let errorOutput = '';

      ffprobeProcess.stdout.on('data', (data) => {
        output += data.toString();
      });

      ffprobeProcess.stderr.on('data', (data) => {
        errorOutput += data.toString();
      });

      ffprobeProcess.on('close', (code) => {
        if (code === 0) {
          try {
            const result = JSON.parse(output);
            const stream = result.streams?.[0];
            if (stream && stream.width && stream.height) {
              resolve({ width: stream.width, height: stream.height });
            } else {
              // Default to 1920x1080 if we can't get dimensions
              resolve({ width: 1920, height: 1080 });
            }
          } catch (error) {
            // Default to 1920x1080 if parsing fails
            resolve({ width: 1920, height: 1080 });
          }
        } else {
          // Default to 1920x1080 if ffprobe fails
          resolve({ width: 1920, height: 1080 });
        }
      });
    });
  }
}