import { ChatGoogleGenerativeAI } from '@langchain/google-genai';
import { BufferMemory } from 'langchain/memory';
import { Tool } from 'langchain/tools';
import { AgentExecutor, createToolCallingAgent } from 'langchain/agents';
import { ChatPromptTemplate } from '@langchain/core/prompts';
import * as fs from 'fs';
import * as path from 'path';
import { spawn } from 'child_process';

// Video Analysis Tool
class VideoAnalysisTool extends Tool {
  name = 'video_analysis';
  description = 'Analyze video content, duration, and metadata to provide detailed insights';

  async _call(input: string): Promise<string> {
    try {
      const { videoPath } = JSON.parse(input);
      
      if (!fs.existsSync(videoPath)) {
        return 'Video file not found. Please check the video path.';
      }

      // Get video metadata using FFprobe
      const metadata = await this.getVideoMetadata(videoPath);
      
      return `Video Analysis Complete:
- Duration: ${metadata.duration} seconds
- Resolution: ${metadata.width}x${metadata.height}
- Format: ${metadata.format}
- Size: ${metadata.size} bytes
- Framerate: ${metadata.framerate} fps
- Video ready for editing operations.`;
    } catch (error) {
      return `Video analysis failed: ${error}`;
    }
  }

  private async getVideoMetadata(videoPath: string): Promise<any> {
    return new Promise((resolve, reject) => {
      const ffprobe = spawn('ffprobe', [
        '-v', 'quiet',
        '-print_format', 'json',
        '-show_format',
        '-show_streams',
        videoPath
      ]);

      let output = '';
      ffprobe.stdout.on('data', (data) => {
        output += data.toString();
      });

      ffprobe.on('close', (code) => {
        if (code === 0) {
          try {
            const metadata = JSON.parse(output);
            const videoStream = metadata.streams.find((s: any) => s.codec_type === 'video');
            
            resolve({
              duration: parseFloat(metadata.format.duration || '0'),
              width: videoStream?.width || 0,
              height: videoStream?.height || 0,
              format: metadata.format.format_name || 'unknown',
              size: parseInt(metadata.format.size || '0'),
              framerate: eval(videoStream?.r_frame_rate || '0/1')
            });
          } catch (error) {
            reject(error);
          }
        } else {
          reject(new Error(`FFprobe failed with code ${code}`));
        }
      });
    });
  }
}

// Video Editing Tool
class VideoEditingTool extends Tool {
  name = 'video_editing';
  description = 'Execute video editing operations like cutting, splitting, adding text overlays, and applying effects';

  async _call(input: string): Promise<string> {
    try {
      const operation = JSON.parse(input);
      
      switch (operation.type) {
        case 'cut_segment':
          return await this.cutVideoSegment(operation);
        case 'add_text':
          return await this.addTextOverlay(operation);
        case 'split_video':
          return await this.splitVideo(operation);
        case 'apply_filter':
          return await this.applyFilter(operation);
        default:
          return `Unknown operation type: ${operation.type}`;
      }
    } catch (error) {
      return `Video editing operation failed: ${error}`;
    }
  }

  private async cutVideoSegment(operation: any): Promise<string> {
    const { videoPath, startTime, endTime, outputPath } = operation;
    
    return new Promise((resolve, reject) => {
      const ffmpeg = spawn('ffmpeg', [
        '-i', videoPath,
        '-ss', startTime.toString(),
        '-to', endTime.toString(),
        '-c', 'copy',
        '-y',
        outputPath
      ]);

      ffmpeg.on('close', (code) => {
        if (code === 0) {
          resolve(`Video segment cut successfully from ${startTime}s to ${endTime}s`);
        } else {
          reject(new Error(`FFmpeg failed with code ${code}`));
        }
      });
    });
  }

  private async addTextOverlay(operation: any): Promise<string> {
    const { videoPath, text, startTime, duration, x, y, outputPath } = operation;
    
    return new Promise((resolve, reject) => {
      const ffmpeg = spawn('ffmpeg', [
        '-i', videoPath,
        '-vf', `drawtext=text='${text}':x=${x}:y=${y}:fontsize=24:fontcolor=white:enable='between(t,${startTime},${startTime + duration})'`,
        '-c:a', 'copy',
        '-y',
        outputPath
      ]);

      ffmpeg.on('close', (code) => {
        if (code === 0) {
          resolve(`Text overlay "${text}" added at ${startTime}s for ${duration}s`);
        } else {
          reject(new Error(`FFmpeg failed with code ${code}`));
        }
      });
    });
  }

  private async splitVideo(operation: any): Promise<string> {
    const { videoPath, splitTime } = operation;
    const dir = path.dirname(videoPath);
    const name = path.basename(videoPath, path.extname(videoPath));
    const ext = path.extname(videoPath);
    
    const part1Path = path.join(dir, `${name}_part1${ext}`);
    const part2Path = path.join(dir, `${name}_part2${ext}`);

    // Create both parts
    await this.cutVideoSegment({
      videoPath,
      startTime: 0,
      endTime: splitTime,
      outputPath: part1Path
    });

    await this.cutVideoSegment({
      videoPath,
      startTime: splitTime,
      endTime: 9999, // Large number for end
      outputPath: part2Path
    });

    return `Video split at ${splitTime}s into two parts: ${part1Path} and ${part2Path}`;
  }

  private async applyFilter(operation: any): Promise<string> {
    const { videoPath, filterType, outputPath } = operation;
    
    let filterString = '';
    switch (filterType) {
      case 'blur':
        filterString = 'boxblur=2:1';
        break;
      case 'brightness':
        filterString = 'eq=brightness=0.2';
        break;
      case 'contrast':
        filterString = 'eq=contrast=1.5';
        break;
      default:
        return `Unknown filter type: ${filterType}`;
    }

    return new Promise((resolve, reject) => {
      const ffmpeg = spawn('ffmpeg', [
        '-i', videoPath,
        '-vf', filterString,
        '-c:a', 'copy',
        '-y',
        outputPath
      ]);

      ffmpeg.on('close', (code) => {
        if (code === 0) {
          resolve(`${filterType} filter applied successfully`);
        } else {
          reject(new Error(`FFmpeg failed with code ${code}`));
        }
      });
    });
  }
}

// Video Navigation Tool
class VideoNavigationTool extends Tool {
  name = 'video_navigation';
  description = 'Navigate video playback, seek to timestamps, and control playback state';

  async _call(input: string): Promise<string> {
    try {
      const { action, timestamp } = JSON.parse(input);
      
      switch (action) {
        case 'seek':
          return `Seeking to ${timestamp} seconds in video`;
        case 'play':
          return 'Playing video';
        case 'pause':
          return 'Pausing video';
        case 'get_current_time':
          return 'Current playback time: 0 seconds'; // This would be dynamic in real implementation
        default:
          return `Unknown navigation action: ${action}`;
      }
    } catch (error) {
      return `Navigation failed: ${error}`;
    }
  }
}

// Main LangChain Video Agent Class
export class LangChainVideoAgent {
  private model: ChatGoogleGenerativeAI;
  private tools: Tool[];
  private memory: BufferMemory;
  private agent: AgentExecutor | null = null;
  private sessionId: string;
  private currentVideoPath: string | null = null;

  constructor(sessionId: string) {
    this.sessionId = sessionId;
    
    // Initialize Gemini model
    this.model = new ChatGoogleGenerativeAI({
      modelName: 'gemini-1.5-flash',
      apiKey: process.env.GEMINI_API_KEY,
      temperature: 0.3
    });

    // Initialize tools
    this.tools = [
      new VideoAnalysisTool(),
      new VideoEditingTool(),
      new VideoNavigationTool()
    ];

    // Initialize memory
    this.memory = new BufferMemory({
      returnMessages: true,
      memoryKey: 'chat_history',
      inputKey: 'input',
      outputKey: 'output'
    });

    this.initializeAgent();
  }

  private async initializeAgent() {
    const prompt = ChatPromptTemplate.fromTemplate(`
You are an expert video editing assistant powered by LangChain and Gemini AI. You help users edit videos using natural language commands.

Available tools:
- video_analysis: Analyze video content and metadata
- video_editing: Execute editing operations (cut, split, add text, apply filters)
- video_navigation: Control video playback and seeking

Current video: {current_video}
Session ID: {session_id}

Chat History:
{chat_history}

User Message: {input}

Respond with helpful video editing assistance. For editing operations, use the appropriate tools and provide clear feedback about what was accomplished.

{agent_scratchpad}
    `);

    this.agent = await createToolCallingAgent({
      llm: this.model,
      tools: this.tools,
      prompt
    });
  }

  async warmupWithVideo(videoPath: string): Promise<string> {
    this.currentVideoPath = videoPath;
    
    // Analyze the video to warm up the agent
    const analysisResult = await this.tools[0]._call(JSON.stringify({ videoPath }));
    
    // Store analysis in memory
    await this.memory.saveContext(
      { input: 'Analyze uploaded video' },
      { output: analysisResult }
    );

    return `LangChain Video Agent ready! ${analysisResult}`;
  }

  async processMessage(message: string, context?: any): Promise<string> {
    if (!this.agent) {
      throw new Error('Agent not initialized');
    }

    try {
      const executor = new AgentExecutor({
        agent: this.agent,
        tools: this.tools,
        memory: this.memory,
        verbose: true
      });

      const result = await executor.invoke({
        input: message,
        current_video: this.currentVideoPath || 'No video loaded',
        session_id: this.sessionId,
        context: context ? JSON.stringify(context) : 'No additional context'
      });

      return result.output || 'Operation completed successfully';
    } catch (error) {
      console.error('LangChain agent error:', error);
      return `I encountered an error processing your request: ${error}`;
    }
  }

  async getSessionHistory(): Promise<any[]> {
    const messages = await this.memory.chatHistory.getMessages();
    return messages.map(msg => ({
      type: msg.getType(),
      content: msg.content,
      timestamp: new Date().toISOString()
    }));
  }

  async clearMemory(): Promise<void> {
    await this.memory.clear();
  }

  getSessionId(): string {
    return this.sessionId;
  }

  getCurrentVideo(): string | null {
    return this.currentVideoPath;
  }
}

// Agent Manager for handling multiple sessions
export class LangChainAgentManager {
  private agents = new Map<string, LangChainVideoAgent>();

  getAgent(sessionId: string): LangChainVideoAgent {
    if (!this.agents.has(sessionId)) {
      this.agents.set(sessionId, new LangChainVideoAgent(sessionId));
    }
    return this.agents.get(sessionId)!;
  }

  removeAgent(sessionId: string): void {
    this.agents.delete(sessionId);
  }

  getActiveSessionCount(): number {
    return this.agents.size;
  }

  async cleanup(): Promise<void> {
    for (const [sessionId, agent] of this.agents) {
      await agent.clearMemory();
    }
    this.agents.clear();
  }
}

// Export singleton instance
export const langchainAgentManager = new LangChainAgentManager();