import React, { useState, useEffect } from 'react';
import { Player } from '@revideo/player-react';
import { Button } from './ui/button';
import { Card, CardContent, CardHeader, CardTitle } from './ui/card';
import { Input } from './ui/input';
import { Label } from './ui/label';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from './ui/select';
import { Textarea } from './ui/textarea';
import { Loader2, Play, Download, Wand2, Sparkles, Film, Video } from 'lucide-react';
import { Tabs, TabsContent, TabsList, TabsTrigger } from './ui/tabs';
import { useToast } from '@/hooks/use-toast';

interface RevideoPlayerProps {
  className?: string;
}

interface RenderOptions {
  titleText?: string;
  subtitleText?: string;
  primaryColor?: string;
  secondaryColor?: string;
  outputWidth?: number;
  outputHeight?: number;
  outputDuration?: number;
  selectedScene?: 'example' | 'videoEditing' | 'subtitles' | 'transitions';
  animationSpeed?: number;
}

interface VideoAnalysis {
  videoType: string;
  suggestedScene: string;
  recommendedAspectRatio: string;
  colorScheme: string;
  suggestedDuration: number;
  subtitleRecommendations: {
    fontSize: number;
    position: string;
    style: string;
  };
  animationStyle: string;
}

export function RevideoPlayer({ className }: RevideoPlayerProps) {
  const [isRendering, setIsRendering] = useState(false);
  const [renderProgress, setRenderProgress] = useState(0);
  const [renderedVideoUrl, setRenderedVideoUrl] = useState<string | null>(null);
  const [renderOptions, setRenderOptions] = useState<RenderOptions>({
    titleText: 'AI Video Editor',
    subtitleText: 'Create professional videos with code',
    primaryColor: '#8B5CF6',
    secondaryColor: '#06B6D4',
    outputWidth: 1920,
    outputHeight: 1080,
    outputDuration: 10,
    selectedScene: 'example',
    animationSpeed: 1.0
  });
  const [videoFile, setVideoFile] = useState<File | null>(null);
  const [aiAnalysis, setAiAnalysis] = useState<VideoAnalysis | null>(null);
  const [isAnalyzing, setIsAnalyzing] = useState(false);
  const [customPrompt, setCustomPrompt] = useState('');
  const [sceneDescription, setSceneDescription] = useState('');
  const { toast } = useToast();

  const aspectRatios = [
    { value: '1920x1080', label: '16:9 (1920x1080)' },
    { value: '1080x1920', label: '9:16 (1080x1920)' },
    { value: '1080x1080', label: '1:1 (1080x1080)' },
  ];

  const scenes = [
    { value: 'example', label: 'Example Scene' },
    { value: 'videoEditing', label: 'Video Editing' },
    { value: 'subtitles', label: 'Subtitles' },
    { value: 'transitions', label: 'Transitions' },
  ];

  const templates = [
    { value: 'social', label: 'Social Media', description: 'Square format for social platforms' },
    { value: 'youtube', label: 'YouTube', description: '16:9 format for YouTube videos' },
    { value: 'story', label: 'Story/Reels', description: '9:16 vertical format' },
    { value: 'presentation', label: 'Presentation', description: 'Professional business format' },
  ];

  const handleVideoUpload = (event: React.ChangeEvent<HTMLInputElement>) => {
    const file = event.target.files?.[0];
    if (file) {
      setVideoFile(file);
      toast({
        title: "Video uploaded",
        description: `${file.name} ready for AI analysis`,
      });
    }
  };

  const analyzeVideo = async () => {
    if (!videoFile) {
      toast({
        title: "Error",
        description: "Please upload a video file first",
        variant: "destructive",
      });
      return;
    }

    setIsAnalyzing(true);
    try {
      const formData = new FormData();
      formData.append('video', videoFile);
      formData.append('userPrompt', customPrompt);

      const response = await fetch('/api/revideo/ai-analyze', {
        method: 'POST',
        body: formData,
      });

      const result = await response.json();
      
      if (result.success) {
        setAiAnalysis(result.analysis);
        
        // Apply AI recommendations to render options
        const [width, height] = getAspectRatioDimensions(result.analysis.recommendedAspectRatio);
        setRenderOptions(prev => ({
          ...prev,
          selectedScene: result.analysis.suggestedScene,
          outputWidth: width,
          outputHeight: height,
          outputDuration: result.analysis.suggestedDuration,
          primaryColor: getColorFromScheme(result.analysis.colorScheme).primary,
          secondaryColor: getColorFromScheme(result.analysis.colorScheme).secondary,
        }));

        toast({
          title: "AI Analysis Complete",
          description: "Video analyzed and optimal settings applied",
        });
      } else {
        throw new Error(result.error);
      }
    } catch (error) {
      console.error('AI analysis failed:', error);
      toast({
        title: "Analysis failed",
        description: "Could not analyze video with AI",
        variant: "destructive",
      });
    } finally {
      setIsAnalyzing(false);
    }
  };

  const generateIntelligentVideo = async () => {
    if (!videoFile) {
      toast({
        title: "Error",
        description: "Please upload a video file first",
        variant: "destructive",
      });
      return;
    }

    setIsRendering(true);
    setRenderProgress(0);

    try {
      const formData = new FormData();
      formData.append('video', videoFile);
      formData.append('userPrompt', customPrompt || 'Enhance this video with AI');

      const response = await fetch('/api/revideo/ai-generate', {
        method: 'POST',
        body: formData,
      });

      const result = await response.json();
      
      if (result.success) {
        setRenderedVideoUrl(result.outputPath);
        setRenderProgress(100);
        toast({
          title: "AI Video Generated",
          description: "Your intelligent video is ready!",
        });
      } else {
        throw new Error(result.error);
      }
    } catch (error) {
      console.error('AI generation failed:', error);
      toast({
        title: "Generation failed",
        description: "Could not generate AI-enhanced video",
        variant: "destructive",
      });
    } finally {
      setIsRendering(false);
    }
  };

  const renderTemplate = async (templateType: string) => {
    setIsRendering(true);
    setRenderProgress(0);

    try {
      const response = await fetch('/api/revideo/render-template', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          templateType,
          customOptions: renderOptions,
        }),
      });

      const result = await response.json();
      
      if (result.success) {
        setRenderedVideoUrl(result.outputPath);
        setRenderProgress(100);
        toast({
          title: "Template Rendered",
          description: `${result.templateType} template video created successfully`,
        });
      } else {
        throw new Error(result.error);
      }
    } catch (error) {
      console.error('Template render failed:', error);
      toast({
        title: "Render failed",
        description: "Could not render template video",
        variant: "destructive",
      });
    } finally {
      setIsRendering(false);
    }
  };

  const renderCustomVideo = async () => {
    setIsRendering(true);
    setRenderProgress(0);

    try {
      const response = await fetch('/api/revideo/render', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify(renderOptions),
      });

      const result = await response.json();
      
      if (result.success) {
        setRenderedVideoUrl(result.outputPath);
        setRenderProgress(100);
        toast({
          title: "Video Rendered",
          description: "Your custom video is ready!",
        });
      } else {
        throw new Error(result.error);
      }
    } catch (error) {
      console.error('Render failed:', error);
      toast({
        title: "Render failed",
        description: "Could not render custom video",
        variant: "destructive",
      });
    } finally {
      setIsRendering(false);
    }
  };

  const createCustomScene = async () => {
    if (!sceneDescription.trim()) {
      toast({
        title: "Error",
        description: "Please describe the scene you want to create",
        variant: "destructive",
      });
      return;
    }

    try {
      const response = await fetch('/api/revideo/ai-scene', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({ sceneDescription }),
      });

      const result = await response.json();
      
      if (result.success) {
        setRenderOptions(prev => ({
          ...prev,
          ...result.sceneOptions,
        }));
        toast({
          title: "Custom Scene Created",
          description: "AI has generated your custom scene configuration",
        });
      } else {
        throw new Error(result.error);
      }
    } catch (error) {
      console.error('Custom scene creation failed:', error);
      toast({
        title: "Scene creation failed",
        description: "Could not create custom scene",
        variant: "destructive",
      });
    }
  };

  const getAspectRatioDimensions = (ratio: string): [number, number] => {
    switch (ratio) {
      case '16:9': return [1920, 1080];
      case '9:16': return [1080, 1920];
      case '1:1': return [1080, 1080];
      default: return [1920, 1080];
    }
  };

  const getColorFromScheme = (scheme: string) => {
    const colorSchemes: Record<string, { primary: string; secondary: string }> = {
      warm: { primary: '#FF6B6B', secondary: '#FFE66D' },
      cool: { primary: '#4ECDC4', secondary: '#45B7D1' },
      cinematic: { primary: '#2C3E50', secondary: '#E74C3C' },
      vibrant: { primary: '#8B5CF6', secondary: '#06B6D4' }
    };
    return colorSchemes[scheme] || colorSchemes.vibrant;
  };

  const downloadVideo = () => {
    if (renderedVideoUrl) {
      const link = document.createElement('a');
      link.href = renderedVideoUrl;
      link.download = 'revideo-render.mp4';
      link.click();
    }
  };

  return (
    <div className={`space-y-6 ${className}`}>
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <Film className="h-5 w-5" />
            Revideo - Programmatic Video Editor
          </CardTitle>
        </CardHeader>
        <CardContent>
          <Tabs defaultValue="ai-enhanced" className="w-full">
            <TabsList className="grid w-full grid-cols-4">
              <TabsTrigger value="ai-enhanced">AI Enhanced</TabsTrigger>
              <TabsTrigger value="templates">Templates</TabsTrigger>
              <TabsTrigger value="custom">Custom</TabsTrigger>
              <TabsTrigger value="scene-creator">Scene Creator</TabsTrigger>
            </TabsList>

            {/* AI Enhanced Video Generation */}
            <TabsContent value="ai-enhanced" className="space-y-4">
              <div className="space-y-4">
                <div>
                  <Label htmlFor="video-upload">Upload Video for AI Analysis</Label>
                  <Input
                    id="video-upload"
                    type="file"
                    accept="video/*"
                    onChange={handleVideoUpload}
                  />
                </div>
                
                <div>
                  <Label htmlFor="custom-prompt">AI Enhancement Instructions</Label>
                  <Textarea
                    id="custom-prompt"
                    placeholder="Describe how you want the AI to enhance your video..."
                    value={customPrompt}
                    onChange={(e) => setCustomPrompt(e.target.value)}
                  />
                </div>

                <div className="grid grid-cols-2 gap-4">
                  <Button 
                    onClick={analyzeVideo} 
                    disabled={!videoFile || isAnalyzing}
                    variant="outline"
                    className="w-full"
                  >
                    {isAnalyzing ? (
                      <>
                        <Loader2 className="h-4 w-4 mr-2 animate-spin" />
                        Analyzing...
                      </>
                    ) : (
                      <>
                        <Sparkles className="h-4 w-4 mr-2" />
                        Analyze Video
                      </>
                    )}
                  </Button>

                  <Button 
                    onClick={generateIntelligentVideo} 
                    disabled={!videoFile || isRendering}
                    className="w-full"
                  >
                    {isRendering ? (
                      <>
                        <Loader2 className="h-4 w-4 mr-2 animate-spin" />
                        Generating...
                      </>
                    ) : (
                      <>
                        <Wand2 className="h-4 w-4 mr-2" />
                        Generate AI Video
                      </>
                    )}
                  </Button>
                </div>

                {aiAnalysis && (
                  <Card className="mt-4">
                    <CardHeader>
                      <CardTitle className="text-lg">AI Analysis Results</CardTitle>
                    </CardHeader>
                    <CardContent>
                      <div className="grid grid-cols-2 gap-4 text-sm">
                        <div>
                          <strong>Video Type:</strong> {aiAnalysis.videoType}
                        </div>
                        <div>
                          <strong>Suggested Scene:</strong> {aiAnalysis.suggestedScene}
                        </div>
                        <div>
                          <strong>Aspect Ratio:</strong> {aiAnalysis.recommendedAspectRatio}
                        </div>
                        <div>
                          <strong>Color Scheme:</strong> {aiAnalysis.colorScheme}
                        </div>
                        <div>
                          <strong>Duration:</strong> {aiAnalysis.suggestedDuration}s
                        </div>
                        <div>
                          <strong>Animation:</strong> {aiAnalysis.animationStyle}
                        </div>
                      </div>
                    </CardContent>
                  </Card>
                )}
              </div>
            </TabsContent>

            {/* Template Generation */}
            <TabsContent value="templates" className="space-y-4">
              <div className="grid grid-cols-2 gap-4">
                {templates.map((template) => (
                  <Card key={template.value} className="cursor-pointer hover:bg-accent transition-colors">
                    <CardContent className="p-4">
                      <h3 className="font-semibold">{template.label}</h3>
                      <p className="text-sm text-muted-foreground mb-3">{template.description}</p>
                      <Button 
                        onClick={() => renderTemplate(template.value)}
                        disabled={isRendering}
                        size="sm"
                        className="w-full"
                      >
                        <Video className="h-4 w-4 mr-2" />
                        Render Template
                      </Button>
                    </CardContent>
                  </Card>
                ))}
              </div>
            </TabsContent>

            {/* Custom Video Generation */}
            <TabsContent value="custom" className="space-y-4">
              <div className="grid grid-cols-2 gap-4">
                <div>
                  <Label htmlFor="title-text">Title Text</Label>
                  <Input
                    id="title-text"
                    value={renderOptions.titleText}
                    onChange={(e) => setRenderOptions(prev => ({ ...prev, titleText: e.target.value }))}
                  />
                </div>
                
                <div>
                  <Label htmlFor="subtitle-text">Subtitle Text</Label>
                  <Input
                    id="subtitle-text"
                    value={renderOptions.subtitleText}
                    onChange={(e) => setRenderOptions(prev => ({ ...prev, subtitleText: e.target.value }))}
                  />
                </div>

                <div>
                  <Label htmlFor="primary-color">Primary Color</Label>
                  <Input
                    id="primary-color"
                    type="color"
                    value={renderOptions.primaryColor}
                    onChange={(e) => setRenderOptions(prev => ({ ...prev, primaryColor: e.target.value }))}
                  />
                </div>

                <div>
                  <Label htmlFor="secondary-color">Secondary Color</Label>
                  <Input
                    id="secondary-color"
                    type="color"
                    value={renderOptions.secondaryColor}
                    onChange={(e) => setRenderOptions(prev => ({ ...prev, secondaryColor: e.target.value }))}
                  />
                </div>

                <div>
                  <Label htmlFor="aspect-ratio">Aspect Ratio</Label>
                  <Select
                    value={`${renderOptions.outputWidth}x${renderOptions.outputHeight}`}
                    onValueChange={(value) => {
                      const [width, height] = value.split('x').map(Number);
                      setRenderOptions(prev => ({ ...prev, outputWidth: width, outputHeight: height }));
                    }}
                  >
                    <SelectTrigger>
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                      {aspectRatios.map((ratio) => (
                        <SelectItem key={ratio.value} value={ratio.value}>
                          {ratio.label}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>

                <div>
                  <Label htmlFor="scene-select">Scene Type</Label>
                  <Select
                    value={renderOptions.selectedScene}
                    onValueChange={(value) => setRenderOptions(prev => ({ ...prev, selectedScene: value as any }))}
                  >
                    <SelectTrigger>
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                      {scenes.map((scene) => (
                        <SelectItem key={scene.value} value={scene.value}>
                          {scene.label}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>

                <div>
                  <Label htmlFor="duration">Duration (seconds)</Label>
                  <Input
                    id="duration"
                    type="number"
                    min="1"
                    max="300"
                    value={renderOptions.outputDuration}
                    onChange={(e) => setRenderOptions(prev => ({ ...prev, outputDuration: parseInt(e.target.value) }))}
                  />
                </div>

                <div>
                  <Label htmlFor="animation-speed">Animation Speed</Label>
                  <Input
                    id="animation-speed"
                    type="number"
                    min="0.1"
                    max="3"
                    step="0.1"
                    value={renderOptions.animationSpeed}
                    onChange={(e) => setRenderOptions(prev => ({ ...prev, animationSpeed: parseFloat(e.target.value) }))}
                  />
                </div>
              </div>

              <Button 
                onClick={renderCustomVideo} 
                disabled={isRendering}
                className="w-full"
              >
                {isRendering ? (
                  <>
                    <Loader2 className="h-4 w-4 mr-2 animate-spin" />
                    Rendering... {renderProgress}%
                  </>
                ) : (
                  <>
                    <Play className="h-4 w-4 mr-2" />
                    Render Custom Video
                  </>
                )}
              </Button>
            </TabsContent>

            {/* Scene Creator */}
            <TabsContent value="scene-creator" className="space-y-4">
              <div>
                <Label htmlFor="scene-description">Describe Your Scene</Label>
                <Textarea
                  id="scene-description"
                  placeholder="Describe the scene you want to create (e.g., 'A dynamic intro with floating text and particle effects')..."
                  value={sceneDescription}
                  onChange={(e) => setSceneDescription(e.target.value)}
                  rows={4}
                />
              </div>

              <Button 
                onClick={createCustomScene} 
                className="w-full"
                variant="outline"
              >
                <Wand2 className="h-4 w-4 mr-2" />
                Generate Scene Configuration
              </Button>

              <Button 
                onClick={renderCustomVideo} 
                disabled={isRendering || !sceneDescription.trim()}
                className="w-full"
              >
                {isRendering ? (
                  <>
                    <Loader2 className="h-4 w-4 mr-2 animate-spin" />
                    Rendering Scene...
                  </>
                ) : (
                  <>
                    <Play className="h-4 w-4 mr-2" />
                    Render Custom Scene
                  </>
                )}
              </Button>
            </TabsContent>
          </Tabs>

          {/* Video Player */}
          {renderedVideoUrl && (
            <Card className="mt-6">
              <CardHeader>
                <CardTitle className="flex items-center justify-between">
                  <span>Rendered Video</span>
                  <Button onClick={downloadVideo} size="sm">
                    <Download className="h-4 w-4 mr-2" />
                    Download
                  </Button>
                </CardTitle>
              </CardHeader>
              <CardContent>
                <video 
                  controls 
                  className="w-full h-auto rounded-lg"
                  src={renderedVideoUrl}
                >
                  Your browser does not support video playback.
                </video>
              </CardContent>
            </Card>
          )}
        </CardContent>
      </Card>
    </div>
  );
}