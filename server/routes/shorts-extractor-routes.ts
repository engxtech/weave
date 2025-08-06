import { Router } from 'express';
import { ShortsExtractorService } from '../services/shorts-extractor-service';

const router = Router();

// Extract viral moments from video
router.post('/extract-moments', async (req, res) => {
  try {
    const { videoPath, searchPhrases = [], targetViralMoments = true } = req.body;

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

    const extractorService = new ShortsExtractorService(process.env.GEMINI_API_KEY || '');
    
    const result = await extractorService.extractViralMoments(
      videoPath, 
      Array.isArray(searchPhrases) ? searchPhrases : searchPhrases.split(',').map((p: string) => p.trim())
    );

    console.log('=== SHORTS EXTRACTION SUCCESS ===');
    console.log(`Found ${result.totalClips} viral moments`);
    console.log(`Processing time: ${result.processingTime}ms`);
    console.log(`Overall confidence: ${result.confidence}%`);

    res.json({
      success: true,
      data: result,
      message: `Successfully extracted ${result.totalClips} viral moments`
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

// Generate short clips from viral moments
router.post('/generate-clips', async (req, res) => {
  try {
    const { videoPath, moments } = req.body;

    if (!videoPath || !moments || !Array.isArray(moments)) {
      return res.status(400).json({
        success: false,
        error: 'Video path and moments array are required'
      });
    }

    console.log('=== SHORTS CLIP GENERATION REQUEST ===');
    console.log('Video path:', videoPath);
    console.log('Moments count:', moments.length);

    const extractorService = new ShortsExtractorService(process.env.GEMINI_API_KEY || '');
    
    const clipPaths = await extractorService.generateShortClips(videoPath, moments);

    console.log('=== SHORTS CLIP GENERATION SUCCESS ===');
    console.log(`Generated ${clipPaths.length} clips`);

    res.json({
      success: true,
      clips: clipPaths.map((path, index) => ({
        id: `clip_${index + 1}`,
        path,
        moment: moments[index],
        downloadUrl: `/api/shorts/download/${path.split('/').pop()}`
      })),
      message: `Successfully generated ${clipPaths.length} short clips`
    });

  } catch (error) {
    console.error('=== SHORTS CLIP GENERATION ERROR ===');
    console.error('Error:', error);
    
    res.status(500).json({
      success: false,
      error: error.message || 'Failed to generate clips',
      details: process.env.NODE_ENV === 'development' ? error.stack : undefined
    });
  }
});

// Download generated clip
router.get('/download/:filename', (req, res) => {
  try {
    const { filename } = req.params;
    const filePath = filename; // Direct path since it's already in root
    
    res.download(filePath, (err) => {
      if (err) {
        console.error('Download error:', err);
        res.status(404).json({
          success: false,
          error: 'Clip not found'
        });
      }
    });
  } catch (error) {
    console.error('Download route error:', error);
    res.status(500).json({
      success: false,
      error: 'Download failed'
    });
  }
});

export default router;