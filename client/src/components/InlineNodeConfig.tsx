import React from 'react';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Textarea } from '@/components/ui/textarea';
import { Switch } from '@/components/ui/switch';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Upload, Search, Mic, Volume2, Eye, Crop, Scissors, Image, Film, Type, Music } from 'lucide-react';

interface InlineNodeConfigProps {
  nodeType: string;
  config: any;
  setConfig: (config: any) => void;
}

export const InlineNodeConfig: React.FC<InlineNodeConfigProps> = ({ nodeType, config, setConfig }) => {
  switch (nodeType) {
    case 'start':
      return (
        <div className="space-y-3 mt-3 p-3 bg-gray-50 dark:bg-gray-800 rounded-lg border">
          <div className="flex items-center gap-2">
            <Upload className="h-4 w-4 text-green-600" />
            <Label className="text-sm font-medium text-gray-700 dark:text-gray-300">Video Input</Label>
          </div>
          <div className="space-y-2">
            <Input
              type="file"
              accept="video/*"
              onChange={(e) => {
                const file = e.target.files?.[0];
                if (file) setConfig({ ...config, videoFile: file, fileName: file.name });
              }}
              className="text-xs"
            />
            {config.fileName && (
              <div className="text-xs text-gray-600 dark:text-gray-400">
                Selected: {config.fileName}
              </div>
            )}
          </div>
        </div>
      );

    case 'shorts':
      return (
        <div className="space-y-3 mt-3 p-3 bg-gray-50 dark:bg-gray-800 rounded-lg border">
          <div className="flex items-center gap-2">
            <Search className="h-4 w-4 text-orange-600" />
            <Label className="text-sm font-medium text-gray-700 dark:text-gray-300">Viral Extraction</Label>
          </div>
          <div className="space-y-2">
            <Input
              value={config.searchPhrases || ''}
              onChange={(e) => setConfig({ ...config, searchPhrases: e.target.value })}
              placeholder="most viral moments"
              className="text-xs"
            />
            <div className="flex items-center justify-between">
              <Label htmlFor="viral-moments" className="text-xs text-gray-600 dark:text-gray-400">
                Target Viral Moments
              </Label>
              <Switch
                id="viral-moments"
                checked={config.targetViralMoments !== false}
                onCheckedChange={(checked) => setConfig({ ...config, targetViralMoments: checked })}
              />
            </div>
            <div className="flex justify-between text-xs text-gray-500">
              <span>5 Max Clips</span>
              <span>30s Clip Length</span>
            </div>
          </div>
        </div>
      );

    case 'voice':
      return (
        <div className="space-y-3 mt-3 p-3 bg-gray-50 dark:bg-gray-800 rounded-lg border">
          <div className="flex items-center gap-2">
            <Mic className="h-4 w-4 text-pink-600" />
            <Label className="text-sm font-medium text-gray-700 dark:text-gray-300">Voice Translation</Label>
          </div>
          <div className="space-y-2">
            <Select value={config.targetLanguage || 'Spanish'} onValueChange={(value) => setConfig({...config, targetLanguage: value})}>
              <SelectTrigger className="text-xs">
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
            <Input
              value={config.safewords || ''}
              onChange={(e) => setConfig({...config, safewords: e.target.value})}
              placeholder="OpenAI, coffee"
              className="text-xs"
            />
            <div className="flex items-center justify-between">
              <Label htmlFor="preserve-audio" className="text-xs text-gray-600 dark:text-gray-400">
                Preserve Background
              </Label>
              <Switch
                id="preserve-audio"
                checked={config.preserveBackgroundAudio !== false}
                onCheckedChange={(checked) => setConfig({...config, preserveBackgroundAudio: checked})}
              />
            </div>
          </div>
        </div>
      );

    case 'audio_enhance':
      return (
        <div className="space-y-3 mt-3 p-3 bg-gray-50 dark:bg-gray-800 rounded-lg border">
          <div className="flex items-center gap-2">
            <Volume2 className="h-4 w-4 text-yellow-600" />
            <Label className="text-sm font-medium text-gray-700 dark:text-gray-300">Audio Enhancement</Label>
          </div>
          <div className="space-y-2">
            <Select value={config.processingBackend || 'Audiophonic'} onValueChange={(value) => setConfig({...config, processingBackend: value})}>
              <SelectTrigger className="text-xs">
                <SelectValue placeholder="Select backend" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="Audiophonic">Audiophonic</SelectItem>
                <SelectItem value="Adobe">Adobe Enhance</SelectItem>
                <SelectItem value="Custom">Custom AI Model</SelectItem>
              </SelectContent>
            </Select>
            <Select value={config.enhancementType || 'Enhance & Denoise'} onValueChange={(value) => setConfig({...config, enhancementType: value})}>
              <SelectTrigger className="text-xs">
                <SelectValue placeholder="Select type" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="Enhance & Denoise">Enhance & Denoise</SelectItem>
                <SelectItem value="Noise Reduction">Noise Reduction Only</SelectItem>
                <SelectItem value="Audio Enhance">Audio Enhance Only</SelectItem>
              </SelectContent>
            </Select>
            <div className="space-y-1">
              <div className="flex items-center justify-between">
                <Label className="text-xs text-gray-600 dark:text-gray-400">Enhancement Steps</Label>
                <span className="text-xs text-yellow-600 font-medium">{config.enhancementSteps || 75}</span>
              </div>
              <input
                type="range"
                min="0"
                max="100"
                value={config.enhancementSteps || 75}
                onChange={(e) => setConfig({...config, enhancementSteps: parseInt(e.target.value)})}
                className="w-full h-1 bg-gray-300 rounded-lg appearance-none cursor-pointer"
              />
            </div>
          </div>
        </div>
      );

    case 'eye_contact':
      return (
        <div className="space-y-3 mt-3 p-3 bg-gray-50 dark:bg-gray-800 rounded-lg border">
          <div className="flex items-center gap-2">
            <Eye className="h-4 w-4 text-purple-600" />
            <Label className="text-sm font-medium text-gray-700 dark:text-gray-300">Eye Contact Correction</Label>
          </div>
          <div className="space-y-2">
            <Select value={config.accuracyBoost || 'Yes'} onValueChange={(value) => setConfig({...config, accuracyBoost: value})}>
              <SelectTrigger className="text-xs">
                <SelectValue placeholder="Accuracy Boost" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="Yes">Yes</SelectItem>
                <SelectItem value="No">No</SelectItem>
              </SelectContent>
            </Select>
            <Select value={config.naturalLookAway || 'No'} onValueChange={(value) => setConfig({...config, naturalLookAway: value})}>
              <SelectTrigger className="text-xs">
                <SelectValue placeholder="Natural Look Away" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="Yes">Yes</SelectItem>
                <SelectItem value="No">No</SelectItem>
              </SelectContent>
            </Select>
          </div>
        </div>
      );

    case 'reframe':
      return (
        <div className="space-y-3 mt-3 p-3 bg-gray-50 dark:bg-gray-800 rounded-lg border">
          <div className="flex items-center gap-2">
            <Crop className="h-4 w-4 text-blue-600" />
            <Label className="text-sm font-medium text-gray-700 dark:text-gray-300">Smart Reframing</Label>
          </div>
          <div className="space-y-2">
            <Select value={config.aspectRatio || 'Vertical (9:16)'} onValueChange={(value) => setConfig({...config, aspectRatio: value})}>
              <SelectTrigger className="text-xs">
                <SelectValue placeholder="Aspect Ratio" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="Vertical (9:16)">Vertical (9:16)</SelectItem>
                <SelectItem value="Horizontal (16:9)">Horizontal (16:9)</SelectItem>
                <SelectItem value="Square (1:1)">Square (1:1)</SelectItem>
              </SelectContent>
            </Select>
            <Input
              value={config.focusSubject || ''}
              onChange={(e) => setConfig({...config, focusSubject: e.target.value})}
              placeholder="Focus Subject (person)"
              className="text-xs"
            />
            <Input
              value={config.avoidSubject || ''}
              onChange={(e) => setConfig({...config, avoidSubject: e.target.value})}
              placeholder="Avoid Subject (logos)"
              className="text-xs"
            />
          </div>
        </div>
      );

    case 'cut':
      return (
        <div className="space-y-3 mt-3 p-3 bg-gray-50 dark:bg-gray-800 rounded-lg border">
          <div className="flex items-center gap-2">
            <Scissors className="h-4 w-4 text-red-600" />
            <Label className="text-sm font-medium text-gray-700 dark:text-gray-300">Content Cutting</Label>
          </div>
          <Textarea
            value={config.contentToRemove || ''}
            onChange={(e) => setConfig({...config, contentToRemove: e.target.value})}
            placeholder="Remove the parts where the guy with the glasses is talking"
            className="text-xs min-h-[60px]"
          />
        </div>
      );

    case 'background':
      return (
        <div className="space-y-3 mt-3 p-3 bg-gray-50 dark:bg-gray-800 rounded-lg border">
          <div className="flex items-center gap-2">
            <Image className="h-4 w-4 text-green-600" />
            <Label className="text-sm font-medium text-gray-700 dark:text-gray-300">Background Replacement</Label>
          </div>
          <div className="space-y-2">
            <Select value={config.processingEngine || 'Parallax (faster)'} onValueChange={(value) => setConfig({...config, processingEngine: value})}>
              <SelectTrigger className="text-xs">
                <SelectValue placeholder="Processing Engine" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="Parallax (faster)">Parallax (faster)</SelectItem>
                <SelectItem value="High Quality">High Quality</SelectItem>
                <SelectItem value="Custom AI">Custom AI</SelectItem>
              </SelectContent>
            </Select>
            <div className="flex items-center gap-2">
              <input
                type="color"
                value={config.backgroundColor || '#0000ff'}
                onChange={(e) => setConfig({...config, backgroundColor: e.target.value})}
                className="w-8 h-8 rounded border border-gray-300 cursor-pointer"
              />
              <Input
                value={config.backgroundColor || '#0000ff'}
                onChange={(e) => setConfig({...config, backgroundColor: e.target.value})}
                placeholder="blue"
                className="text-xs flex-1"
              />
            </div>
          </div>
        </div>
      );

    case 'broll':
      return (
        <div className="space-y-3 mt-3 p-3 bg-gray-50 dark:bg-gray-800 rounded-lg border">
          <div className="flex items-center gap-2">
            <Film className="h-4 w-4 text-indigo-600" />
            <Label className="text-sm font-medium text-gray-700 dark:text-gray-300">B-Roll Generator</Label>
          </div>
          <div className="space-y-2">
            <div className="space-y-1">
              <div className="flex items-center justify-between">
                <Label className="text-xs text-gray-600 dark:text-gray-400">Clips per Minute</Label>
                <span className="text-xs text-indigo-600 font-medium">{config.clipsPerMinute || 3}</span>
              </div>
              <input
                type="range"
                min="0"
                max="6"
                value={config.clipsPerMinute || 3}
                onChange={(e) => setConfig({...config, clipsPerMinute: parseInt(e.target.value)})}
                className="w-full h-1 bg-gray-300 rounded-lg appearance-none cursor-pointer"
              />
            </div>
            <Input
              value={config.styleDescription || ''}
              onChange={(e) => setConfig({...config, styleDescription: e.target.value})}
              placeholder="Smooth and cinematic shots"
              className="text-xs"
            />
            <Input
              value={config.contentFocus || ''}
              onChange={(e) => setConfig({...config, contentFocus: e.target.value})}
              placeholder="Moments they mention 'robots'"
              className="text-xs"
            />
          </div>
        </div>
      );

    case 'captions':
      return (
        <div className="space-y-3 mt-3 p-3 bg-gray-50 dark:bg-gray-800 rounded-lg border">
          <div className="flex items-center gap-2">
            <Type className="h-4 w-4 text-emerald-600" />
            <Label className="text-sm font-medium text-gray-700 dark:text-gray-300">Caption Generator</Label>
          </div>
          <div className="space-y-2">
            <Input
              type="number"
              value={config.captionSize || 100}
              onChange={(e) => setConfig({...config, captionSize: parseInt(e.target.value) || 100})}
              placeholder="Caption Size (100)"
              className="text-xs"
            />
            <div className="flex items-center gap-2">
              <input
                type="color"
                value={config.highlightColor || '#00ff00'}
                onChange={(e) => setConfig({...config, highlightColor: e.target.value})}
                className="w-8 h-8 rounded border border-gray-300 cursor-pointer"
              />
              <Input
                value={config.highlightColor || '#00ff00'}
                onChange={(e) => setConfig({...config, highlightColor: e.target.value})}
                placeholder="Green"
                className="text-xs flex-1"
              />
            </div>
          </div>
        </div>
      );

    case 'music':
      return (
        <div className="space-y-3 mt-3 p-3 bg-gray-50 dark:bg-gray-800 rounded-lg border">
          <div className="flex items-center gap-2">
            <Music className="h-4 w-4 text-violet-600" />
            <Label className="text-sm font-medium text-gray-700 dark:text-gray-300">Music Generator</Label>
          </div>
          <Input
            value={config.musicStyle || ''}
            onChange={(e) => setConfig({...config, musicStyle: e.target.value})}
            placeholder="Cinematic like theme music"
            className="text-xs"
          />
        </div>
      );

    default:
      return null;
  }
};