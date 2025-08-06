import axios from 'axios';

interface TranscriptItem {
  text: string;
  duration: number;
  offset: number;
}

export class YouTubeTranscriptService {
  private apiKey: string;

  constructor(apiKey: string) {
    this.apiKey = apiKey;
  }

  async fetchTranscript(videoUrl: string): Promise<string | null> {
    try {
      console.log('Fetching transcript for:', videoUrl);
      
      const videoId = this.extractVideoId(videoUrl);
      if (!videoId) {
        console.error('Invalid YouTube URL');
        return null;
      }

      // Import youtube-transcript with proper syntax
      const youtubeTranscriptModule = await import('youtube-transcript');
      const YoutubeTranscript = youtubeTranscriptModule.default || youtubeTranscriptModule.YoutubeTranscript;
      const transcript = await YoutubeTranscript.fetchTranscript(videoId);
      
      const fullTranscript = transcript.map((t: any) => t.text).join(' ');
      console.log('Transcript fetched successfully, length:', fullTranscript.length);
      
      return fullTranscript;
    } catch (error) {
      console.error('Error fetching transcript:', error);
      return null;
    }
  }

  async analyzeWithGemini(transcript: string, style: string, duration: number): Promise<any> {
    try {
      const prompt = `
You are a short-form video expert creating ${style} content.

Based on the transcript below, create a detailed ${duration}-second short video script.

Return JSON with:
{
  "title": "Engaging title",
  "hook": "Attention-grabbing opening line",
  "script": "Full script under ${duration} seconds of speech",
  "keyMoments": [
    {"timestamp": "00:30", "description": "Key moment from original video"},
    {"timestamp": "01:45", "description": "Another important moment"}
  ],
  "description": "Video description",
  "hashtags": ["#relevant", "#tags"],
  "editingNotes": "Tone and editing style recommendations"
}

Style: ${style}
Duration: ${duration} seconds

Transcript:
${transcript.substring(0, 3000)}
`;

      const response = await axios.post(
        `https://generativelanguage.googleapis.com/v1beta/models/gemini-2.0-flash-exp:generateContent?key=${this.apiKey}`,
        {
          contents: [{ role: "user", parts: [{ text: prompt }] }],
          generationConfig: {
            temperature: 0.8,
            topK: 32,
            topP: 1,
            maxOutputTokens: 2048,
            stopSequences: [],
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
      console.log('Gemini analysis completed');
      
      // Clean and parse JSON
      const cleanedResult = result.replace(/```json\n?|\n?```/g, '').trim();
      return JSON.parse(cleanedResult);
      
    } catch (error) {
      console.error('Gemini analysis error:', error);
      return null;
    }
  }

  private extractVideoId(url: string): string | null {
    try {
      const urlObj = new URL(url);
      return urlObj.searchParams.get('v');
    } catch {
      // Try regex fallback
      const match = url.match(/(?:youtube\.com\/watch\?v=|youtu\.be\/)([^&\n?#]+)/);
      return match ? match[1] : null;
    }
  }
}

export const createYouTubeTranscriptService = (apiKey: string): YouTubeTranscriptService => {
  return new YouTubeTranscriptService(apiKey);
};