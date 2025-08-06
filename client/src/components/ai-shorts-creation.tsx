import React, { useState, useEffect } from 'react';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Progress } from '@/components/ui/progress';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { ScrollArea } from '@/components/ui/scroll-area';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Label } from '@/components/ui/label';
import { Separator } from '@/components/ui/separator';
import { Play, Download, Sparkles, Clock, Target, Camera, Zap, BarChart3, FileVideo, Code, Activity } from 'lucide-react';
import { useMutation } from '@tanstack/react-query';
import { useToast } from '@/hooks/use-toast';

interface ShortsGenerationOptions {
  userInput: string;
  contentType: 'viral' | 'educational' | 'entertainment' | 'news' | 'highlights';
  aspectRatio: '9:16' | '16:9' | '1:1' | '4:3';
  duration: 15 | 30 | 60 | 90;
  focusMode: 'person' | 'auto' | 'object' | 'center' | 'movement';
  sampleRate: 15 | 30 | 60;
  quality: 'standard' | 'high' | 'ultra';
}

interface VideoSegment {
  startTime: number;
  endTime: number;
  duration: number;
  description: string;
  transcription: string;
  explanation: string;
  focusCoordinates: {
    x: number;
    y: number;
    width: number;
    height: number;
    confidence: number;
    reason: string;
  };
  importance: number;
  engagement: 'high' | 'medium' | 'low';
  visualElements: string[];
  audioLevel: number;
}

interface ShortsScript {
  title: string;
  description: string;
  hashtags: string[];
  totalDuration: number;
  segments: VideoSegment[];
  transitions: Array<{
    type: 'cut' | 'fade' | 'slide' | 'zoom';
    duration: number;
    fromSegment: number;
    toSegment: number;
  }>;
  metadata: {
    analysisTime: number;
    confidence: number;
    keyMoments: string[];
    emotionalTone: string;
    targetAudience: string;
  };
}

interface ShortsGenerationResult {
  script: ShortsScript;
  outputPath: string;
  processingTime: number;
  logs: string[];
  analysisData: {
    originalDuration: number;
    extractedSegments: number;
    totalCuts: number;
    compressionRatio: number;
    focusAccuracy: number;
  };
}

interface AIShortsCreationProps {
  videoPath: string | null;
  onShortsGenerated?: (result: ShortsGenerationResult) => void;
}

const SegmentCard: React.FC<{ segment: VideoSegment; index: number }> = ({ segment, index }) => {
  const getEngagementColor = (engagement: string) => {
    switch (engagement) {
      case 'high': return 'bg-green-100 text-green-800 border-green-200';
      case 'medium': return 'bg-yellow-100 text-yellow-800 border-yellow-200';
      case 'low': return 'bg-gray-100 text-gray-800 border-gray-200';
      default: return 'bg-gray-100 text-gray-800 border-gray-200';
    }
  };

  return (
    <Card className="mb-4">
      <CardHeader className="pb-3">
        <div className="flex items-center justify-between">
          <CardTitle className="text-lg flex items-center">
            <span className="bg-blue-100 text-blue-800 rounded-full w-6 h-6 flex items-center justify-center text-sm font-bold mr-2">
              {index + 1}
            </span>
            Segment {index + 1}
          </CardTitle>
          <Badge className={getEngagementColor(segment.engagement)}>
            {segment.engagement} engagement
          </Badge>
        </div>
      </CardHeader>
      <CardContent className="space-y-3">
        <div className="grid grid-cols-1 md:grid-cols-3 gap-3 text-sm">
          <div>
            <Label className="text-xs text-muted-foreground">Timing</Label>
            <div className="font-mono">
              {segment.startTime.toFixed(1)}s - {segment.endTime.toFixed(1)}s
            </div>
            <div className="text-xs text-muted-foreground">
              Duration: {segment.duration.toFixed(1)}s
            </div>
          </div>
          <div>
            <Label className="text-xs text-muted-foreground">Importance</Label>
            <div className="flex items-center">
              <div className="w-16 bg-gray-200 rounded-full h-2 mr-2">
                <div 
                  className="bg-blue-600 h-2 rounded-full" 
                  style={{ width: `${segment.importance * 100}%` }}
                />
              </div>
              <span className="text-sm">{(segment.importance * 100).toFixed(0)}%</span>
            </div>
          </div>
          <div>
            <Label className="text-xs text-muted-foreground">Audio Level</Label>
            <div className="flex items-center">
              <div className="w-16 bg-gray-200 rounded-full h-2 mr-2">
                <div 
                  className="bg-green-600 h-2 rounded-full" 
                  style={{ width: `${segment.audioLevel * 100}%` }}
                />
              </div>
              <span className="text-sm">{(segment.audioLevel * 100).toFixed(0)}%</span>
            </div>
          </div>
        </div>
        
        <Separator />
        
        <div>
          <Label className="text-sm font-medium">Description</Label>
          <p className="text-sm text-muted-foreground mt-1">{segment.description}</p>
        </div>
        
        {segment.transcription && (
          <div>
            <Label className="text-sm font-medium">Transcription</Label>
            <p className="text-sm text-muted-foreground mt-1 italic">"{segment.transcription}"</p>
          </div>
        )}
        
        <div>
          <Label className="text-sm font-medium">AI Explanation</Label>
          <p className="text-sm text-muted-foreground mt-1">{segment.explanation}</p>
        </div>
        
        <div className="bg-blue-50 p-3 rounded-lg">
          <Label className="text-sm font-medium flex items-center mb-2">
            <Camera className="w-4 h-4 mr-1" />
            Focus Coordinates
          </Label>
          <div className="grid grid-cols-2 gap-2 text-xs">
            <div>
              <span className="font-medium">Position:</span> x:{(segment.focusCoordinates.x * 100).toFixed(1)}%, y:{(segment.focusCoordinates.y * 100).toFixed(1)}%
            </div>
            <div>
              <span className="font-medium">Size:</span> {(segment.focusCoordinates.width * 100).toFixed(1)}% × {(segment.focusCoordinates.height * 100).toFixed(1)}%
            </div>
            <div>
              <span className="font-medium">Confidence:</span> {(segment.focusCoordinates.confidence * 100).toFixed(0)}%
            </div>
            <div>
              <span className="font-medium">Reason:</span> {segment.focusCoordinates.reason}
            </div>
          </div>
        </div>
        
        {segment.visualElements.length > 0 && (
          <div>
            <Label className="text-sm font-medium">Visual Elements</Label>
            <div className="flex flex-wrap gap-1 mt-1">
              {segment.visualElements.map((element, idx) => (
                <Badge key={idx} variant="outline" className="text-xs">
                  {element}
                </Badge>
              ))}
            </div>
          </div>
        )}
      </CardContent>
    </Card>
  );
};

export const AIShortsCreation: React.FC<AIShortsCreationProps> = ({
  videoPath,
  onShortsGenerated
}) => {
  const [options, setOptions] = useState<ShortsGenerationOptions>({
    userInput: '',
    contentType: 'viral',
    aspectRatio: '9:16',
    duration: 60,
    focusMode: 'person',
    sampleRate: 30,
    quality: 'high'
  });
  
  const [result, setResult] = useState<ShortsGenerationResult | null>(null);
  const [progress, setProgress] = useState(0);
  const [status, setStatus] = useState('');
  const [showRawData, setShowRawData] = useState(false);
  
  const { toast } = useToast();

  const generateMutation = useMutation({
    mutationFn: async () => {
      if (!videoPath) throw new Error('No video selected');
      
      const response = await fetch('/api/generate-ai-shorts', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          videoPath,
          options
        })
      });
      
      if (!response.ok) throw new Error('Shorts generation failed');
      return response.json();
    },
    onSuccess: (data: ShortsGenerationResult) => {
      setResult(data);
      setProgress(0);
      setStatus('');
      onShortsGenerated?.(data);
      toast({
        title: "AI Shorts generated successfully!",
        description: `Created ${data.script.segments.length} segments in ${(data.processingTime / 1000).toFixed(1)}s`
      });
    },
    onError: (error) => {
      setProgress(0);
      setStatus('');
      toast({
        title: "Generation failed",
        description: error.message,
        variant: "destructive"
      });
    }
  });

  // Simulate progress updates (in a real implementation, you'd use WebSocket or Server-Sent Events)
  useEffect(() => {
    if (generateMutation.isPending) {
      const interval = setInterval(() => {
        setProgress(prev => {
          if (prev >= 95) return prev;
          const increment = Math.random() * 5 + 2;
          return Math.min(95, prev + increment);
        });
      }, 500);
      
      return () => clearInterval(interval);
    }
  }, [generateMutation.isPending]);

  const handleGenerate = () => {
    setProgress(5);
    setStatus('Initializing AI shorts generation...');
    generateMutation.mutate();
  };

  const handleDownload = () => {
    if (result?.outputPath) {
      const a = document.createElement('a');
      a.href = result.outputPath;
      a.download = `ai-shorts-${Date.now()}.mp4`;
      document.body.appendChild(a);
      a.click();
      document.body.removeChild(a);
    }
  };

  return (
    <div className="space-y-6">
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center">
            <Sparkles className="mr-2 h-5 w-5 text-purple-600" />
            AI Shorts Generation
          </CardTitle>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
            <div>
              <Label>Content Type</Label>
              <Select
                value={options.contentType}
                onValueChange={(value: any) => setOptions(prev => ({ ...prev, contentType: value }))}
              >
                <SelectTrigger>
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="viral">Viral Moments</SelectItem>
                  <SelectItem value="educational">Educational</SelectItem>
                  <SelectItem value="entertainment">Entertainment</SelectItem>
                  <SelectItem value="news">News Highlights</SelectItem>
                  <SelectItem value="highlights">Best Highlights</SelectItem>
                </SelectContent>
              </Select>
            </div>

            <div>
              <Label>Aspect Ratio</Label>
              <Select
                value={options.aspectRatio}
                onValueChange={(value: any) => setOptions(prev => ({ ...prev, aspectRatio: value }))}
              >
                <SelectTrigger>
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="9:16">9:16 (TikTok/Instagram)</SelectItem>
                  <SelectItem value="16:9">16:9 (YouTube)</SelectItem>
                  <SelectItem value="1:1">1:1 (Square)</SelectItem>
                  <SelectItem value="4:3">4:3 (Classic)</SelectItem>
                </SelectContent>
              </Select>
            </div>

            <div>
              <Label>Duration</Label>
              <Select
                value={options.duration.toString()}
                onValueChange={(value) => setOptions(prev => ({ ...prev, duration: parseInt(value) as any }))}
              >
                <SelectTrigger>
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="15">15 seconds</SelectItem>
                  <SelectItem value="30">30 seconds</SelectItem>
                  <SelectItem value="60">60 seconds</SelectItem>
                  <SelectItem value="90">90 seconds</SelectItem>
                </SelectContent>
              </Select>
            </div>

            <div>
              <Label>Focus Mode</Label>
              <Select
                value={options.focusMode}
                onValueChange={(value: any) => setOptions(prev => ({ ...prev, focusMode: value }))}
              >
                <SelectTrigger>
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="person">👥 Person Focus</SelectItem>
                  <SelectItem value="auto">🤖 Auto Detection</SelectItem>
                  <SelectItem value="object">🎯 Object Focus</SelectItem>
                  <SelectItem value="center">📐 Center Crop</SelectItem>
                  <SelectItem value="movement">🏃 Movement Focus</SelectItem>
                </SelectContent>
              </Select>
            </div>

            <div>
              <Label>Quality</Label>
              <Select
                value={options.quality}
                onValueChange={(value: any) => setOptions(prev => ({ ...prev, quality: value }))}
              >
                <SelectTrigger>
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="standard">Standard Quality</SelectItem>
                  <SelectItem value="high">High Quality</SelectItem>
                  <SelectItem value="ultra">Ultra Quality</SelectItem>
                </SelectContent>
              </Select>
            </div>

            <div>
              <Label>Sample Rate</Label>
              <Select
                value={options.sampleRate.toString()}
                onValueChange={(value) => setOptions(prev => ({ ...prev, sampleRate: parseInt(value) as any }))}
              >
                <SelectTrigger>
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="15">15 FPS Analysis</SelectItem>
                  <SelectItem value="30">30 FPS Analysis</SelectItem>
                  <SelectItem value="60">60 FPS Analysis</SelectItem>
                </SelectContent>
              </Select>
            </div>
          </div>

          <div className="flex justify-center pt-4">
            <Button
              onClick={handleGenerate}
              disabled={!videoPath || generateMutation.isPending}
              size="lg"
              className="bg-purple-600 hover:bg-purple-700 text-white px-8"
            >
              {generateMutation.isPending ? (
                <>
                  <Activity className="w-4 h-4 mr-2 animate-spin" />
                  Generating AI Shorts...
                </>
              ) : (
                <>
                  <Zap className="w-4 h-4 mr-2" />
                  Generate AI Shorts
                </>
              )}
            </Button>
          </div>

          {generateMutation.isPending && (
            <div className="space-y-2">
              <div className="flex justify-between text-sm">
                <span>{status}</span>
                <span>{progress.toFixed(0)}%</span>
              </div>
              <Progress value={progress} className="h-2" />
            </div>
          )}
        </CardContent>
      </Card>

      {result && (
        <Tabs defaultValue="preview" className="space-y-4">
          <TabsList className="grid w-full grid-cols-4">
            <TabsTrigger value="preview">Preview</TabsTrigger>
            <TabsTrigger value="script">Script</TabsTrigger>
            <TabsTrigger value="analytics">Analytics</TabsTrigger>
            <TabsTrigger value="logs">Logs & Data</TabsTrigger>
          </TabsList>

          <TabsContent value="preview" className="space-y-4">
            <Card>
              <CardHeader>
                <div className="flex items-center justify-between">
                  <CardTitle className="flex items-center">
                    <FileVideo className="mr-2 h-5 w-5" />
                    {result.script.title}
                  </CardTitle>
                  <div className="flex items-center space-x-2">
                    <Button variant="outline" size="sm">
                      <Play className="w-4 h-4 mr-2" />
                      Preview
                    </Button>
                    <Button onClick={handleDownload} size="sm">
                      <Download className="w-4 h-4 mr-2" />
                      Download
                    </Button>
                  </div>
                </div>
              </CardHeader>
              <CardContent>
                <div className="space-y-4">
                  <div>
                    <Label className="text-sm font-medium">Description</Label>
                    <p className="text-sm text-muted-foreground mt-1">{result.script.description}</p>
                  </div>
                  
                  <div>
                    <Label className="text-sm font-medium">Hashtags</Label>
                    <div className="flex flex-wrap gap-1 mt-1">
                      {result.script.hashtags.map((tag, index) => (
                        <Badge key={index} variant="secondary" className="text-xs">
                          {tag}
                        </Badge>
                      ))}
                    </div>
                  </div>
                  
                  <div className="flex items-center space-x-4 text-sm">
                    <div className="flex items-center">
                      <Clock className="w-4 h-4 mr-1" />
                      {result.script.totalDuration}s
                    </div>
                    <div className="flex items-center">
                      <Target className="w-4 h-4 mr-1" />
                      {result.script.segments.length} segments
                    </div>
                    <div className="flex items-center">
                      <BarChart3 className="w-4 h-4 mr-1" />
                      {(result.script.metadata.confidence * 100).toFixed(0)}% confidence
                    </div>
                  </div>
                </div>
              </CardContent>
            </Card>
          </TabsContent>

          <TabsContent value="script" className="space-y-4">
            <ScrollArea className="h-96">
              {result.script.segments.map((segment, index) => (
                <SegmentCard key={index} segment={segment} index={index} />
              ))}
            </ScrollArea>
          </TabsContent>

          <TabsContent value="analytics" className="space-y-4">
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
              <Card>
                <CardContent className="p-6">
                  <div className="text-center">
                    <div className="text-2xl font-bold text-blue-600">
                      {result.analysisData.extractedSegments}
                    </div>
                    <div className="text-sm text-muted-foreground">Segments</div>
                  </div>
                </CardContent>
              </Card>
              
              <Card>
                <CardContent className="p-6">
                  <div className="text-center">
                    <div className="text-2xl font-bold text-green-600">
                      {(result.analysisData.compressionRatio * 100).toFixed(1)}%
                    </div>
                    <div className="text-sm text-muted-foreground">Compression</div>
                  </div>
                </CardContent>
              </Card>
              
              <Card>
                <CardContent className="p-6">
                  <div className="text-center">
                    <div className="text-2xl font-bold text-purple-600">
                      {(result.analysisData.focusAccuracy * 100).toFixed(1)}%
                    </div>
                    <div className="text-sm text-muted-foreground">Focus Accuracy</div>
                  </div>
                </CardContent>
              </Card>
              
              <Card>
                <CardContent className="p-6">
                  <div className="text-center">
                    <div className="text-2xl font-bold text-orange-600">
                      {result.analysisData.originalDuration.toFixed(1)}s
                    </div>
                    <div className="text-sm text-muted-foreground">Original Duration</div>
                  </div>
                </CardContent>
              </Card>
              
              <Card>
                <CardContent className="p-6">
                  <div className="text-center">
                    <div className="text-2xl font-bold text-red-600">
                      {result.analysisData.totalCuts}
                    </div>
                    <div className="text-sm text-muted-foreground">Total Cuts</div>
                  </div>
                </CardContent>
              </Card>
              
              <Card>
                <CardContent className="p-6">
                  <div className="text-center">
                    <div className="text-2xl font-bold text-indigo-600">
                      {(result.processingTime / 1000).toFixed(1)}s
                    </div>
                    <div className="text-sm text-muted-foreground">Processing Time</div>
                  </div>
                </CardContent>
              </Card>
            </div>
          </TabsContent>

          <TabsContent value="logs" className="space-y-4">
            <Card>
              <CardHeader>
                <div className="flex items-center justify-between">
                  <CardTitle className="flex items-center">
                    <Code className="mr-2 h-5 w-5" />
                    Processing Logs
                  </CardTitle>
                  <Button
                    variant="outline"
                    size="sm"
                    onClick={() => setShowRawData(!showRawData)}
                  >
                    {showRawData ? 'Hide' : 'Show'} Raw Data
                  </Button>
                </div>
              </CardHeader>
              <CardContent>
                <ScrollArea className="h-64">
                  <div className="space-y-1 font-mono text-xs">
                    {result.logs.map((log, index) => (
                      <div key={index} className="text-muted-foreground">
                        {log}
                      </div>
                    ))}
                  </div>
                </ScrollArea>
                
                {showRawData && (
                  <div className="mt-4">
                    <Label className="text-sm font-medium">Raw Script Data (JSON)</Label>
                    <ScrollArea className="h-64 mt-2">
                      <pre className="text-xs bg-gray-100 p-3 rounded">
                        {JSON.stringify(result.script, null, 2)}
                      </pre>
                    </ScrollArea>
                  </div>
                )}
              </CardContent>
            </Card>
          </TabsContent>
        </Tabs>
      )}
    </div>
  );
};