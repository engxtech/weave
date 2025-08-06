import React, { useState, useCallback, memo, useEffect } from 'react';
import { Card, CardContent } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Textarea } from '@/components/ui/textarea';
import { Switch } from '@/components/ui/switch';
import { 
  Play, 
  Settings, 
  MoreVertical, 
  Video, 
  Languages, 
  FileText, 
  Share, 
  Download,
  Youtube,
  CheckCircle,
  AlertCircle,
  Loader2,
  ChevronDown,
  ChevronUp,
  Upload,
  Search,
  Zap,
  Mic,
  Volume2,
  Eye,
  Crop,
  Scissors,
  Image,
  Film,
  Type,
  Music,
  Sparkles,
  Plus,
  Trash2
} from 'lucide-react';
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu';
import { BRollCard } from './BRollCard';

interface ConfigurableFlowNodeProps {
  id: string;
  type: 'start' | 'enhancement' | 'shorts' | 'voice' | 'audio_enhance' | 'eye_contact' | 'reframe' | 'cut' | 'background' | 'broll' | 'captions' | 'music' | 'youtube_shorts' | 'translate' | 'subtitle' | 'share' | 'end';
  position: { x: number; y: number };
  data: {
    label: string;
    config?: any;
  };
  isSelected?: boolean;
  isExecuting?: boolean;
  isDragging?: boolean;
  isConnecting?: boolean;
  executionStatus?: 'idle' | 'running' | 'success' | 'error';
  onDragStart?: (nodeId: string, e: React.MouseEvent) => void;
  onConfigure?: (nodeId: string) => void;
  onExecute?: (nodeId: string) => void;
  onDelete?: (nodeId: string) => void;
  onDuplicate?: (nodeId: string) => void;
  onPreview?: (nodeId: string) => void;
  onStartConnection?: (nodeId: string, handle: 'input' | 'output', e: React.MouseEvent) => void;
  onCompleteConnection?: (nodeId: string, handle: 'input' | 'output') => void;
  onConfigChange?: (nodeId: string, config: any) => void;
}

const getNodeIcon = (type: string) => {
  switch (type) {
    case 'start': return Video;
    case 'enhancement': return Sparkles;
    case 'shorts': return Zap;
    case 'voice': return Mic;
    case 'audio_enhance': return Volume2;
    case 'eye_contact': return Eye;
    case 'reframe': return Crop;
    case 'cut': return Scissors;
    case 'background': return Image;
    case 'broll': return Film;
    case 'captions': return Type;
    case 'music': return Music;
    case 'youtube_shorts': return Youtube;
    case 'translate': return Languages;
    case 'subtitle': return FileText;
    case 'share': return Share;
    case 'end': return Download;
    default: return Video;
  }
};

const getNodeTheme = (type: string) => {
  const themes: Record<string, { primary: string; secondary: string; background: string; border: string }> = {
    start: { primary: '#10B981', secondary: '#047857', background: '#F0FDF4', border: '#10B981' },
    enhancement: { primary: '#9333ea', secondary: '#7c3aed', background: '#f3e8ff', border: '#9333ea' },
    shorts: { primary: '#F97316', secondary: '#EA580C', background: '#FFF7ED', border: '#F97316' },
    voice: { primary: '#EC4899', secondary: '#BE185D', background: '#FDF2F8', border: '#EC4899' },
    audio_enhance: { primary: '#EAB308', secondary: '#CA8A04', background: '#FEFCE8', border: '#EAB308' },
    eye_contact: { primary: '#8B5CF6', secondary: '#7C3AED', background: '#F3F4F6', border: '#8B5CF6' },
    reframe: { primary: '#0EA5E9', secondary: '#0284C7', background: '#F0F9FF', border: '#0EA5E9' },
    cut: { primary: '#EF4444', secondary: '#DC2626', background: '#FEF2F2', border: '#EF4444' },
    background: { primary: '#10B981', secondary: '#059669', background: '#F0FDF4', border: '#10B981' },
    broll: { primary: '#6366F1', secondary: '#4F46E5', background: '#EEF2FF', border: '#6366F1' },
    captions: { primary: '#059669', secondary: '#047857', background: '#F0FDF4', border: '#059669' },
    music: { primary: '#8B5CF6', secondary: '#7C3AED', background: '#F5F3FF', border: '#8B5CF6' },
    youtube_shorts: { primary: '#EF4444', secondary: '#DC2626', background: '#FEF2F2', border: '#EF4444' },
    translate: { primary: '#3B82F6', secondary: '#1D4ED8', background: '#EFF6FF', border: '#3B82F6' },
    subtitle: { primary: '#8B5CF6', secondary: '#7C3AED', background: '#F5F3FF', border: '#8B5CF6' },
    share: { primary: '#10B981', secondary: '#047857', background: '#F0FDF4', border: '#10B981' },
    end: { primary: '#F59E0B', secondary: '#D97706', background: '#FFFBEB', border: '#F59E0B' }
  };
  return themes[type] || themes.start;
};

const ConfigurableFlowNode: React.FC<ConfigurableFlowNodeProps> = memo(({
  id, 
  type, 
  position, 
  data, 
  isSelected, 
  isExecuting, 
  isDragging,
  isConnecting,
  executionStatus = 'idle',
  onDragStart,
  onConfigure,
  onExecute,
  onDelete,
  onDuplicate,
  onPreview,
  onStartConnection,
  onCompleteConnection,
  onConfigChange
}) => {
  const [isConfigExpanded, setIsConfigExpanded] = useState(false);
  const [config, setConfig] = useState(data?.config || {});
  
  // Update config when data.config changes
  useEffect(() => {
    setConfig(data?.config || {});
  }, [data?.config]);
  
  const Icon = getNodeIcon(type);
  const theme = getNodeTheme(type);

  const handleMouseDown = useCallback((e: React.MouseEvent) => {
    // Don't start drag if clicking on input elements
    const target = e.target as HTMLElement;
    if (target.tagName === 'INPUT' || 
        target.tagName === 'TEXTAREA' || 
        target.tagName === 'SELECT' ||
        target.tagName === 'BUTTON' ||
        target.closest('input') ||
        target.closest('textarea') ||
        target.closest('select') ||
        target.closest('button')) {
      return;
    }
    e.preventDefault();
    onDragStart?.(id, e);
  }, [id, onDragStart]);

  const handleInputConnection = useCallback((e: React.MouseEvent) => {
    e.stopPropagation();
    if (isConnecting) {
      onCompleteConnection?.(id, 'input');
    } else {
      onStartConnection?.(id, 'input', e);
    }
  }, [id, isConnecting, onStartConnection, onCompleteConnection]);

  const handleOutputConnection = useCallback((e: React.MouseEvent) => {
    e.stopPropagation();
    if (isConnecting) {
      onCompleteConnection?.(id, 'output');
    } else {
      onStartConnection?.(id, 'output', e);
    }
  }, [id, isConnecting, onStartConnection, onCompleteConnection]);

  const handleConfigChange = useCallback((newConfig: any) => {
    setConfig(newConfig);
    onConfigChange?.(id, newConfig);
  }, [id, onConfigChange]);

  const getStatusIcon = () => {
    switch (executionStatus) {
      case 'running':
        return <Loader2 className="h-3 w-3 animate-spin text-blue-500" />;
      case 'success':
        return <CheckCircle className="h-3 w-3 text-green-500" />;
      case 'error':
        return <AlertCircle className="h-3 w-3 text-red-500" />;
      default:
        return null;
    }
  };

  const renderInlineConfig = () => {
    switch (type) {
      case 'start':
        return (
          <div className="space-y-3 p-3 bg-[#0f0f0f] rounded-lg border border-[#3a3a3a]">
            <div className="flex items-center gap-2">
              <Upload className="h-4 w-4 text-green-600" />
              <Label className="text-sm font-medium text-white">Video Input</Label>
            </div>
            <Input
              type="file"
              accept="video/*"
              onChange={async (e) => {
                const file = e.target.files?.[0];
                if (file) {
                  // Update UI immediately
                  handleConfigChange({ ...config, fileName: file.name, uploadStatus: 'uploading' });
                  
                  try {
                    // Upload to server
                    const formData = new FormData();
                    formData.append('video', file);
                    
                    const response = await fetch('/api/upload/video', {
                      method: 'POST',
                      body: formData
                    });
                    
                    if (response.ok) {
                      const data = await response.json();
                      handleConfigChange({ 
                        ...config, 
                        fileName: file.name,
                        videoPath: data.path,
                        uploadStatus: 'completed'
                      });
                    } else {
                      handleConfigChange({ ...config, uploadStatus: 'error' });
                      alert('Failed to upload video');
                    }
                  } catch (error) {
                    console.error('Upload error:', error);
                    handleConfigChange({ ...config, uploadStatus: 'error' });
                    alert('Error uploading video');
                  }
                }
              }}
              className="text-xs"
              disabled={config.uploadStatus === 'uploading'}
            />
            {config.fileName && (
              <div className="text-xs text-gray-400">
                {config.uploadStatus === 'uploading' && 'Uploading... '}
                {config.uploadStatus === 'completed' && '✓ '}
                {config.fileName}
              </div>
            )}
          </div>
        );

      case 'shorts':
        return (
          <div className="space-y-3 p-3 bg-gray-50 dark:bg-gray-800 rounded-lg border">
            <div className="flex items-center gap-2">
              <Search className="h-4 w-4 text-orange-600" />
              <Label className="text-sm font-medium text-gray-700 dark:text-gray-300">Viral Extraction</Label>
            </div>
            {/* Model Selection */}
            <div>
              <Label htmlFor={`model-${id}`} className="text-xs text-gray-600 dark:text-gray-400">AI Model</Label>
              <Select
                value={config.aiModel || 'gemini-2.0-flash-lite'}
                onValueChange={(value) => handleConfigChange({ ...config, aiModel: value })}
              >
                <SelectTrigger id={`model-${id}`} className="text-xs">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="gemini-2.0-flash-lite">Gemini 2.0 Flash-Lite (Fastest)</SelectItem>
                  <SelectItem value="gemini-2.0-flash-exp">Gemini 2.0 Flash (Balanced)</SelectItem>
                  <SelectItem value="gemini-1.5-flash">Gemini 1.5 Flash (Legacy)</SelectItem>
                  <SelectItem value="gemini-1.5-pro">Gemini 1.5 Pro (High Quality)</SelectItem>
                </SelectContent>
              </Select>
            </div>
            <div 
              className="editable-area"
              onMouseDown={(e) => e.stopPropagation()}
              onMouseMove={(e) => e.stopPropagation()}
              onMouseUp={(e) => e.stopPropagation()}
            >
              <Label htmlFor={`ai-instructions-${id}`} className="text-xs text-gray-600 dark:text-gray-400">AI Instructions</Label>
              <textarea
                id={`ai-instructions-${id}`}
                value={config.extractionDescription || ''}
                onChange={(e) => {
                  const newValue = e.target.value;
                  handleConfigChange({ 
                    ...config, 
                    extractionDescription: newValue
                  });
                }}
                onMouseDown={(e) => e.stopPropagation()}
                onClick={(e) => e.stopPropagation()}
                onFocus={(e) => e.stopPropagation()}
                placeholder="Describe what type of short to extract (e.g., 'funny moments', 'motivational highlights', 'action sequences')"
                className="w-full mt-1 bg-white dark:bg-gray-900 border border-gray-200 dark:border-gray-700 text-gray-900 dark:text-gray-100 rounded-md p-2 text-xs min-h-[60px] resize-none focus:outline-none focus:ring-2 focus:ring-purple-500"
              />
            </div>
            <div 
              className="editable-area"
              onMouseDown={(e) => e.stopPropagation()}
              onMouseMove={(e) => e.stopPropagation()}
              onMouseUp={(e) => e.stopPropagation()}
            >
              <Label htmlFor={`search-keywords-${id}`} className="text-xs text-gray-600 dark:text-gray-400">Search Keywords (optional)</Label>
              <input
                id={`search-keywords-${id}`}
                type="text"
                value={config.searchPhrases || ''}
                onChange={(e) => {
                  const newValue = e.target.value;
                  handleConfigChange({ 
                    ...config, 
                    searchPhrases: newValue 
                  });
                }}
                onMouseDown={(e) => e.stopPropagation()}
                onClick={(e) => e.stopPropagation()}
                onFocus={(e) => e.stopPropagation()}
                placeholder="Enter specific keywords"
                className="w-full mt-1 bg-white dark:bg-gray-900 border border-gray-200 dark:border-gray-700 text-gray-900 dark:text-gray-100 rounded-md px-3 py-1.5 text-xs focus:outline-none focus:ring-2 focus:ring-purple-500"
              />
            </div>
            <div>
              <Label htmlFor={`duration-${id}`} className="text-xs text-gray-600 dark:text-gray-400">Short Duration (seconds)</Label>
              <Select
                value={config.duration?.toString() || '30'}
                onValueChange={(value) => handleConfigChange({ ...config, duration: parseInt(value) })}
              >
                <SelectTrigger id={`duration-${id}`} className="text-xs">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="5">5 seconds</SelectItem>
                  <SelectItem value="15">15 seconds</SelectItem>
                  <SelectItem value="30">30 seconds</SelectItem>
                  <SelectItem value="45">45 seconds</SelectItem>
                  <SelectItem value="60">60 seconds</SelectItem>
                </SelectContent>
              </Select>
            </div>
            <div className="flex items-center justify-between">
              <Label className="text-xs text-gray-600 dark:text-gray-400">Extract Single Best Moment</Label>
              <Switch
                checked={config.singleClip !== false}
                onCheckedChange={(checked) => handleConfigChange({ ...config, singleClip: checked })}
              />
            </div>
          </div>
        );

      case 'enhancement':
        return (
          <div className="space-y-3 p-3 bg-[#0f0f0f] rounded-lg border border-[#3a3a3a]">
            <div className="flex items-center gap-2">
              <Sparkles className="h-4 w-4 text-purple-600" />
              <Label className="text-sm font-medium text-white">Enhancement</Label>
            </div>
            <div className="space-y-2">
              <div className="flex items-center justify-between">
                <Label className="text-xs text-gray-400">Audio Enhancement</Label>
                <Switch
                  checked={config.enhanceAudio !== false}
                  onCheckedChange={(checked) => handleConfigChange({ ...config, enhanceAudio: checked })}
                />
              </div>
              <div className="flex items-center justify-between">
                <Label className="text-xs text-gray-400">Video Stabilization</Label>
                <Switch
                  checked={config.stabilizeVideo !== false}
                  onCheckedChange={(checked) => handleConfigChange({ ...config, stabilizeVideo: checked })}
                />
              </div>
              <div className="flex items-center justify-between">
                <Label className="text-xs text-gray-400">Color Correction</Label>
                <Switch
                  checked={config.colorCorrection !== false}
                  onCheckedChange={(checked) => handleConfigChange({ ...config, colorCorrection: checked })}
                />
              </div>
              <div className="flex items-center justify-between">
                <Label className="text-xs text-gray-400">Noise Reduction</Label>
                <Switch
                  checked={config.noiseReduction !== false}
                  onCheckedChange={(checked) => handleConfigChange({ ...config, noiseReduction: checked })}
                />
              </div>
            </div>
          </div>
        );

      case 'voice':
        return (
          <div className="space-y-3 p-3 bg-gray-50 dark:bg-gray-800 rounded-lg border">
            <div className="flex items-center gap-2">
              <Mic className="h-4 w-4 text-pink-600" />
              <Label className="text-sm font-medium text-gray-700 dark:text-gray-300">Voice Translation</Label>
            </div>
            
            {/* Target Language */}
            <div className="space-y-1">
              <Label className="text-xs text-gray-600 dark:text-gray-400">Target Language</Label>
              <Select value={config.targetLanguage || 'Spanish'} onValueChange={(value) => handleConfigChange({...config, targetLanguage: value})}>
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
                  <SelectItem value="Russian">Russian</SelectItem>
                  <SelectItem value="Hindi">Hindi</SelectItem>
                  <SelectItem value="Arabic">Arabic</SelectItem>
                  <SelectItem value="Dutch">Dutch</SelectItem>
                  <SelectItem value="Polish">Polish</SelectItem>
                  <SelectItem value="Turkish">Turkish</SelectItem>
                  <SelectItem value="Swedish">Swedish</SelectItem>
                </SelectContent>
              </Select>
            </div>
            
            {/* Preserve Background Audio */}
            <div className="space-y-1">
              <Label className="text-xs text-gray-600 dark:text-gray-400">Preserve Background Audio</Label>
              <Select value={config.preserveBackgroundAudio !== false ? 'Yes' : 'No'} onValueChange={(value) => handleConfigChange({...config, preserveBackgroundAudio: value === 'Yes'})}>
                <SelectTrigger className="text-xs">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="Yes">Yes</SelectItem>
                  <SelectItem value="No">No</SelectItem>
                </SelectContent>
              </Select>
            </div>
            
            {/* Safewords */}
            <div className="space-y-1">
              <Label className="text-xs text-gray-600 dark:text-gray-400">Safewords</Label>
              <Input
                value={config.safewords || ''}
                onChange={(e) => handleConfigChange({...config, safewords: e.target.value})}
                placeholder="OpenAI, coffee"
                className="text-xs"
              />
            </div>
            
            {/* Translation Dictionary */}
            <div className="space-y-1">
              <Label className="text-xs text-gray-600 dark:text-gray-400">Translation Dictionary</Label>
              <div className="space-y-2">
                {(config.translationDictionary || []).map((entry: any, index: number) => (
                  <div key={index} className="flex gap-2 items-center">
                    <Input
                      value={entry.original}
                      onChange={(e) => {
                        const newDict = [...(config.translationDictionary || [])];
                        newDict[index] = { ...newDict[index], original: e.target.value };
                        handleConfigChange({...config, translationDictionary: newDict});
                      }}
                      placeholder="Original"
                      className="text-xs flex-1"
                    />
                    <Input
                      value={entry.new}
                      onChange={(e) => {
                        const newDict = [...(config.translationDictionary || [])];
                        newDict[index] = { ...newDict[index], new: e.target.value };
                        handleConfigChange({...config, translationDictionary: newDict});
                      }}
                      placeholder="New"
                      className="text-xs flex-1"
                    />
                    <Button
                      size="sm"
                      variant="ghost"
                      onClick={() => {
                        const newDict = (config.translationDictionary || []).filter((_: any, i: number) => i !== index);
                        handleConfigChange({...config, translationDictionary: newDict});
                      }}
                      className="h-7 w-7 p-0"
                    >
                      <Trash2 className="h-3 w-3" />
                    </Button>
                  </div>
                ))}
                <Button
                  size="sm"
                  variant="outline"
                  onClick={() => {
                    const newDict = [...(config.translationDictionary || []), { original: '', new: '' }];
                    handleConfigChange({...config, translationDictionary: newDict});
                  }}
                  className="w-full text-xs"
                >
                  <Plus className="h-3 w-3 mr-1" />
                  Add Translation
                </Button>
              </div>
            </div>
          </div>
        );

      case 'audio_enhance':
        return (
          <div className="space-y-3 p-3 bg-gray-50 dark:bg-gray-800 rounded-lg border">
            <div className="flex items-center gap-2">
              <Volume2 className="h-4 w-4 text-yellow-600" />
              <Label className="text-sm font-medium text-gray-700 dark:text-gray-300">Audio Enhancement</Label>
            </div>
            
            {/* Processing Backend */}
            <div className="space-y-1">
              <Label className="text-xs text-gray-600 dark:text-gray-400 flex items-center gap-1">
                Processing Backend
                <span className="text-purple-500 text-xs">Required</span>
              </Label>
              <Select 
                value={config.processingBackend || 'Auphonic'} 
                onValueChange={(value) => handleConfigChange({...config, processingBackend: value})}
              >
                <SelectTrigger className="text-xs">
                  <SelectValue placeholder="Select backend" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="Auphonic">Auphonic</SelectItem>
                  <SelectItem value="ElevenLabs">ElevenLabs</SelectItem>
                </SelectContent>
              </Select>
            </div>
            
            {/* Enhancement Type */}
            <div className="space-y-1">
              <Label className="text-xs text-gray-600 dark:text-gray-400 flex items-center gap-1">
                Enhancement Type
                <span className="text-purple-500 text-xs">Required</span>
              </Label>
              <Select 
                value={config.enhancementType || 'Enhance & Denoise'} 
                onValueChange={(value) => handleConfigChange({...config, enhancementType: value})}
              >
                <SelectTrigger className="text-xs">
                  <SelectValue placeholder="Select enhancement" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="Enhance & Denoise">Enhance & Denoise</SelectItem>
                  <SelectItem value="Denoise Only">Denoise Only</SelectItem>
                  <SelectItem value="Enhance Only">Enhance Only</SelectItem>
                  <SelectItem value="Voice Clarity">Voice Clarity</SelectItem>
                  <SelectItem value="Remove Background">Remove Background</SelectItem>
                </SelectContent>
              </Select>
            </div>
            
            {/* Enhancement Steps */}
            <div className="space-y-1">
              <Label className="text-xs text-gray-600 dark:text-gray-400 flex items-center gap-1">
                Enhancement Steps
                <span className="text-purple-500 text-xs">Required</span>
              </Label>
              <div className="flex items-center gap-2">
                <span className="text-xs text-gray-500">32</span>
                <input
                  type="range"
                  min="32"
                  max="100"
                  value={config.enhancementSteps || 64}
                  onChange={(e) => handleConfigChange({...config, enhancementSteps: parseInt(e.target.value)})}
                  className="flex-1 h-2 bg-gray-300 rounded-lg appearance-none cursor-pointer accent-purple-600"
                />
                <span className="text-xs text-gray-500">100</span>
              </div>
              <div className="text-center text-xs text-gray-500">
                {config.enhancementSteps || 64}
              </div>
            </div>
          </div>
        );

      case 'eye_contact':
        return (
          <div className="space-y-3 p-3 bg-gray-50 dark:bg-gray-800 rounded-lg border">
            <div className="flex items-center gap-2">
              <Eye className="h-4 w-4 text-purple-600" />
              <Label className="text-sm font-medium text-gray-700 dark:text-gray-300">Eye Contact</Label>
            </div>
            {/* Model Selection */}
            <div>
              <Label htmlFor={`model-${id}`} className="text-xs text-gray-600 dark:text-gray-400">AI Model</Label>
              <Select
                value={config.aiModel || 'gemini-2.0-flash-lite'}
                onValueChange={(value) => handleConfigChange({ ...config, aiModel: value })}
              >
                <SelectTrigger id={`model-${id}`} className="text-xs">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="gemini-2.0-flash-lite">Gemini 2.0 Flash-Lite (Fastest)</SelectItem>
                  <SelectItem value="gemini-2.0-flash-exp">Gemini 2.0 Flash (Balanced)</SelectItem>
                  <SelectItem value="gemini-1.5-flash">Gemini 1.5 Flash (Legacy)</SelectItem>
                  <SelectItem value="gemini-1.5-pro">Gemini 1.5 Pro (High Quality)</SelectItem>
                </SelectContent>
              </Select>
            </div>
            <Select value={config.accuracyBoost || 'Yes'} onValueChange={(value) => handleConfigChange({...config, accuracyBoost: value})}>
              <SelectTrigger className="text-xs">
                <SelectValue placeholder="Accuracy Boost" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="Yes">Yes</SelectItem>
                <SelectItem value="No">No</SelectItem>
              </SelectContent>
            </Select>
          </div>
        );

      case 'reframe':
        return (
          <div className="space-y-3 p-3 bg-gray-50 dark:bg-gray-800 rounded-lg border">
            <div className="flex items-center gap-2">
              <Crop className="h-4 w-4 text-blue-600" />
              <Label className="text-sm font-medium text-gray-700 dark:text-gray-300">Reframing</Label>
            </div>
            
            {/* Model Selection */}
            <div>
              <Label htmlFor={`model-${id}`} className="text-xs text-gray-600 dark:text-gray-400">AI Model</Label>
              <Select
                value={config.aiModel || 'gemini-2.0-flash-lite'}
                onValueChange={(value) => handleConfigChange({ ...config, aiModel: value })}
              >
                <SelectTrigger id={`model-${id}`} className="text-xs">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="gemini-2.0-flash-lite">Gemini 2.0 Flash-Lite (Fastest)</SelectItem>
                  <SelectItem value="gemini-2.0-flash-exp">Gemini 2.0 Flash (Balanced)</SelectItem>
                  <SelectItem value="gemini-1.5-flash">Gemini 1.5 Flash (Legacy)</SelectItem>
                  <SelectItem value="gemini-1.5-pro">Gemini 1.5 Pro (High Quality)</SelectItem>
                </SelectContent>
              </Select>
            </div>
            
            {/* Aspect Ratio */}
            <div>
              <Label className="text-xs text-gray-600 dark:text-gray-400 mb-1 flex items-center gap-1">
                Aspect Ratio
                <span className="text-purple-500 text-xs">Required</span>
              </Label>
              <Select 
                value={config.aspectRatio || '9:16'} 
                onValueChange={(value) => handleConfigChange({...config, aspectRatio: value})}
              >
                <SelectTrigger className="text-xs">
                  <SelectValue placeholder="Select aspect ratio" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="9:16">Vertical (9:16)</SelectItem>
                  <SelectItem value="16:9">Horizontal (16:9)</SelectItem>
                  <SelectItem value="1:1">Square (1:1)</SelectItem>
                  <SelectItem value="4:5">Portrait (4:5)</SelectItem>
                  <SelectItem value="4:3">Standard (4:3)</SelectItem>
                </SelectContent>
              </Select>
            </div>

            {/* Algorithm Selection */}
            <div>
              <Label className="text-xs text-gray-600 dark:text-gray-400 mb-1 flex items-center gap-1">
                Reframe Algorithm
                <span className="text-purple-500 text-xs">Required</span>
              </Label>
              <Select 
                value={config.algorithm || 'standard'} 
                onValueChange={(value) => handleConfigChange({...config, algorithm: value})}
              >
                <SelectTrigger className="text-xs">
                  <SelectValue placeholder="Select algorithm" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="standard">Standard (Fast)</SelectItem>
                  <SelectItem value="autoflip">AutoFlip-Inspired (Better Focus)</SelectItem>
                </SelectContent>
              </Select>
            </div>

            {/* Active Speaker Detection */}
            <div>
              <Label className="text-xs text-gray-600 dark:text-gray-400 mb-1 flex items-center gap-1">
                Active Speaker Detection
                <span className="text-purple-500 text-xs">Required</span>
              </Label>
              <Select 
                value={config.activeSpeakerDetection !== false ? 'Yes' : 'No'} 
                onValueChange={(value) => handleConfigChange({...config, activeSpeakerDetection: value === 'Yes'})}
              >
                <SelectTrigger className="text-xs">
                  <SelectValue placeholder="Enable speaker detection" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="Yes">Yes</SelectItem>
                  <SelectItem value="No">No</SelectItem>
                </SelectContent>
              </Select>
            </div>

            {/* Focus Subject */}
            <div 
              className="editable-area"
              onMouseDown={(e) => e.stopPropagation()}
              onMouseMove={(e) => e.stopPropagation()}
              onMouseUp={(e) => e.stopPropagation()}
            >
              <Label htmlFor={`focus-subject-${id}`} className="text-xs text-gray-600 dark:text-gray-400">Focus Subject</Label>
              <Input
                id={`focus-subject-${id}`}
                value={config.focusSubject || ''}
                onChange={(e) => handleConfigChange({...config, focusSubject: e.target.value})}
                placeholder="person"
                className="text-xs mt-1"
              />
            </div>

            {/* Avoid Subject */}
            <div 
              className="editable-area"
              onMouseDown={(e) => e.stopPropagation()}
              onMouseMove={(e) => e.stopPropagation()}
              onMouseUp={(e) => e.stopPropagation()}
            >
              <Label htmlFor={`avoid-subject-${id}`} className="text-xs text-gray-600 dark:text-gray-400">Avoid Subject</Label>
              <Input
                id={`avoid-subject-${id}`}
                value={config.avoidSubject || ''}
                onChange={(e) => handleConfigChange({...config, avoidSubject: e.target.value})}
                placeholder="logos"
                className="text-xs mt-1"
              />
            </div>
          </div>
        );

      case 'cut':
        return (
          <div className="space-y-3 p-3 bg-gray-50 dark:bg-gray-800 rounded-lg border">
            <div className="flex items-center gap-2">
              <Scissors className="h-4 w-4 text-red-600" />
              <Label className="text-sm font-medium text-gray-700 dark:text-gray-300">Content Cutting</Label>
            </div>
            <Textarea
              value={config.contentToRemove || ''}
              onChange={(e) => handleConfigChange({...config, contentToRemove: e.target.value})}
              placeholder="Remove the parts where..."
              className="text-xs min-h-[60px]"
            />
          </div>
        );

      case 'background':
        return (
          <div className="space-y-3 p-3 bg-gray-50 dark:bg-gray-800 rounded-lg border">
            <div className="flex items-center gap-2">
              <Image className="h-4 w-4 text-green-600" />
              <Label className="text-sm font-medium text-gray-700 dark:text-gray-300">Background</Label>
            </div>
            <div className="flex items-center gap-2">
              <input
                type="color"
                value={config.backgroundColor || '#0000ff'}
                onChange={(e) => handleConfigChange({...config, backgroundColor: e.target.value})}
                className="w-8 h-8 rounded border border-gray-300 cursor-pointer"
              />
              <Input
                value={config.backgroundColor || '#0000ff'}
                onChange={(e) => handleConfigChange({...config, backgroundColor: e.target.value})}
                className="text-xs flex-1"
              />
            </div>
          </div>
        );

      case 'broll':
        return (
          <div className="space-y-3 p-3 bg-gray-50 dark:bg-gray-800 rounded-lg border">
            <div className="flex items-center gap-2">
              <Film className="h-4 w-4 text-indigo-600" />
              <Label className="text-sm font-medium text-gray-700 dark:text-gray-300">B-Roll</Label>
            </div>
            {/* Model Selection */}
            <div>
              <Label htmlFor={`model-${id}`} className="text-xs text-gray-600 dark:text-gray-400">AI Model</Label>
              <Select
                value={config.aiModel || 'gemini-2.0-flash-lite'}
                onValueChange={(value) => handleConfigChange({ ...config, aiModel: value })}
              >
                <SelectTrigger id={`model-${id}`} className="text-xs">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="gemini-2.0-flash-lite">Gemini 2.0 Flash-Lite (Fastest)</SelectItem>
                  <SelectItem value="gemini-2.0-flash-exp">Gemini 2.0 Flash (Balanced)</SelectItem>
                  <SelectItem value="gemini-1.5-flash">Gemini 1.5 Flash (Legacy)</SelectItem>
                  <SelectItem value="gemini-1.5-pro">Gemini 1.5 Pro (High Quality)</SelectItem>
                </SelectContent>
              </Select>
            </div>
            
            {/* Asset Types */}
            <div className="space-y-2">
              <Label className="text-xs text-gray-600 dark:text-gray-400">Asset Types</Label>
              <div className="space-y-2">
                <label className="flex items-center gap-2 cursor-pointer">
                  <input
                    type="checkbox"
                    checked={config.includeImages !== false}
                    onChange={(e) => handleConfigChange({...config, includeImages: e.target.checked})}
                    className="w-4 h-4 text-indigo-600 rounded focus:ring-indigo-500"
                  />
                  <span className="text-xs text-gray-700 dark:text-gray-300">Images</span>
                </label>
                <label className="flex items-center gap-2 cursor-pointer">
                  <input
                    type="checkbox"
                    checked={config.includeVideos !== false}
                    onChange={(e) => handleConfigChange({...config, includeVideos: e.target.checked})}
                    className="w-4 h-4 text-indigo-600 rounded focus:ring-indigo-500"
                  />
                  <span className="text-xs text-gray-700 dark:text-gray-300">Videos</span>
                </label>
              </div>
            </div>
            
            {/* Clips per Minute */}
            <div className="space-y-1">
              <div className="flex items-center justify-between">
                <Label className="text-xs text-gray-600 dark:text-gray-400">Clips per Minute</Label>
                <span className="text-xs text-indigo-600 font-medium">{config.clipsPerMinute || 3}</span>
              </div>
              <input
                type="range"
                min="0.5"
                max="6"
                step="0.5"
                value={config.clipsPerMinute || 3}
                onChange={(e) => handleConfigChange({...config, clipsPerMinute: parseFloat(e.target.value)})}
                className="w-full h-1 bg-gray-300 rounded-lg appearance-none cursor-pointer"
              />
              <div className="flex justify-between text-xs text-gray-500">
                <span>0.5</span>
                <span>3</span>
                <span>6</span>
              </div>
            </div>
            
            {/* Style Description */}
            <div>
              <Label htmlFor={`style-description-${id}`} className="text-xs text-gray-600 dark:text-gray-400">Style Description</Label>
              <Input
                id={`style-description-${id}`}
                value={config.styleDescription || ''}
                onChange={(e) => handleConfigChange({...config, styleDescription: e.target.value})}
                placeholder="Smooth and cinematic shots"
                className="text-xs mt-1"
              />
            </div>
            
            {/* Content Focus */}
            <div 
              className="editable-area"
              onMouseDown={(e) => e.stopPropagation()}
              onMouseMove={(e) => e.stopPropagation()}
              onMouseUp={(e) => e.stopPropagation()}
            >
              <Label htmlFor={`content-focus-${id}`} className="text-xs text-gray-600 dark:text-gray-400">Content Focus</Label>
              <Textarea
                id={`content-focus-${id}`}
                value={config.contentFocus || ''}
                onChange={(e) => handleConfigChange({...config, contentFocus: e.target.value})}
                placeholder="Moments they mention 'robots' and 'technology'"
                className="text-xs mt-1 min-h-[60px]"
              />
            </div>
          </div>
        );

      case 'captions':
        return (
          <div className="space-y-3 p-3 bg-gray-50 dark:bg-gray-800 rounded-lg border">
            <div className="flex items-center gap-2">
              <Type className="h-4 w-4 text-emerald-600" />
              <Label className="text-sm font-medium text-gray-700 dark:text-gray-300">Captions</Label>
            </div>
            <Input
              type="number"
              value={config.captionSize || 100}
              onChange={(e) => handleConfigChange({...config, captionSize: parseInt(e.target.value) || 100})}
              placeholder="Size (100)"
              className="text-xs"
            />
          </div>
        );

      case 'music':
        return (
          <div className="space-y-3 p-3 bg-gray-50 dark:bg-gray-800 rounded-lg border">
            <div className="flex items-center gap-2">
              <Music className="h-4 w-4 text-violet-600" />
              <Label className="text-sm font-medium text-gray-700 dark:text-gray-300">Music</Label>
            </div>
            <Input
              value={config.musicStyle || ''}
              onChange={(e) => handleConfigChange({...config, musicStyle: e.target.value})}
              placeholder="Cinematic theme"
              className="text-xs"
            />
          </div>
        );

      default:
        return null;
    }
  };

  return (
    <div
      className={`absolute transition-all duration-200 ${isDragging ? 'z-50' : 'z-10'}`}
      style={{ 
        left: position.x, 
        top: position.y,
        transform: isDragging ? 'scale(1.02)' : 'scale(1)'
      }}
    >
      <Card 
        className={`
          w-80 transition-all duration-200 cursor-move
          ${isSelected 
            ? 'ring-2 ring-purple-500 ring-offset-2 ring-offset-[#0f0f0f] shadow-xl' 
            : 'hover:shadow-lg shadow-md'
          }
          ${isDragging ? 'shadow-2xl scale-102' : ''}
          bg-[#1a1a1a] border
        `}
        style={{
          borderColor: isSelected ? theme.primary : '#3a3a3a',
          boxShadow: isSelected 
            ? `0 20px 25px -5px rgba(0, 0, 0, 0.3), 0 10px 10px -5px rgba(0, 0, 0, 0.2), 0 0 0 4px ${theme.primary}30` 
            : '0 10px 15px -3px rgba(0, 0, 0, 0.3)'
        }}
        onMouseDown={(e) => {
          // Check if the target is within an editable area
          const target = e.target as HTMLElement;
          const isEditableArea = target.closest('.editable-area');
          if (!isEditableArea) {
            handleMouseDown(e);
          }
        }}
      >
        {/* Input Handle */}
        {type !== 'start' && (
          <div
            data-handle="true"
            data-node-id={id}
            data-handle-type="input"
            className={`
              absolute left-0 top-1/2 -translate-y-1/2 -translate-x-1/2 z-20
              w-4 h-4 rounded-full border-2 border-[#2a2a2a] cursor-pointer
              transition-all duration-200 hover:scale-150 shadow-lg
              ${isConnecting ? 'scale-150' : ''}
            `}
            style={{ backgroundColor: isConnecting ? theme.primary : '#4a4a4a' }}
            onClick={handleInputConnection}
          />
        )}

        {/* Output Handle */}
        {type !== 'end' && (
          <div
            data-handle="true"
            data-node-id={id}
            data-handle-type="output"
            className={`
              absolute right-0 top-1/2 -translate-y-1/2 translate-x-1/2 z-20
              w-4 h-4 rounded-full border-2 border-[#2a2a2a] cursor-pointer
              transition-all duration-200 hover:scale-150 shadow-lg
              ${isConnecting ? 'scale-150' : ''}
            `}
            style={{ backgroundColor: isConnecting ? theme.primary : '#4a4a4a' }}
            onClick={handleOutputConnection}
          />
        )}

        <CardContent className="p-4">
          {/* Header */}
          <div className="flex items-center justify-between mb-3">
            <div className="flex items-center gap-3">
              <div 
                className="w-10 h-10 rounded-lg flex items-center justify-center shadow-sm"
                style={{ backgroundColor: `${theme.primary}20` }}
              >
                <Icon className="h-5 w-5" style={{ color: theme.primary }} />
              </div>
              <div>
                <h3 className="font-semibold text-white text-sm">{data.label}</h3>
                <div className="flex items-center gap-2 mt-1">
                  <Badge 
                    variant="secondary" 
                    className="text-xs px-2 py-0 border-0"
                    style={{ backgroundColor: `${theme.primary}20`, color: theme.primary }}
                  >
                    {type}
                  </Badge>
                  {getStatusIcon()}
                </div>
              </div>
            </div>

            <div className="flex items-center gap-1">
              <Button
                variant="ghost"
                size="sm"
                className="h-8 w-8 p-0"
                onClick={(e) => {
                  e.stopPropagation();
                  setIsConfigExpanded(!isConfigExpanded);
                }}
              >
                {isConfigExpanded ? <ChevronUp className="h-4 w-4" /> : <ChevronDown className="h-4 w-4" />}
              </Button>
              
              <DropdownMenu>
                <DropdownMenuTrigger asChild>
                  <Button variant="ghost" size="sm" className="h-8 w-8 p-0">
                    <MoreVertical className="h-4 w-4" />
                  </Button>
                </DropdownMenuTrigger>
                <DropdownMenuContent align="end">
                  <DropdownMenuItem onClick={() => onExecute?.(id)}>
                    <Play className="mr-2 h-4 w-4" />
                    Execute
                  </DropdownMenuItem>
                  <DropdownMenuItem onClick={() => onDuplicate?.(id)}>
                    <Settings className="mr-2 h-4 w-4" />
                    Duplicate
                  </DropdownMenuItem>
                  <DropdownMenuItem onClick={() => onDelete?.(id)} className="text-red-600">
                    Delete
                  </DropdownMenuItem>
                </DropdownMenuContent>
              </DropdownMenu>
            </div>
          </div>

          {/* Video Preview for nodes with video data */}
          {data.config?.videoPath && (
            <div className="mb-3 relative">
              <div className="text-xs text-gray-400 mb-2">{data.config.videoPath.split('/').pop()}</div>
              <div className="relative rounded-lg overflow-hidden border-2" style={{ borderColor: theme.primary }}>
                <video
                  src={data.config.videoPath}
                  className="w-full aspect-video bg-black"
                  controls
                  preload="metadata"
                />
              </div>
            </div>
          )}

          {/* B-Roll Assets Display */}
          {type === 'broll' && data.config?.brollAssets && data.config.brollAssets.length > 0 && (
            <BRollCard 
              assets={data.config.brollAssets.map((asset: any, index: number) => ({
                keyword: data.config.moments?.[index]?.keyword || 'Asset',
                timestamp: data.config.moments?.[index]?.timestamp || 0,
                duration: data.config.moments?.[index]?.duration || 5,
                description: data.config.moments?.[index]?.description || 'Generated B-roll asset',
                assetPath: asset,
                assetType: asset.endsWith('.mp4') ? 'video' : 'image'
              }))}
              nodeId={id}
              onPreview={(asset) => {
                window.open(asset.assetPath, '_blank');
              }}
            />
          )}

          {/* Inline Configuration */}
          {isConfigExpanded && renderInlineConfig()}
        </CardContent>
      </Card>
    </div>
  );
});

ConfigurableFlowNode.displayName = 'ConfigurableFlowNode';

export default ConfigurableFlowNode;