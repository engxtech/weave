import express from 'express';
import path from 'path';
import fs from 'fs';
import { YouTubeShortsSubtitleSystem } from '../services/youtube-shorts-subtitle-system.js';

const router = express.Router();

// Initialize the YouTube Shorts subtitle system
const subtitleSystem = new YouTubeShortsSubtitleSystem();

/**
 * Generate professional subtitles using YouTube Shorts methodology
 * POST /api/youtube-shorts-subtitles/generate
 */
router.post('/generate', async (req, res) => {
  try {
    const { videoPath, settings = {} } = req.body;
    
    if (!videoPath) {
      return res.status(400).json({
        success: false,
        error: 'Video path is required'
      });
    }

    // Check if video file exists
    const fullVideoPath = path.resolve(videoPath);
    if (!fs.existsSync(fullVideoPath)) {
      return res.status(404).json({
        success: false,
        error: 'Video file not found'
      });
    }

    console.log(`[YouTubeShortsSubtitles] Generating subtitles for: ${videoPath}`);

    // Generate word-level subtitles using Deepgram
    const subtitles = await subtitleSystem.generateWordLevelSubtitles(fullVideoPath);

    // Create Revideo scene file
    const sceneFilePath = await subtitleSystem.createSubtitleSceneFile(
      subtitles, 
      'youtubeSubtitles', 
      settings
    );

    // Export to SRT format
    const srtContent = subtitleSystem.exportToSRT(subtitles);

    res.json({
      success: true,
      subtitles,
      sceneFilePath,
      srtContent,
      segmentCount: subtitles.length,
      message: `Generated professional YouTube Shorts-style subtitles with ${subtitles.length} segments`
    });

  } catch (error) {
    console.error('[YouTubeShortsSubtitles] Generation error:', error);
    res.status(500).json({
      success: false,
      error: error instanceof Error ? error.message : 'Subtitle generation failed'
    });
  }
});

/**
 * Generate enhanced script using OpenAI
 * POST /api/youtube-shorts-subtitles/enhance-script
 */
router.post('/enhance-script', async (req, res) => {
  try {
    const { transcript, style = 'viral' } = req.body;
    
    if (!transcript) {
      return res.status(400).json({
        success: false,
        error: 'Transcript is required'
      });
    }

    console.log(`[YouTubeShortsSubtitles] Enhancing script with style: ${style}`);

    const enhancedScript = await subtitleSystem.generateEnhancedScript(transcript, style);

    res.json({
      success: true,
      originalTranscript: transcript,
      enhancedScript,
      style,
      message: 'Script enhanced successfully'
    });

  } catch (error) {
    console.error('[YouTubeShortsSubtitles] Script enhancement error:', error);
    res.status(500).json({
      success: false,
      error: error instanceof Error ? error.message : 'Script enhancement failed'
    });
  }
});

/**
 * Create Revideo scene file from existing subtitle data
 * POST /api/youtube-shorts-subtitles/create-scene
 */
router.post('/create-scene', async (req, res) => {
  try {
    const { subtitles, sceneName = 'customSubtitles', settings = {} } = req.body;
    
    if (!subtitles || !Array.isArray(subtitles)) {
      return res.status(400).json({
        success: false,
        error: 'Valid subtitles array is required'
      });
    }

    console.log(`[YouTubeShortsSubtitles] Creating scene file: ${sceneName}`);

    const sceneFilePath = await subtitleSystem.createSubtitleSceneFile(
      subtitles,
      sceneName,
      settings
    );

    res.json({
      success: true,
      sceneFilePath,
      sceneName,
      subtitleCount: subtitles.length,
      message: 'Revideo scene file created successfully'
    });

  } catch (error) {
    console.error('[YouTubeShortsSubtitles] Scene creation error:', error);
    res.status(500).json({
      success: false,
      error: error instanceof Error ? error.message : 'Scene creation failed'
    });
  }
});

/**
 * Export subtitles to SRT format
 * POST /api/youtube-shorts-subtitles/export-srt
 */
router.post('/export-srt', async (req, res) => {
  try {
    const { subtitles, filename = 'subtitles.srt' } = req.body;
    
    if (!subtitles || !Array.isArray(subtitles)) {
      return res.status(400).json({
        success: false,
        error: 'Valid subtitles array is required'
      });
    }

    console.log(`[YouTubeShortsSubtitles] Exporting SRT file: ${filename}`);

    const srtContent = subtitleSystem.exportToSRT(subtitles);
    
    // Set proper headers for file download
    res.setHeader('Content-Type', 'text/plain');
    res.setHeader('Content-Disposition', `attachment; filename="${filename}"`);
    res.send(srtContent);

  } catch (error) {
    console.error('[YouTubeShortsSubtitles] SRT export error:', error);
    res.status(500).json({
      success: false,
      error: error instanceof Error ? error.message : 'SRT export failed'
    });
  }
});

/**
 * Get available caption settings presets
 * GET /api/youtube-shorts-subtitles/presets
 */
router.get('/presets', (req, res) => {
  const presets = {
    youtubeShorts: {
      name: 'YouTube Shorts Style',
      description: 'Official YouTube Shorts subtitle styling',
      settings: {
        fontSize: 80,
        fontWeight: 800,
        textAlign: 'center',
        textColor: 'white',
        currentWordColor: '#00FFFF',
        currentWordBackgroundColor: '#FF0000',
        shadowColor: 'black',
        shadowBlur: 30,
        numSimultaneousWords: 4,
        fadeInAnimation: true,
        textBoxWidthInPercent: 80
      }
    },
    minimal: {
      name: 'Minimal Style',
      description: 'Clean and simple subtitle styling',
      settings: {
        fontSize: 60,
        fontWeight: 600,
        textAlign: 'center',
        textColor: 'white',
        currentWordColor: '#FFFFFF',
        currentWordBackgroundColor: 'transparent',
        shadowColor: 'black',
        shadowBlur: 10,
        numSimultaneousWords: 6,
        fadeInAnimation: false,
        textBoxWidthInPercent: 90
      }
    },
    energetic: {
      name: 'Energetic Style',
      description: 'High-energy subtitle styling with vibrant colors',
      settings: {
        fontSize: 90,
        fontWeight: 900,
        textAlign: 'center',
        textColor: '#FFFF00',
        currentWordColor: '#FF6600',
        currentWordBackgroundColor: '#000000',
        shadowColor: 'white',
        shadowBlur: 40,
        numSimultaneousWords: 3,
        fadeInAnimation: true,
        textBoxWidthInPercent: 70
      }
    }
  };

  res.json({
    success: true,
    presets,
    message: 'Available caption presets'
  });
});

export default router;