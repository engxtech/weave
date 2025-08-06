import { useState, useRef, useCallback, useEffect } from 'react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Textarea } from '@/components/ui/textarea';
import { Badge } from '@/components/ui/badge';
import { Separator } from '@/components/ui/separator';
import { ScrollArea } from '@/components/ui/scroll-area';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { 
  Play, Pause, Upload, Download, MessageSquare, Send, 
  Circle, Square, Type, Image, Volume2, Video, 
  Sparkles, Layers, Move, RotateCcw, Palette,
  Grid, Camera, Code, Zap, X, Trash2, ZoomIn, ZoomOut, Minus, Plus
} from 'lucide-react';
import { useToast } from '@/hooks/use-toast';
import { AppHeader } from '@/components/app-header';

// Types
interface TimelineElement {
  id: string;
  type: 'circle' | 'rect' | 'txt' | 'video' | 'audio' | 'image' | 'layout' | 'grid' | 'code' | 'effect' | 'subtitle';
  name: string;
  startTime: number;
  duration: number;
  properties: Record<string, any>;
  layer: number;
  parentId?: string; // For layout children
  children?: string[]; // For layout containers
}

interface VideoProject {
  id: string;
  name: string;
  duration: number;
  elements: TimelineElement[];
  canvasSize: { width: number; height: number };
}

interface ChatMessage {
  id: string;
  type: 'user' | 'assistant';
  content: string;
  timestamp: Date;
  actionType?: string;
}

function UnifiedVideoEditor() {
  
  // State
  const [project, setProject] = useState<VideoProject>({
    id: 'main-project',
    name: 'Untitled Project',
    duration: 30,
    elements: [],
    canvasSize: { width: 1920, height: 1080 }
  });
  
  const [selectedElement, setSelectedElement] = useState<TimelineElement | null>(null);
  const [currentTime, setCurrentTime] = useState(0);
  const [isPlaying, setIsPlaying] = useState(false);
  const [videoRef, setVideoRef] = useState<HTMLVideoElement | null>(null);
  const [isResizing, setIsResizing] = useState<{ elementId: string; side: 'left' | 'right' } | null>(null);
  const [isExporting, setIsExporting] = useState(false);
  const [showElementEditor, setShowElementEditor] = useState(false);
  const [messages, setMessages] = useState<ChatMessage[]>([
    {
      id: '1',
      type: 'assistant',
      content: 'Welcome to the Unified Video Editor! Try saying "Add a red circle" or "Create text animation"',
      timestamp: new Date()
    }
  ]);
  const [inputMessage, setInputMessage] = useState('');
  const [processing, setProcessing] = useState(false);
  const [draggedElement, setDraggedElement] = useState<Partial<TimelineElement> | null>(null);
  const [uploadedVideo, setUploadedVideo] = useState<string | null>(null);
  const [videoFile, setVideoFile] = useState<File | null>(null);
  const [timelineZoom, setTimelineZoom] = useState(1000); // 1000% = 10x zoom for detailed editing
  const [showSubtitleStyles, setShowSubtitleStyles] = useState(false);
  
  // Load split-screen video if provided via URL parameters
  useEffect(() => {
    const loadSplitScreenVideo = async () => {
      try {
        const urlParams = new URLSearchParams(window.location.search);
        const videoId = urlParams.get('video');
        
        if (videoId) {
          // Load the generated split-screen video
          const videoUrl = `/api/video/stream/${videoId}`;
          console.log('Loading split-screen video:', videoUrl);
          setUploadedVideo(videoUrl);

          // Load subtitle data if available
          const subtitleDataFile = videoId.replace('.mp4', '') + '_subtitles.json';
          try {
            const subtitleResponse = await fetch(`/api/video/${subtitleDataFile}`);
            if (subtitleResponse.ok) {
              const subtitleTrackData = await subtitleResponse.json();
              console.log('Loading split-screen subtitle data:', subtitleTrackData);
              
              setProject(prev => ({
                ...prev,
                name: `Split-Screen Video: ${videoId}`,
                elements: [
                  {
                    id: 'split-screen-video',
                    type: 'video',
                    name: 'Split-Screen Video',
                    startTime: 0,
                    duration: 30,
                    properties: {
                      src: videoUrl,
                      width: 1920,
                      height: 1080,
                      x: 0,
                      y: 0
                    },
                    layer: 0
                  },
                  subtitleTrackData // Add subtitle track as separate element
                ]
              }));

              setMessages(prev => [...prev, {
                id: Date.now().toString(),
                type: 'assistant',
                content: `Split-screen video loaded with ${subtitleTrackData.properties.totalSegments} subtitle segments! The subtitles are now available as a separate track for editing.`,
                timestamp: new Date(),
                actionType: 'load_split_screen'
              }]);

            } else {
              console.log('No subtitle data found for split-screen video');
              setProject(prev => ({
                ...prev,
                name: `Split-Screen Video: ${videoId}`,
                elements: [{
                  id: 'split-screen-video',
                  type: 'video',
                  name: 'Split-Screen Video',
                  startTime: 0,
                  duration: 30,
                  properties: {
                    src: videoUrl,
                    width: 1920,
                    height: 1080,
                    x: 0,
                    y: 0
                  },
                  layer: 0
                }]
              }));
            }
          } catch (subtitleError) {
            console.warn('Failed to load subtitle data:', subtitleError);
            // Load video without subtitles
            setProject(prev => ({
              ...prev,
              name: `Split-Screen Video: ${videoId}`,
              elements: [{
                id: 'split-screen-video',
                type: 'video',
                name: 'Split-Screen Video',
                startTime: 0,
                duration: 30,
                properties: {
                  src: videoUrl,
                  width: 1920,
                  height: 1080,
                  x: 0,
                  y: 0
                },
                layer: 0
              }]
            }));
          }
        }
      } catch (error) {
        console.error('Error loading split-screen video:', error);
      }
    };

    loadSplitScreenVideo();
  }, []);
  const [editingSubtitle, setEditingSubtitle] = useState<{elementId: string, segmentIndex: number, text: string} | null>(null);
  const [selectedSubtitleSegment, setSelectedSubtitleSegment] = useState<{elementId: string, segmentIndex: number} | null>(null);

  // Subtitle Design Templates (similar to standard video editing tools)
  const subtitleTemplates = [
    {
      name: 'YouTube Shorts',
      description: 'Official YouTube Shorts style with cyan highlighting',
      properties: {
        fontSize: 80,
        numSimultaneousWords: 4,
        textColor: '#ffffff',
        fontWeight: 800,
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
      name: 'TikTok Style',
      description: 'Bold white text with black outline',
      properties: {
        fontSize: 72,
        numSimultaneousWords: 3,
        textColor: '#ffffff',
        fontWeight: 900,
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
      name: 'Professional',
      description: 'Clean professional style for business videos',
      properties: {
        fontSize: 48,
        numSimultaneousWords: 6,
        textColor: '#ffffff',
        fontWeight: 600,
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
      name: 'Gaming',
      description: 'High-contrast gaming style with neon colors',
      properties: {
        fontSize: 64,
        numSimultaneousWords: 4,
        textColor: '#00FF00',
        fontWeight: 800,
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

  const timelineRef = useRef<HTMLDivElement>(null);
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const { toast } = useToast();

  // Enhanced Motion Canvas Components with Revideo Layout Support
  const motionCanvasComponents = [
    // Basic Components
    { 
      type: 'circle', 
      name: 'Circle', 
      icon: Circle, 
      category: 'Basic',
      defaultProps: { 
        radius: 50, 
        fill: '#ff0000', 
        x: 100, 
        y: 100,
        opacity: 1 
      },
      properties: [
        { name: 'radius', type: 'number', min: 1, max: 200 },
        { name: 'fill', type: 'color' },
        { name: 'x', type: 'number', min: 0, max: 1920 },
        { name: 'y', type: 'number', min: 0, max: 1080 },
        { name: 'opacity', type: 'number', min: 0, max: 1, step: 0.1 }
      ]
    },
    { 
      type: 'rect', 
      name: 'Rectangle', 
      icon: Square, 
      category: 'Basic',
      defaultProps: { 
        width: 100, 
        height: 100, 
        fill: '#0066ff', 
        x: 100, 
        y: 100,
        radius: 0,
        opacity: 1 
      },
      properties: [
        { name: 'width', type: 'number', min: 1, max: 1920 },
        { name: 'height', type: 'number', min: 1, max: 1080 },
        { name: 'fill', type: 'color' },
        { name: 'x', type: 'number', min: 0, max: 1920 },
        { name: 'y', type: 'number', min: 0, max: 1080 },
        { name: 'radius', type: 'number', min: 0, max: 50 },
        { name: 'opacity', type: 'number', min: 0, max: 1, step: 0.1 }
      ]
    },
    { 
      type: 'txt', 
      name: 'Text', 
      icon: Type, 
      category: 'Basic',
      defaultProps: { 
        text: 'Hello World', 
        fontSize: 48, 
        fill: '#ffffff', 
        x: 100, 
        y: 100,
        fontFamily: 'Arial',
        textAlign: 'left',
        opacity: 1 
      },
      properties: [
        { name: 'text', type: 'text' },
        { name: 'fontSize', type: 'number', min: 8, max: 200 },
        { name: 'fill', type: 'color' },
        { name: 'x', type: 'number', min: 0, max: 1920 },
        { name: 'y', type: 'number', min: 0, max: 1080 },
        { name: 'fontFamily', type: 'select', options: ['Arial', 'Helvetica', 'Times New Roman', 'Courier', 'Impact'] },
        { name: 'textAlign', type: 'select', options: ['left', 'center', 'right'] },
        { name: 'opacity', type: 'number', min: 0, max: 1, step: 0.1 }
      ]
    },
    { 
      type: 'subtitle', 
      name: 'AI Subtitles', 
      icon: MessageSquare, 
      category: 'Media',
      description: 'Auto-generated subtitles with word-level timing',
      defaultProps: { 
        fontSize: 32,
        fontFamily: 'Arial',
        fontWeight: 'bold',
        fill: '#ffffff',
        background: 'rgba(0,0,0,0.8)',
        padding: 10,
        borderRadius: 8,
        position: 'bottom-center',
        wordTiming: true,
        animationType: 'fade'
      },
      properties: [
        { name: 'fontSize', type: 'number', min: 12, max: 72, step: 2, defaultValue: 32 },
        { name: 'fontFamily', type: 'select', options: ['Arial', 'Times', 'Helvetica', 'Georgia'], defaultValue: 'Arial' },
        { name: 'fontWeight', type: 'select', options: ['normal', 'bold', '100', '200', '300', '400', '500', '600', '700', '800', '900'], defaultValue: 'bold' },
        { name: 'fill', type: 'color', defaultValue: '#ffffff' },
        { name: 'background', type: 'text', defaultValue: 'rgba(0,0,0,0.8)' },
        { name: 'padding', type: 'number', min: 0, max: 50, step: 2, defaultValue: 10 },
        { name: 'borderRadius', type: 'number', min: 0, max: 30, step: 2, defaultValue: 8 },
        { name: 'position', type: 'select', options: ['top-left', 'top-center', 'top-right', 'center-left', 'center', 'center-right', 'bottom-left', 'bottom-center', 'bottom-right'], defaultValue: 'bottom-center' },
        { name: 'animationType', type: 'select', options: ['none', 'fade', 'slide-up', 'typewriter', 'highlight'], defaultValue: 'fade' }
      ]
    },
    
    // Layout Components
    { 
      type: 'layout', 
      name: 'Layout Container', 
      icon: Grid, 
      category: 'Layout',
      defaultProps: { 
        direction: 'column',
        gap: 20,
        padding: 10,
        alignItems: 'center',
        justifyContent: 'center',
        width: 300,
        height: 200,
        x: 100,
        y: 100,
        fill: '#333333',
        opacity: 0.8,
        isLayoutRoot: true
      },
      properties: [
        { name: 'direction', type: 'select', options: ['row', 'column', 'row-reverse', 'column-reverse'] },
        { name: 'gap', type: 'number', min: 0, max: 100 },
        { name: 'padding', type: 'number', min: 0, max: 50 },
        { name: 'alignItems', type: 'select', options: ['flex-start', 'center', 'flex-end', 'stretch'] },
        { name: 'justifyContent', type: 'select', options: ['flex-start', 'center', 'flex-end', 'space-between', 'space-around'] },
        { name: 'width', type: 'number', min: 50, max: 1920 },
        { name: 'height', type: 'number', min: 50, max: 1080 },
        { name: 'x', type: 'number', min: 0, max: 1920 },
        { name: 'y', type: 'number', min: 0, max: 1080 },
        { name: 'fill', type: 'color' },
        { name: 'opacity', type: 'number', min: 0, max: 1, step: 0.1 }
      ]
    },
    
    // Media Components
    { 
      type: 'image', 
      name: 'Image', 
      icon: Image, 
      category: 'Media',
      defaultProps: { 
        src: '', 
        width: 200, 
        height: 200, 
        x: 100, 
        y: 100,
        opacity: 1 
      },
      properties: [
        { name: 'src', type: 'text' },
        { name: 'width', type: 'number', min: 10, max: 1920 },
        { name: 'height', type: 'number', min: 10, max: 1080 },
        { name: 'x', type: 'number', min: 0, max: 1920 },
        { name: 'y', type: 'number', min: 0, max: 1080 },
        { name: 'opacity', type: 'number', min: 0, max: 1, step: 0.1 }
      ]
    },
    { 
      type: 'video', 
      name: 'Video', 
      icon: Video, 
      category: 'Media',
      defaultProps: { 
        src: '', 
        width: 320, 
        height: 240, 
        x: 100, 
        y: 100,
        opacity: 1 
      },
      properties: [
        { name: 'src', type: 'text' },
        { name: 'width', type: 'number', min: 50, max: 1920 },
        { name: 'height', type: 'number', min: 50, max: 1080 },
        { name: 'x', type: 'number', min: 0, max: 1920 },
        { name: 'y', type: 'number', min: 0, max: 1080 },
        { name: 'opacity', type: 'number', min: 0, max: 1, step: 0.1 }
      ]
    },
    
    // Audio & Effects
    { 
      type: 'audio', 
      name: 'Audio', 
      icon: Volume2, 
      category: 'Audio',
      defaultProps: { 
        src: '', 
        volume: 1,
        loop: false 
      },
      properties: [
        { name: 'src', type: 'text' },
        { name: 'volume', type: 'number', min: 0, max: 2, step: 0.1 },
        { name: 'loop', type: 'boolean' }
      ]
    },
    // Professional Video Effects Library
    { 
      type: 'fade', 
      name: 'Fade Transition', 
      icon: Zap, 
      category: 'Effects',
      description: 'Smooth fade in/out transition',
      defaultProps: { 
        effectType: 'fade',
        fadeType: 'in',
        duration: 1,
        intensity: 1,
        easing: 'ease-in-out'
      },
      properties: [
        { name: 'fadeType', type: 'select', options: ['in', 'out', 'cross'] },
        { name: 'duration', type: 'number', min: 0.1, max: 5, step: 0.1, defaultValue: 1 },
        { name: 'intensity', type: 'number', min: 0, max: 1, step: 0.1, defaultValue: 1 },
        { name: 'easing', type: 'select', options: ['linear', 'ease-in', 'ease-out', 'ease-in-out'] }
      ]
    },
    {
      type: 'blur', 
      name: 'Blur Effect', 
      icon: Circle, 
      category: 'Effects',
      description: 'Apply gaussian blur with motion effects',
      defaultProps: { 
        effectType: 'blur',
        blurRadius: 5,
        motionBlur: false,
        direction: 0,
        quality: 'high'
      },
      properties: [
        { name: 'blurRadius', type: 'number', min: 0, max: 50, step: 1, defaultValue: 5 },
        { name: 'motionBlur', type: 'boolean', defaultValue: false },
        { name: 'direction', type: 'number', min: 0, max: 360, step: 1, defaultValue: 0 },
        { name: 'quality', type: 'select', options: ['low', 'medium', 'high'] }
      ]
    },
    {
      type: 'colorgrading', 
      name: 'Color Grading', 
      icon: Palette, 
      category: 'Effects',
      description: 'Professional color correction and grading',
      defaultProps: { 
        effectType: 'colorGrading',
        brightness: 0,
        contrast: 0,
        saturation: 0,
        hue: 0,
        shadows: 0,
        highlights: 0,
        preset: 'none'
      },
      properties: [
        { name: 'preset', type: 'select', options: ['none', 'cinematic', 'warm', 'cool', 'vintage', 'dramatic'] },
        { name: 'brightness', type: 'number', min: -100, max: 100, step: 1, defaultValue: 0 },
        { name: 'contrast', type: 'number', min: -100, max: 100, step: 1, defaultValue: 0 },
        { name: 'saturation', type: 'number', min: -100, max: 100, step: 1, defaultValue: 0 },
        { name: 'hue', type: 'number', min: -180, max: 180, step: 1, defaultValue: 0 },
        { name: 'shadows', type: 'number', min: -100, max: 100, step: 1, defaultValue: 0 },
        { name: 'highlights', type: 'number', min: -100, max: 100, step: 1, defaultValue: 0 }
      ]
    },
    {
      type: 'transform', 
      name: 'Transform', 
      icon: Move, 
      category: 'Effects',
      description: 'Scale, rotate, and transform elements',
      defaultProps: { 
        effectType: 'transform',
        scaleX: 1,
        scaleY: 1,
        rotation: 0,
        skewX: 0,
        skewY: 0,
        transformOrigin: 'center'
      },
      properties: [
        { name: 'scaleX', type: 'number', min: 0.1, max: 5, step: 0.1, defaultValue: 1 },
        { name: 'scaleY', type: 'number', min: 0.1, max: 5, step: 0.1, defaultValue: 1 },
        { name: 'rotation', type: 'number', min: -360, max: 360, step: 1, defaultValue: 0 },
        { name: 'skewX', type: 'number', min: -45, max: 45, step: 1, defaultValue: 0 },
        { name: 'skewY', type: 'number', min: -45, max: 45, step: 1, defaultValue: 0 },
        { name: 'transformOrigin', type: 'select', options: ['center', 'top-left', 'top-right', 'bottom-left', 'bottom-right'] }
      ]
    },
    {
      type: 'particles', 
      name: 'Particle System', 
      icon: Sparkles, 
      category: 'Effects',
      description: 'Dynamic particle effects and animations',
      defaultProps: { 
        effectType: 'particles',
        particleCount: 50,
        particleType: 'circle',
        speed: 1,
        size: 3,
        color: '#ffffff',
        gravity: 0,
        spread: 45
      },
      properties: [
        { name: 'particleCount', type: 'number', min: 1, max: 200, step: 1, defaultValue: 50 },
        { name: 'particleType', type: 'select', options: ['circle', 'star', 'heart', 'sparkle'] },
        { name: 'speed', type: 'number', min: 0.1, max: 5, step: 0.1, defaultValue: 1 },
        { name: 'size', type: 'number', min: 1, max: 20, step: 1, defaultValue: 3 },
        { name: 'color', type: 'color', defaultValue: '#ffffff' },
        { name: 'gravity', type: 'number', min: -2, max: 2, step: 0.1, defaultValue: 0 },
        { name: 'spread', type: 'number', min: 0, max: 180, step: 1, defaultValue: 45 }
      ]
    },
    {
      type: 'glitch', 
      name: 'Glitch Effect', 
      icon: Zap, 
      category: 'Effects',
      description: 'Digital glitch and distortion effects',
      defaultProps: { 
        effectType: 'glitch',
        intensity: 0.5,
        frequency: 2,
        chromaShift: true,
        scanlines: true,
        digitalNoise: 0.3
      },
      properties: [
        { name: 'intensity', type: 'number', min: 0, max: 1, step: 0.1, defaultValue: 0.5 },
        { name: 'frequency', type: 'number', min: 0.1, max: 10, step: 0.1, defaultValue: 2 },
        { name: 'chromaShift', type: 'boolean', defaultValue: true },
        { name: 'scanlines', type: 'boolean', defaultValue: true },
        { name: 'digitalNoise', type: 'number', min: 0, max: 1, step: 0.1, defaultValue: 0.3 }
      ]
    },
    {
      type: 'lightleak', 
      name: 'Light Leak', 
      icon: Camera, 
      category: 'Effects',
      description: 'Cinematic light leak overlay effects',
      defaultProps: { 
        effectType: 'lightLeak',
        leakType: 'warm',
        intensity: 0.6,
        position: 'top-right',
        size: 1,
        blendMode: 'screen'
      },
      properties: [
        { name: 'leakType', type: 'select', options: ['warm', 'cool', 'rainbow', 'vintage'] },
        { name: 'intensity', type: 'number', min: 0, max: 1, step: 0.1, defaultValue: 0.6 },
        { name: 'position', type: 'select', options: ['top-left', 'top-right', 'bottom-left', 'bottom-right', 'center'] },
        { name: 'size', type: 'number', min: 0.1, max: 3, step: 0.1, defaultValue: 1 },
        { name: 'blendMode', type: 'select', options: ['screen', 'overlay', 'soft-light', 'color-dodge'] }
      ]
    },
    {
      type: 'filmgrain', 
      name: 'Film Grain', 
      icon: Grid, 
      category: 'Effects',
      description: 'Authentic film grain texture',
      defaultProps: { 
        effectType: 'filmGrain',
        grainSize: 1,
        intensity: 0.3,
        filmType: '16mm',
        animated: true,
        monochrome: false
      },
      properties: [
        { name: 'grainSize', type: 'number', min: 0.5, max: 3, step: 0.1, defaultValue: 1 },
        { name: 'intensity', type: 'number', min: 0, max: 1, step: 0.1, defaultValue: 0.3 },
        { name: 'filmType', type: 'select', options: ['16mm', '35mm', 'digital', 'vintage'] },
        { name: 'animated', type: 'boolean', defaultValue: true },
        { name: 'monochrome', type: 'boolean', defaultValue: false }
      ]
    }
  ];

  // Canvas rendering
  const renderCanvas = useCallback(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;

    const ctx = canvas.getContext('2d');
    if (!ctx) return;

    // Clear canvas
    ctx.clearRect(0, 0, canvas.width, canvas.height);

    // Render elements at current time with enhanced preview
    project.elements.forEach(element => {
      if (currentTime >= element.startTime && currentTime <= element.startTime + element.duration) {
        const props = element.properties;
        const progress = (currentTime - element.startTime) / element.duration;
        
        ctx.save();
        
        // Add selection highlight for selected element
        if (selectedElement && selectedElement.id === element.id) {
          ctx.strokeStyle = '#00ff88';
          ctx.lineWidth = 3;
          ctx.setLineDash([5, 5]);
        }
        
        switch (element.type) {
          case 'layout':
            // Render layout container with enhanced styling
            ctx.fillStyle = props.fill || '#333333';
            ctx.globalAlpha = props.opacity || 0.8;
            const layoutWidth = props.width || 300;
            const layoutHeight = props.height || 200;
            const layoutX = props.x || 100;
            const layoutY = props.y || 100;
            
            // Draw layout background with rounded corners
            ctx.beginPath();
            const cornerRadius = 8;
            ctx.roundRect(layoutX, layoutY, layoutWidth, layoutHeight, cornerRadius);
            ctx.fill();
            
            // Draw layout border
            ctx.strokeStyle = '#555555';
            ctx.lineWidth = 2;
            ctx.stroke();
            
            // Draw layout grid lines to show flexbox structure
            ctx.strokeStyle = '#666666';
            ctx.lineWidth = 1;
            ctx.setLineDash([3, 3]);
            
            if (props.direction === 'row' || props.direction === 'row-reverse') {
              // Vertical divider lines for row layout
              const gap = props.gap || 20;
              const childCount = element.children?.length || 2;
              for (let i = 1; i < childCount; i++) {
                const dividerX = layoutX + (layoutWidth / childCount) * i;
                ctx.beginPath();
                ctx.moveTo(dividerX, layoutY + 10);
                ctx.lineTo(dividerX, layoutY + layoutHeight - 10);
                ctx.stroke();
              }
            } else {
              // Horizontal divider lines for column layout
              const gap = props.gap || 20;
              const childCount = element.children?.length || 2;
              for (let i = 1; i < childCount; i++) {
                const dividerY = layoutY + (layoutHeight / childCount) * i;
                ctx.beginPath();
                ctx.moveTo(layoutX + 10, dividerY);
                ctx.lineTo(layoutX + layoutWidth - 10, dividerY);
                ctx.stroke();
              }
            }
            
            ctx.setLineDash([]);
            
            // Layout label
            ctx.fillStyle = '#ffffff';
            ctx.font = '12px Arial';
            ctx.textAlign = 'left';
            ctx.fillText(`Layout (${props.direction})`, layoutX + 8, layoutY + 20);
            
            if (selectedElement && selectedElement.id === element.id) {
              ctx.strokeStyle = '#00ff88';
              ctx.lineWidth = 3;
              ctx.setLineDash([5, 5]);
              ctx.strokeRect(layoutX, layoutY, layoutWidth, layoutHeight);
              ctx.setLineDash([]);
            }
            break;
            
          case 'circle':
            ctx.beginPath();
            const radius = (props.radius || props.size || 50) * (1 + Math.sin(progress * Math.PI * 4) * 0.05);
            const circleX = props.x || 100;
            const circleY = props.y || 100;
            
            // If this element is in a layout, calculate position
            if (element.parentId) {
              const parent = project.elements.find(el => el.id === element.parentId);
              if (parent && parent.type === 'layout') {
                // Calculate layout position based on flexbox properties
                // This is a simplified version - in real Revideo, this would be more complex
                const layoutProps = parent.properties;
                const parentX = layoutProps.x || 100;
                const parentY = layoutProps.y || 100;
                const parentWidth = layoutProps.width || 300;
                const parentHeight = layoutProps.height || 200;
                const gap = layoutProps.gap || 20;
                const padding = layoutProps.padding || 10;
                
                // Position based on layout direction and sibling index
                // For now, center in layout container
                ctx.arc(parentX + parentWidth/2, parentY + parentHeight/2, radius, 0, Math.PI * 2);
              } else {
                ctx.arc(circleX, circleY, radius, 0, Math.PI * 2);
              }
            } else {
              ctx.arc(circleX, circleY, radius, 0, Math.PI * 2);
            }
            
            ctx.fillStyle = props.fill || '#ff0000';
            ctx.globalAlpha = props.opacity || 0.9;
            ctx.fill();
            if (selectedElement && selectedElement.id === element.id) {
              ctx.stroke();
            }
            break;
            
          case 'rect':
            ctx.fillStyle = props.fill || '#0066ff';
            ctx.globalAlpha = props.opacity || 0.8;
            const width = props.width || 100;
            const height = props.height || 100;
            let x = props.x || 100;
            let y = props.y || 100;
            
            // If this element is in a layout, calculate position
            if (element.parentId) {
              const parent = project.elements.find(el => el.id === element.parentId);
              if (parent && parent.type === 'layout') {
                const layoutProps = parent.properties;
                const parentX = layoutProps.x || 100;
                const parentY = layoutProps.y || 100;
                const parentWidth = layoutProps.width || 300;
                const parentHeight = layoutProps.height || 200;
                
                // Center in layout for now
                x = parentX + (parentWidth - width) / 2;
                y = parentY + (parentHeight - height) / 2;
              }
            }
            
            // Draw rounded rectangle if radius is specified
            if (props.radius && props.radius > 0) {
              ctx.beginPath();
              ctx.roundRect(x, y, width, height, props.radius);
              ctx.fill();
              if (selectedElement && selectedElement.id === element.id) {
                ctx.stroke();
              }
            } else {
              ctx.fillRect(x, y, width, height);
              if (selectedElement && selectedElement.id === element.id) {
                ctx.strokeRect(x, y, width, height);
              }
            }
            break;
            
          case 'txt':
            ctx.fillStyle = props.fill || props.color || '#ffffff';
            ctx.font = `${props.fontWeight || 'normal'} ${props.fontSize || 48}px ${props.fontFamily || 'Arial'}`;
            ctx.textAlign = props.textAlign || 'left';
            ctx.globalAlpha = props.opacity || 1;
            
            let textX = props.x || 100;
            let textY = props.y || 100;
            
            // If this element is in a layout, calculate position
            if (element.parentId) {
              const parent = project.elements.find(el => el.id === element.parentId);
              if (parent && parent.type === 'layout') {
                const layoutProps = parent.properties;
                const parentX = layoutProps.x || 100;
                const parentY = layoutProps.y || 100;
                const parentWidth = layoutProps.width || 300;
                const parentHeight = layoutProps.height || 200;
                
                // Center text in layout
                textX = parentX + parentWidth / 2;
                textY = parentY + parentHeight / 2;
                ctx.textAlign = 'center';
              }
            }
            
            // Text shadow for visibility
            ctx.shadowColor = 'rgba(0, 0, 0, 0.8)';
            ctx.shadowBlur = 4;
            ctx.shadowOffsetX = 2;
            ctx.shadowOffsetY = 2;
            
            const text = props.text || 'Hello';
            ctx.fillText(text, textX, textY + (props.fontSize || 48));
            
            if (selectedElement && selectedElement.id === element.id) {
              const metrics = ctx.measureText(text);
              ctx.shadowColor = 'transparent';
              ctx.strokeRect(textX - 5, textY + 5, metrics.width + 10, (props.fontSize || 48) + 10);
            }
            break;
            
          case 'effect':
            // Enhanced professional effects rendering
            const effectType = props.effectType || props.type || 'fade';
            const intensity = props.intensity || 1;
            const effectProgress = progress;
            
            ctx.save();
            
            switch (effectType) {
              case 'fade':
                const fadeAlpha = props.fadeType === 'in' 
                  ? effectProgress * intensity
                  : props.fadeType === 'out' 
                    ? (1 - effectProgress) * intensity
                    : Math.sin(effectProgress * Math.PI) * intensity;
                ctx.fillStyle = `rgba(0, 0, 0, ${fadeAlpha * 0.8})`;
                ctx.fillRect(0, 0, canvas.width, canvas.height);
                break;
                
              case 'blur':
                // Simulate blur with multiple offset renders
                const blurRadius = (props.blurRadius || 5) * intensity;
                ctx.filter = `blur(${Math.min(blurRadius, 20)}px)`;
                ctx.fillStyle = `rgba(100, 149, 237, ${0.3 * intensity})`;
                ctx.fillRect(0, 0, canvas.width, canvas.height);
                break;
                
              case 'colorGrading':
                const preset = props.preset || 'none';
                let overlayColor = 'rgba(255, 255, 255, 0.1)';
                switch (preset) {
                  case 'cinematic':
                    overlayColor = `rgba(30, 41, 59, ${0.4 * intensity})`;
                    break;
                  case 'warm':
                    overlayColor = `rgba(245, 158, 11, ${0.3 * intensity})`;
                    break;
                  case 'cool':
                    overlayColor = `rgba(59, 130, 246, ${0.3 * intensity})`;
                    break;
                  case 'vintage':
                    overlayColor = `rgba(139, 92, 246, ${0.2 * intensity})`;
                    break;
                  case 'dramatic':
                    overlayColor = `rgba(239, 68, 68, ${0.25 * intensity})`;
                    break;
                }
                ctx.fillStyle = overlayColor;
                ctx.fillRect(0, 0, canvas.width, canvas.height);
                break;
                
              case 'glitch':
                // Digital glitch effect
                const glitchIntensity = props.intensity || 0.5;
                const frequency = props.frequency || 2;
                
                if (Math.random() < glitchIntensity * 0.1) {
                  for (let i = 0; i < 5; i++) {
                    const y = Math.random() * canvas.height;
                    const height = 5 + Math.random() * 15;
                    const offset = (Math.random() - 0.5) * 20 * glitchIntensity;
                    
                    ctx.fillStyle = `rgba(${255 * Math.random()}, ${100 * Math.random()}, ${255 * Math.random()}, 0.8)`;
                    ctx.fillRect(offset, y, canvas.width, height);
                  }
                }
                break;
                
              case 'particles':
                // Particle system effect
                const particleCount = Math.min(props.particleCount || 50, 100);
                const particleSize = props.size || 3;
                const particleColor = props.color || '#ffffff';
                
                ctx.fillStyle = particleColor;
                for (let i = 0; i < particleCount; i++) {
                  const angle = (i / particleCount) * Math.PI * 2 + effectProgress * Math.PI * 2;
                  const radius = 100 + Math.sin(effectProgress * Math.PI * 4 + i) * 50;
                  const x = canvas.width / 2 + Math.cos(angle) * radius;
                  const y = canvas.height / 2 + Math.sin(angle) * radius;
                  const size = particleSize * (0.5 + Math.sin(effectProgress * Math.PI * 2 + i) * 0.5);
                  
                  ctx.beginPath();
                  ctx.arc(x, y, size, 0, Math.PI * 2);
                  ctx.fill();
                }
                break;
                
              case 'lightLeak':
                // Cinematic light leak effect
                const leakType = props.leakType || 'warm';
                const leakSize = (props.size || 1) * 200;
                const leakIntensity = props.intensity || 0.6;
                
                const gradient = ctx.createRadialGradient(
                  canvas.width * 0.8, canvas.height * 0.2, 0,
                  canvas.width * 0.8, canvas.height * 0.2, leakSize
                );
                
                switch (leakType) {
                  case 'warm':
                    gradient.addColorStop(0, `rgba(251, 191, 36, ${leakIntensity})`);
                    gradient.addColorStop(0.5, `rgba(245, 158, 11, ${leakIntensity * 0.5})`);
                    break;
                  case 'cool':
                    gradient.addColorStop(0, `rgba(59, 130, 246, ${leakIntensity})`);
                    gradient.addColorStop(0.5, `rgba(29, 78, 216, ${leakIntensity * 0.5})`);
                    break;
                  case 'rainbow':
                    gradient.addColorStop(0, `rgba(168, 85, 247, ${leakIntensity})`);
                    gradient.addColorStop(0.5, `rgba(236, 72, 153, ${leakIntensity * 0.5})`);
                    break;
                }
                gradient.addColorStop(1, 'rgba(255, 255, 255, 0)');
                
                ctx.fillStyle = gradient;
                ctx.fillRect(0, 0, canvas.width, canvas.height);
                break;
                
              case 'filmGrain':
                // Film grain texture effect
                const grainIntensity = props.intensity || 0.3;
                const grainSize = props.grainSize || 1;
                
                for (let i = 0; i < 500; i++) {
                  const x = Math.random() * canvas.width;
                  const y = Math.random() * canvas.height;
                  const opacity = Math.random() * grainIntensity;
                  
                  ctx.fillStyle = `rgba(255, 255, 255, ${opacity})`;
                  ctx.fillRect(x, y, grainSize, grainSize);
                }
                break;
                
              default:
                // Default effect preview
                ctx.fillStyle = `rgba(255, 107, 53, ${0.3 * intensity})`;
                ctx.fillRect(0, 0, canvas.width, canvas.height);
            }
            
            ctx.restore();
            break;
            
          case 'subtitle':
            // Render YouTube Shorts style subtitles with 4-5 word batches
            const subtitleProps = props;
            const subtitleData = subtitleProps.subtitleData || [];
            
            // Find the current subtitle segment that should be displayed
            const currentSegment = subtitleData.find((segment: any) => {
              if (!segment.words || segment.words.length === 0) return false;
              const segmentStart = segment.words[0].start;
              const segmentEnd = segment.words[segment.words.length - 1].end;
              return currentTime >= segmentStart && currentTime <= segmentEnd;
            });
            
            if (currentSegment && currentSegment.words) {
              ctx.save();
              
              // Set up subtitle styling based on YouTube Shorts properties
              const fontSize = subtitleProps.fontSize || 80;
              const fontWeight = subtitleProps.fontWeight || 800;
              const fontFamily = subtitleProps.fontFamily || 'Mulish';
              const textColor = subtitleProps.textColor || '#ffffff';
              const shadowColor = subtitleProps.shadowColor || '#000000';
              const shadowBlur = subtitleProps.shadowBlur || 30;
              const numSimultaneousWords = subtitleProps.numSimultaneousWords || 4;
              
              ctx.font = `${fontWeight} ${fontSize}px ${fontFamily}`;
              ctx.textAlign = 'center';
              ctx.textBaseline = 'middle';
              
              // Add shadow for better visibility
              ctx.shadowColor = shadowColor;
              ctx.shadowBlur = shadowBlur;
              ctx.shadowOffsetX = 0;
              ctx.shadowOffsetY = 0;
              
              // Position subtitles at bottom center (YouTube Shorts style)
              const x = canvas.width / 2;
              const y = canvas.height - 150; // Bottom area
              
              // Display all words in the segment simultaneously (4-5 words at once per YouTube Shorts style)
              const allWordsInSegment = currentSegment.words;
              const fullText = allWordsInSegment.map((w: any) => w.punctuated_word).join(' ');
              
              // Find the currently spoken word within the segment for highlighting
              const currentWordIndex = allWordsInSegment.findIndex((word: any) => 
                currentTime >= word.start && currentTime <= word.end
              );
              
              // Draw red background box for the entire text segment (YouTube Shorts style)
              if (subtitleProps.currentWordBackgroundColor && fullText) {
                const metrics = ctx.measureText(fullText);
                const padding = 20;
                ctx.shadowColor = 'transparent';
                ctx.fillStyle = subtitleProps.currentWordBackgroundColor;
                ctx.fillRect(
                  x - metrics.width / 2 - padding,
                  y - fontSize / 2 - padding,
                  metrics.width + padding * 2,
                  fontSize + padding * 2
                );
                ctx.shadowColor = shadowColor;
                ctx.shadowBlur = shadowBlur;
              }
              
              // Draw each word with individual highlighting (YouTube Shorts style)
              const words = allWordsInSegment.map((w: any) => w.punctuated_word);
              const spaceWidth = ctx.measureText(' ').width;
              let currentX = x - ctx.measureText(fullText).width / 2;
              
              words.forEach((word: string, index: number) => {
                const isCurrentWord = index === currentWordIndex;
                
                // Set color: cyan for current word, white for others (YouTube Shorts style)
                ctx.fillStyle = isCurrentWord 
                  ? (subtitleProps.currentWordColor || '#00FFFF') 
                  : textColor;
                
                // Measure word width for positioning
                const wordWidth = ctx.measureText(word).width;
                
                // Draw the word
                ctx.fillText(word, currentX + wordWidth / 2, y);
                
                // Move X position for next word (include space)
                currentX += wordWidth;
                if (index < words.length - 1) {
                  currentX += spaceWidth;
                }
              });
              
              ctx.restore();
            }
            break;
        }
        
        ctx.restore();
      }
    });
  }, [project.elements, currentTime]);

  // Function to save subtitle edits
  const saveSubtitleEdit = useCallback((elementId: string, segmentIndex: number, newText: string) => {
    setProject(prev => ({
      ...prev,
      elements: prev.elements.map(element => {
        if (element.id === elementId && element.type === 'subtitle') {
          const updatedSubtitleData = [...(element.properties.subtitleData || [])];
          if (updatedSubtitleData[segmentIndex]) {
            // Update the segment text
            updatedSubtitleData[segmentIndex].text = newText;
            
            // Update individual words to match the new text
            const newWords = newText.split(' ').map((word, wordIndex) => {
              const originalWord = updatedSubtitleData[segmentIndex].words[wordIndex];
              return originalWord ? {
                ...originalWord,
                word: word.replace(/[^\w]/g, ''), // Remove punctuation for word
                punctuated_word: word // Keep punctuation for display
              } : {
                word: word.replace(/[^\w]/g, ''),
                punctuated_word: word,
                start: originalWord?.start || 0,
                end: originalWord?.end || 1,
                confidence: 0.9
              };
            });
            
            updatedSubtitleData[segmentIndex].words = newWords;
          }
          
          return {
            ...element,
            properties: {
              ...element.properties,
              subtitleData: updatedSubtitleData
            }
          };
        }
        return element;
      })
    }));
    
    // Show success message
    toast({
      title: "Subtitle Updated",
      description: `Text changed to: "${newText}"`,
      duration: 2000,
    });
  }, [toast]);

  // Chat handling
  const handleSendMessage = useCallback(async (e: React.FormEvent) => {
    e.preventDefault();
    if (!inputMessage.trim() || processing) return;

    const userMessage: ChatMessage = {
      id: Date.now().toString(),
      type: 'user',
      content: inputMessage,
      timestamp: new Date()
    };

    setMessages(prev => [...prev, userMessage]);
    const currentCommand = inputMessage;
    setInputMessage('');
    setProcessing(true);

    try {
      // Check if this is a subtitle generation request
      const isSubtitleRequest = currentCommand.toLowerCase().includes('subtitle') || 
                               currentCommand.toLowerCase().includes('caption') || 
                               currentCommand.toLowerCase().includes('transcribe');

      if (isSubtitleRequest && uploadedVideo) {
        await handleSubtitleGeneration(currentCommand);
        return;
      } else if (isSubtitleRequest && !uploadedVideo) {
        setMessages(prev => [...prev, {
          id: (Date.now() + 1).toString(),
          type: 'assistant',
          content: 'Please upload a video first to generate subtitles.',
          timestamp: new Date()
        }]);
        setProcessing(false);
        return;
      }

      const response = await fetch('/api/unified-revideo/ai-command', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          command: currentCommand,
          project: project,
          currentTime: currentTime
        })
      });

      const result = await response.json();
      
      const assistantMessage: ChatMessage = {
        id: (Date.now() + 1).toString(),
        type: 'assistant',
        content: result.response || 'Command processed',
        timestamp: new Date(),
        actionType: result.actionType
      };

      setMessages(prev => [...prev, assistantMessage]);

      if (result.newElement) {
        setProject(prev => ({
          ...prev,
          elements: [...prev.elements, {
            ...result.newElement,
            id: Date.now().toString(),
            startTime: result.newElement.startTime || currentTime,
            layer: prev.elements.length
          }]
        }));
      }
    } catch (error) {
      console.error('AI command error:', error);
    } finally {
      setProcessing(false);
    }
  }, [inputMessage, processing, project, currentTime, uploadedVideo]);

  const handleSubtitleGeneration = async (command: string) => {
    try {
      setMessages(prev => [...prev, {
        id: Date.now().toString(),
        type: 'assistant',
        content: 'Generating AI-powered subtitles with word-level timing using Gemini transcription...',
        timestamp: new Date()
      }]);

      const response = await fetch('/api/unified-revideo/generate-subtitles', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ 
          videoFilename: uploadedVideo 
        })
      });

      const data = await response.json();
      
      if (data.success) {
        // Create single subtitle track element (based on official Revideo YouTube Shorts example)
        const subtitleTrack = {
          id: `subtitles_track_${Date.now()}`,
          type: 'subtitle' as const,
          name: 'Subtitles',
          startTime: 0,
          duration: project.duration,
          properties: {
            // Official YouTube Shorts properties from redotvideo/examples
            fontSize: 80,
            numSimultaneousWords: 5, // how many words are shown at most simultaneously
            textColor: '#ffffff',
            fontWeight: 800,
            fontFamily: 'Mulish',
            stream: false, // if true, words appear one by one
            textAlign: 'center',
            textBoxWidthInPercent: 70,
            fadeInAnimation: true,
            currentWordColor: '#00FFFF', // cyan
            currentWordBackgroundColor: '#FF0000', // red background boxes
            shadowColor: '#000000',
            shadowBlur: 30,
            borderColor: undefined,
            borderWidth: undefined,
            // Subtitle data from API
            subtitleData: data.subtitles,
            wordData: data.subtitles.flatMap((s: any) => s.words || []),
            totalSegments: data.totalSegments,
            // Position (bottom center for YouTube Shorts)
            x: 640,
            y: 900,
            width: 'auto',
            height: 'auto'
          },
          layer: project.elements.length
        };
        
        setProject(prev => ({
          ...prev,
          elements: [...prev.elements, subtitleTrack]
        }));

        setMessages(prev => [...prev, {
          id: (Date.now() + 1).toString(),
          type: 'assistant',
          content: `Successfully created single "Subtitles" track with ${data.totalSegments} segments using official YouTube Shorts styling! Features cyan word highlighting (#00FFFF), red background boxes (#FF0000), 80px font size, and professional fade-in animations with 5 simultaneous words display.`,
          timestamp: new Date(),
          actionType: 'add_subtitles'
        }]);

        toast({ 
          title: "Subtitles Generated", 
          description: `Single subtitle track created with YouTube Shorts styling` 
        });
      } else {
        throw new Error(data.error || 'Failed to generate subtitles');
      }

    } catch (error) {
      console.error('Subtitle generation error:', error);
      setMessages(prev => [...prev, {
        id: (Date.now() + 1).toString(),
        type: 'assistant',
        content: `Error generating subtitles: ${error instanceof Error ? error.message : 'Unknown error'}`,
        timestamp: new Date()
      }]);
    } finally {
      setProcessing(false);
    }
  };

  // Drag and Drop
  const handleTimelineDrop = useCallback((e: React.DragEvent) => {
    e.preventDefault();
    console.log('Timeline drop triggered', { draggedElement });
    
    if (!draggedElement || !timelineRef.current) {
      console.log('Drop failed: missing element or timeline ref');
      return;
    }

    const rect = timelineRef.current.getBoundingClientRect();
    const x = e.clientX - rect.left;
    const timeScale = project.duration / rect.width;
    const dropTime = x * timeScale;

    const newElement: TimelineElement = {
      id: `${draggedElement.type}_${Date.now()}`,
      type: draggedElement.type as any,
      name: draggedElement.name || draggedElement.type || 'Element',
      startTime: Math.max(0, dropTime),
      duration: draggedElement.duration || 5,
      properties: { ...draggedElement.properties },
      layer: project.elements.length,
      parentId: draggedElement.parentId,
      children: draggedElement.type === 'layout' ? [] : undefined
    };

    // If dropping onto a layout element, check for collision and auto-assign as child
    const layoutElements = project.elements.filter(el => el.type === 'layout');
    for (const layout of layoutElements) {
      const layoutProps = layout.properties;
      const layoutX = layoutProps.x || 100;
      const layoutY = layoutProps.y || 100;
      const layoutWidth = layoutProps.width || 300;
      const layoutHeight = layoutProps.height || 200;
      const elementX = newElement.properties.x || 100;
      const elementY = newElement.properties.y || 100;
      
      // Check if element is being dropped inside layout bounds
      if (elementX >= layoutX && elementX <= layoutX + layoutWidth &&
          elementY >= layoutY && elementY <= layoutY + layoutHeight) {
        newElement.parentId = layout.id;
        break;
      }
    }

    console.log('Adding new element to timeline:', newElement);

    setProject(prev => {
      let updatedElements = [...prev.elements, newElement];
      
      // If element was assigned to a layout, update the layout's children array
      if (newElement.parentId) {
        updatedElements = updatedElements.map(el => 
          el.id === newElement.parentId && el.type === 'layout'
            ? { ...el, children: [...(el.children || []), newElement.id] }
            : el
        );
      }
      
      return {
        ...prev,
        elements: updatedElements
      };
    });

    setDraggedElement(null);
    
    setTimeout(() => {
      renderCanvas();
    }, 100);
    
    toast({
      title: 'Element Added',
      description: `${newElement.name} added at ${dropTime.toFixed(1)}s`
    });
  }, [draggedElement, project.duration, toast]);

  const handleTimelineClick = useCallback((e: React.MouseEvent) => {
    if (!timelineRef.current) return;
    
    const rect = timelineRef.current.getBoundingClientRect();
    const x = e.clientX - rect.left;
    const timeScale = project.duration / rect.width;
    const clickTime = x * timeScale;
    
    const newTime = Math.max(0, Math.min(clickTime, project.duration));
    setCurrentTime(newTime);
    
    // Sync video element to clicked time
    if (videoRef) {
      videoRef.currentTime = newTime;
    }
  }, [project.duration, videoRef]);

  // Video upload
  const handleFileInputChange = useCallback((e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file || !file.type.startsWith('video/')) {
      toast({
        title: "Invalid file type",
        description: "Please select a video file",
        variant: "destructive",
      });
      return;
    }

    const formData = new FormData();
    formData.append('video', file);

    fetch('/api/upload-video', {
      method: 'POST',
      body: formData,
    })
    .then(response => response.json())
    .then(result => {
      setUploadedVideo(result.filename);
      setVideoFile(file);
      toast({
        title: "Video uploaded successfully",
        description: `${file.name} is ready for editing`,
      });
    })
    .catch(error => {
      console.error('Video upload error:', error);
      toast({
        title: "Upload failed",
        description: "Failed to upload video file",
        variant: "destructive",
      });
    });
  }, [toast]);

  // Video Export
  const handleExport = useCallback(async () => {
    if (project.elements.length === 0) {
      toast({
        title: 'No Elements',
        description: 'Add some elements to the timeline first',
        variant: 'destructive'
      });
      return;
    }

    try {
      setProcessing(true);
      
      toast({
        title: 'Export Starting',
        description: 'Combining timeline elements with video...'
      });
      
      const response = await fetch('/api/export-with-elements', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          project: project,
          videoFile: uploadedVideo ? uploadedVideo.split('/').pop() : null
        })
      });

      if (!response.ok) {
        const error = await response.json();
        throw new Error(error.message || 'Export failed');
      }
      
      const result = await response.json();
      
      if (result.success && result.downloadUrl) {
        // Trigger download
        const link = document.createElement('a');
        link.href = result.downloadUrl;
        link.download = result.filename || 'exported-video.mp4';
        link.click();
        
        toast({
          title: 'Export Complete',
          description: 'Your video with timeline elements has been exported!'
        });
      }
    } catch (error) {
      console.error('Export error:', error);
      toast({
        title: 'Export Failed',
        description: error instanceof Error ? error.message : 'Failed to export video',
        variant: 'destructive'
      });
    } finally {
      setProcessing(false);
    }
  }, [project, uploadedVideo, toast]);

  // Effects
  useEffect(() => {
    renderCanvas();
  }, [renderCanvas]);

  // Mouse resize handlers
  useEffect(() => {
    const handleMouseMove = (e: MouseEvent) => {
      if (!isResizing || !timelineRef.current) return;
      
      const rect = timelineRef.current.getBoundingClientRect();
      const timeScale = project.duration / rect.width;
      const currentTime = (e.clientX - rect.left) * timeScale;
      
      const updatedElements = project.elements.map(el => {
        if (el.id === isResizing.elementId) {
          if (isResizing.side === 'left') {
            const maxStart = el.startTime + el.duration - 0.1; // Minimum 0.1s duration
            const newStartTime = Math.max(0, Math.min(currentTime, maxStart));
            const newDuration = el.duration + (el.startTime - newStartTime);
            return { ...el, startTime: newStartTime, duration: Math.max(0.1, newDuration) };
          } else {
            const minEnd = el.startTime + 0.1; // Minimum 0.1s duration
            const newEndTime = Math.max(minEnd, Math.min(currentTime, project.duration));
            const newDuration = newEndTime - el.startTime;
            return { ...el, duration: Math.max(0.1, newDuration) };
          }
        }
        return el;
      });
      
      setProject(prev => ({ ...prev, elements: updatedElements }));
      
      // Update selected element if it's being resized
      if (selectedElement && selectedElement.id === isResizing.elementId) {
        const updatedSelected = updatedElements.find(el => el.id === isResizing.elementId);
        if (updatedSelected) setSelectedElement(updatedSelected);
      }
    };

    const handleMouseUp = () => {
      setIsResizing(null);
    };

    if (isResizing) {
      document.addEventListener('mousemove', handleMouseMove);
      document.addEventListener('mouseup', handleMouseUp);
      document.body.style.cursor = 'ew-resize';
    }

    return () => {
      document.removeEventListener('mousemove', handleMouseMove);
      document.removeEventListener('mouseup', handleMouseUp);
      document.body.style.cursor = '';
    };
  }, [isResizing, project.duration, project.elements, selectedElement]);



  const formatTime = useCallback((time: number) => {
    const minutes = Math.floor(time / 60);
    const seconds = Math.floor(time % 60);
    return `${minutes}:${seconds.toString().padStart(2, '0')}`;
  }, []);

  const getElementColor = (type: string) => {
    switch (type) {
      case 'circle': return 'from-red-600/90 to-red-500/90 border-red-400/50';
      case 'rect': return 'from-blue-600/90 to-blue-500/90 border-blue-400/50';
      case 'txt': return 'from-green-600/90 to-green-500/90 border-green-400/50';
      case 'subtitle': return 'from-cyan-600/90 to-cyan-500/90 border-cyan-400/50';
      case 'video': return 'from-purple-600/90 to-purple-500/90 border-purple-400/50';
      case 'audio': return 'from-orange-600/90 to-orange-500/90 border-orange-400/50';
      case 'image': return 'from-pink-600/90 to-pink-500/90 border-pink-400/50';
      case 'layout': return 'from-cyan-600/90 to-cyan-500/90 border-cyan-400/50';
      case 'effect': return 'from-yellow-600/90 to-yellow-500/90 border-yellow-400/50';
      default: return 'from-slate-600/90 to-slate-500/90 border-slate-400/50';
    }
  };

  return (
    <div className="min-h-screen bg-slate-950 flex flex-col">
      <AppHeader />
      
      <div className="flex-1 flex overflow-hidden h-[calc(100vh-4rem)]">
        {/* Left Components Panel / Element Editor */}
        <div className="w-80 bg-slate-900/95 backdrop-blur-xl border-r border-slate-800 flex flex-col">
          <div className="p-4 border-b border-slate-800 shrink-0">
            <div className="flex items-center gap-3">
              <div className="w-8 h-8 bg-gradient-to-br from-cyan-500 to-blue-500 rounded-full flex items-center justify-center">
                <Layers className="w-4 h-4 text-white" />
              </div>
              <div>
                <h2 className="text-white font-semibold text-sm">
                  {selectedElement ? 'Element Editor' : 'Motion Canvas'}
                </h2>
                <p className="text-slate-400 text-xs">
                  {selectedElement ? `Editing ${selectedElement.type}` : 'Components Library'}
                </p>
              </div>
            </div>
          </div>

          <ScrollArea className="flex-1">
            <div className="p-4">
              {selectedElement ? (
                // Enhanced Element Editor Panel with all properties
                (() => {
                  const componentDef = motionCanvasComponents.find(c => c.type === selectedElement.type);
                  
                  const updateElementProperty = (property: string, value: any) => {
                    const updatedElements = project.elements.map(el => 
                      el.id === selectedElement.id 
                        ? { ...el, properties: { ...el.properties, [property]: value } }
                        : el
                    );
                    setProject(prev => ({ ...prev, elements: updatedElements }));
                    setSelectedElement(prev => prev ? { ...prev, properties: { ...prev.properties, [property]: value } } : null);
                  };

                  const deleteElement = (elementId: string) => {
                    setProject(prev => {
                      const elementToDelete = prev.elements.find(el => el.id === elementId);
                      let updatedElements = prev.elements.filter(el => el.id !== elementId);
                      
                      // If deleting a layout, also remove all its children
                      if (elementToDelete?.type === 'layout' && elementToDelete.children) {
                        updatedElements = updatedElements.filter(el => !elementToDelete.children?.includes(el.id));
                      }
                      
                      // If deleting a child element, remove it from parent's children array
                      if (elementToDelete?.parentId) {
                        updatedElements = updatedElements.map(el => 
                          el.id === elementToDelete.parentId && el.children
                            ? { ...el, children: el.children.filter(childId => childId !== elementId) }
                            : el
                        );
                      }
                      
                      return {
                        ...prev,
                        elements: updatedElements
                      };
                    });
                    setSelectedElement(null);
                  };

                  return (
                    <div className="space-y-4">
                      <div className="flex items-center justify-between">
                        <h3 className="text-sm font-medium text-white">Edit {componentDef?.name || selectedElement.type}</h3>
                        <Badge variant="outline" className="text-xs">
                          {selectedElement.type}
                        </Badge>
                      </div>
                      
                      <div className="space-y-3 max-h-96 overflow-y-auto">
                        {/* Element Name */}
                        <div>
                          <label className="text-xs text-slate-400 mb-1 block">Name</label>
                          <Input 
                            value={selectedElement.name}
                            onChange={(e) => {
                              const updatedElements = project.elements.map(el => 
                                el.id === selectedElement.id ? { ...el, name: e.target.value } : el
                              );
                              setProject(prev => ({ ...prev, elements: updatedElements }));
                              setSelectedElement({ ...selectedElement, name: e.target.value });
                            }}
                            className="h-8 bg-slate-800 border-slate-600 text-white"
                          />
                        </div>
                        
                        {/* Dynamic Properties based on component definition */}
                        {componentDef?.properties.map((prop) => (
                          <div key={prop.name}>
                            <label className="text-xs text-slate-400 mb-1 block capitalize">
                              {prop.name.replace(/([A-Z])/g, ' $1').trim()}
                            </label>
                            
                            {prop.type === 'number' && (
                              <Input 
                                type="number"
                                min={prop.min}
                                max={prop.max}
                                step={prop.step || 1}
                                value={selectedElement.properties[prop.name] ?? (prop as any).defaultValue ?? 0}
                                onChange={(e) => updateElementProperty(prop.name, parseFloat(e.target.value))}
                                className="h-8 bg-slate-800 border-slate-600 text-white"
                              />
                            )}
                            
                            {prop.type === 'text' && (
                              <Input 
                                value={selectedElement.properties[prop.name] ?? ''}
                                onChange={(e) => updateElementProperty(prop.name, e.target.value)}
                                className="h-8 bg-slate-800 border-slate-600 text-white"
                              />
                            )}
                            
                            {prop.type === 'color' && (
                              <Input 
                                type="color"
                                value={selectedElement.properties[prop.name] ?? '#ffffff'}
                                onChange={(e) => updateElementProperty(prop.name, e.target.value)}
                                className="h-8 bg-slate-800 border-slate-600"
                              />
                            )}
                            
                            {prop.type === 'select' && (prop as any).options && (
                              <select 
                                value={selectedElement.properties[prop.name] ?? (prop as any).options[0]}
                                onChange={(e) => updateElementProperty(prop.name, e.target.value)}
                                className="h-8 w-full bg-slate-800 border border-slate-600 text-white rounded px-2 text-sm"
                              >
                                {(prop as any).options.map((option: string) => (
                                  <option key={option} value={option}>{option}</option>
                                ))}
                              </select>
                            )}
                            
                            {prop.type === 'boolean' && (
                              <label className="flex items-center space-x-2">
                                <input 
                                  type="checkbox"
                                  checked={selectedElement.properties[prop.name] ?? false}
                                  onChange={(e) => updateElementProperty(prop.name, e.target.checked)}
                                  className="rounded bg-slate-800 border-slate-600"
                                />
                                <span className="text-xs text-slate-300">Enabled</span>
                              </label>
                            )}
                          </div>
                        ))}
                        
                        {/* Individual Subtitle Segment Properties */}
                        {selectedElement.type === 'subtitle' && selectedSubtitleSegment && (
                          <div className="border-t border-slate-700 pt-3">
                            <h4 className="text-xs font-medium text-slate-300 mb-3">Selected Subtitle Segment</h4>
                            {(() => {
                              const segment = selectedElement.properties.subtitleData?.[selectedSubtitleSegment.segmentIndex];
                              if (!segment) return null;
                              
                              return (
                                <div className="space-y-3">
                                  {/* Text Content */}
                                  <div>
                                    <label className="text-xs text-slate-400 mb-1 block">Text Content</label>
                                    <Textarea
                                      value={segment.words?.map((w: any) => w.punctuated_word).join(' ') || ''}
                                      onChange={(e) => {
                                        saveSubtitleEdit(selectedSubtitleSegment.elementId, selectedSubtitleSegment.segmentIndex, e.target.value);
                                      }}
                                      className="h-20 bg-slate-800 border-slate-600 text-white text-sm resize-none"
                                      placeholder="Enter subtitle text..."
                                    />
                                  </div>
                                  
                                  {/* Timing Information */}
                                  <div className="grid grid-cols-2 gap-2">
                                    <div>
                                      <label className="text-xs text-slate-400 mb-1 block">Start Time</label>
                                      <Input
                                        type="number"
                                        step="0.1"
                                        value={segment.words?.[0]?.start?.toFixed(1) || '0.0'}
                                        onChange={(e) => {
                                          // Update start time for all words in segment
                                          const newStartTime = parseFloat(e.target.value);
                                          const updatedElements = project.elements.map(el => {
                                            if (el.id === selectedSubtitleSegment.elementId && el.type === 'subtitle') {
                                              const updatedData = [...(el.properties.subtitleData || [])];
                                              if (updatedData[selectedSubtitleSegment.segmentIndex]) {
                                                updatedData[selectedSubtitleSegment.segmentIndex].words = 
                                                  updatedData[selectedSubtitleSegment.segmentIndex].words.map((w: any, idx: number) => ({
                                                    ...w,
                                                    start: newStartTime + (idx * 0.3)
                                                  }));
                                              }
                                              return { ...el, properties: { ...el.properties, subtitleData: updatedData } };
                                            }
                                            return el;
                                          });
                                          setProject(prev => ({ ...prev, elements: updatedElements }));
                                        }}
                                        className="h-8 bg-slate-800 border-slate-600 text-white text-xs"
                                      />
                                    </div>
                                    <div>
                                      <label className="text-xs text-slate-400 mb-1 block">End Time</label>
                                      <Input
                                        type="number"
                                        step="0.1"
                                        value={segment.words?.[segment.words.length - 1]?.end?.toFixed(1) || '1.0'}
                                        onChange={(e) => {
                                          // Update end time for last word in segment
                                          const newEndTime = parseFloat(e.target.value);
                                          const updatedElements = project.elements.map(el => {
                                            if (el.id === selectedSubtitleSegment.elementId && el.type === 'subtitle') {
                                              const updatedData = [...(el.properties.subtitleData || [])];
                                              if (updatedData[selectedSubtitleSegment.segmentIndex]) {
                                                const words = updatedData[selectedSubtitleSegment.segmentIndex].words;
                                                if (words.length > 0) {
                                                  words[words.length - 1].end = newEndTime;
                                                }
                                              }
                                              return { ...el, properties: { ...el.properties, subtitleData: updatedData } };
                                            }
                                            return el;
                                          });
                                          setProject(prev => ({ ...prev, elements: updatedElements }));
                                        }}
                                        className="h-8 bg-slate-800 border-slate-600 text-white text-xs"
                                      />
                                    </div>
                                  </div>
                                  
                                  {/* Word Count */}
                                  <div>
                                    <label className="text-xs text-slate-400 mb-1 block">Word Count</label>
                                    <div className="text-xs text-slate-300 bg-slate-800 px-2 py-1 rounded">
                                      {segment.words?.length || 0} words
                                    </div>
                                  </div>
                                  
                                  {/* Action Buttons */}
                                  <div className="flex gap-2 pt-2">
                                    <Button
                                      variant="outline"
                                      size="sm"
                                      onClick={() => {
                                        const currentText = segment.words?.map((w: any) => w.punctuated_word).join(' ') || '';
                                        setEditingSubtitle({
                                          elementId: selectedSubtitleSegment.elementId,
                                          segmentIndex: selectedSubtitleSegment.segmentIndex,
                                          text: currentText
                                        });
                                      }}
                                      className="flex-1 text-blue-400 border-blue-400/50 hover:bg-blue-400/10"
                                    >
                                      <Type className="w-3 h-3 mr-1" />
                                      Edit Text
                                    </Button>
                                    <Button
                                      variant="outline"
                                      size="sm"
                                      onClick={() => setSelectedSubtitleSegment(null)}
                                      className="flex-1"
                                    >
                                      Close
                                    </Button>
                                  </div>
                                </div>
                              );
                            })()}
                          </div>
                        )}

                        {/* Subtitle Template Selector */}
                        {selectedElement.type === 'subtitle' && !selectedSubtitleSegment && (
                          <div className="border-t border-slate-700 pt-3">
                            <h4 className="text-xs font-medium text-slate-300 mb-2">Subtitle Templates</h4>
                            <div className="grid grid-cols-1 gap-2">
                              {subtitleTemplates.map((template) => (
                                <button
                                  key={template.name}
                                  onClick={() => {
                                    // Apply template properties
                                    const updatedElements = project.elements.map(el => 
                                      el.id === selectedElement.id 
                                        ? { ...el, properties: { ...el.properties, ...template.properties } }
                                        : el
                                    );
                                    setProject(prev => ({ ...prev, elements: updatedElements }));
                                    setSelectedElement(prev => prev ? { ...prev, properties: { ...prev.properties, ...template.properties } } : null);
                                    toast({ title: "Template Applied", description: `${template.name} style applied to subtitles` });
                                  }}
                                  className="p-2 bg-slate-800 hover:bg-slate-700 rounded text-left transition-colors"
                                >
                                  <div className="text-xs font-medium text-white">{template.name}</div>
                                  <div className="text-xs text-slate-400 mt-1">{template.description}</div>
                                </button>
                              ))}
                            </div>
                          </div>
                        )}

                        {/* Layout-specific properties */}
                        {selectedElement.type === 'layout' && (
                          <div className="border-t border-slate-700 pt-3">
                            <h4 className="text-xs font-medium text-slate-300 mb-2">Layout Children</h4>
                            <div className="text-xs text-slate-400">
                              {selectedElement.children?.length || 0} child elements
                            </div>
                            <div className="text-xs text-slate-500 mt-1">
                              Drag elements onto this layout to add them as children
                            </div>
                          </div>
                        )}
                        
                        {/* Parent layout info */}
                        {selectedElement.parentId && (
                          <div className="border-t border-slate-700 pt-3">
                            <h4 className="text-xs font-medium text-slate-300 mb-1">Layout Parent</h4>
                            <div className="text-xs text-slate-400">
                              Part of layout: {project.elements.find(el => el.id === selectedElement.parentId)?.name}
                            </div>
                          </div>
                        )}
                        
                        <div className="flex gap-2 pt-3 border-t border-slate-700">
                          <Button
                            variant="outline"
                            size="sm"
                            onClick={() => deleteElement(selectedElement.id)}
                            className="flex-1 text-red-400 border-red-400/50 hover:bg-red-400/10"
                          >
                            <Trash2 className="w-4 h-4 mr-1" />
                            Delete
                          </Button>
                          <Button
                            variant="outline"
                            size="sm"
                            onClick={() => setSelectedElement(null)}
                            className="flex-1"
                          >
                            Close
                          </Button>
                        </div>
                      </div>
                    </div>
                  );
                })()
              ) : (
                // Enhanced Components Library with Categories
                <div className="space-y-4">
                  {/* Group components by category */}
                  {['Basic', 'Layout', 'Media', 'Audio', 'Effects'].map(category => {
                    const categoryComponents = motionCanvasComponents.filter(c => c.category === category);
                    if (categoryComponents.length === 0) return null;
                    
                    return (
                      <div key={category}>
                        <h4 className="text-xs font-medium text-slate-400 mb-2 uppercase tracking-wider">
                          {category}
                        </h4>
                        
                        {/* Professional Effects Sample Library for Effects Category */}
                        {category === 'Effects' && (
                          <div className="mb-4 space-y-3">
                            {/* Professional Effect Presets */}
                            <div className="p-3 bg-gradient-to-r from-purple-900/30 to-pink-900/30 border border-purple-500/30 rounded-lg">
                              <h5 className="text-xs font-medium text-purple-300 mb-2 flex items-center">
                                <Sparkles className="w-3 h-3 mr-1" />
                                Professional Presets (Adobe/DaVinci Style)
                              </h5>
                              <div className="grid grid-cols-1 gap-1 text-xs">
                                {[
                                  { 
                                    name: 'Cinematic Color Grade', 
                                    preset: 'cinematic', 
                                    description: 'Dark moody film look',
                                    props: { effectType: 'colorGrading', preset: 'cinematic', intensity: 0.8, shadows: -20, highlights: -10 }
                                  },
                                  { 
                                    name: 'Warm Sunset Grade', 
                                    preset: 'warm', 
                                    description: 'Golden hour vibes',
                                    props: { effectType: 'colorGrading', preset: 'warm', intensity: 0.7, saturation: 15, brightness: 5 }
                                  },
                                  { 
                                    name: 'Cool Tech Grade', 
                                    preset: 'cool', 
                                    description: 'Futuristic blue tones',
                                    props: { effectType: 'colorGrading', preset: 'cool', intensity: 0.6, hue: -10, contrast: 10 }
                                  },
                                  { 
                                    name: 'Vintage Film Look', 
                                    preset: 'vintage', 
                                    description: 'Retro 70s aesthetic',
                                    props: { effectType: 'colorGrading', preset: 'vintage', intensity: 0.9, saturation: -30, brightness: -5 }
                                  }
                                ].map((preset) => (
                                  <button
                                    key={preset.name}
                                    onClick={() => {
                                      const newElement = {
                                        id: Date.now().toString(),
                                        type: 'effect' as const,
                                        name: preset.name,
                                        startTime: 0,
                                        duration: project.duration || 10,
                                        properties: preset.props,
                                        layer: project.elements.length + 1
                                      };
                                      setProject(prev => ({
                                        ...prev,
                                        elements: [...prev.elements, newElement]
                                      }));
                                      toast({ title: `Applied ${preset.name}`, description: "Effect added to timeline" });
                                    }}
                                    className="text-left p-2 bg-slate-800/40 hover:bg-slate-700/60 border border-slate-600/50 rounded-md transition-colors"
                                  >
                                    <div className="font-medium text-slate-200">{preset.name}</div>
                                    <div className="text-slate-400 text-xs">{preset.description}</div>
                                  </button>
                                ))}
                              </div>
                            </div>
                            
                            {/* Quick Action Effects */}
                            <div className="p-3 bg-gradient-to-r from-slate-800/50 to-slate-900/50 border border-slate-700/50 rounded-lg">
                              <h5 className="text-xs font-medium text-slate-300 mb-2 flex items-center">
                                <Zap className="w-3 h-3 mr-1" />
                                Quick Effect Samples
                              </h5>
                              <div className="grid grid-cols-2 gap-2 text-xs">
                                {[
                                  { 
                                    name: 'Fade In', 
                                    icon: '↗',
                                    color: 'from-green-500/20 to-emerald-500/20 border-green-500/30',
                                    props: { effectType: 'fade', fadeType: 'in', duration: 2, intensity: 1, easing: 'ease-out' }
                                  },
                                  { 
                                    name: 'Fade Out', 
                                    icon: '↘',
                                    color: 'from-red-500/20 to-pink-500/20 border-red-500/30',
                                    props: { effectType: 'fade', fadeType: 'out', duration: 2, intensity: 1, easing: 'ease-in' }
                                  },
                                  { 
                                    name: 'Blur Focus', 
                                    icon: '⊙',
                                    color: 'from-blue-500/20 to-cyan-500/20 border-blue-500/30',
                                    props: { effectType: 'blur', blurRadius: 15, quality: 'high', motionBlur: false }
                                  },
                                  { 
                                    name: 'Digital Glitch', 
                                    icon: '⚡',
                                    color: 'from-purple-500/20 to-pink-500/20 border-purple-500/30',
                                    props: { effectType: 'glitch', intensity: 0.8, frequency: 4, chromaShift: true, scanlines: true }
                                  },
                                  { 
                                    name: 'Particle Burst', 
                                    icon: '✨',
                                    color: 'from-yellow-500/20 to-orange-500/20 border-yellow-500/30',
                                    props: { effectType: 'particles', particleCount: 150, speed: 3, size: 4, color: '#ffffff', gravity: 0.2 }
                                  },
                                  { 
                                    name: 'Warm Light Leak', 
                                    icon: '☀',
                                    color: 'from-orange-500/20 to-yellow-500/20 border-orange-500/30',
                                    props: { effectType: 'lightLeak', leakType: 'warm', intensity: 0.8, position: 'top-right', size: 1.5 }
                                  }
                                ].map((effect) => (
                                  <button
                                    key={effect.name}
                                    onClick={() => {
                                      const newElement = {
                                        id: Date.now().toString(),
                                        type: 'effect' as const,
                                        name: effect.name,
                                        startTime: 0,
                                        duration: effect.props.duration || 3,
                                        properties: effect.props,
                                        layer: project.elements.length + 1
                                      };
                                      setProject(prev => ({
                                        ...prev,
                                        elements: [...prev.elements, newElement]
                                      }));
                                      toast({ title: `Applied ${effect.name}`, description: "Effect ready to use!" });
                                    }}
                                    className={`p-2 bg-gradient-to-r ${effect.color} rounded-md transition-all hover:scale-105 border flex flex-col items-center space-y-1 text-center`}
                                  >
                                    <span className="text-lg">{effect.icon}</span>
                                    <span className="font-medium text-slate-200 leading-tight">{effect.name}</span>
                                  </button>
                                ))}
                              </div>
                            </div>
                          </div>
                        )}
                        
                        <div className="grid grid-cols-2 gap-2">
                          {categoryComponents.map((component) => (
                            <div
                              key={component.type}
                              draggable
                              onDragStart={(e) => {
                                setDraggedElement({
                                  type: component.type as any,
                                  name: component.name,
                                  duration: 5,
                                  properties: component.defaultProps
                                });
                              }}
                              className="group relative bg-slate-800/50 hover:bg-slate-700/50 border border-slate-700/50 hover:border-cyan-500/50 rounded-lg p-3 cursor-grab active:cursor-grabbing transition-all duration-200 hover:scale-105"
                            >
                              <div className="flex flex-col items-center gap-2">
                                <div className={`w-10 h-10 rounded-lg flex items-center justify-center transition-all ${
                                  category === 'Layout' ? 'bg-gradient-to-br from-purple-500/20 to-pink-500/20 group-hover:from-purple-500/30 group-hover:to-pink-500/30' :
                                  category === 'Media' ? 'bg-gradient-to-br from-green-500/20 to-emerald-500/20 group-hover:from-green-500/30 group-hover:to-emerald-500/30' :
                                  category === 'Audio' ? 'bg-gradient-to-br from-orange-500/20 to-red-500/20 group-hover:from-orange-500/30 group-hover:to-red-500/30' :
                                  category === 'Effects' ? 'bg-gradient-to-br from-yellow-500/20 to-amber-500/20 group-hover:from-yellow-500/30 group-hover:to-amber-500/30' :
                                  'bg-gradient-to-br from-cyan-500/20 to-blue-500/20 group-hover:from-cyan-500/30 group-hover:to-blue-500/30'
                                }`}>
                                  <component.icon className={`w-5 h-5 ${
                                    category === 'Layout' ? 'text-purple-400' :
                                    category === 'Media' ? 'text-green-400' :
                                    category === 'Audio' ? 'text-orange-400' :
                                    category === 'Effects' ? 'text-yellow-400' :
                                    'text-cyan-400'
                                  }`} />
                                </div>
                                <span className="text-xs text-slate-300 text-center font-medium">{component.name}</span>
                                {component.description && (
                                  <span className="text-xs text-slate-500 text-center leading-tight">{component.description}</span>
                                )}
                              </div>
                              
                              {/* Properties count badge */}
                              <Badge 
                                variant="outline" 
                                className="absolute -top-1 -right-1 text-xs px-1 py-0 h-4 border-slate-600 text-slate-400"
                              >
                                {component.properties.length}
                              </Badge>
                            </div>
                          ))}
                        </div>
                      </div>
                    );
                  })}
                </div>
              )}
            </div>
          </ScrollArea>
        </div>

        {/* Main Video Editor */}
        <div className="flex-1 flex flex-col overflow-hidden">
          <div className="flex h-full overflow-hidden">
            {/* Video Preview and Timeline */}
            <div className="flex-1 flex flex-col overflow-hidden">
              {/* Project Info Bar */}
              <div className="h-12 bg-slate-900/90 backdrop-blur-sm border-b border-slate-800 flex items-center justify-between px-6">
                <div className="flex items-center gap-4">
                  <h2 className="text-white font-medium">{project.name}</h2>
                  <Badge variant="outline" className="text-slate-400 border-slate-600 text-xs">
                    {project.elements.length} elements
                  </Badge>
                  {uploadedVideo && (
                    <Badge variant="outline" className="text-green-400 border-green-500/50 text-xs">
                      Video Loaded: {videoFile?.name}
                    </Badge>
                  )}
                </div>
                
                <div className="flex items-center gap-3">
                  <input
                    type="file"
                    accept="video/*"
                    onChange={handleFileInputChange}
                    className="hidden"
                    id="video-upload-input"
                  />
                  <Button
                    onClick={() => document.getElementById('video-upload-input')?.click()}
                    size="sm"
                    variant="outline"
                    className="border-blue-500/50 text-blue-300 hover:bg-blue-500/20"
                  >
                    <Upload className="w-4 h-4 mr-2" />
                    Upload Video
                  </Button>
                  <Button
                    onClick={handleExport}
                    size="sm"
                    disabled={processing || project.elements.length === 0}
                    className="bg-green-600 hover:bg-green-700 text-white"
                  >
                    <Download className="w-4 h-4 mr-2" />
                    Export Video
                  </Button>
                </div>
              </div>

              {/* Video Preview Area */}
              <div className="flex-1 bg-slate-900 flex items-center justify-center p-6 overflow-hidden">
                <div className="w-full max-w-5xl">
                  <Card className="bg-black border-slate-800/50 shadow-2xl">
                    <CardContent className="p-0">
                      <div className="aspect-video bg-slate-950 rounded-lg overflow-hidden relative">
                        {uploadedVideo && (
                          <video 
                            ref={(el) => setVideoRef(el)}
                            className="w-full h-full object-contain absolute inset-0 z-0"
                            src={uploadedVideo.startsWith('/api/video/') ? uploadedVideo : `/api/video/${uploadedVideo}`}
                            onTimeUpdate={() => videoRef && setCurrentTime(videoRef.currentTime)}
                            onLoadedMetadata={() => videoRef && setProject(prev => ({ ...prev, duration: videoRef.duration }))}
                            onPlay={() => setIsPlaying(true)}
                            onPause={() => setIsPlaying(false)}
                            muted={false}
                            onError={(e) => {
                              console.error('Video player error:', e);
                              console.log('Trying to load video from:', uploadedVideo);
                            }}
                          />
                        )}
                        <canvas
                          ref={canvasRef}
                          width={project.canvasSize.width}
                          height={project.canvasSize.height}
                          className="w-full h-full object-contain relative z-10 pointer-events-none"
                          style={{ backgroundColor: uploadedVideo ? 'transparent' : 'rgb(2 6 23)' }}
                        />
                        
                        <div className="absolute inset-0 bg-gradient-to-t from-black/60 via-transparent to-transparent">
                          <div className="absolute bottom-4 left-4 right-4">
                            <div className="flex items-center gap-4 text-white">
                              <Button
                                size="sm"
                                variant="ghost"
                                onClick={() => {
                                  if (videoRef) {
                                    if (isPlaying) {
                                      videoRef.pause();
                                    } else {
                                      videoRef.play();
                                    }
                                  }
                                }}
                                className="text-white hover:bg-white/20 backdrop-blur-sm"
                              >
                                {isPlaying ? <Pause className="w-5 h-5" /> : <Play className="w-5 h-5" />}
                              </Button>
                              
                              <div className="flex-1">
                                <div className="text-xs mb-1 font-medium">
                                  {formatTime(currentTime)} / {formatTime(project.duration)}
                                </div>
                                <div className="w-full bg-slate-700/50 h-2 rounded-full backdrop-blur-sm">
                                  <div 
                                    className="bg-gradient-to-r from-purple-500 to-pink-500 h-2 rounded-full transition-all"
                                    style={{ width: `${(currentTime / project.duration) * 100}%` }}
                                  />
                                </div>
                              </div>
                            </div>
                          </div>
                        </div>
                      </div>
                    </CardContent>
                  </Card>
                </div>
              </div>

              {/* Timeline Area */}
              <div className="h-64 bg-slate-900/95 backdrop-blur-sm border-t border-slate-800/50">
                <div className="h-full flex flex-col">
                  <div className="h-10 bg-slate-800/50 border-b border-slate-700/50 flex items-center justify-between px-4">
                    <div className="flex items-center gap-4">
                      <h3 className="text-white font-medium text-sm">Timeline</h3>
                      <div className="text-slate-400 text-xs">
                        Duration: {project.duration}s
                      </div>
                    </div>
                    
                    {/* Timeline Zoom Controls */}
                    <div className="flex items-center gap-2">
                      <Button
                        variant="ghost"
                        size="sm"
                        onClick={() => setTimelineZoom(Math.max(25, timelineZoom - 100))}
                        className="h-6 w-6 p-0 text-slate-400 hover:text-white hover:bg-slate-700/50"
                        title="Zoom Out"
                      >
                        <Minus className="w-3 h-3" />
                      </Button>
                      <span className="text-xs text-slate-400 min-w-[50px] text-center">
                        {timelineZoom}%
                      </span>
                      <Button
                        variant="ghost"
                        size="sm"
                        onClick={() => setTimelineZoom(Math.min(2000, timelineZoom + 100))}
                        className="h-6 w-6 p-0 text-slate-400 hover:text-white hover:bg-slate-700/50"
                        title="Zoom In"
                      >
                        <Plus className="w-3 h-3" />
                      </Button>
                    </div>
                  </div>

                  <div className="flex-1 relative">
                    <div className="h-8 bg-slate-800/30 border-b border-slate-700/50 relative">
                      {Array.from({ length: Math.ceil(project.duration / 5) }, (_, i) => (
                        <div
                          key={i}
                          className="absolute top-0 bottom-0 border-l border-slate-600/50"
                          style={{ left: `${(i * 5 / project.duration) * 100 * (timelineZoom / 100)}%` }}
                        >
                          <span className="text-xs text-slate-400 ml-1">{i * 5}s</span>
                        </div>
                      ))}

                      <div 
                        className="absolute top-0 bottom-0 w-0.5 bg-purple-400 z-10"
                        style={{ left: `${(currentTime / project.duration) * 100 * (timelineZoom / 100)}%` }}
                      >
                        <div className="absolute -top-1 -left-1 w-2 h-2 bg-purple-400 rounded-full"></div>
                      </div>
                    </div>

                    <div 
                      ref={timelineRef}
                      className="flex-1 bg-slate-800/20 backdrop-blur-sm relative min-h-[200px] overflow-y-auto"
                      onClick={handleTimelineClick}
                      onDrop={handleTimelineDrop}
                      onDragOver={(e) => e.preventDefault()}
                    >
                      {project.elements.length === 0 && (
                        <div className="absolute inset-0 border-2 border-dashed border-slate-600/30 rounded-lg flex items-center justify-center">
                          <div className="text-center">
                            <Sparkles className="w-8 h-8 text-slate-500 mx-auto mb-2" />
                            <p className="text-slate-500 text-sm">Drag components here to add to timeline</p>
                          </div>
                        </div>
                      )}

                      {project.elements.map((element, index) => (
                        element.type === 'subtitle' ? (
                          // Special rendering for subtitle tracks - show individual text segments
                          <div key={element.id} className="relative">
                            {/* Main subtitle track background */}
                            <div
                              className={`absolute h-12 bg-gradient-to-r ${getElementColor(element.type)} rounded-lg transition-all duration-200 shadow-lg backdrop-blur-sm group cursor-pointer ${
                                selectedElement?.id === element.id ? 'ring-2 ring-cyan-400 ring-opacity-75 scale-105' : 'hover:brightness-110 hover:scale-105'
                              }`}
                              style={{
                                left: `${(element.startTime / project.duration) * 100 * (timelineZoom / 100)}%`,
                                width: `${(element.duration / project.duration) * 100 * (timelineZoom / 100)}%`,
                                top: `${8 + (index * 56)}px`
                              }}
                              onClick={(e) => {
                                e.stopPropagation();
                                setSelectedElement(element);
                              }}
                            >
                              <div className="p-3 text-white text-xs h-full flex items-center justify-between pointer-events-none">
                                <span className="font-medium truncate">{element.name}</span>
                                <span className="text-xs opacity-70 uppercase">{element.type}</span>
                              </div>
                            </div>
                            
                            {/* Individual text segments within the subtitle track */}
                            {element.properties.subtitleData?.map((segment: any, segIndex: number) => {
                              if (!segment.words || segment.words.length === 0) return null;
                              
                              const segmentStart = segment.words[0].start;
                              const segmentEnd = segment.words[segment.words.length - 1].end;
                              const segmentDuration = segmentEnd - segmentStart;
                              
                              return (
                                <div
                                  key={`${element.id}_segment_${segIndex}`}
                                  className="absolute h-8 bg-white/20 border border-cyan-300/50 rounded text-xs text-white flex items-center justify-center px-2 truncate cursor-pointer hover:bg-white/30 transition-colors"
                                  style={{
                                    left: `${(segmentStart / project.duration) * 100 * (timelineZoom / 100)}%`,
                                    width: `${(segmentDuration / project.duration) * 100 * (timelineZoom / 100)}%`,
                                    top: `${16 + (index * 56)}px`
                                  }}
                                  title={`${segment.words.map((w: any) => w.punctuated_word).join(' ')} (Click to select, Double-click to edit)`}
                                  onClick={(e) => {
                                    e.stopPropagation();
                                    // Set selected segment for properties panel
                                    setSelectedSubtitleSegment({
                                      elementId: element.id,
                                      segmentIndex: segIndex
                                    });
                                    // Also set selected element for main properties
                                    setSelectedElement(element);
                                  }}
                                  onDoubleClick={(e) => {
                                    e.stopPropagation();
                                    const currentText = segment.words.map((w: any) => w.punctuated_word).join(' ');
                                    setEditingSubtitle({
                                      elementId: element.id,
                                      segmentIndex: segIndex,
                                      text: currentText
                                    });
                                  }}
                                >
                                  {editingSubtitle?.elementId === element.id && editingSubtitle?.segmentIndex === segIndex ? (
                                    <input
                                      type="text"
                                      value={editingSubtitle.text}
                                      onChange={(e) => setEditingSubtitle({...editingSubtitle, text: e.target.value})}
                                      onBlur={() => {
                                        // Save the edited text
                                        saveSubtitleEdit(element.id, segIndex, editingSubtitle.text);
                                        setEditingSubtitle(null);
                                      }}
                                      onKeyDown={(e) => {
                                        if (e.key === 'Enter') {
                                          saveSubtitleEdit(element.id, segIndex, editingSubtitle.text);
                                          setEditingSubtitle(null);
                                        } else if (e.key === 'Escape') {
                                          setEditingSubtitle(null);
                                        }
                                      }}
                                      className="bg-transparent border-none outline-none text-white text-xs w-full text-center"
                                      autoFocus
                                      onClick={(e) => e.stopPropagation()}
                                    />
                                  ) : (
                                    segment.words.slice(0, 5).map((w: any) => w.punctuated_word).join(' ')
                                  )}
                                </div>
                              );
                            })}
                          </div>
                        ) : (
                          // Regular element rendering
                          <div
                            key={element.id}
                            className={`absolute h-12 bg-gradient-to-r ${getElementColor(element.type)} rounded-lg transition-all duration-200 shadow-lg backdrop-blur-sm group cursor-pointer ${
                              selectedElement?.id === element.id ? 'ring-2 ring-cyan-400 ring-opacity-75 scale-105' : 'hover:brightness-110 hover:scale-105'
                            }`}
                            style={{
                              left: `${(element.startTime / project.duration) * 100 * (timelineZoom / 100)}%`,
                              width: `${(element.duration / project.duration) * 100 * (timelineZoom / 100)}%`,
                              top: `${8 + (index * 56)}px`
                            }}
                            onClick={(e) => {
                              e.stopPropagation();
                              setSelectedElement(element);
                            }}
                          >
                          {/* Left resize handle */}
                          <div
                            className="absolute left-0 top-0 bottom-0 w-3 cursor-ew-resize bg-white/10 opacity-0 group-hover:opacity-100 transition-opacity flex items-center justify-center"
                            onMouseDown={(e) => {
                              e.stopPropagation();
                              setIsResizing({ elementId: element.id, side: 'left' });
                            }}
                          >
                            <div className="w-1 h-6 bg-white/50 rounded"></div>
                          </div>
                          
                          <div className="p-3 text-white text-xs h-full flex items-center justify-between pointer-events-none">
                            <span className="font-medium truncate">{element.name}</span>
                            <span className="text-xs opacity-70 uppercase">{element.type}</span>
                          </div>
                          
                          {/* Right resize handle */}
                          <div
                            className="absolute right-0 top-0 bottom-0 w-3 cursor-ew-resize bg-white/10 opacity-0 group-hover:opacity-100 transition-opacity flex items-center justify-center"
                            onMouseDown={(e) => {
                              e.stopPropagation();
                              setIsResizing({ elementId: element.id, side: 'right' });
                            }}
                          >
                            <div className="w-1 h-6 bg-white/50 rounded"></div>
                          </div>
                        </div>
                        )
                      ))}
                    </div>
                  </div>
                </div>
              </div>
            </div>

            {/* Right Chat Panel */}
            <div className="w-80 bg-slate-900/95 backdrop-blur-xl border-l border-slate-800 flex flex-col overflow-hidden">
              <div className="p-4 border-b border-slate-800 shrink-0">
                <div className="flex items-center gap-3">
                  <div className="w-8 h-8 bg-gradient-to-br from-purple-500 to-pink-500 rounded-full flex items-center justify-center">
                    <MessageSquare className="w-4 h-4 text-white" />
                  </div>
                  <div>
                    <h2 className="text-white font-semibold text-sm">AI Assistant</h2>
                    <p className="text-slate-400 text-xs">Natural Language Commands</p>
                  </div>
                </div>
              </div>

              <ScrollArea className="flex-1 p-4">
                <div className="space-y-4">
                  {messages.map((message) => (
                    <div
                      key={message.id}
                      className={`flex ${message.type === 'user' ? 'justify-end' : 'justify-start'}`}
                    >
                      <div
                        className={`max-w-[85%] p-3 rounded-lg ${
                          message.type === 'user'
                            ? 'bg-purple-600 text-white'
                            : 'bg-slate-800 text-slate-200'
                        }`}
                      >
                        <p className="text-sm">{message.content}</p>
                        {message.actionType && (
                          <Badge variant="secondary" className="mt-2 text-xs">
                            {message.actionType}
                          </Badge>
                        )}
                      </div>
                    </div>
                  ))}
                  {processing && (
                    <div className="flex justify-start">
                      <div className="bg-slate-800 text-slate-200 p-3 rounded-lg">
                        <div className="flex items-center gap-2">
                          <div className="w-2 h-2 bg-purple-400 rounded-full animate-pulse"></div>
                          <span className="text-sm">Processing...</span>
                        </div>
                      </div>
                    </div>
                  )}
                </div>
              </ScrollArea>

              <div className="p-4 border-t border-slate-800">
                <form onSubmit={handleSendMessage} className="flex gap-2">
                  <Input
                    value={inputMessage}
                    onChange={(e) => setInputMessage(e.target.value)}
                    placeholder="Add subtitles, create text animation, add effects..."
                    disabled={processing}
                    className="bg-slate-800 border-slate-700 text-white placeholder-slate-400"
                  />
                  <Button
                    type="submit"
                    size="icon"
                    disabled={!inputMessage.trim() || processing}
                    className="bg-purple-600 hover:bg-purple-700 shrink-0"
                  >
                    <Send className="w-4 h-4" />
                  </Button>
                </form>
              </div>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}

export default UnifiedVideoEditor;