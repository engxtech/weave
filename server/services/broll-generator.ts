import { GoogleGenAI } from "@google/genai";
import * as fs from "fs";
import * as path from "path";

const ai = new GoogleGenAI({ apiKey: process.env.GEMINI_API_KEY || "" });

interface BrollSuggestion {
  concept: string;
  startTime: string;
  endTime: string;
  justification: string;
  videoGenerationPrompt: string;
}

interface BrollPlan {
  suggestions: BrollSuggestion[];
  videoAnalysis: {
    transcript: string;
    keyThemes: string[];
    talkingHeadSegments: string[];
    abstractConcepts: string[];
  };
}

export class BrollGenerator {
  private model: any;

  constructor() {
    this.model = ai.models.generateContent;
  }

  async generateBrollPlan(videoPath: string): Promise<BrollPlan> {
    console.log(`🎬 BrollGenerator: Starting B-roll analysis for ${videoPath}`);
    
    try {
      // Verify video file exists
      if (!fs.existsSync(videoPath)) {
        throw new Error(`Video file not found: ${videoPath}`);
      }

      // Read video file for direct analysis
      const videoBuffer = fs.readFileSync(videoPath);
      console.log(`📁 BrollGenerator: Video file loaded successfully (${videoBuffer.length} bytes)`);

      const prompt = this.createBrollAnalysisPrompt();
      
      console.log(`📝 BrollGenerator: Analyzing video with Gemini multimodal...`);
      
      const response = await ai.models.generateContent({
        model: "gemini-2.0-flash-exp",
        contents: [
          {
            inlineData: {
              data: videoBuffer.toString('base64'),
              mimeType: 'video/mp4'
            }
          },
          prompt
        ],
        config: {
          responseMimeType: "application/json",
          responseSchema: {
            type: "object",
            properties: {
              videoAnalysis: {
                type: "object",
                properties: {
                  transcript: { type: "string" },
                  keyThemes: { 
                    type: "array",
                    items: { type: "string" }
                  },
                  talkingHeadSegments: {
                    type: "array", 
                    items: { type: "string" }
                  },
                  abstractConcepts: {
                    type: "array",
                    items: { type: "string" }
                  }
                }
              },
              suggestions: {
                type: "array",
                items: {
                  type: "object",
                  properties: {
                    concept: { type: "string" },
                    startTime: { type: "string" },
                    endTime: { type: "string" },
                    justification: { type: "string" },
                    videoGenerationPrompt: { type: "string" }
                  },
                  required: ["concept", "startTime", "endTime", "justification", "videoGenerationPrompt"]
                },
                minItems: 3,
                maxItems: 3
              }
            },
            required: ["videoAnalysis", "suggestions"]
          }
        }
      });

      if (!response.text) {
        throw new Error("Empty response from Gemini");
      }

      console.log(`📋 BrollGenerator: Raw response length: ${response.text.length} characters`);
      
      let brollPlan: BrollPlan;
      try {
        brollPlan = JSON.parse(response.text);
      } catch (error) {
        console.error(`❌ BrollGenerator: JSON parsing failed, attempting extraction...`);
        brollPlan = this.extractBrollPlanFromResponse(response.text);
      }

      console.log(`✅ BrollGenerator: Generated ${brollPlan.suggestions.length} B-roll suggestions`);
      
      return brollPlan;

    } catch (error) {
      console.error(`❌ BrollGenerator: Error generating B-roll plan:`, error);
      throw new Error(`Failed to generate B-roll plan: ${error}`);
    }
  }

  private createBrollAnalysisPrompt(): string {
    return `You are a highly skilled AI Creative Director and Visual Storyteller. Your expertise lies in analyzing a primary video narrative (A-roll) and identifying key moments that can be powerfully enhanced with supplementary footage (B-roll).

Your Task:
Analyze the provided video file and its narrative. Based on your analysis, identify exactly THREE distinct opportunities to insert B-roll. For each opportunity, you will describe the conceptual B-roll, specify exact time segments, and write detailed prompts for AI video generation.

Your Core Process:

Step 1: Deep Narrative and Visual Analysis
- Transcribe the audio and generate a full transcript
- Extract core themes, concepts, and keywords from the transcript
- Analyze pacing and identify:
  * "Talking Head" segments (long periods of speaking to camera)
  * Pauses in speech (natural gaps for visual fills)
  * Abstract concepts (things not visually present)

Step 2: Conceptualize B-Roll Opportunities
- Think like a filmmaker - use visual metaphors, establishing shots, or detailed close-ups
- For "complexity" → neural networks or intricate machines
- For "growth" → time-lapse of plants growing
- For "data" → abstract flowing digital streams
- Focus on NEWLY GENERATED visuals, not existing video clips

Step 3: Create Enhancement Plan
For each of your three concepts:
- Write clear concept description (one sentence)
- Pinpoint exact insertion points with timestamps
- Justify timing choices narratively and visually
- Craft detailed generation prompts with style, lighting, camera angles, and mood

CRITICAL REQUIREMENTS:
- Provide exactly 3 B-roll suggestions
- Use MM:SS format for timestamps (e.g., "01:23", "02:45")
- Each video generation prompt should be detailed and cinematic
- Focus on professional, broadcast-quality visual concepts
- Ensure B-roll enhances storytelling without distracting

Return your analysis in the exact JSON structure requested.`;
  }

  private extractBrollPlanFromResponse(responseText: string): BrollPlan {
    console.log(`🔧 BrollGenerator: Attempting manual extraction from malformed response`);
    
    // Try to extract JSON from markdown or text response
    const jsonMatch = responseText.match(/\{[\s\S]*\}/);
    if (jsonMatch) {
      try {
        return JSON.parse(jsonMatch[0]);
      } catch (error) {
        console.error(`❌ BrollGenerator: Manual extraction failed`);
      }
    }

    // Fallback: Create basic structure
    return {
      videoAnalysis: {
        transcript: "Unable to extract transcript from response",
        keyThemes: ["general", "content"],
        talkingHeadSegments: ["00:00-00:30"],
        abstractConcepts: ["concepts", "ideas"]
      },
      suggestions: [
        {
          concept: "Dynamic visual metaphor",
          startTime: "00:10",
          endTime: "00:15",
          justification: "Enhances narrative flow during talking head segment",
          videoGenerationPrompt: "Cinematic establishing shot, professional lighting, 4K quality, smooth camera movement"
        },
        {
          concept: "Abstract conceptual visualization",
          startTime: "00:30",
          endTime: "00:35", 
          justification: "Illustrates abstract concepts mentioned in dialogue",
          videoGenerationPrompt: "Abstract visual metaphor, flowing elements, professional cinematography, dynamic composition"
        },
        {
          concept: "Emotional resonance shot",
          startTime: "01:00",
          endTime: "01:05",
          justification: "Provides emotional context and visual interest",
          videoGenerationPrompt: "Emotional establishing shot, warm lighting, cinematic composition, high production value"
        }
      ]
    };
  }

  // Convert time string (MM:SS) to seconds
  private timeToSeconds(timeStr: string): number {
    const parts = timeStr.split(':');
    if (parts.length === 2) {
      return parseInt(parts[0]) * 60 + parseInt(parts[1]);
    }
    return 0;
  }

  // Convert seconds to MM:SS format
  private secondsToTime(seconds: number): string {
    const mins = Math.floor(seconds / 60);
    const secs = Math.floor(seconds % 60);
    return `${mins.toString().padStart(2, '0')}:${secs.toString().padStart(2, '0')}`;
  }
}

export const brollGenerator = new BrollGenerator();