import { GoogleGenAI } from "@google/genai";
import * as fs from "fs";
import { spawn } from "child_process";
import { promisify } from "util";

const ai = new GoogleGenAI({ apiKey: process.env.GEMINI_API_KEY || "" });

export interface PreciseCaptionSegment {
  id: string;
  text: string;
  startTime: number;
  endTime: number;
  confidence: number;
  audioSync: boolean;
  visualContext?: string;
}

export interface MultimodalSyncResult {
  segments: PreciseCaptionSegment[];
  totalDuration: number;
  syncAccuracy: number;
  audioSpeedFactor: number;
}

export class MultimodalCaptionSync {
  private model = "gemini-2.0-flash-exp";

  async generatePreciseCaptions(videoPath: string): Promise<MultimodalSyncResult> {
    try {
      console.log('[MultimodalSync] Starting precise caption generation...');
      
      // Step 1: Extract audio with precise timing
      const audioPath = await this.extractHighQualityAudio(videoPath);
      
      // Step 2: Upload video directly to Gemini for multimodal analysis
      const videoDuration = await this.getVideoDuration(videoPath);
      
      // Step 3: Use Gemini's multimodal API for synchronized transcription
      const segments = await this.performMultimodalTranscription(videoPath, videoDuration);
      
      // Step 4: Audio waveform analysis for timing correction
      const audioSyncedSegments = await this.synchronizeWithAudio(segments, audioPath);
      
      // Step 5: Calculate sync accuracy
      const syncAccuracy = this.calculateSyncAccuracy(audioSyncedSegments);
      const audioSpeedFactor = await this.calculateAudioSpeed(audioPath, videoDuration);
      
      // Cleanup
      if (fs.existsSync(audioPath)) {
        fs.unlinkSync(audioPath);
      }
      
      return {
        segments: audioSyncedSegments,
        totalDuration: videoDuration,
        syncAccuracy,
        audioSpeedFactor
      };
      
    } catch (error) {
      console.error('[MultimodalSync] Error:', error);
      throw error;
    }
  }

  private async extractHighQualityAudio(videoPath: string): Promise<string> {
    const audioPath = videoPath.replace(/\.[^/.]+$/, '_sync.wav');
    
    return new Promise((resolve, reject) => {
      const ffmpeg = spawn('ffmpeg', [
        '-i', videoPath,
        '-vn', // No video
        '-acodec', 'pcm_s16le', // High quality PCM
        '-ar', '44100', // Sample rate
        '-ac', '1', // Mono
        '-y', // Overwrite
        audioPath
      ]);

      ffmpeg.on('close', (code) => {
        if (code === 0) {
          resolve(audioPath);
        } else {
          reject(new Error(`Audio extraction failed with code ${code}`));
        }
      });
    });
  }

  private async performMultimodalTranscription(videoPath: string, videoDuration: number): Promise<PreciseCaptionSegment[]> {
    try {
      // Upload video to Gemini
      const videoBuffer = fs.readFileSync(videoPath);
      const base64Video = videoBuffer.toString('base64');
      
      const prompt = `Analyze this video and provide precise transcription with exact timing. 

CRITICAL REQUIREMENTS:
1. Transcribe every spoken word with EXACT timing
2. Match spoken words to visual lip movements
3. Account for natural speech pace and pauses
4. Use audio-visual synchronization to determine timing
5. Break text into natural segments (3-8 words each)
6. Ensure each segment has precise start/end times
7. Video duration is ${videoDuration.toFixed(2)} seconds

Return JSON array with this exact format:
[
  {
    "text": "exact spoken words",
    "startTime": 0.0,
    "endTime": 1.2,
    "confidence": 0.95,
    "visualContext": "speaker visible/audio only/background noise"
  }
]

Focus on audio-visual synchronization for perfect timing accuracy.`;

      const response = await ai.models.generateContent({
        model: this.model,
        contents: [
          {
            inlineData: {
              data: base64Video,
              mimeType: "video/mp4"
            }
          },
          prompt
        ],
        config: {
          responseMimeType: "application/json"
        }
      });

      const result = response.text;
      if (!result) {
        throw new Error('Empty response from Gemini');
      }

      const segments = JSON.parse(result);
      
      return segments.map((segment: any, index: number) => ({
        id: `multimodal_${Date.now()}_${index}`,
        text: segment.text || '',
        startTime: Math.max(0, parseFloat(segment.startTime) || 0),
        endTime: Math.min(videoDuration, parseFloat(segment.endTime) || 0),
        confidence: parseFloat(segment.confidence) || 0.8,
        audioSync: true,
        visualContext: segment.visualContext || 'audio'
      }));

    } catch (error) {
      console.error('[MultimodalSync] Transcription error:', error);
      throw error;
    }
  }

  private async synchronizeWithAudio(segments: PreciseCaptionSegment[], audioPath: string): Promise<PreciseCaptionSegment[]> {
    try {
      // Extract speech timing from audio waveform
      const speechTimings = await this.extractSpeechTimings(audioPath);
      
      // Align segments with speech patterns
      return segments.map((segment, index) => {
        const speechTiming = speechTimings[index];
        if (speechTiming) {
          // Apply timing correction based on actual speech
          const timingOffset = speechTiming.startTime - segment.startTime;
          
          return {
            ...segment,
            startTime: Math.max(0, speechTiming.startTime),
            endTime: Math.max(speechTiming.startTime + 0.5, speechTiming.endTime),
            audioSync: true
          };
        }
        
        return segment;
      });
      
    } catch (error) {
      console.error('[MultimodalSync] Audio sync error:', error);
      return segments; // Return original if sync fails
    }
  }

  private async extractSpeechTimings(audioPath: string): Promise<Array<{startTime: number, endTime: number}>> {
    return new Promise((resolve) => {
      const timings: Array<{startTime: number, endTime: number}> = [];
      
      // Use FFmpeg to detect speech segments
      const ffmpeg = spawn('ffmpeg', [
        '-i', audioPath,
        '-af', 'silencedetect=noise=-30dB:duration=0.3',
        '-f', 'null',
        '-'
      ], { stdio: ['pipe', 'pipe', 'pipe'] });

      let output = '';
      ffmpeg.stderr.on('data', (data) => {
        output += data.toString();
      });

      ffmpeg.on('close', () => {
        const lines = output.split('\n');
        let currentStart = 0;
        
        for (const line of lines) {
          if (line.includes('silence_start:')) {
            const endTime = parseFloat(line.split('silence_start:')[1].trim());
            if (endTime > currentStart + 0.5) { // Minimum segment length
              timings.push({ startTime: currentStart, endTime });
            }
          } else if (line.includes('silence_end:')) {
            currentStart = parseFloat(line.split('silence_end:')[1].split('|')[0].trim());
          }
        }
        
        resolve(timings);
      });
    });
  }

  private calculateSyncAccuracy(segments: PreciseCaptionSegment[]): number {
    const syncedSegments = segments.filter(s => s.audioSync && s.confidence > 0.7);
    return syncedSegments.length / segments.length;
  }

  private async calculateAudioSpeed(audioPath: string, videoDuration: number): Promise<number> {
    // Calculate speech rate to determine if audio needs speed adjustment
    const speechSegments = await this.extractSpeechTimings(audioPath);
    const totalSpeechTime = speechSegments.reduce((acc, seg) => acc + (seg.endTime - seg.startTime), 0);
    const speechRatio = totalSpeechTime / videoDuration;
    
    return speechRatio; // 1.0 = normal speed, <1.0 = slow, >1.0 = fast
  }

  private async getVideoDuration(videoPath: string): Promise<number> {
    return new Promise((resolve, reject) => {
      const ffprobe = spawn('ffprobe', [
        '-v', 'quiet',
        '-show_entries', 'format=duration',
        '-of', 'csv=p=0',
        videoPath
      ]);

      let output = '';
      ffprobe.stdout.on('data', (data) => {
        output += data.toString();
      });

      ffprobe.on('close', (code) => {
        if (code === 0) {
          const duration = parseFloat(output.trim());
          resolve(duration);
        } else {
          reject(new Error('Failed to get video duration'));
        }
      });
    });
  }
}