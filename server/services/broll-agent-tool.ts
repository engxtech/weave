import { brollGenerator } from './broll-generator';
import * as path from 'path';

interface BrollToolParams {
  currentVideo?: {
    filename: string;
    path: string;
  };
}

export class BrollAgentTool {
  name = "generate_broll_suggestions";
  description = "Analyzes the current video using Gemini multimodal AI to generate creative B-roll suggestions with AI video generation prompts. Perfect for enhancing talking head segments, illustrating abstract concepts, and adding professional visual storytelling elements.";

  async execute(params: BrollToolParams): Promise<any> {
    console.log(`🎬 BrollAgentTool: Starting B-roll generation...`);

    try {
      if (!params.currentVideo?.filename) {
        throw new Error("No video file available for B-roll analysis");
      }

      // Handle different video path formats
      let videoFilename = params.currentVideo.filename;
      
      // Clean up filename - remove any path prefixes
      if (videoFilename.includes('uploads/')) {
        videoFilename = videoFilename.replace(/^.*uploads\//, '');
      }
      
      const videoPath = path.join(process.cwd(), 'uploads', videoFilename);
      console.log(`📁 BrollAgentTool: Analyzing video: ${videoPath}`);

      // Generate B-roll plan using Gemini multimodal analysis
      const brollPlan = await brollGenerator.generateBrollPlan(videoPath);

      console.log(`✅ BrollAgentTool: Generated ${brollPlan.suggestions.length} B-roll suggestions`);

      return {
        type: 'broll_suggestions_generated',
        id: `broll_${Date.now()}`,
        timestamp: Date.now(),
        description: `B-roll Analysis: ${brollPlan.suggestions.length} creative suggestions generated`,
        brollPlan: brollPlan,
        videoAnalysis: brollPlan.videoAnalysis,
        suggestions: brollPlan.suggestions.map((suggestion, index) => ({
          id: `broll_${index + 1}`,
          concept: suggestion.concept,
          startTime: suggestion.startTime,
          endTime: suggestion.endTime,
          justification: suggestion.justification,
          prompt: suggestion.videoGenerationPrompt,
          index: index + 1
        }))
      };

    } catch (error) {
      console.error(`❌ BrollAgentTool: Error:`, error);
      throw error;
    }
  }
}

export const brollAgentTool = new BrollAgentTool();