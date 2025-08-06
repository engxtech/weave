import React, { useState } from 'react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Upload, FileVideo, ArrowLeft } from 'lucide-react';
import { Link } from 'wouter';
import { AIShortsCreation } from '@/components/ai-shorts-creation';
import { useMutation } from '@tanstack/react-query';
import { useToast } from '@/hooks/use-toast';

export default function AIShortsPage() {
  const [selectedFile, setSelectedFile] = useState<File | null>(null);
  const [videoPath, setVideoPath] = useState<string | null>(null);
  const [uploadProgress, setUploadProgress] = useState(0);
  const { toast } = useToast();

  const uploadMutation = useMutation({
    mutationFn: async (file: File) => {
      const formData = new FormData();
      formData.append('video', file);
      
      const response = await fetch('/api/upload', {
        method: 'POST',
        body: formData
      });
      
      if (!response.ok) throw new Error('Upload failed');
      return response.json();
    },
    onSuccess: (data) => {
      setVideoPath(data.videoUrl);
      setUploadProgress(0);
      toast({
        title: "Video uploaded successfully",
        description: "Ready for AI shorts generation"
      });
    },
    onError: () => {
      setUploadProgress(0);
      toast({
        title: "Upload failed",
        description: "Please try again",
        variant: "destructive"
      });
    }
  });

  const handleFileUpload = (event: React.ChangeEvent<HTMLInputElement>) => {
    const file = event.target.files?.[0];
    if (file) {
      if (file.type.startsWith('video/')) {
        setSelectedFile(file);
        setUploadProgress(10);
        uploadMutation.mutate(file);
      } else {
        toast({
          title: "Invalid file type",
          description: "Please select a video file",
          variant: "destructive"
        });
      }
    }
  };

  return (
    <div className="min-h-screen bg-gray-50">
      {/* Header */}
      <header className="bg-white border-b border-gray-200 shadow-sm">
        <div className="max-w-7xl mx-auto px-6 py-4">
          <div className="flex items-center justify-between">
            <div className="flex items-center space-x-4">
              <Link href="/">
                <Button variant="ghost" size="sm">
                  <ArrowLeft className="w-4 h-4 mr-2" />
                  Back to Home
                </Button>
              </Link>
              <div className="w-10 h-10 bg-gradient-to-r from-purple-600 to-pink-600 rounded-lg flex items-center justify-center">
                <FileVideo className="w-6 h-6 text-white" />
              </div>
              <div>
                <h1 className="text-2xl font-bold text-gray-900">
                  AI Shorts Creator
                </h1>
                <p className="text-sm text-gray-600">
                  Generate viral shorts with AI-powered analysis and focus tracking
                </p>
              </div>
            </div>
            
            <div className="flex items-center space-x-2">
              <Badge variant="secondary" className="bg-purple-100 text-purple-800">
                Powered by Gemini AI
              </Badge>
            </div>
          </div>
        </div>
      </header>

      <div className="max-w-6xl mx-auto p-6 space-y-6">
        {/* Video Upload Section */}
        {!videoPath && (
          <Card>
            <CardHeader>
              <CardTitle className="flex items-center">
                <Upload className="mr-2 h-5 w-5" />
                Upload Video for AI Analysis
              </CardTitle>
            </CardHeader>
            <CardContent>
              <div className="border-2 border-dashed border-gray-300 rounded-lg p-8 text-center">
                <Upload className="mx-auto h-12 w-12 text-gray-400 mb-4" />
                <div className="space-y-2">
                  <label htmlFor="video-upload" className="text-lg font-medium cursor-pointer">
                    Choose video file
                  </label>
                  <p className="text-sm text-gray-500">
                    Supports MP4, MOV, AVI and more. AI will analyze for best moments.
                  </p>
                  <input
                    id="video-upload"
                    type="file"
                    accept="video/*"
                    onChange={handleFileUpload}
                    className="hidden"
                  />
                </div>
                {selectedFile && (
                  <div className="mt-4 p-3 bg-purple-50 rounded-lg">
                    <p className="text-sm font-medium">{selectedFile.name}</p>
                    <p className="text-xs text-gray-500">
                      {(selectedFile.size / 1024 / 1024).toFixed(2)} MB
                    </p>
                    {uploadMutation.isPending && (
                      <div className="mt-2">
                        <div className="w-full bg-gray-200 rounded-full h-2">
                          <div 
                            className="bg-purple-600 h-2 rounded-full transition-all duration-300"
                            style={{ width: `${uploadProgress}%` }}
                          />
                        </div>
                        <p className="text-xs text-gray-500 mt-1">Uploading...</p>
                      </div>
                    )}
                  </div>
                )}
              </div>
            </CardContent>
          </Card>
        )}

        {/* Video Preview */}
        {videoPath && (
          <Card>
            <CardHeader>
              <CardTitle className="flex items-center justify-between">
                <span className="flex items-center">
                  <FileVideo className="mr-2 h-5 w-5" />
                  Uploaded Video
                </span>
                <Button
                  variant="outline"
                  size="sm"
                  onClick={() => {
                    setVideoPath(null);
                    setSelectedFile(null);
                  }}
                >
                  Upload Different Video
                </Button>
              </CardTitle>
            </CardHeader>
            <CardContent>
              <div className="bg-black rounded-lg overflow-hidden">
                <video
                  src={videoPath}
                  controls
                  className="w-full max-h-96 object-contain"
                  style={{ aspectRatio: '16/9' }}
                />
              </div>
              <div className="mt-3 text-center">
                <Badge variant="outline" className="bg-green-50 text-green-700 border-green-200">
                  Ready for AI analysis
                </Badge>
              </div>
            </CardContent>
          </Card>
        )}

        {/* AI Shorts Creation Interface */}
        {videoPath && (
          <AIShortsCreation
            videoPath={videoPath}
            onShortsGenerated={(result) => {
              console.log('Shorts generated:', result);
            }}
          />
        )}
      </div>
    </div>
  );
}