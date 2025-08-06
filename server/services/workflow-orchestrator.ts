import { ShortsExtractorService } from './shorts-extractor-service';
import { VoiceProcessorService } from './voice-processor-service';
import { CaptionGeneratorService } from './caption-generator-service';
import { EnhancementService } from './enhancement-service';
import { AudioEnhancementService } from './audio-enhancement-service';
import { EyeContactService } from './eye-contact-service';
import { ReframeService } from './reframe-service';
import { CutService } from './cut-service';
import { BackgroundService } from './background-service';
import { BRollService } from './broll-service';
import { MusicService } from './music-service';
import path from 'path';
import fs from 'fs/promises';

export interface WorkflowNode {
  id: string;
  type: string;
  config: any;
  inputs?: string[];
  outputs?: string[];
}

export interface WorkflowExecution {
  id: string;
  nodes: WorkflowNode[];
  connections: Array<{
    source: string;
    target: string;
    sourceOutput?: string;
    targetInput?: string;
  }>;
  results: Record<string, any>;
}

export class WorkflowOrchestrator {
  private shortsExtractor: ShortsExtractorService;
  private voiceProcessor: VoiceProcessorService;
  private captionGenerator: CaptionGeneratorService;
  private enhancementService: EnhancementService;
  private audioEnhancement: AudioEnhancementService;
  private eyeContactService: EyeContactService;
  private reframeService: ReframeService;
  private cutService: CutService;
  private backgroundService: BackgroundService;
  private bRollService: BRollService;
  private musicService: MusicService;

  constructor() {
    this.shortsExtractor = new ShortsExtractorService(process.env.GEMINI_API_KEY || '');
    this.voiceProcessor = new VoiceProcessorService();
    this.captionGenerator = new CaptionGeneratorService();
    this.enhancementService = new EnhancementService();
    this.audioEnhancement = new AudioEnhancementService(process.env.GEMINI_API_KEY || '');
    this.eyeContactService = new EyeContactService();
    this.reframeService = new ReframeService();
    this.cutService = new CutService();
    this.backgroundService = new BackgroundService();
    this.bRollService = new BRollService();
    this.musicService = new MusicService();
  }

  async executeWorkflow(workflow: WorkflowExecution): Promise<WorkflowExecution> {
    console.log('🚀 Starting workflow execution:', workflow.id);
    
    // Build execution plan with parallel groups
    const executionPlan = this.buildParallelExecutionPlan(workflow);
    
    // Execute nodes according to plan (sequential groups, parallel within groups)
    for (const group of executionPlan) {
      if (group.length === 1) {
        // Single node - execute sequentially
        const nodeId = group[0];
        const node = workflow.nodes.find(n => n.id === nodeId);
        if (!node) continue;
        
        console.log(`\n📊 Executing node: ${node.type} (${node.id})`);
        
        try {
          const inputVideos = await this.getNodeInputs(node, workflow);
          const result = await this.executeNode(node, inputVideos);
          workflow.results[node.id] = result;
          console.log(`✅ Node ${node.id} completed successfully`);
        } catch (error) {
          console.error(`❌ Node ${node.id} failed:`, error);
          workflow.results[node.id] = {
            success: false,
            error: error instanceof Error ? error.message : 'Unknown error'
          };
        }
      } else {
        // Multiple nodes - execute in parallel
        console.log(`\n🔄 Executing ${group.length} nodes in parallel: ${group.join(', ')}`);
        
        const parallelExecutions = group.map(async nodeId => {
          const node = workflow.nodes.find(n => n.id === nodeId);
          if (!node) return;
          
          try {
            const inputVideos = await this.getNodeInputs(node, workflow);
            const result = await this.executeNode(node, inputVideos);
            workflow.results[node.id] = result;
            console.log(`✅ Node ${node.id} completed successfully`);
          } catch (error) {
            console.error(`❌ Node ${node.id} failed:`, error);
            workflow.results[node.id] = {
              success: false,
              error: error instanceof Error ? error.message : 'Unknown error'
            };
          }
        });
        
        await Promise.all(parallelExecutions);
        console.log(`✅ Parallel group completed`);
      }
    }
    
    console.log('\n🎉 Workflow execution completed!');
    return workflow;
  }

  private buildParallelExecutionPlan(workflow: WorkflowExecution): string[][] {
    const executed = new Set<string>();
    const plan: string[][] = [];
    
    // Build dependency map
    const dependencies = new Map<string, Set<string>>();
    const dependents = new Map<string, Set<string>>();
    
    workflow.nodes.forEach(node => {
      dependencies.set(node.id, new Set());
      dependents.set(node.id, new Set());
    });
    
    workflow.connections.forEach(conn => {
      dependencies.get(conn.target)?.add(conn.source);
      dependents.get(conn.source)?.add(conn.target);
    });
    
    // Process nodes in levels
    while (executed.size < workflow.nodes.length) {
      const availableNodes: string[] = [];
      
      // Find all nodes whose dependencies have been executed
      workflow.nodes.forEach(node => {
        if (!executed.has(node.id)) {
          const nodeDeps = dependencies.get(node.id) || new Set();
          const allDepsExecuted = Array.from(nodeDeps).every(dep => executed.has(dep));
          
          if (allDepsExecuted) {
            availableNodes.push(node.id);
          }
        }
      });
      
      if (availableNodes.length === 0) {
        // Handle disconnected nodes
        const disconnected = workflow.nodes
          .filter(n => !executed.has(n.id))
          .map(n => n.id);
        if (disconnected.length > 0) {
          plan.push(disconnected);
          disconnected.forEach(id => executed.add(id));
        }
        break;
      }
      
      // Group nodes that can run in parallel
      const parallelGroups = new Map<string, string[]>();
      
      availableNodes.forEach(nodeId => {
        const nodeDeps = Array.from(dependencies.get(nodeId) || []);
        
        if (nodeDeps.length === 0) {
          // No dependencies - can run independently
          if (!parallelGroups.has('_independent')) {
            parallelGroups.set('_independent', []);
          }
          parallelGroups.get('_independent')!.push(nodeId);
        } else {
          // Group by common parent
          const parent = nodeDeps[0]; // Primary parent
          const siblings = Array.from(dependents.get(parent) || [])
            .filter(sibling => availableNodes.includes(sibling));
          
          if (siblings.length > 1) {
            // Multiple nodes from same parent - run in parallel
            const groupKey = siblings.sort().join('|');
            if (!parallelGroups.has(groupKey)) {
              parallelGroups.set(groupKey, siblings);
            }
          } else {
            // Single node - run sequentially
            parallelGroups.set(nodeId, [nodeId]);
          }
        }
      });
      
      // Add groups to plan and mark as executed
      parallelGroups.forEach(group => {
        plan.push(group);
        group.forEach(id => executed.add(id));
      });
    }
    
    return plan;
  }

  private buildExecutionOrder(workflow: WorkflowExecution): string[] {
    const visited = new Set<string>();
    const order: string[] = [];
    
    // Find nodes with no incoming connections (start nodes)
    const startNodes = workflow.nodes.filter(node => 
      !workflow.connections.some(conn => conn.target === node.id)
    );
    
    // Topological sort using depth-first traversal
    const visit = (nodeId: string) => {
      if (visited.has(nodeId)) return;
      visited.add(nodeId);
      
      // Add current node to order first (pre-order for topological sort)
      order.push(nodeId);
      
      // Then visit connected nodes
      const connectedNodes = workflow.connections
        .filter(conn => conn.source === nodeId)
        .map(conn => conn.target);
      
      connectedNodes.forEach(visit);
    };
    
    // Start from all start nodes
    startNodes.forEach(node => visit(node.id));
    
    // Add any unvisited nodes (disconnected)
    workflow.nodes.forEach(node => {
      if (!visited.has(node.id)) {
        order.push(node.id);
      }
    });
    
    return order;
  }

  private async getNodeInputs(
    node: WorkflowNode, 
    workflow: WorkflowExecution
  ): Promise<string[]> {
    const inputs: string[] = [];
    
    // Find incoming connections
    const incomingConnections = workflow.connections.filter(
      conn => conn.target === node.id
    );
    
    for (const conn of incomingConnections) {
      const sourceResult = workflow.results[conn.source];
      if (sourceResult) {
        // Extract video path(s) from source result
        if (sourceResult.outputPath) {
          inputs.push(sourceResult.outputPath);
        }
        if (sourceResult.generatedClips) {
          sourceResult.generatedClips.forEach((clip: any) => {
            if (clip.clipPath) inputs.push(clip.clipPath);
          });
        }
        if (sourceResult.parallelOutputs) {
          Object.values(sourceResult.parallelOutputs).forEach((outputs: any) => {
            if (Array.isArray(outputs)) {
              outputs.forEach((output: any) => {
                if (output.clipPath) inputs.push(output.clipPath);
              });
            }
          });
        }
      }
    }
    
    // Use configured video path if no inputs
    if (inputs.length === 0 && node.config.videoPath) {
      inputs.push(node.config.videoPath);
    }
    
    return inputs;
  }

  private normalizeVideoPath(path: string): string {
    if (!path) return path;
    
    // Convert API paths to file system paths
    if (path.startsWith('/api/upload/video/')) {
      return path.replace('/api/upload/video/', 'uploads/');
    }
    if (path.startsWith('/api/upload/')) {
      return path.replace('/api/upload/', 'uploads/');
    }
    
    return path;
  }

  private async executeNode(
    node: WorkflowNode, 
    inputVideos: string[]
  ): Promise<any> {
    const config = node.config || {};
    
    // Use first input video as primary input and normalize the path
    const primaryInput = this.normalizeVideoPath(inputVideos[0] || config.videoPath);
    
    switch (node.type) {
      case 'start':
        return {
          success: true,
          outputPath: this.normalizeVideoPath(config.videoPath),
          message: 'Video input ready'
        };

      case 'shorts':
        if (!primaryInput) {
          throw new Error('No video input provided for shorts extraction. Please upload a video to the Start node first.');
        }
        const shortsResult = await this.shortsExtractor.extractViralMoments(
          primaryInput,
          config.searchPhrases?.split(',').map((p: string) => p.trim()) || [],
          config.extractionDescription || '',
          config.duration || 30,
          config.aiModel
        );
        
        // Generate actual clips - only generate one clip
        let generatedClips: any[] = [];
        if (shortsResult.moments.length > 0) {
          // Take only the highest scoring moment
          const bestMoment = [shortsResult.moments[0]];
          generatedClips = await this.shortsExtractor.generateShortClips(
            primaryInput, 
            bestMoment,
            config.duration || 30
          );
        }
        
        return {
          ...shortsResult,
          generatedClips,
          outputPath: generatedClips.length > 0 ? `/api/upload/video/shorts/${path.basename(generatedClips[0])}` : primaryInput,
          success: true
        };

      case 'voice':
        if (!primaryInput) {
          throw new Error('No video input provided for voice processing. Connect a video source to this node.');
        }
        return await this.voiceProcessor.processVoice(primaryInput, config);

      case 'audio_enhance':
        if (!primaryInput) {
          throw new Error('No video input provided for audio enhancement. Connect a video source to this node.');
        }
        const audioResult = await this.audioEnhancement.enhanceAudio(
          primaryInput,
          config.processingBackend || 'Auphonic',
          config.enhancementType || 'Enhance & Denoise',
          config.enhancementSteps || 64
        );
        return {
          ...audioResult,
          success: true
        };

      case 'enhancement':
        if (!primaryInput) {
          throw new Error('No video input provided for video enhancement. Connect a video source to this node.');
        }
        return await this.enhancementService.enhanceVideo(primaryInput, config);

      case 'captions':
        if (!primaryInput) {
          throw new Error('No video input provided for caption generation. Connect a video source to this node.');
        }
        return await this.captionGenerator.generateCaptions(primaryInput, config);

      case 'eye_contact':
        if (!primaryInput) {
          throw new Error('No video input provided for eye contact processing. Connect a video source to this node.');
        }
        const eyeContactResult = await this.eyeContactService.processEyeContact(primaryInput, config);
        return {
          ...eyeContactResult,
          success: true
        };

      case 'reframe':
        if (!primaryInput) {
          throw new Error('No video input provided for reframing. Connect a video source to this node.');
        }
        const reframeResult = await this.reframeService.processReframe(primaryInput, config);
        return {
          ...reframeResult,
          success: true
        };

      case 'cut':
        if (!primaryInput) {
          throw new Error('No video input provided for content cutting. Connect a video source to this node.');
        }
        const cutResult = await this.cutService.processCut(primaryInput, config);
        return {
          ...cutResult,
          success: true
        };

      case 'background':
        if (!primaryInput) {
          throw new Error('No video input provided for background processing. Connect a video source to this node.');
        }
        const backgroundResult = await this.backgroundService.processBackground(primaryInput, config);
        return {
          ...backgroundResult,
          success: true
        };

      case 'broll':
        if (!primaryInput) {
          throw new Error('No video input provided for B-roll generation. Connect a video source to this node.');
        }
        const brollResult = await this.bRollService.processBRoll(primaryInput, config);
        return {
          ...brollResult,
          success: true
        };

      case 'music':
        if (!primaryInput) {
          throw new Error('No video input provided for music generation. Connect a video source to this node.');
        }
        const musicResult = await this.musicService.processMusic(primaryInput, config);
        return {
          ...musicResult,
          success: true
        };

      default:
        throw new Error(`Unknown node type: ${node.type}`);
    }
  }

  async generateWorkflowPreview(workflow: WorkflowExecution): Promise<{
    thumbnails: Record<string, string>;
    metadata: Record<string, any>;
  }> {
    const thumbnails: Record<string, string> = {};
    const metadata: Record<string, any> = {};
    
    for (const [nodeId, result] of Object.entries(workflow.results)) {
      if (result.outputPath && await this.isVideoFile(result.outputPath)) {
        // Generate thumbnail
        const thumbnailPath = await this.generateThumbnail(result.outputPath);
        thumbnails[nodeId] = thumbnailPath;
        
        // Get video metadata
        metadata[nodeId] = await this.getVideoMetadata(result.outputPath);
      }
    }
    
    return { thumbnails, metadata };
  }

  private async isVideoFile(filePath: string): Promise<boolean> {
    try {
      await fs.access(filePath);
      const ext = path.extname(filePath).toLowerCase();
      return ['.mp4', '.mov', '.avi', '.webm', '.mkv'].includes(ext);
    } catch {
      return false;
    }
  }

  private async generateThumbnail(videoPath: string): Promise<string> {
    // Placeholder - would use FFmpeg to extract frame
    return videoPath + '_thumb.jpg';
  }

  private async getVideoMetadata(videoPath: string): Promise<any> {
    // Placeholder - would use FFmpeg to get metadata
    return {
      duration: 0,
      width: 1920,
      height: 1080,
      fps: 30
    };
  }
}