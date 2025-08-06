import { memo } from 'react';

interface FlowConnectionProps {
  sourceX: number;
  sourceY: number;
  targetX: number;
  targetY: number;
  isActive?: boolean;
  isAnimated?: boolean;
  isDashed?: boolean;
}

const FlowConnection = memo(({ 
  sourceX, 
  sourceY, 
  targetX, 
  targetY, 
  isActive = false,
  isAnimated = true,
  isDashed = false
}: FlowConnectionProps) => {
  // Calculate bezier curve control points for smooth connections
  const dx = targetX - sourceX;
  const dy = targetY - sourceY;
  
  // Control point offset based on distance
  const controlOffset = Math.min(Math.abs(dx) * 0.5, 100);
  
  const controlPoint1X = sourceX + controlOffset;
  const controlPoint1Y = sourceY;
  const controlPoint2X = targetX - controlOffset;
  const controlPoint2Y = targetY;

  const path = `M ${sourceX} ${sourceY} C ${controlPoint1X} ${controlPoint1Y}, ${controlPoint2X} ${controlPoint2Y}, ${targetX} ${targetY}`;

  return (
    <g>
      {/* Shadow/Glow effect for active connections */}
      {isActive && (
        <path
          d={path}
          stroke="rgba(168, 85, 247, 0.5)"
          strokeWidth="8"
          fill="none"
          filter="blur(4px)"
        />
      )}
      
      {/* Main connection line */}
      <path
        d={path}
        stroke={isActive ? '#d8b4fe' : '#c084fc'}
        strokeWidth="3"
        fill="none"
        strokeDasharray={isDashed ? '8,4' : 'none'}
        className={`
          transition-all duration-300
          ${isAnimated && isActive ? 'animate-pulse' : ''}
        `}
        style={{
          filter: 'drop-shadow(0 0 6px rgba(168, 85, 247, 0.8))'
        }}
      />
      
      {/* Animated flow dots for active connections */}
      {isActive && isAnimated && (
        <>
          <circle r="3" fill="#a855f7" className="opacity-80">
            <animateMotion
              dur="2s"
              repeatCount="indefinite"
              path={path}
            />
          </circle>
          <circle r="2" fill="#d8b4fe" className="opacity-60">
            <animateMotion
              dur="2s"
              repeatCount="indefinite"
              begin="0.5s"
              path={path}
            />
          </circle>
        </>
      )}
      
      {/* Arrow marker at the end */}
      <defs>
        <marker
          id={`arrowhead-${isActive ? 'active' : 'inactive'}`}
          markerWidth="10"
          markerHeight="7"
          refX="9"
          refY="3.5"
          orient="auto"
        >
          <polygon
            points="0 0, 10 3.5, 0 7"
            fill={isActive ? '#3B82F6' : '#64748B'}
            className="transition-colors duration-300"
          />
        </marker>
      </defs>
      
      <path
        d={path}
        stroke="transparent"
        strokeWidth="2"
        fill="none"
        markerEnd={`url(#arrowhead-${isActive ? 'active' : 'inactive'})`}
      />
    </g>
  );
});

FlowConnection.displayName = 'FlowConnection';

export default FlowConnection;