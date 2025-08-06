import { useState } from "react";
import { Card } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Textarea } from "@/components/ui/textarea";
import { Accordion, AccordionContent, AccordionItem, AccordionTrigger } from "@/components/ui/accordion";
import { useToast } from "@/hooks/use-toast";
import { Loader2, Sparkles, Video, Wand2, Film, ChevronRight, Youtube, ChevronDown, RefreshCw, CheckCircle, Download, Upload } from "lucide-react";
import { AppHeader } from "@/components/app-header";
import { cn } from "@/lib/utils";

interface AIEnhancedPrompt {
  original: string;
  enhanced: string;
  suggestions: string[];
  videoType: 'ad' | 'movie' | 'social';
}

interface Scene {
  id: string;
  number: number;
  duration: number; // Always 8 seconds
  title: string;
  description: string;
  visualPrompt: string;
  audioPrompt: string;
  cameraMovement: string;
  transition: string;
  dialog?: string; // Optional dialog/voiceover
}

export function VisualRemixSimple() {
  const { toast } = useToast();
  
  // Core states
  const [userInput, setUserInput] = useState('');
  const [isProcessing, setIsProcessing] = useState(false);
  const [currentStep, setCurrentStep] = useState<'input' | 'scenes' | 'variations' | 'video'>('input');
  
  // AI enhancement
  const [enhancedPrompt, setEnhancedPrompt] = useState<AIEnhancedPrompt | null>(null);
  
  // Results
  const [variations, setVariations] = useState<Array<{
    url: string;
    prompt: string;
    description: string;
  }>>([]);
  const [selectedVariation, setSelectedVariation] = useState<number | null>(null);
  const [generatedVideo, setGeneratedVideo] = useState<string | null>(null);
  
  // Advanced options
  const [showAdvanced, setShowAdvanced] = useState(false);
  const [youtubeUrl, setYoutubeUrl] = useState('');
  const [videoFile, setVideoFile] = useState<File | null>(null);
  const [isAnalyzingYoutube, setIsAnalyzingYoutube] = useState(false);
  const [learnedTechniques, setLearnedTechniques] = useState<string>('');
  const [storyLength, setStoryLength] = useState<string>('Standard (5-10 scenes)');
  const [generateDialog, setGenerateDialog] = useState(false);
  
  // Scene generation
  const [sceneMode, setSceneMode] = useState<'copy' | 'creative' | null>(null);
  const [scenes, setScenes] = useState<Scene[]>([]);
  const [editingSceneId, setEditingSceneId] = useState<string | null>(null);
  const [videoDuration, setVideoDuration] = useState(24); // Default 24 seconds (3 scenes)
  const [includeSceneDialog, setIncludeSceneDialog] = useState(true); // Include dialog by default
  const [mode, setMode] = useState<'copy' | 'creative'>('creative');
  
  // Sidebar states
  const [showGeneralSettings, setShowGeneralSettings] = useState(true);
  const [showSceneMode, setShowSceneMode] = useState(true);
  const [videoType, setVideoType] = useState<'ad' | 'social' | 'movie'>('ad');
  
  const [youtubeAnalysis, setYoutubeAnalysis] = useState<{
    storyStructure: {
      hook: string;
      narrativeArc: string;
      emotionalJourney: string[];
      ending: string;
    };
    whyItWorks: string[];
    scriptAnalysis: string;
    characterDetails: string;
    universalStoryTemplate: string;
    technicalPatterns: string;
    fullScript: Array<{
      timestamp: string;
      visual: string;
      audio: string;
      action: string;
    }>;
    // New comprehensive story analysis properties
    storyOverview?: {
      title: string;
      genre: string;
      synopsis: string;
      targetAudience: string;
    };
    characters?: Array<{
      name: string;
      role: string;
      description: string;
      arc: string;
    }>;
    scenes?: Array<{
      sceneNumber: number;
      title: string;
      timeRange: string;
      location: string;
      description: string;
      dialog?: Array<{
        speaker: string;
        line: string;
        emotion?: string;
      }>;
      transitionToNext: string;
    }>;
    narrativeFlow?: {
      exposition: string;
      risingAction: string;
      climax: string;
      fallingAction: string;
      resolution: string;
    };
    dialogScript?: string;
  } | null>(null);

  const enhanceUserInput = async () => {
    console.log('enhanceUserInput called, userInput:', userInput);
    if (!userInput.trim()) {
      toast({
        title: "Please tell me what you want to create",
        description: "Example: 'Make an ad for my new coffee brand' or 'Create a movie about space exploration'",
        variant: "destructive"
      });
      return;
    }

    setIsProcessing(true);
    try {
      console.log('Calling /api/visual-remix/enhance-prompt');
      const response = await fetch('/api/visual-remix/enhance-prompt', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ 
          userInput,
          youtubeUrl: showAdvanced ? youtubeUrl : undefined 
        })
      });

      console.log('Response status:', response.status);
      if (!response.ok) {
        const errorText = await response.text();
        console.error('Response error:', errorText);
        throw new Error(`Failed to enhance prompt: ${errorText}`);
      }

      const data = await response.json();
      console.log('Enhanced prompt data:', data);
      setEnhancedPrompt(data);
      
      // If we have YouTube analysis, go to scenes step, otherwise generate variations directly
      if (youtubeAnalysis && youtubeAnalysis.scenes) {
        console.log('Going to scenes step');
        setCurrentStep('scenes');
      } else {
        console.log('Generating variations directly');
        await generateVariations(data.enhanced);
      }
      
    } catch (error) {
      console.error('Error enhancing prompt:', error);
      toast({
        title: "Error",
        description: error instanceof Error ? error.message : "Failed to process your request. Please try again.",
        variant: "destructive"
      });
    } finally {
      setIsProcessing(false);
    }
  };

  const generateScenes = async (mode: 'copy' | 'creative') => {
    setSceneMode(mode);
    setIsProcessing(true);
    
    try {
      const response = await fetch('/api/visual-remix/generate-scenes', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          mode,
          userInput,
          enhancedPrompt: enhancedPrompt?.enhanced,
          youtubeAnalysis,
          videoType: enhancedPrompt?.videoType || 'ad',
          videoDuration,
          includeDialog: includeSceneDialog
        })
      });

      if (!response.ok) throw new Error('Failed to generate scenes');

      const data = await response.json();
      setScenes(data.scenes);
      
      toast({
        title: mode === 'copy' ? "Scenes copied from YouTube" : "Creative scenes generated",
        description: `Created ${data.scenes.length} scenes (8 seconds each)`
      });
      
    } catch (error) {
      console.error('Error generating scenes:', error);
      toast({
        title: "Error",
        description: "Failed to generate scenes",
        variant: "destructive"
      });
    } finally {
      setIsProcessing(false);
    }
  };

  const updateScene = async (sceneId: string, updates: Partial<Scene>) => {
    setScenes(scenes.map(scene => 
      scene.id === sceneId ? { ...scene, ...updates } : scene
    ));
  };

  const aiEnhanceScene = async (sceneId: string) => {
    const scene = scenes.find(s => s.id === sceneId);
    if (!scene) return;

    setIsProcessing(true);
    try {
      const response = await fetch('/api/visual-remix/enhance-scene', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ scene, allScenes: scenes, includeDialog: includeSceneDialog })
      });

      if (!response.ok) throw new Error('Failed to enhance scene');

      const data = await response.json();
      updateScene(sceneId, data.enhancedScene);
      
      toast({
        title: "Scene enhanced",
        description: `Scene ${scene.number} has been improved with AI`
      });
    } catch (error) {
      console.error('Error enhancing scene:', error);
      toast({
        title: "Error",
        description: "Failed to enhance scene",
        variant: "destructive"
      });
    } finally {
      setIsProcessing(false);
    }
  };

  const proceedWithScenes = async () => {
    if (scenes.length === 0) {
      toast({
        title: "No scenes",
        description: "Please generate scenes first",
        variant: "destructive"
      });
      return;
    }

    // Generate variations based on the scenes
    const scenesPrompt = scenes.map(scene => 
      `Scene ${scene.number}: ${scene.visualPrompt}`
    ).join('\n');
    
    await generateVariations(scenesPrompt);
    setCurrentStep('variations');
  };

  const generateVariations = async (prompt: string) => {
    try {
      console.log('Generating variations for prompt:', prompt);
      const response = await fetch('/api/visual-remix/generate-variations', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ prompt })
      });

      if (!response.ok) throw new Error('Failed to generate variations');

      const data = await response.json();
      console.log('Generated variations:', data.variations);
      setVariations(data.variations);
      setCurrentStep('variations');
      
      toast({
        title: "Images generated!",
        description: `Created ${data.variations.length} variations. Click one to make a video.`
      });
      
    } catch (error) {
      console.error('Error generating variations:', error);
      toast({
        title: "Error",
        description: "Failed to generate image variations",
        variant: "destructive"
      });
    }
  };

  const generateVideo = async () => {
    if (selectedVariation === null) {
      toast({
        title: "Please select an image",
        description: "Choose one of the generated images to create your video",
        variant: "destructive"
      });
      return;
    }

    setIsProcessing(true);
    try {
      const videoData = {
        imageUrl: variations[selectedVariation].url,
        prompt: enhancedPrompt?.enhanced || userInput,
        duration: enhancedPrompt?.videoType === 'ad' ? '8' : '15'
      };
      
      console.log('Generating video with:', videoData);
      
      const response = await fetch('/api/visual-remix/generate-video', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(videoData)
      });

      if (!response.ok) throw new Error('Failed to generate video');

      const data = await response.json();
      setGeneratedVideo(data.videoUrl);
      setCurrentStep('video');
      
      toast({
        title: "Video created!",
        description: "Your video is ready to download or share"
      });
      
    } catch (error) {
      console.error('Error generating video:', error);
      toast({
        title: "Error", 
        description: "Failed to generate video. Please try again.",
        variant: "destructive"
      });
    } finally {
      setIsProcessing(false);
    }
  };

  const analyzeYoutubeVideo = async () => {
    if (!youtubeUrl && !videoFile) return;

    setIsAnalyzingYoutube(true);
    try {
      let response;
      
      if (videoFile) {
        // Handle file upload
        const formData = new FormData();
        formData.append('video', videoFile);
        formData.append('storyLength', 'Standard (5-10 scenes)');
        formData.append('generateDialog', generateDialog.toString());
        
        response = await fetch('/api/visual-remix/analyze-video-file', {
          method: 'POST',
          body: formData
        });
      } else {
        // Handle YouTube URL
        response = await fetch('/api/visual-remix/analyze-youtube', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ youtubeUrl })
        });
      }

      if (!response.ok) throw new Error('Failed to analyze video');

      const data = await response.json();
      setYoutubeAnalysis(data);
      setLearnedTechniques(data.universalStoryTemplate);
      
      toast({
        title: "Learned storytelling techniques!",
        description: "I'll apply these techniques to your creation"
      });
      
    } catch (error) {
      console.error('Error analyzing video:', error);
      toast({
        title: "Error",
        description: "Failed to analyze video",
        variant: "destructive"
      });
    } finally {
      setIsAnalyzingYoutube(false);
    }
  };

  return (
    <div className="flex h-screen bg-slate-900">
      {/* Left Sidebar */}
      <div className="w-80 bg-slate-800/50 border-r border-slate-700 p-6 overflow-y-auto">
        <h2 className="text-xl font-semibold text-white mb-6">Visual Remix Studio</h2>
        
        {/* YouTube Analysis Display - Always visible when analysis is complete */}
        {youtubeAnalysis && (
          <div className="mb-6 bg-purple-900/20 border border-purple-700 rounded-lg p-4">
            <h3 className="text-lg font-medium text-purple-300 mb-3">Story Analysis Complete</h3>
            
            {/* Story Overview */}
            {youtubeAnalysis.storyOverview && (
              <div className="mb-4">
                <h4 className="text-sm font-medium text-white mb-2">{youtubeAnalysis.storyOverview.title}</h4>
                <p className="text-xs text-slate-300 mb-1">
                  <span className="text-purple-400">Genre:</span> {youtubeAnalysis.storyOverview.genre}
                </p>
                <p className="text-xs text-slate-300 mb-2">
                  <span className="text-purple-400">Synopsis:</span> {youtubeAnalysis.storyOverview.synopsis}
                </p>
              </div>
            )}
            
            {/* Characters */}
            {youtubeAnalysis.characters && youtubeAnalysis.characters.length > 0 && (
              <div className="mb-4">
                <h4 className="text-sm font-medium text-pink-300 mb-2">Characters ({youtubeAnalysis.characters.length})</h4>
                <div className="space-y-1">
                  {youtubeAnalysis.characters.slice(0, 3).map((char: any, idx: number) => (
                    <div key={idx} className="text-xs">
                      <span className="text-pink-400">{char.name}</span> - {char.role}
                    </div>
                  ))}
                  {youtubeAnalysis.characters.length > 3 && (
                    <p className="text-xs text-slate-400">... and {youtubeAnalysis.characters.length - 3} more</p>
                  )}
                </div>
              </div>
            )}
            
            {/* Scenes */}
            {youtubeAnalysis.scenes && youtubeAnalysis.scenes.length > 0 && (
              <div className="mb-4">
                <h4 className="text-sm font-medium text-cyan-300 mb-2">Scenes ({youtubeAnalysis.scenes.length})</h4>
                <div className="space-y-2 max-h-60 overflow-y-auto">
                  {youtubeAnalysis.scenes.map((scene: any, idx: number) => (
                    <div key={idx} className="bg-slate-800/50 rounded p-2">
                      <p className="text-xs font-medium text-cyan-300">Scene {scene.sceneNumber}: {scene.title}</p>
                      <p className="text-xs text-slate-400">{scene.timeRange}</p>
                      <p className="text-xs text-slate-300 mt-1">{scene.description}</p>
                      {scene.dialog && scene.dialog.length > 0 && (
                        <p className="text-xs text-orange-400 mt-1">"{scene.dialog[0].text}"</p>
                      )}
                    </div>
                  ))}
                </div>
              </div>
            )}
            
            <div className="flex gap-2 mt-3">
              <button
                onClick={() => {
                  setCurrentStep('scenes');
                  generateScenes('copy');
                }}
                className="flex-1 px-3 py-1.5 bg-cyan-600 hover:bg-cyan-700 text-white text-xs rounded transition-colors"
              >
                Copy Scenes
              </button>
              <button
                onClick={() => {
                  setCurrentStep('scenes');
                  generateScenes('creative');
                }}
                className="flex-1 px-3 py-1.5 bg-purple-600 hover:bg-purple-700 text-white text-xs rounded transition-colors"
              >
                Creative Remix
              </button>
            </div>
          </div>
        )}
        
        {/* General Settings */}
        <div className="mb-6">
          <button
            onClick={() => setShowGeneralSettings(!showGeneralSettings)}
            className="flex items-center justify-between w-full text-left text-white hover:text-purple-400 transition-colors mb-3"
          >
            <span className="flex items-center gap-2">
              <ChevronRight className={`w-4 h-4 transition-transform ${showGeneralSettings ? 'rotate-90' : ''}`} />
              General settings
            </span>
          </button>
          
          {showGeneralSettings && (
            <div className="ml-6 space-y-3">
              <div>
                <label className="text-sm text-slate-400 mb-1 block">Video Type</label>
                <select
                  value={videoType}
                  onChange={(e) => setVideoType(e.target.value as 'ad' | 'social' | 'movie')}
                  className="w-full px-3 py-2 bg-slate-900/50 border border-slate-600 rounded-lg text-white"
                >
                  <option value="ad">Advertisement</option>
                  <option value="social">Social Media</option>
                  <option value="movie">Movie/Trailer</option>
                </select>
              </div>
              
              <div>
                <label className="text-sm text-slate-400 mb-1 block">Duration</label>
                <select
                  value={videoDuration}
                  onChange={(e) => setVideoDuration(parseInt(e.target.value))}
                  className="w-full px-3 py-2 bg-slate-900/50 border border-slate-600 rounded-lg text-white"
                >
                  <option value={16}>16 seconds (2 scenes)</option>
                  <option value={24}>24 seconds (3 scenes)</option>
                  <option value={32}>32 seconds (4 scenes)</option>
                  <option value={40}>40 seconds (5 scenes)</option>
                  <option value={48}>48 seconds (6 scenes)</option>
                  <option value={56}>56 seconds (7 scenes)</option>
                  <option value={64}>64 seconds (8 scenes)</option>
                </select>
              </div>
              
              <div className="flex items-center gap-2">
                <input
                  type="checkbox"
                  id="includeDialog"
                  checked={includeSceneDialog}
                  onChange={(e) => setIncludeSceneDialog(e.target.checked)}
                  className="rounded border-slate-600 bg-slate-900/50 text-purple-500"
                />
                <label htmlFor="includeDialog" className="text-sm text-slate-400">
                  Include dialog/voiceover
                </label>
              </div>
            </div>
          )}
        </div>

        {/* Scene Mode */}
        <div className="mb-6">
          <button
            onClick={() => setShowSceneMode(!showSceneMode)}
            className="flex items-center justify-between w-full text-left text-white hover:text-purple-400 transition-colors mb-3"
          >
            <span className="flex items-center gap-2">
              <ChevronRight className={`w-4 h-4 transition-transform ${showSceneMode ? 'rotate-90' : ''}`} />
              Scene Mode
            </span>
          </button>
          
          {showSceneMode && (
            <div className="ml-6 space-y-3">
              <div className="space-y-2">
                <label className="flex items-center gap-2">
                  <input
                    type="radio"
                    value="copy"
                    checked={mode === 'copy'}
                    onChange={(e) => setMode(e.target.value as 'copy' | 'creative')}
                    className="text-purple-500"
                  />
                  <span className="text-sm text-slate-400">Copy Mode</span>
                </label>
                <label className="flex items-center gap-2">
                  <input
                    type="radio"
                    value="creative"
                    checked={mode === 'creative'}
                    onChange={(e) => setMode(e.target.value as 'copy' | 'creative')}
                    className="text-purple-500"
                  />
                  <span className="text-sm text-slate-400">Creative Mode</span>
                </label>
              </div>
            </div>
          )}
        </div>

        {/* Advanced Settings - Video Analysis */}
        <div className="mb-6">
          <button
            onClick={() => setShowAdvanced(!showAdvanced)}
            className="flex items-center justify-between w-full text-left text-white hover:text-purple-400 transition-colors mb-3"
          >
            <span className="flex items-center gap-2">
              <ChevronRight className={`w-4 h-4 transition-transform ${showAdvanced ? 'rotate-90' : ''}`} />
              Learn from Video (Optional)
            </span>
          </button>
          
          {showAdvanced && (
            <div className="ml-6 space-y-3">
              <div>
                <label className="text-sm text-slate-400 mb-1 block">YouTube Reference</label>
                <input
                  type="text"
                  value={youtubeUrl}
                  onChange={(e) => setYoutubeUrl(e.target.value)}
                  placeholder="YouTube URL for learning"
                  className="w-full px-3 py-2 bg-slate-900/50 border border-slate-600 rounded-lg text-white placeholder-slate-500"
                />
              </div>
              
              <div>
                <label className="text-sm text-slate-400 mb-1 block">Upload Video</label>
                <input
                  type="file"
                  accept="video/*"
                  onChange={(e) => setVideoFile(e.target.files?.[0] || null)}
                  className="w-full px-3 py-2 bg-slate-900/50 border border-slate-600 rounded-lg text-white file:mr-4 file:py-1 file:px-3 file:rounded-full file:border-0 file:text-sm file:font-semibold file:bg-purple-500 file:text-white hover:file:bg-purple-600"
                />
              </div>
              
              {(youtubeUrl || videoFile) && (
                <button
                  onClick={analyzeYoutubeVideo}
                  disabled={isAnalyzingYoutube}
                  className="w-full px-3 py-2 bg-purple-500 hover:bg-purple-600 disabled:bg-slate-600 text-white rounded-lg transition-colors text-sm"
                >
                  {isAnalyzingYoutube ? (
                    <span className="flex items-center justify-center gap-2">
                      <Loader2 className="w-4 h-4 animate-spin" />
                      Analyzing...
                    </span>
                  ) : (
                    'Analyze Video'
                  )}
                </button>
              )}
            </div>
          )}
        </div>

        {/* Scenes List */}
        {scenes.length > 0 && (
          <div className="mb-6">
            <h3 className="text-white font-medium mb-3">Scenes ({scenes.length})</h3>
            <div className="space-y-2">
              {scenes.map((scene) => (
                <div
                  key={scene.id}
                  onClick={() => setEditingSceneId(scene.id)}
                  className={`p-3 rounded-lg cursor-pointer transition-all ${
                    editingSceneId === scene.id
                      ? 'bg-purple-500/20 border border-purple-500'
                      : 'bg-slate-900/50 border border-slate-700 hover:border-slate-600'
                  }`}
                >
                  <p className="text-sm font-medium text-white">Scene {scene.number}</p>
                  <p className="text-xs text-slate-400 mt-1">{scene.title}</p>
                </div>
              ))}
            </div>
          </div>
        )}
      </div>

      {/* Main Content Area */}
      <div className="flex-1 flex flex-col">
        {/* Preview Area */}
        <div className="flex-1 flex items-center justify-center p-8">
          {isProcessing ? (
            <div className="text-center">
              <Loader2 className="w-16 h-16 mx-auto mb-4 text-purple-500 animate-spin" />
              <h3 className="text-xl font-medium text-white mb-2">Processing your request...</h3>
              <p className="text-slate-400">AI is creating your visual content</p>
            </div>
          ) : generatedVideo ? (
            <div className="w-full max-w-2xl">
              <video
                src={generatedVideo}
                controls
                className="w-full rounded-lg shadow-2xl"
              />
            </div>
          ) : variations.length > 0 ? (
            <div className="w-full max-w-4xl">
              <div className="mb-4 text-center">
                <h3 className="text-xl font-semibold text-white mb-2">Select an image to create your video</h3>
                <p className="text-slate-400">Click on the image you like best</p>
              </div>
              <div className="grid grid-cols-3 gap-4">
                {variations.map((variation, index) => (
                  <div
                    key={index}
                    onClick={() => setSelectedVariation(index)}
                    className={`relative cursor-pointer rounded-lg overflow-hidden transition-all ${
                      selectedVariation === index
                        ? 'ring-2 ring-purple-500 transform scale-105'
                        : 'hover:ring-2 hover:ring-slate-600'
                    }`}
                  >
                    <img
                      src={variation.url}
                      alt={variation.description}
                      className="w-full h-48 object-cover"
                    />
                    <div className="absolute bottom-0 left-0 right-0 bg-gradient-to-t from-black/60 to-transparent p-2">
                      <p className="text-xs text-white">{variation.description}</p>
                    </div>
                  </div>
                ))}
              </div>
              {selectedVariation !== null && (
                <button
                  onClick={generateVideo}
                  disabled={isProcessing}
                  className="mt-6 w-full px-6 py-3 bg-purple-500 hover:bg-purple-600 disabled:bg-slate-600 text-white rounded-lg transition-colors flex items-center justify-center"
                >
                  {isProcessing ? (
                    <>
                      <Loader2 className="w-5 h-5 mr-2 animate-spin" />
                      Generating video...
                    </>
                  ) : (
                    <>
                      <Video className="w-5 h-5 mr-2" />
                      Generate Video
                    </>
                  )}
                </button>
              )}
            </div>
          ) : scenes.length > 0 && editingSceneId ? (
            <div className="w-full max-w-4xl">
              <h3 className="text-xl font-semibold text-white mb-4">Edit Scene</h3>
              {scenes.filter(s => s.id === editingSceneId).map((scene) => (
                <div key={scene.id} className="bg-slate-800/50 rounded-lg p-6 space-y-4">
                  <input
                    type="text"
                    value={scene.title}
                    onChange={(e) => updateScene(scene.id, { title: e.target.value })}
                    className="w-full px-3 py-2 bg-slate-900/50 border border-slate-600 rounded-lg text-white text-lg font-medium"
                    placeholder="Scene title"
                  />
                  <textarea
                    value={scene.description}
                    onChange={(e) => updateScene(scene.id, { description: e.target.value })}
                    className="w-full px-3 py-2 bg-slate-900/50 border border-slate-600 rounded-lg text-white"
                    placeholder="Scene description"
                    rows={2}
                  />
                  <textarea
                    value={scene.visualPrompt}
                    onChange={(e) => updateScene(scene.id, { visualPrompt: e.target.value })}
                    className="w-full px-3 py-2 bg-slate-900/50 border border-slate-600 rounded-lg text-white"
                    placeholder="Visual prompt"
                    rows={2}
                  />
                  {includeSceneDialog && (
                    <textarea
                      value={scene.dialog || ''}
                      onChange={(e) => updateScene(scene.id, { dialog: e.target.value })}
                      className="w-full px-3 py-2 bg-slate-900/50 border border-slate-600 rounded-lg text-white"
                      placeholder="Dialog/voiceover for this scene"
                      rows={2}
                    />
                  )}
                  <div className="flex gap-2">
                    <input
                      type="text"
                      value={scene.cameraMovement}
                      onChange={(e) => updateScene(scene.id, { cameraMovement: e.target.value })}
                      className="flex-1 px-3 py-2 bg-slate-900/50 border border-slate-600 rounded-lg text-white"
                      placeholder="Camera movement"
                    />
                    <input
                      type="text"
                      value={scene.transition}
                      onChange={(e) => updateScene(scene.id, { transition: e.target.value })}
                      className="flex-1 px-3 py-2 bg-slate-900/50 border border-slate-600 rounded-lg text-white"
                      placeholder="Transition"
                    />
                  </div>
                  <div className="flex gap-2 pt-4">
                    <button
                      onClick={() => aiEnhanceScene(scene.id)}
                      className="flex-1 px-4 py-2 bg-purple-500 hover:bg-purple-600 text-white rounded-lg transition-colors flex items-center justify-center"
                    >
                      <Sparkles className="w-4 h-4 mr-2" />
                      AI Enhance
                    </button>
                    <button
                      onClick={() => setEditingSceneId(null)}
                      className="flex-1 px-4 py-2 bg-slate-700 hover:bg-slate-600 text-white rounded-lg transition-colors"
                    >
                      Done
                    </button>
                  </div>
                </div>
              ))}
            </div>
          ) : scenes.length > 0 ? (
            <div className="w-full max-w-4xl">
              <div className="text-center mb-6">
                <h3 className="text-2xl font-semibold text-white mb-2">Your Scene Breakdown</h3>
                <p className="text-slate-400">Click on any scene to edit it</p>
              </div>
              <div className="grid grid-cols-2 gap-4 mb-6">
                {scenes.map((scene) => (
                  <div
                    key={scene.id}
                    onClick={() => setEditingSceneId(scene.id)}
                    className="bg-slate-800/50 rounded-lg p-4 cursor-pointer hover:bg-slate-700/50 transition-colors"
                  >
                    <div className="flex items-center justify-between mb-2">
                      <span className="text-sm text-purple-400">Scene {scene.number}</span>
                      <span className="text-xs text-slate-500">{scene.duration}s</span>
                    </div>
                    <p className="font-medium text-white">{scene.title}</p>
                    <p className="text-sm text-slate-400 mt-1">{scene.description}</p>
                    <div className="mt-2 space-y-1 text-xs">
                      <p className="text-cyan-400">Visual: {scene.visualPrompt}</p>
                      {scene.dialog && (
                        <p className="text-orange-400">Dialog: "{scene.dialog}"</p>
                      )}
                      <p className="text-green-400">Camera: {scene.cameraMovement}</p>
                      <p className="text-purple-400">Transition: {scene.transition}</p>
                    </div>
                  </div>
                ))}
              </div>
              <button
                onClick={proceedWithScenes}
                className="w-full px-6 py-3 bg-gradient-to-r from-purple-500 to-pink-500 hover:from-purple-600 hover:to-pink-600 text-white rounded-lg transition-all flex items-center justify-center"
              >
                <Wand2 className="w-5 h-5 mr-2" />
                Generate Images from Scenes
              </button>
            </div>
          ) : (
            <div className="text-center">
              <div className="w-24 h-24 mx-auto mb-4 bg-slate-800/50 rounded-full flex items-center justify-center">
                <Film className="w-12 h-12 text-slate-600" />
              </div>
              <h3 className="text-xl font-medium text-white mb-2">No preview available</h3>
              <p className="text-slate-400">Enter a prompt below to start creating</p>
            </div>
          )}
        </div>

        {/* Bottom Prompt Area */}
        <div className="border-t border-slate-700 p-6">
          <div className="max-w-4xl mx-auto">
            <div className="flex gap-2 items-end">
              <div className="flex-1">
                <label className="text-xs text-slate-400 mb-1 block">Prompt</label>
                <textarea
                  value={userInput}
                  onChange={(e) => setUserInput(e.target.value)}
                  placeholder="I want a visual in loop, a medieval style house in the middle of the mountain, it's raining very hard with a lot of wind..."
                  className="w-full px-4 py-3 bg-slate-800/50 border border-slate-700 rounded-lg text-white placeholder-slate-500 resize-none"
                  rows={2}
                />
              </div>
              <button
                onClick={() => setUserInput('')}
                className="px-4 py-3 bg-slate-700 hover:bg-slate-600 text-white rounded-lg transition-colors"
              >
                Clear
              </button>
              <button
                onClick={enhanceUserInput}
                disabled={isProcessing || !userInput.trim()}
                className="px-6 py-3 bg-purple-500 hover:bg-purple-600 disabled:bg-slate-600 text-white rounded-lg transition-colors flex items-center"
              >
                {isProcessing ? (
                  <>
                    <Loader2 className="w-5 h-5 mr-2 animate-spin" />
                    Generating...
                  </>
                ) : scenes.length > 0 ? (
                  <>
                    <Sparkles className="w-5 h-5 mr-2" />
                    Generate New
                  </>
                ) : (
                  <>
                    <Sparkles className="w-5 h-5 mr-2" />
                    Generate
                  </>
                )}
              </button>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
