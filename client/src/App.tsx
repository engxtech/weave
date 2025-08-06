import React, { useEffect } from "react";
import { Switch, Route } from "wouter";
import { queryClient } from "./lib/queryClient";
import { QueryClientProvider } from "@tanstack/react-query";
import { Toaster } from "@/components/ui/toaster";
import { TooltipProvider } from "@/components/ui/tooltip";
import { ThemeProvider } from "@/contexts/theme-context";
import { ErrorBoundary } from "@/components/error-boundary";

import WorkflowEditor from "@/pages/workflow-editor";
import NotFound from "@/pages/not-found";
import Home from "@/pages/home";
import Landing from "@/pages/Landing";
import TimelineEditorPage from "@/pages/timeline-editor-page";
import TimelineEditorRedesigned from "@/pages/timeline-editor-redesigned";
import AIShortsPage from "@/pages/ai-shorts-page";
import { AudioLevelingInterface } from "@/components/audio-leveling-interface";
import IntelligentCropper from "@/components/intelligent-cropper";
import { ComprehensiveShortsTester } from "@/components/comprehensive-shorts-tester";
import IntelligentReframing from "@/components/intelligent-reframing";
import CompleteAutoFlipPage from "@/pages/complete-autoflip";
import ClientSideAutoFlipPage from "@/pages/client-side-autoflip";
import AccountDashboard from "@/pages/AccountDashboard";
import { RevideoPage } from "@/pages/RevideoPage";
import { LiveRevideoPage } from "@/pages/LiveRevideoPage";
import UnifiedVideoEditor from "@/pages/UnifiedVideoEditor";
import SplitScreenGenerator from "@/pages/SplitScreenGenerator";
import AIShortGenerator from "@/pages/ai-shorts-generator";
import ViralTrendPredictor from "@/pages/ViralTrendPredictor";
import NodeVideoEditor from "@/pages/NodeVideoEditor";
import { VisualRemix } from "@/pages/VisualRemix";
import { VisualRemixSimple } from "@/pages/VisualRemixSimple";

function Router() {
  return (
    <Switch>
      <Route path="/workflow/:id" component={WorkflowEditor} />
      <Route path="/timeline-editor" component={TimelineEditorPage} />
      <Route path="/timeline-editor-new" component={TimelineEditorRedesigned} />
      <Route path="/ai-video-editor" component={TimelineEditorRedesigned} />
      <Route path="/audio-leveling" component={AudioLevelingInterface} />
      <Route path="/ai-shorts" component={AIShortsPage} />
      <Route path="/intelligent-crop" component={IntelligentCropper} />
      <Route path="/comprehensive-shorts" component={ComprehensiveShortsTester} />
      <Route path="/intelligent-reframe" component={IntelligentReframing} />
      <Route path="/complete-autoflip" component={CompleteAutoFlipPage} />
      <Route path="/client-side-autoflip" component={ClientSideAutoFlipPage} />
      <Route path="/revideo" component={RevideoPage} />
      <Route path="/live-revideo" component={LiveRevideoPage} />
      <Route path="/unified-editor" component={UnifiedVideoEditor} />
      <Route path="/split-screen" component={SplitScreenGenerator} />
      <Route path="/ai-shorts-generator" component={AIShortGenerator} />
      <Route path="/viral-trend-predictor" component={ViralTrendPredictor} />
      <Route path="/node-video-editor" component={NodeVideoEditor} />
      <Route path="/visual-remix" component={VisualRemix} />
      <Route path="/visual-remix-simple" component={VisualRemixSimple} />
      <Route path="/account" component={AccountDashboard} />
      <Route path="/" component={Home} />
      <Route component={NotFound} />
    </Switch>
  );
}

function App() {
  useEffect(() => {
    // Global error handler for unhandled promise rejections
    const handleUnhandledRejection = (event: PromiseRejectionEvent) => {
      console.warn('Unhandled promise rejection:', event.reason);
      // Prevent default browser behavior (like showing error in console)
      event.preventDefault();
    };

    // Global error handler for unhandled errors
    const handleError = (event: ErrorEvent) => {
      console.warn('Unhandled error:', event.error);
    };

    window.addEventListener('unhandledrejection', handleUnhandledRejection);
    window.addEventListener('error', handleError);

    return () => {
      window.removeEventListener('unhandledrejection', handleUnhandledRejection);
      window.removeEventListener('error', handleError);
    };
  }, []);

  return (
    <ErrorBoundary>
      <ThemeProvider>
        <QueryClientProvider client={queryClient}>
          <TooltipProvider>
            <Toaster />
            <Router />
          </TooltipProvider>
        </QueryClientProvider>
      </ThemeProvider>
    </ErrorBoundary>
  );
}

export default App;
