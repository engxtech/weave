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

export class IntelligentSentenceSearch {
  private genAI: GoogleGenerativeAI;
  private pendingCleanup?: () => void;

  constructor() {
    this.genAI = new GoogleGenerativeAI(process.env.GEMINI_API_KEY || '');
  }

  // Enhanced search matching for Roman English and Hindi content
  private enhanceQueryForRomanEnglish(query: string): string[] {
    const variations = [query.toLowerCase()];
    
    // Add common phonetic variations for Hindi-English transliteration
    const phoneticMap: Record<string, string[]> = {
      'kya': ['kya', 'kia', 'kyaa'],
      'hai': ['hai', 'he', 'hain'],
      'main': ['main', 'mai', 'me'],
      'aap': ['aap', 'ap', 'aapko'],
      'namaste': ['namaste', 'namaskar', 'namaskaar'],
      'accha': ['accha', 'acha', 'achha'],
      'theek': ['theek', 'thik', 'thick'],
      'baat': ['baat', 'bat', 'baath'],
      'last': ['last', 'lasht'], 
      'minute': ['minute', 'minit', 'minut'],
      'booking': ['booking', 'buking']
    };
    
    // Add variations for each word in query
    query.toLowerCase().split(' ').forEach(word => {
      if (phoneticMap[word]) {
        variations.push(...phoneticMap[word]);
      }
    });
    
    return Array.from(new Set(variations)); // Remove duplicates
  }

  // USER-SPECIFIED 4-STEP SEARCH WORKFLOW
  async searchVideo(videoPath: string, query: string): Promise<SearchResultSegment[]> {
    console.log('🔍 USER-SPECIFIED 4-STEP SEARCH WORKFLOW');
    console.log(`📁 Video: ${videoPath}`);
    console.log(`🔍 Query: "${query}"`);
    
    try {
      // Get video duration first for timestamp validation
      const videoDuration = await this.getVideoDuration(videoPath);
      console.log(`📹 Video duration: ${videoDuration}s`);
      
      // STEP 1: Find segments from audio
      console.log(`🎵 STEP 1: Find segments from audio`);
      const audioSegments = await this.findAudioSegments(videoPath, query, videoDuration);
      console.log(`🎵 Audio segments found: ${audioSegments.length}`);

      // STEP 2: Find segments from video  
      console.log(`👁️ STEP 2: Find segments from video`);
      const videoSegments = await this.findVideoSegments(videoPath, query, videoDuration);
      console.log(`👁️ Video segments found: ${videoSegments.length}`);

      // STEP 3: Combine audio and video segments with overlap merging (but no gap merging)
      console.log(`🔗 STEP 3: Combine audio and video segments (with overlap merging)`);
      const combinedSegments = await this.mergeRelatedAudioVideoSegments(audioSegments, videoSegments);
      console.log(`🔗 Combined segments count: ${combinedSegments.length}`);

      // STEP 4: Sort by time (NO gap merging - keep segments separate)
      console.log(`⏱️ STEP 4: Sort segments by time (NO gap merging)`);
      const finalSegments = combinedSegments.sort((a, b) => a.startTime - b.startTime);
      console.log(`⏱️ Final segments without gap merging: ${finalSegments.length}`);

      // Generate thumbnails for final segments
      if (finalSegments.length > 0) {
        await this.generateThumbnails(videoPath, finalSegments);
      }
      
      return finalSegments;
      
    } catch (error) {
      console.error('Search workflow error:', error);
      return [];
    }
  }

  // STEP 1: Find segments from audio
  private async findAudioSegments(videoPath: string, query: string, videoDuration: number): Promise<SearchResultSegment[]> {
    console.log('🎵 Finding audio segments...');
    
    try {
      // Get transcript segments  
      const transcriptSegments = await this.getTranscriptSegments(videoPath);
      console.log(`📝 Processing ${transcriptSegments.length} transcript segments`);
      
      // Enhance query with Roman English variations
      const queryVariations = this.enhanceQueryForRomanEnglish(query);
      console.log(`🔤 Query variations: ${queryVariations.join(', ')}`);
      
      // Search audio with all variations
      let audioResults: SearchResultSegment[] = [];
      for (const queryVar of queryVariations) {
        const results = await this.searchAudioWithCompletion(transcriptSegments, queryVar, videoDuration);
        audioResults.push(...results);
        if (results.length > 0) break; // Stop on first successful match
      }
      
      return audioResults;
    } catch (error) {
      console.error('Error finding audio segments:', error);
      return [];
    }
  }

  // STEP 2: Find segments from video
  private async findVideoSegments(videoPath: string, query: string, videoDuration: number): Promise<SearchResultSegment[]> {
    console.log('👁️ Finding video segments...');
    
    try {
      // Get transcript for context
      const transcriptSegments = await this.getTranscriptSegments(videoPath);
      
      // Enhance query with Roman English variations
      const queryVariations = this.enhanceQueryForRomanEnglish(query);
      
      // Search visual content with all variations
      let visualResults: SearchResultSegment[] = [];
      for (const queryVar of queryVariations) {
        const results = await this.searchVisualWithContext(videoPath, queryVar, transcriptSegments, videoDuration);
        visualResults.push(...results);
        if (results.length > 0) break; // Stop on first successful match
      }
      
      return visualResults;
    } catch (error) {
      console.error('Error finding video segments:', error);
      return [];
    }
  }

  // STEP 3: Merge between audio and video related segments
  private async mergeRelatedAudioVideoSegments(audioSegments: SearchResultSegment[], videoSegments: SearchResultSegment[]): Promise<SearchResultSegment[]> {
    console.log('🔗 STEP 3: Combine audio and video segments (with overlap merging)');
    console.log(`🎤 Audio segments: ${audioSegments.length}`);
    console.log(`👁️ Video segments: ${videoSegments.length}`);
    
    const finalSegments: SearchResultSegment[] = [];
    const usedAudioIndices = new Set<number>();
    const usedVideoIndices = new Set<number>();
    
    // First: Find audio segments that fall WITHIN video segments and merge them
    for (let i = 0; i < audioSegments.length; i++) {
      if (usedAudioIndices.has(i)) continue;
      
      const audioSeg = audioSegments[i];
      let bestMatch: { index: number; overlap: number } | null = null;
      
      // Find video segment where audio falls WITHIN video boundaries
      for (let j = 0; j < videoSegments.length; j++) {
        if (usedVideoIndices.has(j)) continue;
        
        const videoSeg = videoSegments[j];
        
        // Check if audio segment falls WITHIN video segment
        const audioFallsWithinVideo = audioSeg.startTime >= videoSeg.startTime && audioSeg.endTime <= videoSeg.endTime;
        
        if (audioFallsWithinVideo) {
          const overlap = this.calculateTimeOverlap(audioSeg, videoSeg);
          if (!bestMatch || overlap > bestMatch.overlap) {
            bestMatch = { index: j, overlap };
          }
        }
      }
      
      if (bestMatch) {
        // Merge audio segment with video segment (audio falls within video)
        const videoSeg = videoSegments[bestMatch.index];
        const mergedSegment: SearchResultSegment = {
          id: `audio_within_video_${audioSeg.id}_${videoSeg.id}`,
          startTime: Math.min(audioSeg.startTime, videoSeg.startTime),
          endTime: Math.max(audioSeg.endTime, videoSeg.endTime),
          duration: 0, // Will be calculated below
          matchType: 'both',
          relevanceScore: Math.max(audioSeg.relevanceScore, videoSeg.relevanceScore),
          description: `${audioSeg.description} + ${videoSeg.description}`,
          reasoning: `Audio falls within video: ${audioSeg.reasoning} | ${videoSeg.reasoning}`,
          thumbnailPath: videoSeg.thumbnailPath || audioSeg.thumbnailPath
        };
        mergedSegment.duration = mergedSegment.endTime - mergedSegment.startTime;
        
        finalSegments.push(mergedSegment);
        usedAudioIndices.add(i);
        usedVideoIndices.add(bestMatch.index);
        
        console.log(`🔗 Merged (audio within video): Audio ${audioSeg.startTime}-${audioSeg.endTime}s WITHIN Video ${videoSeg.startTime}-${videoSeg.endTime}s → ${mergedSegment.startTime}-${mergedSegment.endTime}s`);
      }
    }
    
    // Second: Add remaining unmatched audio segments
    for (let i = 0; i < audioSegments.length; i++) {
      if (!usedAudioIndices.has(i)) {
        finalSegments.push({ ...audioSegments[i], matchType: 'audio' as const });
        console.log(`🎤 Added unmatched audio: ${audioSegments[i].startTime}-${audioSegments[i].endTime}s`);
      }
    }
    
    // Third: Add remaining unmatched video segments
    for (let j = 0; j < videoSegments.length; j++) {
      if (!usedVideoIndices.has(j)) {
        finalSegments.push({ ...videoSegments[j], matchType: 'visual' as const });
        console.log(`👁️ Added unmatched video: ${videoSegments[j].startTime}-${videoSegments[j].endTime}s`);
      }
    }
    
    // Sort by start time
    finalSegments.sort((a, b) => a.startTime - b.startTime);
    
    console.log(`🔗 Combined segments count: ${finalSegments.length}`);
    return finalSegments;
  }
  
  // Helper function to calculate time overlap between two segments
  private calculateTimeOverlap(seg1: SearchResultSegment, seg2: SearchResultSegment): number {
    const overlapStart = Math.max(seg1.startTime, seg2.startTime);
    const overlapEnd = Math.min(seg1.endTime, seg2.endTime);
    return Math.max(0, overlapEnd - overlapStart);
  }
  
  // Fix overlapping segments to ensure no overlap
  private fixOverlappingSegments(segments: SearchResultSegment[]): SearchResultSegment[] {
    if (segments.length === 0) return segments;
    
    // Sort by start time
    const sortedSegments = [...segments].sort((a, b) => a.startTime - b.startTime);
    const fixedSegments: SearchResultSegment[] = [];
    
    console.log(`🔧 Fixing overlapping segments: ${sortedSegments.length} input segments`);
    
    for (let i = 0; i < sortedSegments.length; i++) {
      const currentSegment = { ...sortedSegments[i] };
      
      // Check if this segment overlaps with the previous one
      if (fixedSegments.length > 0) {
        const previousSegment = fixedSegments[fixedSegments.length - 1];
        
        if (currentSegment.startTime < previousSegment.endTime) {
          // Overlap detected - adjust current segment to start after previous ends
          const originalStart = currentSegment.startTime;
          currentSegment.startTime = previousSegment.endTime;
          currentSegment.duration = currentSegment.endTime - currentSegment.startTime;
          
          console.log(`🔧 Fixed overlap: Segment ${currentSegment.id} moved from ${originalStart}s to ${currentSegment.startTime}s`);
          
          // Skip if segment becomes invalid (endTime <= startTime)
          if (currentSegment.duration <= 0) {
            console.log(`⚠️ Skipping invalid segment ${currentSegment.id} after overlap fix`);
            continue;
          }
        }
      }
      
      fixedSegments.push(currentSegment);
    }
    
    console.log(`🔧 Fixed segments: ${sortedSegments.length} → ${fixedSegments.length} (removed ${sortedSegments.length - fixedSegments.length} invalid)`);
    return fixedSegments;
  }

  // STEP 4: Final merge - only merge segments where gap ≤2 seconds
  private applyFinalGapMerging(segments: SearchResultSegment[], maxGapSeconds: number): SearchResultSegment[] {
    console.log(`⏱️ Applying final gap merging with ${maxGapSeconds}s max gap...`);
    
    if (segments.length === 0) return segments;
    
    // Sort segments by start time
    const sortedSegments = [...segments].sort((a, b) => a.startTime - b.startTime);
    const mergedSegments: SearchResultSegment[] = [];
    let currentSegment = { ...sortedSegments[0] };
    
    for (let i = 1; i < sortedSegments.length; i++) {
      const nextSegment = sortedSegments[i];
      const gap = nextSegment.startTime - currentSegment.endTime;
      
      console.log(`⏱️ Gap analysis: Segment ${i-1} ends at ${currentSegment.endTime}s, Segment ${i} starts at ${nextSegment.startTime}s, Gap: ${gap}s`);
      
      // Only merge if gap is ≤ maxGapSeconds (user specified ≤2 seconds)
      if (gap <= maxGapSeconds) {
        console.log(`✅ Gap ${gap}s ≤ ${maxGapSeconds}s - MERGING segments`);
        // Merge segments
        currentSegment.endTime = nextSegment.endTime;
        currentSegment.duration = currentSegment.endTime - currentSegment.startTime;
        currentSegment.description += ` + ${nextSegment.description}`;
        currentSegment.reasoning += ` | ${nextSegment.reasoning}`;
        currentSegment.relevanceScore = Math.max(currentSegment.relevanceScore, nextSegment.relevanceScore);
        if (!currentSegment.thumbnailPath && nextSegment.thumbnailPath) {
          currentSegment.thumbnailPath = nextSegment.thumbnailPath;
        }
      } else {
        console.log(`❌ Gap ${gap}s > ${maxGapSeconds}s - KEEPING segments separate`);
        // Gap too large, keep segments separate
        mergedSegments.push(currentSegment);
        currentSegment = { ...nextSegment };
      }
    }
    
    // Add the last segment
    mergedSegments.push(currentSegment);
    
    console.log(`⏱️ Final gap merging complete: ${segments.length} → ${mergedSegments.length} segments`);
    return mergedSegments;
  }

  // Helper method to check if segments overlap or are close
  private segmentsOverlapOrClose(seg1: SearchResultSegment, seg2: SearchResultSegment, maxGapSeconds: number): boolean {
    const gap1 = seg2.startTime - seg1.endTime; // Gap if seg1 comes first
    const gap2 = seg1.startTime - seg2.endTime; // Gap if seg2 comes first
    const overlap = Math.max(0, Math.min(seg1.endTime, seg2.endTime) - Math.max(seg1.startTime, seg2.startTime));
    
    return overlap > 0 || gap1 <= maxGapSeconds || gap2 <= maxGapSeconds;
  }

  // Enhanced audio search with sentence completion
  private async searchAudioWithCompletion(segments: TranscriptionSegment[], query: string, videoDuration: number): Promise<SearchResultSegment[]> {
    console.log('🎤 Searching audio with sentence completion...');
    const model = this.genAI.getGenerativeModel({ model: 'gemini-1.5-flash' });
    
    const prompt = `
EXPERT VIDEO EDITOR - MULTIMODAL AUDIO ANALYSIS

You are an expert video editor with 20 years of experience in movie editing with effects and multimodal capabilities.

Query: "${query}"
VIDEO DURATION: ${videoDuration} seconds (MAXIMUM TIME LIMIT)

TRANSCRIPT SEGMENTS (already timestamped and logically chunked):
${segments.map(seg => 
  `${seg.startTime}s-${seg.endTime}s: "${seg.text}"`
).join('\n')}

PROFESSIONAL AUDIO SEGMENTATION TASK:
1. LOGICAL AUDIO SEGMENTATION:
   - Identify segments containing "${query}" or related concepts in the transcript
   - Create unified logical segments that make semantic sense (complete ideas, dialogue, scenes)
   - Use your 20 years of editing experience to determine natural segment boundaries

2. CONTEXTUAL COMPLETENESS:
   - Ensure each segment forms a complete thought or dialogue unit
   - Include sufficient context for viewer understanding
   - Apply professional editing standards for segment coherence

3. PROXIMITY MERGING RULE:
   - If segments are within 2 seconds of each other, merge them into one logical segment
   - This creates smoother, more professional editing flow

4. TIMESTAMP VALIDATION: ALL timestamps MUST be within 0-${videoDuration} seconds
   - startTime MUST be >= 0 and <= ${videoDuration}
   - endTime MUST be >= startTime and <= ${videoDuration}
   - NEVER generate timestamps beyond the video duration

RESPONSE FORMAT (JSON only):
{
  "logicalMatches": [
    {
      "startTime": 6.7,
      "endTime": 13.3,
      "relevanceScore": 0.95,
      "summary": "brief summary of the audio segment",
      "type": "audio",
      "key_entities_or_objects": ["entity1", "entity2"],
      "logicalSentence": "the complete logical thought or sentence unit",
      "boundaryType": "complete_idea | dialogue_unit | scene_audio",
      "reasoning": "professional editing justification for segment boundaries"
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
      
      const rawAudioSegments = audioData.logicalMatches?.map((match: any, index: number) => {
        // Validate and clamp timestamps to video duration
        const startTime = Math.max(0, Math.min(match.startTime, videoDuration));
        const endTime = Math.max(startTime, Math.min(match.endTime, videoDuration));
        
        if (startTime >= videoDuration) {
          console.warn(`⚠️ Skipping invalid audio segment: startTime ${match.startTime}s exceeds video duration ${videoDuration}s`);
          return null;
        }
        
        return {
          id: `logical_sentence_${index}`,
          startTime,
          endTime,
          duration: endTime - startTime,
          matchType: 'audio' as const,
          relevanceScore: match.relevanceScore,
          description: `Logical Sentence: "${match.logicalSentence}"`,
          reasoning: `${match.boundaryType}: ${match.reasoning}`,
          summary: match.summary || match.logicalSentence,
          type: match.type || 'audio',
          keyEntities: match.key_entities_or_objects || []
        };
      }).filter(Boolean) || [];
      
      // Fix overlapping segments
      return this.fixOverlappingSegments(rawAudioSegments);
      
    } catch (error) {
      console.error('Audio completion search error:', error);
      return [];
    }
  }

  // Direct Gemini video analysis with timestamp detection
  private async searchVisualWithContext(videoPath: string, query: string, transcriptSegments?: TranscriptionSegment[], videoDuration?: number): Promise<SearchResultSegment[]> {
    console.log('👁️ Using Gemini direct video analysis for accurate timestamps...');
    
    // Use provided video duration or get it if not provided
    const actualVideoDuration = videoDuration ?? await this.getVideoDuration(videoPath);
    console.log(`📹 Video duration: ${actualVideoDuration}s`);
    
    try {
      const model = this.genAI.getGenerativeModel({ 
        model: 'gemini-1.5-flash',
        generationConfig: {
          responseMimeType: "application/json"
        }
      });
      
      // Read video file for direct Gemini analysis
      const videoBuffer = fs.readFileSync(videoPath);
      
      const transcriptContext = transcriptSegments ? `
AVAILABLE AUDIO TRANSCRIPT:
${transcriptSegments.map(seg => 
  `${seg.startTime}s-${seg.endTime}s: "${seg.text}"`
).join('\n')}
` : 'NO AUDIO AVAILABLE - Analyze video visually only';
      
      const prompt = `
EXPERT VIDEO EDITOR - DIRECT VIDEO TIMESTAMP ANALYSIS

You are an expert video editor with 20 years of experience. Analyze this video directly and find EXACT timestamps where "${query}" appears.

Query: "${query}"
VIDEO DURATION: ${actualVideoDuration} seconds (MAXIMUM TIME LIMIT)

${transcriptContext}

CRITICAL REQUIREMENTS:
1. ONLY return segments where "${query}" is CLEARLY VISIBLE in the video
2. Provide EXACT start and end timestamps in seconds  
3. Each segment must show CONCRETE VISUAL EVIDENCE of "${query}"
4. If "${query}" is not actually visible, return EMPTY ARRAY
5. Better to return NO results than incorrect results

TIMESTAMP ACCURACY:
- Analyze the video frame by frame for precise timing
- Identify the EXACT moment "${query}" first appears
- Identify the EXACT moment "${query}" disappears  
- All timestamps must be within 0-${actualVideoDuration} seconds

RESPONSE FORMAT (JSON only):
{
  "segments": [
    {
      "startTime": 56.0,
      "endTime": 59.0,
      "relevanceScore": 0.95,
      "description": "SPECIFIC description of where and how '${query}' appears in this segment",
      "evidence": "CONCRETE visual evidence of '${query}' being present"
    }
  ]
}

Return EMPTY segments array if "${query}" is not actually visible in the video.
`;
      
      const result = await model.generateContent([
        { text: prompt },
        {
          inlineData: {
            data: videoBuffer.toString('base64'),
            mimeType: 'video/mp4'
          }
        }
      ]);
      
      const responseText = result.response.text();
      console.log(`📝 Gemini direct video analysis response: ${responseText.substring(0, 500)}...`);
      
      const jsonMatch = responseText.match(/\{[\s\S]*\}/);
      if (!jsonMatch) {
        console.log('❌ No valid JSON response from Gemini video analysis');
        return [];
      }
      
      const analysisData = JSON.parse(jsonMatch[0]);
      const segments = analysisData.segments || [];
      
      console.log(`🔍 Gemini found ${segments.length} direct video segments with accurate timestamps`);
      
      const validSegments = segments.map((segment: any, index: number) => {
        console.log(`📝 Segment ${index}: ${segment.startTime}s-${segment.endTime}s, Score: ${segment.relevanceScore}`);
        
        // Validate timestamps
        const startTime = Math.max(0, Math.min(segment.startTime, actualVideoDuration));
        const endTime = Math.max(startTime, Math.min(segment.endTime, actualVideoDuration));
        
        if (startTime >= actualVideoDuration) {
          console.warn(`⚠️ Skipping invalid segment: ${segment.startTime}s exceeds video duration ${actualVideoDuration}s`);
          return null;
        }
        
        return {
          id: `gemini_direct_${index}`,
          startTime,
          endTime,
          duration: endTime - startTime,
          matchType: 'visual' as const,
          relevanceScore: segment.relevanceScore || 0.9,
          description: segment.description || `Direct video detection of "${query}"`,
          reasoning: segment.evidence || `Gemini directly analyzed video and found "${query}"`,
          summary: segment.description || `Found "${query}" in video`,
          type: 'visual',
          keyEntities: [query]
        };
      }).filter(Boolean);
      
      return this.fixOverlappingSegments(validSegments);
      
    } catch (error) {
      console.error('Visual context search error:', error);
      // Cleanup even on error
      if (this.pendingCleanup) {
        this.pendingCleanup();
        this.pendingCleanup = undefined;
      }
      return [];
    }
  }

  // Expert video editor multimodal merging with 2-second proximity rule
  private intelligentlyMergeResults(audioResults: SearchResultSegment[], visualResults: SearchResultSegment[]): SearchResultSegment[] {
    console.log('🧠 Performing expert multimodal merge with 2-second proximity rule...');
    
    const allResults = [...audioResults, ...visualResults];
    allResults.sort((a, b) => a.startTime - b.startTime);
    
    if (allResults.length === 0) return [];
    
    const merged: SearchResultSegment[] = [];
    let currentGroup = [allResults[0]];
    
    for (let i = 1; i < allResults.length; i++) {
      const current = allResults[i];
      const lastInGroup = currentGroup[currentGroup.length - 1];
      
      const shouldMerge = this.shouldMergeForCompletion(lastInGroup, current);
      
      if (shouldMerge) {
        currentGroup.push(current);
        console.log(`🔗 Logical merge: ${shouldMerge.reason}`);
      } else {
        merged.push(this.createCompletedSegment(currentGroup));
        currentGroup = [current];
      }
    }
    
    if (currentGroup.length > 0) {
      merged.push(this.createCompletedSegment(currentGroup));
    }
    
    console.log(`🧠 Expert multimodal merge: ${allResults.length} → ${merged.length} logical segments`);
    return merged;
  }

  // Expert video editor logical merging with strict logical separations
  private shouldMergeForCompletion(seg1: SearchResultSegment, seg2: SearchResultSegment): { reason: string } | false {
    const gap = seg2.startTime - seg1.endTime;
    
    // Debug logging for troubleshooting
    console.log(`🔍 Merge check: Seg1(${seg1.startTime}-${seg1.endTime}) vs Seg2(${seg2.startTime}-${seg2.endTime}), gap: ${gap}s`);
    
    // ULTRA STRICT RULE: Never merge segments with gaps > 3 seconds
    if (gap > 3) {
      console.log(`❌ Gap too large: ${gap}s > 3s, keeping separate`);
      return false;
    }
    
    // Step 1: Only merge if segments actually overlap in time (negative gap)
    if (seg1.endTime > seg2.startTime && gap < 0) {
      console.log(`✅ Temporal overlap detected: ${gap}s`);
      return { reason: 'logical_temporal_overlap' };
    }
    
    // Step 2: Only merge VERY similar content with exact phrase continuations within 1 second
    if (gap <= 1 && this.areExactContinuation(seg1.description, seg2.description)) {
      console.log(`✅ Exact continuation within 1s: ${gap}s`);
      return { reason: 'exact_phrase_continuation' };
    }
    
    // Step 3: Audio-visual correlation only for same timestamps (±1 second)
    if (seg1.matchType !== seg2.matchType && Math.abs(seg1.startTime - seg2.startTime) <= 1) {
      console.log(`✅ Synchronized audio-visual: ${Math.abs(seg1.startTime - seg2.startTime)}s`);
      return { reason: 'synchronized_audio_visual' };
    }
    
    // REJECT: Large gaps should never be merged
    if (gap > 1) {
      console.log(`❌ Gap too large for merging: ${gap}s > 1s, keeping separate`);
      return false;
    }
    
    // Step 4: Only merge if gap is ≤1 second AND segments have identical keywords
    if (gap <= 1 && this.haveIdenticalKeywords(seg1.description, seg2.description)) {
      console.log(`✅ Identical keywords within 1s: ${gap}s`);
      return { reason: 'identical_keywords_proximity' };
    }
    
    console.log(`❌ No merge criteria met, keeping separate`);
    return false;
  }
  
  // Check for exact phrase continuation (much stricter than before)
  private areExactContinuation(desc1: string, desc2: string): boolean {
    // Extract just the text content without prefixes
    const text1 = desc1.replace(/^(Complete Audio:|Audio:|Logical Visual Story:)\s*["']?/, '').replace(/["']?$/, '').trim();
    const text2 = desc2.replace(/^(Complete Audio:|Audio:|Logical Visual Story:)\s*["']?/, '').replace(/["']?$/, '').trim();
    
    // Check if one ends and the other begins with the same word
    const words1 = text1.split(' ');
    const words2 = text2.split(' ');
    
    if (words1.length === 0 || words2.length === 0) return false;
    
    const lastWord1 = words1[words1.length - 1].toLowerCase();
    const firstWord2 = words2[0].toLowerCase();
    
    return lastWord1 === firstWord2;
  }
  
  // Check for identical keywords (much stricter)
  private haveIdenticalKeywords(desc1: string, desc2: string): boolean {
    const text1 = desc1.toLowerCase();
    const text2 = desc2.toLowerCase();
    
    // Extract key search terms only
    const keywords1 = this.extractKeywords(text1);
    const keywords2 = this.extractKeywords(text2);
    
    console.log(`🔍 Keywords comparison: [${keywords1.join(', ')}] vs [${keywords2.join(', ')}]`);
    
    // Must have at least 3 identical keywords to merge (very strict)
    const sharedKeywords = keywords1.filter(word => keywords2.includes(word));
    console.log(`🔍 Shared keywords: [${sharedKeywords.join(', ')}] (${sharedKeywords.length}/3 needed)`);
    
    return sharedKeywords.length >= 3;
  }
  
  // Extract only meaningful keywords for comparison
  private extractKeywords(text: string): string[] {
    const commonWords = ['the', 'and', 'or', 'but', 'in', 'on', 'at', 'to', 'for', 'of', 'with', 'by', 'is', 'are', 'was', 'were', 'this', 'that', 'audio', 'visual', 'story', 'logical', 'complete'];
    return text.split(' ')
      .filter(w => w.length > 3 && !commonWords.includes(w))
      .slice(0, 3); // Only take top 3 keywords
  }
  


  // Check if segments are part of same sentence
  private arePartOfSameSentence(desc1: string, desc2: string): boolean {
    const words1 = desc1.toLowerCase().split(' ');
    const words2 = desc2.toLowerCase().split(' ');
    
    // Check for repeated words (likely same sentence)
    const commonWords = words1.filter(word => words2.includes(word) && word.length > 3);
    if (commonWords.length > 0) return true;
    
    // Check for sentence continuation patterns
    const endsIncomplete = /\b(and|but|or|so|because|that|which|who|when|where|while)\s*["\.]?\s*$/i;
    const startsContinuation = /^["\s]*(and|but|or|so|then|also|too|however|therefore)\b/i;
    
    return endsIncomplete.test(desc1) || startsContinuation.test(desc2);
  }

  // Create completed segment with intelligent description
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
    const description = this.createIntelligentDescription(group);
    const reasoning = group.map(s => s.reasoning).join(' | ');
    
    // Merge summaries and key entities from all segments
    const summaries = group.map(s => (s as any).summary).filter(Boolean);
    const allKeyEntities = group.flatMap(s => (s as any).keyEntities || []);
    const uniqueKeyEntities = Array.from(new Set(allKeyEntities));
    const types = group.map(s => (s as any).type).filter(Boolean);
    
    return {
      id: `intelligent_merged_${Date.now()}`,
      startTime,
      endTime,
      duration: endTime - startTime,
      matchType,
      relevanceScore: maxRelevanceScore,
      description,
      reasoning: `Expert multimodal merge: ${reasoning}`
    };
  }

  // Create intelligent description for merged segments
  private createIntelligentDescription(group: SearchResultSegment[]): string {
    if (group.length === 1) return group[0].description;
    
    const audioSegments = group.filter(s => s.matchType === 'audio');
    const visualSegments = group.filter(s => s.matchType === 'visual');
    
    let description = '';
    
    if (audioSegments.length > 0) {
      // Combine audio into complete sentences
      const audioTexts = audioSegments.map(s => 
        s.description.replace(/^(Complete Audio:|Audio:)\s*["']?/, '').replace(/["']?$/, '').trim()
      );
      
      if (this.areRepetitive(audioTexts)) {
        const baseText = audioTexts[0];
        description = `Complete Audio: "${baseText}" (${audioTexts.length}x repetition)`;
      } else {
        const completeSentence = audioTexts.join(' ').trim();
        description = `Complete Audio: "${completeSentence}"`;
      }
    }
    
    if (visualSegments.length > 0) {
      if (description) description += ' + ';
      description += visualSegments.map(s => s.description).join(' + ');
    }
    
    return description || group.map(s => s.description).join(' + ');
  }

  // Check if texts are repetitive
  private areRepetitive(texts: string[]): boolean {
    if (texts.length <= 1) return false;
    const firstText = texts[0].toLowerCase().trim();
    return texts.slice(1).every(text => text.toLowerCase().trim() === firstText);
  }

  // Helper methods
  private async getTranscriptSegments(videoPath: string): Promise<TranscriptionSegment[]> {
    console.log(`🎤 Starting transcript generation for: ${videoPath}`);
    
    if (!videoPath || videoPath === 'unknown') {
      console.log('❌ Invalid video path provided:', videoPath);
      return [];
    }
    
    try {
      const model = this.genAI.getGenerativeModel({ model: 'gemini-1.5-flash' });
      const fullVideoPath = path.resolve('uploads', videoPath);
      
      // Check if file exists
      if (!fs.existsSync(fullVideoPath)) {
        console.error(`❌ Video file not found: ${fullVideoPath}`);
        return [];
      }
      
      const videoData = fs.readFileSync(fullVideoPath);
      console.log(`📁 Video file loaded: ${(videoData.length / 1024 / 1024).toFixed(2)} MB`);
      
      const prompt = `
COMPREHENSIVE AUDIO TRANSCRIPTION WITH PRECISE TIMING

Transcribe this video's complete audio content with high accuracy and natural segmentation.

CRITICAL REQUIREMENTS:
1. COMPLETE AUDIO EXTRACTION: Listen carefully and transcribe ALL spoken words including:
   - Proper names (e.g., "Sunil Gavaskar", person names, place names)
   - Casual expressions (stupid, crazy, awesome, etc.)
   - Repeated words or phrases (like "stupid stupid stupid")
   - Numbers, dates, technical terms
   - Background conversations or narration

2. LANGUAGE HANDLING:
   - If Hindi/Hinglish detected: Provide ROMAN ENGLISH transliteration
   - Examples: "namaste" not "नमस्ते", "kya hal hai" not "क्या हाल है"
   - For mixed language (Hinglish): Keep English words as-is, transliterate Hindi parts
   - Always use Roman alphabet for better search compatibility

3. NATURAL SEGMENTATION:
   - Break into logical sentence/phrase segments at natural pause points
   - Each segment should contain complete thoughts or meaningful phrases
   - Provide accurate start and end times for each segment
   - Capture repetitive phrases as single complete segments

4. HIGH ACCURACY: Focus on getting every word correct, especially names and key terms

RESPONSE FORMAT (JSON only):
{
  "segments": [
    {
      "startTime": 0.5,
      "endTime": 4.2,
      "text": "complete sentence or phrase with all words transcribed accurately",
      "language": "hindi/english/hinglish"
    }
  ]
}

If no clear speech is detected, return: {"segments": []}
`;

      console.log('🤖 Sending video to Gemini for comprehensive transcription...');
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
      console.log(`📝 Gemini transcription response received (${responseText.length} chars)`);
      
      // Log first 200 chars for debugging
      console.log(`📝 Response preview: ${responseText.substring(0, 200)}...`);
      
      const jsonMatch = responseText.match(/\{[\s\S]*\}/);
      
      if (!jsonMatch) {
        console.log('❌ No JSON found in Gemini response');
        console.log('📝 Full response:', responseText);
        return this.createRealTranscriptFallback(videoPath);
      }

      try {
        const transcriptData = JSON.parse(jsonMatch[0]);
        console.log(`✅ Successfully parsed transcript JSON`);
        
        const segments = transcriptData.segments?.map((seg: {startTime: number, endTime: number, text: string}, index: number) => ({
          id: `segment_${index}`,
          startTime: seg.startTime,
          endTime: seg.endTime,
          text: seg.text || `Segment ${index + 1}`
        })) || [];
        
        console.log(`🎤 Generated ${segments.length} transcript segments`);
        
        if (segments.length > 0) {
          console.log(`🎤 Sample transcript segments:`);
          segments.slice(0, Math.min(3, segments.length)).forEach((seg: {startTime: number, endTime: number, text: string}) => 
            console.log(`  ${seg.startTime}s-${seg.endTime}s: "${seg.text.substring(0, 60)}${seg.text.length > 60 ? '...' : ''}"`)
          );
        } else {
          console.log('⚠️ No transcript segments generated - video may not have clear audio');
        }
        
        return segments;
        
      } catch (parseError) {
        console.error('❌ JSON parsing failed:', parseError);
        console.log('📝 Raw JSON:', jsonMatch[0].substring(0, 300));
        return this.createRealTranscriptFallback(videoPath);
      }
      
    } catch (error) {
      console.error('❌ Complete transcript generation failed:', error);
      return this.createRealTranscriptFallback(videoPath);
    }
  }

  // Create real transcript fallback by extracting audio and using basic transcription
  private async createRealTranscriptFallback(videoPath: string): Promise<TranscriptionSegment[]> {
    console.log(`🔄 Creating real transcript fallback for: ${videoPath}`);
    
    try {
      const model = this.genAI.getGenerativeModel({ model: 'gemini-1.5-flash' });
      const fullVideoPath = path.resolve('uploads', videoPath);
      const videoData = fs.readFileSync(fullVideoPath);
      
      // Simplified transcription request
      const basicPrompt = `
BASIC AUDIO TRANSCRIPTION
Please transcribe all spoken words from this video.
Include names, casual words, and any repeated phrases.
Focus on accuracy over formatting.

Return plain text transcript only - no JSON needed.
`;

      console.log('🤖 Attempting basic transcription...');
      const result = await model.generateContent([
        basicPrompt,
        {
          inlineData: {
            data: videoData.toString('base64'),
            mimeType: 'video/mp4'
          }
        }
      ]);

      const transcriptText = result.response.text();
      console.log(`📝 Basic transcript received: ${transcriptText.length} chars`);
      console.log(`📝 Transcript preview: ${transcriptText.substring(0, 150)}...`);
      
      if (!transcriptText || transcriptText.trim().length < 10) {
        console.log('⚠️ No meaningful transcript generated');
        return [];
      }
      
      // Create segments from the transcript
      const duration = await this.getVideoDuration(videoPath);
      const words = transcriptText.trim().split(/\s+/);
      const wordsPerSecond = words.length / duration;
      const segmentDuration = 3; // 3-second segments
      const wordsPerSegment = Math.ceil(wordsPerSecond * segmentDuration);
      
      const segments: TranscriptionSegment[] = [];
      for (let i = 0; i < words.length; i += wordsPerSegment) {
        const segmentWords = words.slice(i, i + wordsPerSegment);
        const startTime = (i / wordsPerSecond);
        const endTime = Math.min(((i + wordsPerSegment) / wordsPerSecond), duration);
        
        if (segmentWords.length > 0) {
          segments.push({
            id: `fallback_segment_${segments.length}`,
            startTime: Math.max(0, startTime),
            endTime: Math.min(endTime, duration),
            text: segmentWords.join(' ')
          });
        }
      }
      
      console.log(`✅ Created ${segments.length} fallback transcript segments`);
      return segments;
      
    } catch (error) {
      console.error('❌ Fallback transcript failed:', error);
      return this.createBasicTimeSegments(videoPath);
    }
  }

  // Last resort: create time-based segments without transcript
  private async createBasicTimeSegments(videoPath: string): Promise<TranscriptionSegment[]> {
    console.log(`⚠️ Creating basic time segments (no transcript available) for: ${videoPath}`);
    
    const duration = await this.getVideoDuration(videoPath);
    const segmentDuration = 5; // 5-second segments for last resort
    const numSegments = Math.ceil(duration / segmentDuration);
    
    const segments: TranscriptionSegment[] = [];
    for (let i = 0; i < numSegments; i++) {
      const startTime = i * segmentDuration;
      const endTime = Math.min((i + 1) * segmentDuration, duration);
      
      segments.push({
        id: `time_segment_${i}`,
        startTime,
        endTime,
        text: `Audio content from ${startTime.toFixed(1)}s to ${endTime.toFixed(1)}s` // Generic but searchable
      });
    }
    
    console.log(`⚠️ Created ${segments.length} basic time segments`);
    return segments;
  }

  private async extractVideoFrames(videoPath: string): Promise<FrameData[]> {
    const fullVideoPath = path.resolve('uploads', videoPath);
    
    // Create unique temp directory for this execution
    const executionId = `search_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;
    const tempDir = path.resolve('temp_frames', executionId);
    
    // Get video duration first
    const videoDuration = await this.getVideoDuration(fullVideoPath);
    const expectedFrames = Math.ceil(videoDuration / 2);
    console.log(`📹 Video duration: ${videoDuration}s, expecting ~${expectedFrames} frames at 1 frame every 2s`);
    
    // Create unique temp directory
    fs.mkdirSync(tempDir, { recursive: true });
    
    return new Promise((resolve, reject) => {
      const ffmpegProcess = spawn('ffmpeg', [
        '-i', fullVideoPath,
        '-vf', 'fps=0.5', // Extract 1 frame every 2 seconds
        '-t', videoDuration.toString(), // Limit extraction to actual video duration
        '-y',
        path.join(tempDir, 'frame_%03d.jpg')
      ]);
      
      ffmpegProcess.on('close', (code) => {
        if (code === 0) {
          try {
            const frameFiles = fs.readdirSync(tempDir)
              .filter(file => file.startsWith('frame_') && file.endsWith('.jpg'))
              .sort();
            
            console.log(`🖼️ Extracted ${frameFiles.length} frames from execution directory (expected ~${expectedFrames})`);
            
            const frames: FrameData[] = frameFiles.map((file, index) => {
              const framePath = path.join(tempDir, file);
              const imageData = fs.readFileSync(framePath).toString('base64');
              return {
                timestamp: index * 2, // 1 frame every 2 seconds
                imageData
              };
            });
            
            // Store cleanup function for later (after visual analysis is complete)
            this.pendingCleanup = () => {
              if (fs.existsSync(tempDir)) {
                fs.rmSync(tempDir, { recursive: true, force: true });
                console.log(`🧹 Cleaned up temp directory: ${executionId}`);
              }
            };
            
            console.log(`📹 Final frame count: ${frames.length} frames for visual analysis`);
            resolve(frames);
          } catch (error) {
            // Clean up on error too
            if (fs.existsSync(tempDir)) {
              fs.rmSync(tempDir, { recursive: true, force: true });
            }
            reject(error);
          }
        } else {
          // Clean up on FFmpeg error
          if (fs.existsSync(tempDir)) {
            fs.rmSync(tempDir, { recursive: true, force: true });
          }
          reject(new Error(`FFmpeg failed with code ${code}`));
        }
      });
    });
  }

  private async getVideoDuration(videoPath: string): Promise<number> {
    const fullVideoPath = path.resolve('uploads', videoPath);
    
    return new Promise((resolve, reject) => {
      const ffprobeProcess = spawn('ffprobe', [
        '-v', 'error',
        '-show_entries', 'format=duration',
        '-of', 'csv=p=0',
        fullVideoPath
      ]);
      
      let output = '';
      ffprobeProcess.stdout.on('data', (data) => {
        output += data.toString();
      });
      
      ffprobeProcess.on('close', (code) => {
        if (code === 0) {
          const duration = parseFloat(output.trim());
          resolve(duration);
        } else {
          reject(new Error(`FFprobe failed with code ${code}`));
        }
      });
    });
  }

  private async generateThumbnails(videoPath: string, results: SearchResultSegment[]): Promise<void> {
    const fullVideoPath = path.resolve('uploads', videoPath);
    
    for (const result of results) {
      try {
        const timestamp = result.startTime + (result.duration / 2);
        const thumbnailFilename = `thumbnail_${result.id}_${Date.now()}.jpg`;
        const thumbnailPath = path.resolve('uploads', thumbnailFilename);
        
        await new Promise<void>((resolve, reject) => {
          const ffmpegProcess = spawn('ffmpeg', [
            '-i', fullVideoPath,
            '-ss', timestamp.toString(),
            '-vframes', '1',
            '-y',
            thumbnailPath
          ]);
          
          ffmpegProcess.on('close', (code) => {
            if (code === 0) {
              result.thumbnailPath = `/api/video/search/thumbnail/${thumbnailFilename}`;
              resolve();
            } else {
              reject(new Error(`Thumbnail generation failed with code ${code}`));
            }
          });
        });
      } catch (error) {
        console.error(`Failed to generate thumbnail for ${result.id}:`, error);
      }
    }
  }
}