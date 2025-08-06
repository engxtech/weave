import { memo } from 'react';

interface WorkflowMinimapProps {
  nodes: Array<{
    id: string;
    position: { x: number; y: number };
    type: string;
  }>;
  connections: Array<{
    id: string;
    source: string;
    target: string;
  }>;
  viewport: {
    x: number;
    y: number;
    zoom: number;
  };
  onViewportChange?: (viewport: { x: number; y: number; zoom: number }) => void;
}

const WorkflowMinimap = memo(({ nodes, connections, viewport }: WorkflowMinimapProps) => {
  const minimapWidth = 200;
  const minimapHeight = 150;
  const scale = 0.1;

  return (
    <div className="absolute bottom-4 right-4 z-20">
      <div 
        className="bg-slate-900/90 backdrop-blur-sm border border-purple-500/30 rounded-lg p-2"
        style={{ width: minimapWidth, height: minimapHeight }}
      >
        <svg width="100%" height="100%" className="overflow-visible">
          {/* Connections */}
          {connections.map(connection => {
            const sourceNode = nodes.find(n => n.id === connection.source);
            const targetNode = nodes.find(n => n.id === connection.target);
            if (!sourceNode || !targetNode) return null;

            return (
              <line
                key={connection.id}
                x1={sourceNode.position.x * scale}
                y1={sourceNode.position.y * scale}
                x2={targetNode.position.x * scale}
                y2={targetNode.position.y * scale}
                stroke="rgba(139, 92, 246, 0.5)"
                strokeWidth="1"
              />
            );
          })}
          
          {/* Nodes */}
          {nodes.map(node => (
            <rect
              key={node.id}
              x={node.position.x * scale - 2}
              y={node.position.y * scale - 2}
              width="4"
              height="4"
              fill="rgba(139, 92, 246, 0.8)"
              rx="1"
            />
          ))}
          
          {/* Viewport indicator */}
          <rect
            x={-viewport.x * scale}
            y={-viewport.y * scale}
            width={minimapWidth / viewport.zoom}
            height={minimapHeight / viewport.zoom}
            fill="none"
            stroke="rgba(59, 130, 246, 0.7)"
            strokeWidth="1"
            strokeDasharray="2,2"
          />
        </svg>
      </div>
    </div>
  );
});

WorkflowMinimap.displayName = 'WorkflowMinimap';

export default WorkflowMinimap;