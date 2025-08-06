import { Link } from "wouter";
import { Button } from "@/components/ui/button";
import { ArrowLeft, Zap } from "lucide-react";
import { CompleteAutoFlipShorts } from "@/components/complete-autoflip-shorts";

export default function CompleteAutoFlipPage() {
  return (
    <div className="min-h-screen bg-google-background">
      {/* Header */}
      <header className="bg-white border-b border-gray-200 shadow-sm">
        <div className="max-w-7xl mx-auto px-6 py-4">
          <div className="flex items-center justify-between">
            <div className="flex items-center space-x-4">
              <Link href="/">
                <Button variant="ghost" size="sm" className="gap-2">
                  <ArrowLeft className="h-4 w-4" />
                  Back to Home
                </Button>
              </Link>
              <div className="h-6 w-px bg-gray-300" />
              <div className="flex items-center gap-3">
                <div className="p-2 bg-green-100 dark:bg-green-900 rounded-lg">
                  <Zap className="h-6 w-6 text-green-600 dark:text-green-400" />
                </div>
                <div>
                  <h1 className="text-2xl font-google-sans font-medium text-google-text">
                    Complete AutoFlip
                  </h1>
                  <p className="text-sm font-roboto text-google-text-secondary">
                    Advanced MediaPipe-based intelligent video cropping
                  </p>
                </div>
              </div>
            </div>
          </div>
        </div>
      </header>

      {/* Main Content */}
      <main className="max-w-7xl mx-auto px-6 py-8">
        <div className="mb-8">
          <div className="bg-blue-50 dark:bg-blue-900/20 border border-blue-200 dark:border-blue-800 rounded-lg p-6">
            <h2 className="text-lg font-semibold text-blue-900 dark:text-blue-100 mb-2">
              Complete AutoFlip Implementation
            </h2>
            <p className="text-blue-800 dark:text-blue-200 text-sm leading-relaxed">
              This implementation follows the complete MediaPipe AutoFlip documentation with:
              <br />
              • Multi-modal saliency detection (faces, objects, scene analysis)
              • Scene boundary detection and camera motion analysis
              • Motion stabilization with configurable thresholds
              • Snap-to-center functionality for optimal framing
              • Gemini AI integration for advanced scene understanding
              • Real-time processing statistics and confidence scoring
            </p>
          </div>
        </div>

        <CompleteAutoFlipShorts />
      </main>
    </div>
  );
}