import fs from 'fs';
import path from 'path';

interface WordTiming {
  word: string;
  start: number;
  end: number;
  confidence: number;
  punctuated_word: string;
  startMs: number;
  endMs: number;
  waitForMs: number;
}

interface SubtitleSegment {
  timecode: string;
  text: string;
  words: WordTiming[];
}

interface CaptionSettings {
  fontSize: number;
  textColor: string;
  fontWeight: number;
  fontFamily: string;
  numSimultaneousWords: number;
  stream: boolean;
  textAlign: "center" | "left";
  textBoxWidthInPercent: number;
  borderColor?: string;
  borderWidth?: number;
  currentWordColor?: string;
  currentWordBackgroundColor?: string;
  shadowColor?: string;
  shadowBlur?: number;
  fadeInAnimation?: boolean;
}

export class RevideoStreamingSubtitle {
  
  /**
   * Generate professional Revideo subtitle scene based on YouTube Shorts example
   * From: https://github.com/redotvideo/examples/tree/main/youtube-shorts
   */
  generateProfessionalSubtitleScene(
    subtitles: SubtitleSegment[], 
    sceneName: string = 'professionalSubtitles',
    settings: Partial<CaptionSettings> = {}
  ): string {
    // Default settings based on YouTube Shorts example
    const defaultSettings: CaptionSettings = {
      fontSize: 80,
      numSimultaneousWords: 8, // Increased for single-line display
      textColor: "white",
      fontWeight: 800,
      fontFamily: "Arial",
      stream: false,
      textAlign: "center",
      textBoxWidthInPercent: 90, // Wider for single-line text
      fadeInAnimation: true,
      currentWordColor: "cyan",
      currentWordBackgroundColor: "red",
      shadowColor: "black",
      shadowBlur: 30,
      borderColor: "black",
      borderWidth: 2
    };

    const finalSettings = { ...defaultSettings, ...settings };

    // Flatten all words from all segments with precise timing
    const allWords: WordTiming[] = [];
    
    subtitles.forEach(segment => {
      segment.words.forEach(word => {
        allWords.push({
          ...word,
          punctuated_word: word.punctuated_word,
          start: word.start,
          end: word.end
        });
      });
    });
    
    // Sort words by start time to ensure chronological order
    allWords.sort((a, b) => a.start - b.start);

    const sceneCode = `
import { Audio, Img, makeScene2D, Txt, Rect, Layout } from '@revideo/2d';
import { all, createRef, waitFor, useScene, Reference, createSignal } from '@revideo/core';

interface Word {
  punctuated_word: string;
  start: number;
  end: number;
}

interface CaptionSettings {
  fontSize: number;
  textColor: string;
  fontWeight: number;
  fontFamily: string;
  numSimultaneousWords: number;
  stream: boolean;
  textAlign: "center" | "left";
  textBoxWidthInPercent: number;
  borderColor?: string;
  borderWidth?: number;
  currentWordColor?: string;
  currentWordBackgroundColor?: string;
  shadowColor?: string;
  shadowBlur?: number;
  fadeInAnimation?: boolean;
}

const textSettings: CaptionSettings = ${JSON.stringify(finalSettings, null, 2)};

export default makeScene2D(function* (view) {
  const words: Word[] = ${JSON.stringify(allWords.map(w => ({
    punctuated_word: w.punctuated_word,
    start: w.start,
    end: w.end
  })), null, 2)};

  const duration = words[words.length-1].end + 0.5;
  const textContainer = createRef<Layout>();

  yield view.add(
    <Layout
      size={"100%"}
      ref={textContainer}
    />
  );

  yield* displayWords(textContainer, words, textSettings);
});

function* displayWords(container: Reference<Layout>, words: Word[], settings: CaptionSettings){
  let waitBefore = words[0].start;

  for (let i = 0; i < words.length; i += settings.numSimultaneousWords) {
    const currentBatch = words.slice(i, i + settings.numSimultaneousWords);
    const nextClipStart =
      i < words.length - 1 ? words[i + settings.numSimultaneousWords]?.start || null : null;
    const isLastClip = i + settings.numSimultaneousWords >= words.length;
    const waitAfter = isLastClip ? 1 : 0;
    const textRef = createRef<Txt>();
    yield* waitFor(waitBefore);

    if(settings.stream){
      let nextWordStart = 0;
      yield container().add(<Txt width={\`\${settings.textBoxWidthInPercent}%\`} textWrap={true} zIndex={2} textAlign={settings.textAlign} ref={textRef}/>);

      for(let j = 0; j < currentBatch.length; j++){
        const word = currentBatch[j];
        yield* waitFor(nextWordStart);
        const optionalSpace = j === currentBatch.length-1? "" : " ";
        const backgroundRef = createRef<Rect>();
        const wordRef = createRef<Txt>();
        const opacitySignal = createSignal(settings.fadeInAnimation ? 0.5 : 1);
        textRef().add(
          <Txt
            fontSize={settings.fontSize}
            fontWeight={settings.fontWeight}
            fontFamily={settings.fontFamily}
            textWrap={false}
            textAlign={settings.textAlign}
            fill={settings.currentWordColor}
            ref={wordRef}
            lineWidth={settings.borderWidth}
            shadowBlur={settings.shadowBlur}
            shadowColor={settings.shadowColor}
            zIndex={2}
            stroke={settings.borderColor}
            opacity={opacitySignal}
          >
            {word.punctuated_word}
          </Txt>
        );
        textRef().add(<Txt fontSize={settings.fontSize}>{optionalSpace}</Txt>);
        container().add(<Rect fill={settings.currentWordBackgroundColor} zIndex={1} size={wordRef().size} position={wordRef().position} radius={10} padding={10} ref={backgroundRef} />);
        yield* all(waitFor(word.end-word.start), opacitySignal(1, Math.min((word.end-word.start)*0.5, 0.1)));
        wordRef().fill(settings.textColor);
        backgroundRef().remove();
        nextWordStart = currentBatch[j+1]?.start - word.end || 0;
      }
      textRef().remove();

    } else {
      yield container().add(<Txt width={\`\${settings.textBoxWidthInPercent}%\`} textAlign={settings.textAlign} ref={textRef} textWrap={false} zIndex={2}/>);

      const wordRefs = [];
      const opacitySignal = createSignal(settings.fadeInAnimation ? 0.5 : 1);
      for(let j = 0; j < currentBatch.length; j++){
        const word = currentBatch[j];
        const optionalSpace = j === currentBatch.length-1? "" : " ";
        const wordRef = createRef<Txt>();
        textRef().add(
          <Txt
            fontSize={settings.fontSize}
            fontWeight={settings.fontWeight}
            ref={wordRef}
            fontFamily={settings.fontFamily}
            textWrap={false}
            textAlign={settings.textAlign}
            fill={settings.textColor}
            zIndex={2}
            stroke={settings.borderColor}
            lineWidth={settings.borderWidth}
            shadowBlur={settings.shadowBlur}
            shadowColor={settings.shadowColor}
            opacity={opacitySignal}
          >
            {word.punctuated_word}
          </Txt>
        );
        textRef().add(<Txt fontSize={settings.fontSize}>{optionalSpace}</Txt>);

        // we have to yield once to await the first word being aligned correctly
        if(j===0 && i === 0){
          yield;
        }
        wordRefs.push(wordRef);
      }

      yield* all(
        opacitySignal(1, Math.min(0.1, (currentBatch[0].end-currentBatch[0].start)*0.5)),
        highlightCurrentWord(container, currentBatch, wordRefs, settings.currentWordColor, settings.currentWordBackgroundColor),
        waitFor(currentBatch[currentBatch.length-1].end - currentBatch[0].start + waitAfter),
      );
      textRef().remove();
    }
    waitBefore = nextClipStart !== null ? nextClipStart - currentBatch[currentBatch.length-1].end : 0;
  }
}

function* highlightCurrentWord(container: Reference<Layout>, currentBatch: Word[], wordRefs: Reference<Txt>[], wordColor: string, backgroundColor: string){
  let nextWordStart = 0;

  for(let i = 0; i < currentBatch.length; i++){
    yield* waitFor(nextWordStart);
    const word = currentBatch[i];
    const originalColor = wordRefs[i]().fill();
    nextWordStart = currentBatch[i+1]?.start - word.end || 0;
    wordRefs[i]().text(wordRefs[i]().text());
    wordRefs[i]().fill(wordColor);

    const backgroundRef = createRef<Rect>();
    if(backgroundColor){
      container().add(<Rect fill={backgroundColor} zIndex={1} size={wordRefs[i]().size} position={wordRefs[i]().position} radius={10} padding={10} ref={backgroundRef} />);
    }

    yield* waitFor(word.end-word.start);
    wordRefs[i]().text(wordRefs[i]().text());
    wordRefs[i]().fill(originalColor);

    if(backgroundColor){
      backgroundRef().remove();
    }
  }
}
`;

    return sceneCode;
  }

  /**
   * Generate progressive subtitle scene where words fade in/out individually
   */
  generateProgressiveSubtitleScene(subtitles: SubtitleSegment[], sceneName: string = 'progressiveSubtitles'): string {
    const allWords: WordTiming[] = [];
    
    subtitles.forEach(segment => {
      segment.words.forEach(word => {
        allWords.push(word);
      });
    });
    
    allWords.sort((a, b) => a.startMs - b.startMs);
    
    const sceneCode = `
import { makeScene2D } from '@revideo/2d';
import { createRef, waitFor, all, tween, easeInOutCubic } from '@revideo/core';
import { Txt } from '@revideo/2d/lib/components';

export default makeScene2D(function* (view) {
  // Create individual text nodes for each word with precise timing
  const wordRefs: Txt[] = [];
  const words = ${JSON.stringify(allWords.map(w => ({
    text: w.punctuated_word,
    startMs: w.startMs,
    endMs: w.endMs,
    confidence: w.confidence
  })), null, 2)};

  // Create all word nodes initially invisible
  for (let i = 0; i < words.length; i++) {
    const wordRef = createRef<Txt>();
    wordRefs.push(wordRef());
    
    yield view.add(
      <Txt
        fontFamily={'Arial'}
        fontSize={32}
        fontWeight={'bold'}
        fill={'#ffffff'}
        stroke={'#000000'}
        lineWidth={2}
        textAlign={'center'}
        x={-200 + (i * 40)} // Spread words horizontally
        y={280}
        opacity={0}
        text={words[i].text}
        ref={wordRef}
      />
    );
  }

  // Animate words appearing and disappearing with precise timing
  let currentTime = 0;
  
  for (let i = 0; i < words.length; i++) {
    const word = words[i];
    const wordRef = wordRefs[i];
    
    // Wait until word start time
    const waitTime = word.startMs - currentTime;
    if (waitTime > 0) {
      yield* waitFor(waitTime / 1000);
    }
    
    // Fade in word
    yield* tween(0.2, value => {
      wordRef.opacity(easeInOutCubic(value));
    });
    
    // Keep word visible for its duration
    const wordDuration = word.endMs - word.startMs;
    yield* waitFor(wordDuration / 1000);
    
    // Fade out word
    yield* tween(0.2, value => {
      wordRef.opacity(easeInOutCubic(1 - value));
    });
    
    currentTime = word.endMs;
  }
});
`;

    return sceneCode;
  }

  /**
   * Save professional subtitle scene to file
   */
  async saveProfessionalScene(
    subtitles: SubtitleSegment[], 
    outputPath: string, 
    sceneType: 'professional' | 'streaming' | 'progressive' = 'professional',
    settings: Partial<CaptionSettings> = {}
  ): Promise<string> {
    try {
      const sceneName = path.basename(outputPath, '.tsx');
      
      let sceneCode: string;
      if (sceneType === 'professional') {
        sceneCode = this.generateProfessionalSubtitleScene(subtitles, sceneName, settings);
      } else if (sceneType === 'streaming') {
        sceneCode = this.generateStreamingTextScene(subtitles, sceneName);
      } else {
        sceneCode = this.generateProgressiveSubtitleScene(subtitles, sceneName);
      }
      
      // Ensure directory exists
      const dir = path.dirname(outputPath);
      if (!fs.existsSync(dir)) {
        fs.mkdirSync(dir, { recursive: true });
      }
      
      fs.writeFileSync(outputPath, sceneCode, 'utf8');
      console.log('[RevideoStreamingSubtitle] Professional scene saved:', outputPath);
      
      return outputPath;
      
    } catch (error) {
      console.error('[RevideoStreamingSubtitle] Error saving professional scene:', error);
      throw error;
    }
  }

  /**
   * Legacy method for backward compatibility
   */
  async saveStreamingScene(
    subtitles: SubtitleSegment[], 
    outputPath: string, 
    sceneType: 'streaming' | 'progressive' = 'streaming'
  ): Promise<string> {
    return this.saveProfessionalScene(subtitles, outputPath, sceneType);
  }

  /**
   * Generate metadata for the streaming subtitle scene
   */
  generateSceneMetadata(subtitles: SubtitleSegment[]) {
    const allWords = subtitles.flatMap(s => s.words);
    const totalDuration = Math.max(...allWords.map(w => w.endMs)) / 1000;
    
    return {
      totalWords: allWords.length,
      totalSegments: subtitles.length,
      durationSeconds: totalDuration,
      averageWordsPerSecond: allWords.length / totalDuration,
      timingPrecision: 'milliseconds',
      revideoCompatible: true
    };
  }
}