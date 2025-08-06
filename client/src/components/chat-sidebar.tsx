import { useState, useRef, useEffect } from "react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Separator } from "@/components/ui/separator";
import { Badge } from "@/components/ui/badge";
import { useWorkflowChat, useSendChatMessage } from "@/hooks/use-workflow";
import { MdSmartToy, MdSend, MdPerson, MdClose, MdInfo, MdVisibility, MdCrop, MdTouchApp } from "react-icons/md";
import type { ChatMessage } from "@/lib/workflow-types";

interface ChatSidebarProps {
  workflowId: number;
  onClose: () => void;
}

export default function ChatSidebar({ workflowId, onClose }: ChatSidebarProps) {
  const [message, setMessage] = useState("");
  const messagesEndRef = useRef<HTMLDivElement>(null);
  
  const { data: chatData, isLoading } = useWorkflowChat(workflowId);
  const sendMessage = useSendChatMessage();

  const messages: ChatMessage[] = chatData?.messages || [];

  useEffect(() => {
    messagesEndRef.current?.scrollIntoView({ behavior: "smooth" });
  }, [messages]);

  const handleSendMessage = async () => {
    if (!message.trim() || sendMessage.isPending) return;

    const userMessage = message;
    setMessage("");

    try {
      await sendMessage.mutateAsync({
        workflowId,
        message: userMessage,
      });
    } catch (error) {
      // Error is handled by the hook
    }
  };

  const handleKeyPress = (e: React.KeyboardEvent) => {
    if (e.key === "Enter" && !e.shiftKey) {
      e.preventDefault();
      handleSendMessage();
    }
  };

  const suggestedActions = [
    {
      icon: MdTouchApp,
      text: "Auto-detect scene changes",
      color: "text-google-blue",
    },
    {
      icon: MdVisibility,
      text: "Improve eye contact",
      color: "text-gemini-green",
    },
    {
      icon: MdCrop,
      text: "Generate vertical format",
      color: "text-yellow-600",
    },
  ];

  return (
    <div className="w-96 bg-white border-l border-gray-200 flex flex-col shadow-lg">
      {/* Header */}
      <div className="p-5 border-b border-gray-100 bg-gradient-to-r from-google-blue/5 to-gemini-green/5">
        <div className="flex items-center justify-between">
          <div className="flex items-center space-x-3">
            <div className="w-8 h-8 bg-gradient-to-r from-gemini-green to-google-blue rounded-google flex items-center justify-center">
              <MdSmartToy className="w-4 h-4 text-white" />
            </div>
            <div>
              <h2 className="font-google-sans font-medium text-google-text">AI Assistant</h2>
              <div className="flex items-center space-x-2 text-xs text-gemini-green font-medium">
                <div className="w-2 h-2 bg-gemini-green rounded-full animate-pulse"></div>
                <span>Connected</span>
              </div>
            </div>
          </div>
          <Button size="sm" variant="ghost" onClick={onClose} className="rounded-google">
            <MdClose className="w-4 h-4" />
          </Button>
        </div>
      </div>

      {/* Messages */}
      <div className="flex-1 overflow-y-auto p-4 space-y-4">
        {isLoading ? (
          <div className="text-center text-gray-500 py-8">
            <div className="w-6 h-6 border-2 border-google-blue border-t-transparent rounded-full animate-spin mx-auto mb-2"></div>
            Loading chat...
          </div>
        ) : messages.length === 0 ? (
          <div className="chat-message">
            <div className="flex items-start space-x-3">
              <div className="w-8 h-8 bg-gradient-to-r from-google-blue to-gemini-green rounded-full flex items-center justify-center flex-shrink-0">
                <MdSmartToy className="w-4 h-4 text-white" />
              </div>
              <div className="bg-gray-50 rounded-lg p-3 max-w-xs">
                <p className="text-sm text-google-text">
                  Hi! I'm your AI video editing assistant. I can help you build workflows, analyze your content, and make intelligent editing decisions. What would you like to work on today?
                </p>
              </div>
            </div>
          </div>
        ) : (
          messages.map((msg, index) => (
            <div key={index} className="chat-message">
              {msg.role === "user" ? (
                <div className="flex items-start space-x-3 justify-end">
                  <div className="bg-google-blue rounded-lg p-3 max-w-xs">
                    <p className="text-sm text-white">{msg.content}</p>
                  </div>
                  <div className="w-8 h-8 bg-google-blue rounded-full flex items-center justify-center flex-shrink-0">
                    <span className="text-white text-xs font-medium">U</span>
                  </div>
                </div>
              ) : (
                <div className="flex items-start space-x-3">
                  <div className="w-8 h-8 bg-gradient-to-r from-google-blue to-gemini-green rounded-full flex items-center justify-center flex-shrink-0">
                    <MdSmartToy className="w-4 h-4 text-white" />
                  </div>
                  <div className={`rounded-lg p-3 max-w-xs ${msg.error ? 'bg-red-50 border border-red-200' : 'bg-gray-50'}`}>
                    <p className={`text-sm ${msg.error ? 'text-red-700' : 'text-google-text'}`}>
                      {msg.content}
                    </p>
                  </div>
                </div>
              )}
            </div>
          ))
        )}

        {sendMessage.isPending && (
          <div className="chat-message">
            <div className="flex items-start space-x-3">
              <div className="w-8 h-8 bg-gradient-to-r from-google-blue to-gemini-green rounded-full flex items-center justify-center flex-shrink-0">
                <MdSmartToy className="w-4 h-4 text-white" />
              </div>
              <div className="bg-gray-50 rounded-lg p-3 max-w-xs">
                <div className="flex items-center space-x-2">
                  <div className="w-2 h-2 bg-google-blue rounded-full animate-bounce"></div>
                  <div className="w-2 h-2 bg-google-blue rounded-full animate-bounce" style={{ animationDelay: '0.1s' }}></div>
                  <div className="w-2 h-2 bg-google-blue rounded-full animate-bounce" style={{ animationDelay: '0.2s' }}></div>
                </div>
              </div>
            </div>
          </div>
        )}

        <div ref={messagesEndRef} />

        {/* Suggested Actions */}
        {messages.length <= 2 && (
          <div className="bg-tile-blue rounded-lg p-3">
            <h4 className="font-medium text-google-text text-sm mb-2">Suggested Actions</h4>
            <div className="space-y-2">
              {suggestedActions.map((action, index) => (
                <Button
                  key={index}
                  variant="outline"
                  size="sm"
                  className="w-full justify-start text-sm bg-white hover:bg-gray-50 border-blue-200"
                  onClick={() => setMessage(action.text)}
                >
                  <action.icon className={`w-4 h-4 mr-2 ${action.color}`} />
                  {action.text}
                </Button>
              ))}
            </div>
          </div>
        )}
      </div>

      {/* Input */}
      <div className="p-4 border-t border-gray-100">
        <div className="flex space-x-2">
          <Input
            type="text"
            placeholder="Ask Gemini anything about your video..."
            value={message}
            onChange={(e) => setMessage(e.target.value)}
            onKeyPress={handleKeyPress}
            disabled={sendMessage.isPending}
            className="flex-1"
          />
          <Button
            onClick={handleSendMessage}
            disabled={!message.trim() || sendMessage.isPending}
            className="bg-google-blue hover:bg-blue-600 text-white rounded-google"
          >
            <MdSend className="w-4 h-4" />
          </Button>
        </div>
        <div className="mt-2 flex items-center space-x-2 text-xs text-gray-500">
          <MdInfo className="w-3 h-3" />
          <span>Powered by Gemini Pro Vision</span>
        </div>
      </div>
    </div>
  );
}
