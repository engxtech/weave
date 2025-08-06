import { GoogleGenAI } from '@google/genai';
import { spawn } from 'child_process';
import { promises as fs, createReadStream } from 'fs';

interface AudioEnhancementResult {
  success: boolean;
  enhancedAudioPath?: string;
  qualityScore?: number;
  processingTime: number;
  improvements: string[];
}

export class AudioEnhancementService {
  private genai: GoogleGenAI;

  constructor(apiKey: string) {
    this.genai = new GoogleGenAI({ apiKey });
  }

  async enhanceAudio(
    videoPath: string,
    processingBackend: string = 'Auphonic',
    enhancementType: string = 'Enhance & Denoise',
    enhancementSteps: number = 64
  ): Promise<AudioEnhancementResult> {
    const startTime = Date.now();

    try {
      console.log('=== AUDIO ENHANCEMENT START ===');
      console.log('Video path:', videoPath);
      console.log('Processing backend:', processingBackend);
      console.log('Enhancement type:', enhancementType);
      console.log('Enhancement steps:', enhancementSteps);

      // Step 1: Extract audio for analysis
      const audioPath = await this.extractAudio(videoPath);
      
      // Step 2: Analyze audio quality with Gemini
      const qualityAnalysis = await this.analyzeAudioQuality(audioPath);
      
      // Step 3: Apply backend-specific enhancements
      let enhancedAudioPath: string;
      if (processingBackend === 'Auphonic') {
        enhancedAudioPath = await this.enhanceWithAuphonic(audioPath, enhancementType, enhancementSteps);
      } else if (processingBackend === 'ElevenLabs') {
        enhancedAudioPath = await this.enhanceWithElevenLabs(audioPath, enhancementType, enhancementSteps);
      } else {
        // Fallback to FFmpeg-based enhancement
        enhancedAudioPath = await this.enhanceWithFFmpeg(audioPath, enhancementType, enhancementSteps, qualityAnalysis);
      }
      
      // Step 4: Replace audio in original video
      const finalVideoPath = await this.replaceAudioInVideo(videoPath, enhancedAudioPath);
      
      const processingTime = Date.now() - startTime;
      
      console.log('=== AUDIO ENHANCEMENT COMPLETE ===');
      console.log(`Processing time: ${processingTime}ms`);

      return {
        success: true,
        enhancedAudioPath: finalVideoPath,
        qualityScore: qualityAnalysis.score,
        processingTime,
        improvements: qualityAnalysis.improvements
      };

    } catch (error) {
      console.error('Audio enhancement failed:', error);
      return {
        success: false,
        processingTime: Date.now() - startTime,
        improvements: []
      };
    }
  }

  private async extractAudio(videoPath: string): Promise<string> {
    const audioPath = `temp_audio_enhance_${Date.now()}.wav`;
    
    return new Promise((resolve, reject) => {
      const ffmpegProcess = spawn('ffmpeg', [
        '-i', videoPath,
        '-vn',
        '-acodec', 'pcm_s16le',
        '-ar', '48000',
        '-ac', '2',
        '-y',
        audioPath
      ]);

      ffmpegProcess.on('close', (code) => {
        if (code === 0) resolve(audioPath);
        else reject(new Error(`Audio extraction failed with code ${code}`));
      });
    });
  }

  private async analyzeAudioQuality(audioPath: string): Promise<any> {
    try {
      const audioBuffer = await fs.readFile(audioPath);
      const audioBase64 = audioBuffer.toString('base64');

      const response = await this.genai.models.generateContent({
        model: 'gemini-2.0-flash-exp',
        contents: [
          {
            inlineData: {
              data: audioBase64,
              mimeType: 'audio/wav'
            }
          },
          `Analyze this audio file's quality and provide recommendations for enhancement.

Please evaluate:
1. Background noise levels
2. Speech clarity and intelligibility
3. Overall audio quality (1-10 score)
4. Specific issues that need correction
5. Recommended improvements

Return as JSON format:
{
  "score": 7,
  "issues": ["background noise", "low volume"],
  "improvements": ["noise reduction", "volume normalization", "clarity enhancement"]
}`
        ],
        config: {
          responseMimeType: 'application/json'
        }
      });

      return JSON.parse(response.text || '{"score": 5, "issues": [], "improvements": []}');
    } catch (error) {
      console.error('Audio quality analysis failed:', error);
      return { score: 5, issues: [], improvements: [] };
    }
  }

  private async enhanceWithAuphonic(
    audioPath: string,
    enhancementType: string,
    enhancementSteps: number
  ): Promise<string> {
    try {
      console.log('🎧 Enhancing audio with Auphonic using Simple API...');
      
      const FormData = (await import('form-data')).default;
      const axios = (await import('axios')).default;
      
      // Use Auphonic Simple API with multipart/form-data
      const formData = new FormData();
      
      // Add the audio file
      formData.append('input_file', createReadStream(audioPath));
      
      // Add title and output name
      formData.append('title', `Enhanced Audio ${Date.now()}`);
      formData.append('output_basename', `enhanced_${Date.now()}`);
      
      // Configure algorithms based on enhancement type
      const intensity = enhancementSteps / 100;
      
      // Common settings
      formData.append('leveler', 'true');
      formData.append('normloudness', 'true');
      formData.append('loudnesstarget', '-16');
      
      switch (enhancementType) {
        case 'Enhance & Denoise':
          formData.append('denoise', 'true');
          formData.append('denoiseamount', Math.round(intensity * 100).toString());
          formData.append('filtering', 'true');
          break;
        case 'Denoise Only':
          formData.append('denoise', 'true');
          formData.append('denoiseamount', Math.round(intensity * 100).toString());
          formData.append('leveler', 'false');
          break;
        case 'Enhance Only':
          formData.append('filtering', 'true');
          formData.append('denoise', 'false');
          break;
        case 'Voice Clarity':
          formData.append('filtering', 'true');
          formData.append('denoise', 'true');
          formData.append('denoiseamount', '50');
          break;
        case 'Remove Background':
          formData.append('denoise', 'true');
          formData.append('denoiseamount', '90');
          formData.append('filtering', 'true');
          break;
      }
      
      // Start production immediately
      formData.append('action', 'start');
      
      // Create and start production using Simple API
      const response = await axios.post('https://auphonic.com/api/simple/productions.json', formData, {
        headers: {
          'Authorization': `Bearer ${process.env.AUPHONIC_API_KEY}`,
          ...formData.getHeaders()
        }
      });
      
      if (response.data.status_code !== 200) {
        throw new Error(response.data.error_message || 'Auphonic API error');
      }
      
      const productionId = response.data.data.uuid;
      console.log(`📊 Auphonic production started: ${productionId}`);
      
      // Poll for completion
      const enhancedAudioPath = await this.pollAuphonicCompletion(productionId);
      console.log('✅ Auphonic enhancement complete');
      
      return enhancedAudioPath;
    } catch (error) {
      console.error('❌ Auphonic enhancement failed:', error);
      throw new Error(`Auphonic enhancement failed: ${error}`);
    }
  }

  private async enhanceWithElevenLabs(
    audioPath: string,
    enhancementType: string,
    enhancementSteps: number
  ): Promise<string> {
    try {
      console.log('🔊 Enhancing audio with ElevenLabs...');
      
      const axios = (await import('axios')).default;
      const FormData = (await import('form-data')).default;
      
      const formData = new FormData();
      formData.append('audio', await fs.readFile(audioPath), {
        filename: 'audio.wav',
        contentType: 'audio/wav'
      });
      
      // ElevenLabs audio enhancement settings
      const settings = {
        remove_background_noise: enhancementType.includes('Denoise'),
        enhance_speech_clarity: enhancementType.includes('Enhance'),
        normalize_volume: true,
        intensity: enhancementSteps / 100
      };
      
      formData.append('settings', JSON.stringify(settings));
      
      const response = await axios.post('https://api.elevenlabs.io/v1/audio-enhancement', formData, {
        headers: {
          'Xi-Api-Key': process.env.ELEVEN_API_KEY,
          ...formData.getHeaders()
        },
        responseType: 'arraybuffer'
      });
      
      const enhancedAudioPath = `enhanced_elevenlabs_${Date.now()}.wav`;
      await fs.writeFile(enhancedAudioPath, response.data);
      
      console.log('✅ ElevenLabs enhancement complete');
      return enhancedAudioPath;
    } catch (error) {
      console.error('❌ ElevenLabs enhancement failed:', error);
      throw new Error(`ElevenLabs enhancement failed: ${error}`);
    }
  }

  private async enhanceWithFFmpeg(
    audioPath: string,
    enhancementType: string,
    intensity: number,
    analysis: any
  ): Promise<string> {
    const outputPath = `enhanced_audio_${Date.now()}.wav`;
    
    return new Promise((resolve, reject) => {
      const intensityFactor = intensity / 100;
      let ffmpegArgs = ['-i', audioPath];
      
      // Build filter chain based on enhancement type and analysis
      const filters: string[] = [];
      
      if (enhancementType.includes('Denoise') || analysis.issues.includes('background noise')) {
        // Apply noise reduction
        filters.push(`afftdn=nf=${Math.round(intensityFactor * 25)}`);
      }
      
      if (enhancementType.includes('Enhance') || analysis.issues.includes('low volume')) {
        // Apply dynamic range compression and volume normalization
        filters.push(`compand=0.1|0.1:1|1:-90/-90|-70/-70|-30/-9|0/-3:6:0:0:0`);
        filters.push(`loudnorm=I=-16:TP=-1.5:LRA=11`);
      }
      
      // Audio clarity enhancement
      if (analysis.issues.includes('clarity') || analysis.score < 7) {
        filters.push(`highpass=f=80`);
        filters.push(`lowpass=f=8000`);
        filters.push(`equalizer=f=3000:t=h:w=500:g=${Math.round(intensityFactor * 3)}`);
      }
      
      if (filters.length > 0) {
        ffmpegArgs.push('-af', filters.join(','));
      }
      
      ffmpegArgs = ffmpegArgs.concat([
        '-y',
        outputPath
      ]);

      const ffmpegProcess = spawn('ffmpeg', ffmpegArgs);

      ffmpegProcess.on('close', (code) => {
        if (code === 0) resolve(outputPath);
        else reject(new Error(`FFmpeg enhancement failed with code ${code}`));
      });
    });
  }



  private async pollAuphonicCompletion(productionId: string): Promise<string> {
    const axios = (await import('axios')).default;
    const maxAttempts = 60; // 5 minutes max
    let attempts = 0;

    while (attempts < maxAttempts) {
      try {
        const statusResponse = await axios.get(`https://auphonic.com/api/production/${productionId}.json`, {
          headers: { 'Authorization': `Bearer ${process.env.AUPHONIC_API_KEY}` }
        });

        const status = statusResponse.data.data.status_string;
        console.log(`📊 Auphonic status: ${status}`);

        if (status === 'Done') {
          // Download the enhanced audio
          const outputFiles = statusResponse.data.data.output_files;
          if (outputFiles && outputFiles.length > 0) {
            const downloadUrl = outputFiles[0].download_url;
            const enhancedAudioPath = `enhanced_auphonic_${Date.now()}.wav`;
            
            const downloadResponse = await axios.get(downloadUrl, {
              headers: { 'Authorization': `Bearer ${process.env.AUPHONIC_API_KEY}` },
              responseType: 'arraybuffer'
            });
            
            await fs.writeFile(enhancedAudioPath, downloadResponse.data);
            return enhancedAudioPath;
          }
        } else if (status === 'Error') {
          throw new Error('Auphonic processing failed');
        }

        // Wait 5 seconds before next check
        await new Promise(resolve => setTimeout(resolve, 5000));
        attempts++;
      } catch (error) {
        console.error('Error polling Auphonic:', error);
        attempts++;
        await new Promise(resolve => setTimeout(resolve, 5000));
      }
    }

    throw new Error('Auphonic processing timeout');
  }

  private async replaceAudioInVideo(videoPath: string, enhancedAudioPath: string): Promise<string> {
    const outputPath = `audio_enhanced_${Date.now()}.mp4`;
    
    return new Promise((resolve, reject) => {
      const ffmpegProcess = spawn('ffmpeg', [
        '-i', videoPath,
        '-i', enhancedAudioPath,
        '-map', '0:v',
        '-map', '1:a',
        '-c:v', 'copy',
        '-c:a', 'aac',
        '-b:a', '192k',
        '-shortest',
        '-y',
        outputPath
      ]);

      ffmpegProcess.on('close', (code) => {
        if (code === 0) resolve(outputPath);
        else reject(new Error(`Video audio replacement failed with code ${code}`));
      });
    });
  }
}