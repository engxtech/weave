import { GoogleGenerativeAI } from '@google/generative-ai';

interface VideoAnalysis {
  videoId: string;
  title: string;
  description: string;
  duration: string;
  keyMoments: Array<{
    timestamp: string;
    description: string;
    importance: number;
  }>;
  topics: string[];
  mood: string;
  visualElements: string[];
  audioElements: string[];
  transcript?: string;
}

interface ShortsScript {
  title: string;
  hook: string;
  script: string;
  description: string;
  hashtags: string[];
  keyClips: Array<{
    startTime: string;
    endTime: string;
    description: string;
  }>;
  editingNotes: string;
}

export class VideoAnalyzer {
  private ai: GoogleGenerativeAI;

  constructor(apiKey: string) {
    this.ai = new GoogleGenerativeAI(apiKey);
  }

  async analyzeVideo(youtubeUrl: string): Promise<VideoAnalysis> {
    console.log('Analyzing YouTube video directly with Gemini fileData:', youtubeUrl);
    
    // Extract video ID
    const videoId = this.extractVideoId(youtubeUrl);
    if (!videoId) {
      throw new Error('Invalid YouTube URL');
    }

    const model = this.ai.getGenerativeModel({ model: "gemini-2.0-flash-exp" });
    
    const prompt = `Analyze this YouTube video and provide detailed analysis of the actual content you can see and hear.

Return ONLY valid JSON with the following structure:
{
  "videoId": "${videoId}",
  "title": "actual title or description based on video content",
  "description": "detailed description of what actually happens in the video",
  "duration": "estimated duration based on content",
  "keyMoments": [
    {
      "timestamp": "time in video",
      "description": "what actually happens at this moment",
      "importance": 1-10
    }
  ],
  "topics": ["main topics covered in the video"],
  "mood": "actual mood/tone of the video",
  "visualElements": ["visual elements you can see"],
  "audioElements": ["audio elements you can hear"]
}

Be specific about what you actually observe in the video content.`;

    try {
      const result = await model.generateContent([
        prompt,
        {
          fileData: {
            fileUri: youtubeUrl,
          },
        },
      ]);

      const response = result.response.text();
      console.log('Direct video analysis completed');
      
      const analysis = this.parseResponse(response);
      
      if (!analysis) {
        throw new Error('Failed to parse video analysis');
      }

      return analysis;
    } catch (error) {
      console.error('Video analysis error:', error);
      throw new Error(`Failed to analyze video: ${error.message}`);
    }
  }

  async generateShortsScript(
    analysis: VideoAnalysis, 
    style: string, 
    duration: number
  ): Promise<ShortsScript> {
    console.log(`Generating ${style} shorts script for ${duration}s`);
    
    const model = this.ai.getGenerativeModel({ model: "gemini-2.0-flash-exp" });
    
    const prompt = `Based on this video analysis, create a ${duration}-second ${style} short:

Video Analysis:
${JSON.stringify(analysis, null, 2)}

Create a compelling ${style} short that uses REAL moments from the original video.

Return ONLY valid JSON:
{
  "title": "catchy title with emojis",
  "hook": "attention-grabbing opening line",
  "script": "detailed ${duration}s script with timing (0-5s: action, 5-10s: action, etc.)",
  "description": "social media description",
  "hashtags": ["#tag1", "#tag2"],
  "keyClips": [
    {
      "startTime": "0:30",
      "endTime": "0:45", 
      "description": "specific clip from original video"
    }
  ],
  "editingNotes": "specific editing instructions for ${style} style"
}`;

    try {
      const result = await model.generateContent({
        contents: [{
          role: "user",
          parts: [{ text: prompt }]
        }],
        generationConfig: {
          temperature: 0.8,
          maxOutputTokens: 2048,
        }
      });

      const response = result.response.text();
      console.log('Shorts script generated');
      
      const script = this.parseResponse(response);
      
      if (!script) {
        throw new Error('Failed to parse shorts script');
      }

      return script;
    } catch (error) {
      console.error('Script generation error:', error);
      throw new Error(`Failed to generate script: ${error.message}`);
    }
  }

  private parseResponse(response: string): any {
    try {
      let cleaned = response.replace(/```json\n?|\n?```/g, '').trim();
      
      const jsonStart = cleaned.indexOf('{');
      if (jsonStart > 0) {
        cleaned = cleaned.substring(jsonStart);
      }
      
      const jsonEnd = cleaned.lastIndexOf('}');
      if (jsonEnd < cleaned.length - 1) {
        cleaned = cleaned.substring(0, jsonEnd + 1);
      }
      
      return JSON.parse(cleaned);
    } catch (error) {
      console.error('JSON parsing error:', error);
      console.log('Raw response sample:', response.substring(0, 300));
      return null;
    }
  }

  extractVideoId(url: string): string | null {
    try {
      const urlObj = new URL(url);
      return urlObj.searchParams.get('v');
    } catch {
      const match = url.match(/(?:youtube\.com\/watch\?v=|youtu\.be\/)([^&\n?#]+)/);
      return match ? match[1] : null;
    }
  }
}

export const createVideoAnalyzer = (apiKey: string): VideoAnalyzer => {
  return new VideoAnalyzer(apiKey);
};