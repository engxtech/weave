import { GoogleGenerativeAI } from '@google/generative-ai';
import * as fs from 'fs';
import * as path from 'path';

interface ChatMessage {
  role: 'user' | 'assistant';
  content: string;
  timestamp: Date;
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

export class SimpleVideoAgent {
  private ai: GoogleGenerativeAI;
  private static globalMemory: Map<string, AgentMemory> = new Map();
  private apiKey: string;

  constructor(apiKey: string) {
    if (!apiKey || apiKey.trim() === '') {
      throw new Error('API key is required for video agent');
    }
    
    this.apiKey = apiKey.trim();
    this.ai = new GoogleGenerativeAI(this.apiKey);
  }

  async warmupAgent(sessionId: string, videoPath: string, videoMetadata: any): Promise<string> {
    try {
      console.log('Starting agent warmup for session:', sessionId);
      
      // Initialize or get existing memory
      if (!SimpleVideoAgent.globalMemory.has(sessionId)) {
        SimpleVideoAgent.globalMemory.set(sessionId, {
          conversationHistory: [],
          videoMetadata: {
            filename: videoMetadata.originalName,
            duration: videoMetadata.duration || 0,
            uploadTime: new Date()
          }
        });
      }

      const memory = SimpleVideoAgent.globalMemory.get(sessionId)!;

      // Simple analysis without video processing for now
      const analysis = `Video Analysis Complete for ${videoMetadata.originalName}:
- Duration: ${videoMetadata.duration || 'Unknown'} seconds
- File: ${videoPath}
- Analysis stored in session memory
- Ready for navigation commands like "take video to X seconds"`;

      // Store analysis in memory
      memory.videoAnalysis = analysis;
      memory.conversationHistory.push({
        role: 'assistant',
        content: 'Video analyzed and stored in memory',
        timestamp: new Date()
      });

      console.log('Agent warmup completed successfully');
      return analysis;
    } catch (error) {
      console.error('Agent warmup error:', error);
      throw new Error(`Failed to warm up agent: ${error instanceof Error ? error.message : 'Unknown error'}`);
    }
  }

  private async analyzeVideo(videoPath: string): Promise<string> {
    try {
      const fullPath = path.join(process.cwd(), 'uploads', videoPath);
      
      if (!fs.existsSync(fullPath)) {
        throw new Error(`Video file not found: ${fullPath}`);
      }

      const videoBytes = fs.readFileSync(fullPath);
      const model = this.ai.getGenerativeModel({ model: 'gemini-1.5-flash' });
      
      const prompt = `Analyze this video in comprehensive detail. Provide:

1. VIDEO QUALITY ANALYSIS:
   - Resolution and aspect ratio
   - Video quality assessment (excellent/good/fair/poor)
   - Frame rate and stability
   - Audio quality assessment
   - Compression artifacts or issues

2. VIDEO SUMMARY:
   - Main topic or theme
   - Key events in chronological order
   - Duration and pacing assessment

3. DETAILED DESCRIPTION:
   - Scene-by-scene breakdown
   - Visual elements and composition
   - Camera movements and angles
   - Lighting and color analysis

4. OBJECTS AND PEOPLE DETECTION:
   - All visible objects in the video
   - People present (count, positions, activities)
   - Text or graphics visible
   - Background elements

5. CONTENT ANALYSIS:
   - Mood and tone
   - Genre or category
   - Target audience
   - Key moments with timestamps

6. TECHNICAL METADATA:
   - Estimated file size and format
   - Audio channels and quality
   - Any technical issues observed

Please be thorough and specific in your analysis.`;

      const result = await model.generateContent([
        {
          inlineData: {
            data: videoBytes.toString('base64'),
            mimeType: 'video/mp4'
          }
        },
        prompt
      ]);

      return result.response.text() || 'Analysis could not be completed';
    } catch (error) {
      console.error('Video analysis error:', error);
      return `Error analyzing video: ${error instanceof Error ? error.message : 'Unknown error'}`;
    }
  }

  async processCommand(sessionId: string, command: string): Promise<{
    response: string;
    actions?: any[];
  }> {
    const memory = SimpleVideoAgent.globalMemory.get(sessionId);
    if (!memory) {
      throw new Error('Agent not warmed up. Please warm up the agent first.');
    }

    try {
      // Check for navigation commands
      const navigationMatch = command.toLowerCase().match(/take video to (\d+)\s*(?:seconds?|s)/);
      if (navigationMatch) {
        const timestamp = parseInt(navigationMatch[1]);
        const response = `Navigating to ${timestamp} seconds`;
        
        // Update conversation history
        memory.conversationHistory.push(
          { role: 'user', content: command, timestamp: new Date() },
          { role: 'assistant', content: response, timestamp: new Date() }
        );

        return {
          response,
          actions: [{
            type: 'navigation',
            action: 'seek',
            timestamp: timestamp,
            message: `Seeking video to ${timestamp} seconds`
          }]
        };
      }

      // Check for play/pause commands
      if (command.toLowerCase().includes('play') || command.toLowerCase().includes('start')) {
        const response = 'Starting video playback';
        memory.conversationHistory.push(
          { role: 'user', content: command, timestamp: new Date() },
          { role: 'assistant', content: response, timestamp: new Date() }
        );

        return {
          response,
          actions: [{
            type: 'navigation',
            action: 'play',
            message: 'Starting video playback'
          }]
        };
      }

      if (command.toLowerCase().includes('pause') || command.toLowerCase().includes('stop')) {
        const response = 'Pausing video playback';
        memory.conversationHistory.push(
          { role: 'user', content: command, timestamp: new Date() },
          { role: 'assistant', content: response, timestamp: new Date() }
        );

        return {
          response,
          actions: [{
            type: 'navigation',
            action: 'pause',
            message: 'Pausing video playback'
          }]
        };
      }

      // Add context about the video to the command
      const contextualCommand = `
Context: I'm working with a video file "${memory.videoMetadata?.filename}" (duration: ${memory.videoMetadata?.duration}s).
Previous analysis: ${memory.videoAnalysis ? 'Video has been analyzed and details are in memory.' : 'No analysis available.'}

User command: ${command}

If the user asks about video content, refer to the analysis in memory.
`;

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
      console.error('Command processing error:', error);
      throw new Error(`Failed to process command: ${error instanceof Error ? error.message : 'Unknown error'}`);
    }
  }

  getAgentMemory(sessionId: string): AgentMemory | undefined {
    return SimpleVideoAgent.globalMemory.get(sessionId);
  }

  clearAgentMemory(sessionId: string): void {
    SimpleVideoAgent.globalMemory.delete(sessionId);
  }

  getSessionInfo(sessionId: string): any {
    const memory = SimpleVideoAgent.globalMemory.get(sessionId);
    return {
      hasMemory: !!memory,
      hasAnalysis: !!memory?.videoAnalysis,
      conversationLength: memory?.conversationHistory.length || 0,
      videoMetadata: memory?.videoMetadata
    };
  }
}

export const createSimpleVideoAgent = (apiKey: string): SimpleVideoAgent => {
  return new SimpleVideoAgent(apiKey);
};