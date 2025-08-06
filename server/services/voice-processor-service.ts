import { GoogleGenerativeAI } from '@google/generative-ai';
import ffmpeg from 'fluent-ffmpeg';
import fs from 'fs/promises';
import path from 'path';
import { spawn } from 'child_process';
import axios from 'axios';

export class VoiceProcessorService {
  private genAI: GoogleGenerativeAI;
  private elevenLabsApiKey: string;

  constructor() {
    this.genAI = new GoogleGenerativeAI(process.env.GEMINI_API_KEY || '');
    this.elevenLabsApiKey = process.env.ELEVEN_API_KEY || '';
  }

  async processVoice(inputPath: string, config: any): Promise<{
    outputPath: string;
    translatedText: string;
    originalLanguage: string;
    targetLanguage: string;
    processingTime: number;
  }> {
    const startTime = Date.now();
    console.log('🎙️ Starting voice translation with config:', config);
    
    const outputDir = path.join('uploads', 'translated');
    await fs.mkdir(outputDir, { recursive: true });

    const outputPath = path.join(outputDir, `translated_${Date.now()}.mp4`);

    try {
      // Step 1: Extract audio for voice cloning
      const sourceAudioPath = `temp_audio_${Date.now()}.wav`;
      await this.extractAudioFromVideo(inputPath, sourceAudioPath);
      
      // Step 2: Transcribe original audio
      const { text: originalText, language: originalLanguage } = await this.extractAndTranscribe(inputPath);
      
      // Step 3: Apply translation dictionary if provided
      let processedText = originalText;
      if (config.translationDictionary && Array.isArray(config.translationDictionary)) {
        config.translationDictionary.forEach((entry: { original: string; new: string }) => {
          const regex = new RegExp(`\\b${entry.original}\\b`, 'gi');
          processedText = processedText.replace(regex, entry.new);
        });
        console.log('📝 Applied translation dictionary replacements');
      }
      
      // Step 4: Translate with expert prompt
      const translatedText = await this.translateWithContext(processedText, config.targetLanguage, config);
      
      // Step 5: Generate voice in target language with voice cloning
      const voiceCloneConfig = {
        ...config,
        useVoiceCloning: true,
        sourceAudioPath: sourceAudioPath
      };
      const translatedAudioPath = await this.generateTranslatedVoice(translatedText, config.targetLanguage, voiceCloneConfig);
      
      // Step 6: Replace audio in video
      await this.replaceAudioInVideo(inputPath, translatedAudioPath, outputPath, config);
      
      // Cleanup temporary files
      await fs.unlink(sourceAudioPath).catch(() => {});
      await fs.unlink(translatedAudioPath).catch(() => {});
      
      const processingTime = Date.now() - startTime;
      
      return {
        outputPath,
        translatedText,
        originalLanguage,
        targetLanguage: config.targetLanguage,
        processingTime
      };
    } catch (error) {
      console.error('Voice processing failed:', error);
      throw error;
    }
  }

  private async extractAudioFromVideo(videoPath: string, outputPath: string): Promise<void> {
    return new Promise((resolve, reject) => {
      ffmpeg(videoPath)
        .outputOptions([
          '-vn', // No video
          '-acodec', 'pcm_s16le', // WAV format
          '-ar', '44100', // Sample rate
          '-ac', '1' // Mono
        ])
        .output(outputPath)
        .on('end', () => {
          console.log(`✅ Extracted audio for voice cloning: ${outputPath}`);
          resolve();
        })
        .on('error', reject)
        .run();
    });
  }

  private async extractAndTranscribe(videoPath: string): Promise<{ text: string; language: string }> {
    const audioPath = `temp_audio_${Date.now()}.wav`;
    
    // Extract audio
    await new Promise((resolve, reject) => {
      ffmpeg(videoPath)
        .outputOptions(['-vn', '-acodec', 'pcm_s16le', '-ar', '16000', '-ac', '1'])
        .output(audioPath)
        .on('end', resolve)
        .on('error', reject)
        .run();
    });

    // Transcribe with Gemini
    const audioBuffer = await fs.readFile(audioPath);
    const audioBase64 = audioBuffer.toString('base64');

    const model = this.genAI.getGenerativeModel({ model: 'gemini-2.0-flash-exp' });
    const result = await model.generateContent([
      {
        inlineData: {
          data: audioBase64,
          mimeType: 'audio/wav'
        }
      },
      `As an expert transcription specialist, transcribe this audio with:
      1. Exact verbatim accuracy including filler words
      2. Natural speech patterns preserved
      3. Emotional tone markers [excited], [thoughtful], [laughing]
      4. Detect and return the source language
      
      Format:
      {
        "text": "full transcription with tone markers",
        "language": "detected language code (en, es, fr, etc.)"
      }`
    ]);

    await fs.unlink(audioPath).catch(() => {});
    
    // Extract JSON from the response (handle markdown code blocks)
    const responseText = result.response.text();
    let jsonStr = responseText;
    
    // Remove markdown code blocks if present
    const jsonMatch = responseText.match(/```json\s*([\s\S]*?)\s*```/);
    if (jsonMatch) {
      jsonStr = jsonMatch[1];
    }
    
    try {
      const response = JSON.parse(jsonStr);
      return { text: response.text, language: response.language };
    } catch (error) {
      console.error('Failed to parse transcription response:', responseText);
      throw new Error('Failed to parse transcription response');
    }
  }

  private async translateWithContext(text: string, targetLanguage: string, config: any): Promise<string> {
    const model = this.genAI.getGenerativeModel({ model: 'gemini-2.0-flash-exp' });
    
    const safewordsClause = config.safewords ? 
      `CRITICAL: These words/phrases must NOT be translated: ${config.safewords}` : '';
    
    const dictionaryClause = config.translationDictionary ? 
      `Use these specific translations: ${JSON.stringify(config.translationDictionary)}` : '';

    const expertPrompt = `You are a world-class localization expert specializing in video dubbing for global audiences. Your translations preserve the speaker's authentic voice, tone, and personality while adapting perfectly to cultural contexts.

MISSION: Translate this content for maximum impact in ${targetLanguage} markets.

ADVANCED TRANSLATION FRAMEWORK:
1. Cultural Adaptation:
   - Adapt idioms and metaphors to resonate in target culture
   - Preserve humor with culturally equivalent jokes
   - Maintain formality levels appropriate to target market

2. Voice & Personality Preservation:
   - Keep the speaker's unique speech patterns
   - Preserve emotional markers [excited], [thoughtful], etc.
   - Match pacing and rhythm for lip-sync compatibility

3. Platform Optimization:
   - Use trending phrases in target language
   - Include culturally relevant references
   - Optimize for virality in target market

${safewordsClause}
${dictionaryClause}

SOURCE TEXT:
${text}

TARGET LANGUAGE: ${targetLanguage}

Provide translation that sounds like a native speaker while preserving the original's impact and personality.`;

    const result = await model.generateContent(expertPrompt);
    return result.response.text();
  }

  private async generateTranslatedVoice(text: string, language: string, config: any): Promise<string> {
    const audioPath = `translated_audio_${Date.now()}.mp3`;
    
    try {
      // For voice cloning, we need to use the cloned voice ID
      let voiceId: string;
      
      if (config.useVoiceCloning && config.sourceAudioPath) {
        // Clone the voice from the source audio
        voiceId = await this.cloneVoiceFromAudio(config.sourceAudioPath, language);
        console.log(`🎭 Using cloned voice ID: ${voiceId}`);
      } else {
        // Fallback to default voice for the language
        voiceId = await this.getElevenLabsVoiceId(language);
        console.log(`🎤 Using default voice ID: ${voiceId}`);
      }
      
      // Call ElevenLabs API for voice synthesis with the cloned voice
      const response = await axios.post(
        `https://api.elevenlabs.io/v1/text-to-speech/${voiceId}`,
        {
          text: text,
          model_id: 'eleven_multilingual_v2',
          voice_settings: {
            stability: 0.5,
            similarity_boost: 0.9, // Higher for voice cloning
            style: 0.0,
            use_speaker_boost: true
          }
        },
        {
          headers: {
            'Accept': 'audio/mpeg',
            'xi-api-key': this.elevenLabsApiKey,
            'Content-Type': 'application/json'
          },
          responseType: 'stream'
        }
      );

      // Save the audio stream to file
      const fs_sync = await import('fs');
      const writer = fs_sync.createWriteStream(audioPath);
      response.data.pipe(writer);

      await new Promise((resolve, reject) => {
        writer.on('finish', resolve);
        writer.on('error', reject);
      });

      console.log(`✅ Generated voice audio with ${config.useVoiceCloning ? 'cloned' : 'default'} voice: ${audioPath}`);
      return audioPath;
    } catch (error: any) {
      console.error('ElevenLabs TTS error:', error);
      throw new Error(`Failed to generate voice: ${error?.message || String(error)}`);
    }
  }

  private async cloneVoiceFromAudio(audioPath: string, targetLanguage: string): Promise<string> {
    try {
      console.log(`🔬 Starting voice cloning from: ${audioPath}`);
      
      // Read the audio file
      const audioBuffer = await fs.readFile(audioPath);
      
      // Create FormData for multipart upload
      const FormData = (await import('form-data')).default;
      const form = new FormData();
      
      // Add the audio file
      form.append('files', audioBuffer, {
        filename: 'voice_sample.wav',
        contentType: 'audio/wav'
      });
      
      // Add voice metadata
      form.append('name', `Cloned_Voice_${Date.now()}`);
      form.append('description', `Voice cloned for ${targetLanguage} translation`);
      
      // Clone the voice using ElevenLabs API
      const cloneResponse = await axios.post(
        'https://api.elevenlabs.io/v1/voices/add',
        form,
        {
          headers: {
            ...form.getHeaders(),
            'xi-api-key': this.elevenLabsApiKey
          }
        }
      );
      
      const voiceId = cloneResponse.data.voice_id;
      console.log(`✅ Voice cloned successfully! Voice ID: ${voiceId}`);
      
      // Schedule voice deletion after 1 hour to clean up
      setTimeout(async () => {
        try {
          await axios.delete(
            `https://api.elevenlabs.io/v1/voices/${voiceId}`,
            {
              headers: {
                'xi-api-key': this.elevenLabsApiKey
              }
            }
          );
          console.log(`🧹 Cleaned up cloned voice: ${voiceId}`);
        } catch (error) {
          console.error('Failed to delete cloned voice:', error);
        }
      }, 60 * 60 * 1000); // 1 hour
      
      return voiceId;
    } catch (error: any) {
      console.error('Voice cloning error:', error.response?.data || error);
      throw new Error(`Failed to clone voice: ${error?.response?.data?.detail?.message || error?.message || String(error)}`);
    }
  }

  private async getElevenLabsVoiceId(language: string): Promise<string> {
    // Map languages to appropriate ElevenLabs voice IDs
    const voiceMap: Record<string, string> = {
      'english': '21m00Tcm4TlvDq8ikWAM', // Rachel
      'spanish': 'ThT5KcBeYPX3keUQqHPh', // Spanish voice
      'french': 'HDhiZjBPCg3HfHtYRLTr', // French voice
      'german': 'oWAxZDx7w5VEj9dCyTzz', // German voice
      'italian': 'pFZP5JQG7iQjIQuC4Bku', // Italian voice
      'portuguese': 'Zlb1dXrM653N07WRdFW3', // Portuguese voice
      'polish': 'EXAVITQu4vr4xnSDxMaL', // Polish voice
      'hindi': 'wViXBPUzp2ZZixB1xQuM', // Hindi voice
      'japanese': 'pqHfZKP75CvOlQylNhV4', // Japanese voice
      'korean': 'zrHiDhphv9ZnVXBqCLjz', // Korean voice
      'chinese': 'XB0fDUnXU5powFXDhCwa', // Chinese voice
      'russian': 'AZnzlk1XvdvUeBnXmlld', // Russian voice
      'turkish': 'MF3mGyEYCl7XYWbV9V6O', // Turkish voice
      'swedish': 'LcfcDJNUP1GQjkzn1xUU', // Swedish voice
      'dutch': 'onwK4e9ZLuTAKqWW03F9' // Dutch voice
    };

    const normalizedLanguage = language.toLowerCase();
    
    // Try to get voice ID from map, fallback to multilingual default
    return voiceMap[normalizedLanguage] || '21m00Tcm4TlvDq8ikWAM';
  }

  private async replaceAudioInVideo(
    originalVideo: string, 
    newAudio: string, 
    outputPath: string,
    config: any
  ): Promise<void> {
    return new Promise((resolve, reject) => {
      const ffmpegCmd = ffmpeg(originalVideo)
        .addInput(newAudio)
        .outputOptions([
          '-c:v', 'copy', // Copy video stream
          '-map', '0:v:0', // Use video from first input
          '-map', '1:a:0', // Use audio from second input
          '-shortest' // Match duration to shortest stream
        ]);

      if (config.preserveBackgroundAudio) {
        // Mix original background with new voice
        ffmpegCmd.complexFilter([
          '[0:a]highpass=f=200,lowpass=f=3000,volume=0.3[bg]', // Reduce voice frequencies
          '[1:a][bg]amix=inputs=2:duration=first:dropout_transition=2[out]'
        ]).outputOptions(['-map', '[out]']);
      }

      ffmpegCmd
        .output(outputPath)
        .on('end', () => resolve())
        .on('error', reject)
        .run();
    });
  }

  private getLanguageCode(language: string): string {
    const languageMap: Record<string, string> = {
      'english': 'en-US',
      'spanish': 'es-ES',
      'french': 'fr-FR',
      'german': 'de-DE',
      'italian': 'it-IT',
      'portuguese': 'pt-BR',
      'russian': 'ru-RU',
      'japanese': 'ja-JP',
      'korean': 'ko-KR',
      'chinese': 'zh-CN',
      'arabic': 'ar-SA',
      'hindi': 'hi-IN'
    };
    
    return languageMap[language.toLowerCase()] || 'en-US';
  }
}