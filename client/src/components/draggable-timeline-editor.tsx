import React, { useState, useRef, useEffect, useCallback } from 'react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Separator } from '@/components/ui/separator';
import { Progress } from '@/components/ui/progress';
import { MdAdd, MdDelete, MdTextFields, MdEdit, MdClose, MdAutoAwesome, MdRefresh, MdCrop, MdAspectRatio, MdDragIndicator, MdPlayArrow, MdPause, MdDownload } from 'react-icons/md';
import { apiRequest } from '@/lib/queryClient';

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
  order: number; // New property for drag-and-drop ordering
}

interface DraggableTimelineEditorProps {
  videoUrl?: string;
  duration?: number;
  segments: TimelineSegment[];
  onSegmentsChange: (segments: TimelineSegment[]) => void;
  currentTime?: number;
  onTimeUpdate?: (time: number) => void;
  selectedSegment?: number;
  onSegmentSelect?: (index: number) => void;
  className?: string;
  onPreviewReorderedVideo?: (reorderedSegments: TimelineSegment[]) => void;
}

interface DragState {
  isDragging: boolean;
  draggedIndex: number | null;
  dragOverIndex: number | null;
  dragStartY: number;
  dragOffset: { x: number; y: number };
}

export function DraggableTimelineEditor({ 
  videoUrl, 
  duration = 60, 
  segments, 
  onSegmentsChange,
  currentTime = 0,
  onTimeUpdate,
  selectedSegment,
  onSegmentSelect,
  className = "",
  onPreviewReorderedVideo
}: DraggableTimelineEditorProps) {
  const [dragState, setDragState] = useState<DragState>({
    isDragging: false,
    draggedIndex: null,
    dragOverIndex: null,
    dragStartY: 0,
    dragOffset: { x: 0, y: 0 }
  });
  
  const [previewingOrder, setPreviewingOrder] = useState(false);
  const [reorderedSegments, setReorderedSegments] = useState<TimelineSegment[]>([]);
  const [isPlaying, setIsPlaying] = useState(false);
  const [previewCurrentTime, setPreviewCurrentTime] = useState(0);
  const [isProcessing, setIsProcessing] = useState(false);
  const [processedVideoUrl, setProcessedVideoUrl] = useState<string | null>(null);
  const [videoFilename, setVideoFilename] = useState<string | null>(null);
  
  const timelineRef = useRef<HTMLDivElement>(null);
  const dragGhostRef = useRef<HTMLDivElement>(null);

  // Sort segments by order for display
  const sortedSegments = [...segments].sort((a, b) => (a.order || 0) - (b.order || 0));

  // Calculate total duration for preview
  const totalPreviewDuration = reorderedSegments.reduce((total, segment) => {
    return total + (segment.endTime - segment.startTime);
  }, 0);

  const addSegment = () => {
    const newSegment: TimelineSegment = {
      id: `segment-${Date.now()}`,
      startTime: currentTime,
      endTime: Math.min(currentTime + 5, duration),
      action: 'New Segment',
      description: 'Description',
      textOverlays: [],
      order: segments.length
    };
    onSegmentsChange([...segments, newSegment]);
  };

  const deleteSegment = (index: number) => {
    const newSegments = segments.filter((_, i) => i !== index);
    // Reorder remaining segments
    const reorderedSegments = newSegments.map((segment, i) => ({
      ...segment,
      order: i
    }));
    onSegmentsChange(reorderedSegments);
  };

  const handleDragStart = (e: React.MouseEvent, index: number) => {
    e.preventDefault();
    const rect = e.currentTarget.getBoundingClientRect();
    setDragState({
      isDragging: true,
      draggedIndex: index,
      dragOverIndex: null,
      dragStartY: e.clientY,
      dragOffset: {
        x: e.clientX - rect.left,
        y: e.clientY - rect.top
      }
    });

    // Add global mouse event listeners
    document.addEventListener('mousemove', handleDragMove);
    document.addEventListener('mouseup', handleDragEnd);
  };

  const handleDragMove = useCallback((e: MouseEvent) => {
    if (!dragState.isDragging || dragState.draggedIndex === null) return;

    // Update ghost position
    if (dragGhostRef.current) {
      dragGhostRef.current.style.left = `${e.clientX - dragState.dragOffset.x}px`;
      dragGhostRef.current.style.top = `${e.clientY - dragState.dragOffset.y}px`;
    }

    // Determine drop target
    if (timelineRef.current) {
      const timelineRect = timelineRef.current.getBoundingClientRect();
      const relativeY = e.clientY - timelineRect.top;
      const segmentHeight = 80; // Approximate height of each segment
      const dropIndex = Math.floor(relativeY / segmentHeight);
      const clampedDropIndex = Math.max(0, Math.min(dropIndex, sortedSegments.length - 1));
      
      setDragState(prev => ({
        ...prev,
        dragOverIndex: clampedDropIndex
      }));
    }
  }, [dragState.isDragging, dragState.draggedIndex, dragState.dragOffset, sortedSegments.length]);

  const handleDragEnd = useCallback(() => {
    if (dragState.isDragging && dragState.draggedIndex !== null && dragState.dragOverIndex !== null) {
      const newSegments = [...sortedSegments];
      const draggedSegment = newSegments[dragState.draggedIndex];
      
      // Remove dragged segment and insert at new position
      newSegments.splice(dragState.draggedIndex, 1);
      newSegments.splice(dragState.dragOverIndex, 0, draggedSegment);
      
      // Update order property
      const reorderedSegments = newSegments.map((segment, index) => ({
        ...segment,
        order: index
      }));
      
      onSegmentsChange(reorderedSegments);
      setReorderedSegments(reorderedSegments);
    }

    setDragState({
      isDragging: false,
      draggedIndex: null,
      dragOverIndex: null,
      dragStartY: 0,
      dragOffset: { x: 0, y: 0 }
    });

    // Remove global event listeners
    document.removeEventListener('mousemove', handleDragMove);
    document.removeEventListener('mouseup', handleDragEnd);
  }, [dragState, sortedSegments, onSegmentsChange, handleDragMove]);

  const previewReorderedVideo = () => {
    if (reorderedSegments.length === 0) {
      setReorderedSegments(sortedSegments);
    }
    setPreviewingOrder(true);
    setPreviewCurrentTime(0);
    setIsPlaying(true);
    
    if (onPreviewReorderedVideo) {
      onPreviewReorderedVideo(reorderedSegments.length > 0 ? reorderedSegments : sortedSegments);
    }
  };

  const stopPreview = () => {
    setPreviewingOrder(false);
    setIsPlaying(false);
    setPreviewCurrentTime(0);
  };

  // Extract filename from videoUrl
  useEffect(() => {
    if (videoUrl) {
      const url = new URL(videoUrl);
      const pathParts = url.pathname.split('/');
      const filename = pathParts[pathParts.length - 1];
      setVideoFilename(filename);
    }
  }, [videoUrl]);

  // Process reordered video segments
  const processReorderedVideo = async () => {
    if (!videoFilename || reorderedSegments.length === 0) {
      return;
    }

    setIsProcessing(true);
    try {
      const response = await apiRequest('POST', '/api/process-reordered-segments', {
        segments: reorderedSegments,
        videoFilename: videoFilename
      });

      const result = await response.json();
      if (result.success) {
        setProcessedVideoUrl(result.previewUrl);
      }
    } catch (error) {
      console.error('Error processing reordered video:', error);
    } finally {
      setIsProcessing(false);
    }
  };

  // Download processed video
  const downloadProcessedVideo = () => {
    if (processedVideoUrl) {
      const link = document.createElement('a');
      link.href = processedVideoUrl;
      link.download = `reordered_video_${Date.now()}.mp4`;
      document.body.appendChild(link);
      link.click();
      document.body.removeChild(link);
    }
  };

  // Preview playback logic
  useEffect(() => {
    let interval: NodeJS.Timeout;
    
    if (isPlaying && previewingOrder) {
      interval = setInterval(() => {
        setPreviewCurrentTime(prev => {
          if (prev >= totalPreviewDuration) {
            setIsPlaying(false);
            return 0;
          }
          return prev + 0.1;
        });
      }, 100);
    }

    return () => {
      if (interval) clearInterval(interval);
    };
  }, [isPlaying, previewingOrder, totalPreviewDuration]);

  // Get current segment being played in preview
  const getCurrentPreviewSegment = () => {
    let accumulatedTime = 0;
    for (const segment of reorderedSegments) {
      const segmentDuration = segment.endTime - segment.startTime;
      if (previewCurrentTime >= accumulatedTime && previewCurrentTime < accumulatedTime + segmentDuration) {
        return {
          segment,
          relativeTime: previewCurrentTime - accumulatedTime
        };
      }
      accumulatedTime += segmentDuration;
    }
    return null;
  };

  const currentPreviewSegment = getCurrentPreviewSegment();

  return (
    <div className={`space-y-4 ${className}`}>
      {/* Header */}
      <div className="flex items-center justify-between">
        <h3 className="text-lg font-semibold text-gray-900 dark:text-white">Draggable Timeline Editor</h3>
        <div className="flex space-x-2">
          <Button onClick={addSegment} size="sm" variant="outline">
            <MdAdd className="w-4 h-4 mr-1" />
            Add Segment
          </Button>
          <Button 
            onClick={previewReorderedVideo} 
            size="sm" 
            className="bg-blue-600 hover:bg-blue-700 text-white"
            disabled={sortedSegments.length === 0}
          >
            <MdPlayArrow className="w-4 h-4 mr-1" />
            Preview Order
          </Button>
        </div>
      </div>

      {/* Preview Controls */}
      {previewingOrder && (
        <Card className="border-blue-200 dark:border-blue-800 bg-blue-50 dark:bg-blue-950">
          <CardHeader className="pb-3">
            <div className="flex items-center justify-between">
              <CardTitle className="text-sm text-blue-900 dark:text-blue-100">
                Preview Mode - Reordered Segments
              </CardTitle>
              <Button onClick={stopPreview} size="sm" variant="ghost">
                <MdClose className="w-4 h-4" />
              </Button>
            </div>
          </CardHeader>
          <CardContent>
            <div className="space-y-3">
              <div className="flex items-center space-x-3">
                <Button
                  onClick={() => setIsPlaying(!isPlaying)}
                  size="sm"
                  variant="outline"
                >
                  {isPlaying ? <MdPause className="w-4 h-4" /> : <MdPlayArrow className="w-4 h-4" />}
                </Button>
                <div className="flex-1">
                  <Progress 
                    value={(previewCurrentTime / totalPreviewDuration) * 100} 
                    className="h-2"
                  />
                </div>
                <span className="text-sm text-gray-600 dark:text-gray-300">
                  {Math.floor(previewCurrentTime)}s / {Math.floor(totalPreviewDuration)}s
                </span>
              </div>
              
              {currentPreviewSegment && (
                <div className="text-sm text-blue-800 dark:text-blue-200">
                  <strong>Playing:</strong> {currentPreviewSegment.segment.action}
                  <span className="ml-2">
                    ({Math.floor(currentPreviewSegment.relativeTime)}s / {Math.floor(currentPreviewSegment.segment.endTime - currentPreviewSegment.segment.startTime)}s)
                  </span>
                </div>
              )}
            </div>
          </CardContent>
        </Card>
      )}

      {/* Timeline Segments */}
      <div className="space-y-2" ref={timelineRef}>
        {sortedSegments.length === 0 ? (
          <div className="text-center py-8 text-gray-500 dark:text-gray-400">
            <MdAdd className="w-8 h-8 mx-auto mb-2 opacity-50" />
            <p>No segments yet. Click "Add Segment" to start building your timeline.</p>
          </div>
        ) : (
          sortedSegments.map((segment, index) => (
            <div key={segment.id} className="relative">
              {/* Drop indicator */}
              {dragState.dragOverIndex === index && dragState.isDragging && (
                <div className="absolute -top-1 left-0 right-0 h-0.5 bg-blue-500 rounded-full z-10" />
              )}
              
              <Card 
                className={`
                  relative transition-all duration-200 cursor-move
                  ${dragState.draggedIndex === index ? 'opacity-50 scale-95' : ''}
                  ${selectedSegment === index ? 'ring-2 ring-blue-500' : ''}
                  ${previewingOrder && currentPreviewSegment?.segment.id === segment.id ? 
                    'ring-2 ring-green-500 bg-green-50 dark:bg-green-950' : ''}
                  hover:shadow-md
                `}
                onMouseDown={(e) => handleDragStart(e, index)}
                onClick={() => onSegmentSelect?.(index)}
              >
                <CardContent className="p-4">
                  <div className="flex items-center space-x-3">
                    {/* Drag Handle */}
                    <div className="text-gray-400 hover:text-gray-600 dark:text-gray-500 dark:hover:text-gray-300">
                      <MdDragIndicator className="w-5 h-5" />
                    </div>
                    
                    {/* Segment Order Badge */}
                    <Badge variant="outline" className="text-xs">
                      #{index + 1}
                    </Badge>
                    
                    {/* Segment Content */}
                    <div className="flex-1 min-w-0">
                      <div className="flex items-center justify-between">
                        <h4 className="font-medium text-gray-900 dark:text-white truncate">
                          {segment.action}
                        </h4>
                        <div className="flex items-center space-x-2">
                          <span className="text-sm text-gray-500 dark:text-gray-400">
                            {Math.floor(segment.startTime)}s - {Math.floor(segment.endTime)}s
                          </span>
                          <Badge variant="secondary" className="text-xs">
                            {Math.floor(segment.endTime - segment.startTime)}s
                          </Badge>
                        </div>
                      </div>
                      
                      <p className="text-sm text-gray-600 dark:text-gray-300 mt-1 truncate">
                        {segment.description}
                      </p>
                      
                      {segment.textOverlays && segment.textOverlays.length > 0 && (
                        <div className="flex items-center mt-2 space-x-1">
                          <MdTextFields className="w-4 h-4 text-blue-500" />
                          <span className="text-xs text-blue-600 dark:text-blue-400">
                            {segment.textOverlays.length} text overlay{segment.textOverlays.length !== 1 ? 's' : ''}
                          </span>
                        </div>
                      )}
                    </div>
                    
                    {/* Actions */}
                    <div className="flex items-center space-x-1">
                      <Button
                        onClick={(e) => {
                          e.stopPropagation();
                          deleteSegment(index);
                        }}
                        size="sm"
                        variant="ghost"
                        className="text-red-500 hover:text-red-700 hover:bg-red-50 dark:hover:bg-red-950"
                      >
                        <MdDelete className="w-4 h-4" />
                      </Button>
                    </div>
                  </div>
                </CardContent>
              </Card>
            </div>
          ))
        )}
      </div>

      {/* Drag Ghost */}
      {dragState.isDragging && dragState.draggedIndex !== null && (
        <div
          ref={dragGhostRef}
          className="fixed pointer-events-none z-50 opacity-80 transform -rotate-2 shadow-xl"
          style={{
            left: 0,
            top: 0,
          }}
        >
          <Card className="w-80 bg-white dark:bg-gray-800 border-2 border-blue-500">
            <CardContent className="p-4">
              <div className="flex items-center space-x-3">
                <MdDragIndicator className="w-5 h-5 text-blue-500" />
                <div className="flex-1">
                  <h4 className="font-medium text-gray-900 dark:text-white">
                    {sortedSegments[dragState.draggedIndex]?.action}
                  </h4>
                  <p className="text-sm text-gray-600 dark:text-gray-300">
                    Moving to position...
                  </p>
                </div>
              </div>
            </CardContent>
          </Card>
        </div>
      )}

      {/* Processing Controls */}
      <div className="flex flex-col space-y-4">
        <div className="flex items-center justify-center space-x-4">
          <Button
            onClick={processReorderedVideo}
            disabled={isProcessing || reorderedSegments.length === 0}
            className="bg-blue-600 hover:bg-blue-700 text-white"
          >
            {isProcessing ? (
              <>
                <div className="animate-spin w-4 h-4 border-2 border-white border-t-transparent rounded-full mr-2" />
                Processing...
              </>
            ) : (
              <>
                <MdAutoAwesome className="w-4 h-4 mr-2" />
                Process Reordered Video
              </>
            )}
          </Button>

          {processedVideoUrl && (
            <Button
              onClick={downloadProcessedVideo}
              className="bg-green-600 hover:bg-green-700 text-white"
            >
              <MdDownload className="w-4 h-4 mr-2" />
              Download Video
            </Button>
          )}
        </div>

        {processedVideoUrl && (
          <div className="text-center">
            <p className="text-sm text-green-600 dark:text-green-400">
              ✓ Video processed successfully! Ready for download.
            </p>
          </div>
        )}
      </div>

      {/* Instructions */}
      <div className="text-center p-4 bg-gray-50 dark:bg-gray-800 rounded-lg">
        <p className="text-sm text-gray-600 dark:text-gray-300">
          <strong>Drag & Drop:</strong> Click and drag segments to reorder them. 
          Click "Preview Order" to see how your reordered video will play.
          <br />
          <strong>Process:</strong> Click "Process Reordered Video" to create a new video with your custom segment order.
        </p>
      </div>
    </div>
  );
}