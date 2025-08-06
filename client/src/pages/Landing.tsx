import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { 
  Play, 
  Video, 
  Zap, 
  Sparkles, 
  Brain, 
  Clock, 
  Users, 
  Star, 
  ArrowRight, 
  ChevronRight,
  Scissors,
  Wand2,
  Target,
  Layers,
  Palette,
  TrendingUp,
  Shield,
  Globe,
  Eye
} from "lucide-react";
import { SubscriptionPricing } from "@/components/SubscriptionPricing";

export default function Landing() {
  const handleLogin = () => {
    window.location.href = "/api/login";
  };

  return (
    <div className="min-h-screen bg-white dark:bg-gray-900 relative overflow-hidden">
      {/* Modern Gradient Background */}
      <div className="absolute inset-0 overflow-hidden pointer-events-none">
        <div className="absolute top-0 left-0 w-full h-full bg-gradient-to-br from-blue-50 via-purple-50 to-pink-50 dark:from-blue-950/20 dark:via-purple-950/20 dark:to-pink-950/20"></div>
        <div className="absolute -top-96 -right-96 w-[800px] h-[800px] bg-gradient-to-r from-blue-500/20 to-purple-500/20 rounded-full blur-3xl animate-pulse"></div>
        <div className="absolute -bottom-96 -left-96 w-[800px] h-[800px] bg-gradient-to-r from-purple-500/20 to-pink-500/20 rounded-full blur-3xl animate-pulse delay-1000"></div>
        <div className="absolute top-1/3 right-1/4 w-96 h-96 bg-gradient-to-r from-yellow-400/10 to-orange-400/10 rounded-full blur-3xl animate-pulse delay-500"></div>
      </div>

      {/* Navigation */}
      <nav className="relative z-20 flex items-center justify-between p-6 max-w-7xl mx-auto">
        <div className="flex items-center gap-3">
          <div className="w-8 h-8 bg-gradient-to-r from-blue-500 to-purple-600 rounded-lg flex items-center justify-center">
            <Video className="w-5 h-5 text-white" />
          </div>
          <span className="text-2xl font-bold bg-gradient-to-r from-gray-900 to-gray-600 dark:from-white dark:to-gray-300 bg-clip-text text-transparent">
            VideoAI
          </span>
        </div>
        <Button 
          onClick={handleLogin}
          className="bg-black dark:bg-white text-white dark:text-black hover:bg-gray-800 dark:hover:bg-gray-100 rounded-full px-6"
        >
          Get Started
        </Button>
      </nav>

      {/* Hero Section */}
      <main className="relative z-10 max-w-7xl mx-auto px-6 py-20">
        <div className="text-center mb-32">
          <div className="mb-8">
            <Badge className="bg-gradient-to-r from-blue-500 to-purple-600 text-white border-none px-6 py-2 text-sm font-medium rounded-full">
              <Sparkles className="w-4 h-4 mr-2" />
              AI Agents for Video Editing
            </Badge>
          </div>
          
          <h1 className="text-5xl md:text-7xl lg:text-8xl font-bold text-gray-900 dark:text-white mb-8 leading-tight tracking-tight">
            A new paradigm for
            <span className="block bg-gradient-to-r from-blue-500 via-purple-500 to-pink-500 bg-clip-text text-transparent"> 
              video editing
            </span>
          </h1>
          
          <p className="text-xl md:text-2xl text-gray-600 dark:text-gray-300 mb-12 max-w-4xl mx-auto leading-relaxed font-light">
            Accelerate hours of editing work to seconds with AI agents. 
            <br className="hidden md:block" />
            Craft your content tile by tile, with intelligent automation.
          </p>
          
          <div className="flex flex-col sm:flex-row gap-4 justify-center items-center mb-16">
            <Button 
              onClick={handleLogin} 
              size="lg" 
              className="bg-black dark:bg-white text-white dark:text-black hover:bg-gray-800 dark:hover:bg-gray-100 text-lg px-8 py-6 rounded-full shadow-lg hover:shadow-xl transition-all duration-300 group"
            >
              <Play className="w-5 h-5 mr-2 group-hover:scale-110 transition-transform" />
              Start Creating
            </Button>
            <Button 
              variant="outline" 
              size="lg"
              className="text-lg px-8 py-6 rounded-full border-2 hover:bg-gray-50 dark:hover:bg-gray-800 transition-all duration-300"
            >
              <Video className="w-5 h-5 mr-2" />
              Watch Demo
            </Button>
          </div>

          {/* Video Tiles Preview */}
          <div className="grid grid-cols-2 md:grid-cols-4 lg:grid-cols-6 gap-4 max-w-6xl mx-auto mb-20">
            {[
              { icon: Scissors, label: "Smart Cut", color: "from-blue-500 to-blue-600" },
              { icon: Wand2, label: "AI Effects", color: "from-purple-500 to-purple-600" },
              { icon: Target, label: "Auto Frame", color: "from-pink-500 to-pink-600" },
              { icon: Layers, label: "B-Roll", color: "from-green-500 to-green-600" },
              { icon: Palette, label: "Color Grade", color: "from-yellow-500 to-orange-500" },
              { icon: TrendingUp, label: "Analytics", color: "from-red-500 to-red-600" }
            ].map((tile, index) => (
              <Card key={index} className="group hover:scale-105 transition-all duration-300 border-0 shadow-lg hover:shadow-xl cursor-pointer">
                <CardContent className="p-6 text-center">
                  <div className={`w-12 h-12 bg-gradient-to-r ${tile.color} rounded-xl flex items-center justify-center mx-auto mb-3 group-hover:rotate-6 transition-transform`}>
                    <tile.icon className="w-6 h-6 text-white" />
                  </div>
                  <p className="text-sm font-medium text-gray-700 dark:text-gray-300">{tile.label}</p>
                </CardContent>
              </Card>
            ))}
          </div>
        </div>

        {/* Canvas Section */}
        <section className="mb-32">
          <div className="text-center mb-16">
            <h2 className="text-4xl md:text-6xl font-bold text-gray-900 dark:text-white mb-6">
              Canvas
            </h2>
            <p className="text-xl text-gray-600 dark:text-gray-300 max-w-3xl mx-auto">
              Drag and drop tiles in a visual canvas to automate your editing workflow. 
              Use pre-built templates or start from scratch.
            </p>
          </div>

          <div className="grid lg:grid-cols-2 gap-16 items-center">
            <div className="space-y-8">
              <div className="flex items-start gap-4">
                <div className="w-12 h-12 bg-gradient-to-r from-blue-500 to-purple-600 rounded-xl flex items-center justify-center flex-shrink-0">
                  <Layers className="w-6 h-6 text-white" />
                </div>
                <div>
                  <h3 className="text-xl font-semibold text-gray-900 dark:text-white mb-2">1 Video → 10 Videos</h3>
                  <p className="text-gray-600 dark:text-gray-300">Generate different versions of your video simultaneously.</p>
                </div>
              </div>
              
              <div className="flex items-start gap-4">
                <div className="w-12 h-12 bg-gradient-to-r from-purple-500 to-pink-500 rounded-xl flex items-center justify-center flex-shrink-0">
                  <Zap className="w-6 h-6 text-white" />
                </div>
                <div>
                  <h3 className="text-xl font-semibold text-gray-900 dark:text-white mb-2">Run in Parallel</h3>
                  <p className="text-gray-600 dark:text-gray-300">Run branches in parallel. Run agents in parallel.</p>
                </div>
              </div>
              
              <div className="flex items-start gap-4">
                <div className="w-12 h-12 bg-gradient-to-r from-pink-500 to-red-500 rounded-xl flex items-center justify-center flex-shrink-0">
                  <Eye className="w-6 h-6 text-white" />
                </div>
                <div>
                  <h3 className="text-xl font-semibold text-gray-900 dark:text-white mb-2">Instant Preview</h3>
                  <p className="text-gray-600 dark:text-gray-300">Track and see results directly in the Canvas.</p>
                </div>
              </div>
            </div>

            <div className="relative">
              <div className="bg-gradient-to-br from-gray-50 to-gray-100 dark:from-gray-800 dark:to-gray-900 rounded-2xl p-8 shadow-2xl">
                <div className="grid grid-cols-3 gap-4">
                  {[...Array(9)].map((_, i) => (
                    <div 
                      key={i} 
                      className={`aspect-square rounded-xl bg-gradient-to-r ${
                        i % 3 === 0 ? 'from-blue-500 to-purple-600' :
                        i % 3 === 1 ? 'from-purple-500 to-pink-500' :
                        'from-pink-500 to-red-500'
                      } flex items-center justify-center transform hover:scale-105 transition-all duration-300 cursor-pointer`}
                    >
                      <div className="w-6 h-6 bg-white/20 rounded-lg"></div>
                    </div>
                  ))}
                </div>
              </div>
            </div>
          </div>
        </section>

        {/* Chat Section */}
        <section className="mb-32">
          <div className="text-center mb-16">
            <h2 className="text-4xl md:text-6xl font-bold text-gray-900 dark:text-white mb-6">
              Chat
            </h2>
            <p className="text-xl text-gray-600 dark:text-gray-300 max-w-3xl mx-auto">
              Chat lets you talk with a multimodal AI and edit your videos in natural language. 
              Chat understands your video, so you can ask it to perform edits based on what it sees and hears.
            </p>
          </div>

          <div className="bg-gradient-to-br from-white to-gray-50 dark:from-gray-800 dark:to-gray-900 rounded-3xl p-8 md:p-16 shadow-2xl">
            <div className="grid lg:grid-cols-2 gap-12 items-center">
              <div className="space-y-6">
                <div className="bg-blue-500 text-white p-4 rounded-2xl rounded-bl-none max-w-xs">
                  "Add dramatic music to the car chase scene"
                </div>
                <div className="bg-gray-200 dark:bg-gray-700 text-gray-900 dark:text-white p-4 rounded-2xl rounded-br-none max-w-xs ml-auto">
                  I've analyzed the car chase scene and added cinematic music that builds tension. The audio levels are balanced with the engine sounds.
                </div>
                <div className="bg-blue-500 text-white p-4 rounded-2xl rounded-bl-none max-w-xs">
                  "Make the colors more vibrant in the sunset shots"
                </div>
                <div className="bg-gray-200 dark:bg-gray-700 text-gray-900 dark:text-white p-4 rounded-2xl rounded-br-none max-w-xs ml-auto">
                  Enhanced the sunset scenes with increased saturation and warmth. The golden hour tones now pop beautifully.
                </div>
              </div>

              <div className="space-y-8">
                <div className="flex items-center gap-4">
                  <div className="w-12 h-12 bg-gradient-to-r from-blue-500 to-purple-600 rounded-xl flex items-center justify-center">
                    <Brain className="w-6 h-6 text-white" />
                  </div>
                  <div>
                    <h3 className="text-lg font-semibold text-gray-900 dark:text-white">Multimodal Understanding</h3>
                    <p className="text-gray-600 dark:text-gray-300">Analyzes visual, audio, and timing cues</p>
                  </div>
                </div>
                
                <div className="flex items-center gap-4">
                  <div className="w-12 h-12 bg-gradient-to-r from-purple-500 to-pink-500 rounded-xl flex items-center justify-center">
                    <Wand2 className="w-6 h-6 text-white" />
                  </div>
                  <div>
                    <h3 className="text-lg font-semibold text-gray-900 dark:text-white">Natural Language Editing</h3>
                    <p className="text-gray-600 dark:text-gray-300">Edit with simple conversation</p>
                  </div>
                </div>
                
                <div className="flex items-center gap-4">
                  <div className="w-12 h-12 bg-gradient-to-r from-pink-500 to-red-500 rounded-xl flex items-center justify-center">
                    <Target className="w-6 h-6 text-white" />
                  </div>
                  <div>
                    <h3 className="text-lg font-semibold text-gray-900 dark:text-white">Context Aware</h3>
                    <p className="text-gray-600 dark:text-gray-300">Understands your timeline and content</p>
                  </div>
                </div>
              </div>
            </div>
          </div>
        </section>

        {/* CTA Section */}
        <section className="text-center mb-20">
          <div className="bg-gradient-to-r from-blue-500 via-purple-500 to-pink-500 rounded-3xl p-16 text-white">
            <h2 className="text-4xl md:text-6xl font-bold mb-6">
              Ready to transform your videos?
            </h2>
            <p className="text-xl md:text-2xl mb-8 max-w-3xl mx-auto opacity-90">
              Join thousands of creators already using AI to accelerate their video editing workflow.
            </p>
            <Button 
              onClick={handleLogin}
              size="lg"
              className="bg-white text-gray-900 hover:bg-gray-100 text-xl px-12 py-6 rounded-full shadow-lg hover:shadow-xl transition-all duration-300 group"
            >
              <Play className="w-6 h-6 mr-3 group-hover:scale-110 transition-transform" />
              Start Creating Free
              <ArrowRight className="w-5 h-5 ml-2 group-hover:translate-x-1 transition-transform" />
            </Button>
          </div>
        </section>
      </main>

      {/* Subscription Pricing Section */}
      <SubscriptionPricing />
    </div>
  );
}