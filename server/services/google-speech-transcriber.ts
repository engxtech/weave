import * as fs from 'fs';
import * as path from 'path';
import { execSync } from 'child_process';
import { AudioWaveformAnalyzer, WordTiming } from './audio-waveform-analyzer';

interface TranscriptionChunk {
  startTime: number;
  endTime: number;
  text: string;
  confidence: number;
}

interface TranscriptionResult {
  segments: TranscriptionChunk[];
  language: string;
  totalDuration: number;
  fullTranscript: string;
}

export class GoogleSpeechTranscriber {
  private tempDir: string;
  private waveformAnalyzer: AudioWaveformAnalyzer;

  constructor() {
    this.tempDir = path.join(process.cwd(), 'temp_transcription');
    if (!fs.existsSync(this.tempDir)) {
      fs.mkdirSync(this.tempDir, { recursive: true });
    }
    this.waveformAnalyzer = new AudioWaveformAnalyzer();
  }

  async transcribeMedia(mediaPath: string): Promise<TranscriptionResult> {
    console.log(`[GoogleSpeechTranscriber] ===== STARTING 7-STEP GOOGLE SPEECH API WORKFLOW =====`);
    console.log(`[GoogleSpeechTranscriber] Input media file: ${mediaPath}`);
    
    try {
      // STEP 1: Convert media file to WAV
      console.log(`[GoogleSpeechTranscriber] STEP 1: Converting media to WAV format`);
      const wavPath = await this.convertToWAV(mediaPath);
      console.log(`[GoogleSpeechTranscriber] ✓ Converted to WAV: ${wavPath}`);
      
      const duration = await this.getAudioDuration(wavPath);
      console.log(`[GoogleSpeechTranscriber] ✓ Audio duration: ${duration}s`);
      
      // STEP 2-4: Transcribe in 30-second chunks and concatenate for full transcript  
      console.log(`[GoogleSpeechTranscriber] STEP 2-4: Transcribing in 30-second chunks for full transcript`);
      const fullTranscript = await this.transcribeIn30SecondChunks(wavPath, duration);
      console.log(`[GoogleSpeechTranscriber] ✓ Full transcript obtained: "${fullTranscript.substring(0, 50)}..."`);
      
      // STEP 5: Split WAV at silence points (< -20dB, >0.2s)
      console.log(`[GoogleSpeechTranscriber] STEP 5: Detecting silence segments (-20dB threshold, 0.2s minimum)`);
      const silenceSegments = await this.detectSilenceSegments(wavPath);
      console.log(`[GoogleSpeechTranscriber] ✓ Detected ${silenceSegments.length} silence-based segments`);
      
      // STEP 5.1-5.2: Apply segment processing rules
      console.log(`[GoogleSpeechTranscriber] STEP 5.1-5.2: Processing segments (4s chunks if no silence, split >8s segments)`);
      const processedSegments = await this.processSegments(silenceSegments, duration);
      console.log(`[GoogleSpeechTranscriber] ✓ Processed to ${processedSegments.length} final segments`);
      
      // STEP 6: Transcribe each segment with full transcript as phrase context
      console.log(`[GoogleSpeechTranscriber] STEP 6: Transcribing individual segments with phrase context`);
      const transcriptionChunks = await this.transcribeChunksWithContext(
        wavPath,
        processedSegments,
        fullTranscript
      );
      console.log(`[GoogleSpeechTranscriber] ✓ Individual segment transcriptions complete`);
      
      // STEP 7: Group original segments into 5-10 word chunks (preserve content, optimize length)
      console.log(`[GoogleSpeechTranscriber] STEP 7: Grouping segments into optimal 5-10 word chunks`);
      const sentenceGroupedSegments = this.groupIntoOptimalWordChunks(transcriptionChunks);
      console.log(`[GoogleSpeechTranscriber] ✓ Grouped ${transcriptionChunks.length} segments into ${sentenceGroupedSegments.length} optimal word chunks (5-10 words each)`);
      
      // ENHANCED STEP: Add waveform analysis for word-level coloring
      console.log(`[GoogleSpeechTranscriber] ENHANCED STEP: Adding waveform analysis for speech speed coloring`);
      const enhancedSegments = await this.enhanceSegmentsWithWaveformData(sentenceGroupedSegments, wavPath);
      console.log(`[GoogleSpeechTranscriber] ✓ Enhanced ${enhancedSegments.length} segments with waveform-based speech speed and color data`);
      
      // STEP 8: Return data to client
      console.log(`[GoogleSpeechTranscriber] STEP 8: Returning transcription data to client`);
      this.cleanup(wavPath);
      
      const result: TranscriptionResult = {
        segments: enhancedSegments,
        language: 'auto',
        totalDuration: duration,
        fullTranscript: fullTranscript
      };
      
      console.log(`[GoogleSpeechTranscriber] ===== 8-STEP WORKFLOW COMPLETE =====`);
      console.log(`[GoogleSpeechTranscriber] Generated ${result.segments.length} sentence-based segments from ${duration}s audio`);
      
      return result;
      
    } catch (error) {
      console.error('[GoogleSpeechTranscriber] Error:', error);
      throw error;
    }
  }

  private async convertToWAV(mediaPath: string): Promise<string> {
    const wavPath = path.join(this.tempDir, `${Date.now()}_converted.wav`);
    
    try {
      const command = `ffmpeg -i "${mediaPath}" -acodec pcm_s16le -ar 16000 -ac 1 "${wavPath}" -y`;
      execSync(command, { stdio: 'pipe' });
      
      if (!fs.existsSync(wavPath)) {
        throw new Error('WAV conversion failed');
      }
      
      console.log(`[GoogleSpeechTranscriber] Converted to WAV: ${wavPath}`);
      return wavPath;
    } catch (error) {
      console.error('[GoogleSpeechTranscriber] WAV conversion error:', error);
      throw error;
    }
  }

  private async getAudioDuration(wavPath: string): Promise<number> {
    try {
      const command = `ffprobe -v quiet -show_entries format=duration -of csv=p=0 "${wavPath}"`;
      const result = execSync(command, { encoding: 'utf8' });
      return parseFloat(result.trim());
    } catch (error) {
      console.error('[GoogleSpeechTranscriber] Duration detection error:', error);
      return 30; // Default fallback
    }
  }

  private async transcribeIn30SecondChunks(wavPath: string, totalDuration: number): Promise<string> {
    const chunks: string[] = [];
    const chunkDuration = 30;
    
    for (let start = 0; start < totalDuration; start += chunkDuration) {
      const end = Math.min(start + chunkDuration, totalDuration);
      const chunkPath = path.join(this.tempDir, `chunk_${start}_${end}.wav`);
      
      try {
        // Extract 30-second chunk
        const command = `ffmpeg -ss ${start} -t ${end - start} -i "${wavPath}" "${chunkPath}" -y`;
        execSync(command, { stdio: 'pipe' });
        
        // Transcribe chunk with Google Speech API
        const chunkText = await this.transcribeWithGoogleSpeech(chunkPath);
        chunks.push(chunkText);
        
        // Cleanup chunk file
        fs.unlinkSync(chunkPath);
        
      } catch (error) {
        console.error(`[GoogleSpeechTranscriber] Chunk ${start}-${end} error:`, error);
        chunks.push(''); // Add empty for failed chunks
      }
    }
    
    return chunks.join(' ').trim();
  }

  private async detectSilenceSegments(wavPath: string): Promise<Array<{start: number, end: number}>> {
    try {
      // Detect silence points using FFmpeg
      const command = `ffmpeg -i "${wavPath}" -af silencedetect=noise=-20dB:d=0.2 -f null - 2>&1`;
      const output = execSync(command, { encoding: 'utf8' });
      
      const silencePattern = /silence_start: ([\d.]+)|silence_end: ([\d.]+)/g;
      const silencePoints: number[] = [];
      let match;
      
      while ((match = silencePattern.exec(output)) !== null) {
        if (match[1]) silencePoints.push(parseFloat(match[1])); // start
        if (match[2]) silencePoints.push(parseFloat(match[2])); // end
      }
      
      // Convert silence points to speech segments
      const segments: Array<{start: number, end: number}> = [];
      
      if (silencePoints.length === 0) {
        // No silences detected - use 4-second chunks
        const duration = await this.getAudioDuration(wavPath);
        for (let start = 0; start < duration; start += 4) {
          segments.push({
            start: start,
            end: Math.min(start + 4, duration)
          });
        }
      } else {
        // Create segments between silence points
        let lastEnd = 0;
        for (let i = 0; i < silencePoints.length; i += 2) {
          if (i + 1 < silencePoints.length) {
            const silenceStart = silencePoints[i];
            const silenceEnd = silencePoints[i + 1];
            
            if (silenceStart > lastEnd) {
              segments.push({
                start: lastEnd,
                end: silenceStart
              });
            }
            lastEnd = silenceEnd;
          }
        }
        
        // Add final segment
        const duration = await this.getAudioDuration(wavPath);
        if (lastEnd < duration) {
          segments.push({
            start: lastEnd,
            end: duration
          });
        }
      }
      
      return segments;
      
    } catch (error) {
      console.error('[GoogleSpeechTranscriber] Silence detection error:', error);
      // Fallback to 4-second chunks
      const duration = await this.getAudioDuration(wavPath);
      const segments: Array<{start: number, end: number}> = [];
      for (let start = 0; start < duration; start += 4) {
        segments.push({
          start: start,
          end: Math.min(start + 4, duration)
        });
      }
      return segments;
    }
  }

  private async processSegments(segments: Array<{start: number, end: number}>, totalDuration: number): Promise<Array<{start: number, end: number}>> {
    console.log(`[GoogleSpeechTranscriber] Processing ${segments.length} silence-based segments according to specification`);
    
    if (segments.length === 0) return [];
    
    // Sort segments by start time to ensure proper order
    const sortedSegments = segments.sort((a, b) => a.start - b.start);
    
    // Step 5.2: If time between silences (a clip) is longer than 8 seconds, divide into 4-second chunks
    const processedSegments: Array<{start: number, end: number}> = [];
    
    for (const segment of sortedSegments) {
      const duration = segment.end - segment.start;
      
      if (duration > 8) {
        // Split long segments into 4-second chunks as per specification
        console.log(`[GoogleSpeechTranscriber] Segment ${segment.start.toFixed(2)}-${segment.end.toFixed(2)} (${duration.toFixed(2)}s) > 8s, splitting into 4s chunks`);
        
        for (let start = segment.start; start < segment.end; start += 4) {
          const end = Math.min(start + 4, segment.end);
          processedSegments.push({
            start: start,
            end: end
          });
          console.log(`  → Chunk: ${start.toFixed(2)}-${end.toFixed(2)} (${(end - start).toFixed(2)}s)`);
        }
      } else {
        // Keep segments ≤8 seconds as-is
        processedSegments.push(segment);
        console.log(`[GoogleSpeechTranscriber] Keeping segment ${segment.start.toFixed(2)}-${segment.end.toFixed(2)} (${duration.toFixed(2)}s) as-is`);
      }
    }
    
    console.log(`[GoogleSpeechTranscriber] Final processed segments: ${processedSegments.length}`);
    processedSegments.forEach((seg, i) => {
      console.log(`  Segment ${i}: ${seg.start.toFixed(2)}s - ${seg.end.toFixed(2)}s (${(seg.end - seg.start).toFixed(2)}s)`);
    });
    
    return processedSegments;
  }

  private async transcribeChunksWithContext(
    wavPath: string,
    segments: Array<{start: number, end: number}>,
    fullTranscript: string
  ): Promise<TranscriptionChunk[]> {
    const transcriptionChunks: TranscriptionChunk[] = [];
    
    for (let i = 0; i < segments.length; i++) {
      const segment = segments[i];
      const chunkPath = path.join(this.tempDir, `segment_${i}_${segment.start}_${segment.end}.wav`);
      
      try {
        // Extract segment-specific audio
        const segmentDuration = segment.end - segment.start;
        const command = `ffmpeg -ss ${segment.start} -t ${segmentDuration} -i "${wavPath}" "${chunkPath}" -y`;
        execSync(command, { stdio: 'pipe' });
        
        // Verify segment file was created and get its actual duration
        const actualDuration = parseFloat(execSync(`ffprobe -v quiet -show_entries format=duration -of csv=p=0 "${chunkPath}"`, { encoding: 'utf8' }).trim());
        console.log(`[GoogleSpeechTranscriber] Segment ${i}: ${segment.start.toFixed(2)}-${segment.end.toFixed(2)}s (${segmentDuration.toFixed(2)}s) → actual: ${actualDuration.toFixed(2)}s`);
        
        // Transcribe this specific segment with full transcript as context
        const chunkText = await this.transcribeWithGoogleSpeech(chunkPath, fullTranscript);
        
        transcriptionChunks.push({
          startTime: segment.start,
          endTime: segment.end,
          text: chunkText,
          confidence: 0.95 // Default confidence
        });
        
        // Cleanup chunk file
        fs.unlinkSync(chunkPath);
        
      } catch (error) {
        console.error(`[GoogleSpeechTranscriber] Segment ${i} error:`, error);
        // Add placeholder for failed segments
        transcriptionChunks.push({
          startTime: segment.start,
          endTime: segment.end,
          text: '',
          confidence: 0.0
        });
      }
    }
    
    return transcriptionChunks;
  }

  private async transcribeWithGoogleSpeech(audioPath: string, phraseContext?: string): Promise<string> {
    try {
      // Import Google Speech API
      const { GoogleGenAI } = await import('@google/genai');
      
      if (!process.env.GEMINI_API_KEY) {
        throw new Error('GEMINI_API_KEY not found in environment variables');
      }

      const genAI = new GoogleGenAI({ apiKey: process.env.GEMINI_API_KEY });
      
      // Read audio file as base64
      const audioBuffer = fs.readFileSync(audioPath);
      const audioBase64 = audioBuffer.toString('base64');
      
      // Get segment duration for context
      const duration = parseFloat(execSync(`ffprobe -v quiet -show_entries format=duration -of csv=p=0 "${audioPath}"`, { encoding: 'utf8' }).trim());
      
      // Prepare prompt with phrase context for better accuracy
      let prompt = `Transcribe this ${duration.toFixed(1)}s audio segment accurately. Return only the spoken text without any additional formatting or explanation.`;
      
      if (phraseContext) {
        prompt += ` Context (from full video): "${phraseContext}". Focus on transcribing only what is spoken in THIS specific audio segment.`;
      }

      const response = await genAI.models.generateContent({
        model: 'gemini-2.0-flash-exp',
        contents: [
          {
            role: 'user',
            parts: [
              { text: prompt },
              {
                inlineData: {
                  data: audioBase64,
                  mimeType: 'audio/wav'
                }
              }
            ]
          }
        ],
        config: {
          temperature: 0.1, // Low temperature for consistent transcription
          maxOutputTokens: 100
        }
      });

      const transcription = response.text?.trim() || '';
      console.log(`[GoogleSpeechTranscriber] Segment transcription: "${transcription}" (${duration.toFixed(1)}s) from ${audioPath}`);
      
      // Validate that we got actual segment-specific content
      if (transcription && phraseContext && transcription.length > phraseContext.length * 0.8) {
        console.log(`[GoogleSpeechTranscriber] WARNING: Transcription seems too long for segment duration (${duration.toFixed(1)}s)`);
      }
      
      return transcription;
      
    } catch (error) {
      console.error('[GoogleSpeechTranscriber] Google Speech API error:', error);
      
      // Return empty string for failed transcriptions - do not use phrase context as fake transcription
      console.log(`[GoogleSpeechTranscriber] Failed to transcribe segment ${audioPath}, returning empty string`);
      return '';
    }
  }

  private async groupSegmentsIntoSentences(
    segments: Array<{startTime: number, endTime: number, text: string, confidence: number}>,
    fullTranscript: string
  ): Promise<Array<{startTime: number, endTime: number, text: string, confidence: number}>> {
    
    if (segments.length === 0) return [];
    
    try {
      // Import Google Speech API for sentence analysis
      const { GoogleGenAI } = await import('@google/genai');
      
      if (!process.env.GEMINI_API_KEY) {
        console.log('[GoogleSpeechTranscriber] No Gemini API key, using basic sentence grouping');
        return this.basicSentenceGrouping(segments);
      }

      const genAI = new GoogleGenAI({ apiKey: process.env.GEMINI_API_KEY });
      
      // Create segment text summary for AI analysis
      const segmentSummary = segments.map((seg, i) => 
        `[${i}] ${seg.startTime.toFixed(2)}-${seg.endTime.toFixed(2)}s: "${seg.text}"`
      ).join('\n');
      
      const prompt = `Analyze these timed transcript segments and group them into logical sentences for optimal subtitle readability.

Segments:
${segmentSummary}

Rules:
1. Group segments that form complete sentences or logical thoughts
2. Keep each sentence caption between 2-8 seconds for readability  
3. Don't split mid-sentence unless necessary for timing
4. Maintain chronological order
5. Aim for 3-15 words per caption group

Return JSON array of grouped segments:
[
  {
    "startTime": 0.31,
    "endTime": 3.86,
    "text": "Find a teenager in India and ask this: who gave India independence?",
    "segmentIds": [0, 1, 2]
  }
]`;

      const response = await genAI.models.generateContent({
        model: 'gemini-2.0-flash-exp',
        contents: [{ role: 'user', parts: [{ text: prompt }] }],
        config: {
          temperature: 0.1,
          maxOutputTokens: 2000,
          responseMimeType: 'application/json'
        }
      });

      const responseText = response.text?.trim();
      if (responseText) {
        const groupedSegments = JSON.parse(responseText);
        
        // Validate and process the grouped segments
        const processedGroups = groupedSegments.map((group: any, index: number) => ({
          startTime: group.startTime,
          endTime: group.endTime,
          text: group.text,
          confidence: 0.95 // High confidence for grouped segments
        }));

        console.log(`[GoogleSpeechTranscriber] AI sentence grouping: ${segments.length} → ${processedGroups.length} sentence-based captions`);
        return processedGroups;
      }
      
    } catch (error) {
      console.error('[GoogleSpeechTranscriber] AI sentence grouping error:', error);
    }
    
    // Fallback to basic grouping
    return this.basicSentenceGrouping(segments);
  }

  private groupIntoOptimalWordChunks(
    segments: Array<{startTime: number, endTime: number, text: string, confidence: number}>
  ): Array<{startTime: number, endTime: number, text: string, confidence: number}> {
    
    if (segments.length === 0) return [];
    
    const grouped: Array<{startTime: number, endTime: number, text: string, confidence: number}> = [];
    let currentGroup: Array<{startTime: number, endTime: number, text: string, confidence: number}> = [];
    let currentWordCount = 0;
    
    for (let i = 0; i < segments.length; i++) {
      const segment = segments[i];
      const segmentWords = segment.text.trim().split(/\s+/).filter(word => word.length > 0);
      const segmentWordCount = segmentWords.length;
      
      // Check if adding this segment would exceed optimal range
      const wouldExceedOptimal = (currentWordCount + segmentWordCount) > 10;
      const hasMinimumWords = currentWordCount >= 5;
      
      // If we have minimum words and adding would exceed optimal, or we're at maximum
      if (currentGroup.length > 0 && wouldExceedOptimal && hasMinimumWords) {
        // Create group from current segments
        const groupStartTime = currentGroup[0].startTime;
        const groupEndTime = currentGroup[currentGroup.length - 1].endTime;
        const groupText = currentGroup.map(seg => seg.text.trim()).join(' ').trim();
        const avgConfidence = currentGroup.reduce((sum, seg) => sum + seg.confidence, 0) / currentGroup.length;
        
        grouped.push({
          startTime: groupStartTime,
          endTime: groupEndTime,
          text: groupText,
          confidence: avgConfidence
        });
        
        // Start new group with current segment
        currentGroup = [segment];
        currentWordCount = segmentWordCount;
      } else {
        // Add segment to current group
        currentGroup.push(segment);
        currentWordCount += segmentWordCount;
        
        // If we reach exactly 10 words, complete the group
        if (currentWordCount >= 10) {
          const groupStartTime = currentGroup[0].startTime;
          const groupEndTime = currentGroup[currentGroup.length - 1].endTime;
          const groupText = currentGroup.map(seg => seg.text.trim()).join(' ').trim();
          const avgConfidence = currentGroup.reduce((sum, seg) => sum + seg.confidence, 0) / currentGroup.length;
          
          grouped.push({
            startTime: groupStartTime,
            endTime: groupEndTime,
            text: groupText,
            confidence: avgConfidence
          });
          
          currentGroup = [];
          currentWordCount = 0;
        }
      }
      
      // Handle last segment
      if (i === segments.length - 1 && currentGroup.length > 0) {
        const groupStartTime = currentGroup[0].startTime;
        const groupEndTime = currentGroup[currentGroup.length - 1].endTime;
        const groupText = currentGroup.map(seg => seg.text.trim()).join(' ').trim();
        const avgConfidence = currentGroup.reduce((sum, seg) => sum + seg.confidence, 0) / currentGroup.length;
        
        grouped.push({
          startTime: groupStartTime,
          endTime: groupEndTime,
          text: groupText,
          confidence: avgConfidence
        });
      }
    }
    
    console.log(`[GoogleSpeechTranscriber] Optimal word grouping: ${segments.length} → ${grouped.length} chunks (5-10 words each)`);
    return grouped;
  }

  private basicSentenceGrouping(
    segments: Array<{startTime: number, endTime: number, text: string, confidence: number}>
  ): Array<{startTime: number, endTime: number, text: string, confidence: number}> {
    
    const grouped: Array<{startTime: number, endTime: number, text: string, confidence: number}> = [];
    let currentGroup: Array<{startTime: number, endTime: number, text: string, confidence: number}> = [];
    
    for (let i = 0; i < segments.length; i++) {
      const segment = segments[i];
      currentGroup.push(segment);
      
      // Check if we should end the current group
      const shouldEndGroup = 
        // If text ends with sentence punctuation
        /[.!?]$/.test(segment.text.trim()) ||
        // If current group duration > 6 seconds
        (currentGroup.length > 0 && 
         (segment.endTime - currentGroup[0].startTime) > 6) ||
        // If gap to next segment > 1 second
        (i < segments.length - 1 && 
         segments[i + 1].startTime - segment.endTime > 1) ||
        // If current group has > 12 words
        currentGroup.reduce((words, seg) => words + seg.text.split(' ').length, 0) > 12;
      
      if (shouldEndGroup || i === segments.length - 1) {
        // Create grouped segment
        const groupStartTime = currentGroup[0].startTime;
        const groupEndTime = currentGroup[currentGroup.length - 1].endTime;
        const groupText = currentGroup.map(seg => seg.text).join(' ').trim();
        const avgConfidence = currentGroup.reduce((sum, seg) => sum + seg.confidence, 0) / currentGroup.length;
        
        grouped.push({
          startTime: groupStartTime,
          endTime: groupEndTime,
          text: groupText,
          confidence: avgConfidence
        });
        
        currentGroup = [];
      }
    }
    
    console.log(`[GoogleSpeechTranscriber] Basic sentence grouping: ${segments.length} → ${grouped.length} sentence-based captions`);
    return grouped;
  }

  /**
   * Enhance caption segments with waveform analysis data for speech speed coloring
   */
  private async enhanceSegmentsWithWaveformData(
    segments: Array<{startTime: number, endTime: number, text: string, confidence: number}>,
    wavPath: string
  ): Promise<Array<{startTime: number, endTime: number, text: string, confidence: number, words?: any[]}>> {
    
    console.log('[GoogleSpeechTranscriber] Starting waveform analysis for speech speed coloring...');
    
    try {
      // Extract waveform data from the audio file
      const waveformData = await this.waveformAnalyzer.extractWaveformData(wavPath);
      console.log(`[GoogleSpeechTranscriber] Extracted ${waveformData.length} waveform data points`);
      
      // Enhance each segment with word-level waveform analysis
      const enhancedSegments = segments.map(segment => {
        const words = segment.text.split(' ').filter(word => word.trim().length > 0);
        const segmentDuration = segment.endTime - segment.startTime;
        
        // Create word timing data for waveform analysis
        const wordTimings: WordTiming[] = words.map((word, index) => {
          const wordStartTime = segment.startTime + (index / words.length) * segmentDuration;
          const wordEndTime = segment.startTime + ((index + 1) / words.length) * segmentDuration;
          
          return {
            word,
            startTime: wordStartTime,
            endTime: wordEndTime,
            confidence: segment.confidence,
            amplitude: 0.5 // Will be enhanced by waveform analyzer
          };
        });
        
        // Enhance words with waveform data including speech speed and colors
        const enhancedWordTimings = this.waveformAnalyzer.alignWordsToWaveform(
          words,
          { startTime: segment.startTime, endTime: segment.endTime },
          waveformData
        );
        
        // Convert enhanced word timings to the format expected by the frontend
        const enhancedWords = enhancedWordTimings.map(wordTiming => ({
          word: wordTiming.word,
          startTime: wordTiming.startTime,
          endTime: wordTiming.endTime,
          confidence: wordTiming.confidence,
          amplitude: wordTiming.amplitude,
          speechSpeed: wordTiming.speechSpeed,
          waveformColor: wordTiming.waveformColor,
          highlightTiming: wordTiming.highlightTiming
        }));
        
        console.log(`[GoogleSpeechTranscriber] Enhanced segment "${segment.text.substring(0, 30)}..." with ${enhancedWords.length} colored words`);
        
        return {
          ...segment,
          words: enhancedWords
        };
      });
      
      console.log(`[GoogleSpeechTranscriber] Enhanced ${enhancedSegments.length} segments with waveform-based speech speed coloring`);
      return enhancedSegments;
      
    } catch (error) {
      console.error('[GoogleSpeechTranscriber] Waveform enhancement error:', error);
      // Return original segments if waveform analysis fails
      return segments.map(segment => ({ ...segment, words: [] }));
    }
  }

  private cleanup(wavPath: string): void {
    try {
      if (fs.existsSync(wavPath)) {
        fs.unlinkSync(wavPath);
      }
    } catch (error) {
      console.error('[GoogleSpeechTranscriber] Cleanup error:', error);
    }
  }
}