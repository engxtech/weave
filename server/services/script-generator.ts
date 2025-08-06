import { GoogleGenAI } from '@google/genai';

export interface ScriptSegment {
  timeRange: string;
  action: string;
  sourceTimestamp: string;
  instructions: string;
}

export interface GeneratedScript {
  title: string;
  style: string;
  duration: number;
  aspectRatio: string;
  timeline: ScriptSegment[];
  description: string;
  hashtags: string[];
}

export interface ScriptRequest {
  filePath: string;
  style: 'viral' | 'educational' | 'entertaining' | 'dramatic' | 'funny' | 'professional';
  duration: 15 | 30 | 60;
  aspectRatio: '9:16' | '16:9' | '1:1';
  tone: 'engaging' | 'casual' | 'professional' | 'energetic' | 'calm';
  requirements?: string;
}

export class ScriptGenerator {
  private ai: GoogleGenAI;

  constructor(apiKey: string) {
    this.ai = new GoogleGenAI({ apiKey });
  }

  async generateScript(request: ScriptRequest): Promise<GeneratedScript> {
    console.log('=== SCRIPT GENERATOR - STARTING ===');
    console.log('File path:', request.filePath);
    console.log('Style:', request.style);
    console.log('Duration:', request.duration);
    console.log('Aspect ratio:', request.aspectRatio);
    console.log('Tone:', request.tone);

    // Check file existence
    try {
      const fs = await import('fs');
      const stats = fs.statSync(request.filePath);
      console.log('Video file size:', stats.size, 'bytes');
    } catch (error) {
      console.error('ERROR: Cannot access video file:', error);
      throw new Error(`Video file not accessible: ${request.filePath}`);
    }

    // Upload video to Gemini
    console.log('=== UPLOADING VIDEO TO GEMINI ===');
    const uploadedFile = await this.ai.files.upload({
      file: request.filePath,
      config: { mimeType: "video/mp4" }
    });

    console.log('Uploaded file URI:', uploadedFile.uri);
    console.log('File name:', uploadedFile.name);

    // Wait for file to become active - use a simpler approach with delay
    console.log('=== WAITING FOR FILE TO BECOME ACTIVE ===');
    console.log('Waiting 10 seconds for file processing...');
    await new Promise(resolve => setTimeout(resolve, 10000)); // Wait 10 seconds for file to process
    console.log('File processing wait complete, proceeding with generation');

    // Generate script using Gemini 2.0 Flash
    const scriptPrompt = `Transcribe, analyze and create a ${request.duration} seconds shorts that can become viral, ${request.aspectRatio} vertical style.

The output should contain a script which contains:
- New Timeline (in short)
- Action for the Clip
- Source Video Timestamp to CUT FROM
- Instructions

Format as JSON:
{
  "title": "Catchy viral title",
  "style": "${request.style}",
  "duration": ${request.duration},
  "aspectRatio": "${request.aspectRatio}",
  "timeline": [
    {
      "timeRange": "0-3 sec",
      "action": "Man sits and stares at the box.",
      "sourceTimestamp": "00:20 - 00:23",
      "instructions": "Crop this shot to be vertical (9:16). Add Text: 'You find a magic box...'"
    },
    {
      "timeRange": "3-6 sec", 
      "action": "Close-up of hands opening the box",
      "sourceTimestamp": "00:45 - 00:48",
      "instructions": "Zoom in for dramatic effect. Add Text: 'What's inside?'"
    }
  ],
  "description": "Engaging description for the viral short",
  "hashtags": ["#viral", "#shorts", "#trending"]
}

Requirements:
- Style: ${request.style}
- Tone: ${request.tone}
- Duration: ${request.duration} seconds
- Aspect Ratio: ${request.aspectRatio}
${request.requirements ? `- Custom Requirements: ${request.requirements}` : ''}

Make it viral and engaging!`;

    console.log('=== SENDING SCRIPT GENERATION REQUEST ===');
    console.log('Model: gemini-1.5-flash');
    console.log('Prompt length:', scriptPrompt.length, 'characters');

    const response = await this.ai.models.generateContent({
      model: "gemini-1.5-flash",
      contents: [
        {
          parts: [
            {
              fileData: {
                mimeType: uploadedFile.mimeType,
                fileUri: uploadedFile.uri,
              },
            },
            { text: scriptPrompt }
          ]
        }
      ]
    });

    console.log('=== SCRIPT GENERATION RESPONSE ===');
    const responseText = response.text || '';
    console.log('Response length:', responseText.length);
    console.log('Response (first 500 chars):', responseText.substring(0, 500));

    // Skip file cleanup for now due to API compatibility issues
    console.log('Skipping file cleanup (file will be auto-deleted by Gemini after 24 hours)');

    // Parse response - handle markdown formatting
    let cleanedResponse = responseText;
    
    // Remove markdown formatting and explanatory text
    cleanedResponse = cleanedResponse.replace(/^.*?```json\s*/s, '');
    cleanedResponse = cleanedResponse.replace(/```.*$/s, '');
    cleanedResponse = cleanedResponse.replace(/^\s*Here's.*?\n/s, '');
    cleanedResponse = cleanedResponse.replace(/\*\*.*?\*\*/g, '');
    cleanedResponse = cleanedResponse.trim();
    
    // Find JSON object boundaries
    const jsonStart = cleanedResponse.indexOf('{');
    const jsonEnd = cleanedResponse.lastIndexOf('}');
    
    if (jsonStart !== -1 && jsonEnd !== -1 && jsonEnd > jsonStart) {
      cleanedResponse = cleanedResponse.substring(jsonStart, jsonEnd + 1);
    }
    
    try {
      const parsed = JSON.parse(cleanedResponse);
      console.log('=== SCRIPT GENERATION SUCCESS ===');
      console.log('Generated title:', parsed.title);
      console.log('Timeline segments:', parsed.timeline?.length || 0);
      
      return parsed;
    } catch (error) {
      console.error('=== JSON PARSE ERROR ===');
      console.error('Parse error:', error.message);
      console.error('Problematic response:', cleanedResponse);
      
      // Return fallback script
      return {
        title: `${request.style} Short Script`,
        style: request.style,
        duration: request.duration,
        aspectRatio: request.aspectRatio,
        timeline: [
          {
            timeRange: "0-3 sec",
            action: "Opening hook moment",
            sourceTimestamp: "00:00 - 00:03",
            instructions: `Crop to ${request.aspectRatio}. Add engaging text overlay.`
          },
          {
            timeRange: `3-${request.duration} sec`,
            action: "Main content",
            sourceTimestamp: "00:05 - 00:30",
            instructions: "Speed up if needed. Add call-to-action text."
          }
        ],
        description: `AI-generated ${request.style} short script`,
        hashtags: [`#${request.style}`, '#shorts', '#viral', '#ai']
      };
    }
  }
}

export const createScriptGenerator = (apiKey: string): ScriptGenerator => {
  return new ScriptGenerator(apiKey);
};