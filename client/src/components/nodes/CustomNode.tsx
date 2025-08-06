import { memo } from 'react';
import { Handle, Position, NodeProps } from 'reactflow';
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
  Youtube
} from 'lucide-react';

interface CustomNodeData {
  label: string;
  type: 'start' | 'youtube_shorts' | 'translate' | 'subtitle' | 'share' | 'end';
  config?: any;
  isExecuting?: boolean;
  onConfigure?: (nodeId: string) => void;
  onExecute?: (nodeId: string) => void;
  onDelete?: (nodeId: string) => void;
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

const CustomNode = memo(({ id, data, selected }: NodeProps<CustomNodeData>) => {
  const Icon = getNodeIcon(data.type);
  const colorClass = getNodeColor(data.type);

  return (
    <Card className={`
      w-64 min-h-[120px] transition-all duration-200 border-2
      ${selected ? 'border-blue-500 shadow-lg shadow-blue-500/20' : 'border-gray-700'}
      ${data.isExecuting ? 'animate-pulse border-yellow-400' : ''}
      bg-slate-800/90 backdrop-blur-sm
    `}>
      {/* Input Handle - only for non-start nodes */}
      {data.type !== 'start' && (
        <Handle
          type="target"
          position={Position.Left}
          className="w-3 h-3 bg-blue-500 border-2 border-white"
          style={{ left: -6 }}
        />
      )}

      {/* Output Handle - only for non-end nodes */}
      {data.type !== 'end' && (
        <Handle
          type="source"
          position={Position.Right}
          className="w-3 h-3 bg-green-500 border-2 border-white"
          style={{ right: -6 }}
        />
      )}

      <CardHeader className="pb-2">
        <div className={`
          flex items-center gap-2 p-2 rounded-lg bg-gradient-to-r ${colorClass} text-white
        `}>
          <Icon className="h-4 w-4" />
          <span className="font-medium text-sm">{data.label}</span>
        </div>
      </CardHeader>

      <CardContent className="pt-0 space-y-2">
        {data.config && Object.keys(data.config).length > 0 && (
          <div className="text-xs text-gray-400">
            {data.type === 'start' && data.config.title && (
              <div>Title: {data.config.title}</div>
            )}
            {data.type === 'youtube_shorts' && (
              <div>
                Duration: {data.config.duration || '30'}s
                {data.config.story && <div>Story mode: On</div>}
              </div>
            )}
            {data.type === 'translate' && data.config.language && (
              <div>To: {data.config.language}</div>
            )}
            {data.type === 'subtitle' && (
              <div>
                Style: {data.config.style || 'Default'}
                <br />Position: {data.config.position || 'Bottom'}
              </div>
            )}
            {data.type === 'share' && data.config.platforms && (
              <div>Platforms: {data.config.platforms.join(', ')}</div>
            )}
            {data.type === 'end' && data.config.format && (
              <div>Format: {data.config.format}</div>
            )}
          </div>
        )}

        <div className="flex gap-1">
          <Button
            variant="ghost"
            size="sm"
            className="h-7 px-2 text-xs"
            onClick={() => data.onConfigure?.(id)}
          >
            <Settings className="h-3 w-3" />
          </Button>
          
          {data.onExecute && (
            <Button
              variant="ghost"
              size="sm"
              className="h-7 px-2 text-xs"
              onClick={() => data.onExecute?.(id)}
              disabled={data.isExecuting}
            >
              <Play className="h-3 w-3" />
            </Button>
          )}
          
          <Button
            variant="ghost"
            size="sm"
            className="h-7 px-2 text-xs text-red-400 hover:text-red-300"
            onClick={() => data.onDelete?.(id)}
          >
            <Trash2 className="h-3 w-3" />
          </Button>
        </div>

        {data.isExecuting && (
          <Badge variant="secondary" className="w-full justify-center text-xs">
            Processing...
          </Badge>
        )}
      </CardContent>
    </Card>
  );
});

CustomNode.displayName = 'CustomNode';

export default CustomNode;