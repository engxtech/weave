import { useState, useEffect } from 'react';
import { Dialog, DialogContent, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { DialogFooter } from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Textarea } from '@/components/ui/textarea';
import { Switch } from '@/components/ui/switch';
import { Badge } from '@/components/ui/badge';
import { Upload, X, Settings, Video, Zap, Search, Mic, Volume2, Eye, Crop, Scissors, Image, Film, Type, Music } from 'lucide-react';

interface NodeConfigModalProps {
  isOpen: boolean;
  onClose: () => void;
  nodeId: string | null;
  nodeType?: string;
  initialConfig?: any;
  onSave: (config: any) => void;
}

export function NodeConfigModal({ 
  isOpen, 
  onClose, 
  nodeId, 
  nodeType = '', 
  initialConfig = {}, 
  onSave 
}: NodeConfigModalProps) {
  const [config, setConfig] = useState(initialConfig);

  useEffect(() => {
    setConfig(initialConfig);
  }, [initialConfig, isOpen]);

  const handleSave = () => {
    onSave(config);
    onClose();
  };

  const renderConfigFields = () => {
    switch (nodeType) {
      case 'start':
        return (
          <div className="space-y-6">
            {/* Video Input Header */}
            <div className="flex items-center gap-3">
              <div className="w-8 h-8 bg-purple-500 rounded-lg flex items-center justify-center">
                <Video className="h-4 w-4 text-white" />
              </div>
              <div>
                <h3 className="text-lg font-semibold text-white">Video Input</h3>
                <p className="text-sm text-gray-400">Upload a video to get started</p>
              </div>
            </div>

            {/* Professional Upload Area - Exact Match */}
            <div className="bg-gray-900 rounded-xl border-2 border-dashed border-gray-600 p-16 text-center hover:border-purple-500/50 transition-colors">
              <input
                type="file"
                id="video-upload"
                accept="video/*"
                className="hidden"
                onChange={async (e) => {
                  const file = e.target.files?.[0];
                  if (file) {
                    setConfig({...config, videoFile: file, fileName: file.name, fileSize: file.size, uploadStatus: 'uploading'});
                    
                    try {
                      const formData = new FormData();
                      formData.append('video', file);
                      
                      const response = await fetch('/api/upload/video', {
                        method: 'POST',
                        body: formData
                      });
                      
                      if (response.ok) {
                        const data = await response.json();
                        setConfig((prev: any) => ({
                          ...prev,
                          videoPath: data.path,
                          uploadStatus: 'completed'
                        }));
                      } else {
                        setConfig((prev: any) => ({ ...prev, uploadStatus: 'error' }));
                      }
                    } catch (error) {
                      console.error('Upload error:', error);
                      setConfig((prev: any) => ({ ...prev, uploadStatus: 'error' }));
                    }
                  }
                }}
              />
              <label 
                htmlFor="video-upload"
                className="cursor-pointer group block"
              >
                {config.fileName ? (
                  <div className="space-y-4">
                    <div className="w-16 h-16 bg-purple-500 rounded-lg flex items-center justify-center mx-auto">
                      <Video className="h-8 w-8 text-white" />
                    </div>
                    <div>
                      <p className="text-white font-medium truncate">{config.fileName}</p>
                      {config.uploadStatus === 'uploading' && (
                        <p className="text-yellow-400 text-sm mt-1">Uploading...</p>
                      )}
                      {config.uploadStatus === 'completed' && (
                        <p className="text-green-400 text-sm mt-1">Upload complete</p>
                      )}
                      {config.uploadStatus === 'error' && (
                        <p className="text-red-400 text-sm mt-1">Upload failed</p>
                      )}
                    </div>
                    {config.uploadStatus === 'completed' && (
                      <div className="inline-flex items-center gap-2 bg-green-500/20 text-green-400 px-3 py-1 rounded-full text-xs">
                        <div className="w-2 h-2 bg-green-400 rounded-full"></div>
                        Ready for processing
                      </div>
                    )}
                  </div>
                ) : (
                  <div className="space-y-6">
                    <div className="w-12 h-12 bg-gray-800 rounded flex items-center justify-center mx-auto">
                      <Upload className="h-6 w-6 text-gray-400" />
                    </div>
                    <div>
                      <p className="text-white font-medium text-lg">Drop video or click to upload</p>
                    </div>
                    <div className="w-3 h-3 bg-purple-500 rounded-full mx-auto"></div>
                  </div>
                )}
              </label>
            </div>

            {/* Video Title Input */}
            <div className="space-y-2">
              <Label htmlFor="video-title" className="text-sm font-medium text-gray-300">
                Video Title (Optional)
              </Label>
              <Input
                id="video-title"
                value={config.title || ''}
                onChange={(e) => setConfig({...config, title: e.target.value})}
                placeholder="Enter a title for your video"
                className="bg-gray-800 border-gray-700 text-white placeholder:text-gray-500 focus:ring-purple-500 focus:border-purple-500"
              />
            </div>
          </div>
        );

      case 'shorts':
        return (
          <div className="space-y-6">
            {/* Shorts Header */}
            <div className="flex items-center gap-3">
              <div className="w-8 h-8 bg-orange-500 rounded-lg flex items-center justify-center">
                <Zap className="h-4 w-4 text-white" />
              </div>
              <div>
                <h3 className="text-lg font-semibold text-white">Shorts Extractor</h3>
                <p className="text-sm text-gray-400">Automatically find and extract viral-worthy moments</p>
              </div>
            </div>

            {/* Search Phrases Input */}
            <div className="space-y-2">
              <Label htmlFor="search-phrases" className="text-sm font-medium text-gray-300">
                Search Phrases
                <Badge variant="secondary" className="ml-2 text-xs bg-purple-500/20 text-purple-400">Required</Badge>
              </Label>
              <div className="relative">
                <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 h-4 w-4 text-gray-400" />
                <Input
                  id="search-phrases"
                  value={config.searchPhrases || ''}
                  onChange={(e) => setConfig({...config, searchPhrases: e.target.value})}
                  placeholder="most viral moments"
                  className="pl-10 bg-gray-800 border-gray-700 text-white placeholder:text-gray-500 focus:ring-orange-500 focus:border-orange-500"
                />
              </div>
              <p className="text-xs text-gray-500">Enter keywords or phrases to find in your video</p>
            </div>

            {/* Target Viral Moments Toggle */}
            <div className="flex items-center justify-between p-4 bg-gray-800 rounded-lg">
              <div className="space-y-1">
                <Label htmlFor="viral-moments" className="text-sm font-medium text-gray-300">
                  Target Viral Moments
                </Label>
                <p className="text-xs text-gray-500">
                  Use AI to identify high-engagement potential segments
                </p>
              </div>
              <Switch
                id="viral-moments"
                checked={config.targetViralMoments !== false}
                onCheckedChange={(checked) => setConfig({...config, targetViralMoments: checked})}
              />
            </div>

            {/* Processing Settings */}
            <div className="space-y-3">
              <Label className="text-sm font-medium text-gray-300">Processing Settings</Label>
              <div className="grid grid-cols-2 gap-3">
                <div className="p-3 bg-gray-800 rounded-lg text-center">
                  <div className="text-lg font-semibold text-orange-400">5</div>
                  <div className="text-xs text-gray-400">Max Clips</div>
                </div>
                <div className="p-3 bg-gray-800 rounded-lg text-center">
                  <div className="text-lg font-semibold text-orange-400">30s</div>
                  <div className="text-xs text-gray-400">Clip Length</div>
                </div>
              </div>
            </div>
          </div>
        );

      case 'voice':
        return (
          <div className="space-y-6">
            {/* Voice Header */}
            <div className="flex items-center gap-3">
              <div className="w-8 h-8 bg-pink-500 rounded-lg flex items-center justify-center">
                <Mic className="h-4 w-4 text-white" />
              </div>
              <div>
                <h3 className="text-lg font-semibold text-white">Voice Translation</h3>
                <p className="text-sm text-gray-400">Change voice and translate to 30+ languages</p>
              </div>
            </div>

            {/* Target Language */}
            <div className="space-y-2">
              <Label htmlFor="target-language" className="text-sm font-medium text-gray-300">
                Target Language
                <Badge variant="secondary" className="ml-2 text-xs bg-purple-500/20 text-purple-400">Required</Badge>
              </Label>
              <Select value={config.targetLanguage || 'Spanish'} onValueChange={(value) => setConfig({...config, targetLanguage: value})}>
                <SelectTrigger className="bg-gray-800 border-gray-700 text-white focus:ring-pink-500 focus:border-pink-500">
                  <SelectValue placeholder="Select language" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="Spanish">Spanish</SelectItem>
                  <SelectItem value="French">French</SelectItem>
                  <SelectItem value="German">German</SelectItem>
                  <SelectItem value="Italian">Italian</SelectItem>
                  <SelectItem value="Portuguese">Portuguese</SelectItem>
                  <SelectItem value="Japanese">Japanese</SelectItem>
                  <SelectItem value="Korean">Korean</SelectItem>
                  <SelectItem value="Chinese">Chinese</SelectItem>
                </SelectContent>
              </Select>
            </div>

            {/* Preserve Background Audio */}
            <div className="flex items-center justify-between p-4 bg-gray-800 rounded-lg">
              <div className="space-y-1">
                <Label htmlFor="preserve-audio" className="text-sm font-medium text-gray-300">
                  Preserve Background Audio
                </Label>
                <p className="text-xs text-gray-500">Keep original background sounds and music</p>
              </div>
              <Switch
                id="preserve-audio"
                checked={config.preserveBackgroundAudio !== false}
                onCheckedChange={(checked) => setConfig({...config, preserveBackgroundAudio: checked})}
              />
            </div>

            {/* Safewords */}
            <div className="space-y-2">
              <Label htmlFor="safewords" className="text-sm font-medium text-gray-300">Safewords</Label>
              <Input
                id="safewords"
                value={config.safewords || ''}
                onChange={(e) => setConfig({...config, safewords: e.target.value})}
                placeholder="OpenAI, coffee"
                className="bg-gray-800 border-gray-700 text-white placeholder:text-gray-500 focus:ring-pink-500 focus:border-pink-500"
              />
              <p className="text-xs text-gray-500">Words that should not be translated</p>
            </div>

            {/* Translation Dictionary */}
            <div className="space-y-3">
              <Label className="text-sm font-medium text-gray-300">Translation Dictionary</Label>
              <div className="grid grid-cols-2 gap-2">
                <Input placeholder="Original" className="bg-gray-800 border-gray-700 text-white placeholder:text-gray-500" />
                <Input placeholder="New" className="bg-gray-800 border-gray-700 text-white placeholder:text-gray-500" />
              </div>
              <div className="grid grid-cols-2 gap-2">
                <Input placeholder="shit" className="bg-gray-800 border-gray-700 text-white placeholder:text-gray-500" />
                <Input placeholder="shoot" className="bg-gray-800 border-gray-700 text-white placeholder:text-gray-500" />
              </div>
              <Button variant="ghost" size="sm" className="text-pink-400 hover:text-pink-300">+ Add Translation</Button>
            </div>
          </div>
        );

      case 'audio_enhance':
        return (
          <div className="space-y-6">
            {/* Audio Enhance Header */}
            <div className="flex items-center gap-3">
              <div className="w-8 h-8 bg-yellow-500 rounded-lg flex items-center justify-center">
                <Volume2 className="h-4 w-4 text-white" />
              </div>
              <div>
                <h3 className="text-lg font-semibold text-white">Audio Enhancement</h3>
                <p className="text-sm text-gray-400">Improve audio quality with AI-powered processing</p>
              </div>
            </div>

            {/* Processing Backend */}
            <div className="space-y-2">
              <Label htmlFor="processing-backend" className="text-sm font-medium text-gray-300">
                Processing Backend
                <Badge variant="secondary" className="ml-2 text-xs bg-purple-500/20 text-purple-400">Required</Badge>
              </Label>
              <Select value={config.processingBackend || 'Audiophonic'} onValueChange={(value) => setConfig({...config, processingBackend: value})}>
                <SelectTrigger className="bg-gray-800 border-gray-700 text-white focus:ring-yellow-500 focus:border-yellow-500">
                  <SelectValue placeholder="Select backend" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="Audiophonic">Audiophonic</SelectItem>
                  <SelectItem value="Adobe">Adobe Enhance</SelectItem>
                  <SelectItem value="Custom">Custom AI Model</SelectItem>
                </SelectContent>
              </Select>
            </div>

            {/* Enhancement Type */}
            <div className="space-y-2">
              <Label htmlFor="enhancement-type" className="text-sm font-medium text-gray-300">
                Enhancement Type
                <Badge variant="secondary" className="ml-2 text-xs bg-purple-500/20 text-purple-400">Required</Badge>
              </Label>
              <Select value={config.enhancementType || 'Enhance & Denoise'} onValueChange={(value) => setConfig({...config, enhancementType: value})}>
                <SelectTrigger className="bg-gray-800 border-gray-700 text-white focus:ring-yellow-500 focus:border-yellow-500">
                  <SelectValue placeholder="Select type" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="Enhance & Denoise">Enhance & Denoise</SelectItem>
                  <SelectItem value="Noise Reduction">Noise Reduction Only</SelectItem>
                  <SelectItem value="Audio Enhance">Audio Enhance Only</SelectItem>
                </SelectContent>
              </Select>
            </div>

            {/* Enhancement Steps Slider */}
            <div className="space-y-3">
              <Label className="text-sm font-medium text-gray-300">
                Enhancement Steps
                <Badge variant="secondary" className="ml-2 text-xs bg-purple-500/20 text-purple-400">Required</Badge>
              </Label>
              <div className="space-y-2">
                <div className="flex items-center gap-4">
                  <input
                    type="range"
                    min="0"
                    max="100"
                    value={config.enhancementSteps || 75}
                    onChange={(e) => setConfig({...config, enhancementSteps: parseInt(e.target.value)})}
                    className="flex-1 h-2 bg-gray-700 rounded-lg appearance-none cursor-pointer slider"
                  />
                  <span className="text-yellow-400 font-medium min-w-[3rem]">{config.enhancementSteps || 75}</span>
                </div>
                <div className="flex justify-between text-xs text-gray-500">
                  <span>0</span>
                  <span>100</span>
                </div>
              </div>
            </div>
          </div>
        );

      case 'eye_contact':
        return (
          <div className="space-y-6">
            {/* Eye Contact Header */}
            <div className="flex items-center gap-3">
              <div className="w-8 h-8 bg-purple-500 rounded-lg flex items-center justify-center">
                <Eye className="h-4 w-4 text-white" />
              </div>
              <div>
                <h3 className="text-lg font-semibold text-white">Eye Contact Correction</h3>
                <p className="text-sm text-gray-400">Automatically adjust gaze direction for better engagement</p>
              </div>
            </div>

            {/* Accuracy Boost */}
            <div className="space-y-2">
              <Label htmlFor="accuracy-boost" className="text-sm font-medium text-gray-300">
                Accuracy Boost
                <Badge variant="secondary" className="ml-2 text-xs bg-purple-500/20 text-purple-400">Required</Badge>
              </Label>
              <Select value={config.accuracyBoost || 'Yes'} onValueChange={(value) => setConfig({...config, accuracyBoost: value})}>
                <SelectTrigger className="bg-gray-800 border-gray-700 text-white focus:ring-purple-500 focus:border-purple-500">
                  <SelectValue placeholder="Select option" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="Yes">Yes</SelectItem>
                  <SelectItem value="No">No</SelectItem>
                </SelectContent>
              </Select>
            </div>

            {/* Natural Look Away */}
            <div className="space-y-2">
              <Label htmlFor="natural-look-away" className="text-sm font-medium text-gray-300">
                Natural Look Away
                <Badge variant="secondary" className="ml-2 text-xs bg-purple-500/20 text-purple-400">Required</Badge>
              </Label>
              <Select value={config.naturalLookAway || 'No'} onValueChange={(value) => setConfig({...config, naturalLookAway: value})}>
                <SelectTrigger className="bg-gray-800 border-gray-700 text-white focus:ring-purple-500 focus:border-purple-500">
                  <SelectValue placeholder="Select option" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="Yes">Yes</SelectItem>
                  <SelectItem value="No">No</SelectItem>
                </SelectContent>
              </Select>
              <p className="text-xs text-gray-500">Allow realistic blinking and natural eye movement</p>
            </div>
          </div>
        );

      case 'reframe':
        return (
          <div className="space-y-6">
            {/* Reframe Header */}
            <div className="flex items-center gap-3">
              <div className="w-8 h-8 bg-blue-500 rounded-lg flex items-center justify-center">
                <Crop className="h-4 w-4 text-white" />
              </div>
              <div>
                <h3 className="text-lg font-semibold text-white">Smart Reframing</h3>
                <p className="text-sm text-gray-400">Intelligently reframe to different aspect ratios</p>
              </div>
            </div>

            {/* Aspect Ratio */}
            <div className="space-y-2">
              <Label htmlFor="aspect-ratio" className="text-sm font-medium text-gray-300">
                Aspect Ratio
                <Badge variant="secondary" className="ml-2 text-xs bg-purple-500/20 text-purple-400">Required</Badge>
              </Label>
              <Select value={config.aspectRatio || 'Vertical (9:16)'} onValueChange={(value) => setConfig({...config, aspectRatio: value})}>
                <SelectTrigger className="bg-gray-800 border-gray-700 text-white focus:ring-blue-500 focus:border-blue-500">
                  <SelectValue placeholder="Select ratio" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="Vertical (9:16)">Vertical (9:16)</SelectItem>
                  <SelectItem value="Horizontal (16:9)">Horizontal (16:9)</SelectItem>
                  <SelectItem value="Square (1:1)">Square (1:1)</SelectItem>
                </SelectContent>
              </Select>
            </div>

            {/* Active Speaker Detection */}
            <div className="space-y-2">
              <Label htmlFor="active-speaker" className="text-sm font-medium text-gray-300">
                Active Speaker Detection
                <Badge variant="secondary" className="ml-2 text-xs bg-purple-500/20 text-purple-400">Required</Badge>
              </Label>
              <Select value={config.activeSpeakerDetection || 'Yes'} onValueChange={(value) => setConfig({...config, activeSpeakerDetection: value})}>
                <SelectTrigger className="bg-gray-800 border-gray-700 text-white focus:ring-blue-500 focus:border-blue-500">
                  <SelectValue placeholder="Select option" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="Yes">Yes</SelectItem>
                  <SelectItem value="No">No</SelectItem>
                </SelectContent>
              </Select>
            </div>

            {/* Focus Subject */}
            <div className="space-y-2">
              <Label htmlFor="focus-subject" className="text-sm font-medium text-gray-300">Focus Subject</Label>
              <Input
                id="focus-subject"
                value={config.focusSubject || ''}
                onChange={(e) => setConfig({...config, focusSubject: e.target.value})}
                placeholder="person"
                className="bg-gray-800 border-gray-700 text-white placeholder:text-gray-500 focus:ring-blue-500 focus:border-blue-500"
              />
            </div>

            {/* Avoid Subject */}
            <div className="space-y-2">
              <Label htmlFor="avoid-subject" className="text-sm font-medium text-gray-300">Avoid Subject</Label>
              <Input
                id="avoid-subject"
                value={config.avoidSubject || ''}
                onChange={(e) => setConfig({...config, avoidSubject: e.target.value})}
                placeholder="logos"
                className="bg-gray-800 border-gray-700 text-white placeholder:text-gray-500 focus:ring-blue-500 focus:border-blue-500"
              />
            </div>
          </div>
        );

      case 'cut':
        return (
          <div className="space-y-6">
            {/* Cut Header */}
            <div className="flex items-center gap-3">
              <div className="w-8 h-8 bg-red-500 rounded-lg flex items-center justify-center">
                <Scissors className="h-4 w-4 text-white" />
              </div>
              <div>
                <h3 className="text-lg font-semibold text-white">Intelligent Content Cutting</h3>
                <p className="text-sm text-gray-400">Remove specific content based on instructions</p>
              </div>
            </div>

            {/* Content to Remove */}
            <div className="space-y-2">
              <Label htmlFor="content-remove" className="text-sm font-medium text-gray-300">
                Content to Remove
                <Badge variant="secondary" className="ml-2 text-xs bg-purple-500/20 text-purple-400">Required</Badge>
              </Label>
              <Textarea
                id="content-remove"
                value={config.contentToRemove || ''}
                onChange={(e) => setConfig({...config, contentToRemove: e.target.value})}
                placeholder="Remove the parts where the guy with the glasses is talking"
                className="bg-gray-800 border-gray-700 text-white placeholder:text-gray-500 focus:ring-red-500 focus:border-red-500 min-h-[80px]"
              />
              <p className="text-xs text-gray-500">Describe what content should be removed from the video</p>
            </div>
          </div>
        );

      case 'background':
        return (
          <div className="space-y-6">
            {/* Background Header */}
            <div className="flex items-center gap-3">
              <div className="w-8 h-8 bg-green-500 rounded-lg flex items-center justify-center">
                <Image className="h-4 w-4 text-white" />
              </div>
              <div>
                <h3 className="text-lg font-semibold text-white">Background Replacement</h3>
                <p className="text-sm text-gray-400">Remove or replace backgrounds with AI</p>
              </div>
            </div>

            {/* Processing Engine */}
            <div className="space-y-2">
              <Label htmlFor="processing-engine" className="text-sm font-medium text-gray-300">
                Processing Engine
                <Badge variant="secondary" className="ml-2 text-xs bg-purple-500/20 text-purple-400">Required</Badge>
              </Label>
              <Select value={config.processingEngine || 'Parallax (faster)'} onValueChange={(value) => setConfig({...config, processingEngine: value})}>
                <SelectTrigger className="bg-gray-800 border-gray-700 text-white focus:ring-green-500 focus:border-green-500">
                  <SelectValue placeholder="Select engine" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="Parallax (faster)">Parallax (faster)</SelectItem>
                  <SelectItem value="High Quality">High Quality</SelectItem>
                  <SelectItem value="Custom AI">Custom AI</SelectItem>
                </SelectContent>
              </Select>
            </div>

            {/* Background Color */}
            <div className="space-y-2">
              <Label htmlFor="background-color" className="text-sm font-medium text-gray-300">
                Background Color
                <Badge variant="secondary" className="ml-2 text-xs bg-purple-500/20 text-purple-400">Required</Badge>
              </Label>
              <div className="flex items-center gap-3">
                <input
                  type="color"
                  id="background-color"
                  value={config.backgroundColor || '#0000ff'}
                  onChange={(e) => setConfig({...config, backgroundColor: e.target.value})}
                  className="w-12 h-10 rounded border border-gray-700 cursor-pointer"
                />
                <Input
                  value={config.backgroundColor || '#0000ff'}
                  onChange={(e) => setConfig({...config, backgroundColor: e.target.value})}
                  placeholder="blue"
                  className="bg-gray-800 border-gray-700 text-white placeholder:text-gray-500 focus:ring-green-500 focus:border-green-500"
                />
              </div>
            </div>
          </div>
        );

      case 'broll':
        return (
          <div className="space-y-6">
            {/* B-Roll Header */}
            <div className="flex items-center gap-3">
              <div className="w-8 h-8 bg-indigo-500 rounded-lg flex items-center justify-center">
                <Film className="h-4 w-4 text-white" />
              </div>
              <div>
                <h3 className="text-lg font-semibold text-white">B-Roll Generator</h3>
                <p className="text-sm text-gray-400">Generate relevant supplementary footage</p>
              </div>
            </div>

            {/* Asset Types */}
            <div className="space-y-3">
              <Label className="text-sm font-medium text-gray-300">
                Asset Types
                <Badge variant="secondary" className="ml-2 text-xs bg-purple-500/20 text-purple-400">Required</Badge>
              </Label>
              <div className="flex gap-4">
                <div className="flex items-center gap-2">
                  <div className="w-4 h-4 bg-purple-500 rounded flex items-center justify-center">
                    <div className="w-2 h-2 bg-white rounded"></div>
                  </div>
                  <span className="text-white text-sm">Images</span>
                </div>
                <div className="flex items-center gap-2">
                  <div className="w-4 h-4 bg-purple-500 rounded flex items-center justify-center">
                    <div className="w-2 h-2 bg-white rounded"></div>
                  </div>
                  <span className="text-white text-sm">Videos</span>
                </div>
              </div>
            </div>

            {/* Clips per Minute */}
            <div className="space-y-3">
              <Label className="text-sm font-medium text-gray-300">
                Clips per Minute
                <Badge variant="secondary" className="ml-2 text-xs bg-purple-500/20 text-purple-400">Required</Badge>
              </Label>
              <div className="space-y-2">
                <div className="flex items-center gap-4">
                  <input
                    type="range"
                    min="0"
                    max="6"
                    value={config.clipsPerMinute || 3}
                    onChange={(e) => setConfig({...config, clipsPerMinute: parseInt(e.target.value)})}
                    className="flex-1 h-2 bg-gray-700 rounded-lg appearance-none cursor-pointer slider"
                  />
                  <span className="text-indigo-400 font-medium min-w-[1rem]">{config.clipsPerMinute || 3}</span>
                </div>
                <div className="flex justify-between text-xs text-gray-500">
                  <span>0</span>
                  <span>6</span>
                </div>
              </div>
            </div>

            {/* Style Description */}
            <div className="space-y-2">
              <Label htmlFor="style-description" className="text-sm font-medium text-gray-300">Style Description</Label>
              <Input
                id="style-description"
                value={config.styleDescription || ''}
                onChange={(e) => setConfig({...config, styleDescription: e.target.value})}
                placeholder="Smooth and cinematic shots"
                className="bg-gray-800 border-gray-700 text-white placeholder:text-gray-500 focus:ring-indigo-500 focus:border-indigo-500"
              />
            </div>

            {/* Content Focus */}
            <div className="space-y-2">
              <Label htmlFor="content-focus" className="text-sm font-medium text-gray-300">Content Focus</Label>
              <Input
                id="content-focus"
                value={config.contentFocus || ''}
                onChange={(e) => setConfig({...config, contentFocus: e.target.value})}
                placeholder="Moments they mention 'robots' and 'technology'"
                className="bg-gray-800 border-gray-700 text-white placeholder:text-gray-500 focus:ring-indigo-500 focus:border-indigo-500"
              />
            </div>
          </div>
        );

      case 'captions':
        return (
          <div className="space-y-6">
            {/* Captions Header */}
            <div className="flex items-center gap-3">
              <div className="w-8 h-8 bg-emerald-500 rounded-lg flex items-center justify-center">
                <Type className="h-4 w-4 text-white" />
              </div>
              <div>
                <h3 className="text-lg font-semibold text-white">Caption Generator</h3>
                <p className="text-sm text-gray-400">Add customizable captions that match video language</p>
              </div>
            </div>

            {/* Caption Size */}
            <div className="space-y-2">
              <Label htmlFor="caption-size" className="text-sm font-medium text-gray-300">
                Caption Size
                <Badge variant="secondary" className="ml-2 text-xs bg-purple-500/20 text-purple-400">Required</Badge>
              </Label>
              <Input
                id="caption-size"
                type="number"
                value={config.captionSize || 100}
                onChange={(e) => setConfig({...config, captionSize: parseInt(e.target.value) || 100})}
                placeholder="100"
                className="bg-gray-800 border-gray-700 text-white placeholder:text-gray-500 focus:ring-emerald-500 focus:border-emerald-500"
              />
            </div>

            {/* Highlight Color */}
            <div className="space-y-2">
              <Label htmlFor="highlight-color" className="text-sm font-medium text-gray-300">
                Highlight Color
                <Badge variant="secondary" className="ml-2 text-xs bg-purple-500/20 text-purple-400">Required</Badge>
              </Label>
              <div className="flex items-center gap-3">
                <input
                  type="color"
                  id="highlight-color"
                  value={config.highlightColor || '#00ff00'}
                  onChange={(e) => setConfig({...config, highlightColor: e.target.value})}
                  className="w-12 h-10 rounded border border-gray-700 cursor-pointer"
                />
                <Input
                  value={config.highlightColor || '#00ff00'}
                  onChange={(e) => setConfig({...config, highlightColor: e.target.value})}
                  placeholder="Green"
                  className="bg-gray-800 border-gray-700 text-white placeholder:text-gray-500 focus:ring-emerald-500 focus:border-emerald-500"
                />
              </div>
            </div>
          </div>
        );

      case 'music':
        return (
          <div className="space-y-6">
            {/* Music Header */}
            <div className="flex items-center gap-3">
              <div className="w-8 h-8 bg-violet-500 rounded-lg flex items-center justify-center">
                <Music className="h-4 w-4 text-white" />
              </div>
              <div>
                <h3 className="text-lg font-semibold text-white">Music Generator</h3>
                <p className="text-sm text-gray-400">Generate custom background music</p>
              </div>
            </div>

            {/* Music Style */}
            <div className="space-y-2">
              <Label htmlFor="music-style" className="text-sm font-medium text-gray-300">Music Style</Label>
              <Input
                id="music-style"
                value={config.musicStyle || ''}
                onChange={(e) => setConfig({...config, musicStyle: e.target.value})}
                placeholder="Cinematic like theme music"
                className="bg-gray-800 border-gray-700 text-white placeholder:text-gray-500 focus:ring-violet-500 focus:border-violet-500"
              />
              <p className="text-xs text-gray-500">Describe the style and mood of background music</p>
            </div>
          </div>
        );

      case 'youtube_shorts':
        return (
          <div className="space-y-4">
            <div>
              <Label htmlFor="aspect-ratio">Aspect Ratio</Label>
              <Select value={config.aspectRatio || '9:16'} onValueChange={(value) => setConfig({...config, aspectRatio: value})}>
                <SelectTrigger>
                  <SelectValue placeholder="Select aspect ratio" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="9:16">9:16 (Vertical - Shorts)</SelectItem>
                  <SelectItem value="16:9">16:9 (Horizontal)</SelectItem>
                  <SelectItem value="1:1">1:1 (Square)</SelectItem>
                </SelectContent>
              </Select>
            </div>
            <div>
              <Label htmlFor="duration">Target Duration (seconds)</Label>
              <Input
                id="duration"
                type="number"
                value={config.duration || 30}
                onChange={(e) => setConfig({...config, duration: parseInt(e.target.value)})}
                min="15"
                max="60"
              />
            </div>
            <div>
              <Label htmlFor="story-input">Story/Script Input</Label>
              <Textarea
                id="story-input"
                value={config.story || ''}
                onChange={(e) => setConfig({...config, story: e.target.value})}
                placeholder="Enter your story or script for the short video..."
                rows={4}
              />
            </div>
            <div className="flex items-center space-x-2">
              <Switch
                id="auto-crop"
                checked={config.autoCrop || false}
                onCheckedChange={(checked) => setConfig({...config, autoCrop: checked})}
              />
              <Label htmlFor="auto-crop">Auto-crop to focus on subjects</Label>
            </div>
          </div>
        );

      case 'translate':
        return (
          <div className="space-y-4">
            <div>
              <Label htmlFor="source-lang">Source Language</Label>
              <Select value={config.sourceLanguage || 'auto'} onValueChange={(value) => setConfig({...config, sourceLanguage: value})}>
                <SelectTrigger>
                  <SelectValue placeholder="Select source language" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="auto">Auto-detect</SelectItem>
                  <SelectItem value="en">English</SelectItem>
                  <SelectItem value="es">Spanish</SelectItem>
                  <SelectItem value="fr">French</SelectItem>
                  <SelectItem value="de">German</SelectItem>
                  <SelectItem value="zh">Chinese</SelectItem>
                  <SelectItem value="ja">Japanese</SelectItem>
                  <SelectItem value="ko">Korean</SelectItem>
                </SelectContent>
              </Select>
            </div>
            <div>
              <Label htmlFor="target-lang">Target Language</Label>
              <Select value={config.targetLanguage || 'es'} onValueChange={(value) => setConfig({...config, targetLanguage: value})}>
                <SelectTrigger>
                  <SelectValue placeholder="Select target language" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="en">English</SelectItem>
                  <SelectItem value="es">Spanish</SelectItem>
                  <SelectItem value="fr">French</SelectItem>
                  <SelectItem value="de">German</SelectItem>
                  <SelectItem value="zh">Chinese</SelectItem>
                  <SelectItem value="ja">Japanese</SelectItem>
                  <SelectItem value="ko">Korean</SelectItem>
                  <SelectItem value="hi">Hindi</SelectItem>
                  <SelectItem value="pt">Portuguese</SelectItem>
                  <SelectItem value="it">Italian</SelectItem>
                </SelectContent>
              </Select>
            </div>
            <div className="flex items-center space-x-2">
              <Switch
                id="preserve-timing"
                checked={config.preserveTiming || true}
                onCheckedChange={(checked) => setConfig({...config, preserveTiming: checked})}
              />
              <Label htmlFor="preserve-timing">Preserve original timing</Label>
            </div>
          </div>
        );

      case 'subtitle':
        return (
          <div className="space-y-4">
            <div>
              <Label htmlFor="subtitle-style">Subtitle Style</Label>
              <Select value={config.subtitleStyle || 'youtube_gaming'} onValueChange={(value) => setConfig({...config, subtitleStyle: value})}>
                <SelectTrigger>
                  <SelectValue placeholder="Select subtitle style" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="youtube_gaming">YouTube Gaming</SelectItem>
                  <SelectItem value="tiktok_viral">TikTok Viral</SelectItem>
                  <SelectItem value="instagram_modern">Instagram Modern</SelectItem>
                  <SelectItem value="professional_clean">Professional Clean</SelectItem>
                  <SelectItem value="neon_glow">Neon Glow</SelectItem>
                  <SelectItem value="bold_impact">Bold Impact</SelectItem>
                </SelectContent>
              </Select>
            </div>
            <div>
              <Label htmlFor="subtitle-position">Position</Label>
              <Select value={config.position || 'bottom'} onValueChange={(value) => setConfig({...config, position: value})}>
                <SelectTrigger>
                  <SelectValue placeholder="Select position" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="top">Top</SelectItem>
                  <SelectItem value="center">Center</SelectItem>
                  <SelectItem value="bottom">Bottom</SelectItem>
                </SelectContent>
              </Select>
            </div>
            <div>
              <Label htmlFor="font-size">Font Size</Label>
              <Input
                id="font-size"
                type="number"
                value={config.fontSize || 45}
                onChange={(e) => setConfig({...config, fontSize: parseInt(e.target.value)})}
                min="20"
                max="80"
              />
            </div>
            <div className="flex items-center space-x-2">
              <Switch
                id="word-highlight"
                checked={config.wordHighlight || true}
                onCheckedChange={(checked) => setConfig({...config, wordHighlight: checked})}
              />
              <Label htmlFor="word-highlight">Word-level highlighting</Label>
            </div>
          </div>
        );

      case 'share':
        return (
          <div className="space-y-4">
            <div>
              <Label>Target Platforms</Label>
              <div className="grid grid-cols-2 gap-2 mt-2">
                {['YouTube', 'Instagram', 'TikTok', 'Twitter', 'Facebook', 'LinkedIn'].map((platform) => (
                  <div key={platform} className="flex items-center space-x-2">
                    <input
                      type="checkbox"
                      id={platform}
                      checked={config.platforms?.includes(platform) || false}
                      onChange={(e) => {
                        const platforms = config.platforms || [];
                        if (e.target.checked) {
                          setConfig({...config, platforms: [...platforms, platform]});
                        } else {
                          setConfig({...config, platforms: platforms.filter((p: string) => p !== platform)});
                        }
                      }}
                    />
                    <Label htmlFor={platform}>{platform}</Label>
                  </div>
                ))}
              </div>
            </div>
            <div>
              <Label htmlFor="video-title">Video Title</Label>
              <Input
                id="video-title"
                value={config.title || ''}
                onChange={(e) => setConfig({...config, title: e.target.value})}
                placeholder="Enter engaging title"
              />
            </div>
            <div>
              <Label htmlFor="description">Description</Label>
              <Textarea
                id="description"
                value={config.description || ''}
                onChange={(e) => setConfig({...config, description: e.target.value})}
                placeholder="Enter video description with hashtags..."
                rows={4}
              />
            </div>
            <div className="flex items-center space-x-2">
              <Switch
                id="viral-optimization"
                checked={config.viralOptimization || true}
                onCheckedChange={(checked) => setConfig({...config, viralOptimization: checked})}
              />
              <Label htmlFor="viral-optimization">Generate viral thumbnails</Label>
            </div>
            <div className="flex items-center space-x-2">
              <Switch
                id="hashtag-generation"
                checked={config.hashtagGeneration || true}
                onCheckedChange={(checked) => setConfig({...config, hashtagGeneration: checked})}
              />
              <Label htmlFor="hashtag-generation">Auto-generate trending hashtags</Label>
            </div>
          </div>
        );

      case 'end':
        return (
          <div className="space-y-4">
            <div>
              <Label htmlFor="output-format">Output Format</Label>
              <Select value={config.outputFormat || 'mp4'} onValueChange={(value) => setConfig({...config, outputFormat: value})}>
                <SelectTrigger>
                  <SelectValue placeholder="Select output format" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="mp4">MP4 (H.264)</SelectItem>
                  <SelectItem value="mov">MOV</SelectItem>
                  <SelectItem value="avi">AVI</SelectItem>
                  <SelectItem value="webm">WebM</SelectItem>
                </SelectContent>
              </Select>
            </div>
            <div>
              <Label htmlFor="quality">Quality</Label>
              <Select value={config.quality || 'high'} onValueChange={(value) => setConfig({...config, quality: value})}>
                <SelectTrigger>
                  <SelectValue placeholder="Select quality" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="low">Low (480p)</SelectItem>
                  <SelectItem value="medium">Medium (720p)</SelectItem>
                  <SelectItem value="high">High (1080p)</SelectItem>
                  <SelectItem value="ultra">Ultra (4K)</SelectItem>
                </SelectContent>
              </Select>
            </div>
            <div className="flex items-center space-x-2">
              <Switch
                id="auto-download"
                checked={config.autoDownload || false}
                onCheckedChange={(checked) => setConfig({...config, autoDownload: checked})}
              />
              <Label htmlFor="auto-download">Auto-download when complete</Label>
            </div>
          </div>
        );

      default:
        return <div>No configuration available for this node type.</div>;
    }
  };

  return (
    <Dialog open={isOpen} onOpenChange={onClose}>
      <DialogContent className="max-w-lg bg-gray-950 border-gray-800">
        <DialogHeader className="border-b border-gray-800 pb-4">
          <DialogTitle className="text-xl font-semibold text-white flex items-center gap-2">
            <div className="w-8 h-8 bg-purple-500 rounded-lg flex items-center justify-center">
              <Settings className="h-4 w-4 text-white" />
            </div>
            Configure {nodeType ? (nodeType.charAt(0).toUpperCase() + nodeType.slice(1)) : 'Node'} Configuration
          </DialogTitle>
        </DialogHeader>
        
        <div className="py-4">
          {renderConfigFields()}
        </div>

        <DialogFooter className="border-t border-gray-800 pt-4">
          <Button
            variant="outline"
            onClick={onClose}
            className="border-gray-700 text-gray-300 hover:bg-gray-800"
          >
            Cancel
          </Button>
          <Button
            onClick={handleSave}
            className="bg-purple-600 hover:bg-purple-700 text-white"
          >
            Save Configuration
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}