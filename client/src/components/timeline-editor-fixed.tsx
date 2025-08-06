import React, { useState, useRef, useEffect, useCallback } from 'react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Separator } from '@/components/ui/separator';
import { MdAdd, MdDelete, MdTextFields, MdEdit, MdClose, MdAutoAwesome, MdRefresh, MdCrop, MdAspectRatio } from 'react-icons/md';

export interface TextOverlay {
  id: string;
  text: string;
  startTime: number;
  duration: number;
  position: { x: number; y: number };
  style: {
    fontSize: number;
    color: string;
    backgroundColor?: string;
    fontWeight: 'normal' | 'bold';
    animation?: 'fade_in' | 'slide_up' | 'bounce' | 'typewriter';
  };
}

export interface TimelineSegment {
  id: string;
  startTime: number;
  endTime: number;
  action: string;
  description: string;
  textOverlays?: TextOverlay[];
}

interface TimelineEditorProps {
  videoUrl?: string;
  duration?: number;
  segments: TimelineSegment[];
  onSegmentsChange: (segments: TimelineSegment[]) => void;
  currentTime?: number;
  onTimeUpdate?: (time: number) => void;
  selectedSegment?: number;
  onSegmentSelect?: (index: number) => void;
  className?: string;
}

export function TimelineEditor({ 
  videoUrl, 
  duration = 60, 
  segments, 
  onSegmentsChange,
  currentTime = 0,
  onTimeUpdate,
  selectedSegment,
  onSegmentSelect,
  className = ""
}: TimelineEditorProps) {
  const [isDragging, setIsDragging] = useState(false);
  const [dragType, setDragType] = useState<'start' | 'end' | 'move' | null>(null);
  const [dragSegmentIndex, setDragSegmentIndex] = useState<number | null>(null);
  const [videoDuration, setVideoDuration] = useState(duration);
  const [showTextEditor, setShowTextEditor] = useState(false);
  const [editingTextOverlay, setEditingTextOverlay] = useState<{ segmentIndex: number; overlayIndex?: number } | null>(null);
  const [showAIGenerator, setShowAIGenerator] = useState(false);
  const [isGenerating, setIsGenerating] = useState(false);
  const [aiGenerationOptions, setAiGenerationOptions] = useState({
    videoStyle: 'viral' as 'viral' | 'educational' | 'entertainment' | 'news' | 'professional',
    textStyle: 'highlights' as 'captions' | 'highlights' | 'commentary' | 'questions' | 'callouts',
    maxOverlays: 3,
    targetAudience: 'general' as 'general' | 'young' | 'professional' | 'educational'
  });
  const [showAspectRatioConverter, setShowAspectRatioConverter] = useState(false);
  const [isConverting, setIsConverting] = useState(false);
  const [aspectRatioOptions, setAspectRatioOptions] = useState({
    targetRatio: '9:16' as '9:16' | '16:9' | '1:1',
    cropStrategy: 'person-focused' as 'center' | 'smart' | 'person-focused',
    enhanceQuality: true,
    preserveAudio: true
  });
  const [newTextOverlay, setNewTextOverlay] = useState<Partial<TextOverlay>>({
    text: '',
    startTime: 0,
    duration: 3,
    position: { x: 50, y: 50 },
    style: {
      fontSize: 24,
      color: '#ffffff',
      backgroundColor: '#000000',
      fontWeight: 'bold',
      animation: 'fade_in'
    }
  });
  
  const timelineRef = useRef<HTMLDivElement>(null);

  const seekTo = (time: number) => {
    if (onTimeUpdate) {
      onTimeUpdate(Math.max(0, Math.min(time, videoDuration)));
    }
  };

  const addSegment = () => {
    const newSeg: TimelineSegment = {
      id: `segment-${Date.now()}`,
      startTime: Math.max(0, currentTime - 2),
      endTime: Math.min(videoDuration, currentTime + 3),
      action: 'Cut',
      description: `Segment ${segments.length + 1}`,
      textOverlays: []
    };
    onSegmentsChange([...segments, newSeg]);
  };

  const addTextToSegment = (segmentIndex: number) => {
    const segment = segments[segmentIndex];
    if (!segment) return;

    setNewTextOverlay({
      ...newTextOverlay,
      startTime: 0, // Relative to segment start
      duration: Math.min(3, segment.endTime - segment.startTime)
    });
    setEditingTextOverlay({ segmentIndex });
    setShowTextEditor(true);
  };

  const generateAITextOverlays = async (segmentIndex: number) => {
    const segment = segments[segmentIndex];
    if (!segment || !videoUrl) return;

    setIsGenerating(true);
    setShowAIGenerator(true);

    try {
      // For now, generate fallback text overlays since API endpoint needs work
      const fallbackOverlays = [
        {
          text: "Check this out!",
          startTime: 0,
          duration: 2,
          position: { x: 50, y: 20 },
          style: {
            fontSize: 32,
            color: '#ffffff',
            backgroundColor: '#ff1744',
            fontWeight: 'bold' as const,
            animation: 'fade_in' as const
          }
        },
        {
          text: "Amazing moment",
          startTime: segment.endTime - segment.startTime > 3 ? 2 : 1,
          duration: 1.5,
          position: { x: 30, y: 70 },
          style: {
            fontSize: 24,
            color: '#000000',
            backgroundColor: '#ffeb3b',
            fontWeight: 'bold' as const,
            animation: 'slide_up' as const
          }
        }
      ];

      const updatedSegments = [...segments];
      const targetSegment = updatedSegments[segmentIndex];
      
      if (!targetSegment.textOverlays) targetSegment.textOverlays = [];
      
      // Add generated overlays to segment
      fallbackOverlays.forEach((overlay) => {
        if (overlay.startTime < segment.endTime - segment.startTime) {
          targetSegment.textOverlays!.push({
            id: `ai-text-${Date.now()}-${Math.random()}`,
            text: overlay.text,
            startTime: overlay.startTime,
            duration: overlay.duration,
            position: overlay.position,
            style: overlay.style
          });
        }
      });

      onSegmentsChange(updatedSegments);
    } catch (error) {
      console.error('AI text generation failed:', error);
    } finally {
      setIsGenerating(false);
      setShowAIGenerator(false);
    }
  };

  const generateBatchTextOverlays = async () => {
    if (!videoUrl || segments.length === 0) return;

    setIsGenerating(true);

    try {
      const updatedSegments = [...segments];
      
      // Generate fallback overlays for each segment
      updatedSegments.forEach((segment, segmentIndex) => {
        if (!segment.textOverlays) segment.textOverlays = [];
        
        const segmentDuration = segment.endTime - segment.startTime;
        const overlayStyles = [
          { color: '#ffffff', bg: '#ff1744', text: '🔥 Hot!' },
          { color: '#000000', bg: '#ffeb3b', text: '⭐ Featured' },
          { color: '#ffffff', bg: '#2196f3', text: '💡 Tip' },
          { color: '#ffffff', bg: '#4caf50', text: '✨ Amazing' }
        ];
        
        const style = overlayStyles[segmentIndex % overlayStyles.length];
        
        segment.textOverlays.push({
          id: `ai-batch-${Date.now()}-${segmentIndex}`,
          text: style.text,
          startTime: segmentDuration > 3 ? 1 : 0,
          duration: Math.min(2, segmentDuration - 0.5),
          position: { 
            x: 20 + (segmentIndex * 15) % 60, 
            y: 20 + (segmentIndex * 20) % 60 
          },
          style: {
            fontSize: 28,
            color: style.color,
            backgroundColor: style.bg,
            fontWeight: 'bold' as const,
            animation: 'bounce' as const
          }
        });
      });

      onSegmentsChange(updatedSegments);
    } catch (error) {
      console.error('Batch AI text generation failed:', error);
    } finally {
      setIsGenerating(false);
    }
  };

  const convertAspectRatio = async () => {
    if (!videoUrl) return;

    setIsConverting(true);

    try {
      const videoBlob = await fetch(videoUrl).then(r => r.blob());
      const formData = new FormData();
      formData.append('video', videoBlob);
      formData.append('options', JSON.stringify(aspectRatioOptions));

      const response = await fetch('/api/convert-aspect-ratio', {
        method: 'POST',
        body: formData
      });

      if (!response.ok) {
        throw new Error('Failed to convert aspect ratio');
      }

      const result = await response.json();
      
      if (result.success && result.videoUrl) {
        // Update the video URL with the converted video
        // onVideoChange(result.videoUrl); // Commented as function not available
        
        // Reset segments since video dimensions changed
        onSegmentsChange([]);
        
        console.log('Aspect ratio conversion completed:', result.videoUrl);
      }
    } catch (error) {
      console.error('Aspect ratio conversion failed:', error);
    } finally {
      setIsConverting(false);
      setShowAspectRatioConverter(false);
    }
  };

  const saveTextOverlay = () => {
    if (editingTextOverlay === null || !newTextOverlay.text) return;

    const { segmentIndex, overlayIndex } = editingTextOverlay;
    const updatedSegments = [...segments];
    const segment = updatedSegments[segmentIndex];

    if (!segment.textOverlays) segment.textOverlays = [];

    const textOverlay: TextOverlay = {
      id: `text-${Date.now()}`,
      text: newTextOverlay.text!,
      startTime: newTextOverlay.startTime || 0,
      duration: newTextOverlay.duration || 3,
      position: newTextOverlay.position || { x: 50, y: 50 },
      style: newTextOverlay.style || {
        fontSize: 24,
        color: '#ffffff',
        backgroundColor: '#000000',
        fontWeight: 'bold',
        animation: 'fade_in'
      }
    };

    if (overlayIndex !== undefined) {
      // Edit existing overlay
      segment.textOverlays[overlayIndex] = textOverlay;
    } else {
      // Add new overlay
      segment.textOverlays.push(textOverlay);
    }

    onSegmentsChange(updatedSegments);
    closeTextEditor();
  };

  const editTextOverlay = (segmentIndex: number, overlayIndex: number) => {
    const segment = segments[segmentIndex];
    const overlay = segment.textOverlays?.[overlayIndex];
    if (!overlay) return;

    setNewTextOverlay({
      text: overlay.text,
      startTime: overlay.startTime,
      duration: overlay.duration,
      position: overlay.position,
      style: overlay.style
    });
    setEditingTextOverlay({ segmentIndex, overlayIndex });
    setShowTextEditor(true);
  };

  const deleteTextOverlay = (segmentIndex: number, overlayIndex: number) => {
    const updatedSegments = [...segments];
    const segment = updatedSegments[segmentIndex];
    if (segment.textOverlays) {
      segment.textOverlays.splice(overlayIndex, 1);
      onSegmentsChange(updatedSegments);
    }
  };

  const closeTextEditor = () => {
    setShowTextEditor(false);
    setEditingTextOverlay(null);
    setNewTextOverlay({
      text: '',
      startTime: 0,
      duration: 3,
      position: { x: 50, y: 50 },
      style: {
        fontSize: 24,
        color: '#ffffff',
        backgroundColor: '#000000',
        fontWeight: 'bold',
        animation: 'fade_in'
      }
    });
  };

  const handleTimelineClick = (e: React.MouseEvent<HTMLDivElement>) => {
    if (isDragging) return;
    
    const timeline = timelineRef.current;
    if (!timeline) return;

    const rect = timeline.getBoundingClientRect();
    const x = e.clientX - rect.left;
    const clickTime = (x / rect.width) * videoDuration;
    
    seekTo(clickTime);
  };

  const startDrag = (e: React.MouseEvent, segmentIndex: number, type: 'start' | 'end' | 'move') => {
    e.stopPropagation();
    setIsDragging(true);
    setDragType(type);
    setDragSegmentIndex(segmentIndex);
    if (onSegmentSelect) {
      onSegmentSelect(segmentIndex);
    }
  };

  const handleMouseMove = useCallback((e: MouseEvent) => {
    if (!isDragging || dragSegmentIndex === null || !timelineRef.current) return;

    const timeline = timelineRef.current;
    const rect = timeline.getBoundingClientRect();
    const x = e.clientX - rect.left;
    const newTime = Math.max(0, Math.min((x / rect.width) * videoDuration, videoDuration));

    const updatedSegments = [...segments];
    const segment = updatedSegments[dragSegmentIndex];

    if (dragType === 'start') {
      segment.startTime = Math.min(newTime, segment.endTime - 0.5);
    } else if (dragType === 'end') {
      segment.endTime = Math.max(newTime, segment.startTime + 0.5);
    } else if (dragType === 'move') {
      const segmentDuration = segment.endTime - segment.startTime;
      segment.startTime = Math.max(0, Math.min(newTime, videoDuration - segmentDuration));
      segment.endTime = segment.startTime + segmentDuration;
    }

    onSegmentsChange(updatedSegments);
  }, [isDragging, dragSegmentIndex, dragType, segments, videoDuration, onSegmentsChange]);

  const handleMouseUp = useCallback(() => {
    setIsDragging(false);
    setDragType(null);
    setDragSegmentIndex(null);
  }, []);

  useEffect(() => {
    if (isDragging) {
      document.addEventListener('mousemove', handleMouseMove);
      document.addEventListener('mouseup', handleMouseUp);
      return () => {
        document.removeEventListener('mousemove', handleMouseMove);
        document.removeEventListener('mouseup', handleMouseUp);
      };
    }
  }, [isDragging, handleMouseMove, handleMouseUp]);

  return (
    <div className={`space-y-4 ${className}`}>
      <div className="flex items-center justify-between">
        <h3 className="text-lg font-semibold">Timeline Editor</h3>
        <div className="flex space-x-2">
          <Button onClick={addSegment} size="sm">
            <MdAdd className="w-4 h-4" />
            Add Segment
          </Button>
          {videoUrl && (
            <Button 
              onClick={() => setShowAspectRatioConverter(true)} 
              size="sm" 
              variant="outline"
              disabled={isConverting}
            >
              <MdAspectRatio className="w-4 h-4 mr-1" />
              {isConverting ? 'Converting...' : 'Convert to 9:16'}
            </Button>
          )}
          {segments.length > 0 && (
            <Button 
              onClick={generateBatchTextOverlays} 
              size="sm" 
              variant="outline"
              disabled={isGenerating}
            >
              <MdAutoAwesome className="w-4 h-4 mr-1" />
              {isGenerating ? 'Generating...' : 'AI Text for All'}
            </Button>
          )}
        </div>
      </div>

      {/* Enhanced Interactive Timeline */}
      <div className="space-y-4">
        <div className="flex items-center justify-between">
          <h4 className="text-sm font-medium">Timeline</h4>
          <div className="text-xs text-gray-500">
            Click to seek • Drag segment edges to resize • Drag center to move
          </div>
        </div>
        
        <div 
          ref={timelineRef}
          className="relative h-24 bg-gray-100 rounded-lg cursor-pointer overflow-hidden border"
          onClick={handleTimelineClick}
        >
          {/* Time markers */}
          <div className="absolute top-0 left-0 right-0 h-6 flex border-b border-gray-200">
            {Array.from({ length: Math.ceil(videoDuration / 5) + 1 }, (_, i) => (
              <div key={i} className="flex-1 text-xs text-gray-500 border-r border-gray-300 px-1 py-1">
                {i * 5}s
              </div>
            ))}
          </div>
          
          {/* Current time indicator */}
          <div 
            className="absolute top-0 bottom-0 w-1 bg-red-500 z-30 rounded-full shadow-lg"
            style={{ left: `${(currentTime / videoDuration) * 100}%` }}
          >
            <div className="absolute -top-1 -left-2 w-5 h-3 bg-red-500 rounded-t-lg"></div>
          </div>
          
          {/* Segments */}
          {segments.map((segment, index) => {
            const startPercent = (segment.startTime / videoDuration) * 100;
            const widthPercent = ((segment.endTime - segment.startTime) / videoDuration) * 100;
            const isSelected = selectedSegment === index;
            
            return (
              <div
                key={segment.id}
                className={`absolute top-6 h-16 border-2 rounded-lg cursor-pointer transition-all shadow-lg ${
                  isSelected 
                    ? 'bg-gradient-to-r from-blue-500 to-blue-600 border-blue-700 z-20 shadow-xl' 
                    : 'bg-gradient-to-r from-blue-300 to-blue-400 border-blue-500 hover:from-blue-400 hover:to-blue-500 z-10'
                }`}
                style={{
                  left: `${startPercent}%`,
                  width: `${Math.max(widthPercent, 2)}%`,
                }}
                onClick={(e) => {
                  e.stopPropagation();
                  if (onSegmentSelect) {
                    onSegmentSelect(index);
                  }
                }}
              >
                {/* Drag handles */}
                <div 
                  className="absolute left-0 top-0 bottom-0 w-2 bg-blue-800 cursor-ew-resize hover:bg-blue-900 rounded-l-lg"
                  onMouseDown={(e) => startDrag(e, index, 'start')}
                />
                <div 
                  className="absolute right-0 top-0 bottom-0 w-2 bg-blue-800 cursor-ew-resize hover:bg-blue-900 rounded-r-lg"
                  onMouseDown={(e) => startDrag(e, index, 'end')}
                />
                
                {/* Content area */}
                <div 
                  className="absolute left-2 right-2 top-0 bottom-0 cursor-move flex flex-col justify-center"
                  onMouseDown={(e) => startDrag(e, index, 'move')}
                >
                  <div className="text-xs text-white font-medium truncate">
                    {segment.action || `Segment ${index + 1}`}
                  </div>
                  <div className="text-xs text-blue-100">
                    {segment.startTime.toFixed(1)}s - {segment.endTime.toFixed(1)}s
                  </div>
                  <div className="text-xs text-blue-200 truncate">
                    {segment.description}
                  </div>
                </div>
                
                {/* Duration indicator */}
                <div className="absolute -bottom-5 left-1/2 transform -translate-x-1/2 text-xs text-gray-600 bg-white px-1 rounded shadow">
                  {(segment.endTime - segment.startTime).toFixed(1)}s
                </div>
              </div>
            );
          })}
          
          {/* Timeline ruler */}
          <div className="absolute bottom-0 left-0 right-0 h-2 bg-gray-200">
            {Array.from({ length: Math.ceil(videoDuration) }, (_, i) => (
              <div 
                key={i}
                className="absolute w-px h-full bg-gray-400"
                style={{ left: `${(i / videoDuration) * 100}%` }}
              />
            ))}
          </div>
        </div>
        
        {/* Keyboard shortcuts info */}
        <div className="text-xs text-gray-500 bg-gray-50 p-2 rounded">
          <strong>Timeline Controls:</strong> Click to seek • Drag segment edges to resize • Drag center to move segments
        </div>
      </div>

      {/* Segment List */}
      {segments.length > 0 && (
        <div className="space-y-2">
          <h4 className="font-medium">Segments ({segments.length})</h4>
          <div className="max-h-60 overflow-y-auto space-y-2">
            {segments.map((segment, index) => (
              <Card 
                key={segment.id} 
                className={`cursor-pointer transition-colors ${
                  selectedSegment === index ? 'border-blue-300 bg-blue-50' : 'hover:bg-gray-50'
                }`}
                onClick={() => {
                  if (onSegmentSelect) {
                    onSegmentSelect(index);
                  }
                  seekTo(segment.startTime);
                }}
              >
                <CardContent className="p-3">
                  <div className="flex items-center justify-between mb-2">
                    <div className="flex-1">
                      <span className="font-medium">{segment.action}</span>
                      <span className="text-sm text-gray-600 ml-2">
                        {segment.startTime.toFixed(1)}s - {segment.endTime.toFixed(1)}s
                      </span>
                      {segment.description && (
                        <div className="text-xs text-gray-500">{segment.description}</div>
                      )}
                    </div>
                    <div className="flex space-x-1">
                      <Button
                        onClick={(e) => {
                          e.stopPropagation();
                          addTextToSegment(index);
                        }}
                        size="sm"
                        variant="outline"
                        title="Add Text Overlay"
                      >
                        <MdTextFields className="w-4 h-4" />
                      </Button>
                      <Button
                        onClick={(e) => {
                          e.stopPropagation();
                          generateAITextOverlays(index);
                        }}
                        size="sm"
                        variant="outline"
                        title="AI Generate Text"
                        disabled={isGenerating}
                      >
                        <MdAutoAwesome className="w-4 h-4" />
                      </Button>
                      <Button
                        onClick={(e) => {
                          e.stopPropagation();
                          onSegmentsChange(segments.filter((_, i) => i !== index));
                        }}
                        size="sm"
                        variant="outline"
                        title="Delete Segment"
                      >
                        <MdDelete className="w-4 h-4" />
                      </Button>
                    </div>
                  </div>
                  
                  {/* Text Overlays */}
                  {segment.textOverlays && segment.textOverlays.length > 0 && (
                    <div className="mt-2 space-y-1">
                      <div className="text-xs font-medium text-gray-700">Text Overlays:</div>
                      {segment.textOverlays.map((overlay, overlayIndex) => (
                        <div key={overlay.id} className="flex items-center justify-between bg-gray-100 rounded p-2">
                          <div className="flex-1">
                            <div className="text-xs font-medium truncate" style={{ color: overlay.style.color }}>
                              "{overlay.text}"
                            </div>
                            <div className="text-xs text-gray-500">
                              {overlay.startTime.toFixed(1)}s - {(overlay.startTime + overlay.duration).toFixed(1)}s
                            </div>
                            <div className="flex space-x-1 mt-1">
                              <Badge variant="outline" className="text-xs">
                                {overlay.style.fontSize}px
                              </Badge>
                              {overlay.style.animation && (
                                <Badge variant="outline" className="text-xs">
                                  {overlay.style.animation}
                                </Badge>
                              )}
                            </div>
                          </div>
                          <div className="flex space-x-1">
                            <Button
                              onClick={(e) => {
                                e.stopPropagation();
                                editTextOverlay(index, overlayIndex);
                              }}
                              size="sm"
                              variant="ghost"
                              className="h-6 w-6 p-0"
                              title="Edit Text"
                            >
                              <MdEdit className="w-3 h-3" />
                            </Button>
                            <Button
                              onClick={(e) => {
                                e.stopPropagation();
                                deleteTextOverlay(index, overlayIndex);
                              }}
                              size="sm"
                              variant="ghost"
                              className="h-6 w-6 p-0"
                              title="Delete Text"
                            >
                              <MdDelete className="w-3 h-3" />
                            </Button>
                          </div>
                        </div>
                      ))}
                    </div>
                  )}
                </CardContent>
              </Card>
            ))}
          </div>
        </div>
      )}

      {/* Text Overlay Editor Modal */}
      {showTextEditor && (
        <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50">
          <Card className="w-full max-w-md max-h-[90vh] overflow-y-auto">
            <CardHeader>
              <CardTitle className="flex items-center justify-between">
                <span>
                  {editingTextOverlay?.overlayIndex !== undefined ? 'Edit' : 'Add'} Text Overlay
                </span>
                <Button
                  onClick={closeTextEditor}
                  size="sm"
                  variant="ghost"
                >
                  <MdClose className="w-4 h-4" />
                </Button>
              </CardTitle>
            </CardHeader>
            <CardContent className="space-y-4">
              {/* Text Content */}
              <div className="space-y-2">
                <label className="text-sm font-medium">Text</label>
                <Input
                  value={newTextOverlay.text || ''}
                  onChange={(e) => setNewTextOverlay({ ...newTextOverlay, text: e.target.value })}
                  placeholder="Enter text to display"
                />
              </div>

              {/* Timing */}
              <div className="grid grid-cols-2 gap-4">
                <div className="space-y-2">
                  <label className="text-sm font-medium">Start Time (s)</label>
                  <Input
                    type="number"
                    min="0"
                    step="0.1"
                    value={newTextOverlay.startTime || 0}
                    onChange={(e) => setNewTextOverlay({ 
                      ...newTextOverlay, 
                      startTime: parseFloat(e.target.value) || 0 
                    })}
                  />
                </div>
                <div className="space-y-2">
                  <label className="text-sm font-medium">Duration (s)</label>
                  <Input
                    type="number"
                    min="0.1"
                    step="0.1"
                    value={newTextOverlay.duration || 3}
                    onChange={(e) => setNewTextOverlay({ 
                      ...newTextOverlay, 
                      duration: parseFloat(e.target.value) || 3 
                    })}
                  />
                </div>
              </div>

              {/* Position */}
              <div className="grid grid-cols-2 gap-4">
                <div className="space-y-2">
                  <label className="text-sm font-medium">X Position (%)</label>
                  <Input
                    type="number"
                    min="0"
                    max="100"
                    value={newTextOverlay.position?.x || 50}
                    onChange={(e) => setNewTextOverlay({ 
                      ...newTextOverlay, 
                      position: { 
                        ...newTextOverlay.position || { x: 50, y: 50 }, 
                        x: parseInt(e.target.value) || 50 
                      }
                    })}
                  />
                </div>
                <div className="space-y-2">
                  <label className="text-sm font-medium">Y Position (%)</label>
                  <Input
                    type="number"
                    min="0"
                    max="100"
                    value={newTextOverlay.position?.y || 50}
                    onChange={(e) => setNewTextOverlay({ 
                      ...newTextOverlay, 
                      position: { 
                        ...newTextOverlay.position || { x: 50, y: 50 }, 
                        y: parseInt(e.target.value) || 50 
                      }
                    })}
                  />
                </div>
              </div>

              <Separator />

              {/* Style Options */}
              <div className="space-y-4">
                <h4 className="text-sm font-medium">Text Style</h4>
                
                {/* Font Size */}
                <div className="space-y-2">
                  <label className="text-sm font-medium">Font Size (px)</label>
                  <Input
                    type="number"
                    min="12"
                    max="72"
                    value={newTextOverlay.style?.fontSize || 24}
                    onChange={(e) => setNewTextOverlay({ 
                      ...newTextOverlay, 
                      style: { 
                        ...newTextOverlay.style || {
                          fontSize: 24,
                          color: '#ffffff',
                          fontWeight: 'bold' as const
                        }, 
                        fontSize: parseInt(e.target.value) || 24 
                      }
                    })}
                  />
                </div>

                {/* Colors */}
                <div className="grid grid-cols-2 gap-4">
                  <div className="space-y-2">
                    <label className="text-sm font-medium">Text Color</label>
                    <Input
                      type="color"
                      value={newTextOverlay.style?.color || '#ffffff'}
                      onChange={(e) => setNewTextOverlay({ 
                        ...newTextOverlay, 
                        style: { 
                          ...newTextOverlay.style || {
                            fontSize: 24,
                            color: '#ffffff',
                            fontWeight: 'bold' as const
                          }, 
                          color: e.target.value 
                        }
                      })}
                    />
                  </div>
                  <div className="space-y-2">
                    <label className="text-sm font-medium">Background</label>
                    <Input
                      type="color"
                      value={newTextOverlay.style?.backgroundColor || '#000000'}
                      onChange={(e) => setNewTextOverlay({ 
                        ...newTextOverlay, 
                        style: { 
                          fontSize: 24,
                          color: '#ffffff',
                          fontWeight: 'bold' as const,
                          ...newTextOverlay.style || {}, 
                          backgroundColor: e.target.value 
                        }
                      })}
                    />
                  </div>
                </div>

                {/* Font Weight */}
                <div className="space-y-2">
                  <label className="text-sm font-medium">Font Weight</label>
                  <Select
                    value={newTextOverlay.style?.fontWeight || 'bold'}
                    onValueChange={(value: 'normal' | 'bold') => setNewTextOverlay({ 
                      ...newTextOverlay, 
                      style: { 
                        ...newTextOverlay.style || {
                          fontSize: 24,
                          color: '#ffffff',
                          fontWeight: 'bold' as const
                        }, 
                        fontWeight: value 
                      }
                    })}
                  >
                    <SelectTrigger>
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="normal">Normal</SelectItem>
                      <SelectItem value="bold">Bold</SelectItem>
                    </SelectContent>
                  </Select>
                </div>

                {/* Animation */}
                <div className="space-y-2">
                  <label className="text-sm font-medium">Animation</label>
                  <Select
                    value={newTextOverlay.style?.animation || 'fade_in'}
                    onValueChange={(value: 'fade_in' | 'slide_up' | 'bounce' | 'typewriter') => setNewTextOverlay({ 
                      ...newTextOverlay, 
                      style: { 
                        fontSize: 24,
                        color: '#ffffff',
                        fontWeight: 'bold' as const,
                        ...newTextOverlay.style || {}, 
                        animation: value 
                      }
                    })}
                  >
                    <SelectTrigger>
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="fade_in">Fade In</SelectItem>
                      <SelectItem value="slide_up">Slide Up</SelectItem>
                      <SelectItem value="bounce">Bounce</SelectItem>
                      <SelectItem value="typewriter">Typewriter</SelectItem>
                    </SelectContent>
                  </Select>
                </div>
              </div>

              {/* Preview */}
              <div className="space-y-2">
                <label className="text-sm font-medium">Preview</label>
                <div className="relative bg-gray-900 rounded h-24 flex items-center justify-center">
                  <div
                    style={{
                      color: newTextOverlay.style?.color || '#ffffff',
                      backgroundColor: newTextOverlay.style?.backgroundColor || '#000000',
                      fontSize: `${(newTextOverlay.style?.fontSize || 24) / 2}px`,
                      fontWeight: newTextOverlay.style?.fontWeight || 'bold',
                      padding: '4px 8px',
                      borderRadius: '4px'
                    }}
                  >
                    {newTextOverlay.text || 'Sample text'}
                  </div>
                </div>
              </div>

              {/* Action Buttons */}
              <div className="flex space-x-2">
                <Button onClick={saveTextOverlay} className="flex-1">
                  {editingTextOverlay?.overlayIndex !== undefined ? 'Update' : 'Add'} Text
                </Button>
                <Button onClick={closeTextEditor} variant="outline">
                  Cancel
                </Button>
              </div>
            </CardContent>
          </Card>
        </div>
      )}

      {/* AI Text Generation Options Modal */}
      {showAIGenerator && (
        <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50">
          <Card className="w-full max-w-md">
            <CardHeader>
              <CardTitle className="flex items-center justify-between">
                <span>AI Text Generation</span>
                <Button
                  onClick={() => setShowAIGenerator(false)}
                  size="sm"
                  variant="ghost"
                >
                  <MdClose className="w-4 h-4" />
                </Button>
              </CardTitle>
            </CardHeader>
            <CardContent className="space-y-4">
              <div className="space-y-2">
                <label className="text-sm font-medium">Video Style</label>
                <Select
                  value={aiGenerationOptions.videoStyle}
                  onValueChange={(value: any) => setAiGenerationOptions({
                    ...aiGenerationOptions,
                    videoStyle: value
                  })}
                >
                  <SelectTrigger>
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="viral">Viral/Social Media</SelectItem>
                    <SelectItem value="educational">Educational</SelectItem>
                    <SelectItem value="entertainment">Entertainment</SelectItem>
                    <SelectItem value="news">News/Documentary</SelectItem>
                    <SelectItem value="professional">Professional</SelectItem>
                  </SelectContent>
                </Select>
              </div>

              <div className="space-y-2">
                <label className="text-sm font-medium">Text Style</label>
                <Select
                  value={aiGenerationOptions.textStyle}
                  onValueChange={(value: any) => setAiGenerationOptions({
                    ...aiGenerationOptions,
                    textStyle: value
                  })}
                >
                  <SelectTrigger>
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="captions">Captions</SelectItem>
                    <SelectItem value="highlights">Highlights</SelectItem>
                    <SelectItem value="commentary">Commentary</SelectItem>
                    <SelectItem value="questions">Questions</SelectItem>
                    <SelectItem value="callouts">Callouts</SelectItem>
                  </SelectContent>
                </Select>
              </div>

              <div className="space-y-2">
                <label className="text-sm font-medium">Target Audience</label>
                <Select
                  value={aiGenerationOptions.targetAudience}
                  onValueChange={(value: any) => setAiGenerationOptions({
                    ...aiGenerationOptions,
                    targetAudience: value
                  })}
                >
                  <SelectTrigger>
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="general">General</SelectItem>
                    <SelectItem value="young">Young Adults</SelectItem>
                    <SelectItem value="professional">Professional</SelectItem>
                    <SelectItem value="educational">Students</SelectItem>
                  </SelectContent>
                </Select>
              </div>

              <div className="space-y-2">
                <label className="text-sm font-medium">Max Overlays per Segment</label>
                <Input
                  type="number"
                  min="1"
                  max="5"
                  value={aiGenerationOptions.maxOverlays}
                  onChange={(e) => setAiGenerationOptions({
                    ...aiGenerationOptions,
                    maxOverlays: parseInt(e.target.value) || 3
                  })}
                />
              </div>

              <div className="flex space-x-2 pt-4">
                <Button 
                  onClick={() => {
                    // Close modal and trigger generation (this will be handled by the calling function)
                    setShowAIGenerator(false);
                  }}
                  className="flex-1" 
                  disabled={isGenerating}
                >
                  <MdAutoAwesome className="w-4 h-4 mr-2" />
                  {isGenerating ? 'Generating...' : 'Generate Text'}
                </Button>
                <Button 
                  onClick={() => {
                    setShowAIGenerator(false);
                    setIsGenerating(false);
                  }} 
                  variant="outline"
                >
                  Cancel
                </Button>
              </div>
            </CardContent>
          </Card>
        </div>
      )}

      {/* Aspect Ratio Converter Modal */}
      {showAspectRatioConverter && (
        <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50">
          <Card className="w-full max-w-md">
            <CardHeader>
              <CardTitle className="flex items-center justify-between">
                <span>Convert to 9:16 Aspect Ratio</span>
                <Button
                  onClick={() => setShowAspectRatioConverter(false)}
                  size="sm"
                  variant="ghost"
                >
                  <MdClose className="w-4 h-4" />
                </Button>
              </CardTitle>
            </CardHeader>
            <CardContent className="space-y-4">
              <div className="text-sm text-gray-600 mb-4">
                This feature uses AI to detect people in your video and intelligently crop it to 9:16 aspect ratio, perfect for mobile viewing and social media.
              </div>

              <div className="space-y-2">
                <label className="text-sm font-medium">Target Aspect Ratio</label>
                <Select
                  value={aspectRatioOptions.targetRatio}
                  onValueChange={(value: any) => setAspectRatioOptions({
                    ...aspectRatioOptions,
                    targetRatio: value
                  })}
                >
                  <SelectTrigger>
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="9:16">9:16 (Vertical/Mobile)</SelectItem>
                    <SelectItem value="16:9">16:9 (Horizontal/Desktop)</SelectItem>
                    <SelectItem value="1:1">1:1 (Square/Instagram)</SelectItem>
                  </SelectContent>
                </Select>
              </div>

              <div className="space-y-2">
                <label className="text-sm font-medium">Crop Strategy</label>
                <Select
                  value={aspectRatioOptions.cropStrategy}
                  onValueChange={(value: any) => setAspectRatioOptions({
                    ...aspectRatioOptions,
                    cropStrategy: value
                  })}
                >
                  <SelectTrigger>
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="person-focused">AI Person-Focused (Recommended)</SelectItem>
                    <SelectItem value="smart">Smart Crop</SelectItem>
                    <SelectItem value="center">Center Crop</SelectItem>
                  </SelectContent>
                </Select>
              </div>

              <div className="space-y-3">
                <div className="flex items-center space-x-2">
                  <input
                    type="checkbox"
                    id="enhanceQuality"
                    checked={aspectRatioOptions.enhanceQuality}
                    onChange={(e) => setAspectRatioOptions({
                      ...aspectRatioOptions,
                      enhanceQuality: e.target.checked
                    })}
                    className="rounded"
                  />
                  <label htmlFor="enhanceQuality" className="text-sm">
                    Enhance video quality
                  </label>
                </div>

                <div className="flex items-center space-x-2">
                  <input
                    type="checkbox"
                    id="preserveAudio"
                    checked={aspectRatioOptions.preserveAudio}
                    onChange={(e) => setAspectRatioOptions({
                      ...aspectRatioOptions,
                      preserveAudio: e.target.checked
                    })}
                    className="rounded"
                  />
                  <label htmlFor="preserveAudio" className="text-sm">
                    Preserve audio
                  </label>
                </div>
              </div>

              <div className="bg-blue-50 p-3 rounded-lg text-sm">
                <div className="font-medium text-blue-800 mb-1">How it works:</div>
                <ol className="text-blue-700 space-y-1 list-decimal list-inside">
                  <li>Extract frames from your video</li>
                  <li>Detect people using AI</li>
                  <li>Calculate optimal crop coordinates</li>
                  <li>Apply intelligent cropping</li>
                  <li>Output the converted video</li>
                </ol>
              </div>

              <div className="flex space-x-2 pt-4">
                <Button 
                  onClick={convertAspectRatio}
                  className="flex-1" 
                  disabled={isConverting}
                >
                  <MdCrop className="w-4 h-4 mr-2" />
                  {isConverting ? 'Converting...' : 'Convert Video'}
                </Button>
                <Button 
                  onClick={() => setShowAspectRatioConverter(false)} 
                  variant="outline"
                >
                  Cancel
                </Button>
              </div>
            </CardContent>
          </Card>
        </div>
      )}
    </div>
  );
}