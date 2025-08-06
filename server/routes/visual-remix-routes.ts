import { Express } from 'express';
import { VisualRemixService } from '../services/visual-remix-service.js';
import { EnhancedAIShortsGenerator } from '../services/enhanced-ai-shorts-generator.js';
import multer from 'multer';
import path from 'path';
import { nanoid } from 'nanoid';
import { promises as fs, createReadStream } from 'fs';
import { GoogleGenerativeAI } from '@google/generative-ai';
import { spawn } from 'child_process';
import ffmpeg from 'fluent-ffmpeg';

const genAI = new GoogleGenerativeAI(process.env.GEMINI_API_KEY || '');

const upload = multer({
  storage: multer.diskStorage({
    destination: 'uploads/',
    filename: (req, file, cb) => {
      const uniqueId = nanoid();
      const ext = path.extname(file.originalname);
      cb(null, `${uniqueId}${ext}`);
    }
  }),
  limits: { fileSize: 500 * 1024 * 1024 } // 500MB limit
});

// Helper function to generate images using Gemini
async function generateImage(prompt: string, imagePath: string): Promise<boolean> {
  try {
    // Use the visual remix service which has proper image generation setup
    const remixService = new VisualRemixService();
    
    // Generate image using the service's method which handles the complexity
    const result = await remixService.generateImageFromPrompt('style', prompt);
    
    if (result.success && result.imagePath) {
      // Copy the generated image to the desired path
      const imageData = await fs.readFile(result.imagePath);
      await fs.writeFile(imagePath, imageData);
      console.log(`Image saved as ${imagePath}`);
      return true;
    }
    
    return false;
  } catch (error) {
    console.error(`Failed to generate image: ${error}`);
    return false;
  }
}

export default function visualRemixRoutes(app: Express) {
  const remixService = new VisualRemixService();
  
  /**
   * Enhance a scene with AI
   */
  app.post('/api/visual-remix/enhance-scene', async (req, res) => {
    try {
      const { scene } = req.body;
      
      if (!scene) {
        return res.status(400).json({ error: 'Scene data is required' });
      }
      
      const enhancedScene = await remixService.enhanceScene(scene);
      
      res.json({ enhancedScene });
    } catch (error) {
      console.error('Error enhancing scene:', error);
      res.status(500).json({ 
        error: 'Failed to enhance scene',
        message: error instanceof Error ? error.message : 'Unknown error'
      });
    }
  });
  
  /**
   * Generate images from multiple scenes
   */
  app.post('/api/visual-remix/generate-scene-images', async (req, res) => {
    try {
      const { scenes, style, subject } = req.body;
      
      if (!scenes || !Array.isArray(scenes) || scenes.length === 0) {
        return res.status(400).json({ error: 'Scenes array is required' });
      }
      
      const images = await remixService.generateSceneImages(scenes, { style, subject });
      
      res.json({ images });
    } catch (error) {
      console.error('Error generating scene images:', error);
      res.status(500).json({ 
        error: 'Failed to generate scene images',
        message: error instanceof Error ? error.message : 'Unknown error'
      });
    }
  });

  /**
   * Extract a frame from video at specified time
   */
  app.post('/api/visual-remix/extract-frame', async (req, res) => {
    try {
      const { videoPath, time } = req.body;
      
      if (!videoPath || time === undefined) {
        return res.status(400).json({ error: 'Missing videoPath or time' });
      }
      
      const framePath = await remixService.extractFrame(videoPath, time);
      
      res.json({
        success: true,
        framePath: framePath.replace('temp_remix/', '/api/frames/')
      });
    } catch (error) {
      console.error('Error extracting frame:', error);
      res.status(500).json({ error: 'Failed to extract frame' });
    }
  });

  /**
   * Analyze a visual input (frame or uploaded image)
   */
  app.post('/api/visual-remix/analyze', upload.single('image'), async (req, res) => {
    try {
      const { type, imagePath } = req.body;
      const uploadedFile = req.file;
      
      if (!type || (!imagePath && !uploadedFile)) {
        return res.status(400).json({ error: 'Missing type or image' });
      }
      
      const pathToAnalyze = uploadedFile ? uploadedFile.path : imagePath;
      const description = await remixService.analyzeVisualInput(
        pathToAnalyze,
        type as 'subject' | 'scene' | 'style'
      );
      
      res.json({
        success: true,
        type,
        description,
        imagePath: pathToAnalyze
      });
    } catch (error) {
      console.error('Error analyzing visual input:', error);
      res.status(500).json({ error: 'Failed to analyze visual input' });
    }
  });

  /**
   * Generate a remix based on visual inputs
   */
  app.post('/api/visual-remix/generate', async (req, res) => {
    try {
      const { videoPath, subject, scene, style, additionalPrompt } = req.body;
      
      console.log('Remix request:', { videoPath, subject, scene, style, additionalPrompt });
      
      const result = await remixService.remix({
        videoPath,
        subject,
        scene,
        style,
        additionalPrompt
      });
      
      // Convert local paths to API paths
      if (result.generatedImagePath) {
        result.generatedImagePath = result.generatedImagePath.replace('remix_outputs/', '/api/remix/');
      }
      if (result.variations) {
        result.variations = result.variations.map(path => 
          path.replace('remix_outputs/', '/api/remix/')
        );
      }
      
      res.json({
        success: true,
        result
      });
    } catch (error) {
      console.error('Error generating remix:', error);
      res.status(500).json({ error: 'Failed to generate remix' });
    }
  });

  /**
   * Serve extracted frames
   */
  app.get('/api/frames/:filename', (req, res) => {
    const filePath = path.join('temp_remix', req.params.filename);
    res.sendFile(path.resolve(filePath));
  });

  /**
   * Serve remix outputs
   */
  app.get('/api/remix/:filename', (req, res) => {
    const filePath = path.join('remix_outputs', req.params.filename);
    res.sendFile(path.resolve(filePath));
  });

  /**
   * Serve generated videos
   */
  app.get('/api/videos/:filename', (req, res) => {
    const filePath = path.join('temp_remix', req.params.filename);
    res.sendFile(path.resolve(filePath));
  });
  
  /**
   * Serve generated images from visual remix
   */
  app.get('/api/visual-remix/images/:filename', (req, res) => {
    const filePath = path.join('remix_outputs', req.params.filename);
    res.sendFile(path.resolve(filePath));
  });

  /**
   * Generate image from text prompt
   */
  app.post('/api/visual-remix/generate-from-prompt', async (req, res) => {
    try {
      const { type, prompt } = req.body;
      
      if (!type || !prompt) {
        return res.status(400).json({ error: 'Missing type or prompt' });
      }
      
      const result = await remixService.generateImageFromPrompt(type, prompt);
      res.json(result);
    } catch (error) {
      console.error('Error generating image from prompt:', error);
      res.status(500).json({ 
        error: 'Failed to generate image',
        message: error instanceof Error ? error.message : 'Unknown error'
      });
    }
  });

  /**
   * Upload and analyze image
   */
  app.post('/api/visual-remix/upload-image', upload.single('image'), async (req, res) => {
    try {
      if (!req.file) {
        return res.status(400).json({ error: 'No image uploaded' });
      }

      const type = req.body.type as 'subject' | 'scene' | 'style';
      const imagePath = req.file.path;
      const imageUrl = `/api/frames/${path.basename(imagePath)}`;
      
      // Analyze the uploaded image
      const description = await remixService.analyzeVisualInput(imagePath, type);
      
      res.json({
        success: true,
        imagePath,
        imageUrl,
        description
      });
    } catch (error) {
      console.error('Error uploading image:', error);
      res.status(500).json({ 
        error: 'Failed to upload image',
        message: error instanceof Error ? error.message : 'Unknown error'
      });
    }
  });

  /**
   * Generate video from image using Veo model
   */
  app.post('/api/visual-remix/generate-video', async (req, res) => {
    try {
      let { imagePath, imageUrl, prompt, duration = 8, basePrompt } = req.body;
      
      // Handle both imagePath and imageUrl parameters
      if (!imagePath && imageUrl) {
        // Extract filename from URL and construct the path
        const filename = imageUrl.split('/').pop();
        if (filename) {
          imagePath = path.join('remix_outputs', filename);
        }
      }
      
      if (!imagePath || !prompt) {
        return res.status(400).json({ error: 'Missing required parameters: imagePath/imageUrl and prompt are required' });
      }
      
      const result = await remixService.generateVideoFromImage(
        imagePath, 
        prompt, 
        duration,
        basePrompt
      );
      
      res.json({
        success: true,
        videoUrl: `/api/videos/${path.basename(result.videoPath)}`,
        videoPath: result.videoPath
      });
    } catch (error) {
      console.error('Error generating video:', error);
      res.status(500).json({ 
        error: 'Failed to generate video',
        message: error instanceof Error ? error.message : 'Unknown error'
      });
    }
  });

  /**
   * Edit existing video with new prompt
   */
  app.post('/api/visual-remix/edit-video', async (req, res) => {
    try {
      const { videoPath, editPrompt, duration } = req.body;
      
      if (!videoPath || !editPrompt) {
        return res.status(400).json({ error: 'Missing required parameters' });
      }
      
      const result = await remixService.editVideoWithPrompt(
        videoPath,
        editPrompt,
        duration
      );
      
      res.json({
        success: true,
        videoUrl: `/api/videos/${path.basename(result.videoPath)}`,
        videoPath: result.videoPath
      });
    } catch (error) {
      console.error('Error editing video:', error);
      res.status(500).json({ 
        error: 'Failed to edit video',
        message: error instanceof Error ? error.message : 'Unknown error'
      });
    }
  });

  /**
   * Analyze YouTube video for viral factors and Veo3 prompt generation
   */
  app.post('/api/visual-remix/analyze-youtube', async (req, res) => {
    try {
      const { youtubeUrl } = req.body;
      
      if (!youtubeUrl) {
        return res.status(400).json({ error: 'YouTube URL is required' });
      }
      
      const analysis = await remixService.analyzeYoutubeVideo(youtubeUrl);
      
      res.json(analysis);
    } catch (error) {
      console.error('Error analyzing YouTube video:', error);
      res.status(500).json({ 
        error: 'Failed to analyze YouTube video',
        message: error instanceof Error ? error.message : 'Unknown error'
      });
    }
  });

  /**
   * Analyze uploaded video file for viral factors and storytelling techniques
   */
  app.post('/api/visual-remix/analyze-video-file', upload.single('video'), async (req, res) => {
    try {
      const videoFile = req.file;
      const { storyLength, generateDialog } = req.body;
      
      if (!videoFile) {
        return res.status(400).json({ error: 'Video file is required' });
      }
      
      const analysis = await remixService.analyzeVideoFile(
        videoFile.path,
        storyLength,
        generateDialog === 'true' || generateDialog === true
      );
      
      res.json(analysis);
    } catch (error) {
      console.error('Error analyzing video file:', error);
      res.status(500).json({ 
        error: 'Failed to analyze video file',
        message: error instanceof Error ? error.message : 'Unknown error'
      });
    }
  });

  /**
   * Analyze video by path (for already uploaded videos)
   */
  app.post('/api/visual-remix/analyze-video', async (req, res) => {
    try {
      const { videoPath, storyLength, generateDialog } = req.body;
      
      if (!videoPath) {
        return res.status(400).json({ error: 'Video path is required' });
      }
      
      const analysis = await remixService.analyzeVideoFile(
        videoPath,
        storyLength,
        generateDialog
      );
      
      res.json({
        success: true,
        analysis
      });
    } catch (error) {
      console.error('Error analyzing video:', error);
      res.status(500).json({ 
        error: 'Failed to analyze video',
        message: error instanceof Error ? error.message : 'Unknown error'
      });
    }
  });

  /**
   * Generate fused Veo3 prompt combining YouTube analysis with user inputs
   */
  app.post('/api/visual-remix/generate-fused-prompt', async (req, res) => {
    try {
      const { youtubeAnalysis, subject, scene, style, additionalPrompt } = req.body;
      
      if (!youtubeAnalysis) {
        return res.status(400).json({ error: 'YouTube analysis is required' });
      }
      
      const result = await remixService.generateFusedPrompt({
        youtubeAnalysis,
        subject,
        scene,
        style,
        additionalPrompt
      });
      
      res.json(result);
    } catch (error) {
      console.error('Error generating fused prompt:', error);
      res.status(500).json({ 
        error: 'Failed to generate fused prompt',
        message: error instanceof Error ? error.message : 'Unknown error'
      });
    }
  });

  /**
   * Generate story sequence for connected video segments
   */
  app.post('/api/visual-remix/generate-story-sequence', async (req, res) => {
    try {
      const { theme, duration, subject, scene, style, youtubeAnalysis, storyParams } = req.body;
      
      if (!theme || !duration) {
        return res.status(400).json({ error: 'Theme and duration are required' });
      }
      
      const sequences = await remixService.generateStorySequence({
        theme,
        duration,
        subject,
        scene,
        style,
        youtubeAnalysis,
        storyParams
      });
      
      res.json({ sequences });
    } catch (error) {
      console.error('Error generating story sequence:', error);
      res.status(500).json({ 
        error: 'Failed to generate story sequence',
        message: error instanceof Error ? error.message : 'Unknown error'
      });
    }
  });

  /**
   * Merge multiple videos into one final video
   */
  app.post('/api/visual-remix/merge-videos', async (req, res) => {
    try {
      const { videoPaths } = req.body;
      
      if (!videoPaths || !Array.isArray(videoPaths) || videoPaths.length === 0) {
        return res.status(400).json({ error: 'Video paths array is required' });
      }
      
      // Convert API paths to actual file paths
      const actualPaths = videoPaths.map(videoPath => {
        if (videoPath.includes('/api/videos/')) {
          return videoPath.replace('/api/videos/', 'temp_remix/');
        }
        return videoPath;
      });
      
      const result = await remixService.mergeVideos(actualPaths);
      
      // Convert the merged video path to API format
      const apiPath = result.mergedVideoPath.replace('temp_remix/', '/api/videos/');
      
      res.json({ 
        success: true,
        mergedVideoUrl: apiPath
      });
    } catch (error) {
      console.error('Error merging videos:', error);
      res.status(500).json({ 
        error: 'Failed to merge videos',
        message: error instanceof Error ? error.message : 'Unknown error'
      });
    }
  });

  /**
   * Generate scenes based on YouTube analysis
   */
  app.post('/api/visual-remix/generate-scenes', async (req, res) => {
    try {
      const { mode, userInput, enhancedPrompt, youtubeAnalysis, videoType, videoDuration, includeDialog } = req.body;
      
      const model = genAI.getGenerativeModel({ model: 'gemini-2.0-flash-exp' });
      
      // Calculate number of scenes based on duration (each scene is 8 seconds)
      const numScenes = videoDuration / 8;
      
      let scenesPrompt = '';
      
      if (mode === 'copy' && youtubeAnalysis?.scenes) {
        // Copy mode: recreate YouTube scenes
        scenesPrompt = `You are a video director recreating a successful ${videoType} story.
        
Based on this analyzed video:
${JSON.stringify(youtubeAnalysis.scenes, null, 2)}

User wants to create: "${userInput}"

Create a shot-by-shot recreation adapted for their product/service. Each scene must be EXACTLY 8 seconds.
Maintain the same emotional beats and narrative structure but adapt visuals for their needs.`;
      } else {
        // Creative mode: inspired by YouTube but original
        scenesPrompt = `You are an award-winning video director creating a ${videoType}.
        
User wants to create: "${userInput}"
Enhanced vision: "${enhancedPrompt || userInput}"

${youtubeAnalysis ? `
Drawing inspiration from this successful story structure:
- Hook: ${youtubeAnalysis.storyStructure?.hook}
- Narrative Arc: ${youtubeAnalysis.storyStructure?.narrativeArc}
- Emotional Journey: ${youtubeAnalysis.storyStructure?.emotionalJourney?.join(' → ')}
- Why it works: ${youtubeAnalysis.whyItWorks?.join(', ')}
` : ''}

Create an original, compelling story with scenes that:
1. Each scene is EXACTLY 8 seconds long
2. Build emotional connection
3. Have clear visual storytelling
4. Use cinematic techniques`;
      }
      
      scenesPrompt += `

Return a JSON array of EXACTLY ${numScenes} scenes with this structure:
[
  {
    "id": "unique_id",
    "number": 1,
    "duration": 8,
    "title": "Scene Title",
    "description": "What happens in this scene",
    "visualPrompt": "Detailed visual description for AI generation",
    "audioPrompt": "Music/sound description",
    "cameraMovement": "Camera technique (e.g., slow zoom, dolly in)",
    "transition": "How it transitions to next scene"${includeDialog ? ',\n    "dialog": "What the narrator/character says in this scene (natural conversational tone)"' : ''}
  }
]

IMPORTANT: 
- Create EXACTLY ${numScenes} scenes
- Total video duration is ${videoDuration} seconds (${numScenes} scenes × 8 seconds each)
${includeDialog ? '- Include compelling dialog/voiceover for each scene that tells the story' : ''}`;

      const result = await model.generateContent({
        contents: [{ role: 'user', parts: [{ text: scenesPrompt }] }],
        generationConfig: {
          temperature: mode === 'copy' ? 0.3 : 0.8,
          responseMimeType: 'application/json'
        }
      });

      const scenesData = JSON.parse(result.response.text());
      
      // Add unique IDs if not present
      const scenes = scenesData.map((scene: any, idx: number) => ({
        ...scene,
        id: scene.id || `scene_${Date.now()}_${idx}`,
        number: idx + 1,
        duration: 8
      }));
      
      res.json({ scenes });
    } catch (error) {
      console.error('Error generating scenes:', error);
      res.status(500).json({ 
        error: 'Failed to generate scenes',
        message: error instanceof Error ? error.message : 'Unknown error'
      });
    }
  });

  /**
   * AI enhance a single scene
   */
  app.post('/api/visual-remix/enhance-scene', async (req, res) => {
    try {
      const { scene, allScenes, includeDialog, visualSlots } = req.body;
      
      const model = genAI.getGenerativeModel({ model: 'gemini-2.0-flash-exp' });
      
      const prompt = `You are a master filmmaker with 25 years of experience. Enhance this scene with extraordinary cinematic vision.

Current scene:
${JSON.stringify(scene, null, 2)}

Context - other scenes in the story:
${JSON.stringify(allScenes?.map((s: any) => ({ title: s.title, description: s.description })), null, 2)}

${visualSlots ? `IMPORTANT - Blend these visual elements into your enhanced scene:
${visualSlots.subject ? `- Subject: ${visualSlots.subject.description} (integrate this character/object as the main focus)` : ''}
${visualSlots.scene ? `- Scene Environment: ${visualSlots.scene.description} (use this as the setting/background)` : ''}
${visualSlots.style ? `- Visual Style: ${visualSlots.style.description} (apply this aesthetic/mood/color palette)` : ''}` : ''}

Apply your 25 years of expertise to enhance this scene by:
1. Masterful visual composition with rule of thirds, leading lines, depth
2. Cinematic camera movements (dolly, crane, steadicam, handheld for emotion)
3. Professional lighting design (key light, fill, rim, practicals, motivated lighting)
4. Color grading that enhances mood (warm/cool, high/low contrast, color theory)
5. Sound design layers (ambient, foley, music cues, silence for impact)
6. Emotional storytelling through visual metaphors and symbolism
7. Seamless transitions that maintain story flow
${includeDialog ? '8. Natural, compelling dialog that advances the story' : ''}

Create a scene that would win awards at Cannes Film Festival.

Return the enhanced scene maintaining the same JSON structure but with extraordinary improvements.`;

      const result = await model.generateContent({
        contents: [{ role: 'user', parts: [{ text: prompt }] }],
        generationConfig: {
          temperature: 0.9,
          responseMimeType: 'application/json'
        }
      });

      const enhancedScene = JSON.parse(result.response.text());
      
      res.json({ enhancedScene });
    } catch (error) {
      console.error('Error enhancing scene:', error);
      res.status(500).json({ 
        error: 'Failed to enhance scene',
        message: error instanceof Error ? error.message : 'Unknown error'
      });
    }
  });

  /**
   * Enhance a story sequence
   */
  app.post('/api/visual-remix/enhance-story-sequence', async (req, res) => {
    try {
      const { sequence, allSequences, theme, storyParams } = req.body;
      
      const model = genAI.getGenerativeModel({ model: 'gemini-2.0-flash-exp' });
      
      const prompt = `You are an expert video director enhancing a story sequence.
      
Current sequence:
Part ${sequence.part}: ${sequence.description}
Prompt: ${sequence.prompt}

All sequences for context:
${JSON.stringify(allSequences, null, 2)}

Overall theme: "${theme}"
Story parameters: ${JSON.stringify(storyParams)}

Enhance this specific sequence to:
1. Make it more emotionally impactful and visually compelling
2. Ensure smooth transitions from previous and to next parts
3. Add specific visual details, camera movements, and atmosphere
4. Maintain consistency with the overall story arc
5. Make it more engaging and memorable

Return enhanced sequence in JSON format:
{
  "prompt": "enhanced Veo3 video generation prompt with specific details",
  "description": "enhanced description that explains the improvements"
}`;

      const result = await model.generateContent({
        contents: [{ role: 'user', parts: [{ text: prompt }] }],
        generationConfig: {
          temperature: 0.8,
          responseMimeType: 'application/json'
        }
      });

      const enhancedSequence = JSON.parse(result.response.text());
      
      res.json({ enhancedSequence });
    } catch (error) {
      console.error('Error enhancing story sequence:', error);
      res.status(500).json({ 
        error: 'Failed to enhance story sequence',
        message: error instanceof Error ? error.message : 'Unknown error'
      });
    }
  });

  /**
   * Generate copy scenes with changed characters and dialogs
   */
  app.post('/api/visual-remix/generate-copy-scenes', async (req, res) => {
    try {
      const { analysis, sceneCount, videoDuration, videoType, includeDialog, visualSlots } = req.body;
      
      const model = genAI.getGenerativeModel({ model: 'gemini-2.0-flash-exp' });
      
      const prompt = `You are a creative video producer. Transform these analyzed scenes by changing characters and dialogs while maintaining the same story meanings and emotions.

Original Analysis:
${JSON.stringify(analysis, null, 2)}

Requirements:
- Create exactly ${sceneCount} scenes (each 8 seconds long)
- Total duration: ${videoDuration} seconds
- Video type: ${videoType} ${videoType === 'social' ? '(9:16 aspect ratio)' : ''}
- Include dialog: ${includeDialog}

IMPORTANT TRANSFORMATION RULES:
1. Change all characters to different personas (e.g., if original has a businessman, make it an artist)
2. Rewrite all dialogs to express the SAME meanings but with completely different words
3. Keep the same emotional arc and story progression
4. Maintain the same scene purposes and narrative beats
5. Use similar camera work and visual composition
6. Keep the same mood and pacing

${visualSlots?.subject ? `- Use this subject in scenes: ${visualSlots.subject.description}` : ''}
${visualSlots?.scene ? `- Apply this scene style: ${visualSlots.scene.description}` : ''}
${visualSlots?.style ? `- Apply this visual style: ${visualSlots.style.description}` : ''}

For each scene provide:
{
  "title": "New scene title with changed context",
  "description": "What happens with new characters",
  "visualPrompt": "Detailed visual description with new characters and setting",
  "camera": "Similar camera movement as original",
  "audio": "Audio elements that match the mood",
  "dialog": "${includeDialog ? 'Rewritten dialog expressing same meaning differently' : 'null'}"
}

Return an array of ${sceneCount} transformed scenes.`;

      const result = await model.generateContent({
        contents: [{ role: 'user', parts: [{ text: prompt }] }],
        generationConfig: {
          temperature: 0.8,
          responseMimeType: 'application/json'
        }
      });

      const scenes = JSON.parse(result.response.text());
      
      res.json({ scenes });
    } catch (error) {
      console.error('Error generating copy scenes:', error);
      res.status(500).json({ 
        error: 'Failed to generate copy scenes',
        message: error instanceof Error ? error.message : 'Unknown error'
      });
    }
  });

  /**
   * Generate creative scenes based on analysis
   */
  app.post('/api/visual-remix/generate-creative-scenes', async (req, res) => {
    try {
      const { analysis, sceneCount, videoDuration, videoType, includeDialog, visualSlots } = req.body;
      
      const model = genAI.getGenerativeModel({ model: 'gemini-2.0-flash-exp' });
      
      const prompt = `You are a master filmmaker with 25 years of creative experience. Transform this video analysis into ${sceneCount} exceptional scenes.

Original Analysis:
${JSON.stringify(analysis, null, 2)}

Requirements:
- Create exactly ${sceneCount} scenes (each 8 seconds long)
- Total duration: ${videoDuration} seconds
- Video type: ${videoType} ${videoType === 'social' ? '(9:16 aspect ratio)' : ''}
- Include dialog: ${includeDialog}
${visualSlots?.subject ? `- Subject reference: ${visualSlots.subject.description}` : ''}
${visualSlots?.scene ? `- Scene style reference: ${visualSlots.scene.description}` : ''}
${visualSlots?.style ? `- Visual style reference: ${visualSlots.style.description}` : ''}

Apply your 25 years of creative expertise to:
1. Elevate the cinematography with dynamic camera movements and compositions
2. Create emotional depth through visual storytelling
3. Add creative transitions between scenes
4. Enhance pacing and rhythm for maximum engagement
5. Use advanced filming techniques (match cuts, J-cuts, parallel editing)
6. Apply color theory and lighting for mood
7. Create visual metaphors and symbolism
8. Build tension and release through scene progression

For each scene provide:
{
  "title": "Creative scene title",
  "description": "What happens with creative enhancements",
  "visualPrompt": "Detailed cinematic visual description for AI generation",
  "camera": "Specific camera movement/technique",
  "audio": "Professional audio design elements",
  "dialog": "${includeDialog ? 'Natural, engaging dialog that advances the story' : 'null'}"
}

Return an array of ${sceneCount} enhanced scenes that form a cohesive, compelling story.`;

      const result = await model.generateContent({
        contents: [{ role: 'user', parts: [{ text: prompt }] }],
        generationConfig: {
          temperature: 0.9,
          responseMimeType: 'application/json'
        }
      });

      const scenes = JSON.parse(result.response.text());
      
      res.json({ scenes });
    } catch (error) {
      console.error('Error generating creative scenes:', error);
      res.status(500).json({ 
        error: 'Failed to generate creative scenes',
        message: error instanceof Error ? error.message : 'Unknown error'
      });
    }
  });

  /**
   * Generate images from scenes
   */
  app.post('/api/visual-remix/generate-scene-images', async (req, res) => {
    try {
      const { scenes, style, subject, scene: sceneStyle } = req.body;
      
      const images = [];
      
      for (const scene of scenes) {
        let enhancedPrompt = scene.visualPrompt;
        
        // Blend in visual slots
        if (subject) {
          enhancedPrompt = `${enhancedPrompt} The main subject is ${subject}.`;
        }
        if (sceneStyle) {
          enhancedPrompt = `${enhancedPrompt} The scene environment is ${sceneStyle}.`;
        }
        if (style) {
          enhancedPrompt = `${enhancedPrompt} Apply this visual style: ${style}.`;
        }
        
        // Add scene-specific details
        enhancedPrompt = `${enhancedPrompt} Camera: ${scene.camera}. ${scene.description}`;
        
        // Generate image
        const filename = `scene_${scene.id}_${Date.now()}.png`;
        const filepath = path.join('remix_outputs', filename);
        
        await generateImage(enhancedPrompt, filepath);
        
        images.push(`/api/visual-remix/images/${filename}`);
      }
      
      res.json({ images });
    } catch (error) {
      console.error('Error generating scene images:', error);
      res.status(500).json({ 
        error: 'Failed to generate scene images',
        message: error instanceof Error ? error.message : 'Unknown error'
      });
    }
  });

  /**
   * Generate video clips from scenes
   */
  app.post('/api/visual-remix/generate-video-clips', async (req, res) => {
    try {
      const { scenes, images } = req.body;
      
      const videoClips = [];
      
      for (let i = 0; i < scenes.length; i++) {
        const scene = scenes[i];
        const image = images[i];
        
        if (!image) continue;
        
        // Extract image filename from URL
        const imageFilename = image.split('/').pop();
        const imagePath = path.join('remix_outputs', imageFilename);
        
        // Generate 8-second video clip
        const videoFilename = `clip_${scene.id}_${Date.now()}.mp4`;
        const videoPath = path.join('remix_outputs', videoFilename);
        
        // Create 8-second video from image with camera movement
        const cameraEffect = scene.camera.toLowerCase();
        let filterComplex = '';
        
        if (cameraEffect.includes('zoom in')) {
          filterComplex = 'scale=iw*1.2:ih*1.2,zoompan=z=\'min(zoom+0.002,1.2)\':x=\'iw/2-(iw/zoom/2)\':y=\'ih/2-(ih/zoom/2)\':d=200';
        } else if (cameraEffect.includes('zoom out')) {
          filterComplex = 'scale=iw*1.2:ih*1.2,zoompan=z=\'if(lte(zoom,1.0),1.2,max(1.0,zoom-0.002))\':x=\'iw/2-(iw/zoom/2)\':y=\'ih/2-(ih/zoom/2)\':d=200';
        } else if (cameraEffect.includes('pan left')) {
          filterComplex = 'scale=iw*1.2:ih*1.2,crop=iw:ih:\'max(0,iw*0.2-t*20)\':0';
        } else if (cameraEffect.includes('pan right')) {
          filterComplex = 'scale=iw*1.2:ih*1.2,crop=iw:ih:\'min(iw*0.2,t*20)\':0';
        } else {
          // Static shot with slight zoom
          filterComplex = 'scale=iw*1.1:ih*1.1,zoompan=z=1:x=\'iw/2-(iw/zoom/2)\':y=\'ih/2-(ih/zoom/2)\':d=200';
        }
        
        await new Promise((resolve, reject) => {
          const command = ffmpeg(imagePath)
            .loop(8)
            .fps(25)
            .complexFilter(filterComplex)
            .duration(8)
            .output(videoPath)
            .on('end', resolve)
            .on('error', reject);
            
          command.run();
        });
        
        videoClips.push({
          sceneId: scene.id,
          url: `/api/visual-remix/videos/${videoFilename}`,
          duration: 8
        });
      }
      
      res.json({ videoClips });
    } catch (error) {
      console.error('Error generating video clips:', error);
      res.status(500).json({ 
        error: 'Failed to generate video clips',
        message: error instanceof Error ? error.message : 'Unknown error'
      });
    }
  });

  /**
   * Merge video clips into final video
   */
  app.post('/api/visual-remix/merge-videos', async (req, res) => {
    try {
      const { videoClips, includeAudio } = req.body;
      
      if (!videoClips || videoClips.length === 0) {
        return res.status(400).json({ error: 'No video clips to merge' });
      }
      
      // Create concat file
      const concatFilename = `concat_${Date.now()}.txt`;
      const concatPath = path.join('remix_outputs', concatFilename);
      
      const fileLines = videoClips.map((clip: any) => {
        const filename = clip.url.split('/').pop();
        return `file '${filename}'`;
      });
      
      await fs.writeFile(concatPath, fileLines.join('\n'));
      
      // Merge videos
      const mergedFilename = `final_${Date.now()}.mp4`;
      const mergedPath = path.join('remix_outputs', mergedFilename);
      
      await new Promise((resolve, reject) => {
        const command = ffmpeg()
          .input(concatPath)
          .inputOptions(['-f', 'concat', '-safe', '0'])
          .outputOptions(['-c', 'copy'])
          .output(mergedPath)
          .on('end', resolve)
          .on('error', reject);
          
        command.run();
      });
      
      // Clean up concat file
      await fs.unlink(concatPath);
      
      res.json({ 
        finalVideo: `/api/visual-remix/videos/${mergedFilename}`,
        duration: videoClips.length * 8
      });
    } catch (error) {
      console.error('Error merging videos:', error);
      res.status(500).json({ 
        error: 'Failed to merge videos',
        message: error instanceof Error ? error.message : 'Unknown error'
      });
    }
  });

  /**
   * Enhance an analyzed scene
   */
  app.post('/api/visual-remix/enhance-analyzed-scene', async (req, res) => {
    try {
      const { scene, allScenes, storyOverview } = req.body;
      
      const model = genAI.getGenerativeModel({ model: 'gemini-2.0-flash-exp' });
      
      const prompt = `You are an expert video director enhancing a scene from an analyzed video.
      
Current scene:
Scene ${scene.sceneNumber}: ${scene.title}
Time: ${scene.timeRange}
Description: ${scene.description}
Visual elements: ${scene.visualElements?.join(', ')}
Dialog: ${JSON.stringify(scene.dialog)}

Story overview:
${JSON.stringify(storyOverview, null, 2)}

Enhance this scene description to:
1. Add more specific visual details and cinematography notes
2. Improve the emotional impact and narrative clarity
3. Add specific camera angles, movements, and framing suggestions
4. Enhance dialog delivery notes and character emotions
5. Include lighting, color grading, and mood suggestions

Return enhanced scene in JSON format maintaining the original structure but with improved content:
{
  "title": "enhanced scene title",
  "description": "enhanced detailed description",
  "visualElements": ["enhanced", "visual", "elements"],
  "audioElements": ["enhanced", "audio", "elements"],
  "mood": "enhanced mood description",
  "purpose": "enhanced narrative purpose"
}`;

      const result = await model.generateContent({
        contents: [{ role: 'user', parts: [{ text: prompt }] }],
        generationConfig: {
          temperature: 0.8,
          responseMimeType: 'application/json'
        }
      });

      const enhancedScene = JSON.parse(result.response.text());
      
      res.json({ enhancedScene });
    } catch (error) {
      console.error('Error enhancing analyzed scene:', error);
      res.status(500).json({ 
        error: 'Failed to enhance analyzed scene',
        message: error instanceof Error ? error.message : 'Unknown error'
      });
    }
  });

  /**
   * Simplified UI endpoints
   */
  
  // Enhance user prompt with AI
  app.post('/api/visual-remix/enhance-prompt', async (req, res) => {
    try {
      const { userInput, youtubeUrl } = req.body;
      
      // Analyze YouTube if provided
      let learnedTechniques = '';
      if (youtubeUrl) {
        const analysis = await remixService.analyzeYoutubeVideo(youtubeUrl);
        learnedTechniques = analysis.universalStoryTemplate;
      }
      
      // Determine video type from user input
      let videoType: 'ad' | 'movie' | 'social' = 'ad';
      const lowerInput = userInput.toLowerCase();
      if (lowerInput.includes('movie') || lowerInput.includes('trailer') || lowerInput.includes('film')) {
        videoType = 'movie';
      } else if (lowerInput.includes('social') || lowerInput.includes('instagram') || lowerInput.includes('tiktok') || lowerInput.includes('youtube')) {
        videoType = 'social';
      }
      
      // Enhance the prompt with AI
      const model = genAI.getGenerativeModel({ model: 'gemini-2.0-flash-exp' });
      
      const enhancementPrompt = `You are an expert video prompt engineer. A user wants to create a ${videoType}.

User's request: "${userInput}"
${learnedTechniques ? `\nApply these storytelling techniques: ${learnedTechniques}` : ''}

Create an enhanced prompt that:
1. Captures the user's vision perfectly
2. Adds professional cinematography details
3. Includes specific visual elements, camera movements, and atmosphere
4. Is optimized for AI video generation (Veo3)
5. Maintains any product/brand consistency if mentioned

Also provide 3 creative suggestions to make it even better.

Format as JSON:
{
  "enhanced": "the enhanced prompt",
  "suggestions": ["suggestion 1", "suggestion 2", "suggestion 3"]
}`;

      const result = await model.generateContent(enhancementPrompt);
      const responseText = result.response.text();
      const enhancedData = JSON.parse(responseText.replace(/```json\n?|\n?```/g, ''));
      
      res.json({
        original: userInput,
        enhanced: enhancedData.enhanced,
        suggestions: enhancedData.suggestions,
        videoType
      });
      
    } catch (error) {
      console.error('Error enhancing prompt:', error);
      res.status(500).json({ error: 'Failed to enhance prompt' });
    }
  });

  // Generate image variations
  app.post('/api/visual-remix/generate-variations', async (req, res) => {
    try {
      const { prompt } = req.body;
      
      // Generate 3 variations using Gemini's image generation
      const variations = [];
      
      // Generate 3 different variations
      const variationPrompts = [
        `${prompt} - wide shot perspective`,
        `${prompt} - dramatic close-up angle`,
        `${prompt} - artistic cinematic composition`
      ];
      
      for (let i = 0; i < 3; i++) {
        try {
          const filename = `variation_${Date.now()}_${i}.png`;
          const filepath = path.join('remix_outputs', filename);
          
          const success = await generateImage(variationPrompts[i], filepath);
          
          if (success) {
            variations.push({
              url: `/api/visual-remix/images/${filename}`,
              prompt: variationPrompts[i],
              description: `Variation ${i + 1}`
            });
          }
        } catch (error) {
          console.error(`Error generating variation ${i}:`, error);
        }
      }
      
      res.json({ variations });
      
    } catch (error) {
      console.error('Error generating variations:', error);
      res.status(500).json({ error: 'Failed to generate variations' });
    }
  });



  // Serve generated videos
  app.get('/api/visual-remix/videos/:filename', async (req, res) => {
    try {
      const { filename } = req.params;
      const filepath = path.join('remix_outputs', filename);
      
      if (!await fs.access(filepath).then(() => true).catch(() => false)) {
        return res.status(404).json({ error: 'Video not found' });
      }
      
      const stat = await fs.stat(filepath);
      const fileSize = stat.size;
      const range = req.headers.range;
      
      if (range) {
        const parts = range.replace(/bytes=/, "").split("-");
        const start = parseInt(parts[0], 10);
        const end = parts[1] ? parseInt(parts[1], 10) : fileSize - 1;
        const chunksize = (end - start) + 1;
        const file = createReadStream(filepath, { start, end });
        const head = {
          'Content-Range': `bytes ${start}-${end}/${fileSize}`,
          'Accept-Ranges': 'bytes',
          'Content-Length': chunksize,
          'Content-Type': 'video/mp4',
        };
        res.writeHead(206, head);
        file.pipe(res);
      } else {
        const head = {
          'Content-Length': fileSize,
          'Content-Type': 'video/mp4',
        };
        res.writeHead(200, head);
        createReadStream(filepath).pipe(res);
      }
    } catch (error) {
      console.error('Error serving video:', error);
      res.status(500).json({ error: 'Failed to serve video' });
    }
  });
}