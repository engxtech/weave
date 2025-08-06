import { GoogleGenerativeAI } from '@google/generative-ai';
import ffmpeg from 'fluent-ffmpeg';
import fs from 'fs';
import path from 'path';

interface Word {
  punctuated_word: string;
  start: number;
  end: number;
}

interface SubtitleSegment {
  start: number;
  end: number;
  text: string;
  words: Word[];
}

export class SubtitleGenerator {
  private ai: GoogleGenerativeAI;

  constructor(apiKey: string) {
    this.ai = new GoogleGenerativeAI(apiKey);
  }

  async generateSubtitles(videoPath: string): Promise<SubtitleSegment[]> {
    console.log('[SubtitleGenerator] Starting subtitle generation for:', videoPath);
    
    // Get video duration
    const duration = await this.getVideoDuration(videoPath);
    console.log('[SubtitleGenerator] Video duration:', duration, 'seconds');
    
    // Extract audio from video
    const audioPath = videoPath.replace(path.extname(videoPath), '_audio.wav');
    await this.extractAudio(videoPath, audioPath);
    console.log('[SubtitleGenerator] Audio extracted to:', audioPath);
    
    // Transcribe audio with Gemini
    const transcription = await this.transcribeWithGemini(audioPath);
    console.log('[SubtitleGenerator] Transcription completed');
    
    // Parse and time-align the transcription
    const subtitleSegments = await this.createSubtitleSegments(transcription, duration);
    console.log('[SubtitleGenerator] Created', subtitleSegments.length, 'subtitle segments');
    
    // Generate SRT file
    await this.generateSRTFile(subtitleSegments, videoPath);
    
    // Clean up temporary audio file
    if (fs.existsSync(audioPath)) {
      fs.unlinkSync(audioPath);
    }
    
    return subtitleSegments;
  }

  private async getVideoDuration(videoPath: string): Promise<number> {
    return new Promise((resolve, reject) => {
      ffmpeg.ffprobe(videoPath, (err, metadata) => {
        if (err) {
          reject(err);
        } else {
          const duration = metadata.format.duration || 0;
          resolve(duration);
        }
      });
    });
  }

  private async extractAudio(videoPath: string, audioPath: string): Promise<void> {
    return new Promise((resolve, reject) => {
      ffmpeg(videoPath)
        .output(audioPath)
        .audioCodec('pcm_s16le')
        .audioChannels(1)
        .audioFrequency(16000)
        .on('end', () => resolve())
        .on('error', (err) => reject(err))
        .run();
    });
  }

  private async transcribeWithGemini(audioPath: string): Promise<string> {
    try {
      console.log('[SubtitleGenerator] Transcribing audio with Gemini...');
      
      const model = this.ai.getGenerativeModel({ model: "gemini-2.0-flash-exp" });
      
      // Read audio file as base64
      const audioBuffer = fs.readFileSync(audioPath);
      const audioBase64 = audioBuffer.toString('base64');
      
      const prompt = `Please transcribe this audio file accurately. Provide the transcription as plain text with proper punctuation and capitalization. Focus on clarity and accuracy.`;
      
      const result = await model.generateContent([
        {
          inlineData: {
            data: audioBase64,
            mimeType: 'audio/wav'
          }
        },
        prompt
      ]);
      
      const response = result.response;
      const transcription = response.text();
      
      console.log('[SubtitleGenerator] Raw Gemini response length:', transcription.length);
      
      return transcription;
    } catch (error) {
      console.error('[SubtitleGenerator] Gemini transcription error:', error);
      throw new Error('Failed to transcribe audio with Gemini');
    }
  }

  private async createSubtitleSegments(transcription: string, totalDuration: number): Promise<SubtitleSegment[]> {
    // Split transcription into sentences and estimate timing
    const sentences = transcription.split(/[.!?]+/).filter(s => s.trim().length > 0);
    const segments: SubtitleSegment[] = [];
    
    const averageSegmentDuration = totalDuration / sentences.length;
    
    for (let i = 0; i < sentences.length; i++) {
      const sentence = sentences[i].trim();
      if (!sentence) continue;
      
      const words = sentence.split(/\s+/).filter(w => w.length > 0);
      const segmentStart = i * averageSegmentDuration;
      const segmentEnd = Math.min((i + 1) * averageSegmentDuration, totalDuration);
      const segmentDuration = segmentEnd - segmentStart;
      
      // Create word-level timing within the segment
      const wordObjects: Word[] = [];
      const averageWordDuration = segmentDuration / words.length;
      
      for (let j = 0; j < words.length; j++) {
        const wordStart = segmentStart + (j * averageWordDuration);
        const wordEnd = Math.min(wordStart + averageWordDuration, segmentEnd);
        
        wordObjects.push({
          punctuated_word: words[j],
          start: wordStart,
          end: wordEnd
        });
      }
      
      segments.push({
        start: segmentStart,
        end: segmentEnd,
        text: sentence,
        words: wordObjects
      });
    }
    
    // Filter segments to fit within video duration
    const filteredSegments = segments.filter(seg => seg.start < totalDuration);
    console.log('[SubtitleGenerator] Parsed transcription with', filteredSegments.length, 'subtitle segments');
    
    return filteredSegments;
  }

  private async generateSRTFile(segments: SubtitleSegment[], videoPath: string): Promise<string> {
    const srtPath = videoPath.replace(path.extname(videoPath), '.srt');
    
    let srtContent = '';
    for (let i = 0; i < segments.length; i++) {
      const segment = segments[i];
      const startTime = this.secondsToSRTTime(segment.start);
      const endTime = this.secondsToSRTTime(segment.end);
      
      srtContent += `${i + 1}\n`;
      srtContent += `${startTime} --> ${endTime}\n`;
      srtContent += `${segment.text}\n\n`;
    }
    
    fs.writeFileSync(srtPath, srtContent, 'utf8');
    console.log('[SubtitleGenerator] SRT file created:', srtPath);
    
    return srtPath;
  }

  private secondsToSRTTime(seconds: number): string {
    const hours = Math.floor(seconds / 3600);
    const minutes = Math.floor((seconds % 3600) / 60);
    const secs = Math.floor(seconds % 60);
    const ms = Math.floor((seconds % 1) * 1000);
    
    return `${hours.toString().padStart(2, '0')}:${minutes.toString().padStart(2, '0')}:${secs.toString().padStart(2, '0')},${ms.toString().padStart(3, '0')}`;
  }
}