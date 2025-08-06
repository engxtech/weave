import { useState, useRef } from 'react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Separator } from '@/components/ui/separator';
import { Checkbox } from '@/components/ui/checkbox';
import { 
  Upload, Play, Video, FileVideo, Check, ArrowRight, Sparkles, 
  Grid3X3, Volume2, Type, ChevronLeft
} from 'lucide-react';
import { useToast } from '@/hooks/use-toast';
import { AppHeader } from '@/components/app-header';
import { useLocation } from 'wouter';

interface VideoFile {
  file: File;
  preview: string;
  duration?: number;
}

interface SubtitleTemplate {
  id: string;
  name: string;
  preview: string;
  style: {
    fontSize: number;
    fontWeight: number;
    textColor: string;
    fontFamily: string;
    currentWordColor: string;
    currentWordBackgroundColor: string;
    shadowColor: string;
    shadowBlur: number;
    fadeInAnimation: boolean;
    textAlign: string;
  };
}

function SplitScreenGenerator() {
  const [currentStep, setCurrentStep] = useState(1);
  const [mainVideo, setMainVideo] = useState<VideoFile | null>(null);
  const [backgroundVideo, setBackgroundVideo] = useState<VideoFile | null>(null);
  const [selectedAudioSource, setSelectedAudioSource] = useState<'main' | 'background'>('main');
  const [selectedSubtitleSource, setSelectedSubtitleSource] = useState<'main' | 'background'>('main');
  const [selectedTemplate, setSelectedTemplate] = useState<string>('youtube-shorts');
  const [processing, setProcessing] = useState(false);
  const [, setLocation] = useLocation();
  const { toast } = useToast();

  const mainVideoRef = useRef<HTMLInputElement>(null);
  const backgroundVideoRef = useRef<HTMLInputElement>(null);

  // Subtitle templates based on the unified editor
  const subtitleTemplates: SubtitleTemplate[] = [
    {
      id: 'youtube-shorts',
      name: 'YouTube Shorts',
      preview: 'WORD',
      style: {
        fontSize: 80,
        fontWeight: 800,
        textColor: '#ffffff',
        fontFamily: 'Mulish',
        currentWordColor: '#00FFFF',
        currentWordBackgroundColor: '#FF0000',
        shadowColor: '#000000',
        shadowBlur: 30,
        fadeInAnimation: true,
        textAlign: 'center'
      }
    },
    {
      id: 'tiktok-style',
      name: 'TikTok Style',
      preview: 'WORD',
      style: {
        fontSize: 72,
        fontWeight: 900,
        textColor: '#ffffff',
        fontFamily: 'Arial',
        currentWordColor: '#FF69B4',
        currentWordBackgroundColor: '#000000',
        shadowColor: '#000000',
        shadowBlur: 20,
        fadeInAnimation: true,
        textAlign: 'center'
      }
    },
    {
      id: 'professional',
      name: 'Professional',
      preview: 'WORD',
      style: {
        fontSize: 48,
        fontWeight: 600,
        textColor: '#ffffff',
        fontFamily: 'Helvetica',
        currentWordColor: '#4A90E2',
        currentWordBackgroundColor: 'rgba(0,0,0,0.8)',
        shadowColor: '#000000',
        shadowBlur: 15,
        fadeInAnimation: false,
        textAlign: 'center'
      }
    },
    {
      id: 'gaming',
      name: 'Gaming',
      preview: 'WORD',
      style: {
        fontSize: 64,
        fontWeight: 800,
        textColor: '#00FF00',
        fontFamily: 'Courier New',
        currentWordColor: '#FFFF00',
        currentWordBackgroundColor: '#FF0000',
        shadowColor: '#000000',
        shadowBlur: 25,
        fadeInAnimation: true,
        textAlign: 'center'
      }
    }
  ];

  const handleVideoUpload = (type: 'main' | 'background', event: React.ChangeEvent<HTMLInputElement>) => {
    const file = event.target.files?.[0];
    if (!file) return;

    if (!file.type.startsWith('video/')) {
      toast({
        title: "Invalid File",
        description: "Please upload a video file",
        variant: "destructive"
      });
      return;
    }

    if (file.size > 500 * 1024 * 1024) { // 500MB limit
      toast({
        title: "File Too Large",
        description: "Video file must be under 500MB",
        variant: "destructive"
      });
      return;
    }

    const preview = URL.createObjectURL(file);
    const videoFile: VideoFile = { file, preview };

    if (type === 'main') {
      setMainVideo(videoFile);
    } else {
      setBackgroundVideo(videoFile);
    }

    toast({
      title: "Video Uploaded",
      description: `${type === 'main' ? 'Main' : 'Background'} video uploaded successfully`,
    });
  };

  const handleGenerate = async () => {
    if (!mainVideo || !backgroundVideo) {
      toast({
        title: "Missing Videos",
        description: "Please upload both main and background videos",
        variant: "destructive"
      });
      return;
    }

    setProcessing(true);

    try {
      // Upload videos
      const formData = new FormData();
      formData.append('mainVideo', mainVideo.file);
      formData.append('backgroundVideo', backgroundVideo.file);
      formData.append('audioSource', selectedAudioSource);
      formData.append('subtitleSource', selectedSubtitleSource);
      formData.append('subtitleTemplate', selectedTemplate);

      const response = await fetch('/api/generate-split-screen', {
        method: 'POST',
        body: formData
      });

      if (!response.ok) {
        throw new Error('Failed to generate split-screen video');
      }

      const result = await response.json();

      toast({
        title: "Split-Screen Video Generated!",
        description: "Redirecting to the Unified Video Editor...",
      });

      // Redirect to unified editor with the generated video
      setTimeout(() => {
        setLocation(`/unified-editor?video=${result.videoId}`);
      }, 2000);

    } catch (error) {
      console.error('Generation error:', error);
      toast({
        title: "Generation Failed",
        description: "Failed to generate split-screen video. Please try again.",
        variant: "destructive"
      });
    } finally {
      setProcessing(false);
    }
  };

  const canProceed = () => {
    switch (currentStep) {
      case 1:
        return mainVideo !== null;
      case 2:
        return backgroundVideo !== null;
      case 3:
        return true;
      default:
        return false;
    }
  };

  return (
    <div className="min-h-screen bg-gradient-to-br from-slate-950 via-purple-950 to-slate-950">
      <AppHeader />
      
      {/* Animated Background */}
      <div className="fixed inset-0 overflow-hidden pointer-events-none">
        <div className="absolute top-1/4 left-1/4 w-96 h-96 bg-purple-500/10 rounded-full blur-3xl animate-pulse"></div>
        <div className="absolute bottom-1/4 right-1/4 w-96 h-96 bg-cyan-500/10 rounded-full blur-3xl animate-pulse delay-1000"></div>
        <div className="absolute top-1/2 left-1/2 transform -translate-x-1/2 -translate-y-1/2 w-96 h-96 bg-pink-500/10 rounded-full blur-3xl animate-pulse delay-2000"></div>
      </div>

      <div className="relative z-10 container mx-auto px-4 py-8">
        {/* Header */}
        <div className="text-center mb-8">
          <div className="flex items-center justify-center gap-3 mb-4">
            <div className="w-12 h-12 bg-gradient-to-r from-purple-500 to-pink-500 rounded-xl flex items-center justify-center">
              <Grid3X3 className="w-6 h-6 text-white" />
            </div>
            <h1 className="text-4xl font-bold bg-gradient-to-r from-white via-purple-200 to-pink-200 bg-clip-text text-transparent">
              Split Screen Video
            </h1>
          </div>
          <p className="text-slate-400 text-lg max-w-2xl mx-auto">
            Create engaging split-screen videos with AI-powered subtitles and professional layouts
          </p>
        </div>

        {/* Progress Steps */}
        <div className="flex justify-center mb-8">
          <div className="flex items-center gap-4">
            {[
              { step: 1, title: 'Upload Video', icon: Upload },
              { step: 2, title: 'Select Background', icon: Video },
              { step: 3, title: 'Select Subtitles', icon: Type }
            ].map(({ step, title, icon: Icon }, index) => (
              <div key={step} className="flex items-center">
                <div className={`flex items-center gap-2 px-4 py-2 rounded-full transition-all ${
                  currentStep === step 
                    ? 'bg-purple-500 text-white' 
                    : currentStep > step 
                      ? 'bg-green-500 text-white'
                      : 'bg-slate-800 text-slate-400'
                }`}>
                  {currentStep > step ? (
                    <Check className="w-4 h-4" />
                  ) : (
                    <Icon className="w-4 h-4" />
                  )}
                  <span className="text-sm font-medium">{title}</span>
                </div>
                {index < 2 && (
                  <ArrowRight className="w-4 h-4 text-slate-600 mx-2" />
                )}
              </div>
            ))}
          </div>
        </div>

        {/* Step Content */}
        <div className="max-w-4xl mx-auto">
          {currentStep === 1 && (
            <Card className="bg-slate-900/50 backdrop-blur-xl border-slate-800/50 shadow-2xl">
              <CardHeader>
                <CardTitle className="text-white flex items-center gap-2">
                  <Upload className="w-5 h-5" />
                  Upload Main Video
                </CardTitle>
                <p className="text-slate-400">Upload your main video content</p>
              </CardHeader>
              <CardContent className="space-y-6">
                <div
                  className="border-2 border-dashed border-slate-600 rounded-lg p-8 text-center cursor-pointer hover:border-purple-500/50 transition-colors"
                  onClick={() => mainVideoRef.current?.click()}
                >
                  {mainVideo ? (
                    <div className="space-y-4">
                      <video 
                        src={mainVideo.preview} 
                        className="w-full max-w-md mx-auto rounded-lg"
                        controls
                      />
                      <div className="text-slate-300">
                        <p className="font-medium">{mainVideo.file.name}</p>
                        <p className="text-sm text-slate-400">
                          {(mainVideo.file.size / (1024 * 1024)).toFixed(1)} MB
                        </p>
                      </div>
                    </div>
                  ) : (
                    <div className="space-y-4">
                      <FileVideo className="w-16 h-16 text-slate-400 mx-auto" />
                      <div>
                        <p className="text-slate-300 font-medium">Choose a video or drag & drop it here</p>
                        <p className="text-slate-400 text-sm">MP4 formats, up to 500 MB</p>
                      </div>
                      <Button variant="outline" className="mt-4">
                        Browse File
                      </Button>
                    </div>
                  )}
                </div>
                <input
                  ref={mainVideoRef}
                  type="file"
                  accept="video/*"
                  className="hidden"
                  onChange={(e) => handleVideoUpload('main', e)}
                />
              </CardContent>
            </Card>
          )}

          {currentStep === 2 && (
            <Card className="bg-slate-900/50 backdrop-blur-xl border-slate-800/50 shadow-2xl">
              <CardHeader>
                <CardTitle className="text-white flex items-center gap-2">
                  <Video className="w-5 h-5" />
                  Select Background Video
                </CardTitle>
                <p className="text-slate-400">Choose or upload a background video for the split screen</p>
              </CardHeader>
              <CardContent className="space-y-6">
                {/* Upload Custom Background */}
                <div
                  className="border-2 border-dashed border-slate-600 rounded-lg p-6 text-center cursor-pointer hover:border-purple-500/50 transition-colors"
                  onClick={() => backgroundVideoRef.current?.click()}
                >
                  {backgroundVideo ? (
                    <div className="space-y-4">
                      <video 
                        src={backgroundVideo.preview} 
                        className="w-full max-w-md mx-auto rounded-lg"
                        controls
                      />
                      <div className="text-slate-300">
                        <p className="font-medium">{backgroundVideo.file.name}</p>
                        <p className="text-sm text-slate-400">
                          {(backgroundVideo.file.size / (1024 * 1024)).toFixed(1)} MB
                        </p>
                      </div>
                    </div>
                  ) : (
                    <div className="space-y-4">
                      <Upload className="w-12 h-12 text-slate-400 mx-auto" />
                      <div>
                        <p className="text-slate-300 font-medium">Upload Custom Background</p>
                        <p className="text-slate-400 text-sm">MP4 formats, up to 500 MB</p>
                      </div>
                    </div>
                  )}
                </div>
                <input
                  ref={backgroundVideoRef}
                  type="file"
                  accept="video/*"
                  className="hidden"
                  onChange={(e) => handleVideoUpload('background', e)}
                />

                {/* Audio and Subtitle Source Selection */}
                {mainVideo && backgroundVideo && (
                  <div className="grid grid-cols-1 md:grid-cols-2 gap-6 mt-8">
                    <Card className="bg-slate-800/50 border-slate-700">
                      <CardHeader>
                        <CardTitle className="text-white text-sm flex items-center gap-2">
                          <Volume2 className="w-4 h-4" />
                          Audio Source
                        </CardTitle>
                      </CardHeader>
                      <CardContent className="space-y-3">
                        <div className="flex items-center space-x-2">
                          <Checkbox 
                            id="audio-main"
                            checked={selectedAudioSource === 'main'}
                            onCheckedChange={() => setSelectedAudioSource('main')}
                          />
                          <label htmlFor="audio-main" className="text-slate-300 text-sm">
                            Use main video audio
                          </label>
                        </div>
                        <div className="flex items-center space-x-2">
                          <Checkbox 
                            id="audio-background"
                            checked={selectedAudioSource === 'background'}
                            onCheckedChange={() => setSelectedAudioSource('background')}
                          />
                          <label htmlFor="audio-background" className="text-slate-300 text-sm">
                            Use background video audio
                          </label>
                        </div>
                      </CardContent>
                    </Card>

                    <Card className="bg-slate-800/50 border-slate-700">
                      <CardHeader>
                        <CardTitle className="text-white text-sm flex items-center gap-2">
                          <Type className="w-4 h-4" />
                          Subtitle Source
                        </CardTitle>
                      </CardHeader>
                      <CardContent className="space-y-3">
                        <div className="flex items-center space-x-2">
                          <Checkbox 
                            id="subtitle-main"
                            checked={selectedSubtitleSource === 'main'}
                            onCheckedChange={() => setSelectedSubtitleSource('main')}
                          />
                          <label htmlFor="subtitle-main" className="text-slate-300 text-sm">
                            Generate subtitles from main video
                          </label>
                        </div>
                        <div className="flex items-center space-x-2">
                          <Checkbox 
                            id="subtitle-background"
                            checked={selectedSubtitleSource === 'background'}
                            onCheckedChange={() => setSelectedSubtitleSource('background')}
                          />
                          <label htmlFor="subtitle-background" className="text-slate-300 text-sm">
                            Generate subtitles from background video
                          </label>
                        </div>
                      </CardContent>
                    </Card>
                  </div>
                )}
              </CardContent>
            </Card>
          )}

          {currentStep === 3 && (
            <Card className="bg-slate-900/50 backdrop-blur-xl border-slate-800/50 shadow-2xl">
              <CardHeader>
                <CardTitle className="text-white flex items-center gap-2">
                  <Type className="w-5 h-5" />
                  Select Subtitle Template
                </CardTitle>
                <p className="text-slate-400">Choose a subtitle style for your split-screen video</p>
              </CardHeader>
              <CardContent>
                <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
                  {subtitleTemplates.map((template) => (
                    <Card 
                      key={template.id}
                      className={`cursor-pointer transition-all hover:scale-105 ${
                        selectedTemplate === template.id 
                          ? 'ring-2 ring-purple-500 bg-purple-500/20' 
                          : 'bg-slate-800/50 hover:bg-slate-700/50'
                      }`}
                      onClick={() => setSelectedTemplate(template.id)}
                    >
                      <CardContent className="p-4">
                        <div className="aspect-square bg-slate-900 rounded-lg flex items-center justify-center mb-3">
                          <span 
                            className="text-2xl font-bold"
                            style={{
                              color: template.style.textColor,
                              fontFamily: template.style.fontFamily,
                              fontWeight: template.style.fontWeight,
                              textShadow: `0 0 ${template.style.shadowBlur}px ${template.style.shadowColor}`
                            }}
                          >
                            {template.preview}
                          </span>
                        </div>
                        <p className="text-white text-sm font-medium text-center">{template.name}</p>
                      </CardContent>
                    </Card>
                  ))}
                </div>
              </CardContent>
            </Card>
          )}
        </div>

        {/* Navigation */}
        <div className="flex justify-between items-center mt-8 max-w-4xl mx-auto">
          <Button
            variant="outline"
            onClick={() => setCurrentStep(Math.max(1, currentStep - 1))}
            disabled={currentStep === 1}
            className="border-slate-600 text-slate-300 hover:bg-slate-700"
          >
            <ChevronLeft className="w-4 h-4 mr-2" />
            Previous
          </Button>

          {currentStep < 3 ? (
            <Button
              onClick={() => setCurrentStep(currentStep + 1)}
              disabled={!canProceed()}
              className="bg-purple-600 hover:bg-purple-700 text-white"
            >
              Next
              <ArrowRight className="w-4 h-4 ml-2" />
            </Button>
          ) : (
            <Button
              onClick={handleGenerate}
              disabled={processing || !canProceed()}
              className="bg-gradient-to-r from-purple-600 to-pink-600 hover:from-purple-700 hover:to-pink-700 text-white"
            >
              {processing ? (
                <>
                  <Sparkles className="w-4 h-4 mr-2 animate-spin" />
                  Generating...
                </>
              ) : (
                <>
                  Generate Split-Screen
                  <Sparkles className="w-4 h-4 ml-2" />
                </>
              )}
            </Button>
          )}
        </div>
      </div>
    </div>
  );
}

export default SplitScreenGenerator;