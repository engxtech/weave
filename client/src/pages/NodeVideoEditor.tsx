import { useState, useCallback, useRef, useEffect } from 'react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Badge } from '@/components/ui/badge';
import { Separator } from '@/components/ui/separator';
import { 
  Play, 
  Square, 
  Upload, 
  Youtube, 
  Languages, 
  Subtitles, 
  Share2, 
  Settings,
  Zap,
  Plus,
  Trash2,
  Download,
  Eye,
  Save,
  Pause,
  Mic,
  Volume2,
  Crop,
  Scissors,
  Image,
  Film,
  Type,
  Music,
  Sparkles
} from 'lucide-react';
import ConfigurableFlowNode from '@/components/ConfigurableFlowNode';
import FlowConnection from '@/components/FlowConnection';
import { NodeConfigModal } from '@/components/NodeConfigModal';
import { VideoTimeline } from '@/components/VideoTimeline';
import { useNodeProcessing } from '@/hooks/useNodeProcessing';
import { RevideoPreview } from '@/components/RevideoPreview';
import { Dialog, DialogContent, DialogHeader, DialogTitle } from '@/components/ui/dialog';

// Node types for the workflow
interface WorkflowNode {
  id: string;
  type: keyof typeof nodeTypes;
  position: { x: number; y: number };
  data: {
    label: string;
    icon: any;
    color: string;
    inputs: NodeIO[];
    outputs: NodeIO[];
    config?: any;
    description?: string;
    preview?: {
      type: 'video' | 'image';
      url: string;
    };
  };
}

interface Connection {
  id: string;
  source: string;
  target: string;
  sourceHandle: string;
  targetHandle: string;
  sourceType?: IOType;
  targetType?: IOType;
}

// Define input/output types for proper type matching
type IOType = 'video' | 'clips' | 'audio' | 'enhanced_video' | 'any';

interface NodeIO {
  name: string;
  type: IOType;
  label: string;
}

const nodeTypes = {
  start: {
    label: 'Video Input',
    icon: Play,
    color: '#22c55e', // Professional green
    inputs: [] as NodeIO[],
    outputs: [{ name: 'output', type: 'video' as IOType, label: 'Video' }],
    description: 'Upload or select a video file'
  },
  enhancement: {
    label: 'Enhancement Stage',
    icon: Sparkles,
    color: '#9333ea', // Professional purple
    inputs: [{ name: 'input', type: 'video' as IOType, label: 'Video' }],
    outputs: [{ name: 'output', type: 'video' as IOType, label: 'Enhanced' }],
    description: 'AI-powered video enhancement'
  },
  shorts: {
    label: 'Extract Shorts',
    icon: Zap,
    color: '#f97316', // Professional orange
    inputs: [{ name: 'input', type: 'video' as IOType, label: 'Video' }],
    outputs: [
      { name: 'inspiring', type: 'clips' as IOType, label: 'Inspiring' },
      { name: 'viral', type: 'clips' as IOType, label: 'Viral' },
      { name: 'funny', type: 'clips' as IOType, label: 'Funny' }
    ],
    description: 'Extract multiple viral moments'
  },
  voice: {
    label: 'Voice Translation',
    icon: Mic,
    color: '#ec4899', // Professional pink
    inputs: [{ name: 'input', type: 'video' as IOType, label: 'Video' }],
    outputs: [{ name: 'output', type: 'enhanced_video' as IOType, label: 'Translated' }],
    description: 'Translate voice to 30+ languages'
  },
  audio_enhance: {
    label: 'Audio Enhancement',
    icon: Volume2,
    color: '#eab308', // Professional yellow
    inputs: [{ name: 'input', type: 'video' as IOType, label: 'Video' }],
    outputs: [{ name: 'output', type: 'enhanced_video' as IOType, label: 'Enhanced' }],
    description: 'AI-powered noise reduction'
  },
  eye_contact: {
    label: 'Eye Contact Fix',
    icon: Eye,
    color: '#8b5cf6', // Professional purple
    inputs: [{ name: 'input', type: 'video' as IOType, label: 'Video' }],
    outputs: [{ name: 'output', type: 'enhanced_video' as IOType, label: 'Corrected' }],
    description: 'AI gaze correction'
  },
  reframe: {
    label: 'Smart Reframe',
    icon: Crop,
    color: '#0ea5e9', // Professional blue
    inputs: [{ name: 'input', type: 'video' as IOType, label: 'Video' }],
    outputs: [{ name: 'output', type: 'enhanced_video' as IOType, label: 'Reframed' }],
    description: 'Change aspect ratio intelligently'
  },
  cut: {
    label: 'Smart Cut',
    icon: Scissors,
    color: '#ef4444', // Professional red
    inputs: [{ name: 'input', type: 'video' as IOType, label: 'Video' }],
    outputs: [{ name: 'output', type: 'enhanced_video' as IOType, label: 'Trimmed' }],
    description: 'Remove unwanted content'
  },
  background: {
    label: 'Background Replace',
    icon: Image,
    color: '#10b981', // Professional emerald
    inputs: [{ name: 'input', type: 'video' as IOType, label: 'Video' }],
    outputs: [{ name: 'output', type: 'enhanced_video' as IOType, label: 'Composited' }],
    description: 'Replace or remove background'
  },
  broll: {
    label: 'B-Roll Generator',
    icon: Film,
    color: '#6366f1', // Professional indigo
    inputs: [{ name: 'input', type: 'video' as IOType, label: 'Video' }],
    outputs: [{ name: 'output', type: 'enhanced_video' as IOType, label: 'Enhanced' }],
    description: 'Generate relevant B-roll footage'
  },
  captions: {
    label: 'AI Captions',
    icon: Type,
    color: '#059669', // Professional green
    inputs: [{ name: 'input', type: 'video' as IOType, label: 'Video' }],
    outputs: [{ name: 'output', type: 'enhanced_video' as IOType, label: 'Captioned' }],
    description: 'Generate customizable captions'
  },
  music: {
    label: 'Music Generator',
    icon: Music,
    color: '#a855f7', // Professional purple
    inputs: [{ name: 'input', type: 'video' as IOType, label: 'Video' }],
    outputs: [{ name: 'output', type: 'enhanced_video' as IOType, label: 'With Music' }],
    description: 'Add AI-generated music'
  }
};

type ExecutionMode = 'sequential' | 'manual';

const NodeVideoEditor = () => {
  const [nodes, setNodes] = useState<WorkflowNode[]>([]);
  const [connections, setConnections] = useState<Connection[]>([]);
  const [selectedNode, setSelectedNode] = useState<string | null>(null);
  const [isDragging, setIsDragging] = useState(false);
  const [dragOffset, setDragOffset] = useState({ x: 0, y: 0 });
  const [canvasOffset, setCanvasOffset] = useState({ x: 0, y: 0 });
  const [zoom, setZoom] = useState(1);
  const [executingNodes, setExecutingNodes] = useState<Set<string>>(new Set());
  const [isExecuting, setIsExecuting] = useState(false);
  const [executionMode, setExecutionMode] = useState<ExecutionMode>('sequential');
  const [isConnecting, setIsConnecting] = useState(false);
  const [connectionStart, setConnectionStart] = useState<{
    nodeId: string;
    handle: string;
    type: IOType;
  } | null>(null);
  const [tempConnection, setTempConnection] = useState<{
    startX: number;
    startY: number;
    endX: number;
    endY: number;
  } | null>(null);
  const [configModalOpen, setConfigModalOpen] = useState(false);
  const [configNodeId, setConfigNodeId] = useState<string | null>(null);
  const [nodeConfigs, setNodeConfigs] = useState<Record<string, any>>({});
  const [previewModalOpen, setPreviewModalOpen] = useState(false);
  const [previewNodeId, setPreviewNodeId] = useState<string | null>(null);

  const canvasRef = useRef<HTMLDivElement>(null);
  
  // Use the node processing hook
  const { processNode } = useNodeProcessing();
  
  // Force dark mode
  useEffect(() => {
    document.documentElement.classList.add('dark');
  }, []);

  // Add node to canvas
  const addNode = useCallback((type: keyof typeof nodeTypes, position?: { x: number; y: number }) => {
    const nodeId = Date.now().toString();
    const newNode: WorkflowNode = {
      id: nodeId,
      type,
      position: position || { 
        x: Math.random() * 400 + 100,
        y: Math.random() * 300 + 100
      },
      data: {
        label: nodeTypes[type].label,
        icon: nodeTypes[type].icon,
        color: nodeTypes[type].color,
        inputs: nodeTypes[type].inputs,
        outputs: nodeTypes[type].outputs,
        config: {} // Initialize empty config
      }
    };
    setNodes(prev => [...prev, newNode]);
    // Initialize node config
    setNodeConfigs(prev => ({
      ...prev,
      [nodeId]: {}
    }));
  }, []);

  // Delete node
  const deleteNode = useCallback((nodeId: string) => {
    setNodes(prev => prev.filter(n => n.id !== nodeId));
    setConnections(prev => prev.filter(c => c.source !== nodeId && c.target !== nodeId));
    if (selectedNode === nodeId) {
      setSelectedNode(null);
    }
  }, [selectedNode]);

  // Configure node
  const configureNode = useCallback((nodeId: string) => {
    setConfigNodeId(nodeId);
    setConfigModalOpen(true);
  }, []);

  // Execute individual node
  const executeNode = useCallback(async (nodeId: string) => {
    setExecutingNodes(prev => new Set([...Array.from(prev), nodeId]));
    await new Promise(resolve => setTimeout(resolve, 2000));
    setExecutingNodes(prev => {
      const newSet = new Set(prev);
      newSet.delete(nodeId);
      return newSet;
    });
  }, []);

  // Start connection
  const startConnection = useCallback((nodeId: string, handle: string, e: React.MouseEvent) => {
    e.stopPropagation();
    const rect = canvasRef.current?.getBoundingClientRect();
    if (!rect) return;
    
    setIsConnecting(true);
    const node = nodes.find(n => n.id === nodeId);
    const nodeTypeKey = node?.type || 'start';
    const ioType = handle === 'output' 
      ? nodeTypes[nodeTypeKey].outputs[0]?.type || 'video'
      : nodeTypes[nodeTypeKey].inputs[0]?.type || 'video';
    setConnectionStart({ nodeId, handle, type: ioType });
    
    const handleMouseMove = (moveEvent: MouseEvent) => {
      if (!canvasRef.current) return;
      const canvasRect = canvasRef.current.getBoundingClientRect();
      const mouseX = moveEvent.clientX - canvasRect.left;
      const mouseY = moveEvent.clientY - canvasRect.top;
      
      const node = nodes.find(n => n.id === nodeId);
      if (!node) return;
      
      const startX = node.position.x + (handle === 'output' ? 320 : 0); // Node width is w-80 = 320px
      const startY = node.position.y + 60; // Middle of node
      
      setTempConnection({
        startX,
        startY,
        endX: mouseX,
        endY: mouseY
      });
    };

    const handleMouseUp = (upEvent: MouseEvent) => {
      // Check if we're over a valid target handle
      const element = document.elementFromPoint(upEvent.clientX, upEvent.clientY);
      const handleElement = element?.closest('[data-handle]');
      
      if (handleElement) {
        const targetNodeId = handleElement.getAttribute('data-node-id');
        const targetHandle = handleElement.getAttribute('data-handle-type');
        
        if (targetNodeId && targetHandle && targetNodeId !== nodeId) {
          // Prevent connecting to same type of handle or invalid connections
          if ((handle === 'output' && targetHandle === 'input') || 
              (handle === 'input' && targetHandle === 'output')) {
            
            const sourceNodeId = handle === 'output' ? nodeId : targetNodeId;
            const targetNodeIdFinal = handle === 'output' ? targetNodeId : nodeId;
            
            // Check if connection already exists
            const connectionExists = connections.some(c => 
              c.source === sourceNodeId && c.target === targetNodeIdFinal
            );
            
            if (!connectionExists) {
              const newConnection: Connection = {
                id: `${sourceNodeId}-${targetNodeIdFinal}`,
                source: sourceNodeId,
                target: targetNodeIdFinal,
                sourceHandle: 'output',
                targetHandle: 'input'
              };
              
              setConnections(prev => [...prev, newConnection]);
            }
          }
        }
      }
      
      // Clean up
      setIsConnecting(false);
      setConnectionStart(null);
      setTempConnection(null);
      document.removeEventListener('mousemove', handleMouseMove);
      document.removeEventListener('mouseup', handleMouseUp);
    };

    document.addEventListener('mousemove', handleMouseMove);
    document.addEventListener('mouseup', handleMouseUp);
    
    setIsConnecting(true);
    const node2 = nodes.find(n => n.id === nodeId);
    const nodeTypeKey2 = node2?.type || 'start';
    const ioType2 = handle === 'output' 
      ? nodeTypes[nodeTypeKey2].outputs[0]?.type || 'video'
      : nodeTypes[nodeTypeKey2].inputs[0]?.type || 'video';
    setConnectionStart({ nodeId, handle, type: ioType2 });
    
    const startX = e.clientX - rect.left;
    const startY = e.clientY - rect.top;
    
    setTempConnection({
      startX,
      startY,
      endX: startX,
      endY: startY
    });
  }, []);

  // Complete connection
  const completeConnection = useCallback((targetNodeId: string, targetHandle: string) => {
    if (!connectionStart || !isConnecting) return;
    
    // Validate connection
    if (connectionStart.handle === targetHandle) return; // Can't connect same type
    if (connectionStart.nodeId === targetNodeId) return; // Can't connect to self
    
    // Check if connection already exists
    const existingConnection = connections.find(c => 
      c.source === connectionStart.nodeId && c.target === targetNodeId
    );
    if (existingConnection) return;
    
    // Create new connection
    const newConnection: Connection = {
      id: Date.now().toString(),
      source: connectionStart.nodeId,
      target: targetNodeId,
      sourceHandle: connectionStart.handle,
      targetHandle: targetHandle
    };
    
    setConnections(prev => [...prev, newConnection]);
    setIsConnecting(false);
    setConnectionStart(null);
    setTempConnection(null);
  }, [connectionStart, isConnecting, connections]);

  // Cancel connection
  const cancelConnection = useCallback(() => {
    setIsConnecting(false);
    setConnectionStart(null);
    setTempConnection(null);
  }, []);

  // Handle mouse move for temporary connection
  const handleMouseMove = useCallback((e: React.MouseEvent) => {
    if (!isConnecting || !tempConnection) return;
    
    const rect = canvasRef.current?.getBoundingClientRect();
    if (!rect) return;
    
    const endX = e.clientX - rect.left;
    const endY = e.clientY - rect.top;
    
    setTempConnection(prev => prev ? {
      ...prev,
      endX,
      endY
    } : null);
  }, [isConnecting, tempConnection]);

  // Handle mouse up
  const handleMouseUp = useCallback(() => {
    setIsDragging(false);
  }, []);

  // Handle node drag start
  const handleNodeDragStart = useCallback((e: React.MouseEvent, nodeId: string) => {
    const node = nodes.find(n => n.id === nodeId);
    if (!node) return;
    
    setSelectedNode(nodeId);
    setIsDragging(true);
    
    const rect = canvasRef.current?.getBoundingClientRect();
    if (!rect) return;
    
    const mouseX = e.clientX - rect.left;
    const mouseY = e.clientY - rect.top;
    
    setDragOffset({
      x: mouseX - node.position.x,
      y: mouseY - node.position.y
    });

    // Add mouse move and mouse up listeners to the document
    const handleMouseMove = (moveEvent: MouseEvent) => {
      if (!canvasRef.current) return;
      const canvasRect = canvasRef.current.getBoundingClientRect();
      const newX = moveEvent.clientX - canvasRect.left - dragOffset.x;
      const newY = moveEvent.clientY - canvasRect.top - dragOffset.y;
      
      setNodes(prev => prev.map(n => 
        n.id === nodeId 
          ? { ...n, position: { x: Math.max(0, newX), y: Math.max(0, newY) } }
          : n
      ));
    };

    const handleMouseUp = () => {
      setIsDragging(false);
      setSelectedNode(null);
      document.removeEventListener('mousemove', handleMouseMove);
      document.removeEventListener('mouseup', handleMouseUp);
    };

    document.addEventListener('mousemove', handleMouseMove);
    document.addEventListener('mouseup', handleMouseUp);
  }, [nodes, dragOffset.x, dragOffset.y]);

  // Auto-connect nodes
  const autoConnectNodes = useCallback(() => {
    if (nodes.length < 2) return;
    
    const newConnections: Connection[] = [];
    const sortedNodes = [...nodes].sort((a, b) => a.position.x - b.position.x);
    
    for (let i = 0; i < sortedNodes.length - 1; i++) {
      const source = sortedNodes[i];
      const target = sortedNodes[i + 1];
      
      const connectionExists = connections.some(c => 
        c.source === source.id && c.target === target.id
      );
      
      if (!connectionExists) {
        newConnections.push({
          id: Date.now().toString() + i,
          source: source.id,
          target: target.id,
          sourceHandle: 'output',
          targetHandle: 'input'
        });
      }
    }
    
    setConnections(prev => [...prev, ...newConnections]);
  }, [nodes, connections]);

  // Run workflow
  const runWorkflow = useCallback(async () => {
    if (nodes.length === 0) return;
    
    // Validate that Start node has a video uploaded
    const startNode = nodes.find(n => n.type === 'start');
    if (startNode && (!nodeConfigs[startNode.id]?.videoPath && !nodeConfigs[startNode.id]?.videoFile)) {
      alert('Please upload a video to the Start node before running the workflow.');
      return;
    }
    
    setIsExecuting(true);
    setExecutingNodes(new Set());
    
    try {
      // Execute workflow on backend
      const response = await fetch('/api/nodes/execute-workflow', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          nodes: nodes.map(node => ({
            id: node.id,
            type: node.type,
            config: nodeConfigs[node.id] || {}
          })),
          connections: connections.map(conn => ({
            source: conn.source,
            target: conn.target,
            sourceOutput: conn.sourceHandle,
            targetInput: conn.targetHandle
          }))
        })
      });
      
      const result = await response.json();
      
      if (result.success) {
        console.log('Workflow executed successfully:', result.data);
        
        // Update node states with results
        const workflowResults = result.data.results || {};
        
        for (const [nodeId, nodeResult] of Object.entries(workflowResults)) {
          if (nodeResult && typeof nodeResult === 'object') {
            const typedResult = nodeResult as any;
            
            // Update node with output video path for preview
            if (typedResult.outputPath || typedResult.videoPath) {
              const outputPath = typedResult.outputPath || typedResult.videoPath;
              setNodes(prev => prev.map(n => 
                n.id === nodeId 
                  ? { 
                      ...n, 
                      data: { 
                        ...n.data, 
                        config: { 
                          ...n.data?.config, 
                          videoPath: outputPath,
                          // Store B-roll assets if they exist
                          ...(typedResult.brollAssets ? {
                            brollAssets: typedResult.brollAssets,
                            moments: typedResult.moments || []
                          } : {})
                        },
                        preview: {
                          type: 'video' as const,
                          url: outputPath
                        }
                      } 
                    }
                  : n
              ));
            }
            
            // Mark node as processed
            setExecutingNodes(prev => {
              const newSet = new Set(prev);
              newSet.add(nodeId);
              return newSet;
            });
            
            // Animate execution
            await new Promise(resolve => setTimeout(resolve, 500));
            
            setExecutingNodes(prev => {
              const newSet = new Set(prev);
              newSet.delete(nodeId);
              return newSet;
            });
          }
        }
        
        console.log('✅ Workflow execution complete!');
      } else {
        console.error('❌ Workflow execution failed:', result.error);
        alert(`Workflow execution failed: ${result.error || 'Unknown error'}`);
      }
    } catch (error) {
      console.error('Error executing workflow:', error);
      alert('Failed to execute workflow. Please check the console for details.');
    } finally {
      setIsExecuting(false);
      setExecutingNodes(new Set());
    }
  }, [nodes, connections]);

  // Get execution order based on connections
  const getExecutionOrder = useCallback(() => {
    const startNode = nodes.find(n => n.type === 'start');
    if (!startNode) return nodes.map(n => n.id);
    
    const visited = new Set<string>();
    const order: string[] = [];
    
    const traverse = (nodeId: string) => {
      if (visited.has(nodeId)) return;
      visited.add(nodeId);
      order.push(nodeId);
      
      const outgoingConnections = connections.filter(c => c.source === nodeId);
      for (const conn of Array.from(outgoingConnections)) {
        traverse(conn.target);
      }
    };
    
    traverse(startNode.id);
    return order;
  }, [nodes, connections]);

  // Preview node handler
  const handlePreview = useCallback((nodeId: string) => {
    setPreviewNodeId(nodeId);
    setPreviewModalOpen(true);
  }, []);

  // Keyboard shortcuts
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === 'Escape' && isConnecting) {
        cancelConnection();
      }
      if (e.key === 'Delete' && selectedNode) {
        deleteNode(selectedNode);
      }
    };

    document.addEventListener('keydown', handleKeyDown);
    return () => document.removeEventListener('keydown', handleKeyDown);
  }, [isConnecting, selectedNode, cancelConnection, deleteNode]);

  return (
    <div className="min-h-screen bg-[#0f0f0f]">
      {/* Professional Header - n8n Style */}
      <div className="sticky top-0 z-50 bg-[#1a1a1a] border-b border-[#2a2a2a] shadow-xl">
        <div className="container mx-auto px-6 py-3">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-4">
              <div className="flex items-center gap-3">
                <div className="w-8 h-8 bg-gradient-to-br from-purple-500 to-pink-500 rounded-lg flex items-center justify-center">
                  <span className="text-white font-bold text-sm">W</span>
                </div>
                <div>
                  <h1 className="text-lg font-semibold text-white">
                    Weave Video Editor
                  </h1>
                  <p className="text-xs text-gray-400">AI-Powered Visual Processing Pipeline</p>
                </div>
              </div>
            </div>
            
            <div className="flex items-center gap-3">
              <Button
                onClick={runWorkflow}
                disabled={isExecuting || nodes.length === 0}
                className="bg-purple-600 hover:bg-purple-700 disabled:opacity-50 text-white border-0"
                size="sm"
              >
                {isExecuting ? (
                  <>
                    <Pause className="mr-2 h-4 w-4" />
                    Executing
                  </>
                ) : (
                  <>
                    <Play className="mr-2 h-4 w-4" />
                    Run Workflow
                  </>
                )}
              </Button>
              <Button
                onClick={autoConnectNodes}
                variant="outline"
                size="sm"
                className="border-[#3a3a3a] text-gray-300 hover:bg-[#2a2a2a] bg-transparent"
                disabled={nodes.length < 2}
              >
                <Zap className="mr-2 h-4 w-4" />
                Auto Connect
              </Button>
              {isConnecting && (
                <Badge className="text-purple-400 border-purple-500/30 bg-purple-500/10 animate-pulse">
                  Connecting... (Click target handle or ESC to cancel)
                </Badge>
              )}
              <div className="h-6 w-px bg-[#3a3a3a]" />
              <Button variant="outline" size="sm" className="border-[#3a3a3a] text-gray-300 hover:bg-[#2a2a2a] bg-transparent">
                <Save className="mr-2 h-4 w-4" />
                Save
              </Button>
              <Button variant="outline" size="sm" className="border-[#3a3a3a] text-gray-300 hover:bg-[#2a2a2a] bg-transparent">
                <Download className="mr-2 h-4 w-4" />
                Export
              </Button>
            </div>
          </div>
        </div>
      </div>

      <div className="flex h-[calc(100vh-60px)]">
        {/* Professional Sidebar - n8n Style */}
        <div className="w-80 bg-[#1a1a1a] border-r border-[#2a2a2a] shadow-xl">
          <div className="p-4 border-b border-[#2a2a2a]">
            <h2 className="text-sm font-semibold text-white mb-3">Node Library</h2>
            <div className="space-y-2">
              {Object.entries(nodeTypes).map(([type, config]) => {
                const Icon = config.icon;
                return (
                  <Button
                    key={type}
                    variant="ghost"
                    className="w-full justify-start h-auto p-3 hover:bg-[#2a2a2a] border border-[#3a3a3a] hover:border-[#4a4a4a] text-gray-200 bg-[#0f0f0f]"
                    onClick={() => addNode(type as keyof typeof nodeTypes)}
                  >
                    <div className="mr-3 w-8 h-8 rounded flex items-center justify-center" style={{ backgroundColor: config.color + '20' }}>
                      <Icon className="h-4 w-4" style={{ color: config.color }} />
                    </div>
                    <div className="text-left">
                      <div className="font-medium text-sm text-white">{config.label}</div>
                      <div className="text-xs text-gray-400">{config.description}</div>
                    </div>
                  </Button>
                );
              })}
            </div>
          </div>

          <div className="p-4 border-b border-[#2a2a2a]">
            <h3 className="text-sm font-semibold text-white mb-3">Workflow Stats</h3>
            <div className="space-y-2 text-sm">
              <div className="flex justify-between items-center">
                <span className="text-gray-400">Nodes:</span>
                <Badge className="bg-[#2a2a2a] text-gray-300 border-[#3a3a3a] text-xs">
                  {nodes.length}
                </Badge>
              </div>
              <div className="flex justify-between items-center">
                <span className="text-gray-400">Connections:</span>
                <Badge className="bg-[#2a2a2a] text-gray-300 border-[#3a3a3a] text-xs">
                  {connections.length}
                </Badge>
              </div>
              <div className="flex justify-between items-center">
                <span className="text-gray-400">Status:</span>
                <Badge className={`text-xs ${isExecuting ? 'bg-purple-500/10 text-purple-400 border-purple-500/30' : 'bg-green-500/10 text-green-400 border-green-500/30'}`}>
                  {isExecuting ? 'Running' : 'Ready'}
                </Badge>
              </div>
            </div>
          </div>

          <div className="p-4">
            <h3 className="text-sm font-semibold text-white mb-3">Quick Actions</h3>
            <div className="space-y-2">
              <Button 
                variant="outline" 
                size="sm" 
                className="w-full justify-start border-[#3a3a3a] text-gray-300 hover:bg-[#2a2a2a] bg-transparent"
                onClick={() => {
                  addNode('start', { x: 100, y: 100 });
                  addNode('shorts', { x: 400, y: 100 });
                  addNode('captions', { x: 700, y: 100 });
                }}
              >
                <Plus className="mr-2 h-4 w-4" />
                Create Sample Workflow
              </Button>
              <Button 
                variant="outline" 
                size="sm" 
                className="w-full justify-start border-[#3a3a3a] text-gray-300 hover:bg-[#2a2a2a] bg-transparent"
                onClick={() => {
                  setNodes([]);
                  setConnections([]);
                }}
              >
                <Trash2 className="mr-2 h-4 w-4" />
                Clear Canvas
              </Button>
            </div>
          </div>
        </div>

        {/* Professional Canvas - n8n Style */}
        <div className="flex-1 flex flex-col overflow-hidden bg-[#0f0f0f]">
          {/* Video Timeline Section - only show if Start node has video */}
          {(() => {
            const startNode = nodes.find(n => n.type === 'start');
            const videoConfig = startNode?.data?.config;
            return videoConfig?.videoFile ? (
              <div className="h-64 border-b border-[#2a2a2a] bg-[#1a1a1a] p-4">
                <h3 className="text-sm font-semibold text-white mb-3">Video Timeline</h3>
                <VideoTimeline 
                  videoFile={videoConfig.videoFile}
                  title={videoConfig.title}
                />
              </div>
            ) : null;
          })()}
          
          {/* Node Canvas */}
          <div
            ref={canvasRef}
            className="flex-1 relative"
            style={{
              background: `
                radial-gradient(circle at 1px 1px, rgba(255, 255, 255, 0.05) 1px, transparent 0),
                #0f0f0f
              `,
              backgroundSize: '25px 25px'
            }}
            onMouseMove={handleMouseMove}
            onMouseUp={handleMouseUp}
            onClick={() => {
              if (isConnecting) {
                cancelConnection();
              }
            }}
          >
            {/* SVG for connections */}
            <svg className="absolute inset-0 w-full h-full pointer-events-none z-[5]">
              {/* Existing connections */}
              {connections.map(connection => {
                const sourceNode = nodes.find(n => n.id === connection.source);
                const targetNode = nodes.find(n => n.id === connection.target);
                if (!sourceNode || !targetNode) return null;

                const sourceX = sourceNode.position.x + 320; // Node width w-80 (80 * 4)
                const sourceY = sourceNode.position.y + 60; // Node height/2
                const targetX = targetNode.position.x;
                const targetY = targetNode.position.y + 60;

                const isActive = executingNodes.has(connection.source) || executingNodes.has(connection.target);

                return (
                  <FlowConnection
                    key={connection.id}
                    sourceX={sourceX}
                    sourceY={sourceY}
                    targetX={targetX}
                    targetY={targetY}
                    isActive={isActive}
                    isAnimated={true}
                  />
                );
              })}
              
              {/* Temporary connection while dragging */}
              {tempConnection && (
                <FlowConnection
                  sourceX={tempConnection.startX}
                  sourceY={tempConnection.startY}
                  targetX={tempConnection.endX}
                  targetY={tempConnection.endY}
                  isActive={true}
                  isAnimated={false}
                  isDashed={true}
                />
              )}
            </svg>

            {/* Render nodes */}
            {nodes.map(node => (
              <ConfigurableFlowNode
                key={node.id}
                id={node.id}
                type={node.type}
                position={node.position}
                data={node.data}
                isSelected={selectedNode === node.id}
                isExecuting={executingNodes.has(node.id)}
                isDragging={isDragging && selectedNode === node.id}
                isConnecting={isConnecting}
                executionStatus={
                  executingNodes.has(node.id) ? 'running' : 'idle'
                }
                onDragStart={(nodeId, e) => handleNodeDragStart(e, nodeId)}
                onDelete={deleteNode}
                onConfigure={configureNode}
                onExecute={executionMode === 'manual' ? executeNode : undefined}
                onPreview={handlePreview}
                onDuplicate={() => {
                  const newNode = {
                    ...node,
                    id: Date.now().toString(),
                    position: { x: node.position.x + 50, y: node.position.y + 50 }
                  };
                  setNodes(prev => [...prev, newNode]);
                }}
                onStartConnection={startConnection}
                onCompleteConnection={completeConnection}
                onConfigChange={(nodeId, config) => {
                  // Update node configs state
                  setNodeConfigs(prev => ({
                    ...prev,
                    [nodeId]: config
                  }));
                  
                  // Update node data
                  setNodes(prev => prev.map(n => 
                    n.id === nodeId 
                      ? {
                          ...n,
                          data: {
                            ...n.data,
                            config
                          }
                        }
                      : n
                  ));
                }}
              />
            ))}

            {/* Empty state */}
            {nodes.length === 0 && (
              <div className="absolute inset-0 flex items-center justify-center">
                <div className="text-center text-gray-500 max-w-md">
                  <div className="w-16 h-16 mx-auto mb-4 bg-gray-100 rounded-full flex items-center justify-center">
                    <Zap className="h-8 w-8 text-gray-400" />
                  </div>
                  <h3 className="text-lg font-semibold text-gray-900 mb-2">Build Your Video Workflow</h3>
                  <p className="text-sm text-gray-600 mb-6 leading-relaxed">
                    Drag and drop nodes from the sidebar to create your video processing pipeline.
                    Connect nodes together to build powerful automation workflows.
                  </p>
                  <Button
                    onClick={() => {
                      addNode('start', { x: 100, y: 200 });
                      addNode('shorts', { x: 400, y: 200 });
                      addNode('enhancement', { x: 700, y: 200 });
                    }}
                    className="bg-blue-600 hover:bg-blue-700 text-white"
                    size="sm"
                  >
                    <Plus className="mr-2 h-4 w-4" />
                    Create Sample Workflow
                  </Button>
                </div>
              </div>
            )}

            {/* Canvas Info Panel */}
            <div className="absolute bottom-4 right-4 z-20">
              <div className="bg-white border border-gray-200 rounded-lg shadow-sm p-3">
                <div className="text-xs text-gray-600">
                  <div className="font-medium mb-1">Canvas Stats</div>
                  <div className="space-y-1">
                    <div className="flex justify-between">
                      <span>Zoom:</span>
                      <span>{Math.round(zoom * 100)}%</span>
                    </div>
                    <div className="flex justify-between">
                      <span>Nodes:</span>
                      <span>{nodes.length}</span>
                    </div>
                  </div>
                </div>
              </div>
            </div>
          </div>
        </div>
      </div>

      {/* Configuration Modal - Keep for backward compatibility but nodes now have inline config */}
      <NodeConfigModal
        isOpen={configModalOpen}
        onClose={() => {
          setConfigModalOpen(false);
          setConfigNodeId(null);
        }}
        nodeId={configNodeId}
        nodeType={configNodeId ? nodes.find(n => n.id === configNodeId)?.type : undefined}
        initialConfig={configNodeId ? nodeConfigs[configNodeId] : {}}
        onSave={(config) => {
          if (configNodeId) {
            setNodeConfigs(prev => ({
              ...prev,
              [configNodeId]: config
            }));
            
            // Update node data
            setNodes(prev => prev.map(node => 
              node.id === configNodeId 
                ? {
                    ...node,
                    data: {
                      ...node.data,
                      config
                    }
                  }
                : node
            ));
          }
          setConfigModalOpen(false);
          setConfigNodeId(null);
        }}
      />

      {/* Preview Modal */}
      <Dialog open={previewModalOpen} onOpenChange={setPreviewModalOpen}>
        <DialogContent className="max-w-6xl w-full max-h-[90vh] overflow-hidden bg-gray-900 border-gray-800">
          <DialogHeader>
            <DialogTitle className="text-white">Node Preview</DialogTitle>
          </DialogHeader>
          <div className="h-full overflow-auto">
            {previewNodeId && (
              <RevideoPreview
                nodeId={previewNodeId}
                nodeType={nodes.find(n => n.id === previewNodeId)?.type || ''}
                nodeConfig={nodes.find(n => n.id === previewNodeId)?.data?.config || {}}
              />
            )}
          </div>
        </DialogContent>
      </Dialog>
    </div>
  );
};

export default NodeVideoEditor;