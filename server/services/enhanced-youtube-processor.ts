import axios from 'axios';

interface TranscriptItem {
  text: string;
  duration?: number;
  offset?: number;
}

export class EnhancedYouTubeProcessor {
  private apiKey: string;

  constructor(apiKey: string) {
    this.apiKey = apiKey;
  }

  async processYouTubeVideo(videoUrl: string, style: string, duration: number): Promise<any> {
    try {
      console.log('Enhanced YouTube processing for:', videoUrl);
      
      const videoId = this.extractVideoId(videoUrl);
      if (!videoId) {
        throw new Error('Invalid YouTube URL');
      }

      // Fetch transcript using the working approach from ChatGPT code
      const transcript = await this.fetchTranscript(videoId);
      
      if (!transcript) {
        console.log('No transcript available, using URL-based analysis');
        return await this.analyzeVideoByUrl(videoUrl, style, duration);
      }

      console.log(`Transcript fetched: ${transcript.length} characters`);
      
      // Analyze with Gemini using the transcript
      const analysis = await this.analyzeWithGemini(transcript, style, duration, videoUrl);
      
      return {
        success: true,
        hasTranscript: true,
        transcriptLength: transcript.length,
        analysis
      };
      
    } catch (error) {
      console.error('Enhanced processing error:', error);
      return {
        success: false,
        error: error.message,
        fallbackToRegular: true
      };
    }
  }

  private async fetchTranscript(videoId: string): Promise<string | null> {
    try {
      // Use dynamic import with CommonJS compatibility
      const youtubeTranscriptModule = await import('youtube-transcript');
      
      // Handle different export patterns
      let YoutubeTranscript;
      if (youtubeTranscriptModule.default?.YoutubeTranscript) {
        YoutubeTranscript = youtubeTranscriptModule.default.YoutubeTranscript;
      } else if (youtubeTranscriptModule.YoutubeTranscript) {
        YoutubeTranscript = youtubeTranscriptModule.YoutubeTranscript;
      } else if (youtubeTranscriptModule.default) {
        YoutubeTranscript = youtubeTranscriptModule.default;
      } else {
        throw new Error('Could not find YoutubeTranscript in module');
      }

      const transcript = await YoutubeTranscript.fetchTranscript(videoId);
      const fullText = transcript.map((t: TranscriptItem) => t.text).join(' ');
      
      return fullText;
    } catch (error) {
      console.error('Transcript fetch error:', error);
      return null;
    }
  }

  private async analyzeWithGemini(transcript: string, style: string, duration: number, videoUrl: string): Promise<any> {
    try {
      const prompt = `You are a short-form video expert creating ${style} content.

Based on the transcript below, create a detailed ${duration}-second short video script.

Return JSON with:
{
  "title": "Engaging title based on actual content",
  "hook": "Attention-grabbing opening line",
  "script": "Full script under ${duration} seconds with timing markers",
  "keyMoments": [
    {"timestamp": "00:30", "description": "Key moment from original video"},
    {"timestamp": "01:45", "description": "Another important moment"}
  ],
  "description": "Video description referencing original content",
  "hashtags": ["#relevant", "#tags", "#based", "#on", "#content"],
  "editingNotes": "Tone and editing style recommendations"
}

Style: ${style}
Duration: ${duration} seconds
Original Video: ${videoUrl}

Transcript (first 3000 chars):
${transcript.substring(0, 3000)}`;

      const response = await axios.post(
        `https://generativelanguage.googleapis.com/v1beta/models/gemini-2.0-flash-exp:generateContent?key=${this.apiKey}`,
        {
          contents: [{ role: "user", parts: [{ text: prompt }] }],
          generationConfig: {
            temperature: 0.8,
            topK: 32,
            topP: 1,
            maxOutputTokens: 2048,
          },
          safetySettings: [
            { category: "HARM_CATEGORY_HARASSMENT", threshold: "BLOCK_MEDIUM_AND_ABOVE" },
            { category: "HARM_CATEGORY_HATE_SPEECH", threshold: "BLOCK_MEDIUM_AND_ABOVE" },
            { category: "HARM_CATEGORY_SEXUALLY_EXPLICIT", threshold: "BLOCK_MEDIUM_AND_ABOVE" },
            { category: "HARM_CATEGORY_DANGEROUS_CONTENT", threshold: "BLOCK_MEDIUM_AND_ABOVE" },
          ],
        }
      );

      const result = response.data.candidates[0]?.content?.parts[0]?.text;
      
      if (!result) {
        throw new Error('No response from Gemini');
      }
      
      // Clean and parse JSON
      const cleanedResult = result.replace(/```json\n?|\n?```/g, '').trim();
      const analysis = JSON.parse(cleanedResult);
      
      console.log('Gemini analysis completed with transcript data');
      return analysis;
      
    } catch (error) {
      console.error('Gemini analysis error:', error);
      throw error;
    }
  }

  private async analyzeVideoByUrl(videoUrl: string, style: string, duration: number): Promise<any> {
    // Fallback analysis without transcript
    const prompt = `Analyze the YouTube video at ${videoUrl} and create a ${duration}-second ${style} short script.

Return JSON with:
{
  "title": "Engaging title",
  "script": "Script with timing",
  "description": "Description",
  "hashtags": ["#tag1", "#tag2"]
}`;

    try {
      const response = await axios.post(
        `https://generativelanguage.googleapis.com/v1beta/models/gemini-2.0-flash-exp:generateContent?key=${this.apiKey}`,
        {
          contents: [{ role: "user", parts: [{ text: prompt }] }],
          generationConfig: {
            temperature: 0.8,
            maxOutputTokens: 1024,
          }
        }
      );

      const result = response.data.candidates[0]?.content?.parts[0]?.text;
      const cleanedResult = result.replace(/```json\n?|\n?```/g, '').trim();
      return JSON.parse(cleanedResult);
    } catch (error) {
      console.error('URL-based analysis error:', error);
      throw error;
    }
  }

  private extractVideoId(url: string): string | null {
    try {
      const urlObj = new URL(url);
      return urlObj.searchParams.get('v');
    } catch {
      const match = url.match(/(?:youtube\.com\/watch\?v=|youtu\.be\/)([^&\n?#]+)/);
      return match ? match[1] : null;
    }
  }
}

export const createEnhancedYouTubeProcessor = (apiKey: string): EnhancedYouTubeProcessor => {
  return new EnhancedYouTubeProcessor(apiKey);
};