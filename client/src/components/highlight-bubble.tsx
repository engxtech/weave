import React from 'react';
import { Badge } from '@/components/ui/badge';
import { Search, Eye, Zap, Sparkles } from 'lucide-react';

interface HighlightBubbleProps {
  type: 'search' | 'ai-detected' | 'smart-crop' | 'focus-point';
  relevanceScore?: number;
  description?: string;
  position: {
    x: number; // percentage from left
    y: number; // percentage from top
  };
  size?: 'sm' | 'md' | 'lg';
  onClick?: () => void;
  isVisible?: boolean;
  pulseAnimation?: boolean;
}

export const HighlightBubble: React.FC<HighlightBubbleProps> = ({
  type,
  relevanceScore = 0.8,
  description,
  position,
  size = 'md',
  onClick,
  isVisible = true,
  pulseAnimation = false
}) => {
  if (!isVisible) return null;

  const getTypeConfig = () => {
    switch (type) {
      case 'search':
        return {
          icon: Search,
          color: 'bg-cyan-500/80',
          borderColor: 'border-cyan-400',
          label: 'Search Match',
          glowColor: 'shadow-cyan-500/50'
        };
      case 'ai-detected':
        return {
          icon: Sparkles,
          color: 'bg-purple-500/80',
          borderColor: 'border-purple-400',
          label: 'AI Detected',
          glowColor: 'shadow-purple-500/50'
        };
      case 'smart-crop':
        return {
          icon: Zap,
          color: 'bg-emerald-500/80',
          borderColor: 'border-emerald-400',
          label: 'Smart Crop',
          glowColor: 'shadow-emerald-500/50'
        };
      case 'focus-point':
        return {
          icon: Eye,
          color: 'bg-amber-500/80',
          borderColor: 'border-amber-400',
          label: 'Focus Point',
          glowColor: 'shadow-amber-500/50'
        };
      default:
        return {
          icon: Search,
          color: 'bg-blue-500/80',
          borderColor: 'border-blue-400',
          label: 'Highlight',
          glowColor: 'shadow-blue-500/50'
        };
    }
  };

  const getSizeClasses = () => {
    switch (size) {
      case 'sm':
        return 'w-6 h-6';
      case 'lg':
        return 'w-12 h-12';
      default:
        return 'w-8 h-8';
    }
  };

  const config = getTypeConfig();
  const Icon = config.icon;

  return (
    <div
      className={`absolute transform -translate-x-1/2 -translate-y-1/2 z-20 ${
        onClick ? 'cursor-pointer' : ''
      }`}
      style={{
        left: `${position.x}%`,
        top: `${position.y}%`,
      }}
      onClick={onClick}
    >
      {/* Main bubble */}
      <div
        className={`
          ${getSizeClasses()}
          ${config.color}
          ${config.borderColor}
          ${config.glowColor}
          border-2 rounded-full
          backdrop-blur-sm
          flex items-center justify-center
          transition-all duration-300
          hover:scale-110
          shadow-lg
          ${pulseAnimation ? 'animate-pulse' : ''}
        `}
      >
        <Icon className="w-4 h-4 text-white" />
      </div>

      {/* Relevance score badge */}
      {relevanceScore && (
        <Badge
          variant="secondary"
          className={`
            absolute -top-2 -right-2 
            bg-black/80 text-white 
            text-xs px-1.5 py-0.5
            border ${config.borderColor}
            min-w-[2rem] text-center
          `}
        >
          {Math.round(relevanceScore * 100)}%
        </Badge>
      )}

      {/* Tooltip on hover */}
      {description && (
        <div className="absolute bottom-full left-1/2 transform -translate-x-1/2 mb-2 opacity-0 hover:opacity-100 transition-opacity duration-200 pointer-events-none group-hover:pointer-events-auto">
          <div className="bg-black/90 text-white text-xs px-2 py-1 rounded whitespace-nowrap">
            {description}
            <div className="absolute top-full left-1/2 transform -translate-x-1/2 border-4 border-transparent border-t-black/90"></div>
          </div>
        </div>
      )}

      {/* Ripple effect for interactions */}
      {onClick && (
        <div className="absolute inset-0 rounded-full animate-ping opacity-30 bg-current pointer-events-none"></div>
      )}
    </div>
  );
};

// Container component for managing multiple highlight bubbles
interface HighlightBubbleContainerProps {
  children: React.ReactNode;
  highlights: Array<{
    id: string;
    type: HighlightBubbleProps['type'];
    position: HighlightBubbleProps['position'];
    relevanceScore?: number;
    description?: string;
    onClick?: () => void;
  }>;
  className?: string;
}

export const HighlightBubbleContainer: React.FC<HighlightBubbleContainerProps> = ({
  children,
  highlights,
  className = ''
}) => {
  return (
    <div className={`relative ${className}`}>
      {children}
      {highlights.map((highlight) => (
        <HighlightBubble
          key={highlight.id}
          type={highlight.type}
          position={highlight.position}
          relevanceScore={highlight.relevanceScore}
          description={highlight.description}
          onClick={highlight.onClick}
          isVisible={true}
          pulseAnimation={highlight.type === 'ai-detected'}
        />
      ))}
    </div>
  );
};