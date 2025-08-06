import { spawn } from 'child_process';
import * as fs from 'fs';
import * as path from 'path';
import { GoogleGenAI } from '@google/genai';

// Initialize Gemini AI
const ai = new GoogleGenAI({ apiKey: process.env.GEMINI_API_KEY || "" });

interface WordTimestamp {
  word: string;
  start_time: number;
  end_time: number;
}

interface SubtitleBlock {
  index: number;
  start_time: number;
  end_time: number;
  text: string;
  words: WordTimestamp[];
}

interface SubtitleSegment {
  id: string;
  startTime: number;
  endTime: number;
  duration: number;
  text: string;
  confidence: number;
  words: WordTimestamp[];
  x: number;
  y: number;
  fontSize: number;
  color: string;
  style: string;
  animation: string;
  background: string;
  borderRadius: number;
  opacity: number;
}

export class WordLevelSubtitleGenerator {
  private tempDir: string;

  constructor() {
    this.tempDir = path.join(process.cwd(), 'temp_audio');
    if (!fs.existsSync(this.tempDir)) {
      fs.mkdirSync(this.tempDir, { recursive: true });
    }
  }

  /**
   * Step 1: Audio Extraction with FFmpeg
   * Extract high-quality audio from video for precise word-level timing
   */
  private async extractAudioWithFFmpeg(videoPath: string): Promise<string> {
    return new Promise((resolve, reject) => {
      const audioOutputPath = path.join(this.tempDir, `extracted_${Date.now()}.wav`);
      
      console.log('[WordLevel] Step 1: Extracting audio with FFmpeg...');
      
      const ffmpegArgs = [
        '-i', videoPath,
        '-vn', // No video
        '-acodec', 'pcm_s16le', // High quality PCM audio
        '-ar', '48000', // 48kHz sample rate for professional timing
        '-ac', '1', // Mono channel
        '-y', // Overwrite output
        audioOutputPath
      ];

      const ffmpeg = spawn('ffmpeg', ffmpegArgs);
      
      ffmpeg.stderr.on('data', (data) => {
        // Log FFmpeg progress but don't spam console
        const message = data.toString();
        if (message.includes('time=')) {
          process.stdout.write('.');
        }
      });

      ffmpeg.on('close', (code) => {
        if (code === 0) {
          console.log(`\n[WordLevel] Audio extracted successfully: ${audioOutputPath}`);
          resolve(audioOutputPath);
        } else {
          reject(new Error(`FFmpeg failed with code ${code}`));
        }
      });

      ffmpeg.on('error', (error) => {
        reject(error);
      });
    });
  }

  /**
   * Step 2: The AI Core - Transcription with Word-Level Timestamps via Gemini
   * Use Gemini's multimodal capabilities to get precise word-level timing
   */
  private async transcribeWithWordTimestamps(audioPath: string): Promise<WordTimestamp[]> {
    try {
      console.log('[WordLevel] Step 2: Transcribing with Gemini for word-level timestamps...');
      
      // Read audio file as base64
      const audioBytes = fs.readFileSync(audioPath);
      const audioBase64 = audioBytes.toString('base64');

      // Craft the perfect prompt for word-level transcription
      const prompt = `Transcribe the following audio file with precise word-level timestamps. 

CRITICAL REQUIREMENTS:
1. Listen to the provided audio file carefully
2. Transcribe the audio word-for-word with exact timing
3. Return ONLY a JSON array, no other text or explanation
4. Each item must be an object with these exact keys: "word", "start_time", "end_time"
5. Times must be in seconds with decimal precision (e.g., 1.234)
6. Include ALL words spoken, even small words like "the", "a", "um"
7. Account for natural speech patterns, pauses, and pronunciation

Example format:
[
  {"word": "Hello", "start_time": 0.0, "end_time": 0.5},
  {"word": "world", "start_time": 0.6, "end_time": 1.2}
]

Transcribe this audio with word-level precision:`;

      const response = await ai.models.generateContent({
        model: "gemini-2.0-flash-exp",
        contents: [
          {
            inlineData: {
              data: audioBase64,
              mimeType: "audio/wav"
            }
          },
          prompt
        ],
        config: {
          responseMimeType: "application/json"
        }
      });

      const transcriptionText = response.text;
      console.log('[WordLevel] Raw Gemini response length:', transcriptionText?.length || 0);

      if (!transcriptionText) {
        throw new Error('No transcription received from Gemini');
      }

      // Parse the JSON response
      let wordTimestamps: WordTimestamp[];
      try {
        // Clean the response and extract JSON
        const cleanedResponse = transcriptionText
          .replace(/```json\n?/g, '')
          .replace(/```\n?/g, '')
          .trim();
        
        wordTimestamps = JSON.parse(cleanedResponse);
        
        if (!Array.isArray(wordTimestamps)) {
          throw new Error('Response is not an array');
        }

        console.log(`[WordLevel] Parsed ${wordTimestamps.length} word timestamps`);
        return wordTimestamps;

      } catch (parseError) {
        console.error('[WordLevel] JSON parsing failed:', parseError);
        console.log('[WordLevel] Raw response:', transcriptionText.substring(0, 500));
        
        // Fallback: try to extract JSON from the response
        const jsonMatch = transcriptionText.match(/\[[\s\S]*\]/);
        if (jsonMatch) {
          try {
            wordTimestamps = JSON.parse(jsonMatch[0]);
            console.log(`[WordLevel] Fallback parsing successful: ${wordTimestamps.length} words`);
            return wordTimestamps;
          } catch (fallbackError) {
            console.error('[WordLevel] Fallback parsing also failed:', fallbackError);
          }
        }
        
        throw new Error('Failed to parse word-level timestamps from Gemini response');
      }

    } catch (error) {
      console.error('[WordLevel] Transcription error:', error);
      throw error;
    }
  }

  /**
   * Step 3: Grouping Words into Readable Subtitle Blocks
   * Create optimal subtitle blocks for readability while preserving word-level data
   */
  private groupWordsIntoSubtitleBlocks(words: WordTimestamp[]): SubtitleBlock[] {
    console.log('[WordLevel] Step 3: Grouping words into readable subtitle blocks...');
    
    const blocks: SubtitleBlock[] = [];
    let currentBlock: WordTimestamp[] = [];
    let blockStartTime = 0;
    let blockIndex = 1;

    const MAX_WORDS_PER_BLOCK = 6; // Optimal for readability
    const MAX_BLOCK_DURATION = 3.0; // Seconds
    const MIN_BLOCK_DURATION = 0.8; // Minimum visibility time

    for (let i = 0; i < words.length; i++) {
      const word = words[i];
      
      // Start new block if this is the first word
      if (currentBlock.length === 0) {
        blockStartTime = word.start_time;
        currentBlock = [word];
        continue;
      }

      const blockDuration = word.end_time - blockStartTime;
      const shouldCreateNewBlock = 
        currentBlock.length >= MAX_WORDS_PER_BLOCK ||
        blockDuration > MAX_BLOCK_DURATION ||
        (word.start_time - currentBlock[currentBlock.length - 1].end_time > 1.0); // Long pause

      if (shouldCreateNewBlock) {
        // Finalize current block
        const blockEndTime = Math.max(
          currentBlock[currentBlock.length - 1].end_time,
          blockStartTime + MIN_BLOCK_DURATION
        );
        
        blocks.push({
          index: blockIndex++,
          start_time: blockStartTime,
          end_time: blockEndTime,
          text: currentBlock.map(w => w.word).join(' '),
          words: [...currentBlock]
        });

        // Start new block
        blockStartTime = word.start_time;
        currentBlock = [word];
      } else {
        currentBlock.push(word);
      }
    }

    // Handle final block
    if (currentBlock.length > 0) {
      const blockEndTime = Math.max(
        currentBlock[currentBlock.length - 1].end_time,
        blockStartTime + MIN_BLOCK_DURATION
      );
      
      blocks.push({
        index: blockIndex,
        start_time: blockStartTime,
        end_time: blockEndTime,
        text: currentBlock.map(w => w.word).join(' '),
        words: [...currentBlock]
      });
    }

    console.log(`[WordLevel] Created ${blocks.length} subtitle blocks from ${words.length} words`);
    return blocks;
  }

  /**
   * Step 4: Creating the .srt Subtitle File
   * Generate standard SRT format with precise timing
   */
  private generateSRTContent(blocks: SubtitleBlock[]): string {
    console.log('[WordLevel] Step 4: Creating SRT subtitle content...');
    
    const formatTime = (seconds: number): string => {
      const hours = Math.floor(seconds / 3600);
      const minutes = Math.floor((seconds % 3600) / 60);
      const secs = Math.floor(seconds % 60);
      const ms = Math.floor((seconds % 1) * 1000);
      
      return `${hours.toString().padStart(2, '0')}:${minutes.toString().padStart(2, '0')}:${secs.toString().padStart(2, '0')},${ms.toString().padStart(3, '0')}`;
    };

    let srtContent = '';
    
    blocks.forEach((block) => {
      srtContent += `${block.index}\n`;
      srtContent += `${formatTime(block.start_time)} --> ${formatTime(block.end_time)}\n`;
      srtContent += `${block.text}\n\n`;
    });

    return srtContent;
  }

  /**
   * Step 5: Converting to Video Editing Tool Format
   * Create segments compatible with the timeline editor
   */
  private convertToTimelineSegments(blocks: SubtitleBlock[]): SubtitleSegment[] {
    console.log('[WordLevel] Step 5: Converting to timeline editor format...');
    
    // Use standard white text for all video captions

    return blocks.map((block, index) => ({
      id: `word_level_${Date.now()}_${index}`,
      startTime: block.start_time,
      endTime: block.end_time,
      duration: block.end_time - block.start_time,
      text: block.text,
      confidence: 0.95, // High confidence for word-level timing
      words: block.words,
      x: 50, // Center horizontally
      y: 85, // Bottom of screen
      fontSize: 24,
      color: '#FFFFFF', // Standard white text for all video captions
      style: 'bold',
      animation: 'fade-in',
      background: 'rgba(0, 0, 0, 0.8)',
      borderRadius: 8,
      opacity: 1
    }));
  }

  /**
   * Main method: Generate word-level subtitles for video
   */
  async generateWordLevelSubtitles(videoPath: string): Promise<{
    segments: SubtitleSegment[];
    srtContent: string;
    wordCount: number;
    totalDuration: number;
  }> {
    try {
      console.log('[WordLevel] Starting word-level subtitle generation...');
      
      // Step 1: Extract audio
      const audioPath = await this.extractAudioWithFFmpeg(videoPath);
      
      // Step 2: Get word-level timestamps
      const wordTimestamps = await this.transcribeWithWordTimestamps(audioPath);
      
      if (wordTimestamps.length === 0) {
        throw new Error('No words transcribed from audio');
      }
      
      // Step 3: Group words into subtitle blocks
      const subtitleBlocks = this.groupWordsIntoSubtitleBlocks(wordTimestamps);
      
      // Step 4: Generate SRT content
      const srtContent = this.generateSRTContent(subtitleBlocks);
      
      // Step 5: Convert to timeline segments
      const segments = this.convertToTimelineSegments(subtitleBlocks);
      
      // Calculate statistics
      const totalDuration = Math.max(...wordTimestamps.map(w => w.end_time));
      
      // Cleanup temporary files
      if (fs.existsSync(audioPath)) {
        fs.unlinkSync(audioPath);
      }
      
      console.log('[WordLevel] ✅ Word-level subtitle generation complete!');
      console.log(`[WordLevel] Generated ${segments.length} subtitle blocks from ${wordTimestamps.length} words`);
      console.log(`[WordLevel] Total duration: ${totalDuration.toFixed(2)}s`);
      
      return {
        segments,
        srtContent,
        wordCount: wordTimestamps.length,
        totalDuration
      };
      
    } catch (error) {
      console.error('[WordLevel] Generation failed:', error);
      throw error;
    }
  }

  /**
   * Save SRT file to disk
   */
  async saveSRTFile(srtContent: string, filename: string): Promise<string> {
    const srtPath = path.join(this.tempDir, `${filename}.srt`);
    fs.writeFileSync(srtPath, srtContent, 'utf-8');
    console.log(`[WordLevel] SRT file saved: ${srtPath}`);
    return srtPath;
  }
}