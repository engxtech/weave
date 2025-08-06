import { useState } from 'react';
import { useMutation } from '@tanstack/react-query';
import { apiRequest } from '@/lib/queryClient';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Progress } from '@/components/ui/progress';
import { Alert, AlertDescription } from '@/components/ui/alert';
import { Textarea } from '@/components/ui/textarea';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { TrendingUp, Target, AlertTriangle, Clock, Users, Lightbulb, BarChart3, Zap } from 'lucide-react';

interface ViralMetrics {
  engagementScore: number;
  trendAlignment: number;
  emotionalImpact: number;
  shareability: number;
  timingScore: number;
  contentQuality: number;
  overallViralScore: number;
}

interface ViralPrediction {
  viralScore: number;
  confidence: number;
  metrics: ViralMetrics;
  recommendations: string[];
  trendInsights: string[];
  riskFactors: string[];
  optimalTiming: string[];
  targetAudience: string[];
}

export default function ViralTrendPredictor() {
  const [content, setContent] = useState('');
  const [contentType, setContentType] = useState('video');
  const [platform, setPlatform] = useState('youtube');

  const predictMutation = useMutation({
    mutationFn: async (data: { content: string; contentType: string; platform: string }): Promise<ViralPrediction> => {
      const response = await fetch(`/api/viral-predictor/predict`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          script: data.content,
          contentType: data.contentType,
          targetPlatform: data.platform
        })
      });
      
      if (!response.ok) {
        throw new Error('Failed to predict viral potential');
      }
      
      return response.json();
    }
  });

  const handlePredict = () => {
    if (!content.trim()) return;
    predictMutation.mutate({ content, contentType, platform });
  };

  const getScoreColor = (score: number) => {
    if (score >= 80) return 'text-green-600';
    if (score >= 60) return 'text-yellow-600';
    return 'text-red-600';
  };

  const getScoreLabel = (score: number) => {
    if (score >= 80) return 'High Viral Potential';
    if (score >= 60) return 'Moderate Potential';
    if (score >= 40) return 'Low-Moderate Potential';
    return 'Low Viral Potential';
  };

  const prediction = predictMutation.data;

  return (
    <div className="min-h-screen bg-gradient-to-br from-slate-950 via-purple-950 to-slate-950 p-6">
      {/* Animated Background */}
      <div className="fixed inset-0 overflow-hidden pointer-events-none">
        <div className="absolute -top-40 -right-40 w-80 h-80 bg-purple-500/20 rounded-full blur-3xl animate-pulse" />
        <div className="absolute -bottom-40 -left-40 w-80 h-80 bg-cyan-500/20 rounded-full blur-3xl animate-pulse delay-1000" />
        <div className="absolute top-1/2 left-1/2 transform -translate-x-1/2 -translate-y-1/2 w-80 h-80 bg-pink-500/20 rounded-full blur-3xl animate-pulse delay-2000" />
      </div>

      <div className="max-w-7xl mx-auto relative z-10">
        {/* Header */}
        <div className="text-center mb-8">
          <div className="flex items-center justify-center gap-3 mb-4">
            <div className="p-3 bg-gradient-to-r from-purple-500 to-pink-500 rounded-xl">
              <TrendingUp className="w-8 h-8 text-white" />
            </div>
            <h1 className="text-4xl font-bold bg-gradient-to-r from-purple-400 via-pink-400 to-cyan-400 bg-clip-text text-transparent">
              Viral Content Trend Predictor
            </h1>
          </div>
          <p className="text-gray-300 text-lg max-w-2xl mx-auto">
            Analyze your content's viral potential using AI-powered trend analysis and engagement predictions
          </p>
        </div>

        <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
          {/* Input Section */}
          <div className="lg:col-span-1">
            <Card className="bg-slate-900/50 backdrop-blur-xl border-purple-500/20 shadow-2xl">
              <CardHeader>
                <CardTitle className="text-white flex items-center gap-2">
                  <Zap className="w-5 h-5 text-purple-400" />
                  Content Analysis
                </CardTitle>
                <CardDescription className="text-gray-400">
                  Enter your content to analyze viral potential
                </CardDescription>
              </CardHeader>
              <CardContent className="space-y-4">
                <div>
                  <label className="text-sm font-medium text-gray-300 mb-2 block">
                    Content Type
                  </label>
                  <Select value={contentType} onValueChange={setContentType}>
                    <SelectTrigger className="bg-slate-800/50 border-purple-500/20 text-white">
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent className="bg-slate-800 border-purple-500/20">
                      <SelectItem value="video">Video</SelectItem>
                      <SelectItem value="text">Text Post</SelectItem>
                      <SelectItem value="image">Image Post</SelectItem>
                    </SelectContent>
                  </Select>
                </div>

                <div>
                  <label className="text-sm font-medium text-gray-300 mb-2 block">
                    Target Platform
                  </label>
                  <Select value={platform} onValueChange={setPlatform}>
                    <SelectTrigger className="bg-slate-800/50 border-purple-500/20 text-white">
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent className="bg-slate-800 border-purple-500/20">
                      <SelectItem value="youtube">YouTube</SelectItem>
                      <SelectItem value="tiktok">TikTok</SelectItem>
                      <SelectItem value="instagram">Instagram</SelectItem>
                      <SelectItem value="twitter">Twitter/X</SelectItem>
                    </SelectContent>
                  </Select>
                </div>

                <div>
                  <label className="text-sm font-medium text-gray-300 mb-2 block">
                    Content Script/Description
                  </label>
                  <Textarea
                    value={content}
                    onChange={(e) => setContent(e.target.value)}
                    placeholder="Enter your content script, description, or main text here..."
                    rows={6}
                    className="bg-slate-800/50 border-purple-500/20 text-white placeholder-gray-400 resize-none"
                  />
                  <div className="text-xs text-gray-400 mt-1">
                    {content.split(' ').filter(w => w.length > 0).length} words
                  </div>
                </div>

                <Button
                  onClick={handlePredict}
                  disabled={!content.trim() || predictMutation.isPending}
                  className="w-full bg-gradient-to-r from-purple-600 to-pink-600 hover:from-purple-700 hover:to-pink-700 text-white"
                >
                  {predictMutation.isPending ? (
                    <div className="flex items-center gap-2">
                      <div className="w-4 h-4 border-2 border-white/20 border-t-white rounded-full animate-spin" />
                      Analyzing...
                    </div>
                  ) : (
                    <div className="flex items-center gap-2">
                      <BarChart3 className="w-4 h-4" />
                      Predict Viral Potential
                    </div>
                  )}
                </Button>
              </CardContent>
            </Card>
          </div>

          {/* Results Section */}
          <div className="lg:col-span-2">
            {prediction && (
              <div className="space-y-6">
                {/* Overall Score */}
                <Card className="bg-slate-900/50 backdrop-blur-xl border-purple-500/20 shadow-2xl">
                  <CardHeader>
                    <CardTitle className="text-white flex items-center justify-between">
                      <div className="flex items-center gap-2">
                        <TrendingUp className="w-5 h-5 text-purple-400" />
                        Viral Potential Score
                      </div>
                      <Badge variant="outline" className="bg-purple-500/20 border-purple-500/40 text-purple-300">
                        {prediction.confidence}% Confidence
                      </Badge>
                    </CardTitle>
                  </CardHeader>
                  <CardContent>
                    <div className="text-center mb-6">
                      <div className={`text-6xl font-bold mb-2 ${getScoreColor(prediction.viralScore)}`}>
                        {prediction.viralScore}
                      </div>
                      <div className="text-lg text-gray-300 mb-4">
                        {getScoreLabel(prediction.viralScore)}
                      </div>
                      <Progress 
                        value={prediction.viralScore} 
                        className="h-3 bg-slate-700"
                      />
                    </div>

                    {/* Detailed Metrics */}
                    <div className="grid grid-cols-2 md:grid-cols-3 gap-4">
                      <div className="text-center">
                        <div className="text-2xl font-bold text-purple-400 mb-1">
                          {prediction.metrics.engagementScore}
                        </div>
                        <div className="text-sm text-gray-400">Engagement</div>
                      </div>
                      <div className="text-center">
                        <div className="text-2xl font-bold text-cyan-400 mb-1">
                          {prediction.metrics.trendAlignment}
                        </div>
                        <div className="text-sm text-gray-400">Trend Alignment</div>
                      </div>
                      <div className="text-center">
                        <div className="text-2xl font-bold text-pink-400 mb-1">
                          {prediction.metrics.emotionalImpact}
                        </div>
                        <div className="text-sm text-gray-400">Emotional Impact</div>
                      </div>
                      <div className="text-center">
                        <div className="text-2xl font-bold text-green-400 mb-1">
                          {prediction.metrics.shareability}
                        </div>
                        <div className="text-sm text-gray-400">Shareability</div>
                      </div>
                      <div className="text-center">
                        <div className="text-2xl font-bold text-yellow-400 mb-1">
                          {prediction.metrics.timingScore}
                        </div>
                        <div className="text-sm text-gray-400">Timing</div>
                      </div>
                      <div className="text-center">
                        <div className="text-2xl font-bold text-blue-400 mb-1">
                          {prediction.metrics.contentQuality}
                        </div>
                        <div className="text-sm text-gray-400">Quality</div>
                      </div>
                    </div>
                  </CardContent>
                </Card>

                <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                  {/* Recommendations */}
                  <Card className="bg-slate-900/50 backdrop-blur-xl border-purple-500/20 shadow-2xl">
                    <CardHeader>
                      <CardTitle className="text-white flex items-center gap-2">
                        <Lightbulb className="w-5 h-5 text-yellow-400" />
                        Recommendations
                      </CardTitle>
                    </CardHeader>
                    <CardContent>
                      <div className="space-y-3">
                        {prediction.recommendations.map((rec, index) => (
                          <div key={index} className="flex items-start gap-3 p-3 bg-slate-800/30 rounded-lg">
                            <div className="w-2 h-2 bg-yellow-400 rounded-full mt-2 flex-shrink-0" />
                            <div className="text-gray-300 text-sm">{rec}</div>
                          </div>
                        ))}
                      </div>
                    </CardContent>
                  </Card>

                  {/* Trend Insights */}
                  <Card className="bg-slate-900/50 backdrop-blur-xl border-purple-500/20 shadow-2xl">
                    <CardHeader>
                      <CardTitle className="text-white flex items-center gap-2">
                        <TrendingUp className="w-5 h-5 text-cyan-400" />
                        Trend Insights
                      </CardTitle>
                    </CardHeader>
                    <CardContent>
                      <div className="space-y-3">
                        {prediction.trendInsights.map((insight, index) => (
                          <div key={index} className="flex items-start gap-3 p-3 bg-slate-800/30 rounded-lg">
                            <div className="w-2 h-2 bg-cyan-400 rounded-full mt-2 flex-shrink-0" />
                            <div className="text-gray-300 text-sm">{insight}</div>
                          </div>
                        ))}
                      </div>
                    </CardContent>
                  </Card>

                  {/* Risk Factors */}
                  <Card className="bg-slate-900/50 backdrop-blur-xl border-purple-500/20 shadow-2xl">
                    <CardHeader>
                      <CardTitle className="text-white flex items-center gap-2">
                        <AlertTriangle className="w-5 h-5 text-red-400" />
                        Risk Factors
                      </CardTitle>
                    </CardHeader>
                    <CardContent>
                      <div className="space-y-3">
                        {prediction.riskFactors.length > 0 ? (
                          prediction.riskFactors.map((risk, index) => (
                            <div key={index} className="flex items-start gap-3 p-3 bg-red-900/20 rounded-lg border border-red-500/20">
                              <div className="w-2 h-2 bg-red-400 rounded-full mt-2 flex-shrink-0" />
                              <div className="text-gray-300 text-sm">{risk}</div>
                            </div>
                          ))
                        ) : (
                          <div className="text-gray-400 text-sm text-center py-4">
                            No significant risk factors identified
                          </div>
                        )}
                      </div>
                    </CardContent>
                  </Card>

                  {/* Optimal Timing */}
                  <Card className="bg-slate-900/50 backdrop-blur-xl border-purple-500/20 shadow-2xl">
                    <CardHeader>
                      <CardTitle className="text-white flex items-center gap-2">
                        <Clock className="w-5 h-5 text-green-400" />
                        Optimal Timing
                      </CardTitle>
                    </CardHeader>
                    <CardContent>
                      <div className="space-y-3">
                        {prediction.optimalTiming.map((timing, index) => (
                          <div key={index} className="flex items-start gap-3 p-3 bg-green-900/20 rounded-lg border border-green-500/20">
                            <div className="w-2 h-2 bg-green-400 rounded-full mt-2 flex-shrink-0" />
                            <div className="text-gray-300 text-sm">{timing}</div>
                          </div>
                        ))}
                      </div>
                    </CardContent>
                  </Card>
                </div>

                {/* Target Audience */}
                <Card className="bg-slate-900/50 backdrop-blur-xl border-purple-500/20 shadow-2xl">
                  <CardHeader>
                    <CardTitle className="text-white flex items-center gap-2">
                      <Users className="w-5 h-5 text-purple-400" />
                      Target Audience
                    </CardTitle>
                  </CardHeader>
                  <CardContent>
                    <div className="flex flex-wrap gap-2">
                      {prediction.targetAudience.map((audience, index) => (
                        <Badge
                          key={index}
                          variant="outline"
                          className="bg-purple-500/20 border-purple-500/40 text-purple-300"
                        >
                          {audience}
                        </Badge>
                      ))}
                    </div>
                  </CardContent>
                </Card>
              </div>
            )}

            {predictMutation.isError && (
              <Card className="bg-red-900/20 backdrop-blur-xl border-red-500/20 shadow-2xl">
                <CardContent className="p-6">
                  <div className="flex items-center gap-3 text-red-400">
                    <AlertTriangle className="w-5 h-5" />
                    <div>
                      <div className="font-medium">Analysis Failed</div>
                      <div className="text-sm text-red-300 mt-1">
                        Please try again or check your content input.
                      </div>
                    </div>
                  </div>
                </CardContent>
              </Card>
            )}

            {!prediction && !predictMutation.isPending && !predictMutation.isError && (
              <Card className="bg-slate-900/50 backdrop-blur-xl border-purple-500/20 shadow-2xl">
                <CardContent className="p-12 text-center">
                  <TrendingUp className="w-16 h-16 text-purple-400 mx-auto mb-4" />
                  <h3 className="text-xl font-semibold text-white mb-2">
                    Ready to Analyze
                  </h3>
                  <p className="text-gray-400">
                    Enter your content and select options to get started with viral potential analysis
                  </p>
                </CardContent>
              </Card>
            )}
          </div>
        </div>
      </div>
    </div>
  );
}