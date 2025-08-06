import { Router } from 'express';
import multer from 'multer';
import path from 'path';
import fs from 'fs';
import { LiveRevideoService } from '../services/live-revideo-service.js';

const router = Router();
const upload = multer({ dest: 'uploads/' });

interface RevideoRenderOptions {
  titleText?: string;
  subtitleText?: string;
  primaryColor?: string;
  secondaryColor?: string;
  outputWidth?: number;
  outputHeight?: number;
  outputDuration?: number;
  selectedScene?: 'example' | 'videoEditing' | 'subtitles' | 'transitions';
  animationSpeed?: number;
}

// Simple service placeholder until Revideo is properly configured
class SimpleRevideoService {
  async renderVideo(options: RevideoRenderOptions): Promise<string> {
    // For now, return a placeholder response
    // This will be replaced with actual Revideo rendering once the setup is complete
    const outputPath = `/api/placeholder-video.mp4`;
    return outputPath;
  }

  getAvailableTemplates() {
    return ['social', 'youtube', 'story', 'presentation'];
  }

  getAvailableScenes() {
    return ['example', 'videoEditing', 'subtitles', 'transitions'];
  }
}

// Initialize services
const revideoService = new SimpleRevideoService();
let liveRevideoService: LiveRevideoService | null = null;

// Initialize live service if Gemini API key is available
const geminiApiKey = process.env.GEMINI_API_KEY;
if (geminiApiKey) {
  liveRevideoService = new LiveRevideoService(geminiApiKey);
}

// Get available templates
router.get('/templates', (req, res) => {
  try {
    const templates = revideoService.getAvailableTemplates();
    const scenes = revideoService.getAvailableScenes();
    
    res.json({
      success: true,
      templates,
      scenes,
      aspectRatios: ['16:9', '9:16', '1:1'],
      colorSchemes: ['warm', 'cool', 'cinematic', 'vibrant']
    });
  } catch (error) {
    res.status(500).json({
      success: false,
      error: error instanceof Error ? error.message : 'Failed to get templates'
    });
  }
});

// Custom video rendering
router.post('/render', async (req, res) => {
  try {
    const options: RevideoRenderOptions = req.body;
    
    const outputPath = await revideoService.renderVideo(options);
    
    res.json({
      success: true,
      outputPath,
      renderOptions: options,
      message: 'Video rendered successfully'
    });
  } catch (error) {
    console.error('[Revideo Routes] Failed to render video:', error);
    res.status(500).json({
      success: false,
      error: error instanceof Error ? error.message : 'Video rendering failed'
    });
  }
});

// Template rendering
router.post('/render-template', async (req, res) => {
  try {
    const { templateType, customOptions } = req.body;
    
    const outputPath = await revideoService.renderVideo(customOptions || {});
    
    res.json({
      success: true,
      outputPath,
      templateType,
      message: `${templateType} template rendered successfully`
    });
  } catch (error) {
    console.error('[Revideo Routes] Template render failed:', error);
    res.status(500).json({
      success: false,
      error: error instanceof Error ? error.message : 'Template render failed'
    });
  }
});

// AI video analysis
router.post('/ai-analyze', upload.single('video'), async (req, res) => {
  try {
    const { userPrompt } = req.body;
    const videoFile = req.file;

    if (!videoFile) {
      return res.status(400).json({
        success: false,
        error: 'No video file provided'
      });
    }

    // Placeholder AI analysis response
    const analysis = {
      videoType: 'educational',
      suggestedScene: 'example',
      recommendedAspectRatio: '16:9',
      colorScheme: 'vibrant',
      suggestedDuration: 10,
      subtitleRecommendations: {
        fontSize: 24,
        position: 'bottom',
        style: 'modern'
      },
      animationStyle: 'smooth'
    };

    res.json({
      success: true,
      analysis,
      message: 'Video analyzed successfully'
    });
  } catch (error) {
    console.error('[Revideo Routes] AI analysis failed:', error);
    res.status(500).json({
      success: false,
      error: error instanceof Error ? error.message : 'AI analysis failed'
    });
  }
});

// AI video generation
router.post('/ai-generate', upload.single('video'), async (req, res) => {
  try {
    const { userPrompt } = req.body;
    const videoFile = req.file;

    if (!videoFile) {
      return res.status(400).json({
        success: false,
        error: 'No video file provided'
      });
    }

    // Placeholder AI generation response
    const outputPath = '/api/placeholder-ai-video.mp4';

    res.json({
      success: true,
      outputPath,
      message: 'AI-enhanced video generated successfully'
    });
  } catch (error) {
    console.error('[Revideo Routes] AI generation failed:', error);
    res.status(500).json({
      success: false,
      error: error instanceof Error ? error.message : 'AI generation failed'
    });
  }
});

// Custom scene creation
router.post('/ai-scene', async (req, res) => {
  try {
    const { sceneDescription } = req.body;

    if (!sceneDescription) {
      return res.status(400).json({
        success: false,
        error: 'Scene description is required'
      });
    }

    // Placeholder scene configuration
    const sceneOptions = {
      titleText: 'AI Generated Scene',
      subtitleText: sceneDescription,
      primaryColor: '#8B5CF6',
      secondaryColor: '#06B6D4',
      outputWidth: 1920,
      outputHeight: 1080,
      outputDuration: 10,
      selectedScene: 'example' as const,
      animationSpeed: 1.0
    };

    res.json({
      success: true,
      sceneOptions,
      message: 'Custom scene configuration created'
    });
  } catch (error) {
    console.error('[Revideo Routes] Scene creation failed:', error);
    res.status(500).json({
      success: false,
      error: error instanceof Error ? error.message : 'Scene creation failed'
    });
  }
});

// Platform optimization
router.post('/optimize-platform', async (req, res) => {
  try {
    const { platform, options } = req.body;

    const optimizedOptions = {
      ...options,
      outputWidth: platform === 'instagram' ? 1080 : platform === 'youtube' ? 1920 : 1080,
      outputHeight: platform === 'instagram' ? 1080 : platform === 'youtube' ? 1080 : 1920
    };

    res.json({
      success: true,
      optimizedOptions,
      platform,
      message: `Options optimized for ${platform}`
    });
  } catch (error) {
    console.error('[Revideo Routes] Platform optimization failed:', error);
    res.status(500).json({
      success: false,
      error: error instanceof Error ? error.message : 'Platform optimization failed'
    });
  }
});

// === LIVE EDITING ROUTES ===

// Upload video and create editing session
router.post('/upload-video', upload.single('video'), async (req, res) => {
  try {
    const videoFile = req.file;
    if (!videoFile || !liveRevideoService) {
      return res.status(400).json({
        success: false,
        error: 'No video file provided or live service unavailable'
      });
    }

    const sessionId = await liveRevideoService.createEditingSession(videoFile.path);
    
    res.json({
      success: true,
      sessionId,
      videoUrl: `/api/video/${videoFile.filename}`,
      duration: 30, // Will be extracted from metadata
      thumbnail: `/api/thumbnail/${videoFile.filename}`,
      message: 'Video uploaded and session created'
    });
  } catch (error) {
    console.error('[Live Revideo] Upload failed:', error);
    res.status(500).json({
      success: false,
      error: error instanceof Error ? error.message : 'Upload failed'
    });
  }
});

// Process AI agent commands
router.post('/ai-process-command', async (req, res) => {
  try {
    const { sessionId, command, currentTime } = req.body;
    
    if (!liveRevideoService) {
      return res.status(503).json({
        success: false,
        error: 'Live editing service not available'
      });
    }

    const result = await liveRevideoService.processCommand(sessionId, command, currentTime);
    
    res.json(result);
  } catch (error) {
    console.error('[Live Revideo] Command processing failed:', error);
    res.status(500).json({
      success: false,
      error: error instanceof Error ? error.message : 'Command processing failed'
    });
  }
});

// Apply live edit
router.post('/apply-live-edit', async (req, res) => {
  try {
    const { sessionId, edit } = req.body;
    
    if (!liveRevideoService) {
      return res.status(503).json({
        success: false,
        error: 'Live editing service not available'
      });
    }

    const result = await liveRevideoService.applyLiveEdit(sessionId, edit);
    
    res.json(result);
  } catch (error) {
    console.error('[Live Revideo] Edit application failed:', error);
    res.status(500).json({
      success: false,
      error: error instanceof Error ? error.message : 'Edit application failed'
    });
  }
});

// AI enhance video
router.post('/ai-enhance', async (req, res) => {
  try {
    const { sessionId, enhancementType, userPrompt } = req.body;
    
    if (!liveRevideoService) {
      return res.status(503).json({
        success: false,
        error: 'Live editing service not available'
      });
    }

    const result = await liveRevideoService.enhanceVideo(sessionId, enhancementType, userPrompt);
    
    res.json(result);
  } catch (error) {
    console.error('[Live Revideo] Enhancement failed:', error);
    res.status(500).json({
      success: false,
      error: error instanceof Error ? error.message : 'Enhancement failed'
    });
  }
});

// Export edited video
router.post('/export-live-edit', async (req, res) => {
  try {
    const { sessionId, exportFormat, quality } = req.body;
    
    if (!liveRevideoService) {
      return res.status(503).json({
        success: false,
        error: 'Live editing service not available'
      });
    }

    const result = await liveRevideoService.exportEditedVideo(sessionId, {
      format: exportFormat || 'mp4',
      quality: quality || 'high'
    });
    
    res.json(result);
  } catch (error) {
    console.error('[Live Revideo] Export failed:', error);
    res.status(500).json({
      success: false,
      error: error instanceof Error ? error.message : 'Export failed'
    });
  }
});

// Get session status
router.get('/session/:sessionId', (req, res) => {
  try {
    const { sessionId } = req.params;
    
    if (!liveRevideoService) {
      return res.status(503).json({
        success: false,
        error: 'Live editing service not available'
      });
    }

    const session = liveRevideoService.getSessionStatus(sessionId);
    
    if (!session) {
      return res.status(404).json({
        success: false,
        error: 'Session not found'
      });
    }

    res.json({
      success: true,
      session
    });
  } catch (error) {
    console.error('[Live Revideo] Session status failed:', error);
    res.status(500).json({
      success: false,
      error: error instanceof Error ? error.message : 'Session status failed'
    });
  }
});

// Serve preview videos with streaming support
router.get('/preview/:filename', (req, res) => {
  try {
    const { filename } = req.params;
    const previewPath = path.join('./previews', filename);
    
    console.log(`[LiveRevideo] Preview request: ${previewPath}`);
    
    if (!fs.existsSync(previewPath)) {
      console.error(`[LiveRevideo] Preview not found: ${previewPath}`);
      return res.status(404).json({
        success: false,
        error: 'Preview not found'
      });
    }

    // Set proper headers for video streaming
    const stat = fs.statSync(previewPath);
    const fileSize = stat.size;
    const range = req.headers.range;

    console.log(`[LiveRevideo] Serving preview - Size: ${fileSize} bytes, Range: ${range}`);

    if (range) {
      const parts = range.replace(/bytes=/, "").split("-");
      const start = parseInt(parts[0], 10);
      const end = parts[1] ? parseInt(parts[1], 10) : fileSize - 1;
      const chunksize = (end - start) + 1;
      const file = fs.createReadStream(previewPath, { start, end });
      const head = {
        'Content-Range': `bytes ${start}-${end}/${fileSize}`,
        'Accept-Ranges': 'bytes',
        'Content-Length': chunksize,
        'Content-Type': 'video/mp4',
        'Cache-Control': 'no-cache',
      };
      res.writeHead(206, head);
      file.pipe(res);
    } else {
      const head = {
        'Content-Length': fileSize,
        'Content-Type': 'video/mp4',
        'Cache-Control': 'no-cache',
      };
      res.writeHead(200, head);
      fs.createReadStream(previewPath).pipe(res);
    }
  } catch (error) {
    console.error('[Live Revideo] Preview serve failed:', error);
    res.status(500).json({
      success: false,
      error: error instanceof Error ? error.message : 'Preview serve failed'
    });
  }
});

// Serve download files with enhanced video streaming
router.get('/download/:filename', (req, res) => {
  try {
    const { filename } = req.params;
    const downloadPath = path.join('./renders', filename);
    
    console.log(`[LiveRevideo] Download request: ${downloadPath}`);
    
    if (!fs.existsSync(downloadPath)) {
      console.error(`[LiveRevideo] Download file not found: ${downloadPath}`);
      return res.status(404).json({
        success: false,
        error: 'File not found'
      });
    }

    // Get file stats for proper headers
    const stat = fs.statSync(downloadPath);
    const fileSize = stat.size;
    
    console.log(`[LiveRevideo] Serving download - Size: ${fileSize} bytes`);
    
    // Set proper download headers
    res.setHeader('Content-Type', 'video/mp4');
    res.setHeader('Content-Disposition', `attachment; filename="${filename}"`);
    res.setHeader('Content-Length', fileSize);
    res.setHeader('Accept-Ranges', 'bytes');
    
    // Handle range requests for better streaming
    const range = req.headers.range;
    if (range) {
      const parts = range.replace(/bytes=/, "").split("-");
      const start = parseInt(parts[0], 10);
      const end = parts[1] ? parseInt(parts[1], 10) : fileSize - 1;
      const chunksize = (end - start) + 1;
      
      const file = fs.createReadStream(downloadPath, { start, end });
      const head = {
        'Content-Range': `bytes ${start}-${end}/${fileSize}`,
        'Accept-Ranges': 'bytes',
        'Content-Length': chunksize,
        'Content-Type': 'video/mp4',
      };
      res.writeHead(206, head);
      file.pipe(res);
    } else {
      fs.createReadStream(downloadPath).pipe(res);
    }
  } catch (error) {
    console.error('[Live Revideo] Download serve failed:', error);
    res.status(500).json({
      success: false,
      error: error instanceof Error ? error.message : 'Download serve failed'
    });
  }
});

export default router;