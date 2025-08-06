import { GoogleGenerativeAI } from '@google/generative-ai';
import ffmpeg from 'fluent-ffmpeg';
import fs from 'fs/promises';
import path from 'path';

export class MusicService {
  private genAI: GoogleGenerativeAI;

  constructor() {
    this.genAI = new GoogleGenerativeAI(process.env.GEMINI_API_KEY || '');
  }

  async processMusic(inputPath: string, config: any): Promise<{
    outputPath: string;
    musicTrack: string;
    musicStyle: string;
    processingTime: number;
  }> {
    const startTime = Date.now();
    console.log('🎵 Starting music processing with config:', config);
    
    const outputDir = path.join('uploads', 'music');
    await fs.mkdir(outputDir, { recursive: true });

    const outputPath = path.join(outputDir, `music_${Date.now()}.mp4`);

    try {
      // Step 1: Analyze video content for music recommendations
      const musicAnalysis = await this.analyzeForMusic(inputPath, config);
      
      // Step 2: Generate or select music track
      const musicTrack = await this.generateMusic(musicAnalysis, config);
      
      // Step 3: Mix music with video
      await this.mixMusicWithVideo(inputPath, musicTrack, outputPath, config);
      
      const processingTime = Date.now() - startTime;
      
      return {
        outputPath,
        musicTrack,
        musicStyle: musicAnalysis.style,
        processingTime
      };
    } catch (error) {
      console.error('Music processing failed:', error);
      throw error;
    }
  }

  private async analyzeForMusic(videoPath: string, config: any): Promise<any> {
    const model = this.genAI.getGenerativeModel({ model: 'gemini-2.0-flash-exp' });
    
    // Extract audio for analysis
    const audioPath = `temp_audio_${Date.now()}.wav`;
    await new Promise((resolve, reject) => {
      ffmpeg(videoPath)
        .outputOptions(['-vn', '-acodec', 'pcm_s16le', '-ar', '16000', '-ac', '1', '-t', '30'])
        .output(audioPath)
        .on('end', resolve)
        .on('error', reject)
        .run();
    });

    const audioBuffer = await fs.readFile(audioPath);
    const audioBase64 = audioBuffer.toString('base64');

    const result = await model.generateContent([
      {
        inlineData: {
          data: audioBase64,
          mimeType: 'audio/wav'
        }
      },
      `Analyze this video content to recommend background music.
      
      Consider:
      1. Content mood and energy level
      2. Pacing and rhythm of speech/action
      3. Target audience and platform
      4. Genre preferences: ${config.genre || 'auto-detect'}
      
      Analyze for:
      - Overall mood (upbeat, calm, dramatic, inspirational, etc.)
      - Energy curve throughout video
      - Key moments needing emphasis
      - Suggested BPM range
      - Instrumentation style
      
      Return analysis:
      {
        "mood": "primary mood",
        "energy": "low|medium|high",
        "style": "electronic|acoustic|orchestral|ambient|pop|rock|jazz|classical",
        "bpm": number,
        "dynamics": [
          {
            "start": 0,
            "end": 10,
            "intensity": 0.1-1.0,
            "description": "intro buildup"
          }
        ],
        "instruments": ["synth", "drums", "bass", "piano"],
        "keywords": ["uplifting", "corporate", "modern"]
      }`
    ]);

    await fs.unlink(audioPath).catch(() => {});
    
    try {
      return JSON.parse(result.response.text());
    } catch (e) {
      console.error('Failed to parse music analysis:', e);
      return {
        mood: 'neutral',
        energy: 'medium',
        style: 'electronic',
        bpm: 120,
        dynamics: [],
        instruments: ['synth', 'drums'],
        keywords: ['background', 'corporate']
      };
    }
  }

  private async generateMusic(analysis: any, config: any): Promise<string> {
    const musicPath = path.join('uploads', 'music', `track_${Date.now()}.mp3`);
    
    // Get video duration
    const duration = await this.getVideoDuration(config.videoPath || 'input.mp4');
    
    // Generate AI music based on analysis
    // For now, we'll create a simple synthesized track
    await this.createSynthesizedTrack(musicPath, duration, analysis);
    
    return musicPath;
  }

  private async getVideoDuration(videoPath: string): Promise<number> {
    return new Promise((resolve, reject) => {
      ffmpeg.ffprobe(videoPath, (err, metadata) => {
        if (err) reject(err);
        else resolve(metadata.format.duration || 30);
      });
    });
  }

  private async createSynthesizedTrack(outputPath: string, duration: number, analysis: any): Promise<void> {
    // Create a simple synthesized track using FFmpeg's audio synthesis
    const bpm = analysis.bpm || 120;
    const beatDuration = 60 / bpm;
    
    // Build complex audio synthesis filter
    const filters: string[] = [];
    
    // Bass line
    if (analysis.instruments.includes('bass')) {
      filters.push(
        `sine=frequency=55:duration=${duration}:sample_rate=44100,` +
        `volume=0.3*sin(2*PI*${beatDuration}*t)[bass]`
      );
    }
    
    // Kick drum
    if (analysis.instruments.includes('drums')) {
      filters.push(
        `sine=frequency=60:duration=0.1:sample_rate=44100,` +
        `aloop=loop=999:size=44100*${beatDuration},` +
        `volume=0.5*exp(-t*10)[kick]`
      );
    }
    
    // Hi-hat
    filters.push(
      `anoisesrc=d=${duration}:c=white:r=44100,` +
      `highpass=f=8000,` +
      `volume=0.1*mod(t\\,${beatDuration/2})[hihat]`
    );
    
    // Melody synth
    if (analysis.style === 'electronic' || analysis.instruments.includes('synth')) {
      const melodyFreqs = [440, 494, 523, 587]; // A4, B4, C5, D5
      filters.push(
        `sine=frequency=${melodyFreqs[0]}:duration=${duration}:sample_rate=44100,` +
        `vibrato=f=5:d=0.5,` +
        `volume=0.2[melody]`
      );
    }
    
    // Mix all elements
    let mixInputs = [];
    if (filters.some(f => f.includes('[bass]'))) mixInputs.push('[bass]');
    if (filters.some(f => f.includes('[kick]'))) mixInputs.push('[kick]');
    mixInputs.push('[hihat]');
    if (filters.some(f => f.includes('[melody]'))) mixInputs.push('[melody]');
    
    const mixFilter = mixInputs.join('') + `amix=inputs=${mixInputs.length}:duration=longest[out]`;
    
    return new Promise((resolve, reject) => {
      const cmd = ffmpeg()
        .input('anullsrc')
        .inputOptions(['-f', 'lavfi']);
      
      cmd
        .complexFilter([
          ...filters,
          mixFilter
        ])
        .outputOptions([
          '-map', '[out]',
          '-t', duration.toString(),
          '-acodec', 'libmp3lame',
          '-b:a', '128k'
        ])
        .output(outputPath)
        .on('end', () => {
          console.log('✅ Music track generated');
          resolve();
        })
        .on('error', reject)
        .run();
    });
  }

  private async mixMusicWithVideo(
    videoPath: string, 
    musicPath: string, 
    outputPath: string,
    config: any
  ): Promise<void> {
    const musicVolume = config.musicVolume || 0.3;
    const fadeIn = config.fadeIn !== false;
    const fadeOut = config.fadeOut !== false;
    
    // Get video duration for fade timing
    const duration = await this.getVideoDuration(videoPath);
    const fadeInDuration = 2;
    const fadeOutStart = duration - 3;
    
    return new Promise((resolve, reject) => {
      const filters: string[] = [
        // Original audio processing
        '[0:a]volume=1[original]',
        // Music processing with fades
        `[1:a]volume=${musicVolume}` +
        (fadeIn ? `,afade=t=in:st=0:d=${fadeInDuration}` : '') +
        (fadeOut ? `,afade=t=out:st=${fadeOutStart}:d=3` : '') +
        '[music]',
        // Mix audio tracks
        '[original][music]amix=inputs=2:duration=first:dropout_transition=2[mixed]'
      ];
      
      ffmpeg()
        .input(videoPath)
        .input(musicPath)
        .complexFilter(filters)
        .outputOptions([
          '-map', '0:v',
          '-map', '[mixed]',
          '-c:v', 'copy',
          '-c:a', 'aac',
          '-b:a', '192k',
          '-shortest'
        ])
        .output(outputPath)
        .on('end', () => {
          console.log('✅ Music mixed with video');
          resolve();
        })
        .on('error', reject)
        .run();
    });
  }
}