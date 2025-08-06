import { useCallback } from 'react';

interface ConnectionProps {
  sourceX: number;
  sourceY: number;
  targetX: number;
  targetY: number;
  isActive?: boolean;
}

export function NodeConnection({ sourceX, sourceY, targetX, targetY, isActive = false }: ConnectionProps) {
  const generatePath = useCallback(() => {
    const dx = targetX - sourceX;
    const dy = targetY - sourceY;
    
    // Control points for smooth bezier curve
    const controlPoint1X = sourceX + Math.max(dx * 0.4, 100);
    const controlPoint1Y = sourceY;
    const controlPoint2X = targetX - Math.max(dx * 0.4, 100);
    const controlPoint2Y = targetY;

    return `M ${sourceX} ${sourceY} C ${controlPoint1X} ${controlPoint1Y}, ${controlPoint2X} ${controlPoint2Y}, ${targetX} ${targetY}`;
  }, [sourceX, sourceY, targetX, targetY]);

  return (
    <g>
      {/* Shadow/glow effect */}
      <path
        d={generatePath()}
        stroke={isActive ? "rgba(168, 85, 247, 0.4)" : "rgba(139, 92, 246, 0.2)"}
        strokeWidth="8"
        fill="none"
        className="blur-sm"
      />
      {/* Main connection line */}
      <path
        d={generatePath()}
        stroke={isActive ? "rgba(168, 85, 247, 0.8)" : "rgba(139, 92, 246, 0.6)"}
        strokeWidth="3"
        fill="none"
        className="drop-shadow-sm"
      />
      {/* Animated flow dots */}
      {isActive && (
        <>
          <circle r="4" fill="rgba(168, 85, 247, 0.9)">
            <animateMotion dur="2s" repeatCount="indefinite">
              <mpath href={`#path-${sourceX}-${sourceY}-${targetX}-${targetY}`} />
            </animateMotion>
          </circle>
          <path
            id={`path-${sourceX}-${sourceY}-${targetX}-${targetY}`}
            d={generatePath()}
            stroke="none"
            fill="none"
          />
        </>
      )}
    </g>
  );
}