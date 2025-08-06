import React, { useState } from 'react';
import { useMutation, useQuery } from '@tanstack/react-query';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Progress } from '@/components/ui/progress';
import { Badge } from '@/components/ui/badge';
import { Checkbox } from '@/components/ui/checkbox';
import { useToast } from '@/hooks/use-toast';
import { Sparkles, Download, Play, Wand2, Image, Volume2, Video, Subtitles, FileText, TrendingUp, Hash, Star } from 'lucide-react';

interface AIShortResult {
  id: string;
  videoPath: string;
  audioPath: string;
  imagesPaths: string[];
  script: string;
  metadata: {
    duration: number;
    voiceName: string;
    style: string;
    createdAt: string;
  };
}

interface VideoDescription {
  viralScore: number;
  confidence: number;
  metrics: {
    engagementScore: number;
    trendAlignment: number;
    emotionalImpact: number;
    shareability: number;
    timingScore: number;
    contentQuality: number;
    overallViralScore: number;
  };
  recommendations: string[];
  trends: string[];
  riskFactors: string[];
  targetAudience: string;
  description?: string;
  hashtags?: string[];
}

interface ElevenLabsVoice {
  voice_id: string;
  name: string;
  category: string;
  description?: string;
}

export default function AIShortsGenerator() {
  const [topic, setTopic] = useState('');
  const [selectedVoice, setSelectedVoice] = useState('Chris');
  const [style, setStyle] = useState('viral');
  const [result, setResult] = useState<AIShortResult | null>(null);
  const [showSubtitles, setShowSubtitles] = useState(false);
  const [subtitleStyle, setSubtitleStyle] = useState('youtube_gaming');
  const [subtitlePosition, setSubtitlePosition] = useState('bottom');
  const [videoDescription, setVideoDescription] = useState<VideoDescription | null>(null);
  const { toast } = useToast();

  // Fetch available voices
  const { data: voicesData, isLoading: voicesLoading, error: voicesError } = useQuery<{voices: ElevenLabsVoice[]}>({
    queryKey: ['/api/elevenlabs/voices'],
    queryFn: async () => {
      const response = await fetch('/api/elevenlabs/voices');
      if (!response.ok) throw new Error('Failed to fetch voices');
      const data = await response.json();
      return data;
    }
  });
  
  // Fallback voices if API fails
  const fallbackVoices: ElevenLabsVoice[] = [
    { voice_id: 'chris', name: 'Chris', category: 'Default' },
    { voice_id: 'will', name: 'Will', category: 'Default' },
    { voice_id: 'sarah', name: 'Sarah', category: 'Default' }
  ];
  
  const voices = Array.isArray(voicesData?.voices) ? voicesData.voices : 
                Array.isArray(fallbackVoices) ? fallbackVoices : [];

  // Debug logging for voice data structure
  console.log('Voice data debug:', { voicesData, voices, voicesLoading, voicesError });

  // Generate AI Short mutation
  const generateMutation = useMutation({
    mutationFn: async () => {
      if (!topic.trim()) throw new Error('Please enter a topic');
      
      const response = await fetch('/api/ai-shorts/generate', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          prompt: topic.trim(),
          duration: 15,
          voiceName: selectedVoice,
          backgroundMusic: '0.5',
          style: style,
          showSubtitles: showSubtitles,
          subtitleStyle: subtitleStyle,
          subtitlePosition: subtitlePosition
        })
      });
      
      if (!response.ok) {
        const errorData = await response.text();
        throw new Error(`Generation failed: ${errorData}`);
      }
      
      const data = await response.json();
      return data.result;
    },
    onSuccess: (data: AIShortResult) => {
      setResult(data);
      toast({
        title: "AI Short generated successfully!",
        description: `Created with ${data.imagesPaths.length} background images`
      });
    },
    onError: (error: Error) => {
      toast({
        title: "Generation failed",
        description: error.message,
        variant: "destructive"
      });
    }
  });

  // Generate video description mutation
  const generateDescriptionMutation = useMutation({
    mutationFn: async () => {
      if (!result) throw new Error('No video result available');
      
      const response = await fetch('/api/viral-predictor/predict', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          title: result.script,
          description: `AI-generated short about: ${topic}`,
          script: result.script,
          style: result.metadata.style,
          duration: result.metadata.duration
        })
      });
      
      if (!response.ok) {
        throw new Error('Failed to generate description');
      }
      
      return await response.json();
    },
    onSuccess: (data) => {
      console.log('Description generation success:', data);
      setVideoDescription(data);
      toast({
        title: "Description Generated!",
        description: `Virality score: ${data.viralScore || 0}/100`,
      });
    },
    onError: (error) => {
      console.error('Description generation error:', error);
      toast({
        title: "Generation Failed",
        description: error instanceof Error ? error.message : "Failed to generate description",
        variant: "destructive",
      });
    },
  });

  const handleGenerate = () => {
    generateMutation.mutate();
  };

  const handleDownload = (url: string, filename: string) => {
    const a = document.createElement('a');
    a.href = url;
    a.download = filename;
    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);
  };

  // Show loading state while voices are being fetched
  if (voicesLoading) {
    return (
      <div className="min-h-screen bg-gradient-to-br from-slate-950 via-purple-950 to-slate-950 p-6 flex items-center justify-center">
        <div className="text-center">
          <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-purple-500 mx-auto mb-4"></div>
          <p className="text-gray-400">Loading AI Shorts Generator...</p>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-gradient-to-br from-slate-950 via-purple-950 to-slate-950 p-6">
      {/* Animated Background */}
      <div className="fixed inset-0 overflow-hidden pointer-events-none">
        <div className="absolute -top-40 -right-40 w-80 h-80 bg-purple-500/20 rounded-full animate-pulse"></div>
        <div className="absolute -bottom-40 -left-40 w-80 h-80 bg-cyan-500/20 rounded-full animate-pulse animation-delay-1000"></div>
        <div className="absolute top-1/2 left-1/2 w-60 h-60 bg-pink-500/10 rounded-full animate-pulse animation-delay-2000"></div>
      </div>

      <div className="relative z-10 max-w-4xl mx-auto">
        <div className="text-center mb-8">
          <div className="inline-flex items-center gap-3 px-6 py-3 bg-gradient-to-r from-purple-600/20 to-pink-600/20 backdrop-blur-sm rounded-full border border-purple-500/30 mb-6">
            <Wand2 className="w-5 h-5 text-purple-400" />
            <span className="text-purple-300 font-medium">AI-Powered Video Creation</span>
          </div>
          
          <h1 className="text-4xl md:text-6xl font-bold mb-4">
            <span className="bg-gradient-to-r from-white via-purple-200 to-pink-200 bg-clip-text text-transparent">
              AI Shorts Generator
            </span>
          </h1>
          
          <p className="text-xl text-gray-400 max-w-2xl mx-auto">
            Create engaging YouTube Shorts in 9:16 portrait format with AI-generated scripts, voiceovers, and visuals. 
            Add subtitles with gaming-style fonts and get viral content analysis!
          </p>
        </div>

        {/* Generation Form */}
        <Card className="bg-slate-900/50 backdrop-blur-xl border-purple-500/20 mb-8">
          <CardHeader>
            <CardTitle className="flex items-center text-white">
              <Sparkles className="mr-2 h-5 w-5 text-purple-400" />
              Create Your AI Short
            </CardTitle>
          </CardHeader>
          <CardContent className="space-y-6">
            <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
              {/* Topic Input */}
              <div className="md:col-span-2">
                <Label htmlFor="topic" className="text-gray-300">Topic</Label>
                <Input
                  id="topic"
                  placeholder="e.g., artificial intelligence, space exploration, cooking tips..."
                  value={topic}
                  onChange={(e) => setTopic(e.target.value)}
                  className="bg-slate-800/50 border-slate-700 text-white placeholder:text-gray-500 focus:border-purple-500"
                />
                <p className="text-sm text-gray-500 mt-1">
                  AI will create a 10-15 word catchy script from your topic
                </p>
              </div>

              {/* Style Selection */}
              <div>
                <Label className="text-gray-300">Style</Label>
                <Select value={style} onValueChange={setStyle}>
                  <SelectTrigger className="bg-slate-800/50 border-slate-700 text-white">
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="viral">🔥 Viral</SelectItem>
                    <SelectItem value="educational">📚 Educational</SelectItem>
                    <SelectItem value="entertainment">🎭 Entertainment</SelectItem>
                    <SelectItem value="story">📖 Story</SelectItem>
                  </SelectContent>
                </Select>
              </div>
            </div>

            {/* Voice Selection */}
            <div>
              <Label className="text-gray-300">Voice</Label>
              <Select value={selectedVoice} onValueChange={setSelectedVoice}>
                <SelectTrigger className="bg-slate-800/50 border-slate-700 text-white">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  {Array.isArray(voices) && voices.length > 0 ? voices.map(voice => (
                    <SelectItem key={voice.voice_id} value={voice.name}>
                      {voice.name} - {voice.category}
                    </SelectItem>
                  )) : (
                    <SelectItem value="Chris">Chris - Default</SelectItem>
                  )}
                </SelectContent>
              </Select>
            </div>

            {/* Subtitle Options */}
            <div className="space-y-4">
              <div className="flex items-center space-x-3">
                <Checkbox
                  id="show-subtitles"
                  checked={showSubtitles}
                  onCheckedChange={(checked) => setShowSubtitles(checked === true)}
                />
                <Label htmlFor="show-subtitles" className="text-gray-300 flex items-center">
                  <Subtitles className="mr-2 h-4 w-4" />
                  Add Subtitles
                </Label>
              </div>
              
              {showSubtitles && (
                <div className="space-y-3">
                  <div>
                    <Label className="text-gray-300">Subtitle Style</Label>
                    <Select value={subtitleStyle} onValueChange={setSubtitleStyle}>
                      <SelectTrigger className="bg-slate-800/50 border-slate-700 text-white">
                        <SelectValue />
                      </SelectTrigger>
                      <SelectContent>
                        <SelectItem value="youtube_gaming">🎮 YouTube Gaming Style</SelectItem>
                        <SelectItem value="tiktok_viral">🔥 TikTok Viral Style</SelectItem>
                        <SelectItem value="instagram_modern">📱 Instagram Modern</SelectItem>
                        <SelectItem value="professional">💼 Professional Clean</SelectItem>
                        <SelectItem value="neon_glow">✨ Neon Glow Effect</SelectItem>
                        <SelectItem value="bold_impact">💥 Bold Impact</SelectItem>
                      </SelectContent>
                    </Select>
                  </div>
                  
                  <div>
                    <Label className="text-gray-300">Subtitle Position</Label>
                    <Select value={subtitlePosition} onValueChange={setSubtitlePosition}>
                      <SelectTrigger className="bg-slate-800/50 border-slate-700 text-white">
                        <SelectValue />
                      </SelectTrigger>
                      <SelectContent>
                        <SelectItem value="top">⬆️ Top</SelectItem>
                        <SelectItem value="center">↔️ Center</SelectItem>
                        <SelectItem value="bottom">⬇️ Bottom</SelectItem>
                      </SelectContent>
                    </Select>
                  </div>
                </div>
              )}
            </div>

            {/* Generate Button */}
            <Button
              onClick={handleGenerate}
              disabled={!topic.trim() || generateMutation.isPending}
              className="w-full bg-gradient-to-r from-purple-600 to-pink-600 hover:from-purple-700 hover:to-pink-700 text-white font-medium py-3"
            >
              {generateMutation.isPending ? (
                <>
                  <Sparkles className="mr-2 h-4 w-4 animate-spin" />
                  Generating AI Short...
                </>
              ) : (
                <>
                  <Wand2 className="mr-2 h-4 w-4" />
                  Generate AI Short
                </>
              )}
            </Button>

            {/* Progress Bar */}
            {generateMutation.isPending && (
              <div className="space-y-2">
                <Progress value={66} className="h-2" />
                <p className="text-sm text-gray-400 text-center">
                  Creating script → Generating images → Processing audio → Building video...
                </p>
              </div>
            )}
          </CardContent>
        </Card>

        {/* Results */}
        {result && (
          <Card className="bg-slate-900/50 backdrop-blur-xl border-purple-500/20">
            <CardHeader>
              <CardTitle className="flex items-center text-white">
                <Video className="mr-2 h-5 w-5 text-green-400" />
                Generated AI Short
              </CardTitle>
            </CardHeader>
            <CardContent className="space-y-6">
              {/* Script */}
              <div>
                <Label className="text-gray-300 mb-2 block">Generated Script</Label>
                <div className="bg-slate-800/50 p-4 rounded-lg border border-slate-700">
                  <p className="text-white italic">"{result.script}"</p>
                  <div className="flex gap-2 mt-3">
                    <Badge variant="secondary" className="bg-purple-600/20 text-purple-300">
                      {result.metadata.style}
                    </Badge>
                    <Badge variant="secondary" className="bg-cyan-600/20 text-cyan-300">
                      {result.metadata.voiceName}
                    </Badge>
                  </div>
                </div>
              </div>

              {/* Video Preview */}
              <div className="space-y-2">
                <Label className="text-gray-300 flex items-center text-lg">
                  <Play className="mr-2 h-5 w-5" />
                  Generated Video Preview
                </Label>
                <div className="bg-slate-800/50 p-6 rounded-lg border border-slate-700">
                  <div className="flex justify-center">
                    <video 
                      src={`/api/media/${result.videoPath.split('/').pop()}`} 
                      controls 
                      autoPlay
                      muted
                      className="w-full max-w-sm h-96 object-cover rounded-lg bg-slate-700 border-2 border-purple-500/30"
                      style={{ aspectRatio: '9/16' }}
                      onError={(e) => {
                        console.error('Video loading error:', e);
                        console.log('Attempted to load:', `/api/media/${result.videoPath.split('/').pop()}`);
                      }}
                    />
                  </div>
                  <div className="flex justify-center mt-4">
                    <Button
                      onClick={() => handleDownload(`/api/media/${result.videoPath.split('/').pop()}`, `ai-short-${result.id}.mp4`)}
                      className="bg-gradient-to-r from-green-600 to-emerald-600 hover:from-green-700 hover:to-emerald-700 text-white px-6 py-2"
                    >
                      <Download className="mr-2 h-4 w-4" />
                      Download Video
                    </Button>
                  </div>
                </div>
              </div>

              {/* Video Description Generator */}
              <div className="space-y-4 pt-4 border-t border-slate-700">
                <div className="flex items-center justify-between">
                  <Label className="text-gray-300 flex items-center text-lg">
                    <FileText className="mr-2 h-5 w-5" />
                    Video Description & Analytics
                  </Label>
                  <Button
                    onClick={() => generateDescriptionMutation.mutate()}
                    disabled={generateDescriptionMutation.isPending}
                    variant="outline"
                    className="bg-gradient-to-r from-cyan-600 to-blue-600 hover:from-cyan-700 hover:to-blue-700 text-white border-0"
                  >
                    {generateDescriptionMutation.isPending ? (
                      <>
                        <TrendingUp className="mr-2 h-4 w-4 animate-spin" />
                        Analyzing...
                      </>
                    ) : (
                      <>
                        <TrendingUp className="mr-2 h-4 w-4" />
                        Generate Description
                      </>
                    )}
                  </Button>
                </div>

                {videoDescription && (
                  <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
                    {/* Recommendations */}
                    <div className="bg-slate-800/30 p-4 rounded-lg border border-slate-600">
                      <h4 className="font-semibold text-white mb-2 flex items-center">
                        <FileText className="mr-2 h-4 w-4 text-blue-400" />
                        AI Recommendations
                      </h4>
                      <div className="space-y-2">
                        {videoDescription.recommendations && Array.isArray(videoDescription.recommendations) ? 
                          videoDescription.recommendations.slice(0, 4).map((rec, index) => (
                            <div key={index} className="text-sm text-gray-300 bg-slate-700/50 p-2 rounded">
                              • {rec}
                            </div>
                          )) : (
                            <div className="text-sm text-gray-400">No recommendations available</div>
                          )
                        }
                      </div>
                      
                      {videoDescription.targetAudience && (
                        <div className="mt-3">
                          <h5 className="font-medium text-white mb-2 flex items-center">
                            <Hash className="mr-2 h-4 w-4 text-green-400" />
                            Target Audience
                          </h5>
                          <Badge variant="secondary" className="bg-green-600/20 text-green-300 text-xs">
                            {videoDescription.targetAudience}
                          </Badge>
                        </div>
                      )}
                    </div>

                    {/* Virality Score */}
                    <div className="bg-slate-800/30 p-4 rounded-lg border border-slate-600">
                      <h4 className="font-semibold text-white mb-3 flex items-center">
                        <Star className="mr-2 h-4 w-4 text-yellow-400" />
                        Virality Analysis
                      </h4>
                      
                      <div className="text-center mb-4">
                        <div className="text-3xl font-bold text-yellow-400">
                          {videoDescription.viralScore || 0}/100
                        </div>
                        <p className="text-sm text-gray-400">Overall Viral Score</p>
                      </div>

                      <div className="space-y-2">
                        {videoDescription.metrics ? (
                          <>
                            <div className="flex justify-between items-center">
                              <span className="text-sm text-gray-300">Engagement</span>
                              <div className="flex items-center gap-2">
                                <div className="w-16 bg-slate-700 rounded-full h-2">
                                  <div 
                                    className="bg-gradient-to-r from-purple-500 to-pink-500 h-2 rounded-full"
                                    style={{ width: `${videoDescription.metrics.engagementScore || 0}%` }}
                                  />
                                </div>
                                <span className="text-xs text-gray-400 w-8">{videoDescription.metrics.engagementScore || 0}</span>
                              </div>
                            </div>
                            
                            <div className="flex justify-between items-center">
                              <span className="text-sm text-gray-300">Content Quality</span>
                              <div className="flex items-center gap-2">
                                <div className="w-16 bg-slate-700 rounded-full h-2">
                                  <div 
                                    className="bg-gradient-to-r from-blue-500 to-cyan-500 h-2 rounded-full"
                                    style={{ width: `${videoDescription.metrics.contentQuality || 0}%` }}
                                  />
                                </div>
                                <span className="text-xs text-gray-400 w-8">{videoDescription.metrics.contentQuality || 0}</span>
                              </div>
                            </div>

                            <div className="flex justify-between items-center">
                              <span className="text-sm text-gray-300">Shareability</span>
                              <div className="flex items-center gap-2">
                                <div className="w-16 bg-slate-700 rounded-full h-2">
                                  <div 
                                    className="bg-gradient-to-r from-green-500 to-emerald-500 h-2 rounded-full"
                                    style={{ width: `${videoDescription.metrics.shareability || 0}%` }}
                                  />
                                </div>
                                <span className="text-xs text-gray-400 w-8">{videoDescription.metrics.shareability || 0}</span>
                              </div>
                            </div>

                            <div className="flex justify-between items-center">
                              <span className="text-sm text-gray-300">Emotional Impact</span>
                              <div className="flex items-center gap-2">
                                <div className="w-16 bg-slate-700 rounded-full h-2">
                                  <div 
                                    className="bg-gradient-to-r from-orange-500 to-yellow-500 h-2 rounded-full"
                                    style={{ width: `${videoDescription.metrics.emotionalImpact || 0}%` }}
                                  />
                                </div>
                                <span className="text-xs text-gray-400 w-8">{videoDescription.metrics.emotionalImpact || 0}</span>
                              </div>
                            </div>

                            <div className="flex justify-between items-center">
                              <span className="text-sm text-gray-300">Confidence</span>
                              <div className="flex items-center gap-2">
                                <div className="w-16 bg-slate-700 rounded-full h-2">
                                  <div 
                                    className="bg-gradient-to-r from-indigo-500 to-purple-500 h-2 rounded-full"
                                    style={{ width: `${videoDescription.confidence || 0}%` }}
                                  />
                                </div>
                                <span className="text-xs text-gray-400 w-8">{videoDescription.confidence || 0}%</span>
                              </div>
                            </div>
                          </>
                        ) : (
                          <div className="text-sm text-gray-400">Metrics not available</div>
                        )}
                      </div>
                    </div>
                  </div>
                )}
              </div>

              {/* Metadata */}
              <div className="flex justify-between items-center text-sm text-gray-400 pt-4 border-t border-slate-700">
                <span>Generated: {new Date(result.metadata.createdAt).toLocaleString()}</span>
                <span>Duration: {result.metadata.duration}s</span>
              </div>
            </CardContent>
          </Card>
        )}
      </div>
    </div>
  );
}