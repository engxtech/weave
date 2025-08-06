import { GoogleGenAI } from "@google/genai";
import { spawn } from 'child_process';
import * as fs from 'fs';
import * as path from 'path';

const ai = new GoogleGenAI({ apiKey: process.env.GEMINI_API_KEY || "" });

export interface TranscriptionSegment {
  id: string;
  startTime: number;
  endTime: number;
  duration: number;
  originalText: string;
  translatedText: string;
  sourceLanguage: string;
  targetLanguage: string;
  confidence: number;
  skipTranslation?: boolean;
  safeWord?: boolean;
}

export interface TranslationRequest {
  videoPath: string;
  targetLanguage: string;
  safeWords?: string[];
  preserveOriginalAudio?: boolean;
  voiceStyle?: 'natural' | 'professional' | 'casual';
}

export interface TranslationResult {
  success: boolean;
  segments: TranscriptionSegment[];
  sourceLanguage: string;
  targetLanguage: string;
  audioPath?: string;
  totalDuration: number;
  processedSegments: number;
  skippedSegments: number;
}

export class LanguageTranslationService {
  
  async processVideoTranslation(request: TranslationRequest): Promise<TranslationResult> {
    try {
      console.log('Starting video translation process...');
      
      // Step 1: Extract audio from video
      const audioPath = await this.extractAudio(request.videoPath);
      
      // Step 2: Transcribe audio with timestamps
      const transcriptionSegments = await this.transcribeAudioWithTimestamps(audioPath);
      
      // Step 3: Detect source language
      const sourceLanguage = await this.detectSourceLanguage(transcriptionSegments);
      
      // Step 4: Translate segments (skip safe words)
      const translatedSegments = await this.translateSegments(
        transcriptionSegments,
        sourceLanguage,
        request.targetLanguage,
        request.safeWords
      );
      
      // Step 5: Generate translated audio (optional)
      let translatedAudioPath: string | undefined;
      if (!request.preserveOriginalAudio) {
        translatedAudioPath = await this.generateTranslatedAudio(
          translatedSegments,
          request.targetLanguage,
          request.voiceStyle
        );
      }
      
      return {
        success: true,
        segments: translatedSegments,
        sourceLanguage: sourceLanguage,
        targetLanguage: request.targetLanguage,
        audioPath: translatedAudioPath,
        totalDuration: Math.max(...translatedSegments.map(s => s.endTime)),
        processedSegments: translatedSegments.filter(s => !s.skipTranslation).length,
        skippedSegments: translatedSegments.filter(s => s.skipTranslation).length
      };
      
    } catch (error) {
      console.error('Translation process failed:', error);
      throw new Error(`Translation failed: ${error}`);
    }
  }
  
  private async extractAudio(videoPath: string): Promise<string> {
    console.log('=== AUDIO EXTRACTION DEBUG ===');
    console.log('Input video path:', videoPath);
    console.log('Video path exists:', fs.existsSync(videoPath));
    
    // Check if path is absolute, if not make it relative to cwd
    let resolvedVideoPath = videoPath;
    if (!path.isAbsolute(videoPath)) {
      resolvedVideoPath = path.resolve(process.cwd(), videoPath);
    }
    
    console.log('Resolved video path:', resolvedVideoPath);
    console.log('Resolved path exists:', fs.existsSync(resolvedVideoPath));
    
    const audioPath = path.join(path.dirname(resolvedVideoPath), `audio_${Date.now()}.wav`);
    console.log('Output audio path:', audioPath);
    
    return new Promise((resolve, reject) => {
      const ffmpeg = spawn('ffmpeg', [
        '-i', resolvedVideoPath,
        '-vn', // No video
        '-acodec', 'pcm_s16le', // PCM audio codec
        '-ar', '16000', // 16kHz sample rate for speech recognition
        '-ac', '1', // Mono channel
        '-y', // Overwrite output file
        audioPath
      ]);
      
      ffmpeg.stderr.on('data', (data) => {
        console.log('FFmpeg stderr:', data.toString());
      });
      
      ffmpeg.on('close', (code) => {
        console.log('FFmpeg process closed with code:', code);
        if (code === 0) {
          console.log('Audio extraction successful, output file:', audioPath);
          resolve(audioPath);
        } else {
          reject(new Error(`Audio extraction failed with code ${code}`));
        }
      });
      
      ffmpeg.on('error', (error) => {
        console.error('FFmpeg spawn error:', error);
        reject(error);
      });
    });
  }
  
  private async transcribeAudioWithTimestamps(audioPath: string): Promise<TranscriptionSegment[]> {
    try {
      console.log('Transcribing audio with timestamps...');
      
      // Read audio file
      const audioBytes = fs.readFileSync(audioPath);
      
      // Use Gemini for audio transcription with timestamps
      const response = await ai.models.generateContent({
        model: "gemini-1.5-flash",
        contents: [
          {
            inlineData: {
              data: audioBytes.toString("base64"),
              mimeType: "audio/wav",
            },
          },
          `Transcribe this audio and provide timestamps in JSON format. 
          Break speech into natural segments (sentences or phrases) with start and end times.
          
          Return JSON format:
          {
            "segments": [
              {
                "startTime": 0.0,
                "endTime": 3.5,
                "text": "Hello, welcome to our presentation"
              }
            ]
          }
          
          Provide precise timestamps in seconds. Make segments 2-8 seconds long for natural speech patterns.`
        ],
      });
      
      const responseText = response.text || "";
      const transcriptionData = this.parseJsonResponse(responseText);
      
      // Convert to our format
      const segments: TranscriptionSegment[] = transcriptionData.segments.map((segment: any, index: number) => ({
        id: `segment_${index + 1}`,
        startTime: segment.startTime,
        endTime: segment.endTime,
        duration: segment.endTime - segment.startTime,
        originalText: segment.text,
        translatedText: segment.text, // Will be updated in translation step
        sourceLanguage: 'auto', // Will be detected
        targetLanguage: 'auto', // Will be set later
        confidence: 0.9 // Default confidence
      }));
      
      console.log(`Transcribed ${segments.length} segments`);
      return segments;
      
    } catch (error) {
      console.error('Transcription failed:', error);
      throw new Error(`Transcription failed: ${error}`);
    }
  }
  
  private async detectSourceLanguage(segments: TranscriptionSegment[]): Promise<string> {
    try {
      const sampleText = segments.slice(0, 3).map(s => s.originalText).join(' ');
      
      const response = await ai.models.generateContent({
        model: "gemini-1.5-flash",
        contents: `Detect the language of this text and return only the language code (e.g., 'en', 'es', 'fr', 'de', 'it', 'pt', 'ru', 'ja', 'ko', 'zh'):
        
        "${sampleText}"
        
        Return only the 2-letter language code, nothing else.`,
      });
      
      const languageCode = response.text?.trim().toLowerCase() || 'en';
      console.log(`Detected source language: ${languageCode}`);
      return languageCode;
      
    } catch (error) {
      console.error('Language detection failed:', error);
      return 'en'; // Default to English
    }
  }
  
  private async translateSegments(
    segments: TranscriptionSegment[],
    sourceLanguage: string,
    targetLanguage: string,
    safeWords: string[] = []
  ): Promise<TranscriptionSegment[]> {
    console.log(`Translating ${segments.length} segments from ${sourceLanguage} to ${targetLanguage}`);
    
    const translatedSegments: TranscriptionSegment[] = [];
    
    for (const segment of segments) {
      try {
        // Check if segment contains safe words
        const containsSafeWord = safeWords.some(safeWord => 
          segment.originalText.toLowerCase().includes(safeWord.toLowerCase())
        );
        
        if (containsSafeWord) {
          // Skip translation for segments with safe words
          translatedSegments.push({
            ...segment,
            translatedText: segment.originalText,
            sourceLanguage,
            targetLanguage,
            skipTranslation: true,
            safeWord: true
          });
          continue;
        }
        
        // Translate using Gemini
        const response = await ai.models.generateContent({
          model: "gemini-1.5-flash",
          contents: `Translate the following text from ${sourceLanguage} to ${targetLanguage}. 
          Maintain the original tone and context. Return only the translated text:
          
          "${segment.originalText}"`,
        });
        
        const translatedText = response.text?.trim() || segment.originalText;
        
        translatedSegments.push({
          ...segment,
          translatedText,
          sourceLanguage,
          targetLanguage,
          confidence: 0.95
        });
        
        // Small delay to avoid rate limiting
        await new Promise(resolve => setTimeout(resolve, 100));
        
      } catch (error) {
        console.error(`Translation failed for segment ${segment.id}:`, error);
        // Keep original text if translation fails
        translatedSegments.push({
          ...segment,
          translatedText: segment.originalText,
          sourceLanguage,
          targetLanguage,
          confidence: 0.1
        });
      }
    }
    
    console.log(`Translated ${translatedSegments.filter(s => !s.skipTranslation).length} segments`);
    return translatedSegments;
  }
  
  private async generateTranslatedAudio(
    segments: TranscriptionSegment[],
    targetLanguage: string,
    voiceStyle: string = 'natural'
  ): Promise<string> {
    try {
      console.log('Generating translated audio with TTS...');
      
      const outputPath = `temp_translated_audio_${Date.now()}.wav`;
      const audioFiles: string[] = [];
      
      // Generate audio for each segment
      for (const segment of segments) {
        if (segment.skipTranslation) {
          // For safe words, create silence for the duration
          const silenceFile = `silence_${segment.id}_${Date.now()}.wav`;
          await this.createSilenceAudio(silenceFile, segment.duration);
          audioFiles.push(silenceFile);
        } else {
          // Generate TTS for translated text
          const segmentAudioFile = await this.generateTTSForSegment(
            segment.translatedText,
            targetLanguage,
            voiceStyle,
            segment.duration
          );
          audioFiles.push(segmentAudioFile);
        }
      }
      
      // Concatenate all audio files
      if (audioFiles.length > 0) {
        await this.concatenateAudioFiles(audioFiles, outputPath);
        
        // Clean up temporary files
        audioFiles.forEach(file => {
          if (fs.existsSync(file)) {
            fs.unlinkSync(file);
          }
        });
      }
      
      return outputPath;
      
    } catch (error) {
      console.error('Audio generation failed:', error);
      throw new Error(`Audio generation failed: ${error}`);
    }
  }

  private async generateTTSForSegment(
    text: string,
    targetLanguage: string,
    voiceStyle: string,
    duration: number
  ): Promise<string> {
    const outputFile = `tts_segment_${Date.now()}.wav`;
    
    try {
      // Use Gemini AI to generate speech-like description and then convert to audio
      // Note: Gemini doesn't have direct TTS, so we'll use ffmpeg with espeak for now
      const languageCode = this.getEspeakLanguageCode(targetLanguage);
      
      return new Promise((resolve, reject) => {
        const espeak = spawn('espeak', [
          '-v', languageCode,
          '-s', '150', // Speed
          '-p', '50',  // Pitch
          '-a', '100', // Amplitude
          '-w', outputFile, // Write to WAV file
          text
        ]);
        
        espeak.on('close', (code) => {
          if (code === 0 && fs.existsSync(outputFile)) {
            // Adjust duration to match original segment timing
            this.adjustAudioDuration(outputFile, duration).then(() => {
              resolve(outputFile);
            }).catch(reject);
          } else {
            // Fallback: create silence if TTS fails
            console.log('TTS failed, creating silence for segment');
            this.createSilenceAudio(outputFile, duration).then(() => {
              resolve(outputFile);
            }).catch(reject);
          }
        });
        
        espeak.on('error', (error) => {
          console.log('Espeak error, falling back to silence:', error);
          // Fallback: create silence
          this.createSilenceAudio(outputFile, duration).then(() => {
            resolve(outputFile);
          }).catch(reject);
        });
      });
      
    } catch (error) {
      console.error('TTS generation failed for segment:', error);
      // Fallback: create silence
      await this.createSilenceAudio(outputFile, duration);
      return outputFile;
    }
  }

  private getEspeakLanguageCode(targetLanguage: string): string {
    const languageMap: { [key: string]: string } = {
      'hi': 'hi',     // Hindi
      'es': 'es',     // Spanish
      'fr': 'fr',     // French
      'de': 'de',     // German
      'zh': 'zh',     // Chinese
      'ja': 'ja',     // Japanese
      'ko': 'ko',     // Korean
      'pt': 'pt',     // Portuguese
      'it': 'it',     // Italian
      'en': 'en'      // English
    };
    
    return languageMap[targetLanguage] || 'en';
  }

  private async createSilenceAudio(outputFile: string, duration: number): Promise<void> {
    return new Promise((resolve, reject) => {
      const ffmpeg = spawn('ffmpeg', [
        '-f', 'lavfi',
        '-i', `anullsrc=channel_layout=mono:sample_rate=16000:duration=${duration}`,
        '-y',
        outputFile
      ]);
      
      ffmpeg.on('close', (code) => {
        if (code === 0) {
          resolve();
        } else {
          reject(new Error(`Silence generation failed with code ${code}`));
        }
      });
      
      ffmpeg.on('error', reject);
    });
  }

  private async adjustAudioDuration(audioFile: string, targetDuration: number): Promise<void> {
    const tempFile = `temp_${Date.now()}.wav`;
    
    return new Promise((resolve, reject) => {
      const ffmpeg = spawn('ffmpeg', [
        '-i', audioFile,
        '-filter:a', `atempo=1.0,apad=whole_dur=${targetDuration}`,
        '-y',
        tempFile
      ]);
      
      ffmpeg.on('close', (code) => {
        if (code === 0) {
          // Replace original with adjusted version
          fs.renameSync(tempFile, audioFile);
          resolve();
        } else {
          reject(new Error(`Duration adjustment failed with code ${code}`));
        }
      });
      
      ffmpeg.on('error', reject);
    });
  }

  private async concatenateAudioFiles(audioFiles: string[], outputFile: string): Promise<void> {
    if (audioFiles.length === 0) return;
    
    if (audioFiles.length === 1) {
      // If only one file, just copy it
      fs.copyFileSync(audioFiles[0], outputFile);
      return;
    }
    
    // Create concat filter input
    const filterInputs = audioFiles.map((_, index) => `[${index}:a]`).join('');
    const concatFilter = `${filterInputs}concat=n=${audioFiles.length}:v=0:a=1[out]`;
    
    return new Promise((resolve, reject) => {
      const args = [];
      
      // Add all input files
      audioFiles.forEach(file => {
        args.push('-i', file);
      });
      
      // Add filter and output
      args.push('-filter_complex', concatFilter);
      args.push('-map', '[out]');
      args.push('-y', outputFile);
      
      const ffmpeg = spawn('ffmpeg', args);
      
      ffmpeg.on('close', (code) => {
        if (code === 0) {
          resolve();
        } else {
          reject(new Error(`Audio concatenation failed with code ${code}`));
        }
      });
      
      ffmpeg.on('error', reject);
    });
  }
  
  private parseJsonResponse(responseText: string): any {
    try {
      // Try to extract JSON from the response
      const jsonMatch = responseText.match(/\{[\s\S]*\}/);
      if (jsonMatch) {
        return JSON.parse(jsonMatch[0]);
      }
      
      // Fallback: try to parse the entire response
      return JSON.parse(responseText);
    } catch (error) {
      console.error('Failed to parse JSON response:', responseText);
      throw new Error('Invalid JSON response from AI');
    }
  }
  
  // Helper method to get supported languages
  static getSupportedLanguages(): { code: string; name: string }[] {
    return [
      { code: 'en', name: 'English' },
      { code: 'es', name: 'Spanish' },
      { code: 'fr', name: 'French' },
      { code: 'de', name: 'German' },
      { code: 'it', name: 'Italian' },
      { code: 'pt', name: 'Portuguese' },
      { code: 'ru', name: 'Russian' },
      { code: 'ja', name: 'Japanese' },
      { code: 'ko', name: 'Korean' },
      { code: 'zh', name: 'Chinese' },
      { code: 'ar', name: 'Arabic' },
      { code: 'hi', name: 'Hindi' },
      { code: 'nl', name: 'Dutch' },
      { code: 'sv', name: 'Swedish' },
      { code: 'da', name: 'Danish' },
      { code: 'no', name: 'Norwegian' },
      { code: 'fi', name: 'Finnish' },
      { code: 'pl', name: 'Polish' },
      { code: 'tr', name: 'Turkish' },
      { code: 'th', name: 'Thai' },
      { code: 'vi', name: 'Vietnamese' }
    ];
  }
}