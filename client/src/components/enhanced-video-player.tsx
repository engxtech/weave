import React, { useState, useRef, useEffect, useCallback } from 'react';
import { Button } from '@/components/ui/button';
import { Progress } from '@/components/ui/progress';
import { Slider } from '@/components/ui/slider';
import { Badge } from '@/components/ui/badge';
import { MdPlayArrow, MdPause, MdSkipNext, MdSkipPrevious, MdVolumeUp, MdFullscreen, MdSlowMotionVideo, MdVolumeOff } from 'react-icons/md';
import { TimelineSegment, TextOverlay } from './timeline-editor-fixed';

interface EnhancedVideoPlayerProps {
  videoUrl: string;
  segments?: TimelineSegment[];
  currentTime: number;
  onTimeUpdate: (time: number) => void;
  onSegmentSelect?: (index: number) => void;
  selectedSegment?: number;
  className?: string;
  showSegmentOverlay?: boolean;
}

export function EnhancedVideoPlayer({ 
  videoUrl, 
  segments = [], 
  currentTime, 
  onTimeUpdate, 
  onSegmentSelect,
  selectedSegment,
  className = "",
  showSegmentOverlay = true
}: EnhancedVideoPlayerProps) {
  const [isPlaying, setIsPlaying] = useState(false);
  const [volume, setVolume] = useState(1);
  const [playbackRate, setPlaybackRate] = useState(1);
  const [videoDuration, setVideoDuration] = useState(0);
  const [isFullscreen, setIsFullscreen] = useState(false);
  const [isMuted, setIsMuted] = useState(false);
  
  const videoRef = useRef<HTMLVideoElement>(null);
  const containerRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    const video = videoRef.current;
    if (!video) return;

    const updateTime = () => {
      onTimeUpdate(video.currentTime);
    };

    const handleLoadedMetadata = () => {
      setVideoDuration(video.duration);
    };

    const handlePlay = () => setIsPlaying(true);
    const handlePause = () => setIsPlaying(false);

    video.addEventListener('timeupdate', updateTime);
    video.addEventListener('loadedmetadata', handleLoadedMetadata);
    video.addEventListener('play', handlePlay);
    video.addEventListener('pause', handlePause);
    
    return () => {
      video.removeEventListener('timeupdate', updateTime);
      video.removeEventListener('loadedmetadata', handleLoadedMetadata);
      video.removeEventListener('play', handlePlay);
      video.removeEventListener('pause', handlePause);
    };
  }, [onTimeUpdate]);

  // Sync video time with external currentTime prop
  useEffect(() => {
    const video = videoRef.current;
    if (video && Math.abs(video.currentTime - currentTime) > 0.5) {
      video.currentTime = currentTime;
    }
  }, [currentTime]);

  // Keyboard shortcuts
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.target instanceof HTMLInputElement) return;
      
      switch (e.code) {
        case 'Space':
          e.preventDefault();
          togglePlayPause();
          break;
        case 'ArrowLeft':
          e.preventDefault();
          seekRelative(-5);
          break;
        case 'ArrowRight':
          e.preventDefault();
          seekRelative(5);
          break;
        case 'KeyM':
          e.preventDefault();
          toggleMute();
          break;
        case 'KeyF':
          e.preventDefault();
          toggleFullscreen();
          break;
      }
    };

    document.addEventListener('keydown', handleKeyDown);
    return () => document.removeEventListener('keydown', handleKeyDown);
  }, []);

  const togglePlayPause = useCallback(() => {
    const video = videoRef.current;
    if (!video) return;

    if (isPlaying) {
      video.pause();
    } else {
      video.play();
    }
  }, [isPlaying]);

  const seekToTime = useCallback((time: number) => {
    const video = videoRef.current;
    if (!video) return;
    
    const seekTime = Math.max(0, Math.min(time, videoDuration));
    video.currentTime = seekTime;
    onTimeUpdate(seekTime);
  }, [videoDuration, onTimeUpdate]);

  const seekRelative = useCallback((seconds: number) => {
    seekToTime(currentTime + seconds);
  }, [currentTime, seekToTime]);

  const toggleMute = useCallback(() => {
    const video = videoRef.current;
    if (!video) return;
    
    if (isMuted) {
      video.volume = volume;
      setIsMuted(false);
    } else {
      video.volume = 0;
      setIsMuted(true);
    }
  }, [volume, isMuted]);

  const toggleFullscreen = useCallback(() => {
    const container = containerRef.current;
    if (!container) return;

    if (!document.fullscreenElement) {
      container.requestFullscreen();
      setIsFullscreen(true);
    } else {
      document.exitFullscreen();
      setIsFullscreen(false);
    }
  }, []);

  const handleVolumeChange = useCallback((value: number[]) => {
    const video = videoRef.current;
    if (!video) return;
    
    const newVolume = value[0];
    setVolume(newVolume);
    video.volume = newVolume;
    if (newVolume > 0) {
      setIsMuted(false);
    }
  }, []);

  const handlePlaybackRateChange = useCallback((value: number[]) => {
    const video = videoRef.current;
    if (!video) return;
    
    const newRate = value[0];
    setPlaybackRate(newRate);
    video.playbackRate = newRate;
  }, []);

  const handleProgressClick = (e: React.MouseEvent<HTMLDivElement>) => {
    const rect = e.currentTarget.getBoundingClientRect();
    const x = e.clientX - rect.left;
    const clickTime = (x / rect.width) * videoDuration;
    seekToTime(clickTime);
  };

  const getCurrentSegmentIndex = () => {
    return segments.findIndex(segment => 
      currentTime >= segment.startTime && currentTime <= segment.endTime
    );
  };

  const jumpToSegment = (segmentIndex: number) => {
    if (segments[segmentIndex]) {
      seekToTime(segments[segmentIndex].startTime);
      if (onSegmentSelect) {
        onSegmentSelect(segmentIndex);
      }
    }
  };

  return (
    <div className={`relative bg-black rounded-lg overflow-hidden ${className}`} ref={containerRef}>
      <video
        ref={videoRef}
        src={videoUrl}
        className="w-full h-64 object-contain"
        onClick={togglePlayPause}
      />
      
      {/* Segment overlay indicators */}
      {showSegmentOverlay && segments.length > 0 && (
        <div className="absolute top-3 left-3 right-3 flex flex-wrap gap-1">
          {segments.map((segment, index) => {
            const isCurrentSegment = currentTime >= segment.startTime && currentTime <= segment.endTime;
            const isSelected = selectedSegment === index;
            const hasTextOverlays = segment.textOverlays && segment.textOverlays.length > 0;
            return (
              <Badge 
                key={index}
                variant={isCurrentSegment ? "default" : "secondary"}
                className={`text-xs cursor-pointer transition-all ${
                  isCurrentSegment 
                    ? 'bg-red-500 text-white animate-pulse' 
                    : isSelected 
                      ? 'bg-blue-500 text-white'
                      : 'bg-white/80 text-black'
                }`}
                onClick={() => jumpToSegment(index)}
              >
                {index + 1}: {(segment.endTime - segment.startTime).toFixed(1)}s
                {hasTextOverlays && <span className="ml-1">📝</span>}
              </Badge>
            );
          })}
        </div>
      )}

      {/* Text Overlays Preview */}
      {showSegmentOverlay && segments.length > 0 && (
        <div className="absolute inset-0 pointer-events-none">
          {segments.map((segment, segmentIndex) => {
            const isCurrentSegment = currentTime >= segment.startTime && currentTime <= segment.endTime;
            if (!isCurrentSegment || !segment.textOverlays) return null;
            
            return segment.textOverlays.map((overlay) => {
              const segmentRelativeTime = currentTime - segment.startTime;
              const overlayVisible = segmentRelativeTime >= overlay.startTime && 
                                   segmentRelativeTime <= overlay.startTime + overlay.duration;
              
              if (!overlayVisible) return null;
              
              return (
                <div
                  key={overlay.id}
                  className="absolute animate-fade-in"
                  style={{
                    left: `${overlay.position.x}%`,
                    top: `${overlay.position.y}%`,
                    transform: 'translate(-50%, -50%)',
                    color: overlay.style.color,
                    backgroundColor: overlay.style.backgroundColor,
                    fontSize: `${overlay.style.fontSize * 0.5}px`, // Scale down for preview
                    fontWeight: overlay.style.fontWeight,
                    padding: '4px 8px',
                    borderRadius: '4px',
                    maxWidth: '80%',
                    textAlign: 'center',
                    wordWrap: 'break-word'
                  }}
                >
                  {overlay.text}
                </div>
              );
            });
          })}
        </div>
      )}
      
      {/* Enhanced video controls */}
      <div className="absolute bottom-0 left-0 right-0 bg-gradient-to-t from-black via-black/50 to-transparent p-4">
        {/* Progress Bar */}
        <div className="mb-3">
          <Progress 
            value={(currentTime / videoDuration) * 100} 
            className="h-3 cursor-pointer hover:h-4 transition-all"
            onClick={handleProgressClick}
          />
        </div>
        
        {/* Control Buttons */}
        <div className="flex items-center justify-between">
          <div className="flex items-center space-x-3">
            <Button size="sm" variant="ghost" onClick={() => seekRelative(-10)} className="text-white hover:text-gray-300">
              <MdSkipPrevious className="w-5 h-5" />
            </Button>
            <Button size="sm" variant="ghost" onClick={togglePlayPause} className="text-white hover:text-gray-300">
              {isPlaying ? <MdPause className="w-6 h-6" /> : <MdPlayArrow className="w-6 h-6" />}
            </Button>
            <Button size="sm" variant="ghost" onClick={() => seekRelative(10)} className="text-white hover:text-gray-300">
              <MdSkipNext className="w-5 h-5" />
            </Button>
            
            {/* Volume Control */}
            <div className="flex items-center space-x-2">
              <Button size="sm" variant="ghost" onClick={toggleMute} className="text-white hover:text-gray-300">
                {isMuted ? <MdVolumeOff className="w-4 h-4" /> : <MdVolumeUp className="w-4 h-4" />}
              </Button>
              <Slider
                value={[isMuted ? 0 : volume]}
                onValueChange={handleVolumeChange}
                max={1}
                min={0}
                step={0.1}
                className="w-20"
              />
            </div>
          </div>
          
          <div className="flex items-center space-x-3 text-white text-sm">
            {/* Playback Speed */}
            <div className="flex items-center space-x-2">
              <MdSlowMotionVideo className="w-4 h-4" />
              <Slider
                value={[playbackRate]}
                onValueChange={handlePlaybackRateChange}
                max={2}
                min={0.25}
                step={0.25}
                className="w-20"
              />
              <span className="text-xs w-8">{playbackRate}x</span>
            </div>
            
            {/* Time Display */}
            <span className="text-xs">
              {Math.floor(currentTime / 60)}:{Math.floor(currentTime % 60).toString().padStart(2, '0')} / 
              {Math.floor(videoDuration / 60)}:{Math.floor(videoDuration % 60).toString().padStart(2, '0')}
            </span>
            
            {/* Current Segment Display */}
            {showSegmentOverlay && segments.length > 0 && (
              <div className="text-xs">
                Segment: {getCurrentSegmentIndex() >= 0 ? getCurrentSegmentIndex() + 1 : 'None'}
              </div>
            )}
            
            <Button size="sm" variant="ghost" onClick={toggleFullscreen} className="text-white hover:text-gray-300">
              <MdFullscreen className="w-4 h-4" />
            </Button>
          </div>
        </div>
      </div>
      
      {/* Keyboard shortcuts info */}
      <div className="absolute top-3 right-3 bg-black/50 text-white text-xs p-2 rounded opacity-0 hover:opacity-100 transition-opacity">
        Space: Play/Pause • ←/→: Seek • M: Mute • F: Fullscreen
      </div>
    </div>
  );
}