import { GoogleGenerativeAI } from '@google/generative-ai';
import OpenAI from 'openai';
import { createClient } from '@deepgram/sdk';
import ffmpeg from 'fluent-ffmpeg';
import fs from 'fs';
import path from 'path';
import { nanoid } from 'nanoid';

// Interfaces matching YouTube Shorts example
interface WordTiming {
  word: string;
  start: number;
  end: number;
  confidence: number;
  punctuated_word: string;
}

interface SubtitleSegment {
  start: number;
  end: number;
  text: string;
  words: WordTiming[];
  timecode: string;
}

interface CaptionSettings {
  fontSize: number;
  fontWeight: number;
  textAlign: 'center' | 'left' | 'right';
  textColor: string;
  currentWordColor: string;
  currentWordBackgroundColor: string;
  shadowColor: string;
  shadowBlur: number;
  numSimultaneousWords: number;
  fadeInAnimation: boolean;
  stream: boolean;
  textBoxWidthInPercent: number;
}

export class YouTubeShortsSubtitleSystem {
  private gemini: GoogleGenerativeAI;
  private openai: OpenAI;
  private deepgram: any;

  constructor() {
    this.gemini = new GoogleGenerativeAI(process.env.GEMINI_API_KEY!);
    this.openai = new OpenAI({ apiKey: process.env.OPENAI_API_KEY! });
    this.deepgram = createClient(process.env.DEEPGRAM_API_KEY!);
  }

  /**
   * Generate subtitles using Deepgram for precise word-level timing
   * Based on YouTube Shorts example implementation
   */
  async generateWordLevelSubtitles(videoPath: string): Promise<SubtitleSegment[]> {
    console.log('[YouTubeShorts] Starting word-level subtitle generation for:', videoPath);

    try {
      // Extract audio from video
      const audioPath = await this.extractAudio(videoPath);
      
      // Get precise word-level transcription from Deepgram
      const transcription = await this.transcribeWithDeepgram(audioPath);
      
      // Process into subtitle segments with proper timing
      const segments = this.processTranscriptionToSegments(transcription);
      
      // Clean up temporary audio file
      if (fs.existsSync(audioPath)) {
        fs.unlinkSync(audioPath);
      }
      
      console.log(`[YouTubeShorts] Generated ${segments.length} subtitle segments`);
      return segments;
      
    } catch (error) {
      console.error('[YouTubeShorts] Subtitle generation error:', error);
      throw error;
    }
  }

  /**
   * Extract audio from video using FFmpeg
   */
  private async extractAudio(videoPath: string): Promise<string> {
    const audioPath = path.join('temp_transcription', `audio_${nanoid()}.wav`);
    
    // Ensure temp directory exists
    const tempDir = path.dirname(audioPath);
    if (!fs.existsSync(tempDir)) {
      fs.mkdirSync(tempDir, { recursive: true });
    }

    return new Promise((resolve, reject) => {
      ffmpeg(videoPath)
        .output(audioPath)
        .audioCodec('pcm_s16le')
        .audioFrequency(16000)
        .audioChannels(1)
        .on('end', () => {
          console.log('[YouTubeShorts] Audio extraction completed');
          resolve(audioPath);
        })
        .on('error', (error) => {
          console.error('[YouTubeShorts] Audio extraction error:', error);
          reject(error);
        })
        .run();
    });
  }

  /**
   * Transcribe audio using Deepgram with word-level timing
   */
  private async transcribeWithDeepgram(audioPath: string): Promise<any> {
    console.log('[YouTubeShorts] Starting Deepgram transcription');
    
    const audioBuffer = fs.readFileSync(audioPath);
    
    try {
      const response = await this.deepgram.listen.prerecorded.transcribeFile(
        audioBuffer,
        {
          model: 'nova-2',
          language: 'en',
          smart_format: true,
          punctuate: true,
          diarize: false,
          multichannel: false,
          alternatives: 1,
          numerals: true,
          profanity_filter: false,
          utterances: false,
          paragraphs: false,
          sentiment: false
        }
      );
      
      return response;
    } catch (error) {
      console.error('[YouTubeShorts] Deepgram API error:', error);
      throw new Error(`Deepgram transcription failed: ${(error as Error).message}`);
    }
  }

  /**
   * Process Deepgram transcription into single-line subtitle segments
   */
  private processTranscriptionToSegments(transcription: any): SubtitleSegment[] {
    const segments: SubtitleSegment[] = [];
    
    console.log('[YouTubeShorts] Processing transcription structure...');
    
    // Handle Deepgram response structure (response.result contains the actual transcription)
    let actualTranscription = transcription;
    if (transcription.result) {
      actualTranscription = transcription.result;
    }
    
    if (!actualTranscription || !actualTranscription.results) {
      console.error('[YouTubeShorts] Invalid transcription object:', actualTranscription);
      throw new Error('Invalid transcription data - missing results');
    }
    
    if (!actualTranscription.results?.channels?.[0]?.alternatives?.[0]?.words) {
      console.warn('[YouTubeShorts] No word-level timing data available');
      return segments;
    }

    const words = actualTranscription.results.channels[0].alternatives[0].words;
    
    // Create single-line subtitle segments - each segment represents one line of text
    // Group words into longer segments for single-line display (not individual word tracks)
    const wordsPerSegment = 5; // 4-5 words for single-line display as per YouTube Shorts standard
    
    for (let i = 0; i < words.length; i += wordsPerSegment) {
      const segmentWords = words.slice(i, i + wordsPerSegment);
      
      if (segmentWords.length === 0) continue;
      
      const start = segmentWords[0].start;
      const end = segmentWords[segmentWords.length - 1].end;
      const text = segmentWords.map((w: any) => w.punctuated_word || w.word).join(' ');
      
      // Convert to required format
      const wordTimings: WordTiming[] = segmentWords.map((w: any) => ({
        word: w.word,
        start: w.start,
        end: w.end,
        confidence: w.confidence || 0.9,
        punctuated_word: w.punctuated_word || w.word
      }));
      
      segments.push({
        start,
        end,
        text,
        words: wordTimings,
        timecode: this.formatTimecode(start, end)
      });
    }
    
    return segments;
  }

  /**
   * Format timecode in SRT format
   */
  private formatTimecode(start: number, end: number): string {
    const formatTime = (seconds: number): string => {
      const hours = Math.floor(seconds / 3600);
      const minutes = Math.floor((seconds % 3600) / 60);
      const secs = Math.floor(seconds % 60);
      const ms = Math.floor((seconds % 1) * 1000);
      
      return `${hours.toString().padStart(2, '0')}:${minutes.toString().padStart(2, '0')}:${secs.toString().padStart(2, '0')},${ms.toString().padStart(3, '0')}`;
    };
    
    return `${formatTime(start)} --> ${formatTime(end)}`;
  }

  /**
   * Generate professional Revideo subtitle scene based on YouTube Shorts example
   */
  generateRevideoSubtitleScene(
    subtitles: SubtitleSegment[], 
    sceneName: string = 'youtubeSubtitles',
    settings: Partial<CaptionSettings> = {}
  ): string {
    // Default settings based on YouTube Shorts example
    const defaultSettings: CaptionSettings = {
      fontSize: 80,
      fontWeight: 800,
      textAlign: 'center',
      textColor: 'white',
      currentWordColor: '#00FFFF', // Cyan for current word highlighting
      currentWordBackgroundColor: '#FF0000', // Red background for current word
      shadowColor: 'black',
      shadowBlur: 30,
      numSimultaneousWords: 5,
      fadeInAnimation: true,
      stream: false,
      textBoxWidthInPercent: 80
    };

    const finalSettings = { ...defaultSettings, ...settings };

    const sceneCode = `
import { Txt, Layout, makeScene2D } from '@revideo/2d';
import { createRef, all, waitFor, Reference, createSignal } from '@revideo/core';

export default makeScene2D(function* (view) {
  // Create references for subtitle containers
  const subtitleContainer = createRef<Layout>();
  const currentWordSignal = createSignal(0);

  // Subtitle data from generation
  const subtitles = ${JSON.stringify(subtitles, null, 2)};

  view.add(
    <Layout
      ref={subtitleContainer}
      direction="column"
      justifyContent="center"
      alignItems="center"
      width="100%"
      height="100%"
      y={200} // Position at bottom like YouTube Shorts
    />
  );

  // Function to highlight current word (YouTube Shorts style)
  function* highlightCurrentWord(segmentIndex: number, wordIndex: number) {
    const segment = subtitles[segmentIndex];
    if (!segment || !segment.words) return;

    const words = segment.words;
    const currentWord = words[wordIndex];
    
    if (!currentWord) return;

    // Create word elements for this segment
    const wordElements: Reference<Txt>[] = [];
    
    // Clear previous words
    subtitleContainer().removeChildren();
    
    // Add word layout
    const wordLayout = (
      <Layout
        direction="row"
        justifyContent="center"
        alignItems="center"
        gap={20}
        wrap="wrap"
        width={\`\${${finalSettings.textBoxWidthInPercent}}%\`}
      />
    );
    
    subtitleContainer().add(wordLayout);

    // Create text elements for each word
    for (let i = 0; i < Math.min(words.length, ${finalSettings.numSimultaneousWords}); i++) {
      const word = words[i];
      const wordRef = createRef<Txt>();
      wordElements.push(wordRef);
      
      const isCurrentWord = i === wordIndex;
      
      wordLayout.add(
        <Txt
          ref={wordRef}
          text={word.punctuated_word}
          fontSize={${finalSettings.fontSize}}
          fontWeight={${finalSettings.fontWeight}}
          textAlign="${finalSettings.textAlign}"
          fill={isCurrentWord ? '${finalSettings.currentWordColor}' : '${finalSettings.textColor}'}
          fontFamily="Arial"
          shadowColor="${finalSettings.shadowColor}"
          shadowBlur={${finalSettings.shadowBlur}}
          ${finalSettings.fadeInAnimation ? 'opacity={0}' : ''}
        />
      );
    }

    // Animate word highlighting
    if (${finalSettings.fadeInAnimation}) {
      yield* all(
        ...wordElements.map((wordRef, i) => 
          wordRef().opacity(0).to(1, 0.3)
        )
      );
    }

    // Highlight current word with background (YouTube Shorts style)
    if (wordElements[wordIndex]) {
      yield* all(
        wordElements[wordIndex]().fill('${finalSettings.currentWordColor}', 0.1),
        wordElements[wordIndex]().scale(1, 0.1).to(1.1, 0.1).to(1, 0.1)
      );
    }

    // Wait for word duration
    const wordDuration = currentWord.end - currentWord.start;
    yield* waitFor(wordDuration);
  }

  // Main subtitle animation loop
  for (let segmentIndex = 0; segmentIndex < subtitles.length; segmentIndex++) {
    const segment = subtitles[segmentIndex];
    
    // Process words in batches of ${finalSettings.numSimultaneousWords}
    const words = segment.words;
    for (let wordIndex = 0; wordIndex < words.length; wordIndex += ${finalSettings.numSimultaneousWords}) {
      const batch = words.slice(wordIndex, wordIndex + ${finalSettings.numSimultaneousWords});
      
      // Animate each word in the batch
      for (let i = 0; i < batch.length; i++) {
        yield* highlightCurrentWord(segmentIndex, wordIndex + i);
      }
    }
  }
});
`;

    return sceneCode;
  }

  /**
   * Export subtitles to SRT format
   */
  exportToSRT(subtitles: SubtitleSegment[]): string {
    let srtContent = '';
    
    subtitles.forEach((segment, index) => {
      srtContent += `${index + 1}\n`;
      srtContent += `${segment.timecode}\n`;
      srtContent += `${segment.text}\n\n`;
    });
    
    return srtContent;
  }

  /**
   * Generate enhanced script using OpenAI (from YouTube Shorts example)
   */
  async generateEnhancedScript(transcript: string, style: 'viral' | 'educational' | 'entertainment' = 'viral'): Promise<string> {
    console.log('[YouTubeShorts] Generating enhanced script with OpenAI');
    
    const response = await this.openai.chat.completions.create({
      model: 'gpt-4o-mini',
      messages: [
        {
          role: 'system',
          content: `You are a viral content creator specializing in ${style} content. Transform the given transcript into an engaging script optimized for subtitles and visual appeal.`
        },
        {
          role: 'user',
          content: `Transform this transcript into a ${style} script: ${transcript}`
        }
      ],
      max_tokens: 500,
      temperature: 0.7
    });

    return response.choices[0]?.message?.content || transcript;
  }

  /**
   * Create subtitle scene file for Revideo rendering
   */
  async createSubtitleSceneFile(
    subtitles: SubtitleSegment[], 
    sceneName: string = 'professionalSubtitles',
    settings: Partial<CaptionSettings> = {}
  ): Promise<string> {
    const sceneCode = this.generateRevideoSubtitleScene(subtitles, sceneName, settings);
    const fileName = `${sceneName}_${Date.now()}.tsx`;
    const filePath = path.join('revideo', 'scenes', fileName);
    
    // Ensure scenes directory exists
    const scenesDir = path.dirname(filePath);
    if (!fs.existsSync(scenesDir)) {
      fs.mkdirSync(scenesDir, { recursive: true });
    }
    
    fs.writeFileSync(filePath, sceneCode);
    console.log(`[YouTubeShorts] Created subtitle scene file: ${filePath}`);
    
    return filePath;
  }
}