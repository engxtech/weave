import { useState, useRef, useCallback, useEffect } from 'react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Textarea } from '@/components/ui/textarea';
import { Badge } from '@/components/ui/badge';
import { ScrollArea } from '@/components/ui/scroll-area';
import { Play, Pause, Upload, Scissors, Type, Sparkles, Download, MessageSquare, Send, Volume2, Clock, Zap } from 'lucide-react';
import { useToast } from '@/hooks/use-toast';

interface VideoAsset {
  id: string;
  filename: string;
  originalPath: string;
  duration: number;
  width: number;
  height: number;
  frameRate: number;
}

interface LiveEditCommand {
  id: string;
  type: 'cut' | 'text' | 'effect' | 'transition' | 'audio' | 'enhance';
  timestamp: number;
  parameters: any;
  applied: boolean;
}

interface LiveEditingSession {
  sessionId: string;
  videoAsset: VideoAsset;
  commands: LiveEditCommand[];
  currentPreviewPath?: string;
  lastModified: Date;
}

interface Message {
  id: string;
  type: 'user' | 'ai';
  content: string;
  timestamp: Date;
  edits?: LiveEditCommand[];
  suggestions?: string[];
}

export function LiveRevideoEditor() {
  const [session, setSession] = useState<LiveEditingSession | null>(null);
  const [videoFile, setVideoFile] = useState<File | null>(null);
  const [videoUrl, setVideoUrl] = useState<string>('');
  const [isPlaying, setIsPlaying] = useState(false);
  const [currentTime, setCurrentTime] = useState(0);
  const [duration, setDuration] = useState(0);
  const [loading, setLoading] = useState(false);
  const [messages, setMessages] = useState<Message[]>([]);
  const [inputMessage, setInputMessage] = useState('');
  const [processingCommand, setProcessingCommand] = useState(false);
  const [pendingEdits, setPendingEdits] = useState<LiveEditCommand[]>([]);
  
  const videoRef = useRef<HTMLVideoElement>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);
  const { toast } = useToast();

  // Upload video and create session
  const handleVideoUpload = useCallback(async (file: File) => {
    setLoading(true);
    try {
      const formData = new FormData();
      formData.append('video', file);

      const response = await fetch('/api/revideo/upload-video', {
        method: 'POST',
        body: formData,
      });

      if (!response.ok) {
        throw new Error('Upload failed');
      }

      const result = await response.json();
      
      if (result.success) {
        setVideoUrl(result.videoUrl);
        setVideoFile(file);
        
        // Create editing session
        const sessionResponse = await fetch(`/api/revideo/session/${result.sessionId}`);
        if (sessionResponse.ok) {
          const sessionData = await sessionResponse.json();
          setSession(sessionData.session);
        }

        toast({
          title: 'Video uploaded successfully',
          description: 'Your editing session is ready',
        });

        // Add welcome message
        const welcomeMessage: Message = {
          id: `msg_${Date.now()}`,
          type: 'ai',
          content: `Welcome! I've loaded your video "${file.name}". You can now give me editing commands like:
          
• "Cut the video from 5 seconds to 15 seconds"
• "Add text 'Hello World' at 10 seconds"
• "Apply a fade effect at the beginning"
• "Enhance the video quality"

What would you like to do first?`,
          timestamp: new Date(),
        };
        setMessages([welcomeMessage]);
      }
    } catch (error) {
      console.error('Upload failed:', error);
      toast({
        title: 'Upload failed',
        description: error instanceof Error ? error.message : 'Please try again',
        variant: 'destructive',
      });
    } finally {
      setLoading(false);
    }
  }, [toast]);

  // Process AI command
  const handleAICommand = useCallback(async (command: string) => {
    if (!session) {
      toast({
        title: 'No active session',
        description: 'Please upload a video first',
        variant: 'destructive',
      });
      return;
    }

    setProcessingCommand(true);
    
    // Add user message
    const userMessage: Message = {
      id: `msg_${Date.now()}`,
      type: 'user',
      content: command,
      timestamp: new Date(),
    };
    setMessages(prev => [...prev, userMessage]);

    try {
      const response = await fetch('/api/revideo/ai-process-command', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          sessionId: session.sessionId,
          command,
          currentTime,
        }),
      });

      if (!response.ok) {
        throw new Error('Command processing failed');
      }

      const result = await response.json();
      
      if (result.success) {
        // Add AI response
        const aiMessage: Message = {
          id: `msg_${Date.now() + 1}`,
          type: 'ai',
          content: result.response,
          timestamp: new Date(),
          edits: result.edits || [],
          suggestions: result.suggestions || [],
        };
        setMessages(prev => [...prev, aiMessage]);

        // Add pending edits
        if (result.edits && result.edits.length > 0) {
          setPendingEdits(prev => [...prev, ...result.edits]);
        }
      }
    } catch (error) {
      console.error('Command processing failed:', error);
      const errorMessage: Message = {
        id: `msg_${Date.now() + 1}`,
        type: 'ai',
        content: `Sorry, I couldn't process that command. Please try rephrasing it or check your connection.`,
        timestamp: new Date(),
      };
      setMessages(prev => [...prev, errorMessage]);
    } finally {
      setProcessingCommand(false);
    }
  }, [session, currentTime, toast]);

  // Apply live edit
  const handleApplyEdit = useCallback(async (edit: LiveEditCommand) => {
    if (!session) return;

    try {
      const response = await fetch('/api/revideo/apply-live-edit', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          sessionId: session.sessionId,
          edit,
        }),
      });

      if (!response.ok) {
        throw new Error('Edit application failed');
      }

      const result = await response.json();
      
      if (result.success) {
        // Update video source to preview
        if (result.previewUrl) {
          setVideoUrl(result.previewUrl);
        }

        // Remove from pending and mark as applied
        setPendingEdits(prev => prev.filter(e => e.id !== edit.id));
        
        // Update session
        setSession(prev => prev ? {
          ...prev,
          commands: [...prev.commands, { ...edit, applied: true }],
          lastModified: new Date(),
        } : null);

        toast({
          title: 'Edit applied successfully',
          description: `${edit.type} edit has been applied to your video`,
        });
      }
    } catch (error) {
      console.error('Edit application failed:', error);
      toast({
        title: 'Edit failed',
        description: error instanceof Error ? error.message : 'Please try again',
        variant: 'destructive',
      });
    }
  }, [session, toast]);

  // Export video
  const handleExport = useCallback(async () => {
    if (!session) return;

    setLoading(true);
    try {
      const response = await fetch('/api/revideo/export-live-edit', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          sessionId: session.sessionId,
          exportFormat: 'mp4',
          quality: 'high',
        }),
      });

      if (!response.ok) {
        throw new Error('Export failed');
      }

      const result = await response.json();
      
      if (result.success && result.downloadUrl) {
        // Create download link
        const link = document.createElement('a');
        link.href = result.downloadUrl;
        link.download = result.filename || 'edited_video.mp4';
        document.body.appendChild(link);
        link.click();
        document.body.removeChild(link);

        toast({
          title: 'Video exported successfully',
          description: 'Your edited video has been downloaded',
        });
      }
    } catch (error) {
      console.error('Export failed:', error);
      toast({
        title: 'Export failed',
        description: error instanceof Error ? error.message : 'Please try again',
        variant: 'destructive',
      });
    } finally {
      setLoading(false);
    }
  }, [session, toast]);

  // Video player controls
  const togglePlayPause = useCallback(() => {
    if (videoRef.current) {
      if (isPlaying) {
        videoRef.current.pause();
      } else {
        videoRef.current.play();
      }
      setIsPlaying(!isPlaying);
    }
  }, [isPlaying]);

  const handleTimeUpdate = useCallback(() => {
    if (videoRef.current) {
      setCurrentTime(videoRef.current.currentTime);
    }
  }, []);

  const handleLoadedMetadata = useCallback(() => {
    if (videoRef.current) {
      setDuration(videoRef.current.duration);
    }
  }, []);

  // Send message
  const handleSendMessage = useCallback((e: React.FormEvent) => {
    e.preventDefault();
    if (inputMessage.trim() && !processingCommand) {
      handleAICommand(inputMessage.trim());
      setInputMessage('');
    }
  }, [inputMessage, processingCommand, handleAICommand]);

  return (
    <div className="min-h-screen bg-gradient-to-br from-slate-950 via-purple-950 to-slate-950 p-6">
      {/* Header */}
      <div className="mb-8">
        <h1 className="text-4xl font-bold bg-gradient-to-r from-cyan-300 via-purple-300 to-pink-300 bg-clip-text text-transparent mb-2">
          Live Video Editor
        </h1>
        <p className="text-gray-300">Upload a video and edit it in real-time with AI assistance</p>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6 h-[calc(100vh-200px)]">
        {/* Video Player Section */}
        <div className="lg:col-span-2 space-y-4">
          {/* Upload Area */}
          {!videoUrl && (
            <Card className="bg-slate-900/50 backdrop-blur-xl border-purple-500/20">
              <CardContent className="p-8">
                <div 
                  className="border-2 border-dashed border-purple-500/30 rounded-lg p-12 text-center cursor-pointer hover:border-purple-500/50 transition-colors"
                  onClick={() => fileInputRef.current?.click()}
                >
                  <Upload className="w-16 h-16 mx-auto mb-4 text-purple-400" />
                  <h3 className="text-xl font-semibold text-white mb-2">Upload Video</h3>
                  <p className="text-gray-400 mb-4">Click to upload or drag and drop your video file</p>
                  <p className="text-sm text-gray-500">Supports MP4, MOV, AVI up to 500MB</p>
                  <input
                    ref={fileInputRef}
                    type="file"
                    accept="video/*"
                    onChange={(e) => {
                      const file = e.target.files?.[0];
                      if (file) handleVideoUpload(file);
                    }}
                    className="hidden"
                  />
                </div>
              </CardContent>
            </Card>
          )}

          {/* Video Player */}
          {videoUrl && (
            <Card className="bg-slate-900/50 backdrop-blur-xl border-purple-500/20">
              <CardContent className="p-4">
                <div className="relative bg-black rounded-lg overflow-hidden">
                  <video
                    ref={videoRef}
                    src={videoUrl}
                    className="w-full h-auto"
                    onTimeUpdate={handleTimeUpdate}
                    onLoadedMetadata={handleLoadedMetadata}
                    onPlay={() => setIsPlaying(true)}
                    onPause={() => setIsPlaying(false)}
                  />
                  
                  {/* Video Controls with Drop Zone */}
                  <div 
                    className="absolute bottom-0 left-0 right-0 bg-gradient-to-t from-black/80 to-transparent p-4"
                    onDragOver={(e) => {
                      e.preventDefault();
                      e.currentTarget.style.background = 'linear-gradient(to top, rgba(147, 51, 234, 0.8), transparent)';
                    }}
                    onDragLeave={(e) => {
                      e.currentTarget.style.background = 'linear-gradient(to top, rgba(0, 0, 0, 0.8), transparent)';
                    }}
                    onDrop={(e) => {
                      e.preventDefault();
                      e.currentTarget.style.background = 'linear-gradient(to top, rgba(0, 0, 0, 0.8), transparent)';
                      
                      try {
                        const editData = JSON.parse(e.dataTransfer.getData('text/plain'));
                        if (editData && editData.id) {
                          handleApplyEdit(editData);
                          toast({
                            title: 'Edit applied!',
                            description: `${editData.type} edit has been applied to your video`,
                          });
                        }
                      } catch (error) {
                        console.error('Failed to apply dropped edit:', error);
                      }
                    }}
                  >
                    <div className="flex items-center gap-4">
                      <Button
                        size="sm"
                        variant="ghost"
                        onClick={togglePlayPause}
                        className="text-white hover:bg-white/20"
                      >
                        {isPlaying ? <Pause className="w-5 h-5" /> : <Play className="w-5 h-5" />}
                      </Button>
                      
                      <div className="flex-1">
                        <div className="text-xs text-white mb-1">
                          {Math.floor(currentTime)}s / {Math.floor(duration)}s
                        </div>
                        <div className="w-full bg-gray-600 h-1 rounded">
                          <div 
                            className="bg-purple-500 h-1 rounded transition-all"
                            style={{ width: `${(currentTime / duration) * 100}%` }}
                          />
                        </div>
                      </div>
                      
                      <div className="text-xs text-gray-300">
                        Drop edits here ⬇
                      </div>
                    </div>
                  </div>
                </div>

                {/* Applied Edits Timeline */}
                {session && session.commands.length > 0 && (
                  <div className="mt-4">
                    <h4 className="text-sm font-medium text-gray-300 mb-2">Applied Edits</h4>
                    <div className="flex flex-wrap gap-2">
                      {session.commands.map((cmd) => (
                        <Badge key={cmd.id} variant="secondary" className="bg-purple-600/20 text-purple-300">
                          {cmd.type} at {Math.floor(cmd.timestamp)}s
                        </Badge>
                      ))}
                    </div>
                  </div>
                )}

                {/* Pending Edits */}
                {pendingEdits.length > 0 && (
                  <div className="mt-4">
                    <h4 className="text-sm font-medium text-gray-300 mb-2 flex items-center gap-2">
                      <span className="w-2 h-2 bg-orange-400 rounded-full animate-pulse"></span>
                      Pending Edits ({pendingEdits.length})
                    </h4>
                    <div className="space-y-2">
                      {pendingEdits.map((edit, index) => (
                        <div 
                          key={`${edit.id}-${index}-${Date.now()}`} 
                          className="flex items-center justify-between p-3 bg-slate-800/50 rounded-lg border border-dashed border-purple-500/30 hover:border-purple-500/50 transition-all duration-200"
                          draggable={true}
                          onDragStart={(e) => {
                            e.dataTransfer.setData('text/plain', JSON.stringify(edit));
                            e.currentTarget.style.opacity = '0.5';
                          }}
                          onDragEnd={(e) => {
                            e.currentTarget.style.opacity = '1';
                          }}
                        >
                          <div>
                            <div className="text-sm font-medium text-white capitalize flex items-center gap-2">
                              <span className="w-2 h-2 bg-purple-400 rounded-full animate-pulse"></span>
                              {edit.type} Edit
                            </div>
                            <div className="text-xs text-gray-400">At {Math.floor(edit.timestamp)}s</div>
                            <div className="text-xs text-purple-300 mt-1">🎯 Drag to timeline or click Apply</div>
                          </div>
                          <Button
                            size="sm"
                            onClick={() => handleApplyEdit(edit)}
                            className="bg-purple-600 hover:bg-purple-700"
                          >
                            Apply
                          </Button>
                        </div>
                      ))}
                    </div>
                  </div>
                )}

                {/* Export Button */}
                {session && session.commands.length > 0 && (
                  <div className="mt-4 pt-4 border-t border-gray-700">
                    <Button
                      onClick={handleExport}
                      disabled={loading}
                      className="w-full bg-gradient-to-r from-cyan-600 to-purple-600 hover:from-cyan-700 hover:to-purple-700"
                    >
                      <Download className="w-4 h-4 mr-2" />
                      {loading ? 'Exporting...' : 'Export Video'}
                    </Button>
                  </div>
                )}
              </CardContent>
            </Card>
          )}
        </div>

        {/* AI Assistant Chat */}
        <div className="space-y-4">
          <Card className="bg-slate-900/50 backdrop-blur-xl border-purple-500/20 h-full flex flex-col">
            <CardHeader className="pb-3">
              <CardTitle className="flex items-center gap-2 text-white">
                <MessageSquare className="w-5 h-5 text-purple-400" />
                AI Assistant
              </CardTitle>
            </CardHeader>
            
            <CardContent className="flex-1 flex flex-col">
              {/* Messages */}
              <ScrollArea className="flex-1 pr-4 mb-4">
                <div className="space-y-3">
                  {messages.map((message) => (
                    <div
                      key={message.id}
                      className={`flex ${message.type === 'user' ? 'justify-end' : 'justify-start'}`}
                    >
                      <div
                        className={`max-w-[80%] p-3 rounded-lg ${
                          message.type === 'user'
                            ? 'bg-purple-600 text-white'
                            : 'bg-slate-800 text-gray-100'
                        }`}
                      >
                        <div className="text-sm whitespace-pre-wrap">{message.content}</div>
                        
                        {/* AI Suggestions */}
                        {message.suggestions && message.suggestions.length > 0 && (
                          <div className="mt-2 pt-2 border-t border-gray-600">
                            <div className="text-xs text-gray-400 mb-1">Suggestions:</div>
                            {message.suggestions.map((suggestion, idx) => (
                              <div key={idx} className="text-xs text-purple-300">• {suggestion}</div>
                            ))}
                          </div>
                        )}
                        
                        <div className="text-xs text-gray-400 mt-1">
                          {message.timestamp.toLocaleTimeString()}
                        </div>
                      </div>
                    </div>
                  ))}
                  
                  {processingCommand && (
                    <div className="flex justify-start">
                      <div className="bg-slate-800 text-gray-100 p-3 rounded-lg">
                        <div className="flex items-center gap-2">
                          <div className="w-2 h-2 bg-purple-400 rounded-full animate-ping"></div>
                          <span className="text-sm">Processing command...</span>
                        </div>
                      </div>
                    </div>
                  )}
                </div>
              </ScrollArea>

              {/* Quick Actions */}
              {session && (
                <div className="mb-4">
                  <div className="text-xs text-gray-400 mb-2">Quick Actions</div>
                  <div className="grid grid-cols-2 gap-2">
                    <Button
                      size="sm"
                      variant="outline"
                      onClick={() => handleAICommand('Cut the video from the current time')}
                      className="text-xs"
                    >
                      <Scissors className="w-3 h-3 mr-1" />
                      Cut
                    </Button>
                    <Button
                      size="sm"
                      variant="outline"
                      onClick={() => handleAICommand('Add text overlay')}
                      className="text-xs"
                    >
                      <Type className="w-3 h-3 mr-1" />
                      Text
                    </Button>
                    <Button
                      size="sm"
                      variant="outline"
                      onClick={() => handleAICommand('Enhance video quality')}
                      className="text-xs"
                    >
                      <Sparkles className="w-3 h-3 mr-1" />
                      Enhance
                    </Button>
                    <Button
                      size="sm"
                      variant="outline"
                      onClick={() => handleAICommand('Adjust audio levels')}
                      className="text-xs"
                    >
                      <Volume2 className="w-3 h-3 mr-1" />
                      Audio
                    </Button>
                  </div>
                </div>
              )}

              {/* Message Input */}
              <form onSubmit={handleSendMessage} className="flex gap-2">
                <Input
                  value={inputMessage}
                  onChange={(e) => setInputMessage(e.target.value)}
                  placeholder={session ? "Tell me what to edit..." : "Upload a video first"}
                  disabled={!session || processingCommand}
                  className="bg-slate-800 border-gray-600 text-white placeholder-gray-400"
                />
                <Button
                  type="submit"
                  size="icon"
                  disabled={!session || !inputMessage.trim() || processingCommand}
                  className="bg-purple-600 hover:bg-purple-700"
                >
                  <Send className="w-4 h-4" />
                </Button>
              </form>
            </CardContent>
          </Card>
        </div>
      </div>
    </div>
  );
}