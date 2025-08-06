import React, { useState } from 'react';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Progress } from '@/components/ui/progress';
import { Badge } from '@/components/ui/badge';
import { Upload, Play, Download, Brain, Target, Zap } from 'lucide-react';
import { useToast } from '@/hooks/use-toast';

interface YoloSvgResult {
  success: boolean;
  message: string;
  analysisDetails: {
    totalFrames: number;
    totalObjects: number;
    aspectRatioRectangles: number;
    smoothingFormula: string;
    videoInfo: {
      width: number;
      height: number;
      duration: number;
      fps: number;
    };
    processingTime: number;
  };
  outputVideo: {
    downloadUrl: string;
    filename: string;
  };
}

export function YoloSvgTester() {
  const [selectedFile, setSelectedFile] = useState<File | null>(null);
  const [aspectRatio, setAspectRatio] = useState('9:16');
  const [frameRate, setFrameRate] = useState('5');
  const [isProcessing, setIsProcessing] = useState(false);
  const [progress, setProgress] = useState(0);
  const [result, setResult] = useState<YoloSvgResult | null>(null);
  const { toast } = useToast();

  const handleFileSelect = (event: React.ChangeEvent<HTMLInputElement>) => {
    const file = event.target.files?.[0];
    if (file && file.type.startsWith('video/')) {
      setSelectedFile(file);
      setResult(null);
    } else {
      toast({
        title: 'Invalid file',
        description: 'Please select a video file',
        variant: 'destructive'
      });
    }
  };

  const processVideo = async () => {
    if (!selectedFile) return;

    setIsProcessing(true);
    setProgress(0);
    setResult(null);

    const formData = new FormData();
    formData.append('video', selectedFile);
    formData.append('targetAspectRatio', aspectRatio);
    formData.append('frameRate', frameRate);

    try {
      // Simulate progress updates
      const progressInterval = setInterval(() => {
        setProgress(prev => Math.min(prev + 5, 90));
      }, 500);

      const response = await fetch('/api/test-yolo-svg-analysis', {
        method: 'POST',
        body: formData
      });

      clearInterval(progressInterval);
      setProgress(100);

      if (!response.ok) {
        throw new Error(`HTTP error! status: ${response.status}`);
      }

      const data = await response.json();
      setResult(data);

      toast({
        title: 'Analysis Complete',
        description: `Processed ${data.analysisDetails.totalFrames} frames with ${data.analysisDetails.totalObjects} objects detected`
      });

    } catch (error) {
      console.error('YOLO + SVG analysis failed:', error);
      toast({
        title: 'Analysis Failed',
        description: error instanceof Error ? error.message : 'Unknown error occurred',
        variant: 'destructive'
      });
    } finally {
      setIsProcessing(false);
      setTimeout(() => setProgress(0), 2000);
    }
  };

  const downloadVideo = () => {
    if (result?.outputVideo.downloadUrl) {
      window.open(result.outputVideo.downloadUrl, '_blank');
    }
  };

  return (
    <div className="space-y-6">
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <Brain className="h-5 w-5 text-blue-500" />
            YOLO + SVG + Gemini Pipeline Tester
          </CardTitle>
          <CardDescription>
            Test the comprehensive object detection and intelligent aspect ratio conversion pipeline
          </CardDescription>
        </CardHeader>
        <CardContent className="space-y-4">
          {/* File Upload */}
          <div className="space-y-2">
            <label className="text-sm font-medium">Video File</label>
            <div className="flex items-center gap-4">
              <Button
                variant="outline"
                onClick={() => document.getElementById('video-upload')?.click()}
                className="flex items-center gap-2"
              >
                <Upload className="h-4 w-4" />
                {selectedFile ? 'Change Video' : 'Upload Video'}
              </Button>
              {selectedFile && (
                <Badge variant="secondary" className="flex items-center gap-2">
                  <Play className="h-3 w-3" />
                  {selectedFile.name}
                </Badge>
              )}
            </div>
            <input
              id="video-upload"
              type="file"
              accept="video/*"
              onChange={handleFileSelect}
              className="hidden"
            />
          </div>

          {/* Configuration */}
          <div className="grid grid-cols-2 gap-4">
            <div className="space-y-2">
              <label className="text-sm font-medium">Target Aspect Ratio</label>
              <Select value={aspectRatio} onValueChange={setAspectRatio}>
                <SelectTrigger>
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="9:16">9:16 (Vertical)</SelectItem>
                  <SelectItem value="16:9">16:9 (Horizontal)</SelectItem>
                  <SelectItem value="1:1">1:1 (Square)</SelectItem>
                </SelectContent>
              </Select>
            </div>

            <div className="space-y-2">
              <label className="text-sm font-medium">Analysis Frame Rate</label>
              <Select value={frameRate} onValueChange={setFrameRate}>
                <SelectTrigger>
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="2">2 FPS (Fast)</SelectItem>
                  <SelectItem value="5">5 FPS (Recommended)</SelectItem>
                  <SelectItem value="10">10 FPS (Detailed)</SelectItem>
                </SelectContent>
              </Select>
            </div>
          </div>

          {/* Process Button */}
          <Button
            onClick={processVideo}
            disabled={!selectedFile || isProcessing}
            className="w-full flex items-center gap-2"
            size="lg"
          >
            {isProcessing ? (
              <>
                <Zap className="h-4 w-4 animate-pulse" />
                Processing...
              </>
            ) : (
              <>
                <Target className="h-4 w-4" />
                Start YOLO + SVG Analysis
              </>
            )}
          </Button>

          {/* Progress */}
          {isProcessing && (
            <div className="space-y-2">
              <div className="flex justify-between text-sm">
                <span>Analyzing video frames...</span>
                <span>{progress}%</span>
              </div>
              <Progress value={progress} className="w-full" />
            </div>
          )}
        </CardContent>
      </Card>

      {/* Results */}
      {result && (
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <Target className="h-5 w-5 text-green-500" />
              Analysis Results
            </CardTitle>
          </CardHeader>
          <CardContent className="space-y-4">
            {/* Summary Stats */}
            <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
              <div className="text-center p-3 bg-blue-50 rounded-lg">
                <div className="text-2xl font-bold text-blue-600">
                  {result.analysisDetails.totalFrames}
                </div>
                <div className="text-sm text-blue-800">Frames Analyzed</div>
              </div>
              <div className="text-center p-3 bg-green-50 rounded-lg">
                <div className="text-2xl font-bold text-green-600">
                  {result.analysisDetails.totalObjects}
                </div>
                <div className="text-sm text-green-800">Objects Detected</div>
              </div>
              <div className="text-center p-3 bg-purple-50 rounded-lg">
                <div className="text-2xl font-bold text-purple-600">
                  {result.analysisDetails.aspectRatioRectangles}
                </div>
                <div className="text-sm text-purple-800">Crop Rectangles</div>
              </div>
              <div className="text-center p-3 bg-orange-50 rounded-lg">
                <div className="text-2xl font-bold text-orange-600">
                  {(result.analysisDetails.processingTime / 1000).toFixed(1)}s
                </div>
                <div className="text-sm text-orange-800">Processing Time</div>
              </div>
            </div>

            {/* Video Info */}
            <div className="space-y-2">
              <h4 className="font-medium">Video Information</h4>
              <div className="grid grid-cols-2 gap-4 text-sm">
                <div>
                  <span className="text-gray-500">Resolution:</span>{' '}
                  {result.analysisDetails.videoInfo.width} × {result.analysisDetails.videoInfo.height}
                </div>
                <div>
                  <span className="text-gray-500">Duration:</span>{' '}
                  {result.analysisDetails.videoInfo.duration.toFixed(1)}s
                </div>
                <div>
                  <span className="text-gray-500">Frame Rate:</span>{' '}
                  {result.analysisDetails.videoInfo.fps.toFixed(1)} FPS
                </div>
                <div>
                  <span className="text-gray-500">Analysis Rate:</span>{' '}
                  {frameRate} FPS
                </div>
              </div>
            </div>

            {/* Smoothing Formula Preview */}
            <div className="space-y-2">
              <h4 className="font-medium">Smoothing Formula (Preview)</h4>
              <div className="bg-gray-50 p-3 rounded-md font-mono text-xs overflow-x-auto">
                {result.analysisDetails.smoothingFormula}
              </div>
            </div>

            {/* Download Button */}
            <Button
              onClick={downloadVideo}
              className="w-full flex items-center gap-2"
              size="lg"
            >
              <Download className="h-4 w-4" />
              Download Processed Video ({result.outputVideo.filename})
            </Button>
          </CardContent>
        </Card>
      )}
    </div>
  );
}