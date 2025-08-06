import { ChatGoogleGenerativeAI } from "@langchain/google-genai";
import { DynamicTool } from "@langchain/core/tools";
import { AgentExecutor, createReactAgent } from "langchain/agents";
import { PromptTemplate } from "@langchain/core/prompts";
import { BufferMemory } from "langchain/memory";
import { HumanMessage, AIMessage } from "@langchain/core/messages";
import * as fs from 'fs';
import * as path from 'path';
import { spawn } from 'child_process';

// Session-based memory storage
const sessionMemories = new Map<string, BufferMemory>();

// Create video split tool
const videoSplitTool = new DynamicTool({
  name: "video_split",
  description: "Split video into segments. Input format: startTime,endTime,videoPath",
  func: async (input: string) => {
    try {
      const [startTime, endTime, videoPath = ''] = input.split(',');
      const start = parseFloat(startTime);
      const end = parseFloat(endTime);
      
      const splitId = `split_${Date.now()}`;
      const operation = {
        id: splitId,
        type: 'split_video',
        timestamp: Date.now(),
        parameters: { startTime: start, endTime: end, videoPath },
        description: `Split video from ${start}s to ${end}s`
      };
      
      console.log('Video split operation created:', operation);
      
      return `Successfully created video split from ${start} to ${end} seconds. Split ID: ${splitId}`;
    } catch (error) {
      return `Error creating video split: ${error}`;
    }
  }
});

// Create text overlay tool
const textOverlayTool = new DynamicTool({
  name: "add_text_overlay",
  description: "Add text overlay to video. Input format: text,startTime,duration,x,y",
  func: async (input: string) => {
    try {
      const parts = input.split(',');
      const text = parts[0] || 'Sample Text';
      const startTime = parseFloat(parts[1]) || 0;
      const duration = parseFloat(parts[2]) || 3;
      const x = parseFloat(parts[3]) || 50;
      const y = parseFloat(parts[4]) || 20;
      
      const textId = `text_${Date.now()}`;
      const textOverlay = {
        id: textId,
        text,
        startTime,
        duration,
        x,
        y,
        fontSize: 24,
        color: '#ffffff',
        background: 'rgba(0,0,0,0.7)'
      };
      
      console.log('Text overlay created:', textOverlay);
      
      return `Successfully added text overlay "${text}" at ${startTime}s for ${duration} seconds. Text ID: ${textId}`;
    } catch (error) {
      return `Error creating text overlay: ${error}`;
    }
  }
});

// Create video filter tool
const videoFilterTool = new DynamicTool({
  name: "apply_video_filter",
  description: "Apply video filter/effect. Input format: filterName,startTime,endTime,intensity",
  func: async (input: string) => {
    try {
      const parts = input.split(',');
      const filterName = parts[0] || 'sepia';
      const startTime = parseFloat(parts[1]) || 0;
      const endTime = parseFloat(parts[2]) || 5;
      const intensity = parseFloat(parts[3]) || 0.7;
      
      const filterId = `filter_${Date.now()}`;
      const filter = {
        id: filterId,
        name: filterName,
        startTime,
        endTime,
        settings: { intensity }
      };
      
      console.log('Video filter created:', filter);
      
      return `Successfully applied ${filterName} filter from ${startTime}s to ${endTime}s with intensity ${intensity}. Filter ID: ${filterId}`;
    } catch (error) {
      return `Error applying video filter: ${error}`;
    }
  }
});

// Create video analysis tool
const videoAnalysisTool = new DynamicTool({
  name: "analyze_video",
  description: "Analyze video content for editing suggestions. Input: videoPath",
  func: async (input: string) => {
    try {
      const videoPath = input.trim();
      
      if (!fs.existsSync(videoPath)) {
        return `Video file not found: ${videoPath}`;
      }
      
      // Get video metadata using ffprobe
      const metadata = await getVideoMetadata(videoPath);
      
      const analysis = {
        duration: metadata.duration,
        resolution: `${metadata.width}x${metadata.height}`,
        framerate: metadata.framerate,
        fileSize: fs.statSync(videoPath).size,
        suggestions: [
          "Consider adding text overlays at key moments",
          "Apply color grading filters for mood enhancement",
          "Split into engaging segments for better pacing"
        ]
      };
      
      console.log('Video analysis completed:', analysis);
      
      return `Video analysis complete:
Duration: ${analysis.duration}s
Resolution: ${analysis.resolution}
Frame rate: ${analysis.framerate} fps
File size: ${(analysis.fileSize / (1024 * 1024)).toFixed(2)} MB

Suggestions:
${analysis.suggestions.map((s, i) => `${i + 1}. ${s}`).join('\n')}`;
    } catch (error) {
      return `Error analyzing video: ${error}`;
    }
  }
});

// Create video cutting tool
const videoCuttingTool = new DynamicTool({
  name: "cut_video_segment",
  description: "Cut/extract specific segment from video. Input format: videoPath,startTime,endTime,outputPath",
  func: async (input: string) => {
    try {
      const parts = input.split(',');
      const videoPath = parts[0];
      const startTime = parseFloat(parts[1]);
      const endTime = parseFloat(parts[2]);
      const outputPath = parts[3] || `cut_${Date.now()}.mp4`;
      
      const duration = endTime - startTime;
      const fullOutputPath = path.join('uploads', outputPath);
      
      await cutVideoSegment(videoPath, startTime, duration, fullOutputPath);
      
      console.log('Video segment cut:', { videoPath, startTime, endTime, outputPath: fullOutputPath });
      
      return `Successfully cut video segment from ${startTime}s to ${endTime}s. Output saved to: ${fullOutputPath}`;
    } catch (error) {
      return `Error cutting video segment: ${error}`;
    }
  }
});

// Create video navigation tool
const videoNavigationTool = new DynamicTool({
  name: "navigate_video",
  description: "Navigate to specific time in video or control playback. Input format: action,time",
  func: async (input: string) => {
    try {
      const parts = input.split(',');
      const action = parts[0];
      const time = parts[1] ? parseFloat(parts[1]) : undefined;
      
      const command = {
        action,
        time,
        timestamp: Date.now()
      };
      
      console.log('Video navigation command:', command);
      
      switch (action) {
        case 'seek':
          return `Navigated to ${time} seconds in the video`;
        case 'play':
          return `Started video playback`;
        case 'pause':
          return `Paused video playback`;
        case 'stop':
          return `Stopped video playback`;
        default:
          return `Unknown navigation action: ${action}`;
      }
    } catch (error) {
      return `Error navigating video: ${error}`;
    }
  }
});

// Helper function to get video metadata
async function getVideoMetadata(videoPath: string): Promise<any> {
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
            duration: parseFloat(metadata.format.duration),
            width: videoStream?.width || 0,
            height: videoStream?.height || 0,
            framerate: eval(videoStream?.r_frame_rate || '30/1')
          });
        } catch (error) {
          reject(error);
        }
      } else {
        reject(new Error(`ffprobe failed with code ${code}`));
      }
    });
  });
}

// Helper function to cut video segment
async function cutVideoSegment(inputPath: string, startTime: number, duration: number, outputPath: string): Promise<void> {
  return new Promise((resolve, reject) => {
    const ffmpeg = spawn('ffmpeg', [
      '-i', inputPath,
      '-ss', startTime.toString(),
      '-t', duration.toString(),
      '-c', 'copy',
      '-y',
      outputPath
    ]);
    
    ffmpeg.on('close', (code) => {
      if (code === 0) {
        resolve();
      } else {
        reject(new Error(`FFmpeg failed with code ${code}`));
      }
    });
  });
}

// Create LangChain agent with Gemini
export class VideoEditingAgent {
  private model: ChatGoogleGenerativeAI;
  private tools: any[];
  private sessionId: string;
  private agent: any;
  
  constructor(sessionId: string) {
    this.sessionId = sessionId;
    
    // Initialize Gemini model
    this.model = new ChatGoogleGenerativeAI({
      model: "gemini-1.5-flash",
      apiKey: process.env.GEMINI_API_KEY,
      temperature: 0.7,
    });
    
    // Initialize tools
    this.tools = [
      videoSplitTool,
      textOverlayTool,
      videoFilterTool,
      videoAnalysisTool,
      videoCuttingTool,
      videoNavigationTool
    ];
    
    // Initialize session memory if not exists
    if (!sessionMemories.has(sessionId)) {
      sessionMemories.set(sessionId, new BufferMemory({
        memoryKey: "chat_history",
        returnMessages: true
      }));
    }
    
    this.initializeAgent();
  }
  
  private async initializeAgent() {
    const prompt = PromptTemplate.fromTemplate(`
You are an AI video editing assistant powered by Gemini. You help users edit videos through natural language commands.

Available tools:
{tools}

Tool Names: {tool_names}

You should:
1. Understand the user's video editing intent
2. Use appropriate tools to accomplish the task
3. Provide clear feedback about what was done
4. Remember context from previous interactions in this session

Session ID: {sessionId}

Previous conversation:
{chat_history}

Current user input: {input}

Thought: Let me understand what the user wants to do with their video.
{agent_scratchpad}`);

    this.agent = await createReactAgent({
      llm: this.model,
      tools: this.tools,
      prompt
    });
  }
  
  // Get session memory
  private getMemory(): BufferMemory {
    return sessionMemories.get(this.sessionId)!;
  }
  
  // Process user message with agent
  async processMessage(message: string, context?: any): Promise<string> {
    try {
      const memory = this.getMemory();
      
      // Create agent executor
      const executor = new AgentExecutor({
        agent: this.agent,
        tools: this.tools,
        memory: memory,
        verbose: true,
        maxIterations: 3
      });
      
      // Add context to the message if provided
      const fullMessage = context 
        ? `${message}\n\nContext: ${JSON.stringify(context)}`
        : message;
      
      // Execute the agent
      const result = await executor.invoke({
        input: fullMessage,
        sessionId: this.sessionId
      });
      
      // Save to memory
      await memory.saveContext(
        { input: message },
        { output: result.output }
      );
      
      return result.output;
    } catch (error) {
      console.error('Agent processing error:', error);
      return `I encountered an error while processing your request: ${error}. Please try again or rephrase your request.`;
    }
  }
  
  // Get session history
  async getSessionHistory(): Promise<any[]> {
    const memory = this.getMemory();
    const messages = await memory.chatHistory.getMessages();
    return messages.map(msg => ({
      type: msg._getType(),
      content: msg.content,
      timestamp: Date.now()
    }));
  }
  
  // Clear session memory
  async clearMemory(): Promise<void> {
    sessionMemories.set(this.sessionId, new BufferMemory({
      memoryKey: "chat_history",
      returnMessages: true
    }));
  }
  
  // Warm up agent with video analysis
  async warmupWithVideo(videoPath: string): Promise<string> {
    try {
      const analysisResult = await videoAnalysisTool.func(videoPath);
      
      // Store analysis in memory
      const memory = this.getMemory();
      await memory.saveContext(
        { input: "analyze current video" },
        { output: analysisResult }
      );
      
      return `Agent warmed up with video analysis:\n${analysisResult}`;
    } catch (error) {
      return `Failed to warm up agent: ${error}`;
    }
  }
}

// Agent manager for multiple sessions
export class AgentManager {
  private agents = new Map<string, VideoEditingAgent>();
  
  getAgent(sessionId: string): VideoEditingAgent {
    if (!this.agents.has(sessionId)) {
      this.agents.set(sessionId, new VideoEditingAgent(sessionId));
    }
    return this.agents.get(sessionId)!;
  }
  
  removeAgent(sessionId: string): void {
    this.agents.delete(sessionId);
    sessionMemories.delete(sessionId);
  }
  
  getActiveSessionCount(): number {
    return this.agents.size;
  }
}

// Export singleton manager
export const agentManager = new AgentManager();