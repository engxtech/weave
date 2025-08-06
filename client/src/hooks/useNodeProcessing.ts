import { useState, useCallback } from 'react';

interface ProcessingResult {
  success: boolean;
  data?: any;
  error?: string;
}

export const useNodeProcessing = () => {
  const [processing, setProcessing] = useState<Record<string, boolean>>({});
  const [results, setResults] = useState<Record<string, ProcessingResult>>({});

  const processNode = useCallback(async (nodeId: string, nodeType: string, config: any) => {
    setProcessing(prev => ({ ...prev, [nodeId]: true }));

    try {
      let result: ProcessingResult;

      switch (nodeType) {
        case 'enhancement':
          result = await processEnhancementNode(config);
          break;
        case 'shorts':
          result = await processShortsNode(config);
          break;
        case 'voice':
          result = await processVoiceNode(config);
          break;
        case 'audio_enhance':
          result = await processAudioEnhanceNode(config);
          break;
        case 'eye_contact':
          result = await processEyeContactNode(config);
          break;
        case 'reframe':
          result = await processReframeNode(config);
          break;
        case 'cut':
          result = await processCutNode(config);
          break;
        case 'background':
          result = await processBackgroundNode(config);
          break;
        case 'broll':
          result = await processBRollNode(config);
          break;
        case 'captions':
          result = await processCaptionsNode(config);
          break;
        case 'music':
          result = await processMusicNode(config);
          break;
        default:
          result = { success: false, error: `Unknown node type: ${nodeType}` };
      }

      setResults(prev => ({ ...prev, [nodeId]: result }));
      return result;

    } catch (error) {
      const errorResult = { 
        success: false, 
        error: error instanceof Error ? error.message : 'Processing failed' 
      };
      setResults(prev => ({ ...prev, [nodeId]: errorResult }));
      return errorResult;
    } finally {
      setProcessing(prev => ({ ...prev, [nodeId]: false }));
    }
  }, []);

  const processShortsNode = async (config: any): Promise<ProcessingResult> => {
    const { videoPath, searchPhrases, targetViralMoments } = config;

    if (!videoPath) {
      return { success: false, error: 'No video file provided' };
    }

    const response = await fetch('/api/video-nodes/extract-shorts', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        videoPath,
        searchPhrases: searchPhrases?.split(',').map((p: string) => p.trim()) || [],
        targetViralMoments
      }),
    });

    const data = await response.json();

    if (!response.ok) {
      return { success: false, error: data.error || 'Failed to extract shorts' };
    }

    // Return categorized moments for parallel processing
    return { 
      success: true, 
      data: {
        ...data.data,
        parallelOutputs: {
          inspiring: data.data?.categorizedMoments?.inspiring || [],
          viral: data.data?.categorizedMoments?.viral || [],
          funny: data.data?.categorizedMoments?.funny || []
        }
      } 
    };
  };

  const processVoiceNode = async (config: any): Promise<ProcessingResult> => {
    const { videoPath, targetLanguage, preserveBackgroundAudio, safewords, translationDictionary } = config;

    if (!videoPath) {
      return { success: false, error: 'No video file provided' };
    }

    const response = await fetch('/api/video-nodes/process-voice', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        videoPath,
        targetLanguage,
        preserveBackgroundAudio,
        safewords,
        translationDictionary
      }),
    });

    const data = await response.json();

    if (!response.ok) {
      return { success: false, error: data.error || 'Failed to process voice' };
    }

    return { success: true, data: data.data };
  };

  const processAudioEnhanceNode = async (config: any): Promise<ProcessingResult> => {
    const { videoPath, processingBackend, enhancementType, enhancementSteps } = config;

    if (!videoPath) {
      return { success: false, error: 'No video file provided' };
    }

    const response = await fetch('/api/video-nodes/enhance-audio', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        videoPath,
        processingBackend,
        enhancementType,
        enhancementSteps
      }),
    });

    const data = await response.json();

    if (!response.ok) {
      return { success: false, error: data.error || 'Failed to enhance audio' };
    }

    return { success: true, data: data.data };
  };

  const processEyeContactNode = async (config: any): Promise<ProcessingResult> => {
    const { videoPath, accuracyBoost, naturalLookAway } = config;
    
    const response = await fetch('/api/video-nodes/correct-eye-contact', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ videoPath, accuracyBoost, naturalLookAway }),
    });
    
    const data = await response.json();
    return response.ok ? { success: true, data: data.data } : { success: false, error: data.error };
  };

  const processReframeNode = async (config: any): Promise<ProcessingResult> => {
    const { videoPath, aspectRatio, activeSpeakerDetection, focusSubject, avoidSubject } = config;
    
    const response = await fetch('/api/video-nodes/reframe-video', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ videoPath, aspectRatio, activeSpeakerDetection, focusSubject, avoidSubject }),
    });
    
    const data = await response.json();
    return response.ok ? { success: true, data: data.data } : { success: false, error: data.error };
  };

  const processCutNode = async (config: any): Promise<ProcessingResult> => {
    const { videoPath, contentToRemove } = config;
    
    const response = await fetch('/api/video-nodes/cut-content', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ videoPath, contentToRemove }),
    });
    
    const data = await response.json();
    return response.ok ? { success: true, data: data.data } : { success: false, error: data.error };
  };

  const processBackgroundNode = async (config: any): Promise<ProcessingResult> => {
    const { videoPath, processingEngine, backgroundColor } = config;
    
    const response = await fetch('/api/video-nodes/replace-background', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ videoPath, processingEngine, backgroundColor }),
    });
    
    const data = await response.json();
    return response.ok ? { success: true, data: data.data } : { success: false, error: data.error };
  };

  const processBRollNode = async (config: any): Promise<ProcessingResult> => {
    const { videoPath, assetTypes, clipsPerMinute, styleDescription, contentFocus } = config;
    
    const response = await fetch('/api/video-nodes/generate-broll', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ videoPath, assetTypes, clipsPerMinute, styleDescription, contentFocus }),
    });
    
    const data = await response.json();
    return response.ok ? { success: true, data: data.data } : { success: false, error: data.error };
  };

  const processCaptionsNode = async (config: any): Promise<ProcessingResult> => {
    const { videoPath, captionSize, highlightColor } = config;
    
    const response = await fetch('/api/video-nodes/generate-captions', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ videoPath, captionSize, highlightColor }),
    });
    
    const data = await response.json();
    return response.ok ? { success: true, data: data.data } : { success: false, error: data.error };
  };

  const processMusicNode = async (config: any): Promise<ProcessingResult> => {
    const { videoPath, musicStyle } = config;
    
    const response = await fetch('/api/video-nodes/generate-music', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ videoPath, musicStyle }),
    });
    
    const data = await response.json();
    return response.ok ? { success: true, data: data.data } : { success: false, error: data.error };
  };

  const processEnhancementNode = async (config: any): Promise<ProcessingResult> => {
    const { videoPath, enhanceAudio, stabilizeVideo, colorCorrection, noiseReduction } = config;
    
    if (!videoPath) {
      return { success: false, error: 'No video file provided' };
    }

    const response = await fetch('/api/video-nodes/enhance-video', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ 
        videoPath, 
        config: {
          enhanceAudio,
          stabilizeVideo,
          colorCorrection,
          noiseReduction
        }
      }),
    });
    
    const data = await response.json();
    return response.ok ? { success: true, data: data.data } : { success: false, error: data.error };
  };

  return {
    processing,
    results,
    processNode
  };
};