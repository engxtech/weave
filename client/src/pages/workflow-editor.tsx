import { useState, useEffect } from "react";
import { useParams } from "wouter";
import { Button } from "@/components/ui/button";
import { Separator } from "@/components/ui/separator";
import WorkflowCanvas from "@/components/workflow-canvas";
import TileLibrary from "@/components/tile-library";
import ChatSidebar from "@/components/chat-sidebar";
import SettingsPopup from "@/components/settings-popup";
import TemplateGallery from "@/components/template-gallery";
import VideoUpload from "@/components/video-upload";
import CollaborationPanel from "@/components/collaboration-panel";
import { useWorkflow, useCreateWorkflow, useUpdateWorkflow, useExecuteWorkflow } from "@/hooks/use-workflow";
import { useToast } from "@/hooks/use-toast";
import { 
  MdVideoLibrary, MdSettings, MdHelp, MdPlayArrow, MdFileUpload, MdFolder, 
  MdSmartToy, MdPeople, MdCloudUpload, MdAutoAwesome, MdSave 
} from "react-icons/md";
import type { WorkflowNode, WorkflowEdge } from "@/lib/workflow-types";

export default function WorkflowEditor() {
  const { id } = useParams<{ id?: string }>();
  const workflowId = id ? parseInt(id) : undefined;
  
  const [nodes, setNodes] = useState<WorkflowNode[]>([]);
  const [edges, setEdges] = useState<WorkflowEdge[]>([]);
  const [chatSidebarOpen, setChatSidebarOpen] = useState(true);
  const [settingsOpen, setSettingsOpen] = useState(false);
  const [collaborationOpen, setCollaborationOpen] = useState(false);
  const [videoUploadOpen, setVideoUploadOpen] = useState(false);
  const [workflowName, setWorkflowName] = useState("Untitled Video");
  
  const { toast } = useToast();
  const { data: workflow, isLoading } = useWorkflow(workflowId);
  const createWorkflow = useCreateWorkflow();
  const updateWorkflow = useUpdateWorkflow();
  const executeWorkflow = useExecuteWorkflow();

  useEffect(() => {
    if (workflow) {
      setWorkflowName(workflow.name);
      setNodes(workflow.nodes as WorkflowNode[] || []);
      setEdges(workflow.edges as WorkflowEdge[] || []);
    }
  }, [workflow]);

  const handleSaveWorkflow = async () => {
    if (!workflowId) {
      // Create new workflow if none exists
      try {
        const newWorkflow = await createWorkflow.mutateAsync({
          name: workflowName,
          nodes,
          edges
        });
        window.history.pushState({}, '', `/workflow/${newWorkflow.id}`);
        toast({
          title: "Workflow created and saved",
          description: "Your workflow has been saved successfully"
        });
        return;
      } catch (error) {
        toast({
          title: "Error creating workflow",
          description: "Failed to create new workflow",
          variant: "destructive"
        });
        return;
      }
    }

    try {
      await updateWorkflow.mutateAsync({
        id: workflowId,
        data: {
          name: workflowName,
          nodes,
          edges
        }
      });
      
      toast({
        title: "Workflow saved",
        description: "Your changes have been saved successfully"
      });
    } catch (error) {
      toast({
        title: "Error saving workflow",
        description: "Failed to save workflow changes",
        variant: "destructive"
      });
    }
  };

  const handleAutoSave = async () => {
    try {
      const workflowData = {
        name: workflowName,
        nodes,
        edges,
        settings: {}
      };

      if (workflowId) {
        await updateWorkflow.mutateAsync({ id: workflowId, data: workflowData });
        toast({ title: "Workflow saved successfully" });
      } else {
        const newWorkflow = await createWorkflow.mutateAsync(workflowData);
        window.history.pushState({}, "", `/workflow/${newWorkflow.id}`);
        toast({ title: "Workflow created successfully" });
      }
    } catch (error) {
      toast({ 
        title: "Error saving workflow", 
        description: "Please try again",
        variant: "destructive" 
      });
    }
  };

  const handleExecuteWorkflow = async () => {
    if (!workflowId) {
      toast({ 
        title: "Please save the workflow first", 
        variant: "destructive" 
      });
      return;
    }

    try {
      // Set all nodes to processing state
      const processingNodes = nodes.map(node => ({
        ...node,
        data: {
          ...node.data,
          status: 'processing'
        }
      }));
      
      setNodes(processingNodes);
      
      const result = await executeWorkflow.mutateAsync(workflowId);
      
      // Update nodes with execution results
      if (result.updatedNodes) {
        setNodes(result.updatedNodes);
      }
      
      toast({ 
        title: "Workflow executed successfully", 
        description: result.message 
      });
      
      // Save the updated workflow
      await handleSaveWorkflow();
      
    } catch (error: any) {
      // Reset nodes to ready state on error
      const readyNodes = nodes.map(node => ({
        ...node,
        data: {
          ...node.data,
          status: 'ready'
        }
      }));
      
      setNodes(readyNodes);
      
      toast({ 
        title: "Error executing workflow", 
        description: error.message || "Please try again",
        variant: "destructive" 
      });
    }
  };

  const handleTemplateSelect = async (template: any) => {
    try {
      if (workflowId) {
        await updateWorkflow.mutateAsync({ 
          id: workflowId, 
          data: { 
            nodes: template.nodes, 
            edges: template.edges 
          } 
        });
      } else {
        const newWorkflow = await createWorkflow.mutateAsync({
          name: template.name,
          nodes: template.nodes,
          edges: template.edges,
          settings: { template: template.id }
        });
        window.history.pushState({}, "", `/workflow/${newWorkflow.id}`);
      }
      
      setNodes(template.nodes);
      setEdges(template.edges);
      setWorkflowName(template.name);
      
      toast({ 
        title: "Template applied successfully",
        description: `${template.name} template has been loaded.`
      });
    } catch (error) {
      toast({ 
        title: "Error applying template", 
        description: "Please try again",
        variant: "destructive" 
      });
    }
  };

  const handleVideoAnalysis = (analysis: any) => {
    toast({
      title: "Video analysis complete",
      description: `Found ${analysis.scenes?.length || 0} scenes, ${analysis.objects?.length || 0} objects. Ready to generate optimized workflow.`
    });
    
    setVideoUploadOpen(false);
  };

  if (isLoading) {
    return (
      <div className="h-screen flex items-center justify-center bg-background dark:bg-slate-900">
        <div className="text-center">
          <div className="w-8 h-8 border-4 border-google-blue border-t-transparent rounded-full animate-spin mx-auto mb-4"></div>
          <p className="text-foreground dark:text-slate-200">Loading workflow...</p>
        </div>
      </div>
    );
  }

  return (
    <div className="h-screen flex flex-col bg-background dark:bg-slate-900 font-google-sans">
      {/* Top Toolbar */}
      <header className="bg-card dark:bg-slate-800 border-b border-border dark:border-slate-700 px-6 py-4 flex items-center justify-between shadow-sm">
        <div className="flex items-center space-x-6">
          <div className="flex items-center space-x-3">
            <div className="w-10 h-10 bg-google-blue rounded-google flex items-center justify-center shadow-lg">
              <MdVideoLibrary className="w-5 h-5 text-white" />
            </div>
            <div>
              <h1 className="text-xl font-google-sans font-medium text-foreground dark:text-slate-200 tracking-tight">AI Video Editor</h1>
              <p className="text-xs text-muted-foreground dark:text-slate-400 font-roboto">Powered by Gemini AI</p>
            </div>
          </div>
          <Separator orientation="vertical" className="h-8" />
          <div className="flex items-center space-x-16">
            <Button 
              size="sm" 
              onClick={() => setVideoUploadOpen(true)}
              className="bg-google-blue hover:bg-blue-600 text-white shadow-lg font-google-sans font-medium rounded-google"
            >
              <MdCloudUpload className="w-4 h-4 mr-2" />
              Upload Video
            </Button>
            <TemplateGallery onSelectTemplate={handleTemplateSelect} />
            <Button size="sm" variant="outline" className="border-border dark:border-slate-600 hover:bg-secondary dark:hover:bg-slate-700 font-google-sans font-medium rounded-google">
              <MdFolder className="w-4 h-4 mr-2" />
              Open
            </Button>
          </div>
        </div>
        
        <div className="flex items-center space-x-4">
          <div className="flex items-center space-x-3">
            <Button 
              onClick={() => setChatSidebarOpen(!chatSidebarOpen)}
              className="bg-gemini-green hover:bg-green-600 text-white shadow-lg font-google-sans font-medium rounded-google"
            >
              <MdSmartToy className="w-4 h-4 mr-2" />
              AI Assistant
            </Button>
            <Button 
              onClick={() => setCollaborationOpen(!collaborationOpen)}
              variant="outline"
              className="border-border dark:border-slate-600 hover:bg-secondary dark:hover:bg-slate-700 font-google-sans font-medium rounded-google"
            >
              <MdPeople className="w-4 h-4 mr-2" />
              Collaborate
            </Button>
            <Button 
              size="sm" 
              variant="outline"
              onClick={() => setSettingsOpen(true)}
              className="border-border dark:border-slate-600 hover:bg-secondary dark:hover:bg-slate-700 rounded-google"
            >
              <MdSettings className="w-4 h-4 mr-1" />
              Settings
            </Button>
            <Button size="sm" variant="outline" className="border-border dark:border-slate-600 hover:bg-secondary dark:hover:bg-slate-700 rounded-google">
              <MdHelp className="w-4 h-4 mr-1" />
              Help
            </Button>
          </div>
          <Separator orientation="vertical" className="h-8" />
          <div className="flex items-center space-x-16">
            <div className="w-9 h-9 bg-gradient-to-r from-google-blue to-gemini-green rounded-full flex items-center justify-center shadow-lg">
              <span className="text-white text-sm font-google-sans font-medium">JD</span>
            </div>
          </div>
        </div>
      </header>

      {/* Main Workspace */}
      <div className="flex-1 flex">
        {/* Tile Library */}
        <TileLibrary />

        {/* Canvas Workspace */}
        <div className="flex-1 flex flex-col">
          {/* Canvas Controls */}
          <div className="bg-white border-b border-gray-200 px-6 py-4 flex items-center justify-between shadow-sm">
            <div className="flex items-center space-x-6">
              <h2 className="font-medium text-google-text text-lg tracking-tight">Workflow Canvas</h2>
              <div className="flex items-center space-x-3 text-sm text-gray-600">
                <span className="font-medium">Project:</span>
                <input
                  type="text"
                  value={workflowName || ""}
                  onChange={(e) => setWorkflowName(e.target.value)}
                  className="font-medium text-google-text bg-transparent border-none outline-none min-w-[150px] focus:bg-gray-50 px-2 py-1 rounded transition-colors"
                  onBlur={handleSaveWorkflow}
                  placeholder="Enter project name"
                />
              </div>
            </div>
            <div className="flex items-center space-x-4">
              <div className="flex items-center space-x-2 text-sm text-gray-500">
                <span>Zoom: 100%</span>
              </div>
              <Separator orientation="vertical" className="h-6" />
              <Button
                onClick={handleSaveWorkflow}
                disabled={updateWorkflow.isPending}
                variant="outline"
                className="border-google-blue text-google-blue hover:bg-google-blue/5 shadow-sm font-medium px-4"
              >
                <MdSave className="w-4 h-4 mr-2" />
                {updateWorkflow.isPending ? "Saving..." : "Save"}
              </Button>
              <Button
                onClick={handleExecuteWorkflow}
                disabled={executeWorkflow.isPending}
                className="bg-gemini-green hover:bg-green-600 text-white shadow-sm font-medium px-6"
              >
                <MdPlayArrow className="w-4 h-4 mr-2" />
                {executeWorkflow.isPending ? "Running..." : "Run Workflow"}
              </Button>
            </div>
          </div>

          {/* Main Canvas */}
          <WorkflowCanvas
            nodes={nodes}
            edges={edges}
            onNodesChange={setNodes}
            onEdgesChange={setEdges}
            onSave={handleSaveWorkflow}
          />
        </div>

        {/* Chat Sidebar */}
        {chatSidebarOpen && workflowId && (
          <ChatSidebar 
            workflowId={workflowId}
            onClose={() => setChatSidebarOpen(false)}
          />
        )}

        {/* Collaboration Panel */}
        {collaborationOpen && workflowId && (
          <CollaborationPanel 
            workflowId={workflowId}
            isOpen={collaborationOpen}
            onClose={() => setCollaborationOpen(false)}
          />
        )}
      </div>

      {/* Modals */}
      <SettingsPopup 
        open={settingsOpen}
        onOpenChange={setSettingsOpen}
      />

      {videoUploadOpen && (
        <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50 p-4">
          <div className="relative">
            <Button
              onClick={() => setVideoUploadOpen(false)}
              variant="ghost"
              size="sm"
              className="absolute -top-12 -right-4 text-white hover:text-gray-300"
            >
              <span className="sr-only">Close</span>
              ×
            </Button>
            <VideoUpload onAnalysisComplete={handleVideoAnalysis} />
          </div>
        </div>
      )}
    </div>
  );
}
