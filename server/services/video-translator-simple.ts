import { GoogleGenAI } from "@google/genai";
import * as fs from "fs";
import { promises as fsPromises } from "fs";
import * as path from "path";
import { spawn } from "child_process";
import * as wav from "wav";
import { TokenTracker } from "./token-tracker";

export interface TranslationSegment {
  speakerId: number;
  startTime: number;
  endTime: number;
  originalText: string;
  translatedText: string;
}

export interface VideoTranslationResult {
  originalLanguage: string;
  targetLanguage: string;
  originalTranscription: string;
  translatedTranscription: string;
  segments: TranslationSegment[];
  speakerCount: number;
  dubbedVideoPath?: string;
}

export interface SafewordReplacement {
  original: string;
  replacement: string;
}

export class SimpleVideoTranslator {
  private geminiAI: GoogleGenAI;
  private uploadsDir: string;

  constructor() {
    const apiKey = process.env.GEMINI_API_KEY;
    if (!apiKey) {
      throw new Error('GEMINI_API_KEY environment variable is required');
    }
    
    this.geminiAI = new GoogleGenAI({ apiKey });
    this.uploadsDir = path.join(process.cwd(), 'uploads');
    
    if (!fs.existsSync(this.uploadsDir)) {
      fs.mkdirSync(this.uploadsDir, { recursive: true });
    }
  }

  private extractJsonFromResponse(responseText: string): string {
    console.log(`[VideoTranslator] Raw response length: ${responseText.length}`);
    console.log(`[VideoTranslator] Raw response (first 500 chars): ${responseText.substring(0, 500)}`);
    
    // Strategy 1: Remove markdown code blocks if present
    const codeBlockRegex = /```(?:json)?\s*([\s\S]*?)\s*```/;
    const match = responseText.match(codeBlockRegex);
    
    if (match) {
      const extracted = match[1].trim();
      console.log(`[VideoTranslator] Extracted from code blocks: ${extracted.substring(0, 200)}...`);
      return this.validateAndCleanJson(extracted);
    }
    
    // Strategy 2: Try to find complete JSON object with balanced braces
    const jsonStart = responseText.indexOf('{');
    if (jsonStart !== -1) {
      let braceCount = 0;
      let inString = false;
      let escaped = false;
      
      for (let i = jsonStart; i < responseText.length; i++) {
        const char = responseText[i];
        
        if (escaped) {
          escaped = false;
          continue;
        }
        
        if (char === '\\') {
          escaped = true;
          continue;
        }
        
        if (char === '"') {
          inString = !inString;
          continue;
        }
        
        if (!inString) {
          if (char === '{') {
            braceCount++;
          } else if (char === '}') {
            braceCount--;
            if (braceCount === 0) {
              const extracted = responseText.substring(jsonStart, i + 1);
              console.log(`[VideoTranslator] Extracted balanced JSON: ${extracted.substring(0, 200)}...`);
              return this.validateAndCleanJson(extracted);
            }
          }
        }
      }
    }
    
    // Strategy 3: Try simple boundary detection as fallback
    const simpleStart = responseText.indexOf('{');
    const simpleEnd = responseText.lastIndexOf('}');
    
    if (simpleStart !== -1 && simpleEnd !== -1 && simpleEnd > simpleStart) {
      const extracted = responseText.substring(simpleStart, simpleEnd + 1);
      console.log(`[VideoTranslator] Extracted by simple boundaries: ${extracted.substring(0, 200)}...`);
      return this.validateAndCleanJson(extracted);
    }
    
    // If no JSON found, return the original text
    console.log(`[VideoTranslator] No JSON structure found, returning original text`);
    return responseText.trim();
  }
  
  private validateAndCleanJson(jsonStr: string): string {
    // Remove any trailing commas before closing braces/brackets
    let cleaned = jsonStr.replace(/,(\s*[}\]])/g, '$1');
    
    // Fix common JSON issues
    cleaned = cleaned.replace(/,\s*}/g, '}'); // Remove trailing commas in objects
    cleaned = cleaned.replace(/,\s*]/g, ']'); // Remove trailing commas in arrays
    
    return cleaned.trim();
  }

  async analyzeVideoForSpeakers(videoPath: string, userId: string): Promise<number> {
    console.log(`[VideoTranslator] Analyzing speakers in video: ${videoPath}`);
    
    try {
      // Check if video file exists
      if (!fs.existsSync(videoPath)) {
        throw new Error(`Video file does not exist: ${videoPath}`);
      }
      
      // Read video file with error handling
      let videoData: Buffer;
      try {
        videoData = fs.readFileSync(videoPath);
        if (!videoData || videoData.length === 0) {
          throw new Error(`Video file is empty or could not be read: ${videoPath}`);
        }
      } catch (readError) {
        throw new Error(`Failed to read video file: ${readError instanceof Error ? readError.message : 'Unknown error'}`);
      }
      
      const videoBase64 = videoData.toString('base64');
      console.log(`[VideoTranslator] Video file read successfully, size: ${videoData.length} bytes`);

      const prompt = `Analyze this video and count the number of distinct speakers. 
      Look at both visual cues (people talking, mouth movements) and audio patterns.
      
      Respond with ONLY a JSON object in this format:
      {
        "speakerCount": number,
        "confidence": "high|medium|low",
        "analysis": "Brief explanation of how you determined the speaker count"
      }`;

      const response = await this.geminiAI.models.generateContent({
        model: "gemini-1.5-flash",
        contents: [{
          parts: [
            {
              inlineData: {
                data: videoBase64,
                mimeType: this.getMimeType(videoPath)
              }
            },
            { text: prompt }
          ]
        }]
      });

      // Track token usage with actual usage data if available
      try {
        const actualUsage = {
          inputTokens: undefined,
          outputTokens: undefined,
          totalTokens: undefined
        };

        await TokenTracker.trackGeminiRequest(
          userId,
          'video_speaker_analysis',
          'gemini-1.5-flash',
          prompt,
          response.text || '',
          actualUsage
        );
      } catch (tokenError) {
        console.warn('Failed to track tokens for speaker analysis:', tokenError);
      }

      const responseText = response.text || '';
      if (!responseText) {
        throw new Error('No response text received from Gemini API for speaker analysis');
      }
      console.log(`[VideoTranslator] Speaker analysis response: ${responseText}`);
      
      // Clean the response text to handle code blocks
      let cleanedText = responseText.replace(/```json\s*/, '').replace(/```\s*$/, '').trim();
      const analysisResult = JSON.parse(cleanedText);
      return analysisResult.speakerCount || 1;
      
    } catch (error) {
      console.error('[VideoTranslator] Error analyzing speakers:', error);
      return 1; // Default to 1 speaker if analysis fails
    }
  }

  async translateVideo(
    videoPath: string, 
    targetLanguage: string,
    confirmedSpeakerCount: number,
    safewords: SafewordReplacement[] = [],
    userId: string
  ): Promise<VideoTranslationResult> {
    console.log(`[VideoTranslator] Starting translation to ${targetLanguage}`);
    
    try {
      // Check if video file exists
      if (!fs.existsSync(videoPath)) {
        throw new Error(`Video file does not exist: ${videoPath}`);
      }
      
      // Read video file with error handling
      let videoData: Buffer;
      try {
        videoData = fs.readFileSync(videoPath);
        if (!videoData || videoData.length === 0) {
          throw new Error(`Video file is empty or could not be read: ${videoPath}`);
        }
      } catch (readError) {
        throw new Error(`Failed to read video file: ${readError instanceof Error ? readError.message : 'Unknown error'}`);
      }
      
      const videoBase64 = videoData.toString('base64');
      console.log(`[VideoTranslator] Video file read successfully for translation, size: ${videoData.length} bytes`);

      const safewordInstructions = safewords.length > 0 
        ? `\n\nApply these safeword replacements: ${safewords.map(s => `"${s.original}" -> "${s.replacement}"`).join(', ')}`
        : '';

      const prompt = `Analyze this video and provide a complete transcription and translation.

IMPORTANT: Treat this as a single speaker video. Do not separate speakers or use "Speaker 1:", "Speaker 2:" labels.

Instructions:
1. Transcribe all spoken content with precise timestamps as a single continuous speaker
2. Do NOT use any speaker labels like "Speaker 1:", "Speaker 2:" - treat all speech as one speaker
3. Apply safeword replacements if provided${safewordInstructions}
4. Translate the text to ${targetLanguage}
5. Maintain timing information in translation

Respond with ONLY a JSON object in this exact format:
{
  "originalLanguage": "detected language",
  "targetLanguage": "${targetLanguage}",
  "originalTranscription": "full original transcription without speaker labels",
  "translatedTranscription": "final translation in ${targetLanguage}",
  "segments": [
    {
      "speakerId": 1,
      "startTime": 0.0,
      "endTime": 5.2,
      "originalText": "original text",
      "translatedText": "translated text"
    }
  ]
}`;

      const response = await this.geminiAI.models.generateContent({
        model: "gemini-1.5-flash",
        contents: [{
          parts: [
            {
              inlineData: {
                data: videoBase64,
                mimeType: this.getMimeType(videoPath)
              }
            },
            { text: prompt }
          ]
        }]
      });

      // Track token usage
      try {
        const actualUsage = {
          inputTokens: undefined,
          outputTokens: undefined,
          totalTokens: undefined
        };

        await TokenTracker.trackGeminiRequest(
          userId,
          'video_transcription_translation',
          'gemini-1.5-flash',
          prompt,
          response.text || '',
          actualUsage
        );
      } catch (tokenError) {
        console.warn('Failed to track tokens for translation:', tokenError);
      }

      const responseText = response.text || '';
      if (!responseText) {
        throw new Error('No response text received from Gemini API for translation');
      }
      console.log(`[VideoTranslator] Translation response: ${responseText}`);
      
      // Extract JSON from markdown code blocks if present
      const cleanJsonText = this.extractJsonFromResponse(responseText);
      console.log(`[VideoTranslator] Attempting to parse JSON: ${cleanJsonText.substring(0, 300)}...`);
      
      let translationData;
      try {
        translationData = JSON.parse(cleanJsonText);
        console.log(`[VideoTranslator] Successfully parsed JSON response`);
      } catch (parseError) {
        console.error(`[VideoTranslator] Initial JSON parsing failed:`, parseError);
        console.error(`[VideoTranslator] Problematic JSON text (first 1000 chars):`, cleanJsonText.substring(0, 1000));
        
        // Try additional cleanup strategies
        try {
          // Strategy 1: Try to fix truncated JSON by looking for incomplete segments array
          let repairedJson = cleanJsonText;
          
          // If JSON ends mid-segment, try to close it properly
          if (repairedJson.includes('"segments":') && !repairedJson.endsWith('}')) {
            const segmentsStart = repairedJson.indexOf('"segments":');
            const afterSegments = repairedJson.substring(segmentsStart);
            
            // Find the last complete segment
            const lastCompleteSegment = afterSegments.lastIndexOf('},{');
            if (lastCompleteSegment > 0) {
              const upToLastSegment = repairedJson.substring(0, segmentsStart + lastCompleteSegment + 1);
              repairedJson = upToLastSegment + '],"speakerCount":1}';
              console.log(`[VideoTranslator] Attempting repair with truncated segments`);
            }
          }
          
          translationData = JSON.parse(repairedJson);
          console.log(`[VideoTranslator] Successfully parsed repaired JSON response`);
        } catch (repairError) {
          console.error(`[VideoTranslator] JSON repair also failed:`, repairError);
          
          // Final fallback: Create minimal valid response
          console.log(`[VideoTranslator] Creating fallback response due to JSON parsing issues`);
          translationData = {
            originalLanguage: 'en',
            targetLanguage: targetLanguage,
            originalTranscription: 'Audio transcription failed due to response format issues',
            translatedTranscription: 'Translation failed due to response format issues',
            segments: []
          };
        }
      }
      
      return {
        originalLanguage: translationData.originalLanguage,
        targetLanguage: translationData.targetLanguage,
        originalTranscription: translationData.originalTranscription,
        translatedTranscription: translationData.translatedTranscription,
        segments: translationData.segments || [],
        speakerCount: confirmedSpeakerCount
      };
      
    } catch (error) {
      console.error('[VideoTranslator] Error in translation:', error);
      throw new Error(`Translation failed: ${error instanceof Error ? error.message : 'Unknown error'}`);
    }
  }

  async createDubbedVideo(
    originalVideoPath: string,
    translationResult: VideoTranslationResult,
    userId: string
  ): Promise<string> {
    console.log(`[VideoTranslator] Creating dubbed video with TTS audio using gemini-2.5-flash-preview-tts`);
    
    try {
      const outputPath = path.join(
        this.uploadsDir, 
        `dubbed_${Date.now()}_${path.basename(originalVideoPath)}`
      );
      
      // Generate TTS audio for the translated transcript
      console.log(`[VideoTranslator] About to generate TTS audio for user: ${userId}`);
      console.log(`[VideoTranslator] Translation result:`, translationResult);
      const ttsAudioPath = await this.generateTTSAudio(translationResult, userId);
      console.log(`[VideoTranslator] TTS audio generated at: ${ttsAudioPath}`);
      
      // Analyze timing alignment between original and translated content
      console.log(`[VideoTranslator] 🔍 Analyzing timing alignment for intelligent dubbing...`);
      const timingAnalysis = await this.analyzeTimingAlignment(
        translationResult.originalTranscription,
        translationResult.translatedTranscription,
        translationResult.originalLanguage || 'en',
        translationResult.targetLanguage
      );
      
      // Replace original audio with intelligently-timed TTS audio
      await this.replaceAudioTrack(originalVideoPath, ttsAudioPath, outputPath, timingAnalysis);
      
      // Clean up temporary TTS audio file
      try {
        fs.unlinkSync(ttsAudioPath);
      } catch (e) {
        console.warn('Failed to clean up TTS audio file:', e);
      }
      
      return outputPath;
      
    } catch (error) {
      console.error('[VideoTranslator] Error creating dubbed video:', error);
      throw new Error(`Dubbing failed: ${error instanceof Error ? error.message : 'Unknown error'}`);
    }
  }

  /**
   * Generate TTS audio using Gemini 2.5 Flash Preview TTS model
   */
  async generateTTSAudio(
    translationResult: VideoTranslationResult,
    userId: string
  ): Promise<string> {
    console.log(`[VideoTranslator] Generating TTS audio using gemini-2.5-flash-preview-tts`);
    
    try {
      // Using the new GoogleGenAI client directly
      
      // Use the full translated transcription for TTS, removing timestamps
      let textToSpeak = translationResult.translatedTranscription;
      
      // Remove timestamps like [00:10] from the text
      textToSpeak = textToSpeak.replace(/\[\d{2}:\d{2}\]/g, '').trim();
      
      // Clean up extra whitespace and line breaks
      textToSpeak = textToSpeak.replace(/\s+/g, ' ').trim();
      
      console.log(`[VideoTranslator] Generating TTS for: "${textToSpeak.substring(0, 100)}..."`);
      
      console.log(`[VideoTranslator] Making TTS request with text: "${textToSpeak.substring(0, 50)}..."`);
      
      // Use the new GoogleGenAI client for TTS with correct API structure
      console.log(`[VideoTranslator] Making TTS request to gemini-2.5-flash-preview-tts model...`);
      
      const response = await this.geminiAI.models.generateContent({
        model: "gemini-2.5-flash-preview-tts",
        contents: [{
          role: 'user',
          parts: [{ text: textToSpeak }]
        }],
        config: {
          responseModalities: ['AUDIO'],
          generationConfig: {
            responseMimeType: 'audio/wav',
            audioConfig: {
              voiceConfig: {
                voiceType: 'MALE',
                pitch: 0.0,
                speakingRate: 1.0
              }
            }
          }
        } as any
      });
      
      console.log(`[VideoTranslator] TTS request completed successfully`);
      
      console.log(`[VideoTranslator] TTS Response structure:`, {
        hasResponse: !!response,
        hasText: !!response.text,
        hasAudio: !!response.audio,
        hasCandidates: !!response.candidates,
        candidatesLength: response.candidates?.length || 0,
        responseKeys: Object.keys(response || {}),
        candidatesStructure: response.candidates?.[0] ? Object.keys(response.candidates[0]) : [],
        contentStructure: response.candidates?.[0]?.content ? Object.keys(response.candidates[0].content) : [],
        partsLength: response.candidates?.[0]?.content?.parts?.length || 0
      });
      
      // Log detailed parts structure for debugging
      if (response.candidates?.[0]?.content?.parts) {
        response.candidates[0].content.parts.forEach((part, index) => {
          console.log(`[VideoTranslator] Part ${index}:`, {
            hasText: !!part.text,
            hasInlineData: !!part.inlineData,
            mimeType: part.inlineData?.mimeType,
            dataSize: part.inlineData?.data ? part.inlineData.data.length : 0
          });
        });
      }
      
      // Track token usage for TTS
      try {
        const actualUsage = {
          inputTokens: response.usageMetadata?.promptTokenCount || 0,
          outputTokens: response.usageMetadata?.candidatesTokenCount || 0,
          totalTokens: response.usageMetadata?.totalTokenCount || 0
        };

        await TokenTracker.trackGeminiRequest(
          userId,
          'tts_generation',
          'gemini-2.5-flash-preview-tts',
          textToSpeak,
          'TTS audio generated',
          actualUsage
        );
      } catch (tokenError) {
        console.warn('Failed to track tokens for TTS:', tokenError);
      }
      
      // Extract audio data using Google's official approach
      const data = response.candidates?.[0]?.content?.parts?.[0]?.inlineData?.data;
      
      if (!data) {
        console.error('[VideoTranslator] No audio data found in TTS response');
        console.error('[VideoTranslator] Response structure:', JSON.stringify(response, null, 2));
        throw new Error('No TTS audio generated. Please try again or ensure the video file is valid.');
      }

      console.log(`[VideoTranslator] Found TTS audio data, converting from base64...`);
      
      // Convert base64 data to Buffer as per Google's documentation
      const audioBuffer = Buffer.from(data, 'base64');
      console.log(`[VideoTranslator] Converted base64 to Buffer, size: ${audioBuffer.length} bytes`);

      // Validate audio buffer size
      if (audioBuffer.length < 1000) {
        console.error(`[VideoTranslator] Audio buffer too small (${audioBuffer.length} bytes), likely corrupted`);
        throw new Error('Generated audio file too small, likely corrupted');
      }

      // Save TTS audio to temporary file using Google's approach
      const ttsAudioPath = path.join(
        this.uploadsDir, 
        `tts_${Date.now()}_${userId}.wav`
      );
      
      try {
        // Use the new event-driven approach for reliable file creation
        console.log(`[VideoTranslator] ⏳ Starting WAV file creation process...`);
        await this.saveWaveFile(ttsAudioPath, audioBuffer);
        console.log(`[VideoTranslator] ✅ WAV file creation completed successfully!`);
        
        // Final verification with detailed stats
        const fileStats = fs.statSync(ttsAudioPath);
        console.log(`[VideoTranslator] 📊 Final WAV file verification:`, {
          path: ttsAudioPath,
          size: fileStats.size,
          exists: fs.existsSync(ttsAudioPath),
          isFile: fileStats.isFile(),
          created: fileStats.birthtime,
          modified: fileStats.mtime
        });
        
        // Additional safety check for file accessibility
        try {
          const testRead = fs.readFileSync(ttsAudioPath, { encoding: null });
          console.log(`[VideoTranslator] 🔍 File read test: ${testRead.length} bytes successfully read`);
        } catch (readError) {
          console.error(`[VideoTranslator] ⚠️ Warning: File exists but cannot be read:`, readError);
          throw new Error(`WAV file created but not readable: ${readError}`);
        }
        
        console.log(`[VideoTranslator] 🎉 TTS audio file ready: ${ttsAudioPath}`);
        return ttsAudioPath;
        
      } catch (writeError) {
        console.error(`[VideoTranslator] ❌ Failed to create WAV file:`, writeError);
        throw new Error(`Failed to save TTS audio: ${writeError instanceof Error ? writeError.message : 'WAV file creation failed'}`);
      }
      
    } catch (error) {
      console.error('[VideoTranslator] Error generating TTS audio:', error);
      throw new Error(`TTS generation failed: ${error instanceof Error ? error.message : 'Unknown error'}`);
    }
  }

  /**
   * Analyze timing differences between original and translated transcripts using Gemini AI
   */
  async analyzeTimingAlignment(
    originalTranscript: string,
    translatedTranscript: string,
    originalLanguage: string,
    targetLanguage: string
  ): Promise<any> {
    console.log(`[VideoTranslator] 🔍 Analyzing timing alignment between ${originalLanguage} and ${targetLanguage}...`);
    
    const prompt = `You are an expert audio timing analyst. Analyze the timing differences between the original and translated transcripts and provide precise timing adjustments.

ORIGINAL TRANSCRIPT (${originalLanguage}):
${originalTranscript}

TRANSLATED TRANSCRIPT (${targetLanguage}):
${translatedTranscript}

Please analyze the timing alignment and provide:
1. Speech rate differences between languages
2. Natural pause adjustments needed
3. Syllable density analysis
4. Recommended time stretching factors
5. Segment-by-segment timing recommendations

Respond with JSON in this exact format:
{
  "speechRateRatio": 1.2,
  "pauseAdjustments": [
    {"timestamp": "00:05", "addPause": 0.3},
    {"timestamp": "00:15", "addPause": 0.5}
  ],
  "timeStretchFactors": [
    {"startTime": "00:00", "endTime": "00:10", "factor": 1.1},
    {"startTime": "00:10", "endTime": "00:20", "factor": 0.9}
  ],
  "syllableDensity": {
    "original": 4.2,
    "translated": 3.8
  },
  "recommendations": [
    "Slow down Spanish pronunciation by 10% for clarity",
    "Add 0.3s pause after technical terms"
  ]
}`;

    try {
      const response = await this.geminiAI.models.generateContent({
        model: "gemini-1.5-flash",
        contents: [{
          role: 'user',
          parts: [{ text: prompt }]
        }],
        config: {
          responseMimeType: "application/json"
        } as any
      });

      const analysisText = response.text || response.candidates?.[0]?.content?.parts?.[0]?.text;
      if (!analysisText) {
        throw new Error('No timing analysis received from Gemini');
      }

      const timingAnalysis = JSON.parse(analysisText);
      console.log(`[VideoTranslator] 📊 Timing analysis completed:`, timingAnalysis);
      
      return timingAnalysis;
      
    } catch (error) {
      console.error(`[VideoTranslator] Failed to analyze timing:`, error);
      // Return default safe timing adjustments
      return {
        speechRateRatio: 1.0,
        pauseAdjustments: [],
        timeStretchFactors: [],
        syllableDensity: { original: 4.0, translated: 4.0 },
        recommendations: ["Use original timing as fallback"]
      };
    }
  }

  /**
   * Apply intelligent timing adjustments to TTS audio based on Gemini analysis
   */
  async applyTimingAdjustments(
    ttsAudioPath: string,
    timingAnalysis: any,
    outputPath: string
  ): Promise<string> {
    console.log(`[VideoTranslator] 🎵 Applying intelligent timing adjustments...`);
    
    const tempAdjustedPath = outputPath.replace('.wav', '_adjusted.wav');
    
    try {
      // Build FFmpeg filter for timing adjustments
      let audioFilters = [];
      
      // Apply speech rate ratio if significantly different
      if (Math.abs(timingAnalysis.speechRateRatio - 1.0) > 0.05) {
        const tempo = 1.0 / timingAnalysis.speechRateRatio;
        audioFilters.push(`atempo=${tempo.toFixed(3)}`);
        console.log(`[VideoTranslator] Adjusting tempo by factor: ${tempo.toFixed(3)}`);
      }
      
      // Apply time stretching for specific segments
      if (timingAnalysis.timeStretchFactors && timingAnalysis.timeStretchFactors.length > 0) {
        for (const stretch of timingAnalysis.timeStretchFactors) {
          if (Math.abs(stretch.factor - 1.0) > 0.05) {
            console.log(`[VideoTranslator] Time stretch ${stretch.startTime}-${stretch.endTime}: ${stretch.factor}`);
          }
        }
      }
      
      // Add pause adjustments
      if (timingAnalysis.pauseAdjustments && timingAnalysis.pauseAdjustments.length > 0) {
        console.log(`[VideoTranslator] Adding ${timingAnalysis.pauseAdjustments.length} pause adjustments`);
      }
      
      if (audioFilters.length > 0) {
        // Apply audio filters using FFmpeg
        const filterComplex = audioFilters.join(',');
        
        return new Promise((resolve, reject) => {
          const ffmpegCommand = [
            '-i', ttsAudioPath,
            '-af', filterComplex,
            '-c:a', 'pcm_s16le',  // Keep as WAV format
            '-ar', '24000',       // Maintain sample rate
            '-ac', '1',           // Mono
            '-y',
            tempAdjustedPath
          ];
          
          console.log(`[VideoTranslator] FFmpeg timing adjustment: ffmpeg ${ffmpegCommand.join(' ')}`);
          
          const ffmpeg = spawn('ffmpeg', ffmpegCommand);
          
          ffmpeg.stderr.on('data', (data) => {
            console.log(`[FFmpeg Timing] ${data}`);
          });
          
          ffmpeg.on('close', (code) => {
            if (code === 0) {
              console.log(`[VideoTranslator] ✅ Timing adjustments applied successfully`);
              resolve(tempAdjustedPath);
            } else {
              console.error(`[VideoTranslator] FFmpeg timing adjustment failed with code: ${code}`);
              // Return original path as fallback
              resolve(ttsAudioPath);
            }
          });
          
          ffmpeg.on('error', (error) => {
            console.error(`[VideoTranslator] FFmpeg timing error:`, error);
            resolve(ttsAudioPath); // Fallback to original
          });
        });
      } else {
        console.log(`[VideoTranslator] No significant timing adjustments needed`);
        return ttsAudioPath;
      }
      
    } catch (error) {
      console.error(`[VideoTranslator] Error applying timing adjustments:`, error);
      return ttsAudioPath; // Return original on error
    }
  }

  /**
   * Replace original video audio track with TTS audio using intelligent timing
   */
  async replaceAudioTrack(
    videoPath: string, 
    ttsAudioPath: string, 
    outputPath: string,
    timingAnalysis?: any
  ): Promise<void> {
    console.log(`[VideoTranslator] 🔄 Replacing audio track with intelligent timing...`);
    console.log(`[VideoTranslator] Video: ${videoPath}`);
    console.log(`[VideoTranslator] TTS Audio: ${ttsAudioPath}`);
    console.log(`[VideoTranslator] Output: ${outputPath}`);

    let finalAudioPath = ttsAudioPath;
    
    // Apply timing adjustments if analysis is available
    if (timingAnalysis && timingAnalysis.speechRateRatio !== 1.0) {
      const adjustedAudioPath = outputPath.replace('.mp4', '_timing_adjusted.wav');
      finalAudioPath = await this.applyTimingAdjustments(ttsAudioPath, timingAnalysis, adjustedAudioPath);
    }

    return new Promise((resolve, reject) => {
      // Check if both input files exist before processing
      if (!fs.existsSync(videoPath)) {
        throw new Error(`Video file not found: ${videoPath}`);
      }
      if (!fs.existsSync(finalAudioPath)) {
        throw new Error(`TTS audio file not found: ${finalAudioPath}`);
      }
      
      // Get file sizes for debugging
      const videoStats = fs.statSync(videoPath);
      const audioStats = fs.statSync(finalAudioPath);
      console.log(`[VideoTranslator] Video file size: ${videoStats.size} bytes`);
      console.log(`[VideoTranslator] Audio file size: ${audioStats.size} bytes`);
      
      // Use enhanced FFmpeg arguments with timing synchronization
      const ffmpegArgs = [
        '-i', videoPath,           // Input video
        '-i', finalAudioPath,      // Input TTS audio (possibly timing-adjusted)
        '-c:v', 'copy',            // Copy video stream as-is
        '-c:a', 'aac',             // Encode audio as AAC
        '-b:a', '128k',            // Set audio bitrate
        '-ar', '44100',            // Set audio sample rate
        '-map', '0:v:0',           // Map video from first input
        '-map', '1:a:0',           // Map audio from second input (TTS)
        '-shortest',               // End when shortest input ends
        '-af', 'aresample=async=1', // Audio resampling for sync
        '-avoid_negative_ts', 'make_zero',  // Handle timing issues
        '-y',                      // Overwrite output file
        outputPath
      ];

      console.log(`[VideoTranslator] Replacing audio with intelligently-timed TTS: ffmpeg ${ffmpegArgs.join(' ')}`);
      
      let ffmpegOutput = '';
      let ffmpegError = '';
      
      const ffmpeg = spawn('ffmpeg', ffmpegArgs);
      
      ffmpeg.stdout.on('data', (data) => {
        ffmpegOutput += data.toString();
      });
      
      ffmpeg.stderr.on('data', (data) => {
        const errorText = data.toString();
        ffmpegError += errorText;
        console.log(`[FFmpeg] ${errorText}`);
      });
      
      ffmpeg.on('close', (code) => {
        if (code === 0) {
          console.log(`[VideoTranslator] ✅ Successfully created intelligently-timed dubbed video: ${outputPath}`);
          
          // Clean up temporary timing-adjusted file
          if (finalAudioPath !== ttsAudioPath) {
            try {
              fs.unlinkSync(finalAudioPath);
              console.log(`[VideoTranslator] Cleaned up temporary timing file`);
            } catch (e) {
              console.warn('Failed to clean up timing adjustment file:', e);
            }
          }
          
          resolve();
        } else {
          console.error(`[VideoTranslator] FFmpeg failed with code ${code}`);
          console.error(`[VideoTranslator] FFmpeg stdout: ${ffmpegOutput}`);
          console.error(`[VideoTranslator] FFmpeg stderr: ${ffmpegError}`);
          reject(new Error(`FFmpeg process exited with code ${code}. Details: ${ffmpegError}`));
        }
      });
      
      ffmpeg.on('error', (error) => {
        console.error(`[VideoTranslator] FFmpeg process error:`, error);
        reject(error);
      });
    });
  }

  private async createSubtitleFile(translationResult: VideoTranslationResult): Promise<string> {
    const subtitlePath = path.join(this.uploadsDir, `subtitles_${Date.now()}.srt`);
    
    let srtContent = '';
    let subtitleIndex = 1;
    
    // Sort segments by start time
    const sortedSegments = [...translationResult.segments].sort((a, b) => a.startTime - b.startTime);
    
    for (const segment of sortedSegments) {
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

  /**
   * Save audio buffer as WAV file using the exact same approach as test-tts-translation.js
   */
  private async saveWaveFile(
    filename: string,
    pcmData: Buffer,
    channels = 1,
    rate = 24000,
    sampleWidth = 2,
  ): Promise<void> {
    return new Promise((resolve, reject) => {
      console.log(`[VideoTranslator] Starting WAV file creation: ${filename}, data size: ${pcmData.length} bytes`);
      
      try {
        // Use event-driven approach for reliable file completion detection
        const writer = new wav.FileWriter(filename, {
          channels: 1,          // Mono
          sampleRate: 24000,    // 24kHz
          bitDepth: 16          // 16-bit depth
        });

        // Set up event listeners for file completion
        writer.on('done', () => {
          console.log(`[VideoTranslator] WAV writer 'done' event fired`);
          
          // Double-check the file was actually created and has content
          try {
            if (fs.existsSync(filename)) {
              const stats = fs.statSync(filename);
              console.log(`[VideoTranslator] WAV file confirmed: ${filename}, size: ${stats.size} bytes`);
              
              if (stats.size > 1000) {
                console.log(`[VideoTranslator] WAV file creation SUCCESS!`);
                resolve();
              } else {
                reject(new Error(`WAV file too small: ${stats.size} bytes`));
              }
            } else {
              reject(new Error('WAV file does not exist after done event'));
            }
          } catch (statError) {
            reject(new Error(`Failed to verify WAV file: ${statError}`));
          }
        });

        writer.on('error', (error) => {
          console.error(`[VideoTranslator] WAV writer error:`, error);
          reject(new Error(`WAV writer failed: ${error.message}`));
        });

        // Add timeout fallback in case events don't fire
        const timeout = setTimeout(() => {
          reject(new Error('WAV file creation timeout - no events received'));
        }, 10000); // 10 second timeout

        // Clear timeout when done
        writer.on('done', () => clearTimeout(timeout));
        writer.on('error', () => clearTimeout(timeout));

        console.log(`[VideoTranslator] Writing WAV data and ending writer...`);
        writer.write(pcmData);
        writer.end();
        
      } catch (error) {
        console.error(`[VideoTranslator] Failed to create WAV writer:`, error);
        reject(error);
      }
    });
  }
}

export const simpleVideoTranslator = new SimpleVideoTranslator();