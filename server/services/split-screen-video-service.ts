import path from 'path';
import fs from 'fs/promises';
import { fileURLToPath } from 'url';
import { YouTubeShortsSubtitleSystem } from './youtube-shorts-subtitle-system';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

interface SplitScreenConfig {
  mainVideoPath: string;
  backgroundVideoPath: string;
  audioSourcePath: string;
  subtitleData: any[];
  subtitleTemplate: string;
  outputPath: string;
}

interface SubtitleStyle {
  fontSize: number;
  fontWeight: number;
  textColor: string;
  fontFamily: string;
  currentWordColor: string;
  currentWordBackgroundColor: string;
  shadowColor: string;
  shadowBlur: number;
  fadeInAnimation: boolean;
  textAlign: string;
}

export class SplitScreenVideoService {
  private getSubtitleStyleByTemplate(template: string): SubtitleStyle {
    const styles: Record<string, SubtitleStyle> = {
      'youtube-shorts': {
        fontSize: 80,
        fontWeight: 800,
        textColor: '#ffffff',
        fontFamily: 'Mulish',
        currentWordColor: '#00FFFF',
        currentWordBackgroundColor: '#FF0000',
        shadowColor: '#000000',
        shadowBlur: 30,
        fadeInAnimation: true,
        textAlign: 'center'
      },
      'tiktok-style': {
        fontSize: 72,
        fontWeight: 900,
        textColor: '#ffffff',
        fontFamily: 'Arial',
        currentWordColor: '#FF69B4',
        currentWordBackgroundColor: '#000000',
        shadowColor: '#000000',
        shadowBlur: 20,
        fadeInAnimation: true,
        textAlign: 'center'
      },
      'professional': {
        fontSize: 48,
        fontWeight: 600,
        textColor: '#ffffff',
        fontFamily: 'Helvetica',
        currentWordColor: '#4A90E2',
        currentWordBackgroundColor: 'rgba(0,0,0,0.8)',
        shadowColor: '#000000',
        shadowBlur: 15,
        fadeInAnimation: false,
        textAlign: 'center'
      },
      'gaming': {
        fontSize: 64,
        fontWeight: 800,
        textColor: '#00FF00',
        fontFamily: 'Courier New',
        currentWordColor: '#FFFF00',
        currentWordBackgroundColor: '#FF0000',
        shadowColor: '#000000',
        shadowBlur: 25,
        fadeInAnimation: true,
        textAlign: 'center'
      }
    };

    return styles[template] || styles['youtube-shorts'];
  }

  async generateSplitScreenVideo(config: SplitScreenConfig): Promise<void> {
    console.log('[SplitScreen] Starting split-screen video generation...');
    
    const style = this.getSubtitleStyleByTemplate(config.subtitleTemplate);
    const sceneId = `split_screen_${Date.now()}`;
    const scenePath = path.join(__dirname, '../../revideo/scenes', `${sceneId}.tsx`);

    // Create the Revideo scene for split-screen video
    const sceneContent = this.generateRevideoScene({
      mainVideoPath: config.mainVideoPath,
      backgroundVideoPath: config.backgroundVideoPath,
      audioSourcePath: config.audioSourcePath,
      subtitleData: config.subtitleData,
      style,
      sceneId
    });

    // Write the scene file
    await fs.writeFile(scenePath, sceneContent);
    console.log(`[SplitScreen] Scene file created: ${scenePath}`);

    // Render the video using FFmpeg
    await this.renderVideo(sceneId, config.outputPath, {
      mainVideoPath: config.mainVideoPath,
      backgroundVideoPath: config.backgroundVideoPath
    });
  }

  private generateRevideoScene(params: {
    mainVideoPath: string;
    backgroundVideoPath: string;
    audioSourcePath: string;
    subtitleData: any[];
    style: SubtitleStyle;
    sceneId: string;
  }): string {
    const { mainVideoPath, backgroundVideoPath, audioSourcePath, subtitleData, style, sceneId } = params;

    return `import {makeScene2D} from '@revideo/2d';
import {Audio, Video, Txt, Layout, Rect} from '@revideo/2d/lib/components';
import {createRef, Reference} from '@revideo/core/lib/utils';
import {all, sequence, waitFor} from '@revideo/core/lib/flow';
import {slideTransition} from '@revideo/core/lib/transitions';
import {Direction} from '@revideo/core/lib/types';
import {createSignal} from '@revideo/core/lib/signals';

export default makeScene2D(function* (view) {
  // Layout setup for split screen
  const layout = createRef<Layout>();
  const mainVideo = createRef<Video>();
  const backgroundVideo = createRef<Video>();
  const mainVideoRect = createRef<Rect>();
  const backgroundVideoRect = createRef<Rect>();
  const subtitleText = createRef<Txt>();
  const subtitleContainer = createRef<Layout>();

  // Create signals for dynamic content
  const currentText = createSignal('');
  const currentWordIndex = createSignal(0);

  view.add(
    <Layout ref={layout} size={[1080, 1920]} layout>
      {/* Main Video (Top half) */}
      <Rect 
        ref={mainVideoRect}
        width={1080} 
        height={960} 
        y={-480}
        clip
        radius={20}
        stroke={'#333'}
        lineWidth={4}
      >
        <Video
          ref={mainVideo}
          src={'${mainVideoPath}'}
          size={[1080, 960]}
          play={true}
        />
      </Rect>

      {/* Background Video (Bottom half) */}
      <Rect 
        ref={backgroundVideoRect}
        width={1080} 
        height={960} 
        y={480}
        clip
        radius={20}
        stroke={'#333'}
        lineWidth={4}
      >
        <Video
          ref={backgroundVideo}
          src={'${backgroundVideoPath}'}
          size={[1080, 960]}
          play={true}
        />
      </Rect>

      {/* Subtitle Container - positioned at bottom for 9:16 format */}
      <Layout 
        ref={subtitleContainer}
        y={800}
        layout
        direction={'column'}
        alignItems={'center'}
        gap={20}
      >
        <Txt
          ref={subtitleText}
          text={currentText}
          fontSize={${style.fontSize}}
          fontWeight={${style.fontWeight}}
          fill={'${style.textColor}'}
          fontFamily={'${style.fontFamily}'}
          textAlign={'${style.textAlign}'}
          shadowColor={'${style.shadowColor}'}
          shadowBlur={${style.shadowBlur}}
          shadowOffset={[0, 4]}
          cache
        />
      </Layout>

      {/* Audio Source */}
      <Audio
        src={'${audioSourcePath}'}
        play={true}
        time={0}
      />
    </Layout>
  );

  // Initialize videos
  yield* all(
    mainVideo().play(),
    backgroundVideo().play(),
  );

  // Subtitle animation sequence
  ${this.generateSubtitleAnimations(subtitleData, style)}

  // Wait for video duration
  yield* waitFor(30); // Default 30 seconds, adjust based on actual video duration
});

// Helper function to create word highlighting
function* highlightWord(
  textRef: Reference<Txt>,
  words: string[],
  currentIndex: number,
  style: any
) {
  const highlightedText = words.map((word, index) => {
    if (index === currentIndex) {
      return \`<span style="color: ${style.currentWordColor}; background-color: ${style.currentWordBackgroundColor}; padding: 4px 8px; border-radius: 4px;">\${word}</span>\`;
    }
    return word;
  }).join(' ');

  textRef().text(highlightedText);
}
`;
  }

  private generateSubtitleAnimations(subtitleData: any[], style: SubtitleStyle): string {
    if (!subtitleData || subtitleData.length === 0) {
      return 'yield* waitFor(0.1);';
    }

    const animations = subtitleData.map((segment, segmentIndex) => {
      const words = segment.words || [];
      const segmentStart = words[0]?.start || 0;
      const segmentEnd = words[words.length - 1]?.end || segmentStart + 2;
      const segmentText = words.map((w: any) => w.punctuated_word).join(' ');

      const wordAnimations = words.map((word: any, wordIndex: number) => {
        const relativeStart = (word.start - segmentStart) * 1000; // Convert to milliseconds
        return `
    yield* waitFor(${relativeStart / 1000});
    currentWordIndex(${wordIndex});
    yield* highlightWord(subtitleText, [${words.map((w: any) => `'${w.punctuated_word}'`).join(', ')}], ${wordIndex}, {
      currentWordColor: '${style.currentWordColor}',
      currentWordBackgroundColor: '${style.currentWordBackgroundColor}'
    });`;
      }).join('');

      return `
  // Segment ${segmentIndex + 1}: "${segmentText}"
  yield* waitFor(${segmentStart});
  currentText('${segmentText}');
  ${style.fadeInAnimation ? `
  yield* subtitleText().opacity(0, 0);
  yield* subtitleText().opacity(1, 0.3);` : ''}
  ${wordAnimations}
  yield* waitFor(${segmentEnd - segmentStart});
  ${style.fadeInAnimation ? `yield* subtitleText().opacity(0, 0.3);` : ''}`;
    });

    return `
  // Start subtitle animations
  yield* sequence(0.1,
    ${animations.join(',\n    ')}
  );`;
  }

  private async renderVideo(sceneId: string, outputPath: string, config?: {
    mainVideoPath: string;
    backgroundVideoPath: string;
  }): Promise<void> {
    console.log(`[SplitScreen] Creating split-screen video using FFmpeg`);
    
    if (config) {
      await this.createSplitScreenVideo(config.mainVideoPath, config.backgroundVideoPath, outputPath);
    } else {
      // Fallback: extract from scene file
      const scenePath = path.join(__dirname, '../../revideo/scenes', `${sceneId}.tsx`);
      const sceneContent = await fs.readFile(scenePath, 'utf-8');
      
      const videoMatches = sceneContent.match(/src={'([^']+)'}/g);
      if (!videoMatches || videoMatches.length < 2) {
        throw new Error('Could not extract video paths from scene');
      }
      
      const mainVideoPath = videoMatches[0].match(/src={'([^']+)'}/)?.[1] || '';
      const backgroundVideoPath = videoMatches[1].match(/src={'([^']+)'}/)?.[1] || '';
      
      await this.createSplitScreenVideo(mainVideoPath, backgroundVideoPath, outputPath);
    }
  }

  private async createSplitScreenVideo(mainVideoPath: string, backgroundVideoPath: string, outputPath: string): Promise<void> {
    const { spawn } = await import('child_process');
    
    console.log(`[SplitScreen] Creating split-screen from: ${mainVideoPath} and ${backgroundVideoPath}`);
    
    // Create 9:16 split-screen video with top/bottom layout
    const ffmpegProcess = spawn('ffmpeg', [
      '-i', mainVideoPath,
      '-i', backgroundVideoPath,
      '-filter_complex', [
        // Scale and crop both videos to exactly fill 50% of screen (1080x960)
        '[0:v]scale=1080:960:force_original_aspect_ratio=increase,crop=1080:960[top]',
        '[1:v]scale=1080:960:force_original_aspect_ratio=increase,crop=1080:960[bottom]',
        // Stack them vertically to create 1080x1920 (9:16 format)
        '[top][bottom]vstack=inputs=2[v]'
      ].join(';'),
      '-map', '[v]',
      '-map', '0:a?', // Use audio from first video if available
      '-c:v', 'libx264',
      '-preset', 'medium',
      '-crf', '23',
      '-c:a', 'aac',
      '-b:a', '128k',
      '-t', '30', // Limit to 30 seconds
      '-y',
      outputPath
    ], { stdio: 'pipe' });

    await new Promise((resolve, reject) => {
      ffmpegProcess.on('close', (code) => {
        if (code === 0) {
          console.log(`[SplitScreen] Split-screen video created: ${outputPath}`);
          resolve(undefined);
        } else {
          console.error(`[SplitScreen] FFmpeg failed with code ${code}`);
          reject(new Error(`FFmpeg failed with code ${code}`));
        }
      });

      ffmpegProcess.on('error', (error) => {
        console.error(`[SplitScreen] FFmpeg error:`, error);
        reject(error);
      });

      ffmpegProcess.stderr?.on('data', (data) => {
        console.log(`[SplitScreen] FFmpeg: ${data.toString()}`);
      });
    });
  }
}