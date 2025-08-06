import React, { useState, useEffect, useRef } from 'react';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Slider } from '@/components/ui/slider';
import { Label } from '@/components/ui/label';
import { Switch } from '@/components/ui/switch';
import { Progress } from '@/components/ui/progress';
import { Badge } from '@/components/ui/badge';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { Upload, Play, Pause, Download, Volume2, Activity, BarChart3 } from 'lucide-react';
import { useMutation } from '@tanstack/react-query';
import { useToast } from '@/hooks/use-toast';

interface AudioLevelingOptions {
  targetLUFS: number;
  dynamicRange: number;
  compressorRatio: number;
  gateThreshold: number;
  normalize: boolean;
  limiterEnabled: boolean;
}

interface WaveformData {
  timestamps: number[];
  peaks: number[];
  rms: number[];
  frequency: number;
  duration: number;
  channels: number;
  sampleRate: number;
}

interface AudioAnalysis {
  originalLUFS: number;
  targetLUFS: number;
  peakLevel: number;
  dynamicRange: number;
  clippingDetected: boolean;
  silencePercentage: number;
  waveform: WaveformData;
}

interface AudioProcessingResult {
  outputPath: string;
  originalAnalysis: AudioAnalysis;
  processedAnalysis: AudioAnalysis;
  processingTime: number;
  improvementMetrics: {
    lufsImprovement: number;
    dynamicRangeChange: number;
    peakReduction: number;
    consistencyScore: number;
  };
}

const WaveformVisualization: React.FC<{
  waveformData: WaveformData | null;
  isPlaying: boolean;
  currentTime: number;
  title: string;
}> = ({ waveformData, isPlaying, currentTime, title }) => {
  const canvasRef = useRef<HTMLCanvasElement>(null);

  useEffect(() => {
    if (!waveformData || !canvasRef.current) return;

    const canvas = canvasRef.current;
    const ctx = canvas.getContext('2d');
    if (!ctx) return;

    const { width, height } = canvas;
    ctx.clearRect(0, 0, width, height);

    // Draw waveform
    const { peaks, rms, timestamps, duration } = waveformData;
    const barWidth = width / peaks.length;

    peaks.forEach((peak, i) => {
      const rmsValue = rms[i] || peak;
      const x = i * barWidth;
      
      // Convert dB to height (assuming -60dB to 0dB range)
      const peakHeight = Math.max(1, ((peak + 60) / 60) * height);
      const rmsHeight = Math.max(1, ((rmsValue + 60) / 60) * height);
      
      // Draw RMS (background)
      ctx.fillStyle = '#3b82f6';
      ctx.fillRect(x, height - rmsHeight, barWidth - 1, rmsHeight);
      
      // Draw peaks (foreground)
      ctx.fillStyle = '#1d4ed8';
      ctx.fillRect(x, height - peakHeight, barWidth - 1, Math.max(1, peakHeight - rmsHeight));
    });

    // Draw playhead
    if (duration > 0) {
      const playheadX = (currentTime / duration) * width;
      ctx.strokeStyle = '#ef4444';
      ctx.lineWidth = 2;
      ctx.beginPath();
      ctx.moveTo(playheadX, 0);
      ctx.lineTo(playheadX, height);
      ctx.stroke();
    }

    // Draw level lines
    ctx.strokeStyle = '#6b7280';
    ctx.lineWidth = 1;
    ctx.setLineDash([2, 2]);
    
    [-6, -12, -18, -24, -30].forEach(dbLevel => {
      const y = height - ((dbLevel + 60) / 60) * height;
      ctx.beginPath();
      ctx.moveTo(0, y);
      ctx.lineTo(width, y);
      ctx.stroke();
    });

  }, [waveformData, currentTime]);

  return (
    <div className="space-y-2">
      <div className="flex items-center justify-between">
        <Label className="text-sm font-medium">{title}</Label>
        <div className="flex items-center space-x-2 text-xs text-muted-foreground">
          {waveformData && (
            <>
              <span>{waveformData.channels} ch</span>
              <span>{(waveformData.sampleRate / 1000).toFixed(1)}kHz</span>
              <span>{waveformData.duration.toFixed(1)}s</span>
            </>
          )}
        </div>
      </div>
      <div className="border rounded-lg bg-gray-900 p-2">
        <canvas
          ref={canvasRef}
          width={600}
          height={120}
          className="w-full h-24 rounded"
          style={{ maxWidth: '100%' }}
        />
      </div>
      <div className="flex justify-between text-xs text-muted-foreground">
        <span>0dB</span>
        <span>-30dB</span>
        <span>-60dB</span>
      </div>
    </div>
  );
};

const AudioMetrics: React.FC<{
  analysis: AudioAnalysis | null;
  title: string;
  color: 'blue' | 'green';
}> = ({ analysis, title, color }) => {
  if (!analysis) return null;

  const colorClasses = {
    blue: 'border-blue-200 bg-blue-50',
    green: 'border-green-200 bg-green-50'
  };

  return (
    <Card className={`${colorClasses[color]} border-2`}>
      <CardHeader className="pb-3">
        <CardTitle className="text-lg flex items-center">
          <Activity className="mr-2 h-5 w-5" />
          {title}
        </CardTitle>
      </CardHeader>
      <CardContent className="space-y-4">
        <div className="grid grid-cols-2 gap-4">
          <div>
            <Label className="text-sm text-muted-foreground">LUFS</Label>
            <div className="text-2xl font-bold">
              {analysis.originalLUFS.toFixed(1)}
            </div>
          </div>
          <div>
            <Label className="text-sm text-muted-foreground">Peak</Label>
            <div className="text-2xl font-bold">
              {analysis.peakLevel.toFixed(1)} dB
            </div>
          </div>
          <div>
            <Label className="text-sm text-muted-foreground">Dynamic Range</Label>
            <div className="text-2xl font-bold">
              {analysis.dynamicRange.toFixed(1)} LU
            </div>
          </div>
          <div>
            <Label className="text-sm text-muted-foreground">Silence</Label>
            <div className="text-2xl font-bold">
              {analysis.silencePercentage.toFixed(1)}%
            </div>
          </div>
        </div>
        
        <div className="space-y-2">
          {analysis.clippingDetected && (
            <Badge variant="destructive" className="w-full justify-center">
              Clipping Detected
            </Badge>
          )}
          
          <div className="flex items-center justify-between text-sm">
            <span>Audio Quality</span>
            <Badge variant={analysis.clippingDetected ? "destructive" : analysis.originalLUFS > -16 ? "secondary" : "default"}>
              {analysis.clippingDetected ? "Poor" : analysis.originalLUFS > -16 ? "Loud" : "Good"}
            </Badge>
          </div>
        </div>
      </CardContent>
    </Card>
  );
};

export const AudioLevelingInterface: React.FC = () => {
  const [selectedFile, setSelectedFile] = useState<File | null>(null);
  const [audioUrl, setAudioUrl] = useState<string | null>(null);
  const [processedAudioUrl, setProcessedAudioUrl] = useState<string | null>(null);
  const [isPlaying, setIsPlaying] = useState(false);
  const [currentTime, setCurrentTime] = useState(0);
  const [processingResult, setProcessingResult] = useState<AudioProcessingResult | null>(null);
  const [processingProgress, setProcessingProgress] = useState(0);
  
  const audioRef = useRef<HTMLAudioElement>(null);
  const { toast } = useToast();

  const [options, setOptions] = useState<AudioLevelingOptions>({
    targetLUFS: -16, // Streaming standard
    dynamicRange: 7,
    compressorRatio: 3,
    gateThreshold: -40,
    normalize: true,
    limiterEnabled: true
  });

  const uploadMutation = useMutation({
    mutationFn: async (file: File) => {
      const formData = new FormData();
      formData.append('audio', file);
      
      const response = await fetch('/api/upload-audio', {
        method: 'POST',
        body: formData
      });
      
      if (!response.ok) throw new Error('Upload failed');
      return response.json();
    },
    onSuccess: (data) => {
      setAudioUrl(data.audioUrl);
      toast({
        title: "Audio uploaded successfully",
        description: "Ready for processing"
      });
    },
    onError: () => {
      toast({
        title: "Upload failed",
        description: "Please try again",
        variant: "destructive"
      });
    }
  });

  const processAudioMutation = useMutation({
    mutationFn: async () => {
      if (!audioUrl) throw new Error('No audio file');
      
      const response = await fetch('/api/process-audio-leveling', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          audioPath: audioUrl,
          options
        })
      });
      
      if (!response.ok) throw new Error('Processing failed');
      return response.json();
    },
    onSuccess: (result: AudioProcessingResult) => {
      setProcessingResult(result);
      setProcessedAudioUrl(result.outputPath);
      setProcessingProgress(0);
      toast({
        title: "Audio processing completed",
        description: `Improved by ${result.improvementMetrics.consistencyScore.toFixed(1)}% consistency`
      });
    },
    onError: () => {
      setProcessingProgress(0);
      toast({
        title: "Processing failed",
        description: "Please try again",
        variant: "destructive"
      });
    }
  });

  const handleFileUpload = (event: React.ChangeEvent<HTMLInputElement>) => {
    const file = event.target.files?.[0];
    if (file) {
      setSelectedFile(file);
      uploadMutation.mutate(file);
    }
  };

  const handlePlayPause = () => {
    if (audioRef.current) {
      if (isPlaying) {
        audioRef.current.pause();
      } else {
        audioRef.current.play();
      }
      setIsPlaying(!isPlaying);
    }
  };

  const handleTimeUpdate = () => {
    if (audioRef.current) {
      setCurrentTime(audioRef.current.currentTime);
    }
  };

  const handleDownload = (url: string, filename: string) => {
    const a = document.createElement('a');
    a.href = url;
    a.download = filename;
    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);
  };

  return (
    <div className="max-w-6xl mx-auto p-6 space-y-6">
      <div className="text-center space-y-2">
        <h1 className="text-3xl font-bold">Smart Audio Leveling</h1>
        <p className="text-muted-foreground">
          Intelligent audio processing with real-time waveform visualization
        </p>
      </div>

      {/* File Upload */}
      <Card>
        <CardContent className="p-6">
          <div className="border-2 border-dashed border-gray-300 rounded-lg p-8 text-center">
            <Upload className="mx-auto h-12 w-12 text-gray-400 mb-4" />
            <div className="space-y-2">
              <Label htmlFor="audio-upload" className="text-lg font-medium cursor-pointer">
                Choose audio file
              </Label>
              <p className="text-sm text-muted-foreground">
                Supports MP3, WAV, AAC, and more
              </p>
              <input
                id="audio-upload"
                type="file"
                accept="audio/*"
                onChange={handleFileUpload}
                className="hidden"
              />
            </div>
            {selectedFile && (
              <div className="mt-4 p-3 bg-blue-50 rounded-lg">
                <p className="text-sm font-medium">{selectedFile.name}</p>
                <p className="text-xs text-muted-foreground">
                  {(selectedFile.size / 1024 / 1024).toFixed(2)} MB
                </p>
              </div>
            )}
          </div>
        </CardContent>
      </Card>

      {audioUrl && (
        <>
          {/* Audio Controls */}
          <Card>
            <CardContent className="p-6">
              <div className="flex items-center justify-between">
                <div className="flex items-center space-x-4">
                  <Button
                    variant="outline"
                    size="sm"
                    onClick={handlePlayPause}
                    disabled={!audioUrl}
                  >
                    {isPlaying ? <Pause className="h-4 w-4" /> : <Play className="h-4 w-4" />}
                  </Button>
                  <div className="text-sm text-muted-foreground">
                    {Math.floor(currentTime / 60)}:{(currentTime % 60).toFixed(0).padStart(2, '0')}
                  </div>
                </div>
                
                <div className="flex items-center space-x-2">
                  {processedAudioUrl && (
                    <Button
                      variant="outline"
                      size="sm"
                      onClick={() => handleDownload(processedAudioUrl, 'processed-audio.aac')}
                    >
                      <Download className="h-4 w-4 mr-2" />
                      Download
                    </Button>
                  )}
                </div>
              </div>
              
              <audio
                ref={audioRef}
                src={processedAudioUrl || audioUrl}
                onTimeUpdate={handleTimeUpdate}
                onEnded={() => setIsPlaying(false)}
                style={{ display: 'none' }}
              />
            </CardContent>
          </Card>

          {/* Processing Controls */}
          <Card>
            <CardHeader>
              <CardTitle className="flex items-center">
                <Volume2 className="mr-2 h-5 w-5" />
                Processing Settings
              </CardTitle>
            </CardHeader>
            <CardContent className="space-y-6">
              <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                <div className="space-y-4">
                  <div>
                    <Label>Target Loudness (LUFS)</Label>
                    <Slider
                      value={[options.targetLUFS]}
                      onValueChange={([value]) => setOptions(prev => ({ ...prev, targetLUFS: value }))}
                      min={-30}
                      max={-6}
                      step={1}
                      className="mt-2"
                    />
                    <div className="flex justify-between text-xs text-muted-foreground mt-1">
                      <span>-30</span>
                      <span>Current: {options.targetLUFS} LUFS</span>
                      <span>-6</span>
                    </div>
                  </div>

                  <div>
                    <Label>Dynamic Range (LU)</Label>
                    <Slider
                      value={[options.dynamicRange]}
                      onValueChange={([value]) => setOptions(prev => ({ ...prev, dynamicRange: value }))}
                      min={3}
                      max={20}
                      step={1}
                      className="mt-2"
                    />
                    <div className="flex justify-between text-xs text-muted-foreground mt-1">
                      <span>3</span>
                      <span>Current: {options.dynamicRange} LU</span>
                      <span>20</span>
                    </div>
                  </div>

                  <div>
                    <Label>Compression Ratio</Label>
                    <Slider
                      value={[options.compressorRatio]}
                      onValueChange={([value]) => setOptions(prev => ({ ...prev, compressorRatio: value }))}
                      min={1}
                      max={10}
                      step={0.5}
                      className="mt-2"
                    />
                    <div className="flex justify-between text-xs text-muted-foreground mt-1">
                      <span>1:1</span>
                      <span>Current: {options.compressorRatio}:1</span>
                      <span>10:1</span>
                    </div>
                  </div>
                </div>

                <div className="space-y-4">
                  <div>
                    <Label>Noise Gate (dB)</Label>
                    <Slider
                      value={[options.gateThreshold]}
                      onValueChange={([value]) => setOptions(prev => ({ ...prev, gateThreshold: value }))}
                      min={-60}
                      max={-10}
                      step={1}
                      className="mt-2"
                    />
                    <div className="flex justify-between text-xs text-muted-foreground mt-1">
                      <span>-60</span>
                      <span>Current: {options.gateThreshold} dB</span>
                      <span>-10</span>
                    </div>
                  </div>

                  <div className="space-y-3">
                    <div className="flex items-center space-x-2">
                      <Switch
                        id="normalize"
                        checked={options.normalize}
                        onCheckedChange={(checked) => setOptions(prev => ({ ...prev, normalize: checked }))}
                      />
                      <Label htmlFor="normalize">Peak Normalization</Label>
                    </div>

                    <div className="flex items-center space-x-2">
                      <Switch
                        id="limiter"
                        checked={options.limiterEnabled}
                        onCheckedChange={(checked) => setOptions(prev => ({ ...prev, limiterEnabled: checked }))}
                      />
                      <Label htmlFor="limiter">Peak Limiter</Label>
                    </div>
                  </div>
                </div>
              </div>

              <div className="flex justify-center">
                <Button
                  onClick={() => processAudioMutation.mutate()}
                  disabled={!audioUrl || processAudioMutation.isPending}
                  size="lg"
                  className="px-8"
                >
                  {processAudioMutation.isPending ? 'Processing...' : 'Process Audio'}
                </Button>
              </div>

              {processAudioMutation.isPending && (
                <div className="space-y-2">
                  <div className="flex justify-between text-sm">
                    <span>Processing audio...</span>
                    <span>{processingProgress}%</span>
                  </div>
                  <Progress value={processingProgress} />
                </div>
              )}
            </CardContent>
          </Card>

          {/* Results */}
          {processingResult && (
            <Tabs defaultValue="waveform" className="space-y-4">
              <TabsList className="grid w-full grid-cols-3">
                <TabsTrigger value="waveform">Waveform</TabsTrigger>
                <TabsTrigger value="analysis">Analysis</TabsTrigger>
                <TabsTrigger value="metrics">Metrics</TabsTrigger>
              </TabsList>

              <TabsContent value="waveform" className="space-y-4">
                <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
                  <div>
                    <WaveformVisualization
                      waveformData={processingResult.originalAnalysis.waveform}
                      isPlaying={isPlaying}
                      currentTime={currentTime}
                      title="Original Audio"
                    />
                  </div>
                  <div>
                    <WaveformVisualization
                      waveformData={processingResult.processedAnalysis.waveform}
                      isPlaying={isPlaying}
                      currentTime={currentTime}
                      title="Processed Audio"
                    />
                  </div>
                </div>
              </TabsContent>

              <TabsContent value="analysis" className="space-y-4">
                <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
                  <AudioMetrics
                    analysis={processingResult.originalAnalysis}
                    title="Original Analysis"
                    color="blue"
                  />
                  <AudioMetrics
                    analysis={processingResult.processedAnalysis}
                    title="Processed Analysis"
                    color="green"
                  />
                </div>
              </TabsContent>

              <TabsContent value="metrics" className="space-y-4">
                <Card>
                  <CardHeader>
                    <CardTitle className="flex items-center">
                      <BarChart3 className="mr-2 h-5 w-5" />
                      Improvement Metrics
                    </CardTitle>
                  </CardHeader>
                  <CardContent>
                    <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
                      <div className="text-center p-4 bg-green-50 rounded-lg">
                        <div className="text-2xl font-bold text-green-600">
                          {processingResult.improvementMetrics.consistencyScore.toFixed(1)}%
                        </div>
                        <div className="text-sm text-muted-foreground">Consistency</div>
                      </div>
                      <div className="text-center p-4 bg-blue-50 rounded-lg">
                        <div className="text-2xl font-bold text-blue-600">
                          {processingResult.improvementMetrics.peakReduction.toFixed(1)} dB
                        </div>
                        <div className="text-sm text-muted-foreground">Peak Reduction</div>
                      </div>
                      <div className="text-center p-4 bg-purple-50 rounded-lg">
                        <div className="text-2xl font-bold text-purple-600">
                          {processingResult.improvementMetrics.lufsImprovement.toFixed(1)}
                        </div>
                        <div className="text-sm text-muted-foreground">LUFS Improvement</div>
                      </div>
                      <div className="text-center p-4 bg-orange-50 rounded-lg">
                        <div className="text-2xl font-bold text-orange-600">
                          {(processingResult.processingTime / 1000).toFixed(1)}s
                        </div>
                        <div className="text-sm text-muted-foreground">Processing Time</div>
                      </div>
                    </div>
                  </CardContent>
                </Card>
              </TabsContent>
            </Tabs>
          )}
        </>
      )}
    </div>
  );
};