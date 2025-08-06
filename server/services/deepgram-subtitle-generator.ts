import { createClient } from '@deepgram/sdk';
import * as fs from 'fs';
import * as path from 'path';
import { nanoid } from 'nanoid';

interface SubtitleWord {
  word: string;
  start: number;
  end: number;
  confidence: number;
}

interface SubtitleSegment {
  start: number;
  end: number;
  text: string;
  words: SubtitleWord[];
}

interface SubtitleStyle {
  fontSize: number;
  fontWeight: string;
  color: string;
  backgroundColor: string;
  position: 'center' | 'top' | 'bottom';
  alignment: 'left' | 'center' | 'right';
  borderRadius: number;
  padding: number;
  shadowBlur: number;
  shadowColor: string;
  outlineWidth: number;
  outlineColor: string;
}

const SUBTITLE_STYLES: Record<string, SubtitleStyle> = {
  youtube_gaming: {
    fontSize: 45,
    fontWeight: 'bold',
    color: '#FFFFFF',
    backgroundColor: 'rgba(255, 0, 0, 0.8)',
    position: 'bottom',
    alignment: 'center',
    borderRadius: 8,
    padding: 16,
    shadowBlur: 30,
    shadowColor: '#000000',
    outlineWidth: 3,
    outlineColor: '#000000'
  },
  tiktok_viral: {
    fontSize: 42,
    fontWeight: 'bold',
    color: '#FFFFFF',
    backgroundColor: 'rgba(0, 0, 0, 0.7)',
    position: 'center',
    alignment: 'center',
    borderRadius: 12,
    padding: 20,
    shadowBlur: 20,
    shadowColor: '#FF006E',
    outlineWidth: 2,
    outlineColor: '#FF006E'
  },
  instagram_modern: {
    fontSize: 38,
    fontWeight: '600',
    color: '#FFFFFF',
    backgroundColor: 'rgba(138, 43, 226, 0.8)',
    position: 'bottom',
    alignment: 'center',
    borderRadius: 16,
    padding: 18,
    shadowBlur: 25,
    shadowColor: '#8A2BE2',
    outlineWidth: 2,
    outlineColor: '#FFFFFF'
  },
  professional: {
    fontSize: 35,
    fontWeight: '500',
    color: '#FFFFFF',
    backgroundColor: 'rgba(0, 0, 0, 0.85)',
    position: 'bottom',
    alignment: 'center',
    borderRadius: 4,
    padding: 12,
    shadowBlur: 10,
    shadowColor: '#000000',
    outlineWidth: 1,
    outlineColor: '#333333'
  },
  neon_glow: {
    fontSize: 40,
    fontWeight: 'bold',
    color: '#00FFFF',
    backgroundColor: 'rgba(0, 0, 0, 0.6)',
    position: 'center',
    alignment: 'center',
    borderRadius: 20,
    padding: 24,
    shadowBlur: 40,
    shadowColor: '#00FFFF',
    outlineWidth: 3,
    outlineColor: '#0080FF'
  },
  bold_impact: {
    fontSize: 48,
    fontWeight: '900',
    color: '#FFFF00',
    backgroundColor: 'rgba(255, 0, 0, 0.9)',
    position: 'top',
    alignment: 'center',
    borderRadius: 6,
    padding: 20,
    shadowBlur: 35,
    shadowColor: '#000000',
    outlineWidth: 4,
    outlineColor: '#000000'
  }
};

export class DeepgramSubtitleGenerator {
  private deepgram: any;

  constructor() {
    if (!process.env.DEEPGRAM_API_KEY) {
      throw new Error('DEEPGRAM_API_KEY environment variable is required');
    }
    this.deepgram = createClient(process.env.DEEPGRAM_API_KEY);
  }

  async generateSubtitles(
    videoPath: string, 
    style: string = 'youtube_gaming',
    position: 'center' | 'top' | 'bottom' = 'bottom',
    customSettings?: Partial<SubtitleStyle>
  ): Promise<{
    segments: SubtitleSegment[];
    srtContent: string;
    styleSettings: SubtitleStyle;
  }> {
    try {
      console.log('Starting Deepgram subtitle generation for:', videoPath);

      // Extract audio from video
      const audioPath = await this.extractAudio(videoPath);
      
      // Transcribe with Deepgram
      const transcription = await this.transcribeWithDeepgram(audioPath);
      
      // Process into subtitle segments
      const segments = this.processTranscriptionToSegments(transcription);
      
      // Generate SRT content
      const srtContent = this.generateSRT(segments);
      
      // Get style settings
      const baseStyle = SUBTITLE_STYLES[style] || SUBTITLE_STYLES.youtube_gaming;
      const styleSettings = {
        ...baseStyle,
        position,
        ...customSettings
      };

      // Cleanup temporary audio file
      if (fs.existsSync(audioPath)) {
        fs.unlinkSync(audioPath);
      }

      console.log(`Generated ${segments.length} subtitle segments with style: ${style}`);
      
      return {
        segments,
        srtContent,
        styleSettings
      };

    } catch (error) {
      console.error('Deepgram subtitle generation error:', error);
      throw new Error(`Failed to generate subtitles: ${error instanceof Error ? error.message : String(error)}`);
    }
  }

  private async extractAudio(videoPath: string): Promise<string> {
    const { exec } = await import('child_process');
    const audioPath = path.join('uploads', `temp_audio_${nanoid()}.wav`);
    
    return new Promise((resolve, reject) => {
      const command = `ffmpeg -i "${videoPath}" -vn -acodec pcm_s16le -ar 16000 -ac 1 -y "${audioPath}"`;
      
      exec(command, (error, stdout, stderr) => {
        if (error) {
          console.error('Audio extraction error:', error);
          reject(new Error(`Audio extraction failed: ${error instanceof Error ? error.message : String(error)}`));
          return;
        }
        
        if (!fs.existsSync(audioPath)) {
          reject(new Error('Audio file was not created'));
          return;
        }
        
        console.log('Audio extracted successfully:', audioPath);
        resolve(audioPath);
      });
    });
  }

  private async transcribeWithDeepgram(audioPath: string): Promise<any> {
    try {
      const audioBuffer = fs.readFileSync(audioPath);
      
      const response = await this.deepgram.listen.prerecorded.transcribeFile(
        audioBuffer,
        {
          model: 'nova-2',
          language: 'en',
          smart_format: true,
          punctuate: true,
          diarize: false,
          utterances: true,
          words: true,
          paragraphs: false,
          summarize: false
        }
      );

      if (!response.result?.results?.channels?.[0]?.alternatives?.[0]) {
        throw new Error('No transcription results from Deepgram');
      }

      console.log('Deepgram transcription completed successfully');
      return response.result.results.channels[0].alternatives[0];

    } catch (error) {
      console.error('Deepgram transcription error:', error);
      throw new Error(`Deepgram transcription failed: ${error instanceof Error ? error.message : String(error)}`);
    }
  }

  private processTranscriptionToSegments(transcription: any): SubtitleSegment[] {
    const words = transcription.words || [];
    const segments: SubtitleSegment[] = [];
    
    if (words.length === 0) {
      return segments;
    }

    // Group words into segments (4-6 words each for optimal readability)
    const wordsPerSegment = 5;
    
    for (let i = 0; i < words.length; i += wordsPerSegment) {
      const segmentWords = words.slice(i, i + wordsPerSegment);
      
      if (segmentWords.length === 0) continue;
      
      const segment: SubtitleSegment = {
        start: segmentWords[0].start,
        end: segmentWords[segmentWords.length - 1].end,
        text: segmentWords.map((w: any) => w.punctuated_word || w.word).join(' '),
        words: segmentWords.map((w: any) => ({
          word: w.punctuated_word || w.word,
          start: w.start,
          end: w.end,
          confidence: w.confidence || 0.9
        }))
      };
      
      segments.push(segment);
    }

    console.log(`Processed ${words.length} words into ${segments.length} segments`);
    return segments;
  }

  private generateSRT(segments: SubtitleSegment[]): string {
    let srtContent = '';
    
    segments.forEach((segment, index) => {
      const startTime = this.formatSRTTime(segment.start);
      const endTime = this.formatSRTTime(segment.end);
      
      srtContent += `${index + 1}\n`;
      srtContent += `${startTime} --> ${endTime}\n`;
      srtContent += `${segment.text}\n\n`;
    });
    
    return srtContent.trim();
  }

  private formatSRTTime(seconds: number): string {
    const hours = Math.floor(seconds / 3600);
    const minutes = Math.floor((seconds % 3600) / 60);
    const secs = Math.floor(seconds % 60);
    const milliseconds = Math.floor((seconds % 1) * 1000);
    
    return `${hours.toString().padStart(2, '0')}:${minutes.toString().padStart(2, '0')}:${secs.toString().padStart(2, '0')},${milliseconds.toString().padStart(3, '0')}`;
  }

  async generateSubtitleVideo(
    videoPath: string,
    segments: SubtitleSegment[],
    styleSettings: SubtitleStyle,
    outputPath?: string
  ): Promise<string> {
    const { exec } = await import('child_process');
    const finalOutputPath = outputPath || path.join('uploads', `subtitled_video_${nanoid()}.mp4`);
    
    // Create a simple SRT file instead of complex FFmpeg filters
    const srtPath = path.join('uploads', `temp_subtitles_${nanoid()}.srt`);
    const srtContent = this.generateSRT(segments);
    fs.writeFileSync(srtPath, srtContent);
    
    // Calculate position based on style
    let subtitlePosition = '';
    switch (styleSettings.position) {
      case 'top':
        subtitlePosition = 'Alignment=2,MarginV=50'; // Top alignment
        break;
      case 'center':
        subtitlePosition = 'Alignment=2,MarginV=300'; // Center alignment
        break;
      case 'bottom':
      default:
        subtitlePosition = 'Alignment=2,MarginV=50'; // Bottom alignment (default)
        break;
    }
    
    return new Promise((resolve, reject) => {
      const command = `ffmpeg -i "${videoPath}" -vf "subtitles=${srtPath}:force_style='FontSize=${styleSettings.fontSize},FontName=Arial,PrimaryColour=&H00FFFFFF,OutlineColour=&H00000000,BackColour=&H80000000,Bold=1,${subtitlePosition}'" -c:a copy -y "${finalOutputPath}"`;
      
      console.log('Creating subtitled video with SRT file...');
      console.log('FFmpeg command:', command);
      
      exec(command, (error, stdout, stderr) => {
        // Clean up temp SRT file
        if (fs.existsSync(srtPath)) {
          fs.unlinkSync(srtPath);
        }
        
        if (error) {
          console.error('Subtitle video creation error:', error);
          console.error('FFmpeg stderr:', stderr);
          reject(new Error(`Subtitle video creation failed: ${error instanceof Error ? error.message : String(error)}`));
          return;
        }
        
        if (!fs.existsSync(finalOutputPath)) {
          reject(new Error('Subtitled video was not created'));
          return;
        }
        
        console.log('Subtitled video created successfully:', finalOutputPath);
        resolve(finalOutputPath);
      });
    });
  }

  getStyleSettings(style: string = 'youtube_gaming', position: 'center' | 'top' | 'bottom' = 'bottom'): SubtitleStyle {
    const baseStyle = SUBTITLE_STYLES[style] || SUBTITLE_STYLES.youtube_gaming;
    return {
      ...baseStyle,
      position
    };
  }

  private createFFmpegSubtitleFilter(segments: SubtitleSegment[], style: SubtitleStyle): string {
    const filters: string[] = [];
    const videoHeight = 1920; // 9:16 aspect ratio
    
    // Calculate position
    let yPosition: number;
    switch (style.position) {
      case 'top':
        yPosition = style.fontSize + style.padding;
        break;
      case 'center':
        yPosition = videoHeight / 2;
        break;
      case 'bottom':
      default:
        yPosition = videoHeight - style.fontSize - style.padding - 50;
        break;
    }

    segments.forEach((segment, index) => {
      // Simple text cleaning - remove problematic characters
      const cleanText = segment.text
        .replace(/['"]/g, '')  // Remove quotes
        .replace(/[:;,]/g, ' ') // Replace punctuation with spaces
        .replace(/\s+/g, ' ')   // Normalize spaces
        .trim();
      
      const textFilter = `drawtext=text=${cleanText}` +
        `:fontsize=${style.fontSize}` +
        `:fontcolor=${style.color}` +
        `:x=(w-text_w)/2` +
        `:y=${yPosition}` +
        `:enable=between(t\\,${segment.start}\\,${segment.end})` +
        `:box=1:boxcolor=${style.backgroundColor}` +
        `:boxborderw=${style.padding}`;
      
      filters.push(textFilter);
    });

    return filters.join(',');
  }
}