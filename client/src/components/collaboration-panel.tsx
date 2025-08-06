import { useState, useEffect } from "react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import { Input } from "@/components/ui/input";
import { ScrollArea } from "@/components/ui/scroll-area";
import { Users, MessageCircle, Share, Copy, Check } from "lucide-react";
import { useToast } from "@/hooks/use-toast";

interface ConnectedUser {
  id: string;
  name: string;
  avatar: string;
  cursor: { x: number; y: number } | null;
  selection: string[] | null;
}

interface ChatMessage {
  userId: string;
  userName: string;
  message: string;
  timestamp: string;
}

interface CollaborationPanelProps {
  workflowId: number;
  isOpen: boolean;
  onClose: () => void;
}

export default function CollaborationPanel({ workflowId, isOpen, onClose }: CollaborationPanelProps) {
  const [users, setUsers] = useState<ConnectedUser[]>([]);
  const [chatMessages, setChatMessages] = useState<ChatMessage[]>([]);
  const [newMessage, setNewMessage] = useState("");
  const [ws, setWs] = useState<WebSocket | null>(null);
  const [isConnected, setIsConnected] = useState(false);
  const [shareUrlCopied, setShareUrlCopied] = useState(false);
  const { toast } = useToast();

  const currentUser = {
    id: 'demo-user-1',
    name: 'John Doe',
    avatar: ''
  };

  useEffect(() => {
    if (!isOpen || !workflowId) return;

    // Connect to collaboration WebSocket
    const protocol = window.location.protocol === "https:" ? "wss:" : "ws:";
    const wsUrl = `${protocol}//${window.location.host}/ws/collaboration`;
    const websocket = new WebSocket(wsUrl);

    websocket.onopen = () => {
      setIsConnected(true);
      setWs(websocket);
      
      // Join collaboration session
      websocket.send(JSON.stringify({
        type: 'join',
        userId: currentUser.id,
        workflowId: workflowId,
        data: {
          name: currentUser.name,
          avatar: currentUser.avatar
        },
        timestamp: new Date()
      }));
    };

    websocket.onmessage = (event) => {
      try {
        const message = JSON.parse(event.data);
        handleWebSocketMessage(message);
      } catch (error) {
        console.error('Invalid WebSocket message:', error);
      }
    };

    websocket.onclose = () => {
      setIsConnected(false);
      setWs(null);
    };

    websocket.onerror = (error) => {
      console.error('WebSocket error:', error);
      setIsConnected(false);
    };

    return () => {
      if (websocket.readyState === WebSocket.OPEN) {
        websocket.send(JSON.stringify({
          type: 'leave',
          userId: currentUser.id,
          workflowId: workflowId,
          timestamp: new Date()
        }));
      }
      websocket.close();
    };
  }, [isOpen, workflowId]);

  const handleWebSocketMessage = (message: any) => {
    switch (message.type) {
      case 'session_state':
        setUsers(message.session.users || []);
        break;
      case 'user_joined':
        setUsers(message.users || []);
        toast({
          title: "User joined",
          description: `${message.user.name} joined the collaboration session`,
        });
        break;
      case 'user_left':
        setUsers(message.users || []);
        break;
      case 'chat_message':
        setChatMessages(prev => [...prev, {
          userId: message.userId,
          userName: message.userName,
          message: message.message,
          timestamp: message.timestamp
        }]);
        break;
      case 'cursor_updated':
        setUsers(prev => prev.map(user =>
          user.id === message.userId
            ? { ...user, cursor: message.cursor }
            : user
        ));
        break;
      case 'selection_changed':
        setUsers(prev => prev.map(user =>
          user.id === message.userId
            ? { ...user, selection: message.selection }
            : user
        ));
        break;
    }
  };

  const sendChatMessage = () => {
    if (!newMessage.trim() || !ws || ws.readyState !== WebSocket.OPEN) return;

    ws.send(JSON.stringify({
      type: 'chat_message',
      userId: currentUser.id,
      workflowId: workflowId,
      data: { message: newMessage },
      timestamp: new Date()
    }));

    setNewMessage("");
  };

  const copyShareUrl = async () => {
    const shareUrl = `${window.location.origin}/workflow/${workflowId}`;
    try {
      await navigator.clipboard.writeText(shareUrl);
      setShareUrlCopied(true);
      toast({
        title: "Share URL copied",
        description: "Share this URL with others to collaborate on this workflow",
      });
      setTimeout(() => setShareUrlCopied(false), 2000);
    } catch (error) {
      toast({
        title: "Failed to copy URL",
        description: "Please copy the URL manually from your browser",
        variant: "destructive"
      });
    }
  };

  const formatTime = (timestamp: string) => {
    return new Date(timestamp).toLocaleTimeString([], { 
      hour: '2-digit', 
      minute: '2-digit' 
    });
  };

  if (!isOpen) return null;

  return (
    <div className="w-80 bg-white border-l border-gray-200 flex flex-col shadow-lg">
      {/* Header */}
      <div className="p-4 border-b border-gray-100 bg-gradient-to-r from-google-blue/5 to-purple-500/5">
        <div className="flex items-center justify-between">
          <div className="flex items-center space-x-2">
            <div className="w-8 h-8 bg-gradient-to-r from-google-blue to-purple-500 rounded-lg flex items-center justify-center">
              <Users className="w-4 h-4 text-white" />
            </div>
            <h2 className="font-medium text-google-text">Collaboration</h2>
            <Badge variant={isConnected ? "default" : "secondary"} className="text-xs">
              {isConnected ? "Connected" : "Disconnected"}
            </Badge>
          </div>
          <Button size="sm" variant="ghost" onClick={onClose}>
            ×
          </Button>
        </div>
      </div>

      {/* Share Section */}
      <div className="p-4 border-b border-gray-100">
        <div className="space-y-2">
          <label className="text-sm font-medium text-gray-700">Share Workflow</label>
          <div className="flex space-x-2">
            <Button
              onClick={copyShareUrl}
              className="flex-1 bg-google-blue hover:bg-blue-600 text-white text-sm"
            >
              {shareUrlCopied ? (
                <>
                  <Check className="w-4 h-4 mr-2" />
                  Copied!
                </>
              ) : (
                <>
                  <Share className="w-4 h-4 mr-2" />
                  Share
                </>
              )}
            </Button>
          </div>
        </div>
      </div>

      {/* Active Users */}
      <div className="p-4 border-b border-gray-100">
        <h3 className="text-sm font-medium text-gray-700 mb-3">
          Active Users ({users.length})
        </h3>
        <div className="space-y-2">
          {users.map((user) => (
            <div key={user.id} className="flex items-center space-x-3">
              <Avatar className="w-8 h-8">
                <AvatarImage src={user.avatar} />
                <AvatarFallback className="bg-google-blue text-white text-xs">
                  {user.name.split(' ').map(n => n[0]).join('').toUpperCase()}
                </AvatarFallback>
              </Avatar>
              <div className="flex-1">
                <p className="text-sm font-medium text-google-text">{user.name}</p>
                {user.selection && user.selection.length > 0 && (
                  <p className="text-xs text-gray-500">
                    Selected {user.selection.length} node(s)
                  </p>
                )}
              </div>
              <div className="w-2 h-2 bg-green-500 rounded-full animate-pulse"></div>
            </div>
          ))}
          {users.length === 0 && (
            <p className="text-sm text-gray-500 text-center py-4">
              No other users connected
            </p>
          )}
        </div>
      </div>

      {/* Chat Section */}
      <div className="flex-1 flex flex-col">
        <div className="p-4 border-b border-gray-100">
          <h3 className="text-sm font-medium text-gray-700 flex items-center gap-2">
            <MessageCircle className="w-4 h-4" />
            Team Chat
          </h3>
        </div>

        <ScrollArea className="flex-1 p-4">
          <div className="space-y-3">
            {chatMessages.map((msg, index) => (
              <div key={index} className="space-y-1">
                <div className="flex items-center space-x-2">
                  <span className="text-xs font-medium text-google-text">
                    {msg.userName}
                  </span>
                  <span className="text-xs text-gray-500">
                    {formatTime(msg.timestamp)}
                  </span>
                </div>
                <p className="text-sm text-gray-700 bg-gray-50 rounded-lg p-2">
                  {msg.message}
                </p>
              </div>
            ))}
            {chatMessages.length === 0 && (
              <p className="text-sm text-gray-500 text-center py-8">
                No messages yet. Start the conversation!
              </p>
            )}
          </div>
        </ScrollArea>

        <div className="p-4 border-t border-gray-100">
          <div className="flex space-x-2">
            <Input
              value={newMessage}
              onChange={(e) => setNewMessage(e.target.value)}
              placeholder="Type a message..."
              onKeyPress={(e) => e.key === 'Enter' && sendChatMessage()}
              disabled={!isConnected}
              className="flex-1 text-sm"
            />
            <Button
              onClick={sendChatMessage}
              disabled={!newMessage.trim() || !isConnected}
              size="sm"
              className="bg-google-blue hover:bg-blue-600 text-white"
            >
              <MessageCircle className="w-4 h-4" />
            </Button>
          </div>
        </div>
      </div>
    </div>
  );
}