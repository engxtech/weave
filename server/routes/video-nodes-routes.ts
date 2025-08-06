import { Router } from 'express';
import { VoiceProcessorService } from '../services/voice-processor-service';
import { AudioEnhancementService } from '../services/audio-enhancement-service';
import { EnhancementService } from '../services/enhancement-service';
import { ShortsExtractorService } from '../services/shorts-extractor-service';
import { CaptionGeneratorService } from '../services/caption-generator-service';
import { WorkflowOrchestrator } from '../services/workflow-orchestrator';

const router = Router();

// Shorts Extraction Node - Parallel Processing
router.post('/extract-shorts', async (req, res) => {
  try {
    const { videoPath, searchPhrases, targetViralMoments } = req.body;

    if (!videoPath) {
      return res.status(400).json({
        success: false,
        error: 'Video path is required'
      });
    }

    console.log('=== SHORTS EXTRACTION REQUEST ===');
    console.log('Video path:', videoPath);
    console.log('Search phrases:', searchPhrases);
    console.log('Target viral moments:', targetViralMoments);

    const shortsService = new ShortsExtractorService(process.env.GEMINI_API_KEY || '');
    
    const result = await shortsService.extractViralMoments(
      videoPath,
      searchPhrases || []
    );

    // Generate actual clips if requested
    let generatedClips = [];
    if (result.moments.length > 0) {
      generatedClips = await shortsService.generateShortClips(videoPath, result.moments);
    }

    res.json({
      success: true,
      data: {
        ...result,
        generatedClips,
        message: `Extracted ${result.totalClips} viral moments in ${result.categorizedMoments.inspiring.length} inspiring, ${result.categorizedMoments.viral.length} viral, ${result.categorizedMoments.funny.length} funny categories`
      }
    });

  } catch (error) {
    console.error('=== SHORTS EXTRACTION ERROR ===');
    console.error('Error:', error);
    
    res.status(500).json({
      success: false,
      error: error.message || 'Failed to extract shorts',
      details: process.env.NODE_ENV === 'development' ? error.stack : undefined
    });
  }
});

// Voice Processing Node
router.post('/process-voice', async (req, res) => {
  try {
    const { 
      videoPath, 
      targetLanguage, 
      preserveBackgroundAudio, 
      safewords, 
      translationDictionary 
    } = req.body;

    if (!videoPath || !targetLanguage) {
      return res.status(400).json({
        success: false,
        error: 'Video path and target language are required'
      });
    }

    console.log('=== VOICE PROCESSING REQUEST ===');
    console.log('Video path:', videoPath);
    console.log('Target language:', targetLanguage);

    const voiceService = new VoiceProcessorService();
    
    const result = await voiceService.processVoice(
      videoPath,
      {
        targetLanguage,
        preserveBackgroundAudio,
        safewords: safewords?.split(',').map((s: string) => s.trim()) || [],
        translationDictionary: translationDictionary || {}
      }
    );

    res.json({
      success: true,
      data: result,
      message: 'Voice processing completed successfully'
    });

  } catch (error) {
    console.error('=== VOICE PROCESSING ERROR ===');
    console.error('Error:', error);
    
    res.status(500).json({
      success: false,
      error: error.message || 'Failed to process voice',
      details: process.env.NODE_ENV === 'development' ? error.stack : undefined
    });
  }
});

// Audio Enhancement Node
router.post('/enhance-audio', async (req, res) => {
  try {
    const { 
      videoPath, 
      processingBackend, 
      enhancementType, 
      enhancementSteps 
    } = req.body;

    if (!videoPath) {
      return res.status(400).json({
        success: false,
        error: 'Video path is required'
      });
    }

    console.log('=== AUDIO ENHANCEMENT REQUEST ===');
    console.log('Video path:', videoPath);
    console.log('Enhancement type:', enhancementType);

    const audioService = new AudioEnhancementService(process.env.GEMINI_API_KEY || '');
    
    const result = await audioService.enhanceAudio(
      videoPath,
      processingBackend || 'Audiophonic',
      enhancementType || 'Enhance & Denoise',
      enhancementSteps || 75
    );

    res.json({
      success: result.success,
      data: result,
      message: result.success ? 'Audio enhancement completed successfully' : 'Audio enhancement failed'
    });

  } catch (error) {
    console.error('=== AUDIO ENHANCEMENT ERROR ===');
    console.error('Error:', error);
    
    res.status(500).json({
      success: false,
      error: error.message || 'Failed to enhance audio',
      details: process.env.NODE_ENV === 'development' ? error.stack : undefined
    });
  }
});

// Eye Contact Correction Node (placeholder)
router.post('/correct-eye-contact', async (req, res) => {
  try {
    const { videoPath, accuracyBoost, naturalLookAway } = req.body;

    if (!videoPath) {
      return res.status(400).json({
        success: false,
        error: 'Video path is required'
      });
    }

    // Placeholder implementation - will use Gemini vision API
    console.log('=== EYE CONTACT CORRECTION REQUEST ===');
    console.log('Video path:', videoPath);
    console.log('Accuracy boost:', accuracyBoost);
    console.log('Natural look away:', naturalLookAway);
    
    // For now, return the same video with a success message
    res.json({
      success: true,
      data: {
        outputPath: videoPath,
        message: 'Eye contact correction will be implemented with Gemini Vision API'
      }
    });



  } catch (error) {
    res.status(500).json({
      success: false,
      error: error.message || 'Failed to correct eye contact'
    });
  }
});

// Video Reframing Node (placeholder)
router.post('/reframe-video', async (req, res) => {
  try {
    const { videoPath, aspectRatio, activeSpeakerDetection, focusSubject, avoidSubject } = req.body;

    if (!videoPath) {
      return res.status(400).json({
        success: false,
        error: 'Video path is required'
      });
    }

    console.log('=== VIDEO REFRAMING REQUEST ===');
    console.log('Video path:', videoPath);
    console.log('Aspect ratio:', aspectRatio);

    // TODO: Implement intelligent reframing using Gemini vision
    res.json({
      success: true,
      data: {
        message: 'Video reframing will be implemented with Gemini vision API',
        videoPath: videoPath + '_reframed.mp4',
        processingTime: 8000
      }
    });

  } catch (error) {
    res.status(500).json({
      success: false,
      error: error.message || 'Failed to reframe video'
    });
  }
});

// Content Cutting Node (placeholder)
router.post('/cut-content', async (req, res) => {
  try {
    const { videoPath, contentToRemove } = req.body;

    if (!videoPath || !contentToRemove) {
      return res.status(400).json({
        success: false,
        error: 'Video path and content description are required'
      });
    }

    console.log('=== CONTENT CUTTING REQUEST ===');
    console.log('Video path:', videoPath);
    console.log('Content to remove:', contentToRemove);

    // TODO: Implement intelligent content cutting using Gemini multimodal
    res.json({
      success: true,
      data: {
        message: 'Content cutting will be implemented with Gemini multimodal API',
        videoPath: videoPath + '_cut.mp4',
        processingTime: 10000
      }
    });

  } catch (error) {
    res.status(500).json({
      success: false,
      error: error.message || 'Failed to cut content'
    });
  }
});

// Background Replacement Node (placeholder)
router.post('/replace-background', async (req, res) => {
  try {
    const { videoPath, processingEngine, backgroundColor } = req.body;

    if (!videoPath) {
      return res.status(400).json({
        success: false,
        error: 'Video path is required'
      });
    }

    console.log('=== BACKGROUND REPLACEMENT REQUEST ===');
    console.log('Video path:', videoPath);
    console.log('Background color:', backgroundColor);

    // TODO: Implement background replacement using Gemini vision
    res.json({
      success: true,
      data: {
        message: 'Background replacement will be implemented with Gemini vision API',
        videoPath: videoPath + '_bg_replaced.mp4',
        processingTime: 12000
      }
    });

  } catch (error) {
    res.status(500).json({
      success: false,
      error: error.message || 'Failed to replace background'
    });
  }
});

// B-Roll Generation Node (placeholder)
router.post('/generate-broll', async (req, res) => {
  try {
    const { videoPath, assetTypes, clipsPerMinute, styleDescription, contentFocus } = req.body;

    if (!videoPath) {
      return res.status(400).json({
        success: false,
        error: 'Video path is required'
      });
    }

    console.log('=== B-ROLL GENERATION REQUEST ===');
    console.log('Video path:', videoPath);
    console.log('Style:', styleDescription);

    // TODO: Implement B-roll generation using Gemini content analysis
    res.json({
      success: true,
      data: {
        message: 'B-roll generation will be implemented with Gemini content analysis',
        videoPath: videoPath + '_with_broll.mp4',
        generatedClips: [],
        processingTime: 15000
      }
    });

  } catch (error) {
    res.status(500).json({
      success: false,
      error: error.message || 'Failed to generate B-roll'
    });
  }
});

// Caption Generation Node
router.post('/generate-captions', async (req, res) => {
  try {
    const { videoPath, captionSize, highlightColor, style } = req.body;

    if (!videoPath) {
      return res.status(400).json({
        success: false,
        error: 'Video path is required'
      });
    }

    console.log('=== CAPTION GENERATION REQUEST ===');
    console.log('Video path:', videoPath);
    console.log('Caption size:', captionSize);
    console.log('Style:', style);

    const captionService = new CaptionGeneratorService();
    
    const result = await captionService.generateCaptions(
      videoPath,
      {
        style: style || 'dynamic',
        fontSize: captionSize || 24,
        highlightColor: highlightColor || '#00FFFF'
      }
    );

    res.json({
      success: true,
      data: result,
      message: 'Captions generated successfully'
    });

  } catch (error) {
    console.error('Caption generation error:', error);
    res.status(500).json({
      success: false,
      error: error instanceof Error ? error.message : 'Failed to generate captions'
    });
  }
});

// Music Generation Node (placeholder)
router.post('/generate-music', async (req, res) => {
  try {
    const { videoPath, musicStyle } = req.body;

    if (!videoPath) {
      return res.status(400).json({
        success: false,
        error: 'Video path is required'
      });
    }

    console.log('=== MUSIC GENERATION REQUEST ===');
    console.log('Video path:', videoPath);
    console.log('Music style:', musicStyle);

    // TODO: Implement music generation using Gemini mood analysis
    res.json({
      success: true,
      data: {
        message: 'Music generation will be implemented with Gemini mood analysis',
        videoPath: videoPath + '_with_music.mp4',
        musicPath: 'generated_music.mp3',
        processingTime: 20000
      }
    });

  } catch (error) {
    res.status(500).json({
      success: false,
      error: error.message || 'Failed to generate music'
    });
  }
});

// Enhancement Stage Node
router.post('/enhance-video', async (req, res) => {
  try {
    const { videoPath, config } = req.body;

    if (!videoPath) {
      return res.status(400).json({
        success: false,
        error: 'Video path is required'
      });
    }

    console.log('=== VIDEO ENHANCEMENT REQUEST ===');
    console.log('Video path:', videoPath);
    console.log('Config:', config);

    const enhancementService = new EnhancementService();
    
    const result = await enhancementService.enhanceVideo(
      videoPath,
      config || {
        enhanceAudio: true,
        stabilizeVideo: true,
        colorCorrection: true,
        noiseReduction: true
      }
    );

    res.json({
      success: true,
      data: result,
      message: 'Video enhancement completed successfully'
    });

  } catch (error) {
    console.error('Video enhancement error:', error);
    res.status(500).json({
      success: false,
      error: 'Video enhancement failed',
      details: error instanceof Error ? error.message : 'Unknown error'
    });
  }
});

// Workflow Execution Endpoint
router.post('/execute-workflow', async (req, res) => {
  try {
    const { nodes, connections } = req.body;

    if (!nodes || !connections) {
      return res.status(400).json({
        success: false,
        error: 'Workflow nodes and connections are required'
      });
    }

    console.log('=== WORKFLOW EXECUTION REQUEST ===');
    console.log('Nodes:', nodes.length);
    console.log('Connections:', connections.length);

    const orchestrator = new WorkflowOrchestrator();
    
    const workflow = {
      id: `workflow_${Date.now()}`,
      nodes,
      connections,
      results: {}
    };

    const executedWorkflow = await orchestrator.executeWorkflow(workflow);

    res.json({
      success: true,
      data: {
        workflowId: executedWorkflow.id,
        results: executedWorkflow.results,
        message: 'Workflow executed successfully'
      }
    });

  } catch (error) {
    console.error('Workflow execution error:', error);
    res.status(500).json({
      success: false,
      error: error instanceof Error ? error.message : 'Failed to execute workflow'
    });
  }
});

export default router;