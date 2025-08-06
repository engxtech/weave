import React, { useState, useEffect, useRef } from 'react';

export interface AnimatedWordProps {
  word: string;
  startTime: number;
  endTime: number;
  animation: {
    type: 'fadeIn' | 'slideUp' | 'typewriter' | 'bounce' | 'glow' | 'scale' | 'highlight';
    duration: number;
    delay: number;
    easing: 'ease' | 'ease-in' | 'ease-out' | 'ease-in-out';
  };
  visual: {
    color: string;
    highlightColor: string;
    shadowColor: string;
    fontSize: number;
    fontWeight: 'normal' | 'bold' | 'semibold';
    opacity: number;
    transform: string;
  };
  speechMetrics: {
    speed: 'slow' | 'normal' | 'fast';
    emphasis: 'low' | 'medium' | 'high';
    volume: 'quiet' | 'normal' | 'loud';
  };
}

export interface AnimatedSubtitleProps {
  id: string;
  startTime: number;
  endTime: number;
  text: string;
  words: AnimatedWordProps[];
  containerAnimation: {
    entrance: 'fadeIn' | 'slideUp' | 'slideDown' | 'expandIn' | 'flipIn';
    exit: 'fadeOut' | 'slideDown' | 'slideUp' | 'contractOut' | 'flipOut';
    duration: number;
  };
  style: {
    backgroundColor: string;
    borderRadius: number;
    padding: number;
    boxShadow: string;
    backdropBlur: boolean;
  };
  timing: {
    leadInTime: number;
    holdTime: number;
    wordGap: number;
  };
  currentTime: number;
  preset?: 'subtle' | 'dynamic' | 'typewriter' | 'energetic';
  onAnimationComplete?: () => void;
}

const AnimatedWord: React.FC<AnimatedWordProps & { currentTime: number; isActive: boolean; wordIndex: number; preset?: string }> = ({
  word,
  startTime,
  endTime,
  animation,
  visual,
  speechMetrics,
  currentTime,
  isActive,
  wordIndex,
  preset
}) => {
  const [hasAnimated, setHasAnimated] = useState(false);
  const wordRef = useRef<HTMLSpanElement>(null);

  // Check if word should be visible based on current time
  const shouldShow = currentTime >= startTime - 0.1; // Show slightly before startTime
  const isCurrentWord = currentTime >= startTime && currentTime <= endTime;
  const hasEnded = currentTime > endTime;

  useEffect(() => {
    if (shouldShow && !hasAnimated) {
      setHasAnimated(true);
    }
  }, [shouldShow, hasAnimated]);

  // Create animation classes
  const animationClass = hasAnimated ? `animate-${animation.type}` : '';
  const speedClass = `word-speed-${speechMetrics.speed}`;
  const volumeClass = speechMetrics.volume !== 'normal' ? `word-volume-${speechMetrics.volume}` : '';
  const emphasisClass = speechMetrics.emphasis !== 'medium' ? `word-emphasis-${speechMetrics.emphasis}` : '';
  const presetClass = preset ? `preset-${preset}` : '';

  // Create inline styles
  const wordStyle: React.CSSProperties = {
    color: visual.color,
    fontSize: `${visual.fontSize}px`,
    fontWeight: visual.fontWeight,
    opacity: hasEnded ? 0.7 : visual.opacity,
    animationDelay: `${animation.delay}ms`,
    animationDuration: `${animation.duration}ms`,
    animationTimingFunction: animation.easing,
    textShadow: isCurrentWord ? `0 0 8px ${visual.highlightColor}` : 'none',
    transform: isCurrentWord ? 'scale(1.05)' : visual.transform,
    transition: 'all 0.2s ease',
    backgroundColor: isCurrentWord ? `${visual.highlightColor}20` : 'transparent',
    borderRadius: '3px',
    padding: '1px 2px'
  };

  if (!shouldShow) {
    return null;
  }

  return (
    <span
      ref={wordRef}
      className={`animated-word ${animationClass} ${speedClass} ${volumeClass} ${emphasisClass} ${presetClass}`.trim()}
      style={wordStyle}
      data-word={word}
      data-start={startTime}
      data-end={endTime}
      data-current={isCurrentWord}
    >
      {word}
    </span>
  );
};

const AnimatedSubtitle: React.FC<AnimatedSubtitleProps> = ({
  id,
  startTime,
  endTime,
  text,
  words,
  containerAnimation,
  style,
  timing,
  currentTime,
  preset = 'dynamic',
  onAnimationComplete
}) => {
  const [isVisible, setIsVisible] = useState(false);
  const [hasEntered, setHasEntered] = useState(false);
  const [isExiting, setIsExiting] = useState(false);
  const containerRef = useRef<HTMLDivElement>(null);

  // Calculate visibility timing
  const showTime = startTime - timing.leadInTime;
  const hideTime = endTime + timing.holdTime;
  const shouldShow = currentTime >= showTime && currentTime <= hideTime;
  const isActive = currentTime >= startTime && currentTime <= endTime;

  useEffect(() => {
    if (shouldShow && !hasEntered) {
      setIsVisible(true);
      setHasEntered(true);
    } else if (!shouldShow && hasEntered && !isExiting) {
      // Start exit animation
      setIsExiting(true);
      const exitDelay = containerAnimation.duration;
      setTimeout(() => {
        setIsVisible(false);
        setIsExiting(false);
        setHasEntered(false);
        onAnimationComplete?.();
      }, exitDelay);
    }
  }, [shouldShow, hasEntered, isExiting, containerAnimation.duration, onAnimationComplete]);

  if (!isVisible) {
    return null;
  }

  // Create container classes
  const entranceClass = hasEntered && !isExiting ? `animate-${containerAnimation.entrance}` : '';
  const exitClass = isExiting ? `animate-${containerAnimation.exit}` : '';
  const presetClass = `preset-${preset}`;
  const containerClass = style.backdropBlur ? 'glass-effect' : 'solid-background';

  // Create container styles
  const containerStyle: React.CSSProperties = {
    backgroundColor: style.backgroundColor,
    borderRadius: `${style.borderRadius}px`,
    padding: `${style.padding}px`,
    boxShadow: style.boxShadow,
    backdropFilter: style.backdropBlur ? 'blur(10px)' : 'none',
    animationDuration: `${containerAnimation.duration}ms`,
    border: isActive ? '2px solid rgba(251, 191, 36, 0.5)' : '1px solid rgba(255, 255, 255, 0.1)',
    transform: isActive ? 'scale(1.02)' : 'scale(1)',
    transition: 'all 0.3s ease'
  };

  return (
    <div
      ref={containerRef}
      className={`subtitle-container ${entranceClass} ${exitClass} ${presetClass} ${containerClass}`.trim()}
      style={containerStyle}
      data-subtitle-id={id}
      data-start={startTime}
      data-end={endTime}
      data-active={isActive}
    >
      {words.map((word, index) => (
        <AnimatedWord
          key={`${id}-word-${index}`}
          {...word}
          currentTime={currentTime}
          isActive={isActive}
          wordIndex={index}
          preset={preset}
        />
      ))}
    </div>
  );
};

export default AnimatedSubtitle;