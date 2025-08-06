import { useState } from 'react';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Progress } from '@/components/ui/progress';
import { Badge } from '@/components/ui/badge';
import { Upload, Brain, Scissors, Download, Play, Eye } from 'lucide-react';
import { useToast } from '@/hooks/use-toast';

interface VideoSegment {
  startTime: number;
  endTime: number;
  duration: number;
  actionCenterX: number;
  confidence: number;
  description: string;
}

interface CropResult {
  success: boolean;
  outputPath: string;
  downloadUrl: string;
  segments: VideoSegment[];
  processingTime: number;
  analysisMethod: string;
  stats: {
    totalSegments: number;
    averageConfidence: number;
    totalDuration: number;
  };
}

export default function IntelligentCropper() {
  const [file, setFile] = useState<File | null>(null);
  const [isProcessing, setIsProcessing] = useState(false);
  const [progress, setProgress] = useState(0);
  const [result, setResult] = useState<CropResult | null>(null);
  const [targetAspectRatio, setTargetAspectRatio] = useState<'9:16' | '16:9' | '1:1'>('9:16');
  const [analysisMethod, setAnalysisMethod] = useState<'composite' | 'gemini' | 'hybrid'>('hybrid');
  const [segmentDuration, setSegmentDuration] = useState('10');
  const [currentStep, setCurrentStep] = useState('');
  
  const { toast } = useToast();

  const handleFileSelect = (event: React.ChangeEvent<HTMLInputElement>) => {
    const selectedFile = event.target.files?.[0];
    if (selectedFile && selectedFile.type.includes('video')) {
      setFile(selectedFile);
      setResult(null);
    } else {
      toast({
        title: "Invalid file",
        description: "Please select a video file",
        variant: "destructive"
      });
    }
  };

  const processVideo = async () => {
    if (!file) return;

    setIsProcessing(true);
    setProgress(0);
    setCurrentStep('Uploading video...');

    try {
      const formData = new FormData();
      formData.append('video', file);
      formData.append('targetAspectRatio', targetAspectRatio);
      formData.append('analysisMethod', analysisMethod);
      formData.append('segmentDuration', segmentDuration);

      // Simulate progress updates
      const progressInterval = setInterval(() => {
        setProgress(prev => {
          if (prev < 90) return prev + 10;
          return prev;
        });
      }, 1000);

      // Update steps
      setTimeout(() => setCurrentStep('Segmenting video into scenes...'), 1000);
      setTimeout(() => setCurrentStep('Creating composite frames...'), 3000);
      setTimeout(() => setCurrentStep('Analyzing action centers with AI...'), 5000);
      setTimeout(() => setCurrentStep('Cropping segments with precision...'), 7000);
      setTimeout(() => setCurrentStep('Stitching final video...'), 9000);

      const response = await fetch('/api/intelligent-crop', {
        method: 'POST',
        body: formData,
      });

      clearInterval(progressInterval);
      setProgress(100);
      setCurrentStep('Processing complete!');

      if (!response.ok) {
        const error = await response.json();
        throw new Error(error.details || 'Processing failed');
      }

      const cropResult: CropResult = await response.json();
      setResult(cropResult);

      toast({
        title: "Success!",
        description: `Video intelligently cropped using ${cropResult.analysisMethod} analysis`,
      });

    } catch (error) {
      console.error('Processing error:', error);
      toast({
        title: "Processing failed",
        description: error instanceof Error ? error.message : "Unknown error occurred",
        variant: "destructive"
      });
    } finally {
      setIsProcessing(false);
      setProgress(0);
      setCurrentStep('');
    }
  };

  const downloadVideo = () => {
    if (result?.downloadUrl) {
      const link = document.createElement('a');
      link.href = result.downloadUrl;
      link.download = result.outputPath;
      document.body.appendChild(link);
      link.click();
      document.body.removeChild(link);
    }
  };

  const getConfidenceColor = (confidence: number) => {
    if (confidence >= 0.8) return 'bg-green-500';
    if (confidence >= 0.6) return 'bg-yellow-500';
    return 'bg-red-500';
  };

  const getMethodDescription = (method: string) => {
    switch (method) {
      case 'composite':
        return 'Zero-AI composite frame analysis with computer vision blob detection';
      case 'gemini':
        return 'AI-powered frame analysis using Gemini Vision API';
      case 'hybrid':
        return 'Composite analysis with Gemini fallback for maximum accuracy';
      default:
        return method;
    }
  };

  return (
    <div className="max-w-4xl mx-auto p-6 space-y-6">
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <Brain className="h-6 w-6 text-blue-600" />
            Intelligent Video Cropper
          </CardTitle>
          <CardDescription>
            Advanced video cropping using composite frame analysis and AI to automatically detect and follow the center of action
          </CardDescription>
        </CardHeader>
        <CardContent className="space-y-6">
          {/* File Upload */}
          <div className="space-y-2">
            <Label htmlFor="video-upload">Select Video</Label>
            <div className="border-2 border-dashed border-gray-300 rounded-lg p-6 text-center">
              {file ? (
                <div className="space-y-2">
                  <Play className="h-8 w-8 mx-auto text-green-600" />
                  <p className="text-sm font-medium">{file.name}</p>
                  <p className="text-xs text-gray-500">
                    {(file.size / (1024 * 1024)).toFixed(1)} MB
                  </p>
                </div>
              ) : (
                <div className="space-y-2">
                  <Upload className="h-8 w-8 mx-auto text-gray-400" />
                  <p className="text-sm text-gray-500">Click to upload video</p>
                </div>
              )}
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
                className="mt-2"
              >
                Choose Video
              </Button>
            </div>
          </div>

          {/* Settings */}
          <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
            <div className="space-y-2">
              <Label htmlFor="aspect-ratio">Target Aspect Ratio</Label>
              <Select value={targetAspectRatio} onValueChange={(value: any) => setTargetAspectRatio(value)}>
                <SelectTrigger>
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="9:16">9:16 (Vertical/TikTok)</SelectItem>
                  <SelectItem value="16:9">16:9 (Horizontal/YouTube)</SelectItem>
                  <SelectItem value="1:1">1:1 (Square/Instagram)</SelectItem>
                </SelectContent>
              </Select>
            </div>

            <div className="space-y-2">
              <Label htmlFor="analysis-method">Analysis Method</Label>
              <Select value={analysisMethod} onValueChange={(value: any) => setAnalysisMethod(value)}>
                <SelectTrigger>
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="hybrid">Hybrid (Recommended)</SelectItem>
                  <SelectItem value="composite">Composite Frame Only</SelectItem>
                  <SelectItem value="gemini">AI Analysis Only</SelectItem>
                </SelectContent>
              </Select>
            </div>

            <div className="space-y-2">
              <Label htmlFor="segment-duration">Segment Duration (seconds)</Label>
              <Input
                id="segment-duration"
                type="number"
                value={segmentDuration}
                onChange={(e) => setSegmentDuration(e.target.value)}
                min="5"
                max="30"
              />
            </div>
          </div>

          {/* Method Description */}
          <div className="p-4 bg-blue-50 rounded-lg">
            <h4 className="font-medium text-blue-900 mb-2">Analysis Method: {analysisMethod}</h4>
            <p className="text-sm text-blue-700">{getMethodDescription(analysisMethod)}</p>
          </div>

          {/* Process Button */}
          <Button
            onClick={processVideo}
            disabled={!file || isProcessing}
            className="w-full"
            size="lg"
          >
            {isProcessing ? (
              <>
                <Scissors className="h-4 w-4 mr-2 animate-spin" />
                Processing...
              </>
            ) : (
              <>
                <Brain className="h-4 w-4 mr-2" />
                Start Intelligent Cropping
              </>
            )}
          </Button>

          {/* Progress */}
          {isProcessing && (
            <div className="space-y-2">
              <div className="flex justify-between text-sm">
                <span>{currentStep}</span>
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
              <Eye className="h-6 w-6 text-green-600" />
              Processing Results
            </CardTitle>
          </CardHeader>
          <CardContent className="space-y-6">
            {/* Stats */}
            <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
              <div className="text-center p-4 bg-gray-50 rounded-lg">
                <p className="text-2xl font-bold text-blue-600">{result.stats.totalSegments}</p>
                <p className="text-sm text-gray-600">Segments</p>
              </div>
              <div className="text-center p-4 bg-gray-50 rounded-lg">
                <p className="text-2xl font-bold text-green-600">
                  {(result.stats.averageConfidence * 100).toFixed(0)}%
                </p>
                <p className="text-sm text-gray-600">Avg Confidence</p>
              </div>
              <div className="text-center p-4 bg-gray-50 rounded-lg">
                <p className="text-2xl font-bold text-purple-600">
                  {result.stats.totalDuration.toFixed(1)}s
                </p>
                <p className="text-sm text-gray-600">Duration</p>
              </div>
              <div className="text-center p-4 bg-gray-50 rounded-lg">
                <p className="text-2xl font-bold text-orange-600">
                  {(result.processingTime / 1000).toFixed(1)}s
                </p>
                <p className="text-sm text-gray-600">Process Time</p>
              </div>
            </div>

            {/* Download */}
            <div className="flex gap-4">
              <Button onClick={downloadVideo} className="flex-1">
                <Download className="h-4 w-4 mr-2" />
                Download Cropped Video
              </Button>
              <Button variant="outline" onClick={() => window.open(result.downloadUrl, '_blank')}>
                <Play className="h-4 w-4 mr-2" />
                Preview
              </Button>
            </div>

            {/* Segment Analysis */}
            <div className="space-y-4">
              <h4 className="font-medium">Segment Analysis</h4>
              <div className="space-y-2 max-h-60 overflow-y-auto">
                {result.segments.map((segment, index) => (
                  <div key={index} className="flex items-center justify-between p-3 bg-gray-50 rounded">
                    <div className="flex-1">
                      <div className="flex items-center gap-2">
                        <span className="font-medium">Segment {index + 1}</span>
                        <Badge variant="secondary">
                          {segment.startTime.toFixed(1)}s - {segment.endTime.toFixed(1)}s
                        </Badge>
                      </div>
                      <p className="text-sm text-gray-600 mt-1">{segment.description}</p>
                    </div>
                    <div className="flex items-center gap-2">
                      <div className="text-right">
                        <p className="text-sm font-medium">
                          Center: {(segment.actionCenterX * 100).toFixed(0)}%
                        </p>
                        <div className="flex items-center gap-1">
                          <div className={`w-2 h-2 rounded-full ${getConfidenceColor(segment.confidence)}`} />
                          <span className="text-xs text-gray-500">
                            {(segment.confidence * 100).toFixed(0)}%
                          </span>
                        </div>
                      </div>
                    </div>
                  </div>
                ))}
              </div>
            </div>

            {/* Method Used */}
            <div className="p-4 bg-green-50 rounded-lg">
              <h4 className="font-medium text-green-900 mb-2">
                Analysis Method Used: {result.analysisMethod}
              </h4>
              <p className="text-sm text-green-700">
                {getMethodDescription(result.analysisMethod)}
              </p>
            </div>
          </CardContent>
        </Card>
      )}
    </div>
  );
}