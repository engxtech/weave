import { memo, useCallback } from 'react';
import { Card, CardContent } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { 
  Play, 
  Settings, 
  MoreVertical, 
  Video, 
  Languages, 
  FileText, 
  Share, 
  Download,
  Youtube,
  CheckCircle,
  AlertCircle,
  Loader2,
  Eye
} from 'lucide-react';
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu';

interface ProfessionalFlowNodeProps {
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
  executionStatus?: 'idle' | 'running' | 'success' | 'error';
  onDragStart?: (nodeId: string, e: React.MouseEvent) => void;
  onConfigure?: (nodeId: string) => void;
  onExecute?: (nodeId: string) => void;
  onDelete?: (nodeId: string) => void;
  onDuplicate?: (nodeId: string) => void;
  onPreview?: (nodeId: string) => void;
  onStartConnection?: (nodeId: string, handle: 'input' | 'output', e: React.MouseEvent) => void;
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

const getNodeTheme = (type: string) => {
  switch (type) {
    case 'start': 
      return {
        primary: '#10B981',
        secondary: '#047857',
        background: '#F0FDF4',
        border: '#10B981'
      };
    case 'youtube_shorts': 
      return {
        primary: '#EF4444',
        secondary: '#DC2626',
        background: '#FEF2F2',
        border: '#EF4444'
      };
    case 'translate': 
      return {
        primary: '#3B82F6',
        secondary: '#2563EB',
        background: '#EFF6FF',
        border: '#3B82F6'
      };
    case 'subtitle': 
      return {
        primary: '#8B5CF6',
        secondary: '#7C3AED',
        background: '#F5F3FF',
        border: '#8B5CF6'
      };
    case 'share': 
      return {
        primary: '#F59E0B',
        secondary: '#D97706',
        background: '#FFFBEB',
        border: '#F59E0B'
      };
    case 'end': 
      return {
        primary: '#6B7280',
        secondary: '#4B5563',
        background: '#F9FAFB',
        border: '#6B7280'
      };
    default: 
      return {
        primary: '#6B7280',
        secondary: '#4B5563',
        background: '#F9FAFB',
        border: '#6B7280'
      };
  }
};

const ProfessionalFlowNode = memo(({ 
  id, 
  type, 
  position, 
  data, 
  isSelected, 
  isExecuting, 
  isDragging,
  isConnecting,
  executionStatus = 'idle',
  onDragStart,
  onConfigure,
  onExecute,
  onDelete,
  onDuplicate,
  onPreview,
  onStartConnection,
  onCompleteConnection
}: ProfessionalFlowNodeProps) => {
  const Icon = getNodeIcon(type);
  const theme = getNodeTheme(type);

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
      onStartConnection?.(id, 'input', e);
    }
  }, [id, isConnecting, onStartConnection, onCompleteConnection]);

  const handleOutputConnection = useCallback((e: React.MouseEvent) => {
    e.stopPropagation();
    const rect = e.currentTarget.getBoundingClientRect();
    const position = { x: rect.right, y: rect.top + rect.height / 2 };
    
    if (isConnecting) {
      onCompleteConnection?.(id, 'output');
    } else {
      onStartConnection?.(id, 'output', e);
    }
  }, [id, isConnecting, onStartConnection, onCompleteConnection]);

  const getStatusIcon = () => {
    switch (executionStatus) {
      case 'running':
        return <Loader2 className="h-3 w-3 animate-spin text-blue-500" />;
      case 'success':
        return <CheckCircle className="h-3 w-3 text-green-500" />;
      case 'error':
        return <AlertCircle className="h-3 w-3 text-red-500" />;
      default:
        return null;
    }
  };

  return (
    <div
      className={`absolute transition-all duration-200 ${isDragging ? 'z-50' : 'z-10'}`}
      style={{ 
        left: position.x, 
        top: position.y,
        transform: isDragging ? 'scale(1.02)' : 'scale(1)'
      }}
    >
      <Card 
        className={`
          w-72 transition-all duration-200 cursor-move
          ${isSelected 
            ? 'ring-2 ring-blue-500 ring-offset-2 ring-offset-slate-950 shadow-xl' 
            : 'hover:shadow-lg shadow-md'
          }
          ${isDragging ? 'shadow-2xl scale-102' : ''}
          bg-white border-2
        `}
        style={{
          borderColor: isSelected ? '#3B82F6' : theme.border,
          boxShadow: isSelected 
            ? '0 20px 25px -5px rgba(0, 0, 0, 0.1), 0 10px 10px -5px rgba(0, 0, 0, 0.04), 0 0 0 4px rgba(59, 130, 246, 0.1)' 
            : undefined
        }}
        onMouseDown={handleMouseDown}
      >
        {/* Input Handle - only for non-start nodes */}
        {type !== 'start' && (
          <div
            className={`
              absolute left-0 top-1/2 -translate-y-1/2 -translate-x-1/2 z-20
              w-3 h-3 rounded-full border-2 border-white cursor-pointer
              transition-all duration-200 hover:scale-125 shadow-sm
              ${isConnecting ? 'animate-pulse' : ''}
            `}
            style={{
              backgroundColor: isConnecting ? '#F59E0B' : theme.primary
            }}
            onClick={handleInputConnection}
            data-handle="true"
            data-node-id={id}
            data-handle-type="input"
            title="Input connection"
          />
        )}

        {/* Output Handle - only for non-end nodes */}
        {type !== 'end' && (
          <div
            className={`
              absolute right-0 top-1/2 -translate-y-1/2 translate-x-1/2 z-20
              w-3 h-3 rounded-full border-2 border-white cursor-pointer
              transition-all duration-200 hover:scale-125 shadow-sm
              ${isConnecting ? 'animate-pulse' : ''}
            `}
            style={{
              backgroundColor: isConnecting ? '#F59E0B' : theme.primary
            }}
            onClick={handleOutputConnection}
            data-handle="true"
            data-node-id={id}
            data-handle-type="output"
            title="Output connection"
          />
        )}

        <CardContent className="p-4">
          {/* Header Section */}
          <div className="flex items-start justify-between mb-3">
            <div className="flex items-center gap-3">
              <div 
                className="p-2 rounded-lg"
                style={{ backgroundColor: theme.background }}
              >
                <Icon 
                  className="h-5 w-5" 
                  style={{ color: theme.primary }}
                />
              </div>
              <div>
                <h3 className="font-semibold text-gray-900 text-sm leading-tight">
                  {data.label}
                </h3>
                <p className="text-xs text-gray-500 mt-0.5">
                  {type === 'start' && 'Upload and process video'}
                  {type === 'youtube_shorts' && 'Convert to vertical format'}
                  {type === 'translate' && 'Multi-language support'}
                  {type === 'subtitle' && 'Add captions and subtitles'}
                  {type === 'share' && 'Distribute to platforms'}
                  {type === 'end' && 'Export final result'}
                </p>
              </div>
            </div>
            
            <div className="flex items-center gap-1">
              {getStatusIcon()}
              <DropdownMenu>
                <DropdownMenuTrigger asChild>
                  <Button
                    variant="ghost"
                    size="sm"
                    className="h-6 w-6 p-0 hover:bg-gray-100"
                    onClick={(e) => e.stopPropagation()}
                  >
                    <MoreVertical className="h-3 w-3 text-gray-500" />
                  </Button>
                </DropdownMenuTrigger>
                <DropdownMenuContent align="end" className="w-40">
                  <DropdownMenuItem onClick={() => onConfigure?.(id)}>
                    <Settings className="h-3 w-3 mr-2" />
                    Configure
                  </DropdownMenuItem>
                  <DropdownMenuItem onClick={() => onPreview?.(id)}>
                    <Eye className="h-3 w-3 mr-2" />
                    Preview
                  </DropdownMenuItem>
                  {onExecute && (
                    <DropdownMenuItem 
                      onClick={() => onExecute?.(id)}
                      disabled={isExecuting}
                    >
                      <Play className="h-3 w-3 mr-2" />
                      Execute
                    </DropdownMenuItem>
                  )}
                  <DropdownMenuItem onClick={() => onDuplicate?.(id)}>
                    Duplicate
                  </DropdownMenuItem>
                  <DropdownMenuItem 
                    onClick={() => onDelete?.(id)}
                    className="text-red-600 focus:text-red-600"
                  >
                    Delete
                  </DropdownMenuItem>
                </DropdownMenuContent>
              </DropdownMenu>
            </div>
          </div>

          {/* Configuration Status */}
          {data.config && Object.keys(data.config).length > 0 && (
            <div className="mb-3">
              <Badge 
                variant="secondary" 
                className="text-xs"
                style={{ 
                  backgroundColor: theme.background,
                  color: theme.secondary,
                  border: `1px solid ${theme.primary}20`
                }}
              >
                Configured
              </Badge>
            </div>
          )}

          {/* Configuration Details */}
          {data.config && Object.keys(data.config).length > 0 && (
            <div className="text-xs text-gray-600 bg-gray-50 p-2 rounded border">
              {type === 'start' && data.config.title && (
                <div className="truncate">
                  <span className="font-medium">Title:</span> {data.config.title}
                </div>
              )}
              {type === 'youtube_shorts' && (
                <div className="space-y-1">
                  <div><span className="font-medium">Duration:</span> {data.config.duration || '30'}s</div>
                  {data.config.story && <div><span className="font-medium">Story mode:</span> Enabled</div>}
                </div>
              )}
              {type === 'translate' && data.config.language && (
                <div className="truncate">
                  <span className="font-medium">Target:</span> {data.config.language}
                </div>
              )}
              {type === 'subtitle' && (
                <div className="space-y-1">
                  <div><span className="font-medium">Style:</span> {data.config.style || 'Default'}</div>
                  <div><span className="font-medium">Position:</span> {data.config.position || 'Bottom'}</div>
                </div>
              )}
              {type === 'share' && data.config.platforms && (
                <div className="truncate">
                  <span className="font-medium">Platforms:</span> {data.config.platforms.join(', ')}
                </div>
              )}
              {type === 'end' && data.config.format && (
                <div className="truncate">
                  <span className="font-medium">Format:</span> {data.config.format}
                </div>
              )}
            </div>
          )}

          {/* Execution Status */}
          {executionStatus !== 'idle' && (
            <div className="mt-3 pt-3 border-t border-gray-200">
              <div className="flex items-center gap-2 text-xs">
                {executionStatus === 'running' && (
                  <Badge variant="outline" className="text-blue-600 border-blue-200 bg-blue-50">
                    Processing...
                  </Badge>
                )}
                {executionStatus === 'success' && (
                  <Badge variant="outline" className="text-green-600 border-green-200 bg-green-50">
                    Completed
                  </Badge>
                )}
                {executionStatus === 'error' && (
                  <Badge variant="outline" className="text-red-600 border-red-200 bg-red-50">
                    Failed
                  </Badge>
                )}
              </div>
            </div>
          )}
        </CardContent>
      </Card>
    </div>
  );
});

ProfessionalFlowNode.displayName = 'ProfessionalFlowNode';

export default ProfessionalFlowNode;