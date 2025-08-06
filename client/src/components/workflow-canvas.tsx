import { useCallback, useRef, useEffect } from "react";
import ReactFlow, {
  ReactFlowProvider,
  addEdge,
  useNodesState,
  useEdgesState,
  Controls,
  Background,

  BackgroundVariant,
  Connection,
  Edge,
  Node,
} from "reactflow";
import "reactflow/dist/style.css";
import WorkflowTile from "./workflow-tile";
import { MdAdd, MdSettings } from "react-icons/md";
import { Button } from "@/components/ui/button";
import { Link } from "wouter";
import type { WorkflowNode, WorkflowEdge } from "@/lib/workflow-types";

// Custom tile component with data flow capabilities
const TileWithConnections = (props: any) => {
  return <WorkflowTile {...props} onDataChange={handleDataChange} />;
};

// Global state for node data flow
let nodeDataStore: Record<string, any> = {};
let updateConnectedNodes: ((sourceId: string, data: any) => void) | null = null;

const handleDataChange = (nodeId: string, outputData: any) => {
  nodeDataStore[nodeId] = outputData;
  if (updateConnectedNodes) {
    updateConnectedNodes(nodeId, outputData);
  }
};

const nodeTypes = {
  workflowTile: TileWithConnections,
};

interface WorkflowCanvasProps {
  nodes: WorkflowNode[];
  edges: WorkflowEdge[];
  onNodesChange: (nodes: WorkflowNode[]) => void;
  onEdgesChange: (edges: WorkflowEdge[]) => void;
  onSave: () => void;
}

function WorkflowCanvasInner({
  nodes: initialNodes,
  edges: initialEdges,
  onNodesChange,
  onEdgesChange,
  onSave,
}: WorkflowCanvasProps) {
  const reactFlowWrapper = useRef<HTMLDivElement>(null);
  const [nodes, setNodes, onNodesStateChange] = useNodesState(initialNodes);
  const [edges, setEdges, onEdgesStateChange] = useEdgesState(initialEdges);

  // Set up data flow handler
  updateConnectedNodes = useCallback((sourceId: string, outputData: any) => {
    const connectedEdges = edges.filter(edge => edge.source === sourceId);
    if (connectedEdges.length > 0) {
      setNodes(currentNodes => 
        currentNodes.map(node => {
          const isTargetNode = connectedEdges.some(edge => edge.target === node.id);
          if (isTargetNode) {
            const existingInputs = node.data.inputs || [];
            const updatedInputs = existingInputs.filter((input: any) => input.sourceNodeId !== sourceId);
            updatedInputs.push({ ...outputData, sourceNodeId: sourceId });
            
            return {
              ...node,
              data: {
                ...node.data,
                inputs: updatedInputs
              }
            };
          }
          return node;
        })
      );
    }
  }, [edges, setNodes]);

  const onConnect = useCallback(
    (params: Connection) => {
      const newEdge = addEdge({
        ...params,
        type: "smoothstep",
        style: { stroke: "#4285F4", strokeWidth: 3 },
        animated: true,
        label: "video data",
      }, edges);
      setEdges(newEdge);
      onEdgesChange(newEdge as WorkflowEdge[]);
      
      // Immediately pass any existing data from source to target
      if (params.source && params.target && nodeDataStore[params.source]) {
        setNodes(currentNodes => 
          currentNodes.map(node => {
            if (node.id === params.target) {
              const existingInputs = node.data.inputs || [];
              const updatedInputs = existingInputs.filter((input: any) => input.sourceNodeId !== params.source);
              updatedInputs.push({ ...nodeDataStore[params.source], sourceNodeId: params.source });
              
              return {
                ...node,
                data: {
                  ...node.data,
                  inputs: updatedInputs
                }
              };
            }
            return node;
          })
        );
      }
    },
    [edges, setEdges, onEdgesChange, setNodes]
  );

  const onNodesChangeHandler = useCallback(
    (changes: any) => {
      onNodesStateChange(changes);
    },
    [onNodesStateChange]
  );

  const onEdgesChangeHandler = useCallback(
    (changes: any) => {
      onEdgesStateChange(changes);
    },
    [onEdgesStateChange]
  );

  // Update parent component when nodes or edges change
  useEffect(() => {
    onNodesChange(nodes as WorkflowNode[]);
  }, [nodes, onNodesChange]);

  useEffect(() => {
    onEdgesChange(edges as WorkflowEdge[]);
  }, [edges, onEdgesChange]);

  const onDrop = useCallback(
    (event: React.DragEvent) => {
      event.preventDefault();
      console.log('Drop event triggered');

      if (!reactFlowWrapper.current) {
        console.log('No reactFlowWrapper ref');
        return;
      }

      const reactFlowBounds = reactFlowWrapper.current.getBoundingClientRect();
      const tileData = event.dataTransfer.getData("application/reactflow");
      console.log('Tile data:', tileData);

      if (!tileData) {
        console.log('No tile data found');
        return;
      }

      try {
        const tile = JSON.parse(tileData);
        console.log('Parsed tile:', tile);
        
        const position = {
          x: event.clientX - reactFlowBounds.left - 136, // Half of tile width
          y: event.clientY - reactFlowBounds.top - 80,   // Half of tile height
        };

        const newNode: WorkflowNode = {
          id: `${tile.id}-${Date.now()}`,
          type: "workflowTile",
          position,
          data: {
            label: tile.name,
            icon: tile.icon,
            color: tile.color,
            type: tile.type,
            settings: tile.defaultSettings || {},
            status: "ready",
          },
        };

        console.log('Creating new node:', newNode);

        setNodes((nds) => {
          const newNodes = nds.concat(newNode);
          console.log('Updated nodes:', newNodes);
          onNodesChange(newNodes as WorkflowNode[]);
          return newNodes;
        });

        // Auto-save after adding a node
        setTimeout(onSave, 500);
      } catch (error) {
        console.error('Error parsing tile data:', error);
      }
    },
    [setNodes, onNodesChange, onSave]
  );

  const onDragOver = useCallback((event: React.DragEvent) => {
    event.preventDefault();
    event.dataTransfer.dropEffect = "move";
  }, []);

  // Create a default video upload node if no nodes exist
  const displayNodes = nodes.length === 0 ? [
    {
      id: "video-upload",
      type: "workflowTile",
      position: { x: 100, y: 100 },
      data: {
        label: "Video Upload",
        icon: "Upload",
        color: "bg-blue-500",
        settings: {},
        status: "ready" as const,
      },
    }
  ] : nodes;

  return (
    <div className="flex-1 relative" ref={reactFlowWrapper}>
      <ReactFlow
        nodes={displayNodes}
        edges={edges}
        onNodesChange={onNodesChangeHandler}
        onEdgesChange={onEdgesChangeHandler}
        onConnect={onConnect}
        onDrop={onDrop}
        onDragOver={onDragOver}
        nodeTypes={nodeTypes}
        fitView
        className="bg-google-bg"
        defaultEdgeOptions={{
          style: { strokeWidth: 2, stroke: '#4285F4' },
          type: 'smoothstep',
        }}
      >
        <Controls className="!bg-google-canvas !border-gray-200 !rounded-google shadow-lg" />

        <Background 
          variant={BackgroundVariant.Dots} 
          gap={20} 
          size={1} 
          color="#E8F0FE"
          className="bg-google-bg"
        />
      </ReactFlow>

      {/* Floating Add Node Button */}
      <Button
        size="lg"
        className="absolute bottom-8 right-8 w-14 h-14 rounded-full bg-google-blue hover:bg-blue-600 text-white shadow-lg hover:shadow-xl transition-all duration-200"
        title="Add Node"
      >
        <MdAdd className="w-6 h-6" />
      </Button>
    </div>
  );
}

export default function WorkflowCanvas(props: WorkflowCanvasProps) {
  return (
    <ReactFlowProvider>
      <WorkflowCanvasInner {...props} />
    </ReactFlowProvider>
  );
}
