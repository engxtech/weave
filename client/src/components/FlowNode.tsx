import { memo, useCallback } from 'react';
import { Card, CardContent, CardHeader } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { 
  Play, 
  Settings, 
  Trash2, 
  Video, 
  Languages, 
  FileText, 
  Share, 
  Download,
  Youtube,
  Circle,
  ArrowRight
} from 'lucide-react';

interface FlowNodeProps {
  id: string;
  type: 'start' | 'youtube_shorts' | 'translate' | 'subtitle' | 'share' | 'end';
  position: { x: number; y: number };
  data: {
    label: string;
    config?: any;
  };
  isSelected?: boolean;
  isExecuting?: boolean;
  isDragging?: boolean;
  isConnecting?: boolean;
  onDragStart?: (nodeId: string, e: React.MouseEvent) => void;
  onConfigure?: (nodeId: string) => void;
  onExecute?: (nodeId: string) => void;
  onDelete?: (nodeId: string) => void;
  onStartConnection?: (nodeId: string, handle: 'input' | 'output', position: { x: number; y: number }) => void;
  onCompleteConnection?: (nodeId: string, handle: 'input' | 'output') => void;
}

const getNodeIcon = (type: string) => {
  switch (type) {
    case 'start': return Video;
    case 'youtube_shorts': return Youtube;
    case 'translate': return Languages;
    case 'subtitle': return FileText;
    case 'share': return Share;
    case 'end': return Download;
    default: return Video;
  }
};

const getNodeColor = (type: string) => {
  switch (type) {
    case 'start': return 'from-green-500 to-green-600';
    case 'youtube_shorts': return 'from-red-500 to-red-600';
    case 'translate': return 'from-blue-500 to-blue-600';
    case 'subtitle': return 'from-purple-500 to-purple-600';
    case 'share': return 'from-pink-500 to-pink-600';
    case 'end': return 'from-gray-500 to-gray-600';
    default: return 'from-gray-500 to-gray-600';
  }
};

const FlowNode = memo(({ 
  id, 
  type, 
  position, 
  data, 
  isSelected, 
  isExecuting, 
  isDragging,
  isConnecting,
  onDragStart,
  onConfigure,
  onExecute,
  onDelete,
  onStartConnection,
  onCompleteConnection
}: FlowNodeProps) => {
  const Icon = getNodeIcon(type);
  const colorClass = getNodeColor(type);

  const handleMouseDown = useCallback((e: React.MouseEvent) => {
    e.preventDefault();
    onDragStart?.(id, e);
  }, [id, onDragStart]);

  const handleInputConnection = useCallback((e: React.MouseEvent) => {
    e.stopPropagation();
    const rect = e.currentTarget.getBoundingClientRect();
    const position = { x: rect.left, y: rect.top + rect.height / 2 };
    
    if (isConnecting) {
      onCompleteConnection?.(id, 'input');
    } else {
      onStartConnection?.(id, 'input', position);
    }
  }, [id, isConnecting, onStartConnection, onCompleteConnection]);

  const handleOutputConnection = useCallback((e: React.MouseEvent) => {
    e.stopPropagation();
    const rect = e.currentTarget.getBoundingClientRect();
    const position = { x: rect.right, y: rect.top + rect.height / 2 };
    
    if (isConnecting) {
      onCompleteConnection?.(id, 'output');
    } else {
      onStartConnection?.(id, 'output', position);
    }
  }, [id, isConnecting, onStartConnection, onCompleteConnection]);

  return (
    <div
      className={`absolute transition-all duration-200 ${isDragging ? 'z-50' : 'z-10'}`}
      style={{ 
        left: position.x, 
        top: position.y,
        transform: isDragging ? 'scale(1.05)' : 'scale(1)'
      }}
    >
      <Card 
        className={`
          w-64 min-h-[120px] transition-all duration-200 border-2 cursor-move
          ${isSelected ? 'border-blue-500 shadow-lg shadow-blue-500/20' : 'border-gray-700'}
          ${isExecuting ? 'animate-pulse border-yellow-400' : ''}
          ${isDragging ? 'shadow-2xl' : ''}
          bg-slate-800/95 backdrop-blur-sm hover:bg-slate-800
        `}
        onMouseDown={handleMouseDown}
      >
        {/* Input Handle - only for non-start nodes */}
        {type !== 'start' && (
          <div
            className={`
              absolute left-0 top-1/2 -translate-y-1/2 -translate-x-1/2 z-20
              w-4 h-4 rounded-full border-2 border-white cursor-pointer
              transition-all duration-200 hover:scale-125
              ${isConnecting ? 'bg-yellow-400 animate-pulse' : 'bg-blue-500'}
              hover:bg-blue-400
            `}
            onClick={handleInputConnection}
            title="Input connection"
          >
            <Circle className="w-2 h-2 absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2" />
          </div>
        )}

        {/* Output Handle - only for non-end nodes */}
        {type !== 'end' && (
          <div
            className={`
              absolute right-0 top-1/2 -translate-y-1/2 translate-x-1/2 z-20
              w-4 h-4 rounded-full border-2 border-white cursor-pointer
              transition-all duration-200 hover:scale-125
              ${isConnecting ? 'bg-yellow-400 animate-pulse' : 'bg-green-500'}
              hover:bg-green-400
            `}
            onClick={handleOutputConnection}
            title="Output connection"
          >
            <ArrowRight className="w-2 h-2 absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2" />
          </div>
        )}

        <CardHeader className="pb-2">
          <div className={`
            flex items-center gap-2 p-3 rounded-lg bg-gradient-to-r ${colorClass} text-white
          `}>
            <Icon className="h-5 w-5" />
            <span className="font-semibold text-sm">{data.label}</span>
          </div>
        </CardHeader>

        <CardContent className="pt-0 space-y-3">
          {data.config && Object.keys(data.config).length > 0 && (
            <div className="text-xs text-gray-300 bg-slate-700/50 p-2 rounded">
              {type === 'start' && data.config.title && (
                <div><span className="text-gray-400">Title:</span> {data.config.title}</div>
              )}
              {type === 'youtube_shorts' && (
                <div>
                  <div><span className="text-gray-400">Duration:</span> {data.config.duration || '30'}s</div>
                  {data.config.story && <div><span className="text-gray-400">Story mode:</span> Enabled</div>}
                </div>
              )}
              {type === 'translate' && data.config.language && (
                <div><span className="text-gray-400">Target:</span> {data.config.language}</div>
              )}
              {type === 'subtitle' && (
                <div>
                  <div><span className="text-gray-400">Style:</span> {data.config.style || 'Default'}</div>
                  <div><span className="text-gray-400">Position:</span> {data.config.position || 'Bottom'}</div>
                </div>
              )}
              {type === 'share' && data.config.platforms && (
                <div><span className="text-gray-400">Platforms:</span> {data.config.platforms.join(', ')}</div>
              )}
              {type === 'end' && data.config.format && (
                <div><span className="text-gray-400">Format:</span> {data.config.format}</div>
              )}
            </div>
          )}

          <div className="flex gap-1 justify-center">
            <Button
              variant="ghost"
              size="sm"
              className="h-8 px-3 text-xs hover:bg-slate-700"
              onClick={(e) => {
                e.stopPropagation();
                onConfigure?.(id);
              }}
            >
              <Settings className="h-3 w-3 mr-1" />
              Configure
            </Button>
            
            {onExecute && (
              <Button
                variant="ghost"
                size="sm"
                className="h-8 px-3 text-xs hover:bg-slate-700"
                onClick={(e) => {
                  e.stopPropagation();
                  onExecute?.(id);
                }}
                disabled={isExecuting}
              >
                <Play className="h-3 w-3 mr-1" />
                Run
              </Button>
            )}
            
            <Button
              variant="ghost"
              size="sm"
              className="h-8 px-3 text-xs text-red-400 hover:text-red-300 hover:bg-red-500/10"
              onClick={(e) => {
                e.stopPropagation();
                onDelete?.(id);
              }}
            >
              <Trash2 className="h-3 w-3" />
            </Button>
          </div>

          {isExecuting && (
            <Badge variant="secondary" className="w-full justify-center text-xs bg-yellow-500/20 text-yellow-300">
              Processing...
            </Badge>
          )}
        </CardContent>
      </Card>
    </div>
  );
});

FlowNode.displayName = 'FlowNode';

export default FlowNode;