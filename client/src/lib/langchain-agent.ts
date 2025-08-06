// Client-side LangChain Agent utility for reuse across components
// Generate a unique session ID
function generateSessionId(): string {
  return `session_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;
}

export interface AgentMessage {
  id: string;
  type: 'user' | 'assistant';
  content: string;
  timestamp: string;
  operation?: string;
  operations?: Array<{ description: string; type: string; }>;
  tokensUsed?: number;
  cost?: string;
}

export interface AgentSession {
  sessionId: string;
  isWarmedUp: boolean;
  currentVideo: string | null;
  messages: AgentMessage[];
}

export class LangChainAgentClient {
  private sessionId: string;
  private isWarmedUp: boolean = false;
  private currentVideo: string | null = null;
  private messages: AgentMessage[] = [];
  private onMessageCallback?: (message: AgentMessage) => void;
  private onStatusCallback?: (status: { isWarmedUp: boolean; currentVideo: string | null }) => void;

  constructor(sessionId?: string) {
    this.sessionId = sessionId || generateSessionId();
  }

  // Set callback for when new messages arrive
  onMessage(callback: (message: AgentMessage) => void) {
    this.onMessageCallback = callback;
  }

  // Set callback for status changes
  onStatusChange(callback: (status: { isWarmedUp: boolean; currentVideo: string | null }) => void) {
    this.onStatusCallback = callback;
  }

  // Warm up the agent with a video
  async warmupWithVideo(videoPath: string): Promise<string> {
    try {
      const response = await fetch('/api/agent-warmup', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json'
        },
        body: JSON.stringify({
          sessionId: this.sessionId,
          videoPath
        })
      });

      if (!response.ok) {
        throw new Error(`Warmup failed: ${response.statusText}`);
      }

      const result = await response.json();
      
      this.isWarmedUp = true;
      this.currentVideo = videoPath;
      
      // Add system message about warmup
      const warmupMessage: AgentMessage = {
        id: Date.now().toString(),
        type: 'assistant',
        content: result.message,
        timestamp: new Date().toISOString(),
        operation: 'warmup'
      };
      
      this.messages.push(warmupMessage);
      this.onMessageCallback?.(warmupMessage);
      this.onStatusCallback?.({ isWarmedUp: this.isWarmedUp, currentVideo: this.currentVideo });
      
      return result.message;
    } catch (error) {
      console.error('Agent warmup error:', error);
      throw error;
    }
  }

  // Send a message to the agent
  async sendMessage(message: string, context?: any): Promise<string> {
    try {
      // Add user message
      const userMessage: AgentMessage = {
        id: Date.now().toString(),
        type: 'user',
        content: message,
        timestamp: new Date().toISOString()
      };
      
      this.messages.push(userMessage);
      this.onMessageCallback?.(userMessage);

      // Send to agent
      const response = await fetch('/api/langchain-chat', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json'
        },
        body: JSON.stringify({
          sessionId: this.sessionId,
          message,
          context
        })
      });

      if (!response.ok) {
        throw new Error(`Chat failed: ${response.statusText}`);
      }

      const result = await response.json();
      
      // Add assistant response
      const assistantMessage: AgentMessage = {
        id: Date.now().toString(),
        type: 'assistant',
        content: result.response,
        timestamp: new Date().toISOString()
      };
      
      this.messages.push(assistantMessage);
      this.onMessageCallback?.(assistantMessage);
      
      return result.response;
    } catch (error) {
      console.error('Agent message error:', error);
      throw error;
    }
  }

  // Update video context without full warmup
  updateVideoContext(videoPath: string): void {
    this.currentVideo = videoPath;
    this.isWarmedUp = false; // Reset warmup state since video changed
    this.onStatusCallback?.({ isWarmedUp: this.isWarmedUp, currentVideo: this.currentVideo });
  }

  // Get session information
  getSession(): AgentSession {
    return {
      sessionId: this.sessionId,
      isWarmedUp: this.isWarmedUp,
      currentVideo: this.currentVideo,
      messages: [...this.messages]
    };
  }

  // Clear the conversation
  clearMessages() {
    this.messages = [];
  }

  // Get session ID
  getSessionId(): string {
    return this.sessionId;
  }

  // Check if agent is warmed up
  getIsWarmedUp(): boolean {
    return this.isWarmedUp;
  }

  // Get current video
  getCurrentVideo(): string | null {
    return this.currentVideo;
  }

  // Get all messages
  getMessages(): AgentMessage[] {
    return [...this.messages];
  }
}

// Utility function to create agent instances
export function createLangChainAgent(sessionId?: string): LangChainAgentClient {
  return new LangChainAgentClient(sessionId);
}

// Shared agent instance for global use
let globalAgent: LangChainAgentClient | null = null;

export function getGlobalAgent(): LangChainAgentClient {
  if (!globalAgent) {
    globalAgent = new LangChainAgentClient();
  }
  return globalAgent;
}

export function setGlobalAgent(agent: LangChainAgentClient) {
  globalAgent = agent;
}

export function resetGlobalAgent() {
  globalAgent = null;
}