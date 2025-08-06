import { makeProject } from '@revideo/core';
import { NodeVideoEditor as NodeVideoEditorScene } from './revideo-scenes/NodeVideoEditor';
import { renderVideo } from '@revideo/renderer';
import path from 'path';
import fs from 'fs/promises';

export interface RevideoPreviewConfig {
  nodeType: string;
  inputVideo?: string;
  outputPath?: string;
  nodeConfig: any;
}

export class RevideoPreviewService {
  private projectsDir: string;
  
  constructor() {
    this.projectsDir = path.join(process.cwd(), 'revideo-projects');
  }

  async generatePreview(config: RevideoPreviewConfig): Promise<{
    previewPath: string;
    thumbnailPath: string;
  }> {
    console.log('🎬 Generating Revideo preview for node:', config.nodeType);
    
    // Ensure projects directory exists
    await fs.mkdir(this.projectsDir, { recursive: true });
    
    // Create project for the specific node type
    const project = await this.createNodeProject(config);
    
    // Render preview
    const outputPath = path.join(this.projectsDir, `preview_${Date.now()}.mp4`);
    const thumbnailPath = path.join(this.projectsDir, `thumb_${Date.now()}.jpg`);
    
    try {
      // Render video preview
      await renderVideo({
        projectFile: project,
        variables: {
          inputVideo: config.inputVideo,
          nodeConfig: config.nodeConfig
        },
        output: outputPath,
        logProgress: true
      });
      
      // Generate thumbnail from first frame
      await this.generateThumbnail(outputPath, thumbnailPath);
      
      return {
        previewPath: outputPath,
        thumbnailPath
      };
    } catch (error) {
      console.error('Failed to render Revideo preview:', error);
      throw error;
    }
  }

  private async createNodeProject(config: RevideoPreviewConfig): Promise<any> {
    // Create dynamic scene based on node type
    switch (config.nodeType) {
      case 'shorts':
        return this.createShortsPreview(config);
      case 'voice':
        return this.createVoicePreview(config);
      case 'captions':
        return this.createCaptionsPreview(config);
      case 'reframe':
        return this.createReframePreview(config);
      case 'cut':
        return this.createCutPreview(config);
      case 'background':
        return this.createBackgroundPreview(config);
      case 'broll':
        return this.createBRollPreview(config);
      case 'music':
        return this.createMusicPreview(config);
      default:
        return this.createDefaultPreview(config);
    }
  }

  private async createShortsPreview(config: RevideoPreviewConfig) {
    const sceneCode = `
      import {makeScene2D, Video, Txt, Rect} from '@revideo/2d';
      import {all, createRef, waitFor} from '@revideo/core';
      
      export default makeScene2D(function* (view) {
        const video = createRef<Video>();
        const title = createRef<Txt>();
        
        view.add(
          <>
            <Video
              ref={video}
              src={'${config.inputVideo || ''}'}
              width={1080}
              height={1920}
              radius={20}
            />
            <Rect
              width={1080}
              height={200}
              y={-860}
              fill={'rgba(0,0,0,0.8)'}
              radius={[20, 20, 0, 0]}
            >
              <Txt
                ref={title}
                text={'Shorts Preview'}
                fontSize={60}
                fontWeight={700}
                fill={'white'}
              />
            </Rect>
          </>
        );
        
        yield* all(
          video().play(),
          title().opacity(0).opacity(1, 0.5)
        );
        
        yield* waitFor(5);
      });
    `;
    
    return this.createProjectFromScene(sceneCode);
  }

  private async createVoicePreview(config: RevideoPreviewConfig) {
    const sceneCode = `
      import {makeScene2D, Video, Txt, Rect, Icon} from '@revideo/2d';
      import {all, createRef, waitFor} from '@revideo/core';
      
      export default makeScene2D(function* (view) {
        const video = createRef<Video>();
        
        view.add(
          <>
            <Video
              ref={video}
              src={'${config.inputVideo || ''}'}
              width={1920}
              height={1080}
            />
            <Rect
              width={400}
              height={100}
              x={-660}
              y={-440}
              fill={'rgba(139, 92, 246, 0.9)'}
              radius={50}
            >
              <Txt
                text={'${config.nodeConfig?.targetLanguage || 'Translation'} Voice'}
                fontSize={40}
                fontWeight={600}
                fill={'white'}
              />
            </Rect>
          </>
        );
        
        yield* video().play();
        yield* waitFor(5);
      });
    `;
    
    return this.createProjectFromScene(sceneCode);
  }

  private async createCaptionsPreview(config: RevideoPreviewConfig) {
    const sceneCode = `
      import {makeScene2D, Video, Txt, Rect} from '@revideo/2d';
      import {all, createRef, waitFor, loop} from '@revideo/core';
      
      export default makeScene2D(function* (view) {
        const video = createRef<Video>();
        const caption = createRef<Txt>();
        
        view.add(
          <>
            <Video
              ref={video}
              src={'${config.inputVideo || ''}'}
              width={1920}
              height={1080}
            />
            <Rect
              width={1600}
              height={120}
              y={400}
              fill={'rgba(0,0,0,0.8)'}
              radius={10}
            >
              <Txt
                ref={caption}
                text={'Sample Caption Text'}
                fontSize={${config.nodeConfig?.captionSize || 48}}
                fontWeight={700}
                fill={'${config.nodeConfig?.highlightColor || '#00FFFF'}'}
              />
            </Rect>
          </>
        );
        
        yield* video().play();
        
        // Animate caption
        yield* loop(3, () => 
          caption().text('This is an example caption', 0.5).to('showing dynamic text', 0.5)
        );
        
        yield* waitFor(2);
      });
    `;
    
    return this.createProjectFromScene(sceneCode);
  }

  private async createReframePreview(config: RevideoPreviewConfig) {
    const aspectRatio = config.nodeConfig?.aspectRatio || '9:16';
    const [widthRatio, heightRatio] = aspectRatio.split(':').map(Number);
    const targetWidth = 1080;
    const targetHeight = (targetWidth * heightRatio) / widthRatio;
    
    const sceneCode = `
      import {makeScene2D, Video, Rect} from '@revideo/2d';
      import {all, createRef, waitFor} from '@revideo/core';
      
      export default makeScene2D(function* (view) {
        const video = createRef<Video>();
        const frame = createRef<Rect>();
        
        view.add(
          <>
            <Rect
              ref={frame}
              width={${targetWidth}}
              height={${targetHeight}}
              stroke={'#ef4444'}
              lineWidth={4}
              fill={'transparent'}
            />
            <Video
              ref={video}
              src={'${config.inputVideo || ''}'}
              width={${targetWidth}}
              height={${targetHeight}}
            />
          </>
        );
        
        yield* all(
          video().play(),
          frame().scale(0.8).scale(1, 0.5)
        );
        
        yield* waitFor(5);
      });
    `;
    
    return this.createProjectFromScene(sceneCode);
  }

  private async createCutPreview(config: RevideoPreviewConfig) {
    const sceneCode = `
      import {makeScene2D, Video, Txt, Rect} from '@revideo/2d';
      import {all, createRef, waitFor} from '@revideo/core';
      
      export default makeScene2D(function* (view) {
        const video = createRef<Video>();
        
        view.add(
          <>
            <Video
              ref={video}
              src={'${config.inputVideo || ''}'}
              width={1920}
              height={1080}
            />
            <Rect
              width={600}
              height={80}
              y={-450}
              fill={'rgba(239, 68, 68, 0.9)'}
              radius={40}
            >
              <Txt
                text={'✂️ Cuts Applied'}
                fontSize={36}
                fontWeight={600}
                fill={'white'}
              />
            </Rect>
          </>
        );
        
        yield* video().play();
        yield* waitFor(5);
      });
    `;
    
    return this.createProjectFromScene(sceneCode);
  }

  private async createBackgroundPreview(config: RevideoPreviewConfig) {
    const bgColor = config.nodeConfig?.backgroundColor || '#10b981';
    
    const sceneCode = `
      import {makeScene2D, Video, Rect} from '@revideo/2d';
      import {all, createRef, waitFor} from '@revideo/core';
      
      export default makeScene2D(function* (view) {
        const video = createRef<Video>();
        const bg = createRef<Rect>();
        
        view.add(
          <>
            <Rect
              ref={bg}
              width={1920}
              height={1080}
              fill={'${bgColor}'}
            />
            <Video
              ref={video}
              src={'${config.inputVideo || ''}'}
              width={1920}
              height={1080}
              compositeOperation={'source-atop'}
            />
          </>
        );
        
        yield* all(
          video().play(),
          bg().opacity(0.5).opacity(1, 1)
        );
        
        yield* waitFor(5);
      });
    `;
    
    return this.createProjectFromScene(sceneCode);
  }

  private async createBRollPreview(config: RevideoPreviewConfig) {
    const sceneCode = `
      import {makeScene2D, Video, Txt, Rect, Img} from '@revideo/2d';
      import {all, createRef, waitFor, chain} from '@revideo/core';
      
      export default makeScene2D(function* (view) {
        const video = createRef<Video>();
        const brollOverlay = createRef<Rect>();
        
        view.add(
          <>
            <Video
              ref={video}
              src={'${config.inputVideo || ''}'}
              width={1920}
              height={1080}
            />
            <Rect
              ref={brollOverlay}
              width={600}
              height={400}
              x={500}
              y={200}
              fill={'rgba(99, 102, 241, 0.9)'}
              radius={20}
              scale={0}
            >
              <Txt
                text={'B-Roll Content'}
                fontSize={48}
                fontWeight={700}
                fill={'white'}
              />
            </Rect>
          </>
        );
        
        yield* video().play();
        
        yield* chain(
          waitFor(1),
          brollOverlay().scale(1, 0.5),
          waitFor(2),
          brollOverlay().scale(0, 0.5)
        );
        
        yield* waitFor(1);
      });
    `;
    
    return this.createProjectFromScene(sceneCode);
  }

  private async createMusicPreview(config: RevideoPreviewConfig) {
    const sceneCode = `
      import {makeScene2D, Video, Txt, Rect, Circle} from '@revideo/2d';
      import {all, createRef, waitFor, loop} from '@revideo/core';
      
      export default makeScene2D(function* (view) {
        const video = createRef<Video>();
        const musicIcon = createRef<Circle>();
        
        view.add(
          <>
            <Video
              ref={video}
              src={'${config.inputVideo || ''}'}
              width={1920}
              height={1080}
            />
            <Circle
              ref={musicIcon}
              size={120}
              x={-750}
              y={450}
              fill={'rgba(236, 72, 153, 0.9)'}
            >
              <Txt
                text={'♪'}
                fontSize={60}
                fill={'white'}
              />
            </Circle>
          </>
        );
        
        yield* video().play();
        
        yield* loop(5, () => 
          musicIcon().scale(1.2, 0.3).to(1, 0.3)
        );
      });
    `;
    
    return this.createProjectFromScene(sceneCode);
  }

  private async createDefaultPreview(config: RevideoPreviewConfig) {
    const sceneCode = `
      import {makeScene2D, Video, Txt} from '@revideo/2d';
      import {createRef, waitFor} from '@revideo/core';
      
      export default makeScene2D(function* (view) {
        const video = createRef<Video>();
        
        view.add(
          <Video
            ref={video}
            src={'${config.inputVideo || ''}'}
            width={1920}
            height={1080}
          />
        );
        
        yield* video().play();
        yield* waitFor(5);
      });
    `;
    
    return this.createProjectFromScene(sceneCode);
  }

  private createProjectFromScene(sceneCode: string): any {
    // This would typically compile the scene code and return a Revideo project
    // For now, we'll return a placeholder
    return {
      sceneCode,
      name: 'preview',
      scenes: []
    };
  }

  private async generateThumbnail(videoPath: string, thumbnailPath: string): Promise<void> {
    // Use FFmpeg to extract first frame as thumbnail
    const ffmpeg = require('fluent-ffmpeg');
    
    return new Promise((resolve, reject) => {
      ffmpeg(videoPath)
        .screenshots({
          timestamps: ['00:00:01'],
          filename: path.basename(thumbnailPath),
          folder: path.dirname(thumbnailPath),
          size: '320x180'
        })
        .on('end', resolve)
        .on('error', reject);
    });
  }
}