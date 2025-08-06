import { GoogleGenAI } from "@google/genai";
import * as fs from "fs";
import * as path from "path";
import { spawn } from "child_process";
import { nanoid } from "nanoid";

const ai = new GoogleGenAI({ apiKey: process.env.GEMINI_API_KEY || "" });

export interface PersonDetection {
  name: string;
  confidence: number;
  timeRanges: Array<{
    startTime: number;
    endTime: number;
    description: string;
  }>;
}

export interface ObjectDetection {
  object: string;
  confidence: number;
  timeRanges: Array<{
    startTime: number;
    endTime: number;
    description: string;
  }>;
}

export interface ActivityDetection {
  activity: string;
  confidence: number;
  timeRanges: Array<{
    startTime: number;
    endTime: number;
    description: string;
  }>;
}

export interface TokenUsage {
  inputTokens: number;
  outputTokens: number;
  totalTokens: number;
  cost: number;
}

export interface VideoIntelligenceResult {
  videoPath: string;
  duration: number;
  transcript?: string;
  people: PersonDetection[];
  objects: ObjectDetection[];
  activities: ActivityDetection[];
  analysisTimestamp: number;
  tokenUsage?: TokenUsage;
}

export class VideoIntelligenceTool {
  private cache = new Map<string, VideoIntelligenceResult>();
  private tokenUsage: TokenUsage = { inputTokens: 0, outputTokens: 0, totalTokens: 0, cost: 0 };

  private calculateTokenCost(inputTokens: number, outputTokens: number): TokenUsage {
    // Gemini 1.5 Flash pricing: $0.075 per 1M input tokens, $0.30 per 1M output tokens
    const inputCost = (inputTokens / 1_000_000) * 0.075;
    const outputCost = (outputTokens / 1_000_000) * 0.30;
    const totalCost = inputCost + outputCost;
    
    return {
      inputTokens,
      outputTokens,
      totalTokens: inputTokens + outputTokens,
      cost: totalCost
    };
  }

  private addToTokenUsage(usage: TokenUsage): void {
    this.tokenUsage.inputTokens += usage.inputTokens;
    this.tokenUsage.outputTokens += usage.outputTokens;
    this.tokenUsage.totalTokens += usage.totalTokens;
    this.tokenUsage.cost += usage.cost;
  }

  private resetTokenUsage(): void {
    this.tokenUsage = { inputTokens: 0, outputTokens: 0, totalTokens: 0, cost: 0 };
  }

  public getCurrentTokenUsage(): TokenUsage {
    return { ...this.tokenUsage };
  }

  async analyzeVideo(videoPath: string): Promise<VideoIntelligenceResult> {
    // Ensure we have the full path to the video file
    const fullVideoPath = path.isAbsolute(videoPath) 
      ? videoPath 
      : path.join(process.cwd(), 'uploads', videoPath);

    // Check cache first
    if (this.cache.has(fullVideoPath)) {
      return this.cache.get(fullVideoPath)!;
    }

    console.log(`Starting video intelligence analysis for: ${fullVideoPath}`);

    // Get video duration
    const duration = await this.getVideoDuration(fullVideoPath);
    
    // Extract frames at intervals for analysis
    const frames = await this.extractFramesForAnalysis(fullVideoPath, duration);
    
    // Get audio transcript
    const transcript = await this.extractAudioTranscript(fullVideoPath);
    
    // Analyze frames with Gemini
    const analysisResults = await this.analyzeFramesWithGemini(frames, transcript);
    
    const result: VideoIntelligenceResult = {
      videoPath: fullVideoPath,
      duration,
      transcript,
      people: analysisResults.people,
      objects: analysisResults.objects,
      activities: analysisResults.activities,
      analysisTimestamp: Date.now()
    };

    // Cache the result
    this.cache.set(fullVideoPath, result);
    
    return result;
  }

  private async getVideoDuration(videoPath: string): Promise<number> {
    return new Promise((resolve, reject) => {
      // Ensure we have the full path to the video file
      const fullVideoPath = path.isAbsolute(videoPath) 
        ? videoPath 
        : path.join(process.cwd(), 'uploads', videoPath);

      console.log(`Getting duration for video: ${fullVideoPath}`);
      
      // Check if file exists
      if (!fs.existsSync(fullVideoPath)) {
        console.error(`Video file not found: ${fullVideoPath}`);
        reject(new Error(`Video file not found: ${fullVideoPath}`));
        return;
      }

      const ffprobe = spawn('ffprobe', [
        '-v', 'quiet',
        '-print_format', 'json',
        '-show_format',
        fullVideoPath
      ]);

      let output = '';
      let errorOutput = '';
      
      ffprobe.stdout.on('data', (data) => {
        output += data.toString();
      });

      ffprobe.stderr.on('data', (data) => {
        errorOutput += data.toString();
      });

      ffprobe.on('close', (code) => {
        if (code === 0) {
          try {
            const info = JSON.parse(output);
            const duration = parseFloat(info.format.duration);
            console.log(`Video duration: ${duration} seconds`);
            resolve(duration);
          } catch (error) {
            console.error('Error parsing ffprobe output:', error);
            console.error('Output was:', output);
            reject(error);
          }
        } else {
          console.error(`ffprobe failed with code ${code}`);
          console.error('Error output:', errorOutput);
          reject(new Error(`Failed to get video duration: ${errorOutput}`));
        }
      });
    });
  }

  private async extractFramesForAnalysis(videoPath: string, duration: number): Promise<Array<{timestamp: number, framePath: string}>> {
    const frames: Array<{timestamp: number, framePath: string}> = [];
    const frameInterval = 1; // Extract frames every 1 second for better accuracy
    const tempDir = path.join(process.cwd(), 'temp_frames');
    
    // Ensure we have the full path to the video file
    const fullVideoPath = path.isAbsolute(videoPath) 
      ? videoPath 
      : path.join(process.cwd(), 'uploads', videoPath);
    
    // Create temp directory
    if (!fs.existsSync(tempDir)) {
      fs.mkdirSync(tempDir, { recursive: true });
    }

    console.log(`Extracting frames every ${frameInterval} seconds from video (duration: ${duration}s)`);

    for (let time = 0; time < duration; time += frameInterval) {
      const framePath = path.join(tempDir, `frame_${time}_${nanoid()}.jpg`);
      
      await new Promise<void>((resolve, reject) => {
        const ffmpeg = spawn('ffmpeg', [
          '-ss', time.toString(),
          '-i', fullVideoPath,
          '-frames:v', '1',
          '-q:v', '2',
          '-y',
          framePath
        ]);

        ffmpeg.on('close', (code) => {
          if (code === 0 && fs.existsSync(framePath)) {
            frames.push({ timestamp: time, framePath });
          }
          resolve();
        });

        ffmpeg.on('error', () => resolve()); // Continue even if frame extraction fails
      });
    }

    return frames;
  }

  private async extractAudioTranscript(videoPath: string): Promise<string> {
    const tempAudioPath = path.join(process.cwd(), `temp_audio_${nanoid()}.wav`);
    
    // Ensure we have the full path to the video file
    const fullVideoPath = path.isAbsolute(videoPath) 
      ? videoPath 
      : path.join(process.cwd(), 'uploads', videoPath);
    
    try {
      // Extract audio from video
      await new Promise<void>((resolve, reject) => {
        const ffmpeg = spawn('ffmpeg', [
          '-i', fullVideoPath,
          '-vn', // No video
          '-acodec', 'pcm_s16le',
          '-ar', '16000',
          '-ac', '1',
          '-y',
          tempAudioPath
        ]);

        ffmpeg.on('close', (code) => {
          if (code === 0) {
            resolve();
          } else {
            reject(new Error('Audio extraction failed'));
          }
        });
      });

      // Use Gemini to transcribe audio
      if (fs.existsSync(tempAudioPath)) {
        const audioBytes = fs.readFileSync(tempAudioPath);
        
        const response = await ai.models.generateContent({
          model: "gemini-2.0-flash-exp",
          contents: [
            {
              inlineData: {
                data: audioBytes.toString("base64"),
                mimeType: "audio/wav",
              },
            },
            "Transcribe this audio and provide timestamps where possible. Include speaker identification if multiple people are speaking."
          ],
        });

        // Clean up temp audio file
        fs.unlinkSync(tempAudioPath);
        
        return response.text || "";
      }
    } catch (error) {
      console.error('Audio transcription failed:', error);
      if (fs.existsSync(tempAudioPath)) {
        fs.unlinkSync(tempAudioPath);
      }
    }

    return "";
  }

  private async analyzeFramesWithGemini(frames: Array<{timestamp: number, framePath: string}>, transcript: string) {
    const people: PersonDetection[] = [];
    const objects: ObjectDetection[] = [];
    const activities: ActivityDetection[] = [];

    console.log(`Analyzing ${frames.length} frames with Gemini...`);

    // Process frames in batches to avoid rate limits
    const batchSize = 5;
    for (let i = 0; i < frames.length; i += batchSize) {
      const batch = frames.slice(i, i + batchSize);
      
      for (const frame of batch) {
        try {
          const frameAnalysis = await this.analyzeFrameWithGemini(frame, transcript);
          
          // Merge results
          this.mergeDetections(people, frameAnalysis.people, frame.timestamp);
          this.mergeDetections(objects, frameAnalysis.objects, frame.timestamp);
          this.mergeDetections(activities, frameAnalysis.activities, frame.timestamp);
          
          // Clean up frame file
          if (fs.existsSync(frame.framePath)) {
            fs.unlinkSync(frame.framePath);
          }
        } catch (error) {
          console.error(`Frame analysis failed for timestamp ${frame.timestamp}:`, error);
        }
      }
      
      // Add delay between batches to respect rate limits
      if (i + batchSize < frames.length) {
        await new Promise(resolve => setTimeout(resolve, 1000));
      }
    }

    return { people, objects, activities };
  }

  private async analyzeFrameWithGemini(frame: {timestamp: number, framePath: string}, transcript: string) {
    const imageBytes = fs.readFileSync(frame.framePath);

    const prompt = `FRAME ANALYSIS TASK: Analyze this video frame at timestamp ${frame.timestamp} seconds.

PRIMARY OBJECTIVE: Identify ALL people visible in this frame with maximum detail.

SPECIFIC INSTRUCTIONS:
1. Look carefully for ANY human faces, even if partially visible or in the background
2. Identify people by their appearance, clothing, distinguishing features
3. If you can identify specific individuals (like public figures, celebrities, sports players), provide their names
4. Note facial expressions, gestures, and positioning
5. Pay attention to clothing, accessories, or uniforms that might help identify people
6. Look for name tags, jerseys with names, or any text that identifies people

Audio context: ${transcript.substring(0, 300)}

Please identify:
1. PEOPLE: Any recognizable people, celebrities, or public figures. Be specific with names if you can identify them.
2. OBJECTS: Notable objects, items, or things visible in the scene.
3. ACTIVITIES: What activities or actions are happening (dancing, talking, walking, etc.)

Respond in JSON format:
{
  "people": [{"name": "person name", "confidence": 0.8, "description": "what they're doing"}],
  "objects": [{"object": "object name", "confidence": 0.9, "description": "object details"}],
  "activities": [{"activity": "activity name", "confidence": 0.7, "description": "activity details"}]
}

Be accurate and only include high-confidence detections. For people, try to identify specific individuals if possible.`;

    const response = await ai.models.generateContent({
      model: "gemini-2.0-flash-exp",
      contents: [
        {
          inlineData: {
            data: imageBytes.toString("base64"),
            mimeType: "image/jpeg",
          },
        },
        prompt
      ],
    });

    try {
      const analysisText = response.text || "{}";
      const cleanJson = this.extractJSON(analysisText);
      return JSON.parse(cleanJson);
    } catch (error) {
      console.error('Failed to parse frame analysis:', error);
      return { people: [], objects: [], activities: [] };
    }
  }

  private extractJSON(text: string): string {
    // Find JSON in the response
    const jsonMatch = text.match(/\{[\s\S]*\}/);
    if (jsonMatch) {
      return jsonMatch[0];
    }
    return "{}";
  }

  private mergeDetections(existingDetections: any[], newDetections: any[], timestamp: number) {
    for (const newItem of newDetections) {
      const existing = existingDetections.find(item => 
        item.name === newItem.name || item.object === newItem.object || item.activity === newItem.activity
      );

      if (existing) {
        // Add to existing time ranges
        const lastRange = existing.timeRanges[existing.timeRanges.length - 1];
        if (lastRange && timestamp - lastRange.endTime <= 5) {
          // Extend existing range if within 5 seconds
          lastRange.endTime = timestamp + 2;
          lastRange.description += `, ${newItem.description}`;
        } else {
          // Add new time range
          existing.timeRanges.push({
            startTime: timestamp,
            endTime: timestamp + 2,
            description: newItem.description
          });
        }
        existing.confidence = Math.max(existing.confidence, newItem.confidence);
      } else {
        // Create new detection
        const key = newItem.name || newItem.object || newItem.activity;
        existingDetections.push({
          [newItem.name ? 'name' : newItem.object ? 'object' : 'activity']: key,
          confidence: newItem.confidence,
          timeRanges: [{
            startTime: timestamp,
            endTime: timestamp + 2,
            description: newItem.description
          }]
        });
      }
    }
  }

  async findPersonInVideo(videoPath: string, personName: string): Promise<Array<{startTime: number, endTime: number, description: string}>> {
    console.log(`Searching for ${personName} in video using direct frame analysis...`);
    
    // Reset token usage for this query
    this.resetTokenUsage();
    
    // Ensure we have the full path to the video file
    const fullVideoPath = path.isAbsolute(videoPath) 
      ? videoPath 
      : path.join(process.cwd(), 'uploads', videoPath);
    
    // Get video duration
    const duration = await this.getVideoDuration(fullVideoPath);
    
    // Extract frames every 2 seconds for targeted person search
    const frames = await this.extractFramesForAnalysis(fullVideoPath, duration);
    
    const results: Array<{startTime: number, endTime: number, description: string}> = [];
    
    console.log(`Analyzing ${frames.length} frames for ${personName}...`);
    console.log(`This will make ${frames.length} Gemini API calls for comprehensive analysis...`);

    // Analyze each frame specifically for the person
    for (let i = 0; i < frames.length; i++) {
      const frame = frames[i];
      try {
        console.log(`[${i+1}/${frames.length}] Analyzing frame at ${frame.timestamp}s for ${personName}...`);
        const personFound = await this.searchPersonInFrame(frame, personName);
        
        if (personFound.found) {
          results.push({
            startTime: frame.timestamp,
            endTime: frame.timestamp + 2,
            description: personFound.description
          });
          console.log(`✓ MATCH FOUND: ${personName} at ${frame.timestamp}s - ${personFound.description}`);
        } else {
          console.log(`✗ No match at ${frame.timestamp}s`);
        }
        
        // Clean up frame file
        if (fs.existsSync(frame.framePath)) {
          fs.unlinkSync(frame.framePath);
        }
        
        // Add small delay to respect rate limits
        await new Promise(resolve => setTimeout(resolve, 500));
      } catch (error) {
        console.error(`Frame analysis failed for ${frame.timestamp}s:`, error);
      }
    }
    
    console.log(`=== PERSON SEARCH COMPLETE ===`);
    console.log(`Searched for: ${personName}`);
    console.log(`Frames analyzed: ${frames.length}`);
    console.log(`Matches found: ${results.length}`);
    if (results.length > 0) {
      console.log(`Match timestamps:`, results.map(r => `${r.startTime}s`).join(', '));
    }
    
    // Log total token usage for this search
    const totalUsage = this.getCurrentTokenUsage();
    console.log(`=== TOTAL TOKEN USAGE FOR SEARCH ===`);
    console.log(`Total Gemini API calls: ${frames.length}`);
    console.log(`Total input tokens: ${totalUsage.inputTokens.toLocaleString()}`);
    console.log(`Total output tokens: ${totalUsage.outputTokens.toLocaleString()}`);
    console.log(`Total tokens: ${totalUsage.totalTokens.toLocaleString()}`);
    console.log(`Total cost: $${totalUsage.cost.toFixed(6)}`);
    console.log(`Average tokens per frame: ${Math.round(totalUsage.totalTokens / frames.length)}`);
    console.log(`======================================`);
    
    return results;
  }

  private async searchPersonInFrame(frame: {timestamp: number, framePath: string}, personName: string): Promise<{found: boolean, description: string}> {
    const imageBytes = fs.readFileSync(frame.framePath);

    const prompt = `PERSON IDENTIFICATION: Looking for "${personName}" in this video frame at ${frame.timestamp} seconds.

YOUR TASK: Carefully examine this image to determine if ${personName} is present.

ANALYSIS APPROACH:
1. Look at EVERY person/face in the image, no matter how small
2. If ${personName} is a well-known person (celebrity, public figure, athlete), use your knowledge to identify them
3. Check facial features, hair, clothing, body language, and any visible text/name tags
4. Consider the setting and context that might help identification
5. Be thorough but only confirm if you're reasonably confident

REQUIRED RESPONSE FORMAT (respond with EXACTLY one of these):
- "FOUND: [describe where/how ${personName} appears in the frame]"
- "POSSIBLE: [describe why you think it might be ${personName} but aren't sure]"  
- "NOT_FOUND"

Do not include any other text or explanations. Just the status and description.`;

    try {
      const response = await ai.models.generateContent({
        model: "gemini-2.0-flash-exp",
        contents: [
          {
            inlineData: {
              data: imageBytes.toString("base64"),
              mimeType: "image/jpeg",
            },
          },
          prompt,
        ],
      });

      // Track token usage from this Gemini call - estimate based on content
      const result = response.text || "";
      const estimatedInputTokens = Math.ceil((prompt.length + 1000) / 4); // ~4 chars per token + image tokens
      const estimatedOutputTokens = Math.ceil(result.length / 4); // ~4 chars per token
      
      const tokenCost = this.calculateTokenCost(estimatedInputTokens, estimatedOutputTokens);
      this.addToTokenUsage(tokenCost);
      console.log(`Frame ${frame.timestamp}s: ~${tokenCost.totalTokens} tokens, ~$${tokenCost.cost.toFixed(6)}`);
      console.log(`Gemini response for ${personName} at ${frame.timestamp}s: "${result}"`);
      
      if (result.includes("FOUND:")) {
        const description = result.replace("FOUND:", "").trim();
        console.log(`✓ Positive identification: ${description}`);
        return { found: true, description };
      } else if (result.includes("POSSIBLE:")) {
        const description = result.replace("POSSIBLE:", "").trim();
        console.log(`? Possible match: ${description}`);
        return { found: true, description: `Possible match: ${description}` };
      } else {
        console.log(`✗ Not found in this frame`);
        return { found: false, description: "" };
      }
    } catch (error) {
      console.error("Gemini analysis failed:", error);
      return { found: false, description: "" };
    }
  }

  async findByQuery(videoPath: string, query: string): Promise<Array<{startTime: number, endTime: number, description: string}>> {
    console.log(`Finding by query: "${query}"`);
    
    // Check if this is a person search query - enhanced detection
    const personQuery = query.toLowerCase();
    const personKeywords = ['person', 'people', 'who', 'find', 'appears', 'shows up', 'in video', 'is', 'altman', 'pant'];
    const containsPersonKeywords = personKeywords.some(keyword => personQuery.includes(keyword));
    const isNamePattern = /^[A-Z][a-z]+(\s+[A-Z][a-z]+)+/.test(query); // Matches "FirstName LastName" or longer names
    const isPossiblePersonSearch = containsPersonKeywords || isNamePattern;

    console.log(`Query analysis: contains keywords=${containsPersonKeywords}, name pattern=${isNamePattern}, using person search=${isPossiblePersonSearch}`);

    if (isPossiblePersonSearch) {
      console.log("✓ Detected person search query, using enhanced frame-by-frame person detection...");
      
      // Try different extraction patterns
      let personName = query;
      
      // Extract from patterns like "is Sam Altman", "find Rishabh Pant", etc.
      const nameMatch = query.match(/(?:find|is|shows?|appears?|when)\s+([A-Z][a-z]+(?:\s+[A-Z][a-z]+)*)/i);
      if (nameMatch) {
        personName = nameMatch[1];
      }
      // If no match, check if the whole query is a name
      else if (isNamePattern) {
        personName = query.trim();
      }
      
      console.log(`Using person name: "${personName}"`);
      return this.findPersonInVideo(videoPath, personName);
    }

    // Ensure we have the full path to the video file
    const fullVideoPath = path.isAbsolute(videoPath) 
      ? videoPath 
      : path.join(process.cwd(), 'uploads', videoPath);
      
    const analysis = await this.analyzeVideo(fullVideoPath);
    const results: Array<{startTime: number, endTime: number, description: string}> = [];

    // Use Gemini to interpret the query and match against detections
    const interpretationPrompt = `Given this query: "${query}"

And this video analysis data:
People: ${JSON.stringify(analysis.people, null, 2)}
Objects: ${JSON.stringify(analysis.objects, null, 2)}
Activities: ${JSON.stringify(analysis.activities, null, 2)}

Find all time ranges that match the query. Return them as JSON array:
[{"startTime": number, "endTime": number, "description": "what was found"}]

Be inclusive - if the query mentions "dancing" find all dance-related activities.
If it mentions a person's name, find all their appearances.
If it mentions objects like "glasses" or "sunglasses", find relevant time ranges.`;

    try {
      const response = await ai.models.generateContent({
        model: "gemini-2.0-flash-exp",
        contents: interpretationPrompt,
      });

      const responseText = response.text || "[]";
      const cleanJson = this.extractJSON(responseText);
      const matches = JSON.parse(cleanJson);
      
      return Array.isArray(matches) ? matches : [];
    } catch (error) {
      console.error('Query interpretation failed:', error);
      return [];
    }
  }

  getAnalysisForVideo(videoPath: string): VideoIntelligenceResult | null {
    return this.cache.get(videoPath) || null;
  }

  clearCache() {
    this.cache.clear();
  }
}

export const videoIntelligenceTool = new VideoIntelligenceTool();