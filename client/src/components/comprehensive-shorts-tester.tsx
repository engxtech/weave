import React, { useState } from 'react';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Progress } from '@/components/ui/progress';
import { Badge } from '@/components/ui/badge';
import { Separator } from '@/components/ui/separator';
import { Upload, Play, Download, Clock, Cpu, Eye, Target, Zap } from 'lucide-react';
import { apiRequest } from '@/lib/queryClient';

interface ComprehensiveResult {
  success: boolean;
  videoUrl?: string;
  downloadUrl?: string;
  filename?: string;
  fileSize?: number;
  metadata?: {
    transcription: {
      segments: Array<{
        text: string;
        start: number;
        end: number;
        confidence: number;
      }>;
      fullText: string;
    };
    script: any;
    yoloFrameCount: number;
    focusFrameCount: number;
    interpolatedFrameCount: number;
    workflow: string;
    steps: string[];
  };
  error?: string;
}

export function ComprehensiveShortsTester() {
  const [file, setFile] = useState<File | null>(null);
  const [isProcessing, setIsProcessing] = useState(false);
  const [progress, setProgress] = useState(0);
  const [currentStep, setCurrentStep] = useState('');
  const [result, setResult] = useState<ComprehensiveResult | null>(null);
  const [options, setOptions] = useState({
    targetDuration: 30,
    targetAspectRatio: '9:16' as '9:16' | '16:9' | '1:1',
    captionStyle: 'viral' as 'viral' | 'educational' | 'professional' | 'entertainment'
  });

  const steps = [
    { icon: Clock, label: 'Audio transcription with timestamps', description: 'Extract and analyze audio content' },
    { icon: Cpu, label: 'Gemini script creation and cutting plan', description: 'AI analysis for optimal content selection' },
    { icon: Zap, label: 'JavaScript video cutting and merging', description: 'Precise video segmentation' },
    { icon: Eye, label: 'YOLO object detection at 3fps', description: 'Identify objects and dead areas' },
    { icon: Target, label: 'Gemini focus area analysis', description: 'AI-powered focus rectangle calculation' },
    { icon: Cpu, label: 'Mathematical interpolation for all frames', description: 'Smooth transitions between keyframes' },
    { icon: Play, label: 'Final video creation with focus rectangles', description: 'Generate optimized shorts' }
  ];

  const handleFileSelect = (event: React.ChangeEvent<HTMLInputElement>) => {
    const selectedFile = event.target.files?.[0];
    if (selectedFile) {
      setFile(selectedFile);
      setResult(null);
    }
  };

  const processComprehensiveShorts = async () => {
    if (!file) return;

    setIsProcessing(true);
    setProgress(0);
    setCurrentStep('Initializing comprehensive 7-step workflow...');

    try {
      const formData = new FormData();
      formData.append('video', file);
      formData.append('targetDuration', options.targetDuration.toString());
      formData.append('targetAspectRatio', options.targetAspectRatio);
      formData.append('captionStyle', options.captionStyle);

      // Simulate progress updates
      const stepProgress = [
        { step: 'Step 1: Audio transcription with timestamps', progress: 14 },
        { step: 'Step 2: Gemini script creation and cutting plan', progress: 28 },
        { step: 'Step 3: JavaScript video cutting and merging', progress: 42 },
        { step: 'Step 4: YOLO object detection at 3fps', progress: 56 },
        { step: 'Step 5: Gemini focus area analysis', progress: 70 },
        { step: 'Step 6: Mathematical interpolation for all frames', progress: 84 },
        { step: 'Step 7: Final video creation with focus rectangles', progress: 100 }
      ];

      // Simulate step progression
      let stepIndex = 0;
      const progressInterval = setInterval(() => {
        if (stepIndex < stepProgress.length) {
          setCurrentStep(stepProgress[stepIndex].step);
          setProgress(stepProgress[stepIndex].progress);
          stepIndex++;
        }
      }, 2000);

      const response = await apiRequest('/api/comprehensive-shorts-creation', {
        method: 'POST',
        body: formData
      });

      clearInterval(progressInterval);
      setProgress(100);
      setCurrentStep('Comprehensive shorts creation complete!');
      setResult(response);

    } catch (error) {
      console.error('Comprehensive shorts creation failed:', error);
      setResult({
        success: false,
        error: error instanceof Error ? error.message : 'Unknown error occurred'
      });
    } finally {
      setIsProcessing(false);
    }
  };

  const formatFileSize = (bytes: number) => {
    if (bytes === 0) return '0 Bytes';
    const k = 1024;
    const sizes = ['Bytes', 'KB', 'MB', 'GB'];
    const i = Math.floor(Math.log(bytes) / Math.log(k));
    return parseFloat((bytes / Math.pow(k, i)).toFixed(2)) + ' ' + sizes[i];
  };

  return (
    <div className="container mx-auto p-6 space-y-6">
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <Zap className="h-6 w-6 text-blue-600" />
            Comprehensive 7-Step Shorts Creation
          </CardTitle>
          <CardDescription>
            Advanced AI-powered video processing with audio transcription, script analysis, 
            YOLO object detection, and mathematical interpolation for optimal focus tracking
          </CardDescription>
        </CardHeader>
        <CardContent className="space-y-6">
          {/* Upload Section */}
          <div className="space-y-4">
            <Label htmlFor="video-upload">Upload Video</Label>
            <div className="flex items-center gap-4">
              <Input
                id="video-upload"
                type="file"
                accept="video/*"
                onChange={handleFileSelect}
                className="flex-1"
              />
              <Button 
                onClick={processComprehensiveShorts}
                disabled={!file || isProcessing}
                className="min-w-[140px]"
              >
                {isProcessing ? (
                  <>
                    <Cpu className="mr-2 h-4 w-4 animate-spin" />
                    Processing...
                  </>
                ) : (
                  <>
                    <Play className="mr-2 h-4 w-4" />
                    Start Process
                  </>
                )}
              </Button>
            </div>
            {file && (
              <div className="text-sm text-gray-600">
                Selected: {file.name} ({formatFileSize(file.size)})
              </div>
            )}
          </div>

          {/* Options */}
          <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
            <div className="space-y-2">
              <Label>Target Duration</Label>
              <Select
                value={options.targetDuration.toString()}
                onValueChange={(value) => setOptions(prev => ({ ...prev, targetDuration: parseInt(value) }))}
              >
                <SelectTrigger>
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="15">15 seconds</SelectItem>
                  <SelectItem value="30">30 seconds</SelectItem>
                  <SelectItem value="60">60 seconds</SelectItem>
                </SelectContent>
              </Select>
            </div>

            <div className="space-y-2">
              <Label>Aspect Ratio</Label>
              <Select
                value={options.targetAspectRatio}
                onValueChange={(value: '9:16' | '16:9' | '1:1') => setOptions(prev => ({ ...prev, targetAspectRatio: value }))}
              >
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
              <Label>Caption Style</Label>
              <Select
                value={options.captionStyle}
                onValueChange={(value: 'viral' | 'educational' | 'professional' | 'entertainment') => setOptions(prev => ({ ...prev, captionStyle: value }))}
              >
                <SelectTrigger>
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="viral">Viral</SelectItem>
                  <SelectItem value="educational">Educational</SelectItem>
                  <SelectItem value="professional">Professional</SelectItem>
                  <SelectItem value="entertainment">Entertainment</SelectItem>
                </SelectContent>
              </Select>
            </div>
          </div>

          {/* Progress Section */}
          {isProcessing && (
            <div className="space-y-4">
              <div className="space-y-2">
                <div className="flex justify-between text-sm">
                  <span>Progress</span>
                  <span>{progress}%</span>
                </div>
                <Progress value={progress} className="w-full" />
              </div>
              <div className="text-sm text-blue-600 font-medium">
                {currentStep}
              </div>
            </div>
          )}

          {/* Workflow Steps */}
          <div className="space-y-4">
            <Label>7-Step Comprehensive Workflow</Label>
            <div className="grid grid-cols-1 gap-3">
              {steps.map((step, index) => {
                const StepIcon = step.icon;
                const isActive = isProcessing && progress >= ((index + 1) / steps.length) * 100;
                const isCompleted = progress > ((index + 1) / steps.length) * 100;
                
                return (
                  <div
                    key={index}
                    className={`flex items-center gap-3 p-3 rounded-lg border transition-colors ${
                      isCompleted 
                        ? 'bg-green-50 border-green-200' 
                        : isActive 
                        ? 'bg-blue-50 border-blue-200' 
                        : 'bg-gray-50 border-gray-200'
                    }`}
                  >
                    <div className={`p-2 rounded-full ${
                      isCompleted 
                        ? 'bg-green-100 text-green-600' 
                        : isActive 
                        ? 'bg-blue-100 text-blue-600' 
                        : 'bg-gray-100 text-gray-400'
                    }`}>
                      <StepIcon className="h-4 w-4" />
                    </div>
                    <div className="flex-1">
                      <div className="font-medium text-sm">{step.label}</div>
                      <div className="text-xs text-gray-600">{step.description}</div>
                    </div>
                    <Badge variant={isCompleted ? 'default' : isActive ? 'secondary' : 'outline'}>
                      Step {index + 1}
                    </Badge>
                  </div>
                );
              })}
            </div>
          </div>

          {/* Results Section */}
          {result && (
            <div className="space-y-4">
              <Separator />
              <Label>Processing Results</Label>
              
              {result.success ? (
                <div className="space-y-4">
                  <div className="flex items-center justify-between p-4 bg-green-50 border border-green-200 rounded-lg">
                    <div className="flex items-center gap-2">
                      <div className="p-2 bg-green-100 rounded-full">
                        <Play className="h-4 w-4 text-green-600" />
                      </div>
                      <div>
                        <div className="font-medium text-green-800">Comprehensive Shorts Created Successfully!</div>
                        <div className="text-sm text-green-600">
                          {result.filename} ({result.fileSize ? formatFileSize(result.fileSize) : 'Unknown size'})
                        </div>
                      </div>
                    </div>
                    <Button asChild>
                      <a href={result.downloadUrl} download>
                        <Download className="mr-2 h-4 w-4" />
                        Download
                      </a>
                    </Button>
                  </div>

                  {/* Video Preview */}
                  {result.videoUrl && (
                    <div className="space-y-2">
                      <Label>Generated Short Video</Label>
                      <video
                        src={result.videoUrl}
                        controls
                        className="w-full max-w-md mx-auto rounded-lg"
                        poster="data:image/svg+xml,%3Csvg xmlns='http://www.w3.org/2000/svg' width='400' height='300'%3E%3Crect width='100%25' height='100%25' fill='%23f3f4f6'/%3E%3Ctext x='50%25' y='50%25' font-family='Arial' font-size='16' fill='%236b7280' text-anchor='middle' dy='.3em'%3EGenerated Short%3C/text%3E%3C/svg%3E"
                      />
                    </div>
                  )}

                  {/* Processing Metadata */}
                  {result.metadata && (
                    <div className="space-y-4">
                      <Label>Processing Metadata</Label>
                      <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
                        <div className="p-3 bg-blue-50 rounded-lg text-center">
                          <div className="text-2xl font-bold text-blue-600">
                            {result.metadata.transcription?.segments?.length || 0}
                          </div>
                          <div className="text-sm text-blue-800">Transcription Segments</div>
                        </div>
                        <div className="p-3 bg-purple-50 rounded-lg text-center">
                          <div className="text-2xl font-bold text-purple-600">
                            {result.metadata.yoloFrameCount}
                          </div>
                          <div className="text-sm text-purple-800">YOLO Frames Analyzed</div>
                        </div>
                        <div className="p-3 bg-green-50 rounded-lg text-center">
                          <div className="text-2xl font-bold text-green-600">
                            {result.metadata.focusFrameCount}
                          </div>
                          <div className="text-sm text-green-800">Focus Frames Processed</div>
                        </div>
                        <div className="p-3 bg-orange-50 rounded-lg text-center">
                          <div className="text-2xl font-bold text-orange-600">
                            {result.metadata.interpolatedFrameCount}
                          </div>
                          <div className="text-sm text-orange-800">Interpolated Frames</div>
                        </div>
                      </div>

                      {/* Workflow Steps Completed */}
                      <div className="space-y-2">
                        <Label>Completed Workflow Steps</Label>
                        <div className="space-y-1">
                          {result.metadata.steps?.map((step, index) => (
                            <div key={index} className="flex items-center gap-2 text-sm">
                              <div className="w-2 h-2 bg-green-500 rounded-full" />
                              {step}
                            </div>
                          ))}
                        </div>
                      </div>
                    </div>
                  )}
                </div>
              ) : (
                <div className="p-4 bg-red-50 border border-red-200 rounded-lg">
                  <div className="flex items-center gap-2 text-red-800">
                    <div className="p-2 bg-red-100 rounded-full">
                      <Upload className="h-4 w-4 text-red-600" />
                    </div>
                    <div>
                      <div className="font-medium">Processing Failed</div>
                      <div className="text-sm">{result.error}</div>
                    </div>
                  </div>
                </div>
              )}
            </div>
          )}
        </CardContent>
      </Card>
    </div>
  );
}