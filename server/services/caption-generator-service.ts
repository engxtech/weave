import { GoogleGenerativeAI } from '@google/generative-ai';
import ffmpeg from 'fluent-ffmpeg';
import fs from 'fs/promises';
import path from 'path';
import { createClient } from '@deepgram/sdk';

export class CaptionGeneratorService {
  private genAI: GoogleGenerativeAI;
  private deepgram: any;

  constructor() {
    this.genAI = new GoogleGenerativeAI(process.env.GEMINI_API_KEY || '');
    this.deepgram = createClient(process.env.DEEPGRAM_API_KEY || '');
  }

  async generateCaptions(inputPath: string, config: any): Promise<{
    outputPath: string;
    captionFile: string;
    style: any;
    wordCount: number;
  }> {
    console.log('📝 Starting Deepgram caption generation with config:', config);
    
    const outputDir = path.join('uploads', 'captioned');
    await fs.mkdir(outputDir, { recursive: true });

    const outputPath = path.join(outputDir, `captioned_${Date.now()}.mp4`);
    const srtPath = path.join(outputDir, `captions_${Date.now()}.srt`);

    try {
      // Use Deepgram for transcription with word-level timestamps
      const transcription = await this.transcribeWithTimestamps(inputPath);
      
      // Generate optimized captions (6-8 words per screen)
      const captions = await this.generateOptimizedCaptions(transcription, config);
      
      // Create SRT file
      await this.createSRTFile(captions, srtPath);
      
      // Apply captions to video with custom styling
      await this.applyCaptionsToVideo(inputPath, srtPath, outputPath, config);
      
      return {
        outputPath,
        captionFile: srtPath,
        style: this.getStyledCaptionConfig(config),
        wordCount: captions.reduce((sum, cap) => sum + cap.text.split(' ').length, 0)
      };
    } catch (error) {
      console.error('Caption generation failed:', error);
      throw error;
    }
  }

  private async transcribeWithTimestamps(videoPath: string): Promise<any[]> {
    const audioPath = `temp_audio_${Date.now()}.wav`;
    
    try {
      // Extract audio
      await new Promise((resolve, reject) => {
        ffmpeg(videoPath)
          .outputOptions(['-vn', '-acodec', 'pcm_s16le', '-ar', '16000', '-ac', '1'])
          .output(audioPath)
          .on('end', resolve)
          .on('error', reject)
          .run();
      });

      // Use Deepgram for transcription
      const audioBuffer = await fs.readFile(audioPath);
      
      const { result } = await this.deepgram.listen.prerecorded.transcribeFile(
        audioBuffer,
        {
          model: 'nova-2',
          smart_format: true,
          punctuate: true,
          paragraphs: true,
          utterances: true,
          language: 'en-US',
          detect_language: true
        }
      );

      // Extract words with timestamps
      const words = result?.results?.channels?.[0]?.alternatives?.[0]?.words || [];
      
      // Group words into caption segments
      const segments: any[] = [];
      let currentSegment: {
        text: string;
        start: number;
        end: number;
        words: any[];
      } = {
        text: '',
        start: 0,
        end: 0,
        words: []
      };
      
      for (const word of words) {
        if (!currentSegment.text) {
          currentSegment.start = word.start;
        }
        
        currentSegment.text += (currentSegment.text ? ' ' : '') + word.word;
        currentSegment.end = word.end;
        currentSegment.words.push(word);
        
        // Create new segment after 5-8 words or at sentence boundaries
        if (currentSegment.words.length >= 6 || 
            word.word.match(/[.!?]$/) ||
            (word.end - currentSegment.start) > 4) {
          segments.push({ ...currentSegment });
          currentSegment = {
            text: '',
            start: 0,
            end: 0,
            words: []
          };
        }
      }
      
      // Add any remaining words
      if (currentSegment.text) {
        segments.push(currentSegment);
      }
      
      // Clean up temp audio file
      await fs.unlink(audioPath).catch(() => {});
      
      return segments;
    } catch (error) {
      console.error('Deepgram transcription error:', error);
      throw error;
    }
  }

  private async generateOptimizedCaptions(transcription: any[], config: any): Promise<any[]> {
    // For now, return the transcription as-is since Deepgram already provides excellent segmentation
    // This avoids JSON parsing errors and maintains the 6-8 word grouping from Deepgram
    return transcription.map((segment, index) => ({
      id: index + 1,
      start: segment.start,
      end: segment.end,
      text: segment.text.trim(),
      words: segment.words
    }));
  }

  private async createSRTFile(captions: any[], outputPath: string): Promise<void> {
    let srtContent = '';
    
    captions.forEach((caption, index) => {
      const startTime = this.formatSRTTime(caption.start);
      const endTime = this.formatSRTTime(caption.end);
      
      srtContent += `${index + 1}\n`;
      srtContent += `${startTime} --> ${endTime}\n`;
      srtContent += `${caption.text}\n\n`;
    });
    
    await fs.writeFile(outputPath, srtContent);
  }

  private getStyledCaptionConfig(config: any): any {
    const captionSize = config.captionSize || 100;
    const highlightColor = config.highlightColor || 'Green';
    
    return {
      fontSize: captionSize,
      fontColor: '#FFFFFF',
      highlightColor: this.getColorCode(highlightColor),
      backgroundColor: 'rgba(0, 0, 0, 0.8)',
      position: 'bottom',
      fontFamily: 'Arial',
      fontWeight: 'bold',
      wordsPerScreen: '6-8'
    };
  }
  
  private getColorCode(colorName: string): string {
    const colors: Record<string, string> = {
      'Green': '#00FF00',
      'Yellow': '#FFFF00',
      'Red': '#FF0000',
      'Blue': '#0000FF',
      'Cyan': '#00FFFF',
      'Purple': '#FF00FF',
      'Orange': '#FFA500',
      'White': '#FFFFFF'
    };
    return colors[colorName] || '#00FF00';
  }

  private formatSRTTime(seconds: number): string {
    const hours = Math.floor(seconds / 3600);
    const minutes = Math.floor((seconds % 3600) / 60);
    const secs = Math.floor(seconds % 60);
    const ms = Math.floor((seconds % 1) * 1000);
    
    return `${hours.toString().padStart(2, '0')}:${minutes.toString().padStart(2, '0')}:${secs.toString().padStart(2, '0')},${ms.toString().padStart(3, '0')}`;
  }

  private async applyCaptionsToVideo(
    inputVideo: string,
    srtPath: string,
    outputPath: string,
    config: any
  ): Promise<void> {
    // Get caption size and highlight color from config
    const captionSize = config.captionSize || 100;
    const highlightColor = config.highlightColor || 'Green';
    
    // Create style with user's settings
    const style = {
      fontName: 'Arial',
      fontSize: Math.round(captionSize * 0.24), // Scale based on caption size (100 = 24pt)
      primaryColor: '&HFFFFFF', // White text
      outlineColor: this.getFFmpegColor(highlightColor), // Use highlight color for outline
      backColor: '&H80000000', // Semi-transparent black background
      bold: 1,
      alignment: 2 // Center
    };
    
    return new Promise<void>((resolve, reject) => {
      ffmpeg(inputVideo)
        .outputOptions([
          '-vf', `subtitles=${srtPath}:force_style='${this.getFFmpegStyle(style)}'`,
          '-c:a', 'copy'
        ])
        .output(outputPath)
        .on('end', () => resolve())
        .on('error', (err) => reject(err))
        .run();
    });
  }

  private getStylePrompt(style: string): string {
    const styles: Record<string, string> = {
      'minimal': 'Clean, sans-serif, high contrast, no decorations',
      'bold': 'Large, impactful, strong colors, attention-grabbing',
      'animated': 'Dynamic entry/exit, word-by-word reveal, kinetic',
      'neon': 'Glowing effects, vibrant colors, nightlife aesthetic',
      'professional': 'Corporate clean, subtle, readable, trustworthy'
    };
    
    return styles[style] || styles['minimal'];
  }

  private getDefaultStyle(): any {
    return {
      fontName: 'Arial',
      fontSize: 24,
      primaryColor: '&HFFFFFF',
      outlineColor: '&H000000',
      backColor: '&H80000000',
      bold: 1,
      alignment: 2 // Center
    };
  }

  private getFFmpegStyle(style: any): string {
    return [
      `FontName=${style.fontName}`,
      `FontSize=${style.fontSize}`,
      `PrimaryColour=${style.primaryColor}`,
      `OutlineColour=${style.outlineColor}`,
      `BackColour=${style.backColor}`,
      `Bold=${style.bold}`,
      `Alignment=${style.alignment}`
    ].join(',');
  }

  private getFFmpegColor(colorName: string): string {
    // Convert color names to FFmpeg ASS format (BGR order with &H prefix)
    const colors: Record<string, string> = {
      'Green': '&H00FF00',
      'Yellow': '&H00FFFF',
      'Red': '&H0000FF',
      'Blue': '&HFF0000',
      'Cyan': '&HFFFF00',
      'Purple': '&HFF00FF',
      'Orange': '&H00A5FF',
      'White': '&HFFFFFF'
    };
    return colors[colorName] || '&H00FF00';
  }
}