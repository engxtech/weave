import React from 'react';
import { Link, useLocation } from 'wouter';
import { Button } from '@/components/ui/button';
import { Sparkles, Film, Layers, Home, Palette, Images } from 'lucide-react';

interface WeaveHeaderProps {
  showGallery?: boolean;
  onGalleryClick?: () => void;
}

export function WeaveHeader({ showGallery, onGalleryClick }: WeaveHeaderProps) {
  const [location] = useLocation();
  
  return (
    <header className="bg-slate-900/90 backdrop-blur-xl border-b border-purple-500/20 sticky top-0 z-50">
      <div className="container mx-auto px-4">
        <div className="flex items-center justify-between h-16">
          {/* Logo and Brand */}
          <div className="flex items-center gap-6">
            <Link href="/">
              <a className="flex items-center gap-2 text-white hover:text-purple-400 transition-colors">
                <Sparkles className="w-6 h-6 text-purple-400" />
                <span className="font-bold text-xl">Weave</span>
              </a>
            </Link>
            
            {/* Navigation */}
            <nav className="hidden md:flex items-center gap-4">
              <Link href="/visual-remix">
                <a className={`flex items-center gap-2 px-3 py-2 rounded-lg transition-colors ${
                  location === '/visual-remix' 
                    ? 'bg-purple-600/20 text-purple-400' 
                    : 'text-slate-300 hover:text-white hover:bg-slate-800/50'
                }`}>
                  <Palette className="w-4 h-4" />
                  Visual Remix
                </a>
              </Link>
              
              <Link href="/workflows">
                <a className={`flex items-center gap-2 px-3 py-2 rounded-lg transition-colors ${
                  location === '/workflows' 
                    ? 'bg-purple-600/20 text-purple-400' 
                    : 'text-slate-300 hover:text-white hover:bg-slate-800/50'
                }`}>
                  <Layers className="w-4 h-4" />
                  Workflows
                </a>
              </Link>
              
              <Link href="/video-editor">
                <a className={`flex items-center gap-2 px-3 py-2 rounded-lg transition-colors ${
                  location === '/video-editor' 
                    ? 'bg-purple-600/20 text-purple-400' 
                    : 'text-slate-300 hover:text-white hover:bg-slate-800/50'
                }`}>
                  <Film className="w-4 h-4" />
                  Editor
                </a>
              </Link>
            </nav>
          </div>
          
          {/* Actions */}
          <div className="flex items-center gap-4">
            {showGallery && (
              <Button
                onClick={onGalleryClick}
                variant="outline"
                size="sm"
                className="border-purple-500/50 text-purple-400 hover:bg-purple-600/20"
              >
                <Images className="w-4 h-4 mr-2" />
                Gallery
              </Button>
            )}
            
            <Link href="/">
              <Button
                variant="ghost"
                size="sm"
                className="text-slate-300 hover:text-white"
              >
                <Home className="w-4 h-4" />
              </Button>
            </Link>
          </div>
        </div>
      </div>
    </header>
  );
}