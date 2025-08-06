import React, { useEffect, useState, useRef } from 'react';
import { Player } from '@revideo/player-react';
import { Card } from '@/components/ui/card';
import { Loader2, Play, Pause, RotateCcw } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Slider } from '@/components/ui/slider';

interface RevideoPreviewProps {
  nodeId: string;
  nodeType: string;
  nodeConfig: any;
  inputVideo?: string;
}

// Temporarily disable Revideo Player import due to installation issues
// Using video element as fallback
const VideoPreview: React.FC<{ src: string; nodeType: string }> = ({ src, nodeType }) => {
  const videoRef = useRef<HTMLVideoElement>(null);
  const [isPlaying, setIsPlaying] = useState(false);
  const [currentTime, setCurrentTime] = useState(0);
  const [duration, setDuration] = useState(0);

  useEffect(() => {
    const video = videoRef.current;
    if (!video) return;

    const updateTime = () => setCurrentTime(video.currentTime);
    const updateDuration = () => setDuration(video.duration);

    video.addEventListener('timeupdate', updateTime);
    video.addEventListener('loadedmetadata', updateDuration);

    return () => {
      video.removeEventListener('timeupdate', updateTime);
      video.removeEventListener('loadedmetadata', updateDuration);
    };
  }, []);

  const togglePlayPause = () => {
    const video = videoRef.current;
    if (!video) return;

    if (isPlaying) {
      video.pause();
    } else {
      video.play();
    }
    setIsPlaying(!isPlaying);
  };

  const handleSeek = (value: number[]) => {
    const video = videoRef.current;
    if (!video) return;
    video.currentTime = value[0];
    setCurrentTime(value[0]);
  };

  const restart = () => {
    const video = videoRef.current;
    if (!video) return;
    video.currentTime = 0;
    setCurrentTime(0);
    video.play();
    setIsPlaying(true);
  };

  return (
    <div className="space-y-4">
      <div className="relative bg-black rounded-lg overflow-hidden">
        <video
          ref={videoRef}
          src={src}
          className="w-full h-auto"
          onClick={togglePlayPause}
        />
        <div className="absolute inset-0 flex items-center justify-center pointer-events-none">
          {!isPlaying && (
            <div className="bg-white/20 backdrop-blur-sm rounded-full p-4">
              <Play className="w-8 h-8 text-white" />
            </div>
          )}
        </div>
      </div>
      
      <div className="flex items-center gap-2">
        <Button
          size="sm"
          variant="outline"
          onClick={togglePlayPause}
          className="w-10 h-10 p-0"
        >
          {isPlaying ? <Pause className="w-4 h-4" /> : <Play className="w-4 h-4" />}
        </Button>
        
        <Button
          size="sm"
          variant="outline"
          onClick={restart}
          className="w-10 h-10 p-0"
        >
          <RotateCcw className="w-4 h-4" />
        </Button>
        
        <Slider
          value={[currentTime]}
          onValueChange={handleSeek}
          max={duration}
          step={0.1}
          className="flex-1"
        />
        
        <span className="text-sm text-gray-500 min-w-[80px]">
          {formatTime(currentTime)} / {formatTime(duration)}
        </span>
      </div>
    </div>
  );
};

const formatTime = (seconds: number): string => {
  const mins = Math.floor(seconds / 60);
  const secs = Math.floor(seconds % 60);
  return `${mins}:${secs.toString().padStart(2, '0')}`;
};

export const RevideoPreview: React.FC<RevideoPreviewProps> = ({
  nodeId,
  nodeType,
  nodeConfig,
  inputVideo
}) => {
  const [previewUrl, setPreviewUrl] = useState<string | null>(null);
  const [isGenerating, setIsGenerating] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    generatePreview();
  }, [nodeConfig, inputVideo]);

  const generatePreview = async () => {
    if (!inputVideo) return;

    setIsGenerating(true);
    setError(null);

    try {
      const response = await fetch('/api/revideo/generate-preview', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          nodeType,
          inputVideo,
          nodeConfig
        })
      });

      const data = await response.json();

      if (data.success) {
        setPreviewUrl(data.previewUrl);
      } else {
        setError(data.error || 'Failed to generate preview');
      }
    } catch (err) {
      setError('Error generating preview');
      console.error('Preview generation error:', err);
    } finally {
      setIsGenerating(false);
    }
  };

  const getPreviewTitle = () => {
    const titles: Record<string, string> = {
      shorts: 'Shorts Extraction Preview',
      voice: 'Voice Translation Preview',
      captions: 'Caption Generation Preview',
      reframe: 'Reframe Preview',
      cut: 'Content Cut Preview',
      background: 'Background Replacement Preview',
      broll: 'B-Roll Generation Preview',
      music: 'Music Generation Preview',
      eye_contact: 'Eye Contact Correction Preview',
      audio_enhance: 'Audio Enhancement Preview',
      enhancement: 'Video Enhancement Preview'
    };
    return titles[nodeType] || 'Video Preview';
  };

  return (
    <Card className="p-4">
      <h3 className="text-sm font-semibold mb-3">{getPreviewTitle()}</h3>
      
      {isGenerating && (
        <div className="flex items-center justify-center h-48">
          <Loader2 className="w-8 h-8 animate-spin text-purple-500" />
          <span className="ml-2 text-sm text-gray-500">Generating preview...</span>
        </div>
      )}
      
      {error && (
        <div className="text-red-500 text-sm p-4 bg-red-50 rounded">
          {error}
        </div>
      )}
      
      {previewUrl && !isGenerating && (
        <VideoPreview src={previewUrl} nodeType={nodeType} />
      )}
      
      {!inputVideo && !isGenerating && (
        <div className="text-gray-500 text-sm p-4 bg-gray-50 rounded text-center">
          No input video available for preview
        </div>
      )}
    </Card>
  );
};