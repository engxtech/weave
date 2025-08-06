import { Router } from 'express';
import { RevideoPreviewService } from '../services/revideo-preview-service';
import path from 'path';
import fs from 'fs/promises';

const router = Router();
const previewService = new RevideoPreviewService();

// Generate preview for a node
router.post('/generate-preview', async (req, res) => {
  try {
    const { nodeType, inputVideo, nodeConfig } = req.body;

    if (!nodeType || !inputVideo) {
      return res.status(400).json({
        success: false,
        error: 'Node type and input video are required'
      });
    }

    console.log('🎬 Generating preview for node:', nodeType);
    console.log('Input video:', inputVideo);
    console.log('Config:', nodeConfig);

    // For now, return the input video as preview
    // TODO: Implement actual Revideo scene generation once package is installed
    res.json({
      success: true,
      previewUrl: inputVideo,
      message: 'Using input video as preview (Revideo integration pending)'
    });

  } catch (error) {
    console.error('Preview generation error:', error);
    res.status(500).json({
      success: false,
      error: error instanceof Error ? error.message : 'Failed to generate preview'
    });
  }
});

// Get preview status
router.get('/preview-status/:nodeId', async (req, res) => {
  try {
    const { nodeId } = req.params;
    
    // TODO: Implement preview status tracking
    res.json({
      success: true,
      status: 'ready',
      nodeId
    });

  } catch (error) {
    res.status(500).json({
      success: false,
      error: 'Failed to get preview status'
    });
  }
});

export default router;