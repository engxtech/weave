import { GoogleGenerativeAI } from '@google/generative-ai';
import * as fs from 'fs';
import * as path from 'path';
import { spawn } from 'child_process';

interface TranscriptionSegment {
  id: string;
  startTime: number;
  endTime: number;
  text: string;
}

interface SearchResultSegment {
  id: string;
  startTime: number;
  endTime: number;
  duration: number;
  matchType: 'audio' | 'visual' | 'both';
  relevanceScore: number;
  description: string;
  reasoning: string;
  thumbnailPath?: string;
}

interface FrameData {
  timestamp: number;
  imageData: string;
}

export class SeparatedAudioVisualSearch {
  private genAI: GoogleGenerativeAI;

  constructor() {
    this.genAI = new GoogleGenerativeAI(process.env.GEMINI_API_KEY || '');
  }

  // Main search function with separated audio/visual analysis
  async searchVideo(videoPath: string, query: string): Promise<SearchResultSegment[]> {
    console.log('🔍 Starting separated audio and visual search...');
    
    try {
      // Step 1: Get transcript segments
      const transcriptSegments = await this.getTranscriptSegments(videoPath);
      console.log(`📝 Created ${transcriptSegments.length} transcript segments`);
      
      // Step 2A: Audio Search
      const audioResults = await this.searchAudioContent(transcriptSegments, query);
      console.log(`🎤 Audio search: ${audioResults.length} segments found`);
      
      // Step 2B: Visual Search with transcript context
      const visualResults = await this.searchVisualContent(videoPath, query, transcriptSegments);
      console.log(`👁️ Visual search: ${visualResults.length} segments found`);
      
      // Step 3: Logical Merge
      const mergedResults = this.logicallyMergeResults(audioResults, visualResults);
      console.log(`🔀 Logical merge: ${mergedResults.length} final segments`);
      
      // Step 4: Generate thumbnails
      if (mergedResults.length > 0) {
        await this.generateThumbnails(videoPath, mergedResults);
      }
      
      return mergedResults;
      
    } catch (error) {
      console.error('Search error:', error);
      return [];
    }
  }

  // Get transcript with logical segmentation
  private async getTranscriptSegments(videoPath: string): Promise<TranscriptionSegment[]> {
    const model = this.genAI.getGenerativeModel({ model: 'gemini-1.5-flash' });
    
    const fullVideoPath = path.resolve('uploads', videoPath);
    const videoData = fs.readFileSync(fullVideoPath);
    
    const prompt = `
AUDIO TRANSCRIPTION WITH TIMING

Transcribe this video's audio content and provide logical sentence segments with precise timing.

REQUIREMENTS:
1. Transcribe ALL spoken words with exact timing
2. Break into logical sentences (natural speech pauses)
3. Include names, proper nouns, and specific terms
4. Provide start/end times for each sentence segment

RESPONSE FORMAT (JSON only):
{
  "segments": [
    {
      "startTime": 0.0,
      "endTime": 3.5,
      "text": "exact spoken words here"
    },
    {
      "startTime": 3.5,
      "endTime": 7.2,
      "text": "next sentence segment"
    }
  ]
}
`;

    try {
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
      const jsonMatch = responseText.match(/\{[\s\S]*\}/);
      
      if (!jsonMatch) {
        console.log('No JSON in transcript response, creating segments manually');
        return this.createManualSegments(videoPath);
      }

      const transcriptData = JSON.parse(jsonMatch[0]);
      
      return transcriptData.segments?.map((seg: any, index: number) => ({
        id: `segment_${index}`,
        startTime: seg.startTime,
        endTime: seg.endTime,
        text: seg.text
      })) || [];
      
    } catch (error) {
      console.error('Transcript error:', error);
      return this.createManualSegments(videoPath);
    }
  }

  // Manual segment creation fallback
  private async createManualSegments(videoPath: string): Promise<TranscriptionSegment[]> {
    // Get basic transcript and create time-based segments
    const duration = await this.getVideoDuration(videoPath);
    const segmentDuration = 3; // 3-second segments
    const numSegments = Math.ceil(duration / segmentDuration);
    
    const model = this.genAI.getGenerativeModel({ model: 'gemini-1.5-flash' });
    const fullVideoPath = path.resolve('uploads', videoPath);
    const videoData = fs.readFileSync(fullVideoPath);
    
    const result = await model.generateContent([
      'Transcribe all spoken words from this video:',
      {
        inlineData: {
          data: videoData.toString('base64'),
          mimeType: 'video/mp4'
        }
      }
    ]);

    const fullTranscript = result.response.text()?.trim() || '';
    const words = fullTranscript.split(' ');
    const wordsPerSegment = Math.ceil(words.length / numSegments);
    
    const segments: TranscriptionSegment[] = [];
    for (let i = 0; i < numSegments; i++) {
      const startTime = i * segmentDuration;
      const endTime = Math.min((i + 1) * segmentDuration, duration);
      const segmentWords = words.slice(i * wordsPerSegment, (i + 1) * wordsPerSegment);
      
      segments.push({
        id: `segment_${i}`,
        startTime,
        endTime,
        text: segmentWords.join(' ')
      });
    }
    
    return segments;
  }

  // Search audio content in transcript segments with sentence completion
  private async searchAudioContent(segments: TranscriptionSegment[], query: string): Promise<SearchResultSegment[]> {
    console.log('🎤 Searching audio content with sentence completion...');
    const model = this.genAI.getGenerativeModel({ model: 'gemini-1.5-flash' });
    
    const prompt = `
INTELLIGENT AUDIO SEARCH WITH SENTENCE COMPLETION

Query: "${query}"

TRANSCRIPT SEGMENTS:
${segments.map(seg => 
  `${seg.id} (${seg.startTime}s-${seg.endTime}s): "${seg.text}"`
).join('\n')}

SEARCH REQUIREMENTS:
1. LOGICAL SENTENCE COMPLETION: When finding "${query}", capture the complete sentence or phrase
   - Example: If audio says "I am stupid stupid stupid" and searching for "stupid", capture the entire phrase
   - Extend segment boundaries to include complete thoughts and context

2. CONTEXTUAL EXPANSION: 
   - Include words before and after the query for natural context
   - Capture emotional emphasis and repetition patterns
   - Ensure segments make logical sense when played alone

3. SMART BOUNDARY DETECTION:
   - Start segments at sentence/phrase beginnings (not mid-word)  
   - End segments at natural pause points or sentence endings
   - Merge adjacent segments that form one complete thought

4. INTELLIGENT EXPANSION:
   - Look across multiple segments to create complete sentences
   - If "${query}" appears multiple times in succession, capture the full repetition
   - Extend timing to include complete emotional or contextual expressions

RESPONSE FORMAT (JSON only):
{
  "matches": [
    {
      "segmentId": "expanded_audio_1", 
      "startTime": 6.7,
      "endTime": 13.3,
      "relevanceScore": 0.95,
      "exactQuote": "complete sentence or phrase containing the query",
      "reasoning": "captured complete sentence/phrase for context",
      "expansionType": "sentence_completion | repetition_capture | contextual_extension"
    }
  ]
}
`;

    try {
      const result = await model.generateContent(prompt);
      const responseText = result.response.text();
      const jsonMatch = responseText.match(/\{[\s\S]*\}/);
      
      if (!jsonMatch) return [];
      
      const audioData = JSON.parse(jsonMatch[0]);
      
      return audioData.matches?.map((match: any, index: number) => ({
        id: `audio_${index}`,
        startTime: match.startTime,
        endTime: match.endTime,
        duration: match.endTime - match.startTime,
        matchType: 'audio' as const,
        relevanceScore: match.relevanceScore,
        description: `Audio: "${match.exactQuote}"`,
        reasoning: match.reasoning
      })) || [];
      
    } catch (error) {
      console.error('Audio search error:', error);
      return [];
    }
  }

  // Search visual content with logical audio context creation
  private async searchVisualContent(videoPath: string, query: string, transcriptSegments?: TranscriptionSegment[]): Promise<SearchResultSegment[]> {
    console.log('👁️ Searching visual content with logical audio backing...');
    
    // Extract frames every 2 seconds
    const frames = await this.extractVideoFrames(videoPath);
    console.log(`🖼️ Extracted ${frames.length} frames for visual analysis`);
    
    if (frames.length === 0) return [];
    
    const model = this.genAI.getGenerativeModel({ model: 'gemini-1.5-flash' });
    
    // Include transcript context for intelligent audio backing
    const transcriptContext = transcriptSegments ? `
AVAILABLE AUDIO TRANSCRIPT:
${transcriptSegments.map(seg => 
  `${seg.startTime}s-${seg.endTime}s: "${seg.text}"`
).join('\n')}
` : 'NO AUDIO AVAILABLE - Use visual logic for segment creation';
    
    const prompt = `
INTELLIGENT VISUAL SEARCH WITH LOGICAL AUDIO BACKING

Query: "${query}"

${transcriptContext}

VISUAL SEARCH REQUIREMENTS:
1. VISUAL DETECTION: Find visual appearances of "${query}"
   - Text/captions showing "${query}"
   - Objects, people, or scenes related to "${query}"
   - Graphics, logos, or visual elements matching "${query}"

2. LOGICAL AUDIO BACKING: Create contextually complete segments
   - IF AUDIO EXISTS: Match visual timing with relevant audio context
   - IF NO AUDIO: Use logical video pacing for natural segment duration
   - Ensure segments make sense when played independently

3. INTELLIGENT SEGMENT CREATION:
   - Visual-first approach: Start with visual detection timing
   - Audio enhancement: Extend/adjust timing to include relevant spoken context  
   - Context completion: Create 2-4 second segments with logical beginning/end points
   - Natural pacing: Avoid abrupt cuts, allow for visual comprehension time

FRAME TIMING:
- Frame sequence starts at 0 seconds
- Each frame represents 2-second intervals  
- Frame 0 = 0-2s, Frame 1 = 2-4s, Frame 2 = 4-6s, etc.

RESPONSE FORMAT (JSON only):
{
  "visualMatches": [
    {
      "frameIndex": 2,
      "startTime": 4.0,
      "endTime": 6.0,
      "relevanceScore": 0.88,
      "visualDescription": "what you see that matches the query",
      "reasoning": "why this is a match",
      "audioContext": "relevant spoken words during this time if available",
      "segmentType": "visual_with_audio | visual_only | logical_context"
    }
  ]
}
`;

    try {
      const parts = [
        prompt,
        ...frames.map(frame => ({
          inlineData: {
            data: frame.imageData,
            mimeType: 'image/jpeg'
          }
        }))
      ];
      
      const result = await model.generateContent(parts);
      const responseText = result.response.text();
      const jsonMatch = responseText.match(/\{[\s\S]*\}/);
      
      if (!jsonMatch) return [];
      
      const visualData = JSON.parse(jsonMatch[0]);
      
      return visualData.visualMatches?.map((match: any, index: number) => ({
        id: `visual_${index}`,
        startTime: match.startTime,
        endTime: match.endTime,
        duration: match.endTime - match.startTime,
        matchType: 'visual' as const,
        relevanceScore: match.relevanceScore,
        description: `Visual: ${match.visualDescription}${match.audioContext ? ` + Audio: "${match.audioContext}"` : ''}`,
        reasoning: match.reasoning,
        segmentType: match.segmentType || 'visual_only'
      })) || [];
      
    } catch (error) {
      console.error('Visual search error:', error);
      return [];
    }
  }

  // Logical merge of audio and visual results with 2-second proximity merging
  private logicallyMergeResults(audioResults: SearchResultSegment[], visualResults: SearchResultSegment[]): SearchResultSegment[] {
    console.log('🔀 Performing logical merge of audio and visual results...');
    
    const mergedResults: SearchResultSegment[] = [];
    const processed = new Set<string>();
    
    // Process audio results
    for (const audioResult of audioResults) {
      let merged = false;
      
      // Check for overlapping or close visual results (within 2 seconds)
      for (const visualResult of visualResults) {
        if (this.hasTimeOverlap(audioResult, visualResult) || this.isWithin2Seconds(audioResult, visualResult)) {
          // Create merged segment
          const mergedSegment: SearchResultSegment = {
            id: `merged_${mergedResults.length}`,
            startTime: Math.min(audioResult.startTime, visualResult.startTime),
            endTime: Math.max(audioResult.endTime, visualResult.endTime),
            duration: 0,
            matchType: 'both',
            relevanceScore: Math.max(audioResult.relevanceScore, visualResult.relevanceScore),
            description: `${audioResult.description} + ${visualResult.description}`,
            reasoning: `Audio: ${audioResult.reasoning} | Visual: ${visualResult.reasoning}`
          };
          mergedSegment.duration = mergedSegment.endTime - mergedSegment.startTime;
          
          mergedResults.push(mergedSegment);
          processed.add(audioResult.id);
          processed.add(visualResult.id);
          merged = true;
          
          console.log(`🔗 Merged audio(${audioResult.startTime}s-${audioResult.endTime}s) + visual(${visualResult.startTime}s-${visualResult.endTime}s) → both(${mergedSegment.startTime}s-${mergedSegment.endTime}s)`);
          break;
        }
      }
      
      // Add standalone audio result if no merge occurred
      if (!merged && !processed.has(audioResult.id)) {
        mergedResults.push(audioResult);
        processed.add(audioResult.id);
      }
    }
    
    // Add remaining visual results
    for (const visualResult of visualResults) {
      if (!processed.has(visualResult.id)) {
        mergedResults.push(visualResult);
        processed.add(visualResult.id);
      }
    }
    
    // Sort by start time
    mergedResults.sort((a, b) => a.startTime - b.startTime);
    
    // SECOND PASS: Merge segments that are within 2 seconds of each other
    const finalMergedResults = this.mergeCloseSegments(mergedResults, 2);
    
    console.log(`🔀 Merge complete: ${audioResults.length} audio + ${visualResults.length} visual → ${mergedResults.length} initial → ${finalMergedResults.length} final after 2s proximity merge`);
    return finalMergedResults;
  }

  // Enhanced proximity merging with sentence completion logic
  private mergeCloseSegments(segments: SearchResultSegment[], maxGapSeconds: number): SearchResultSegment[] {
    if (segments.length <= 1) return segments;
    
    console.log(`🧠 Performing intelligent sentence completion merge on ${segments.length} segments...`);
    
    const merged: SearchResultSegment[] = [];
    let currentGroup = [segments[0]];
    
    for (let i = 1; i < segments.length; i++) {
      const current = segments[i];
      const lastInGroup = currentGroup[currentGroup.length - 1];
      
      // Calculate gap between segments
      const gap = current.startTime - lastInGroup.endTime;
      
      // Intelligent merging logic
      const shouldMerge = this.shouldMergeSegments(lastInGroup, current, gap, maxGapSeconds);
      
      if (shouldMerge) {
        currentGroup.push(current);
        console.log(`🔗 Merging ${current.id} with group (gap: ${gap.toFixed(1)}s) - ${shouldMerge.reason}`);
      } else {
        // Finalize current group and start new one
        merged.push(this.createCompletedSegment(currentGroup));
        currentGroup = [current];
      }
    }
    
    // Process final group
    if (currentGroup.length > 0) {
      merged.push(this.createCompletedSegment(currentGroup));
    }
    
    console.log(`🧠 Sentence completion merge: ${segments.length} → ${merged.length} segments`);
    return merged;
  }

  // Intelligent logic to determine if segments should be merged
  private shouldMergeSegments(
    segment1: SearchResultSegment, 
    segment2: SearchResultSegment, 
    gap: number, 
    maxGap: number
  ): { should: boolean; reason: string } | false {
    
    // Basic proximity check
    if (gap <= maxGap) {
      return { should: true, reason: 'proximity' };
    }
    
    // Sentence completion logic for audio segments
    if (segment1.matchType === 'audio' && segment2.matchType === 'audio') {
      // If both segments contain repetitive words, likely same sentence
      if (this.hasRepetitivePattern(segment1.description, segment2.description)) {
        return { should: true, reason: 'repetitive_pattern' };
      }
      
      // If gap is small and likely part of same sentence (up to 5 seconds)
      if (gap <= 5 && this.arePartOfSameSentence(segment1.description, segment2.description)) {
        return { should: true, reason: 'sentence_continuation' };
      }
    }
    
    // Visual-audio context completion
    if ((segment1.matchType === 'visual' && segment2.matchType === 'audio') ||
        (segment1.matchType === 'audio' && segment2.matchType === 'visual')) {
      // Merge visual and related audio within 4 seconds for context
      if (gap <= 4) {
        return { should: true, reason: 'audio_visual_context' };
      }
    }
    
    return false;
  }

  // Check if descriptions contain repetitive patterns
  private hasRepetitivePattern(desc1: string, desc2: string): boolean {
    const words1 = desc1.toLowerCase().split(' ');
    const words2 = desc2.toLowerCase().split(' ');
    
    // Check for repeated words across descriptions
    const commonWords = words1.filter(word => words2.includes(word) && word.length > 3);
    return commonWords.length > 0;
  }

  // Check if segments are part of the same sentence
  private arePartOfSameSentence(desc1: string, desc2: string): boolean {
    // Look for incomplete sentence patterns
    const endsWithIncomplete = /\b(and|but|or|so|because|that|which|who|when|where|while)\s*["\.]?\s*$/i;
    const startsWithContinuation = /^["\s]*(and|but|or|so|then|also|too|however|therefore)\b/i;
    
    return endsWithIncomplete.test(desc1) || startsWithContinuation.test(desc2);
  }

  // Create completed segment with enhanced context
  private createCompletedSegment(group: SearchResultSegment[]): SearchResultSegment {
    if (group.length === 1) return group[0];
    
    const startTime = Math.min(...group.map(s => s.startTime));
    const endTime = Math.max(...group.map(s => s.endTime));
    const maxRelevanceScore = Math.max(...group.map(s => s.relevanceScore));
    
    // Determine match type
    const hasAudio = group.some(s => s.matchType === 'audio' || s.matchType === 'both');
    const hasVisual = group.some(s => s.matchType === 'visual' || s.matchType === 'both');
    const matchType = (hasAudio && hasVisual) ? 'both' : (hasAudio ? 'audio' : 'visual');
    
    // Create intelligent description
    const description = this.createCompletedDescription(group);
    const reasoning = group.map(s => s.reasoning).join(' | ');
    
    return {
      id: `completed_${Date.now()}`,
      startTime,
      endTime,
      duration: endTime - startTime,
      matchType,
      relevanceScore: maxRelevanceScore,
      description,
      reasoning: `Sentence completion: ${reasoning}`
    };
  }

  // Create intelligent description for completed segments
  private createCompletedDescription(group: SearchResultSegment[]): string {
    if (group.length === 1) return group[0].description;
    
    // Separate audio and visual descriptions
    const audioDescs = group.filter(s => s.matchType === 'audio').map(s => s.description);
    const visualDescs = group.filter(s => s.matchType === 'visual').map(s => s.description);
    
    let completedDesc = '';
    
    if (audioDescs.length > 0) {
      // Combine audio descriptions intelligently
      const combinedAudio = this.combineAudioDescriptions(audioDescs);
      completedDesc += combinedAudio;
    }
    
    if (visualDescs.length > 0) {
      if (completedDesc) completedDesc += ' + ';
      completedDesc += visualDescs.join(' + ');
    }
    
    return completedDesc || group.map(s => s.description).join(' + ');
  }

  // Combine audio descriptions to form complete sentences
  private combineAudioDescriptions(descriptions: string[]): string {
    // Remove "Audio: " prefixes and quotes for processing
    const cleanTexts = descriptions.map(desc => 
      desc.replace(/^Audio:\s*["']?/, '').replace(/["']?$/, '').trim()
    );
    
    // If descriptions are repetitive, create a summary
    if (this.areRepetitive(cleanTexts)) {
      const baseText = cleanTexts[0];
      const count = cleanTexts.length;
      return `Audio: "${baseText}" (repeated ${count} times)`;
    }
    
    // Otherwise, join as complete sentence
    const completeSentence = cleanTexts.join(' ').trim();
    return `Audio: "${completeSentence}"`;
  }

  // Check if texts are repetitive
  private areRepetitive(texts: string[]): boolean {
    if (texts.length <= 1) return false;
    
    const firstText = texts[0].toLowerCase().trim();
    return texts.slice(1).every(text => text.toLowerCase().trim() === firstText);
  }

  // Check if two segments are within 2 seconds of each other
  private isWithin2Seconds(seg1: SearchResultSegment, seg2: SearchResultSegment): boolean {
    const gap1 = Math.abs(seg1.endTime - seg2.startTime);
    const gap2 = Math.abs(seg2.endTime - seg1.startTime);
    return Math.min(gap1, gap2) <= 2;
  }

  // Check if two segments have time overlap
  private hasTimeOverlap(seg1: SearchResultSegment, seg2: SearchResultSegment): boolean {
    return seg1.startTime < seg2.endTime && seg2.startTime < seg1.endTime;
  }

  // Extract video frames for visual analysis
  private async extractVideoFrames(videoPath: string): Promise<FrameData[]> {
    const fullVideoPath = path.resolve('uploads', videoPath);
    const tempDir = path.resolve('temp_frames');
    
    if (!fs.existsSync(tempDir)) {
      fs.mkdirSync(tempDir, { recursive: true });
    }
    
    return new Promise((resolve, reject) => {
      const ffmpegProcess = spawn('ffmpeg', [
        '-i', fullVideoPath,
        '-vf', 'fps=0.5', // Extract frame every 2 seconds
        '-y',
        path.join(tempDir, 'frame_%03d.jpg')
      ]);
      
      ffmpegProcess.on('close', (code) => {
        if (code === 0) {
          try {
            const frameFiles = fs.readdirSync(tempDir)
              .filter(file => file.startsWith('frame_') && file.endsWith('.jpg'))
              .sort();
            
            const frames: FrameData[] = frameFiles.map((file, index) => {
              const framePath = path.join(tempDir, file);
              const imageData = fs.readFileSync(framePath).toString('base64');
              return {
                timestamp: index * 2, // 2-second intervals
                imageData
              };
            });
            
            // Clean up temp files
            frameFiles.forEach(file => {
              fs.unlinkSync(path.join(tempDir, file));
            });
            
            resolve(frames);
          } catch (error) {
            reject(error);
          }
        } else {
          reject(new Error(`FFmpeg failed with code ${code}`));
        }
      });
      
      ffmpegProcess.on('error', reject);
    });
  }

  // Get video duration
  private async getVideoDuration(videoPath: string): Promise<number> {
    const fullVideoPath = path.resolve('uploads', videoPath);
    
    return new Promise((resolve, reject) => {
      const ffprobeProcess = spawn('ffprobe', [
        '-v', 'quiet',
        '-print_format', 'json',
        '-show_format',
        fullVideoPath
      ]);
      
      let output = '';
      ffprobeProcess.stdout.on('data', (data) => {
        output += data.toString();
      });
      
      ffprobeProcess.on('close', (code) => {
        if (code === 0) {
          try {
            const metadata = JSON.parse(output);
            const duration = parseFloat(metadata.format.duration) || 30;
            resolve(duration);
          } catch (error) {
            resolve(30); // Default fallback
          }
        } else {
          resolve(30); // Default fallback
        }
      });
      
      ffprobeProcess.on('error', () => resolve(30));
    });
  }

  // Generate thumbnails for search results
  private async generateThumbnails(videoPath: string, results: SearchResultSegment[]): Promise<void> {
    const fullVideoPath = path.resolve('uploads', videoPath);
    
    for (const result of results) {
      try {
        const thumbnailPath = `thumbnail_${result.id}_${Date.now()}.jpg`;
        const fullThumbnailPath = path.resolve('uploads', thumbnailPath);
        const seekTime = result.startTime + (result.duration / 2); // Middle of segment
        
        await new Promise<void>((resolve, reject) => {
          const ffmpegProcess = spawn('ffmpeg', [
            '-i', fullVideoPath,
            '-ss', seekTime.toString(),
            '-vframes', '1',
            '-y',
            fullThumbnailPath
          ]);
          
          ffmpegProcess.on('close', (code) => {
            if (code === 0) {
              result.thumbnailPath = `/api/video/search/thumbnail/${thumbnailPath}`;
              resolve();
            } else {
              reject(new Error(`Thumbnail generation failed`));
            }
          });
          
          ffmpegProcess.on('error', reject);
        });
        
      } catch (error) {
        console.error(`Thumbnail generation failed for ${result.id}:`, error);
      }
    }
  }
}