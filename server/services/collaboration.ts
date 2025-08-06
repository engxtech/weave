import { WebSocketServer, WebSocket } from 'ws';
import { Server } from 'http';

export interface CollaborationSession {
  id: string;
  workflowId: number;
  users: ConnectedUser[];
  currentVersion: number;
  lastActivity: Date;
}

export interface ConnectedUser {
  id: string;
  name: string;
  avatar: string;
  cursor: { x: number; y: number } | null;
  selection: string[] | null;
  connection: WebSocket;
  lastSeen: Date;
}

export interface CollaborationMessage {
  type: 'join' | 'leave' | 'cursor_move' | 'node_update' | 'edge_update' | 'selection_change' | 'chat_message';
  userId: string;
  workflowId: number;
  data: any;
  timestamp: Date;
}

export class CollaborationManager {
  private wss: WebSocketServer;
  private sessions: Map<number, CollaborationSession> = new Map();
  private userConnections: Map<string, WebSocket> = new Map();

  constructor(server: Server) {
    this.wss = new WebSocketServer({ 
      server, 
      path: '/ws/collaboration'
    });

    this.wss.on('connection', (ws: WebSocket, request) => {
      console.log('New collaboration connection');
      
      ws.on('message', (data: Buffer) => {
        try {
          const message: CollaborationMessage = JSON.parse(data.toString());
          this.handleMessage(ws, message);
        } catch (error) {
          console.error('Invalid collaboration message:', error);
        }
      });

      ws.on('close', () => {
        this.handleDisconnection(ws);
      });

      ws.on('error', (error) => {
        console.error('WebSocket error:', error);
      });
    });
  }

  private handleMessage(ws: WebSocket, message: CollaborationMessage) {
    const { type, userId, workflowId, data, timestamp } = message;

    switch (type) {
      case 'join':
        this.handleUserJoin(ws, userId, workflowId, data);
        break;
      case 'leave':
        this.handleUserLeave(userId, workflowId);
        break;
      case 'cursor_move':
        this.handleCursorMove(userId, workflowId, data);
        break;
      case 'node_update':
        this.handleNodeUpdate(userId, workflowId, data);
        break;
      case 'edge_update':
        this.handleEdgeUpdate(userId, workflowId, data);
        break;
      case 'selection_change':
        this.handleSelectionChange(userId, workflowId, data);
        break;
      case 'chat_message':
        this.handleChatMessage(userId, workflowId, data);
        break;
    }
  }

  private handleUserJoin(ws: WebSocket, userId: string, workflowId: number, userData: any) {
    let session = this.sessions.get(workflowId);
    
    if (!session) {
      session = {
        id: `session-${workflowId}-${Date.now()}`,
        workflowId,
        users: [],
        currentVersion: 1,
        lastActivity: new Date()
      };
      this.sessions.set(workflowId, session);
    }

    const user: ConnectedUser = {
      id: userId,
      name: userData.name || `User ${userId}`,
      avatar: userData.avatar || '',
      cursor: null,
      selection: null,
      connection: ws,
      lastSeen: new Date()
    };

    // Remove existing user if reconnecting
    session.users = session.users.filter(u => u.id !== userId);
    session.users.push(user);
    
    this.userConnections.set(userId, ws);

    // Notify all users in the session
    this.broadcastToSession(workflowId, {
      type: 'user_joined',
      user: {
        id: user.id,
        name: user.name,
        avatar: user.avatar
      },
      users: session.users.map(u => ({
        id: u.id,
        name: u.name,
        avatar: u.avatar,
        cursor: u.cursor,
        selection: u.selection
      }))
    });

    // Send current session state to the new user
    ws.send(JSON.stringify({
      type: 'session_state',
      session: {
        id: session.id,
        users: session.users.map(u => ({
          id: u.id,
          name: u.name,
          avatar: u.avatar,
          cursor: u.cursor,
          selection: u.selection
        })),
        version: session.currentVersion
      }
    }));
  }

  private handleUserLeave(userId: string, workflowId: number) {
    const session = this.sessions.get(workflowId);
    if (!session) return;

    session.users = session.users.filter(u => u.id !== userId);
    this.userConnections.delete(userId);

    this.broadcastToSession(workflowId, {
      type: 'user_left',
      userId,
      users: session.users.map(u => ({
        id: u.id,
        name: u.name,
        avatar: u.avatar,
        cursor: u.cursor,
        selection: u.selection
      }))
    });

    // Clean up empty sessions
    if (session.users.length === 0) {
      this.sessions.delete(workflowId);
    }
  }

  private handleCursorMove(userId: string, workflowId: number, cursorData: any) {
    const session = this.sessions.get(workflowId);
    if (!session) return;

    const user = session.users.find(u => u.id === userId);
    if (!user) return;

    user.cursor = cursorData;
    user.lastSeen = new Date();

    this.broadcastToSession(workflowId, {
      type: 'cursor_updated',
      userId,
      cursor: cursorData
    }, userId);
  }

  private handleNodeUpdate(userId: string, workflowId: number, nodeData: any) {
    const session = this.sessions.get(workflowId);
    if (!session) return;

    session.currentVersion++;
    session.lastActivity = new Date();

    this.broadcastToSession(workflowId, {
      type: 'node_updated',
      userId,
      nodeData,
      version: session.currentVersion
    }, userId);
  }

  private handleEdgeUpdate(userId: string, workflowId: number, edgeData: any) {
    const session = this.sessions.get(workflowId);
    if (!session) return;

    session.currentVersion++;
    session.lastActivity = new Date();

    this.broadcastToSession(workflowId, {
      type: 'edge_updated',
      userId,
      edgeData,
      version: session.currentVersion
    }, userId);
  }

  private handleSelectionChange(userId: string, workflowId: number, selectionData: any) {
    const session = this.sessions.get(workflowId);
    if (!session) return;

    const user = session.users.find(u => u.id === userId);
    if (!user) return;

    user.selection = selectionData.nodeIds || null;

    this.broadcastToSession(workflowId, {
      type: 'selection_changed',
      userId,
      selection: user.selection
    }, userId);
  }

  private handleChatMessage(userId: string, workflowId: number, messageData: any) {
    const session = this.sessions.get(workflowId);
    if (!session) return;

    const user = session.users.find(u => u.id === userId);
    if (!user) return;

    this.broadcastToSession(workflowId, {
      type: 'chat_message',
      userId,
      userName: user.name,
      message: messageData.message,
      timestamp: new Date().toISOString()
    });
  }

  private handleDisconnection(ws: WebSocket) {
    // Find and remove user from all sessions
    for (const [workflowId, session] of this.sessions.entries()) {
      const userIndex = session.users.findIndex(u => u.connection === ws);
      if (userIndex !== -1) {
        const user = session.users[userIndex];
        this.handleUserLeave(user.id, workflowId);
        break;
      }
    }
  }

  private broadcastToSession(workflowId: number, message: any, excludeUserId?: string) {
    const session = this.sessions.get(workflowId);
    if (!session) return;

    const messageString = JSON.stringify(message);

    session.users.forEach(user => {
      if (excludeUserId && user.id === excludeUserId) return;
      
      if (user.connection.readyState === WebSocket.OPEN) {
        user.connection.send(messageString);
      }
    });
  }

  getActiveUsers(workflowId: number): ConnectedUser[] {
    const session = this.sessions.get(workflowId);
    return session ? session.users.map(u => ({
      ...u,
      connection: undefined as any // Don't expose WebSocket connection
    })) : [];
  }

  getSessionInfo(workflowId: number): Partial<CollaborationSession> | null {
    const session = this.sessions.get(workflowId);
    return session ? {
      id: session.id,
      workflowId: session.workflowId,
      currentVersion: session.currentVersion,
      lastActivity: session.lastActivity,
      users: session.users.map(u => ({
        ...u,
        connection: undefined as any
      }))
    } : null;
  }
}

export let collaborationManager: CollaborationManager;