import { useState } from 'react';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Progress } from '@/components/ui/progress';
import { Badge } from '@/components/ui/badge';
import { useToast } from '@/hooks/use-toast';
import { MdUpload, MdVideoLibrary, MdSmartToy, MdDownload, MdAspectRatio } from 'react-icons/md';

interface ReframingResult {
  success: boolean;
  outputPath: string;
  downloadUrl: string;
  filename: string;
  processingDetails: {
    originalAspectRatio: string;
    targetAspectRatio: string;
    focusAreasDetected: number;
    cropPositions: {
      x: number;
      y: number;
      width: number;
      height: number;
    };
    processingTime: number;
  };
}

export default function IntelligentReframing() {
  const [videoFile, setVideoFile] = useState<File | null>(null);
  const [targetAspectRatio, setTargetAspectRatio] = useState('9:16');
  const [focusMode, setFocusMode] = useState('auto');
  const [isProcessing, setIsProcessing] = useState(false);
  const [progress, setProgress] = useState(0);
  const [currentStep, setCurrentStep] = useState('');
  const [result, setResult] = useState<ReframingResult | null>(null);
  const { toast } = useToast();

  const handleVideoUpload = (event: React.ChangeEvent<HTMLInputElement>) => {
    const file = event.target.files?.[0];
    if (file) {
      setVideoFile(file);
      setResult(null);
      toast({
        title: "Video Selected",
        description: `${file.name} ready for intelligent reframing`,
      });
    }
  };

  const handleReframing = async () => {
    if (!videoFile) {
      toast({
        title: "No Video Selected",
        description: "Please select a video file first",
        variant: "destructive",
      });
      return;
    }

    setIsProcessing(true);
    setProgress(0);
    setResult(null);

    try {
      const formData = new FormData();
      formData.append('video', videoFile);
      formData.append('targetAspectRatio', targetAspectRatio);
      formData.append('focusMode', focusMode);

      // Step 1: Upload and analyze
      setCurrentStep('Uploading and analyzing video...');
      setProgress(20);

      // Enhanced 8-step processing with real-time updates
      const steps = [
        'Audio transcription with timestamps',
        'Gemini script analysis for video cutting', 
        'JavaScript video segmentation',
        'YOLO object detection on all frames',
        'Composite image analysis for motion detection',
        'Gemini focus area identification',
        'Mathematical interpolation for intermediate frames',
        'Final video creation with focus rectangles'
      ];

      let stepIndex = 0;
      const progressInterval = setInterval(() => {
        if (stepIndex < steps.length) {
          setCurrentStep(`Step ${stepIndex + 1}/8: ${steps[stepIndex]}`);
          setProgress((stepIndex + 1) * 12.5);
          stepIndex++;
        }
      }, 2500);

      console.log('=== ENHANCED 8-STEP REFRAMING START ===');
      console.log(`File: ${videoFile.name}, Target: ${targetAspectRatio}, Focus: ${focusMode}`);

      const response = await fetch('/api/enhanced-comprehensive-shorts', {
        method: 'POST',
        body: formData,
      });

      clearInterval(progressInterval);

      if (!response.ok) {
        const errorData = await response.json();
        throw new Error(errorData.details || 'Enhanced reframing failed');
      }

      const data = await response.json();
      console.log('=== ENHANCED REFRAMING COMPLETED ===');
      console.log('Processing details:', data.processingDetails);
      
      setProgress(100);
      setCurrentStep('Complete!');
      setResult(data);

      toast({
        title: "Reframing Complete",
        description: `Video successfully reframed to ${targetAspectRatio}`,
      });

    } catch (error) {
      console.error('Reframing error:', error);
      toast({
        title: "Reframing Failed",
        description: "Failed to process video. Please try again.",
        variant: "destructive",
      });
    } finally {
      setIsProcessing(false);
    }
  };

  const handleDownload = () => {
    if (result?.downloadUrl) {
      const link = document.createElement('a');
      link.href = result.downloadUrl;
      link.download = result.filename;
      document.body.appendChild(link);
      link.click();
      document.body.removeChild(link);
    }
  };

  return (
    <div className="max-w-4xl mx-auto p-6 space-y-6">
      <div className="text-center mb-8">
        <h1 className="text-3xl font-bold text-gray-900 dark:text-white mb-2">
          Intelligent Video Reframing
        </h1>
        <p className="text-gray-600 dark:text-gray-400">
          Convert 16:9 landscape videos to shorts with AI-powered focus preservation
        </p>
      </div>

      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <MdAspectRatio className="w-5 h-5" />
            Video Reframing Setup
          </CardTitle>
        </CardHeader>
        <CardContent className="space-y-6">
          {/* Video Upload */}
          <div className="space-y-2">
            <Label htmlFor="video-upload">Upload Video (16:9 recommended)</Label>
            <div className="flex items-center gap-4">
              <Input
                id="video-upload"
                type="file"
                accept="video/*"
                onChange={handleVideoUpload}
                className="flex-1"
              />
              <MdUpload className="w-5 h-5 text-gray-500" />
            </div>
            {videoFile && (
              <div className="flex items-center gap-2 mt-2">
                <MdVideoLibrary className="w-4 h-4 text-blue-500" />
                <span className="text-sm text-gray-600 dark:text-gray-400">
                  {videoFile.name} ({(videoFile.size / 1024 / 1024).toFixed(1)} MB)
                </span>
              </div>
            )}
          </div>

          {/* Target Aspect Ratio */}
          <div className="space-y-2">
            <Label>Target Aspect Ratio</Label>
            <Select value={targetAspectRatio} onValueChange={setTargetAspectRatio}>
              <SelectTrigger>
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="9:16">9:16 (Vertical/Portrait)</SelectItem>
                <SelectItem value="1:1">1:1 (Square)</SelectItem>
                <SelectItem value="4:5">4:5 (Instagram Portrait)</SelectItem>
                <SelectItem value="16:9">16:9 (Landscape)</SelectItem>
              </SelectContent>
            </Select>
          </div>

          {/* Focus Mode */}
          <div className="space-y-2">
            <Label>Focus Detection Mode</Label>
            <Select value={focusMode} onValueChange={setFocusMode}>
              <SelectTrigger>
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="auto">Auto (AI determines best focus)</SelectItem>
                <SelectItem value="people">People Priority</SelectItem>
                <SelectItem value="center">Center Focus</SelectItem>
                <SelectItem value="motion">Motion Tracking</SelectItem>
              </SelectContent>
            </Select>
          </div>

          {/* Process Button */}
          <Button 
            onClick={handleReframing}
            disabled={!videoFile || isProcessing}
            className="w-full"
            size="lg"
          >
            {isProcessing ? (
              <>
                <MdSmartToy className="w-5 h-5 mr-2 animate-spin" />
                Processing...
              </>
            ) : (
              <>
                <MdSmartToy className="w-5 h-5 mr-2" />
                Start Intelligent Reframing
              </>
            )}
          </Button>
        </CardContent>
      </Card>

      {/* Progress */}
      {isProcessing && (
        <Card>
          <CardContent className="pt-6">
            <div className="space-y-4">
              <div className="flex justify-between items-center">
                <span className="text-sm font-medium">Processing Progress</span>
                <span className="text-sm text-gray-600 dark:text-gray-400">{progress}%</span>
              </div>
              <Progress value={progress} className="w-full" />
              <p className="text-sm text-gray-600 dark:text-gray-400">{currentStep}</p>
            </div>
          </CardContent>
        </Card>
      )}

      {/* Results */}
      {result && (
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <MdVideoLibrary className="w-5 h-5" />
              Reframing Complete
            </CardTitle>
          </CardHeader>
          <CardContent className="space-y-4">
            <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
              <div className="text-center">
                <div className="text-2xl font-bold text-blue-600">{result.processingDetails.originalAspectRatio}</div>
                <div className="text-sm text-gray-600 dark:text-gray-400">Original</div>
              </div>
              <div className="text-center">
                <div className="text-2xl font-bold text-green-600">{result.processingDetails.targetAspectRatio}</div>
                <div className="text-sm text-gray-600 dark:text-gray-400">Converted</div>
              </div>
              <div className="text-center">
                <div className="text-2xl font-bold text-purple-600">{result.processingDetails.focusAreasDetected}</div>
                <div className="text-sm text-gray-600 dark:text-gray-400">Focus Areas</div>
              </div>
              <div className="text-center">
                <div className="text-2xl font-bold text-orange-600">{result.processingDetails.processingTime}s</div>
                <div className="text-sm text-gray-600 dark:text-gray-400">Process Time</div>
              </div>
            </div>

            <div className="bg-gray-50 dark:bg-gray-800 p-4 rounded-lg">
              <h4 className="font-semibold mb-2">Crop Information</h4>
              <div className="grid grid-cols-2 gap-4 text-sm">
                <div>Position: ({result.processingDetails.cropPositions.x}, {result.processingDetails.cropPositions.y})</div>
                <div>Size: {result.processingDetails.cropPositions.width}×{result.processingDetails.cropPositions.height}</div>
              </div>
            </div>

            <Button onClick={handleDownload} className="w-full" size="lg">
              <MdDownload className="w-5 h-5 mr-2" />
              Download Reframed Video
            </Button>
          </CardContent>
        </Card>
      )}
    </div>
  );
}