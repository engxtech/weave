import React, { useState, useRef, useEffect, useCallback } from 'react';
import { Button } from '@/components/ui/button';
import { MdAdd, MdDelete } from 'react-icons/md';

export interface TimelineSegment {
  id: string;
  startTime: number;
  endTime: number;
  action: string;
  description: string;
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
  const [draggedSegment, setDraggedSegment] = useState<string | null>(null);
  const [selectionStart, setSelectionStart] = useState<number | null>(null);
  const [selectionEnd, setSelectionEnd] = useState<number | null>(null);
  const [isSelecting, setIsSelecting] = useState(false);
  const [isDragging, setIsDragging] = useState(false);
  const [dragType, setDragType] = useState<'start' | 'end' | 'move' | null>(null);
  const [dragSegmentIndex, setDragSegmentIndex] = useState<number | null>(null);
  const [videoDuration, setVideoDuration] = useState(duration);
  
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
      description: `Segment ${segments.length + 1}`
    };
    onSegmentsChange([...segments, newSeg]);
  };
  const getTimeFromPosition = (clientX: number) => {
    if (!timelineRef.current) return 0;
    const rect = timelineRef.current.getBoundingClientRect();
    const x = clientX - rect.left;
    const percentage = Math.max(0, Math.min(1, x / rect.width));
    return percentage * duration;
  };

  const getPositionFromTime = (time: number) => {
    return (time / duration) * 100;
  };

  const handleTimelineClick = (e: React.MouseEvent) => {
    if (isSelecting) return;
    const time = getTimeFromPosition(e.clientX);
    seekTo(time);
  };

  const handleSelectionStart = (e: React.MouseEvent) => {
    const time = getTimeFromPosition(e.clientX);
    setSelectionStart(time);
    setSelectionEnd(time);
    setIsSelecting(true);
  };

  const handleSelectionMove = (e: React.MouseEvent) => {
    if (!isSelecting || selectionStart === null) return;
    const time = getTimeFromPosition(e.clientX);
    setSelectionEnd(time);
  };

  const handleSelectionEnd = () => {
    if (selectionStart !== null && selectionEnd !== null) {
      const start = Math.min(selectionStart, selectionEnd);
      const end = Math.max(selectionStart, selectionEnd);
      
      if (end - start >= 0.5) { // Minimum 0.5 second segment
        addSegment(start, end);
      }
    }
    
    setSelectionStart(null);
    setSelectionEnd(null);
    setIsSelecting(false);
  };

  const addSegment = (startTime: number, endTime: number) => {
    const newSegment: TimelineSegment = {
      id: `segment-${Date.now()}`,
      startTime: Math.round(startTime * 10) / 10,
      endTime: Math.round(endTime * 10) / 10,
      action: 'cut',
      description: `Segment ${segments.length + 1}`
    };
    
    const updatedSegments = [...segments, newSegment].sort((a, b) => a.startTime - b.startTime);
    onSegmentsChange(updatedSegments);
  };

  const deleteSegment = (segmentId: string) => {
    const updatedSegments = segments.filter(seg => seg.id !== segmentId);
    onSegmentsChange(updatedSegments);
  };

  const updateSegment = (segmentId: string, updates: Partial<TimelineSegment>) => {
    const updatedSegments = segments.map(seg => 
      seg.id === segmentId ? { ...seg, ...updates } : seg
    );
    onSegmentsChange(updatedSegments);
  };

  // Update current time from video
  useEffect(() => {
    const video = videoRef.current;
    if (!video) return;

    const handleTimeUpdate = () => {
      setCurrentTime(video.currentTime);
    };

    const handleLoadedMetadata = () => {
      if (duration === 60 && video.duration) {
        // Update duration if it was default
      }
    };

    video.addEventListener('timeupdate', handleTimeUpdate);
    video.addEventListener('loadedmetadata', handleLoadedMetadata);
    video.addEventListener('play', () => setIsPlaying(true));
    video.addEventListener('pause', () => setIsPlaying(false));

    return () => {
      video.removeEventListener('timeupdate', handleTimeUpdate);
      video.removeEventListener('loadedmetadata', handleLoadedMetadata);
      video.removeEventListener('play', () => setIsPlaying(true));
      video.removeEventListener('pause', () => setIsPlaying(false));
    };
  }, [duration]);

  const formatTime = (time: number) => {
    const minutes = Math.floor(time / 60);
    const seconds = Math.floor(time % 60);
    return `${minutes}:${seconds.toString().padStart(2, '0')}`;
  };

  const currentSelection = selectionStart !== null && selectionEnd !== null ? {
    start: Math.min(selectionStart, selectionEnd),
    end: Math.max(selectionStart, selectionEnd)
  } : null;

  return (
    <div className={`bg-white border rounded-lg p-4 ${className}`}>
      <div className="space-y-4">
        {/* Video Preview */}
        {videoUrl && (
          <div className="bg-black rounded-lg overflow-hidden">
            <video
              ref={videoRef}
              src={videoUrl}
              className="w-full h-48 object-contain"
              preload="metadata"
            />
          </div>
        )}

        {/* Video Controls */}
        <div className="flex items-center space-x-3">
          <button
            onClick={togglePlayPause}
            className="flex items-center justify-center w-10 h-10 bg-blue-500 text-white rounded-full hover:bg-blue-600 transition-colors"
          >
            {isPlaying ? <MdPause className="w-5 h-5" /> : <MdPlayArrow className="w-5 h-5 ml-0.5" />}
          </button>
          
          <div className="text-sm text-gray-600">
            {formatTime(currentTime)} / {formatTime(duration)}
          </div>
        </div>

        {/* Timeline */}
        <div className="space-y-2">
          <div className="text-sm font-medium text-gray-700">Timeline Editor</div>
          <div className="text-xs text-gray-500">
            Click to seek • Drag to select segments • Shift+click to add segments
          </div>
          
          <div 
            ref={timelineRef}
            className="relative h-16 bg-gray-100 rounded border cursor-crosshair select-none"
            onClick={handleTimelineClick}
            onMouseDown={handleSelectionStart}
            onMouseMove={handleSelectionMove}
            onMouseUp={handleSelectionEnd}
            onMouseLeave={handleSelectionEnd}
          >
            {/* Time markers */}
            <div className="absolute inset-x-0 top-0 h-4 flex justify-between text-xs text-gray-400 px-1">
              {Array.from({ length: Math.min(11, Math.ceil(duration / 10) + 1) }, (_, i) => (
                <div key={i} className="flex flex-col items-center">
                  <div className="w-px h-2 bg-gray-300"></div>
                  <span>{formatTime(i * 10)}</span>
                </div>
              ))}
            </div>

            {/* Current selection */}
            {currentSelection && (
              <div
                className="absolute top-4 h-8 bg-blue-200 border-2 border-blue-400 rounded opacity-60"
                style={{
                  left: `${getPositionFromTime(currentSelection.start)}%`,
                  width: `${getPositionFromTime(currentSelection.end - currentSelection.start)}%`
                }}
              />
            )}

            {/* Existing segments */}
            {segments.map((segment) => (
              <div
                key={segment.id}
                className="absolute top-4 h-8 bg-green-200 border-2 border-green-400 rounded cursor-pointer group hover:bg-green-300 transition-colors"
                style={{
                  left: `${getPositionFromTime(segment.startTime)}%`,
                  width: `${getPositionFromTime(segment.endTime - segment.startTime)}%`
                }}
                onClick={(e) => {
                  e.stopPropagation();
                  seekTo(segment.startTime);
                }}
              >
                <div className="absolute inset-0 flex items-center justify-center">
                  <span className="text-xs font-medium text-green-800 truncate px-1">
                    {segment.description}
                  </span>
                </div>
                
                {/* Delete button */}
                <button
                  className="absolute -top-1 -right-1 w-4 h-4 bg-red-500 text-white rounded-full opacity-0 group-hover:opacity-100 transition-opacity flex items-center justify-center"
                  onClick={(e) => {
                    e.stopPropagation();
                    deleteSegment(segment.id);
                  }}
                >
                  <MdDelete className="w-2.5 h-2.5" />
                </button>
              </div>
            ))}

            {/* Current time indicator */}
            <div
              className="absolute top-0 bottom-0 w-0.5 bg-red-500 z-10 pointer-events-none"
              style={{ left: `${getPositionFromTime(currentTime)}%` }}
            >
              <div className="absolute -top-1 -left-1 w-3 h-3 bg-red-500 rounded-full"></div>
            </div>
          </div>
        </div>

        {/* Segments List */}
        {segments.length > 0 && (
          <div className="space-y-2">
            <div className="text-sm font-medium text-gray-700">Selected Segments</div>
            <div className="space-y-2 max-h-40 overflow-y-auto">
              {segments.map((segment, index) => (
                <div
                  key={segment.id}
                  className="flex items-center space-x-3 p-2 bg-gray-50 rounded border text-sm"
                >
                  <div className="flex items-center space-x-2 flex-1">
                    <MdDragIndicator className="w-4 h-4 text-gray-400" />
                    <span className="font-medium">#{index + 1}</span>
                    <input
                      type="text"
                      value={segment.description}
                      onChange={(e) => updateSegment(segment.id, { description: e.target.value })}
                      className="flex-1 px-2 py-1 border rounded text-xs"
                      placeholder="Segment description"
                    />
                  </div>
                  
                  <div className="flex items-center space-x-2 text-xs text-gray-600">
                    <span>{formatTime(segment.startTime)}</span>
                    <span>-</span>
                    <span>{formatTime(segment.endTime)}</span>
                    <span className="text-gray-400">
                      ({(segment.endTime - segment.startTime).toFixed(1)}s)
                    </span>
                  </div>
                  
                  <button
                    onClick={() => deleteSegment(segment.id)}
                    className="text-red-500 hover:text-red-700 transition-colors"
                  >
                    <MdDelete className="w-4 h-4" />
                  </button>
                </div>
              ))}
            </div>
          </div>
        )}

        {/* Add Segment Button */}
        <button
          onClick={() => addSegment(currentTime, Math.min(currentTime + 3, duration))}
          className="flex items-center space-x-2 px-3 py-2 bg-blue-500 text-white rounded hover:bg-blue-600 transition-colors text-sm"
        >
          <MdAdd className="w-4 h-4" />
          <span>Add 3s Segment at Current Time</span>
        </button>
      </div>
    </div>
  );
}