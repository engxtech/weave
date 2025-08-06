import { useState, useRef } from "react";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Progress } from "@/components/ui/progress";
import { Badge } from "@/components/ui/badge";
import { Upload, Video, FileAudio, X, Eye, Brain, Zap } from "lucide-react";
import { useToast } from "@/hooks/use-toast";
import { apiRequest } from "@/lib/queryClient";

interface VideoAnalysisResult {
  transcript: string;
  scenes: any[];
  objects: any[];
  faces: any[];
  emotions: any[];
  quality: any;
  suggestions: string[];
}

interface VideoUploadProps {
  onAnalysisComplete: (analysis: VideoAnalysisResult) => void;
}

export default function VideoUpload({ onAnalysisComplete }: VideoUploadProps) {
  const [isDragging, setIsDragging] = useState(false);
  const [uploadProgress, setUploadProgress] = useState(0);
  const [isAnalyzing, setIsAnalyzing] = useState(false);
  const [analysisStage, setAnalysisStage] = useState<string>("");
  const fileInputRef = useRef<HTMLInputElement>(null);
  const { toast } = useToast();

  const handleDragOver = (e: React.DragEvent) => {
    e.preventDefault();
    setIsDragging(true);
  };

  const handleDragLeave = (e: React.DragEvent) => {
    e.preventDefault();
    setIsDragging(false);
  };

  const handleDrop = (e: React.DragEvent) => {
    e.preventDefault();
    setIsDragging(false);
    
    const files = Array.from(e.dataTransfer.files);
    if (files.length > 0) {
      handleFileUpload(files[0]);
    }
  };

  const handleFileSelect = (e: React.ChangeEvent<HTMLInputElement>) => {
    const files = e.target.files;
    if (files && files.length > 0) {
      handleFileUpload(files[0]);
    }
  };

  const handleFileUpload = async (file: File) => {
    // Validate file type
    const allowedTypes = ['video/mp4', 'video/mov', 'video/avi', 'audio/mp3', 'audio/wav'];
    if (!allowedTypes.includes(file.type)) {
      toast({
        title: "Invalid file type",
        description: "Please upload a video (MP4, MOV, AVI) or audio (MP3, WAV) file.",
        variant: "destructive"
      });
      return;
    }

    // Validate file size (100MB limit)
    if (file.size > 100 * 1024 * 1024) {
      toast({
        title: "File too large",
        description: "Please upload a file smaller than 100MB.",
        variant: "destructive"
      });
      return;
    }

    setIsAnalyzing(true);
    setUploadProgress(0);
    setAnalysisStage("Uploading file...");

    try {
      const formData = new FormData();
      formData.append('video', file);

      // Simulate upload progress
      const progressInterval = setInterval(() => {
        setUploadProgress(prev => {
          if (prev >= 90) {
            clearInterval(progressInterval);
            return prev;
          }
          return prev + 10;
        });
      }, 200);

      setAnalysisStage("Processing with Gemini AI...");

      const response = await fetch('/api/upload', {
        method: 'POST',
        body: formData,
      });

      clearInterval(progressInterval);
      setUploadProgress(100);

      if (!response.ok) {
        throw new Error('Upload failed');
      }

      const result = await response.json();
      
      setAnalysisStage("Analysis complete!");
      
      setTimeout(() => {
        onAnalysisComplete(result.analysis);
        toast({
          title: "Video analyzed successfully",
          description: "Your video has been processed and is ready for editing.",
        });
      }, 1000);

    } catch (error) {
      console.error('Upload error:', error);
      toast({
        title: "Upload failed",
        description: "There was an error analyzing your video. Please try again.",
        variant: "destructive"
      });
    } finally {
      setTimeout(() => {
        setIsAnalyzing(false);
        setUploadProgress(0);
        setAnalysisStage("");
      }, 2000);
    }
  };

  const analysisFeatures = [
    {
      icon: Brain,
      title: "Scene Detection",
      description: "Automatically identify scene changes and key moments"
    },
    {
      icon: Eye,
      title: "Object Recognition",
      description: "Detect and track objects throughout your video"
    },
    {
      icon: Zap,
      title: "Emotion Analysis",
      description: "Analyze facial expressions and emotional content"
    }
  ];

  return (
    <Card className="w-full max-w-2xl mx-auto">
      <CardHeader>
        <CardTitle className="flex items-center gap-2 text-xl font-semibold text-google-text">
          <Video className="w-6 h-6 text-google-blue" />
          Upload & Analyze Video
        </CardTitle>
        <CardDescription>
          Upload your video for AI-powered analysis and automated workflow generation
        </CardDescription>
      </CardHeader>
      <CardContent className="space-y-6">
        {!isAnalyzing ? (
          <>
            {/* Upload Area */}
            <div
              className={`border-2 border-dashed rounded-lg p-8 text-center transition-colors ${
                isDragging 
                  ? 'border-google-blue bg-blue-50' 
                  : 'border-gray-300 hover:border-google-blue hover:bg-gray-50'
              }`}
              onDragOver={handleDragOver}
              onDragLeave={handleDragLeave}
              onDrop={handleDrop}
              onClick={() => fileInputRef.current?.click()}
            >
              <div className="flex flex-col items-center space-y-4">
                <div className="w-16 h-16 bg-google-blue rounded-full flex items-center justify-center">
                  <Upload className="w-8 h-8 text-white" />
                </div>
                <div>
                  <p className="text-lg font-medium text-google-text">
                    Drop your video here or click to browse
                  </p>
                  <p className="text-sm text-gray-500 mt-1">
                    Supports MP4, MOV, AVI, MP3, WAV (max 100MB)
                  </p>
                </div>
                <Button className="bg-google-blue hover:bg-blue-600 text-white">
                  <Upload className="w-4 h-4 mr-2" />
                  Choose File
                </Button>
              </div>
            </div>

            <input
              ref={fileInputRef}
              type="file"
              accept="video/*,audio/*"
              onChange={handleFileSelect}
              className="hidden"
            />

            {/* Analysis Features */}
            <div className="space-y-4">
              <h3 className="font-medium text-google-text">AI Analysis Features</h3>
              <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                {analysisFeatures.map((feature, index) => (
                  <div key={index} className="p-4 border border-gray-200 rounded-lg hover:bg-gray-50 transition-colors">
                    <div className="flex items-center space-x-3">
                      <div className="w-8 h-8 bg-google-blue rounded-lg flex items-center justify-center">
                        <feature.icon className="w-4 h-4 text-white" />
                      </div>
                      <div className="flex-1">
                        <h4 className="font-medium text-sm text-google-text">{feature.title}</h4>
                        <p className="text-xs text-gray-600 mt-1">{feature.description}</p>
                      </div>
                    </div>
                  </div>
                ))}
              </div>
            </div>
          </>
        ) : (
          /* Analysis Progress */
          <div className="space-y-6">
            <div className="text-center">
              <div className="w-16 h-16 bg-google-blue rounded-full flex items-center justify-center mx-auto mb-4">
                <Brain className="w-8 h-8 text-white animate-pulse" />
              </div>
              <h3 className="text-lg font-medium text-google-text mb-2">Analyzing Your Video</h3>
              <p className="text-sm text-gray-600">{analysisStage}</p>
            </div>

            <div className="space-y-2">
              <div className="flex justify-between text-sm">
                <span className="text-gray-600">Progress</span>
                <span className="text-google-blue font-medium">{uploadProgress}%</span>
              </div>
              <Progress value={uploadProgress} className="h-2" />
            </div>

            <div className="grid grid-cols-3 gap-4">
              {['Uploading', 'Processing', 'Complete'].map((stage, index) => (
                <div key={stage} className="text-center">
                  <div className={`w-3 h-3 rounded-full mx-auto mb-2 ${
                    uploadProgress > index * 33 ? 'bg-google-blue' : 'bg-gray-300'
                  }`} />
                  <p className="text-xs text-gray-600">{stage}</p>
                </div>
              ))}
            </div>
          </div>
        )}
      </CardContent>
    </Card>
  );
}