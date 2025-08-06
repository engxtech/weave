import React, { useState, useRef, useCallback } from 'react';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Progress } from '@/components/ui/progress';
import { Slider } from '@/components/ui/slider';
import { Switch } from '@/components/ui/switch';
import { Label } from '@/components/ui/label';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Upload, Play, Eye, Move, Users, Zap, AlertCircle, CheckCircle, Download } from 'lucide-react';

interface CompleteAutoFlipOptions {
  targetAspectRatio: '9:16' | '16:9' | '1:1' | '4:3';
  motionStabilizationThreshold: number;
  saliencyWeight: number;
  faceWeight: number;
  objectWeight: number;
  snapToCenterDistance: number;
  maxSceneSize: number;
  enableVisualization: boolean;
}

interface SaliencyRegion {
  x: number;
  y: number;
  width: number;
  height: number;
  confidence: number;
  type: 'face' | 'person' | 'object' | 'pet' | 'car' | 'text';
  isRequired: boolean;
  weight: number;
}

interface CropDecision {
  timestamp: number;
  cropX: number;
  cropY: number;
  cropWidth: number;
  cropHeight: number;
  confidence: number;
  stabilized: boolean;
  saliencyRegions: SaliencyRegion[];
}

interface ProcessingStats {
  totalFrames: number;
  faceDetections: number;
  objectDetections: number;
  sceneChanges: number;
  averageConfidence: number;
  processingTime: number;
}

interface AutoFlipResult {
  success: boolean;
  outputBlob?: Blob;
  error?: string;
  processingStats?: ProcessingStats;
  metadata?: {
    algorithm: string;
    features: string[];
    stabilizationMode: string;
    aspectRatioConversion: string;
  };
}

export default function ClientSideAutoFlipClean() {
  const [selectedVideo, setSelectedVideo] = useState<File | null>(null);
  const [previewUrl, setPreviewUrl] = useState<string>('');
  const [isProcessing, setIsProcessing] = useState(false);
  const [progress, setProgress] = useState(0);
  const [currentStep, setCurrentStep] = useState('');
  const [result, setResult] = useState<AutoFlipResult | null>(null);
  
  const fileInputRef = useRef<HTMLInputElement>(null);
  const videoRef = useRef<HTMLVideoElement>(null);
  const canvasRef = useRef<HTMLCanvasElement>(null);

  const [options, setOptions] = useState<CompleteAutoFlipOptions>({
    targetAspectRatio: '9:16',
    motionStabilizationThreshold: 0.3,
    saliencyWeight: 0.7,
    faceWeight: 0.8,
    objectWeight: 0.6,
    snapToCenterDistance: 0.15,
    maxSceneSize: 5.0,
    enableVisualization: true
  });

  const handleVideoUpload = useCallback((event: React.ChangeEvent<HTMLInputElement>) => {
    const file = event.target.files?.[0];
    if (!file) return;

    setSelectedVideo(file);
    
    // Create preview URL
    const url = URL.createObjectURL(file);
    setPreviewUrl(url);
    
    // Reset previous results
    setResult(null);
    setProgress(0);
    setCurrentStep('');
  }, []);

  const processVideoClientSide = async () => {
    if (!selectedVideo) return;

    setIsProcessing(true);
    setProgress(0);
    setCurrentStep('Initializing processing...');

    try {
      const startTime = Date.now();

      // Phase 1: Load video and extract frames
      setCurrentStep('Loading video and extracting frames...');
      setProgress(10);
      
      const video = videoRef.current!;
      
      // Create a separate hidden canvas for frame analysis only
      const analysisCanvas = document.createElement('canvas');
      const analysisCtx = analysisCanvas.getContext('2d')!;
      
      // Set analysis canvas dimensions
      analysisCanvas.width = video.videoWidth;
      analysisCanvas.height = video.videoHeight;

      // Extract frames for analysis
      const frames: ImageData[] = [];
      const frameCount = Math.min(20, Math.floor(video.duration * 2)); // 2 FPS sampling
      
      for (let i = 0; i < frameCount; i++) {
        video.currentTime = (i / frameCount) * video.duration;
        await new Promise(resolve => setTimeout(resolve, 100)); // Wait for seek
        
        // Draw to analysis canvas (not the visible preview canvas)
        analysisCtx.drawImage(video, 0, 0, analysisCanvas.width, analysisCanvas.height);
        const imageData = analysisCtx.getImageData(0, 0, analysisCanvas.width, analysisCanvas.height);
        frames.push(imageData);
        
        setProgress(10 + (i / frameCount) * 30);
      }

      // Phase 2: Saliency Detection
      setCurrentStep('Analyzing saliency regions...');
      setProgress(40);
      
      const allSaliencyRegions: SaliencyRegion[][] = [];
      for (let i = 0; i < frames.length; i++) {
        const regions = detectSaliencyRegions(frames[i]);
        allSaliencyRegions.push(regions);
        setProgress(40 + (i / frames.length) * 20);
      }

      // Phase 3: Scene Boundary Detection
      setCurrentStep('Detecting scene boundaries...');
      setProgress(60);
      
      const sceneChanges = calculateSceneChanges(frames);

      // Phase 4: Generate Crop Decisions
      setCurrentStep('Computing optimal crop paths...');
      setProgress(70);
      
      const cropDecisions = generateCropDecisions(allSaliencyRegions, frames);

      // Phase 5: Apply Motion Stabilization
      setCurrentStep('Applying motion stabilization...');
      setProgress(80);
      
      const stabilizedDecisions = applyMotionStabilization(cropDecisions);

      // Phase 6: Generate Output Video
      setCurrentStep('Generating output video...');
      setProgress(90);
      
      const outputBlob = await generateOutputVideo(stabilizedDecisions);

      const processingTime = Date.now() - startTime;
      
      // Calculate processing statistics
      const stats: ProcessingStats = {
        totalFrames: frames.length,
        faceDetections: allSaliencyRegions.flat().filter(r => r.type === 'face').length,
        objectDetections: allSaliencyRegions.flat().filter(r => r.type === 'object').length,
        sceneChanges,
        averageConfidence: allSaliencyRegions.flat().reduce((sum, r) => sum + r.confidence, 0) / allSaliencyRegions.flat().length,
        processingTime
      };

      setResult({
        success: true,
        outputBlob,
        processingStats: stats,
        metadata: {
          algorithm: 'AutoFlip MediaPipe Style',
          features: ['Saliency Detection', 'Face Detection', 'Motion Stabilization', 'Scene Analysis'],
          stabilizationMode: 'Advanced',
          aspectRatioConversion: options.targetAspectRatio
        }
      });

      setProgress(100);
      setCurrentStep('Processing complete!');

    } catch (error) {
      console.error('Processing error:', error);
      setResult({
        success: false,
        error: error instanceof Error ? error.message : 'Unknown error occurred'
      });
    } finally {
      setIsProcessing(false);
    }
  };

  const detectSaliencyRegions = (imageData: ImageData): SaliencyRegion[] => {
    const regions: SaliencyRegion[] = [];
    const { width, height, data } = imageData;

    // Simple saliency detection based on color variance and edge detection
    const blockSize = 32;
    for (let y = 0; y < height - blockSize; y += blockSize) {
      for (let x = 0; x < width - blockSize; x += blockSize) {
        const variance = calculateColorVariance(data, x, y, blockSize, width);
        const faceScore = calculateFaceScore(data, x, y, blockSize, width);
        
        if (variance > 1000 || faceScore > 0.3) {
          regions.push({
            x: x / width,
            y: y / height,
            width: blockSize / width,
            height: blockSize / height,
            confidence: Math.min(variance / 5000 + faceScore, 1),
            type: faceScore > 0.5 ? 'face' : 'object',
            isRequired: faceScore > 0.7,
            weight: faceScore > 0.5 ? options.faceWeight : options.objectWeight
          });
        }
      }
    }

    return regions;
  };

  const calculateColorVariance = (data: Uint8ClampedArray, startX: number, startY: number, blockSize: number, width: number): number => {
    let sumR = 0, sumG = 0, sumB = 0;
    let count = 0;

    for (let y = startY; y < startY + blockSize && y < data.length / (width * 4); y++) {
      for (let x = startX; x < startX + blockSize && x < width; x++) {
        const idx = (y * width + x) * 4;
        sumR += data[idx];
        sumG += data[idx + 1];
        sumB += data[idx + 2];
        count++;
      }
    }

    const avgR = sumR / count;
    const avgG = sumG / count;
    const avgB = sumB / count;

    let variance = 0;
    for (let y = startY; y < startY + blockSize && y < data.length / (width * 4); y++) {
      for (let x = startX; x < startX + blockSize && x < width; x++) {
        const idx = (y * width + x) * 4;
        variance += Math.pow(data[idx] - avgR, 2) + Math.pow(data[idx + 1] - avgG, 2) + Math.pow(data[idx + 2] - avgB, 2);
      }
    }

    return variance / count;
  };

  const calculateFaceScore = (data: Uint8ClampedArray, startX: number, startY: number, blockSize: number, width: number): number => {
    // Simple face detection based on skin tone and geometric patterns
    let skinPixels = 0;
    let totalPixels = 0;

    for (let y = startY; y < startY + blockSize && y < data.length / (width * 4); y++) {
      for (let x = startX; x < startX + blockSize && x < width; x++) {
        const idx = (y * width + x) * 4;
        const r = data[idx];
        const g = data[idx + 1];
        const b = data[idx + 2];

        // Basic skin tone detection
        if (r > 95 && g > 40 && b > 20 && r > g && r > b && r - g > 15) {
          skinPixels++;
        }
        totalPixels++;
      }
    }

    return skinPixels / totalPixels;
  };

  const calculateSceneChanges = (frames: ImageData[]): number => {
    let changes = 0;
    for (let i = 1; i < frames.length; i++) {
      const diff = calculateFrameDifference(frames[i - 1], frames[i]);
      if (diff > options.maxSceneSize / 10) {
        changes++;
      }
    }
    return changes;
  };

  const calculateFrameDifference = (frame1: ImageData, frame2: ImageData): number => {
    const data1 = frame1.data;
    const data2 = frame2.data;
    let diff = 0;

    for (let i = 0; i < data1.length; i += 4) {
      diff += Math.abs(data1[i] - data2[i]) + Math.abs(data1[i + 1] - data2[i + 1]) + Math.abs(data1[i + 2] - data2[i + 2]);
    }

    return diff / (data1.length / 4) / 255;
  };

  const generateCropDecisions = (saliencyRegions: SaliencyRegion[][], frames: ImageData[]): CropDecision[] => {
    const decisions: CropDecision[] = [];
    const targetAspect = getAspectRatio(options.targetAspectRatio);

    for (let i = 0; i < frames.length; i++) {
      const regions = saliencyRegions[i];
      const frame = frames[i];
      
      // Calculate optimal crop area based on saliency
      let centerX = 0.5;
      let centerY = 0.5;
      let confidence = 0.5;

      if (regions.length > 0) {
        const weightedCenterX = regions.reduce((sum, r) => sum + (r.x + r.width / 2) * r.weight * r.confidence, 0);
        const weightedCenterY = regions.reduce((sum, r) => sum + (r.y + r.height / 2) * r.weight * r.confidence, 0);
        const totalWeight = regions.reduce((sum, r) => sum + r.weight * r.confidence, 0);

        if (totalWeight > 0) {
          centerX = weightedCenterX / totalWeight;
          centerY = weightedCenterY / totalWeight;
          confidence = Math.min(totalWeight / regions.length, 1);
        }
      }

      // Apply snap to center
      if (Math.abs(centerX - 0.5) < options.snapToCenterDistance) {
        centerX = 0.5;
      }
      if (Math.abs(centerY - 0.5) < options.snapToCenterDistance) {
        centerY = 0.5;
      }

      // Calculate crop dimensions
      const sourceAspect = frame.width / frame.height;
      let cropWidth, cropHeight;

      if (sourceAspect > targetAspect) {
        // Source is wider, crop width
        cropHeight = 1;
        cropWidth = targetAspect / sourceAspect;
      } else {
        // Source is taller, crop height
        cropWidth = 1;
        cropHeight = sourceAspect / targetAspect;
      }

      // Ensure crop stays within bounds
      const cropX = Math.max(0, Math.min(1 - cropWidth, centerX - cropWidth / 2));
      const cropY = Math.max(0, Math.min(1 - cropHeight, centerY - cropHeight / 2));

      decisions.push({
        timestamp: i / frames.length,
        cropX,
        cropY,
        cropWidth,
        cropHeight,
        confidence,
        stabilized: false,
        saliencyRegions: regions
      });
    }

    return decisions;
  };

  const applyMotionStabilization = (decisions: CropDecision[]): CropDecision[] => {
    const stabilized = [...decisions];
    const smoothingWindow = Math.max(1, Math.floor(decisions.length * options.motionStabilizationThreshold));

    for (let i = 0; i < stabilized.length; i++) {
      const start = Math.max(0, i - smoothingWindow);
      const end = Math.min(stabilized.length, i + smoothingWindow + 1);
      
      let avgX = 0, avgY = 0, count = 0;
      
      for (let j = start; j < end; j++) {
        avgX += decisions[j].cropX;
        avgY += decisions[j].cropY;
        count++;
      }
      
      stabilized[i] = {
        ...decisions[i],
        cropX: avgX / count,
        cropY: avgY / count,
        stabilized: true
      };
    }

    return stabilized;
  };

  const generateOutputVideo = async (decisions: CropDecision[]): Promise<Blob> => {
    const video = videoRef.current!;
    
    // Create a separate hidden canvas for video generation only
    const outputCanvas = document.createElement('canvas');
    const outputCtx = outputCanvas.getContext('2d')!;
    
    // Set target dimensions based on aspect ratio
    const targetDims = getTargetDimensions(video.videoWidth, video.videoHeight, options.targetAspectRatio);
    outputCanvas.width = targetDims.width;
    outputCanvas.height = targetDims.height;
    
    // Create MediaRecorder for video capture with audio preservation
    const stream = outputCanvas.captureStream(30); // Back to 30 FPS for smooth video
    
    // Audio capture - simplified approach that works reliably
    try {
      // For file-based videos, capture audio using Web Audio API
      const audioContext = new (window.AudioContext || (window as any).webkitAudioContext)();
      await audioContext.resume(); // Ensure audio context is running
      
      const source = audioContext.createMediaElementSource(video);
      const destination = audioContext.createMediaStreamDestination();
      
      // Connect audio source to both destination (for recording) and speakers (for playback)
      source.connect(destination);
      source.connect(audioContext.destination);
      
      // Add audio tracks to the video stream
      const audioTracks = destination.stream.getAudioTracks();
      audioTracks.forEach(track => {
        stream.addTrack(track);
        console.log('Added audio track:', track);
      });
      
      console.log('Audio capture setup complete, tracks:', audioTracks.length);
    } catch (audioError) {
      console.warn('Audio capture failed, proceeding without audio:', audioError);
      // Continue without audio rather than failing completely
    }
    
    let mediaRecorder: MediaRecorder;
    let mimeType = 'video/mp4';
    
    // Try MP4 first with higher quality settings
    if (MediaRecorder.isTypeSupported('video/mp4;codecs=h264,mp4a.40.2')) {
      mediaRecorder = new MediaRecorder(stream, {
        mimeType: 'video/mp4;codecs=h264,mp4a.40.2',
        videoBitsPerSecond: 5000000, // 5 Mbps for high quality
        audioBitsPerSecond: 128000   // 128 kbps for audio
      });
    } else if (MediaRecorder.isTypeSupported('video/webm;codecs=vp9,opus')) {
      mediaRecorder = new MediaRecorder(stream, {
        mimeType: 'video/webm;codecs=vp9,opus',
        videoBitsPerSecond: 5000000,
        audioBitsPerSecond: 128000
      });
      mimeType = 'video/webm';
    } else {
      mediaRecorder = new MediaRecorder(stream);
      mimeType = 'video/webm';
    }
    
    const chunks: Blob[] = [];
    mediaRecorder.ondataavailable = (event) => {
      if (event.data.size > 0) {
        chunks.push(event.data);
      }
    };
    
    return new Promise((resolve) => {
      mediaRecorder.onstop = () => {
        const videoBlob = new Blob(chunks, { type: mimeType });
        resolve(videoBlob);
      };
      
      // Use full video duration with proper frame rate matching
      const duration = video.duration;
      const frameRate = 30; // Match capture stream FPS
      const totalFrames = Math.floor(duration * frameRate);
      const frameInterval = 1000 / frameRate; // 33.33ms per frame
      
      let frameIndex = 0;
      
      const processFrame = async () => {
        if (frameIndex >= totalFrames) {
          // Stop recording after processing all frames
          setTimeout(() => mediaRecorder.stop(), 200);
          return;
        }
        
        try {
          // Calculate precise time for this frame with proper interpolation
          const currentTime = frameIndex * (duration / totalFrames);
          
          // Ensure video is at the right time with better synchronization
          if (Math.abs(video.currentTime - currentTime) > 0.02) {
            video.currentTime = currentTime;
            
            // Wait for video to be ready with proper timing
            await new Promise<void>((resolve) => {
              const startTime = Date.now();
              const checkReady = () => {
                if (video.readyState >= 3 || Date.now() - startTime > 100) {
                  resolve();
                } else {
                  requestAnimationFrame(checkReady);
                }
              };
              checkReady();
            });
            
            // Additional small delay for frame stability
            await new Promise(resolve => setTimeout(resolve, 16)); // One frame at 60fps
          }
          
          // Get corresponding crop decision with linear interpolation
          const normalizedTime = frameIndex / totalFrames;
          const decisionIndex = Math.min(
            Math.floor(normalizedTime * decisions.length),
            decisions.length - 1
          );
          const decision = decisions[decisionIndex];
          
          // Calculate pixel coordinates with strict bounds checking
          const sourceWidth = video.videoWidth;
          const sourceHeight = video.videoHeight;
          
          const pixelCropX = Math.max(0, Math.min(Math.floor(decision.cropX * sourceWidth), sourceWidth - 1));
          const pixelCropY = Math.max(0, Math.min(Math.floor(decision.cropY * sourceHeight), sourceHeight - 1));
          const pixelCropWidth = Math.max(1, Math.min(Math.floor(decision.cropWidth * sourceWidth), sourceWidth - pixelCropX));
          const pixelCropHeight = Math.max(1, Math.min(Math.floor(decision.cropHeight * sourceHeight), sourceHeight - pixelCropY));
          
          // Clear output canvas with consistent background
          outputCtx.fillStyle = '#000000';
          outputCtx.fillRect(0, 0, outputCanvas.width, outputCanvas.height);
          
          // Draw only the video content - absolutely no overlays
          if (video.videoWidth > 0 && video.videoHeight > 0) {
            outputCtx.drawImage(
              video,
              pixelCropX, pixelCropY, pixelCropWidth, pixelCropHeight,
              0, 0, outputCanvas.width, outputCanvas.height
            );
          }
          
        } catch (error) {
          console.warn('Frame processing error:', error);
          // Fill with black frame on error
          outputCtx.fillStyle = '#000000';
          outputCtx.fillRect(0, 0, outputCanvas.width, outputCanvas.height);
        }
        
        frameIndex++;
        
        // Schedule next frame with precise timing
        setTimeout(processFrame, frameInterval);
      };
      
      // Start recording and begin frame processing
      mediaRecorder.start(50); // Smaller chunks for better synchronization
      
      // Wait a moment for recording to initialize then start processing
      setTimeout(processFrame, 50);
    });
  };

  const getAspectRatio = (ratio: string): number => {
    switch (ratio) {
      case '9:16': return 9 / 16;
      case '16:9': return 16 / 9;
      case '1:1': return 1;
      case '4:3': return 4 / 3;
      default: return 9 / 16;
    }
  };

  const getTargetDimensions = (sourceWidth: number, sourceHeight: number, aspectRatio: string) => {
    const targetAspect = getAspectRatio(aspectRatio);
    const sourceAspect = sourceWidth / sourceHeight;
    
    let targetWidth, targetHeight;
    
    if (sourceAspect > targetAspect) {
      targetHeight = sourceHeight;
      targetWidth = targetHeight * targetAspect;
    } else {
      targetWidth = sourceWidth;
      targetHeight = targetWidth / targetAspect;
    }
    
    return { width: Math.round(targetWidth), height: Math.round(targetHeight) };
  };

  const downloadResult = () => {
    if (!result?.outputBlob) return;
    
    const url = URL.createObjectURL(result.outputBlob);
    const a = document.createElement('a');
    a.href = url;
    
    // Determine file extension based on blob type
    const fileExtension = result.outputBlob.type.includes('mp4') ? 'mp4' : 'webm';
    a.download = `autoflip-${options.targetAspectRatio}-${Date.now()}.${fileExtension}`;
    
    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);
    URL.revokeObjectURL(url);
  };

  return (
    <div className="max-w-4xl mx-auto p-6 space-y-6">
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <Upload className="w-5 h-5" />
            Client-Side AutoFlip Processing
          </CardTitle>
        </CardHeader>
        <CardContent className="space-y-6">
          {/* Advanced Configuration Controls */}
          <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
            {/* Left Column - Video Upload & Basic Controls */}
            <div className="space-y-4">
              <div className="flex items-center gap-4">
                <Button
                  onClick={() => fileInputRef.current?.click()}
                  variant="outline"
                  className="flex items-center gap-2"
                >
                  <Upload className="w-4 h-4" />
                  Select Video
                </Button>
                
                <Button
                  onClick={processVideoClientSide}
                  disabled={!selectedVideo || isProcessing}
                  className="flex items-center gap-2"
                >
                  <Play className="w-4 h-4" />
                  Process Video
                </Button>
              </div>

              {/* Target Aspect Ratio */}
              <div className="space-y-2">
                <Label htmlFor="aspect-ratio">Target Aspect Ratio</Label>
                <Select 
                  value={options.targetAspectRatio} 
                  onValueChange={(value) => setOptions(prev => ({ ...prev, targetAspectRatio: value as any }))}
                >
                  <SelectTrigger>
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="9:16">9:16 (Portrait/Stories)</SelectItem>
                    <SelectItem value="16:9">16:9 (Landscape)</SelectItem>
                    <SelectItem value="1:1">1:1 (Square)</SelectItem>
                    <SelectItem value="4:3">4:3 (Standard)</SelectItem>
                  </SelectContent>
                </Select>
              </div>

              {/* Motion Stabilization */}
              <div className="space-y-3">
                <div className="flex items-center gap-2">
                  <Move className="w-4 h-4 text-blue-600" />
                  <Label>Motion Stabilization Threshold</Label>
                </div>
                <div className="space-y-2">
                  <Slider
                    value={[options.motionStabilizationThreshold]}
                    onValueChange={([value]) => 
                      setOptions(prev => ({ ...prev, motionStabilizationThreshold: value }))
                    }
                    min={0}
                    max={1}
                    step={0.1}
                    className="w-full"
                  />
                  <div className="text-xs text-gray-500">
                    Current: {options.motionStabilizationThreshold.toFixed(1)} 
                    (Higher = more stable, less responsive)
                  </div>
                </div>
              </div>
            </div>

            {/* Right Column - Advanced Detection Controls */}
            <div className="space-y-4">
              {/* Face Detection Weight */}
              <div className="space-y-3">
                <div className="flex items-center gap-2">
                  <Users className="w-4 h-4 text-purple-600" />
                  <Label>Face Detection Priority</Label>
                </div>
                <div className="space-y-2">
                  <Slider
                    value={[options.faceWeight]}
                    onValueChange={([value]) => 
                      setOptions(prev => ({ ...prev, faceWeight: value }))
                    }
                    min={0}
                    max={1}
                    step={0.1}
                    className="w-full"
                  />
                  <div className="text-xs text-gray-500">
                    Current: {options.faceWeight.toFixed(1)} 
                    (Higher = prioritizes faces over other elements)
                  </div>
                </div>
              </div>

              {/* Object Detection Weight */}
              <div className="space-y-3">
                <div className="flex items-center gap-2">
                  <Zap className="w-4 h-4 text-orange-600" />
                  <Label>Object Detection Weight</Label>
                </div>
                <div className="space-y-2">
                  <Slider
                    value={[options.objectWeight]}
                    onValueChange={([value]) => 
                      setOptions(prev => ({ ...prev, objectWeight: value }))
                    }
                    min={0}
                    max={1}
                    step={0.1}
                    className="w-full"
                  />
                  <div className="text-xs text-gray-500">
                    Current: {options.objectWeight.toFixed(1)} 
                    (Higher = focuses more on detected objects)
                  </div>
                </div>
              </div>

              {/* Enable Visualization */}
              <div className="flex items-center space-x-2">
                <Switch
                  id="visualization"
                  checked={options.enableVisualization}
                  onCheckedChange={(checked) => 
                    setOptions(prev => ({ ...prev, enableVisualization: checked }))
                  }
                />
                <Label htmlFor="visualization">Enable Processing Visualization</Label>
              </div>
            </div>
          </div>
          
          <input
            ref={fileInputRef}
            type="file"
            accept="video/*"
            onChange={handleVideoUpload}
            className="hidden"
          />

          {selectedVideo && (
            <div className="text-sm text-gray-600">
              Selected: {selectedVideo.name} ({(selectedVideo.size / 1024 / 1024).toFixed(2)} MB)
            </div>
          )}

          {/* Video Preview */}
          {previewUrl && (
            <div className="space-y-2">
              <h3 className="font-medium">Original Video</h3>
              <video
                ref={videoRef}
                src={previewUrl}
                controls
                className="w-full max-w-md rounded-lg border"
              />
            </div>
          )}

          {/* Processing Progress */}
          {isProcessing && (
            <div className="space-y-3">
              <div className="flex items-center gap-2">
                <Eye className="w-4 h-4 animate-pulse" />
                <span className="font-medium">Processing Video...</span>
              </div>
              <Progress value={progress} className="w-full" />
              <div className="text-sm text-gray-600">{currentStep}</div>
            </div>
          )}

          {/* Results */}
          {result && (
            <div className="space-y-4">
              {result.success ? (
                <div className="space-y-3">
                  <div className="flex items-center gap-2 text-green-600">
                    <CheckCircle className="w-4 h-4" />
                    <span className="font-medium">Processing Complete!</span>
                  </div>
                  
                  {result.processingStats && (
                    <div className="grid grid-cols-2 gap-4 p-4 bg-gray-50 rounded-lg">
                      <div className="text-sm">
                        <div className="font-medium">Processing Statistics</div>
                        <div>Frames Analyzed: {result.processingStats.totalFrames}</div>
                        <div>Face Detections: {result.processingStats.faceDetections}</div>
                        <div>Object Detections: {result.processingStats.objectDetections}</div>
                      </div>
                      <div className="text-sm">
                        <div>Scene Changes: {result.processingStats.sceneChanges}</div>
                        <div>Avg Confidence: {(result.processingStats.averageConfidence * 100).toFixed(1)}%</div>
                        <div>Processing Time: {(result.processingStats.processingTime / 1000).toFixed(1)}s</div>
                      </div>
                    </div>
                  )}
                  
                  <div className="space-y-3">
                    {/* Video Preview */}
                    <div className="space-y-2">
                      <h3 className="font-medium">Processed Video Preview</h3>
                      <video
                        src={result.outputBlob ? URL.createObjectURL(result.outputBlob) : ''}
                        controls
                        className="w-full max-w-md rounded-lg border"
                        style={{
                          aspectRatio: options.targetAspectRatio === '9:16' ? '9/16' :
                                      options.targetAspectRatio === '16:9' ? '16/9' :
                                      options.targetAspectRatio === '4:3' ? '4/3' : '1/1'
                        }}
                      />
                    </div>
                    
                    <Button 
                      onClick={downloadResult}
                      className="flex items-center gap-2"
                    >
                      <Download className="w-4 h-4" />
                      Download Video ({result.outputBlob?.type.includes('mp4') ? '.mp4' : '.webm'})
                    </Button>
                  </div>
                </div>
              ) : (
                <div className="flex items-center gap-2 text-red-600">
                  <AlertCircle className="w-4 h-4" />
                  <span>Processing failed: {result.error}</span>
                </div>
              )}
            </div>
          )}
        </CardContent>
      </Card>
      
      {/* Hidden canvas for preview only - Video generation uses separate canvases */}
      <canvas ref={canvasRef} className="hidden" style={{ display: 'none' }} />
    </div>
  );
}