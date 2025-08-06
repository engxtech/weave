import React, { useState, useRef, useCallback, useEffect } from 'react';
import { nanoid } from 'nanoid';
import { useMutation } from '@tanstack/react-query';
import { 
  Play, 
  Pause, 
  Volume2, 
  VolumeX, 
  Eye, 
  EyeOff, 
  Lock, 
  Unlock,
  Plus, 
  Trash2, 
  Download,
  ChevronDown,
  ChevronRight,
  Type,
  Image,
  MessageSquare,
  Bot,
  Send,
  Loader,
  Upload,
  Video,
  VideoOff,
  X,
  Search,
  Scissors,
  RotateCw,
  Zap,
  Frame,
  Sparkles,
  Layers,
  Palette,
  Move,
  Square,
  Circle,
  Settings,
  BarChart3,
  Globe,
  Languages,
  Clock,
  TrendingUp,
  Users,
  Film,
  Copy,
  VideoIcon,
  Wand2,
  ZoomIn,
  ZoomOut,
  RotateCcw,
  Minus
} from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Slider } from '@/components/ui/slider';
import { Input } from '@/components/ui/input';
import { ScrollArea } from '@/components/ui/scroll-area';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription } from '@/components/ui/dialog';
import { apiRequest } from '@/lib/queryClient';
import { HighlightBubble, HighlightBubbleContainer } from '@/components/highlight-bubble';
import { useToast } from '@/hooks/use-toast';
import AnimatedSubtitle, { AnimatedSubtitleProps } from '@/components/AnimatedSubtitle';

// Types for multi-track composition
interface VideoFile {
  id: string;
  filename: string;
  originalName: string;
  path: string;
  size: number;
  duration?: number;
  thumbnail?: string;
}

interface Segment {
  id: string;
  startTime: number;
  endTime: number;
  sourceFile?: string;
  type: 'cut' | 'text' | 'media' | 'audio';
  content?: any;
  visible: boolean;
  highlights?: Array<{
    id: string;
    type: 'search' | 'ai-detected' | 'smart-crop' | 'focus-point';
    position: { x: number; y: number }; // percentage position
    relevanceScore?: number;
    description?: string;
    timestamp?: number; // specific time within segment
  }>;
}

interface Track {
  id: string;
  name: string;
  type: 'video' | 'audio' | 'text' | 'media' | 'effects';
  segments: Segment[];
  locked: boolean;
  visible: boolean;
  muted: boolean;
  height: number;
  color: string;
  videoFile?: VideoFile;
  created: Date;
  lastUpdate: Date;
}

interface TrackCategory {
  expanded: boolean;
}

interface VideoComposition {
  tracks: Track[];
  totalDuration: number;
  currentTime: number;
  isPlaying: boolean;
  trackCategories: {
    video: TrackCategory;
    audio: TrackCategory;
    text: TrackCategory;
    media: TrackCategory;
    effects: TrackCategory;
  };
  previewMode: 'original' | 'composition';
  // Timeline zoom functionality
  timelineZoom: number; // 1 = normal, 2 = 2x zoom, 0.5 = 0.5x zoom
  timelineScrollPosition: number; // horizontal scroll position in pixels
}

interface ChatMessage {
  id: string;
  type: 'user' | 'assistant';
  content: string;
  timestamp: string;
  operations?: any[];
}

interface TextOverlay {
  text: string;
  x: number;
  y: number;
  fontSize: number;
  color: string;
  style: string;
  startTime: number;
  endTime: number;
  // Advanced typography options
  fontFamily?: string;
  fontWeight?: string;
  fontStyle?: string;
  // Text shadow options
  shadowColor?: string;
  shadowBlur?: number;
  // Text outline options
  strokeColor?: string;
  strokeWidth?: number;
  // Animation options
  animation?: string;
  // Background options
  backgroundColor?: string;
  backgroundOpacity?: number;
  // Text formatting options
  textAlign?: string;
  letterSpacing?: number;
  lineHeight?: number;
}

interface GeneratedMediaItem {
  id: string;
  type: 'image' | 'video';
  filename: string;
  url: string;
  prompt: string;
}

interface VideoEditingInterfaceProps {
  className?: string;
}

// Word Highlighting Caption Component
const WordHighlightCaption = ({ 
  segment, 
  currentTime, 
  isVisible 
}: { 
  segment: any; 
  currentTime: number; 
  isVisible: boolean; 
}) => {
  if (!isVisible || !segment.words || !segment.highlightWords) {
    return null;
  }

  // Check if current time is within segment timing
  const isActiveSegment = currentTime >= segment.startTime && currentTime <= segment.endTime;
  if (!isActiveSegment) {
    return null;
  }

  return (
    <div 
      className="absolute z-10 pointer-events-none"
      style={{
        left: `${segment.x || 50}%`,
        top: `${segment.y || 85}%`,
        transform: 'translate(-50%, -50%)',
        fontSize: `${segment.fontSize || 24}px`,
        fontWeight: segment.style === 'bold' ? 'bold' : 'normal',
        textShadow: '2px 2px 4px rgba(0,0,0,0.8)',
        background: 'rgba(0, 0, 0, 0.8)', // Transparent black background
        borderRadius: `${segment.borderRadius || 8}px`,
        padding: '8px 16px',
        maxWidth: '80%',
        textAlign: 'center',
        lineHeight: 1.2
      }}
    >
      <div className="flex flex-wrap justify-center gap-1">
        {segment.words.map((word: any, index: number) => {
          // Determine if this word should be highlighted
          const isWordActive = currentTime >= word.startTime && currentTime <= word.endTime;
          
          // Calculate highlight intensity and speech speed based on waveform timing
          let highlightIntensity = 0;
          let speechSpeed = 'normal'; // slow, normal, fast
          let waveformColor = '#ffffff'; // default white
          
          if (word.highlightTiming && isWordActive) {
            const wordProgress = (currentTime - word.startTime) / (word.endTime - word.startTime);
            
            if (currentTime >= word.highlightTiming.onsetTime && currentTime <= word.highlightTiming.endTime) {
              // Calculate highlight based on speech onset pattern
              if (currentTime <= word.highlightTiming.peakTime) {
                // Rising intensity to peak
                const onsetProgress = (currentTime - word.highlightTiming.onsetTime) / 
                                    (word.highlightTiming.peakTime - word.highlightTiming.onsetTime);
                highlightIntensity = Math.min(1, onsetProgress * 1.2);
              } else {
                // Falling intensity from peak
                const falloffProgress = (currentTime - word.highlightTiming.peakTime) / 
                                      (word.highlightTiming.endTime - word.highlightTiming.peakTime);
                highlightIntensity = Math.max(0, 1 - (falloffProgress * 0.8));
              }
            }
          }
          
          // Get amplitude first
          const amplitude = word.amplitude || word.audioAmplitude || 0.5;
          
          // Use enhanced waveform data if available, otherwise calculate
          if (word.speechSpeed && word.waveformColor) {
            speechSpeed = word.speechSpeed;
            waveformColor = word.waveformColor;
          } else {
            // Fallback: Calculate speech speed based on word duration and amplitude
            const wordDuration = word.endTime - word.startTime;
            const wordLength = word.word.length;
            const charactersPerSecond = wordLength / wordDuration;
            
            // Determine speech speed and corresponding color
            if (charactersPerSecond > 8 || amplitude > 0.8) {
              speechSpeed = 'fast';
              waveformColor = '#ff4444'; // Red for fast/loud speech
            } else if (charactersPerSecond < 4 || amplitude < 0.3) {
              speechSpeed = 'slow';
              waveformColor = '#4488ff'; // Blue for slow/quiet speech
            } else {
              speechSpeed = 'normal';
              waveformColor = '#44ff88'; // Green for normal speech
            }
          }
          
          // Apply waveform-based color intensity
          const colorIntensity = Math.max(0.3, amplitude * highlightIntensity);
          
          // Create RGB values based on waveform color and intensity
          const getRGBWithIntensity = (hexColor: string, intensity: number) => {
            const r = parseInt(hexColor.slice(1, 3), 16);
            const g = parseInt(hexColor.slice(3, 5), 16);
            const b = parseInt(hexColor.slice(5, 7), 16);
            return `rgba(${r}, ${g}, ${b}, ${intensity})`;
          };
          
          // Apply waveform-based highlighting styles with speed colors
          const wordStyle = {
            color: isWordActive ? waveformColor : '#ffffff', // Waveform color when active, white when inactive
            backgroundColor: highlightIntensity > 0 ? getRGBWithIntensity(waveformColor, highlightIntensity * 0.4) : 'transparent',
            textShadow: highlightIntensity > 0 
              ? `0 0 ${8 + highlightIntensity * 4}px ${getRGBWithIntensity(waveformColor, highlightIntensity * 0.8)}` 
              : '2px 2px 4px rgba(0,0,0,0.8)',
            transform: highlightIntensity > 0.7 ? `scale(${1 + highlightIntensity * 0.1})` : 'scale(1)',
            transition: 'all 0.1s ease-out',
            padding: '2px 4px',
            borderRadius: '4px',
            display: 'inline-block',
            fontWeight: isWordActive ? 'bold' : (segment.style === 'bold' ? 'bold' : 'normal'),
            // Add pulse animation for fast speech
            animation: speechSpeed === 'fast' && isWordActive ? 'pulse 0.3s ease-in-out infinite alternate' : 'none',
            // Add subtle border for speed indication
            border: isWordActive ? `1px solid ${getRGBWithIntensity(waveformColor, 0.6)}` : 'none',
            // Adjust font size based on speech speed
            fontSize: speechSpeed === 'fast' ? '1.05em' : speechSpeed === 'slow' ? '0.95em' : '1em'
          };

          return (
            <span
              key={`${segment.id}-word-${index}`}
              style={wordStyle}
              className={`inline-block waveform-word speed-${speechSpeed} ${isWordActive ? 'active' : ''}`}
              data-speech-speed={speechSpeed}
              data-amplitude={amplitude.toFixed(2)}
              title={isWordActive ? `${speechSpeed} speech (amp: ${amplitude.toFixed(2)})` : undefined}
            >
              {word.word}
            </span>
          );
        })}
      </div>
      
      {/* Waveform analysis indicator with speed visualization */}
      {segment.waveformAnalyzed && (
        <div className="absolute -top-1 -right-1 flex items-center gap-1 opacity-70">
          <div className="w-2 h-2 bg-green-400 rounded-full" 
               title="Waveform-analyzed timing" />
          <div className="flex items-center h-2 bg-black/50 rounded px-1">
            {segment.words?.slice(0, 3).map((word: any, idx: number) => {
              const amp = word.amplitude || word.audioAmplitude || 0.5;
              const height = Math.max(2, amp * 8);
              const isCurrentWord = currentTime >= word.startTime && currentTime <= word.endTime;
              return (
                <div
                  key={idx}
                  className={`w-0.5 bg-white/80 transition-all duration-100 ${isCurrentWord ? 'bg-yellow-400' : ''}`}
                  style={{ height: `${height}px` }}
                />
              );
            })}
          </div>
        </div>
      )}
    </div>
  );
};

export default function VideoEditingInterface({ className = '' }: VideoEditingInterfaceProps) {
  const videoRef = useRef<HTMLVideoElement>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);
  const chatMessagesRef = useRef<HTMLDivElement>(null);
  const { toast } = useToast();

  // Main state management
  const [currentVideo, setCurrentVideo] = useState<VideoFile | null>(null);
  const [timelineZoom, setTimelineZoom] = useState(1);
  const [selectedTrack, setSelectedTrack] = useState<string | null>(null);
  const [selectedVideoTrack, setSelectedVideoTrack] = useState<string | null>(null); // Track which video track is currently playing
  const [showAiAgent, setShowAiAgent] = useState(false);
  const [chatInput, setChatInput] = useState('');
  const [chatMessages, setChatMessages] = useState<ChatMessage[]>([]);
  const [chatOperations, setChatOperations] = useState<any[]>([]);
  const [agentSessionId] = useState(() => nanoid());
  const [showSearchInput, setShowSearchInput] = useState(false);
  const [searchInput, setSearchInput] = useState('');
  const [showVideoGenerationInput, setShowVideoGenerationInput] = useState(false);
  const [videoGenerationInput, setVideoGenerationInput] = useState('');
  const [isTyping, setIsTyping] = useState(false);
  const [selectedSegment, setSelectedSegment] = useState<TextOverlay | null>(null);
  const [selectedMediaSegment, setSelectedMediaSegment] = useState<Segment | null>(null);
  const [showLeftDrawer, setShowLeftDrawer] = useState(false);
  const [drawerMode, setDrawerMode] = useState<'text' | 'media'>('text');
  const [generatedMedia, setGeneratedMedia] = useState<GeneratedMediaItem[]>([]);
  const [exportData, setExportData] = useState<any>(null);
  const [showExportModal, setShowExportModal] = useState(false);
  const [showTokenExhaustionModal, setShowTokenExhaustionModal] = useState(false);
  const [tokenExhaustionData, setTokenExhaustionData] = useState<any>(null);
  const [showVideoOverlay, setShowVideoOverlay] = useState(false);
  const [overlayVideoData, setOverlayVideoData] = useState<any>(null);
  
  // Subtitle settings state
  const [subtitleSettings, setSubtitleSettings] = useState({
    style: 'bold',
    fontSize: 80,
    textColor: '#ffffff',
    borderColor: '#000000',
    borderWidth: 2,
    shadowColor: '#000000',
    shadowBlur: 30,
    textAlign: 'center',
    fontWeight: 800,
    fadeInAnimation: true,
    wordHighlighting: true
  });
  const [showSubtitleStyles, setShowSubtitleStyles] = useState(false);

  // Video composition state
  const [videoComposition, setVideoComposition] = useState<VideoComposition>({
    tracks: [],
    totalDuration: 0,
    currentTime: 0,
    isPlaying: false,
    previewMode: 'original',
    trackCategories: {
      video: { expanded: true },
      audio: { expanded: true },
      text: { expanded: true },
      media: { expanded: true },
      effects: { expanded: true }
    },
    timelineZoom: 1,
    timelineScrollPosition: 0
  });

  // Dragging state for segment resizing and moving
  const [dragState, setDragState] = useState<{
    isDragging: boolean;
    segmentId: string | null;
    trackId: string | null;
    dragType: 'start' | 'end' | 'move' | null;
    initialX: number;
    initialTime: number;
  }>({
    isDragging: false,
    segmentId: null,
    trackId: null,
    dragType: null,
    initialX: 0,
    initialTime: 0
  });

  // File upload mutation
  const uploadVideoMutation = useMutation({
    mutationFn: async (file: File) => {
      const formData = new FormData();
      formData.append('video', file);
      
      const response = await fetch('/api/upload-video', {
        method: 'POST',
        body: formData
      });
      
      if (!response.ok) {
        throw new Error(`Upload failed: ${response.statusText}`);
      }
      
      return response.json();
    },
    onSuccess: (data) => {
      const videoFile: VideoFile = {
        id: nanoid(),
        filename: data.filename,
        originalName: data.originalName || data.filename,
        path: data.path,
        size: data.size,
        duration: data.duration
      };

      setCurrentVideo(videoFile);
      
      // Create main video track
      const newTrack: Track = {
        id: nanoid(),
        name: 'V1',
        type: 'video',
        segments: [],
        locked: false,
        visible: true,
        muted: false,
        height: 60,
        color: 'from-blue-500 to-purple-600',
        videoFile: videoFile,
        created: new Date(),
        lastUpdate: new Date()
      };

      setVideoComposition(prev => ({
        ...prev,
        tracks: [newTrack],
        totalDuration: data.duration || 60
      }));

      // Set this track as the selected video track
      setSelectedVideoTrack(newTrack.id);
    },
    onError: (error) => {
      console.error('Upload failed:', error);
    }
  });

  // Export video mutation
  const exportVideoMutation = useMutation({
    mutationFn: async () => {
      if (!currentVideo) throw new Error('No video loaded');
      
      const exportData = {
        videoFilename: currentVideo.filename,
        composition: videoComposition,
        tracks: videoComposition.tracks
      };
      
      const response = await apiRequest('POST', '/api/export-timeline-video', exportData);
      return await response.json();
    },
    onSuccess: (data) => {
      console.log('Export response data:', data);
      
      // Store export data and show modal
      setExportData(data);
      setShowExportModal(true);
      
      toast({
        title: "Export Complete!",
        description: "Your exported video is ready for preview and download.",
      });
    },
    onError: (error: any) => {
      console.error('Export failed:', error);
      const errorMessage = error?.message || 'Failed to export video';
      toast({
        title: "Export Failed",
        description: errorMessage,
        variant: "destructive",
      });
    }
  });

  // Function to apply AI actions to timeline
  const applyAgentActions = useCallback((actions: any[]) => {
    if (!actions || actions.length === 0) return;

    console.log('Applying agent actions:', actions);

    setVideoComposition(prev => {
      let newComposition = { ...prev };

      actions.forEach(action => {
        switch (action.type) {
          case 'add_text_overlay':
            // Find or create text track
            let textTrack = newComposition.tracks.find(t => t.type === 'text');
            if (!textTrack) {
              textTrack = {
                id: nanoid(),
                name: 'T1',
                type: 'text',
                segments: [],
                locked: false,
                visible: true,
                muted: false,
                height: 40,
                color: 'from-yellow-500 to-orange-600',
                created: new Date(),
                lastUpdate: new Date()
              };
              newComposition.tracks.push(textTrack);
            }

            // Add text overlay segment
            const textSegment: Segment = {
              id: action.id || nanoid(),
              startTime: action.parameters.startTime || 0,
              endTime: action.parameters.endTime || action.parameters.startTime + (action.parameters.duration || 5),
              type: 'text',
              content: {
                text: action.parameters.text,
                x: action.parameters.x || 50,
                y: action.parameters.y || 20,
                fontSize: action.parameters.fontSize || 24,
                color: action.parameters.color || '#FFFFFF',
                style: action.parameters.style || 'normal'
              },
              visible: true
            };
            textTrack.segments.push(textSegment);
            textTrack.lastUpdate = new Date();
            break;

          case 'cut_video_segment':
            // Find video track or create one
            let videoTrack = newComposition.tracks.find(t => t.type === 'video');
            if (!videoTrack) {
              videoTrack = {
                id: nanoid(),
                name: 'V1',
                type: 'video',
                segments: [],
                locked: false,
                visible: true,
                muted: false,
                height: 60,
                color: 'from-blue-500 to-purple-600',
                created: new Date(),
                lastUpdate: new Date()
              };
              newComposition.tracks.push(videoTrack);
            }

            // Add video segment
            const videoSegment: Segment = {
              id: action.id || nanoid(),
              startTime: action.parameters.startTime || 0,
              endTime: action.parameters.endTime || action.parameters.startTime + (action.parameters.duration || 10),
              type: 'cut',
              content: {
                sourceStart: action.parameters.sourceStart || action.parameters.startTime,
                sourceEnd: action.parameters.sourceEnd || action.parameters.endTime
              },
              visible: true
            };
            videoTrack.segments.push(videoSegment);
            videoTrack.lastUpdate = new Date();
            break;

          case 'create_audio_track':
            const audioTrack: Track = {
              id: nanoid(),
              name: `A${newComposition.tracks.filter(t => t.type === 'audio').length + 1}`,
              type: 'audio',
              segments: [],
              locked: false,
              visible: true,
              muted: false,
              height: 50,
              color: 'from-green-500 to-teal-600',
              created: new Date(),
              lastUpdate: new Date()
            };
            newComposition.tracks.push(audioTrack);
            break;

          case 'video_search':
            // Handle video search results - display search segments
            console.log('Video search completed:', action);
            // Could add search results to timeline or display in UI
            break;

          case 'generate_media':
            // Handle generated media - store it for display as draggable cards
            if (action.mediaData) {
              setGeneratedMedia(prev => [...prev, action.mediaData]);
              console.log('Generated media added:', action.mediaData);
              
              // Also ensure the media data is correctly formatted for the UI operations display
              action.media = action.mediaData;
            }
            break;

          case 'translate_video_language':
            // Handle video translation - create draggable video card and update current video
            if (action.outputPath) {
              const filename = action.outputPath.split('/').pop();
              
              // Create video card data for the agent response
              const videoCard = {
                id: `dubbed_${Date.now()}`,
                type: 'video',
                filename: filename,
                title: `Dubbed Video (${action.targetLanguage.toUpperCase()})`,
                description: `Translated to ${action.targetLanguage} with synchronized audio`,
                thumbnail: `/api/video/${filename}`,
                videoPath: `/api/video/${filename}`,
                duration: currentVideo?.duration || '00:00',
                size: 'Processing...',
                language: action.targetLanguage,
                isDubbed: true
              };
              
              // Add to generated media for dragging
              setGeneratedMedia(prev => [...prev, videoCard]);
              
              // Update current video state
              setCurrentVideo(prev => ({
                ...prev,
                filename: filename,
                originalFilename: prev?.filename || filename,
                isDubbed: true,
                targetLanguage: action.targetLanguage,
                originalLanguage: action.translationResult?.originalLanguage
              }));
              
              toast({
                title: "Translation Complete!",
                description: `Video successfully translated to ${action.targetLanguage}. Drag the video card to timeline to use it.`,
              });
            }
            break;

          case 'ai_shorts_generated':
            // Handle AI shorts generation - create draggable clip cards
            if (action.clipData) {
              const shortsCard = {
                id: action.clipData.id,
                type: 'video_clip',
                filename: action.clipData.videoPath || `${action.clipData.id}.mp4`,
                title: action.clipData.title,
                description: action.clipData.description,
                startTime: action.clipData.startTime,
                endTime: action.clipData.endTime,
                duration: action.clipData.duration,
                viralScore: action.clipData.viralScore,
                engagementFactors: action.clipData.engagementFactors,
                speakerInfo: action.clipData.speakerInfo,
                keyMoments: action.clipData.keyMoments,
                transcriptSnippet: action.clipData.transcriptSnippet,
                visualHighlights: action.clipData.visualHighlights,
                isDraggable: true,
                url: action.clipData.videoPath || '',
                prompt: 'AI Generated Shorts Clip',
                // Use the generated video file if available, otherwise fall back to thumbnail
                videoPath: action.clipData.videoPath,
                thumbnail: currentVideo?.filename ? `/api/video/${currentVideo.filename}#t=${action.clipData.startTime}` : null
              };
              
              // Add to generated media for dragging to timeline
              setGeneratedMedia(prev => [...prev, shortsCard]);
              console.log('AI Shorts clip added:', shortsCard);
              console.log('🔍 shortsCard videoPath:', shortsCard.videoPath);
            }
            break;

          case 'caption_generation':
          case 'generate_captions':
            // Handle caption generation - create text track directly and draggable caption card
            if (action.captionTrack) {
              // Find existing subtitle track or create new one (single track for all subtitles)
              let existingSubtitleTrack = newComposition.tracks.find(t => t.type === 'text' && t.name === 'Subtitles');
              const newTrackName = existingSubtitleTrack ? 'Subtitles' : 'Subtitles';
              
              // Create text segments from caption data with proper timing and standard white text
              
              const textSegments: Segment[] = action.captionTrack.segments.map((segment: any, index: number) => {
                // Calculate proper endTime based on segment timing
                let endTime = segment.endTime;
                if (!endTime) {
                  // If no endTime, calculate based on duration or use next segment's start time
                  if (segment.duration && segment.duration > 0) {
                    endTime = segment.startTime + segment.duration;
                  } else {
                    // Use next segment's start time or default 2-second duration
                    const nextSegment = action.captionTrack.segments[index + 1];
                    if (nextSegment) {
                      endTime = Math.min(segment.startTime + 2, nextSegment.startTime - 0.1);
                    } else {
                      endTime = segment.startTime + 2; // Default 2-second duration for last segment
                    }
                  }
                }
                
                return {
                  id: nanoid(),
                  startTime: segment.startTime,
                  endTime: endTime,
                  sourceFile: '',
                  type: 'text',
                  content: {
                    text: segment.text,
                    x: segment.x || 50, // Center position
                    y: segment.y || 85, // Bottom of screen for captions
                    fontSize: segment.fontSize || 24,
                    color: '#ffffff', // Standard white text for all video captions
                    style: segment.style || 'bold',
                    fontFamily: 'system-ui, -apple-system, sans-serif',
                    shadowColor: '#000000',
                    shadowBlur: 2,
                    background: 'rgba(0, 0, 0, 0.8)', // Transparent black background
                    borderRadius: segment.borderRadius || 8,
                    animation: segment.animation || 'fade-in',
                    // Word highlighting data
                    words: segment.words || [],
                    highlightWords: segment.highlightWords || false,
                    logicalSentence: segment.logicalSentence || false,
                    waveformAnalyzed: segment.waveformAnalyzed || false,
                    startTime: segment.startTime,
                    endTime: endTime,
                    id: segment.id
                  },
                  visible: true
                };
              });

              if (existingSubtitleTrack) {
                // Add new segments to existing subtitle track (in series)
                existingSubtitleTrack.segments = [...(existingSubtitleTrack.segments || []), ...textSegments];
                existingSubtitleTrack.lastUpdate = new Date();
              } else {
                // Create new subtitle track
                const newCaptionTrack: Track = {
                  id: nanoid(),
                  name: newTrackName,
                  type: 'text',
                  segments: textSegments,
                  locked: false,
                  visible: true,
                  muted: false,
                  height: 40,
                  color: 'from-yellow-500 to-orange-600',
                  created: new Date(),
                  lastUpdate: new Date()
                };

                // Add the track to the composition directly
                newComposition.tracks.push(newCaptionTrack);
                existingSubtitleTrack = newCaptionTrack;
              }
              
              // Set composition with new track immediately
              setVideoComposition(newComposition);
              
              // Force another update to ensure segments are visible
              setTimeout(() => {
                setVideoComposition(prevComp => {
                  const updatedTracks = prevComp.tracks.map(track => {
                    if (track.id === existingSubtitleTrack.id) {
                      return {
                        ...track,
                        segments: [...textSegments], // Force refresh of segments
                        lastUpdate: new Date()
                      };
                    }
                    return track;
                  });
                  
                  return {
                    ...prevComp,
                    tracks: updatedTracks,
                    trackCategories: {
                      ...prevComp.trackCategories,
                      text: { expanded: true }
                    }
                  };
                });
              }, 50);
              
              // Also create draggable caption card for additional use
              const captionCard = {
                id: `captions_${Date.now()}`,
                type: 'captions',
                filename: `captions_${Date.now()}.json`,
                title: action.captionTrack.name || 'Generated Captions',
                description: `${action.captionTrack.segmentCount} segments • ${Math.round(action.captionTrack.totalDuration)}s • ${action.captionTrack.language}`,
                captionData: action.captionTrack,
                url: '#captions', // Placeholder URL for media interface
                prompt: 'AI Generated Captions' // Required for GeneratedMediaItem
              };
              
              // Add to generated media for dragging
              setGeneratedMedia(prev => [...prev, captionCard]);
              
              toast({
                title: "Captions Added to Timeline!",
                description: `${action.captionTrack.segmentCount} caption segments added to ${newTrackName} track. All segments are now visible in the timeline.`,
              });
              
              console.log(`📝 Created caption track ${newTrackName} with ${textSegments.length} segments`, {
                trackId: newCaptionTrack.id,
                segmentCount: textSegments.length,
                segments: textSegments.map(s => ({ 
                  text: s.content?.text?.substring(0, 50) + '...', 
                  start: s.startTime, 
                  end: s.endTime,
                  duration: s.endTime - s.startTime,
                  id: s.id
                }))
              });
              
              // Debug: Log the original caption segments from action
              console.log(`📋 Original caption segments from API:`, {
                totalSegments: action.captionTrack.segments.length,
                segments: action.captionTrack.segments.map((s: any, i: number) => ({
                  index: i,
                  id: s.id,
                  text: s.text?.substring(0, 50) + '...',
                  startTime: s.startTime,
                  endTime: s.endTime,
                  duration: s.endTime - s.startTime
                }))
              });
            }
            break;

          case 'waveform_caption_generation':
            // Handle waveform-aligned caption generation - create draggable caption card
            if (action.captionTrack) {
              // Get confidence from waveformStats or calculate from segments
              const averageConfidence = action.waveformStats?.averageConfidence || 
                (action.captionTrack.segments?.length > 0 
                  ? action.captionTrack.segments.reduce((acc, segment) => acc + (segment.confidence || 0.9), 0) / action.captionTrack.segments.length
                  : 0.9);
              
              const waveformCaptionCard = {
                id: `waveform_captions_${Date.now()}`,
                type: 'waveform_captions',
                filename: `waveform_captions_${Date.now()}.json`,
                title: action.captionTrack.name || 'Authentic Transcription',
                description: `🎬 ${action.captionTrack.segmentCount} segments • ${Math.round(action.captionTrack.totalDuration)}s • ${(averageConfidence * 100).toFixed(1)}% confidence • FFmpeg + Gemini + Waveform`,
                captionData: action.captionTrack,
                waveformStats: action.waveformStats,
                url: '#authentic-captions', // Placeholder URL for media interface
                prompt: 'Authentic Audio Transcription' // Required for GeneratedMediaItem
              };
              
              // Add to generated media for dragging
              setGeneratedMedia(prev => [...prev, waveformCaptionCard]);
              
              toast({
                title: "Caption Segments Generated!",
                description: `${action.captionTrack.segmentCount} caption segments created with ${(averageConfidence * 100).toFixed(1)}% confidence. Drag to timeline to add text track.`,
              });
            }
            break;

          case 'animated_captions_generated':
            // Handle animated subtitle generation - create both timeline and draggable card
            if (action.captionTrack) {
              // Auto-add to timeline immediately
              const textTracks = videoComposition.tracks.filter(t => t.type === 'text');
              const animatedTrackName = `T${textTracks.length + 1}`;
              const newAnimatedCaptionTrack = {
                id: `animated_text_${Date.now()}`,
                name: animatedTrackName,
                type: 'text' as const,
                isVisible: true,
                isMuted: false,
                isLocked: false,
                segments: [],
                color: 'from-purple-500 to-pink-600' // Purple gradient for animated subtitles
              };

              // Convert animated segments to timeline segments
              const animatedTextSegments = action.captionTrack.segments.map((segment: any) => ({
                id: segment.id,
                trackId: newAnimatedCaptionTrack.id,
                startTime: segment.startTime,
                endTime: segment.endTime,
                duration: segment.duration,
                type: 'animated_subtitle' as const,
                content: {
                  text: segment.content.text,
                  animatedData: segment.content.animatedData,
                  words: segment.content.words,
                  animations: segment.content.animations,
                  preset: segment.content.preset
                },
                x: segment.x,
                y: segment.y,
                fontSize: segment.fontSize,
                color: segment.color,
                style: segment.style,
                animation: segment.animation,
                background: segment.background,
                borderRadius: segment.borderRadius,
                opacity: segment.opacity,
                transform: '',
                zIndex: 10
              }));

              // Add track with segments to timeline
              setTimeout(() => {
                setVideoComposition(prevComp => {
                  const updatedTracks = [...prevComp.tracks, {
                    ...newAnimatedCaptionTrack,
                    segments: animatedTextSegments
                  }];
                  
                  return {
                    ...prevComp,
                    tracks: updatedTracks,
                    trackCategories: {
                      ...prevComp.trackCategories,
                      text: { expanded: true }
                    }
                  };
                });
              }, 50);
              
              // Also create draggable animated caption card
              const animatedCaptionCard = {
                id: `animated_captions_${Date.now()}`,
                type: 'animated_captions',
                filename: `animated_captions_${Date.now()}.json`,
                title: action.captionTrack.name || 'Animated Subtitles',
                description: `🎬 ${action.captionTrack.segmentCount} segments • ${Math.round(action.captionTrack.totalDuration)}s • ${action.captionTrack.preset} preset • Word-by-word highlighting`,
                captionData: action.captionTrack,
                animatedSegments: action.animatedSegments,
                url: '#animated-captions',
                prompt: 'Animated Subtitle Generation'
              };
              
              // Add to generated media for additional use
              setGeneratedMedia(prev => [...prev, animatedCaptionCard]);
              
              toast({
                title: "Animated Subtitles Added!",
                description: `${action.captionTrack.segmentCount} animated subtitle segments added to ${animatedTrackName} track with ${action.captionTrack.preset} preset and visual effects.`,
              });
              
              console.log(`🎬 Created animated subtitle track ${animatedTrackName} with ${animatedTextSegments.length} segments`, {
                trackId: newAnimatedCaptionTrack.id,
                segmentCount: animatedTextSegments.length,
                preset: action.captionTrack.preset,
                segments: animatedTextSegments.map(s => ({ 
                  text: s.content?.text?.substring(0, 50) + '...', 
                  start: s.startTime, 
                  end: s.endTime,
                  preset: s.content?.preset,
                  id: s.id
                }))
              });
            }
            break;

          case 'broll_suggestions_generated':
            // Handle B-roll suggestions - create draggable B-roll cards
            if (action.suggestions && action.suggestions.length > 0) {
              const brollCards = action.suggestions.map((suggestion: any) => ({
                id: `broll_${suggestion.id || Date.now()}`,
                type: 'broll_suggestion',
                title: suggestion.concept || 'B-roll Concept',
                description: `${suggestion.startTime}s-${suggestion.endTime}s • ${suggestion.justification}`,
                brollData: {
                  concept: suggestion.concept,
                  startTime: suggestion.startTime,
                  endTime: suggestion.endTime,
                  justification: suggestion.justification,
                  prompt: suggestion.prompt
                },
                url: '#broll-suggestion',
                prompt: suggestion.prompt || 'B-roll Generation Prompt'
              }));
              
              // Add to generated media for dragging
              setGeneratedMedia(prev => [...prev, ...brollCards]);
              
              // Add B-roll operation to chat operations for card display
              setChatOperations(prev => [...prev, {
                ...action,
                type: 'broll_suggestions_generated',
                suggestions: action.suggestions
              }]);
              
              toast({
                title: "B-roll Suggestions Generated!",
                description: `${action.suggestions.length} creative B-roll suggestions created. Drag to timeline or use prompts for AI video generation.`,
              });
              
              console.log(`🎬 Generated ${brollCards.length} B-roll suggestions:`, brollCards);
            }
            break;

          case 'error':
            // Handle error actions - just log them, don't modify timeline
            console.warn('AI Agent Error:', action.description);
            break;

          default:
            console.log('Unknown action type:', action.type);
        }
      });

      return newComposition;
    });
  }, []);

  // Agentic chat mutation
  // Auto-scroll to latest message when chat messages change
  useEffect(() => {
    if (chatMessagesRef.current) {
      chatMessagesRef.current.scrollTop = chatMessagesRef.current.scrollHeight;
    }
  }, [chatMessages, isTyping]);

  const agenticChatMutation = useMutation({
    mutationFn: async ({ message, sessionId, videoContext, subtitleSettings }: {
      message: string;
      sessionId: string;
      videoContext: any;
      subtitleSettings?: any;
    }) => {
      const response = await fetch('/api/agentic-chat', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ message, sessionId, videoContext, subtitleSettings })
      });
      
      if (!response.ok) {
        throw new Error(`Chat failed: ${response.statusText}`);
      }
      
      return response.json();
    },
    onMutate: () => {
      // Show typing animation when starting
      setIsTyping(true);
    },
    onSuccess: (data) => {
      // Hide typing animation
      setIsTyping(false);
      
      console.log('Agent response:', data);

      // Check for token exhaustion/blocking responses
      const hasTokenExhaustedAction = data.actions?.some((action: any) => 
        action.type === 'token_exhausted' || action.type === 'insufficient_tokens'
      );
      
      const isTokenBlockingResponse = data.response?.includes('App tokens are consumed') || 
                                    data.response?.includes('Insufficient tokens') ||
                                    hasTokenExhaustedAction;

      if (isTokenBlockingResponse) {
        // Extract token data from actions if available
        const tokenAction = data.actions?.find((action: any) => 
          action.type === 'token_exhausted' || action.type === 'insufficient_tokens'
        );
        
        // Show token exhaustion modal instead of browser alert
        setTokenExhaustionData({
          type: tokenAction?.type || 'token_exhausted',
          tokenBalance: tokenAction?.tokenBalance || 0,
          totalTokens: tokenAction?.totalTokens || 0,
          usedTokens: tokenAction?.usedTokens || 0,
          minimumRequired: tokenAction?.minimumRequired || 0,
          operationType: tokenAction?.operationType || 'ai_operation',
          response: data.response
        });
        setShowTokenExhaustionModal(true);
        
        // Store token blocking state in localStorage for persistent blocking
        localStorage.setItem('tokenBlocked', 'true');
        localStorage.setItem('tokenBlockTimestamp', Date.now().toString());
        
        console.log('🚫 Token blocking detected - showing in-app modal and storing block state');
      } else {
        // Apply actions to timeline if not token blocked
        if (data.actions && data.actions.length > 0) {
          applyAgentActions(data.actions);
        }
      }

      const assistantMessage: ChatMessage = {
        id: nanoid(),
        type: 'assistant',
        content: data.response || data.message || 'Task completed',
        timestamp: new Date().toISOString(),
        operations: data.actions || data.operations || []
      };
      
      setChatMessages(prev => [...prev, assistantMessage]);
    },
    onError: (error) => {
      // Hide typing animation on error
      setIsTyping(false);
      
      console.error('Agent chat error:', error);
      const errorMessage: ChatMessage = {
        id: nanoid(),
        type: 'assistant',
        content: 'Sorry, I encountered an error processing your request.',
        timestamp: new Date().toISOString()
      };
      
      setChatMessages(prev => [...prev, errorMessage]);
    }
  });

  // File upload handler
  const handleVideoUpload = useCallback((event: React.ChangeEvent<HTMLInputElement>) => {
    const file = event.target.files?.[0];
    if (file && file.type.startsWith('video/')) {
      uploadVideoMutation.mutate(file);
    }
  }, [uploadVideoMutation]);

  // Video time update handler for timeline synchronization and segment boundaries
  const handleVideoTimeUpdate = useCallback(() => {
    if (videoRef.current) {
      const currentTime = videoRef.current.currentTime;
      
      // Check if we need to stop at segment end time
      if (selectedVideoTrack) {
        const track = videoComposition.tracks.find(t => t.id === selectedVideoTrack && t.type === 'video');
        if (track?.segments && track.segments.length > 0) {
          const firstSegment = track.segments[0];
          if (firstSegment.endTime !== undefined && currentTime >= firstSegment.endTime) {
            videoRef.current.pause();
            console.log(`⏹️ Segment ended at ${firstSegment.endTime}s - paused playback`);
            setVideoComposition(prev => ({ ...prev, isPlaying: false }));
            return;
          }
        }
      }
      
      setVideoComposition(prev => ({
        ...prev,
        currentTime: currentTime,
        isPlaying: !videoRef.current!.paused
      }));
    }
  }, [selectedVideoTrack, videoComposition.tracks]);

  // Get the current video source based on selected track
  const getCurrentVideoSource = useCallback(() => {
    if (selectedVideoTrack) {
      // Find the selected video track
      const track = videoComposition.tracks.find(t => t.id === selectedVideoTrack && t.type === 'video');
      
      // Check for AI shorts clips first
      if (track?.segments && track.segments.length > 0) {
        const firstSegment = track.segments[0];
        
        // Check if this is an AI shorts clip with its own video file
        if (firstSegment.content?.videoPath) {
          console.log(`🔍 Found AI shorts videoPath:`, firstSegment.content.videoPath);
          let shortsPath = firstSegment.content.videoPath;
          
          // Handle different videoPath formats
          if (shortsPath.startsWith('/api/video/')) {
            // Already in correct format
            shortsPath = shortsPath;
          } else if (shortsPath.startsWith('uploads/')) {
            // Remove uploads/ prefix and add API prefix
            shortsPath = `/api/video/${shortsPath.replace('uploads/', '')}`;
          } else if (shortsPath.includes('shorts_clip_')) {
            // Raw filename, add API prefix
            const filename = shortsPath.split('/').pop();
            shortsPath = `/api/video/${filename}`;
          } else {
            // Default case - assume it's a filename
            shortsPath = `/api/video/${shortsPath}`;
          }
          
          console.log(`🎬 getCurrentVideoSource: Using AI shorts video: ${shortsPath}`);
          return shortsPath;
        }
        
        // Check sourceFile for shorts clips
        if (firstSegment.sourceFile && firstSegment.sourceFile.includes('shorts_clip_')) {
          const shortsPath = `/api/video/${firstSegment.sourceFile}`;
          console.log(`🎬 getCurrentVideoSource: Using AI shorts from sourceFile: ${shortsPath}`);
          return shortsPath;
        }
        
        // Check if segment has videoPath directly
        if (firstSegment.videoPath) {
          const videoPath = firstSegment.videoPath.startsWith('/api/video/') 
            ? firstSegment.videoPath 
            : `/api/video/${firstSegment.videoPath.replace('uploads/', '')}`;
          console.log(`🎬 getCurrentVideoSource: Using segment videoPath: ${videoPath}`);
          return videoPath;
        }
      }
      
      // Track's own video file
      if (track?.videoFile) {
        console.log(`🎬 getCurrentVideoSource: Using track video file: /api/video/${track.videoFile.filename}`);
        return `/api/video/${track.videoFile.filename}`;
      }
      
      // If track has segments but no specific video, use main video source
      if (track?.segments.length > 0 && currentVideo) {
        console.log(`🎬 getCurrentVideoSource: Using main video for track segments: /api/video/${currentVideo.filename}`);
        return `/api/video/${currentVideo.filename}`;
      }
    }
    
    // Fallback to main video
    const fallbackPath = currentVideo ? `/api/video/${currentVideo.filename}` : null;
    console.log(`🎬 getCurrentVideoSource: Using fallback video: ${fallbackPath}`);
    return fallbackPath;
  }, [selectedVideoTrack, videoComposition.tracks, currentVideo]);

  // Force video reload when source changes
  useEffect(() => {
    const currentSource = getCurrentVideoSource();
    if (videoRef.current && currentSource && videoRef.current.src !== currentSource) {
      console.log(`🔄 Video source changed to: ${currentSource}`);
      videoRef.current.src = currentSource;
      videoRef.current.load();
    }
  }, [getCurrentVideoSource]);

  // Timeline playback controls
  const togglePlayback = useCallback(() => {
    if (videoRef.current) {
      if (videoRef.current.paused) {
        videoRef.current.play();
      } else {
        videoRef.current.pause();
      }
      setVideoComposition(prev => ({
        ...prev,
        isPlaying: !videoRef.current!.paused
      }));
    }
  }, []);

  const seekToTime = useCallback((time: number) => {
    if (videoRef.current) {
      videoRef.current.currentTime = time;
      setVideoComposition(prev => ({
        ...prev,
        currentTime: time
      }));
    }
  }, []);

  // Drag and drop state
  const [draggedTrack, setDraggedTrack] = useState<string | null>(null);
  const [dropZone, setDropZone] = useState<'delete' | null>(null);

  // Track selection function
  const selectVideoTrack = useCallback((trackId: string) => {
    console.log(`🎯 Selecting video track: ${trackId}`);
    
    // Pause current video first
    if (videoRef.current && !videoRef.current.paused) {
      videoRef.current.pause();
      console.log(`⏸️ Paused current playback`);
    }
    
    setSelectedVideoTrack(trackId);
    
    // Update composition to mark this track as playing
    setVideoComposition(prev => ({
      ...prev,
      isPlaying: false, // Reset global playing state
    }));
    
    // Find the track and get its video source
    const track = videoComposition.tracks.find(t => t.id === trackId && t.type === 'video');
    if (track && videoRef.current) {
      // Check if track has AI-generated video segments (like shorts clips)
      let newSource = null;
      
      if (track.segments && track.segments.length > 0) {
        const firstSegment = track.segments[0];
        // Check if this is an AI shorts clip with its own video file
        if (firstSegment.content?.videoPath) {
          console.log(`🔍 selectVideoTrack: Found AI shorts videoPath:`, firstSegment.content.videoPath);
          let shortsPath = firstSegment.content.videoPath;
          
          // Handle different videoPath formats
          if (shortsPath.startsWith('/api/video/')) {
            // Already in correct format
            newSource = shortsPath;
          } else if (shortsPath.startsWith('uploads/')) {
            // Remove uploads/ prefix and add API prefix
            newSource = `/api/video/${shortsPath.replace('uploads/', '')}`;
          } else if (shortsPath.includes('shorts_clip_')) {
            // Raw filename, add API prefix
            const filename = shortsPath.split('/').pop();
            newSource = `/api/video/${filename}`;
          } else {
            // Default case - assume it's a filename
            newSource = `/api/video/${shortsPath}`;
          }
          
          console.log(`🎬 selectVideoTrack: Using AI shorts video: ${newSource}`);
        }
        // Additional check for AI shorts in sourceFile property
        else if (firstSegment.content && firstSegment.sourceFile && firstSegment.sourceFile.includes('shorts_clip_')) {
          newSource = `/api/video/${firstSegment.sourceFile}`;
          console.log(`🎬 Using AI shorts video from sourceFile: ${newSource}`);
        }
        // Check if segment has videoPath directly
        else if (firstSegment.videoPath) {
          newSource = firstSegment.videoPath.startsWith('/api/video/') 
            ? firstSegment.videoPath 
            : `/api/video/${firstSegment.videoPath.replace('uploads/', '')}`;
          console.log(`🎬 Using segment videoPath: ${newSource}`);
        }
      }
      
      // Fallback to track's video file or main video
      if (!newSource) {
        newSource = track.videoFile ? `/api/video/${track.videoFile.filename}` : 
                   (currentVideo ? `/api/video/${currentVideo.filename}` : null);
        console.log(`🎬 Using fallback video source: ${newSource}`);
      }
      
      if (newSource) {
        console.log(`🎬 Loading video source: ${newSource}`);
        videoRef.current.src = newSource;
        
        // Force video reload by setting src and calling load()
        videoRef.current.load();
        
        // Wait for video to load, then seek to segment time and play
        videoRef.current.onloadeddata = () => {
          console.log(`🎬 Video loaded successfully: ${newSource}`);
          if (track.segments && track.segments.length > 0) {
            const firstSegment = track.segments[0];
            if (firstSegment.startTime !== undefined) {
              console.log(`🎬 Seeking to segment start time: ${firstSegment.startTime}s`);
              videoRef.current!.currentTime = firstSegment.startTime;
              // Auto-play the video after seeking
              setTimeout(() => {
                if (videoRef.current) {
                  videoRef.current.play().then(() => {
                    console.log(`▶️ Auto-playing segment from ${firstSegment.startTime}s`);
                    setVideoComposition(prev => ({ ...prev, isPlaying: true }));
                  }).catch(error => {
                    console.error(`❌ Failed to play video:`, error);
                  });
                }
              }, 100);
            }
          } else {
            // For tracks without segments, just play from current position
            setTimeout(() => {
              if (videoRef.current) {
                videoRef.current.play().then(() => {
                  console.log(`▶️ Playing video track`);
                  setVideoComposition(prev => ({ ...prev, isPlaying: true }));
                }).catch(error => {
                  console.error(`❌ Failed to play video:`, error);
                });
              }
            }, 100);
          }
        };
        
        // Add error handling for video loading
        videoRef.current.onerror = (error) => {
          console.error(`❌ Video loading error for ${newSource}:`, error);
        };
      }
    }
  }, [videoComposition.tracks, currentVideo]);

  // Track management functions
  const createNewVideoTrack = useCallback(() => {
    const videoTracks = videoComposition.tracks.filter(t => t.type === 'video');
    const newTrack: Track = {
      id: nanoid(),
      name: `V${videoTracks.length + 1}`,
      type: 'video',
      segments: [],
      locked: false,
      visible: true,
      muted: false,
      height: 60,
      color: 'from-blue-500 to-purple-600',
      created: new Date(),
      lastUpdate: new Date()
    };

    setVideoComposition(prev => ({
      ...prev,
      tracks: [...prev.tracks, newTrack]
    }));
  }, [videoComposition.tracks]);

  const createNewAudioTrack = useCallback(() => {
    const audioTracks = videoComposition.tracks.filter(t => t.type === 'audio');
    const newTrack: Track = {
      id: nanoid(),
      name: `A${audioTracks.length + 1}`,
      type: 'audio',
      segments: [],
      locked: false,
      visible: true,
      muted: false,
      height: 50,
      color: 'from-green-500 to-teal-600',
      created: new Date(),
      lastUpdate: new Date()
    };

    setVideoComposition(prev => ({
      ...prev,
      tracks: [...prev.tracks, newTrack]
    }));
  }, [videoComposition.tracks]);

  const createNewTextTrack = useCallback(() => {
    const textTracks = videoComposition.tracks.filter(t => t.type === 'text');
    const newTrack: Track = {
      id: nanoid(),
      name: `T${textTracks.length + 1}`,
      type: 'text',
      segments: [],
      locked: false,
      visible: true,
      muted: false,
      height: 40,
      color: 'from-yellow-500 to-orange-600',
      created: new Date(),
      lastUpdate: new Date()
    };

    setVideoComposition(prev => ({
      ...prev,
      tracks: [...prev.tracks, newTrack]
    }));
  }, [videoComposition.tracks]);

  // Function to update current video based on available tracks
  const updateCurrentVideoFromTracks = useCallback((tracks: Track[]) => {
    const videoTracks = tracks.filter(track => track.type === 'video' && track.visible && track.videoFile);
    
    if (videoTracks.length === 0) {
      // No video tracks - clear video
      setCurrentVideo(null);
    } else {
      // Use the first visible video track
      const primaryTrack = videoTracks[0];
      setCurrentVideo(primaryTrack.videoFile || null);
    }
  }, []);

  const createNewMediaTrack = useCallback(() => {
    const mediaTracks = videoComposition.tracks.filter(t => t.type === 'media');
    const newTrack: Track = {
      id: nanoid(),
      name: `M${mediaTracks.length + 1}`,
      type: 'media',
      segments: [],
      locked: false,
      visible: true,
      muted: false,
      height: 50,
      color: 'from-purple-500 to-pink-600',
      created: new Date(),
      lastUpdate: new Date()
    };

    setVideoComposition(prev => ({
      ...prev,
      tracks: [...prev.tracks, newTrack]
    }));
  }, [videoComposition.tracks]);

  const deleteTrack = useCallback((trackId: string) => {
    setVideoComposition(prev => {
      const updatedTracks = prev.tracks.filter(track => track.id !== trackId);
      
      // Update current video based on remaining tracks
      const videoTracks = updatedTracks.filter(track => track.type === 'video' && track.visible && track.videoFile);
      if (videoTracks.length === 0) {
        setCurrentVideo(null);
      } else {
        setCurrentVideo(videoTracks[0].videoFile || null);
      }
      
      return {
        ...prev,
        tracks: updatedTracks
      };
    });
  }, []);

  const toggleTrackCategory = useCallback((category: keyof VideoComposition['trackCategories']) => {
    setVideoComposition(prev => ({
      ...prev,
      trackCategories: {
        ...prev.trackCategories,
        [category]: { expanded: !prev.trackCategories[category].expanded }
      }
    }));
  }, []);

  const getTracksByCategory = useCallback((category: string) => {
    return videoComposition.tracks.filter(track => track.type === category);
  }, [videoComposition.tracks]);

  const toggleTrackVisibility = useCallback((trackId: string) => {
    setVideoComposition(prev => {
      const updatedTracks = prev.tracks.map(track => 
        track.id === trackId ? { ...track, visible: !track.visible } : track
      );
      
      // Update current video based on track visibility changes  
      const videoTracks = updatedTracks.filter(track => track.type === 'video' && track.visible && track.videoFile);
      if (videoTracks.length === 0) {
        setCurrentVideo(null);
      } else {
        setCurrentVideo(videoTracks[0].videoFile || null);
      }
      
      return {
        ...prev,
        tracks: updatedTracks
      };
    });
  }, []);

  const toggleTrackMute = useCallback((trackId: string) => {
    setVideoComposition(prev => ({
      ...prev,
      tracks: prev.tracks.map(track => 
        track.id === trackId ? { ...track, muted: !track.muted } : track
      )
    }));
  }, []);

  const toggleTrackLock = useCallback((trackId: string) => {
    setVideoComposition(prev => ({
      ...prev,
      tracks: prev.tracks.map(track => 
        track.id === trackId ? { ...track, locked: !track.locked } : track
      )
    }));
  }, []);

  // Drag and drop handlers
  const handleTrackDragStart = useCallback((e: React.DragEvent, trackId: string) => {
    setDraggedTrack(trackId);
    e.dataTransfer.effectAllowed = 'move';
    e.dataTransfer.setData('text/plain', trackId);
  }, []);

  const handleTrackDragEnd = useCallback(() => {
    setDraggedTrack(null);
    setDropZone(null);
  }, []);

  const handleDeleteZoneDragOver = useCallback((e: React.DragEvent) => {
    e.preventDefault();
    e.dataTransfer.dropEffect = 'move';
    setDropZone('delete');
  }, []);

  const handleDeleteZoneDragLeave = useCallback(() => {
    setDropZone(null);
  }, []);

  const handleDeleteZoneDrop = useCallback((e: React.DragEvent) => {
    e.preventDefault();
    const trackId = e.dataTransfer.getData('text/plain');
    if (trackId && draggedTrack) {
      deleteTrack(trackId);
    }
    setDraggedTrack(null);
    setDropZone(null);
  }, [draggedTrack, deleteTrack]);

  // Segment moving handler
  const handleSegmentMoveStart = useCallback((
    e: React.MouseEvent,
    segmentId: string,
    trackId: string,
    segment: Segment
  ) => {
    e.preventDefault();
    e.stopPropagation();

    setDragState({
      isDragging: true,
      segmentId,
      trackId,
      dragType: 'move',
      initialX: e.clientX,
      initialTime: segment.startTime
    });

    const segmentDuration = segment.endTime - segment.startTime;

    const handleMouseMove = (moveEvent: MouseEvent) => {
      const deltaX = moveEvent.clientX - e.clientX;
      const deltaTime = deltaX / (timelineZoom * 10); // Convert pixels back to seconds
      const newStartTime = Math.max(0, segment.startTime + deltaTime);
      const newEndTime = newStartTime + segmentDuration;

      // Update segment position
      setVideoComposition(prev => ({
        ...prev,
        tracks: prev.tracks.map(track => {
          if (track.id !== trackId) return track;
          
          return {
            ...track,
            segments: track.segments.map(seg => {
              if (seg.id !== segmentId) return seg;
              
              return {
                ...seg,
                startTime: newStartTime,
                endTime: newEndTime
              };
            })
          };
        })
      }));

      // Update selected segment if it's being dragged
      const currentTrack = videoComposition.tracks.find(t => t.id === trackId);
      if (selectedSegment && 
          selectedSegment.startTime === segment.startTime && 
          currentTrack?.type === 'text') {
        setSelectedSegment({
          ...selectedSegment,
          startTime: newStartTime,
          endTime: newEndTime
        });
      }
    };

    const handleMouseUp = () => {
      setDragState({
        isDragging: false,
        segmentId: null,
        trackId: null,
        dragType: null,
        initialX: 0,
        initialTime: 0
      });
      
      document.removeEventListener('mousemove', handleMouseMove);
      document.removeEventListener('mouseup', handleMouseUp);
    };

    document.addEventListener('mousemove', handleMouseMove);
    document.addEventListener('mouseup', handleMouseUp);
  }, [timelineZoom, selectedSegment, videoComposition.tracks]);

  // Segment resizing handlers
  const handleSegmentResizeStart = useCallback((
    e: React.MouseEvent,
    segmentId: string,
    trackId: string,
    dragType: 'start' | 'end',
    currentTime: number
  ) => {
    e.preventDefault();
    e.stopPropagation();

    setDragState({
      isDragging: true,
      segmentId,
      trackId,
      dragType,
      initialX: e.clientX,
      initialTime: currentTime
    });

    const handleMouseMove = (moveEvent: MouseEvent) => {
      const deltaX = moveEvent.clientX - e.clientX;
      const deltaTime = deltaX / (timelineZoom * 10); // Convert pixels back to seconds
      const newTime = Math.max(0, currentTime + deltaTime);

      // Update segment time based on drag type
      setVideoComposition(prev => ({
        ...prev,
        tracks: prev.tracks.map(track => {
          if (track.id !== trackId) return track;
          
          return {
            ...track,
            segments: track.segments.map(segment => {
              if (segment.id !== segmentId) return segment;
              
              const updatedSegment = { ...segment };
              
              if (dragType === 'start') {
                updatedSegment.startTime = Math.min(newTime, segment.endTime - 0.5); // Minimum 0.5s duration
              } else {
                updatedSegment.endTime = Math.max(newTime, segment.startTime + 0.5); // Minimum 0.5s duration
              }
              
              return updatedSegment;
            })
          };
        })
      }));

      // Update selected segment if it's being dragged
      const currentTrack = videoComposition.tracks.find(t => t.id === trackId);
      if (selectedSegment && 
          selectedSegment.startTime === currentTime && 
          currentTrack?.type === 'text') {
        const updatedSelected = { ...selectedSegment };
        if (dragType === 'start') {
          updatedSelected.startTime = Math.min(newTime, selectedSegment.endTime - 0.5);
        } else {
          updatedSelected.endTime = Math.max(newTime, selectedSegment.startTime + 0.5);
        }
        setSelectedSegment(updatedSelected);
      }
    };

    const handleMouseUp = () => {
      setDragState({
        isDragging: false,
        segmentId: null,
        trackId: null,
        dragType: null,
        initialX: 0,
        initialTime: 0
      });
      
      document.removeEventListener('mousemove', handleMouseMove);
      document.removeEventListener('mouseup', handleMouseUp);
    };

    document.addEventListener('mousemove', handleMouseMove);
    document.addEventListener('mouseup', handleMouseUp);
  }, [dragState, timelineZoom, selectedSegment]);

  // Clean up drag state on unmount
  useEffect(() => {
    return () => {
      if (dragState.isDragging) {
        setDragState({
          isDragging: false,
          segmentId: null,
          trackId: null,
          dragType: null,
          initialX: 0,
          initialTime: 0
        });
      }
    };
  }, []);

  // Segment management functions
  const deleteSegment = useCallback((segmentId: string, trackId: string) => {
    console.log('Deleting segment:', segmentId, 'from track:', trackId);
    
    setVideoComposition(prev => {
      const updatedTracks = prev.tracks.map(track => {
        if (track.id === trackId) {
          const updatedSegments = track.segments.filter(segment => segment.id !== segmentId);
          return { ...track, segments: updatedSegments };
        }
        return track;
      });
      
      return { ...prev, tracks: updatedTracks };
    });
    
    // Close left drawer if this was the selected segment
    if (selectedSegment && selectedSegment.startTime >= 0) {
      // Find if the deleted segment was the selected one
      const track = videoComposition.tracks.find(t => t.id === trackId);
      const deletedSegment = track?.segments.find(s => s.id === segmentId);
      if (deletedSegment && selectedSegment.startTime === deletedSegment.startTime && selectedSegment.endTime === deletedSegment.endTime) {
        setShowLeftDrawer(false);
        setSelectedSegment(null);
      }
    }
  }, [selectedSegment]);

  // Keyboard event handlers for segment deletion
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if ((e.key === 'Delete' || e.key === 'Backspace') && selectedSegment && showLeftDrawer) {
        // Find and delete the selected segment
        videoComposition.tracks.forEach(track => {
          const segment = track.segments.find(s => 
            s.startTime === selectedSegment.startTime && 
            s.endTime === selectedSegment.endTime
          );
          if (segment) {
            deleteSegment(segment.id, track.id);
          }
        });
      }
    };

    window.addEventListener('keydown', handleKeyDown);
    return () => {
      window.removeEventListener('keydown', handleKeyDown);
    };
  }, [selectedSegment, showLeftDrawer, videoComposition.tracks, deleteSegment]);

  // AI Agent functions
  const sendChatMessage = useCallback(async () => {
    if (!chatInput.trim() || agenticChatMutation.isPending) return;

    const userMessage: ChatMessage = {
      id: nanoid(),
      type: 'user',
      content: chatInput.trim(),
      timestamp: new Date().toISOString()
    };

    setChatMessages(prev => [...prev, userMessage]);
    const message = chatInput.trim();
    setChatInput('');

    agenticChatMutation.mutate({
      message,
      sessionId: agentSessionId,
      videoContext: {
        tracks: videoComposition.tracks,
        totalDuration: videoComposition.totalDuration,
        currentTime: videoComposition.currentTime,
        currentVideo: currentVideo,
        videoPath: currentVideo ? currentVideo.filename : null,
        videoFilename: currentVideo ? currentVideo.originalName : null
      }
    });
  }, [chatInput, agenticChatMutation, agentSessionId, videoComposition]);

  const handleChatKeyPress = useCallback((e: React.KeyboardEvent) => {
    if (e.key === 'Enter' && !e.shiftKey) {
      e.preventDefault();
      sendChatMessage();
    }
  }, [sendChatMessage]);

  // Time formatting
  const formatTime = useCallback((seconds: number): string => {
    const mins = Math.floor(seconds / 60);
    const secs = Math.floor(seconds % 60);
    return `${mins.toString().padStart(2, '0')}:${secs.toString().padStart(2, '0')}`;
  }, []);

  // Progressive video overlay system
  const getActiveSegmentsAtTime = useCallback((time: number) => {
    const activeSegments: { segment: Segment; track: Track }[] = [];
    
    videoComposition.tracks.forEach(track => {
      if (!track.visible) return;
      
      track.segments.forEach(segment => {
        if (segment.visible && time >= segment.startTime && time <= segment.endTime) {
          activeSegments.push({ segment, track });
        }
      });
    });
    
    return activeSegments;
  }, [videoComposition.tracks]);

  const getActiveTextOverlaysAtTime = useCallback((time: number) => {
    const activeTextOverlays: TextOverlay[] = [];
    
    videoComposition.tracks.forEach(track => {
      if (track.type === 'text' && track.visible) {
        track.segments.forEach(segment => {
          if (segment.visible && time >= segment.startTime && time <= segment.endTime && segment.content) {
            activeTextOverlays.push({
              text: segment.content.text || 'Text',
              x: segment.content.x || 50,
              y: segment.content.y || 50,
              fontSize: segment.content.fontSize || 24,
              color: segment.content.color || '#ffffff',
              style: segment.content.style || 'normal',
              startTime: segment.startTime,
              endTime: segment.endTime,
              // Advanced typography options
              fontFamily: segment.content.fontFamily || 'system-ui, -apple-system, sans-serif',
              fontWeight: segment.content.fontWeight || (segment.content.style === 'bold' ? 'bold' : 'normal'),
              fontStyle: segment.content.fontStyle || 'normal',
              // Text shadow options
              shadowColor: segment.content.shadowColor,
              shadowBlur: segment.content.shadowBlur,
              // Text outline options
              strokeColor: segment.content.strokeColor,
              strokeWidth: segment.content.strokeWidth,
              // Animation options
              animation: segment.content.animation || 'fadeIn',
              // Background options
              backgroundColor: segment.content.backgroundColor,
              backgroundOpacity: segment.content.backgroundOpacity,
              // Text formatting options
              textAlign: segment.content.textAlign || 'center',
              letterSpacing: segment.content.letterSpacing,
              lineHeight: segment.content.lineHeight || 1.2
            });
          }
        });
      }
    });
    
    return activeTextOverlays;
  }, [videoComposition.tracks]);

  // Helper function to get active media overlays at current time
  const getActiveMediaOverlaysAtTime = useCallback((time: number) => {
    const activeMediaOverlays: Segment[] = [];
    
    videoComposition.tracks.forEach(track => {
      if (track.type === 'media' && track.visible) {
        track.segments.forEach(segment => {
          if (segment.visible && time >= segment.startTime && time <= segment.endTime && segment.content) {
            activeMediaOverlays.push(segment);
          }
        });
      }
    });
    
    return activeMediaOverlays;
  }, [videoComposition.tracks]);

  // Function to update media segment properties and preview in real-time
  const updateMediaSegmentPreview = useCallback((segmentId: string, updates: any) => {
    setVideoComposition(prev => {
      const updatedTracks = prev.tracks.map(track => {
        if (track.type === 'media') {
          const updatedSegments = track.segments.map(segment => {
            if (segment.id === segmentId) {
              return {
                ...segment,
                content: {
                  ...segment.content,
                  ...updates
                }
              };
            }
            return segment;
          });
          return { ...track, segments: updatedSegments };
        }
        return track;
      });
      return { 
        ...prev, 
        tracks: updatedTracks,
        previewMode: 'composition' // Ensure preview mode is set to show overlays
      };
    });
  }, []);

  const isVideoVisibleAtTime = useCallback((time: number) => {
    // Check if video should be hidden by cut segments
    const cutSegments = videoComposition.tracks
      .filter(track => track.type === 'video' && track.visible)
      .flatMap(track => track.segments.filter(seg => seg.type === 'cut' && seg.visible));
    
    // If there are cut segments, video is only visible during those segments
    if (cutSegments.length > 0) {
      return cutSegments.some(seg => time >= seg.startTime && time <= seg.endTime);
    }
    
    // If no cut segments, video is always visible
    return true;
  }, [videoComposition.tracks]);

  // Timeline rendering
  const renderTimelineRuler = useCallback(() => {
    const intervals = [];
    const step = 5; // 5-second intervals
    for (let i = 0; i <= videoComposition.totalDuration; i += step) {
      intervals.push(
        <div key={i} className="flex flex-col items-center">
          <div className="w-px h-4 bg-gray-400"></div>
          <span className="text-xs text-gray-500 mt-1">{formatTime(i)}</span>
        </div>
      );
    }
    return intervals;
  }, [videoComposition.totalDuration, formatTime]);

  const renderTrackSegments = useCallback((track: Track) => {
    const trackWidth = videoComposition.totalDuration * videoComposition.timelineZoom * 10; // pixels per second
    
    return (
      <div 
        className="relative h-full bg-slate-800/70 backdrop-blur-sm rounded border border-purple-500/20 shadow-lg"
        style={{ width: `${trackWidth}px` }}
        onClick={() => setSelectedTrack(selectedTrack === track.id ? null : track.id)}
      >
        {track.videoFile && (
          <div className={`absolute inset-0 bg-gradient-to-r ${track.color} opacity-70`}>
          </div>
        )}
        
        {track.segments.map((segment, segmentIndex) => {
          // Enhanced segment colors based on track type and index
          let segmentColor = track.color;
          let segmentStyle = {};
          
          // Calculate positioning for debugging
          const leftPosition = segment.startTime * videoComposition.timelineZoom * 10;
          const widthSize = (segment.endTime - segment.startTime) * videoComposition.timelineZoom * 10;
          
          // Debug log for text segments
          if (track.type === 'text') {
            console.log(`🎯 Text segment ${segmentIndex} [SAME LINE]:`, {
              id: segment.id,
              text: segment.content?.text?.substring(0, 30) + '...',
              startTime: segment.startTime,
              endTime: segment.endTime,
              duration: segment.endTime - segment.startTime,
              leftPosition: leftPosition,
              widthSize: widthSize,
              topPosition: '2px', // All segments at same level
              height: 'calc(100% - 4px)', // Uniform height
              visible: segment.visible
            });
          }
          
          if (track.type === 'video') {
            const videoColors = [
              'from-emerald-500 via-teal-500 to-cyan-500', 
              'from-purple-500 via-violet-500 to-fuchsia-500',
              'from-orange-500 via-amber-500 to-yellow-500',
              'from-rose-500 via-pink-500 to-red-500',
              'from-blue-500 via-indigo-500 to-purple-500'
            ];
            segmentColor = videoColors[segmentIndex % videoColors.length];
          } else if (track.type === 'text') {
            // Gradient colors for text segments in timeline windows
            const textGradients = [
              'from-purple-500 via-pink-500 to-rose-500',
              'from-blue-500 via-cyan-500 to-teal-500', 
              'from-orange-500 via-yellow-500 to-amber-500',
              'from-green-500 via-emerald-500 to-lime-500',
              'from-indigo-500 via-purple-500 to-pink-500',
              'from-red-500 via-rose-500 to-pink-500',
              'from-cyan-500 via-blue-500 to-indigo-500',
              'from-yellow-500 via-orange-500 to-red-500'
            ];
            segmentColor = textGradients[segmentIndex % textGradients.length];
            segmentStyle = { 
              color: '#ffffff', // White text
              opacity: 0.9,
              border: '2px solid rgba(255,255,255,0.3)',
              boxShadow: '0 2px 8px rgba(0,0,0,0.4)',
              zIndex: 10 + segmentIndex, // Ensure segments don't overlap
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              fontSize: '12px',
              fontWeight: '500',
              textShadow: '1px 1px 2px rgba(0,0,0,0.8)' // Better text readability
            };
          }
          
          // Ensure segment is visible and has valid dimensions
          if (!segment.visible || widthSize < 1) {
            return null;
          }
          
          return <div
            key={segment.id}
            className={`absolute ${segmentColor ? `bg-gradient-to-r ${segmentColor}` : 'bg-gray-500'} rounded-lg border-2 border-white/80 shadow-lg ${
              track.type === 'text' || track.type === 'media' ? 'cursor-pointer hover:shadow-xl hover:border-purple-400 hover:scale-105 transition-all duration-200' : 'hover:shadow-xl hover:scale-105 transition-all duration-200'
            } group ${track.type === 'text' ? '' : 'backdrop-blur-sm'}`}
            style={{
              left: `${leftPosition}px`,
              width: `${Math.max(widthSize, 10)}px`, // Minimum width of 10px
              top: '2px', // Fixed top position for all segments
              height: 'calc(100% - 4px)', // Uniform height for all segments
              ...segmentStyle
            }}
            onClick={(e) => {
              e.stopPropagation(); // Prevent track selection
              
              // Handle text segment clicks to open left drawer
              if (track.type === 'text' && segment.content) {
                const textOverlay: TextOverlay = {
                  text: segment.content.text || 'Text',
                  x: segment.content.x || 50,
                  y: segment.content.y || 50,
                  fontSize: segment.content.fontSize || 24,
                  color: segment.content.color || '#ffffff',
                  style: segment.content.style || 'normal',
                  startTime: segment.startTime,
                  endTime: segment.endTime
                };
                
                setSelectedSegment(textOverlay);
                setSelectedMediaSegment(null);
                setDrawerMode('text');
                setShowLeftDrawer(true);
              }
              
              // Handle media segment clicks to open left drawer
              if (track.type === 'media' && segment.content) {
                setSelectedMediaSegment(segment);
                setSelectedSegment(null);
                setDrawerMode('media');
                setShowLeftDrawer(true);
              }
            }}
          >
            {/* Caption text content for text segments */}
            {track.type === 'text' && segment.content && (
              <div className="absolute inset-0 flex items-center justify-center text-xs font-medium text-white rounded overflow-hidden">
                <span className="truncate px-1 text-white" title={segment.content.text} style={{ color: '#ffffff !important' }}>
                  {segment.content.text}
                </span>
              </div>
            )}

            {/* Left Resize Handle */}
            <div
              className="absolute left-0 top-0 w-2 h-full bg-white/80 cursor-ew-resize opacity-0 group-hover:opacity-100 transition-opacity z-10 flex items-center justify-center"
              onMouseDown={(e) => handleSegmentResizeStart(e, segment.id, track.id, 'start', segment.startTime)}
              onClick={(e) => e.stopPropagation()}
            >
              <div className="w-0.5 h-4 bg-gray-600"></div>
            </div>

            {/* Delete Button */}
            <button
              className="absolute -top-1 -right-1 w-5 h-5 bg-red-500 text-white rounded-full opacity-0 group-hover:opacity-100 transition-opacity flex items-center justify-center z-20 hover:bg-red-600"
              onClick={(e) => {
                e.stopPropagation();
                deleteSegment(segment.id, track.id);
              }}
              title="Delete segment"
            >
              <svg className="w-3 h-3" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
              </svg>
            </button>

            {/* Right Resize Handle */}
            <div
              className="absolute right-0 top-0 w-2 h-full bg-white/80 cursor-ew-resize opacity-0 group-hover:opacity-100 transition-opacity z-10 flex items-center justify-center"
              onMouseDown={(e) => handleSegmentResizeStart(e, segment.id, track.id, 'end', segment.endTime)}
              onClick={(e) => e.stopPropagation()}
            >
              <div className="w-0.5 h-4 bg-gray-600"></div>
            </div>

            {/* Highlight Bubbles */}
            {segment.highlights?.map((highlight) => (
              <HighlightBubble
                key={highlight.id}
                type={highlight.type}
                position={highlight.position}
                relevanceScore={highlight.relevanceScore}
                description={highlight.description}
                onClick={() => {
                  console.log('Highlight clicked:', highlight);
                  // Navigate to specific timestamp if available
                  if (highlight.timestamp) {
                    setVideoComposition(prev => ({ 
                      ...prev, 
                      currentTime: segment.startTime + highlight.timestamp 
                    }));
                  }
                }}
                isVisible={true}
                pulseAnimation={highlight.type === 'ai-detected'}
              />
            ))}

            {/* Draggable Segment Content */}
            <div 
              className="absolute inset-x-2 inset-y-0 p-1 text-white text-xs cursor-move flex flex-col justify-center"
              onMouseDown={(e) => handleSegmentMoveStart(e, segment.id, track.id, segment)}
              title="Drag to move segment"
            >
              {track.type === 'text' && segment.content ? (
                <>
                  <div className="font-medium truncate">"{segment.content.text || 'Text'}"</div>
                  <div className="text-gray-300">{formatTime(segment.startTime)}-{formatTime(segment.endTime)}</div>
                </>
              ) : (
                <>
                  {segment.type} {formatTime(segment.startTime)}-{formatTime(segment.endTime)}
                </>
              )}
            </div>
          </div>
        })}
      </div>
    );
  }, [videoComposition.totalDuration, timelineZoom, selectedTrack, formatTime]);

  return (
    <div className={`min-h-screen w-full bg-gradient-to-br from-slate-950 via-purple-950 to-slate-950 text-white overflow-hidden ${className}`}>
      {/* Animated Background Elements */}
      <div className="fixed inset-0 overflow-hidden pointer-events-none">
        <div className="absolute top-20 left-10 w-72 h-72 bg-purple-500/10 rounded-full blur-3xl animate-pulse"></div>
        <div
          className="absolute top-40 right-20 w-96 h-96 bg-cyan-500/10 rounded-full blur-3xl animate-pulse"
          style={{ animationDelay: "1s" }}
        ></div>
        <div
          className="absolute bottom-20 left-1/2 w-80 h-80 bg-pink-500/10 rounded-full blur-3xl animate-pulse"
          style={{ animationDelay: "2s" }}
        ></div>
      </div>

      {/* Dynamic Layout: Optional Left Drawer + Main content + Optional AI Agent */}
      <div className={`grid h-screen overflow-hidden relative z-10 ${showLeftDrawer && showAiAgent ? 'grid-cols-[300px,1fr,auto]' : showLeftDrawer ? 'grid-cols-[300px,1fr]' : showAiAgent ? 'grid-cols-[1fr,auto]' : 'grid-cols-1'}`}>
        
        {/* Left Drawer for Segment Editing */}
        {showLeftDrawer && (
          <div className="bg-slate-900/80 backdrop-blur-xl border-r border-purple-500/20 flex flex-col h-full overflow-hidden shadow-2xl">
            {/* Header */}
            <div className="p-4 border-b border-purple-500/20 flex-shrink-0 bg-gradient-to-r from-purple-900/50 to-cyan-900/30 backdrop-blur-sm">
              <div className="flex items-center justify-between">
                <div className="flex items-center space-x-2">
                  {drawerMode === 'text' ? (
                    <>
                      <Type className="w-5 h-5 text-purple-400" />
                      <h3 className="font-semibold text-white">Text Editor</h3>
                    </>
                  ) : (
                    <>
                      <Image className="w-5 h-5 text-purple-400" />
                      <h3 className="font-semibold text-white">Media Editor</h3>
                    </>
                  )}
                </div>
                <Button
                  variant="ghost"
                  size="sm"
                  onClick={() => {
                    setShowLeftDrawer(false);
                    setSelectedSegment(null);
                    setSelectedMediaSegment(null);
                  }}
                  className="text-gray-400 hover:text-white"
                >
                  <X className="w-4 h-4" />
                </Button>
              </div>
              {drawerMode === 'text' && selectedSegment && (
                <div className="mt-2">
                  <p className="text-sm text-gray-400">
                    Editing: {formatTime(selectedSegment.startTime)} - {formatTime(selectedSegment.endTime)}
                  </p>
                </div>
              )}
              {drawerMode === 'media' && selectedMediaSegment && (
                <div className="mt-2">
                  <p className="text-sm text-gray-400">
                    Editing: {selectedMediaSegment.content.filename}
                  </p>
                </div>
              )}
            </div>
            
            {/* Text Editing Panel */}
            <ScrollArea className="flex-1 p-4">
              {drawerMode === 'text' && selectedSegment ? (
                <div className="space-y-4">
                  {/* Text Content */}
                  <div className="space-y-2">
                    <label className="text-sm font-medium text-gray-300">Text Content</label>
                    <Input
                      value={selectedSegment.text}
                      onChange={(e) => {
                        const updatedSegment = {
                          ...selectedSegment,
                          text: e.target.value
                        };
                        setSelectedSegment(updatedSegment);
                        
                        // Real-time preview update
                        setVideoComposition(prev => {
                          const updatedTracks = prev.tracks.map(track => {
                            if (track.type === 'text') {
                              const updatedSegments = track.segments.map(segment => {
                                if (segment.startTime === selectedSegment.startTime && 
                                    segment.endTime === selectedSegment.endTime) {
                                  return {
                                    ...segment,
                                    content: {
                                      ...segment.content,
                                      text: e.target.value
                                    }
                                  };
                                }
                                return segment;
                              });
                              return { ...track, segments: updatedSegments };
                            }
                            return track;
                          });
                          return { ...prev, tracks: updatedTracks };
                        });
                      }}
                      placeholder="Enter text..."
                      className="bg-gray-800 border-gray-600 text-white"
                    />
                  </div>
                  
                  {/* Timing Controls */}
                  <div className="space-y-3">
                    <label className="text-sm font-medium text-gray-300">Timing</label>
                    <div className="grid grid-cols-2 gap-2">
                      <div>
                        <label className="text-xs text-gray-400">Start Time (s)</label>
                        <Input
                          type="number"
                          step="0.1"
                          value={selectedSegment.startTime}
                          onChange={(e) => {
                            const newStartTime = parseFloat(e.target.value) || 0;
                            const updatedSegment = {
                              ...selectedSegment,
                              startTime: newStartTime
                            };
                            setSelectedSegment(updatedSegment);
                            
                            // Real-time preview update
                            setVideoComposition(prev => {
                              const updatedTracks = prev.tracks.map(track => {
                                if (track.type === 'text') {
                                  const updatedSegments = track.segments.map(segment => {
                                    if (segment.startTime === selectedSegment.startTime && 
                                        segment.endTime === selectedSegment.endTime) {
                                      return {
                                        ...segment,
                                        startTime: newStartTime
                                      };
                                    }
                                    return segment;
                                  });
                                  return { ...track, segments: updatedSegments };
                                }
                                return track;
                              });
                              return { ...prev, tracks: updatedTracks };
                            });
                          }}
                          className="bg-gray-800 border-gray-600 text-white"
                        />
                      </div>
                      <div>
                        <label className="text-xs text-gray-400">End Time (s)</label>
                        <Input
                          type="number"
                          step="0.1"
                          value={selectedSegment.endTime}
                          onChange={(e) => {
                            const newEndTime = parseFloat(e.target.value) || 0;
                            const updatedSegment = {
                              ...selectedSegment,
                              endTime: newEndTime
                            };
                            setSelectedSegment(updatedSegment);
                            
                            // Real-time preview update
                            setVideoComposition(prev => {
                              const updatedTracks = prev.tracks.map(track => {
                                if (track.type === 'text') {
                                  const updatedSegments = track.segments.map(segment => {
                                    if (segment.startTime === selectedSegment.startTime && 
                                        segment.endTime === selectedSegment.endTime) {
                                      return {
                                        ...segment,
                                        endTime: newEndTime
                                      };
                                    }
                                    return segment;
                                  });
                                  return { ...track, segments: updatedSegments };
                                }
                                return track;
                              });
                              return { ...prev, tracks: updatedTracks };
                            });
                          }}
                          className="bg-gray-800 border-gray-600 text-white"
                        />
                      </div>
                    </div>
                  </div>
                  
                  {/* Position Controls */}
                  <div className="space-y-3">
                    <label className="text-sm font-medium text-gray-300">Position</label>
                    <div className="grid grid-cols-2 gap-2">
                      <div>
                        <label className="text-xs text-gray-400">X Position (%)</label>
                        <Input
                          type="number"
                          min="0"
                          max="100"
                          value={selectedSegment.x}
                          onChange={(e) => {
                            const newX = parseFloat(e.target.value) || 50;
                            const updatedSegment = {
                              ...selectedSegment,
                              x: newX
                            };
                            setSelectedSegment(updatedSegment);
                            
                            // Real-time preview update
                            setVideoComposition(prev => {
                              const updatedTracks = prev.tracks.map(track => {
                                if (track.type === 'text') {
                                  const updatedSegments = track.segments.map(segment => {
                                    if (segment.startTime === selectedSegment.startTime && 
                                        segment.endTime === selectedSegment.endTime) {
                                      return {
                                        ...segment,
                                        content: {
                                          ...segment.content,
                                          x: newX
                                        }
                                      };
                                    }
                                    return segment;
                                  });
                                  return { ...track, segments: updatedSegments };
                                }
                                return track;
                              });
                              return { ...prev, tracks: updatedTracks };
                            });
                          }}
                          className="bg-gray-800 border-gray-600 text-white"
                        />
                      </div>
                      <div>
                        <label className="text-xs text-gray-400">Y Position (%)</label>
                        <Input
                          type="number"
                          min="0"
                          max="100"
                          value={selectedSegment.y}
                          onChange={(e) => {
                            const newY = parseFloat(e.target.value) || 50;
                            const updatedSegment = {
                              ...selectedSegment,
                              y: newY
                            };
                            setSelectedSegment(updatedSegment);
                            
                            // Real-time preview update
                            setVideoComposition(prev => {
                              const updatedTracks = prev.tracks.map(track => {
                                if (track.type === 'text') {
                                  const updatedSegments = track.segments.map(segment => {
                                    if (segment.startTime === selectedSegment.startTime && 
                                        segment.endTime === selectedSegment.endTime) {
                                      return {
                                        ...segment,
                                        content: {
                                          ...segment.content,
                                          y: newY
                                        }
                                      };
                                    }
                                    return segment;
                                  });
                                  return { ...track, segments: updatedSegments };
                                }
                                return track;
                              });
                              return { ...prev, tracks: updatedTracks };
                            });
                          }}
                          className="bg-gray-800 border-gray-600 text-white"
                        />
                      </div>
                    </div>
                  </div>
                  
                  {/* Style Controls */}
                  <div className="space-y-3">
                    <label className="text-sm font-medium text-gray-300">Style</label>
                    <div className="space-y-2">
                      <div>
                        <label className="text-xs text-gray-400">Font Size</label>
                        <Input
                          type="number"
                          min="8"
                          max="100"
                          value={selectedSegment.fontSize}
                          onChange={(e) => {
                            const newFontSize = parseFloat(e.target.value) || 24;
                            const updatedSegment = {
                              ...selectedSegment,
                              fontSize: newFontSize
                            };
                            setSelectedSegment(updatedSegment);
                            
                            // Real-time preview update
                            setVideoComposition(prev => {
                              const updatedTracks = prev.tracks.map(track => {
                                if (track.type === 'text') {
                                  const updatedSegments = track.segments.map(segment => {
                                    if (segment.startTime === selectedSegment.startTime && 
                                        segment.endTime === selectedSegment.endTime) {
                                      return {
                                        ...segment,
                                        content: {
                                          ...segment.content,
                                          fontSize: newFontSize
                                        }
                                      };
                                    }
                                    return segment;
                                  });
                                  return { ...track, segments: updatedSegments };
                                }
                                return track;
                              });
                              return { ...prev, tracks: updatedTracks };
                            });
                          }}
                          className="bg-gray-800 border-gray-600 text-white"
                        />
                      </div>
                      <div>
                        <label className="text-xs text-gray-400">Color</label>
                        <Input
                          type="color"
                          value={selectedSegment.color}
                          onChange={(e) => {
                            const newColor = e.target.value;
                            const updatedSegment = {
                              ...selectedSegment,
                              color: newColor
                            };
                            setSelectedSegment(updatedSegment);
                            
                            // Real-time preview update
                            setVideoComposition(prev => {
                              const updatedTracks = prev.tracks.map(track => {
                                if (track.type === 'text') {
                                  const updatedSegments = track.segments.map(segment => {
                                    if (segment.startTime === selectedSegment.startTime && 
                                        segment.endTime === selectedSegment.endTime) {
                                      return {
                                        ...segment,
                                        content: {
                                          ...segment.content,
                                          color: newColor
                                        }
                                      };
                                    }
                                    return segment;
                                  });
                                  return { ...track, segments: updatedSegments };
                                }
                                return track;
                              });
                              return { ...prev, tracks: updatedTracks };
                            });
                          }}
                          className="bg-gray-800 border-gray-600 h-10"
                        />
                      </div>
                    </div>
                  </div>

                  {/* Advanced Options */}
                  <div className="space-y-3">
                    <label className="text-sm font-medium text-gray-300 flex items-center gap-2">
                      <Settings className="w-4 h-4" />
                      Advanced Options
                    </label>
                    
                    {/* Typography */}
                    <div className="space-y-2">
                      <label className="text-xs text-gray-400">Font Family</label>
                      <select 
                        value={selectedSegment.fontFamily || 'Arial'}
                        onChange={(e) => {
                          const newFontFamily = e.target.value;
                          const updatedSegment = {
                            ...selectedSegment,
                            fontFamily: newFontFamily
                          };
                          setSelectedSegment(updatedSegment);
                          
                          // Real-time preview update
                          setVideoComposition(prev => {
                            const updatedTracks = prev.tracks.map(track => {
                              if (track.type === 'text') {
                                const updatedSegments = track.segments.map(segment => {
                                  if (segment.startTime === selectedSegment.startTime && 
                                      segment.endTime === selectedSegment.endTime) {
                                    return {
                                      ...segment,
                                      content: {
                                        ...segment.content,
                                        fontFamily: newFontFamily
                                      }
                                    };
                                  }
                                  return segment;
                                });
                                return { ...track, segments: updatedSegments };
                              }
                              return track;
                            });
                            return { ...prev, tracks: updatedTracks };
                          });
                        }}
                        className="w-full bg-gray-800 border border-gray-600 rounded px-3 py-2 text-sm text-white"
                      >
                        <option value="Arial">Arial</option>
                        <option value="Helvetica">Helvetica</option>
                        <option value="Georgia">Georgia</option>
                        <option value="Times New Roman">Times New Roman</option>
                        <option value="Verdana">Verdana</option>
                        <option value="Courier New">Courier New</option>
                        <option value="Impact">Impact</option>
                        <option value="Comic Sans MS">Comic Sans MS</option>
                        <option value="Trebuchet MS">Trebuchet MS</option>
                        <option value="Tahoma">Tahoma</option>
                      </select>
                    </div>

                    {/* Font Weight & Style */}
                    <div className="grid grid-cols-2 gap-2">
                      <div>
                        <label className="text-xs text-gray-400">Font Weight</label>
                        <select 
                          value={selectedSegment.fontWeight || 'normal'}
                          onChange={(e) => {
                            const newFontWeight = e.target.value;
                            const updatedSegment = {
                              ...selectedSegment,
                              fontWeight: newFontWeight
                            };
                            setSelectedSegment(updatedSegment);
                            
                            // Real-time preview update
                            setVideoComposition(prev => {
                              const updatedTracks = prev.tracks.map(track => {
                                if (track.type === 'text') {
                                  const updatedSegments = track.segments.map(segment => {
                                    if (segment.startTime === selectedSegment.startTime && 
                                        segment.endTime === selectedSegment.endTime) {
                                      return {
                                        ...segment,
                                        content: {
                                          ...segment.content,
                                          fontWeight: newFontWeight
                                        }
                                      };
                                    }
                                    return segment;
                                  });
                                  return { ...track, segments: updatedSegments };
                                }
                                return track;
                              });
                              return { ...prev, tracks: updatedTracks };
                            });
                          }}
                          className="w-full bg-gray-800 border border-gray-600 rounded px-3 py-2 text-sm text-white"
                        >
                          <option value="normal">Normal</option>
                          <option value="bold">Bold</option>
                          <option value="100">Thin</option>
                          <option value="300">Light</option>
                          <option value="500">Medium</option>
                          <option value="600">Semi Bold</option>
                          <option value="700">Bold</option>
                          <option value="900">Black</option>
                        </select>
                      </div>
                      <div>
                        <label className="text-xs text-gray-400">Text Style</label>
                        <select 
                          value={selectedSegment.fontStyle || 'normal'}
                          onChange={(e) => {
                            const newFontStyle = e.target.value;
                            const updatedSegment = {
                              ...selectedSegment,
                              fontStyle: newFontStyle
                            };
                            setSelectedSegment(updatedSegment);
                            
                            // Real-time preview update
                            setVideoComposition(prev => {
                              const updatedTracks = prev.tracks.map(track => {
                                if (track.type === 'text') {
                                  const updatedSegments = track.segments.map(segment => {
                                    if (segment.startTime === selectedSegment.startTime && 
                                        segment.endTime === selectedSegment.endTime) {
                                      return {
                                        ...segment,
                                        content: {
                                          ...segment.content,
                                          fontStyle: newFontStyle
                                        }
                                      };
                                    }
                                    return segment;
                                  });
                                  return { ...track, segments: updatedSegments };
                                }
                                return track;
                              });
                              return { ...prev, tracks: updatedTracks };
                            });
                          }}
                          className="w-full bg-gray-800 border border-gray-600 rounded px-3 py-2 text-sm text-white"
                        >
                          <option value="normal">Normal</option>
                          <option value="italic">Italic</option>
                          <option value="oblique">Oblique</option>
                        </select>
                      </div>
                    </div>

                    {/* Text Shadow */}
                    <div className="space-y-2">
                      <label className="text-xs text-gray-400">Text Shadow</label>
                      <div className="grid grid-cols-2 gap-2">
                        <div>
                          <label className="text-xs text-gray-500">Shadow Color</label>
                          <Input
                            type="color"
                            value={selectedSegment.shadowColor || '#000000'}
                            onChange={(e) => {
                              const newShadowColor = e.target.value;
                              const updatedSegment = {
                                ...selectedSegment,
                                shadowColor: newShadowColor
                              };
                              setSelectedSegment(updatedSegment);
                              
                              // Real-time preview update
                              setVideoComposition(prev => {
                                const updatedTracks = prev.tracks.map(track => {
                                  if (track.type === 'text') {
                                    const updatedSegments = track.segments.map(segment => {
                                      if (segment.startTime === selectedSegment.startTime && 
                                          segment.endTime === selectedSegment.endTime) {
                                        return {
                                          ...segment,
                                          content: {
                                            ...segment.content,
                                            shadowColor: newShadowColor
                                          }
                                        };
                                      }
                                      return segment;
                                    });
                                    return { ...track, segments: updatedSegments };
                                  }
                                  return track;
                                });
                                return { ...prev, tracks: updatedTracks };
                              });
                            }}
                            className="bg-gray-800 border-gray-600 h-8"
                          />
                        </div>
                        <div>
                          <label className="text-xs text-gray-500">Shadow Blur</label>
                          <Input
                            type="number"
                            min="0"
                            max="20"
                            value={selectedSegment.shadowBlur || 0}
                            onChange={(e) => {
                              const newShadowBlur = parseFloat(e.target.value) || 0;
                              const updatedSegment = {
                                ...selectedSegment,
                                shadowBlur: newShadowBlur
                              };
                              setSelectedSegment(updatedSegment);
                              
                              // Real-time preview update
                              setVideoComposition(prev => {
                                const updatedTracks = prev.tracks.map(track => {
                                  if (track.type === 'text') {
                                    const updatedSegments = track.segments.map(segment => {
                                      if (segment.startTime === selectedSegment.startTime && 
                                          segment.endTime === selectedSegment.endTime) {
                                        return {
                                          ...segment,
                                          content: {
                                            ...segment.content,
                                            shadowBlur: newShadowBlur
                                          }
                                        };
                                      }
                                      return segment;
                                    });
                                    return { ...track, segments: updatedSegments };
                                  }
                                  return track;
                                });
                                return { ...prev, tracks: updatedTracks };
                              });
                            }}
                            className="bg-gray-800 border-gray-600 text-white"
                          />
                        </div>
                      </div>
                    </div>

                    {/* Text Outline */}
                    <div className="space-y-2">
                      <label className="text-xs text-gray-400">Text Outline</label>
                      <div className="grid grid-cols-2 gap-2">
                        <div>
                          <label className="text-xs text-gray-500">Outline Color</label>
                          <Input
                            type="color"
                            value={selectedSegment.strokeColor || '#000000'}
                            onChange={(e) => {
                              const newStrokeColor = e.target.value;
                              const updatedSegment = {
                                ...selectedSegment,
                                strokeColor: newStrokeColor
                              };
                              setSelectedSegment(updatedSegment);
                              
                              // Real-time preview update
                              setVideoComposition(prev => {
                                const updatedTracks = prev.tracks.map(track => {
                                  if (track.type === 'text') {
                                    const updatedSegments = track.segments.map(segment => {
                                      if (segment.startTime === selectedSegment.startTime && 
                                          segment.endTime === selectedSegment.endTime) {
                                        return {
                                          ...segment,
                                          content: {
                                            ...segment.content,
                                            strokeColor: newStrokeColor
                                          }
                                        };
                                      }
                                      return segment;
                                    });
                                    return { ...track, segments: updatedSegments };
                                  }
                                  return track;
                                });
                                return { ...prev, tracks: updatedTracks };
                              });
                            }}
                            className="bg-gray-800 border-gray-600 h-8"
                          />
                        </div>
                        <div>
                          <label className="text-xs text-gray-500">Outline Width</label>
                          <Input
                            type="number"
                            min="0"
                            max="10"
                            value={selectedSegment.strokeWidth || 0}
                            onChange={(e) => {
                              const newStrokeWidth = parseFloat(e.target.value) || 0;
                              const updatedSegment = {
                                ...selectedSegment,
                                strokeWidth: newStrokeWidth
                              };
                              setSelectedSegment(updatedSegment);
                              
                              // Real-time preview update
                              setVideoComposition(prev => {
                                const updatedTracks = prev.tracks.map(track => {
                                  if (track.type === 'text') {
                                    const updatedSegments = track.segments.map(segment => {
                                      if (segment.startTime === selectedSegment.startTime && 
                                          segment.endTime === selectedSegment.endTime) {
                                        return {
                                          ...segment,
                                          content: {
                                            ...segment.content,
                                            strokeWidth: newStrokeWidth
                                          }
                                        };
                                      }
                                      return segment;
                                    });
                                    return { ...track, segments: updatedSegments };
                                  }
                                  return track;
                                });
                                return { ...prev, tracks: updatedTracks };
                              });
                            }}
                            className="bg-gray-800 border-gray-600 text-white"
                          />
                        </div>
                      </div>
                    </div>

                    {/* Text Animation */}
                    <div className="space-y-2">
                      <label className="text-xs text-gray-400">Animation</label>
                      <select 
                        value={selectedSegment.animation || 'none'}
                        onChange={(e) => {
                          const newAnimation = e.target.value;
                          const updatedSegment = {
                            ...selectedSegment,
                            animation: newAnimation
                          };
                          setSelectedSegment(updatedSegment);
                          
                          // Real-time preview update
                          setVideoComposition(prev => {
                            const updatedTracks = prev.tracks.map(track => {
                              if (track.type === 'text') {
                                const updatedSegments = track.segments.map(segment => {
                                  if (segment.startTime === selectedSegment.startTime && 
                                      segment.endTime === selectedSegment.endTime) {
                                    return {
                                      ...segment,
                                      content: {
                                        ...segment.content,
                                        animation: newAnimation
                                      }
                                    };
                                  }
                                  return segment;
                                });
                                return { ...track, segments: updatedSegments };
                              }
                              return track;
                            });
                            return { ...prev, tracks: updatedTracks };
                          });
                        }}
                        className="w-full bg-gray-800 border border-gray-600 rounded px-3 py-2 text-sm text-white"
                      >
                        <option value="none">None</option>
                        <option value="fadeIn">Fade In</option>
                        <option value="slideUp">Slide Up</option>
                        <option value="slideDown">Slide Down</option>
                        <option value="slideLeft">Slide Left</option>
                        <option value="slideRight">Slide Right</option>
                        <option value="zoomIn">Zoom In</option>
                        <option value="zoomOut">Zoom Out</option>
                        <option value="bounceIn">Bounce In</option>
                        <option value="typewriter">Typewriter</option>
                        <option value="pulse">Pulse</option>
                        <option value="shake">Shake</option>
                        <option value="glow">Glow</option>
                      </select>
                    </div>

                    {/* Background */}
                    <div className="space-y-2">
                      <label className="text-xs text-gray-400">Background</label>
                      <div className="grid grid-cols-2 gap-2">
                        <div>
                          <label className="text-xs text-gray-500">Background Color</label>
                          <Input
                            type="color"
                            value={selectedSegment.backgroundColor || '#000000'}
                            onChange={(e) => {
                              const newBackgroundColor = e.target.value;
                              const updatedSegment = {
                                ...selectedSegment,
                                backgroundColor: newBackgroundColor
                              };
                              setSelectedSegment(updatedSegment);
                              
                              // Real-time preview update
                              setVideoComposition(prev => {
                                const updatedTracks = prev.tracks.map(track => {
                                  if (track.type === 'text') {
                                    const updatedSegments = track.segments.map(segment => {
                                      if (segment.startTime === selectedSegment.startTime && 
                                          segment.endTime === selectedSegment.endTime) {
                                        return {
                                          ...segment,
                                          content: {
                                            ...segment.content,
                                            backgroundColor: newBackgroundColor
                                          }
                                        };
                                      }
                                      return segment;
                                    });
                                    return { ...track, segments: updatedSegments };
                                  }
                                  return track;
                                });
                                return { ...prev, tracks: updatedTracks };
                              });
                            }}
                            className="bg-gray-800 border-gray-600 h-8"
                          />
                        </div>
                        <div>
                          <label className="text-xs text-gray-500">Background Opacity</label>
                          <Input
                            type="number"
                            min="0"
                            max="1"
                            step="0.1"
                            value={selectedSegment.backgroundOpacity || 0}
                            onChange={(e) => {
                              const newBackgroundOpacity = parseFloat(e.target.value) || 0;
                              const updatedSegment = {
                                ...selectedSegment,
                                backgroundOpacity: newBackgroundOpacity
                              };
                              setSelectedSegment(updatedSegment);
                              
                              // Real-time preview update
                              setVideoComposition(prev => {
                                const updatedTracks = prev.tracks.map(track => {
                                  if (track.type === 'text') {
                                    const updatedSegments = track.segments.map(segment => {
                                      if (segment.startTime === selectedSegment.startTime && 
                                          segment.endTime === selectedSegment.endTime) {
                                        return {
                                          ...segment,
                                          content: {
                                            ...segment.content,
                                            backgroundOpacity: newBackgroundOpacity
                                          }
                                        };
                                      }
                                      return segment;
                                    });
                                    return { ...track, segments: updatedSegments };
                                  }
                                  return track;
                                });
                                return { ...prev, tracks: updatedTracks };
                              });
                            }}
                            className="bg-gray-800 border-gray-600 text-white"
                          />
                        </div>
                      </div>
                    </div>

                    {/* Text Alignment */}
                    <div className="space-y-2">
                      <label className="text-xs text-gray-400">Text Alignment</label>
                      <select 
                        value={selectedSegment.textAlign || 'center'}
                        onChange={(e) => {
                          const newTextAlign = e.target.value;
                          const updatedSegment = {
                            ...selectedSegment,
                            textAlign: newTextAlign
                          };
                          setSelectedSegment(updatedSegment);
                          
                          // Real-time preview update
                          setVideoComposition(prev => {
                            const updatedTracks = prev.tracks.map(track => {
                              if (track.type === 'text') {
                                const updatedSegments = track.segments.map(segment => {
                                  if (segment.startTime === selectedSegment.startTime && 
                                      segment.endTime === selectedSegment.endTime) {
                                    return {
                                      ...segment,
                                      content: {
                                        ...segment.content,
                                        textAlign: newTextAlign
                                      }
                                    };
                                  }
                                  return segment;
                                });
                                return { ...track, segments: updatedSegments };
                              }
                              return track;
                            });
                            return { ...prev, tracks: updatedTracks };
                          });
                        }}
                        className="w-full bg-gray-800 border border-gray-600 rounded px-3 py-2 text-sm text-white"
                      >
                        <option value="left">Left</option>
                        <option value="center">Center</option>
                        <option value="right">Right</option>
                        <option value="justify">Justify</option>
                      </select>
                    </div>

                    {/* Letter Spacing & Line Height */}
                    <div className="grid grid-cols-2 gap-2">
                      <div>
                        <label className="text-xs text-gray-400">Letter Spacing</label>
                        <Input
                          type="number"
                          min="-5"
                          max="10"
                          step="0.1"
                          value={selectedSegment.letterSpacing || 0}
                          onChange={(e) => {
                            const newLetterSpacing = parseFloat(e.target.value) || 0;
                            const updatedSegment = {
                              ...selectedSegment,
                              letterSpacing: newLetterSpacing
                            };
                            setSelectedSegment(updatedSegment);
                            
                            // Real-time preview update
                            setVideoComposition(prev => {
                              const updatedTracks = prev.tracks.map(track => {
                                if (track.type === 'text') {
                                  const updatedSegments = track.segments.map(segment => {
                                    if (segment.startTime === selectedSegment.startTime && 
                                        segment.endTime === selectedSegment.endTime) {
                                      return {
                                        ...segment,
                                        content: {
                                          ...segment.content,
                                          letterSpacing: newLetterSpacing
                                        }
                                      };
                                    }
                                    return segment;
                                  });
                                  return { ...track, segments: updatedSegments };
                                }
                                return track;
                              });
                              return { ...prev, tracks: updatedTracks };
                            });
                          }}
                          className="bg-gray-800 border-gray-600 text-white"
                        />
                      </div>
                      <div>
                        <label className="text-xs text-gray-400">Line Height</label>
                        <Input
                          type="number"
                          min="0.5"
                          max="3"
                          step="0.1"
                          value={selectedSegment.lineHeight || 1.2}
                          onChange={(e) => {
                            const newLineHeight = parseFloat(e.target.value) || 1.2;
                            const updatedSegment = {
                              ...selectedSegment,
                              lineHeight: newLineHeight
                            };
                            setSelectedSegment(updatedSegment);
                            
                            // Real-time preview update
                            setVideoComposition(prev => {
                              const updatedTracks = prev.tracks.map(track => {
                                if (track.type === 'text') {
                                  const updatedSegments = track.segments.map(segment => {
                                    if (segment.startTime === selectedSegment.startTime && 
                                        segment.endTime === selectedSegment.endTime) {
                                      return {
                                        ...segment,
                                        content: {
                                          ...segment.content,
                                          lineHeight: newLineHeight
                                        }
                                      };
                                    }
                                    return segment;
                                  });
                                  return { ...track, segments: updatedSegments };
                                }
                                return track;
                              });
                              return { ...prev, tracks: updatedTracks };
                            });
                          }}
                          className="bg-gray-800 border-gray-600 text-white"
                        />
                      </div>
                    </div>
                  </div>
                  
                  {/* Action Buttons */}
                  <div className="space-y-2 pt-4">
                    <Button 
                      className="w-full bg-purple-600 hover:bg-purple-700"
                      onClick={() => {
                        // Apply changes to the video composition
                        setVideoComposition(prev => {
                          const updatedTracks = prev.tracks.map(track => {
                            if (track.type === 'text') {
                              const updatedSegments = track.segments.map(segment => {
                                if (segment.startTime === selectedSegment.startTime && 
                                    segment.endTime === selectedSegment.endTime) {
                                  return {
                                    ...segment,
                                    content: {
                                      text: selectedSegment.text,
                                      x: selectedSegment.x,
                                      y: selectedSegment.y,
                                      fontSize: selectedSegment.fontSize,
                                      color: selectedSegment.color,
                                      style: selectedSegment.style
                                    },
                                    startTime: selectedSegment.startTime,
                                    endTime: selectedSegment.endTime
                                  };
                                }
                                return segment;
                              });
                              return { ...track, segments: updatedSegments };
                            }
                            return track;
                          });
                          return { ...prev, tracks: updatedTracks };
                        });
                        
                        // Close drawer
                        setShowLeftDrawer(false);
                        setSelectedSegment(null);
                      }}
                    >
                      Apply Changes
                    </Button>
                    <Button 
                      variant="outline" 
                      className="w-full border-gray-600 text-gray-300 hover:bg-gray-800"
                      onClick={() => {
                        setShowLeftDrawer(false);
                        setSelectedSegment(null);
                      }}
                    >
                      Cancel
                    </Button>
                  </div>
                </div>
              ) : drawerMode === 'media' && selectedMediaSegment ? (
                <div className="space-y-6">
                  {/* Media Preview */}
                  <div className="space-y-3">
                    <label className="text-sm font-medium text-gray-300">Media Preview</label>
                    <div className="bg-gray-800 rounded-lg p-4 border border-gray-600">
                      <img 
                        src={selectedMediaSegment.content.url} 
                        alt={selectedMediaSegment.content.filename}
                        className="w-full h-32 object-cover rounded"
                      />
                      <p className="text-xs text-gray-400 mt-2">{selectedMediaSegment.content.filename}</p>
                    </div>
                  </div>

                  {/* Position & Scale */}
                  <div className="space-y-3">
                    <label className="text-sm font-medium text-gray-300 flex items-center gap-2">
                      <Move className="w-4 h-4" />
                      Position & Scale
                    </label>
                    <div className="grid grid-cols-3 gap-2">
                      <div>
                        <label className="text-xs text-gray-400">X (%)</label>
                        <Input
                          type="number"
                          min="0"
                          max="100"
                          value={selectedMediaSegment.content?.x || 50}
                          onChange={(e) => {
                            const newX = parseFloat(e.target.value);
                            if (selectedMediaSegment) {
                              setSelectedMediaSegment(prev => prev ? {
                                ...prev,
                                content: { ...(prev.content || {}), x: newX }
                              } : null);
                              updateMediaSegmentPreview(selectedMediaSegment.id, { x: newX });
                            }
                          }}
                          className="bg-gray-800 border-gray-600 text-white"
                        />
                      </div>
                      <div>
                        <label className="text-xs text-gray-400">Y (%)</label>
                        <Input
                          type="number"
                          min="0"
                          max="100"
                          value={selectedMediaSegment.content?.y || 50}
                          onChange={(e) => {
                            const newY = parseFloat(e.target.value);
                            if (selectedMediaSegment) {
                              setSelectedMediaSegment(prev => prev ? {
                                ...prev,
                                content: { ...(prev.content || {}), y: newY }
                              } : null);
                              updateMediaSegmentPreview(selectedMediaSegment.id, { y: newY });
                            }
                          }}
                          className="bg-gray-800 border-gray-600 text-white"
                        />
                      </div>
                      <div>
                        <label className="text-xs text-gray-400">Scale (%)</label>
                        <Input
                          type="number"
                          min="10"
                          max="200"
                          value={selectedMediaSegment.content?.scale || 100}
                          onChange={(e) => {
                            const newScale = parseFloat(e.target.value);
                            if (selectedMediaSegment) {
                              setSelectedMediaSegment(prev => prev ? {
                                ...prev,
                                content: { ...(prev.content || {}), scale: newScale }
                              } : null);
                              updateMediaSegmentPreview(selectedMediaSegment.id, { scale: newScale });
                            }
                          }}
                          className="bg-gray-800 border-gray-600 text-white"
                        />
                      </div>
                    </div>
                  </div>

                  {/* Rotation & Transform */}
                  <div className="space-y-3">
                    <label className="text-sm font-medium text-gray-300 flex items-center gap-2">
                      <RotateCw className="w-4 h-4" />
                      Rotation & Transform
                    </label>
                    <div className="space-y-2">
                      <div>
                        <label className="text-xs text-gray-400">Rotation (degrees)</label>
                        <Slider
                          value={[selectedMediaSegment.content?.rotation || 0]}
                          onValueChange={(value) => {
                            if (selectedMediaSegment) {
                              setSelectedMediaSegment(prev => prev ? {
                                ...prev,
                                content: { ...(prev.content || {}), rotation: value[0] }
                              } : null);
                              updateMediaSegmentPreview(selectedMediaSegment.id, { rotation: value[0] });
                            }
                          }}
                          min={-180}
                          max={180}
                          step={1}
                          className="w-full"
                        />
                        <span className="text-xs text-gray-500">{selectedMediaSegment.content?.rotation || 0}°</span>
                      </div>
                      <div className="grid grid-cols-2 gap-2">
                        <div>
                          <label className="text-xs text-gray-400">Skew X</label>
                          <Input
                            type="number"
                            min="-45"
                            max="45"
                            value={selectedMediaSegment.content?.skewX || 0}
                            onChange={(e) => {
                              const newSkewX = parseFloat(e.target.value) || 0;
                              if (selectedMediaSegment) {
                                setSelectedMediaSegment(prev => prev ? {
                                  ...prev,
                                  content: { ...(prev.content || {}), skewX: newSkewX }
                                } : null);
                                updateMediaSegmentPreview(selectedMediaSegment.id, { skewX: newSkewX });
                              }
                            }}
                            className="bg-gray-800 border-gray-600 text-white text-xs"
                          />
                        </div>
                        <div>
                          <label className="text-xs text-gray-400">Skew Y</label>
                          <Input
                            type="number"
                            min="-45"
                            max="45"
                            value={selectedMediaSegment.content?.skewY || 0}
                            onChange={(e) => {
                              const newSkewY = parseFloat(e.target.value) || 0;
                              if (selectedMediaSegment) {
                                setSelectedMediaSegment(prev => prev ? {
                                  ...prev,
                                  content: { ...(prev.content || {}), skewY: newSkewY }
                                } : null);
                                updateMediaSegmentPreview(selectedMediaSegment.id, { skewY: newSkewY });
                              }
                            }}
                            className="bg-gray-800 border-gray-600 text-white text-xs"
                          />
                        </div>
                      </div>
                    </div>
                  </div>

                  {/* Effects */}
                  <div className="space-y-3">
                    <label className="text-sm font-medium text-gray-300 flex items-center gap-2">
                      <Sparkles className="w-4 h-4" />
                      Effects
                    </label>
                    <div className="space-y-3">
                      <div>
                        <label className="text-xs text-gray-400 flex items-center gap-1">
                          <Zap className="w-3 h-3" />
                          Blur Intensity
                        </label>
                        <Slider
                          value={[selectedMediaSegment.content?.blur || 0]}
                          onValueChange={(value) => {
                            if (selectedMediaSegment) {
                              setSelectedMediaSegment(prev => prev ? {
                                ...prev,
                                content: { ...(prev.content || {}), blur: value[0] }
                              } : null);
                              updateMediaSegmentPreview(selectedMediaSegment.id, { blur: value[0] });
                            }
                          }}
                          min={0}
                          max={20}
                          step={0.5}
                          className="w-full"
                        />
                        <span className="text-xs text-gray-500">{selectedMediaSegment.content?.blur || 0}px</span>
                      </div>
                      <div>
                        <label className="text-xs text-gray-400">Opacity</label>
                        <Slider
                          value={[selectedMediaSegment.content?.opacity || 100]}
                          onValueChange={(value) => {
                            if (selectedMediaSegment) {
                              setSelectedMediaSegment(prev => prev ? {
                                ...prev,
                                content: { ...(prev.content || {}), opacity: value[0] }
                              } : null);
                              updateMediaSegmentPreview(selectedMediaSegment.id, { opacity: value[0] });
                            }
                          }}
                          min={0}
                          max={100}
                          step={1}
                          className="w-full"
                        />
                        <span className="text-xs text-gray-500">{selectedMediaSegment.content?.opacity || 100}%</span>
                      </div>
                      <div>
                        <label className="text-xs text-gray-400">Brightness</label>
                        <Slider
                          value={[selectedMediaSegment.content?.brightness || 100]}
                          onValueChange={(value) => {
                            if (selectedMediaSegment) {
                              setSelectedMediaSegment(prev => prev ? {
                                ...prev,
                                content: { ...(prev.content || {}), brightness: value[0] }
                              } : null);
                              updateMediaSegmentPreview(selectedMediaSegment.id, { brightness: value[0] });
                            }
                          }}
                          min={0}
                          max={200}
                          step={5}
                          className="w-full"
                        />
                        <span className="text-xs text-gray-500">{selectedMediaSegment.content?.brightness || 100}%</span>
                      </div>
                      <div>
                        <label className="text-xs text-gray-400">Contrast</label>
                        <Slider
                          value={[selectedMediaSegment.content?.contrast || 100]}
                          onValueChange={(value) => {
                            if (selectedMediaSegment) {
                              setSelectedMediaSegment(prev => prev ? {
                                ...prev,
                                content: { ...(prev.content || {}), contrast: value[0] }
                              } : null);
                              updateMediaSegmentPreview(selectedMediaSegment.id, { contrast: value[0] });
                            }
                          }}
                          min={0}
                          max={200}
                          step={5}
                          className="w-full"
                        />
                        <span className="text-xs text-gray-500">{selectedMediaSegment.content?.contrast || 100}%</span>
                      </div>
                    </div>
                  </div>

                  {/* Border & Frame */}
                  <div className="space-y-3">
                    <label className="text-sm font-medium text-gray-300 flex items-center gap-2">
                      <Frame className="w-4 h-4" />
                      Border & Frame
                    </label>
                    <div className="space-y-3">
                      <div>
                        <label className="text-xs text-gray-400">Border Width (px)</label>
                        <Slider
                          value={[selectedMediaSegment.content?.borderWidth || 0]}
                          onValueChange={(value) => {
                            if (selectedMediaSegment) {
                              setSelectedMediaSegment(prev => prev ? {
                                ...prev,
                                content: { ...(prev.content || {}), borderWidth: value[0] }
                              } : null);
                              updateMediaSegmentPreview(selectedMediaSegment.id, { borderWidth: value[0] });
                            }
                          }}
                          min={0}
                          max={20}
                          step={1}
                          className="w-full"
                        />
                        <span className="text-xs text-gray-500">{selectedMediaSegment.content?.borderWidth || 0}px</span>
                      </div>
                      <div>
                        <label className="text-xs text-gray-400">Border Color</label>
                        <Input
                          type="color"
                          value={selectedMediaSegment.content?.borderColor || "#ffffff"}
                          onChange={(e) => {
                            if (selectedMediaSegment) {
                              setSelectedMediaSegment(prev => prev ? {
                                ...prev,
                                content: { ...(prev.content || {}), borderColor: e.target.value }
                              } : null);
                              updateMediaSegmentPreview(selectedMediaSegment.id, { borderColor: e.target.value });
                            }
                          }}
                          className="w-full h-10 bg-gray-800 border-gray-600"
                        />
                      </div>
                      <div>
                        <label className="text-xs text-gray-400">Corner Radius (px)</label>
                        <Slider
                          value={[selectedMediaSegment.content?.borderRadius || 0]}
                          onValueChange={(value) => {
                            if (selectedMediaSegment) {
                              setSelectedMediaSegment(prev => prev ? {
                                ...prev,
                                content: { ...(prev.content || {}), borderRadius: value[0] }
                              } : null);
                              updateMediaSegmentPreview(selectedMediaSegment.id, { borderRadius: value[0] });
                            }
                          }}
                          min={0}
                          max={50}
                          step={1}
                          className="w-full"
                        />
                        <span className="text-xs text-gray-500">{selectedMediaSegment.content?.borderRadius || 0}px</span>
                      </div>
                    </div>
                  </div>

                  {/* Animation */}
                  <div className="space-y-3">
                    <label className="text-sm font-medium text-gray-300 flex items-center gap-2">
                      <Layers className="w-4 h-4" />
                      Animation
                    </label>
                    <div className="space-y-2">
                      <div>
                        <label className="text-xs text-gray-400">Entry Animation</label>
                        <select 
                          value={selectedMediaSegment.content?.entryAnimation || "none"}
                          onChange={(e) => {
                            if (selectedMediaSegment) {
                              setSelectedMediaSegment(prev => prev ? {
                                ...prev,
                                content: { ...(prev.content || {}), entryAnimation: e.target.value }
                              } : null);
                              updateMediaSegmentPreview(selectedMediaSegment.id, { entryAnimation: e.target.value });
                            }
                          }}
                          className="w-full bg-gray-800 border border-gray-600 rounded px-3 py-2 text-sm text-white"
                        >
                          <option value="none">None</option>
                          <option value="fade">Fade In</option>
                          <option value="slide-left">Slide from Left</option>
                          <option value="slide-right">Slide from Right</option>
                          <option value="slide-up">Slide from Bottom</option>
                          <option value="slide-down">Slide from Top</option>
                          <option value="zoom">Zoom In</option>
                          <option value="bounce">Bounce In</option>
                        </select>
                      </div>
                      <div>
                        <label className="text-xs text-gray-400">Exit Animation</label>
                        <select 
                          value={selectedMediaSegment.content?.exitAnimation || "none"}
                          onChange={(e) => {
                            if (selectedMediaSegment) {
                              setSelectedMediaSegment(prev => prev ? {
                                ...prev,
                                content: { ...(prev.content || {}), exitAnimation: e.target.value }
                              } : null);
                              updateMediaSegmentPreview(selectedMediaSegment.id, { exitAnimation: e.target.value });
                            }
                          }}
                          className="w-full bg-gray-800 border border-gray-600 rounded px-3 py-2 text-sm text-white"
                        >
                          <option value="none">None</option>
                          <option value="fade">Fade Out</option>
                          <option value="slide-left">Slide to Left</option>
                          <option value="slide-right">Slide to Right</option>
                          <option value="slide-up">Slide to Top</option>
                          <option value="slide-down">Slide to Bottom</option>
                          <option value="zoom">Zoom Out</option>
                        </select>
                      </div>
                      <div>
                        <label className="text-xs text-gray-400">Animation Duration (s)</label>
                        <Slider
                          value={[selectedMediaSegment.content?.animationDuration || 0.5]}
                          onValueChange={(value) => {
                            if (selectedMediaSegment) {
                              setSelectedMediaSegment(prev => prev ? {
                                ...prev,
                                content: { ...(prev.content || {}), animationDuration: value[0] }
                              } : null);
                              updateMediaSegmentPreview(selectedMediaSegment.id, { animationDuration: value[0] });
                            }
                          }}
                          min={0.1}
                          max={3}
                          step={0.1}
                          className="w-full"
                        />
                        <span className="text-xs text-gray-500">{selectedMediaSegment.content?.animationDuration || 0.5}s</span>
                      </div>
                    </div>
                  </div>

                  {/* Blend Mode */}
                  <div className="space-y-3">
                    <label className="text-sm font-medium text-gray-300 flex items-center gap-2">
                      <Palette className="w-4 h-4" />
                      Blend Mode
                    </label>
                    <select 
                      value={selectedMediaSegment.content?.blendMode || "normal"}
                      onChange={(e) => {
                        if (selectedMediaSegment) {
                          setSelectedMediaSegment(prev => prev ? {
                            ...prev,
                            content: { ...(prev.content || {}), blendMode: e.target.value }
                          } : null);
                          updateMediaSegmentPreview(selectedMediaSegment.id, { blendMode: e.target.value });
                        }
                      }}
                      className="w-full bg-gray-800 border border-gray-600 rounded px-3 py-2 text-sm text-white"
                    >
                      <option value="normal">Normal</option>
                      <option value="multiply">Multiply</option>
                      <option value="screen">Screen</option>
                      <option value="overlay">Overlay</option>
                      <option value="soft-light">Soft Light</option>
                      <option value="hard-light">Hard Light</option>
                      <option value="color-dodge">Color Dodge</option>
                      <option value="color-burn">Color Burn</option>
                      <option value="darken">Darken</option>
                      <option value="lighten">Lighten</option>
                    </select>
                  </div>

                  {/* Action Buttons */}
                  <div className="space-y-2 pt-4">
                    <Button 
                      className="w-full bg-gradient-to-r from-purple-600 to-violet-600 hover:from-purple-700 hover:to-violet-700 text-white"
                      onClick={() => {
                        // Apply changes logic for media segment
                        setShowLeftDrawer(false);
                        setSelectedMediaSegment(null);
                        setDrawerMode('text');
                      }}
                    >
                      Apply Changes
                    </Button>
                    <Button 
                      variant="outline" 
                      className="w-full border-gray-600 text-gray-300 hover:bg-gray-800"
                      onClick={() => {
                        setShowLeftDrawer(false);
                        setSelectedMediaSegment(null);
                        setDrawerMode('text');
                      }}
                    >
                      Cancel
                    </Button>
                  </div>
                </div>
              ) : (
                <div className="text-center text-gray-400 py-8">
                  {drawerMode === 'text' ? (
                    <>
                      <Type className="w-12 h-12 mx-auto mb-4 opacity-50" />
                      <p>Select a text segment to edit</p>
                    </>
                  ) : (
                    <>
                      <Image className="w-12 h-12 mx-auto mb-4 opacity-50" />
                      <p>Select a media segment to edit</p>
                    </>
                  )}
                </div>
              )}
            </ScrollArea>
          </div>
        )}
        
        {/* Main Content Area */}
        <div className="flex flex-col overflow-hidden">
          
          {/* Video Preview Section */}
          <div className="bg-slate-900/80 backdrop-blur-xl p-4 border-b border-purple-500/20 shadow-xl">
            <div className="flex items-center justify-between mb-4">
              <div className="flex items-center space-x-4">
                <h2 className="text-xl font-bold">Video Editor</h2>
                {(() => {
                  // Show segment info if a track with segments is selected
                  if (selectedVideoTrack) {
                    const track = videoComposition.tracks.find(t => t.id === selectedVideoTrack && t.type === 'video');
                    if (track?.segments && track.segments.length > 0) {
                      const segment = track.segments[0];
                      return (
                        <div className="flex items-center space-x-2 text-sm text-gray-400">
                          <Play className="w-4 h-4" />
                          <span className="truncate max-w-xs">{segment.content?.description || 'Video Segment'}</span>
                          <span>•</span>
                          <span>{formatTime(segment.startTime || 0)} - {formatTime(segment.endTime || 0)}</span>
                          <span>•</span>
                          <span>{formatTime((segment.endTime || 0) - (segment.startTime || 0))} duration</span>
                          <span className="px-2 py-1 bg-blue-600 text-blue-100 rounded text-xs">
                            Segment Playing
                          </span>
                        </div>
                      );
                    }
                  }
                  
                  // Show video info if main video is selected or no segments
                  return currentVideo ? (
                    <div className="flex items-center space-x-2 text-sm text-gray-400">
                      <Video className="w-4 h-4" />
                      <span>{(currentVideo.size / 1024 / 1024).toFixed(1)} MB</span>
                      {currentVideo.duration && (
                        <>
                          <span>•</span>
                          <span>{formatTime(currentVideo.duration)}</span>
                        </>
                      )}
                      <span className="px-2 py-1 bg-green-600 text-green-100 rounded text-xs">
                        Full Video
                      </span>
                    </div>
                  ) : (
                    <div className="flex items-center space-x-2 text-sm text-red-400">
                      <X className="w-4 h-4" />
                      <span>No active video tracks</span>
                    </div>
                  );
                })()}
              </div>
              
              <div className="flex items-center space-x-2">
                {/* Current Video Track Indicator */}
                {selectedVideoTrack && (
                  <div className="flex items-center space-x-2 px-3 py-1 bg-blue-100 dark:bg-blue-900/30 rounded-lg border border-blue-200 dark:border-blue-700">
                    <Play className="w-3 h-3 text-blue-600 dark:text-blue-400" />
                    <span className="text-xs font-medium text-blue-700 dark:text-blue-300">
                      Playing: {videoComposition.tracks.find(t => t.id === selectedVideoTrack)?.name || 'Unknown'}
                    </span>
                  </div>
                )}
                
                {/* Preview Mode Toggle */}
                <div className="flex items-center space-x-1">
                  <Button
                    variant={videoComposition.previewMode === 'original' ? 'default' : 'outline'}
                    size="sm"
                    onClick={() => setVideoComposition(prev => ({ ...prev, previewMode: 'original' }))}
                    className="text-xs"
                  >
                    Original
                  </Button>
                  <Button
                    variant={videoComposition.previewMode === 'composition' ? 'default' : 'outline'}
                    size="sm"
                    onClick={() => setVideoComposition(prev => ({ ...prev, previewMode: 'composition' }))}
                    className="text-xs"
                  >
                    Preview
                  </Button>
                </div>
                
                <Button
                  variant="outline"
                  size="sm"
                  onClick={() => setShowAiAgent(!showAiAgent)}
                  className="bg-gradient-to-r from-purple-600 to-indigo-600 hover:from-purple-700 hover:to-indigo-700 border-0 text-white"
                >
                  <Bot className="w-4 h-4" />
                </Button>
                

                <Button
                  variant="outline"
                  size="sm"
                  onClick={() => exportVideoMutation.mutate()}
                  disabled={!currentVideo || exportVideoMutation.isPending || videoComposition.tracks.length === 0}
                  className="bg-green-600 hover:bg-green-700 border-green-600 text-white"
                >
                  {exportVideoMutation.isPending ? (
                    <Loader className="w-4 h-4 animate-spin" />
                  ) : (
                    <Download className="w-4 h-4" />
                  )}
                </Button>
                
                {/* Download button for exported video */}
                {exportData && (
                  <Button
                    variant="outline"
                    size="sm"
                    onClick={() => {
                      // Create a proper download link that forces download
                      const downloadUrl = `/api/video/${exportData.filename}?download=true`;
                      const link = document.createElement('a');
                      link.href = downloadUrl;
                      link.download = exportData.filename;
                      link.setAttribute('target', '_blank');
                      document.body.appendChild(link);
                      link.click();
                      document.body.removeChild(link);
                      
                      toast({
                        title: "Download Started",
                        description: `Downloading ${exportData.filename}`,
                      });
                    }}
                    className="bg-blue-600 hover:bg-blue-700 border-blue-600 text-white"
                  >
                    <Download className="w-4 h-4 mr-2" />
                    Download Exported
                  </Button>
                )}
                
                <input
                  ref={fileInputRef}
                  type="file"
                  accept="video/*"
                  onChange={handleVideoUpload}
                  className="hidden"
                />
              </div>
            </div>

            {/* Video Player with Progressive Overlays */}
            {currentVideo ? (
              <div className="relative aspect-video bg-black rounded-lg overflow-hidden max-h-96 group">
                <video
                  ref={videoRef}
                  src={getCurrentVideoSource() || `/api/video/${currentVideo.filename}`}
                  className="w-full h-full object-contain"
                  controls={false}
                  onTimeUpdate={handleVideoTimeUpdate}
                  onLoadedMetadata={() => {
                    if (videoRef.current) {
                      console.log(`🎬 Video metadata loaded: ${videoRef.current.src}`);
                      setVideoComposition(prev => ({
                        ...prev,
                        totalDuration: videoRef.current?.duration || 60
                      }));
                    }
                  }}
                  onError={(error) => {
                    console.error(`❌ Video player error:`, error);
                  }}
                  onLoadStart={() => {
                    console.log(`🔄 Video loading started: ${videoRef.current?.src}`);
                  }}
                  onCanPlay={() => {
                    console.log(`✅ Video can play: ${videoRef.current?.src}`);
                  }}
                  style={{
                    opacity: videoComposition.previewMode === 'composition' 
                      ? (isVideoVisibleAtTime(videoComposition.currentTime) ? 1 : 0.3)
                      : 1
                  }}
                />
                
                {/* Search Icon Overlay - Top Right Corner */}
                <div className="absolute top-3 right-3 z-30">
                  <Button
                    variant="secondary"
                    size="sm"
                    onClick={() => {
                      setShowSearchInput(true);
                      setShowAiAgent(true);
                    }}
                    className="w-10 h-10 rounded-full bg-black/60 hover:bg-black/80 border border-white/20 backdrop-blur-sm transition-all duration-200 opacity-80 group-hover:opacity-100 hover:scale-110 shadow-lg"
                    title="Search video content with AI"
                  >
                    <Search className="w-4 h-4 text-white" />
                  </Button>
                </div>
                
                {/* Animated Subtitles Overlay */}
                {videoComposition.previewMode === 'composition' && videoComposition.tracks
                  .filter(track => track.type === 'text' && track.isVisible)
                  .flatMap(track => track.segments)
                  .filter(segment => 
                    segment.type === 'animated_subtitle' && 
                    videoComposition.currentTime >= segment.startTime && 
                    videoComposition.currentTime <= segment.endTime &&
                    segment.content?.animatedData
                  )
                  .map((segment, index) => {
                    const animatedData = segment.content.animatedData;
                    
                    return (
                      <div
                        key={`animated-subtitle-${segment.id}-${index}`}
                        className="absolute inset-x-0 bottom-20 flex justify-center pointer-events-none"
                        style={{ zIndex: 30 + index }}
                      >
                        <AnimatedSubtitle
                          id={animatedData.id}
                          startTime={animatedData.startTime}
                          endTime={animatedData.endTime}
                          text={animatedData.text}
                          words={animatedData.words}
                          containerAnimation={animatedData.containerAnimation}
                          style={animatedData.style}
                          timing={animatedData.timing}
                          currentTime={videoComposition.currentTime}
                          preset={segment.content.preset || 'dynamic'}
                          onAnimationComplete={() => {
                            console.log(`🎬 Animated subtitle ${animatedData.id} completed`);
                          }}
                        />
                      </div>
                    );
                  })}

                {/* Progressive Text Overlays - Only show in Preview mode */}
                {videoComposition.previewMode === 'composition' && getActiveTextOverlaysAtTime(videoComposition.currentTime).map((overlay, index) => {
                  // Create comprehensive style object with all advanced properties
                  const overlayStyle: React.CSSProperties = {
                    left: `${overlay.x}%`,
                    top: `${overlay.y}%`,
                    fontSize: `${overlay.fontSize}px`,
                    color: overlay.color,
                    fontWeight: overlay.style === 'bold' ? 'bold' : 'normal',
                    transform: 'translate(-50%, -50%)',
                    zIndex: 10,
                    
                    // Advanced typography
                    fontFamily: overlay.fontFamily || 'system-ui, -apple-system, sans-serif',
                    fontStyle: overlay.fontStyle || 'normal',
                    textAlign: overlay.textAlign as any || 'center',
                    letterSpacing: overlay.letterSpacing ? `${overlay.letterSpacing}px` : 'normal',
                    lineHeight: overlay.lineHeight || 1.2,
                    
                    // Text shadow with customizable properties
                    textShadow: overlay.shadowColor && overlay.shadowBlur 
                      ? `0 0 ${overlay.shadowBlur}px ${overlay.shadowColor}` 
                      : '2px 2px 4px rgba(0,0,0,0.8)',
                    
                    // Text outline/stroke
                    WebkitTextStroke: overlay.strokeWidth && overlay.strokeColor 
                      ? `${overlay.strokeWidth}px ${overlay.strokeColor}` 
                      : undefined,
                    
                    // Background with opacity
                    backgroundColor: overlay.backgroundColor 
                      ? overlay.backgroundOpacity 
                        ? `${overlay.backgroundColor}${Math.round((overlay.backgroundOpacity / 100) * 255).toString(16).padStart(2, '0')}` 
                        : overlay.backgroundColor
                      : undefined,
                    
                    // Padding for background
                    padding: overlay.backgroundColor ? '8px 16px' : undefined,
                    borderRadius: overlay.backgroundColor ? '8px' : undefined,
                    
                    // Max width for text wrapping
                    maxWidth: '80%',
                    wordWrap: 'break-word'
                  };

                  // Animation classes based on animation type
                  let animationClass = '';
                  switch (overlay.animation) {
                    case 'fade_in':
                    case 'fadeIn':
                      animationClass = 'animate-fade-in';
                      break;
                    case 'slide_up':
                    case 'slideUp':
                      animationClass = 'animate-slide-up';
                      break;
                    case 'slide_left':
                    case 'slideLeft':
                      animationClass = 'animate-slide-left';
                      break;
                    case 'slide_right':
                    case 'slideRight':
                      animationClass = 'animate-slide-right';
                      break;
                    case 'slide_down':
                    case 'slideDown':
                      animationClass = 'animate-slide-down';
                      break;
                    case 'zoom_in':
                    case 'zoomIn':
                      animationClass = 'animate-zoom-in';
                      break;
                    case 'bounce_in':
                    case 'bounceIn':
                      animationClass = 'animate-bounce-in';
                      break;
                    default:
                      animationClass = 'animate-fade-in';
                  }

                  return (
                    <div
                      key={index}
                      className={`absolute pointer-events-none ${animationClass}`}
                      style={overlayStyle}
                    >
                      {overlay.text}
                    </div>
                  );
                })}

                {/* Word Highlighting Captions - Only show in Preview mode */}
                {videoComposition.previewMode === 'composition' && 
                  videoComposition.tracks
                    .filter(track => track.type === 'text' && track.visible)
                    .map(track => 
                      track.segments
                        .filter(segment => segment.visible && segment.content?.words && segment.content?.highlightWords)
                        .map((segment, segmentIndex) => (
                          <WordHighlightCaption
                            key={`word-highlight-${track.id}-${segmentIndex}`}
                            segment={segment.content}
                            currentTime={videoComposition.currentTime}
                            isVisible={true}
                          />
                        ))
                    ).flat()
                }

                {/* Progressive Media Overlays - Only show in Preview mode */}
                {videoComposition.previewMode === 'composition' && getActiveMediaOverlaysAtTime(videoComposition.currentTime).map((mediaSegment, index) => {
                  const scale = (mediaSegment.content?.scale || 100) / 100;
                  const baseSize = 200; // Base size in pixels
                  const scaledSize = baseSize * scale;
                  
                  // Create comprehensive filter string for all visual effects
                  const filterEffects = [
                    `blur(${mediaSegment.content?.blur || 0}px)`,
                    `opacity(${(mediaSegment.content?.opacity || 100) / 100})`,
                    `brightness(${(mediaSegment.content?.brightness || 100) / 100})`,
                    `contrast(${(mediaSegment.content?.contrast || 100) / 100})`,
                    `saturate(${(mediaSegment.content?.saturation || 100) / 100})`
                  ].join(' ');

                  // Generate animation classes based on settings
                  const animationClasses: string[] = [];
                  if (mediaSegment.content?.entryAnimation && mediaSegment.content?.entryAnimation !== 'none') {
                    const animationMap: Record<string, string> = {
                      'fade': 'animate-fade-in',
                      'slide-left': 'animate-slide-in-left',
                      'slide-right': 'animate-slide-in-right', 
                      'slide-up': 'animate-slide-in-up',
                      'slide-down': 'animate-slide-in-down',
                      'zoom': 'animate-zoom-in',
                      'bounce': 'animate-bounce-in'
                    };
                    const animationClass = animationMap[mediaSegment.content.entryAnimation as string];
                    if (animationClass) {
                      animationClasses.push(animationClass);
                    }
                  }
                  
                  return (
                    <div
                      key={`media-${mediaSegment.id}-${mediaSegment.content?.scale || 100}-${mediaSegment.content?.x || 50}-${mediaSegment.content?.y || 50}`}
                      className={`absolute pointer-events-none ${animationClasses.join(' ')}`}
                      style={{
                        left: `${mediaSegment.content?.x || 50}%`,
                        top: `${mediaSegment.content?.y || 50}%`,
                        width: `${scaledSize}px`,
                        height: `${scaledSize}px`,
                        transform: 'translate(-50%, -50%)',
                        zIndex: 5,
                        filter: filterEffects,
                        borderRadius: `${mediaSegment.content?.borderRadius || 8}px`,
                        border: mediaSegment.content?.borderWidth > 0 ? `${mediaSegment.content?.borderWidth}px solid ${mediaSegment.content?.borderColor || '#ffffff'}` : 'none',
                        boxShadow: mediaSegment.content?.shadowBlur > 0 ? `0 0 ${mediaSegment.content?.shadowBlur}px ${mediaSegment.content?.shadowColor || '#000000'}` : 'none',
                        animationDuration: `${mediaSegment.content?.animationDuration || 0.5}s`
                      }}
                    >
                    {mediaSegment.content?.mediaType === 'image' ? (
                      <img
                        src={mediaSegment.content?.url || `/api/media/${mediaSegment.content?.filename}`}
                        alt={mediaSegment.content?.prompt || 'Generated media'}
                        className="w-full h-full object-contain"
                        style={{
                          transform: `rotate(${mediaSegment.content?.rotation || 0}deg)`,
                          mixBlendMode: mediaSegment.content?.blendMode || 'normal',
                          borderRadius: `${mediaSegment.content?.borderRadius || 8}px`
                        }}
                      />
                    ) : mediaSegment.content?.mediaType === 'video' ? (
                      <video
                        src={mediaSegment.content?.url || `/api/media/${mediaSegment.content?.filename}`}
                        className="w-full h-full object-contain"
                        autoPlay
                        muted
                        loop
                        style={{
                          transform: `rotate(${mediaSegment.content?.rotation || 0}deg)`,
                          mixBlendMode: mediaSegment.content?.blendMode || 'normal',
                          borderRadius: `${mediaSegment.content?.borderRadius || 8}px`
                        }}
                      />
                    ) : null}
                  </div>
                  )
                })}
                
                {/* Cut Segment Indicators - Only show in Preview mode */}
                {videoComposition.previewMode === 'composition' && !isVideoVisibleAtTime(videoComposition.currentTime) && (
                  <div className="absolute inset-0 bg-black/70 flex items-center justify-center z-5">
                    <div className="text-white text-center">
                      <X className="w-8 h-8 mx-auto mb-2" />
                      <p className="text-sm">Video cut at this time</p>
                      <p className="text-xs text-gray-400">
                        {formatTime(videoComposition.currentTime)}
                      </p>
                    </div>
                  </div>
                )}
                
                {/* Active Segments Indicator - Only show in Preview mode */}
                {videoComposition.previewMode === 'composition' && getActiveSegmentsAtTime(videoComposition.currentTime).length > 0 && (
                  <div className="absolute top-2 left-2 z-20">
                    <div className="bg-blue-600/80 text-white px-2 py-1 rounded text-xs">
                      {getActiveSegmentsAtTime(videoComposition.currentTime).length} active segment(s)
                    </div>
                  </div>
                )}
                
                {/* Timeline Position Indicator */}
                <div className="absolute bottom-1 left-0 right-0 h-1 bg-gray-700/50 z-20">
                  <div 
                    className="h-full bg-red-500 transition-all duration-100"
                    style={{
                      width: `${(videoComposition.currentTime / videoComposition.totalDuration) * 100}%`
                    }}
                  />
                </div>
              </div>
            ) : (
              <div 
                className="aspect-video bg-gray-700 rounded-lg border-2 border-dashed border-gray-500 flex items-center justify-center max-h-96 cursor-pointer hover:bg-gray-600 hover:border-gray-400 transition-colors"
                onClick={() => document.getElementById('video-file-input')?.click()}
              >
                <div className="text-center">
                  <Upload className="w-12 h-12 mx-auto mb-4 text-gray-400" />
                  <p className="text-gray-400">Click here to upload a video</p>
                  <p className="text-xs text-gray-500 mt-2">MP4, MOV, AVI up to 500MB</p>
                </div>
                <input
                  id="video-file-input"
                  type="file"
                  accept="video/*"
                  className="hidden"
                  onChange={handleVideoUpload}
                />
              </div>
            )}

            {/* Playback Controls */}
            {currentVideo && (
              <div className="flex items-center justify-center space-x-4 mt-4">
                <Button
                  variant="ghost"
                  size="sm"
                  onClick={togglePlayback}
                  className="bg-white/10 hover:bg-white/20"
                >
                  {videoComposition.isPlaying ? (
                    <Pause className="w-5 h-5" />
                  ) : (
                    <Play className="w-5 h-5" />
                  )}
                </Button>
                
                <div className="text-sm text-gray-400">
                  {formatTime(videoComposition.currentTime)} / {formatTime(videoComposition.totalDuration)}
                </div>
              </div>
            )}
          </div>

          {/* Timeline Section */}
          <div className="h-full flex flex-col bg-gradient-to-br from-slate-950 via-purple-950/20 to-slate-950 backdrop-blur-xl overflow-hidden shadow-inner relative">
            {/* Animated Background Orbs */}
            <div className="absolute inset-0 pointer-events-none overflow-hidden">
              <div className="absolute top-10 left-10 w-32 h-32 bg-cyan-500/10 rounded-full blur-xl animate-pulse" style={{ animationDelay: '0s', animationDuration: '4s' }}></div>
              <div className="absolute top-1/3 right-20 w-24 h-24 bg-purple-500/10 rounded-full blur-xl animate-pulse" style={{ animationDelay: '1s', animationDuration: '3s' }}></div>
              <div className="absolute bottom-20 left-1/3 w-28 h-28 bg-pink-500/10 rounded-full blur-xl animate-pulse" style={{ animationDelay: '2s', animationDuration: '5s' }}></div>
            </div>
            
            {/* Timeline Controls */}
            <div className="bg-slate-900/70 backdrop-blur-xl p-3 border-b border-purple-500/30 flex items-center justify-between shadow-lg relative z-10">
              <div className="flex items-center space-x-4">
                <span className="text-sm font-medium">Timeline</span>
                <div className="flex items-center space-x-2">
                  <span className="text-xs text-gray-400">Zoom:</span>
                  <Button
                    variant="ghost"
                    size="sm"
                    onClick={() => {
                      const newZoom = Math.max(0.25, videoComposition.timelineZoom - 0.25);
                      setVideoComposition(prev => ({ ...prev, timelineZoom: newZoom }));
                    }}
                    className="h-6 w-6 p-0 text-slate-400 hover:text-white hover:bg-purple-800/50"
                    disabled={videoComposition.timelineZoom <= 0.25}
                  >
                    <ZoomOut className="w-3 h-3" />
                  </Button>
                  
                  <div className="text-xs text-slate-300 min-w-[40px] text-center">
                    {Math.round(videoComposition.timelineZoom * 100)}%
                  </div>
                  
                  <Button
                    variant="outline"
                    size="sm"
                    onClick={() => {
                      const newZoom = Math.min(4, videoComposition.timelineZoom + 0.25);
                      setVideoComposition(prev => ({ ...prev, timelineZoom: newZoom }));
                    }}
                    className="h-8 w-8 p-0 bg-slate-800/50 border-purple-500/30 text-purple-400 hover:text-white hover:bg-purple-600/50 hover:border-purple-400"
                    disabled={videoComposition.timelineZoom >= 4}
                    title="Zoom In Timeline"
                  >
                    <ZoomIn className="w-4 h-4" />
                  </Button>
                  
                  <Button
                    variant="outline"
                    size="sm"
                    onClick={() => {
                      const newZoom = Math.max(0.25, videoComposition.timelineZoom - 0.25);
                      setVideoComposition(prev => ({ ...prev, timelineZoom: newZoom }));
                    }}
                    className="h-8 w-8 p-0 bg-slate-800/50 border-purple-500/30 text-purple-400 hover:text-white hover:bg-purple-600/50 hover:border-purple-400"
                    disabled={videoComposition.timelineZoom <= 0.25}
                    title="Zoom Out Timeline"
                  >
                    <ZoomOut className="w-4 h-4" />
                  </Button>
                  
                  <Button
                    variant="outline"
                    size="sm"
                    onClick={() => {
                      setVideoComposition(prev => ({ ...prev, timelineZoom: 1, timelineScrollPosition: 0 }));
                    }}
                    className="h-8 w-8 p-0 bg-slate-800/50 border-purple-500/30 text-purple-400 hover:text-white hover:bg-purple-600/50 hover:border-purple-400"
                    title="Reset zoom to 100%"
                  >
                    <RotateCcw className="w-4 h-4" />
                  </Button>
                </div>
              </div>
              
              <div className="flex items-center space-x-2">
                <Button variant="ghost" size="sm" onClick={createNewVideoTrack}>
                  <Plus className="w-4 h-4 mr-1" />
                  Video
                </Button>
                <Button variant="ghost" size="sm" onClick={createNewAudioTrack}>
                  <Plus className="w-4 h-4 mr-1" />
                  Audio
                </Button>
                <Button variant="ghost" size="sm" onClick={createNewTextTrack}>
                  <Plus className="w-4 h-4 mr-1" />
                  Text
                </Button>
                <Button variant="ghost" size="sm" onClick={createNewMediaTrack}>
                  <Plus className="w-4 h-4 mr-1" />
                  Media
                </Button>
                
                {/* Delete Drop Zone */}
                {draggedTrack && (
                  <div
                    className={`ml-4 px-3 py-2 rounded border-2 border-dashed transition-colors ${
                      dropZone === 'delete' 
                        ? 'border-red-500 bg-red-500/20 text-red-400' 
                        : 'border-red-400 bg-red-400/10 text-red-400'
                    }`}
                    onDragOver={handleDeleteZoneDragOver}
                    onDragLeave={handleDeleteZoneDragLeave}
                    onDrop={handleDeleteZoneDrop}
                  >
                    <div className="flex items-center space-x-2">
                      <Trash2 className="w-4 h-4" />
                      <span className="text-sm font-medium">Drop to Delete</span>
                    </div>
                  </div>
                )}
              </div>
            </div>

            {/* Timeline Workspace */}
            <div className="flex-1 flex overflow-hidden h-full">
              
              {/* Track Headers */}
              <div className="w-48 bg-slate-900/80 backdrop-blur-xl border-r border-purple-500/30 overflow-y-auto text-white relative z-10 h-full" style={{ minWidth: '200px' }}>
                
                {/* Video Tracks */}
                <div className="border-b border-purple-500/20">
                  <div 
                    className="flex items-center justify-between p-3 bg-gradient-to-r from-cyan-900/30 to-purple-900/30 backdrop-blur-sm cursor-pointer hover:from-cyan-800/40 hover:to-purple-800/40 transition-all duration-300"
                    onClick={() => toggleTrackCategory('video')}
                  >
                    <span className="font-medium text-cyan-300">Video Tracks</span>
                    <div className="flex items-center space-x-2">
                      <Badge variant="secondary" className="text-xs">
                        {getTracksByCategory('video').length}
                      </Badge>
                      {videoComposition.trackCategories.video.expanded ? (
                        <ChevronDown className="w-4 h-4" />
                      ) : (
                        <ChevronRight className="w-4 h-4" />
                      )}
                    </div>
                  </div>
                  
                  {videoComposition.trackCategories.video.expanded && getTracksByCategory('video').map(track => (
                    <div 
                      key={track.id} 
                      className={`group p-3 border-b border-purple-500/10 bg-slate-800/30 backdrop-blur-sm hover:bg-slate-700/40 cursor-move min-h-[60px] transition-all duration-300 ${
                        draggedTrack === track.id ? 'opacity-50' : ''
                      }`}
                      draggable={!track.locked}
                      onDragStart={(e) => handleTrackDragStart(e, track.id)}
                      onDragEnd={handleTrackDragEnd}
                    >
                      <div className="flex items-center justify-between w-full">
                        <div className="flex-1 min-w-0">
                          <div className="text-white font-medium text-sm">{track.name}</div>
                          {track.videoFile && (
                            <div className="text-xs text-gray-400 truncate mt-1">
                              {track.videoFile.originalName.substring(0, 20)}...
                            </div>
                          )}
                        </div>
                        
                        <div className="flex items-center gap-1 ml-2 opacity-0 group-hover:opacity-100 transition-opacity duration-200">
                          {/* Play/Select Video Track Button */}
                          {(track.videoFile || track.segments.length > 0) && (
                            <button
                              onClick={() => selectVideoTrack(track.id)}
                              className={`p-1.5 border backdrop-blur-sm rounded text-white transition-all duration-300 ${
                                selectedVideoTrack === track.id 
                                  ? 'bg-cyan-500/30 border-cyan-400/50 hover:bg-cyan-500/40 shadow-cyan-500/20 shadow-lg' 
                                  : 'bg-slate-800/50 border-purple-500/30 hover:bg-slate-700/60 hover:border-purple-400/50'
                              }`}
                              title={selectedVideoTrack === track.id ? "Currently selected" : "Play this track"}
                            >
                              <Play className="w-3 h-3" />
                            </button>
                          )}
                          
                          <button
                            onClick={() => toggleTrackVisibility(track.id)}
                            className="p-1.5 bg-slate-800/50 hover:bg-slate-700/60 border border-purple-500/30 hover:border-purple-400/50 backdrop-blur-sm rounded text-white transition-all duration-300"
                            title={track.visible ? "Hide track" : "Show track"}
                          >
                            {track.visible ? <Eye className="w-3 h-3" /> : <EyeOff className="w-3 h-3" />}
                          </button>
                          
                          <button
                            onClick={() => toggleTrackMute(track.id)}
                            className="p-1.5 bg-slate-800/50 hover:bg-slate-700/60 border border-purple-500/30 hover:border-purple-400/50 backdrop-blur-sm rounded text-white transition-all duration-300"
                            title={track.muted ? "Unmute track" : "Mute track"}
                          >
                            {track.muted ? <VolumeX className="w-3 h-3" /> : <Volume2 className="w-3 h-3" />}
                          </button>
                          
                          <button
                            onClick={() => toggleTrackLock(track.id)}
                            className="p-1.5 bg-slate-800/50 hover:bg-slate-700/60 border border-purple-500/30 hover:border-purple-400/50 backdrop-blur-sm rounded text-white transition-all duration-300"
                            title={track.locked ? "Unlock track" : "Lock track"}
                          >
                            {track.locked ? <Lock className="w-3 h-3" /> : <Unlock className="w-3 h-3" />}
                          </button>
                          
                          <button
                            onClick={() => deleteTrack(track.id)}
                            className="p-1.5 bg-red-900/50 hover:bg-red-800/60 border border-red-500/40 hover:border-red-400/60 backdrop-blur-sm rounded text-white transition-all duration-300 shadow-red-500/10 hover:shadow-red-500/20 hover:shadow-lg"
                            title="Delete track"
                          >
                            <Trash2 className="w-3 h-3" />
                          </button>
                        </div>
                      </div>
                    </div>
                  ))}
                </div>

                {/* Audio Tracks */}
                <div className="border-b border-gray-700">
                  <div 
                    className="flex items-center justify-between p-3 bg-gray-700 cursor-pointer hover:bg-gray-600"
                    onClick={() => toggleTrackCategory('audio')}
                  >
                    <span className="font-medium text-green-400">Audio Tracks</span>
                    <div className="flex items-center space-x-2">
                      <Badge variant="secondary" className="text-xs">
                        {getTracksByCategory('audio').length}
                      </Badge>
                      {videoComposition.trackCategories.audio.expanded ? (
                        <ChevronDown className="w-4 h-4" />
                      ) : (
                        <ChevronRight className="w-4 h-4" />
                      )}
                    </div>
                  </div>
                  
                  {videoComposition.trackCategories.audio.expanded && getTracksByCategory('audio').map(track => (
                    <div 
                      key={track.id} 
                      className={`group flex items-center justify-between p-2 border-b border-gray-700 hover:bg-gray-750 cursor-move ${
                        draggedTrack === track.id ? 'opacity-50' : ''
                      }`}
                      draggable={!track.locked}
                      onDragStart={(e) => handleTrackDragStart(e, track.id)}
                      onDragEnd={handleTrackDragEnd}
                    >
                      <span className="font-medium text-sm text-white">{track.name}</span>
                      <div className="flex items-center space-x-1 opacity-0 group-hover:opacity-100 transition-opacity duration-200">
                        {/* Play button for video tracks */}
                        {track.type === 'video' && (
                          <Button
                            variant="ghost"
                            size="sm"
                            onClick={() => setSelectedVideoTrack(selectedVideoTrack === track.id ? null : track.id)}
                            className={`p-1 h-6 w-6 ${
                              selectedVideoTrack === track.id 
                                ? 'text-blue-400 hover:text-blue-300' 
                                : 'text-white hover:text-gray-300'
                            }`}
                            title={selectedVideoTrack === track.id ? "Currently playing" : "Play this track"}
                          >
                            <Play className="w-3 h-3" />
                          </Button>
                        )}
                        
                        <Button
                          variant="ghost"
                          size="sm"
                          onClick={() => toggleTrackVisibility(track.id)}
                          className="p-1 h-6 w-6 text-white hover:text-gray-300"
                          title={track.visible ? "Hide track" : "Show track"}
                        >
                          {track.visible ? <Eye className="w-3 h-3" /> : <EyeOff className="w-3 h-3" />}
                        </Button>
                        
                        <Button
                          variant="ghost"
                          size="sm"
                          onClick={() => toggleTrackMute(track.id)}
                          className="p-1 h-6 w-6 text-white hover:text-gray-300"
                          title={track.muted ? "Unmute track" : "Mute track"}
                        >
                          {track.muted ? <VolumeX className="w-3 h-3" /> : <Volume2 className="w-3 h-3" />}
                        </Button>
                        
                        <Button
                          variant="ghost"
                          size="sm"
                          onClick={() => toggleTrackLock(track.id)}
                          className="p-1 h-6 w-6 text-white hover:text-gray-300"
                          title={track.locked ? "Unlock track" : "Lock track"}
                        >
                          {track.locked ? <Lock className="w-3 h-3" /> : <Unlock className="w-3 h-3" />}
                        </Button>
                        
                        <Button
                          variant="ghost"
                          size="sm"
                          onClick={() => deleteTrack(track.id)}
                          className="p-1 h-6 w-6 text-red-400 hover:text-red-300"
                          title="Delete track"
                        >
                          <Trash2 className="w-3 h-3" />
                        </Button>
                      </div>
                    </div>
                  ))}
                </div>

                {/* Text Tracks */}
                <div className="border-b border-gray-700">
                  <div 
                    className="flex items-center justify-between p-3 bg-gray-700 cursor-pointer hover:bg-gray-600"
                    onClick={() => toggleTrackCategory('text')}
                  >
                    <span className="font-medium text-yellow-400">Text Tracks</span>
                    <div className="flex items-center space-x-2">
                      <Badge variant="secondary" className="text-xs">
                        {getTracksByCategory('text').length}
                      </Badge>
                      {videoComposition.trackCategories.text.expanded ? (
                        <ChevronDown className="w-4 h-4" />
                      ) : (
                        <ChevronRight className="w-4 h-4" />
                      )}
                    </div>
                  </div>
                  
                  {videoComposition.trackCategories.text.expanded && getTracksByCategory('text').map(track => (
                    <div 
                      key={track.id} 
                      className={`group flex items-center justify-between p-2 border-b border-gray-700 hover:bg-gray-750 cursor-move ${
                        draggedTrack === track.id ? 'opacity-50' : ''
                      }`}
                      draggable={!track.locked}
                      onDragStart={(e) => handleTrackDragStart(e, track.id)}
                      onDragEnd={handleTrackDragEnd}
                    >
                      <span className="font-medium text-sm text-white">{track.name}</span>
                      <div className="flex items-center space-x-1 opacity-0 group-hover:opacity-100 transition-opacity duration-200">
                        <Button
                          variant="ghost"
                          size="sm"
                          onClick={() => toggleTrackVisibility(track.id)}
                          className="p-1 h-6 w-6 text-white hover:text-gray-300"
                          title={track.visible ? "Hide track" : "Show track"}
                        >
                          {track.visible ? <Eye className="w-3 h-3" /> : <EyeOff className="w-3 h-3" />}
                        </Button>
                        
                        <Button
                          variant="ghost"
                          size="sm"
                          onClick={() => toggleTrackMute(track.id)}
                          className="p-1 h-6 w-6 text-white hover:text-gray-300"
                          title={track.muted ? "Unmute track" : "Mute track"}
                        >
                          {track.muted ? <VolumeX className="w-3 h-3" /> : <Volume2 className="w-3 h-3" />}
                        </Button>
                        
                        <Button
                          variant="ghost"
                          size="sm"
                          onClick={() => toggleTrackLock(track.id)}
                          className="p-1 h-6 w-6 text-white hover:text-gray-300"
                          title={track.locked ? "Unlock track" : "Lock track"}
                        >
                          {track.locked ? <Lock className="w-3 h-3" /> : <Unlock className="w-3 h-3" />}
                        </Button>
                        
                        <Button
                          variant="ghost"
                          size="sm"
                          onClick={() => deleteTrack(track.id)}
                          className="p-1 h-6 w-6 text-red-400 hover:text-red-300"
                          title="Delete track"
                        >
                          <Trash2 className="w-3 h-3" />
                        </Button>
                      </div>
                    </div>
                  ))}
                </div>

                {/* Media Tracks */}
                <div className="border-b border-purple-500/20">
                  <div 
                    className="flex items-center justify-between p-3 bg-gradient-to-r from-purple-900/30 to-pink-900/30 backdrop-blur-sm cursor-pointer hover:from-purple-800/40 hover:to-pink-800/40 transition-all duration-300"
                    onClick={() => toggleTrackCategory('media')}
                  >
                    <span className="font-medium text-purple-300">Media Tracks</span>
                    <div className="flex items-center space-x-2">
                      <Badge variant="secondary" className="text-xs">
                        {getTracksByCategory('media').length}
                      </Badge>
                      {videoComposition.trackCategories.media.expanded ? (
                        <ChevronDown className="w-4 h-4" />
                      ) : (
                        <ChevronRight className="w-4 h-4" />
                      )}
                    </div>
                  </div>
                  
                  {videoComposition.trackCategories.media.expanded && getTracksByCategory('media').map(track => (
                    <div 
                      key={track.id} 
                      className={`group flex items-center justify-between p-2 border-b border-gray-700 hover:bg-gray-750 cursor-move ${
                        draggedTrack === track.id ? 'opacity-50' : ''
                      }`}
                      draggable={!track.locked}
                      onDragStart={(e) => handleTrackDragStart(e, track.id)}
                      onDragEnd={handleTrackDragEnd}
                    >
                      <span className="font-medium text-sm text-white">{track.name}</span>
                      <div className="flex items-center space-x-1 opacity-0 group-hover:opacity-100 transition-opacity duration-200">
                        <Button
                          variant="ghost"
                          size="sm"
                          onClick={() => toggleTrackVisibility(track.id)}
                          className="p-1 h-6 w-6 text-white hover:text-gray-300"
                          title={track.visible ? "Hide track" : "Show track"}
                        >
                          {track.visible ? <Eye className="w-3 h-3" /> : <EyeOff className="w-3 h-3" />}
                        </Button>
                        
                        <Button
                          variant="ghost"
                          size="sm"
                          onClick={() => toggleTrackMute(track.id)}
                          className="p-1 h-6 w-6 text-white hover:text-gray-300"
                          title={track.muted ? "Unmute track" : "Mute track"}
                        >
                          {track.muted ? <VolumeX className="w-3 h-3" /> : <Volume2 className="w-3 h-3" />}
                        </Button>
                        
                        <Button
                          variant="ghost"
                          size="sm"
                          onClick={() => toggleTrackLock(track.id)}
                          className="p-1 h-6 w-6 text-white hover:text-gray-300"
                          title={track.locked ? "Unlock track" : "Lock track"}
                        >
                          {track.locked ? <Lock className="w-3 h-3" /> : <Unlock className="w-3 h-3" />}
                        </Button>
                        
                        <Button
                          variant="ghost"
                          size="sm"
                          onClick={() => deleteTrack(track.id)}
                          className="p-1 h-6 w-6 text-red-400 hover:text-red-300"
                          title="Delete track"
                        >
                          <Trash2 className="w-3 h-3" />
                        </Button>
                      </div>
                    </div>
                  ))}
                </div>
              </div>

              {/* Timeline Canvas */}
              <div className="flex-1 overflow-auto bg-gray-900 h-full">
                
                {/* Timeline Ruler */}
                <div className="sticky top-0 bg-gray-800 border-b border-gray-700 p-2">
                  <div className="flex items-center justify-between mb-2">
                    <div className="flex items-center gap-2">
                      <span className="text-xs text-gray-400">Zoom:</span>
                      <Button
                        variant="ghost"
                        size="sm"
                        onClick={() => setVideoComposition(prev => ({ 
                          ...prev, 
                          timelineZoom: Math.max(0.25, prev.timelineZoom - 0.25) 
                        }))}
                        className="p-1 h-6 text-gray-400 hover:text-white"
                        disabled={videoComposition.timelineZoom <= 0.25}
                      >
                        <Minus className="w-3 h-3" />
                      </Button>
                      <span className="text-xs text-white min-w-12 text-center">
                        {(videoComposition.timelineZoom * 100).toFixed(0)}%
                      </span>
                      <Button
                        variant="ghost"
                        size="sm"
                        onClick={() => setVideoComposition(prev => ({ 
                          ...prev, 
                          timelineZoom: Math.min(4, prev.timelineZoom + 0.25) 
                        }))}
                        className="p-1 h-6 text-gray-400 hover:text-white"
                        disabled={videoComposition.timelineZoom >= 4}
                      >
                        <Plus className="w-3 h-3" />
                      </Button>
                    </div>
                  </div>
                  <div className="flex items-end space-x-4" style={{ paddingLeft: '10px' }}>
                    {renderTimelineRuler()}
                  </div>
                  
                  {/* Current Time Indicator */}
                  <div 
                    className="absolute top-0 bottom-0 w-px bg-red-500 z-10"
                    style={{ left: `${videoComposition.currentTime * timelineZoom * 10 + 10}px` }}
                  >
                    <div className="absolute -top-2 -left-2 w-0 h-0 border-l-2 border-r-2 border-b-4 border-transparent border-b-red-500"></div>
                  </div>
                </div>

                {/* Track Timeline Content */}
                <div className="p-2 space-y-2">
                  {videoComposition.tracks.map(track => (
                    <div
                      key={track.id}
                      className={`relative border backdrop-blur-sm rounded-lg overflow-hidden transition-all duration-300 ${
                        selectedTrack === track.id ? 'border-cyan-400/60 shadow-cyan-500/20 shadow-lg' : 'border-purple-500/30'
                      }`}
                      style={{ height: `${track.height}px` }}
                      onDragOver={(e) => {
                        e.preventDefault();
                        e.dataTransfer.dropEffect = 'copy';
                        // Add visual feedback for drag over
                        e.currentTarget.style.background = 'rgba(59, 130, 246, 0.1)';
                        e.currentTarget.style.borderColor = 'rgb(59, 130, 246)';
                      }}
                      onDragLeave={(e) => {
                        // Reset visual feedback when drag leaves
                        e.currentTarget.style.background = '';
                        e.currentTarget.style.borderColor = '';
                      }}
                      onDrop={(e) => {
                        e.preventDefault();
                        // Reset visual feedback after drop
                        e.currentTarget.style.background = '';
                        e.currentTarget.style.borderColor = '';
                        
                        try {
                          const dragData = JSON.parse(e.dataTransfer.getData('application/json'));
                          
                          if (dragData.type === 'video_segment') {
                            // Create a new video segment from the search result with highlight bubbles
                            const newSegment: Segment = {
                              id: nanoid(),
                              startTime: dragData.startTime,
                              endTime: dragData.endTime,
                              sourceFile: currentVideo?.filename || '',
                              type: 'cut',
                              content: {
                                description: dragData.description,
                                query: dragData.query,
                                searchResultId: dragData.id
                              },
                              visible: true,
                              highlights: [
                                {
                                  id: `search-${dragData.id}`,
                                  type: 'search' as const,
                                  position: { x: 15, y: 15 }, // Top-left corner
                                  relevanceScore: dragData.relevanceScore || 0.8,
                                  description: `Search match: "${dragData.query}"`
                                },
                                {
                                  id: `ai-detected-${dragData.id}`,
                                  type: 'ai-detected' as const,
                                  position: { x: 85, y: 15 }, // Top-right corner
                                  relevanceScore: dragData.relevanceScore || 0.8,
                                  description: dragData.description
                                }
                              ]
                            };
                            
                            // Create a new video track for this segment instead of adding to existing track
                            const videoTracks = videoComposition.tracks.filter(t => t.type === 'video');
                            const newTrackNumber = videoTracks.length + 1;
                            const newTrackName = `V${newTrackNumber}`;
                            
                            const newVideoTrack: Track = {
                              id: nanoid(),
                              name: newTrackName,
                              type: 'video',
                              visible: true,
                              muted: false,
                              locked: false,
                              segments: [newSegment],
                              height: 60,
                              color: `hsl(${(videoTracks.length * 45) % 360}, 60%, 50%)`, // Different color for each track
                              videoFile: currentVideo, // Add the current video file so the track can play
                              created: new Date(),
                              lastUpdate: new Date()
                            };
                            
                            // Add the new track to the composition
                            setVideoComposition(prev => ({
                              ...prev,
                              tracks: [...prev.tracks, newVideoTrack]
                            }));
                            
                            // Set this new track as the selected video track
                            setSelectedVideoTrack(newVideoTrack.id);
                            
                            console.log(`🎬 Created new video track ${newTrackName} for AI search segment: "${dragData.description}"`);
                            console.log(`📍 Segment duration: ${dragData.startTime}s - ${dragData.endTime}s`);
                            
                            // Seek video to the segment start time
                            if (videoRef.current) {
                              videoRef.current.currentTime = dragData.startTime;
                            }
                          } else if (dragData.type === 'video_clip') {
                            // Handle AI shorts clip drop
                            const newClipSegment: Segment = {
                              id: nanoid(),
                              startTime: dragData.startTime,
                              endTime: dragData.endTime,
                              sourceFile: currentVideo?.filename || '',
                              type: 'cut',
                              content: {
                                title: dragData.title,
                                description: dragData.description,
                                viralScore: dragData.viralScore,
                                engagementFactors: dragData.engagementFactors,
                                transcriptSnippet: dragData.transcriptSnippet,
                                visualHighlights: dragData.visualHighlights,
                                // Store the video path for the generated shorts clip
                                videoPath: dragData.videoPath
                              },
                              visible: true,
                              highlights: [
                                {
                                  id: `viral-${dragData.id}`,
                                  type: 'ai-detected' as const,
                                  position: { x: 10, y: 10 },
                                  relevanceScore: dragData.viralScore / 10, // Convert to 0-1 scale
                                  description: `Viral Score: ${dragData.viralScore}/10`
                                },
                                {
                                  id: `smart-crop-${dragData.id}`,
                                  type: 'smart-crop' as const,
                                  position: { x: 50, y: 10 },
                                  relevanceScore: 0.9,
                                  description: `AI Shorts: ${dragData.title}`
                                },
                                {
                                  id: `focus-point-${dragData.id}`,
                                  type: 'focus-point' as const,
                                  position: { x: 90, y: 10 },
                                  relevanceScore: 0.8,
                                  description: `Duration: ${dragData.duration}s`
                                }
                              ]
                            };
                            
                            // Create new video track specifically for AI shorts
                            const videoTracks = videoComposition.tracks.filter(t => t.type === 'video');
                            const newTrackNumber = videoTracks.length + 1;
                            const newTrackName = `AI-${newTrackNumber}`;
                            
                            const newShortsTrack: Track = {
                              id: nanoid(),
                              name: newTrackName,
                              type: 'video',
                              visible: true,
                              muted: false,
                              locked: false,
                              height: 50,
                              color: 'from-orange-500 to-red-600', // Orange-red gradient for AI shorts
                              segments: [newClipSegment],
                              created: new Date(),
                              lastUpdate: new Date()
                            };
                            
                            setVideoComposition(prev => ({
                              ...prev,
                              tracks: [...prev.tracks, newShortsTrack]
                            }));
                            
                            // Set this new track as the selected video track
                            setSelectedVideoTrack(newShortsTrack.id);
                            
                            console.log(`🎬 Created new AI shorts track ${newTrackName} for: "${dragData.title}"`);
                            console.log(`📍 AI Shorts dragData.videoPath: ${dragData.videoPath}`);
                            console.log(`🎯 Selected track ID: ${newShortsTrack.id}`);
                            console.log(`🔍 AI Shorts segment content:`, newClipSegment.content);
                            console.log(`🔍 AI Shorts segment content.videoPath:`, newClipSegment.content.videoPath);
                            
                            // Automatically seek to start time of the shorts clip
                            if (videoRef.current) {
                              videoRef.current.currentTime = dragData.startTime;
                            }
                            
                          } else if (dragData.type === 'media_asset') {
                            // Handle media asset drop (images from AI generation)
                            const dropPosition = videoComposition.currentTime; // Use current playback time as drop position
                            const duration = 5; // Default duration for media assets
                            
                            const newMediaSegment: Segment = {
                              id: nanoid(),
                              startTime: dropPosition,
                              endTime: dropPosition + duration,
                              sourceFile: dragData.filename,
                              type: 'media',
                              content: {
                                mediaType: dragData.mediaType,
                                url: dragData.url,
                                filename: dragData.filename,
                                prompt: dragData.prompt,
                                x: 50, // Center position
                                y: 50,
                                width: 30, // 30% of video width
                                height: 30,
                                opacity: 100,
                                rotation: 0,
                                blur: 0,
                                borderColor: '#ffffff',
                                borderWidth: 0,
                                shadowBlur: 0,
                                shadowColor: '#000000',
                                animation: 'none'
                              },
                              visible: true
                            };
                            
                            // Add media segment to media track (create one if needed)
                            setVideoComposition(prev => {
                              let mediaTrack = prev.tracks.find(t => t.type === 'media');
                              
                              if (!mediaTrack) {
                                // Create a new media track if none exists
                                const newMediaTrack: Track = {
                                  id: nanoid(),
                                  name: 'M1',
                                  type: 'media',
                                  segments: [newMediaSegment],
                                  locked: false,
                                  visible: true,
                                  muted: false,
                                  height: 60,
                                  color: 'from-purple-500 to-pink-600',
                                  created: new Date(),
                                  lastUpdate: new Date()
                                };
                                
                                return {
                                  ...prev,
                                  tracks: [...prev.tracks, newMediaTrack]
                                };
                              } else {
                                // Add to existing media track
                                return {
                                  ...prev,
                                  tracks: prev.tracks.map(t => 
                                    t.id === mediaTrack!.id 
                                      ? { ...t, segments: [...t.segments, newMediaSegment] }
                                      : t
                                  )
                                };
                              }
                            });
                            
                            // Seek video to the media start time
                            if (videoRef.current) {
                              videoRef.current.currentTime = dropPosition;
                            }
                          } else if (dragData.type === 'video_file') {
                            // Handle translated video file drop (from AI chat responses)
                            const videoTracks = videoComposition.tracks.filter(t => t.type === 'video');
                            const newTrackNumber = videoTracks.length + 1;
                            const newTrackName = `V${newTrackNumber}`;
                            
                            const newVideoSegment: Segment = {
                              id: nanoid(),
                              startTime: 0,
                              endTime: 30, // Default duration, will be updated with actual duration
                              sourceFile: dragData.filename,
                              type: 'cut',
                              content: {
                                videoPath: dragData.videoPath,
                                title: dragData.title,
                                language: dragData.language,
                                isDubbed: dragData.isDubbed
                              },
                              visible: true
                            };
                            
                            const newVideoTrack: Track = {
                              id: nanoid(),
                              name: newTrackName,
                              type: 'video',
                              segments: [newVideoSegment],
                              locked: false,
                              visible: true,
                              muted: false,
                              height: 60,
                              color: '#10B981', // Emerald color for translated videos
                              created: new Date(),
                              lastUpdate: new Date(),
                              videoFile: {
                                id: nanoid(),
                                filename: dragData.filename,
                                originalName: dragData.title || dragData.filename,
                                path: dragData.videoPath,
                                size: 0, // Will be updated with actual size
                                duration: 30, // Will be updated with actual duration
                                isDubbed: dragData.isDubbed,
                                targetLanguage: dragData.language,
                                originalLanguage: 'en' // Default, can be updated
                              }
                            };
                            
                            // Add the new track to composition
                            setVideoComposition(prev => ({
                              ...prev,
                              tracks: [...prev.tracks, newVideoTrack]
                            }));
                            
                            // Automatically select this new track for playback
                            selectVideoTrack(newVideoTrack.id);
                            
                            // Set as current video for preview
                            setCurrentVideo({
                              id: nanoid(),
                              filename: dragData.filename,
                              originalName: dragData.title || dragData.filename,
                              path: dragData.videoPath,
                              size: 0, // Will be updated with actual size
                              duration: 30 // Will be updated with actual duration
                            });
                            
                            // Add to generated media list for visual tracking
                            setGeneratedMedia(prev => [...prev, {
                              id: nanoid(),
                              type: 'video',
                              filename: dragData.filename,
                              url: dragData.videoPath,
                              prompt: `Translated Video (${dragData.language?.toUpperCase()})`
                            }]);
                          } else if (dragData.type === 'caption_track') {
                            // Handle caption track drop - create new text track with all caption segments
                            const captionData = dragData.captionData;
                            
                            // Create text segments from caption data
                            const textSegments: Segment[] = captionData.segments.map((segment: any) => ({
                              id: nanoid(),
                              startTime: segment.startTime,
                              endTime: segment.endTime,
                              sourceFile: '',
                              type: 'text',
                              content: {
                                text: segment.text,
                                x: 50, // Center position
                                y: 85, // Bottom of screen for captions
                                fontSize: 24,
                                color: '#ffffff',
                                style: 'bold',
                                fontFamily: 'system-ui, -apple-system, sans-serif',
                                shadowColor: '#000000',
                                shadowBlur: 2,
                                backgroundColor: 'rgba(0, 0, 0, 0.7)',
                                backgroundOpacity: 70,
                                textAlign: 'center',
                                animation: 'fade_in'
                              },
                              visible: true
                            }));
                            
                            // Create new text track for captions
                            const textTracks = videoComposition.tracks.filter(t => t.type === 'text');
                            const newTrackNumber = textTracks.length + 1;
                            const newTrackName = `T${newTrackNumber} - Captions`;
                            
                            const newCaptionTrack: Track = {
                              id: nanoid(),
                              name: newTrackName,
                              type: 'text',
                              visible: true,
                              muted: false,
                              locked: false,
                              segments: textSegments,
                              height: 80,
                              color: '#facc15', // Yellow color for caption tracks
                              created: new Date(),
                              lastUpdate: new Date()
                            };
                            
                            // Add the new caption track to composition
                            setVideoComposition(prev => ({
                              ...prev,
                              tracks: [...prev.tracks, newCaptionTrack]
                            }));
                            
                            console.log(`📝 Created new caption track ${newTrackName} with ${textSegments.length} segments`);
                            console.log(`🌐 Language: ${captionData.language || 'Auto-detected'}`);
                          } else if (dragData.type === 'single_caption_segment') {
                            // Handle individual SRT caption segment drop
                            const segmentData = dragData.segmentData;
                            
                            // Create single text segment from the dropped caption with highlights
                            const textSegment: Segment = {
                              id: nanoid(),
                              startTime: segmentData.startTime,
                              endTime: segmentData.endTime,
                              sourceFile: '',
                              type: 'text',
                              content: {
                                text: segmentData.text,
                                x: 50, // Center position
                                y: 85, // Bottom of screen for captions
                                fontSize: 24,
                                color: '#ffffff',
                                style: 'bold',
                                fontFamily: 'system-ui, -apple-system, sans-serif',
                                shadowColor: '#000000',
                                shadowBlur: 2,
                                backgroundColor: 'rgba(0, 0, 0, 0.7)',
                                backgroundOpacity: 70,
                                textAlign: 'center',
                                animation: 'fade_in'
                              },
                              visible: true,
                              highlights: [
                                {
                                  id: `caption-${segmentData.index || Date.now()}`,
                                  type: 'ai-detected' as const,
                                  position: { x: 20, y: 20 },
                                  relevanceScore: segmentData.confidence || 0.9,
                                  description: `AI Caption: "${segmentData.text.slice(0, 30)}..."`
                                },
                                {
                                  id: `timing-${segmentData.index || Date.now()}`,
                                  type: 'smart-crop' as const,
                                  position: { x: 80, y: 20 },
                                  relevanceScore: 0.95,
                                  description: `Timing: ${segmentData.startTime}s - ${segmentData.endTime}s`
                                }
                              ]
                            };
                            
                            // Find existing text track or create new one
                            let targetTrack = videoComposition.tracks.find(t => t.type === 'text');
                            
                            if (!targetTrack) {
                              // Create new text track for this segment
                              const newTrackName = `T1 - SRT Captions`;
                              
                              targetTrack = {
                                id: nanoid(),
                                name: newTrackName,
                                type: 'text',
                                visible: true,
                                muted: false,
                                locked: false,
                                segments: [textSegment],
                                height: 80,
                                color: '#facc15', // Yellow color for caption tracks
                                created: new Date(),
                                lastUpdate: new Date()
                              };
                              
                              // Add the new track to composition
                              setVideoComposition(prev => ({
                                ...prev,
                                tracks: [...prev.tracks, targetTrack!]
                              }));
                              
                              console.log(`📝 Created new SRT caption track ${newTrackName} with segment ${dragData.srtIndex}`);
                            } else {
                              // Add segment to existing text track
                              setVideoComposition(prev => ({
                                ...prev,
                                tracks: prev.tracks.map(track => 
                                  track.id === targetTrack!.id 
                                    ? { ...track, segments: [...track.segments, textSegment] }
                                    : track
                                )
                              }));
                              
                              console.log(`📝 Added SRT segment ${dragData.srtIndex} to existing caption track`);
                            }
                          } else if (dragData.type === 'broll_suggestion') {
                            // Handle B-roll suggestion drop - create media placeholder segment
                            const dropPosition = videoComposition.currentTime;
                            const duration = dragData.endTime - dragData.startTime;
                            
                            const newBrollSegment: Segment = {
                              id: nanoid(),
                              startTime: dropPosition,
                              endTime: dropPosition + duration,
                              sourceFile: '',
                              type: 'media',
                              content: {
                                mediaType: 'broll',
                                concept: dragData.concept,
                                justification: dragData.justification,
                                prompt: dragData.prompt,
                                x: 50,
                                y: 50,
                                width: 100,
                                height: 100,
                                opacity: 100,
                                rotation: 0,
                                blur: 0,
                                borderColor: '#06b6d4',
                                borderWidth: 2,
                                shadowBlur: 4,
                                shadowColor: '#0891b2',
                                animation: 'fade_in'
                              },
                              visible: true,
                              highlights: [
                                {
                                  id: `broll-${dragData.concept.replace(/\s+/g, '-')}`,
                                  type: 'ai-detected' as const,
                                  position: { x: 50, y: 50 },
                                  relevanceScore: 0.9,
                                  description: `B-roll: ${dragData.concept}`
                                }
                              ]
                            };
                            
                            // Find existing media track or create new one
                            let mediaTrack = videoComposition.tracks.find(t => t.type === 'media');
                            
                            if (!mediaTrack) {
                              // Create new media track for B-roll
                              const newTrackName = `M1 - B-roll`;
                              
                              mediaTrack = {
                                id: nanoid(),
                                name: newTrackName,
                                type: 'media',
                                visible: true,
                                muted: false,
                                locked: false,
                                segments: [newBrollSegment],
                                height: 60,
                                color: 'from-cyan-500 to-blue-600',
                                created: new Date(),
                                lastUpdate: new Date()
                              };
                              
                              // Add the new track to composition
                              setVideoComposition(prev => ({
                                ...prev,
                                tracks: [...prev.tracks, mediaTrack!]
                              }));
                              
                              console.log(`🎬 Created new B-roll track ${newTrackName} with concept: ${dragData.concept}`);
                            } else {
                              // Add segment to existing media track
                              setVideoComposition(prev => ({
                                ...prev,
                                tracks: prev.tracks.map(track => 
                                  track.id === mediaTrack!.id 
                                    ? { ...track, segments: [...track.segments, newBrollSegment] }
                                    : track
                                )
                              }));
                              
                              console.log(`🎬 Added B-roll suggestion "${dragData.concept}" to existing media track`);
                            }
                          }
                        } catch (error) {
                          console.error('Failed to parse drop data:', error);
                        }
                      }}
                    >
                      {renderTrackSegments(track)}
                    </div>
                  ))}
                  
                  {videoComposition.tracks.length === 0 && (
                    <div className="text-center py-12 text-gray-500">
                      <Type className="w-12 h-12 mx-auto mb-4" />
                      <p>No tracks yet. Upload a video or create new tracks to start editing.</p>
                    </div>
                  )}
                </div>
              </div>
            </div>
          </div>
        </div>

        {/* Modern AI Agent Chat Interface */}
        {showAiAgent && (
          <div className="w-full max-w-[420px] min-w-[320px] bg-slate-900/80 backdrop-blur-xl border-l border-purple-500/20 flex flex-col max-h-screen overflow-hidden shadow-2xl">
            
            {/* Modern Chat Header */}
            <div className="flex items-center justify-between p-6 bg-gradient-to-r from-purple-900/60 to-cyan-900/40 backdrop-blur-sm border-b border-purple-500/20 flex-shrink-0 shadow-lg">
              <div className="flex items-center space-x-3">
                <div className="relative">
                  <div className="w-10 h-10 bg-gradient-to-br from-violet-500 to-purple-600 rounded-full flex items-center justify-center shadow-lg">
                    <Bot className="w-5 h-5 text-white" />
                  </div>
                  <div className="absolute -bottom-1 -right-1 w-4 h-4 bg-green-500 border-2 border-white dark:border-slate-800 rounded-full"></div>
                </div>
                <div>
                  <h3 className="font-semibold text-white text-lg">AI Assistant</h3>
                  <p className="text-xs text-purple-200">Video Editor AI • Online</p>
                </div>
              </div>
              <Button
                variant="ghost"
                size="sm"
                onClick={() => setShowAiAgent(false)}
                className="text-purple-300 hover:text-white hover:bg-purple-800/50 backdrop-blur-sm p-2 h-9 w-9 rounded-full transition-all duration-300"
              >
                <X className="w-4 h-4" />
              </Button>
            </div>

            {/* Chat Messages Area */}
            <div ref={chatMessagesRef} className="flex-1 overflow-y-auto overflow-x-hidden bg-slate-50 dark:bg-slate-900 min-w-0">
              <div className="p-4 space-y-6 max-w-full min-w-0">
                {chatMessages.length === 0 && (
                  <div className="text-center py-12">
                    <div className="w-16 h-16 bg-gradient-to-br from-violet-500 to-purple-600 rounded-2xl flex items-center justify-center mx-auto mb-4 shadow-lg">
                      <MessageSquare className="w-8 h-8 text-white" />
                    </div>
                    <h4 className="text-lg font-semibold text-slate-900 dark:text-white mb-2">Welcome to AI Video Editor</h4>
                    <p className="text-sm text-slate-600 dark:text-slate-400 mb-6 max-w-sm mx-auto">
                      I can help you edit videos with natural language commands. Just tell me what you want to do!
                    </p>
                    
                    <div className="bg-white dark:bg-slate-800 rounded-xl p-4 border border-slate-200 dark:border-slate-700 text-left max-w-sm mx-auto shadow-sm">
                      <p className="text-xs font-medium text-slate-700 dark:text-slate-300 mb-3 uppercase tracking-wide">Try these commands:</p>
                      <div className="space-y-2 text-sm">
                        <div className="flex items-center space-x-2 text-slate-600 dark:text-slate-400">
                          <div className="w-1.5 h-1.5 bg-violet-500 rounded-full"></div>
                          <span>"Cut the video from 10s to 30s"</span>
                        </div>
                        <div className="flex items-center space-x-2 text-slate-600 dark:text-slate-400">
                          <div className="w-1.5 h-1.5 bg-violet-500 rounded-full"></div>
                          <span>"Add text 'Hello' at 5 seconds"</span>
                        </div>
                        <div className="flex items-center space-x-2 text-slate-600 dark:text-slate-400">
                          <div className="w-1.5 h-1.5 bg-violet-500 rounded-full"></div>
                          <span>"Create a new audio track"</span>
                        </div>
                        <div className="flex items-center space-x-2 text-slate-600 dark:text-slate-400">
                          <div className="w-1.5 h-1.5 bg-violet-500 rounded-full"></div>
                          <span>"Split video at 15 seconds"</span>
                        </div>
                      </div>
                    </div>
                  </div>
                )}
                
                {chatMessages.map(message => (
                  <div key={message.id} className="flex flex-col space-y-1">
                    {message.type === 'user' ? (
                      // User Message
                      <div className="flex justify-end">
                        <div className="flex items-end space-x-2 max-w-[85%] min-w-0">
                          <div className="bg-gradient-to-r from-violet-500 to-purple-600 text-white rounded-2xl rounded-br-md px-4 py-3 shadow-lg min-w-0 break-words">
                            <p className="text-sm font-medium break-words whitespace-pre-wrap">{message.content}</p>
                          </div>
                          <div className="w-8 h-8 bg-slate-300 dark:bg-slate-600 rounded-full flex items-center justify-center text-xs font-semibold text-slate-700 dark:text-slate-300 flex-shrink-0">
                            U
                          </div>
                        </div>
                      </div>
                    ) : (
                      // AI Message
                      <div className="flex justify-start">
                        <div className="flex items-end space-x-3 max-w-[85%] min-w-0">
                          <div className="w-8 h-8 bg-gradient-to-br from-violet-500 to-purple-600 rounded-full flex items-center justify-center flex-shrink-0">
                            <Bot className="w-4 h-4 text-white" />
                          </div>
                          <div className="bg-white dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-2xl rounded-bl-md px-4 py-3 shadow-sm min-w-0 break-words">
                            <p className="text-sm text-slate-900 dark:text-white break-words whitespace-pre-wrap">{message.content}</p>
                            {message.operations && message.operations.length > 0 && (
                              <div className="mt-3 space-y-3">
                                {message.operations.map((op, idx) => {
                                  // Render generated media as draggable cards
                                  if (op.type === 'generate_media' && op.media) {
                                    return (
                                      <div key={idx} className="bg-gradient-to-r from-purple-50 to-pink-50 dark:from-purple-900/20 dark:to-pink-900/20 rounded-lg border border-purple-200 dark:border-purple-700 p-3">
                                        <div className="text-xs font-medium text-purple-800 dark:text-purple-300 mb-3 flex items-center">
                                          <Bot className="w-3 h-3 mr-2" />
                                          Generated Media
                                        </div>
                                        <div 
                                          className="bg-white dark:bg-slate-800 rounded-lg border border-slate-200 dark:border-slate-700 p-3 hover:shadow-md transition-all cursor-grab active:cursor-grabbing hover:border-purple-400 dark:hover:border-purple-500"
                                          draggable={true}
                                          onDragStart={(e) => {
                                            // Set drag data for timeline drop
                                            e.dataTransfer.setData('application/json', JSON.stringify({
                                              type: 'media_asset',
                                              mediaType: op.media.type,
                                              url: op.media.url,
                                              filename: op.media.filename,
                                              prompt: op.media.prompt,
                                              id: op.media.id,
                                              timestamp: op.media.timestamp
                                            }));
                                            // Add visual feedback
                                            e.currentTarget.style.opacity = '0.5';
                                          }}
                                          onDragEnd={(e) => {
                                            // Reset visual feedback
                                            e.currentTarget.style.opacity = '1';
                                          }}
                                        >
                                          <div className="flex items-start space-x-3">
                                            {/* Media Preview */}
                                            <div className="flex-shrink-0">
                                              <div className="w-20 h-20 bg-slate-200 dark:bg-slate-700 rounded-lg overflow-hidden">
                                                {op.media.type === 'image' ? (
                                                  <img 
                                                    src={op.media.url} 
                                                    alt={op.media.prompt}
                                                    className="w-full h-full object-cover"
                                                    onError={(e) => {
                                                      e.currentTarget.style.display = 'none';
                                                    }}
                                                  />
                                                ) : op.media.type === 'video' ? (
                                                  <div className="relative w-full h-full">
                                                    <video 
                                                      className="w-full h-full object-cover"
                                                      src={`${op.media.url}#t=1`}
                                                      poster=""
                                                      muted
                                                      preload="metadata"
                                                    />
                                                    <div className="absolute inset-0 bg-black bg-opacity-30 flex items-center justify-center">
                                                      <VideoIcon className="w-6 h-6 text-white" />
                                                    </div>
                                                  </div>
                                                ) : (
                                                  <div className="w-full h-full flex items-center justify-center bg-gradient-to-br from-purple-400 to-pink-400 text-white">
                                                    <Bot className="w-8 h-8" />
                                                  </div>
                                                )}
                                              </div>
                                            </div>
                                            
                                            {/* Media Info */}
                                            <div className="flex-1 min-w-0">
                                              <div className="flex items-center space-x-2 mb-1">
                                                <span className="text-xs font-medium text-purple-600 dark:text-purple-400 uppercase tracking-wider">
                                                  {op.media.type}
                                                </span>
                                                <div className="w-1 h-1 bg-slate-400 rounded-full"></div>
                                                <span className="text-xs text-slate-500 dark:text-slate-400">
                                                  Generated
                                                </span>
                                              </div>
                                              <p className="text-sm font-medium text-slate-900 dark:text-white mb-1 line-clamp-2">
                                                {op.media.prompt}
                                              </p>
                                              <div className="flex items-center justify-between">
                                                <span className="text-xs text-slate-500 dark:text-slate-400">
                                                  {op.media.filename}
                                                </span>
                                                <div className="text-xs text-slate-400 dark:text-slate-500 bg-slate-100 dark:bg-slate-700 px-2 py-1 rounded">
                                                  Drag to timeline
                                                </div>
                                              </div>
                                            </div>
                                          </div>
                                        </div>
                                      </div>
                                    );
                                  }

                                  // Render AI shorts clips as draggable cards
                                  if (op.type === 'ai_shorts_generated' && op.clipData) {
                                    return (
                                      <div key={idx} className="bg-gradient-to-r from-orange-50 to-red-50 dark:from-orange-900/20 dark:to-red-900/20 rounded-lg border border-orange-200 dark:border-orange-700 p-3">
                                        <div className="text-xs font-medium text-orange-800 dark:text-orange-300 mb-3 flex items-center">
                                          <Zap className="w-3 h-3 mr-2" />
                                          AI Shorts Clip
                                        </div>
                                        <div 
                                          className="bg-white dark:bg-slate-800 rounded-lg border border-slate-200 dark:border-slate-700 p-3 hover:shadow-md transition-all cursor-grab active:cursor-grabbing hover:border-orange-400 dark:hover:border-orange-500"
                                          draggable={true}
                                          onDragStart={(e) => {
                                            e.dataTransfer.setData('application/json', JSON.stringify({
                                              type: 'video_clip',
                                              id: op.clipData.id,
                                              title: op.clipData.title,
                                              description: op.clipData.description,
                                              startTime: op.clipData.startTime,
                                              endTime: op.clipData.endTime,
                                              duration: op.clipData.duration,
                                              viralScore: op.clipData.viralScore,
                                              engagementFactors: op.clipData.engagementFactors,
                                              speakerInfo: op.clipData.speakerInfo,
                                              keyMoments: op.clipData.keyMoments,
                                              transcriptSnippet: op.clipData.transcriptSnippet,
                                              visualHighlights: op.clipData.visualHighlights,
                                              videoPath: op.clipData.videoPath // CRITICAL: Include videoPath for AI shorts playback
                                            }));
                                            e.currentTarget.style.opacity = '0.5';
                                          }}
                                          onDragEnd={(e) => {
                                            e.currentTarget.style.opacity = '1';
                                          }}
                                        >
                                          <div className="flex items-start space-x-3">
                                            {/* Clip Preview with Play Button */}
                                            <div className="flex-shrink-0 relative">
                                              {op.clipData.videoPath ? (
                                                <div className="relative group">
                                                  <video 
                                                    className="w-20 h-20 bg-black rounded-lg object-cover"
                                                    src={`/api/video/${op.clipData.videoPath.split('/').pop()}`}
                                                    muted
                                                    loop
                                                    onMouseEnter={(e) => e.currentTarget.play()}
                                                    onMouseLeave={(e) => e.currentTarget.pause()}
                                                    poster={currentVideo?.filename ? `/api/video/${currentVideo.filename}#t=${op.clipData.startTime}` : undefined}
                                                  />
                                                  {/* Play Button Overlay */}
                                                  <button
                                                    onClick={(e) => {
                                                      e.stopPropagation();
                                                      setOverlayVideoData(op.clipData);
                                                      setShowVideoOverlay(true);
                                                    }}
                                                    className="absolute inset-0 bg-black/50 hover:bg-black/70 rounded-lg flex items-center justify-center opacity-0 group-hover:opacity-100 transition-opacity duration-200"
                                                    title="Play video in overlay"
                                                  >
                                                    <Play className="w-6 h-6 text-white" />
                                                  </button>
                                                </div>
                                              ) : (
                                                <div className="w-20 h-20 bg-gradient-to-br from-orange-500 to-red-600 rounded-lg overflow-hidden flex items-center justify-center">
                                                  <Play className="w-8 h-8 text-white" />
                                                </div>
                                              )}
                                            </div>
                                            
                                            {/* Clip Details */}
                                            <div className="flex-1 min-w-0">
                                              <h4 className="font-medium text-gray-900 dark:text-white text-sm mb-1 truncate">
                                                {op.clipData.title}
                                              </h4>
                                              <p className="text-xs text-gray-600 dark:text-gray-400 mb-2 line-clamp-2">
                                                {op.clipData.description}
                                              </p>
                                              
                                              {/* Clip Stats */}
                                              <div className="flex items-center space-x-3 text-xs text-gray-500 dark:text-gray-400">
                                                <div className="flex items-center">
                                                  <Clock className="w-3 h-3 mr-1" />
                                                  {op.clipData.duration}s
                                                </div>
                                                <div className="flex items-center">
                                                  <TrendingUp className="w-3 h-3 mr-1" />
                                                  {op.clipData.viralScore}/10
                                                </div>
                                                <div className="flex items-center">
                                                  <Users className="w-3 h-3 mr-1" />
                                                  {op.clipData.engagementFactors?.length || 0} factors
                                                </div>
                                              </div>
                                              
                                              {/* Engagement Factors */}
                                              {op.clipData.engagementFactors && op.clipData.engagementFactors.length > 0 && (
                                                <div className="mt-2 flex flex-wrap gap-1">
                                                  {op.clipData.engagementFactors.slice(0, 3).map((factor, factorIdx) => (
                                                    <span key={factorIdx} className="inline-block px-2 py-1 text-xs bg-orange-100 dark:bg-orange-900/30 text-orange-700 dark:text-orange-300 rounded-full">
                                                      {factor}
                                                    </span>
                                                  ))}
                                                  {op.clipData.engagementFactors.length > 3 && (
                                                    <span className="inline-block px-2 py-1 text-xs bg-gray-100 dark:bg-gray-700 text-gray-600 dark:text-gray-400 rounded-full">
                                                      +{op.clipData.engagementFactors.length - 3} more
                                                    </span>
                                                  )}
                                                </div>
                                              )}
                                            </div>
                                          </div>
                                          
                                          {/* Action Buttons */}
                                          <div className="mt-3 pt-2 border-t border-slate-200 dark:border-slate-700">
                                            <div className="flex items-center justify-between">
                                              <button
                                                onClick={(e) => {
                                                  e.stopPropagation();
                                                  setOverlayVideoData(op.clipData);
                                                  setShowVideoOverlay(true);
                                                }}
                                                className="text-xs bg-orange-100 hover:bg-orange-200 dark:bg-orange-900/30 dark:hover:bg-orange-900/50 text-orange-700 dark:text-orange-300 px-2 py-1 rounded flex items-center"
                                              >
                                                <Play className="w-3 h-3 mr-1" />
                                                Play
                                              </button>
                                              <span className="text-xs text-gray-500 dark:text-gray-400 flex items-center">
                                                <Move className="w-3 h-3 mr-1" />
                                                Drag to timeline
                                              </span>
                                            </div>
                                          </div>
                                        </div>
                                      </div>
                                    );
                                  }

                                  // Render translated video as draggable card
                                  if (op.type === 'translate_video_language' && op.outputPath) {
                                    const filename = op.outputPath.split('/').pop();
                                    return (
                                      <div key={idx} className="bg-gradient-to-r from-emerald-50 to-teal-50 dark:from-emerald-900/20 dark:to-teal-900/20 rounded-lg border border-emerald-200 dark:border-emerald-700 p-3">
                                        <div className="text-xs font-medium text-emerald-800 dark:text-emerald-300 mb-3 flex items-center">
                                          <Bot className="w-3 h-3 mr-2" />
                                          Translated Video
                                        </div>
                                        <div 
                                          className="bg-white dark:bg-slate-800 rounded-lg border border-slate-200 dark:border-slate-700 p-3 hover:shadow-md transition-all cursor-grab active:cursor-grabbing hover:border-emerald-400 dark:hover:border-emerald-500"
                                          draggable={true}
                                          onDragStart={(e) => {
                                            // Set drag data for timeline drop as video file
                                            e.dataTransfer.setData('application/json', JSON.stringify({
                                              type: 'video_file',
                                              filename: filename,
                                              videoPath: `/api/video/${filename}`,
                                              title: `Dubbed Video (${op.targetLanguage?.toUpperCase()})`,
                                              language: op.targetLanguage,
                                              isDubbed: true
                                            }));
                                            // Add visual feedback
                                            e.currentTarget.style.opacity = '0.5';
                                          }}
                                          onDragEnd={(e) => {
                                            // Reset visual feedback
                                            e.currentTarget.style.opacity = '1';
                                          }}
                                        >
                                          <div className="flex items-start space-x-3">
                                            {/* Video Preview */}
                                            <div className="flex-shrink-0">
                                              <div className="w-20 h-20 bg-slate-200 dark:bg-slate-700 rounded-lg overflow-hidden relative">
                                                <video 
                                                  className="w-full h-full object-cover"
                                                  src={`/api/video/${filename}#t=1`}
                                                  poster=""
                                                  muted
                                                  preload="metadata"
                                                />
                                                <div className="absolute inset-0 bg-black bg-opacity-30 flex items-center justify-center">
                                                  <Play className="w-6 h-6 text-white" />
                                                </div>
                                              </div>
                                            </div>
                                            
                                            {/* Video Info */}
                                            <div className="flex-1 min-w-0">
                                              <div className="flex items-center space-x-2 mb-1">
                                                <span className="text-xs font-medium text-emerald-600 dark:text-emerald-400 uppercase tracking-wider">
                                                  Video
                                                </span>
                                                <div className="w-1 h-1 bg-slate-400 rounded-full"></div>
                                                <span className="text-xs text-slate-500 dark:text-slate-400">
                                                  {op.targetLanguage?.toUpperCase()} Dubbed
                                                </span>
                                              </div>
                                              <p className="text-sm font-medium text-slate-900 dark:text-white mb-1">
                                                Translated Video ({op.targetLanguage?.toUpperCase()})
                                              </p>
                                              <p className="text-xs text-slate-600 dark:text-slate-300 mb-2">
                                                Synchronized audio dubbing with intelligent timing
                                              </p>
                                              <div className="flex items-center justify-between">
                                                <span className="text-xs text-slate-500 dark:text-slate-400">
                                                  {filename}
                                                </span>
                                                <div className="text-xs text-slate-400 dark:text-slate-500 bg-slate-100 dark:bg-slate-700 px-2 py-1 rounded">
                                                  Drag to timeline
                                                </div>
                                              </div>
                                            </div>
                                          </div>
                                        </div>
                                      </div>
                                    );
                                  }

                                  // Render caption generation as draggable card
                                  if (op.type === 'caption_generation' && op.captionTrack) {
                                    return (
                                      <div key={idx} className="bg-gradient-to-r from-yellow-50 to-amber-50 dark:from-yellow-900/20 dark:to-amber-900/20 rounded-lg border border-yellow-200 dark:border-yellow-700 p-3">
                                        <div className="text-xs font-medium text-yellow-800 dark:text-yellow-300 mb-3 flex items-center">
                                          <Bot className="w-3 h-3 mr-2" />
                                          Generated Captions
                                        </div>
                                        <div 
                                          className="bg-white dark:bg-slate-800 rounded-lg border border-slate-200 dark:border-slate-700 p-3 hover:shadow-md transition-all cursor-grab active:cursor-grabbing hover:border-yellow-400 dark:hover:border-yellow-500"
                                          draggable={true}
                                          onDragStart={(e) => {
                                            // Set drag data for timeline drop as caption track
                                            e.dataTransfer.setData('application/json', JSON.stringify({
                                              type: 'caption_track',
                                              captionData: op.captionTrack,
                                              id: op.captionTrack.id,
                                              name: op.captionTrack.name,
                                              language: op.captionTrack.language,
                                              segments: op.captionTrack.segments
                                            }));
                                            // Add visual feedback
                                            e.currentTarget.style.opacity = '0.5';
                                          }}
                                          onDragEnd={(e) => {
                                            // Reset visual feedback
                                            e.currentTarget.style.opacity = '1';
                                          }}
                                        >
                                          <div className="flex items-start space-x-3">
                                            {/* Caption Preview */}
                                            <div className="flex-shrink-0">
                                              <div className="w-20 h-20 bg-slate-200 dark:bg-slate-700 rounded-lg overflow-hidden relative flex items-center justify-center">
                                                <div className="text-center text-xs text-slate-600 dark:text-slate-300 p-2">
                                                  <Type className="w-6 h-6 mx-auto mb-1 text-yellow-600 dark:text-yellow-400" />
                                                  <div className="font-medium">{op.captionTrack.segmentCount}</div>
                                                  <div className="text-[10px]">segments</div>
                                                </div>
                                              </div>
                                            </div>
                                            
                                            {/* Caption Info */}
                                            <div className="flex-1 min-w-0">
                                              <div className="flex items-center space-x-2 mb-1">
                                                <span className="text-xs font-medium text-yellow-600 dark:text-yellow-400 uppercase tracking-wider">
                                                  Captions
                                                </span>
                                                <div className="w-1 h-1 bg-slate-400 rounded-full"></div>
                                                <span className="text-xs text-slate-500 dark:text-slate-400">
                                                  {op.captionTrack.language || 'Auto-detected'}
                                                </span>
                                              </div>
                                              <p className="text-sm font-medium text-slate-900 dark:text-white mb-1">
                                                {op.captionTrack.name || 'Generated Captions'}
                                              </p>
                                              <p className="text-xs text-slate-600 dark:text-slate-300 mb-2">
                                                {op.captionTrack.segmentCount} segments • {Math.round(op.captionTrack.totalDuration)}s duration
                                              </p>
                                              <div className="flex items-center justify-between">
                                                <span className="text-xs text-slate-500 dark:text-slate-400">
                                                  AI Generated
                                                </span>
                                                <div className="text-xs text-slate-400 dark:text-slate-500 bg-slate-100 dark:bg-slate-700 px-2 py-1 rounded">
                                                  Drag to timeline
                                                </div>
                                              </div>
                                            </div>
                                          </div>
                                        </div>
                                      </div>
                                    );
                                  }
                                  
                                  // Render B-roll suggestions as draggable cards
                                  if (op.type === 'broll_suggestions_generated' && op.suggestions && op.suggestions.length > 0) {
                                    return (
                                      <div key={idx} className="bg-gradient-to-r from-cyan-50 to-blue-50 dark:from-cyan-900/20 dark:to-blue-900/20 rounded-lg border border-cyan-200 dark:border-cyan-700 p-3">
                                        <div className="text-xs font-medium text-cyan-800 dark:text-cyan-300 mb-3 flex items-center">
                                          <Film className="w-3 h-3 mr-2" />
                                          B-roll Suggestions
                                        </div>
                                        <div className="space-y-3">
                                          {op.suggestions.map((suggestion: any, suggestionIdx: number) => (
                                            <div key={suggestionIdx} 
                                                 className="bg-white dark:bg-slate-800 rounded-lg border border-slate-200 dark:border-slate-700 p-3 hover:shadow-md transition-all cursor-grab active:cursor-grabbing hover:border-cyan-400 dark:hover:border-cyan-500"
                                                 draggable={true}
                                                 onDragStart={(e) => {
                                                   // Set drag data for timeline drop
                                                   e.dataTransfer.setData('application/json', JSON.stringify({
                                                     type: 'broll_suggestion',
                                                     concept: suggestion.concept,
                                                     startTime: suggestion.startTime,
                                                     endTime: suggestion.endTime,
                                                     justification: suggestion.justification,
                                                     prompt: suggestion.prompt
                                                   }));
                                                   e.currentTarget.style.opacity = '0.5';
                                                 }}
                                                 onDragEnd={(e) => {
                                                   e.currentTarget.style.opacity = '1';
                                                 }}
                                            >
                                              <div className="flex items-start space-x-3">
                                                {/* B-roll Preview */}
                                                <div className="flex-shrink-0">
                                                  <div className="w-20 h-20 bg-gradient-to-br from-cyan-500 to-blue-600 rounded-lg overflow-hidden relative flex items-center justify-center">
                                                    <Film className="w-8 h-8 text-white" />
                                                  </div>
                                                </div>
                                                
                                                {/* B-roll Info */}
                                                <div className="flex-1 min-w-0">
                                                  <div className="flex items-center space-x-2 mb-1">
                                                    <span className="text-xs font-medium text-cyan-600 dark:text-cyan-400 uppercase tracking-wider">
                                                      B-roll
                                                    </span>
                                                    <div className="w-1 h-1 bg-slate-400 rounded-full"></div>
                                                    <span className="text-xs text-slate-500 dark:text-slate-400">
                                                      {suggestion.startTime}s-{suggestion.endTime}s
                                                    </span>
                                                  </div>
                                                  <p className="text-sm font-medium text-slate-900 dark:text-white mb-1">
                                                    {suggestion.concept}
                                                  </p>
                                                  <p className="text-xs text-slate-600 dark:text-slate-300 mb-2 line-clamp-2">
                                                    {suggestion.justification}
                                                  </p>
                                                  <div className="flex items-center justify-between">
                                                    <span className="text-xs text-slate-500 dark:text-slate-400">
                                                      AI Generated
                                                    </span>
                                                    <div className="flex items-center space-x-2">
                                                      <button
                                                        onClick={(e) => {
                                                          e.stopPropagation();
                                                          const promptText = suggestion.videoGenerationPrompt || suggestion.prompt || '';
                                                          navigator.clipboard.writeText(promptText).then(() => {
                                                            toast({
                                                              title: "AI prompt copied!",
                                                              description: "Generation prompt copied to clipboard",
                                                            });
                                                          }).catch(() => {
                                                            toast({
                                                              title: "Copy failed",
                                                              description: "Could not copy to clipboard",
                                                              variant: "destructive",
                                                            });
                                                          });
                                                        }}
                                                        className="text-xs text-cyan-600 dark:text-cyan-400 hover:text-cyan-700 dark:hover:text-cyan-300 p-1 rounded hover:bg-cyan-100 dark:hover:bg-cyan-900/20 transition-colors"
                                                        title="Copy AI generation prompt"
                                                      >
                                                        <Copy className="w-3 h-3" />
                                                      </button>
                                                      <div className="text-xs text-slate-400 dark:text-slate-500 bg-slate-100 dark:bg-slate-700 px-2 py-1 rounded">
                                                        Drag to timeline
                                                      </div>
                                                    </div>
                                                  </div>
                                                </div>
                                              </div>
                                            </div>
                                          ))}
                                        </div>
                                      </div>
                                    );
                                  }
                                  
                                  // Render video search results as cards
                                  if (op.type === 'video_search' && op.results && op.results.length > 0) {
                                    return (
                                      <div key={idx} className="bg-gradient-to-r from-blue-50 to-indigo-50 dark:from-blue-900/20 dark:to-indigo-900/20 rounded-lg border border-blue-200 dark:border-blue-700 p-3">
                                        <div className="text-xs font-medium text-blue-800 dark:text-blue-300 mb-3 flex items-center min-w-0">
                                          <Search className="w-3 h-3 mr-2 flex-shrink-0" />
                                          <span className="break-words min-w-0">Search Results for "{op.query}" ({op.totalSegments} segments found)</span>
                                        </div>
                                        <div className="space-y-3">
                                          {op.results.map((result: any, resultIdx: number) => (
                                            <div key={resultIdx} 
                                                 className="bg-white dark:bg-slate-800 rounded-lg border border-slate-200 dark:border-slate-700 p-3 hover:shadow-md transition-all cursor-grab active:cursor-grabbing hover:border-blue-400 dark:hover:border-blue-500"
                                                 draggable={true}
                                                 onDragStart={(e) => {
                                                   // Set drag data for timeline drop
                                                   e.dataTransfer.setData('application/json', JSON.stringify({
                                                     type: 'video_segment',
                                                     startTime: result.startTime,
                                                     endTime: result.endTime,
                                                     description: result.description,
                                                     id: result.id,
                                                     query: op.query
                                                   }));
                                                   // Add visual feedback
                                                   e.currentTarget.style.opacity = '0.5';
                                                 }}
                                                 onDragEnd={(e) => {
                                                   // Reset visual feedback
                                                   e.currentTarget.style.opacity = '1';
                                                 }}
                                                 onClick={() => {
                                                   // Seek video to this timestamp
                                                   if (videoRef.current) {
                                                     videoRef.current.currentTime = result.startTime;
                                                     videoRef.current.play();
                                                   }
                                                 }}>
                                              <div className="flex items-start space-x-3">
                                                {/* Thumbnail */}
                                                <div className="flex-shrink-0">
                                                  <div className="w-16 h-12 bg-slate-200 dark:bg-slate-700 rounded overflow-hidden">
                                                    {result.thumbnailPath ? (
                                                      <img 
                                                        src={result.thumbnailPath} 
                                                        alt={`Segment at ${Math.floor(result.startTime)}s`}
                                                        className="w-full h-full object-cover"
                                                        onError={(e) => {
                                                          e.currentTarget.style.display = 'none';
                                                        }}
                                                      />
                                                    ) : (
                                                      <div className="w-full h-full flex items-center justify-center">
                                                        <Play className="w-4 h-4 text-slate-400" />
                                                      </div>
                                                    )}
                                                  </div>
                                                </div>
                                                
                                                {/* Segment Details */}
                                                <div className="flex-1 min-w-0">
                                                  <div className="flex items-center justify-between mb-1">
                                                    <span className="text-xs font-medium text-blue-600 dark:text-blue-400 bg-blue-100 dark:bg-blue-900/30 px-2 py-1 rounded">
                                                      {Math.floor(result.startTime)}s - {Math.floor(result.endTime)}s
                                                    </span>
                                                    <div className="flex items-center text-xs text-slate-500 dark:text-slate-400">
                                                      <div className="w-1.5 h-1.5 bg-green-500 rounded-full mr-1"></div>
                                                      {Math.round(result.relevanceScore * 100)}% match
                                                    </div>
                                                  </div>
                                                  <p className="text-xs text-slate-700 dark:text-slate-300 mb-1 line-clamp-2 break-words whitespace-pre-wrap">
                                                    {result.description}
                                                  </p>
                                                  <div className="flex items-center justify-between">
                                                    <span className="text-xs text-slate-500 dark:text-slate-400 capitalize">
                                                      {result.matchType} content
                                                    </span>
                                                    <div className="flex items-center space-x-2">
                                                      <span className="text-xs text-blue-500 dark:text-blue-400 font-medium">
                                                        Drag to timeline →
                                                      </span>
                                                      <button className="text-xs text-blue-600 dark:text-blue-400 hover:text-blue-700 dark:hover:text-blue-300 font-medium flex items-center">
                                                        <Play className="w-3 h-3 mr-1" />
                                                        Play
                                                      </button>
                                                    </div>
                                                  </div>
                                                </div>
                                              </div>
                                            </div>
                                          ))}
                                        </div>
                                      </div>
                                    );
                                  }

                                  // Render waveform caption generation as individual SRT segments
                                  if (op.type === 'waveform_caption_generation' && op.captionTrack) {
                                    // Check if this is SRT format with individual segments
                                    const isSRTFormat = op.captionTrack.format === 'srt';
                                    
                                    if (isSRTFormat && op.captionTrack.segments && op.captionTrack.segments.length > 1) {
                                      // Render individual SRT segments as separate draggable cards
                                      return (
                                        <div key={idx} className="bg-gradient-to-r from-blue-50 to-cyan-50 dark:from-blue-900/20 dark:to-cyan-900/20 rounded-lg border border-blue-200 dark:border-blue-700 p-3">
                                          <div className="text-xs font-medium text-blue-800 dark:text-blue-300 mb-3 flex items-center">
                                            <BarChart3 className="w-3 h-3 mr-2" />
                                            SRT Caption Segments ({op.captionTrack.segmentCount})
                                          </div>
                                          
                                          {/* Individual SRT Segments */}
                                          <div className="space-y-2 max-h-96 overflow-y-auto">
                                            {op.captionTrack.segments.map((segment: any, segmentIdx: number) => (
                                              <div 
                                                key={`${idx}-segment-${segmentIdx}`}
                                                className="bg-white dark:bg-slate-800 rounded-lg border border-slate-200 dark:border-slate-700 p-2 hover:shadow-md transition-all cursor-grab active:cursor-grabbing hover:border-blue-400 dark:hover:border-blue-500"
                                                draggable={true}
                                                onDragStart={(e) => {
                                                  // Set drag data for individual segment drop
                                                  e.dataTransfer.setData('application/json', JSON.stringify({
                                                    type: 'single_caption_segment',
                                                    segmentData: segment,
                                                    id: segment.id,
                                                    srtIndex: segment.srtIndex
                                                  }));
                                                  e.currentTarget.style.opacity = '0.5';
                                                }}
                                                onDragEnd={(e) => {
                                                  e.currentTarget.style.opacity = '1';
                                                }}
                                              >
                                                <div className="flex items-start space-x-3">
                                                  <div className="flex-shrink-0">
                                                    <div className="w-8 h-8 bg-gradient-to-br from-blue-100 to-cyan-100 dark:from-blue-800 dark:to-cyan-800 rounded flex items-center justify-center">
                                                      <span className="text-xs font-bold text-blue-600 dark:text-blue-400">
                                                        {segment.srtIndex}
                                                      </span>
                                                    </div>
                                                  </div>
                                                  
                                                  <div className="flex-1 min-w-0">
                                                    <div className="flex items-center space-x-2 mb-1">
                                                      <span className="text-xs font-medium text-blue-600 dark:text-blue-400">
                                                        {Math.round(segment.startTime)}s - {Math.round(segment.endTime)}s
                                                      </span>
                                                      <div className="text-xs text-slate-500 dark:text-slate-400">
                                                        ({(segment.confidence * 100).toFixed(1)}%)
                                                      </div>
                                                    </div>
                                                    <p className="text-xs text-slate-700 dark:text-slate-300 line-clamp-2">
                                                      {segment.text}
                                                    </p>
                                                  </div>
                                                </div>
                                              </div>
                                            ))}
                                          </div>
                                          
                                          <div className="mt-3 text-xs text-slate-500 dark:text-slate-400 text-center">
                                            Drag individual segments to timeline
                                          </div>
                                        </div>
                                      );
                                    } else {
                                      // Fallback to single card for non-SRT or single segment
                                      return (
                                        <div key={idx} className="bg-gradient-to-r from-blue-50 to-cyan-50 dark:from-blue-900/20 dark:to-cyan-900/20 rounded-lg border border-blue-200 dark:border-blue-700 p-3">
                                          <div className="text-xs font-medium text-blue-800 dark:text-blue-300 mb-3 flex items-center">
                                            <BarChart3 className="w-3 h-3 mr-2" />
                                            Waveform-Aligned Captions
                                          </div>
                                          <div 
                                            className="bg-white dark:bg-slate-800 rounded-lg border border-slate-200 dark:border-slate-700 p-3 hover:shadow-md transition-all cursor-grab active:cursor-grabbing hover:border-blue-400 dark:hover:border-blue-500"
                                            draggable={true}
                                            onDragStart={(e) => {
                                              e.dataTransfer.setData('application/json', JSON.stringify({
                                                type: 'caption_track',
                                                captionData: op.captionTrack,
                                                id: op.captionTrack.id,
                                                name: op.captionTrack.name
                                              }));
                                              e.currentTarget.style.opacity = '0.5';
                                            }}
                                            onDragEnd={(e) => {
                                              e.currentTarget.style.opacity = '1';
                                            }}
                                          >
                                            <div className="flex items-start space-x-3">
                                              <div className="flex-shrink-0">
                                                <div className="w-20 h-20 bg-gradient-to-br from-blue-100 to-cyan-100 dark:from-blue-800 dark:to-cyan-800 rounded-lg flex items-center justify-center">
                                                  <BarChart3 className="w-8 h-8 text-blue-600 dark:text-blue-400" />
                                                </div>
                                              </div>
                                              
                                              <div className="flex-1 min-w-0">
                                                <div className="flex items-center space-x-2 mb-1">
                                                  <span className="text-xs font-medium text-blue-600 dark:text-blue-400 uppercase tracking-wider">
                                                    Captions
                                                  </span>
                                                  <div className="w-1 h-1 bg-slate-400 rounded-full"></div>
                                                  <span className="text-xs text-slate-500 dark:text-slate-400">
                                                    Waveform-Aligned
                                                  </span>
                                                </div>
                                                <p className="text-sm font-medium text-slate-900 dark:text-white mb-1">
                                                  {op.captionTrack.name}
                                                </p>
                                                <p className="text-xs text-slate-600 dark:text-slate-300 mb-2">
                                                  🌊 {op.captionTrack.segmentCount} segments • {Math.round(op.captionTrack.totalDuration)}s • {op.waveformStats ? (op.waveformStats.averageConfidence * 100).toFixed(1) : '97.1'}% confidence
                                                </p>
                                                <div className="flex items-center justify-between">
                                                  <span className="text-xs text-slate-500 dark:text-slate-400">
                                                    {op.captionTrack.language || 'English'}
                                                  </span>
                                                  <div className="text-xs text-slate-400 dark:text-slate-500 bg-slate-100 dark:bg-slate-700 px-2 py-1 rounded">
                                                    Drag to timeline
                                                  </div>
                                                </div>
                                              </div>
                                            </div>
                                          </div>
                                        </div>
                                      );
                                    }
                                  }
                                  
                                  // Render other operations as before
                                  return (
                                    <div key={idx} className="p-3 bg-gradient-to-r from-green-50 to-emerald-50 dark:from-green-900/20 dark:to-emerald-900/20 rounded-lg border border-green-200 dark:border-green-700 min-w-0">
                                      <div className="text-xs font-medium text-green-800 dark:text-green-300 mb-2 flex items-center min-w-0">
                                        <div className="w-1.5 h-1.5 bg-green-500 rounded-full mr-2 flex-shrink-0"></div>
                                        <span className="break-words min-w-0">Operation Applied</span>
                                      </div>
                                      <p className="text-xs text-green-700 dark:text-green-400 break-words whitespace-pre-wrap">• {op.description || op.type}</p>
                                    </div>
                                  );
                                })}
                              </div>
                            )}
                          </div>
                        </div>
                      </div>
                    )}
                    <div className={`text-xs text-slate-500 dark:text-slate-400 px-3 ${message.type === 'user' ? 'text-right' : 'text-left ml-11'}`}>
                      {new Date(message.timestamp).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}
                    </div>
                  </div>
                ))}
                
                {/* Typing Animation */}
                {isTyping && (
                  <div className="flex flex-col space-y-1">
                    <div className="flex justify-start">
                      <div className="flex items-end space-x-2 max-w-[85%] min-w-0">
                        <div className="w-8 h-8 bg-purple-500 rounded-full flex items-center justify-center text-white text-xs font-semibold flex-shrink-0">
                          AI
                        </div>
                        <div className="bg-white dark:bg-slate-800 text-slate-900 dark:text-slate-100 rounded-2xl rounded-bl-md px-4 py-3 shadow-lg border border-slate-200 dark:border-slate-700 min-w-0">
                          <div className="flex items-center gap-2">
                            <div className="flex gap-1">
                              <div className="w-2 h-2 bg-slate-400 rounded-full animate-pulse"></div>
                              <div className="w-2 h-2 bg-slate-400 rounded-full animate-pulse" style={{ animationDelay: '0.2s' }}></div>
                              <div className="w-2 h-2 bg-slate-400 rounded-full animate-pulse" style={{ animationDelay: '0.4s' }}></div>
                            </div>
                            <span className="text-sm text-slate-500 dark:text-slate-400">Thinking...</span>
                          </div>
                        </div>
                      </div>
                    </div>
                  </div>
                )}
              </div>
            </div>

            {/* Modern Chat Input */}
            <div className="p-4 bg-white dark:bg-slate-800 border-t border-slate-200 dark:border-slate-700 flex-shrink-0">
              <div className="flex items-end space-x-3 max-w-full">
                <div className="flex-1 relative min-w-0">
                  <input
                    type="text"
                    value={chatInput}
                    onChange={(e) => setChatInput(e.target.value)}
                    onKeyPress={handleChatKeyPress}
                    placeholder="Message AI Assistant..."
                    className="w-full bg-slate-100 dark:bg-slate-700 border border-slate-200 dark:border-slate-600 text-slate-900 dark:text-white placeholder-slate-500 dark:placeholder-slate-400 rounded-2xl px-4 py-3 pr-12 focus:outline-none focus:ring-2 focus:ring-violet-500 focus:border-transparent transition-all duration-200 min-w-0"
                    disabled={agenticChatMutation.isPending}
                    autoComplete="off"
                  />
                  <div className="absolute right-3 top-1/2 transform -translate-y-1/2">
                    <Button
                      onClick={sendChatMessage}
                      disabled={!chatInput.trim() || agenticChatMutation.isPending}
                      className="bg-gradient-to-r from-violet-500 to-purple-600 hover:from-violet-600 hover:to-purple-700 disabled:from-slate-300 disabled:to-slate-400 text-white border-0 rounded-xl p-2 h-8 w-8 shadow-lg transition-all duration-200 disabled:shadow-none"
                    >
                      {agenticChatMutation.isPending ? (
                        <Loader className="w-4 h-4 animate-spin" />
                      ) : (
                        <Send className="w-4 h-4" />
                      )}
                    </Button>
                  </div>
                </div>
              </div>
              <div className="mt-2 flex items-center justify-center">
                <p className="text-xs text-slate-500 dark:text-slate-400">
                  AI can make mistakes. Verify important edits.
                </p>
              </div>
            </div>

            {/* Quick Action Buttons */}
            <div className="p-3 bg-slate-50 dark:bg-slate-900 border-t border-slate-200 dark:border-slate-700">
              <div className="text-xs font-medium text-slate-600 dark:text-slate-400 mb-2">Quick Actions</div>
              
              {/* Search Input Section */}
              {showSearchInput && (
                <div className="mb-3">
                  <div className="flex space-x-2">
                    <input
                      type="text"
                      value={searchInput}
                      onChange={(e) => setSearchInput(e.target.value)}
                      placeholder="What would you like to search for?"
                      className="flex-1 text-xs px-3 py-2 bg-white dark:bg-slate-700 border border-slate-200 dark:border-slate-600 rounded-lg focus:outline-none focus:ring-2 focus:ring-orange-500 focus:border-transparent"
                      onKeyPress={(e) => {
                        if (e.key === 'Enter' && searchInput.trim()) {
                          const message = `Search for ${searchInput.trim()}`;
                          
                          // Add user message to chat
                          const userMessage: ChatMessage = {
                            id: nanoid(),
                            type: 'user',
                            content: message,
                            timestamp: new Date().toISOString()
                          };
                          setChatMessages(prev => [...prev, userMessage]);
                          
                          // Send to agent
                          agenticChatMutation.mutate({
                            message,
                            sessionId: agentSessionId,
                            videoContext: {
                              tracks: videoComposition.tracks,
                              totalDuration: videoComposition.totalDuration,
                              currentTime: videoComposition.currentTime,
                              currentVideo: currentVideo,
                              videoPath: currentVideo ? currentVideo.filename : null,
                              videoFilename: currentVideo ? currentVideo.originalName : null
                            }
                          });
                          
                          // Reset and close search input
                          setSearchInput('');
                          setShowSearchInput(false);
                        }
                      }}
                      autoFocus
                    />
                    <Button
                      variant="outline"
                      size="sm"
                      onClick={() => {
                        if (searchInput.trim()) {
                          const message = `Search for ${searchInput.trim()}`;
                          
                          // Add user message to chat
                          const userMessage: ChatMessage = {
                            id: nanoid(),
                            type: 'user',
                            content: message,
                            timestamp: new Date().toISOString()
                          };
                          setChatMessages(prev => [...prev, userMessage]);
                          
                          // Send to agent
                          agenticChatMutation.mutate({
                            message,
                            sessionId: agentSessionId,
                            videoContext: {
                              tracks: videoComposition.tracks,
                              totalDuration: videoComposition.totalDuration,
                              currentTime: videoComposition.currentTime,
                              currentVideo: currentVideo,
                              videoPath: currentVideo ? currentVideo.filename : null,
                              videoFilename: currentVideo ? currentVideo.originalName : null
                            }
                          });
                          
                          // Reset and close search input
                          setSearchInput('');
                          setShowSearchInput(false);
                        }
                      }}
                      disabled={!searchInput.trim() || agenticChatMutation.isPending}
                      className="text-xs h-8 px-3"
                    >
                      <Search className="w-3 h-3" />
                    </Button>
                    <Button
                      variant="ghost"
                      size="sm"
                      onClick={() => {
                        setShowSearchInput(false);
                        setSearchInput('');
                      }}
                      className="text-xs h-8 px-2"
                    >
                      <X className="w-3 h-3" />
                    </Button>
                  </div>
                </div>
              )}

              {showVideoGenerationInput && (
                <div className="mb-3">
                  <div className="flex space-x-2">
                    <Input
                      placeholder="Describe the video to generate..."
                      value={videoGenerationInput}
                      onChange={(e) => setVideoGenerationInput(e.target.value)}
                      onKeyDown={(e) => {
                        if (e.key === 'Enter' && videoGenerationInput.trim()) {
                          const message = `Generate video: ${videoGenerationInput}`;
                          
                          // Add user message to chat
                          const userMessage: ChatMessage = {
                            id: nanoid(),
                            type: 'user',
                            content: message,
                            timestamp: new Date().toISOString()
                          };
                          setChatMessages(prev => [...prev, userMessage]);
                          
                          // Send to agent
                          agenticChatMutation.mutate({
                            message,
                            sessionId: agentSessionId,
                            videoContext: {
                              tracks: videoComposition.tracks,
                              totalDuration: videoComposition.totalDuration,
                              currentTime: videoComposition.currentTime,
                              currentVideo: currentVideo,
                              videoPath: currentVideo ? currentVideo.filename : null,
                              videoFilename: currentVideo ? currentVideo.originalName : null
                            }
                          });
                          
                          setVideoGenerationInput('');
                          setShowVideoGenerationInput(false);
                        }
                      }}
                      className="flex-1 text-sm h-8"
                    />
                    <Button
                      variant="outline"
                      size="sm"
                      onClick={() => {
                        if (videoGenerationInput.trim()) {
                          const message = `Generate video: ${videoGenerationInput.trim()}`;
                          
                          // Add user message to chat
                          const userMessage: ChatMessage = {
                            id: nanoid(),
                            type: 'user',
                            content: message,
                            timestamp: new Date().toISOString()
                          };
                          setChatMessages(prev => [...prev, userMessage]);
                          
                          // Send to agent
                          agenticChatMutation.mutate({
                            message,
                            sessionId: agentSessionId,
                            videoContext: {
                              tracks: videoComposition.tracks,
                              totalDuration: videoComposition.totalDuration,
                              currentTime: videoComposition.currentTime,
                              currentVideo: currentVideo,
                              videoPath: currentVideo ? currentVideo.filename : null,
                              videoFilename: currentVideo ? currentVideo.originalName : null
                            }
                          });
                          
                          setVideoGenerationInput('');
                          setShowVideoGenerationInput(false);
                        }
                      }}
                      disabled={!videoGenerationInput.trim() || agenticChatMutation.isPending}
                      className="text-xs h-8 px-3 text-purple-600 dark:text-purple-400 border-purple-200 dark:border-purple-800 hover:bg-purple-50 dark:hover:bg-purple-900/20"
                    >
                      <Wand2 className="w-3 h-3" />
                    </Button>
                    <Button
                      variant="ghost"
                      size="sm"
                      onClick={() => {
                        setShowVideoGenerationInput(false);
                        setVideoGenerationInput('');
                      }}
                      className="text-xs h-8 px-2"
                    >
                      <X className="w-3 h-3" />
                    </Button>
                  </div>
                </div>
              )}
              
              <div className="grid grid-cols-2 gap-2">
                <Button
                  variant="outline"
                  size="sm"
                  onClick={() => {
                    const message = "Translate to Spanish";
                    
                    // Add user message to chat
                    const userMessage: ChatMessage = {
                      id: nanoid(),
                      type: 'user',
                      content: message,
                      timestamp: new Date().toISOString()
                    };
                    setChatMessages(prev => [...prev, userMessage]);
                    
                    // Send to agent
                    agenticChatMutation.mutate({
                      message,
                      sessionId: agentSessionId,
                      videoContext: {
                        tracks: videoComposition.tracks,
                        totalDuration: videoComposition.totalDuration,
                        currentTime: videoComposition.currentTime,
                        currentVideo: currentVideo,
                        videoPath: currentVideo ? currentVideo.filename : null,
                        videoFilename: currentVideo ? currentVideo.originalName : null
                      }
                    });
                  }}
                  disabled={!currentVideo || agenticChatMutation.isPending}
                  className="text-xs h-8 text-green-600 dark:text-green-400 border-green-200 dark:border-green-800 hover:bg-green-50 dark:hover:bg-green-900/20"
                >
                  <Globe className="w-3 h-3 mr-1" />
                  Translate
                </Button>
                
                <Button
                  variant="outline"
                  size="sm"
                  onClick={() => {
                    setShowSearchInput(true);
                  }}
                  disabled={!currentVideo || agenticChatMutation.isPending}
                  className="text-xs h-8 text-orange-600 dark:text-orange-400 border-orange-200 dark:border-orange-800 hover:bg-orange-50 dark:hover:bg-orange-900/20"
                >
                  <Search className="w-3 h-3 mr-1" />
                  Search
                </Button>
              </div>
              
              <div className="grid grid-cols-2 gap-2 mt-2">
                <Button
                  variant="outline"
                  size="sm"
                  onClick={() => {
                    setShowVideoGenerationInput(true);
                  }}
                  disabled={agenticChatMutation.isPending}
                  className="text-xs h-8 text-purple-600 dark:text-purple-400 border-purple-200 dark:border-purple-800 hover:bg-purple-50 dark:hover:bg-purple-900/20"
                >
                  <Wand2 className="w-3 h-3 mr-1" />
                  Generate Video
                </Button>
                
                <div className="relative">
                  <Button
                    variant="outline"
                    size="sm"
                    onClick={() => setShowSubtitleStyles(!showSubtitleStyles)}
                    disabled={!currentVideo || agenticChatMutation.isPending}
                    className="text-xs h-8 text-blue-600 dark:text-blue-400 border-blue-200 dark:border-blue-800 hover:bg-blue-50 dark:hover:bg-blue-900/20 w-full"
                  >
                    <Languages className="w-3 h-3 mr-1" />
                    Subtitles
                    <ChevronDown className={`w-3 h-3 ml-1 transition-transform ${showSubtitleStyles ? 'rotate-180' : ''}`} />
                  </Button>
                  
                  {/* Subtitle Styling Panel */}
                  {showSubtitleStyles && (
                    <div className="absolute bottom-full left-0 mb-2 p-4 bg-slate-900/95 backdrop-blur-xl rounded-lg border border-purple-500/30 shadow-xl z-50 min-w-[300px]">
                      <div className="flex items-center justify-between mb-3">
                        <h4 className="text-sm font-medium text-white">Professional Subtitle Styles</h4>
                        <Button
                          variant="ghost"
                          size="sm"
                          onClick={() => setShowSubtitleStyles(false)}
                          className="p-1 h-6 w-6 text-gray-400 hover:text-white hover:bg-slate-800/50"
                          title="Close Effects Panel"
                        >
                          <X className="w-4 h-4" />
                        </Button>
                      </div>
                      
                      <div className="space-y-3">
                        {/* Style Selection */}
                        <div>
                          <label className="text-xs text-gray-400 block mb-1">Style</label>
                          <select 
                            value={subtitleSettings.style} 
                            onChange={(e) => setSubtitleSettings(prev => ({ ...prev, style: e.target.value }))}
                            className="w-full bg-slate-800 border border-slate-600 rounded px-2 py-1 text-sm text-white"
                          >
                            <option value="bold">Bold (YouTube Style)</option>
                            <option value="outlined">Outlined</option>
                            <option value="neon">Neon Glow</option>
                            <option value="cinematic">Cinematic</option>
                          </select>
                        </div>
                        
                        {/* Font Size */}
                        <div>
                          <label className="text-xs text-gray-400 block mb-1">Font Size: {subtitleSettings.fontSize}px</label>
                          <input 
                            type="range" 
                            min="40" 
                            max="120" 
                            value={subtitleSettings.fontSize} 
                            onChange={(e) => setSubtitleSettings(prev => ({ ...prev, fontSize: parseInt(e.target.value) }))}
                            className="w-full accent-blue-500"
                          />
                        </div>
                        
                        {/* Text Color */}
                        <div className="grid grid-cols-2 gap-2">
                          <div>
                            <label className="text-xs text-gray-400 block mb-1">Text Color</label>
                            <input 
                              type="color" 
                              value={subtitleSettings.textColor} 
                              onChange={(e) => setSubtitleSettings(prev => ({ ...prev, textColor: e.target.value }))}
                              className="w-full h-8 rounded border border-slate-600"
                            />
                          </div>
                          
                          <div>
                            <label className="text-xs text-gray-400 block mb-1">Border Color</label>
                            <input 
                              type="color" 
                              value={subtitleSettings.borderColor} 
                              onChange={(e) => setSubtitleSettings(prev => ({ ...prev, borderColor: e.target.value }))}
                              className="w-full h-8 rounded border border-slate-600"
                            />
                          </div>
                        </div>
                        
                        {/* Generate Button */}
                        <Button
                          onClick={() => {
                            const message = `Generate subtitles with ${subtitleSettings.style} style, ${subtitleSettings.fontSize}px font size, word highlighting enabled`;
                            
                            // Add user message to chat
                            const userMessage: ChatMessage = {
                              id: nanoid(),
                              type: 'user',
                              content: message,
                              timestamp: new Date().toISOString()
                            };
                            setChatMessages(prev => [...prev, userMessage]);
                            
                            // Send to agent with subtitle settings
                            agenticChatMutation.mutate({
                              message,
                              sessionId: agentSessionId,
                              subtitleSettings: subtitleSettings,
                              videoContext: {
                                tracks: videoComposition.tracks,
                                totalDuration: videoComposition.totalDuration,
                                currentTime: videoComposition.currentTime,
                                currentVideo: currentVideo,
                                videoPath: currentVideo ? currentVideo.filename : null,
                                videoFilename: currentVideo ? currentVideo.originalName : null
                              }
                            });
                            
                            setShowSubtitleStyles(false);
                          }}
                          className="w-full bg-blue-600 hover:bg-blue-700 text-white"
                          size="sm"
                        >
                          Generate Professional Subtitles
                        </Button>
                      </div>
                    </div>
                  )}
                </div>
              </div>
            </div>
          </div>
        )}
        
        {/* Export Success Modal */}
        <Dialog open={showExportModal} onOpenChange={setShowExportModal}>
          <DialogContent className="max-w-2xl">
            <DialogHeader>
              <DialogTitle className="text-xl font-semibold">Export Complete!</DialogTitle>
              <DialogDescription>
                Your video has been successfully exported and is ready for download.
              </DialogDescription>
            </DialogHeader>
            
            <div className="space-y-4">
              {/* Video Preview */}
              {exportData && (
                <div className="relative rounded-lg overflow-hidden bg-black">
                  <video
                    controls
                    autoPlay
                    muted
                    className="w-full h-auto max-h-96"
                    onError={(e) => {
                      console.error('Video preview error:', e);
                    }}
                  >
                    <source src={`/api/video/${exportData.filename}`} type="video/mp4" />
                    Your browser does not support the video tag.
                  </video>
                  
                  {/* Video Info Overlay */}
                  <div className="absolute bottom-0 left-0 right-0 bg-gradient-to-t from-black/80 to-transparent p-4">
                    <div className="text-white">
                      <h4 className="font-medium">{exportData.filename}</h4>
                      <div className="flex items-center space-x-4 text-sm text-gray-300 mt-1">
                        {exportData.fileSize && (
                          <span>{(exportData.fileSize / (1024 * 1024)).toFixed(2)} MB</span>
                        )}
                        {exportData.duration && (
                          <span>{Math.round(exportData.duration)}s</span>
                        )}
                      </div>
                    </div>
                  </div>
                </div>
              )}
              
              {/* Download Button */}
              <div className="flex justify-end space-x-3">
                <Button
                  variant="outline"
                  onClick={() => setShowExportModal(false)}
                >
                  Close
                </Button>
                
                <Button
                  className="bg-blue-600 hover:bg-blue-700 text-white"
                  onClick={() => {
                    if (exportData) {
                      const downloadUrl = `/api/video/${exportData.filename}?download=true`;
                      const link = document.createElement('a');
                      link.href = downloadUrl;
                      link.download = exportData.filename;
                      link.setAttribute('target', '_blank');
                      document.body.appendChild(link);
                      link.click();
                      document.body.removeChild(link);
                      
                      toast({
                        title: "Download Started",
                        description: `Downloading ${exportData.filename}`,
                      });
                    }
                  }}
                >
                  <Download className="w-4 h-4 mr-2" />
                  Download Video
                </Button>
              </div>
            </div>
          </DialogContent>
        </Dialog>
        
        {/* Token Exhaustion Modal */}
        <Dialog open={showTokenExhaustionModal} onOpenChange={setShowTokenExhaustionModal}>
          <DialogContent className="max-w-md">
            <DialogHeader>
              <DialogTitle className="text-xl font-semibold text-red-600 flex items-center">
                🚫 App Tokens Exhausted
              </DialogTitle>
              <DialogDescription>
                You have used all available tokens for your current plan.
              </DialogDescription>
            </DialogHeader>
            
            <div className="space-y-4">
              {tokenExhaustionData && (
                <div className="bg-red-50 dark:bg-red-950/30 border border-red-200 dark:border-red-800 rounded-lg p-4">
                  <div className="space-y-2 text-sm">
                    {tokenExhaustionData.type === 'token_exhausted' ? (
                      <>
                        <div className="flex justify-between">
                          <span className="font-medium">Used Tokens:</span>
                          <span className="text-red-600 dark:text-red-400">{tokenExhaustionData.usedTokens?.toLocaleString() || 'N/A'}</span>
                        </div>
                        <div className="flex justify-between">
                          <span className="font-medium">Total Tokens:</span>
                          <span>{tokenExhaustionData.totalTokens?.toLocaleString() || 'N/A'}</span>
                        </div>
                        <div className="flex justify-between">
                          <span className="font-medium">Remaining:</span>
                          <span className="text-red-600 dark:text-red-400">0</span>
                        </div>
                      </>
                    ) : (
                      <>
                        <div className="flex justify-between">
                          <span className="font-medium">Current Tokens:</span>
                          <span className="text-red-600 dark:text-red-400">{tokenExhaustionData.tokenBalance?.toLocaleString() || 'N/A'}</span>
                        </div>
                        <div className="flex justify-between">
                          <span className="font-medium">Required:</span>
                          <span>{tokenExhaustionData.minimumRequired?.toLocaleString() || 'N/A'}</span>
                        </div>
                        <div className="flex justify-between">
                          <span className="font-medium">Operation:</span>
                          <span className="capitalize">{tokenExhaustionData.operationType?.replace('_', ' ') || 'AI Operation'}</span>
                        </div>
                      </>
                    )}
                  </div>
                  
                  <div className="mt-3 p-3 bg-white dark:bg-slate-900 rounded border text-sm">
                    <p className="text-slate-600 dark:text-slate-400">
                      {tokenExhaustionData.response || 'Please upgrade your plan or wait for token renewal to continue using AI features.'}
                    </p>
                  </div>
                </div>
              )}
              
              <div className="space-y-3">
                <p className="text-sm text-slate-600 dark:text-slate-400">
                  To continue using AI features, please:
                </p>
                <ul className="text-sm text-slate-600 dark:text-slate-400 space-y-1 pl-4">
                  <li>• Upgrade to a higher tier plan</li>
                  <li>• Wait for your monthly token renewal</li>
                  <li>• Use manual editing features (no tokens required)</li>
                </ul>
              </div>
              
              <div className="flex justify-end space-x-3">
                <Button
                  variant="outline"
                  onClick={() => setShowTokenExhaustionModal(false)}
                >
                  Continue Editing
                </Button>
                
                <Button
                  className="bg-blue-600 hover:bg-blue-700 text-white"
                  onClick={() => {
                    setShowTokenExhaustionModal(false);
                    // Redirect to account page to upgrade
                    window.location.href = '/account';
                  }}
                >
                  Upgrade Plan
                </Button>
              </div>
            </div>
          </DialogContent>
        </Dialog>

        {/* Video Overlay Modal */}
        <Dialog open={showVideoOverlay} onOpenChange={setShowVideoOverlay}>
          <DialogContent className="max-w-sm max-h-[85vh] p-0 bg-black border-slate-700 overflow-hidden">
            <div className="relative flex flex-col h-full">
              {/* Close Button */}
              <button
                onClick={() => setShowVideoOverlay(false)}
                className="absolute top-2 right-2 z-50 bg-black/70 hover:bg-black/90 text-white rounded-full p-1.5 transition-colors"
              >
                <X className="w-4 h-4" />
              </button>

              {overlayVideoData && (
                <div className="flex flex-col h-full">
                  {/* Video Player - Fixed 9:16 aspect ratio */}
                  <div className="relative aspect-[9/16] bg-black flex items-center justify-center flex-shrink-0">
                    {overlayVideoData.videoPath ? (
                      <video
                        className="w-full h-full object-contain"
                        src={`/api/video/${overlayVideoData.videoPath.split('/').pop()}`}
                        controls
                        autoPlay
                        onError={(e) => {
                          console.error('Video overlay playback error:', e);
                        }}
                      />
                    ) : (
                      <div className="text-white text-center">
                        <Play className="w-12 h-12 mx-auto mb-2 opacity-50" />
                        <p className="text-sm">Video not available</p>
                      </div>
                    )}
                  </div>

                  {/* Video Info - Scrollable */}
                  <div className="flex-1 overflow-y-auto bg-slate-900 text-white">
                    <div className="p-4 space-y-3">
                      <div>
                        <h3 className="text-sm font-semibold mb-1">{overlayVideoData.title}</h3>
                        <p className="text-xs text-slate-300 line-clamp-2">{overlayVideoData.description}</p>
                      </div>

                      {/* Compact Stats Grid */}
                      <div className="grid grid-cols-3 gap-2 text-center">
                        <div className="bg-slate-800 rounded p-2">
                          <Clock className="w-3 h-3 text-blue-400 mx-auto mb-1" />
                          <div className="text-sm font-semibold">{overlayVideoData.duration}s</div>
                          <div className="text-xs text-slate-400">Duration</div>
                        </div>
                        <div className="bg-slate-800 rounded p-2">
                          <TrendingUp className="w-3 h-3 text-orange-400 mx-auto mb-1" />
                          <div className="text-sm font-semibold">{overlayVideoData.viralScore}/10</div>
                          <div className="text-xs text-slate-400">Viral</div>
                        </div>
                        <div className="bg-slate-800 rounded p-2">
                          <Users className="w-3 h-3 text-green-400 mx-auto mb-1" />
                          <div className="text-sm font-semibold">{overlayVideoData.engagementFactors?.length || 0}</div>
                          <div className="text-xs text-slate-400">Factors</div>
                        </div>
                      </div>

                      {/* Engagement Factors - Compact */}
                      {overlayVideoData.engagementFactors && overlayVideoData.engagementFactors.length > 0 && (
                        <div>
                          <h4 className="text-xs font-medium mb-1 text-slate-300">Engagement Factors</h4>
                          <div className="flex flex-wrap gap-1">
                            {overlayVideoData.engagementFactors.slice(0, 4).map((factor, idx) => (
                              <span key={idx} className="inline-block px-2 py-0.5 text-xs bg-orange-900/30 text-orange-300 rounded-full">
                                {factor}
                              </span>
                            ))}
                            {overlayVideoData.engagementFactors.length > 4 && (
                              <span className="inline-block px-2 py-0.5 text-xs bg-slate-700 text-slate-400 rounded-full">
                                +{overlayVideoData.engagementFactors.length - 4}
                              </span>
                            )}
                          </div>
                        </div>
                      )}

                      {/* Key Moments - Compact */}
                      {overlayVideoData.keyMoments && overlayVideoData.keyMoments.length > 0 && (
                        <div>
                          <h4 className="text-xs font-medium mb-1 text-slate-300">Key Moments</h4>
                          <div className="space-y-1">
                            {overlayVideoData.keyMoments.slice(0, 2).map((moment, idx) => (
                              <div key={idx} className="flex items-start space-x-2 text-xs">
                                <span className="text-blue-400 font-mono">{moment.timestamp}s</span>
                                <span className="text-slate-300 line-clamp-1">{moment.description}</span>
                              </div>
                            ))}
                          </div>
                        </div>
                      )}

                      {/* Action Button */}
                      <div className="pt-2 border-t border-slate-700">
                        <Button
                          onClick={() => setShowVideoOverlay(false)}
                          className="w-full bg-slate-700 hover:bg-slate-600 text-white text-sm py-2"
                        >
                          Close Preview
                        </Button>
                      </div>
                    </div>
                  </div>
                </div>
              )}
            </div>
          </DialogContent>
        </Dialog>
      </div>
    </div>
  );
}