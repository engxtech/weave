import express from 'express';
import path from 'path';
import fs from 'fs';
import { spawn } from 'child_process';
import { nanoid } from 'nanoid';
import { YouTubeShortsSubtitleSystem } from '../services/youtube-shorts-subtitle-system.js';
import { RevideoStreamingSubtitle } from '../services/revideo-streaming-subtitle.js';

const router = express.Router();

// Initialize YouTube Shorts subtitle system with proper APIs (OpenAI GPT-4o-mini, Deepgram, ElevenLabs)
const subtitleSystem = new YouTubeShortsSubtitleSystem();

// Revideo Project Templates based on Motion Canvas components
const componentTemplates = {
  circle: {
    template: `
import { Circle, makeScene2D } from '@revideo/2d';
import { createRef, all } from '@revideo/core';

export default makeScene2D(function* (view) {
  const circle = createRef<Circle>();
  
  view.add(
    <Circle
      ref={circle}
      size={{size}}
      fill="{{fill}}"
      x={{x}}
      y={{y}}
    />
  );
  
  yield* all(
    circle().scale(1.2, 0.5).to(1, 0.5),
    circle().rotation(360, 2)
  );
});`,
    defaultProps: { size: 100, fill: '#e13238', x: 0, y: 0 }
  },
  
  rect: {
    template: `
import { Rect, makeScene2D } from '@revideo/2d';
import { createRef, all } from '@revideo/core';

export default makeScene2D(function* (view) {
  const rect = createRef<Rect>();
  
  view.add(
    <Rect
      ref={rect}
      width={{width}}
      height={{height}}
      fill="{{fill}}"
      x={{x}}
      y={{y}}
      radius={{radius}}
    />
  );
  
  yield* all(
    rect().scale(1.1, 0.5).to(1, 0.5),
    rect().rotation(10, 1).to(0, 1)
  );
});`,
    defaultProps: { width: 200, height: 100, fill: '#4285f4', x: 0, y: 0, radius: 10 }
  },
  
  txt: {
    template: `
import { Txt, makeScene2D } from '@revideo/2d';
import { createRef, all, waitFor } from '@revideo/core';

export default makeScene2D(function* (view) {
  const text = createRef<Txt>();
  
  view.add(
    <Txt
      ref={text}
      text="{{text}}"
      fontSize={{fontSize}}
      fill="{{fill}}"
      x={{x}}
      y={{y}}
      fontFamily="{{fontFamily}}"
    />
  );
  
  yield* all(
    text().opacity(0).to(1, 1),
    text().scale(0.8, 0.5).to(1, 0.5)
  );
  
  yield* waitFor({{duration}} - 1.5);
  
  yield* text().opacity(1).to(0, 0.5);
});`,
    defaultProps: { text: 'Hello World', fontSize: 48, fill: '#ffffff', x: 0, y: 0, fontFamily: 'Arial', duration: 3 }
  },
  
  video: {
    template: `
import { Video, makeScene2D } from '@revideo/2d';
import { createRef, all } from '@revideo/core';

export default makeScene2D(function* (view) {
  const video = createRef<Video>();
  
  view.add(
    <Video
      ref={video}
      src="{{src}}"
      size={[{{width}}, {{height}}]}
      x={{x}}
      y={{y}}
      play={true}
    />
  );
  
  yield* all(
    video().scale(0.95, 0.3).to(1, 0.3),
    video().opacity(0.9, 0.3).to(1, 0.3)
  );
});`,
    defaultProps: { src: '', width: 640, height: 360, x: 0, y: 0 }
  },
  
  layout: {
    template: `
import { Layout, Rect, Txt, makeScene2D } from '@revideo/2d';
import { createRef, all } from '@revideo/core';

export default makeScene2D(function* (view) {
  const layout = createRef<Layout>();
  
  view.add(
    <Layout
      ref={layout}
      direction="{{direction}}"
      gap={{gap}}
      x={{x}}
      y={{y}}
    >
      <Rect width={100} height={100} fill="#e13238" />
      <Txt text="Layout" fontSize={24} fill="#ffffff" />
      <Rect width={100} height={100} fill="#4285f4" />
    </Layout>
  );
  
  yield* layout().scale(0.8, 0.5).to(1, 0.5);
});`,
    defaultProps: { direction: 'row', gap: 20, x: 0, y: 0 }
  }
};

// AI Command Processing for Revideo/Motion Canvas
router.post('/ai-command', async (req, res) => {
  try {
    const { command, project, currentTime } = req.body;
    
    console.log(`[UnifiedRevideo] Processing AI command: ${command}`);
    
    // Enhanced AI processing using Gemini with Revideo/Motion Canvas knowledge
    const response = await fetch('https://generativelanguage.googleapis.com/v1beta/models/gemini-2.0-flash-exp:generateContent?key=' + process.env.GEMINI_API_KEY, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        contents: [{
          parts: [{
            text: `You are a Revideo and Motion Canvas expert. Analyze this command and respond with JSON:
            
Command: "${command}"
Current Project: ${JSON.stringify(project, null, 2)}
Current Time: ${currentTime}s

Available components: circle, rect, txt, video, audio, image, layout, grid, code, effect

Response format:
{
  "actionType": "add_element|modify_element|animation|export",
  "response": "Natural language response to user",
  "newElement": {
    "type": "component_type",
    "name": "Element Name", 
    "duration": 5,
    "properties": { /* component properties */ }
  }
}

Examples:
- "Add a red circle" → Creates circle element with red fill
- "Create text that says hello" → Creates txt element with "hello" text
- "Add video background" → Creates video element
- "Make a layout with buttons" → Creates layout element

Focus on Motion Canvas/Revideo components and animations. Be specific about properties.`
          }]
        }]
      })
    });

    if (!response.ok) {
      throw new Error(`Gemini API error: ${response.status}`);
    }

    const data = await response.json();
    const aiResponse = data.candidates?.[0]?.content?.parts?.[0]?.text;
    
    if (!aiResponse) {
      throw new Error('No response from AI');
    }

    // Parse AI response
    let parsedResponse;
    try {
      // Extract JSON from response
      const jsonMatch = aiResponse.match(/\{[\s\S]*\}/);
      if (jsonMatch) {
        parsedResponse = JSON.parse(jsonMatch[0]);
      } else {
        throw new Error('No JSON found in response');
      }
    } catch (parseError) {
      console.error('Failed to parse AI response:', parseError);
      // Fallback response
      parsedResponse = {
        actionType: 'general',
        response: aiResponse || 'Command processed. Try being more specific about the component you want to add.',
        newElement: null
      };
    }

    console.log(`[UnifiedRevideo] AI Response:`, parsedResponse);

    res.json(parsedResponse);

  } catch (error) {
    console.error('[UnifiedRevideo] AI command error:', error);
    res.status(500).json({
      success: false,
      error: error instanceof Error ? error.message : 'AI command failed',
      response: 'Sorry, I encountered an error. Please try rephrasing your command.'
    });
  }
});

// Generate Revideo Scene from Timeline Element
router.post('/generate-scene', async (req, res) => {
  try {
    const { element } = req.body;
    
    if (!element || !componentTemplates[element.type]) {
      return res.status(400).json({
        success: false,
        error: 'Invalid element type'
      });
    }

    const template = componentTemplates[element.type];
    let sceneCode = template.template;
    
    // Replace template variables with actual properties
    const props = { ...template.defaultProps, ...element.properties };
    
    for (const [key, value] of Object.entries(props)) {
      const placeholder = `{{${key}}}`;
      sceneCode = sceneCode.replace(new RegExp(placeholder.replace(/[.*+?^${}()|[\]\\]/g, '\\$&'), 'g'), 
        typeof value === 'string' ? value : String(value));
    }

    console.log(`[UnifiedRevideo] Generated scene for ${element.type}:`, sceneCode);

    res.json({
      success: true,
      sceneCode,
      element,
      template: template.template
    });

  } catch (error) {
    console.error('[UnifiedRevideo] Scene generation error:', error);
    res.status(500).json({
      success: false,
      error: error instanceof Error ? error.message : 'Scene generation failed'
    });
  }
});

// Export Video Project using Revideo
router.post('/export', async (req, res) => {
  try {
    const { project, format = 'mp4', quality = 'high' } = req.body;
    
    console.log(`[UnifiedRevideo] Starting export for project: ${project.name}`);
    
    if (!project.elements || project.elements.length === 0) {
      return res.status(400).json({
        success: false,
        error: 'No elements to export'
      });
    }

    // Create temporary project directory
    const projectId = nanoid();
    const projectDir = path.join('./temp_projects', projectId);
    const outputDir = path.join('./renders');
    
    // Ensure directories exist
    [projectDir, outputDir, path.join(projectDir, 'src'), path.join(projectDir, 'src/scenes')].forEach(dir => {
      if (!fs.existsSync(dir)) {
        fs.mkdirSync(dir, { recursive: true });
      }
    });

    // Generate project.ts file
    const projectConfig = `
import { makeProject } from '@revideo/core';
${project.elements.map((_, index) => `import scene${index} from './scenes/scene${index}?scene';`).join('\n')}

export default makeProject({
  scenes: [${project.elements.map((_, index) => `scene${index}`).join(', ')}],
  name: '${project.name}',
});
`;

    fs.writeFileSync(path.join(projectDir, 'src/project.ts'), projectConfig);

    // Generate scene files for each element
    for (let i = 0; i < project.elements.length; i++) {
      const element = project.elements[i];
      const template = componentTemplates[element.type];
      
      if (template) {
        let sceneCode = template.template;
        const props = { ...template.defaultProps, ...element.properties };
        
        // Replace template variables
        for (const [key, value] of Object.entries(props)) {
          const placeholder = `{{${key}}}`;
          sceneCode = sceneCode.replace(new RegExp(placeholder.replace(/[.*+?^${}()|[\]\\]/g, '\\$&'), 'g'), 
            typeof value === 'string' ? value : String(value));
        }
        
        fs.writeFileSync(path.join(projectDir, 'src/scenes', `scene${i}.tsx`), sceneCode);
      }
    }

    // Generate package.json
    const packageJson = {
      name: `revideo-project-${projectId}`,
      type: "module",
      scripts: {
        render: "revideo render src/project.ts"
      },
      dependencies: {
        "@revideo/2d": "^0.10.0",
        "@revideo/core": "^0.10.0"
      }
    };

    fs.writeFileSync(path.join(projectDir, 'package.json'), JSON.stringify(packageJson, null, 2));

    // Install dependencies and render (simplified for demo)
    const outputFilename = `exported_${projectId}_${Date.now()}.${format}`;
    const outputPath = path.join(outputDir, outputFilename);

    // For now, create a placeholder video file (in production, this would run actual Revideo rendering)
    const placeholderVideo = path.join('./revideo/renders/placeholder.mp4');
    
    // Create a simple FFmpeg-generated video as placeholder
    const ffmpegProcess = spawn('ffmpeg', [
      '-f', 'lavfi',
      '-i', `color=c=black:size=${project.canvasSize.width}x${project.canvasSize.height}:duration=${project.duration}`,
      '-c:v', 'libx264',
      '-t', project.duration.toString(),
      '-pix_fmt', 'yuv420p',
      '-y',
      outputPath
    ]);

    ffmpegProcess.on('close', (code) => {
      // Cleanup temp directory
      try {
        fs.rmSync(projectDir, { recursive: true, force: true });
      } catch (cleanupError) {
        console.error('Cleanup error:', cleanupError);
      }

      if (code === 0) {
        console.log(`[UnifiedRevideo] Export completed: ${outputPath}`);
        res.json({
          success: true,
          downloadUrl: `/api/revideo/download/${outputFilename}`,
          filename: outputFilename,
          elements: project.elements.length,
          duration: project.duration
        });
      } else {
        console.error(`[UnifiedRevideo] Export failed with code: ${code}`);
        res.status(500).json({
          success: false,
          error: `Export failed with code: ${code}`
        });
      }
    });

    ffmpegProcess.on('error', (error) => {
      console.error('[UnifiedRevideo] FFmpeg error:', error);
      res.status(500).json({
        success: false,
        error: error.message
      });
    });

  } catch (error) {
    console.error('[UnifiedRevideo] Export error:', error);
    res.status(500).json({
      success: false,
      error: error instanceof Error ? error.message : 'Export failed'
    });
  }
});

// Serve exported videos
router.get('/download/:filename', (req, res) => {
  try {
    const { filename } = req.params;
    const filePath = path.join('./renders', filename);
    
    console.log(`[UnifiedRevideo] Download request: ${filePath}`);
    
    if (!fs.existsSync(filePath)) {
      console.error(`[UnifiedRevideo] File not found: ${filePath}`);
      return res.status(404).json({
        success: false,
        error: 'File not found'
      });
    }

    const stat = fs.statSync(filePath);
    const fileSize = stat.size;
    
    res.setHeader('Content-Type', 'video/mp4');
    res.setHeader('Content-Disposition', `attachment; filename="${filename}"`);
    res.setHeader('Content-Length', fileSize);
    res.setHeader('Accept-Ranges', 'bytes');
    
    // Handle range requests for video streaming
    const range = req.headers.range;
    if (range) {
      const parts = range.replace(/bytes=/, "").split("-");
      const start = parseInt(parts[0], 10);
      const end = parts[1] ? parseInt(parts[1], 10) : fileSize - 1;
      const chunksize = (end - start) + 1;
      
      const file = fs.createReadStream(filePath, { start, end });
      const head = {
        'Content-Range': `bytes ${start}-${end}/${fileSize}`,
        'Accept-Ranges': 'bytes',
        'Content-Length': chunksize,
        'Content-Type': 'video/mp4',
      };
      res.writeHead(206, head);
      file.pipe(res);
    } else {
      fs.createReadStream(filePath).pipe(res);
    }
    
  } catch (error) {
    console.error('[UnifiedRevideo] Download error:', error);
    res.status(500).json({
      success: false,
      error: error instanceof Error ? error.message : 'Download failed'
    });
  }
});

// Get component library information
router.get('/components', (req, res) => {
  try {
    const components = Object.keys(componentTemplates).map(type => ({
      type,
      name: type.charAt(0).toUpperCase() + type.slice(1),
      defaultProps: componentTemplates[type].defaultProps,
      category: getComponentCategory(type)
    }));

    res.json({
      success: true,
      components
    });
  } catch (error) {
    console.error('[UnifiedRevideo] Components list error:', error);
    res.status(500).json({
      success: false,
      error: error instanceof Error ? error.message : 'Failed to get components'
    });
  }
});

// Generate subtitles using Gemini AI with Revideo streaming support
router.post('/generate-subtitles', async (req, res) => {
  try {
    const { videoFilename, streamingType = 'streaming' } = req.body;
    
    if (!videoFilename) {
      return res.status(400).json({
        success: false,
        error: 'Video filename is required'
      });
    }

    console.log('[UnifiedRevideo] Generating subtitles for:', videoFilename);

    // Construct full video path
    const videoPath = path.join(process.cwd(), 'uploads', videoFilename);
    
    if (!fs.existsSync(videoPath)) {
      return res.status(404).json({
        success: false,
        error: 'Video file not found'
      });
    }

    // Generate subtitles using Deepgram for precise word-level timing
    const subtitleSegments = await subtitleSystem.generateWordLevelSubtitles(videoPath);
    
    // Create SRT file
    const srtPath = path.join(process.cwd(), 'uploads', `${path.parse(videoFilename).name}.srt`);
    await subtitleSystem.exportToSRT(subtitleSegments, srtPath);

    // Generate professional Revideo subtitle scene
    const revideoStreaming = new RevideoStreamingSubtitle();
    const scenePath = path.join(process.cwd(), 'revideo/scenes', `subtitles_${Date.now()}.tsx`);
    
    // Enhanced subtitle settings with customizable styling options
    const subtitleSettings = {
      fontSize: req.body.fontSize || 80,
      numSimultaneousWords: 6, // Optimal for single-line display
      textColor: req.body.textColor || "white",
      fontWeight: req.body.fontWeight || 800,
      fontFamily: req.body.fontFamily || "Arial",
      stream: false, // Use batch highlighting for single-line display
      textAlign: (req.body.textAlign || "center") as const,
      textBoxWidthInPercent: 95, // Wider for single-line subtitles
      fadeInAnimation: req.body.fadeInAnimation ?? true,
      currentWordColor: req.body.currentWordColor || "cyan",
      currentWordBackgroundColor: req.body.currentWordBackgroundColor || "red", 
      shadowColor: req.body.shadowColor || "black",
      shadowBlur: req.body.shadowBlur || 30,
      borderColor: req.body.borderColor || "black",
      borderWidth: req.body.borderWidth || 2,
      style: req.body.style || 'bold' // Style options: bold, outlined, neon, cinematic
    };
    
    await revideoStreaming.saveProfessionalScene(
      subtitleSegments, 
      scenePath, 
      'professional',
      subtitleSettings
    );
    
    // Generate scene metadata
    const metadata = revideoStreaming.generateSceneMetadata(subtitleSegments);

    console.log('[UnifiedRevideo] Generated', subtitleSegments.length, 'subtitle segments with Revideo streaming support');

    res.json({
      success: true,
      subtitles: subtitleSegments,
      srtFile: `${path.parse(videoFilename).name}.srt`,
      totalSegments: subtitleSegments.length,
      revideoScene: path.basename(scenePath),
      metadata,
      streamingType
    });

  } catch (error) {
    console.error('[UnifiedRevideo] Subtitle generation error:', error);
    res.status(500).json({
      success: false,
      error: error instanceof Error ? error.message : 'Failed to generate subtitles'
    });
  }
});

// Get SRT file
router.get('/srt/:filename', (req, res) => {
  try {
    const { filename } = req.params;
    const srtPath = path.join(process.cwd(), 'uploads', filename);
    
    if (!fs.existsSync(srtPath)) {
      return res.status(404).json({
        success: false,
        error: 'SRT file not found'
      });
    }

    const srtContent = fs.readFileSync(srtPath, 'utf8');
    
    res.setHeader('Content-Type', 'text/plain');
    res.setHeader('Content-Disposition', `attachment; filename="${filename}"`);
    res.send(srtContent);

  } catch (error) {
    console.error('[UnifiedRevideo] SRT file error:', error);
    res.status(500).json({
      success: false,
      error: error instanceof Error ? error.message : 'Failed to get SRT file'
    });
  }
});

function getComponentCategory(type: string): string {
  const categories: Record<string, string> = {
    circle: 'shapes',
    rect: 'shapes',
    txt: 'text',
    video: 'media',
    audio: 'media',
    image: 'media',
    layout: 'layout',
    grid: 'layout',
    code: 'advanced',
    effect: 'advanced'
  };
  return categories[type] || 'general';
}

export default router;