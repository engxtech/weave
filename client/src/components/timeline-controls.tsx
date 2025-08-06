import React, { useState, useRef, useEffect } from 'react';
import { Button } from '@/components/ui/button';
import { Slider } from '@/components/ui/slider';
import { Badge } from '@/components/ui/badge';
import { 
  Play, 
  Pause, 
  SkipBack, 
  SkipForward, 
  Volume2, 
  VolumeX,
  Maximize,
  Scissors,
  Copy,
  Trash2
} from 'lucide-react';

interface TimelineControlsProps {
  videoRef: React.RefObject<HTMLVideoElement>;
  currentTime: number;
  duration: number;
  isPlaying: boolean;
  volume: number;
  onPlayPause: () => void;
  onSeek: (time: number) => void;
  onVolumeChange: (volume: number) => void;
  onSplit: (time: number) => void;
  onCut: (startTime: number, endTime: number) => void;
  formatTime: (seconds: number) => string;
  selectedRange?: { start: number; end: number } | null;
  onRangeSelect: (start: number, end: number) => void;
}

export default function TimelineControls({
  videoRef,
  currentTime,
  duration,
  isPlaying,
  volume,
  onPlayPause,
  onSeek,
  onVolumeChange,
  onSplit,
  onCut,
  formatTime,
  selectedRange,
  onRangeSelect
}: TimelineControlsProps) {
  const [isDragging, setIsDragging] = useState(false);
  const [isSelectingRange, setIsSelectingRange] = useState(false);
  const [rangeStart, setRangeStart] = useState<number | null>(null);
  const [showVolumeSlider, setShowVolumeSlider] = useState(false);
  const timelineRef = useRef<HTMLDivElement>(null);

  const handleTimelineClick = (e: React.MouseEvent<HTMLDivElement>) => {
    if (!timelineRef.current || duration === 0) return;

    const rect = timelineRef.current.getBoundingClientRect();
    const clickX = e.clientX - rect.left;
    const percentage = clickX / rect.width;
    const newTime = percentage * duration;

    if (isSelectingRange) {
      if (rangeStart === null) {
        setRangeStart(newTime);
      } else {
        const start = Math.min(rangeStart, newTime);
        const end = Math.max(rangeStart, newTime);
        onRangeSelect(start, end);
        setRangeStart(null);
        setIsSelectingRange(false);
      }
    } else {
      onSeek(newTime);
    }
  };

  const handleTimelineDrag = (e: React.MouseEvent<HTMLDivElement>) => {
    if (!isDragging || !timelineRef.current || duration === 0) return;

    const rect = timelineRef.current.getBoundingClientRect();
    const clickX = e.clientX - rect.left;
    const percentage = Math.max(0, Math.min(1, clickX / rect.width));
    const newTime = percentage * duration;
    
    onSeek(newTime);
  };

  const handleMouseDown = () => {
    setIsDragging(true);
  };

  const handleMouseUp = () => {
    setIsDragging(false);
  };

  const handleKeyDown = (e: KeyboardEvent) => {
    if (e.code === 'Space') {
      e.preventDefault();
      onPlayPause();
    } else if (e.code === 'ArrowLeft') {
      onSeek(Math.max(0, currentTime - 5));
    } else if (e.code === 'ArrowRight') {
      onSeek(Math.min(duration, currentTime + 5));
    } else if (e.code === 'KeyK') {
      onSplit(currentTime);
    }
  };

  useEffect(() => {
    window.addEventListener('keydown', handleKeyDown);
    window.addEventListener('mouseup', handleMouseUp);
    
    return () => {
      window.removeEventListener('keydown', handleKeyDown);
      window.removeEventListener('mouseup', handleMouseUp);
    };
  }, [currentTime, duration]);

  const progressPercentage = duration > 0 ? (currentTime / duration) * 100 : 0;

  return (
    <div className="bg-gray-900 text-white p-4 space-y-3">
      {/* Transport Controls */}
      <div className="flex items-center justify-center space-x-4">
        <Button
          variant="ghost"
          size="sm"
          onClick={() => onSeek(Math.max(0, currentTime - 10))}
          className="text-white hover:bg-gray-700"
        >
          <SkipBack className="w-4 h-4" />
        </Button>
        
        <Button
          variant="ghost"
          size="lg"
          onClick={onPlayPause}
          className="text-white hover:bg-gray-700 bg-blue-600"
        >
          {isPlaying ? <Pause className="w-6 h-6" /> : <Play className="w-6 h-6" />}
        </Button>
        
        <Button
          variant="ghost"
          size="sm"
          onClick={() => onSeek(Math.min(duration, currentTime + 10))}
          className="text-white hover:bg-gray-700"
        >
          <SkipForward className="w-4 h-4" />
        </Button>
      </div>

      {/* Timeline */}
      <div className="space-y-2">
        <div className="flex items-center justify-between text-sm">
          <span>{formatTime(currentTime)}</span>
          <div className="flex space-x-2">
            <Button
              variant="ghost"
              size="sm"
              onClick={() => setIsSelectingRange(!isSelectingRange)}
              className={`text-xs ${isSelectingRange ? 'bg-blue-600' : ''}`}
            >
              Select Range
            </Button>
            {selectedRange && (
              <Button
                variant="ghost"
                size="sm"
                onClick={() => onCut(selectedRange.start, selectedRange.end)}
                className="text-xs"
              >
                <Scissors className="w-3 h-3 mr-1" />
                Cut
              </Button>
            )}
          </div>
          <span>{formatTime(duration)}</span>
        </div>
        
        <div
          ref={timelineRef}
          className="relative h-8 bg-gray-700 rounded cursor-pointer"
          onClick={handleTimelineClick}
          onMouseMove={handleTimelineDrag}
          onMouseDown={handleMouseDown}
        >
          {/* Progress bar */}
          <div
            className="absolute top-0 left-0 h-full bg-blue-500 rounded transition-all duration-100"
            style={{ width: `${progressPercentage}%` }}
          />
          
          {/* Selected range highlight */}
          {selectedRange && (
            <div
              className="absolute top-0 h-full bg-yellow-500/30 border-l-2 border-r-2 border-yellow-500"
              style={{
                left: `${(selectedRange.start / duration) * 100}%`,
                width: `${((selectedRange.end - selectedRange.start) / duration) * 100}%`
              }}
            />
          )}
          
          {/* Range selection preview */}
          {isSelectingRange && rangeStart !== null && (
            <div
              className="absolute top-0 h-full bg-blue-500/20 border-l-2 border-blue-500"
              style={{
                left: `${(rangeStart / duration) * 100}%`,
                width: `${((currentTime - rangeStart) / duration) * 100}%`
              }}
            />
          )}
          
          {/* Current time indicator */}
          <div
            className="absolute top-0 w-1 h-full bg-white shadow-lg transition-all duration-100"
            style={{ left: `${progressPercentage}%` }}
          />
          
          {/* Time markers */}
          {Array.from({ length: Math.floor(duration / 10) }, (_, i) => (
            <div
              key={i}
              className="absolute top-0 w-px h-full bg-gray-500"
              style={{ left: `${((i + 1) * 10 / duration) * 100}%` }}
            />
          ))}
        </div>
      </div>

      {/* Bottom Controls */}
      <div className="flex items-center justify-between">
        <div className="flex items-center space-x-4">
          {/* Volume Control */}
          <div className="flex items-center space-x-2">
            <Button
              variant="ghost"
              size="sm"
              onClick={() => setShowVolumeSlider(!showVolumeSlider)}
              className="text-white hover:bg-gray-700"
            >
              {volume === 0 ? <VolumeX className="w-4 h-4" /> : <Volume2 className="w-4 h-4" />}
            </Button>
            
            {showVolumeSlider && (
              <div className="w-20">
                <Slider
                  value={[volume * 100]}
                  onValueChange={(value) => onVolumeChange(value[0] / 100)}
                  max={100}
                  step={1}
                  className="w-full"
                />
              </div>
            )}
          </div>
          
          {/* Current selection info */}
          {selectedRange && (
            <Badge variant="secondary" className="text-xs">
              Selected: {formatTime(selectedRange.end - selectedRange.start)}
            </Badge>
          )}
        </div>

        <div className="flex items-center space-x-2">
          {/* Edit Tools */}
          <Button
            variant="ghost"
            size="sm"
            onClick={() => onSplit(currentTime)}
            className="text-white hover:bg-gray-700"
          >
            <Scissors className="w-4 h-4" />
          </Button>
          
          <Button
            variant="ghost"
            size="sm"
            onClick={() => videoRef.current?.requestFullscreen()}
            className="text-white hover:bg-gray-700"
          >
            <Maximize className="w-4 h-4" />
          </Button>
        </div>
      </div>

      {/* Keyboard shortcuts info */}
      <div className="text-xs text-gray-400 text-center space-x-4">
        <span>Space: Play/Pause</span>
        <span>←/→: Seek ±5s</span>
        <span>K: Split</span>
      </div>
    </div>
  );
}