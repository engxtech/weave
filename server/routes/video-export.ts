import { Router } from 'express';
import { spawn } from 'child_process';
import path from 'path';
import fs from 'fs';
import { nanoid } from 'nanoid';

const router = Router();

// Export video with timeline elements overlayed
router.post('/export-with-elements', async (req, res) => {
  try {
    const { project, videoFile } = req.body;
    
    console.log(`[VideoExport] Exporting project: ${project.name} with ${project.elements.length} elements`);
    
    if (!project.elements || project.elements.length === 0) {
      return res.status(400).json({
        success: false,
        error: 'No timeline elements to export'
      });
    }

    const outputFilename = `exported_${nanoid()}_${Date.now()}.mp4`;
    const outputPath = path.join('./renders', outputFilename);
    
    // Ensure renders directory exists
    if (!fs.existsSync('./renders')) {
      fs.mkdirSync('./renders', { recursive: true });
    }

    if (videoFile) {
      // Export with uploaded video + timeline elements
      const inputVideoPath = path.join('./uploads', videoFile);
      
      if (!fs.existsSync(inputVideoPath)) {
        return res.status(400).json({
          success: false,
          error: 'Video file not found'
        });
      }
      
      console.log(`[VideoExport] Combining video ${videoFile} with timeline elements`);
      
      // Build comprehensive FFmpeg filter chain
      let filterComplex = '[0:v]';
      let overlayCount = 0;
      let lastOutput = '0:v';
      
      // Process each timeline element
      project.elements.forEach((element, index) => {
        const startTime = element.startTime;
        const endTime = element.startTime + element.duration;
        
        switch (element.type) {
          case 'txt':
            const text = (element.properties.text || 'Text').replace(/'/g, "\\'");
            const fontSize = element.properties.fontSize || 48;
            const color = (element.properties.fill || '#ffffff').replace('#', '');
            const x = element.properties.x || 100;
            const y = element.properties.y || 100;
            
            // Create text overlay with timing
            filterComplex += `[${lastOutput}]drawtext=text='${text}':fontfile=/usr/share/fonts/truetype/dejavu/DejaVuSans-Bold.ttf:fontsize=${fontSize}:fontcolor=0x${color}:x=${x}:y=${y}:enable='between(t,${startTime},${endTime})':alpha='if(between(t,${startTime},${endTime}),1,0)'[v${overlayCount}];`;
            lastOutput = `v${overlayCount}`;
            overlayCount++;
            break;
            
          case 'circle':
            const radius = element.properties.radius || element.properties.size || 50;
            const circleColor = (element.properties.fill || '#ff0000').replace('#', '');
            const circleX = element.properties.x || 100;
            const circleY = element.properties.y || 100;
            
            // Create circle overlay (using drawbox as approximate)
            filterComplex += `[${lastOutput}]drawbox=x=${circleX-radius}:y=${circleY-radius}:w=${radius*2}:h=${radius*2}:color=0x${circleColor}:thickness=fill:enable='between(t,${startTime},${endTime})'[v${overlayCount}];`;
            lastOutput = `v${overlayCount}`;
            overlayCount++;
            break;
            
          case 'rect':
            const rectWidth = element.properties.width || 100;
            const rectHeight = element.properties.height || 100;
            const rectColor = (element.properties.fill || '#0066ff').replace('#', '');
            const rectX = element.properties.x || 100;
            const rectY = element.properties.y || 100;
            
            // Create rectangle overlay
            filterComplex += `[${lastOutput}]drawbox=x=${rectX}:y=${rectY}:w=${rectWidth}:h=${rectHeight}:color=0x${rectColor}:thickness=fill:enable='between(t,${startTime},${endTime})'[v${overlayCount}];`;
            lastOutput = `v${overlayCount}`;
            overlayCount++;
            break;
        }
      });
      
      // Remove trailing semicolon
      if (filterComplex.endsWith(';')) {
        filterComplex = filterComplex.slice(0, -1);
      }
      
      // Build FFmpeg command
      const ffmpegArgs = ['-i', inputVideoPath];
      
      if (overlayCount > 0) {
        ffmpegArgs.push('-filter_complex', filterComplex);
        ffmpegArgs.push('-map', `[${lastOutput}]`);
        ffmpegArgs.push('-map', '0:a'); // Map original audio stream
      } else {
        // No overlays, just copy video
        ffmpegArgs.push('-c:v', 'copy');
        ffmpegArgs.push('-map', '0:a'); // Map original audio stream
      }
      
      // Video and audio encoding settings
      ffmpegArgs.push('-c:v', 'libx264');
      ffmpegArgs.push('-c:a', 'aac');
      ffmpegArgs.push('-preset', 'medium');
      ffmpegArgs.push('-crf', '23');
      ffmpegArgs.push('-b:a', '128k');
      ffmpegArgs.push('-ar', '44100');
      ffmpegArgs.push('-shortest');
      ffmpegArgs.push('-y');
      ffmpegArgs.push(outputPath);
      
      console.log(`[VideoExport] FFmpeg command: ffmpeg ${ffmpegArgs.join(' ')}`);
      
      const ffmpegProcess = spawn('ffmpeg', ffmpegArgs);
      
      let ffmpegOutput = '';
      
      ffmpegProcess.stderr.on('data', (data) => {
        ffmpegOutput += data.toString();
        console.log(`[VideoExport] FFmpeg: ${data}`);
      });
      
      ffmpegProcess.on('close', (code) => {
        if (code === 0) {
          console.log(`[VideoExport] Export completed successfully: ${outputFilename}`);
          
          res.json({
            success: true,
            downloadUrl: `/api/renders/${outputFilename}`,
            filename: outputFilename,
            message: 'Video exported successfully with timeline elements'
          });
        } else {
          console.error(`[VideoExport] Export failed with code: ${code}`);
          console.error(`[VideoExport] FFmpeg output: ${ffmpegOutput}`);
          res.status(500).json({
            success: false,
            error: `Video export failed with code: ${code}`,
            details: ffmpegOutput
          });
        }
      });
      
    } else {
      // Create video from timeline elements only (no background video)
      const backgroundColor = project.backgroundColor || '#000000';
      const bgColor = backgroundColor.replace('#', '');
      
      let filterComplex = `color=c=0x${bgColor}:size=${project.canvasSize.width}x${project.canvasSize.height}:duration=${project.duration}[bg];`;
      let lastOutput = 'bg';
      let overlayCount = 0;
      
      // Add all timeline elements as overlays
      project.elements.forEach((element, index) => {
        const startTime = element.startTime;
        const endTime = element.startTime + element.duration;
        
        switch (element.type) {
          case 'txt':
            const text = (element.properties.text || 'Text').replace(/'/g, "\\'");
            const fontSize = element.properties.fontSize || 48;
            const color = (element.properties.fill || '#ffffff').replace('#', '');
            const x = element.properties.x || 100;
            const y = element.properties.y || 100;
            
            filterComplex += `[${lastOutput}]drawtext=text='${text}':fontfile=/usr/share/fonts/truetype/dejavu/DejaVuSans-Bold.ttf:fontsize=${fontSize}:fontcolor=0x${color}:x=${x}:y=${y}:enable='between(t,${startTime},${endTime})'[v${overlayCount}];`;
            lastOutput = `v${overlayCount}`;
            overlayCount++;
            break;
            
          case 'circle':
            const radius = element.properties.radius || element.properties.size || 50;
            const circleColor = (element.properties.fill || '#ff0000').replace('#', '');
            const circleX = element.properties.x || 100;
            const circleY = element.properties.y || 100;
            
            filterComplex += `[${lastOutput}]drawbox=x=${circleX-radius}:y=${circleY-radius}:w=${radius*2}:h=${radius*2}:color=0x${circleColor}:thickness=fill:enable='between(t,${startTime},${endTime})'[v${overlayCount}];`;
            lastOutput = `v${overlayCount}`;
            overlayCount++;
            break;
            
          case 'rect':
            const rectWidth = element.properties.width || 100;
            const rectHeight = element.properties.height || 100;
            const rectColor = (element.properties.fill || '#0066ff').replace('#', '');
            const rectX = element.properties.x || 100;
            const rectY = element.properties.y || 100;
            
            filterComplex += `[${lastOutput}]drawbox=x=${rectX}:y=${rectY}:w=${rectWidth}:h=${rectHeight}:color=0x${rectColor}:thickness=fill:enable='between(t,${startTime},${endTime})'[v${overlayCount}];`;
            lastOutput = `v${overlayCount}`;
            overlayCount++;
            break;
        }
      });
      
      // Remove trailing semicolon
      if (filterComplex.endsWith(';')) {
        filterComplex = filterComplex.slice(0, -1);
      }
      
      const ffmpegArgs = [
        '-f', 'lavfi',
        '-i', filterComplex,
        '-map', `[${lastOutput}]`,
        '-c:v', 'libx264',
        '-preset', 'medium',
        '-crf', '23',
        '-pix_fmt', 'yuv420p',
        '-t', project.duration.toString(),
        '-y',
        outputPath
      ];
      
      console.log(`[VideoExport] FFmpeg command (elements only): ffmpeg ${ffmpegArgs.join(' ')}`);

      const ffmpegProcess = spawn('ffmpeg', ffmpegArgs);
      
      let ffmpegOutput = '';
      
      ffmpegProcess.stderr.on('data', (data) => {
        ffmpegOutput += data.toString();
        console.log(`[VideoExport] FFmpeg: ${data}`);
      });

      ffmpegProcess.on('close', (code) => {
        if (code === 0) {
          console.log(`[VideoExport] Export completed successfully: ${outputFilename}`);
          
          res.json({
            success: true,
            downloadUrl: `/api/renders/${outputFilename}`,
            filename: outputFilename,
            message: 'Video created successfully from timeline elements'
          });
        } else {
          console.error(`[VideoExport] Export failed with code: ${code}`);
          console.error(`[VideoExport] FFmpeg output: ${ffmpegOutput}`);
          res.status(500).json({
            success: false,
            error: `Video export failed with code: ${code}`,
            details: ffmpegOutput
          });
        }
      });
    }

  } catch (error) {
    console.error('[VideoExport] Export error:', error);
    res.status(500).json({
      success: false,
      error: error instanceof Error ? error.message : 'Export failed'
    });
  }
});

// Serve exported videos
router.get('/renders/:filename', (req, res) => {
  try {
    const { filename } = req.params;
    const filePath = path.join('./renders', filename);
    
    console.log(`[VideoExport] Download request: ${filePath}`);
    
    if (!fs.existsSync(filePath)) {
      console.error(`[VideoExport] File not found: ${filePath}`);
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
      
      const stream = fs.createReadStream(filePath, { start, end });
      
      res.writeHead(206, {
        'Content-Range': `bytes ${start}-${end}/${fileSize}`,
        'Accept-Ranges': 'bytes',
        'Content-Length': chunksize,
        'Content-Type': 'video/mp4'
      });
      
      stream.pipe(res);
    } else {
      const stream = fs.createReadStream(filePath);
      stream.pipe(res);
    }

  } catch (error) {
    console.error('[VideoExport] Download error:', error);
    res.status(500).json({
      success: false,
      error: error instanceof Error ? error.message : 'Download failed'
    });
  }
});

export default router;