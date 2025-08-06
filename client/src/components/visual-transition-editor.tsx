import React, { useState, useRef, useEffect } from 'react';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Slider } from '@/components/ui/slider';
import { Switch } from '@/components/ui/switch';
import { Badge } from '@/components/ui/badge';
import { Separator } from '@/components/ui/separator';
import { MdMovieCreation, MdTune, MdPreview, MdTimeline, MdSwapHoriz } from 'react-icons/md';
import { TimelineSegment, TextOverlay } from './timeline-editor-fixed';

interface TransitionConfig {
  type: string;
  duration: number;
  easing: string;
  direction?: string;
  intensity?: number;
  customParams?: Record<string, any>;
}

interface VisualTransitionEditorProps {
  segments: TimelineSegment[];
  transitions: TransitionConfig[];
  onTransitionsChange: (transitions: TransitionConfig[]) => void;
  videoUrl: string;
  className?: string;
}

const TRANSITION_TYPES = {
  fade: { name: 'Fade', description: 'Smooth opacity transition', preview: '○ → ●' },
  dissolve: { name: 'Dissolve', description: 'Cross-fade with blending', preview: '◐ ⇄ ◑' },
  slide: { name: 'Slide', description: 'Directional slide movement', preview: '◀ ■ ▶' },
  wipe: { name: 'Wipe', description: 'Progressive reveal', preview: '▌ ■ ▐' },
  zoom: { name: 'Zoom', description: 'Scale transition effect', preview: '⊙ → ●' },
  push: { name: 'Push', description: 'One clip pushes another', preview: '■ → ■' },
  cover: { name: 'Cover', description: 'One clip covers another', preview: '■ ⊡ ■' },
  reveal: { name: 'Reveal', description: 'Progressive reveal effect', preview: '▒ → ■' }
};

const EASING_FUNCTIONS = [
  'linear', 'ease-in', 'ease-out', 'ease-in-out', 'bounce', 'elastic'
];

const DIRECTIONS = ['left', 'right', 'up', 'down', 'center'];

export function VisualTransitionEditor({ 
  segments, 
  transitions, 
  onTransitionsChange, 
  videoUrl, 
  className 
}: VisualTransitionEditorProps) {
  const [selectedTransition, setSelectedTransition] = useState(0);
  const [previewMode, setPreviewMode] = useState(false);
  const [autoPreview, setAutoPreview] = useState(false);
  const canvasRef = useRef<HTMLCanvasElement>(null);

  const transitionCount = Math.max(0, segments.length - 1);

  useEffect(() => {
    // Initialize transitions if needed
    if (transitions.length < transitionCount) {
      const newTransitions: TransitionConfig[] = [];
      for (let i = 0; i < transitionCount; i++) {
        newTransitions.push(transitions[i] || {
          type: 'fade',
          duration: 0.5,
          easing: 'ease-in-out',
          direction: 'center',
          intensity: 1.0
        });
      }
      onTransitionsChange(newTransitions);
    }
  }, [transitionCount, transitions, onTransitionsChange]);

  const updateTransition = (index: number, updates: Partial<TransitionConfig>) => {
    const newTransitions = [...transitions];
    newTransitions[index] = { ...newTransitions[index], ...updates };
    onTransitionsChange(newTransitions);
  };

  const renderTransitionPreview = (transition: TransitionConfig) => {
    const canvas = canvasRef.current;
    if (!canvas) return;

    const ctx = canvas.getContext('2d');
    if (!ctx) return;

    // Clear canvas
    ctx.clearRect(0, 0, canvas.width, canvas.height);

    // Draw transition preview
    const centerX = canvas.width / 2;
    const centerY = canvas.height / 2;
    const size = 40;

    ctx.fillStyle = '#3B82F6';
    
    switch (transition.type) {
      case 'fade':
        ctx.globalAlpha = 0.5;
        ctx.fillRect(centerX - size, centerY - size/2, size, size);
        ctx.globalAlpha = 1.0;
        ctx.fillRect(centerX, centerY - size/2, size, size);
        break;
        
      case 'slide':
        ctx.fillRect(centerX - size/2, centerY - size/2, size/2, size);
        ctx.fillStyle = '#10B981';
        ctx.fillRect(centerX, centerY - size/2, size/2, size);
        break;
        
      case 'wipe':
        ctx.fillRect(centerX - size, centerY - size/2, size * 1.5, size);
        ctx.fillStyle = '#10B981';
        ctx.fillRect(centerX - size/2, centerY - size/2, size * 1.5, size);
        break;
        
      default:
        ctx.fillRect(centerX - size/2, centerY - size/2, size, size);
    }

    ctx.globalAlpha = 1.0;
  };

  useEffect(() => {
    if (selectedTransition < transitions.length) {
      renderTransitionPreview(transitions[selectedTransition]);
    }
  }, [selectedTransition, transitions]);

  const currentTransition = transitions[selectedTransition] || {
    type: 'fade',
    duration: 0.5,
    easing: 'ease-in-out',
    direction: 'center',
    intensity: 1.0
  };

  return (
    <div className={className}>
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center justify-between">
            <div className="flex items-center space-x-2">
              <MdMovieCreation className="w-5 h-5 text-purple-600" />
              <span>Visual Transition Editor</span>
            </div>
            <div className="flex items-center space-x-2">
              <Switch
                checked={autoPreview}
                onCheckedChange={setAutoPreview}
                id="auto-preview"
              />
              <label htmlFor="auto-preview" className="text-sm">Auto Preview</label>
            </div>
          </CardTitle>
        </CardHeader>
        <CardContent className="space-y-6">
          {transitionCount === 0 ? (
            <div className="text-center py-8 text-gray-500">
              <MdTimeline className="w-12 h-12 mx-auto mb-2 opacity-50" />
              <p>Add more segments to create transitions</p>
            </div>
          ) : (
            <>
              {/* Transition Navigator */}
              <div>
                <h4 className="text-sm font-medium mb-3">Transition Points</h4>
                <div className="grid grid-cols-1 gap-2">
                  {Array.from({ length: transitionCount }, (_, index) => (
                    <Button
                      key={index}
                      variant={selectedTransition === index ? 'default' : 'outline'}
                      size="sm"
                      onClick={() => setSelectedTransition(index)}
                      className="justify-start"
                    >
                      <MdSwapHoriz className="w-4 h-4 mr-2" />
                      Segment {index + 1} → {index + 2}
                      <Badge variant="secondary" className="ml-auto">
                        {transitions[index]?.type || 'fade'}
                      </Badge>
                    </Button>
                  ))}
                </div>
              </div>

              <Separator />

              {/* Transition Configuration */}
              <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
                <div className="space-y-4">
                  <h4 className="text-sm font-medium">Transition Settings</h4>
                  
                  {/* Transition Type */}
                  <div className="space-y-2">
                    <label className="text-sm font-medium">Effect Type</label>
                    <Select
                      value={currentTransition.type}
                      onValueChange={(value) => updateTransition(selectedTransition, { type: value })}
                    >
                      <SelectTrigger>
                        <SelectValue />
                      </SelectTrigger>
                      <SelectContent>
                        {Object.entries(TRANSITION_TYPES).map(([key, info]) => (
                          <SelectItem key={key} value={key}>
                            <div className="flex items-center justify-between w-full">
                              <span>{info.name}</span>
                              <span className="text-xs text-gray-500 ml-2">{info.preview}</span>
                            </div>
                          </SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                    <p className="text-xs text-gray-500">
                      {TRANSITION_TYPES[currentTransition.type as keyof typeof TRANSITION_TYPES]?.description}
                    </p>
                  </div>

                  {/* Duration */}
                  <div className="space-y-2">
                    <label className="text-sm font-medium">Duration</label>
                    <Slider
                      value={[currentTransition.duration]}
                      onValueChange={(value) => updateTransition(selectedTransition, { duration: value[0] })}
                      max={3}
                      min={0.1}
                      step={0.1}
                      className="w-full"
                    />
                    <div className="flex justify-between text-xs text-gray-500">
                      <span>0.1s</span>
                      <span>{currentTransition.duration}s</span>
                      <span>3.0s</span>
                    </div>
                  </div>

                  {/* Easing */}
                  <div className="space-y-2">
                    <label className="text-sm font-medium">Easing Function</label>
                    <Select
                      value={currentTransition.easing}
                      onValueChange={(value) => updateTransition(selectedTransition, { easing: value })}
                    >
                      <SelectTrigger>
                        <SelectValue />
                      </SelectTrigger>
                      <SelectContent>
                        {EASING_FUNCTIONS.map((easing) => (
                          <SelectItem key={easing} value={easing}>
                            {easing}
                          </SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                  </div>

                  {/* Direction (for applicable transitions) */}
                  {['slide', 'wipe', 'push', 'cover'].includes(currentTransition.type) && (
                    <div className="space-y-2">
                      <label className="text-sm font-medium">Direction</label>
                      <Select
                        value={currentTransition.direction || 'center'}
                        onValueChange={(value) => updateTransition(selectedTransition, { direction: value })}
                      >
                        <SelectTrigger>
                          <SelectValue />
                        </SelectTrigger>
                        <SelectContent>
                          {DIRECTIONS.map((direction) => (
                            <SelectItem key={direction} value={direction}>
                              {direction}
                            </SelectItem>
                          ))}
                        </SelectContent>
                      </Select>
                    </div>
                  )}

                  {/* Intensity */}
                  <div className="space-y-2">
                    <label className="text-sm font-medium">Intensity</label>
                    <Slider
                      value={[currentTransition.intensity || 1.0]}
                      onValueChange={(value) => updateTransition(selectedTransition, { intensity: value[0] })}
                      max={2}
                      min={0.1}
                      step={0.1}
                      className="w-full"
                    />
                    <div className="flex justify-between text-xs text-gray-500">
                      <span>Subtle</span>
                      <span>{((currentTransition.intensity || 1.0) * 100).toFixed(0)}%</span>
                      <span>Intense</span>
                    </div>
                  </div>
                </div>

                {/* Preview */}
                <div className="space-y-4">
                  <h4 className="text-sm font-medium">Preview</h4>
                  
                  <div className="bg-gray-100 rounded-lg p-4 text-center">
                    <canvas
                      ref={canvasRef}
                      width={200}
                      height={100}
                      className="border rounded-lg bg-white mx-auto mb-3"
                    />
                    
                    <div className="space-y-2">
                      <div className="text-xs text-gray-600">
                        {TRANSITION_TYPES[currentTransition.type as keyof typeof TRANSITION_TYPES]?.name} Transition
                      </div>
                      <div className="text-xs text-gray-500">
                        Duration: {currentTransition.duration}s • Easing: {currentTransition.easing}
                        {currentTransition.direction && ` • Direction: ${currentTransition.direction}`}
                      </div>
                    </div>
                  </div>

                  <Button
                    className="w-full"
                    variant="outline"
                    onClick={() => setPreviewMode(!previewMode)}
                  >
                    <MdPreview className="w-4 h-4 mr-2" />
                    {previewMode ? 'Stop Preview' : 'Preview Transition'}
                  </Button>
                </div>
              </div>

              {/* Transition Summary */}
              <Separator />
              <div>
                <h4 className="text-sm font-medium mb-3">Transition Summary</h4>
                <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-3">
                  {transitions.slice(0, transitionCount).map((transition, index) => (
                    <Card key={index} className="p-3">
                      <div className="flex items-center justify-between mb-2">
                        <Badge variant="outline">T{index + 1}</Badge>
                        <span className="text-xs text-gray-500">
                          {transition.duration}s
                        </span>
                      </div>
                      <div className="text-sm font-medium mb-1">
                        {TRANSITION_TYPES[transition.type as keyof typeof TRANSITION_TYPES]?.name}
                      </div>
                      <div className="text-xs text-gray-600">
                        {transition.easing}
                        {transition.direction && ` • ${transition.direction}`}
                      </div>
                    </Card>
                  ))}
                </div>
              </div>
            </>
          )}
        </CardContent>
      </Card>
    </div>
  );
}