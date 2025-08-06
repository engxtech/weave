export interface WorkflowNode {
  id: string;
  type: string;
  position: { x: number; y: number };
  data: {
    label: string;
    icon: string;
    color: string;
    type?: 'video-input' | 'video-upload' | 'shorts-creation' | 'script-generator' | 'video-generator' | 'captions' | 'audio' | 'effects';
    settings?: Record<string, any>;
    status?: 'ready' | 'processing' | 'complete' | 'error';
    inputs?: any[];
    output?: any;
  };
}

export interface WorkflowEdge {
  id: string;
  source: string;
  target: string;
  type?: string;
}

export interface TileDefinition {
  id: string;
  name: string;
  description: string;
  category: string;
  icon: string;
  color: string;
  type?: 'video-input' | 'video-upload' | 'shorts-creation' | 'script-generator' | 'video-generator' | 'captions' | 'audio' | 'effects';
  tags: string[];
  defaultSettings: Record<string, any>;
}

export interface ChatMessage {
  role: 'user' | 'assistant';
  content: string;
  timestamp: string;
  error?: boolean;
}

export const TILE_DEFINITIONS: TileDefinition[] = [
  {
    id: 'video-upload',
    name: 'Video Upload',
    description: 'Upload video files for processing',
    category: 'Input Sources',
    icon: 'Upload',
    color: 'bg-blue-500',
    type: 'video-upload',
    tags: ['Upload', 'File', 'Input'],
    defaultSettings: {
      maxSize: '500MB',
      acceptedFormats: 'MP4, MOV, AVI, MKV'
    }
  },
  {
    id: 'shorts-creation',
    name: 'Shorts Creation',
    description: 'Generate AI-powered short videos from uploaded content',
    category: 'AI Generation',
    icon: 'SmartToy',
    color: 'bg-pink-500',
    type: 'shorts-creation',
    tags: ['AI', 'Short-form', 'Generate'],
    defaultSettings: {
      duration: '15s',
      style: 'viral',
      aspectRatio: '9:16'
    }
  },
  {
    id: 'script-generator',
    name: 'Script Generator',
    description: 'Generate viral video scripts from uploaded video content using AI',
    category: 'AI Generation',
    icon: 'Description',
    color: 'bg-purple-500',
    type: 'script-generator',
    tags: ['AI', 'Script', 'Timeline', 'Analysis'],
    defaultSettings: {
      style: 'viral',
      tone: 'engaging',
      duration: '30s'
    }
  },
  {
    id: 'video-generator',
    name: 'Video Generator',
    description: 'Cut and merge video segments based on timeline instructions',
    category: 'Video Processing',
    icon: 'MovieCreation',
    color: 'bg-blue-500',
    type: 'video-generator',
    tags: ['Video', 'Editing', 'Timeline', 'Cut'],
    defaultSettings: {
      outputFormat: 'mp4',
      quality: 'high',
      aspectRatio: '9:16'
    }
  },
  {
    id: 'voice',
    name: 'Voice',
    description: 'Change specific spoken words',
    category: 'Content Processing',
    icon: 'Mic',
    color: 'bg-google-blue',
    tags: ['Cloning', 'Translation'],
    defaultSettings: {
      targetLanguage: 'Spanish',
      preserveBackground: true,
      voiceCloning: true
    }
  },
  {
    id: 'captions',
    name: 'Captions',
    description: 'Auto-generate captions',
    category: 'Content Processing',
    icon: 'Subtitles',
    color: 'bg-gemini-green',
    tags: ['Auto-sync', 'Styling'],
    defaultSettings: {
      style: 'Modern',
      position: 'Bottom Center',
      language: 'Auto-detect'
    }
  },
  {
    id: 'audio-enhance',
    name: 'Audio Enhance',
    description: 'Improve audio quality',
    category: 'Content Processing',
    icon: 'Volume2',
    color: 'bg-google-yellow',
    tags: ['Noise Reduction', 'Clarity'],
    defaultSettings: {
      noiseReduction: 'High',
      enhancement: 'Clarity'
    }
  },
  {
    id: 'cut',
    name: 'Cut',
    description: 'Trim video content',
    category: 'Editing Operations',
    icon: 'Scissors',
    color: 'bg-google-red',
    tags: [],
    defaultSettings: {
      startTime: '00:00:00',
      endTime: '00:01:00'
    }
  },
  {
    id: 'b-roll',
    name: 'B-Roll',
    description: 'Add supplementary footage',
    category: 'Editing Operations',
    icon: 'Film',
    color: 'bg-purple-500',
    tags: [],
    defaultSettings: {
      source: 'Stock Library',
      placement: 'Auto'
    }
  },
  {
    id: 'music',
    name: 'Music',
    description: 'Add background music',
    category: 'Editing Operations',
    icon: 'Music4',
    color: 'bg-indigo-500',
    tags: [],
    defaultSettings: {
      volume: 0.3,
      fadeIn: true,
      fadeOut: true
    }
  },
  {
    id: 'curator-agent',
    name: 'Curator Agent',
    description: 'Transform long-form content',
    category: 'AI Agents',
    icon: 'Sparkles',
    color: 'bg-gradient-to-r from-google-blue to-purple-500',
    tags: ['Shorts', 'Reframe'],
    defaultSettings: {
      outputFormat: 'Shorts',
      aspectRatio: 'Vertical (9:16)'
    }
  },
  {
    id: 'linguist-agent',
    name: 'Linguist Agent',
    description: 'Localize content globally',
    category: 'AI Agents',
    icon: 'Languages',
    color: 'bg-gradient-to-r from-gemini-green to-google-blue',
    tags: ['Voice', 'Captions'],
    defaultSettings: {
      targetLanguages: ['Spanish', 'French'],
      preserveVoice: true
    }
  },
  {
    id: 'reframe',
    name: 'Reframe',
    description: 'Automatically reframe your video',
    category: 'Editing Operations',
    icon: 'Crop',
    color: 'bg-blue-500',
    tags: ['Vertical', 'Aspect Ratio'],
    defaultSettings: {
      aspectRatio: 'Vertical (9:16)',
      autoDetect: true
    }
  },
  {
    id: 'background',
    name: 'Background',
    description: 'Remove or replace background',
    category: 'Content Processing',
    icon: 'Image',
    color: 'bg-pink-500',
    tags: ['Removal', 'Replacement'],
    defaultSettings: {
      processingEngine: 'Parallel (Faster)',
      backgroundColor: 'Blue'
    }
  },
  {
    id: 'eye-contact',
    name: 'Eye Contact',
    description: 'Correct eye contact in video',
    category: 'AI Agents',
    icon: 'Eye',
    color: 'bg-orange-500',
    tags: ['Eye Contact'],
    defaultSettings: {
      accuracyBoost: true,
      naturalLookAway: false
    }
  }
];
