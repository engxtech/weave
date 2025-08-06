export interface WorkflowTemplate {
  id: string;
  name: string;
  description: string;
  category: string;
  difficulty: 'beginner' | 'intermediate' | 'advanced';
  estimatedTime: string;
  nodes: any[];
  edges: any[];
  requiredInputs: string[];
  expectedOutputs: string[];
  branching?: BranchingLogic[];
}

export interface BranchingLogic {
  nodeId: string;
  condition: string;
  trueTarget: string;
  falseTarget: string;
  operator: 'equals' | 'greater_than' | 'less_than' | 'contains';
  value: any;
}

export const WORKFLOW_TEMPLATES: WorkflowTemplate[] = [
  {
    id: 'social-media-shorts',
    name: 'Social Media Shorts',
    description: 'Transform long-form content into engaging short-form videos',
    category: 'Social Media',
    difficulty: 'beginner',
    estimatedTime: '5-10 minutes',
    requiredInputs: ['Video file (MP4, MOV)', 'Target duration (15s, 30s, 60s)'],
    expectedOutputs: ['Vertical video (9:16)', 'Auto-generated captions', 'Background music'],
    nodes: [
      {
        id: 'video-input',
        type: 'workflowTile',
        position: { x: 100, y: 100 },
        data: { label: 'Video Input', icon: 'Video', color: 'bg-google-blue', status: 'ready' }
      },
      {
        id: 'curator-agent',
        type: 'workflowTile',
        position: { x: 400, y: 100 },
        data: { 
          label: 'Curator Agent', 
          icon: 'Sparkles', 
          color: 'bg-gradient-to-r from-google-blue to-purple-500',
          settings: { outputFormat: 'Shorts', aspectRatio: 'Vertical (9:16)', duration: '30s' },
          status: 'ready'
        }
      },
      {
        id: 'captions',
        type: 'workflowTile',
        position: { x: 700, y: 50 },
        data: { 
          label: 'Captions', 
          icon: 'Subtitles', 
          color: 'bg-gemini-green',
          settings: { style: 'Modern', position: 'Bottom Center', fontSize: 'Large' },
          status: 'ready'
        }
      },
      {
        id: 'music',
        type: 'workflowTile',
        position: { x: 700, y: 150 },
        data: { 
          label: 'Music', 
          icon: 'Music4', 
          color: 'bg-indigo-500',
          settings: { mood: 'Upbeat', volume: 0.3, fadeIn: true },
          status: 'ready'
        }
      }
    ],
    edges: [
      { id: 'e1', source: 'video-input', target: 'curator-agent', type: 'smoothstep' },
      { id: 'e2', source: 'curator-agent', target: 'captions', type: 'smoothstep' },
      { id: 'e3', source: 'curator-agent', target: 'music', type: 'smoothstep' }
    ],
    branching: [
      {
        nodeId: 'curator-agent',
        condition: 'duration',
        trueTarget: 'captions',
        falseTarget: 'music',
        operator: 'greater_than',
        value: 30
      }
    ]
  },
  {
    id: 'multilingual-content',
    name: 'Multilingual Content',
    description: 'Create localized versions for global audiences',
    category: 'Localization',
    difficulty: 'intermediate',
    estimatedTime: '15-20 minutes',
    requiredInputs: ['Video file', 'Target languages', 'Voice cloning preference'],
    expectedOutputs: ['Multiple language versions', 'Translated captions', 'Localized voice tracks'],
    nodes: [
      {
        id: 'video-input',
        type: 'workflowTile',
        position: { x: 100, y: 100 },
        data: { label: 'Video Input', icon: 'Video', color: 'bg-google-blue', status: 'ready' }
      },
      {
        id: 'linguist-agent',
        type: 'workflowTile',
        position: { x: 400, y: 100 },
        data: { 
          label: 'Linguist Agent', 
          icon: 'Languages', 
          color: 'bg-gradient-to-r from-gemini-green to-google-blue',
          settings: { targetLanguages: ['Spanish', 'French', 'German'], preserveVoice: true },
          status: 'ready'
        }
      },
      {
        id: 'voice-spanish',
        type: 'workflowTile',
        position: { x: 700, y: 50 },
        data: { 
          label: 'Voice (Spanish)', 
          icon: 'Mic', 
          color: 'bg-google-blue',
          settings: { targetLanguage: 'Spanish', voiceCloning: true },
          status: 'ready'
        }
      },
      {
        id: 'voice-french',
        type: 'workflowTile',
        position: { x: 700, y: 150 },
        data: { 
          label: 'Voice (French)', 
          icon: 'Mic', 
          color: 'bg-google-blue',
          settings: { targetLanguage: 'French', voiceCloning: true },
          status: 'ready'
        }
      }
    ],
    edges: [
      { id: 'e1', source: 'video-input', target: 'linguist-agent', type: 'smoothstep' },
      { id: 'e2', source: 'linguist-agent', target: 'voice-spanish', type: 'smoothstep' },
      { id: 'e3', source: 'linguist-agent', target: 'voice-french', type: 'smoothstep' }
    ]
  },
  {
    id: 'podcast-to-video',
    name: 'Podcast to Video',
    description: 'Transform audio podcasts into engaging video content',
    category: 'Content Creation',
    difficulty: 'intermediate',
    estimatedTime: '10-15 minutes',
    requiredInputs: ['Audio file (MP3, WAV)', 'Visual style preference', 'Branding assets'],
    expectedOutputs: ['Video with visualizations', 'Captions', 'Brand elements'],
    nodes: [
      {
        id: 'audio-input',
        type: 'workflowTile',
        position: { x: 100, y: 100 },
        data: { label: 'Audio Input', icon: 'Headphones', color: 'bg-purple-500', status: 'ready' }
      },
      {
        id: 'audio-enhance',
        type: 'workflowTile',
        position: { x: 400, y: 100 },
        data: { 
          label: 'Audio Enhance', 
          icon: 'Volume2', 
          color: 'bg-google-yellow',
          settings: { noiseReduction: 'High', enhancement: 'Clarity' },
          status: 'ready'
        }
      },
      {
        id: 'background',
        type: 'workflowTile',
        position: { x: 700, y: 50 },
        data: { 
          label: 'Background', 
          icon: 'Image', 
          color: 'bg-pink-500',
          settings: { style: 'Animated Waveform', branding: true },
          status: 'ready'
        }
      },
      {
        id: 'captions',
        type: 'workflowTile',
        position: { x: 700, y: 150 },
        data: { 
          label: 'Captions', 
          icon: 'Subtitles', 
          color: 'bg-gemini-green',
          settings: { style: 'Podcast', highlight: 'Speaker' },
          status: 'ready'
        }
      }
    ],
    edges: [
      { id: 'e1', source: 'audio-input', target: 'audio-enhance', type: 'smoothstep' },
      { id: 'e2', source: 'audio-enhance', target: 'background', type: 'smoothstep' },
      { id: 'e3', source: 'audio-enhance', target: 'captions', type: 'smoothstep' }
    ]
  },
  {
    id: 'advanced-editing',
    name: 'Advanced Professional Edit',
    description: 'Comprehensive editing with AI-powered enhancements',
    category: 'Professional',
    difficulty: 'advanced',
    estimatedTime: '20-30 minutes',
    requiredInputs: ['Multiple video files', 'Script or outline', 'Style preferences'],
    expectedOutputs: ['Professional video', 'Color grading', 'Advanced transitions', 'Audio mixing'],
    nodes: [
      {
        id: 'video-input',
        type: 'workflowTile',
        position: { x: 100, y: 100 },
        data: { label: 'Video Input', icon: 'Video', color: 'bg-google-blue', status: 'ready' }
      },
      {
        id: 'eye-contact',
        type: 'workflowTile',
        position: { x: 300, y: 50 },
        data: { 
          label: 'Eye Contact', 
          icon: 'Eye', 
          color: 'bg-orange-500',
          settings: { accuracyBoost: true, naturalLookAway: false },
          status: 'ready'
        }
      },
      {
        id: 'audio-enhance',
        type: 'workflowTile',
        position: { x: 300, y: 150 },
        data: { 
          label: 'Audio Enhance', 
          icon: 'Volume2', 
          color: 'bg-google-yellow',
          settings: { noiseReduction: 'Maximum', enhancement: 'Professional' },
          status: 'ready'
        }
      },
      {
        id: 'cut',
        type: 'workflowTile',
        position: { x: 500, y: 100 },
        data: { 
          label: 'Smart Cut', 
          icon: 'Scissors', 
          color: 'bg-google-red',
          settings: { removeFillers: true, paceOptimization: true },
          status: 'ready'
        }
      },
      {
        id: 'b-roll',
        type: 'workflowTile',
        position: { x: 700, y: 50 },
        data: { 
          label: 'B-Roll', 
          icon: 'Film', 
          color: 'bg-purple-500',
          settings: { autoPlacement: true, contextAware: true },
          status: 'ready'
        }
      },
      {
        id: 'captions',
        type: 'workflowTile',
        position: { x: 700, y: 150 },
        data: { 
          label: 'Captions', 
          icon: 'Subtitles', 
          color: 'bg-gemini-green',
          settings: { style: 'Professional', animation: 'Fade' },
          status: 'ready'
        }
      }
    ],
    edges: [
      { id: 'e1', source: 'video-input', target: 'eye-contact', type: 'smoothstep' },
      { id: 'e2', source: 'video-input', target: 'audio-enhance', type: 'smoothstep' },
      { id: 'e3', source: 'eye-contact', target: 'cut', type: 'smoothstep' },
      { id: 'e4', source: 'audio-enhance', target: 'cut', type: 'smoothstep' },
      { id: 'e5', source: 'cut', target: 'b-roll', type: 'smoothstep' },
      { id: 'e6', source: 'cut', target: 'captions', type: 'smoothstep' }
    ],
    branching: [
      {
        nodeId: 'cut',
        condition: 'video_length',
        trueTarget: 'b-roll',
        falseTarget: 'captions',
        operator: 'greater_than',
        value: 300
      }
    ]
  }
];

export class WorkflowTemplateManager {
  getTemplates(): WorkflowTemplate[] {
    return WORKFLOW_TEMPLATES;
  }

  getTemplateById(id: string): WorkflowTemplate | undefined {
    return WORKFLOW_TEMPLATES.find(template => template.id === id);
  }

  getTemplatesByCategory(category: string): WorkflowTemplate[] {
    return WORKFLOW_TEMPLATES.filter(template => template.category === category);
  }

  getTemplatesByDifficulty(difficulty: 'beginner' | 'intermediate' | 'advanced'): WorkflowTemplate[] {
    return WORKFLOW_TEMPLATES.filter(template => template.difficulty === difficulty);
  }

  applyBranchingLogic(template: WorkflowTemplate, nodeData: any): { nextNodeId: string | null } {
    if (!template.branching) return { nextNodeId: null };

    for (const branch of template.branching) {
      const value = nodeData[branch.condition];
      let conditionMet = false;

      switch (branch.operator) {
        case 'equals':
          conditionMet = value === branch.value;
          break;
        case 'greater_than':
          conditionMet = value > branch.value;
          break;
        case 'less_than':
          conditionMet = value < branch.value;
          break;
        case 'contains':
          conditionMet = value && value.toString().includes(branch.value);
          break;
      }

      return { nextNodeId: conditionMet ? branch.trueTarget : branch.falseTarget };
    }

    return { nextNodeId: null };
  }
}

export const workflowTemplateManager = new WorkflowTemplateManager();