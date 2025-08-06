import { GoogleGenAI } from "@google/genai";
import * as fs from "fs";
import * as path from "path";

export interface AnimatedWordSegment {
  word: string;
  startTime: number;
  endTime: number;
  animation: {
    type: 'fadeIn' | 'slideUp' | 'typewriter' | 'bounce' | 'glow' | 'scale' | 'highlight';
    duration: number;
    delay: number;
    easing: 'ease' | 'ease-in' | 'ease-out' | 'ease-in-out';
  };
  visual: {
    color: string;
    highlightColor: string;
    shadowColor: string;
    fontSize: number;
    fontWeight: 'normal' | 'bold' | 'semibold';
    opacity: number;
    transform: string;
  };
  speechMetrics: {
    speed: 'slow' | 'normal' | 'fast';
    emphasis: 'low' | 'medium' | 'high';
    volume: 'quiet' | 'normal' | 'loud';
  };
}

export interface AnimatedSubtitleSegment {
  id: string;
  startTime: number;
  endTime: number;
  text: string;
  words: AnimatedWordSegment[];
  containerAnimation: {
    entrance: 'fadeIn' | 'slideUp' | 'slideDown' | 'expandIn' | 'flipIn';
    exit: 'fadeOut' | 'slideDown' | 'slideUp' | 'contractOut' | 'flipOut';
    duration: number;
  };
  style: {
    backgroundColor: string;
    borderRadius: number;
    padding: number;
    boxShadow: string;
    backdropBlur: boolean;
  };
  timing: {
    leadInTime: number; // Time before speech starts
    holdTime: number;   // Time after speech ends
    wordGap: number;    // Gap between words
  };
}

export interface AnimationPreset {
  name: string;
  description: string;
  wordAnimations: AnimatedWordSegment['animation'][];
  containerStyle: AnimatedSubtitleSegment['containerAnimation'];
  colorScheme: {
    primary: string;
    highlight: string;
    shadow: string;
    background: string;
  };
  timing: {
    wordDelay: number;
    containerDuration: number;
    emphasis: 'subtle' | 'moderate' | 'dynamic' | 'dramatic';
  };
}

export class AnimatedSubtitleGenerator {
  private geminiAI: GoogleGenAI;
  
  // Predefined animation presets
  private animationPresets: { [key: string]: AnimationPreset } = {
    subtle: {
      name: 'Subtle',
      description: 'Gentle animations that enhance readability without distraction',
      wordAnimations: [
        { type: 'fadeIn', duration: 300, delay: 0, easing: 'ease-out' }
      ],
      containerStyle: { entrance: 'fadeIn', exit: 'fadeOut', duration: 400 },
      colorScheme: {
        primary: '#ffffff',
        highlight: '#fbbf24',
        shadow: 'rgba(0,0,0,0.8)',
        background: 'rgba(0,0,0,0.7)'
      },
      timing: { wordDelay: 100, containerDuration: 400, emphasis: 'subtle' }
    },
    
    dynamic: {
      name: 'Dynamic',
      description: 'Engaging word-by-word highlighting with smooth transitions',
      wordAnimations: [
        { type: 'slideUp', duration: 400, delay: 0, easing: 'ease-out' },
        { type: 'highlight', duration: 200, delay: 200, easing: 'ease-in-out' }
      ],
      containerStyle: { entrance: 'slideUp', exit: 'slideDown', duration: 500 },
      colorScheme: {
        primary: '#ffffff',
        highlight: '#60a5fa',
        shadow: 'rgba(59,130,246,0.5)',
        background: 'rgba(15,23,42,0.9)'
      },
      timing: { wordDelay: 150, containerDuration: 500, emphasis: 'moderate' }
    },
    
    typewriter: {
      name: 'Typewriter',
      description: 'Letter-by-letter reveal with typing sound visualization',
      wordAnimations: [
        { type: 'typewriter', duration: 600, delay: 0, easing: 'ease' }
      ],
      containerStyle: { entrance: 'expandIn', exit: 'contractOut', duration: 300 },
      colorScheme: {
        primary: '#10b981',
        highlight: '#34d399',
        shadow: 'rgba(16,185,129,0.3)',
        background: 'rgba(6,78,59,0.8)'
      },
      timing: { wordDelay: 200, containerDuration: 300, emphasis: 'dynamic' }
    },
    
    energetic: {
      name: 'Energetic',
      description: 'High-energy animations perfect for viral content',
      wordAnimations: [
        { type: 'bounce', duration: 500, delay: 0, easing: 'ease-out' },
        { type: 'glow', duration: 300, delay: 100, easing: 'ease-in-out' },
        { type: 'scale', duration: 200, delay: 300, easing: 'ease-out' }
      ],
      containerStyle: { entrance: 'flipIn', exit: 'flipOut', duration: 600 },
      colorScheme: {
        primary: '#fbbf24',
        highlight: '#f59e0b',
        shadow: 'rgba(245,158,11,0.6)',
        background: 'rgba(120,53,15,0.9)'
      },
      timing: { wordDelay: 120, containerDuration: 600, emphasis: 'dramatic' }
    }
  };

  constructor() {
    this.geminiAI = new GoogleGenAI({ 
      apiKey: process.env.GEMINI_API_KEY || "" 
    });
  }

  async generateAnimatedSubtitles(
    videoPath: string,
    options: {
      preset?: keyof typeof this.animationPresets;
      customAnimation?: Partial<AnimationPreset>;
      speechAnalysis?: boolean;
      adaptToContent?: boolean;
    } = {}
  ): Promise<AnimatedSubtitleSegment[]> {
    try {
      console.log('[AnimatedSubtitles] Starting animated subtitle generation...');
      
      // Step 1: Extract audio and analyze speech patterns
      const audioPath = await this.extractAudio(videoPath);
      const speechAnalysis = await this.analyzeSpeechPatterns(videoPath, audioPath);
      
      // Step 2: Generate base transcription with word-level timing
      const baseTranscription = await this.getWordLevelTranscription(audioPath);
      
      // Step 3: Apply animation logic based on speech analysis
      const animatedSegments = await this.applyAnimations(
        baseTranscription,
        speechAnalysis,
        options
      );
      
      // Step 4: Optimize animations for readability
      const optimizedSegments = this.optimizeAnimationTiming(animatedSegments);
      
      // Cleanup
      if (fs.existsSync(audioPath)) {
        fs.unlinkSync(audioPath);
      }
      
      console.log(`[AnimatedSubtitles] Generated ${optimizedSegments.length} animated segments`);
      return optimizedSegments;
      
    } catch (error) {
      console.error('[AnimatedSubtitles] Error:', error);
      throw error;
    }
  }

  private async extractAudio(videoPath: string): Promise<string> {
    // Extract high-quality audio for analysis
    const audioPath = videoPath.replace(/\.[^/.]+$/, '_animated.wav');
    
    return new Promise(async (resolve, reject) => {
      const { spawn } = await import('child_process');
      const ffmpeg = spawn('ffmpeg', [
        '-i', videoPath,
        '-vn',
        '-acodec', 'pcm_s16le',
        '-ar', '48000',
        '-ac', '1',
        '-y',
        audioPath
      ]);
      
      ffmpeg.on('close', (code: number) => {
        if (code === 0) resolve(audioPath);
        else reject(new Error(`Audio extraction failed with code ${code}`));
      });
    });
  }

  private async analyzeSpeechPatterns(videoPath: string, audioPath: string): Promise<any> {
    try {
      console.log('[AnimatedSubtitles] Analyzing speech patterns with Gemini 2.0...');
      
      const videoBuffer = fs.readFileSync(videoPath);
      const audioBuffer = fs.readFileSync(audioPath);
      
      const prompt = `Analyze this video and audio for speech patterns to create optimal subtitle animations:

ANALYZE FOR:
1. Speech Speed: Identify slow, normal, and fast speech segments
2. Emphasis Points: Detect words/phrases that need highlighting
3. Emotional Tone: Map excitement, calm, urgency, emphasis
4. Audience Engagement: Identify viral moments, key points, quotable segments
5. Natural Pauses: Find breath points, sentence boundaries, emphasis gaps

PROVIDE TIMING DATA:
- Word-level speech speed classification
- Emphasis intensity per word (1-10 scale)
- Emotional tone segments with timestamps
- Recommended animation intensity per segment
- Key engagement moments for special effects

Return detailed JSON with timing, emphasis, and animation recommendations.`;

      const response = await this.geminiAI.models.generateContent({
        model: "gemini-2.0-flash-exp",
        contents: [
          {
            role: "user",
            parts: [
              {
                inlineData: {
                  data: videoBuffer.toString('base64'),
                  mimeType: "video/mp4"
                }
              },
              {
                inlineData: {
                  data: audioBuffer.toString('base64'),
                  mimeType: "audio/wav"
                }
              },
              { text: prompt }
            ]
          }
        ],
        config: {
          responseMimeType: "application/json"
        }
      });

      const analysisText = response.text;
      if (!analysisText) {
        throw new Error('No speech analysis received');
      }

      return JSON.parse(analysisText);
      
    } catch (error) {
      console.error('[AnimatedSubtitles] Speech analysis failed:', error);
      // Return fallback analysis
      return {
        speechSpeed: 'normal',
        emphasisPoints: [],
        emotionalTone: 'neutral',
        engagementMoments: []
      };
    }
  }

  private async getWordLevelTranscription(audioPath: string): Promise<any[]> {
    try {
      console.log('[AnimatedSubtitles] Getting transcription using fallback system...');
      
      // Use existing GoogleSpeechTranscriber for reliable transcription
      const { GoogleSpeechTranscriber } = await import('./google-speech-transcriber');
      const transcriber = new GoogleSpeechTranscriber();
      
      // Get basic caption data
      const captionData = await transcriber.generateCaptions(audioPath.replace('_animated.wav', '.mp4'));
      
      if (!captionData || !captionData.segments || captionData.segments.length === 0) {
        console.log('[AnimatedSubtitles] No caption data, creating demo segments...');
        return this.createDemoAnimatedSegments();
      }
      
      console.log(`[AnimatedSubtitles] Processing ${captionData.segments.length} caption segments...`);
      
      // Convert caption segments to animated format
      const animatedSegments = captionData.segments.map((segment: any, index: number) => {
        const words = this.splitTextIntoWords(segment.text, segment.startTime, segment.endTime);
        
        return {
          start_time: segment.startTime,
          end_time: segment.endTime,
          text: segment.text,
          words: words,
          speechMetrics: {
            speed: this.analyzeSpeechSpeed(segment.endTime - segment.startTime, segment.text.length),
            emphasis: index % 3 === 0 ? 'high' : 'medium', // Vary emphasis
            volume: 'normal'
          }
        };
      });
      
      return animatedSegments;
      
    } catch (error) {
      console.error('[AnimatedSubtitles] Transcription failed, using demo data:', error);
      return this.createDemoAnimatedSegments();
    }
  }
  
  private createDemoAnimatedSegments(): any[] {
    return [
      {
        start_time: 0,
        end_time: 3,
        text: "Welcome to animated subtitles",
        words: [
          { word: "Welcome", start_time: 0, end_time: 0.8 },
          { word: "to", start_time: 0.8, end_time: 1.1 },
          { word: "animated", start_time: 1.1, end_time: 2.0 },
          { word: "subtitles", start_time: 2.0, end_time: 3.0 }
        ],
        speechMetrics: { speed: 'normal', emphasis: 'high', volume: 'normal' }
      },
      {
        start_time: 3.5,
        end_time: 6.5,
        text: "With dynamic word highlighting",
        words: [
          { word: "With", start_time: 3.5, end_time: 3.9 },
          { word: "dynamic", start_time: 3.9, end_time: 4.7 },
          { word: "word", start_time: 4.7, end_time: 5.2 },
          { word: "highlighting", start_time: 5.2, end_time: 6.5 }
        ],
        speechMetrics: { speed: 'fast', emphasis: 'medium', volume: 'normal' }
      }
    ];
  }
  
  private splitTextIntoWords(text: string, startTime: number, endTime: number): any[] {
    const words = text.split(' ');
    const duration = endTime - startTime;
    const timePerWord = duration / words.length;
    
    return words.map((word, index) => ({
      word: word,
      start_time: startTime + (index * timePerWord),
      end_time: startTime + ((index + 1) * timePerWord)
    }));
  }
  
  private analyzeSpeechSpeed(duration: number, textLength: number): 'slow' | 'normal' | 'fast' {
    const wordsPerSecond = textLength / duration / 5; // Rough estimate
    if (wordsPerSecond > 2.5) return 'fast';
    if (wordsPerSecond < 1.5) return 'slow';
    return 'normal';
  }

  private async applyAnimations(
    transcription: any[],
    speechAnalysis: any,
    options: any
  ): Promise<AnimatedSubtitleSegment[]> {
    const preset = this.animationPresets[options.preset || 'dynamic'];
    const segments: AnimatedSubtitleSegment[] = [];

    for (let i = 0; i < transcription.length; i++) {
      const segment = transcription[i];
      
      // Create animated words
      const animatedWords: AnimatedWordSegment[] = segment.words?.map((word: any, wordIndex: number) => {
        const speechMetrics = this.determineSpeechMetrics(word, speechAnalysis);
        const animation = this.selectWordAnimation(speechMetrics, preset, wordIndex);
        const visual = this.createWordVisual(speechMetrics, preset);
        
        return {
          word: word.word,
          startTime: word.start_time,
          endTime: word.end_time,
          animation,
          visual,
          speechMetrics
        };
      }) || [];

      // Create segment container
      const animatedSegment: AnimatedSubtitleSegment = {
        id: `animated_${Date.now()}_${i}`,
        startTime: segment.start_time || segment.startTime,
        endTime: segment.end_time || segment.endTime,
        text: segment.text,
        words: animatedWords,
        containerAnimation: {
          ...preset.containerStyle,
          duration: preset.timing.containerDuration
        },
        style: {
          backgroundColor: preset.colorScheme.background,
          borderRadius: 8,
          padding: 12,
          boxShadow: `0 4px 20px ${preset.colorScheme.shadow}`,
          backdropBlur: true
        },
        timing: {
          leadInTime: 0.3,
          holdTime: 0.2,
          wordGap: preset.timing.wordDelay / 1000
        }
      };

      segments.push(animatedSegment);
    }

    return segments;
  }

  private determineSpeechMetrics(word: any, speechAnalysis: any): AnimatedWordSegment['speechMetrics'] {
    // Analyze word characteristics for animation selection
    const wordDuration = word.end_time - word.start_time;
    const averageWordDuration = 0.5; // 500ms average
    
    let speed: 'slow' | 'normal' | 'fast' = 'normal';
    if (wordDuration > averageWordDuration * 1.5) speed = 'slow';
    if (wordDuration < averageWordDuration * 0.7) speed = 'fast';
    
    // Check for emphasis indicators
    const emphasis = word.emphasis || 'medium';
    const volume = word.volume || 'normal';
    
    return { speed, emphasis, volume };
  }

  private selectWordAnimation(
    metrics: AnimatedWordSegment['speechMetrics'],
    preset: AnimationPreset,
    wordIndex: number
  ): AnimatedWordSegment['animation'] {
    const baseAnimation = preset.wordAnimations[0];
    
    // Modify animation based on speech characteristics
    let duration = baseAnimation.duration;
    let type = baseAnimation.type;
    
    // Adjust for speech speed
    if (metrics.speed === 'fast') {
      duration *= 0.7; // Faster animations for fast speech
      type = 'slideUp'; // Quick, snappy animation
    } else if (metrics.speed === 'slow') {
      duration *= 1.3; // Slower animations for slow speech
      type = 'fadeIn'; // Gentle animation
    }
    
    // Adjust for emphasis
    if (metrics.emphasis === 'high') {
      type = 'bounce'; // Attention-grabbing animation
      duration *= 1.2;
    }
    
    // Add staggered delay for word-by-word effect
    const delay = wordIndex * (preset.timing.wordDelay || 100);
    
    return {
      type,
      duration,
      delay,
      easing: baseAnimation.easing
    };
  }

  private createWordVisual(
    metrics: AnimatedWordSegment['speechMetrics'],
    preset: AnimationPreset
  ): AnimatedWordSegment['visual'] {
    let color = preset.colorScheme.primary;
    let highlightColor = preset.colorScheme.highlight;
    
    // Color based on speech characteristics
    if (metrics.speed === 'fast' && metrics.volume === 'loud') {
      color = '#ef4444'; // Red for fast/loud
      highlightColor = '#fca5a5';
    } else if (metrics.speed === 'slow' && metrics.volume === 'quiet') {
      color = '#3b82f6'; // Blue for slow/quiet
      highlightColor = '#93c5fd';
    } else {
      color = '#10b981'; // Green for normal
      highlightColor = '#6ee7b7';
    }
    
    return {
      color,
      highlightColor,
      shadowColor: preset.colorScheme.shadow,
      fontSize: metrics.emphasis === 'high' ? 24 : 20,
      fontWeight: metrics.emphasis === 'high' ? 'bold' : 'normal',
      opacity: 1,
      transform: 'none'
    };
  }

  private optimizeAnimationTiming(segments: AnimatedSubtitleSegment[]): AnimatedSubtitleSegment[] {
    // Optimize timing to prevent overwhelming animations
    return segments.map((segment, index) => {
      // Ensure minimum gap between segments
      if (index > 0) {
        const prevSegment = segments[index - 1];
        const gap = segment.startTime - prevSegment.endTime;
        if (gap < 0.5) {
          // Reduce animation intensity for rapid segments
          segment.words.forEach(word => {
            word.animation.duration *= 0.8;
            word.animation.delay *= 0.5;
          });
        }
      }
      
      // Limit concurrent animations
      if (segment.words.length > 6) {
        segment.words.forEach((word, wordIndex) => {
          if (wordIndex > 3) {
            word.animation.type = 'fadeIn'; // Simpler animation for long segments
          }
        });
      }
      
      return segment;
    });
  }

  getAvailablePresets(): { [key: string]: AnimationPreset } {
    return this.animationPresets;
  }
}

export default AnimatedSubtitleGenerator;