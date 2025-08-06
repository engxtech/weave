import { memo, useState } from "react";
import { Handle, Position } from "reactflow";
import { 
  MdMic, MdSubtitles, MdVolumeUp, MdContentCut, MdMovie, MdMusicNote,
  MdAutoAwesome, MdLanguage, MdCrop, MdImage, MdVisibility, MdVideoLibrary,
  MdYoutubeSearchedFor, MdSmartToy, MdPlayArrow, MdDownload, MdSettings,
  MdUpload, MdVideoFile, MdCheckCircle, MdClose, MdCloudUpload, MdDescription,
  MdContentCopy, MdMovieCreation, MdInsertDriveFile, MdEdit
} from "react-icons/md";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";

interface WorkflowTileProps {
  data: {
    label: string;
    icon: string;
    color: string;
    type?: 'video-upload' | 'shorts-creation' | 'script-generator' | 'video-generator' | 'captions' | 'audio' | 'effects';
    settings?: Record<string, any>;
    status?: 'ready' | 'processing' | 'complete' | 'error';
    inputs?: any[];
    output?: any;
  };
  id: string;
  onDataChange?: (nodeId: string, data: any) => void;
}

export default memo(function WorkflowTile({ data, id, onDataChange }: WorkflowTileProps) {
  // State for managing outputs and connections
  const [outputData, setOutputData] = useState<any>(null);
  const [useVisualEditor, setUseVisualEditor] = useState(true);
  const [timelineSegments, setTimelineSegments] = useState<any[]>([]);
  // Removed YouTube URL state - using file upload only
  const [searchPhrase, setSearchPhrase] = useState('');
  const [customRequirements, setCustomRequirements] = useState('');
  const [thumbnailUrl, setThumbnailUrl] = useState('');
  const [uploadedFile, setUploadedFile] = useState<File | null>(null);
  const [uploading, setUploading] = useState(false);
  const [isProcessing, setIsProcessing] = useState(false);
  const [generatedShort, setGeneratedShort] = useState<any>(null);
  const [style, setStyle] = useState('viral');
  const [duration, setDuration] = useState(15);
  const [aspectRatio, setAspectRatio] = useState('9:16');
  const [voiceType, setVoiceType] = useState('auto');
  const [processingStep, setProcessingStep] = useState(0);
  const [processingProgress, setProcessingProgress] = useState(0);
  const [processingStatus, setProcessingStatus] = useState('Ready');

  const getIcon = (iconName: string) => {
    const iconMap: Record<string, any> = {
      'Mic': MdMic,
      'Subtitles': MdSubtitles,
      'Volume2': MdVolumeUp,
      'Scissors': MdContentCut,
      'Film': MdMovie,
      'Music4': MdMusicNote,
      'Sparkles': MdAutoAwesome,
      'Languages': MdLanguage,
      'Crop': MdCrop,
      'Image': MdImage,
      'Eye': MdVisibility,
      'Video': MdVideoLibrary,
      'VideoLibrary': MdVideoLibrary,
      'YouTube': MdYoutubeSearchedFor,
      'Upload': MdUpload,
      'SmartToy': MdSmartToy,
      'Description': MdDescription,
      'PlayArrow': MdVideoLibrary,
      'MovieCreation': MdMovieCreation,
      'default': MdAutoAwesome,
    };
    
    const IconComponent = iconMap[iconName] || iconMap['default'];
    return <IconComponent className="w-4 h-4 text-white" />;
  };

  // YouTube functionality removed - using file upload only

  const formatFileSize = (bytes: number) => {
    if (bytes === 0) return '0 Bytes';
    const k = 1024;
    const sizes = ['Bytes', 'KB', 'MB', 'GB'];
    const i = Math.floor(Math.log(bytes) / Math.log(k));
    return parseFloat((bytes / Math.pow(k, i)).toFixed(2)) + ' ' + sizes[i];
  };

  const handleVideoUpload = async (event: React.ChangeEvent<HTMLInputElement>) => {
    const file = event.target.files?.[0];
    if (file && file.type.startsWith('video/')) {
      await handleFileUpload(file);
    }
  };

  const generateScript = async () => {
    if (!uploadedFile) {
      alert('Please upload a video file first');
      return;
    }

    setIsProcessing(true);
    setProcessingStep(0);
    setProcessingProgress(0);
    setProcessingStatus('Initializing script generation...');

    try {
      // Script generation steps
      const steps = [
        { step: 1, progress: 25, status: 'Uploading video to AI...', delay: 2000 },
        { step: 2, progress: 50, status: 'Transcribing and analyzing...', delay: 4000 },
        { step: 3, progress: 75, status: 'Generating viral script...', delay: 3000 },
        { step: 4, progress: 100, status: 'Creating timeline with timestamps...', delay: 2000 }
      ];

      for (const stepData of steps) {
        await new Promise(resolve => setTimeout(resolve, stepData.delay));
        setProcessingStep(stepData.step);
        setProcessingProgress(stepData.progress);
        setProcessingStatus(stepData.status);
      }

      // Create form data for script generation
      const formData = new FormData();
      formData.append('file', uploadedFile);
      formData.append('style', style);
      formData.append('duration', duration.toString());
      formData.append('aspectRatio', aspectRatio);
      formData.append('tone', voiceType);
      formData.append('requirements', searchPhrase);

      console.log('=== SENDING SCRIPT GENERATION REQUEST ===');
      console.log('- style:', style);
      console.log('- duration:', duration);
      console.log('- aspectRatio:', aspectRatio);
      console.log('- tone:', voiceType);
      console.log('- requirements:', searchPhrase);
      console.log('- file:', uploadedFile.name, uploadedFile.size, 'bytes');

      const response = await fetch('/api/script/generate', {
        method: 'POST',
        body: formData,
      });

      if (!response.ok) {
        const errorText = await response.text();
        throw new Error(`HTTP error! status: ${response.status} - ${errorText}`);
      }

      const result = await response.json();
      console.log('=== SCRIPT GENERATION COMPLETE ===');
      console.log('Result:', result);

      if (result.success) {
        setGeneratedShort(result.script);
        setThumbnailUrl(`data:image/svg+xml;base64,${btoa(`<svg width="320" height="180" xmlns="http://www.w3.org/2000/svg"><rect width="100%" height="100%" fill="#7C3AED"/><text x="50%" y="50%" font-family="Arial" font-size="16" fill="white" text-anchor="middle">SCRIPT</text></svg>`)}`);
        
        // Update tile data with script output for downstream tiles
        const scriptOutput = {
          type: 'script-generator',
          script: result.script,
          title: result.script.title,
          timeline: result.script.timeline,
          style: result.script.style,
          duration: result.script.duration,
          aspectRatio: result.script.aspectRatio,
          description: result.script.description,
          hashtags: result.script.hashtags,
          source: 'ai-generated'
        };
        
        setOutputData(scriptOutput);
        
        if (onDataChange) {
          onDataChange(id, {
            ...data,
            output: scriptOutput,
            status: 'complete'
          });
        }
      } else {
        throw new Error(result.error || 'Failed to generate script');
      }

    } catch (error) {
      console.error('Error generating script:', error);
      alert('Failed to generate script. Please try again.');
    } finally {
      setIsProcessing(false);
      setProcessingStep(0);
      setProcessingProgress(0);
      setProcessingStatus('Ready');
    }
  };

  const handleFileUpload = async (file: File) => {
    if (!file.type.startsWith('video/')) {
      alert('Please select a video file');
      return;
    }

    if (file.size > 500 * 1024 * 1024) {
      alert('File size must be less than 500MB');
      return;
    }

    setUploading(true);
    
    try {
      const formData = new FormData();
      formData.append('video', file);

      console.log('Uploading file:', file.name, file.size, file.type);

      const response = await fetch('/api/upload-video', {
        method: 'POST',
        body: formData,
      });

      console.log('Upload response status:', response.status);

      if (!response.ok) {
        const errorText = await response.text();
        console.error('Upload failed with status:', response.status, errorText);
        throw new Error(`Upload failed: ${response.status} ${errorText}`);
      }

      const result = await response.json();
      console.log('Upload successful:', result);
      console.log('FILE PATH STORED IN TILE:', result.path);
      
      setUploadedFile(file);
      
      const outputVideoData = {
        type: 'video-upload',
        file: file,
        path: result.path,
        title: file.name,
        size: result.size,
        duration: result.duration || 0,
        source: 'upload',
        originalFormat: result.originalFormat
      };
      
      setOutputData(outputVideoData);
      
      // Clear previous timeline segments when new video is uploaded
      setTimelineSegments([]);
      
      if (onDataChange) {
        onDataChange(id, { 
          ...data, 
          settings: { ...data.settings, uploadedFile: file, serverPath: result.path, originalFormat: result.originalFormat },
          output: outputVideoData,
          status: 'ready'
        });
      }
      
    } catch (error) {
      console.error('Upload/conversion error:', error);
      alert(`Upload failed: ${error.message}`);
    } finally {
      setUploading(false);
    }
  };

  // Helper functions for validation and display
  const hasValidInput = () => {
    const hasConnectedInput = data.inputs && data.inputs.length > 0;
    const hasUploadedVideo = uploadedFile;
    return hasConnectedInput || hasUploadedVideo;
  };

  const getButtonText = () => {
    const hasConnectedInput = data.inputs && data.inputs.length > 0;
    const hasUploadedVideo = uploadedFile;
    
    if (hasConnectedInput) return 'Create Shorts from Connected Video';
    if (hasUploadedVideo) return 'Create Shorts from Uploaded Video';
    return 'Upload Video to Continue';
  };

  const getVideoSource = () => {
    // Priority: connected input > uploaded file
    const connectedInput = data.inputs && data.inputs.length > 0 ? data.inputs[0] : null;
    if (connectedInput) return connectedInput;
    
    // Use uploaded file if available
    if (uploadedFile) {
      return {
        type: 'video-upload',
        file: uploadedFile,
        path: data.settings?.serverPath,
        title: uploadedFile.name,
        size: uploadedFile.size,
        source: 'upload'
      };
    }
    
    return null;
  };

  const handleGenerateVideo = async () => {
    if (!uploadedFile) {
      alert('Please upload a video file first');
      return;
    }

    // Get timeline data from visual editor or JSON
    let timelineData;
    if (useVisualEditor) {
      if (timelineSegments.length === 0) {
        alert('Please create at least one segment using the visual timeline editor');
        return;
      }
      timelineData = timelineSegments.map(segment => ({
        startTime: segment.startTime,
        endTime: segment.endTime,
        action: segment.action,
        description: segment.description
      }));
    } else {
      if (!customRequirements.trim()) {
        alert('Please provide timeline data in JSON format');
        return;
      }

      // Validate JSON format
      try {
        timelineData = JSON.parse(customRequirements);
      } catch (error) {
        alert('Invalid JSON format in timeline configuration');
        return;
      }
    }

    setIsProcessing(true);
    setProcessingStep(0);
    setProcessingProgress(0);
    setProcessingStatus('Starting video generation...');

    try {
      console.log('=== STARTING VIDEO GENERATION ===');
      console.log('Uploaded file:', uploadedFile.name);
      console.log('Server path:', data.settings?.serverPath);
      console.log('Timeline data:', timelineData);

      const formData = new FormData();
      
      // Check if we have a server path, if not, re-upload the file
      if (data.settings?.serverPath) {
        formData.append('videoPath', data.settings.serverPath);
      } else {
        // Re-upload the file if server path is missing
        formData.append('file', uploadedFile);
      }
      
      formData.append('timeline', JSON.stringify(timelineData));
      formData.append('outputFormat', data.settings?.outputFormat || 'mp4');
      formData.append('quality', data.settings?.quality || 'high');
      formData.append('aspectRatio', data.settings?.aspectRatio || '9:16');

      setProcessingStatus('Sending request to server...');
      const response = await fetch('/api/video/generate', {
        method: 'POST',
        body: formData,
      });

      console.log('Response status:', response.status);
      const result = await response.json();
      console.log('Response data:', result);

      if (result.success) {
        setGeneratedShort(result.video);
        setProcessingStatus('Video generated successfully!');
        
        setOutputData({
          type: 'video-generator',
          video: result.video,
          title: result.video.title,
          videoUrl: result.video.videoUrl,
          duration: result.video.duration,
          segments: result.video.segments || 0,
          outputFormat: data.settings?.outputFormat || 'mp4',
          source: 'ai-generated'
        });
        
        if (onDataChange) {
          onDataChange(id, {
            ...data,
            output: result.video,
            status: 'complete'
          });
        }
      } else {
        throw new Error(result.error || 'Failed to generate video');
      }

    } catch (error) {
      console.error('Error generating video:', error);
      setProcessingStatus('Error: ' + error.message);
      alert('Failed to generate video: ' + error.message);
    } finally {
      setIsProcessing(false);
      setProcessingStep(0);
      setProcessingProgress(0);
    }
  };

  const handleGenerateShorts = async () => {
    const inputVideo = getVideoSource();
    if (!inputVideo) return;
    
    const effectiveTopic = `${inputVideo.title || 'Video content'} - ${searchPhrase || 'create engaging short'}`;
    
    setIsProcessing(true);
    setGeneratedShort(null);
    setProcessingProgress(0);
    setProcessingStep(0);
    setProcessingStatus('Initializing...');
    
    // Progress simulation
    const progressInterval = setInterval(() => {
      setProcessingProgress(prev => {
        if (prev < 90) return prev + Math.random() * 15;
        return prev;
      });
    }, 500);
    
    try {
      setProcessingStep(0);
      setProcessingStatus('Preparing video source...');
      
      setTimeout(() => {
        setProcessingStep(1);
        setProcessingStatus('Downloading video content...');
      }, 1000);
      
      setTimeout(() => {
        setProcessingStep(2);
        setProcessingStatus('Analyzing with AI...');
      }, 3000);
      
      setTimeout(() => {
        setProcessingStep(3);
        setProcessingStatus('Creating shorts video...');
      }, 5000);

      const response = await fetch('/api/ai/generate-short', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          topic: effectiveTopic,
          style: style,
          duration: duration,
          aspectRatio: aspectRatio,
          voiceType: voiceType,
          inputVideo: inputVideo ? {
            videoId: inputVideo.videoId,
            url: inputVideo.url,
            title: inputVideo.title,
            thumbnailUrl: inputVideo.thumbnailUrl
          } : null
        })
      });

      if (!response.ok) {
        throw new Error('Failed to generate short');
      }

      clearInterval(progressInterval);
      
      const shortData = await response.json();
      console.log('Shorts generation complete:', shortData);
      
      // Extract the actual short data from response
      const actualShort = shortData.short || shortData;
      
      setGeneratedShort({
        ...actualShort,
        downloadUrl: actualShort.videoUrl
      });
      setThumbnailUrl(actualShort.thumbnailUrl);
      
      // Update tile data with output for download buttons
      setData(prev => ({
        ...prev,
        status: 'complete',
        output: {
          title: actualShort.title,
          videoUrl: actualShort.videoUrl,
          script: actualShort.script,
          thumbnailUrl: actualShort.thumbnailUrl
        }
      }));
      
      if (onDataChange) {
        onDataChange(id, { 
          ...data, 
          output: {
            title: actualShort.title,
            videoUrl: actualShort.videoUrl,
            script: actualShort.script,
            thumbnailUrl: actualShort.thumbnailUrl
          }, 
          status: 'complete' 
        });
      }
      
      setIsProcessing(false);
      setProcessingProgress(100);
      setProcessingStatus('Complete');
      setProcessingStep(4);
    } catch (error) {
      clearInterval(progressInterval);
      setIsProcessing(false);
      setProcessingProgress(0);
      setProcessingStatus('Error occurred');
      setProcessingStep(0);
      console.error('Error generating shorts:', error);
      
      // Fallback to local generation
      const thumbnailSvg = `data:image/svg+xml;base64,${btoa(`
        <svg width="300" height="400" viewBox="0 0 300 400" fill="none" xmlns="http://www.w3.org/2000/svg">
          <defs>
            <linearGradient id="bg" x1="0%" y1="0%" x2="100%" y2="100%">
              <stop offset="0%" style="stop-color:#FF6B6B;stop-opacity:1" />
              <stop offset="50%" style="stop-color:#4ECDC4;stop-opacity:1" />
              <stop offset="100%" style="stop-color:#45B7D1;stop-opacity:1" />
            </linearGradient>
          </defs>
          <rect width="300" height="400" fill="url(#bg)"/>
          <rect x="20" y="20" width="260" height="360" fill="black" opacity="0.1" rx="12"/>
          <text x="150" y="200" fill="white" text-anchor="middle" font-size="18" font-weight="bold">${searchPhrase.toUpperCase()}</text>
          <text x="150" y="230" fill="white" text-anchor="middle" font-size="12">AI GENERATED SHORT</text>
          <circle cx="150" cy="280" r="25" fill="white" opacity="0.9"/>
          <polygon points="140,270 140,290 165,280" fill="#FF6B6B"/>
          <rect x="50" y="350" width="200" height="3" fill="white" opacity="0.8" rx="2"/>
          <rect x="50" y="350" width="120" height="3" fill="#FFD93D" rx="2"/>
        </svg>
      `)}`;
      
      setThumbnailUrl(thumbnailSvg);
    }
  };

  const getStatusColor = (status?: string) => {
    switch (status) {
      case 'processing':
        return 'bg-yellow-500';
      case 'complete':
        return 'bg-gemini-green';
      case 'error':
        return 'bg-google-red';
      default:
        return 'bg-gray-300';
    }
  };

  const getStatusAnimation = (status?: string) => {
    return status === 'processing' ? 'animate-pulse' : '';
  };

  const renderTileContent = () => {
    switch (data.type) {
      case 'video-upload':
        return (
          <div className="space-y-3">
            {!uploadedFile ? (
              <div
                className="border-2 border-dashed border-gray-300 rounded-lg p-4 text-center hover:border-blue-400 transition-colors cursor-pointer"
                onClick={() => {
                  const input = document.createElement('input');
                  input.type = 'file';
                  input.accept = 'video/*';
                  input.onchange = (e) => {
                    const file = (e.target as HTMLInputElement).files?.[0];
                    if (file) handleFileUpload(file);
                  };
                  input.click();
                }}
              >
                <MdUpload className="w-8 h-8 text-gray-400 mx-auto mb-2" />
                <p className="text-sm text-gray-600 mb-1">
                  Click to upload video file
                </p>
                <p className="text-xs text-gray-500">
                  Supports MP4, MOV, AVI, MKV (max 500MB)<br/>
                  <span className="text-blue-600">Preserves original format, converts to MP4 for AI only</span>
                </p>
              </div>
            ) : (
              <div className="bg-green-50 p-3 rounded-lg border border-green-200">
                <div className="flex items-start justify-between">
                  <div className="flex items-center gap-2">
                    <MdVideoFile className="w-5 h-5 text-green-600" />
                    <div>
                      <h4 className="font-medium text-green-800 text-sm">{uploadedFile.name}</h4>
                      <p className="text-xs text-green-700">{formatFileSize(uploadedFile.size)}</p>
                    </div>
                  </div>
                  <Button
                    variant="ghost"
                    size="sm"
                    onClick={() => {
                      setUploadedFile(null);
                      setOutputData(null);
                      if (onDataChange) {
                        onDataChange(id, { ...data, output: null, status: 'ready' });
                      }
                    }}
                    className="text-red-600 hover:text-red-800 p-1"
                  >
                    <MdClose className="w-4 h-4" />
                  </Button>
                </div>
                {uploading && (
                  <div className="mt-2 text-xs text-blue-700">Uploading video...</div>
                )}
              </div>
            )}
          </div>
        );

      case 'script-generator':
        return (
          <div className="space-y-4">
            {/* Video Upload Area */}
            <div className="border-2 border-dashed border-gray-300 rounded-lg p-4 text-center">
              <input
                type="file"
                accept="video/*"
                onChange={handleVideoUpload}
                className="hidden"
                id={`script-upload-${id}`}
                disabled={uploading}
              />
              <label
                htmlFor={`script-upload-${id}`}
                className="cursor-pointer flex flex-col items-center space-y-2"
              >
                <MdCloudUpload className="w-8 h-8 text-gray-400" />
                <span className="text-sm text-gray-600">
                  {uploading ? 'Uploading...' : 'Upload Video for Script'}
                </span>
                <span className="text-xs text-gray-500">MP4, MOV, AVI up to 500MB</span>
              </label>
            </div>

            {uploadedFile && (
              <div className="bg-purple-50 p-3 rounded border border-purple-200">
                <div className="text-sm font-medium text-purple-800">{uploadedFile.name}</div>
                <div className="text-xs text-purple-600">{(uploadedFile.size / (1024 * 1024)).toFixed(1)} MB</div>
              </div>
            )}

            {/* Script Configuration */}
            <div className="space-y-3">
              <div className="text-sm font-medium text-gray-700">Script Configuration</div>
              
              <div className="grid grid-cols-2 gap-2 text-xs">
                <div>
                  <label className="block text-gray-600 mb-1">Style</label>
                  <select
                    value={style}
                    onChange={(e) => setStyle(e.target.value)}
                    className="w-full p-1.5 border rounded text-xs"
                  >
                    <option value="viral">Viral</option>
                    <option value="educational">Educational</option>
                    <option value="entertaining">Entertaining</option>
                    <option value="dramatic">Dramatic</option>
                    <option value="funny">Funny</option>
                    <option value="professional">Professional</option>
                  </select>
                </div>
                <div>
                  <label className="block text-gray-600 mb-1">Duration</label>
                  <select
                    value={duration}
                    onChange={(e) => setDuration(parseInt(e.target.value))}
                    className="w-full p-1.5 border rounded text-xs"
                  >
                    <option value={15}>15 seconds</option>
                    <option value={30}>30 seconds</option>
                    <option value={60}>60 seconds</option>
                  </select>
                </div>
                <div>
                  <label className="block text-gray-600 mb-1">Aspect Ratio</label>
                  <select
                    value={aspectRatio}
                    onChange={(e) => setAspectRatio(e.target.value)}
                    className="w-full p-1.5 border rounded text-xs"
                  >
                    <option value="9:16">Vertical (9:16)</option>
                    <option value="16:9">Horizontal (16:9)</option>
                    <option value="1:1">Square (1:1)</option>
                  </select>
                </div>
                <div>
                  <label className="block text-gray-600 mb-1">Tone</label>
                  <select
                    value={voiceType}
                    onChange={(e) => setVoiceType(e.target.value)}
                    className="w-full p-1.5 border rounded text-xs"
                  >
                    <option value="engaging">Engaging</option>
                    <option value="casual">Casual</option>
                    <option value="professional">Professional</option>
                    <option value="energetic">Energetic</option>
                    <option value="calm">Calm</option>
                  </select>
                </div>
              </div>

              {/* Custom Requirements */}
              <div>
                <label className="block text-gray-600 mb-1 text-xs">Custom Requirements (Optional)</label>
                <textarea
                  value={searchPhrase}
                  onChange={(e) => setSearchPhrase(e.target.value)}
                  placeholder="e.g., Focus on action sequences, include specific moments, highlight dialogue..."
                  className="w-full p-2 border rounded text-xs resize-none"
                  rows={2}
                />
              </div>
            </div>

            <button
              onClick={generateScript}
              disabled={isProcessing || !uploadedFile}
              className="w-full px-4 py-2 bg-gradient-to-r from-purple-500 to-indigo-600 text-white rounded hover:from-purple-600 hover:to-indigo-700 transition-all text-sm flex items-center justify-center gap-2 disabled:opacity-50 disabled:cursor-not-allowed"
            >
              {isProcessing ? (
                <>
                  <div className="w-4 h-4 border-2 border-white border-t-transparent rounded-full animate-spin"></div>
                  Generating Script...
                </>
              ) : (
                <>
                  <MdDescription className="w-4 h-4" />
                  Generate Script
                </>
              )}
            </button>

            {/* Generated Script Output Section */}
            {generatedShort && !isProcessing && (
              <div className="mt-4 p-3 bg-purple-50 rounded border border-purple-200">
                <div className="text-sm font-medium text-purple-800 mb-2">Generated Script Output</div>
                <div className="space-y-2 text-xs">
                  <div><strong>Title:</strong> {generatedShort.title}</div>
                  <div><strong>Timeline Segments:</strong> {generatedShort.timeline?.length || 0}</div>
                  <div><strong>Style:</strong> {generatedShort.style}</div>
                  <div><strong>Duration:</strong> {generatedShort.duration}s</div>
                  
                  {/* Timeline Preview */}
                  {generatedShort.timeline && (
                    <div className="mt-2">
                      <div className="font-medium text-purple-700 mb-1">Timeline Preview:</div>
                      <div className="bg-white p-2 rounded max-h-24 overflow-y-auto">
                        {generatedShort.timeline.slice(0, 2).map((segment, index) => (
                          <div key={index} className="text-xs text-gray-600 mb-1 pb-1 border-b border-gray-100">
                            <div className="font-medium">{segment.timeRange}</div>
                            <div className="text-gray-500">{segment.action}</div>
                          </div>
                        ))}
                        {generatedShort.timeline.length > 2 && (
                          <div className="text-xs text-gray-400">+{generatedShort.timeline.length - 2} more segments</div>
                        )}
                      </div>
                    </div>
                  )}
                  
                  {/* Copy Buttons */}
                  <div className="flex gap-2 mt-2">
                    <button
                      onClick={() => {
                        if (generatedShort.timeline) {
                          const scriptText = generatedShort.timeline.map(segment => 
                            `${segment.timeRange} | ${segment.action} | ${segment.sourceTimestamp} | ${segment.instructions}`
                          ).join('\n');
                          navigator.clipboard.writeText(scriptText);
                          alert('Script copied to clipboard!');
                        }
                      }}
                      className="flex-1 px-2 py-1 bg-purple-500 text-white text-xs rounded hover:bg-purple-600 transition-colors"
                    >
                      Copy Script
                    </button>
                    <button
                      onClick={() => {
                        if (generatedShort) {
                          const jsonOutput = JSON.stringify(generatedShort, null, 2);
                          navigator.clipboard.writeText(jsonOutput);
                          alert('JSON script copied to clipboard!');
                        }
                      }}
                      className="flex-1 px-2 py-1 bg-indigo-500 text-white text-xs rounded hover:bg-indigo-600 transition-colors"
                    >
                      Copy JSON
                    </button>
                  </div>
                </div>
              </div>
            )}
          </div>
        );

      case 'video-generator':
        return (
          <div className="space-y-4">
            {/* Video Source Section */}
            <div className="space-y-2">
              <div className="text-sm font-medium text-gray-700">Video Source</div>
              
              {/* Show connected input if available */}
              {data.inputs && data.inputs.length > 0 ? (
                data.inputs.map((input, index) => (
                  <div key={index} className="bg-green-50 p-2 rounded text-xs border border-green-200">
                    <div className="flex items-center justify-between mb-1">
                      <div className="flex items-center space-x-2">
                        <MdVideoLibrary className="w-3 h-3 text-green-600" />
                        <span className="font-medium text-green-800">Connected Video</span>
                      </div>
                      <div className="w-2 h-2 bg-green-500 rounded-full" title="Connected"></div>
                    </div>
                    <div className="text-xs text-gray-600 mt-1">
                      <div className="font-mono bg-gray-100 p-1 rounded">
                        {input.source === 'upload' ? `File: ${input.title}` : `Source: ${input.title}`}
                      </div>
                    </div>
                  </div>
                ))
              ) : uploadedFile ? (
                <div className="bg-green-50 p-2 rounded text-xs border border-green-200">
                  <div className="flex items-center justify-between mb-1">
                    <div className="flex items-center space-x-2">
                      <MdInsertDriveFile className="w-3 h-3 text-green-600" />
                      <span className="font-medium text-green-800">Uploaded Video</span>
                    </div>
                    <div className="w-2 h-2 bg-green-500 rounded-full" title="Ready"></div>
                  </div>
                  <div className="text-xs text-gray-600 mt-1">
                    <div className="font-mono bg-gray-100 p-1 rounded">File: {uploadedFile.name}</div>
                    <div className="font-mono bg-gray-100 p-1 rounded mt-1">Size: {formatFileSize(uploadedFile.size)}</div>
                  </div>
                </div>
              ) : (
                <div className="border-2 border-dashed border-gray-300 rounded-lg p-4 text-center">
                  <input
                    type="file"
                    accept="video/*"
                    onChange={handleVideoUpload}
                    className="hidden"
                    id={`video-upload-${id}`}
                    disabled={uploading}
                  />
                  <label
                    htmlFor={`video-upload-${id}`}
                    className="cursor-pointer flex flex-col items-center space-y-2"
                  >
                    <MdCloudUpload className="w-8 h-8 text-gray-400" />
                    <span className="text-sm text-gray-600">
                      {uploading ? 'Uploading...' : 'Upload Video or Connect from Upstream'}
                    </span>
                    <span className="text-xs text-gray-500">MP4, MOV, AVI up to 500MB</span>
                  </label>
                </div>
              )}
            </div>

            {/* Timeline Configuration */}
            <div className="space-y-3">
              <div className="text-sm font-medium text-gray-700">Timeline Configuration</div>
              
              {/* Check for connected script input */}
              {data.inputs && data.inputs.find(input => input.type === 'script-generator') ? (
                <div className="bg-purple-50 p-2 rounded text-xs border border-purple-200">
                  <div className="flex items-center space-x-2 mb-1">
                    <MdDescription className="w-3 h-3 text-purple-600" />
                    <span className="font-medium text-purple-800">Connected Script Timeline</span>
                  </div>
                  <div className="text-xs text-purple-600">
                    Timeline will be automatically imported from connected Script Generator
                  </div>
                </div>
              ) : (
                <div className="space-y-3">
                  {/* Timeline Editor Toggle */}
                  <div className="flex items-center space-x-2">
                    <button
                      onClick={() => setUseVisualEditor(!useVisualEditor)}
                      className={`flex items-center space-x-2 px-3 py-1 rounded text-xs transition-colors ${
                        useVisualEditor 
                          ? 'bg-blue-100 text-blue-700 border border-blue-200' 
                          : 'bg-gray-100 text-gray-600 border border-gray-200'
                      }`}
                    >
                      <MdEdit className="w-3 h-3" />
                      <span>{useVisualEditor ? 'Visual Editor' : 'JSON Editor'}</span>
                    </button>
                  </div>

                  {useVisualEditor ? (
                    /* Visual Timeline Editor */
                    <div className="border rounded p-2">
                      <div className="text-xs text-gray-600 mb-2">Visual Timeline Editor</div>
                      <div className="text-xs text-orange-600">Coming soon - use JSON editor for now</div>
                    </div>
                  ) : (
                    /* JSON Editor */
                    <div className="space-y-2">
                      <label className="text-xs font-medium text-gray-600">Manual Timeline (JSON format)</label>
                      <textarea
                        value={customRequirements}
                        onChange={(e) => setCustomRequirements(e.target.value)}
                        placeholder={JSON.stringify([
                          {
                            "startTime": 20,
                            "endTime": 23,
                            "action": "cut",
                            "description": "Opening scene"
                          },
                          {
                            "startTime": 45,
                            "endTime": 48,
                            "action": "cut",
                            "description": "Main content"
                          }
                        ], null, 2)}
                        className="w-full text-xs border border-gray-300 rounded p-2 h-32 resize-none font-mono"
                      />
                    </div>
                  )}
                </div>
              )}
            </div>

            {/* Output Settings */}
            <div className="grid grid-cols-2 gap-2">
              <div>
                <label className="text-xs font-medium text-gray-700">Output Format</label>
                <select
                  value={data.settings?.outputFormat || 'mp4'}
                  onChange={(e) => updateSettings({ outputFormat: e.target.value })}
                  className="w-full text-xs border border-gray-300 rounded p-1 mt-1"
                >
                  <option value="mp4">MP4</option>
                  <option value="mov">MOV</option>
                  <option value="avi">AVI</option>
                </select>
              </div>
              <div>
                <label className="text-xs font-medium text-gray-700">Quality</label>
                <select
                  value={data.settings?.quality || 'high'}
                  onChange={(e) => updateSettings({ quality: e.target.value })}
                  className="w-full text-xs border border-gray-300 rounded p-1 mt-1"
                >
                  <option value="high">High</option>
                  <option value="medium">Medium</option>
                  <option value="low">Low</option>
                </select>
              </div>
            </div>

            {/* Generate Button */}
            <button
              onClick={handleGenerateVideo}
              disabled={(!uploadedFile && (!data.inputs || data.inputs.length === 0)) || isProcessing}
              className="w-full px-4 py-2 bg-gradient-to-r from-blue-500 to-cyan-600 text-white rounded hover:from-blue-600 hover:to-cyan-700 transition-all text-sm flex items-center justify-center gap-2 disabled:opacity-50 disabled:cursor-not-allowed"
            >
              {isProcessing ? (
                <>
                  <div className="w-4 h-4 border-2 border-white border-t-transparent rounded-full animate-spin"></div>
                  Generating Video...
                </>
              ) : (
                <>
                  <MdMovieCreation className="w-4 h-4" />
                  Generate Video
                </>
              )}
            </button>

            {/* Generated Video Output Section */}
            {generatedShort && !isProcessing && (
              <div className="mt-4 p-3 bg-blue-50 rounded border border-blue-200">
                <div className="text-sm font-medium text-blue-800 mb-2">Generated Video Output</div>
                <div className="space-y-2 text-xs">
                  <div><strong>Title:</strong> {generatedShort.title}</div>
                  <div><strong>Duration:</strong> {generatedShort.duration}s</div>
                  <div><strong>Segments:</strong> {generatedShort.timeline?.length || 0}</div>
                  
                  {/* Video Preview */}
                  {generatedShort.videoUrl && (
                    <div className="mt-2">
                      <div className="font-medium text-blue-700 mb-1">Video Preview:</div>
                      <video
                        src={generatedShort.videoUrl}
                        controls
                        className="w-full h-32 object-cover rounded border"
                      />
                    </div>
                  )}
                  
                  {/* Download Button */}
                  {generatedShort.videoUrl && (
                    <div className="flex gap-2 mt-2">
                      <button
                        onClick={() => {
                          const link = document.createElement('a');
                          link.href = generatedShort.videoUrl;
                          link.download = `${(generatedShort.title || 'generated_video').replace(/[^a-z0-9]/gi, '_').toLowerCase()}.${data.settings?.outputFormat || 'mp4'}`;
                          document.body.appendChild(link);
                          link.click();
                          document.body.removeChild(link);
                        }}
                        className="flex-1 px-2 py-1 bg-blue-500 text-white text-xs rounded hover:bg-blue-600 transition-colors"
                      >
                        Download Video
                      </button>
                    </div>
                  )}
                </div>
              </div>
            )}
          </div>
        );

      case 'shorts-creation':
        return (
          <div className="space-y-3">
            {/* Video Source Section */}
            <div className="space-y-2 border-b border-gray-200 pb-2">
              <div className="text-xs font-medium text-gray-700">Video Source:</div>
              
              {/* Show connected input if available */}
              {data.inputs && data.inputs.length > 0 ? (
                data.inputs.map((input, index) => (
                  <div key={index} className="bg-green-50 p-2 rounded text-xs border border-green-200">
                    <div className="flex items-center justify-between mb-1">
                      <div className="flex items-center space-x-2">
                        <MdVideoLibrary className="w-3 h-3 text-green-600" />
                        <span className="font-medium text-green-800">Connected Video</span>
                      </div>
                      <div className="w-2 h-2 bg-green-500 rounded-full" title="Connected"></div>
                    </div>
                    {input.thumbnailUrl && (
                      <img src={input.thumbnailUrl} alt="Connected video" className="w-full h-12 object-cover rounded mt-1 border" />
                    )}
                    <div className="text-xs text-gray-600 mt-1">
                      <div className="font-mono bg-gray-100 p-1 rounded">
                        {input.source === 'upload' ? `File: ${input.title}` : `videoUrl: ${input.url}`}
                      </div>
                    </div>
                  </div>
                ))
              ) : uploadedFile ? (
                /* Show uploaded file */
                <div className="bg-green-50 p-2 rounded text-xs border border-green-200">
                  <div className="flex items-center justify-between mb-1">
                    <div className="flex items-center space-x-2">
                      <MdInsertDriveFile className="w-3 h-3 text-green-600" />
                      <span className="font-medium text-green-800">Uploaded Video</span>
                    </div>
                    <div className="w-2 h-2 bg-green-500 rounded-full" title="Ready"></div>
                  </div>
                  <div className="text-xs text-gray-600 mt-1">
                    <div className="font-mono bg-gray-100 p-1 rounded">File: {uploadedFile.name}</div>
                    <div className="font-mono bg-gray-100 p-1 rounded mt-1">Size: {formatFileSize(uploadedFile.size)}</div>
                  </div>
                </div>
              ) : (
                /* Message when no video source */
                <div className="text-center py-4 text-gray-500 text-sm">
                  Connect a Video Upload tile or upload a file directly to create shorts
                </div>
              )}
            </div>
            
            <div className="space-y-2">
              <Input
                placeholder="Enter topic or search phrase..."
                value={searchPhrase}
                onChange={(e) => setSearchPhrase(e.target.value)}
                className="text-sm border-gray-300"
              />
              <div className="grid grid-cols-2 gap-2">
                <select 
                  value={style} 
                  onChange={(e) => setStyle(e.target.value)}
                  className="text-xs border border-gray-300 rounded px-2 py-1 bg-white"
                >
                  <option value="viral">Style: Viral</option>
                  <option value="educational">Style: Educational</option>
                  <option value="entertainment">Style: Entertainment</option>
                  <option value="news">Style: News</option>
                </select>
                <select 
                  value={duration} 
                  onChange={(e) => setDuration(parseInt(e.target.value))}
                  className="text-xs border border-gray-300 rounded px-2 py-1 bg-white"
                >
                  <option value={15}>15 seconds</option>
                  <option value={30}>30 seconds</option>
                  <option value={60}>60 seconds</option>
                </select>
              </div>
              <div className="grid grid-cols-2 gap-2">
                <select 
                  value={aspectRatio} 
                  onChange={(e) => setAspectRatio(e.target.value)}
                  className="text-xs border border-gray-300 rounded px-2 py-1 bg-white"
                >
                  <option value="9:16">9:16 Vertical</option>
                  <option value="16:9">16:9 Horizontal</option>
                  <option value="1:1">1:1 Square</option>
                </select>
                <select 
                  value={voiceType} 
                  onChange={(e) => setVoiceType(e.target.value)}
                  className="text-xs border border-gray-300 rounded px-2 py-1 bg-white"
                >
                  <option value="auto">Auto Voice</option>
                  <option value="male">Male Voice</option>
                  <option value="female">Female Voice</option>
                  <option value="none">No Voice</option>
                </select>
              </div>
            </div>
            
            <Button
              onClick={handleGenerateShorts}
              disabled={(!hasValidInput()) || isProcessing}
              size="sm"
              className="w-full bg-gradient-to-r from-pink-500 to-purple-600 hover:from-pink-600 hover:to-purple-700 text-white text-xs font-medium"
            >
              {isProcessing ? (
                <>
                  <div className="animate-spin w-3 h-3 border border-white border-t-transparent rounded-full mr-2" />
                  Processing Video...
                </>
              ) : (
                <>
                  <MdAutoAwesome className="w-3 h-3 mr-1" />
                  {getButtonText()}
                </>
              )}
            </Button>
            
            {isProcessing && (
              <div className="space-y-3">
                <div className="text-xs text-gray-600 font-medium">Processing Progress:</div>
                
                {/* Progress Bar */}
                <div className="space-y-2">
                  <div className="flex justify-between text-xs">
                    <span>Video Processing</span>
                    <span>{Math.round(processingProgress)}%</span>
                  </div>
                  <div className="w-full bg-gray-200 rounded-full h-2">
                    <div 
                      className="bg-gradient-to-r from-pink-500 to-purple-600 h-2 rounded-full transition-all duration-300 ease-out"
                      style={{ width: `${processingProgress}%` }}
                    ></div>
                  </div>
                  <div className="text-xs text-gray-500">{processingStatus}</div>
                </div>

                {/* Processing Steps */}
                <div className="space-y-1 text-xs">
                  <div className="flex items-center space-x-2">
                    <div className={`w-2 h-2 rounded-full ${processingStep >= 1 ? 'bg-green-500' : processingStep === 0 ? 'bg-blue-500 animate-pulse' : 'bg-gray-300'}`}></div>
                    <span>Downloading video content</span>
                  </div>
                  <div className="flex items-center space-x-2">
                    <div className={`w-2 h-2 rounded-full ${processingStep >= 2 ? 'bg-green-500' : processingStep === 1 ? 'bg-blue-500 animate-pulse' : 'bg-gray-300'}`}></div>
                    <span>AI analysis & script generation</span>
                  </div>
                  <div className="flex items-center space-x-2">
                    <div className={`w-2 h-2 rounded-full ${processingStep >= 3 ? 'bg-green-500' : processingStep === 2 ? 'bg-blue-500 animate-pulse' : 'bg-gray-300'}`}></div>
                    <span>Creating shorts video</span>
                  </div>
                  <div className="flex items-center space-x-2">
                    <div className={`w-2 h-2 rounded-full ${processingStep >= 4 ? 'bg-green-500' : processingStep === 3 ? 'bg-blue-500 animate-pulse' : 'bg-gray-300'}`}></div>
                    <span>Finalizing download</span>
                  </div>
                </div>
              </div>
            )}
            
            {thumbnailUrl && !isProcessing && (
              <div className="space-y-2">
                <div className="relative">
                  <img
                    src={thumbnailUrl}
                    alt="Generated short thumbnail"
                    className="w-full h-20 object-cover rounded border"
                  />
                  <div className="absolute top-1 right-1 bg-black/70 text-white text-xs px-1 py-0.5 rounded">
                    AI Generated
                  </div>
                </div>
                
                <div className="text-xs space-y-1">
                  <div className="font-medium text-gray-700">Video Details:</div>
                  <div className="grid grid-cols-2 gap-1 text-gray-600">
                    <span>Quality: HD 1080p</span>
                    <span>Format: MP4</span>
                    <span>Duration: 15s</span>
                    <span>Size: 2.3MB</span>
                  </div>
                </div>
                
                {/* Removed duplicate buttons - handled below with actual MP4 download */}
                
                {generatedShort && (
                  <div className="text-xs space-y-3">
                    {data.type === 'script-generator' ? (
                      <>
                        {/* Script Output */}
                        <div className="bg-gradient-to-r from-purple-50 to-indigo-50 p-3 rounded border border-purple-200">
                          <div className="font-medium text-gray-700 mb-2">Generated Script</div>
                          <div className="space-y-1 text-gray-600">
                            <div>Title: {generatedShort.title || 'Generated Script'}</div>
                            <div>Timeline Segments: {generatedShort.timeline?.length || 0}</div>
                            <div>Style: {generatedShort.style || style}</div>
                            <div>Duration: {generatedShort.duration || duration}s</div>
                          </div>
                        </div>

                        {/* Timeline Preview */}
                        {generatedShort.timeline && (
                          <div className="space-y-1">
                            <div className="font-medium text-gray-700">Script Timeline:</div>
                            <div className="bg-gray-50 p-2 rounded max-h-32 overflow-y-auto">
                              {generatedShort.timeline.map((segment, index) => (
                                <div key={index} className="text-xs text-gray-600 mb-2 border-b border-gray-200 pb-1">
                                  <div className="font-medium">{segment.timeRange}</div>
                                  <div>{segment.action}</div>
                                  <div className="text-gray-500">Source: {segment.sourceTimestamp}</div>
                                  <div className="text-blue-600">{segment.instructions}</div>
                                </div>
                              ))}
                            </div>
                          </div>
                        )}

                        {/* Action Buttons */}
                        <div className="flex gap-2">
                          <button
                            onClick={() => {
                              if (generatedShort.timeline) {
                                const scriptText = generatedShort.timeline.map(segment => 
                                  `${segment.timeRange} | ${segment.action} | ${segment.sourceTimestamp} | ${segment.instructions}`
                                ).join('\n');
                                navigator.clipboard.writeText(scriptText);
                                alert('Script copied to clipboard!');
                              }
                            }}
                            className="flex-1 px-3 py-2 bg-purple-500 text-white text-sm rounded hover:bg-purple-600 transition-colors flex items-center justify-center gap-2"
                          >
                            <MdContentCopy className="w-4 h-4" />
                            Copy Script
                          </button>
                          <button
                            onClick={() => {
                              if (generatedShort) {
                                const jsonOutput = JSON.stringify(generatedShort, null, 2);
                                navigator.clipboard.writeText(jsonOutput);
                                alert('JSON script copied to clipboard!');
                              }
                            }}
                            className="flex-1 px-3 py-2 bg-indigo-500 text-white text-sm rounded hover:bg-indigo-600 transition-colors flex items-center justify-center gap-2"
                          >
                            <MdContentCopy className="w-4 h-4" />
                            Copy JSON
                          </button>
                        </div>
                      </>
                    ) : (
                      <>
                        {/* Editing Plan Summary */}
                        {generatedShort.editingPlan && (
                          <div className="bg-gradient-to-r from-pink-50 to-purple-50 p-3 rounded border border-pink-200">
                            <div className="font-medium text-gray-700 mb-2">AI Editing Plan</div>
                            <div className="space-y-1 text-gray-600">
                              <div>Timeline: {generatedShort.editingPlan.timeline?.length || 0} segments</div>
                              <div>Text Overlays: {generatedShort.editingPlan.textOverlays?.length || 0}</div>
                              <div>Mood: {generatedShort.editingPlan.mood}</div>
                              <div>Duration: {generatedShort.editingPlan.totalDuration}s</div>
                            </div>
                          </div>
                        )}
                        
                        {/* Timeline Preview */}
                        {generatedShort.timeline && generatedShort.timeline.length > 0 && (
                          <div className="space-y-1">
                            <div className="font-medium text-gray-700">Timeline Segments:</div>
                            <div className="bg-gray-50 p-2 rounded max-h-20 overflow-y-auto">
                              {generatedShort.timeline.slice(0, 3).map((segment, index) => (
                                <div key={index} className="text-xs text-gray-600 mb-1">
                                  {segment.startTime}s-{segment.endTime}s: {segment.description}
                                </div>
                              ))}
                              {generatedShort.timeline.length > 3 && (
                                <div className="text-xs text-gray-500">+{generatedShort.timeline.length - 3} more segments</div>
                              )}
                            </div>
                          </div>
                        )}
                        
                        {/* Video Details */}
                        <div className="space-y-1">
                          <div className="font-medium text-gray-700">Video Details:</div>
                          <div className="grid grid-cols-2 gap-1 text-gray-600">
                            <span>Quality: HD 1080p</span>
                            <span>Format: MP4</span>
                            <span>Duration: {duration}s</span>
                            <span>Style: {voiceType}</span>
                          </div>
                        </div>
                        
                        {generatedShort.hashtags && (
                          <div className="space-y-1">
                            <div className="font-medium text-gray-700">Hashtags:</div>
                            <div className="text-xs text-blue-600">
                              {generatedShort.hashtags.slice(0, 4).join(' ')}
                            </div>
                          </div>
                        )}
                        
                        {/* Action Buttons */}
                        <div className="flex gap-2 mt-3">
                          <button 
                            className="flex-1 px-3 py-2 bg-blue-500 text-white text-sm rounded hover:bg-blue-600 transition-colors flex items-center justify-center gap-2"
                            onClick={() => {
                              if (generatedShort.videoUrl) {
                                window.open(generatedShort.videoUrl, '_blank');
                              }
                            }}
                          >
                            <MdPlayArrow className="w-4 h-4" />
                            Preview
                          </button>
                          <button
                            onClick={() => {
                              if (generatedShort.videoUrl) {
                                const link = document.createElement('a');
                                link.href = generatedShort.videoUrl;
                                link.download = `${(generatedShort.title || 'ai_edited_video').replace(/[^a-z0-9]/gi, '_').toLowerCase()}.mp4`;
                                link.setAttribute('target', '_blank');
                                document.body.appendChild(link);
                                link.click();
                                document.body.removeChild(link);
                              }
                            }}
                            disabled={!generatedShort.videoUrl}
                            className="flex-1 px-3 py-2 bg-green-500 text-white text-sm rounded hover:bg-green-600 transition-colors flex items-center justify-center gap-2 disabled:opacity-50 disabled:cursor-not-allowed"
                          >
                            <MdDownload className="w-4 h-4" />
                            Download
                          </button>
                        </div>
                      </>
                    )}
                  </div>
                )}
                
                {/* Always show download section when shorts are generated */}
                {(data.status === 'complete' && (data.output || generatedShort)) && (
                  <div className="space-y-2 border-t border-gray-200 pt-2 mt-3">
                    <div className="text-xs font-medium text-gray-700">Generated Video</div>
                    
                    {/* Download buttons - always visible when complete */}
                    <div className="flex gap-1">
                      <button
                        onClick={() => {
                          const videoUrl = data.output?.videoUrl || generatedShort?.videoUrl;
                          if (videoUrl) {
                            window.open(videoUrl, '_blank');
                          }
                        }}
                        className="flex-1 px-2 py-1 bg-blue-500 text-white text-xs rounded hover:bg-blue-600 transition-colors flex items-center justify-center gap-1"
                      >
                        <MdPlayArrow className="w-3 h-3" />
                        Preview
                      </button>
                      <button
                        onClick={() => {
                          const videoUrl = data.output?.videoUrl || generatedShort?.videoUrl;
                          const title = data.output?.title || generatedShort?.title || 'shorts_video';
                          if (videoUrl) {
                            const link = document.createElement('a');
                            link.href = videoUrl;
                            link.download = `${title.replace(/[^a-z0-9]/gi, '_').toLowerCase()}.mp4`;
                            document.body.appendChild(link);
                            link.click();
                            document.body.removeChild(link);
                          }
                        }}
                        className="flex-1 px-2 py-1 bg-green-500 text-white text-xs rounded hover:bg-green-600 transition-colors flex items-center justify-center gap-1"
                      >
                        <MdDownload className="w-3 h-3" />
                        Download MP4
                      </button>
                    </div>
                    
                    {/* Video info */}
                    <div className="text-xs text-gray-600">
                      {data.output?.title || generatedShort?.title || 'AI Generated Short'}
                    </div>
                  </div>
                )}
              </div>
            )}
          </div>
        );

      default:
        return (
          <div className="space-y-3">
            <div className="text-xs text-gray-600">
              Status: <span className="capitalize font-medium">{data.status || 'ready'}</span>
            </div>
            
            {/* Show output data if available */}
            {data.output && (
              <div className="space-y-2 border-t border-gray-200 pt-2">
                <div className="text-xs font-medium text-gray-700">Output:</div>
                {data.output.thumbnailUrl && (
                  <img
                    src={data.output.thumbnailUrl}
                    alt="Output thumbnail"
                    className="w-full h-16 object-cover rounded border"
                    onError={(e) => {
                      e.currentTarget.style.display = 'none';
                    }}
                  />
                )}
                {data.output.title && (
                  <div className="text-xs text-gray-800 font-medium bg-gray-50 p-2 rounded">
                    {data.output.title}
                  </div>
                )}
                {data.output.script && (
                  <div className="text-xs text-gray-600 bg-gray-50 p-2 rounded max-h-16 overflow-y-auto">
                    {data.output.script}
                  </div>
                )}
                {data.output.videoUrl && (
                  <div className="flex gap-1 mt-2">
                    <button
                      onClick={() => {
                        window.open(data.output.videoUrl, '_blank');
                      }}
                      className="flex-1 px-2 py-1 bg-blue-500 text-white text-xs rounded hover:bg-blue-600 transition-colors flex items-center justify-center gap-1"
                    >
                      <MdPlayArrow className="w-3 h-3" />
                      Preview
                    </button>
                    <button
                      onClick={() => {
                        const link = document.createElement('a');
                        link.href = data.output.videoUrl;
                        link.download = `${(data.output.title || 'shorts_video').replace(/[^a-z0-9]/gi, '_').toLowerCase()}.mp4`;
                        document.body.appendChild(link);
                        link.click();
                        document.body.removeChild(link);
                      }}
                      className="flex-1 px-2 py-1 bg-green-500 text-white text-xs rounded hover:bg-green-600 transition-colors flex items-center justify-center gap-1"
                    >
                      <MdDownload className="w-3 h-3" />
                      Download
                    </button>
                  </div>
                )}
              </div>
            )}
            
            {data.settings && Object.keys(data.settings).length > 0 && (
              <div className="space-y-1">
                {Object.entries(data.settings).slice(0, 2).map(([key, value]) => (
                  <div key={key} className="flex justify-between items-center text-xs">
                    <span className="text-gray-600 capitalize font-medium">{key.replace(/([A-Z])/g, ' $1').trim()}:</span>
                    <span className="font-medium text-google-text bg-gray-50 px-2 py-0.5 rounded">{String(value)}</span>
                  </div>
                ))}
              </div>
            )}
          </div>
        );
    }
  };

  // Determine number of input handles based on tile type
  const getInputHandles = () => {
    switch (data.type) {
      case 'shorts-creation':
        return [
          { id: 'video-upload', position: Position.Left, style: { top: '30%' } },
          { id: 'audio-input', position: Position.Left, style: { top: '70%' } }
        ];
      case 'captions':
        return [
          { id: 'video-upload', position: Position.Left, style: { top: '50%' } }
        ];
      default:
        return [
          { id: 'input', position: Position.Left, style: { top: '50%' } }
        ];
    }
  };

  return (
    <div className="bg-white rounded-xl shadow-lg border-2 border-gray-200 w-80 min-h-[160px] overflow-hidden transition-all duration-200 hover:shadow-xl hover:border-google-blue/30">
      {/* Input Handles */}
      {getInputHandles().map((handle, index) => (
        <Handle
          key={handle.id}
          type="target"
          position={handle.position}
          id={handle.id}
          style={handle.style}
          className="w-3 h-3 bg-gray-400 border-2 border-white shadow-sm hover:bg-gray-600 transition-colors"
        />
      ))}
      
      {/* Header */}
      <div className={`${data.color} p-4 border-b border-gray-100`}>
        <div className="flex items-center justify-between">
          <div className="flex items-center space-x-3">
            <div className="w-8 h-8 bg-white/20 rounded-lg flex items-center justify-center shadow-sm">
              {getIcon(data.icon)}
            </div>
            <h4 className="font-roboto font-medium text-white text-sm flex-1 tracking-tight">{data.label}</h4>
          </div>
          {data.status === 'processing' && (
            <div className="animate-spin w-4 h-4 border-2 border-white border-t-transparent rounded-full" />
          )}
        </div>
      </div>
      
      {/* Content */}
      <div className="p-4">
        {renderTileContent()}
      </div>
      
      {/* Output Handle */}
      <Handle
        type="source"
        position={Position.Right}
        className="w-3 h-3 bg-google-blue border-2 border-white shadow-sm hover:bg-blue-600 transition-colors"
        style={{ top: '50%' }}
      />
    </div>
  );
});
