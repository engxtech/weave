import React from 'react';
import { AppHeader } from '@/components/app-header';
import VideoEditingInterface from '@/components/video-editing-interface';

export default function TimelineEditorRedesigned() {
  return (
    <div className="h-screen flex flex-col bg-slate-950">
      <AppHeader />

      {/* Main Interface - Constrained */}
      <div className="flex-1 overflow-hidden">
        <VideoEditingInterface />
      </div>
    </div>
  );
}