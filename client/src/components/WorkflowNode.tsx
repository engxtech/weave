import { useState } from 'react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Trash2, Settings, Play } from 'lucide-react';

interface WorkflowNodeProps {
  id: string;
  type: string;
  position: { x: number; y: number };
  data: {
    label: string;
    icon: any;
    color: string;
    config?: any;
  };
  isSelected: boolean;
  isExecuting: boolean;
  onDragStart: (e: React.MouseEvent, nodeId: string) => void;
  onDelete: (nodeId: string) => void;
  onConfigure: (nodeId: string) => void;
  onExecute?: (nodeId: string) => void;
  onStartConnection?: (nodeId: string, handle: 'input' | 'output', position: { x: number; y: number }) => void;
  onCompleteConnection?: (nodeId: string, handle: 'input' | 'output') => void;
}

const nodeTypeDescriptions = {
  start: 'Upload video to begin workflow',
  youtube_shorts: 'Convert to 9:16 aspect ratio',
  translate: 'Translate audio to target language',
  subtitle: 'Generate and style subtitles',
  share: 'Publish to social platforms',
  end: 'Workflow completion'
};

export function WorkflowNode({
  id,
  type,
  position,
  data,
  isSelected,
  isExecuting,
  onDragStart,
  onDelete,
  onConfigure,
  onExecute,
  onStartConnection,
  onCompleteConnection
}: WorkflowNodeProps) {
  const [isHovered, setIsHovered] = useState(false);
  const Icon = data.icon;

  return (
    <div
      className={`absolute cursor-move select-none transition-all duration-200 ${
        isSelected ? 'z-20 scale-105' : 'z-10'
      } ${isExecuting ? 'animate-pulse' : ''}`}
      style={{
        left: position.x,
        top: position.y,
      }}
      onMouseDown={(e) => onDragStart(e, id)}
      onMouseEnter={() => setIsHovered(true)}
      onMouseLeave={() => setIsHovered(false)}
    >
      <Card className={`w-72 bg-slate-800/95 backdrop-blur-sm border-0 shadow-2xl transition-all duration-200 ${
        isSelected ? 'ring-2 ring-purple-500 shadow-purple-500/20' : ''
      } ${isHovered ? 'shadow-3xl transform -translate-y-1' : ''}`}>
        <CardHeader className="pb-3">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-3">
              <div className={`p-2.5 rounded-xl bg-gradient-to-r ${data.color} shadow-lg`}>
                <Icon className="h-5 w-5 text-white" />
              </div>
              <div>
                <CardTitle className="text-sm text-white font-semibold">{data.label}</CardTitle>
                <Badge variant="secondary" className="bg-slate-700/50 text-slate-300 text-xs mt-1">
                  {type}
                </Badge>
              </div>
            </div>
            <div className="flex gap-1">
              {onExecute && (
                <Button
                  size="sm"
                  variant="ghost"
                  className="h-7 w-7 p-0 text-gray-400 hover:text-green-400 hover:bg-green-500/10"
                  onClick={(e) => {
                    e.stopPropagation();
                    onExecute(id);
                  }}
                  disabled={isExecuting}
                >
                  <Play className="h-3 w-3" />
                </Button>
              )}
              <Button
                size="sm"
                variant="ghost"
                className="h-7 w-7 p-0 text-gray-400 hover:text-blue-400 hover:bg-blue-500/10"
                onClick={(e) => {
                  e.stopPropagation();
                  onConfigure(id);
                }}
              >
                <Settings className="h-3 w-3" />
              </Button>
              <Button
                size="sm"
                variant="ghost"
                className="h-7 w-7 p-0 text-gray-400 hover:text-red-400 hover:bg-red-500/10"
                onClick={(e) => {
                  e.stopPropagation();
                  onDelete(id);
                }}
              >
                <Trash2 className="h-3 w-3" />
              </Button>
            </div>
          </div>
        </CardHeader>
        <CardContent className="pt-0">
          <div className="space-y-3">
            {/* Node description */}
            <div className="text-xs text-gray-400 leading-relaxed">
              {nodeTypeDescriptions[type as keyof typeof nodeTypeDescriptions]}
            </div>

            {/* Connection handles */}
            <div className="flex justify-between items-center">
              {/* Input handles */}
              <div className="flex gap-1">
                {type !== 'start' && (
                  <div
                    className="w-3 h-3 bg-blue-500 rounded-full border-2 border-slate-800 hover:bg-blue-400 transition-colors cursor-pointer"
                    title="Input"
                    onClick={(e) => {
                      e.stopPropagation();
                      if (onCompleteConnection) {
                        onCompleteConnection(id, 'input');
                      }
                    }}
                    onMouseDown={(e) => {
                      e.stopPropagation();
                      if (onStartConnection) {
                        const rect = e.currentTarget.getBoundingClientRect();
                        onStartConnection(id, 'input', {
                          x: rect.left + rect.width / 2,
                          y: rect.top + rect.height / 2
                        });
                      }
                    }}
                  />
                )}
              </div>
              
              {/* Status indicator */}
              <div className={`w-2 h-2 rounded-full ${
                isExecuting ? 'bg-yellow-500 animate-pulse' : 
                isSelected ? 'bg-purple-500' : 'bg-slate-500'
              }`} />

              {/* Output handles */}
              <div className="flex gap-1">
                {type !== 'end' && (
                  <div
                    className="w-3 h-3 bg-purple-500 rounded-full border-2 border-slate-800 hover:bg-purple-400 transition-colors cursor-pointer"
                    title="Output"
                    onClick={(e) => {
                      e.stopPropagation();
                      if (onCompleteConnection) {
                        onCompleteConnection(id, 'output');
                      }
                    }}
                    onMouseDown={(e) => {
                      e.stopPropagation();
                      if (onStartConnection) {
                        const rect = e.currentTarget.getBoundingClientRect();
                        onStartConnection(id, 'output', {
                          x: rect.left + rect.width / 2,
                          y: rect.top + rect.height / 2
                        });
                      }
                    }}
                  />
                )}
              </div>
            </div>

            {/* Configuration preview */}
            {data.config && Object.keys(data.config).length > 0 && (
              <div className="bg-slate-700/30 rounded p-2">
                <div className="text-xs text-gray-400">Configured</div>
              </div>
            )}
          </div>
        </CardContent>
      </Card>
    </div>
  );
}