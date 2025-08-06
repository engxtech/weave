import React, { useState } from 'react';
import { Link } from 'wouter';
import { MdArrowBack, MdCloudUpload, MdTimeline, MdVideoLibrary, MdDownload, MdAutoAwesome, MdTune, MdStayCurrentPortrait, MdGraphicEq } from 'react-icons/md';
import { TimelineEditor, TimelineSegment } from '../components/timeline-editor-fixed';
import { DraggableTimelineEditor } from '../components/draggable-timeline-editor';
import { SegmentPreview } from '../components/segment-preview';
import { VisualTransitionEditor } from '../components/visual-transition-editor';
import { EnhancedVideoPlayer } from '../components/enhanced-video-player';
import { Button } from '@/components/ui/button';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Slider } from '@/components/ui/slider';
import { Switch } from '@/components/ui/switch';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';

export default function TimelineEditorPage() {
  const [uploadedFile, setUploadedFile] = useState<File | null>(null);
  const [uploading, setUploading] = useState(false);
  const [timelineSegments, setTimelineSegments] = useState<TimelineSegment[]>([]);
  const [generatedVideo, setGeneratedVideo] = useState<any>(null);
  const [isProcessing, setIsProcessing] = useState(false);
  const [processingStatus, setProcessingStatus] = useState('');
  
  // Advanced processing options
  const [enhancementSettings, setEnhancementSettings] = useState({
    transitionType: 'fade',
    transitionDuration: 0.5,
    stabilization: true,
    qualityEnhancement: true,
    autoColorCorrection: true,
    smartPacing: true,
    noiseReduction: 0.3,
    sharpening: 0.2,
    rhythmDetection: true,
    transitions: []
  });

  const [selectedSegment, setSelectedSegment] = useState(0);
  const [transitions, setTransitions] = useState([]);
  const [videoCurrentTime, setVideoCurrentTime] = useState(0);

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

      const response = await fetch('/api/upload-video', {
        method: 'POST',
        body: formData,
      });

      if (!response.ok) {
        const errorText = await response.text();
        throw new Error(`Upload failed: ${response.status} ${errorText}`);
      }

      const result = await response.json();
      setUploadedFile(file);
      setTimelineSegments([]); // Clear previous segments
      
    } catch (error) {
      console.error('Upload error:', error);
      alert(`Upload failed: ${error.message}`);
    } finally {
      setUploading(false);
    }
  };

  const handleGenerateVideo = async () => {
    if (!uploadedFile || timelineSegments.length === 0) {
      alert('Please upload a video and create timeline segments');
      return;
    }

    setIsProcessing(true);
    setProcessingStatus('Starting video generation...');

    try {
      const formData = new FormData();
      formData.append('file', uploadedFile);
      formData.append('timeline', JSON.stringify(timelineSegments.map(segment => ({
        startTime: segment.startTime,
        endTime: segment.endTime,
        action: segment.action,
        description: segment.description
      }))));
      formData.append('outputFormat', 'mp4');
      formData.append('quality', 'high');
      formData.append('aspectRatio', '9:16');

      setProcessingStatus('Processing video segments with advanced features...');
      
      // Add enhancement settings with transitions to form data
      const settingsWithTransitions = {
        ...enhancementSettings,
        transitions: transitions
      };
      formData.append('enhancementSettings', JSON.stringify(settingsWithTransitions));
      
      const response = await fetch('/api/video/generate-enhanced', {
        method: 'POST',
        body: formData,
      });

      if (!response.ok) {
        const errorText = await response.text();
        throw new Error(`Server error ${response.status}: ${errorText}`);
      }

      const result = await response.json();
      
      if (!result.success) {
        throw new Error(result.error || 'Video generation failed');
      }
      
      if (result.success) {
        setGeneratedVideo(result.video);
        setProcessingStatus('Video generated successfully!');
      } else {
        throw new Error(result.error || 'Failed to generate video');
      }

    } catch (error) {
      console.error('Error generating video:', error);
      setProcessingStatus('Error: ' + error.message);
      alert('Failed to generate video: ' + error.message);
    } finally {
      setIsProcessing(false);
    }
  };

  return (
    <div className="min-h-screen bg-background dark:bg-slate-900">
      {/* Header */}
      <div className="bg-card dark:bg-slate-800 border-b border-border dark:border-slate-700">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
          <div className="flex items-center justify-between h-16">
            <div className="flex items-center space-x-4">
              <Link href="/">
                <button className="flex items-center space-x-2 text-muted-foreground dark:text-slate-400 hover:text-foreground dark:hover:text-slate-200 transition-colors">
                  <MdArrowBack className="w-5 h-5" />
                  <span>Back to Home</span>
                </button>
              </Link>
              <div className="h-6 w-px bg-border dark:bg-slate-600"></div>
              <div className="flex items-center space-x-2">
                <MdTimeline className="w-6 h-6 text-blue-600" />
                <h1 className="text-xl font-semibold text-foreground dark:text-slate-200">Visual Timeline Editor</h1>
              </div>
            </div>
          </div>
        </div>
      </div>

      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8">
        <div className="space-y-6">
          {/* Introduction */}
          <div className="bg-card dark:bg-slate-800 rounded-lg border border-border dark:border-slate-700 p-6">
            <div className="flex items-start space-x-4">
              <div className="flex-shrink-0">
                <div className="w-12 h-12 bg-blue-100 rounded-lg flex items-center justify-center">
                  <MdTimeline className="w-6 h-6 text-blue-600" />
                </div>
              </div>
              <div className="flex-1">
                <h2 className="text-lg font-semibold text-foreground dark:text-slate-200 mb-2">
                  Professional Video Timeline Editor
                </h2>
                <p className="text-muted-foreground dark:text-slate-400 mb-4">
                  Create precise video segments with our visual timeline editor. Upload your video, 
                  drag to select segments, and generate professional cuts with ease.
                </p>
                <div className="grid grid-cols-1 md:grid-cols-3 gap-4 text-sm">
                  <div className="flex items-center space-x-2">
                    <div className="w-2 h-2 bg-green-500 rounded-full"></div>
                    <span>Visual segment selection</span>
                  </div>
                  <div className="flex items-center space-x-2">
                    <div className="w-2 h-2 bg-green-500 rounded-full"></div>
                    <span>Real-time video preview</span>
                  </div>
                  <div className="flex items-center space-x-2">
                    <div className="w-2 h-2 bg-green-500 rounded-full"></div>
                    <span>Professional video output</span>
                  </div>
                </div>
              </div>
            </div>
          </div>

          {/* Upload Section */}
          {!uploadedFile ? (
            <div className="bg-white rounded-lg border border-gray-200 p-6">
              <h3 className="text-lg font-medium text-gray-900 mb-4">Upload Your Video</h3>
              <div className="border-2 border-dashed border-gray-300 rounded-lg p-8">
                <div className="text-center">
                  <MdCloudUpload className="mx-auto h-12 w-12 text-gray-400" />
                  <div className="mt-4">
                    <label htmlFor="video-upload" className="cursor-pointer">
                      <span className="mt-2 block text-sm font-medium text-gray-900">
                        Choose video file or drag and drop
                      </span>
                      <span className="mt-1 block text-sm text-gray-500">
                        MP4, MOV, AVI up to 500MB
                      </span>
                    </label>
                    <input
                      id="video-upload"
                      type="file"
                      accept="video/*"
                      className="hidden"
                      onChange={(e) => {
                        const file = e.target.files?.[0];
                        if (file) handleFileUpload(file);
                      }}
                      disabled={uploading}
                    />
                  </div>
                  {uploading && (
                    <div className="mt-4">
                      <div className="text-sm text-blue-600">Uploading video...</div>
                      <div className="mt-2 w-full bg-gray-200 rounded-full h-2">
                        <div className="bg-blue-600 h-2 rounded-full animate-pulse w-1/2"></div>
                      </div>
                    </div>
                  )}
                </div>
              </div>
            </div>
          ) : (
            /* Timeline Editor Section */
            <div className="bg-white rounded-lg border border-gray-200 p-6">
              <div className="flex items-center justify-between mb-4">
                <h3 className="text-lg font-medium text-gray-900">Timeline Editor</h3>
                <div className="flex items-center space-x-2 text-sm text-gray-600">
                  <MdVideoLibrary className="w-4 h-4" />
                  <span>{uploadedFile.name}</span>
                  <button
                    onClick={() => {
                      setUploadedFile(null);
                      setTimelineSegments([]);
                      setGeneratedVideo(null);
                    }}
                    className="ml-2 text-red-600 hover:text-red-800"
                  >
                    Change Video
                  </button>
                </div>
              </div>

              <Tabs defaultValue="timeline" className="w-full">
                <TabsList className="grid w-full grid-cols-5">
                  <TabsTrigger value="timeline">Timeline</TabsTrigger>
                  <TabsTrigger value="dragdrop">Drag & Drop</TabsTrigger>
                  <TabsTrigger value="preview">Preview</TabsTrigger>
                  <TabsTrigger value="transitions">Transitions</TabsTrigger>
                  <TabsTrigger value="settings">Settings</TabsTrigger>
                </TabsList>

                <TabsContent value="timeline" className="mt-6">
                  <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
                    {/* Enhanced Video Player */}
                    <div>
                      <EnhancedVideoPlayer
                        videoUrl={URL.createObjectURL(uploadedFile)}
                        segments={timelineSegments}
                        currentTime={videoCurrentTime}
                        onTimeUpdate={setVideoCurrentTime}
                        onSegmentSelect={setSelectedSegment}
                        selectedSegment={selectedSegment}
                        showSegmentOverlay={true}
                      />
                    </div>
                    
                    {/* Timeline Editor */}
                    <div>
                      <TimelineEditor
                        videoUrl={URL.createObjectURL(uploadedFile)}
                        duration={60} // Will be updated from video metadata
                        segments={timelineSegments}
                        onSegmentsChange={setTimelineSegments}
                        currentTime={videoCurrentTime}
                        onTimeUpdate={setVideoCurrentTime}
                        selectedSegment={selectedSegment}
                        onSegmentSelect={setSelectedSegment}
                        className="border rounded-lg p-4"
                      />
                    </div>
                  </div>
                </TabsContent>

                <TabsContent value="dragdrop" className="mt-6">
                  <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
                    {/* Enhanced Video Player */}
                    <div>
                      <EnhancedVideoPlayer
                        videoUrl={URL.createObjectURL(uploadedFile)}
                        segments={timelineSegments}
                        currentTime={videoCurrentTime}
                        onTimeUpdate={setVideoCurrentTime}
                        onSegmentSelect={setSelectedSegment}
                        selectedSegment={selectedSegment}
                        showSegmentOverlay={true}
                      />
                    </div>
                    
                    {/* Draggable Timeline Editor */}
                    <div>
                      <DraggableTimelineEditor
                        videoUrl={URL.createObjectURL(uploadedFile)}
                        duration={60} // Will be updated from video metadata
                        segments={timelineSegments.map((segment, index) => ({
                          ...segment,
                          order: segment.order ?? index
                        }))}
                        onSegmentsChange={(segments) => setTimelineSegments(segments.map(({ order, ...segment }) => segment))}
                        currentTime={videoCurrentTime}
                        onTimeUpdate={setVideoCurrentTime}
                        selectedSegment={selectedSegment}
                        onSegmentSelect={setSelectedSegment}
                        onPreviewReorderedVideo={(reorderedSegments) => {
                          console.log('Preview reordered video:', reorderedSegments);
                          // Here you could implement actual video reordering preview
                        }}
                        className="border rounded-lg p-4"
                      />
                    </div>
                  </div>
                </TabsContent>

                <TabsContent value="preview" className="mt-6">
                  <SegmentPreview
                    segments={timelineSegments}
                    videoUrl={URL.createObjectURL(uploadedFile)}
                    onSegmentSelect={setSelectedSegment}
                    selectedSegment={selectedSegment}
                  />
                </TabsContent>

                <TabsContent value="transitions" className="mt-6">
                  <VisualTransitionEditor
                    segments={timelineSegments}
                    transitions={transitions}
                    onTransitionsChange={setTransitions}
                    videoUrl={URL.createObjectURL(uploadedFile)}
                  />
                </TabsContent>

                <TabsContent value="settings" className="mt-6">
                  <div className="grid grid-cols-1 lg:grid-cols-2 xl:grid-cols-3 gap-6">
                    <Card>
                      <CardHeader>
                        <CardTitle className="flex items-center space-x-2 text-lg">
                          <MdAutoAwesome className="w-5 h-5 text-purple-600" />
                          <span>AI Enhancement</span>
                        </CardTitle>
                      </CardHeader>
                      <CardContent className="space-y-4">
                        <div className="flex items-center justify-between">
                          <span className="text-sm font-medium">Quality Enhancement</span>
                          <Switch
                            checked={enhancementSettings.qualityEnhancement}
                            onCheckedChange={(checked) => 
                              setEnhancementSettings({...enhancementSettings, qualityEnhancement: checked})
                            }
                          />
                        </div>
                        
                        <div className="flex items-center justify-between">
                          <span className="text-sm font-medium">Auto Color Correction</span>
                          <Switch
                            checked={enhancementSettings.autoColorCorrection}
                            onCheckedChange={(checked) => 
                              setEnhancementSettings({...enhancementSettings, autoColorCorrection: checked})
                            }
                          />
                        </div>
                        
                        <div className="space-y-2">
                          <span className="text-sm font-medium">Noise Reduction</span>
                          <Slider
                            value={[enhancementSettings.noiseReduction]}
                            onValueChange={(value) => 
                              setEnhancementSettings({...enhancementSettings, noiseReduction: value[0]})
                            }
                            max={1}
                            min={0}
                            step={0.1}
                            className="w-full"
                          />
                          <div className="text-xs text-gray-500">{(enhancementSettings.noiseReduction * 100).toFixed(0)}%</div>
                        </div>
                        
                        <div className="space-y-2">
                          <span className="text-sm font-medium">Sharpening</span>
                          <Slider
                            value={[enhancementSettings.sharpening]}
                            onValueChange={(value) => 
                              setEnhancementSettings({...enhancementSettings, sharpening: value[0]})
                            }
                            max={1}
                            min={0}
                            step={0.1}
                            className="w-full"
                          />
                          <div className="text-xs text-gray-500">{(enhancementSettings.sharpening * 100).toFixed(0)}%</div>
                        </div>
                      </CardContent>
                    </Card>
                    
                    <Card>
                      <CardHeader>
                        <CardTitle className="flex items-center space-x-2 text-lg">
                          <MdStayCurrentPortrait className="w-5 h-5 text-blue-600" />
                          <span>Stabilization</span>
                        </CardTitle>
                      </CardHeader>
                      <CardContent className="space-y-4">
                        <div className="flex items-center justify-between">
                          <span className="text-sm font-medium">Video Stabilization</span>
                          <Switch
                            checked={enhancementSettings.stabilization}
                            onCheckedChange={(checked) => 
                              setEnhancementSettings({...enhancementSettings, stabilization: checked})
                            }
                          />
                        </div>
                        
                        <div className="text-xs text-gray-500">
                          Advanced optical flow stabilization reduces camera shake and improves smoothness
                        </div>
                      </CardContent>
                    </Card>
                    
                    <Card>
                      <CardHeader>
                        <CardTitle className="flex items-center space-x-2 text-lg">
                          <MdGraphicEq className="w-5 h-5 text-orange-600" />
                          <span>Smart Pacing</span>
                        </CardTitle>
                      </CardHeader>
                      <CardContent className="space-y-4">
                        <div className="flex items-center justify-between">
                          <span className="text-sm font-medium">Auto Pacing</span>
                          <Switch
                            checked={enhancementSettings.smartPacing}
                            onCheckedChange={(checked) => 
                              setEnhancementSettings({...enhancementSettings, smartPacing: checked})
                            }
                          />
                        </div>
                        
                        <div className="flex items-center justify-between">
                          <span className="text-sm font-medium">Rhythm Detection</span>
                          <Switch
                            checked={enhancementSettings.rhythmDetection}
                            onCheckedChange={(checked) => 
                              setEnhancementSettings({...enhancementSettings, rhythmDetection: checked})
                            }
                          />
                        </div>
                        
                        <div className="text-xs text-gray-500">
                          AI analyzes audio and visual patterns to optimize clip timing and transitions
                        </div>
                      </CardContent>
                    </Card>
                  </div>
                </TabsContent>
              </Tabs>

              {/* Generate Video Button */}
              <div className="flex items-center justify-between">
                <div className="text-sm text-gray-600">
                  {timelineSegments.length} segment{timelineSegments.length !== 1 ? 's' : ''} selected
                </div>
                <button
                  onClick={handleGenerateVideo}
                  disabled={timelineSegments.length === 0 || isProcessing}
                  className={`flex items-center space-x-2 px-6 py-3 rounded-lg transition-colors ${
                    timelineSegments.length > 0 && !isProcessing
                      ? 'bg-blue-600 text-white hover:bg-blue-700'
                      : 'bg-gray-300 text-gray-500 cursor-not-allowed'
                  }`}
                >
                  <MdVideoLibrary className="w-5 h-5" />
                  <span>{isProcessing ? 'Generating...' : 'Generate Video'}</span>
                </button>
              </div>

              {/* Processing Status */}
              {isProcessing && (
                <div className="mt-4 p-4 bg-blue-50 rounded-lg border border-blue-200">
                  <div className="flex items-center space-x-3">
                    <div className="animate-spin rounded-full h-5 w-5 border-b-2 border-blue-600"></div>
                    <span className="text-blue-800">{processingStatus}</span>
                  </div>
                </div>
              )}
            </div>
          )}

          {/* Generated Video Section */}
          {generatedVideo && (
            <div className="bg-white rounded-lg border border-gray-200 p-6">
              <h3 className="text-lg font-medium text-gray-900 mb-4">Generated Video</h3>
              <div className="space-y-4">
                <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                  <div>
                    <div className="text-sm text-gray-600 mb-2">Video Preview</div>
                    <video
                      src={generatedVideo.videoUrl}
                      controls
                      className="w-full h-48 object-cover rounded-lg border"
                    />
                  </div>
                  <div className="space-y-3">
                    <div>
                      <div className="text-sm font-medium text-gray-700">Title</div>
                      <div className="text-sm text-gray-600">{generatedVideo.title}</div>
                    </div>
                    <div>
                      <div className="text-sm font-medium text-gray-700">Duration</div>
                      <div className="text-sm text-gray-600">{generatedVideo.duration}s</div>
                    </div>
                    <div>
                      <div className="text-sm font-medium text-gray-700">Segments</div>
                      <div className="text-sm text-gray-600">{generatedVideo.segments} clips merged</div>
                    </div>
                    {generatedVideo.enhancements && (
                      <div>
                        <div className="text-sm font-medium text-gray-700 mb-2">Applied Enhancements</div>
                        <div className="flex flex-wrap gap-1">
                          {generatedVideo.enhancements.map((enhancement: string, index: number) => (
                            <Badge key={index} variant="secondary" className="text-xs">
                              {enhancement}
                            </Badge>
                          ))}
                        </div>
                      </div>
                    )}
                    <a
                      href={generatedVideo.videoUrl}
                      download
                      className="inline-flex items-center space-x-2 px-4 py-2 bg-green-600 text-white rounded-lg hover:bg-green-700 transition-colors"
                    >
                      <MdDownload className="w-4 h-4" />
                      <span>Download Video</span>
                    </a>
                  </div>
                </div>
              </div>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}