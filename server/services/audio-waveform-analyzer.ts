import { spawn } from 'child_process';
import * as fs from 'fs';
import * as path from 'path';

export interface WaveformDataPoint {
  time: number;
  amplitude: number;
  rms: number;
  peak: number;
}

export interface SpeechSegment {
  startTime: number;
  endTime: number;
  duration: number;
  avgAmplitude: number;
  confidence: number;
  words?: string[];
}

export interface WordTiming {
  word: string;
  startTime: number;
  endTime: number;
  confidence: number;
  amplitude: number;
  speechSpeed?: 'slow' | 'normal' | 'fast';
  waveformColor?: string;
  highlightTiming?: {
    onsetTime: number;
    peakTime: number;
    endTime: number;
  };
}

export class AudioWaveformAnalyzer {
  private readonly SILENCE_THRESHOLD = 0.01; // RMS threshold for silence detection
  private readonly MIN_SPEECH_DURATION = 0.05; // Minimum duration for speech segment (50ms)
  private readonly SAMPLE_RATE = 48000; // 48kHz for high-precision analysis
  private readonly MILLISECOND_PRECISION = 0.001; // 1ms precision for timing
  
  async analyzeAudioWaveform(audioPath: string): Promise<WaveformDataPoint[]> {
    console.log(`[AudioWaveformAnalyzer] Analyzing waveform for: ${audioPath}`);
    
    return new Promise((resolve, reject) => {
      const waveformData: WaveformDataPoint[] = [];
      
      // Extract detailed audio waveform data using FFmpeg with millisecond precision
      const ffmpeg = spawn('ffmpeg', [
        '-i', audioPath,
        '-af', `aresample=${this.SAMPLE_RATE},astats=metadata=1:reset=1:length=0.001`, // 1ms windows
        '-f', 'null',
        '-'
      ]);

      let output = '';
      ffmpeg.stderr.on('data', (data) => {
        output += data.toString();
      });

      ffmpeg.on('close', (code) => {
        try {
          console.log(`[AudioWaveformAnalyzer] FFmpeg completed with code: ${code}`);
          
          // Parse FFmpeg astats output for RMS and peak values
          const lines = output.split('\n');
          let timeIndex = 0;
          
          for (const line of lines) {
            if (line.includes('lavfi.astats.Overall.RMS_level=')) {
              const rmsMatch = line.match(/lavfi\.astats\.Overall\.RMS_level=(-?\d+\.?\d*)/);
              const peakMatch = output.match(/lavfi\.astats\.Overall\.Peak_level=(-?\d+\.?\d*)/);
              
              if (rmsMatch) {
                const rmsDb = parseFloat(rmsMatch[1]);
                const peakDb = peakMatch ? parseFloat(peakMatch[1]) : rmsDb;
                
                // Convert dB to linear amplitude (0-1 range)
                const rmsLinear = Math.pow(10, rmsDb / 20);
                const peakLinear = Math.pow(10, peakDb / 20);
                const amplitude = Math.max(0, Math.min(1, (rmsLinear + peakLinear) / 2));
                
                waveformData.push({
                  time: timeIndex * 0.001, // 1ms intervals for millisecond precision
                  amplitude,
                  rms: Math.max(0, rmsLinear),
                  peak: Math.max(0, peakLinear)
                });
                
                timeIndex++;
              }
            }
          }
          
          // If FFmpeg method fails, create waveform using alternative approach
          if (waveformData.length === 0) {
            console.log(`[AudioWaveformAnalyzer] Using alternative waveform extraction`);
            this.extractWaveformAlternative(audioPath).then(resolve).catch(reject);
            return;
          }
          
          console.log(`[AudioWaveformAnalyzer] Extracted ${waveformData.length} waveform points`);
          resolve(waveformData);
          
        } catch (error) {
          console.error('[AudioWaveformAnalyzer] Error parsing waveform:', error);
          reject(error);
        }
      });

      ffmpeg.on('error', (error) => {
        console.error('[AudioWaveformAnalyzer] FFmpeg error:', error);
        reject(error);
      });
    });
  }

  private async extractWaveformAlternative(audioPath: string): Promise<WaveformDataPoint[]> {
    return new Promise((resolve, reject) => {
      const waveformData: WaveformDataPoint[] = [];
      
      // Extract raw audio data for waveform analysis
      const ffmpeg = spawn('ffmpeg', [
        '-i', audioPath,
        '-ar', this.SAMPLE_RATE.toString(),
        '-ac', '1', // Mono
        '-f', 's16le', // 16-bit PCM
        '-'
      ]);

      const audioChunks: Buffer[] = [];
      
      ffmpeg.stdout.on('data', (chunk) => {
        audioChunks.push(chunk);
      });

      ffmpeg.on('close', (code) => {
        try {
          const audioBuffer = Buffer.concat(audioChunks);
          const samples = audioBuffer.length / 2; // 16-bit = 2 bytes per sample
          const windowSize = Math.floor(this.SAMPLE_RATE * 0.1); // 100ms windows
          
          for (let i = 0; i < samples - windowSize; i += windowSize) {
            let sumSquares = 0;
            let peak = 0;
            
            // Calculate RMS and peak for this window
            for (let j = 0; j < windowSize; j++) {
              const sampleIndex = (i + j) * 2;
              if (sampleIndex < audioBuffer.length - 1) {
                const sample = audioBuffer.readInt16LE(sampleIndex) / 32768.0; // Normalize to -1 to 1
                sumSquares += sample * sample;
                peak = Math.max(peak, Math.abs(sample));
              }
            }
            
            const rms = Math.sqrt(sumSquares / windowSize);
            const amplitude = (rms + peak) / 2; // Average of RMS and peak
            
            waveformData.push({
              time: (i / this.SAMPLE_RATE),
              amplitude: Math.max(0, Math.min(1, amplitude)),
              rms: Math.max(0, Math.min(1, rms)),
              peak: Math.max(0, Math.min(1, peak))
            });
          }
          
          console.log(`[AudioWaveformAnalyzer] Generated ${waveformData.length} waveform points from raw audio`);
          resolve(waveformData);
          
        } catch (error) {
          console.error('[AudioWaveformAnalyzer] Error processing raw audio:', error);
          reject(error);
        }
      });

      ffmpeg.on('error', (error) => {
        console.error('[AudioWaveformAnalyzer] Raw audio extraction error:', error);
        reject(error);
      });
    });
  }

  detectSpeechSegments(waveformData: WaveformDataPoint[]): SpeechSegment[] {
    console.log(`[AudioWaveformAnalyzer] Detecting speech segments from ${waveformData.length} data points`);
    
    const speechSegments: SpeechSegment[] = [];
    let currentSegmentStart: number | null = null;
    let segmentAmplitudes: number[] = [];
    
    for (let i = 0; i < waveformData.length; i++) {
      const point = waveformData[i];
      const isSpeech = point.rms > this.SILENCE_THRESHOLD;
      
      if (isSpeech && currentSegmentStart === null) {
        // Start of speech segment
        currentSegmentStart = point.time;
        segmentAmplitudes = [point.amplitude];
        
      } else if (isSpeech && currentSegmentStart !== null) {
        // Continue speech segment
        segmentAmplitudes.push(point.amplitude);
        
      } else if (!isSpeech && currentSegmentStart !== null) {
        // End of speech segment
        const duration = point.time - currentSegmentStart;
        
        if (duration >= this.MIN_SPEECH_DURATION) {
          const avgAmplitude = segmentAmplitudes.reduce((a, b) => a + b, 0) / segmentAmplitudes.length;
          const confidence = Math.min(1, avgAmplitude * 2); // Confidence based on amplitude
          
          speechSegments.push({
            startTime: currentSegmentStart,
            endTime: point.time,
            duration,
            avgAmplitude,
            confidence
          });
        }
        
        currentSegmentStart = null;
        segmentAmplitudes = [];
      }
    }
    
    // Handle case where segment continues to end of audio
    if (currentSegmentStart !== null && waveformData.length > 0) {
      const lastPoint = waveformData[waveformData.length - 1];
      const duration = lastPoint.time - currentSegmentStart;
      
      if (duration >= this.MIN_SPEECH_DURATION) {
        const avgAmplitude = segmentAmplitudes.reduce((a, b) => a + b, 0) / segmentAmplitudes.length;
        const confidence = Math.min(1, avgAmplitude * 2);
        
        speechSegments.push({
          startTime: currentSegmentStart,
          endTime: lastPoint.time,
          duration,
          avgAmplitude,
          confidence
        });
      }
    }
    
    console.log(`[AudioWaveformAnalyzer] Detected ${speechSegments.length} speech segments`);
    return speechSegments;
  }

  alignWordsToWaveform(
    words: string[], 
    transcriptTiming: { startTime: number; endTime: number },
    waveformData: WaveformDataPoint[]
  ): WordTiming[] {
    console.log(`[AudioWaveformAnalyzer] Aligning ${words.length} words to waveform timing with millisecond precision`);
    
    // Find waveform data points within the transcript timing window with expanded window for precision
    const relevantWaveform = waveformData.filter(
      point => point.time >= (transcriptTiming.startTime - 0.1) && 
                point.time <= (transcriptTiming.endTime + 0.1)
    );
    
    if (relevantWaveform.length === 0) {
      console.warn(`[AudioWaveformAnalyzer] No waveform data for timing window ${transcriptTiming.startTime}-${transcriptTiming.endTime}`);
      return this.fallbackWordTiming(words, transcriptTiming);
    }
    
    // Detect speech onsets and peaks with millisecond precision
    const speechEvents = this.detectSpeechEventsWithPrecision(relevantWaveform);
    const wordTimings: WordTiming[] = [];
    
    // Map each word to speech events for precise timing
    for (let i = 0; i < words.length; i++) {
      const word = words[i];
      const estimatedStart = transcriptTiming.startTime + 
        (i / words.length) * (transcriptTiming.endTime - transcriptTiming.startTime);
      
      // Find the closest speech event to the estimated word start
      const nearestEvent = this.findNearestSpeechEvent(speechEvents, estimatedStart);
      
      let startTime: number;
      let endTime: number;
      let amplitude: number;
      
      if (nearestEvent) {
        // Use precise speech onset timing
        startTime = nearestEvent.time;
        amplitude = nearestEvent.amplitude;
        
        // Calculate word duration based on syllable count and speech rate
        const syllableCount = this.estimateSyllableCount(word);
        const baseWordDuration = syllableCount * 0.15; // 150ms per syllable
        
        // Find next speech event or use calculated duration
        const nextEvent = speechEvents.find(event => 
          event.time > startTime + 0.1 && event.time <= startTime + baseWordDuration + 0.2
        );
        
        if (nextEvent) {
          endTime = nextEvent.time;
        } else {
          endTime = startTime + baseWordDuration;
        }
        
        // Ensure minimum word duration (50ms) and maximum (2 seconds)
        const duration = endTime - startTime;
        if (duration < 0.05) {
          endTime = startTime + 0.05;
        } else if (duration > 2.0) {
          endTime = startTime + 2.0;
        }
        
      } else {
        // Fallback with precise timing calculation
        const avgWordDuration = (transcriptTiming.endTime - transcriptTiming.startTime) / words.length;
        startTime = parseFloat(estimatedStart.toFixed(3)); // Millisecond precision
        endTime = parseFloat((startTime + avgWordDuration).toFixed(3));
        amplitude = relevantWaveform.reduce((sum, p) => sum + p.amplitude, 0) / relevantWaveform.length;
      }
      
      // Apply millisecond precision rounding
      startTime = parseFloat(startTime.toFixed(3));
      endTime = parseFloat(endTime.toFixed(3));
      
      const confidence = Math.min(0.95, 0.7 + (amplitude * 0.25));
      
      console.log(`[AudioWaveformAnalyzer] Word "${word}": ${startTime}s-${endTime}s (${((endTime - startTime) * 1000).toFixed(0)}ms)`);
      
      wordTimings.push({
        word,
        startTime,
        endTime,
        confidence,
        amplitude
      });
    }
    
    console.log(`[AudioWaveformAnalyzer] Aligned ${wordTimings.length} words with millisecond precision`);
    
    // Enhance words with waveform-based colors and speech speed
    return this.enhanceWordsWithWaveformColors(wordTimings, relevantWaveform);
  }

  /**
   * Calculate speech speed and assign waveform colors based on audio characteristics
   */
  private enhanceWordsWithWaveformColors(words: WordTiming[], waveformData: WaveformDataPoint[]): WordTiming[] {
    console.log('[AudioWaveformAnalyzer] Enhancing words with waveform-based colors...');
    
    return words.map(word => {
      const wordDuration = word.endTime - word.startTime;
      const wordLength = word.word.length;
      const charactersPerSecond = wordLength / wordDuration;
      
      // Find amplitude data for this word's time range
      const wordWaveformData = waveformData.filter(
        point => point.time >= word.startTime && point.time <= word.endTime
      );
      
      // Calculate average amplitude for the word
      const avgAmplitude = wordWaveformData.length > 0
        ? wordWaveformData.reduce((sum, point) => sum + point.amplitude, 0) / wordWaveformData.length
        : word.amplitude || 0.5;
      
      // Calculate peak amplitude timing for highlight effects
      let peakAmplitude = 0;
      let peakTime = word.startTime + wordDuration / 2; // Default to middle
      
      wordWaveformData.forEach(point => {
        if (point.amplitude > peakAmplitude) {
          peakAmplitude = point.amplitude;
          peakTime = point.time;
        }
      });
      
      // Determine speech speed based on characters per second and amplitude
      let speechSpeed: 'slow' | 'normal' | 'fast' = 'normal';
      let waveformColor = '#44ff88'; // Green for normal
      
      if (charactersPerSecond > 8 || avgAmplitude > 0.8) {
        speechSpeed = 'fast';
        waveformColor = '#ff4444'; // Red for fast/loud speech
      } else if (charactersPerSecond < 4 || avgAmplitude < 0.3) {
        speechSpeed = 'slow';
        waveformColor = '#4488ff'; // Blue for slow/quiet speech
      }
      
      // Create highlight timing for smooth word animation
      const highlightTiming = {
        onsetTime: word.startTime,
        peakTime: peakTime,
        endTime: word.endTime
      };
      
      return {
        ...word,
        amplitude: avgAmplitude,
        speechSpeed,
        waveformColor,
        highlightTiming
      };
    });
  }

  private findSpeechPeaks(waveformData: WaveformDataPoint[]): WaveformDataPoint[] {
    const peaks: WaveformDataPoint[] = [];
    const minPeakDistance = 0.1; // Minimum 100ms between peaks
    
    for (let i = 1; i < waveformData.length - 1; i++) {
      const current = waveformData[i];
      const prev = waveformData[i - 1];
      const next = waveformData[i + 1];
      
      // Check if this is a local maximum and above threshold
      if (current.amplitude > prev.amplitude && 
          current.amplitude > next.amplitude && 
          current.rms > this.SILENCE_THRESHOLD * 2) {
        
        // Ensure minimum distance from last peak
        const lastPeak = peaks[peaks.length - 1];
        if (!lastPeak || current.time - lastPeak.time >= minPeakDistance) {
          peaks.push(current);
        }
      }
    }
    
    return peaks;
  }

  private detectSpeechEventsWithPrecision(waveformData: WaveformDataPoint[]): WaveformDataPoint[] {
    const events: WaveformDataPoint[] = [];
    const threshold = this.SILENCE_THRESHOLD * 2; // Higher threshold for events
    
    for (let i = 1; i < waveformData.length - 1; i++) {
      const current = waveformData[i];
      const previous = waveformData[i - 1];
      const next = waveformData[i + 1];
      
      // Detect speech onset (silence to speech transition)
      if (previous.rms <= threshold && current.rms > threshold) {
        events.push(current);
      }
      
      // Detect amplitude peaks within speech
      if (current.amplitude > previous.amplitude && current.amplitude > next.amplitude && 
          current.amplitude > threshold * 2) {
        events.push(current);
      }
    }
    
    return events;
  }

  private findNearestSpeechEvent(events: WaveformDataPoint[], targetTime: number): WaveformDataPoint | null {
    if (events.length === 0) return null;
    
    let nearest = events[0];
    let minDistance = Math.abs(events[0].time - targetTime);
    
    for (const event of events) {
      const distance = Math.abs(event.time - targetTime);
      if (distance < minDistance) {
        minDistance = distance;
        nearest = event;
      }
    }
    
    // Only return if within 200ms of target
    return minDistance <= 0.2 ? nearest : null;
  }

  private estimateSyllableCount(word: string): number {
    // Simple syllable estimation based on vowel groups
    const vowels = word.toLowerCase().match(/[aeiouy]+/g);
    return Math.max(1, vowels ? vowels.length : 1);
  }

  private fallbackWordTiming(
    words: string[], 
    transcriptTiming: { startTime: number; endTime: number }
  ): WordTiming[] {
    console.log(`[AudioWaveformAnalyzer] Using fallback timing for ${words.length} words`);
    
    const totalDuration = transcriptTiming.endTime - transcriptTiming.startTime;
    const avgWordDuration = totalDuration / words.length;
    
    return words.map((word, index) => ({
      word,
      startTime: transcriptTiming.startTime + (index * avgWordDuration),
      endTime: transcriptTiming.startTime + ((index + 1) * avgWordDuration),
      confidence: 0.7, // Lower confidence for fallback timing
      amplitude: 0.5
    }));
  }

  async analyzeWordLevelTiming(
    audioPath: string,
    transcriptSegments: Array<{ text: string; startTime: number; endTime: number }>
  ): Promise<Array<{ text: string; startTime: number; endTime: number; words: WordTiming[] }>> {
    console.log(`[AudioWaveformAnalyzer] Analyzing word-level timing for ${transcriptSegments.length} segments`);
    
    // Extract full waveform
    const waveformData = await this.analyzeAudioWaveform(audioPath);
    
    // Process each segment
    const enhancedSegments = transcriptSegments.map(segment => {
      const words = segment.text.split(/\s+/).filter(word => word.length > 0);
      const wordTimings = this.alignWordsToWaveform(
        words,
        { startTime: segment.startTime, endTime: segment.endTime },
        waveformData
      );
      
      return {
        ...segment,
        words: wordTimings
      };
    });
    
    console.log(`[AudioWaveformAnalyzer] Enhanced ${enhancedSegments.length} segments with word-level timing`);
    return enhancedSegments;
  }
}

export const audioWaveformAnalyzer = new AudioWaveformAnalyzer();