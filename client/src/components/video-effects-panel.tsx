import React, { useState } from 'react';
import { Button } from '@/components/ui/button';
import { Slider } from '@/components/ui/slider';
import { Switch } from '@/components/ui/switch';
import { Label } from '@/components/ui/label';
import { Badge } from '@/components/ui/badge';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { 
  Zap, 
  Sparkles, 
  Palette, 
  Music, 
  Type,
  Wind,
  Sun,
  Contrast,
  Volume2,
  Wand2
} from 'lucide-react';

interface VideoEffectsOptions {
  brightness: number;
  contrast: number;
  saturation: number;
  blur: number;
  sharpen: number;
  warmth: number;
  vignette: number;
  grain: number;
  fadeIn: boolean;
  fadeOut: boolean;
  slowMotion: number;
  speedRamp: number;
  audioFade: boolean;
  audioEcho: number;
  audioBass: number;
}

interface VideoEffectsPanelProps {
  effects: VideoEffectsOptions;
  onEffectsChange: (effects: VideoEffectsOptions) => void;
  onApplyEffect: (effectType: string, intensity: number) => void;
  isProcessing: boolean;
}

export default function VideoEffectsPanel({
  effects,
  onEffectsChange,
  onApplyEffect,
  isProcessing
}: VideoEffectsPanelProps) {
  const [activePreset, setActivePreset] = useState<string | null>(null);

  const updateEffect = (key: keyof VideoEffectsOptions, value: number | boolean) => {
    onEffectsChange({
      ...effects,
      [key]: value
    });
  };

  const presets = [
    {
      name: 'Cinematic',
      icon: <Sparkles className="w-4 h-4" />,
      effects: {
        contrast: 15,
        saturation: 10,
        warmth: 20,
        vignette: 25,
        grain: 5
      }
    },
    {
      name: 'Bright & Vibrant',
      icon: <Sun className="w-4 h-4" />,
      effects: {
        brightness: 20,
        contrast: 10,
        saturation: 30,
        sharpen: 15
      }
    },
    {
      name: 'Vintage',
      icon: <Palette className="w-4 h-4" />,
      effects: {
        warmth: 40,
        contrast: -10,
        saturation: -15,
        grain: 20,
        vignette: 30
      }
    },
    {
      name: 'Dramatic',
      icon: <Contrast className="w-4 h-4" />,
      effects: {
        contrast: 35,
        brightness: -10,
        saturation: 20,
        vignette: 40,
        sharpen: 10
      }
    }
  ];

  const applyPreset = (preset: any) => {
    const newEffects = { ...effects };
    Object.entries(preset.effects).forEach(([key, value]) => {
      (newEffects as any)[key] = value;
    });
    onEffectsChange(newEffects);
    setActivePreset(preset.name);
  };

  return (
    <div className="h-full bg-white border-l border-gray-200">
      <Tabs defaultValue="color" className="h-full flex flex-col">
        <TabsList className="w-full justify-start bg-gray-50 rounded-none border-b border-gray-200">
          <TabsTrigger value="color" className="data-[state=active]:bg-white">Color</TabsTrigger>
          <TabsTrigger value="motion" className="data-[state=active]:bg-white">Motion</TabsTrigger>
          <TabsTrigger value="audio" className="data-[state=active]:bg-white">Audio</TabsTrigger>
          <TabsTrigger value="presets" className="data-[state=active]:bg-white">Presets</TabsTrigger>
        </TabsList>

        <div className="flex-1 overflow-y-auto">
          <TabsContent value="color" className="m-0 p-4 space-y-6">
            <Card>
              <CardHeader>
                <CardTitle className="text-sm flex items-center">
                  <Palette className="w-4 h-4 mr-2" />
                  Color Correction
                </CardTitle>
              </CardHeader>
              <CardContent className="space-y-4">
                <div>
                  <div className="flex items-center justify-between mb-2">
                    <Label className="text-sm">Brightness</Label>
                    <span className="text-xs text-gray-500">{effects.brightness}%</span>
                  </div>
                  <Slider
                    value={[effects.brightness]}
                    onValueChange={(value) => updateEffect('brightness', value[0])}
                    min={-50}
                    max={50}
                    step={1}
                  />
                </div>

                <div>
                  <div className="flex items-center justify-between mb-2">
                    <Label className="text-sm">Contrast</Label>
                    <span className="text-xs text-gray-500">{effects.contrast}%</span>
                  </div>
                  <Slider
                    value={[effects.contrast]}
                    onValueChange={(value) => updateEffect('contrast', value[0])}
                    min={-50}
                    max={50}
                    step={1}
                  />
                </div>

                <div>
                  <div className="flex items-center justify-between mb-2">
                    <Label className="text-sm">Saturation</Label>
                    <span className="text-xs text-gray-500">{effects.saturation}%</span>
                  </div>
                  <Slider
                    value={[effects.saturation]}
                    onValueChange={(value) => updateEffect('saturation', value[0])}
                    min={-50}
                    max={50}
                    step={1}
                  />
                </div>

                <div>
                  <div className="flex items-center justify-between mb-2">
                    <Label className="text-sm">Warmth</Label>
                    <span className="text-xs text-gray-500">{effects.warmth}%</span>
                  </div>
                  <Slider
                    value={[effects.warmth]}
                    onValueChange={(value) => updateEffect('warmth', value[0])}
                    min={-50}
                    max={50}
                    step={1}
                  />
                </div>
              </CardContent>
            </Card>

            <Card>
              <CardHeader>
                <CardTitle className="text-sm flex items-center">
                  <Wand2 className="w-4 h-4 mr-2" />
                  Style Effects
                </CardTitle>
              </CardHeader>
              <CardContent className="space-y-4">
                <div>
                  <div className="flex items-center justify-between mb-2">
                    <Label className="text-sm">Vignette</Label>
                    <span className="text-xs text-gray-500">{effects.vignette}%</span>
                  </div>
                  <Slider
                    value={[effects.vignette]}
                    onValueChange={(value) => updateEffect('vignette', value[0])}
                    min={0}
                    max={100}
                    step={1}
                  />
                </div>

                <div>
                  <div className="flex items-center justify-between mb-2">
                    <Label className="text-sm">Film Grain</Label>
                    <span className="text-xs text-gray-500">{effects.grain}%</span>
                  </div>
                  <Slider
                    value={[effects.grain]}
                    onValueChange={(value) => updateEffect('grain', value[0])}
                    min={0}
                    max={50}
                    step={1}
                  />
                </div>

                <div>
                  <div className="flex items-center justify-between mb-2">
                    <Label className="text-sm">Sharpen</Label>
                    <span className="text-xs text-gray-500">{effects.sharpen}%</span>
                  </div>
                  <Slider
                    value={[effects.sharpen]}
                    onValueChange={(value) => updateEffect('sharpen', value[0])}
                    min={0}
                    max={100}
                    step={1}
                  />
                </div>

                <div>
                  <div className="flex items-center justify-between mb-2">
                    <Label className="text-sm">Blur</Label>
                    <span className="text-xs text-gray-500">{effects.blur}%</span>
                  </div>
                  <Slider
                    value={[effects.blur]}
                    onValueChange={(value) => updateEffect('blur', value[0])}
                    min={0}
                    max={20}
                    step={1}
                  />
                </div>
              </CardContent>
            </Card>
          </TabsContent>

          <TabsContent value="motion" className="m-0 p-4 space-y-6">
            <Card>
              <CardHeader>
                <CardTitle className="text-sm flex items-center">
                  <Wind className="w-4 h-4 mr-2" />
                  Speed & Motion
                </CardTitle>
              </CardHeader>
              <CardContent className="space-y-4">
                <div>
                  <div className="flex items-center justify-between mb-2">
                    <Label className="text-sm">Slow Motion</Label>
                    <span className="text-xs text-gray-500">{effects.slowMotion}x</span>
                  </div>
                  <Slider
                    value={[effects.slowMotion]}
                    onValueChange={(value) => updateEffect('slowMotion', value[0])}
                    min={0.25}
                    max={2}
                    step={0.25}
                  />
                </div>

                <div>
                  <div className="flex items-center justify-between mb-2">
                    <Label className="text-sm">Speed Ramp</Label>
                    <span className="text-xs text-gray-500">{effects.speedRamp}x</span>
                  </div>
                  <Slider
                    value={[effects.speedRamp]}
                    onValueChange={(value) => updateEffect('speedRamp', value[0])}
                    min={0.5}
                    max={4}
                    step={0.1}
                  />
                </div>

                <div className="space-y-3">
                  <div className="flex items-center justify-between">
                    <Label className="text-sm">Fade In</Label>
                    <Switch
                      checked={effects.fadeIn}
                      onCheckedChange={(checked) => updateEffect('fadeIn', checked)}
                    />
                  </div>

                  <div className="flex items-center justify-between">
                    <Label className="text-sm">Fade Out</Label>
                    <Switch
                      checked={effects.fadeOut}
                      onCheckedChange={(checked) => updateEffect('fadeOut', checked)}
                    />
                  </div>
                </div>
              </CardContent>
            </Card>
          </TabsContent>

          <TabsContent value="audio" className="m-0 p-4 space-y-6">
            <Card>
              <CardHeader>
                <CardTitle className="text-sm flex items-center">
                  <Volume2 className="w-4 h-4 mr-2" />
                  Audio Effects
                </CardTitle>
              </CardHeader>
              <CardContent className="space-y-4">
                <div>
                  <div className="flex items-center justify-between mb-2">
                    <Label className="text-sm">Echo</Label>
                    <span className="text-xs text-gray-500">{effects.audioEcho}%</span>
                  </div>
                  <Slider
                    value={[effects.audioEcho]}
                    onValueChange={(value) => updateEffect('audioEcho', value[0])}
                    min={0}
                    max={100}
                    step={1}
                  />
                </div>

                <div>
                  <div className="flex items-center justify-between mb-2">
                    <Label className="text-sm">Bass Boost</Label>
                    <span className="text-xs text-gray-500">{effects.audioBass}%</span>
                  </div>
                  <Slider
                    value={[effects.audioBass]}
                    onValueChange={(value) => updateEffect('audioBass', value[0])}
                    min={0}
                    max={100}
                    step={1}
                  />
                </div>

                <div className="flex items-center justify-between">
                  <Label className="text-sm">Audio Fade</Label>
                  <Switch
                    checked={effects.audioFade}
                    onCheckedChange={(checked) => updateEffect('audioFade', checked)}
                  />
                </div>
              </CardContent>
            </Card>
          </TabsContent>

          <TabsContent value="presets" className="m-0 p-4 space-y-4">
            <div className="grid grid-cols-2 gap-3">
              {presets.map((preset) => (
                <Button
                  key={preset.name}
                  variant={activePreset === preset.name ? "default" : "outline"}
                  onClick={() => applyPreset(preset)}
                  className="h-16 flex flex-col items-center justify-center space-y-1"
                  disabled={isProcessing}
                >
                  {preset.icon}
                  <span className="text-xs">{preset.name}</span>
                </Button>
              ))}
            </div>

            <div className="pt-4 border-t">
              <Button
                className="w-full"
                onClick={() => onApplyEffect('all', 1)}
                disabled={isProcessing}
              >
                {isProcessing ? (
                  <>
                    <Zap className="w-4 h-4 mr-2 animate-pulse" />
                    Applying Effects...
                  </>
                ) : (
                  <>
                    <Zap className="w-4 h-4 mr-2" />
                    Apply All Effects
                  </>
                )}
              </Button>
            </div>
          </TabsContent>
        </div>
      </Tabs>
    </div>
  );
}