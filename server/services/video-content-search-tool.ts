import { StructuredTool } from '@langchain/core/tools';
import { z } from 'zod';
import * as fs from 'fs';
import * as path from 'path';
import { promisify } from 'util';
import { GoogleGenerativeAI } from '@google/generative-ai';
import { spawn } from 'child_process';
import ffmpeg from 'fluent-ffmpeg';

const writeFile = promisify(fs.writeFile);
const readFile = promisify(fs.readFile);

interface VideoSegment {
  id: string;
  startTime: number;
  endTime: number;
  duration: number;
  relevanceScore: number;
  description: string;
  matchType: 'audio' | 'visual' | 'both';
  thumbnailPath: string;
  segmentVideoPath: string;
  transcript?: string;
  timestamp: string;
}

interface SearchResult {
  query: string;
  totalSegments: number;
  segments: VideoSegment[];
  processingTime: number;
}

export class VideoContentSearchTool extends StructuredTool {
  name = 'search_video_content';
  description = 'Search video content for specific topics, people, objects, or keywords using AI analysis of both audio transcripts and visual content';
  
  schema = z.object({
    query: z.string().describe('Search query (e.g., "Y combinator", "person with glasses", "startup advice")'),
    videoPath: z.string().optional().describe('Path to video file - if not provided, will use current video'),
    maxResults: z.number().optional().default(10).describe('Maximum number of segments to return'),
    minRelevanceScore: z.number().optional().default(0.6).describe('Minimum relevance score (0-1) for including segments')
  });

  private genAI: GoogleGenerativeAI;

  constructor() {
    super();
    this.genAI = new GoogleGenerativeAI(process.env.GEMINI_API_KEY || '');
  }

  async _call(args: z.infer<typeof this.schema>): Promise<string> {
    const startTime = Date.now();
    
    try {
      const { query, videoPath, maxResults, minRelevanceScore } = args;
      
      console.log(`🔍 3-Step Multimodal Video Search: "${query}"`);
      
      if (!videoPath) {
        return JSON.stringify({
          error: 'No video file provided for search',
          query,
          totalSegments: 0,
          segments: []
        });
      }

      // STEP 1: Extract transcript and arrange in logical full sentences with timestamps
      console.log('📝 Step 1: Extracting logical transcript sentences...');
      const logicalTranscript = await this.extractLogicalTranscript(videoPath, query);
      
      // STEP 2: Search visuals separately for visual matches  
      console.log('👁️ Step 2: Searching visuals for target...');
      const visualSegments = await this.searchVisualContent(videoPath, query, logicalTranscript);
      
      // STEP 3: Logically merge audio and visual segments
      console.log('🔗 Step 3: Merging audio and visual segments logically...');
      const mergedSegments = await this.mergeAudioVisualSegments(
        logicalTranscript.segments, 
        visualSegments, 
        query,
        maxResults,
        minRelevanceScore
      );

      const processingTime = Date.now() - startTime;

      const result: SearchResult = {
        query,
        totalSegments: mergedSegments.length,
        segments: mergedSegments,
        processingTime
      };

      console.log(`✅ 3-Step Search Complete: ${mergedSegments.length} segments for "${query}" in ${processingTime}ms`);
      
      return JSON.stringify(result);

    } catch (error: any) {
      console.error('3-Step Multimodal Search Error:', error);
      return JSON.stringify({
        error: `Failed to search video content: ${error?.message || 'Unknown error'}`,
        query: args.query,
        totalSegments: 0,
        segments: []
      });
    }
  }

  // STEP 1: Extract transcript and arrange in logical full sentences
  private async extractLogicalTranscript(videoPath: string, query: string): Promise<{ 
    fullText: string; 
    segments: Array<{start: number, end: number, text: string, isMatch: boolean}> 
  }> {
    try {
      console.log('📝 Step 1: Extracting logical transcript sentences with Gemini...');
      
      // Read video file
      const fullVideoPath = path.resolve('uploads', videoPath);
      const videoData = fs.readFileSync(fullVideoPath);
      
      const model = this.genAI.getGenerativeModel({ model: 'gemini-1.5-flash' });
      
      const prompt = `
STEP 1: COMPREHENSIVE AUDIO TRANSCRIPT EXTRACTION WITH MULTILINGUAL SUPPORT
Transcribe this video audio completely and arrange into logical full sentences with precise timestamps.

CRITICAL REQUIREMENTS:
- Listen to ALL audio carefully and extract EVERY spoken word
- Provide BOTH original language AND English transliteration for non-English content
- Include casual words like "stupid", "crazy", "don't", "be", brand names, exclamations
- Arrange words into logical complete sentences or phrases
- Provide accurate start-end timestamps for each sentence/phrase
- Don't miss ANY spoken content - be thorough and comprehensive
- Detect emotional expressions, advertising language, repeated words
- Listen for words that might be said multiple times (like "stupid stupid stupid")

TARGET SEARCH: Looking specifically for "${query}" - provide both original script and English transliteration

RESPONSE FORMAT (JSON only):
{
  "fullText": "complete transcription with all spoken words",
  "fullTextEnglish": "same content transliterated to English characters",
  "segments": [
    {
      "start": 0,
      "end": 8,
      "text": "original script/language",
      "textEnglish": "english transliteration",
      "isMatch": false
    },
    {
      "start": 8,
      "end": 15,
      "text": "स्टूपिड स्टूपिड स्टूपिड",
      "textEnglish": "stupid stupid stupid",
      "isMatch": true
    }
  ]
}

Be extremely thorough with audio detection and provide both scripts for multilingual support.`;
      
      const result = await model.generateContent([
        prompt,
        {
          inlineData: {
            data: videoData.toString('base64'),
            mimeType: 'video/mp4'
          }
        }
      ]);
      
      const responseText = result.response.text();
      console.log('📝 Raw Gemini logical transcript response:', responseText);
      
      const jsonMatch = responseText.match(/\{[\s\S]*\}/);
      if (!jsonMatch) {
        throw new Error('No valid JSON found in Step 1 response');
      }
      
      const transcriptData = JSON.parse(jsonMatch[0]);
      
      // Mark segments that contain the query (check both original and English text)
      const queryLower = query.toLowerCase();
      transcriptData.segments = transcriptData.segments.map((seg: any) => ({
        ...seg,
        isMatch: seg.text.toLowerCase().includes(queryLower) || 
                 (seg.textEnglish && seg.textEnglish.toLowerCase().includes(queryLower))
      }));
      
      console.log(`✅ Step 1: Extracted ${transcriptData.segments.length} logical sentences`);
      console.log(`🎯 Step 1: Found ${transcriptData.segments.filter((s: any) => s.isMatch).length} audio matches for "${query}"`);
      
      return transcriptData;
      
    } catch (error) {
      console.error('Step 1 logical transcript extraction failed:', error);
      return {
        fullText: "Transcript extraction failed",
        segments: []
      };
    }
  }

  private async extractAudioTranscript(videoPath: string): Promise<{ text: string; timestamps: Array<{start: number, end: number, text: string}> }> {
    try {
      console.log('🎤 Extracting audio transcript using Gemini multimodal API...');
      
      // Read video file
      const fullVideoPath = path.resolve('uploads', videoPath);
      const videoData = fs.readFileSync(fullVideoPath);
      
      // Use Gemini multimodal API to transcribe video with timestamps
      const model = this.genAI.getGenerativeModel({ model: 'gemini-1.5-flash' });
      
      const prompt = `
MULTIMODAL VIDEO ANALYSIS FOR SEARCH
Transcribe this video's audio content with precise timestamps for search purposes.

REQUIREMENTS:
- Extract ALL spoken words and phrases with start/end timestamps
- Include repetitive phrases, exclamations, casual speech
- Capture emotional expressions like "stupid", "amazing", "wow", etc.
- Break into logical segments (2-5 second chunks)
- Include filler words and natural speech patterns

RESPONSE FORMAT (JSON only):
{
  "fullText": "complete transcription",
  "segments": [
    {
      "start": 0.5,
      "end": 3.2,
      "text": "exact spoken words including casual expressions"
    }
  ]
}
`;
      
      const result = await model.generateContent([
        prompt,
        {
          inlineData: {
            data: videoData.toString('base64'),
            mimeType: 'video/mp4'
          }
        }
      ]);
      
      const responseText = result.response.text();
      console.log('🎤 Raw Gemini transcription response:', responseText);
      
      // Parse JSON response
      const jsonMatch = responseText.match(/\{[\s\S]*\}/);
      if (!jsonMatch) {
        throw new Error('No valid JSON found in Gemini response');
      }
      
      const transcriptData = JSON.parse(jsonMatch[0]);
      
      console.log(`✅ Transcribed ${transcriptData.segments?.length || 0} audio segments`);
      console.log('📝 Full transcript:', transcriptData.fullText);
      
      return {
        text: transcriptData.fullText || '',
        timestamps: transcriptData.segments || []
      };
      
    } catch (error) {
      console.error('Audio transcription failed:', error);
      // Fallback to dummy segments for now
      const duration = await this.getVideoDuration(videoPath);
      const segments = [];
      for (let i = 0; i < duration; i += 5) {
        segments.push({
          start: i,
          end: Math.min(i + 5, duration),
          text: `Audio segment ${i}s-${Math.min(i + 5, duration)}s`
        });
      }
      return {
        text: "Transcription failed - using fallback segments",
        timestamps: segments
      };
    }
  }

  private async createAudioSegments(videoPath: string): Promise<Array<{start: number, end: number, text: string}>> {
    // Get video duration
    const duration = await this.getVideoDuration(videoPath);
    
    // Create 10-second segments for analysis
    const segments = [];
    for (let i = 0; i < duration; i += 10) {
      const start = i;
      const end = Math.min(i + 10, duration);
      segments.push({
        start,
        end,
        text: `Audio segment ${start}s - ${end}s` // Will be analyzed by Gemini
      });
    }
    
    return segments;
  }

  private async getVideoDuration(videoPath: string): Promise<number> {
    return new Promise((resolve, reject) => {
      ffmpeg.ffprobe(videoPath, (err, metadata) => {
        if (err) reject(err);
        else resolve(metadata.format.duration || 0);
      });
    });
  }

  private async extractFrames(videoPath: string): Promise<Array<{timestamp: number, framePath: string}>> {
    const frames = [];
    const tempDir = path.join('temp_frames', `search_${Date.now()}`);
    
    if (!fs.existsSync(tempDir)) {
      fs.mkdirSync(tempDir, { recursive: true });
    }

    const duration = await this.getVideoDuration(videoPath);
    const frameInterval = 2; // Extract frames every 2 seconds for comprehensive analysis
    const expectedFrames = Math.ceil(duration / frameInterval);
    
    console.log(`🖼️ Analyzing ${expectedFrames} frames for comprehensive visual content (1 frame every ${frameInterval} seconds)...`);
    
    // Extract frames every 2 seconds for better coverage
    for (let i = 0; i < duration; i += frameInterval) {
      const framePath = path.join(tempDir, `frame_${i}.jpg`);
      
      await new Promise((resolve, reject) => {
        ffmpeg(videoPath)
          .seekInput(i)
          .frames(1)
          .output(framePath)
          .on('end', resolve)
          .on('error', reject)
          .run();
      });

      frames.push({
        timestamp: i,
        framePath
      });
    }

    console.log(`✅ Extracted ${frames.length} frames for visual analysis`);
    return frames;
  }

  // STEP 2: Search visuals separately for target with transcript context
  private async searchVisualContent(videoPath: string, query: string, transcriptContext?: { fullText: string; segments: Array<{start: number, end: number, text: string, isMatch: boolean}> }): Promise<Array<{
    start: number, 
    end: number, 
    relevanceScore: number, 
    description: string,
    matchType: 'visual'
  }>> {
    try {
      console.log('👁️ Step 2: Searching visuals for target with Gemini...');
      
      // Extract frames for analysis (every 2 seconds for comprehensive coverage)
      const frames = await this.extractFrames(videoPath);
      const visualMatches = [];
      
      const model = this.genAI.getGenerativeModel({ model: 'gemini-1.5-flash' });
      
      console.log(`👁️ Step 2: Analyzing ${frames.length} frames for "${query}" (comprehensive visual search)...`);
      
      for (const frame of frames) {
        try {
          const imageData = fs.readFileSync(frame.framePath);
          const base64Image = imageData.toString('base64');

          const contextInfo = transcriptContext ? 
            `\n\nTRANSCRIPT CONTEXT:\nFull transcript: "${transcriptContext.fullText}"\nAudio segments with timestamps: ${JSON.stringify(transcriptContext.segments.slice(0, 5))}` 
            : '';

          const prompt = `
STEP 2: COMPREHENSIVE VISUAL SEARCH WITH AUDIO CONTEXT
Search this video frame at ${frame.timestamp}s for ALL visual elements related to: "${query}"

SEARCH REQUIREMENTS:
- Look for people, faces, objects, text, actions, scenes, emotions, expressions
- Check for exact matches and similar/related visual content  
- Use audio context to understand what's happening in the video
- Rate visual relevance from 0-1 (1 = perfect match, 0.7+ = good match)
- Find ALL instances - there can be multiple matches per frame
- Be thorough and detailed in description
${contextInfo}

RESPONSE FORMAT (JSON only):
{
  "isMatch": true,
  "relevanceScore": 0.85,
  "description": "Specific description of what matches the query in this frame at ${frame.timestamp}s",
  "reasoning": "Detailed explanation of why this is a visual match for the query"
}`;

          const result = await model.generateContent([
            prompt,
            {
              inlineData: {
                data: base64Image,
                mimeType: 'image/jpeg'
              }
            }
          ]);

          const responseText = result.response.text();
          const jsonMatch = responseText.match(/\{[\s\S]*\}/);
          
          if (jsonMatch) {
            const analysis = JSON.parse(jsonMatch[0]);
            
            if (analysis.isMatch && analysis.relevanceScore > 0.7) {
              visualMatches.push({
                start: frame.timestamp,
                end: frame.timestamp + 2, // 2-second segment
                relevanceScore: analysis.relevanceScore,
                description: analysis.description,
                matchType: 'visual' as const
              });
              console.log(`🎯 Step 2: Visual match at ${frame.timestamp}s: ${analysis.description} (${analysis.relevanceScore})`);
            }
          }
        } catch (frameError) {
          console.warn(`Step 2: Error analyzing frame at ${frame.timestamp}s:`, frameError);
        }
      }
      
      console.log(`✅ Step 2: Found ${visualMatches.length} visual matches for "${query}"`);
      return visualMatches;
      
    } catch (error) {
      console.error('Step 2 visual search failed:', error);
      return [];
    }
  }

  // STEP 3: Logically merge audio and visual segments
  private async mergeAudioVisualSegments(
    audioSegments: Array<{start: number, end: number, text: string, isMatch: boolean}>,
    visualSegments: Array<{start: number, end: number, relevanceScore: number, description: string, matchType: 'visual'}>,
    query: string,
    maxResults: number,
    minRelevanceScore: number
  ): Promise<VideoSegment[]> {
    try {
      console.log('🔗 Step 3: Merging audio and visual segments logically...');
      
      // Get matching audio segments
      const audioMatches = audioSegments.filter(seg => seg.isMatch);
      console.log(`🎤 Step 3: Processing ${audioMatches.length} audio matches`);
      console.log(`👁️ Step 3: Processing ${visualSegments.length} visual matches`);
      
      // Create initial segments from both audio and visual matches
      const allSegments = [];
      
      // Add audio matches
      audioMatches.forEach(audioSeg => {
        // Use English text if available, otherwise original text
        const displayText = audioSeg.textEnglish || audioSeg.text;
        allSegments.push({
          start: audioSeg.start,
          end: audioSeg.end,
          relevanceScore: 0.95, // High score for exact audio matches
          description: `Audio: "${displayText}"`,
          transcript: displayText,
          matchType: 'audio' as const,
          source: 'audio'
        });
      });
      
      // Add visual matches
      visualSegments.forEach(visualSeg => {
        allSegments.push({
          start: visualSeg.start,
          end: visualSeg.end,
          relevanceScore: visualSeg.relevanceScore,
          description: visualSeg.description,
          matchType: 'visual' as const,
          source: 'visual'
        });
      });
      
      // Sort by start time
      allSegments.sort((a, b) => a.start - b.start);
      
      // Logical merge: combine segments that are close together
      const mergedSegments = [];
      let currentSegment = null;
      
      for (const segment of allSegments) {
        if (!currentSegment) {
          currentSegment = { ...segment };
        } else {
          // Check if segments are within 2 seconds of each other
          const gap = segment.start - currentSegment.end;
          
          if (gap <= 2) {
            // Merge segments - extend the end time and combine descriptions
            console.log(`🔗 Step 3: Merging segments: ${currentSegment.start}-${currentSegment.end}s + ${segment.start}-${segment.end}s (gap: ${gap}s)`);
            currentSegment.end = Math.max(currentSegment.end, segment.end);
            currentSegment.description = `${currentSegment.description} + ${segment.description}`;
            currentSegment.relevanceScore = Math.max(currentSegment.relevanceScore, segment.relevanceScore);
            currentSegment.matchType = currentSegment.source === segment.source ? currentSegment.matchType : 'both';
          } else {
            // Gap is too large, finalize current segment and start new one
            mergedSegments.push(currentSegment);
            currentSegment = { ...segment };
          }
        }
      }
      
      // Add the last segment
      if (currentSegment) {
        mergedSegments.push(currentSegment);
      }
      
      // Convert to VideoSegment format and generate thumbnails
      const finalSegments: VideoSegment[] = [];
      const tempDir = path.join('temp_frames', `segments_${Date.now()}`);
      
      if (!fs.existsSync(tempDir)) {
        fs.mkdirSync(tempDir, { recursive: true });
      }
      
      for (let i = 0; i < Math.min(mergedSegments.length, maxResults); i++) {
        const segment = mergedSegments[i];
        
        if (segment.relevanceScore >= minRelevanceScore) {
          try {
            // Generate thumbnail for the segment
            const thumbnailName = `thumbnail_${segment.matchType}_${i}_${Date.now()}.jpg`;
            const thumbnailPath = path.join(tempDir, thumbnailName);
            
            await this.generateThumbnail(path.resolve('uploads', path.basename(videoPath)), segment.start, thumbnailPath);
            
            finalSegments.push({
              id: `${segment.matchType}_${i}_${Date.now()}`,
              startTime: segment.start,
              endTime: segment.end,
              duration: segment.end - segment.start,
              matchType: segment.matchType,
              relevanceScore: segment.relevanceScore,
              description: segment.description,
              reasoning: `Logical merge of ${segment.source} match`,
              timestamp: Math.round((segment.start + segment.end) / 2),
              thumbnailPath: `/api/video/search/thumbnail/${thumbnailName}`
            });
            
            console.log(`✅ Step 3: Created merged segment ${segment.start}-${segment.end}s (${segment.matchType}, score: ${segment.relevanceScore})`);
          } catch (thumbError) {
            console.warn(`Step 3: Error generating thumbnail for segment ${i}:`, thumbError);
          }
        }
      }
      
      console.log(`✅ Step 3: Final result: ${finalSegments.length} merged segments for "${query}"`);
      return finalSegments;
      
    } catch (error) {
      console.error('Step 3 logical merging failed:', error);
      return [];
    }
  }

  private async analyzeContentWithAI(
    transcript: any, 
    frames: Array<{timestamp: number, framePath: string}>, 
    query: string
  ): Promise<Array<{timestamp: number, relevanceScore: number, description: string, matchType: 'audio' | 'visual' | 'both'}>> {
    const model = this.genAI.getGenerativeModel({ model: 'gemini-1.5-flash' });
    const results = [];

    console.log(`🤖 Analyzing ${frames.length} frames and audio transcript for query: "${query}"`);
    console.log(`🎤 Full transcript available: ${transcript.text}`);

    // First, search audio transcript for query matches
    const audioMatches = [];
    if (transcript.timestamps && transcript.timestamps.length > 0) {
      for (const segment of transcript.timestamps) {
        const segmentText = segment.text.toLowerCase();
        const queryLower = query.toLowerCase();
        
        // Check for exact matches, partial matches, or semantic relevance
        const exactMatch = segmentText.includes(queryLower);
        const wordMatch = queryLower.split(' ').some(word => segmentText.includes(word));
        
        if (exactMatch || wordMatch) {
          const relevanceScore = exactMatch ? 0.95 : 0.8;
          audioMatches.push({
            timestamp: segment.start,
            relevanceScore,
            description: `Audio: "${segment.text}"`,
            matchType: 'audio' as const,
            audioText: segment.text
          });
          console.log(`🎯 Audio match found at ${segment.start}s: "${segment.text}"`);
        }
      }
    }

    // Then analyze visual frames, giving priority to frames with audio matches
    for (const frame of frames) {
      try {
        const imageData = fs.readFileSync(frame.framePath);
        const base64Image = imageData.toString('base64');

        // Find corresponding audio segment for this frame
        const audioSegment = transcript.timestamps?.find((seg: any) => 
          seg.start <= frame.timestamp && seg.end >= frame.timestamp
        );
        
        const audioContext = audioSegment ? `Audio at this time: "${audioSegment.text}"` : 'No audio at this time';

        const prompt = `MULTIMODAL VIDEO SEARCH ANALYSIS
Query: "${query}"
Frame timestamp: ${frame.timestamp}s
${audioContext}

Analyze this video frame AND the audio context for relevance to the search query.

SEARCH CRITERIA:
- Audio matches: spoken words, phrases, expressions that match the query
- Visual matches: people, objects, text, actions, scenes that match the query  
- Combined matches: both audio and visual elements support the query

RESPONSE FORMAT (JSON only):
{
  "relevanceScore": 0.95,
  "description": "Speaker says 'stupid' while pointing at screen",
  "isRelevant": true,
  "matchType": "both",
  "audioMatch": true,
  "visualMatch": false,
  "reasoning": "Audio contains exact query word 'stupid'"
}`;

        const result = await model.generateContent([
          prompt,
          {
            inlineData: {
              data: base64Image,
              mimeType: 'image/jpeg'
            }
          }
        ]);

        const responseText = result.response.text();
        
        try {
          const jsonMatch = responseText.match(/\{[\s\S]*\}/);
          if (jsonMatch) {
            const analysis = JSON.parse(jsonMatch[0]);
            
            if (analysis.isRelevant && analysis.relevanceScore > 0.3) {
              results.push({
                timestamp: frame.timestamp,
                relevanceScore: analysis.relevanceScore,
                description: analysis.description,
                matchType: analysis.matchType || 'visual'
              });
              console.log(`🎯 Frame match at ${frame.timestamp}s: ${analysis.description} (${analysis.relevanceScore})`);
            }
          }
        } catch (parseError) {
          console.warn(`Failed to parse Gemini response for frame ${frame.timestamp}:`, parseError);
        }

      } catch (error) {
        console.error(`Error analyzing frame at ${frame.timestamp}s:`, error);
      }
    }

    // Combine audio and visual results
    const allResults = [...audioMatches, ...results];
    
    // Sort by relevance score and return
    return allResults.sort((a, b) => b.relevanceScore - a.relevanceScore);
  }

  private async generateVideoSegments(
    videoPath: string,
    analysisResults: Array<{timestamp: number, relevanceScore: number, description: string, matchType: string}>,
    query: string,
    maxResults: number,
    minRelevanceScore: number
  ): Promise<VideoSegment[]> {
    const segments: VideoSegment[] = [];
    const tempDir = path.join('temp_frames', `segments_${Date.now()}`);
    
    if (!fs.existsSync(tempDir)) {
      fs.mkdirSync(tempDir, { recursive: true });
    }

    // Get the full video duration
    const videoDuration = await this.getVideoDuration(videoPath);
    console.log(`📹 Video duration: ${videoDuration}s - Using full video length for segments`);

    // Filter results by minimum relevance score
    const relevantResults = analysisResults.filter(r => r.relevanceScore >= minRelevanceScore);
    
    // Take top results
    const topResults = relevantResults.slice(0, maxResults);

    for (let i = 0; i < topResults.length; i++) {
      const result = topResults[i];
      const segmentId = `segment_${Date.now()}_${i}`;
      
      // Use FULL VIDEO LENGTH instead of 10-second segments
      const startTime = 0;
      const endTime = videoDuration;
      const duration = endTime - startTime;

      // Generate thumbnail
      const thumbnailPath = path.join(tempDir, `thumb_${segmentId}.jpg`);
      await this.generateThumbnail(videoPath, result.timestamp, thumbnailPath);

      // Generate segment video
      const segmentVideoPath = path.join(tempDir, `segment_${segmentId}.mp4`);
      await this.generateSegmentVideo(videoPath, startTime, endTime, segmentVideoPath);

      segments.push({
        id: segmentId,
        startTime,
        endTime,
        duration,
        relevanceScore: result.relevanceScore,
        description: result.description,
        matchType: result.matchType as 'audio' | 'visual' | 'both',
        thumbnailPath,
        segmentVideoPath,
        timestamp: this.formatTime(result.timestamp)
      });
    }

    return segments;
  }

  private async generateThumbnail(videoPath: string, timestamp: number, outputPath: string): Promise<void> {
    return new Promise((resolve, reject) => {
      ffmpeg(videoPath)
        .seekInput(timestamp)
        .frames(1)
        .output(outputPath)
        .on('end', resolve)
        .on('error', reject)
        .run();
    });
  }

  private async generateSegmentVideo(videoPath: string, startTime: number, endTime: number, outputPath: string): Promise<void> {
    return new Promise((resolve, reject) => {
      ffmpeg(videoPath)
        .seekInput(startTime)
        .duration(endTime - startTime)
        .output(outputPath)
        .videoCodec('libx264')
        .audioCodec('aac')
        .on('end', resolve)
        .on('error', reject)
        .run();
    });
  }

  private formatTime(seconds: number): string {
    const minutes = Math.floor(seconds / 60);
    const remainingSeconds = Math.floor(seconds % 60);
    return `${minutes}:${remainingSeconds.toString().padStart(2, '0')}`;
  }
}