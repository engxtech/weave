import { useState, useCallback, useRef, useEffect } from 'react';
import { Upload, Film, Sparkles, Palette, MapPin, Plus, Wand2, Download, Loader2, Image, ImagePlus, Video, Clock, Play, Check, Youtube, FileVideo, Save, FolderOpen, ChevronRight, Layers } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Card } from '@/components/ui/card';
import { Textarea } from '@/components/ui/textarea';
import { Input } from '@/components/ui/input';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Accordion, AccordionContent, AccordionItem, AccordionTrigger } from '@/components/ui/accordion';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { toast } from '@/hooks/use-toast';
import { WeaveHeader } from '@/components/WeaveHeader';
import { GalleryDialog } from '@/components/GalleryDialog';
import { nanoid } from 'nanoid';
import { useQuery, useMutation } from '@tanstack/react-query';
import { queryClient, apiRequest } from '@/lib/queryClient';

interface VisualSlot {
  type: 'subject' | 'scene' | 'style';
  imagePath?: string;
  imageUrl?: string;
  frameTime?: number;
  description?: string;
  isGenerating?: boolean;
}

interface SessionData {
  youtubeUrl: string | null;
  videoFile: string | null;
  videoAnalysis: any | null;
  subject: VisualSlot | null;
  scene: VisualSlot | null;
  style: VisualSlot | null;
  scenes: any[];
  storySequences: any[];
  generatedImages: string[];
  generatedVideos: any[];
  settings: any;
}

export function VisualRemix() {
  const [isProcessing, setIsProcessing] = useState(false);
  const [activeTab, setActiveTab] = useState('subject');
  const [showGallery, setShowGallery] = useState(false);
  
  // Session states
  const [currentSessionId, setCurrentSessionId] = useState<number | null>(null);
  const [sessionName, setSessionName] = useState('');
  const [hasUnsavedChanges, setHasUnsavedChanges] = useState(false);
  
  // Visual slots
  const [visualSlots, setVisualSlots] = useState<{
    subject?: VisualSlot;
    scene?: VisualSlot;
    style?: VisualSlot;
  }>({});
  
  // Video generation settings
  const [videoDuration, setVideoDuration] = useState<number>(16); // Default 16 seconds
  const [videoType, setVideoType] = useState<'advertisement' | 'film' | 'social'>('social');
  const [includeDialog, setIncludeDialog] = useState(false);
  const [creationMode, setCreationMode] = useState<'copy' | 'creative'>('copy');
  const [buildPurpose, setBuildPurpose] = useState(''); // What user wants to build
  
  const [promptInputs, setPromptInputs] = useState<{
    subject: string;
    scene: string;
    style: string;
  }>({
    subject: '',
    scene: '',
    style: ''
  });
  
  // YouTube analysis states
  const [youtubeUrl, setYoutubeUrl] = useState('');
  const [videoFile, setVideoFile] = useState<File | null>(null);
  const [isAnalyzingYoutube, setIsAnalyzingYoutube] = useState(false);
  const [youtubeAnalysis, setYoutubeAnalysis] = useState<any>(null);
  
  // Scene editing states
  const [scenes, setScenes] = useState<Array<{
    id: string;
    title: string;
    description: string;
    visualPrompt: string;
    camera: string;
    audio: string;
    duration: number;
    dialog?: string;
  }>>([]);
  
  // Generated images state
  const [generatedImages, setGeneratedImages] = useState<string[]>([]);
  const [selectedImageIndex, setSelectedImageIndex] = useState<number | null>(null);
  const [currentSceneIndex, setCurrentSceneIndex] = useState(0);
  const [sceneImageOptions, setSceneImageOptions] = useState<Array<{sceneId: string; images: string[]; selectedImage?: string}>>([]);
  
  // Video production states
  const [videoClips, setVideoClips] = useState<Array<{
    sceneId: string;
    url: string;
    duration: number;
  }>>([]);
  const [finalVideo, setFinalVideo] = useState<string | null>(null);
  
  // Session management
  const saveMutation = useMutation({
    mutationFn: async (data: { sessionId?: number; sessionName: string; sessionData: SessionData }) => {
      if (data.sessionId) {
        const response = await fetch(`/api/visual-remix/sessions/${data.sessionId}`, {
          method: 'PUT',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify(data),
        });
        if (!response.ok) throw new Error('Failed to update session');
        return response.json();
      } else {
        const response = await fetch('/api/visual-remix/sessions', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify(data),
        });
        if (!response.ok) throw new Error('Failed to create session');
        return response.json();
      }
    },
    onSuccess: (data) => {
      setCurrentSessionId(data.session.id);
      setHasUnsavedChanges(false);
      toast({
        title: 'Session saved',
        description: 'Your work has been saved successfully.',
      });
    },
    onError: () => {
      toast({
        title: 'Error',
        description: 'Failed to save session.',
        variant: 'destructive',
      });
    },
  });
  
  const loadSession = useCallback(async (sessionId: number) => {
    try {
      const response = await fetch(`/api/visual-remix/sessions/${sessionId}`);
      if (!response.ok) throw new Error('Failed to load session');
      const { session } = await response.json();
      
      // Restore session data
      const data = session.sessionData;
      setSessionName(session.sessionName);
      setCurrentSessionId(session.id);
      setYoutubeUrl(data.youtubeUrl || '');
      setYoutubeAnalysis(data.videoAnalysis);
      setScenes(data.scenes || []);
      setGeneratedImages(data.generatedImages || []);
      
      // Restore visual slots
      const slots: any = {};
      if (data.subject) slots.subject = data.subject;
      if (data.scene) slots.scene = data.scene;
      if (data.style) slots.style = data.style;
      setVisualSlots(slots);
      
      toast({
        title: 'Session loaded',
        description: 'Your previous work has been restored.',
      });
    } catch (error) {
      toast({
        title: 'Error',
        description: 'Failed to load session.',
        variant: 'destructive',
      });
    }
  }, []);
  
  const saveSession = useCallback(() => {
    if (!sessionName) {
      toast({
        title: 'Session name required',
        description: 'Please enter a name for your session.',
        variant: 'destructive',
      });
      return;
    }
    
    const sessionData: SessionData = {
      youtubeUrl,
      videoFile: videoFile?.name || null,
      videoAnalysis: youtubeAnalysis,
      subject: visualSlots.subject || null,
      scene: visualSlots.scene || null,
      style: visualSlots.style || null,
      scenes,
      storySequences: [],
      generatedImages,
      generatedVideos: [],
      settings: {},
    };
    
    saveMutation.mutate({
      sessionId: currentSessionId || undefined,
      sessionName,
      sessionData,
    });
  }, [sessionName, currentSessionId, youtubeUrl, videoFile, youtubeAnalysis, visualSlots, scenes, generatedImages, saveMutation]);
  
  // Track changes
  useEffect(() => {
    setHasUnsavedChanges(true);
  }, [visualSlots, youtubeUrl, videoFile, youtubeAnalysis, scenes, generatedImages]);
  
  // Generate image from prompt
  const generateFromPrompt = async (type: 'subject' | 'scene' | 'style') => {
    const prompt = promptInputs[type];
    if (!prompt.trim()) {
      toast({
        title: 'Prompt required',
        description: `Please enter a ${type} description to generate an image.`,
        variant: 'destructive',
      });
      return;
    }
    
    setVisualSlots(prev => ({
      ...prev,
      [type]: { type, isGenerating: true }
    }));
    
    try {
      const response = await fetch('/api/visual-remix/generate-from-prompt', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ type, prompt })
      });
      
      const result = await response.json();
      
      if (result.success && result.imagePath) {
        setVisualSlots(prev => ({
          ...prev,
          [type]: {
            type,
            imagePath: result.imagePath,
            imageUrl: result.imagePath.replace('temp_remix/', '/api/frames/'),
            description: prompt
          }
        }));
        
        // Add to gallery
        await fetch('/api/visual-remix/gallery', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            sessionId: currentSessionId,
            type: 'image',
            title: `${type.charAt(0).toUpperCase() + type.slice(1)} - ${prompt.slice(0, 50)}`,
            description: prompt,
            fileUrl: result.imagePath.replace('temp_remix/', '/api/frames/'),
            prompt,
            metadata: { type, generatedAt: new Date().toISOString() },
          }),
        });
      }
    } catch (error) {
      console.error('Error generating image:', error);
      toast({
        title: 'Generation failed',
        description: 'Failed to generate image. Please try again.',
        variant: 'destructive',
      });
    } finally {
      setVisualSlots(prev => ({
        ...prev,
        [type]: { ...prev[type]!, isGenerating: false }
      }));
    }
  };
  
  // Analyze YouTube video
  const analyzeYoutubeVideo = async () => {
    if (!youtubeUrl && !videoFile) {
      toast({
        title: 'Input required',
        description: 'Please provide a YouTube URL or upload a video file.',
        variant: 'destructive',
      });
      return;
    }
    
    setIsAnalyzingYoutube(true);
    
    try {
      let analysis;
      
      if (youtubeUrl) {
        const response = await fetch('/api/visual-remix/analyze-youtube', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ youtubeUrl, includeTranscript: includeDialog })
        });
        
        if (!response.ok) throw new Error('Failed to analyze video');
        analysis = await response.json();
      } else if (videoFile) {
        const formData = new FormData();
        formData.append('video', videoFile);
        formData.append('includeTranscript', includeDialog.toString());
        
        const response = await fetch('/api/visual-remix/analyze-video-file', {
          method: 'POST',
          body: formData
        });
        
        if (!response.ok) throw new Error('Failed to analyze video');
        analysis = await response.json();
      }
      
      // Transform the analysis to include analyzedScenes for compatibility
      const transformedAnalysis = {
        ...analysis,
        analyzedScenes: analysis.scenes?.map((scene: any, idx: number) => ({
          title: `Scene ${scene.sceneNumber || idx + 1}`,
          description: scene.description || '',
          visualPrompt: scene.visualElements?.join(', ') || scene.description || '',
          cameraWork: scene.visualElements?.find((e: string) => e.includes('camera')) || 'medium shot',
          audio: scene.audioElements?.join(', ') || 'ambient sound',
          dialog: scene.dialog
        })) || []
      };
      
      setYoutubeAnalysis(transformedAnalysis);
      toast({
        title: 'Analysis complete',
        description: 'Video has been analyzed successfully.',
      });
      
      // Auto-switch to scenes tab if analysis contains scenes
      if (transformedAnalysis.analyzedScenes.length > 0) {
        setActiveTab('scenes');
      }
    } catch (error) {
      console.error('Error analyzing video:', error);
      toast({
        title: 'Analysis failed',
        description: 'Failed to analyze video. Please try again.',
        variant: 'destructive',
      });
    } finally {
      setIsAnalyzingYoutube(false);
    }
  };
  
  // Generate scene from analysis
  const generateSceneFromAnalysis = async (mode: 'copy' | 'creative' = creationMode) => {
    if (!youtubeAnalysis?.analyzedScenes?.length) {
      toast({
        title: 'No analysis available',
        description: 'Please analyze a video first.',
        variant: 'destructive',
      });
      return;
    }
    
    const sceneCount = videoDuration / 8;
    
    if (mode === 'creative') {
      // Generate creative scenes based on analysis
      setIsProcessing(true);
      try {
        const response = await fetch('/api/visual-remix/generate-creative-scenes', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            analysis: youtubeAnalysis,
            sceneCount,
            videoDuration,
            videoType,
            includeDialog,
            visualSlots,
            buildPurpose
          })
        });
        
        if (!response.ok) throw new Error('Failed to generate creative scenes');
        const { scenes: creativeScenes } = await response.json();
        
        setScenes(creativeScenes.map((scene: any, idx: number) => ({
          id: nanoid(),
          title: scene.title || `Scene ${idx + 1}`,
          description: scene.description || '',
          visualPrompt: scene.visualPrompt || '',
          camera: scene.camera || 'dynamic shot',
          audio: scene.audio || 'cinematic music',
          duration: 8,
          dialog: includeDialog ? scene.dialog : undefined
        })));
        
        toast({
          title: 'Creative scenes generated',
          description: `Created ${sceneCount} enhanced scenes with 25 years of creative experience.`,
        });
      } catch (error) {
        console.error('Error generating creative scenes:', error);
        toast({
          title: 'Generation failed',
          description: 'Failed to generate creative scenes.',
          variant: 'destructive',
        });
      } finally {
        setIsProcessing(false);
      }
    } else {
      // Copy mode - generate scenes with changed characters and dialogs
      setIsProcessing(true);
      try {
        const response = await fetch('/api/visual-remix/generate-copy-scenes', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            analysis: youtubeAnalysis,
            sceneCount,
            videoDuration,
            videoType,
            includeDialog,
            visualSlots,
            buildPurpose
          })
        });
        
        if (!response.ok) throw new Error('Failed to generate copy scenes');
        const { scenes: copyScenes } = await response.json();
        
        setScenes(copyScenes.map((scene: any, idx: number) => ({
          id: nanoid(),
          title: scene.title || `Scene ${idx + 1}`,
          description: scene.description || '',
          visualPrompt: scene.visualPrompt || '',
          camera: scene.camera || 'static shot',
          audio: scene.audio || 'ambient sound',
          duration: 8,
          dialog: includeDialog ? scene.dialog : undefined
        })));
        
        toast({
          title: 'Copy scenes generated',
          description: `Created ${sceneCount} scenes with transformed characters and dialogs.`,
        });
      } catch (error) {
        console.error('Error generating copy scenes:', error);
        toast({
          title: 'Generation failed',
          description: 'Failed to generate copy scenes.',
          variant: 'destructive',
        });
      } finally {
        setIsProcessing(false);
      }
    }
    
    setActiveTab('scenes');
    setHasUnsavedChanges(true);
  };
  
  // Enhance scene with AI
  const enhanceScene = async (sceneId: string) => {
    const scene = scenes.find(s => s.id === sceneId);
    if (!scene) return;
    
    setIsProcessing(true);
    try {
      const response = await fetch('/api/visual-remix/enhance-scene', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ 
          scene,
          allScenes: scenes,
          includeDialog,
          visualSlots 
        })
      });
      
      if (!response.ok) throw new Error('Failed to enhance scene');
      const { enhancedScene } = await response.json();
      
      setScenes(prev => prev.map(s => 
        s.id === sceneId ? { ...enhancedScene, id: sceneId } : s
      ));
      
      setHasUnsavedChanges(true);
      
      toast({
        title: 'Scene enhanced',
        description: 'AI has improved the scene details.',
      });
    } catch (error) {
      toast({
        title: 'Enhancement failed',
        description: 'Failed to enhance scene.',
        variant: 'destructive',
      });
    } finally {
      setIsProcessing(false);
    }
  };
  
  // Generate 3 images for current scene
  const generateImagesForCurrentScene = async () => {
    if (currentSceneIndex >= scenes.length) {
      toast({
        title: 'All scenes processed',
        description: 'You have generated images for all scenes.',
      });
      return;
    }
    
    setIsProcessing(true);
    const currentScene = scenes[currentSceneIndex];
    
    try {
      // Generate 3 variations
      const images = [];
      for (let i = 0; i < 3; i++) {
        const response = await fetch('/api/visual-remix/generate-scene-images', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ 
            scenes: [currentScene],
            style: visualSlots.style?.description || '',
            subject: visualSlots.subject?.description || '',
            scene: visualSlots.scene?.description || '',
            variation: i + 1
          })
        });
        
        if (!response.ok) throw new Error('Failed to generate image');
        const { images: generatedImages } = await response.json();
        images.push(generatedImages[0]);
      }
      
      // Store the options for this scene
      setSceneImageOptions(prev => [
        ...prev,
        { sceneId: currentScene.id, images }
      ]);
      
      toast({
        title: 'Images generated',
        description: `Generated 3 variations for scene ${currentSceneIndex + 1}. Select one to continue.`,
      });
    } catch (error) {
      toast({
        title: 'Generation failed',
        description: 'Failed to generate images.',
        variant: 'destructive',
      });
    } finally {
      setIsProcessing(false);
    }
  };
  
  // Select image and move to next scene
  const selectImageAndContinue = (imageUrl: string) => {
    // Update selected image for current scene
    setSceneImageOptions(prev => prev.map((opt, idx) => 
      idx === currentSceneIndex 
        ? { ...opt, selectedImage: imageUrl }
        : opt
    ));
    
    // Add to final images list
    setGeneratedImages(prev => [...prev, imageUrl]);
    
    // Move to next scene
    if (currentSceneIndex < scenes.length - 1) {
      setCurrentSceneIndex(prev => prev + 1);
    } else {
      toast({
        title: 'All scenes complete!',
        description: 'You can now generate video clips.',
      });
    }
  };
  
  // Generate images from scenes (legacy function for scene tab button)
  const generateImagesFromScenes = async () => {
    setActiveTab('images');
    await generateImagesForCurrentScene();
  };
  
  // Generate video clips from images
  const generateVideoClips = async () => {
    if (generatedImages.length === 0) {
      toast({
        title: 'No images available',
        description: 'Please generate images first.',
        variant: 'destructive',
      });
      return;
    }
    
    setIsProcessing(true);
    
    try {
      const response = await fetch('/api/visual-remix/generate-video-clips', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ 
          scenes,
          images: generatedImages
        })
      });
      
      if (!response.ok) throw new Error('Failed to generate video clips');
      const { videoClips: clips } = await response.json();
      
      setVideoClips(clips);
      setHasUnsavedChanges(true);
      
      toast({
        title: 'Video clips generated',
        description: `Generated ${clips.length} video clips.`,
      });
    } catch (error) {
      toast({
        title: 'Generation failed',
        description: 'Failed to generate video clips.',
        variant: 'destructive',
      });
    } finally {
      setIsProcessing(false);
    }
  };
  
  // Merge video clips into final video
  const mergeVideos = async () => {
    if (videoClips.length === 0) {
      toast({
        title: 'No video clips available',
        description: 'Please generate video clips first.',
        variant: 'destructive',
      });
      return;
    }
    
    setIsProcessing(true);
    
    try {
      const response = await fetch('/api/visual-remix/merge-videos', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ 
          videoClips,
          includeAudio: includeDialog
        })
      });
      
      if (!response.ok) throw new Error('Failed to merge videos');
      const { finalVideo: video, duration } = await response.json();
      
      setFinalVideo(video);
      setHasUnsavedChanges(true);
      
      toast({
        title: 'Final video created!',
        description: `Created ${duration} second video.`,
      });
    } catch (error) {
      toast({
        title: 'Merge failed',
        description: 'Failed to merge video clips.',
        variant: 'destructive',
      });
    } finally {
      setIsProcessing(false);
    }
  };
  
  return (
    <div className="min-h-screen bg-slate-950">
      <WeaveHeader showGallery={true} onGalleryClick={() => setShowGallery(true)} />
      
      <div className="container mx-auto px-4 py-8">
        {/* Session Bar */}
        <div className="mb-6 flex items-center justify-between gap-4">
          <div className="flex items-center gap-4 flex-1">
            <Input
              placeholder="Session name..."
              value={sessionName}
              onChange={(e) => setSessionName(e.target.value)}
              className="max-w-xs bg-slate-900/50 border-slate-700"
            />
            <Button
              onClick={saveSession}
              disabled={saveMutation.isPending}
              variant="outline"
              size="sm"
              className={hasUnsavedChanges ? 'border-orange-500 text-orange-500' : ''}
            >
              <Save className="w-4 h-4 mr-2" />
              {saveMutation.isPending ? 'Saving...' : hasUnsavedChanges ? 'Save Changes' : 'Saved'}
            </Button>
          </div>
          <Button
            variant="outline"
            size="sm"
            onClick={() => {
              // TODO: Show session picker dialog
              toast({
                title: 'Coming soon',
                description: 'Session picker will be available soon.',
              });
            }}
          >
            <FolderOpen className="w-4 h-4 mr-2" />
            Load Session
          </Button>
        </div>
        
        {/* Main Content Tabs */}
        <Tabs value={activeTab} onValueChange={setActiveTab} className="space-y-6">
          <TabsList className="grid grid-cols-4 w-full max-w-2xl mx-auto bg-slate-900/50">
            <TabsTrigger value="subject" className="data-[state=active]:bg-purple-600">
              <Upload className="w-4 h-4 mr-2" />
              Subject
            </TabsTrigger>
            <TabsTrigger value="youtube" className="data-[state=active]:bg-purple-600">
              <Youtube className="w-4 h-4 mr-2" />
              Analysis
            </TabsTrigger>
            <TabsTrigger value="scenes" className="data-[state=active]:bg-purple-600">
              <Film className="w-4 h-4 mr-2" />
              Scenes
            </TabsTrigger>
            <TabsTrigger value="images" className="data-[state=active]:bg-purple-600">
              <Layers className="w-4 h-4 mr-2" />
              Production
            </TabsTrigger>
          </TabsList>
          
          {/* Subject Upload/Generation Tab */}
          <TabsContent value="subject">
            <Card className="bg-slate-900/50 backdrop-blur-xl border-purple-500/20 p-6">
              <h2 className="text-2xl font-bold text-white mb-6">Visual Inputs & Settings</h2>
              
              {/* Video Settings Section */}
              <div className="bg-slate-800/50 rounded-lg p-4 mb-6">
                <h3 className="text-lg font-medium text-white mb-4">Video Settings</h3>
                
                <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                  {/* Video Duration */}
                  <div>
                    <label className="text-sm font-medium text-slate-300 mb-2 block">
                      Video Duration (seconds)
                    </label>
                    <Select value={videoDuration.toString()} onValueChange={(value) => setVideoDuration(parseInt(value))}>
                      <SelectTrigger className="bg-slate-900/50 border-slate-700">
                        <SelectValue />
                      </SelectTrigger>
                      <SelectContent>
                        <SelectItem value="8">8 seconds (1 scene)</SelectItem>
                        <SelectItem value="16">16 seconds (2 scenes)</SelectItem>
                        <SelectItem value="24">24 seconds (3 scenes)</SelectItem>
                        <SelectItem value="32">32 seconds (4 scenes)</SelectItem>
                        <SelectItem value="40">40 seconds (5 scenes)</SelectItem>
                        <SelectItem value="48">48 seconds (6 scenes)</SelectItem>
                        <SelectItem value="56">56 seconds (7 scenes)</SelectItem>
                        <SelectItem value="64">64 seconds (8 scenes)</SelectItem>
                      </SelectContent>
                    </Select>
                  </div>
                  
                  {/* Video Type */}
                  <div>
                    <label className="text-sm font-medium text-slate-300 mb-2 block">
                      Video Type
                    </label>
                    <Select value={videoType} onValueChange={(value: any) => setVideoType(value)}>
                      <SelectTrigger className="bg-slate-900/50 border-slate-700">
                        <SelectValue />
                      </SelectTrigger>
                      <SelectContent>
                        <SelectItem value="advertisement">Advertisement</SelectItem>
                        <SelectItem value="film">Film</SelectItem>
                        <SelectItem value="social">Social Media (9:16)</SelectItem>
                      </SelectContent>
                    </Select>
                  </div>
                  
                  {/* Dialog Option */}
                  <div>
                    <label className="text-sm font-medium text-slate-300 mb-2 block">
                      Include Dialog/Voiceover
                    </label>
                    <Button
                      variant={includeDialog ? "default" : "outline"}
                      onClick={() => setIncludeDialog(!includeDialog)}
                      className={includeDialog ? "w-full bg-purple-600" : "w-full"}
                    >
                      {includeDialog ? (
                        <>
                          <Check className="w-4 h-4 mr-2" />
                          Dialog Enabled
                        </>
                      ) : (
                        <>
                          <Film className="w-4 h-4 mr-2" />
                          Dialog Disabled
                        </>
                      )}
                    </Button>
                  </div>
                </div>
              </div>
              
              {/* Build Purpose */}
              <div className="bg-slate-800/50 rounded-lg p-4 mb-6">
                <h3 className="text-lg font-medium text-white mb-4">What do you want to build?</h3>
                <Input
                  placeholder="e.g., Hotel advertisement, Product showcase, Brand story..."
                  value={buildPurpose}
                  onChange={(e) => setBuildPurpose(e.target.value)}
                  className="bg-slate-900 border-slate-700"
                />
                <p className="text-xs text-slate-400 mt-2">
                  Describe your video goal to help AI create the perfect story
                </p>
              </div>
              
              <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
                {['subject', 'scene', 'style'].map((type) => (
                  <div key={type} className="space-y-4">
                    <h3 className="text-lg font-medium text-white capitalize">{type}</h3>
                    
                    <div className="aspect-square bg-slate-800/50 rounded-lg border-2 border-dashed border-slate-700 relative overflow-hidden">
                      {visualSlots[type as keyof typeof visualSlots]?.imageUrl ? (
                        <img
                          src={visualSlots[type as keyof typeof visualSlots]!.imageUrl}
                          alt={type}
                          className="w-full h-full object-cover"
                        />
                      ) : (
                        <div className="flex items-center justify-center h-full">
                          <div className="text-center">
                            <Image className="w-12 h-12 text-slate-600 mx-auto mb-2" />
                            <p className="text-sm text-slate-500">No image yet</p>
                          </div>
                        </div>
                      )}
                      
                      {visualSlots[type as keyof typeof visualSlots]?.isGenerating && (
                        <div className="absolute inset-0 bg-black/60 flex items-center justify-center">
                          <Loader2 className="w-8 h-8 text-white animate-spin" />
                        </div>
                      )}
                    </div>
                    
                    {/* Image Upload */}
                    <div>
                      <input
                        type="file"
                        accept="image/*"
                        onChange={(e) => {
                          const file = e.target.files?.[0];
                          if (file) {
                            const reader = new FileReader();
                            reader.onload = (event) => {
                              setVisualSlots(prev => ({
                                ...prev,
                                [type]: {
                                  type: type as 'subject' | 'scene' | 'style',
                                  imageUrl: event.target?.result as string,
                                  description: `Uploaded ${type} image`
                                }
                              }));
                              setHasUnsavedChanges(true);
                            };
                            reader.readAsDataURL(file);
                          }
                        }}
                        className="hidden"
                        id={`${type}-upload`}
                      />
                      <label
                        htmlFor={`${type}-upload`}
                        className="flex items-center justify-center gap-2 px-4 py-2 bg-slate-800/50 border border-slate-700 rounded-md cursor-pointer hover:bg-slate-800/80 w-full"
                      >
                        <Upload className="w-4 h-4" />
                        Upload Image
                      </label>
                    </div>
                    
                    <Textarea
                      placeholder={`Describe the ${type}...`}
                      value={promptInputs[type as keyof typeof promptInputs]}
                      onChange={(e) => setPromptInputs(prev => ({ ...prev, [type]: e.target.value }))}
                      className="bg-slate-800/50 border-slate-700"
                      rows={3}
                    />
                    
                    <Button
                      onClick={() => generateFromPrompt(type as 'subject' | 'scene' | 'style')}
                      disabled={visualSlots[type as keyof typeof visualSlots]?.isGenerating}
                      className="w-full bg-gradient-to-r from-purple-600 to-pink-600"
                    >
                      <Sparkles className="w-4 h-4 mr-2" />
                      Generate {type}
                    </Button>
                  </div>
                ))}
              </div>
            </Card>
          </TabsContent>
          
          {/* YouTube Analysis Tab */}
          <TabsContent value="youtube">
            <Card className="bg-slate-900/50 backdrop-blur-xl border-purple-500/20 p-6">
              <h2 className="text-2xl font-bold text-white mb-6">Video Analysis</h2>
              
              <div className="space-y-6">
                {/* Input Section */}
                <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                  <div>
                    <label className="text-sm font-medium text-slate-300 mb-2 block">
                      YouTube URL
                    </label>
                    <div className="flex gap-2">
                      <Input
                        placeholder="https://youtube.com/watch?v=..."
                        value={youtubeUrl}
                        onChange={(e) => setYoutubeUrl(e.target.value)}
                        className="flex-1 bg-slate-800/50 border-slate-700"
                      />
                    </div>
                  </div>
                  
                  <div>
                    <label className="text-sm font-medium text-slate-300 mb-2 block">
                      Or Upload Video
                    </label>
                    <input
                      type="file"
                      accept="video/*"
                      onChange={(e) => setVideoFile(e.target.files?.[0] || null)}
                      className="hidden"
                      id="video-upload"
                    />
                    <label
                      htmlFor="video-upload"
                      className="flex items-center justify-center gap-2 px-4 py-2 bg-slate-800/50 border border-slate-700 rounded-md cursor-pointer hover:bg-slate-800/80"
                    >
                      <FileVideo className="w-4 h-4" />
                      {videoFile ? videoFile.name : 'Choose file'}
                    </label>
                  </div>
                </div>
                
                <Button
                  onClick={analyzeYoutubeVideo}
                  disabled={(!youtubeUrl && !videoFile) || isAnalyzingYoutube}
                  className="w-full bg-gradient-to-r from-purple-600 to-pink-600"
                >
                  {isAnalyzingYoutube ? (
                    <>
                      <Loader2 className="w-4 h-4 mr-2 animate-spin" />
                      Analyzing...
                    </>
                  ) : (
                    <>
                      <Sparkles className="w-4 h-4 mr-2" />
                      Analyze Video
                    </>
                  )}
                </Button>
                
                {/* Analysis Results */}
                {youtubeAnalysis && (
                  <div className="space-y-6 mt-6">
                    <h3 className="text-lg font-medium text-white mb-4">Detailed Video Analysis</h3>
                    
                    {/* Story Overview */}
                    {youtubeAnalysis.storyOverview && (
                      <div className="bg-slate-800/50 rounded-lg p-4">
                        <h4 className="font-medium text-purple-400 mb-2">Story Overview</h4>
                        <p className="text-sm text-slate-300 mb-2">{youtubeAnalysis.storyOverview.synopsis}</p>
                        <div className="grid grid-cols-2 gap-2 text-sm">
                          <div>
                            <span className="text-slate-400">Genre:</span>
                            <span className="ml-2 text-slate-200">{youtubeAnalysis.storyOverview.genre || 'N/A'}</span>
                          </div>
                          <div>
                            <span className="text-slate-400">Mood:</span>
                            <span className="ml-2 text-slate-200">{youtubeAnalysis.storyOverview.mood || 'N/A'}</span>
                          </div>
                        </div>
                      </div>
                    )}
                    
                    {/* Technical Analysis */}
                    {youtubeAnalysis.technicalAnalysis && (
                      <div className="bg-slate-800/50 rounded-lg p-4">
                        <h4 className="font-medium text-purple-400 mb-3">Technical Analysis</h4>
                        <div className="space-y-3">
                          <div>
                            <span className="text-slate-400 text-sm">Camera Techniques:</span>
                            <div className="flex flex-wrap gap-2 mt-1">
                              {youtubeAnalysis.technicalAnalysis.cinematography?.map((technique: string, idx: number) => (
                                <span key={idx} className="px-2 py-1 bg-purple-900/30 text-purple-300 rounded-md text-xs">
                                  {technique}
                                </span>
                              ))}
                            </div>
                          </div>
                          <div>
                            <span className="text-slate-400 text-sm">Color Grading:</span>
                            <p className="text-slate-200 text-sm mt-1">{youtubeAnalysis.technicalAnalysis.colorGrading}</p>
                          </div>
                          <div>
                            <span className="text-slate-400 text-sm">Sound Design:</span>
                            <p className="text-slate-200 text-sm mt-1">{youtubeAnalysis.technicalAnalysis.soundDesign}</p>
                          </div>
                        </div>
                      </div>
                    )}
                    
                    {/* Characters Analysis */}
                    {youtubeAnalysis.characters && youtubeAnalysis.characters.length > 0 && (
                      <div className="bg-slate-800/50 rounded-lg p-4">
                        <h4 className="font-medium text-purple-400 mb-3">Characters ({youtubeAnalysis.characters.length} people)</h4>
                        <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
                          {youtubeAnalysis.characters.map((character: any, idx: number) => (
                            <div key={idx} className="bg-slate-900/50 rounded-lg p-3">
                              <h5 className="font-medium text-slate-200">{character.name || `Character ${idx + 1}`}</h5>
                              <p className="text-xs text-slate-400 mt-1">{character.description}</p>
                              {character.development && (
                                <p className="text-xs text-purple-400 mt-2">Arc: {character.development}</p>
                              )}
                            </div>
                          ))}
                        </div>
                      </div>
                    )}
                    
                    {/* Dialog/Transcript */}
                    {youtubeAnalysis.dialogScript && youtubeAnalysis.dialogScript.formatted && (
                      <div className="bg-slate-800/50 rounded-lg p-4">
                        <h4 className="font-medium text-purple-400 mb-3">Dialog/Transcript</h4>
                        <div className="bg-slate-900/50 rounded-lg p-3 max-h-48 overflow-y-auto">
                          <pre className="text-xs text-slate-300 whitespace-pre-wrap font-mono">
                            {youtubeAnalysis.dialogScript.formatted}
                          </pre>
                        </div>
                        {youtubeAnalysis.dialogScript.speakerList && (
                          <div className="mt-2">
                            <span className="text-xs text-slate-400">Speakers: </span>
                            <span className="text-xs text-slate-300">
                              {youtubeAnalysis.dialogScript.speakerList.join(', ')}
                            </span>
                          </div>
                        )}
                      </div>
                    )}
                    
                    {/* Scenes Breakdown */}
                    {youtubeAnalysis.analyzedScenes && youtubeAnalysis.analyzedScenes.length > 0 && (
                      <div className="bg-slate-800/50 rounded-lg p-4">
                        <div className="flex items-center justify-between mb-3">
                          <h4 className="font-medium text-purple-400">
                            Scene Breakdown ({youtubeAnalysis.analyzedScenes.length} scenes)
                          </h4>
                        </div>
                        
                        <div className="space-y-2 mb-4 max-h-64 overflow-y-auto">
                          {youtubeAnalysis.analyzedScenes.map((scene: any, idx: number) => (
                            <div key={idx} className="bg-slate-900/50 rounded-lg p-3">
                              <div className="flex items-start justify-between">
                                <div className="flex-1">
                                  <h5 className="font-medium text-slate-200 text-sm">{scene.title}</h5>
                                  <p className="text-xs text-slate-400 mt-1">{scene.description}</p>
                                  {scene.cameraWork && (
                                    <p className="text-xs text-purple-400 mt-1">Camera: {scene.cameraWork}</p>
                                  )}
                                </div>
                              </div>
                            </div>
                          ))}
                        </div>
                        
                        {/* Action Buttons */}
                        <div className="flex gap-4 pt-4 border-t border-slate-700">
                          <div className="flex-1">
                            <h5 className="text-sm font-medium text-slate-300 mb-2">Creation Mode</h5>
                            <div className="flex gap-2">
                              <Button
                                onClick={() => {
                                  setCreationMode('copy');
                                  generateSceneFromAnalysis('copy');
                                }}
                                size="sm"
                                className="flex-1 bg-purple-600 hover:bg-purple-700"
                              >
                                <Film className="w-4 h-4 mr-2" />
                                Copy Mode
                              </Button>
                              <Button
                                onClick={() => {
                                  setCreationMode('creative');
                                  generateSceneFromAnalysis('creative');
                                }}
                                size="sm"
                                className="flex-1 bg-gradient-to-r from-purple-600 to-pink-600"
                              >
                                <Sparkles className="w-4 h-4 mr-2" />
                                Creative Mode
                              </Button>
                            </div>
                            <p className="text-xs text-slate-400 mt-2">
                              Copy: Similar to original • Creative: Enhanced with 25 years experience
                            </p>
                          </div>
                        </div>
                      </div>
                    )}
                  </div>
                )}
              </div>
            </Card>
          </TabsContent>
          
          {/* Scenes Tab */}
          <TabsContent value="scenes">
            <Card className="bg-slate-900/50 backdrop-blur-xl border-purple-500/20 p-6">
              <h2 className="text-2xl font-bold text-white mb-6">Scene Editor</h2>
              
              {scenes.length === 0 ? (
                <div className="text-center py-12">
                  <Film className="w-12 h-12 text-slate-600 mx-auto mb-4" />
                  <p className="text-slate-500">No scenes yet. Analyze a video to get started.</p>
                </div>
              ) : (
                <div className="grid gap-4 max-h-[600px] overflow-y-auto pr-2">
                  {scenes.map((scene, idx) => (
                    <div key={scene.id} className="bg-slate-800/50 rounded-lg p-5 border border-slate-700 hover:border-purple-500/50 transition-colors">
                      <div className="flex items-start gap-4">
                        <div className="flex-1 space-y-4">
                          {/* Scene Header */}
                          <div className="flex items-center gap-3">
                            <span className="flex items-center justify-center w-8 h-8 bg-purple-600 rounded-full text-sm font-bold">
                              {idx + 1}
                            </span>
                            <h3 className="text-lg font-semibold text-white flex-1">{scene.title}</h3>
                            <span className="text-xs text-slate-400">8 seconds</span>
                          </div>
                          
                          {/* Scene Details Card */}
                          <div className="space-y-4 bg-slate-900/30 rounded-lg p-4">
                            <div>
                              <h4 className="text-sm font-medium text-purple-300 mb-1">Story Headline</h4>
                              <p className="text-sm text-white">{scene.title}</p>
                            </div>
                            
                            <div>
                              <h4 className="text-sm font-medium text-purple-300 mb-1">Description</h4>
                              <p className="text-sm text-slate-300">{scene.description || 'No description provided'}</p>
                            </div>
                            
                            <div>
                              <h4 className="text-sm font-medium text-purple-300 mb-1">Visual Prompt</h4>
                              <p className="text-sm text-slate-300">{scene.visualPrompt || 'No visual prompt provided'}</p>
                            </div>
                            
                            <div className="grid grid-cols-2 gap-4">
                              <div>
                                <h4 className="text-sm font-medium text-purple-300 mb-1">Camera Angle</h4>
                                <p className="text-sm text-slate-300">{scene.camera || 'Not specified'}</p>
                              </div>
                              <div>
                                <h4 className="text-sm font-medium text-purple-300 mb-1">Audio</h4>
                                <p className="text-sm text-slate-300">{scene.audio || 'Not specified'}</p>
                              </div>
                            </div>
                            
                            {scene.dialog && (
                              <div>
                                <h4 className="text-sm font-medium text-purple-300 mb-1">Dialog & Voiceover</h4>
                                <p className="text-sm text-slate-300">{scene.dialog}</p>
                              </div>
                            )}
                          </div>
                          
                          {/* Action Button */}
                          <div className="flex justify-end">
                            <Button
                              onClick={() => enhanceScene(scene.id)}
                              size="sm"
                              variant="outline"
                              className="whitespace-nowrap"
                            >
                              <Wand2 className="w-4 h-4 mr-2" />
                              AI Enhance
                            </Button>
                          </div>
                        </div>
                      </div>
                    </div>
                  ))}
                  
                  <Button
                    onClick={generateImagesFromScenes}
                    disabled={isProcessing || scenes.length === 0}
                    className="w-full bg-gradient-to-r from-purple-600 to-pink-600"
                  >
                    <Image className="w-4 h-4 mr-2" />
                    Generate Images from Scenes
                  </Button>
                </div>
              )}
            </Card>
          </TabsContent>


          
          {/* Final Production Tab */}
          <TabsContent value="images">
            <Card className="bg-slate-900/50 backdrop-blur-xl border-purple-500/20 p-6">
              <h2 className="text-2xl font-bold text-white mb-6">Final Production</h2>
              
              <div className="space-y-8">
                {/* Step 1: Generate Images */}
                <div className="space-y-4">
                  <div className="flex items-center gap-3">
                    <div className={`flex items-center justify-center w-8 h-8 rounded-full text-sm font-bold ${
                      currentSceneIndex > 0 || sceneImageOptions.length > 0 ? 'bg-purple-600' : 'bg-purple-600'
                    }`}>
                      1
                    </div>
                    <h3 className="text-lg font-semibold text-white">Select Reference Images</h3>
                  </div>
                  
                  {scenes.length === 0 ? (
                    <p className="text-slate-400 text-sm">Create scenes first in the Scenes tab.</p>
                  ) : (
                    <div className="space-y-4">
                      {/* Progress */}
                      <div className="flex items-center justify-between text-sm text-slate-400">
                        <span>Scene {currentSceneIndex + 1} of {scenes.length}</span>
                        <span>{generatedImages.length} images selected</span>
                      </div>
                      
                      {/* Current Scene */}
                      {currentSceneIndex < scenes.length && (
                        <div className="bg-slate-800/50 rounded-lg p-3">
                          <h4 className="font-medium text-white mb-1">
                            {scenes[currentSceneIndex].title}
                          </h4>
                          <p className="text-sm text-slate-300">
                            {scenes[currentSceneIndex].description}
                          </p>
                        </div>
                      )}
                      
                      {/* Image Options */}
                      {sceneImageOptions[currentSceneIndex] ? (
                        <div>
                          <p className="text-sm text-slate-400 mb-3">Select one image to continue:</p>
                          <div className="grid grid-cols-3 gap-3">
                            {sceneImageOptions[currentSceneIndex].images.map((image, idx) => (
                              <div
                                key={idx}
                                className="relative aspect-video rounded-lg overflow-hidden cursor-pointer transition-all hover:scale-105 ring-2 ring-transparent hover:ring-purple-500"
                                onClick={() => selectImageAndContinue(image)}
                              >
                                <img
                                  src={image}
                                  alt={`Option ${idx + 1}`}
                                  className="w-full h-full object-cover"
                                />
                                <div className="absolute bottom-0 left-0 right-0 bg-gradient-to-t from-black/80 to-transparent p-2">
                                  <span className="text-xs text-white">Option {idx + 1}</span>
                                </div>
                              </div>
                            ))}
                          </div>
                        </div>
                      ) : currentSceneIndex >= scenes.length ? (
                        <div className="bg-green-500/10 border border-green-500/20 rounded-lg p-4">
                          <div className="flex items-center gap-2 text-green-400">
                            <Check className="w-5 h-5" />
                            <span className="font-medium">All images selected!</span>
                          </div>
                        </div>
                      ) : (
                        <Button
                          onClick={generateImagesForCurrentScene}
                          disabled={isProcessing}
                          className="w-full bg-gradient-to-r from-purple-600 to-pink-600"
                        >
                          <Image className="w-4 h-4 mr-2" />
                          Generate 3 Image Options
                        </Button>
                      )}
                      
                      {/* Selected Images Preview */}
                      {generatedImages.length > 0 && (
                        <div className="border-t border-slate-700 pt-4">
                          <p className="text-sm text-slate-400 mb-2">Selected images:</p>
                          <div className="grid grid-cols-4 gap-2">
                            {generatedImages.map((image, idx) => (
                              <div key={idx} className="relative aspect-video rounded overflow-hidden">
                                <img
                                  src={image}
                                  alt={`Selected ${idx + 1}`}
                                  className="w-full h-full object-cover"
                                />
                                <div className="absolute inset-0 bg-black/40 flex items-center justify-center">
                                  <span className="text-xs text-white font-medium">Scene {idx + 1}</span>
                                </div>
                              </div>
                            ))}
                          </div>
                        </div>
                      )}
                    </div>
                  )}
                </div>
                
                {/* Step 2: Generate Video Clips */}
                <div className="space-y-4">
                  <div className="flex items-center gap-3">
                    <div className={`flex items-center justify-center w-8 h-8 rounded-full text-sm font-bold ${
                      generatedImages.length > 0 ? 'bg-purple-600' : 'bg-slate-700'
                    }`}>
                      2
                    </div>
                    <h3 className="text-lg font-semibold text-white">Generate 8-Second Video Clips</h3>
                  </div>
                  
                  {videoClips.length === 0 ? (
                    <Button
                      onClick={generateVideoClips}
                      disabled={isProcessing || generatedImages.length === 0}
                      className="w-full"
                      variant={generatedImages.length > 0 ? "default" : "outline"}
                    >
                      <Video className="w-4 h-4 mr-2" />
                      Generate Video Clips
                    </Button>
                  ) : (
                    <div>
                      <div className="grid grid-cols-2 md:grid-cols-3 gap-4 mb-4">
                        {videoClips.map((clip, idx) => (
                          <div key={idx} className="bg-slate-800 rounded-lg p-3">
                            <div className="flex items-center justify-between mb-2">
                              <span className="text-sm text-white">Clip {idx + 1}</span>
                              <span className="text-xs text-slate-400">8 seconds</span>
                            </div>
                            <div className="flex items-center gap-2">
                              <Video className="w-4 h-4 text-purple-400" />
                              <span className="text-xs text-slate-300">Ready</span>
                            </div>
                          </div>
                        ))}
                      </div>
                      <Button
                        onClick={generateVideoClips}
                        variant="outline"
                        className="w-full"
                      >
                        Regenerate Video Clips
                      </Button>
                    </div>
                  )}
                </div>
                
                {/* Step 3: Merge Videos */}
                <div className="space-y-4">
                  <div className="flex items-center gap-3">
                    <div className={`flex items-center justify-center w-8 h-8 rounded-full text-sm font-bold ${
                      videoClips.length > 0 ? 'bg-purple-600' : 'bg-slate-700'
                    }`}>
                      3
                    </div>
                    <h3 className="text-lg font-semibold text-white">Merge into Final Video</h3>
                  </div>
                  
                  {!finalVideo ? (
                    <Button
                      onClick={mergeVideos}
                      disabled={isProcessing || videoClips.length === 0}
                      className="w-full"
                      variant={videoClips.length > 0 ? "default" : "outline"}
                    >
                      <Layers className="w-4 h-4 mr-2" />
                      Merge All Clips
                    </Button>
                  ) : (
                    <div className="space-y-4">
                      <div className="bg-gradient-to-r from-purple-600/20 to-pink-600/20 rounded-lg p-6">
                        <div className="flex items-center justify-between mb-4">
                          <h4 className="text-lg font-semibold text-white">Final Video Ready!</h4>
                          <span className="text-sm text-purple-300">{videoClips.length * 8} seconds</span>
                        </div>
                        <video
                          src={finalVideo}
                          controls
                          className="w-full rounded-lg mb-4"
                        />
                        <div className="flex gap-2">
                          <a
                            href={finalVideo}
                            download="final_video.mp4"
                            className="flex-1 bg-purple-600 hover:bg-purple-700 text-white rounded-lg px-4 py-2 flex items-center justify-center"
                          >
                            <Download className="w-4 h-4 mr-2" />
                            Download Video
                          </a>
                          <Button
                            onClick={mergeVideos}
                            variant="outline"
                            className="flex-1"
                          >
                            Create New Version
                          </Button>
                        </div>
                      </div>
                    </div>
                  )}
                </div>
              </div>
            </Card>
          </TabsContent>
        </Tabs>
      </div>
      
      <GalleryDialog
        open={showGallery}
        onOpenChange={setShowGallery}
        onSelectItem={(item) => {
          // Handle selecting item from gallery
          if (item.type === 'image') {
            // Could restore to a visual slot
            toast({
              title: 'Item selected',
              description: `Selected ${item.title} from gallery.`,
            });
          }
          setShowGallery(false);
        }}
      />
    </div>
  );
}