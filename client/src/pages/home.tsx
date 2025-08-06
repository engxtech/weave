import { useState } from 'react';
import { Link } from 'wouter';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { 
  Video, Sparkles, Zap, Code, Play, ArrowRight, Bot,
  Circle, Square, Type, Camera, Grid, Layers, Grid3X3
} from 'lucide-react';

export default function Home() {
  const [hoveredCard, setHoveredCard] = useState<string | null>(null);

  const features = [
    {
      id: 'unified-editor',
      title: 'Unified Video Editor',
      description: 'Single-screen editor with Revideo + Motion Canvas integration',
      icon: Video,
      color: 'from-purple-500 to-pink-500',
      link: '/unified-editor',
      tags: ['Revideo', 'Motion Canvas', 'AI-Powered']
    },
    {
      id: 'split-screen',
      title: 'Split Screen Video',
      description: 'Create engaging split-screen videos with AI subtitles',
      icon: Grid3X3,
      color: 'from-cyan-500 to-blue-500',
      link: '/split-screen',
      tags: ['Split Screen', 'AI Subtitles', 'Templates']
    },
    {
      id: 'timeline-editor',
      title: 'Advanced Timeline',
      description: 'Professional multi-track video editing interface',
      icon: Layers,
      color: 'from-green-500 to-emerald-500',
      link: '/timeline-editor-new',
      tags: ['Multi-track', 'Professional', 'Timeline']
    },
    {
      id: 'ai-shorts-generator',
      title: 'AI Shorts Generator',
      description: 'Create engaging shorts with AI-generated scripts, voices, and visuals',
      icon: Bot,
      color: 'from-orange-500 to-red-500',
      link: '/ai-shorts-generator',
      tags: ['ElevenLabs TTS', 'Gemini AI', 'Viral Content']
    },
    {
      id: 'viral-trend-predictor',
      title: 'Viral Content Predictor',
      description: 'AI-powered viral potential analysis and trend prediction',
      icon: Sparkles,
      color: 'from-cyan-500 to-blue-500',
      link: '/viral-trend-predictor',
      tags: ['AI Analysis', 'Trend Prediction', '2025 Algorithms']
    },
    {
      id: 'node-video-editor',
      title: 'Node Video Editor',
      description: 'Visual workflow builder with drag-and-drop nodes',
      icon: Zap,
      color: 'from-pink-500 to-purple-500',
      link: '/node-video-editor',
      tags: ['Visual Workflow', 'Node-based', 'Automation']
    },
    {
      id: 'visual-remix',
      title: 'Visualise & Remix',
      description: 'Create visual remixes using AI-powered image generation from video frames',
      icon: Sparkles,
      color: 'from-purple-500 to-cyan-500',
      link: '/visual-remix',
      tags: ['AI Generation', 'Visual Remix', 'Frame Extraction']
    }
  ];

  const motionCanvasComponents = [
    { name: 'Circle', icon: Circle, color: 'text-red-400' },
    { name: 'Rectangle', icon: Square, color: 'text-blue-400' },
    { name: 'Text', icon: Type, color: 'text-green-400' },
    { name: 'Video', icon: Camera, color: 'text-purple-400' },
    { name: 'Grid', icon: Grid, color: 'text-cyan-400' },
    { name: 'Layout', icon: Layers, color: 'text-yellow-400' }
  ];

  return (
    <div className="min-h-screen bg-gradient-to-br from-slate-950 via-purple-950 to-slate-950">
      {/* Header */}
      <div className="container mx-auto px-6 py-8">
        <div className="text-center mb-12">
          <div className="flex items-center justify-center gap-3 mb-4">
            <div className="w-12 h-12 bg-gradient-to-br from-purple-500 to-pink-500 rounded-xl flex items-center justify-center">
              <Code className="w-6 h-6 text-white" />
            </div>
            <h1 className="text-4xl font-bold bg-gradient-to-r from-white via-purple-200 to-pink-200 bg-clip-text text-transparent">
              Video Editor Pro
            </h1>
          </div>
          <p className="text-xl text-slate-300 max-w-2xl mx-auto">
            Create stunning videos with code using Revideo and Motion Canvas. 
            Professional editing tools powered by AI and TypeScript.
          </p>
        </div>

        {/* Main Features Grid */}
        <div className="grid md:grid-cols-2 gap-6 mb-12">
          {features.map((feature) => (
            <Card
              key={feature.id}
              className="bg-slate-900/50 border-slate-800 hover:border-purple-500/50 transition-all duration-300 cursor-pointer backdrop-blur-sm"
              onMouseEnter={() => setHoveredCard(feature.id)}
              onMouseLeave={() => setHoveredCard(null)}
            >
              <CardHeader>
                <div className="flex items-center gap-4">
                  <div className={`w-12 h-12 bg-gradient-to-br ${feature.color} rounded-lg flex items-center justify-center`}>
                    <feature.icon className="w-6 h-6 text-white" />
                  </div>
                  <div className="flex-1">
                    <CardTitle className="text-white text-xl">{feature.title}</CardTitle>
                    <p className="text-slate-400 text-sm mt-1">{feature.description}</p>
                  </div>
                  <ArrowRight className={`w-5 h-5 text-slate-500 transition-transform ${
                    hoveredCard === feature.id ? 'translate-x-1 text-purple-400' : ''
                  }`} />
                </div>
              </CardHeader>
              <CardContent>
                <div className="flex flex-wrap gap-2 mb-4">
                  {feature.tags.map((tag) => (
                    <Badge key={tag} variant="secondary" className="bg-slate-800 text-slate-300">
                      {tag}
                    </Badge>
                  ))}
                </div>
                <Link href={feature.link}>
                  <Button className={`w-full bg-gradient-to-r ${feature.color} hover:opacity-90 transition-opacity`}>
                    <Play className="w-4 h-4 mr-2" />
                    Open Editor
                  </Button>
                </Link>
              </CardContent>
            </Card>
          ))}
        </div>

        {/* Motion Canvas Components Showcase */}
        <Card className="bg-slate-900/30 border-slate-800 backdrop-blur-sm">
          <CardHeader>
            <CardTitle className="text-white text-2xl text-center">Motion Canvas Components</CardTitle>
            <p className="text-slate-400 text-center">Drag-and-drop components available in the unified editor</p>
          </CardHeader>
          <CardContent>
            <div className="grid grid-cols-3 md:grid-cols-6 gap-4">
              {motionCanvasComponents.map((component) => (
                <div
                  key={component.name}
                  className="flex flex-col items-center p-4 bg-slate-800/50 rounded-lg hover:bg-slate-700/50 transition-colors"
                >
                  <component.icon className={`w-8 h-8 ${component.color} mb-2`} />
                  <span className="text-slate-300 text-sm font-medium">{component.name}</span>
                </div>
              ))}
            </div>
            <div className="text-center mt-6">
              <Link href="/unified-editor">
                <Button variant="outline" className="border-purple-500 text-purple-400 hover:bg-purple-500/10">
                  <Zap className="w-4 h-4 mr-2" />
                  Try Unified Editor
                </Button>
              </Link>
            </div>
          </CardContent>
        </Card>

        {/* Quick Stats */}
        <div className="grid grid-cols-2 md:grid-cols-4 gap-4 mt-12">
          {[
            { label: 'Components', value: '10+', color: 'text-purple-400' },
            { label: 'Templates', value: '25+', color: 'text-cyan-400' },
            { label: 'AI Features', value: '8', color: 'text-green-400' },
            { label: 'Export Formats', value: '5', color: 'text-orange-400' }
          ].map((stat) => (
            <div key={stat.label} className="text-center">
              <div className={`text-3xl font-bold ${stat.color}`}>{stat.value}</div>
              <div className="text-slate-400 text-sm">{stat.label}</div>
            </div>
          ))}
        </div>
      </div>
    </div>
  );
}