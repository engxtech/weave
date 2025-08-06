import { ProfessionalAudioSync, ProfessionalCaptionSegment } from './professional-audio-sync';
import * as fs from 'fs';
import * as path from 'path';

export class ProfessionalCaptionTool {
  private audioSync: ProfessionalAudioSync;

  constructor() {
    this.audioSync = new ProfessionalAudioSync();
  }

  async generateProfessionalCaptions(videoPath: string, options: {
    language?: string;
    style?: 'broadcast' | 'social' | 'educational';
    timingPrecision?: 'standard' | 'professional' | 'broadcast';
  } = {}): Promise<{
    success: boolean;
    segments: any[];
    metadata: {
      totalSegments: number;
      averageConfidence: number;
      speechRate: number;
      timingAccuracy: string;
      audioQuality: string;
    };
  }> {
    console.log(`[ProfessionalCaptionTool] Starting professional caption generation`);
    console.log(`[ProfessionalCaptionTool] Video: ${videoPath}`);
    console.log(`[ProfessionalCaptionTool] Options:`, options);

    try {
      // Resolve video file path - check multiple possible locations
      let resolvedVideoPath = videoPath;
      
      // If path doesn't include directory, check uploads folder
      if (!videoPath.includes('/') && !fs.existsSync(videoPath)) {
        const uploadsPath = `uploads/${videoPath}`;
        if (fs.existsSync(uploadsPath)) {
          resolvedVideoPath = uploadsPath;
        }
      }
      
      // Verify video file exists
      if (!fs.existsSync(resolvedVideoPath)) {
        console.error(`[ProfessionalCaptionTool] Video file not found at: ${resolvedVideoPath}`);
        console.error(`[ProfessionalCaptionTool] Also tried: ${videoPath}`);
        throw new Error(`Video file not found: ${videoPath}`);
      }
      
      console.log(`[ProfessionalCaptionTool] Using video file: ${resolvedVideoPath}`);
      videoPath = resolvedVideoPath;

      // Generate production-level captions
      const professionalSegments = await this.audioSync.generateProductionCaptions(
        videoPath, 
        options.language || 'auto'
      );

      // Convert to UI-compatible format
      const uiSegments = this.convertToUISegments(professionalSegments, options.style || 'broadcast');

      // Calculate metadata
      const metadata = this.calculateMetadata(professionalSegments);

      console.log(`[ProfessionalCaptionTool] Professional caption generation complete:`);
      console.log(`[ProfessionalCaptionTool] - ${metadata.totalSegments} segments generated`);
      console.log(`[ProfessionalCaptionTool] - ${metadata.averageConfidence * 100}% average confidence`);
      console.log(`[ProfessionalCaptionTool] - ${metadata.speechRate} words per minute`);
      console.log(`[ProfessionalCaptionTool] - ${metadata.timingAccuracy} timing accuracy`);

      return {
        success: true,
        segments: uiSegments,
        metadata: metadata
      };

    } catch (error) {
      console.error('[ProfessionalCaptionTool] Error generating professional captions:', error);
      return {
        success: false,
        segments: [],
        metadata: {
          totalSegments: 0,
          averageConfidence: 0,
          speechRate: 0,
          timingAccuracy: 'failed',
          audioQuality: 'unknown'
        }
      };
    }
  }

  private convertToUISegments(professionalSegments: ProfessionalCaptionSegment[], style: string): any[] {
    // Use standard white text for all video captions

    return professionalSegments.map((segment, index) => {
      // Apply style-specific positioning and formatting
      const styleConfig = this.getStyleConfig(style);
      
      return {
        id: segment.id,
        startTime: segment.startTime,
        endTime: segment.endTime,
        duration: segment.duration,
        text: segment.text,
        confidence: segment.confidence,
        words: segment.words.map(word => ({
          word: word.word,
          startTime: word.startTime,
          endTime: word.endTime,
          confidence: word.confidence,
          highlightTiming: {
            onsetTime: word.highlightTiming.onsetTime,
            peakTime: word.highlightTiming.peakTime,
            endTime: word.highlightTiming.endTime,
            intensity: word.highlightTiming.intensity,
            waveformMatched: word.highlightTiming.waveformMatched
          },
          syllableCount: word.syllableCount,
          phonemePattern: word.phonemePattern,
          waveformBased: true
        })),
        x: styleConfig.x,
        y: styleConfig.y,
        fontSize: styleConfig.fontSize,
        color: '#FFFFFF', // Standard white text for all video captions
        style: styleConfig.fontWeight,
        fontFamily: styleConfig.fontFamily,
        shadowColor: styleConfig.shadowColor,
        shadowBlur: styleConfig.shadowBlur,
        background: styleConfig.background,
        borderRadius: styleConfig.borderRadius,
        opacity: styleConfig.opacity,
        animation: styleConfig.animation,
        highlightWords: true,
        logicalSentence: segment.logicalSentence,
        waveformAnalyzed: segment.waveformAnalyzed,
        speechPattern: segment.speechPattern,
        emotionalIntensity: segment.emotionalIntensity,
        backgroundNoise: segment.backgroundNoise,
        timingAccuracy: 'professional' // Mark as production-quality timing
      };
    });
  }

  private getStyleConfig(style: string): any {
    switch (style) {
      case 'broadcast':
        return {
          x: 50, // Center
          y: 90, // Bottom with safe area
          fontSize: 28,
          fontWeight: 'bold',
          fontFamily: 'Arial, Helvetica, sans-serif',
          shadowColor: '#000000',
          shadowBlur: 3,
          background: 'rgba(0, 0, 0, 0.8)',
          borderRadius: 6,
          opacity: 1.0,
          animation: 'fade-in'
        };
      case 'social':
        return {
          x: 50,
          y: 85,
          fontSize: 32,
          fontWeight: 'bold',
          fontFamily: 'Impact, Arial Black, sans-serif',
          shadowColor: '#000000',
          shadowBlur: 4,
          background: 'rgba(0, 0, 0, 0.9)',
          borderRadius: 12,
          opacity: 1.0,
          animation: 'pop-in'
        };
      case 'educational':
        return {
          x: 50,
          y: 88,
          fontSize: 24,
          fontWeight: 'normal',
          fontFamily: 'Georgia, Times New Roman, serif',
          shadowColor: '#000000',
          shadowBlur: 2,
          background: 'rgba(0, 0, 0, 0.7)',
          borderRadius: 8,
          opacity: 1.0,
          animation: 'slide-up'
        };
      default:
        return {
          x: 50,
          y: 85,
          fontSize: 26,
          fontWeight: 'bold',
          fontFamily: 'system-ui, -apple-system, sans-serif',
          shadowColor: '#000000',
          shadowBlur: 2,
          background: 'rgba(0, 0, 0, 0.75)',
          borderRadius: 8,
          opacity: 1.0,
          animation: 'fade-in'
        };
    }
  }

  private calculateMetadata(segments: ProfessionalCaptionSegment[]): any {
    if (segments.length === 0) {
      return {
        totalSegments: 0,
        averageConfidence: 0,
        speechRate: 0,
        timingAccuracy: 'unknown',
        audioQuality: 'unknown'
      };
    }

    // Calculate average confidence
    const totalConfidence = segments.reduce((sum, segment) => sum + segment.confidence, 0);
    const averageConfidence = totalConfidence / segments.length;

    // Calculate speech rate (words per minute)
    const totalWords = segments.reduce((sum, segment) => sum + segment.words.length, 0);
    const totalDuration = Math.max(...segments.map(s => s.endTime)) - Math.min(...segments.map(s => s.startTime));
    const speechRate = Math.round((totalWords / totalDuration) * 60);

    // Determine timing accuracy based on waveform analysis
    const waveformAnalyzedSegments = segments.filter(s => s.waveformAnalyzed).length;
    const waveformPercentage = (waveformAnalyzedSegments / segments.length) * 100;
    
    let timingAccuracy: string;
    if (waveformPercentage >= 90) {
      timingAccuracy = 'broadcast-quality (±50ms)';
    } else if (waveformPercentage >= 70) {
      timingAccuracy = 'professional (±100ms)';
    } else if (waveformPercentage >= 50) {
      timingAccuracy = 'standard (±200ms)';
    } else {
      timingAccuracy = 'basic (±500ms)';
    }

    // Determine audio quality based on background noise
    const averageNoise = segments.reduce((sum, segment) => sum + segment.backgroundNoise, 0) / segments.length;
    let audioQuality: string;
    if (averageNoise < 0.2) {
      audioQuality = 'excellent';
    } else if (averageNoise < 0.4) {
      audioQuality = 'good';
    } else if (averageNoise < 0.6) {
      audioQuality = 'fair';
    } else {
      audioQuality = 'poor';
    }

    return {
      totalSegments: segments.length,
      averageConfidence: averageConfidence,
      speechRate: speechRate,
      timingAccuracy: timingAccuracy,
      audioQuality: audioQuality
    };
  }
}