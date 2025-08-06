import { Router } from 'express';
import multer from 'multer';
import path from 'path';
import fs from 'fs';

const router = Router();

// Configure multer for video uploads
const storage = multer.diskStorage({
  destination: (req, file, cb) => {
    const uploadDir = 'uploads';
    if (!fs.existsSync(uploadDir)) {
      fs.mkdirSync(uploadDir, { recursive: true });
    }
    cb(null, uploadDir);
  },
  filename: (req, file, cb) => {
    const uniqueSuffix = Date.now() + '-' + Math.round(Math.random() * 1E9);
    cb(null, 'video-' + uniqueSuffix + path.extname(file.originalname));
  }
});

const upload = multer({ 
  storage,
  limits: {
    fileSize: 500 * 1024 * 1024, // 500MB limit
  },
  fileFilter: (req, file, cb) => {
    if (file.mimetype.startsWith('video/')) {
      cb(null, true);
    } else {
      cb(new Error('Only video files are allowed'));
    }
  }
});

// Upload video for node editor
router.post('/video', upload.single('video'), (req, res) => {
  try {
    const file = req.file;
    
    if (!file) {
      return res.status(400).json({
        success: false,
        error: 'No video file provided'
      });
    }

    res.json({
      success: true,
      path: `/api/upload/video/${file.filename}`,
      filename: file.filename,
      originalName: file.originalname,
      size: file.size,
      message: 'Video uploaded successfully'
    });
  } catch (error) {
    console.error('Video upload failed:', error);
    res.status(500).json({
      success: false,
      error: error instanceof Error ? error.message : 'Upload failed'
    });
  }
});

// Serve uploaded videos
router.get('/video/:filename', (req, res) => {
  try {
    const { filename } = req.params;
    const videoPath = path.join('./uploads', filename);
    
    if (!fs.existsSync(videoPath)) {
      return res.status(404).json({
        success: false,
        error: 'Video not found'
      });
    }

    const stat = fs.statSync(videoPath);
    const fileSize = stat.size;
    const range = req.headers.range;

    if (range) {
      // Support video streaming with range requests
      const parts = range.replace(/bytes=/, "").split("-");
      const start = parseInt(parts[0], 10);
      const end = parts[1] ? parseInt(parts[1], 10) : fileSize-1;
      const chunksize = (end-start)+1;
      const file = fs.createReadStream(videoPath, {start, end});
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
      fs.createReadStream(videoPath).pipe(res);
    }
  } catch (error) {
    console.error('Video serve failed:', error);
    res.status(500).json({
      success: false,
      error: error instanceof Error ? error.message : 'Video serve failed'
    });
  }
});

// Generate video thumbnail
router.get('/thumbnail/:filename', (req, res) => {
  try {
    const { filename } = req.params;
    
    // In production, this would generate actual thumbnails using FFmpeg
    // For now, return a placeholder
    res.json({
      success: true,
      thumbnailUrl: `/api/placeholder-thumbnail.jpg`,
      message: 'Thumbnail generated'
    });
  } catch (error) {
    console.error('Thumbnail generation failed:', error);
    res.status(500).json({
      success: false,
      error: error instanceof Error ? error.message : 'Thumbnail generation failed'
    });
  }
});

// Serve uploaded shorts videos from subdirectory
router.get('/video/shorts/:filename', (req, res) => {
  try {
    const { filename } = req.params;
    const videoPath = path.join('./uploads/shorts', filename);
    
    if (!fs.existsSync(videoPath)) {
      return res.status(404).json({
        success: false,
        error: 'Shorts video not found'
      });
    }

    const stat = fs.statSync(videoPath);
    const fileSize = stat.size;
    const range = req.headers.range;

    if (range) {
      // Support video streaming with range requests
      const parts = range.replace(/bytes=/, "").split("-");
      const start = parseInt(parts[0], 10);
      const end = parts[1] ? parseInt(parts[1], 10) : fileSize - 1;
      const chunksize = (end - start) + 1;
      const file = fs.createReadStream(videoPath, { start, end });
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
      fs.createReadStream(videoPath).pipe(res);
    }
  } catch (error) {
    console.error('Error serving shorts video:', error);
    res.status(500).json({
      success: false,
      error: 'Failed to serve shorts video'
    });
  }
});

export default router;