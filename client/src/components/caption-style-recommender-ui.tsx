import { useState } from 'react';
import { Button } from "@/components/ui/button";
import { Card, CardHeader, CardTitle, CardContent } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Sparkles, Brain, Eye, Clock, Users, Mic } from 'lucide-react';
import { apiRequest } from "@/lib/queryClient";
import { useToast } from "@/hooks/use-toast";

interface CaptionStyleRecommendation {
  recommendedStyle: 'readable' | 'verbatim' | 'simplified';
  confidence: number;
  reasoning: string;
  visualSettings: {
    fontSize: number;
    color: string;
    background: string;
    position: 'top' | 'center' | 'bottom';
    animation: 'fade-in' | 'slide-up' | 'slide-down' | 'zoom-in' | 'bounce';
  };
  contentAnalysis: {
    videoType: 'educational' | 'entertainment' | 'professional' | 'casual' | 'technical';
    paceAnalysis: 'fast' | 'moderate' | 'slow';
    audienceLevel: 'beginner' | 'intermediate' | 'advanced';
    speechClarity: 'clear' | 'moderate' | 'challenging';
  };
  alternativeStyles?: {
    style: 'readable' | 'verbatim' | 'simplified';
    reason: string;
    confidence: number;
  }[];
}

interface CaptionStyleRecommenderUIProps {
  videoFilename?: string;
  videoDuration?: number;
  onApplyStyle?: (style: 'readable' | 'verbatim' | 'simplified') => void;
}

export function CaptionStyleRecommenderUI({ 
  videoFilename, 
  videoDuration,
  onApplyStyle 
}: CaptionStyleRecommenderUIProps) {
  const [recommendation, setRecommendation] = useState<CaptionStyleRecommendation | null>(null);
  const [isAnalyzing, setIsAnalyzing] = useState(false);
  const { toast } = useToast();

  const analyzeVideoStyle = async () => {
    if (!videoFilename || !videoDuration) {
      toast({
        title: "Video Required",
        description: "Please upload a video first to get style recommendations",
        variant: "destructive",
      });
      return;
    }

    setIsAnalyzing(true);
    try {
      console.log('🎯 Requesting AI caption style analysis...');
      
      const response = await apiRequest('POST', '/api/caption-style-recommendations', {
        videoFilename,
        videoDuration
      });

      const result = await response.json();
      
      if (result.success) {
        setRecommendation(result.recommendation);
        toast({
          title: "Analysis Complete",
          description: result.message,
        });
      } else {
        throw new Error(result.error || 'Analysis failed');
      }
    } catch (error) {
      console.error('Style analysis error:', error);
      toast({
        title: "Analysis Failed",
        description: error instanceof Error ? error.message : "Failed to analyze video",
        variant: "destructive",
      });
    } finally {
      setIsAnalyzing(false);
    }
  };

  const getStyleColor = (style: string) => {
    switch (style) {
      case 'readable': return 'bg-green-100 text-green-800 border-green-300';
      case 'verbatim': return 'bg-blue-100 text-blue-800 border-blue-300';
      case 'simplified': return 'bg-purple-100 text-purple-800 border-purple-300';
      default: return 'bg-gray-100 text-gray-800 border-gray-300';
    }
  };

  const getContentTypeIcon = (type: string) => {
    switch (type) {
      case 'educational': return <Brain className="h-4 w-4" />;
      case 'entertainment': return <Sparkles className="h-4 w-4" />;
      case 'professional': return <Users className="h-4 w-4" />;
      case 'casual': return <Mic className="h-4 w-4" />;
      case 'technical': return <Eye className="h-4 w-4" />;
      default: return <Clock className="h-4 w-4" />;
    }
  };

  return (
    <div className="space-y-4">
      <Card className="bg-gradient-to-br from-purple-50 to-indigo-50 border-purple-200">
        <CardHeader>
          <CardTitle className="flex items-center gap-2 text-purple-800">
            <Sparkles className="h-5 w-5" />
            AI-Powered Caption Style Recommendations
          </CardTitle>
        </CardHeader>
        <CardContent className="space-y-4">
          <p className="text-sm text-purple-600">
            Get intelligent caption style recommendations based on your video content, pace, and audience.
          </p>
          
          <Button 
            onClick={analyzeVideoStyle}
            disabled={isAnalyzing || !videoFilename}
            className="w-full bg-purple-600 hover:bg-purple-700"
          >
            {isAnalyzing ? (
              <>
                <div className="animate-spin h-4 w-4 border-2 border-white border-t-transparent rounded-full mr-2" />
                Analyzing Video...
              </>
            ) : (
              <>
                <Brain className="h-4 w-4 mr-2" />
                Analyze Video Style
              </>
            )}
          </Button>
        </CardContent>
      </Card>

      {recommendation && (
        <Card className="border-l-4 border-l-purple-500">
          <CardHeader>
            <CardTitle className="flex items-center justify-between">
              <span>Recommended Style</span>
              <Badge className={getStyleColor(recommendation.recommendedStyle)}>
                {recommendation.recommendedStyle.toUpperCase()}
              </Badge>
            </CardTitle>
          </CardHeader>
          <CardContent className="space-y-6">
            {/* Confidence and Reasoning */}
            <div className="space-y-2">
              <div className="flex items-center justify-between">
                <span className="text-sm font-medium">Confidence</span>
                <span className="text-sm text-purple-600 font-bold">
                  {Math.round(recommendation.confidence * 100)}%
                </span>
              </div>
              <div className="w-full bg-gray-200 rounded-full h-2">
                <div 
                  className="bg-purple-500 h-2 rounded-full transition-all duration-300"
                  style={{ width: `${recommendation.confidence * 100}%` }}
                />
              </div>
              <p className="text-sm text-gray-600 mt-2">
                {recommendation.reasoning}
              </p>
            </div>

            {/* Content Analysis */}
            <div className="grid grid-cols-2 gap-4">
              <div className="space-y-2">
                <h4 className="text-sm font-semibold text-gray-700">Content Analysis</h4>
                <div className="space-y-1">
                  <div className="flex items-center gap-2">
                    {getContentTypeIcon(recommendation.contentAnalysis.videoType)}
                    <span className="text-sm">{recommendation.contentAnalysis.videoType}</span>
                  </div>
                  <div className="flex items-center gap-2">
                    <Clock className="h-4 w-4" />
                    <span className="text-sm">{recommendation.contentAnalysis.paceAnalysis} pace</span>
                  </div>
                  <div className="flex items-center gap-2">
                    <Users className="h-4 w-4" />
                    <span className="text-sm">{recommendation.contentAnalysis.audienceLevel} level</span>
                  </div>
                  <div className="flex items-center gap-2">
                    <Mic className="h-4 w-4" />
                    <span className="text-sm">{recommendation.contentAnalysis.speechClarity} clarity</span>
                  </div>
                </div>
              </div>

              <div className="space-y-2">
                <h4 className="text-sm font-semibold text-gray-700">Visual Settings</h4>
                <div className="space-y-1">
                  <div className="text-sm">Font Size: {recommendation.visualSettings.fontSize}px</div>
                  <div className="text-sm">Position: {recommendation.visualSettings.position}</div>
                  <div className="text-sm">Animation: {recommendation.visualSettings.animation}</div>
                  <div className="flex items-center gap-2 text-sm">
                    <span>Color:</span>
                    <div 
                      className="w-4 h-4 rounded border"
                      style={{ backgroundColor: recommendation.visualSettings.color }}
                    />
                    <span className="font-mono text-xs">{recommendation.visualSettings.color}</span>
                  </div>
                </div>
              </div>
            </div>

            {/* Apply Button */}
            <Button 
              onClick={() => onApplyStyle?.(recommendation.recommendedStyle)}
              className="w-full bg-green-600 hover:bg-green-700"
            >
              Apply {recommendation.recommendedStyle.charAt(0).toUpperCase() + recommendation.recommendedStyle.slice(1)} Style
            </Button>

            {/* Alternative Styles */}
            {recommendation.alternativeStyles && recommendation.alternativeStyles.length > 0 && (
              <div className="space-y-2">
                <h4 className="text-sm font-semibold text-gray-700">Alternative Styles</h4>
                <div className="space-y-2">
                  {recommendation.alternativeStyles.map((alt, index) => (
                    <div key={index} className="flex items-center justify-between p-2 bg-gray-50 rounded">
                      <div className="flex items-center gap-2">
                        <Badge className={getStyleColor(alt.style)}>
                          {alt.style.toUpperCase()}
                        </Badge>
                        <span className="text-sm">{alt.reason}</span>
                      </div>
                      <div className="flex items-center gap-2">
                        <span className="text-xs text-gray-500">
                          {Math.round(alt.confidence * 100)}%
                        </span>
                        <Button 
                          size="sm" 
                          variant="outline"
                          onClick={() => onApplyStyle?.(alt.style)}
                        >
                          Apply
                        </Button>
                      </div>
                    </div>
                  ))}
                </div>
              </div>
            )}
          </CardContent>
        </Card>
      )}
    </div>
  );
}