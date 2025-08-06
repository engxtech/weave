import React from 'react';
import { RevideoPlayer } from '@/components/RevideoPlayer';

export function RevideoPage() {
  return (
    <div className="min-h-screen bg-gradient-to-br from-slate-950 via-purple-950 to-slate-950">
      {/* Animated background elements */}
      <div className="absolute inset-0 overflow-hidden">
        <div className="absolute top-1/4 left-1/4 w-96 h-96 bg-purple-600/10 rounded-full blur-3xl animate-pulse" 
             style={{ animationDelay: '0s', animationDuration: '4s' }}></div>
        <div className="absolute top-3/4 right-1/4 w-80 h-80 bg-cyan-600/10 rounded-full blur-3xl animate-pulse" 
             style={{ animationDelay: '2s', animationDuration: '6s' }}></div>
        <div className="absolute bottom-1/4 left-1/3 w-72 h-72 bg-pink-600/10 rounded-full blur-3xl animate-pulse" 
             style={{ animationDelay: '4s', animationDuration: '5s' }}></div>
      </div>

      <div className="relative z-10">
        <div className="container mx-auto px-4 py-8">
          {/* Header */}
          <div className="text-center mb-8">
            <h1 className="text-4xl md:text-6xl font-bold bg-gradient-to-r from-purple-400 via-cyan-400 to-pink-400 bg-clip-text text-transparent mb-4">
              Revideo Editor
            </h1>
            <p className="text-lg md:text-xl text-slate-300 max-w-3xl mx-auto">
              Create professional videos programmatically with AI-powered scene generation, 
              intelligent analysis, and code-based animation control
            </p>
          </div>

          {/* Feature highlights */}
          <div className="grid grid-cols-1 md:grid-cols-3 gap-6 mb-8">
            <div className="backdrop-blur-xl bg-white/5 border border-purple-500/20 rounded-2xl p-6 text-center">
              <div className="w-12 h-12 bg-gradient-to-r from-purple-500 to-pink-500 rounded-lg flex items-center justify-center mx-auto mb-4">
                <svg className="w-6 h-6 text-white" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M13 10V3L4 14h7v7l9-11h-7z" />
                </svg>
              </div>
              <h3 className="text-lg font-semibold text-white mb-2">AI-Powered Analysis</h3>
              <p className="text-slate-400 text-sm">Intelligent video analysis with automatic scene detection and optimization recommendations</p>
            </div>

            <div className="backdrop-blur-xl bg-white/5 border border-cyan-500/20 rounded-2xl p-6 text-center">
              <div className="w-12 h-12 bg-gradient-to-r from-cyan-500 to-blue-500 rounded-lg flex items-center justify-center mx-auto mb-4">
                <svg className="w-6 h-6 text-white" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M7 4V2a1 1 0 011-1h8a1 1 0 011 1v2m-9 4h10m-8 4h6m2 5H6a2 2 0 01-2-2V7a2 2 0 012-2h12a2 2 0 012 2v12a2 2 0 01-2 2z" />
                </svg>
              </div>
              <h3 className="text-lg font-semibold text-white mb-2">Programmatic Control</h3>
              <p className="text-slate-400 text-sm">Code-based video generation with TypeScript scenes and precise animation control</p>
            </div>

            <div className="backdrop-blur-xl bg-white/5 border border-pink-500/20 rounded-2xl p-6 text-center">
              <div className="w-12 h-12 bg-gradient-to-r from-pink-500 to-red-500 rounded-lg flex items-center justify-center mx-auto mb-4">
                <svg className="w-6 h-6 text-white" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 6V4m0 2a2 2 0 100 4m0-4a2 2 0 110 4m-6 8a2 2 0 100-4m0 4a2 2 0 100 4m0-4v2m0-6V4m6 6v10m6-2a2 2 0 100-4m0 4a2 2 0 100 4m0-4v2m0-6V4" />
                </svg>
              </div>
              <h3 className="text-lg font-semibold text-white mb-2">Professional Templates</h3>
              <p className="text-slate-400 text-sm">Ready-made templates for social media, YouTube, presentations, and more</p>
            </div>
          </div>

          {/* Main Revideo Player */}
          <RevideoPlayer className="backdrop-blur-xl bg-white/5 border border-white/10 rounded-2xl p-6" />

          {/* Technical info */}
          <div className="mt-8 text-center">
            <div className="backdrop-blur-xl bg-white/5 border border-white/10 rounded-2xl p-6">
              <h3 className="text-lg font-semibold text-white mb-4">Powered by Revideo v0.10.3</h3>
              <div className="grid grid-cols-2 md:grid-cols-4 gap-4 text-sm">
                <div className="text-slate-300">
                  <div className="font-medium text-white">TypeScript Scenes</div>
                  <div>Code-based animations</div>
                </div>
                <div className="text-slate-300">
                  <div className="font-medium text-white">Headless Rendering</div>
                  <div>Server-side generation</div>
                </div>
                <div className="text-slate-300">
                  <div className="font-medium text-white">AI Integration</div>
                  <div>Gemini-powered analysis</div>
                </div>
                <div className="text-slate-300">
                  <div className="font-medium text-white">Multi-format</div>
                  <div>16:9, 9:16, 1:1 support</div>
                </div>
              </div>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}