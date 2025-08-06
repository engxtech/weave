import { GoogleGenerativeAI } from '@google/generative-ai';
import { WaveformAnalyzer, type AlignedCaption } from './waveform-analyzer';
import * as fs from 'fs';
import * as path from 'path';

export interface TranscriptSegment {
  startTime: number;
  endTime: number;
  text: string;
  confidence: number;
}

export interface VideoTranscript {
  fullText: string;
  language: string;
  segments: TranscriptSegment[];
  duration: number;
}

export class GeminiVideoTranscriber {
  private genAI: GoogleGenerativeAI;
  private waveformAnalyzer: WaveformAnalyzer;

  constructor() {
    if (!process.env.GEMINI_API_KEY) {
      throw new Error('GEMINI_API_KEY environment variable is required');
    }
    this.genAI = new GoogleGenerativeAI(process.env.GEMINI_API_KEY);
    this.waveformAnalyzer = new WaveformAnalyzer();
  }

  async transcribeVideo(videoPath: string): Promise<VideoTranscript> {
    try {
      console.log('🎤 Starting Gemini video transcription for:', videoPath);
      
      // Handle relative and absolute paths correctly
      const fullVideoPath = path.isAbsolute(videoPath) ? videoPath : 
                           videoPath.startsWith('./uploads/') ? videoPath : 
                           path.join('uploads', path.basename(videoPath));
      
      if (!fs.existsSync(fullVideoPath)) {
        throw new Error(`Video file not found: ${fullVideoPath}`);
      }

      const videoData = fs.readFileSync(fullVideoPath);
      console.log('📊 Video file loaded:', videoData.length, 'bytes');

      const model = this.genAI.getGenerativeModel({ 
        model: 'gemini-1.5-flash',
        generationConfig: {
          temperature: 0.1,
          maxOutputTokens: 1024,
          responseMimeType: 'application/json',
        }
      });

      const prompt = `Generate accurate video captions with precise timing.

Analyze the video audio and create time-synchronized captions that match the actual speech.

REQUIREMENTS:
- Listen to spoken words and match timing exactly
- Create 3-8 word segments based on natural speech pauses
- Use real speech rhythm (fast/slow speakers get different timing)
- Detect when words are actually spoken, not estimated

Return ONLY this JSON format:
{
  "language": "auto",
  "duration": video_length_in_seconds,
  "fullText": "complete transcript text",
  "segments": [
    {"startTime": 0.0, "endTime": 2.1, "text": "hello everyone", "confidence": 0.95},
    {"startTime": 2.1, "endTime": 4.3, "text": "welcome to this video", "confidence": 0.93}
  ]
}

Focus on accuracy over quantity. Maximum 30 segments to ensure quality.`;

      console.log('🔄 Sending video to Gemini for transcription...');
      
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
      
      console.log('=== GEMINI TRANSCRIPTION RESPONSE ===');
      console.log('📁 Video:', videoPath);
      console.log('📊 Size:', videoData.length, 'bytes');
      console.log('🤖 Response length:', responseText.length, 'chars');
      console.log('📝 Full response:');
      console.log(responseText);
      console.log('=== END RESPONSE ===');

      // Enhanced JSON parsing with multiple extraction strategies
      let jsonData;
      
      // Strategy 1: Direct parsing after cleanup
      let cleanResponse = responseText.trim()
        .replace(/```json\s*/g, '')
        .replace(/```\s*/g, '')
        .replace(/^[^{]*/, '') // Remove any text before first {
        .replace(/[^}]*$/, '') // Remove any text after last }
        .trim();

      try {
        jsonData = JSON.parse(cleanResponse);
      } catch (parseError) {
        console.log('⚠️ Direct parsing failed, trying extraction...');
        
        // Strategy 2: Extract JSON object from anywhere in response
        const jsonMatches = responseText.match(/\{[\s\S]*?\}/g);
        if (jsonMatches && jsonMatches.length > 0) {
          // Try each JSON-like match
          for (const match of jsonMatches) {
            try {
              const testData = JSON.parse(match);
              if (testData.segments || testData.fullText) {
                jsonData = testData;
                break;
              }
            } catch (e) {
              continue;
            }
          }
        }
        
        // Strategy 3: Extract complete JSON with proper bracket matching
        if (!jsonData) {
          const startIndex = responseText.indexOf('{');
          if (startIndex !== -1) {
            let bracketCount = 0;
            let endIndex = startIndex;
            
            for (let i = startIndex; i < responseText.length; i++) {
              if (responseText[i] === '{') bracketCount++;
              if (responseText[i] === '}') bracketCount--;
              if (bracketCount === 0) {
                endIndex = i;
                break;
              }
            }
            
            try {
              const extractedJson = responseText.substring(startIndex, endIndex + 1);
              jsonData = JSON.parse(extractedJson);
            } catch (e) {
              console.error('❌ All JSON parsing strategies failed:', e);
              throw new Error(`Failed to parse JSON from Gemini response: ${(parseError as Error).message}`);
            }
          }
        }
        
        // Strategy 4: Enhanced JSON fixing with comprehensive repair
        if (!jsonData) {
          console.log('🔧 Attempting enhanced JSON repair...');
          try {
            let cleanedJson = responseText;
            
            // Remove any markdown formatting
            cleanedJson = cleanedJson.replace(/```json\s*/g, '').replace(/```\s*/g, '');
            cleanedJson = cleanedJson.replace(/^```/gm, '').replace(/```$/gm, '');
            
            // Enhanced JSON cleaning
            cleanedJson = cleanedJson.replace(/,\s*}/g, '}'); // Remove trailing commas before }
            cleanedJson = cleanedJson.replace(/,\s*]/g, ']'); // Remove trailing commas before ]
            cleanedJson = cleanedJson.replace(/}\s*{/g, '},{'); // Fix missing commas between objects
            cleanedJson = cleanedJson.replace(/]\s*\[/g, '],['); // Fix missing commas between arrays
            
            // Fix incomplete JSON by finding valid segments array
            const segmentsMatch = cleanedJson.match(/"segments":\s*\[(.*)/s);
            if (segmentsMatch) {
              const segmentsStart = segmentsMatch.index! + segmentsMatch[0].indexOf('[');
              const segmentsSubstring = cleanedJson.substring(segmentsStart);
              
              // Parse segments one by one until we hit invalid JSON
              const segments = [];
              let bracketCount = 0;
              let currentSegment = '';
              let inString = false;
              let escapeNext = false;
              let segmentStart = -1;
              
              for (let i = 0; i < segmentsSubstring.length; i++) {
                const char = segmentsSubstring[i];
                
                if (escapeNext) {
                  escapeNext = false;
                  continue;
                }
                
                if (char === '\\') {
                  escapeNext = true;
                  continue;
                }
                
                if (char === '"' && !escapeNext) {
                  inString = !inString;
                }
                
                if (!inString) {
                  if (char === '[') {
                    if (bracketCount === 0) {
                      segmentStart = i + 1;
                    }
                    bracketCount++;
                  } else if (char === '{') {
                    if (segmentStart >= 0 && bracketCount === 1) {
                      currentSegment = char;
                    } else if (currentSegment) {
                      currentSegment += char;
                    }
                  } else if (char === '}') {
                    if (currentSegment) {
                      currentSegment += char;
                      // Try to parse this segment
                      try {
                        const segmentObj = JSON.parse(currentSegment);
                        if (segmentObj.startTime !== undefined && segmentObj.endTime !== undefined && segmentObj.text) {
                          segments.push(segmentObj);
                        }
                      } catch (e) {
                        // Skip invalid segment
                      }
                      currentSegment = '';
                    }
                  } else if (char === ']') {
                    bracketCount--;
                    if (bracketCount === 0) break;
                  } else if (currentSegment && char !== ',' && char !== ' ' && char !== '\n') {
                    currentSegment += char;
                  }
                }
                
                if (inString && currentSegment) {
                  currentSegment += char;
                }
              }
              
              if (segments.length > 0) {
                // Create a valid JSON structure
                jsonData = {
                  language: "auto",
                  duration: Math.max(...segments.map(s => s.endTime || 0)),
                  fullText: segments.map(s => s.text).join(' '),
                  segments: segments
                };
                console.log(`✅ Enhanced JSON repair successful, extracted ${segments.length} segments`);
              }
            }
            
            // Fallback: Try regex-based segment extraction
            if (!jsonData) {
              console.log('🔧 Trying regex-based segment extraction...');
              const segmentRegex = /\{\s*"startTime":\s*([0-9.]+),\s*"endTime":\s*([0-9.]+),\s*"text":\s*"([^"]*)"(?:,\s*"confidence":\s*([0-9.]+))?\s*\}/g;
              const segments = [];
              let match;
              
              while ((match = segmentRegex.exec(responseText)) !== null) {
                segments.push({
                  startTime: parseFloat(match[1]),
                  endTime: parseFloat(match[2]),
                  text: match[3],
                  confidence: match[4] ? parseFloat(match[4]) : 0.9
                });
              }
              
              if (segments.length > 0) {
                jsonData = {
                  language: "auto",
                  duration: Math.max(...segments.map(s => s.endTime)),
                  fullText: segments.map(s => s.text).join(' '),
                  segments: segments
                };
                console.log(`✅ Regex extraction successful, found ${segments.length} segments`);
              }
            }
          } catch (e) {
            console.error('❌ Enhanced JSON repair failed:', e);
          }
        }

        // Strategy 5: Create minimal fallback if all else fails
        if (!jsonData) {
          console.log('🔧 Creating minimal fallback transcription...');
          jsonData = {
            language: "auto", 
            duration: 10,
            fullText: "Audio transcription failed - please try again",
            segments: [
              {
                startTime: 0,
                endTime: 10,
                text: "Transcription failed - please retry",
                confidence: 0.1
              }
            ]
          };
        }

        if (!jsonData) {
          throw new Error(`Failed to extract valid JSON from Gemini response: ${(parseError as Error).message}`);
        }
      }

      if (!jsonData.segments || jsonData.segments.length === 0) {
        throw new Error('No transcript segments found in Gemini response');
      }

      console.log('✅ Successfully transcribed:', jsonData.segments.length, 'segments');
      console.log('📝 Sample text:', jsonData.fullText?.substring(0, 100) + '...');

      return {
        fullText: jsonData.fullText || '',
        language: jsonData.language || 'auto',
        segments: jsonData.segments || [],
        duration: jsonData.duration || 0
      };

    } catch (error) {
      console.error('❌ Gemini video transcription failed:', error);
      throw error;
    }
  }

  /**
   * Enhanced transcription with waveform alignment
   */
  async transcribeVideoWithWaveform(videoPath: string): Promise<VideoTranscript & { alignedCaptions: AlignedCaption[] }> {
    console.log('🌊 Starting enhanced transcription with waveform alignment...');
    
    try {
      // Run both processes in parallel for efficiency
      const [basicTranscript, waveformData] = await Promise.all([
        this.transcribeVideo(videoPath),
        this.waveformAnalyzer.extractWaveform(videoPath)
      ]);

      console.log('🎯 Aligning transcript segments with waveform data...');
      
      // Align the basic transcript with waveform data
      const alignedCaptions = this.waveformAnalyzer.alignCaptionsWithWaveform(
        basicTranscript.segments.map(seg => ({
          startTime: seg.startTime,
          endTime: seg.endTime,
          text: seg.text
        })),
        waveformData
      );

      console.log(`✅ Enhanced transcription complete with ${alignedCaptions.length} waveform-aligned segments`);

      return {
        ...basicTranscript,
        alignedCaptions
      };
      
    } catch (error) {
      console.error('❌ Enhanced transcription failed:', error);
      throw new Error(`Failed to create waveform-aligned transcription: ${error instanceof Error ? error.message : 'Unknown error'}`);
    }
  }

  /**
   * Get waveform visualization data for a video
   */
  async generateWaveformVisualization(videoPath: string, width: number = 800) {
    try {
      const waveformData = await this.waveformAnalyzer.extractWaveform(videoPath);
      return this.waveformAnalyzer.generateWaveformVisualization(waveformData, width);
    } catch (error) {
      console.error('❌ Waveform visualization failed:', error);
      throw new Error(`Failed to generate waveform visualization: ${error instanceof Error ? error.message : 'Unknown error'}`);
    }
  }
}