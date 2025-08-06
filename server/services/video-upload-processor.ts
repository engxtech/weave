import {
  GoogleGenAI,
  createUserContent,
  createPartFromUri,
} from "@google/genai";
import * as fs from 'fs';
import * as path from 'path';
import { promises as fsPromises } from 'fs';

export interface VideoUploadAnalysis {
  title: string;
  description: string;
  keyMoments: Array<{
    timestamp: string;
    description: string;
    importance: number;
  }>;
  topics: string[];
  duration: number;
  transcript: string;
  visualDescription: string;
  audioDescription: string;
}

export interface ShortsScript {
  title: string;
  script: string;
  description: string;
  hashtags: string[];
  keyMoments: Array<{
    timestamp: string;
    text: string;
    action: string;
  }>;
  style: string;
  editingNotes: string;
}

export class VideoUploadProcessor {
  private ai: GoogleGenAI;

  constructor(apiKey: string) {
    this.ai = new GoogleGenAI({ apiKey });
  }

  async analyzeUploadedVideo(videoPath: string): Promise<VideoUploadAnalysis> {
    console.log('GEMINI ANALYSIS - Starting video analysis for file:', videoPath);
    
    if (!fs.existsSync(videoPath)) {
      throw new Error(`Video file not found: ${videoPath}`);
    }

    const fileStats = fs.statSync(videoPath);
    console.log('GEMINI ANALYSIS - File size:', fileStats.size, 'bytes');
    console.log('GEMINI ANALYSIS - File path being uploaded to Gemini:', videoPath);

    try {
      // Upload file to Gemini
      console.log('GEMINI ANALYSIS - Uploading video to Gemini...');
      console.log('GEMINI ANALYSIS - File size:', require('fs').statSync(videoPath).size, 'bytes');
      
      // Check if we need to convert to MP4 for Gemini
      const isMP4 = videoPath.toLowerCase().endsWith('.mp4');
      let geminiVideoPath = videoPath;
      
      if (!isMP4) {
        console.log('GEMINI ANALYSIS - Converting non-MP4 video to MP4 for Gemini compatibility');
        const tempMp4Path = videoPath.replace(/\.[^/.]+$/, '_temp.mp4');
        
        // Convert to MP4 for Gemini
        const { spawn } = require('child_process');
        await new Promise((resolve, reject) => {
          const ffmpeg = spawn('ffmpeg', [
            '-i', videoPath,
            '-c:v', 'libx264',
            '-c:a', 'aac',
            '-y',
            tempMp4Path
          ]);
          
          ffmpeg.on('close', (code) => {
            if (code === 0) {
              console.log('GEMINI ANALYSIS - Temporary MP4 conversion completed');
              resolve(true);
            } else {
              reject(new Error(`MP4 conversion failed with code ${code}`));
            }
          });
          
          ffmpeg.on('error', (error) => {
            reject(error);
          });
        });
        
        geminiVideoPath = tempMp4Path;
      } else {
        console.log('GEMINI ANALYSIS - Video is already in MP4 format');
      }
      
      console.log('GEMINI ANALYSIS - Uploading file to Gemini API...');
      console.log('GEMINI ANALYSIS - Upload config:', {
        file: geminiVideoPath,
        mimeType: "video/mp4"
      });
      
      const uploadedFile = await this.ai.files.upload({
        file: geminiVideoPath,
        config: { mimeType: "video/mp4" },
      });
      
      console.log('GEMINI ANALYSIS - File uploaded successfully:');
      console.log('GEMINI ANALYSIS - File URI:', uploadedFile.uri);
      console.log('GEMINI ANALYSIS - File name:', uploadedFile.name);
      console.log('GEMINI ANALYSIS - File state:', uploadedFile.state);

      console.log('GEMINI ANALYSIS - Video uploaded to Gemini successfully');
      console.log('GEMINI ANALYSIS - Gemini file URI:', uploadedFile.uri);
      console.log('GEMINI ANALYSIS - Gemini file name:', uploadedFile.name);

      console.log('GEMINI ANALYSIS - Sending analysis request to gemini-2.0-flash-exp model');

      // Analyze the video
      const response = await this.ai.models.generateContent({
        model: "gemini-2.0-flash-exp",
        contents: createUserContent([
          createPartFromUri(uploadedFile.uri, uploadedFile.mimeType),
          `Analyze this video comprehensively. Provide detailed analysis including:

1. Video content summary and key topics
2. Transcription of spoken content
3. Visual description of what's happening
4. Audio description (music, sound effects, speech patterns)
5. Key moments with timestamps and importance scores (1-10)
6. Overall duration and pacing

Return ONLY valid JSON in this exact format:
{
  "title": "descriptive title",
  "description": "detailed description of video content",
  "keyMoments": [
    {
      "timestamp": "MM:SS",
      "description": "what happens at this moment",
      "importance": 8
    }
  ],
  "topics": ["topic1", "topic2"],
  "duration": 120,
  "transcript": "full transcription of spoken content",
  "visualDescription": "detailed visual description",
  "audioDescription": "audio content description"
}`
        ]),
      });

      const responseText = response.text;
      console.log('GEMINI ANALYSIS - Raw response received:', responseText ? responseText.substring(0, 500) + '...' : 'Empty response');
      
      if (!responseText) {
        throw new Error('Empty response from Gemini');
      }

      // Clean and parse JSON response
      const cleanedResponse = responseText.replace(/```json\n?|\n?```/g, '').trim();
      console.log('GEMINI ANALYSIS - Cleaned response for parsing:', cleanedResponse.substring(0, 200) + '...');
      
      let analysis;
      try {
        analysis = JSON.parse(cleanedResponse) as VideoUploadAnalysis;
        console.log('GEMINI ANALYSIS - Successfully parsed response:', analysis.title);
      } catch (parseError) {
        console.error('GEMINI ANALYSIS - JSON parse error:', parseError);
        console.log('GEMINI ANALYSIS - Problematic response:', cleanedResponse);
        throw new Error('Failed to parse AI response as JSON');
      }

      // Clean up uploaded file from Gemini
      console.log('GEMINI ANALYSIS - Cleaning up uploaded file from Gemini...');
      console.log('GEMINI ANALYSIS - File to delete:', uploadedFile.name);
      try {
        await this.ai.files.delete(uploadedFile.name);
        console.log('GEMINI ANALYSIS - File cleanup successful');
      } catch (error) {
        console.warn('GEMINI ANALYSIS - Failed to delete uploaded file:', error);
      }
      
      // Clean up temporary MP4 file if created
      if (!isMP4 && geminiVideoPath !== videoPath) {
        console.log('GEMINI ANALYSIS - Cleaning up temporary MP4 file:', geminiVideoPath);
        try {
          await fsPromises.unlink(geminiVideoPath);
          console.log('GEMINI ANALYSIS - Temporary MP4 file cleaned up');
        } catch (error) {
          console.warn('GEMINI ANALYSIS - Failed to clean up temporary MP4 file:', error);
        }
      }

      console.log('GEMINI ANALYSIS - Analysis complete for:', analysis.title);
      console.log('GEMINI ANALYSIS - Analysis summary:');
      console.log('  - Duration:', analysis.duration);
      console.log('  - Topics:', analysis.topics?.join(', '));
      console.log('  - Mood:', analysis.mood);
      console.log('  - Viral potential:', analysis.viralPotential);
      console.log('  - Key moments:', analysis.keyMoments?.length);
      
      return analysis;

    } catch (error) {
      console.error('GEMINI ANALYSIS - Error analyzing uploaded video:', error);
      throw new Error(`Failed to analyze video: ${error}`);
    }
  }

  async generateShortsScript(
    analysis: VideoUploadAnalysis,
    style: string,
    duration: number
  ): Promise<ShortsScript> {
    console.log(`Generating ${style} shorts script for ${duration}s`);
    
    const response = await this.ai.models.generateContent({
      model: "gemini-1.5-flash",
      contents: createUserContent([
        `Based on this video analysis, create a ${duration}-second ${style} short:

Video Analysis:
${JSON.stringify(analysis, null, 2)}

Create an engaging ${style} short that captures the best moments. Return ONLY valid JSON:
{
  "title": "catchy title for the short",
  "script": "detailed script with timing and actions",
  "description": "engaging description",
  "hashtags": ["#tag1", "#tag2", "#tag3"],
  "keyMoments": [
    {
      "timestamp": "0:00-0:03",
      "text": "text overlay or narration",
      "action": "visual instruction"
    }
  ],
  "style": "${style}",
  "editingNotes": "specific editing instructions"
}`
      ]),
    });

    const responseText = response.text;
    if (!responseText) {
      throw new Error('Empty response from Gemini');
    }

    const cleanedResponse = responseText.replace(/```json\n?|\n?```/g, '').trim();
    return JSON.parse(cleanedResponse) as ShortsScript;
  }
}

export const createVideoUploadProcessor = (apiKey: string): VideoUploadProcessor => {
  return new VideoUploadProcessor(apiKey);
};