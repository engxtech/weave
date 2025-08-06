import { GoogleGenerativeAI } from "@google/generative-ai";
import * as fs from "fs";
import * as path from "path";
import { spawn } from "child_process";
import { TokenTracker } from "./token-tracker";

export interface SpeakerInfo {
  id: number;
  label: string;
  segments: TranscriptionSegment[];
}

export interface TranscriptionSegment {
  speakerId: number;
  startTime: number;
  endTime: number;
  originalText: string;
  translatedText?: string;
  audioFile?: string;
}

export interface TranslationResult {
  originalLanguage: string;
  targetLanguage: string;
  speakers: SpeakerInfo[];
  originalTranscription: string;
  translatedTranscription: string;
  dubbedVideoPath?: string;
  processingStats: {
    totalSegments: number;
    totalDuration: number;
    processingTime: number;
  };
}

export interface SafewordReplacement {
  original: string;
  replacement: string;
}

export class VideoTranslator {
  private geminiAI: GoogleGenerativeAI;
  private uploadsDir: string;

  constructor() {
    const apiKey = process.env.GEMINI_API_KEY;
    if (!apiKey) {
      throw new Error('GEMINI_API_KEY environment variable is required');
    }
    
    this.geminiAI = new GoogleGenerativeAI(apiKey);
    this.uploadsDir = path.join(process.cwd(), 'uploads');
    
    if (!fs.existsSync(this.uploadsDir)) {
      fs.mkdirSync(this.uploadsDir, { recursive: true });
    }
  }

  async analyzeVideoForSpeakers(videoPath: string, userId: string): Promise<number> {
    console.log(`[VideoTranslator] Analyzing speakers in video: ${videoPath}`);
    
    try {
      const model = this.geminiAI.getGenerativeModel({ model: "gemini-1.5-flash" });
      
      // Read video file and create content for Gemini
      const videoData = fs.readFileSync(videoPath);
      const videoBase64 = videoData.toString('base64');

      const prompt = `Analyze this video and count the number of distinct speakers. 
      Look at both visual cues (people talking, mouth movements) and audio patterns.
      
      Respond with ONLY a JSON object in this format:
      {
        "speakerCount": number,
        "confidence": "high|medium|low",
        "analysis": "Brief explanation of how you determined the speaker count"
      }`;

      const response = await model.generateContent([
        { fileData: { mimeType: uploadedFile.mimeType, fileUri: uploadedFile.uri } },
        { text: prompt }
      ]);

      // Track token usage
      const usageMetadata = response.response.usageMetadata || {};
      const actualUsage = {
        inputTokens: usageMetadata.promptTokenCount || undefined,
        outputTokens: usageMetadata.candidatesTokenCount || undefined,
        totalTokens: usageMetadata.totalTokenCount || undefined
      };

      await TokenTracker.trackGeminiRequest(
        userId,
        'video_speaker_analysis',
        'gemini-1.5-flash',
        prompt,
        response.response.text() || '',
        actualUsage
      );

      const responseText = response.response.text();
      console.log(`[VideoTranslator] Speaker analysis response: ${responseText}`);
      
      const analysisResult = JSON.parse(responseText);
      return analysisResult.speakerCount || 1;
      
    } catch (error) {
      console.error('[VideoTranslator] Error analyzing speakers:', error);
      return 1; // Default to 1 speaker if analysis fails
    }
  }

  async transcribeAndTranslate(
    videoPath: string, 
    targetLanguage: string,
    confirmedSpeakerCount: number,
    safewords: SafewordReplacement[] = [],
    userId: string
  ): Promise<TranslationResult> {
    console.log(`[VideoTranslator] Starting transcription and translation to ${targetLanguage}`);
    
    const startTime = Date.now();
    
    try {
      const model = this.geminiAI.getGenerativeModel({ model: "gemini-1.5-flash" });
      
      // Upload video file to Gemini
      const uploadedFile = await this.geminiAI.uploadFile(videoPath, {
        mimeType: this.getMimeType(videoPath),
        displayName: path.basename(videoPath)
      });

      const safewordInstructions = safewords.length > 0 
        ? `\n\nApply these safeword replacements to the transcription: ${safewords.map(s => `"${s.original}" -> "${s.replacement}"`).join(', ')}`
        : '';

      const prompt = `Analyze this video and provide a complete transcription and translation.

IMPORTANT: Based on the user confirmation, there are ${confirmedSpeakerCount} speaker(s) in this video.

Instructions:
1. Transcribe all spoken content with precise timestamps
2. If there are multiple speakers (${confirmedSpeakerCount} > 1), use speaker labels (Speaker 1, Speaker 2, etc.)
3. Apply safeword replacements if provided${safewordInstructions}
4. Translate the anonymized text to ${targetLanguage}
5. Maintain timing and speaker information in translation

Respond with ONLY a JSON object in this exact format:
{
  "originalLanguage": "detected language",
  "targetLanguage": "${targetLanguage}",
  "originalTranscription": "full original transcription with speaker labels if multiple speakers",
  "anonymizedTranscription": "transcription after safeword replacements",
  "translatedTranscription": "final translation in ${targetLanguage}",
  "segments": [
    {
      "speakerId": 1,
      "startTime": 0.0,
      "endTime": 5.2,
      "originalText": "original text",
      "anonymizedText": "text after safewords",
      "translatedText": "translated text"
    }
  ]
}`;

      const response = await model.generateContent([
        { fileData: { mimeType: uploadedFile.mimeType, fileUri: uploadedFile.uri } },
        { text: prompt }
      ]);

      // Track token usage
      const usageMetadata = response.response.usageMetadata || {};
      const actualUsage = {
        inputTokens: usageMetadata.promptTokenCount || undefined,
        outputTokens: usageMetadata.candidatesTokenCount || undefined,
        totalTokens: usageMetadata.totalTokenCount || undefined
      };

      await TokenTracker.trackGeminiRequest(
        userId,
        'video_transcription_translation',
        'gemini-1.5-flash',
        prompt,
        response.response.text() || '',
        actualUsage
      );

      const responseText = response.response.text();
      console.log(`[VideoTranslator] Transcription response: ${responseText}`);
      
      const transcriptionData = JSON.parse(responseText);
      
      // Process segments into speaker groups
      const speakers: SpeakerInfo[] = [];
      const speakerMap = new Map<number, SpeakerInfo>();
      
      transcriptionData.segments.forEach((segment: any) => {
        const speakerId = segment.speakerId || 1;
        
        if (!speakerMap.has(speakerId)) {
          const speakerInfo: SpeakerInfo = {
            id: speakerId,
            label: `Speaker ${speakerId}`,
            segments: []
          };
          speakerMap.set(speakerId, speakerInfo);
          speakers.push(speakerInfo);
        }
        
        const processedSegment: TranscriptionSegment = {
          speakerId,
          startTime: segment.startTime,
          endTime: segment.endTime,
          originalText: segment.originalText,
          translatedText: segment.translatedText
        };
        
        speakerMap.get(speakerId)!.segments.push(processedSegment);
      });

      const processingTime = Date.now() - startTime;
      
      return {
        originalLanguage: transcriptionData.originalLanguage,
        targetLanguage: transcriptionData.targetLanguage,
        speakers,
        originalTranscription: transcriptionData.originalTranscription,
        translatedTranscription: transcriptionData.translatedTranscription,
        processingStats: {
          totalSegments: transcriptionData.segments.length,
          totalDuration: this.calculateTotalDuration(transcriptionData.segments),
          processingTime
        }
      };
      
    } catch (error) {
      console.error('[VideoTranslator] Error in transcription/translation:', error);
      throw new Error(`Translation failed: ${error instanceof Error ? error.message : 'Unknown error'}`);
    }
  }

  async generateDubbedVideo(
    originalVideoPath: string,
    translationResult: TranslationResult,
    userId: string
  ): Promise<string> {
    console.log(`[VideoTranslator] Generating dubbed video`);
    
    try {
      // Generate audio for each segment using Gemini (text-to-speech would be ideal here)
      // For now, we'll create a version with translated subtitles burned into the video
      
      const outputPath = path.join(
        this.uploadsDir, 
        `dubbed_${Date.now()}_${path.basename(originalVideoPath)}`
      );
      
      // Create subtitle file from translated segments
      const subtitlePath = await this.createSubtitleFile(translationResult);
      
      // Use FFmpeg to burn subtitles into video
      await this.burnSubtitlesIntoVideo(originalVideoPath, subtitlePath, outputPath);
      
      // Clean up temporary subtitle file
      try {
        fs.unlinkSync(subtitlePath);
      } catch (e) {
        console.warn('Failed to clean up subtitle file:', e);
      }
      
      return outputPath;
      
    } catch (error) {
      console.error('[VideoTranslator] Error generating dubbed video:', error);
      throw new Error(`Dubbing failed: ${error instanceof Error ? error.message : 'Unknown error'}`);
    }
  }

  private async createSubtitleFile(translationResult: TranslationResult): Promise<string> {
    const subtitlePath = path.join(this.uploadsDir, `subtitles_${Date.now()}.srt`);
    
    let srtContent = '';
    let subtitleIndex = 1;
    
    // Flatten all segments from all speakers and sort by start time
    const allSegments = translationResult.speakers.flatMap(speaker => speaker.segments);
    allSegments.sort((a, b) => a.startTime - b.startTime);
    
    for (const segment of allSegments) {
      const startTime = this.formatSRTTime(segment.startTime);
      const endTime = this.formatSRTTime(segment.endTime);
      
      srtContent += `${subtitleIndex}\n`;
      srtContent += `${startTime} --> ${endTime}\n`;
      srtContent += `${segment.translatedText}\n\n`;
      
      subtitleIndex++;
    }
    
    fs.writeFileSync(subtitlePath, srtContent, 'utf8');
    return subtitlePath;
  }

  private formatSRTTime(seconds: number): string {
    const hours = Math.floor(seconds / 3600);
    const minutes = Math.floor((seconds % 3600) / 60);
    const secs = Math.floor(seconds % 60);
    const milliseconds = Math.floor((seconds % 1) * 1000);
    
    return `${hours.toString().padStart(2, '0')}:${minutes.toString().padStart(2, '0')}:${secs.toString().padStart(2, '0')},${milliseconds.toString().padStart(3, '0')}`;
  }

  private async burnSubtitlesIntoVideo(videoPath: string, subtitlePath: string, outputPath: string): Promise<void> {
    return new Promise((resolve, reject) => {
      const ffmpegArgs = [
        '-i', videoPath,
        '-vf', `subtitles=${subtitlePath}:force_style='Fontsize=24,PrimaryColour=&Hffffff,BackColour=&H80000000,Bold=1'`,
        '-c:a', 'copy',
        '-y',
        outputPath
      ];

      console.log(`[VideoTranslator] Running FFmpeg: ffmpeg ${ffmpegArgs.join(' ')}`);
      
      const ffmpeg = spawn('ffmpeg', ffmpegArgs);
      
      ffmpeg.stderr.on('data', (data) => {
        console.log(`[FFmpeg] ${data}`);
      });
      
      ffmpeg.on('close', (code) => {
        if (code === 0) {
          console.log(`[VideoTranslator] Successfully created dubbed video: ${outputPath}`);
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

  private getMimeType(filePath: string): string {
    const ext = path.extname(filePath).toLowerCase();
    switch (ext) {
      case '.mp4': return 'video/mp4';
      case '.avi': return 'video/x-msvideo';
      case '.mov': return 'video/quicktime';
      case '.mkv': return 'video/x-matroska';
      case '.webm': return 'video/webm';
      default: return 'video/mp4';
    }
  }

  private calculateTotalDuration(segments: any[]): number {
    if (segments.length === 0) return 0;
    return Math.max(...segments.map(s => s.endTime));
  }
}

export const videoTranslator = new VideoTranslator();