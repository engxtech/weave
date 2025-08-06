import { StructuredTool } from "@langchain/core/tools";
import { z } from "zod";
import * as path from "path";

interface ShortsRequest {
  videoPath: string;
  contentType: 'viral_moments' | 'entertainment' | 'educational' | 'highlights' | 'funny_moments' | 'key_insights';
  duration: number;
  style: 'tiktok' | 'youtube_shorts' | 'instagram_reels';
  targetAudience: 'general' | 'young_adults' | 'professionals' | 'students';
}

interface ShortsClip {
  id: string;
  title: string;
  description: string;
  startTime: number;
  endTime: number;
  duration: number;
  viralScore: number;
  engagementFactors: string[];
  speakerInfo: any;
  keyMoments: string[];
  transcriptSnippet: string;
  visualHighlights: string[];
}

const ShortsGeneratorSchema = z.object({
  videoPath: z.string().describe("Path to the source video file"),
  contentType: z.enum(['viral_moments', 'entertainment', 'educational', 'highlights', 'funny_moments', 'key_insights'])
    .describe("Type of content to extract from the video"),
  duration: z.number().min(15).max(90).describe("Duration of each shorts clip in seconds (15, 30, 60, or 90)"),
  style: z.enum(['tiktok', 'youtube_shorts', 'instagram_reels'])
    .describe("Platform style to optimize for"),
  targetAudience: z.enum(['general', 'young_adults', 'professionals', 'students'])
    .describe("Target audience for the content"),
  createVideos: z.boolean().optional().default(false)
    .describe("Whether to create actual video files or just return clip data")
});

export class AIShortsGeneratorTool extends StructuredTool {
  name = "generate_ai_shorts";
  description = `Generate viral short clips from longer videos using AI analysis. This tool analyzes videos with Gemini multimodal AI to identify the most engaging segments for short-form content platforms like TikTok, YouTube Shorts, and Instagram Reels.

Features:
- Content type selection (viral moments, entertainment, educational highlights, etc.)
- Custom duration settings (15, 30, 60, or 90 seconds)
- Platform-specific optimization (TikTok, YouTube Shorts, Instagram Reels)
- Speaker identification and audio-visual analysis
- Viral potential scoring and engagement factor analysis
- Complete narrative arc preservation within clips

The tool returns detailed analysis including viral scores, engagement factors, speaker information, key moments, and transcript snippets for each recommended clip.`;
  
  schema = ShortsGeneratorSchema;

  async _call(args: z.infer<typeof ShortsGeneratorSchema>) {
    try {
      console.log("🎬 AI Shorts Generator called with:", args);

      // Validate video path
      const fullVideoPath = path.isAbsolute(args.videoPath) 
        ? args.videoPath 
        : path.join(process.cwd(), args.videoPath);

      // Prepare request
      const request: ShortsRequest = {
        videoPath: fullVideoPath,
        contentType: args.contentType,
        duration: args.duration,
        style: args.style,
        targetAudience: args.targetAudience
      };

      // This tool is deprecated in favor of the new AI Shorts Generator
      const clips: ShortsClip[] = [];

      if (clips.length === 0) {
        return {
          success: false,
          error: "This tool is deprecated. Please use the new AI Shorts Generator at /ai-shorts-generator",
          clips: []
        };
      }

      let outputVideos: string[] = [];

      const result = {
        success: true,
        totalClips: clips.length,
        clips: clips.map((clip: ShortsClip) => ({
          id: clip.id,
          title: clip.title,
          description: clip.description,
          startTime: clip.startTime,
          endTime: clip.endTime,
          duration: clip.duration,
          viralScore: clip.viralScore,
          engagementFactors: clip.engagementFactors,
          speakerInfo: clip.speakerInfo,
          keyMoments: clip.keyMoments,
          transcriptSnippet: clip.transcriptSnippet,
          visualHighlights: clip.visualHighlights
        })),
        videoFiles: outputVideos,
        analysis: {
          contentType: args.contentType,
          targetDuration: args.duration,
          platformStyle: args.style,
          targetAudience: args.targetAudience
        }
      };

      console.log(`✅ Generated ${clips.length} shorts clips successfully`);
      return JSON.stringify(result, null, 2);

    } catch (error) {
      console.error("AI Shorts generation failed:", error);
      return JSON.stringify({
        success: false,
        error: `Shorts generation failed: ${error}`,
        clips: []
      }, null, 2);
    }
  }
}

export const aiShortsGeneratorTool = new AIShortsGeneratorTool();