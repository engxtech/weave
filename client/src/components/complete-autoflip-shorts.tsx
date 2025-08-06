import { useState } from 'react';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Progress } from '@/components/ui/progress';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Slider } from '@/components/ui/slider';
import { Label } from '@/components/ui/label';
import { Badge } from '@/components/ui/badge';
import { Upload, Play, Download, Settings, Zap, Eye, ZoomIn } from 'lucide-react';
import { apiRequest } from '@/lib/queryClient';

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
  outputPath?: string;
  downloadUrl?: string;
  filename?: string;
  processingDetails?: {
    algorithm: string;
  } & ProcessingStats;
  metadata?: {
    algorithm: string;
    features: string[];
    stabilizationMode: string;
    aspectRatioConversion: string;
  };
}

export function CompleteAutoFlipShorts() {
  const [selectedFile, setSelectedFile] = useState<File | null>(null);
  const [isProcessing, setIsProcessing] = useState(false);
  const [progress, setProgress] = useState(0);
  const [result, setResult] = useState<AutoFlipResult | null>(null);
  const [error, setError] = useState<string | null>(null);
  
  // AutoFlip Configuration
  const [targetAspectRatio, setTargetAspectRatio] = useState('9:16');
  const [motionStabilizationThreshold, setMotionStabilizationThreshold] = useState([0.5]);
  const [saliencyWeight, setSaliencyWeight] = useState([0.8]);
  const [faceWeight, setFaceWeight] = useState([0.9]);
  const [objectWeight, setObjectWeight] = useState([0.7]);
  const [snapToCenterDistance, setSnapToCenterDistance] = useState([0.1]);
  const [enableVisualization, setEnableVisualization] = useState(false);
  
  // Dynamic Zoom Configuration
  const [enableDynamicZoom, setEnableDynamicZoom] = useState(true);
  const [minZoomFactor, setMinZoomFactor] = useState([0.7]);
  const [maxZoomFactor, setMaxZoomFactor] = useState([1.5]);
  const [focusPriorityMode, setFocusPriorityMode] = useState('smart_crop');
  const [subjectPadding, setSubjectPadding] = useState([0.15]);

  const handleFileSelect = (event: React.ChangeEvent<HTMLInputElement>) => {
    const file = event.target.files?.[0];
    if (file && file.type.startsWith('video/')) {
      setSelectedFile(file);
      setResult(null);
      setError(null);
    }
  };

  const processCompleteAutoFlip = async () => {
    if (!selectedFile) return;

    setIsProcessing(true);
    setProgress(0);
    setError(null);
    setResult(null);

    try {
      const formData = new FormData();
      formData.append('video', selectedFile);
      formData.append('targetAspectRatio', targetAspectRatio);
      formData.append('motionStabilizationThreshold', motionStabilizationThreshold[0].toString());
      formData.append('saliencyWeight', saliencyWeight[0].toString());
      formData.append('faceWeight', faceWeight[0].toString());
      formData.append('objectWeight', objectWeight[0].toString());
      formData.append('snapToCenterDistance', snapToCenterDistance[0].toString());
      formData.append('enableVisualization', enableVisualization.toString());
      
      // Dynamic Zoom Settings
      formData.append('enableDynamicZoom', enableDynamicZoom.toString());
      formData.append('minZoomFactor', minZoomFactor[0].toString());
      formData.append('maxZoomFactor', maxZoomFactor[0].toString());
      formData.append('focusPriorityMode', focusPriorityMode);
      formData.append('subjectPadding', subjectPadding[0].toString());

      // Simulate progress updates
      const progressInterval = setInterval(() => {
        setProgress(prev => Math.min(prev + Math.random() * 15, 90));
      }, 1000);

      const response = await fetch('/api/complete-autoflip-shorts', {
        method: 'POST',
        body: formData,
      });

      clearInterval(progressInterval);
      setProgress(100);

      const data = await response.json();

      if (data.success) {
        setResult(data);
        console.log('Complete AutoFlip shorts created successfully:', data);
      } else {
        setError(data.error || 'Complete AutoFlip processing failed');
      }
    } catch (err) {
      setError(err instanceof Error ? err.message : 'An error occurred during processing');
    } finally {
      setIsProcessing(false);
    }
  };

  const formatTime = (ms: number) => {
    const seconds = Math.floor(ms / 1000);
    return `${Math.floor(seconds / 60)}:${(seconds % 60).toString().padStart(2, '0')}`;
  };

  const formatConfidence = (confidence: number) => {
    return `${(confidence * 100).toFixed(1)}%`;
  };

  return (
    <Card className="w-full max-w-4xl mx-auto">
      <CardHeader>
        <div className="flex items-center gap-3">
          <div className="p-2 bg-blue-100 dark:bg-blue-900 rounded-lg">
            <Zap className="h-6 w-6 text-blue-600 dark:text-blue-400" />
          </div>
          <div>
            <CardTitle className="text-xl">Complete AutoFlip Shorts</CardTitle>
            <CardDescription>
              Advanced MediaPipe-based video cropping with multi-modal saliency detection
            </CardDescription>
          </div>
        </div>
      </CardHeader>

      <CardContent className="space-y-6">
        {/* File Upload */}
        <div className="space-y-4">
          <Label htmlFor="video-upload" className="text-base font-medium">
            Upload Video
          </Label>
          <div className="border-2 border-dashed border-gray-300 dark:border-gray-600 rounded-lg p-6">
            <div className="flex flex-col items-center gap-4">
              <Upload className="h-12 w-12 text-gray-400" />
              <div className="text-center">
                <p className="text-sm text-gray-600 dark:text-gray-400">
                  Choose a video file to process with Complete AutoFlip
                </p>
                <p className="text-xs text-gray-500 dark:text-gray-500 mt-1">
                  Supports MP4, MOV, AVI formats
                </p>
              </div>
              <input
                id="video-upload"
                type="file"
                accept="video/*"
                onChange={handleFileSelect}
                className="hidden"
              />
              <Button
                variant="outline"
                onClick={() => document.getElementById('video-upload')?.click()}
                className="gap-2"
              >
                <Upload className="h-4 w-4" />
                Select Video
              </Button>
            </div>
          </div>
          
          {selectedFile && (
            <div className="flex items-center gap-3 p-3 bg-green-50 dark:bg-green-900/20 rounded-lg">
              <Play className="h-5 w-5 text-green-600" />
              <div>
                <p className="font-medium text-green-800 dark:text-green-200">
                  {selectedFile.name}
                </p>
                <p className="text-sm text-green-600 dark:text-green-400">
                  {(selectedFile.size / (1024 * 1024)).toFixed(1)} MB
                </p>
              </div>
            </div>
          )}
        </div>

        {/* AutoFlip Configuration */}
        <div className="space-y-6 p-4 bg-gray-50 dark:bg-gray-900/50 rounded-lg">
          <div className="flex items-center gap-2">
            <Settings className="h-5 w-5" />
            <h3 className="font-semibold">AutoFlip Configuration</h3>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
            {/* Target Aspect Ratio */}
            <div className="space-y-2">
              <Label>Target Aspect Ratio</Label>
              <Select value={targetAspectRatio} onValueChange={setTargetAspectRatio}>
                <SelectTrigger>
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="9:16">9:16 (Vertical)</SelectItem>
                  <SelectItem value="16:9">16:9 (Horizontal)</SelectItem>
                  <SelectItem value="1:1">1:1 (Square)</SelectItem>
                  <SelectItem value="4:3">4:3 (Standard)</SelectItem>
                </SelectContent>
              </Select>
            </div>

            {/* Motion Stabilization Threshold */}
            <div className="space-y-3">
              <Label>Motion Stabilization ({(motionStabilizationThreshold[0] * 100).toFixed(0)}%)</Label>
              <Slider
                value={motionStabilizationThreshold}
                onValueChange={setMotionStabilizationThreshold}
                max={1}
                min={0}
                step={0.1}
                className="w-full"
              />
              <p className="text-xs text-gray-500">
                Higher values = more stable camera, lower values = more tracking
              </p>
            </div>

            {/* Saliency Weight */}
            <div className="space-y-3">
              <Label>Saliency Weight ({(saliencyWeight[0] * 100).toFixed(0)}%)</Label>
              <Slider
                value={saliencyWeight}
                onValueChange={setSaliencyWeight}
                max={1}
                min={0}
                step={0.1}
                className="w-full"
              />
            </div>

            {/* Face Weight */}
            <div className="space-y-3">
              <Label>Face Priority ({(faceWeight[0] * 100).toFixed(0)}%)</Label>
              <Slider
                value={faceWeight}
                onValueChange={setFaceWeight}
                max={1}
                min={0}
                step={0.1}
                className="w-full"
              />
            </div>

            {/* Object Weight */}
            <div className="space-y-3">
              <Label>Object Priority ({(objectWeight[0] * 100).toFixed(0)}%)</Label>
              <Slider
                value={objectWeight}
                onValueChange={setObjectWeight}
                max={1}
                min={0}
                step={0.1}
                className="w-full"
              />
            </div>

            {/* Snap to Center Distance */}
            <div className="space-y-3">
              <Label>Snap to Center ({(snapToCenterDistance[0] * 100).toFixed(0)}%)</Label>
              <Slider
                value={snapToCenterDistance}
                onValueChange={setSnapToCenterDistance}
                max={0.5}
                min={0}
                step={0.05}
                className="w-full"
              />
            </div>
          </div>

          {/* Dynamic Zoom Configuration */}
          <div className="space-y-4 p-4 bg-blue-50 dark:bg-blue-900/20 rounded-lg">
            <div className="flex items-center gap-2">
              <ZoomIn className="h-5 w-5" />
              <h4 className="font-semibold">Dynamic Zoom Settings</h4>
            </div>
            
            {/* Enable Dynamic Zoom */}
            <div className="flex items-center gap-3">
              <input
                type="checkbox"
                id="dynamic-zoom"
                checked={enableDynamicZoom}
                onChange={(e) => setEnableDynamicZoom(e.target.checked)}
                className="rounded"
              />
              <Label htmlFor="dynamic-zoom" className="flex items-center gap-2">
                <ZoomIn className="h-4 w-4" />
                Enable Dynamic Zoom Based on Focus
              </Label>
            </div>

            {enableDynamicZoom && (
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                {/* Min Zoom Factor */}
                <div className="space-y-3">
                  <Label>Min Zoom ({minZoomFactor[0].toFixed(1)}x)</Label>
                  <Slider
                    value={minZoomFactor}
                    onValueChange={setMinZoomFactor}
                    max={1.0}
                    min={0.5}
                    step={0.1}
                    className="w-full"
                  />
                  <p className="text-xs text-gray-600 dark:text-gray-400">
                    Minimum zoom out level to include more content
                  </p>
                </div>

                {/* Max Zoom Factor */}
                <div className="space-y-3">
                  <Label>Max Zoom ({maxZoomFactor[0].toFixed(1)}x)</Label>
                  <Slider
                    value={maxZoomFactor}
                    onValueChange={setMaxZoomFactor}
                    max={2.0}
                    min={1.0}
                    step={0.1}
                    className="w-full"
                  />
                  <p className="text-xs text-gray-600 dark:text-gray-400">
                    Maximum zoom in level for close-ups
                  </p>
                </div>

                {/* Focus Priority Mode */}
                <div className="space-y-2">
                  <Label>Focus Priority Mode</Label>
                  <Select value={focusPriorityMode} onValueChange={setFocusPriorityMode}>
                    <SelectTrigger>
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="preserve_all">Preserve All - Ensure all subjects stay visible</SelectItem>
                      <SelectItem value="smart_crop">Smart Crop - Balance visibility and frame filling</SelectItem>
                      <SelectItem value="optimal_framing">Optimal Framing - Best visual composition</SelectItem>
                    </SelectContent>
                  </Select>
                </div>

                {/* Subject Padding */}
                <div className="space-y-3">
                  <Label>Subject Padding ({(subjectPadding[0] * 100).toFixed(0)}%)</Label>
                  <Slider
                    value={subjectPadding}
                    onValueChange={setSubjectPadding}
                    max={0.3}
                    min={0.05}
                    step={0.05}
                    className="w-full"
                  />
                  <p className="text-xs text-gray-600 dark:text-gray-400">
                    Padding around subjects for better framing
                  </p>
                </div>
              </div>
            )}
          </div>

          {/* Visualization Toggle */}
          <div className="flex items-center gap-3">
            <input
              type="checkbox"
              id="visualization"
              checked={enableVisualization}
              onChange={(e) => setEnableVisualization(e.target.checked)}
              className="rounded"
            />
            <Label htmlFor="visualization" className="flex items-center gap-2">
              <Eye className="h-4 w-4" />
              Enable Processing Visualization
            </Label>
          </div>
        </div>

        {/* Process Button */}
        <Button
          onClick={processCompleteAutoFlip}
          disabled={!selectedFile || isProcessing}
          className="w-full h-12 text-base"
          size="lg"
        >
          {isProcessing ? (
            <>
              <div className="animate-spin rounded-full h-5 w-5 border-b-2 border-white mr-2" />
              Processing with Complete AutoFlip...
            </>
          ) : (
            <>
              <Zap className="h-5 w-5 mr-2" />
              Process with Complete AutoFlip
            </>
          )}
        </Button>

        {/* Progress */}
        {isProcessing && (
          <div className="space-y-2">
            <div className="flex justify-between text-sm">
              <span>Processing...</span>
              <span>{progress.toFixed(0)}%</span>
            </div>
            <Progress value={progress} className="w-full" />
            <p className="text-xs text-gray-500 text-center">
              Running multi-modal saliency detection and scene analysis...
            </p>
          </div>
        )}

        {/* Error Display */}
        {error && (
          <div className="p-4 bg-red-50 dark:bg-red-900/20 border border-red-200 dark:border-red-800 rounded-lg">
            <p className="text-red-800 dark:text-red-200 font-medium">Error</p>
            <p className="text-red-600 dark:text-red-400 text-sm mt-1">{error}</p>
          </div>
        )}

        {/* Results */}
        {result && result.success && (
          <div className="space-y-4 p-4 bg-green-50 dark:bg-green-900/20 border border-green-200 dark:border-green-800 rounded-lg">
            <div className="flex items-center justify-between">
              <h3 className="font-semibold text-green-800 dark:text-green-200">
                Complete AutoFlip Processing Complete
              </h3>
              <Badge variant="secondary" className="bg-green-100 text-green-800">
                {result.metadata?.stabilizationMode}
              </Badge>
            </div>

            {/* Processing Statistics */}
            {result.processingDetails && (
              <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
                <div className="text-center p-3 bg-white dark:bg-gray-800 rounded-lg">
                  <p className="text-2xl font-bold text-blue-600">
                    {result.processingDetails.totalFrames}
                  </p>
                  <p className="text-xs text-gray-600">Key Frames</p>
                </div>
                <div className="text-center p-3 bg-white dark:bg-gray-800 rounded-lg">
                  <p className="text-2xl font-bold text-green-600">
                    {result.processingDetails.faceDetections}
                  </p>
                  <p className="text-xs text-gray-600">Face Detections</p>
                </div>
                <div className="text-center p-3 bg-white dark:bg-gray-800 rounded-lg">
                  <p className="text-2xl font-bold text-purple-600">
                    {result.processingDetails.objectDetections}
                  </p>
                  <p className="text-xs text-gray-600">Object Detections</p>
                </div>
                <div className="text-center p-3 bg-white dark:bg-gray-800 rounded-lg">
                  <p className="text-2xl font-bold text-orange-600">
                    {formatConfidence(result.processingDetails.averageConfidence)}
                  </p>
                  <p className="text-xs text-gray-600">Avg Confidence</p>
                </div>
              </div>
            )}

            {/* Algorithm Features */}
            {result.metadata?.features && (
              <div className="space-y-2">
                <h4 className="font-medium text-green-800 dark:text-green-200">
                  Applied Features
                </h4>
                <div className="flex flex-wrap gap-2">
                  {result.metadata.features.map((feature, index) => (
                    <Badge key={index} variant="outline" className="text-xs">
                      {feature}
                    </Badge>
                  ))}
                </div>
              </div>
            )}

            {/* Processing Time and Conversion Info */}
            <div className="flex justify-between items-center text-sm text-green-600 dark:text-green-400">
              <span>
                Processing time: {formatTime(result.processingDetails?.processingTime || 0)}
              </span>
              <span>{result.metadata?.aspectRatioConversion}</span>
            </div>

            {/* Download Button */}
            {result.downloadUrl && (
              <Button
                asChild
                className="w-full bg-green-600 hover:bg-green-700"
              >
                <a href={result.downloadUrl} download={result.filename}>
                  <Download className="h-4 w-4 mr-2" />
                  Download Complete AutoFlip Video
                </a>
              </Button>
            )}
          </div>
        )}
      </CardContent>
    </Card>
  );
}