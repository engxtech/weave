import { StructuredTool } from '@langchain/core/tools';
import { z } from 'zod';

// Legacy VideoSearchTool - redirects to enhanced version
export class VideoSearchTool extends StructuredTool {
  name = 'search_video_content';
  description = 'Legacy video search - use enhanced version instead.';
  
  schema = z.object({
    query: z.string().describe('Search query'),
    videoPath: z.string().optional().describe('Path to video file'),
    maxResults: z.number().optional().default(5).describe('Maximum number of segments'),
    minRelevanceScore: z.number().optional().default(0.7).describe('Minimum relevance score')
  });

  async _call(args: z.infer<typeof this.schema>): Promise<string> {
    // Redirect to enhanced video search tool
    const { enhancedVideoSearchTool } = await import('./enhanced-video-search-tool.js');
    return enhancedVideoSearchTool._call(args);
  }
}

export const videoSearchTool = new VideoSearchTool();