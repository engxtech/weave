import React, { useState, useRef, useEffect } from 'react';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Progress } from '@/components/ui/progress';
import { Separator } from '@/components/ui/separator';
import { Badge } from '@/components/ui/badge';
import { MdPlayArrow, MdPause, MdSkipNext, MdSkipPrevious, MdVisibility, MdTrendingUp } from 'react-icons/md';
import { TimelineSegment, TextOverlay } from './timeline-editor-fixed';

interface SegmentPreviewProps {
  segments: TimelineSegment[];
  videoUrl: string;
  onSegmentSelect: (index: number) => void;
  selectedSegment: number;
  className?: string;
}

interface SegmentMetadata {
  duration: number;
  action: string;
  description: string;
  estimatedEngagement: number;
  transitionType?: string;
}

export function SegmentPreview({ segments, videoUrl, onSegmentSelect, selectedSegment, className }: SegmentPreviewProps) {
  const [isPlaying, setIsPlaying] = useState(false);
  const [currentTime, setCurrentTime] = useState(0);
  const [previewMode, setPreviewMode] = useState<'timeline' | 'segments'>('timeline');
  const videoRef = useRef<HTMLVideoElement>(null);

  const segmentMetadata: SegmentMetadata[] = segments.map((segment, index) => ({
    duration: segment.endTime - segment.startTime,
    action: segment.action || 'Video Clip',
    description: segment.description || `Segment ${index + 1}`,
    estimatedEngagement: Math.random() * 40 + 60, // Simulate engagement score
    transitionType: index < segments.length - 1 ? getTransitionType(index) : undefined
  }));

  function getTransitionType(index: number): string {
    const transitions = ['fade', 'dissolve', 'slide', 'wipe', 'zoom'];
    return transitions[index % transitions.length];
  }

  useEffect(() => {
    const video = videoRef.current;
    if (!video) return;

    const updateTime = () => {
      setCurrentTime(video.currentTime);
    };

    video.addEventListener('timeupdate', updateTime);
    return () => video.removeEventListener('timeupdate', updateTime);
  }, []);

  const handlePlayPause = () => {
    const video = videoRef.current;
    if (!video) return;

    if (isPlaying) {
      video.pause();
    } else {
      video.play();
    }
    setIsPlaying(!isPlaying);
  };

  const jumpToSegment = (segmentIndex: number) => {
    const video = videoRef.current;
    if (!video) return;

    const segment = segments[segmentIndex];
    video.currentTime = segment.startTime;
    onSegmentSelect(segmentIndex);
  };

  const getCurrentSegmentIndex = () => {
    return segments.findIndex(segment => 
      currentTime >= segment.startTime && currentTime <= segment.endTime
    );
  };

  const totalDuration = segments.reduce((sum, segment) => sum + (segment.endTime - segment.startTime), 0);

  return (
    <div className={className}>
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center justify-between">
            <div className="flex items-center space-x-2">
              <MdVisibility className="w-5 h-5 text-blue-600" />
              <span>Segment Preview & Analysis</span>
            </div>
            <div className="flex space-x-2">
              <Button
                size="sm"
                variant={previewMode === 'timeline' ? 'default' : 'outline'}
                onClick={() => setPreviewMode('timeline')}
              >
                Timeline
              </Button>
              <Button
                size="sm"
                variant={previewMode === 'segments' ? 'default' : 'outline'}
                onClick={() => setPreviewMode('segments')}
              >
                Segments
              </Button>
            </div>
          </CardTitle>
        </CardHeader>
        <CardContent className="space-y-4">
          {/* Enhanced Video Preview */}
          <div className="relative bg-black rounded-lg overflow-hidden">
            <video
              ref={videoRef}
              src={videoUrl}
              className="w-full h-64 bg-black object-contain"
              onPlay={() => setIsPlaying(true)}
              onPause={() => setIsPlaying(false)}
              onClick={handlePlayPause}
            />
            
            {/* Segment overlay indicators */}
            <div className="absolute top-3 left-3 right-3 flex flex-wrap gap-1">
              {segments.map((segment, index) => {
                const isCurrentSegment = currentTime >= segment.startTime && currentTime <= segment.endTime;
                return (
                  <Badge 
                    key={index}
                    variant={isCurrentSegment ? "default" : "secondary"}
                    className={`text-xs cursor-pointer transition-all ${
                      isCurrentSegment ? 'bg-red-500 text-white animate-pulse' : 'bg-white/80 text-black'
                    }`}
                    onClick={() => jumpToSegment(index)}
                  >
                    {index + 1}: {(segment.endTime - segment.startTime).toFixed(1)}s
                  </Badge>
                );
              })}
            </div>
            
            {/* Enhanced video controls */}
            <div className="absolute bottom-0 left-0 right-0 bg-gradient-to-t from-black via-black/50 to-transparent p-4">
              <div className="mb-3">
                <Progress 
                  value={(currentTime / totalDuration) * 100} 
                  className="h-3 cursor-pointer hover:h-4 transition-all"
                  onClick={(e) => {
                    const rect = e.currentTarget.getBoundingClientRect();
                    const x = e.clientX - rect.left;
                    const clickTime = (x / rect.width) * totalDuration;
                    const video = videoRef.current;
                    if (video) video.currentTime = clickTime;
                  }}
                />
              </div>
              
              <div className="flex items-center justify-between">
                <div className="flex items-center space-x-2">
                  <Button
                    size="sm"
                    variant="ghost"
                    onClick={handlePlayPause}
                    className="text-white hover:text-gray-300"
                  >
                    {isPlaying ? <MdPause className="w-5 h-5" /> : <MdPlayArrow className="w-5 h-5" />}
                  </Button>
                  
                  <div className="text-white text-sm">
                    {Math.floor(currentTime / 60)}:{Math.floor(currentTime % 60).toString().padStart(2, '0')} / 
                    {Math.floor(totalDuration / 60)}:{Math.floor(totalDuration % 60).toString().padStart(2, '0')}
                  </div>
                </div>
                
                <div className="text-white text-xs">
                  Playing: {getCurrentSegmentIndex() >= 0 ? `Segment ${getCurrentSegmentIndex() + 1}` : 'None'}
                </div>
              </div>
            </div>
          </div>

          {previewMode === 'timeline' && (
            <div className="space-y-4">
              {/* Concatenation Timeline */}
              <div>
                <h4 className="text-sm font-medium mb-2">Concatenation Timeline</h4>
                <div className="relative h-12 bg-gray-100 rounded-lg overflow-hidden">
                  {segments.map((segment, index) => {
                    const duration = segment.endTime - segment.startTime;
                    const width = (duration / totalDuration) * 100;
                    const isActive = getCurrentSegmentIndex() === index;
                    
                    return (
                      <div
                        key={index}
                        className={`absolute h-full cursor-pointer transition-all ${
                          isActive ? 'bg-blue-500 border-2 border-blue-700' : 'bg-blue-300 hover:bg-blue-400'
                        }`}
                        style={{
                          left: `${segments.slice(0, index).reduce((sum, s) => sum + ((s.endTime - s.startTime) / totalDuration) * 100, 0)}%`,
                          width: `${width}%`
                        }}
                        onClick={() => jumpToSegment(index)}
                      >
                        <div className="h-full flex items-center justify-center text-xs text-white font-medium">
                          {index + 1}
                        </div>
                        {segmentMetadata[index].transitionType && (
                          <div className="absolute -right-2 top-0 bottom-0 w-4 bg-gradient-to-r from-blue-400 to-blue-600 flex items-center justify-center">
                            <div className="w-1 h-6 bg-white opacity-70"></div>
                          </div>
                        )}
                      </div>
                    );
                  })}
                </div>
              </div>

              {/* Transition Preview */}
              <div>
                <h4 className="text-sm font-medium mb-2">Transition Effects</h4>
                <div className="grid grid-cols-2 gap-2">
                  {segmentMetadata.slice(0, -1).map((metadata, index) => (
                    <div key={index} className="flex items-center space-x-2 p-2 bg-gray-50 rounded">
                      <div className="w-3 h-3 bg-blue-400 rounded"></div>
                      <span className="text-xs text-gray-600">
                        Segment {index + 1} → {index + 2}
                      </span>
                      <Badge variant="outline" className="text-xs">
                        {metadata.transitionType}
                      </Badge>
                    </div>
                  ))}
                </div>
              </div>
            </div>
          )}

          {previewMode === 'segments' && (
            <div className="space-y-3">
              <h4 className="text-sm font-medium">Segment Analysis & Metadata</h4>
              {segmentMetadata.map((metadata, index) => (
                <Card key={index} className={`cursor-pointer transition-all ${selectedSegment === index ? 'ring-2 ring-blue-500' : ''}`}>
                  <CardContent className="p-3" onClick={() => jumpToSegment(index)}>
                    <div className="flex items-center justify-between mb-2">
                      <div className="flex items-center space-x-2">
                        <Badge variant="secondary">Segment {index + 1}</Badge>
                        <span className="text-sm font-medium">{metadata.action}</span>
                      </div>
                      <div className="flex items-center space-x-1 text-green-600">
                        <MdTrendingUp className="w-4 h-4" />
                        <span className="text-xs">{metadata.estimatedEngagement.toFixed(0)}%</span>
                      </div>
                    </div>
                    
                    <div className="grid grid-cols-3 gap-2 text-xs text-gray-600">
                      <div>
                        <span className="font-medium">Duration:</span>
                        <div>{metadata.duration.toFixed(1)}s</div>
                      </div>
                      <div>
                        <span className="font-medium">Start:</span>
                        <div>{segments[index].startTime.toFixed(1)}s</div>
                      </div>
                      <div>
                        <span className="font-medium">End:</span>
                        <div>{segments[index].endTime.toFixed(1)}s</div>
                      </div>
                    </div>
                    
                    <div className="mt-2">
                      <p className="text-xs text-gray-700">{metadata.description}</p>
                    </div>
                    
                    {metadata.transitionType && (
                      <div className="mt-2 flex items-center space-x-1">
                        <span className="text-xs text-gray-500">Transition:</span>
                        <Badge variant="outline" className="text-xs">
                          {metadata.transitionType}
                        </Badge>
                      </div>
                    )}
                  </CardContent>
                </Card>
              ))}
            </div>
          )}

          {/* Quick Actions */}
          <Separator />
          <div className="flex items-center justify-between">
            <div className="flex space-x-2">
              <Button
                size="sm"
                variant="outline"
                onClick={() => jumpToSegment(Math.max(0, selectedSegment - 1))}
                disabled={selectedSegment <= 0}
              >
                <MdSkipPrevious className="w-4 h-4" />
              </Button>
              <Button
                size="sm"
                variant="outline"
                onClick={() => jumpToSegment(Math.min(segments.length - 1, selectedSegment + 1))}
                disabled={selectedSegment >= segments.length - 1}
              >
                <MdSkipNext className="w-4 h-4" />
              </Button>
            </div>
            
            <div className="text-sm text-gray-600">
              {segments.length} segments • {totalDuration.toFixed(1)}s total
            </div>
          </div>
        </CardContent>
      </Card>
    </div>
  );
}