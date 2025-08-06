import * as fs from 'fs';
import * as path from 'path';
import { spawn } from 'child_process';

export interface WaveformData {
  peaks: number[];
  duration: number;
  sampleRate: number;
  speechSegments: SpeechSegment[];
}

export interface SpeechSegment {
  startTime: number;
  endTime: number;
  amplitude: number;
  confidence: number;
  speechIntensity: number;
}

export interface AlignedCaption {
  startTime: number;
  endTime: number;
  text: string;
  waveformAlignment: {
    speechStart: number;
    speechEnd: number;
    peakAmplitude: number;
    speechConfidence: number;
  };
}

export class WaveformAnalyzer {
  
  /**
   * Extract audio waveform data from video file
   */
  async extractWaveform(videoPath: string): Promise<WaveformData> {
    console.log('🌊 Extracting audio waveform from:', videoPath);
    
    const tempAudioPath = path.join('temp_frames', `waveform_${Date.now()}.wav`);
    
    // Ensure temp directory exists
    if (!fs.existsSync('temp_frames')) {
      fs.mkdirSync('temp_frames', { recursive: true });
    }
    
    try {
      // Extract audio as WAV for analysis
      await this.extractAudio(videoPath, tempAudioPath);
      
      // Analyze waveform
      const waveformData = await this.analyzeAudioWaveform(tempAudioPath);
      
      // Detect speech segments
      const speechSegments = this.detectSpeechSegments(waveformData.peaks, waveformData.sampleRate);
      
      // Cleanup
      if (fs.existsSync(tempAudioPath)) {
        fs.unlinkSync(tempAudioPath);
      }
      
      return {
        ...waveformData,
        speechSegments
      };
      
    } catch (error) {
      console.error('❌ Waveform extraction failed:', error);
      throw error;
    }
  }
  
  /**
   * Extract audio from video using FFmpeg
   */
  private extractAudio(videoPath: string, outputPath: string): Promise<void> {
    return new Promise((resolve, reject) => {
      console.log('🎵 Extracting audio for waveform analysis');
      console.log('Video path:', videoPath);
      console.log('Output path:', outputPath);
      
      // Check if video file exists - try multiple possible paths
      let resolvedVideoPath = videoPath;
      
      if (!path.isAbsolute(videoPath)) {
        // Try multiple possible locations
        const possiblePaths = [
          path.resolve(process.cwd(), videoPath),
          path.resolve(process.cwd(), 'uploads', videoPath),
          path.resolve(process.cwd(), 'uploads', path.basename(videoPath))
        ];
        
        for (const possiblePath of possiblePaths) {
          console.log('Checking path:', possiblePath, 'exists:', fs.existsSync(possiblePath));
          if (fs.existsSync(possiblePath)) {
            resolvedVideoPath = possiblePath;
            break;
          }
        }
      }
      
      console.log('Final resolved video path:', resolvedVideoPath);
      console.log('Video file exists:', fs.existsSync(resolvedVideoPath));
      
      if (!fs.existsSync(resolvedVideoPath)) {
        console.error('❌ Video file not found in any location:', resolvedVideoPath);
        console.error('Original path:', videoPath);
        reject(new Error(`Video file not found: ${resolvedVideoPath}`));
        return;
      }
      
      const ffmpeg = spawn('ffmpeg', [
        '-i', resolvedVideoPath,
        '-vn', // No video
        '-acodec', 'pcm_s16le', // PCM 16-bit
        '-ar', '44100', // 44.1kHz sample rate
        '-ac', '1', // Mono
        '-y', // Overwrite
        outputPath
      ]);
      
      ffmpeg.stderr.on('data', (data) => {
        console.log('FFmpeg audio extraction stderr:', data.toString());
      });
      
      ffmpeg.on('close', (code) => {
        console.log('FFmpeg audio extraction finished with code:', code);
        if (code === 0) {
          console.log('✅ Audio extracted successfully:', outputPath);
          resolve();
        } else {
          console.error('❌ FFmpeg audio extraction failed with code:', code);
          reject(new Error(`FFmpeg audio extraction failed with code ${code}`));
        }
      });
      
      ffmpeg.on('error', (error) => {
        console.error('❌ FFmpeg spawn error:', error);
        reject(error);
      });
    });
  }
  
  /**
   * Analyze audio waveform using FFmpeg
   */
  private analyzeAudioWaveform(audioPath: string): Promise<{peaks: number[], duration: number, sampleRate: number}> {
    return new Promise((resolve, reject) => {
      let peaksData = '';
      
      // Use FFmpeg to generate waveform data
      const ffmpeg = spawn('ffmpeg', [
        '-i', audioPath,
        '-filter_complex', 'astats=metadata=1:reset=1:length=0.1', // 100ms windows
        '-f', 'null',
        '-'
      ]);
      
      ffmpeg.stderr.on('data', (data) => {
        peaksData += data.toString();
      });
      
      ffmpeg.on('close', (code) => {
        if (code === 0) {
          try {
            // Parse duration from FFmpeg output
            const durationMatch = peaksData.match(/Duration: (\d+):(\d+):(\d+\.\d+)/);
            let duration = 0;
            
            if (durationMatch) {
              const hours = parseInt(durationMatch[1]);
              const minutes = parseInt(durationMatch[2]);
              const seconds = parseFloat(durationMatch[3]);
              duration = hours * 3600 + minutes * 60 + seconds;
            }
            
            // Extract RMS levels as peaks (simplified approach)
            const rmsMatches = peaksData.match(/lavfi\.astats\.Overall\.RMS_level=(-?\d+\.\d+)/g) || [];
            const peaks = rmsMatches.map(match => {
              const level = parseFloat(match.split('=')[1]);
              // Convert dB to linear amplitude (0-1 range)
              return Math.max(0, Math.min(1, Math.pow(10, level / 20)));
            });
            
            console.log(`🌊 Extracted ${peaks.length} waveform peaks over ${duration}s`);
            
            resolve({
              peaks: peaks.length > 0 ? peaks : this.generateFallbackPeaks(duration),
              duration,
              sampleRate: 44100
            });
            
          } catch (error) {
            console.error('❌ Waveform parsing failed:', error);
            reject(error);
          }
        } else {
          reject(new Error(`FFmpeg waveform analysis failed with code ${code}`));
        }
      });
      
      ffmpeg.on('error', reject);
    });
  }
  
  /**
   * Generate fallback waveform peaks if extraction fails
   */
  private generateFallbackPeaks(duration: number): number[] {
    const peaks = [];
    const samplesPerSecond = 10; // 100ms intervals
    
    for (let i = 0; i < duration * samplesPerSecond; i++) {
      // Simulate speech pattern with some randomness
      const time = i / samplesPerSecond;
      const speechPattern = Math.sin(time * 0.5) * 0.3 + 0.4;
      const noise = (Math.random() - 0.5) * 0.2;
      peaks.push(Math.max(0, Math.min(1, speechPattern + noise)));
    }
    
    return peaks;
  }
  
  /**
   * Detect speech segments from waveform peaks
   */
  private detectSpeechSegments(peaks: number[], sampleRate: number): SpeechSegment[] {
    const segments: SpeechSegment[] = [];
    const windowSize = Math.floor(sampleRate / 100); // 10ms windows
    const speechThreshold = 0.1; // Minimum amplitude for speech
    const minSegmentDuration = 0.3; // Minimum 300ms for valid speech
    
    let currentSegment: Partial<SpeechSegment> | null = null;
    
    for (let i = 0; i < peaks.length; i++) {
      const time = i * 0.1; // 100ms intervals
      const amplitude = peaks[i];
      const isSpeech = amplitude > speechThreshold;
      
      if (isSpeech && !currentSegment) {
        // Start new speech segment
        currentSegment = {
          startTime: time,
          amplitude: amplitude,
          speechIntensity: amplitude
        };
      } else if (isSpeech && currentSegment) {
        // Continue current segment
        currentSegment.amplitude = Math.max(currentSegment.amplitude || 0, amplitude);
        currentSegment.speechIntensity = (currentSegment.speechIntensity || 0) + amplitude;
      } else if (!isSpeech && currentSegment) {
        // End current segment
        const duration = time - (currentSegment.startTime || 0);
        
        if (duration >= minSegmentDuration) {
          segments.push({
            startTime: currentSegment.startTime || 0,
            endTime: time,
            amplitude: currentSegment.amplitude || 0,
            confidence: Math.min(1, (currentSegment.speechIntensity || 0) / duration),
            speechIntensity: currentSegment.speechIntensity || 0
          });
        }
        
        currentSegment = null;
      }
    }
    
    // Close final segment if needed
    if (currentSegment) {
      const duration = (peaks.length * 0.1) - (currentSegment.startTime || 0);
      if (duration >= minSegmentDuration) {
        segments.push({
          startTime: currentSegment.startTime || 0,
          endTime: peaks.length * 0.1,
          amplitude: currentSegment.amplitude || 0,
          confidence: Math.min(1, (currentSegment.speechIntensity || 0) / duration),
          speechIntensity: currentSegment.speechIntensity || 0
        });
      }
    }
    
    console.log(`🎙️ Detected ${segments.length} speech segments`);
    return segments;
  }
  
  /**
   * Align captions with waveform data for optimal timing
   */
  alignCaptionsWithWaveform(
    captions: Array<{startTime: number, endTime: number, text: string}>,
    waveformData: WaveformData
  ): AlignedCaption[] {
    console.log('🎯 Aligning captions with waveform data...');
    
    const alignedCaptions: AlignedCaption[] = [];
    
    for (const caption of captions) {
      // Find the best matching speech segment for this caption
      const matchingSegment = this.findBestSpeechSegment(
        caption.startTime,
        caption.endTime,
        waveformData.speechSegments
      );
      
      if (matchingSegment) {
        // Adjust caption timing to match speech segment
        const adjustedStartTime = matchingSegment.startTime;
        const adjustedEndTime = Math.min(
          matchingSegment.endTime,
          adjustedStartTime + (caption.endTime - caption.startTime) * 1.2 // Allow 20% flexibility
        );
        
        alignedCaptions.push({
          startTime: adjustedStartTime,
          endTime: adjustedEndTime,
          text: caption.text,
          waveformAlignment: {
            speechStart: matchingSegment.startTime,
            speechEnd: matchingSegment.endTime,
            peakAmplitude: matchingSegment.amplitude,
            speechConfidence: matchingSegment.confidence
          }
        });
      } else {
        // No matching speech segment, keep original timing
        alignedCaptions.push({
          startTime: caption.startTime,
          endTime: caption.endTime,
          text: caption.text,
          waveformAlignment: {
            speechStart: caption.startTime,
            speechEnd: caption.endTime,
            peakAmplitude: 0.3,
            speechConfidence: 0.5
          }
        });
      }
    }
    
    console.log(`✅ Aligned ${alignedCaptions.length} captions with waveform`);
    return alignedCaptions;
  }
  
  /**
   * Find the best matching speech segment for a caption
   */
  private findBestSpeechSegment(
    captionStart: number,
    captionEnd: number,
    speechSegments: SpeechSegment[]
  ): SpeechSegment | null {
    let bestSegment: SpeechSegment | null = null;
    let bestOverlap = 0;
    
    for (const segment of speechSegments) {
      // Calculate overlap between caption and speech segment
      const overlapStart = Math.max(captionStart, segment.startTime);
      const overlapEnd = Math.min(captionEnd, segment.endTime);
      const overlap = Math.max(0, overlapEnd - overlapStart);
      
      // Score based on overlap and speech confidence
      const score = overlap * segment.confidence;
      
      if (score > bestOverlap) {
        bestOverlap = score;
        bestSegment = segment;
      }
    }
    
    return bestSegment;
  }
  
  /**
   * Generate waveform visualization data for frontend
   */
  generateWaveformVisualization(waveformData: WaveformData, width: number = 800): {
    points: number[],
    speechRegions: Array<{start: number, end: number}>,
    duration: number
  } {
    const points = [];
    const speechRegions = [];
    
    // Downsample peaks to fit visualization width
    const samplesPerPixel = Math.ceil(waveformData.peaks.length / width);
    
    for (let i = 0; i < width; i++) {
      const startIdx = i * samplesPerPixel;
      const endIdx = Math.min(startIdx + samplesPerPixel, waveformData.peaks.length);
      
      // Take maximum amplitude in this pixel range
      let maxAmp = 0;
      for (let j = startIdx; j < endIdx; j++) {
        maxAmp = Math.max(maxAmp, waveformData.peaks[j] || 0);
      }
      
      points.push(maxAmp);
    }
    
    // Convert speech segments to pixel coordinates
    for (const segment of waveformData.speechSegments) {
      const startPixel = Math.floor((segment.startTime / waveformData.duration) * width);
      const endPixel = Math.floor((segment.endTime / waveformData.duration) * width);
      
      speechRegions.push({
        start: startPixel,
        end: endPixel
      });
    }
    
    return {
      points,
      speechRegions,
      duration: waveformData.duration
    };
  }
}