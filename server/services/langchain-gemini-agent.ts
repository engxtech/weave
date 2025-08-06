import { GoogleGenerativeAI } from '@google/generative-ai';
import { Tool } from '@langchain/core/tools';
import { z } from 'zod';
import * as fs from 'fs';
import * as path from 'path';

// Video Navigation Tool
export class VideoNavigationTool extends Tool {
  name = 'navigate_video';
  description = 'Navigate video to specific timestamp and control playback';
  
  schema = z.object({
    action: z.enum(['seek', 'play', 'pause']).describe('Navigation action to perform'),
    timestamp: z.number().optional().describe('Time in seconds to seek to'),
  });

  async _call(input: z.infer<typeof this.schema>): Promise<string> {
    if (input.action === 'seek' && input.timestamp !== undefined) {
      return JSON.stringify({
        type: 'navigation',
        action: 'seek',
        timestamp: input.timestamp,
        message: `Seeking video to ${input.timestamp} seconds`
      });
    } else if (input.action === 'play') {
      return JSON.stringify({
        type: 'navigation',
        action: 'play',
        message: 'Starting video playback'
      });
    } else if (input.action === 'pause') {
      return JSON.stringify({
        type: 'navigation',
        action: 'pause',
        message: 'Pausing video playback'
      });
    }
    
    return 'Invalid navigation command';
  }
}

// Video Analysis Tool
export class VideoAnalysisTool extends Tool {
  name = 'analyze_video';
  description = 'Analyze video content including quality, summary, objects, and detailed description';
  
  schema = z.object({
    videoPath: z.string().describe('Path to the video file'),
  });

  private ai: GoogleGenerativeAI;

  constructor(apiKey: string) {
    super();
    this.ai = new GoogleGenerativeAI(apiKey);
  }

  async _call(input: z.infer<typeof this.schema>): Promise<string> {
    try {
      // Handle both full paths and just filenames
      let videoPath = input.videoPath;
      if (!videoPath.startsWith('/') && !videoPath.includes(process.cwd())) {
        if (!videoPath.startsWith('uploads/')) {
          videoPath = path.join(process.cwd(), 'uploads', videoPath);
        } else {
          videoPath = path.join(process.cwd(), videoPath);
        }
      }
      
      console.log('Analyzing video at path:', videoPath);
      
      if (!fs.existsSync(videoPath)) {
        console.error('Video file not found at:', videoPath);
        return `Video file not found: ${input.videoPath}`;
      }

      const videoBytes = fs.readFileSync(videoPath);
      const model = this.ai.getGenerativeModel({ model: 'gemini-1.5-flash' });
      
      const prompt = `Analyze this video comprehensively:

1. VIDEO QUALITY ANALYSIS:
   - Resolution and aspect ratio
   - Video quality assessment
   - Frame rate and stability
   - Audio quality assessment

2. VIDEO SUMMARY:
   - Main topic or theme
   - Key events in chronological order
   - Duration and pacing assessment

3. DETAILED DESCRIPTION:
   - Scene-by-scene breakdown
   - Visual elements and composition
   - Camera movements and angles

4. OBJECTS AND PEOPLE DETECTION:
   - All visible objects in the video
   - People present (count, positions, activities)
   - Text or graphics visible

5. CONTENT ANALYSIS:
   - Mood and tone
   - Genre or category
   - Key moments with timestamps

Please be thorough and specific.`;

      const result = await model.generateContent([
        {
          inlineData: {
            data: videoBytes.toString('base64'),
            mimeType: 'video/mp4'
          }
        },
        prompt
      ]);

      const responseText = await result.response.text();
      console.log('Video analysis completed successfully');
      return responseText || 'Analysis could not be completed';
    } catch (error) {
      console.error('Video analysis error:', error);
      return `Error analyzing video: ${error instanceof Error ? error.message : 'Unknown error'}`;
    }
  }
}

interface ChatMessage {
  role: 'user' | 'assistant' | 'system';
  content: string;
  timestamp: Date;
  actions?: any[];
}

interface AgentMemory {
  videoAnalysis?: string;
  videoMetadata?: {
    filename: string;
    duration: number;
    uploadTime: Date;
  };
  conversationHistory: ChatMessage[];
  currentTimestamp?: number;
}

export class LangChainGeminiAgent {
  private ai: GoogleGenerativeAI;
  private tools: Map<string, Tool>;
  private static globalMemory: Map<string, AgentMemory> = new Map();
  private apiKey: string;

  constructor(apiKey: string) {
    if (!apiKey || apiKey.trim() === '') {
      throw new Error('API key is required for LangChain Gemini agent');
    }
    
    this.apiKey = apiKey.trim();
    this.ai = new GoogleGenerativeAI(this.apiKey);
    
    // Initialize tools
    this.tools = new Map();
    this.tools.set('navigate_video', new VideoNavigationTool());
    this.tools.set('analyze_video', new VideoAnalysisTool(apiKey));
  }

  async warmupAgent(sessionId: string, videoPath: string, videoMetadata: any): Promise<string> {
    try {
      console.log('Starting LangChain agent warmup for session:', sessionId);
      console.log('Received videoMetadata:', videoMetadata);
      
      // Initialize or get existing memory
      if (!LangChainGeminiAgent.globalMemory.has(sessionId)) {
        LangChainGeminiAgent.globalMemory.set(sessionId, {
          conversationHistory: [],
          videoMetadata: {
            filename: videoMetadata?.originalName || 'video.mp4',
            duration: videoMetadata?.duration || 0,
            uploadTime: new Date()
          }
        });
      }

      const memory = LangChainGeminiAgent.globalMemory.get(sessionId)!;

      // Perform comprehensive video analysis using the tool
      console.log('Performing comprehensive video analysis...');
      const analysisTool = this.tools.get('analyze_video') as VideoAnalysisTool;
      
      let analysis = 'Video analysis not available';
      try {
        analysis = await analysisTool._call({ videoPath });
        console.log('Video analysis result length:', analysis.length);
        
        // Store analysis in memory
        memory.videoAnalysis = analysis;
        console.log('Video analysis completed and stored in memory');
      } catch (error) {
        console.error('Video analysis failed:', error);
        analysis = `Error analyzing video: ${error instanceof Error ? error.message : 'Unknown error'}`;
        memory.videoAnalysis = analysis;
      }
      
      memory.conversationHistory.push({
        role: 'system',
        content: 'Video analyzed and stored in memory',
        timestamp: new Date(),
        actions: []
      });

      console.log('LangChain agent warmup completed successfully');
      return analysis;
    } catch (error) {
      console.error('LangChain agent warmup error:', error);
      throw new Error(`Failed to warm up agent: ${error instanceof Error ? error.message : 'Unknown error'}`);
    }
  }

  async processCommand(sessionId: string, command: string): Promise<{
    response: string;
    actions?: any[];
  }> {
    const memory = LangChainGeminiAgent.globalMemory.get(sessionId);
    if (!memory) {
      throw new Error('Agent not warmed up. Please warm up the agent first.');
    }

    try {
      console.log('Processing command with LangChain agent:', command);

      // Check for navigation commands first
      const navigationMatch = command.toLowerCase().match(/take video to (\d+)\s*(?:seconds?|s)/);
      if (navigationMatch) {
        const timestamp = parseInt(navigationMatch[1]);
        const navTool = this.tools.get('navigate_video') as VideoNavigationTool;
        const actionResult = await navTool._call({ action: 'seek', timestamp });
        
        const response = `Navigating to ${timestamp} seconds`;
        
        // Update conversation history
        memory.conversationHistory.push(
          { role: 'user', content: command, timestamp: new Date() },
          { role: 'assistant', content: response, timestamp: new Date(), actions: [JSON.parse(actionResult)] }
        );

        return {
          response,
          actions: [JSON.parse(actionResult)]
        };
      }

      // Check for play/pause commands
      if (command.toLowerCase().includes('play') || command.toLowerCase().includes('start')) {
        const navTool = this.tools.get('navigate_video') as VideoNavigationTool;
        const actionResult = await navTool._call({ action: 'play' });
        
        const response = 'Starting video playback';
        memory.conversationHistory.push(
          { role: 'user', content: command, timestamp: new Date() },
          { role: 'assistant', content: response, timestamp: new Date(), actions: [JSON.parse(actionResult)] }
        );

        return {
          response,
          actions: [JSON.parse(actionResult)]
        };
      }

      if (command.toLowerCase().includes('pause') || command.toLowerCase().includes('stop')) {
        const navTool = this.tools.get('navigate_video') as VideoNavigationTool;
        const actionResult = await navTool._call({ action: 'pause' });
        
        const response = 'Pausing video playback';
        memory.conversationHistory.push(
          { role: 'user', content: command, timestamp: new Date() },
          { role: 'assistant', content: response, timestamp: new Date(), actions: [JSON.parse(actionResult)] }
        );

        return {
          response,
          actions: [JSON.parse(actionResult)]
        };
      }

      // For other commands, use Gemini AI with context
      const contextualCommand = `
Context: I'm working with a video file "${memory.videoMetadata?.filename}" (duration: ${memory.videoMetadata?.duration}s).
Video analysis available: ${memory.videoAnalysis ? 'Yes, detailed analysis stored in memory' : 'No analysis available'}

User command: ${command}

If the user asks about video content, refer to the analysis in memory.
If the user wants to navigate to a specific time, respond with navigation instructions.
Respond helpfully and naturally.`;

      const model = this.ai.getGenerativeModel({ model: 'gemini-1.5-flash' });
      const result = await model.generateContent(contextualCommand);
      const response = result.response.text() || 'No response available';

      // Update conversation history
      memory.conversationHistory.push(
        { role: 'user', content: command, timestamp: new Date() },
        { role: 'assistant', content: response, timestamp: new Date() }
      );

      return {
        response,
        actions: []
      };
    } catch (error) {
      console.error('LangChain command processing error:', error);
      throw new Error(`Failed to process command: ${error instanceof Error ? error.message : 'Unknown error'}`);
    }
  }

  getAgentMemory(sessionId: string): AgentMemory | undefined {
    return LangChainGeminiAgent.globalMemory.get(sessionId);
  }

  clearAgentMemory(sessionId: string): void {
    LangChainGeminiAgent.globalMemory.delete(sessionId);
  }

  getSessionInfo(sessionId: string): any {
    const memory = LangChainGeminiAgent.globalMemory.get(sessionId);
    return {
      hasMemory: !!memory,
      hasAnalysis: !!memory?.videoAnalysis,
      conversationLength: memory?.conversationHistory.length || 0,
      videoMetadata: memory?.videoMetadata,
      toolsAvailable: Array.from(this.tools.keys())
    };
  }
}

export const createLangChainGeminiAgent = (apiKey: string): LangChainGeminiAgent => {
  return new LangChainGeminiAgent(apiKey);
};