import { Tool } from "@langchain/core/tools";
import { geminiMediaGenerator, GeneratedMedia } from "./gemini-media-generator.js";

export class GenerateMediaTool extends Tool {
  name = "generate_media";
  description = "Generate images or videos using AI based on text prompts. When user asks to create, generate, or make visual content, use this tool. Input should be the text prompt describing what to generate. Include 'video' in the prompt for video generation, otherwise an image will be created.";

  private userId: number;

  constructor(userId: number = 1) {
    super();
    this.userId = userId;
  }

  async _call(input: string): Promise<string> {
    try {
      console.log('🎨 GenerateMediaTool called with input:', input);
      
      // Determine media type from input
      const isVideo = input.toLowerCase().includes('video') || 
                     input.toLowerCase().includes('clip') || 
                     input.toLowerCase().includes('movie') ||
                     input.toLowerCase().includes('animation');
      
      const mediaType = isVideo ? 'video' : 'image';
      
      // Extract prompt by removing generation keywords
      const prompt = input
        .replace(/generate|create|make\s*(an?\s*)?(image|picture|photo|video|clip|movie|animation)\s*(of|with|showing)?\s*/i, '')
        .trim();
      
      console.log(`🎨 Generating ${mediaType} with prompt: "${prompt}"`);
      
      const media: GeneratedMedia = await geminiMediaGenerator.generateMedia(prompt, mediaType, this.userId);
      
      const result = {
        type: 'generate_media',
        id: media.id,
        timestamp: Date.now(),
        parameters: {
          prompt,
          mediaType,
          filename: media.filename,
          url: media.url,
          generatedId: media.id
        },
        description: `Generated ${mediaType}: "${prompt}"`,
        mediaData: {
          id: media.id,
          type: media.type,
          filename: media.filename,
          url: media.url,
          prompt: media.prompt
        },
        uiUpdate: true
      };

      console.log(`✅ ${mediaType} generated successfully:`, media.filename);
      return JSON.stringify(result);
      
    } catch (error) {
      console.error(`❌ Failed to generate media:`, error);
      
      const errorResult = {
        type: 'error',
        message: `Failed to generate media: ${error instanceof Error ? error.message : 'Unknown error'}`,
        timestamp: Date.now()
      };
      
      return JSON.stringify(errorResult);
    }
  }
}