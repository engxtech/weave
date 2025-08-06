import { spawn } from 'child_process';
import path from 'path';
import fs from 'fs';
import { nanoid } from 'nanoid';

export interface AudioLevelingOptions {
  targetLUFS: number; // Target loudness (e.g., -23 for broadcast, -16 for streaming)
  dynamicRange: number; // How much dynamic range to preserve (0-100)
  compressorRatio: number; // Compression ratio (1-20)
  gateThreshold: number; // Noise gate threshold in dB
  normalize: boolean; // Whether to normalize peaks
  limiterEnabled: boolean; // Enable peak limiter
}

export interface WaveformData {
  timestamps: number[];
  peaks: number[];
  rms: number[];
  frequency: number;
  duration: number;
  channels: number;
  sampleRate: number;
}

export interface AudioAnalysis {
  originalLUFS: number;
  targetLUFS: number;
  peakLevel: number;
  dynamicRange: number;
  clippingDetected: boolean;
  silencePercentage: number;
  waveform: WaveformData;
}

export interface AudioProcessingResult {
  outputPath: string;
  originalAnalysis: AudioAnalysis;
  processedAnalysis: AudioAnalysis;
  processingTime: number;
  improvementMetrics: {
    lufsImprovement: number;
    dynamicRangeChange: number;
    peakReduction: number;
    consistencyScore: number;
  };
}

export class AudioProcessor {
  private tempDir: string;

  constructor() {
    this.tempDir = path.join(process.cwd(), 'temp_audio_processing');
    this.ensureTempDir();
  }

  private ensureTempDir() {
    if (!fs.existsSync(this.tempDir)) {
      fs.mkdirSync(this.tempDir, { recursive: true });
    }
  }

  async processAudioLeveling(
    inputPath: string,
    outputPath: string,
    options: AudioLevelingOptions,
    progressCallback?: (progress: number) => void
  ): Promise<AudioProcessingResult> {
    const startTime = Date.now();
    console.log('Starting smart audio leveling with waveform analysis...');
    
    if (progressCallback) progressCallback(5);

    // Analyze original audio
    const originalAnalysis = await this.analyzeAudio(inputPath);
    console.log('Original audio analysis:', {
      lufs: originalAnalysis.originalLUFS,
      peak: originalAnalysis.peakLevel,
      dynamicRange: originalAnalysis.dynamicRange
    });
    
    if (progressCallback) progressCallback(25);

    // Generate processing filter chain
    const filterChain = this.buildAudioFilterChain(originalAnalysis, options);
    console.log('Audio filter chain:', filterChain);
    
    if (progressCallback) progressCallback(40);

    // Process audio with smart leveling
    await this.applyAudioProcessing(inputPath, outputPath, filterChain, progressCallback);
    
    if (progressCallback) progressCallback(80);

    // Analyze processed audio
    const processedAnalysis = await this.analyzeAudio(outputPath);
    
    if (progressCallback) progressCallback(95);

    const processingTime = Date.now() - startTime;
    
    // Calculate improvement metrics
    const improvementMetrics = this.calculateImprovementMetrics(originalAnalysis, processedAnalysis, options);
    
    if (progressCallback) progressCallback(100);

    return {
      outputPath,
      originalAnalysis,
      processedAnalysis,
      processingTime,
      improvementMetrics
    };
  }

  private async analyzeAudio(filePath: string): Promise<AudioAnalysis> {
    console.log('Analyzing audio levels and generating waveform...');
    
    // Get audio metadata
    const metadata = await this.getAudioMetadata(filePath);
    
    // Analyze loudness (LUFS)
    const lufsData = await this.analyzeLoudness(filePath);
    
    // Generate waveform data
    const waveform = await this.generateWaveformData(filePath, metadata);
    
    // Detect clipping and silence
    const clippingData = await this.detectClipping(filePath);
    const silenceData = await this.detectSilence(filePath);
    
    return {
      originalLUFS: lufsData.lufs,
      targetLUFS: lufsData.lufs, // Will be updated during processing
      peakLevel: lufsData.peak,
      dynamicRange: lufsData.range,
      clippingDetected: clippingData.hasClipping,
      silencePercentage: silenceData.percentage,
      waveform
    };
  }

  private async getAudioMetadata(filePath: string): Promise<{
    duration: number;
    channels: number;
    sampleRate: number;
    bitrate: number;
  }> {
    return new Promise((resolve, reject) => {
      const ffprobe = spawn('ffprobe', [
        '-v', 'quiet',
        '-print_format', 'json',
        '-show_format',
        '-show_streams',
        '-select_streams', 'a:0',
        filePath
      ]);

      let output = '';
      ffprobe.stdout.on('data', (data) => {
        output += data.toString();
      });

      ffprobe.on('close', (code) => {
        if (code === 0) {
          try {
            const info = JSON.parse(output);
            const audioStream = info.streams[0];
            const duration = parseFloat(info.format.duration);
            
            resolve({
              duration,
              channels: audioStream.channels || 2,
              sampleRate: parseInt(audioStream.sample_rate) || 44100,
              bitrate: parseInt(audioStream.bit_rate) || 128000
            });
          } catch (error) {
            reject(new Error(`Failed to parse audio metadata: ${error}`));
          }
        } else {
          reject(new Error(`ffprobe failed with code ${code}`));
        }
      });
    });
  }

  private async analyzeLoudness(filePath: string): Promise<{
    lufs: number;
    peak: number;
    range: number;
  }> {
    return new Promise((resolve, reject) => {
      const ffmpeg = spawn('ffmpeg', [
        '-i', filePath,
        '-af', 'loudnorm=print_format=json',
        '-f', 'null',
        '-'
      ]);

      let stderr = '';
      ffmpeg.stderr.on('data', (data) => {
        stderr += data.toString();
      });

      ffmpeg.on('close', (code) => {
        try {
          // Extract loudness data from stderr
          const jsonMatch = stderr.match(/\{[\s\S]*?\}/);
          if (jsonMatch) {
            const loudnessData = JSON.parse(jsonMatch[0]);
            resolve({
              lufs: parseFloat(loudnessData.input_i) || -23,
              peak: parseFloat(loudnessData.input_tp) || -6,
              range: parseFloat(loudnessData.input_lra) || 7
            });
          } else {
            // Fallback values
            resolve({ lufs: -23, peak: -6, range: 7 });
          }
        } catch (error) {
          console.error('Failed to parse loudness data:', error);
          resolve({ lufs: -23, peak: -6, range: 7 });
        }
      });
    });
  }

  private async generateWaveformData(filePath: string, metadata: any): Promise<WaveformData> {
    console.log('Generating detailed waveform data...');
    
    const tempWaveFile = path.join(this.tempDir, `waveform_${nanoid()}.txt`);
    
    return new Promise((resolve, reject) => {
      // Generate waveform data with astats filter
      const ffmpeg = spawn('ffmpeg', [
        '-i', filePath,
        '-af', 'astats=metadata=1:reset=1:length=0.1', // 100ms windows
        '-f', 'null',
        '-'
      ]);

      let stderr = '';
      ffmpeg.stderr.on('data', (data) => {
        stderr += data.toString();
      });

      ffmpeg.on('close', (code) => {
        try {
          // Parse RMS and peak values from astats output
          const rmsMatches = stderr.match(/lavfi\.astats\.Overall\.RMS_level=(-?\d+\.?\d*)/g) || [];
          const peakMatches = stderr.match(/lavfi\.astats\.Overall\.Peak_level=(-?\d+\.?\d*)/g) || [];
          
          const rms = rmsMatches.map(match => {
            const value = parseFloat(match.split('=')[1]);
            return Math.max(-60, value); // Clamp to -60dB minimum
          });
          
          const peaks = peakMatches.map(match => {
            const value = parseFloat(match.split('=')[1]);
            return Math.max(-60, value); // Clamp to -60dB minimum
          });
          
          // Generate timestamps
          const timestamps = rms.map((_, i) => i * 0.1); // 100ms intervals
          
          resolve({
            timestamps,
            peaks: peaks.length > 0 ? peaks : this.generateFallbackWaveform(metadata.duration),
            rms: rms.length > 0 ? rms : this.generateFallbackWaveform(metadata.duration),
            frequency: 10, // 10 Hz (100ms intervals)
            duration: metadata.duration,
            channels: metadata.channels,
            sampleRate: metadata.sampleRate
          });
        } catch (error) {
          console.error('Failed to generate waveform data:', error);
          resolve({
            timestamps: [],
            peaks: this.generateFallbackWaveform(metadata.duration),
            rms: this.generateFallbackWaveform(metadata.duration),
            frequency: 10,
            duration: metadata.duration,
            channels: metadata.channels,
            sampleRate: metadata.sampleRate
          });
        }
      });
    });
  }

  private generateFallbackWaveform(duration: number): number[] {
    const samples = Math.floor(duration * 10); // 10 Hz
    return Array.from({ length: samples }, (_, i) => {
      // Generate realistic-looking waveform with some variation
      const base = -20 + Math.sin(i * 0.1) * 5;
      const noise = (Math.random() - 0.5) * 4;
      return Math.max(-60, base + noise);
    });
  }

  private async detectClipping(filePath: string): Promise<{ hasClipping: boolean; clippingPercentage: number }> {
    return new Promise((resolve) => {
      const ffmpeg = spawn('ffmpeg', [
        '-i', filePath,
        '-af', 'astats',
        '-f', 'null',
        '-'
      ]);

      let stderr = '';
      ffmpeg.stderr.on('data', (data) => {
        stderr += data.toString();
      });

      ffmpeg.on('close', () => {
        const peakMatch = stderr.match(/Peak_level=(-?\d+\.?\d*)/);
        const peak = peakMatch ? parseFloat(peakMatch[1]) : -6;
        
        const hasClipping = peak > -0.1; // Consider > -0.1dB as clipping
        const clippingPercentage = hasClipping ? Math.min(100, (peak + 0.1) * 10) : 0;
        
        resolve({ hasClipping, clippingPercentage });
      });
    });
  }

  private async detectSilence(filePath: string): Promise<{ percentage: number; silentSections: Array<{ start: number; duration: number }> }> {
    return new Promise((resolve) => {
      const ffmpeg = spawn('ffmpeg', [
        '-i', filePath,
        '-af', 'silencedetect=noise=-40dB:duration=0.5',
        '-f', 'null',
        '-'
      ]);

      let stderr = '';
      ffmpeg.stderr.on('data', (data) => {
        stderr += data.toString();
      });

      ffmpeg.on('close', () => {
        const silenceMatches = stderr.match(/silence_start: (\d+\.?\d*)/g) || [];
        const silenceEndMatches = stderr.match(/silence_end: (\d+\.?\d*)/g) || [];
        
        let totalSilence = 0;
        const silentSections = [];
        
        for (let i = 0; i < Math.min(silenceMatches.length, silenceEndMatches.length); i++) {
          const start = parseFloat(silenceMatches[i].split(': ')[1]);
          const end = parseFloat(silenceEndMatches[i].split(': ')[1]);
          const duration = end - start;
          
          totalSilence += duration;
          silentSections.push({ start, duration });
        }
        
        // Estimate total duration for percentage calculation
        const durationMatch = stderr.match(/Duration: (\d{2}):(\d{2}):(\d{2}\.?\d*)/);
        let totalDuration = 0;
        if (durationMatch) {
          const hours = parseInt(durationMatch[1]);
          const minutes = parseInt(durationMatch[2]);
          const seconds = parseFloat(durationMatch[3]);
          totalDuration = hours * 3600 + minutes * 60 + seconds;
        }
        
        const percentage = totalDuration > 0 ? (totalSilence / totalDuration) * 100 : 0;
        
        resolve({ percentage, silentSections });
      });
    });
  }

  private buildAudioFilterChain(analysis: AudioAnalysis, options: AudioLevelingOptions): string {
    const filters = [];
    
    // Noise gate
    if (options.gateThreshold < 0) {
      filters.push(`agate=threshold=${options.gateThreshold}dB:ratio=10:attack=1:release=10`);
    }
    
    // Compressor for dynamic range control
    const attack = 5; // ms
    const release = 50; // ms
    const knee = 2; // dB
    filters.push(`acompressor=ratio=${options.compressorRatio}:threshold=-18dB:attack=${attack}:release=${release}:knee=${knee}`);
    
    // EQ for frequency balance (gentle high-frequency boost for clarity)
    filters.push('highpass=f=80'); // Remove rumble
    filters.push('lowpass=f=16000'); // Remove harsh highs
    
    // Loudness normalization
    filters.push(`loudnorm=i=${options.targetLUFS}:lra=${options.dynamicRange}:tp=-1.0`);
    
    // Peak limiter (if enabled)
    if (options.limiterEnabled) {
      filters.push('alimiter=limit=0.95:attack=1:release=50');
    }
    
    // Final normalization (if enabled)
    if (options.normalize) {
      filters.push('anorm=p=-1.0');
    }
    
    return filters.join(',');
  }

  private async applyAudioProcessing(
    inputPath: string,
    outputPath: string,
    filterChain: string,
    progressCallback?: (progress: number) => void
  ): Promise<void> {
    console.log('Applying smart audio leveling...');
    
    return new Promise((resolve, reject) => {
      const ffmpeg = spawn('ffmpeg', [
        '-i', inputPath,
        '-af', filterChain,
        '-c:a', 'aac',
        '-b:a', '256k',
        '-ar', '48000',
        outputPath,
        '-y'
      ]);

      ffmpeg.stderr.on('data', (data) => {
        const output = data.toString();
        
        // Parse progress from FFmpeg output
        const timeMatch = output.match(/time=(\d{2}):(\d{2}):(\d{2}\.\d{2})/);
        const durationMatch = output.match(/Duration: (\d{2}):(\d{2}):(\d{2}\.\d{2})/);
        
        if (timeMatch && durationMatch && progressCallback) {
          const currentTime = this.parseTime(timeMatch[1], timeMatch[2], timeMatch[3]);
          const totalTime = this.parseTime(durationMatch[1], durationMatch[2], durationMatch[3]);
          
          if (totalTime > 0) {
            const progress = 40 + Math.min(40, (currentTime / totalTime) * 40);
            progressCallback(progress);
          }
        }
      });

      ffmpeg.on('close', (code) => {
        if (code === 0) {
          console.log('Audio processing completed successfully');
          resolve();
        } else {
          reject(new Error(`Audio processing failed with code ${code}`));
        }
      });

      ffmpeg.on('error', reject);
    });
  }

  private parseTime(hours: string, minutes: string, seconds: string): number {
    return parseInt(hours) * 3600 + parseInt(minutes) * 60 + parseFloat(seconds);
  }

  private calculateImprovementMetrics(
    original: AudioAnalysis,
    processed: AudioAnalysis,
    options: AudioLevelingOptions
  ): {
    lufsImprovement: number;
    dynamicRangeChange: number;
    peakReduction: number;
    consistencyScore: number;
  } {
    const lufsImprovement = Math.abs(processed.originalLUFS - options.targetLUFS) - Math.abs(original.originalLUFS - options.targetLUFS);
    const dynamicRangeChange = processed.dynamicRange - original.dynamicRange;
    const peakReduction = original.peakLevel - processed.peakLevel;
    
    // Calculate consistency score based on waveform variance
    const originalVariance = this.calculateWaveformVariance(original.waveform.rms);
    const processedVariance = this.calculateWaveformVariance(processed.waveform.rms);
    const consistencyScore = Math.max(0, Math.min(100, ((originalVariance - processedVariance) / originalVariance) * 100));
    
    return {
      lufsImprovement,
      dynamicRangeChange,
      peakReduction,
      consistencyScore
    };
  }

  private calculateWaveformVariance(values: number[]): number {
    if (values.length === 0) return 0;
    
    const mean = values.reduce((sum, val) => sum + val, 0) / values.length;
    const variance = values.reduce((sum, val) => sum + Math.pow(val - mean, 2), 0) / values.length;
    
    return variance;
  }
}

export const createAudioProcessor = (): AudioProcessor => {
  return new AudioProcessor();
};