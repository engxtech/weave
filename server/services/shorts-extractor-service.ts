import { GoogleGenAI } from '@google/genai';
import { promises as fs, mkdirSync, existsSync } from 'fs';
import { spawn } from 'child_process';
import path from 'path';

interface ViralMoment {
  startTime: number;
  endTime: number;
  score: number;
  reasoning: string;
  searchPhrase?: string;
  engagement_factors: string[];
  category?: 'inspiring' | 'viral' | 'funny';
  categoryConfidence?: number;
}

interface ShortsExtractionResult {
  moments: ViralMoment[];
  categorizedMoments: {
    inspiring: ViralMoment[];
    viral: ViralMoment[];
    funny: ViralMoment[];
  };
  totalClips: number;
  processingTime: number;
  confidence: number;
}

export class ShortsExtractorService {
  private genai: GoogleGenAI;

  constructor(apiKey: string) {
    this.genai = new GoogleGenAI({ apiKey });
  }

  async extractViralMoments(videoPath: string, searchPhrases: string[] = [], extractionDescription: string = '', duration: number = 30, aiModel?: string): Promise<ShortsExtractionResult> {
    const startTime = Date.now();
    
    try {
      console.log('=== SHORTS EXTRACTOR START ===');
      console.log('Video path:', videoPath);
      console.log('Search phrases:', searchPhrases);
      console.log('Extraction description:', extractionDescription);

      // Convert URL path to file system path if needed
      let actualVideoPath = videoPath;
      if (videoPath.startsWith('/api/upload/video/')) {
        const filename = videoPath.replace('/api/upload/video/', '');
        actualVideoPath = path.join(process.cwd(), 'uploads', filename);
        console.log('Converted to file path:', actualVideoPath);
      }

      // Check if file exists
      if (!existsSync(actualVideoPath)) {
        throw new Error(`Video file not found: ${actualVideoPath}`);
      }

      // Step 1: Extract video frames for analysis
      const frames = await this.extractVideoFrames(actualVideoPath, 30); // 30 frames total
      
      // Step 2: Transcribe audio for content analysis
      const transcription = await this.transcribeVideo(actualVideoPath, aiModel);
      
      // Step 3: Analyze content with Gemini for viral potential
      const viralMoments = await this.analyzeViralPotential(frames, transcription, searchPhrases, extractionDescription, duration, aiModel);
      
      // Step 4: Score and rank moments
      const rankedMoments = await this.rankMomentsByViralScore(viralMoments);
      
      // Step 5: Categorize moments for parallel processing
      const categorizedMoments = await this.categorizeMoments(rankedMoments);
      
      const processingTime = Date.now() - startTime;
      
      console.log('=== SHORTS EXTRACTOR COMPLETE ===');
      console.log(`Found ${rankedMoments.length} viral moments in ${processingTime}ms`);
      console.log(`Categorized: ${categorizedMoments.inspiring.length} inspiring, ${categorizedMoments.viral.length} viral, ${categorizedMoments.funny.length} funny`);

      return {
        moments: rankedMoments,
        categorizedMoments,
        totalClips: rankedMoments.length,
        processingTime,
        confidence: this.calculateOverallConfidence(rankedMoments)
      };

    } catch (error) {
      console.error('Shorts extraction failed:', error);
      throw new Error(`Failed to extract shorts: ${error instanceof Error ? error.message : 'Unknown error'}`);
    }
  }

  private async extractVideoFrames(videoPath: string, maxFrames: number): Promise<string[]> {
    return new Promise((resolve, reject) => {
      const outputDir = path.join('temp_frames', Date.now().toString());
      const framePattern = path.join(outputDir, 'frame_%03d.jpg');
      
      // Create output directory
      mkdirSync(outputDir, { recursive: true });
      
      const ffmpegProcess = spawn('ffmpeg', [
        '-i', videoPath,
        '-vf', `fps=1/${maxFrames}`, // Extract 1 frame every N seconds
        '-y',
        framePattern
      ]);

      let errorOutput = '';
      ffmpegProcess.stderr.on('data', (data) => {
        errorOutput += data.toString();
      });

      ffmpegProcess.on('close', async (code) => {
        if (code === 0) {
          try {
            const files = await fs.readdir(outputDir);
            const framePaths = files
              .filter(file => file.endsWith('.jpg'))
              .map(file => path.join(outputDir, file))
              .sort();
            resolve(framePaths);
          } catch (error) {
            reject(error);
          }
        } else {
          console.error('FFmpeg error output:', errorOutput);
          reject(new Error(`FFmpeg failed with code ${code}. Error: ${errorOutput}`));
        }
      });
    });
  }

  private async transcribeVideo(videoPath: string, aiModel?: string): Promise<string> {
    try {
      // Extract audio first
      const audioPath = `temp_audio_${Date.now()}.wav`;
      
      await new Promise((resolve, reject) => {
        const ffmpegProcess = spawn('ffmpeg', [
          '-i', videoPath,
          '-vn',
          '-acodec', 'pcm_s16le',
          '-ar', '16000',
          '-ac', '1',
          '-y',
          audioPath
        ]);

        let errorOutput = '';
        ffmpegProcess.stderr.on('data', (data) => {
          errorOutput += data.toString();
        });

        ffmpegProcess.on('close', (code) => {
          if (code === 0) resolve(null);
          else {
            console.error('FFmpeg audio extraction error:', errorOutput);
            reject(new Error(`Audio extraction failed with code ${code}. Error: ${errorOutput}`));
          }
        });
      });

      // Read audio file and transcribe with Gemini
      const audioBuffer = await fs.readFile(audioPath);
      const audioBase64 = audioBuffer.toString('base64');

      const response = await this.genai.models.generateContent({
        model: aiModel || 'gemini-2.0-flash-exp',
        contents: [
          {
            inlineData: {
              data: audioBase64,
              mimeType: 'audio/wav'
            }
          },
          'Transcribe this audio content with precise timestamps. Focus on identifying engaging moments, emotional peaks, and quotable phrases that would work well in short-form content.'
        ]
      });

      // Cleanup temp file
      await fs.unlink(audioPath).catch(() => {});

      return response.text || '';

    } catch (error) {
      console.error('Video transcription failed:', error);
      return '';
    }
  }

  private async analyzeViralPotential(framePaths: string[], transcription: string, searchPhrases: string[], extractionDescription: string = '', duration: number = 30, aiModel?: string): Promise<ViralMoment[]> {
    try {
      // Process frames in batches for Gemini analysis
      const frameData = await Promise.all(
        framePaths.slice(0, 10).map(async (framePath, index) => {
          const imageBuffer = await fs.readFile(framePath);
          return {
            index,
            data: imageBuffer.toString('base64'),
            timestamp: index * 6 // Approximate timestamp (6 seconds apart)
          };
        })
      );

      const analysisPrompt = `
You are an elite AI Video Editor at a top content agency, specializing in viral short-form content that consistently achieves millions of views. Your expertise spans TikTok, Instagram Reels, and YouTube Shorts algorithms.

MISSION: Transform this long-form content into multiple high-performing short clips that will dominate social feeds.

ADVANCED ANALYSIS FRAMEWORK:
1. Hook Analysis (0-3 seconds):
   - Identify moments with instant visual or verbal hooks
   - Look for pattern interrupts, unexpected statements, or visual surprises
   - Find "scroll-stopping" moments that demand attention

2. Emotional Arc Mapping:
   - Track emotional peaks and valleys throughout the content
   - Identify transformation moments (before/after, problem/solution)
   - Find relatable pain points and triumph moments

3. Platform-Specific Optimization:
   - TikTok: Focus on trend potential, remix-ability, comment bait
   - Instagram Reels: Aesthetic moments, lifestyle aspirations, shareable wisdom
   - YouTube Shorts: Educational value, curiosity gaps, binge potential

4. Engagement Triggers:
   - Controversial or polarizing statements (healthy debate starters)
   - "Wait for it" moments with satisfying payoffs
   - Expert tips or life hacks that save time/money
   - Relatable struggles with unexpected solutions

TRANSCRIPTION TO ANALYZE:
${transcription}

${extractionDescription ? `USER'S SPECIFIC REQUEST: ${extractionDescription}` : ''}

SEARCH FOCUS: ${searchPhrases.length > 0 ? searchPhrases.join(', ') : 'Any high-engagement moments'}

IMPORTANT: Each clip should be approximately ${duration} seconds long. Adjust start_time and end_time accordingly.

For each viral moment, provide:
{
  "start_time": number (seconds),
  "end_time": number (seconds),
  "viral_score": 1-10 (based on shareability and engagement potential),
  "reasoning": "Specific psychological triggers and engagement factors",
  "hook": "The first 3 seconds that will stop scrolling",
  "engagement_factors": ["factor1", "factor2", "factor3"],
  "platform_optimization": {
    "tiktok": "Specific optimization for TikTok",
    "instagram": "Specific optimization for Instagram",
    "youtube": "Specific optimization for YouTube Shorts"
  }
}

Return as JSON array of moments that will maximize reach and engagement.
`;

      const response = await this.genai.models.generateContent({
        model: aiModel || 'gemini-2.0-flash-exp',
        contents: [
          ...frameData.map(frame => ({
            inlineData: {
              data: frame.data,
              mimeType: 'image/jpeg'
            }
          })),
          analysisPrompt
        ],
        config: {
          responseMimeType: 'application/json'
        }
      });

      const analysisResult = JSON.parse(response.text || '[]');
      
      return analysisResult.map((moment: any) => ({
        startTime: moment.start_time || 0,
        endTime: moment.end_time || duration,
        score: moment.viral_score || 5,
        reasoning: moment.reasoning || 'Potential viral moment detected',
        searchPhrase: searchPhrases.find(phrase => 
          moment.reasoning?.toLowerCase().includes(phrase.toLowerCase())
        ),
        engagement_factors: moment.engagement_factors || ['unknown']
      }));

    } catch (error) {
      console.error('Viral potential analysis failed:', error);
      return [];
    }
  }

  private async rankMomentsByViralScore(moments: ViralMoment[]): Promise<ViralMoment[]> {
    return moments
      .sort((a, b) => b.score - a.score)
      .slice(0, 5) // Top 5 moments
      .map((moment, index) => ({
        ...moment,
        rank: index + 1
      }));
  }

  private calculateOverallConfidence(moments: ViralMoment[]): number {
    if (moments.length === 0) return 0;
    
    const avgScore = moments.reduce((sum, moment) => sum + moment.score, 0) / moments.length;
    return Math.min(avgScore * 10, 100); // Convert to percentage
  }

  private async categorizeMoments(moments: ViralMoment[]): Promise<{
    inspiring: ViralMoment[];
    viral: ViralMoment[];
    funny: ViralMoment[];
  }> {
    const categorized = {
      inspiring: [] as ViralMoment[],
      viral: [] as ViralMoment[],
      funny: [] as ViralMoment[]
    };

    try {      
      for (const moment of moments) {
        const prompt = `
Analyze this viral moment and categorize it. The moment has these characteristics:
- Reasoning: ${moment.reasoning}
- Engagement factors: ${moment.engagement_factors.join(', ')}
- Viral score: ${moment.score}/10

Categorize this moment as one of:
1. "inspiring" - motivational, uplifting, achievement-focused, success stories
2. "viral" - trending, shareable, general viral appeal, shocking or surprising
3. "funny" - humorous, comedic, entertaining, meme-worthy

Also provide a confidence score (0-1) for your categorization.

Return JSON: { "category": "inspiring|viral|funny", "confidence": 0.0-1.0 }
`;

        const response = await this.genai.models.generateContent({
          model: 'gemini-2.0-flash-exp',
          contents: prompt,
          config: {
            responseMimeType: 'application/json'
          }
        });
        
        const result = JSON.parse(response.text || '{}');
        
        const categorizedMoment = {
          ...moment,
          category: result.category || 'viral',
          categoryConfidence: result.confidence || 0.7
        };

        const targetCategory = (result.category as 'inspiring' | 'viral' | 'funny') || 'viral';
        categorized[targetCategory].push(categorizedMoment);
      }
    } catch (error) {
      console.error('Categorization failed, using fallback:', error);
      // Fallback categorization based on engagement factors
      for (const moment of moments) {
        const factors = moment.engagement_factors.join(' ').toLowerCase();
        let category: 'inspiring' | 'viral' | 'funny' = 'viral';
        
        if (factors.includes('motivat') || factors.includes('inspir') || factors.includes('success')) {
          category = 'inspiring';
        } else if (factors.includes('funny') || factors.includes('humor') || factors.includes('laugh')) {
          category = 'funny';
        }
        
        categorized[category].push({
          ...moment,
          category,
          categoryConfidence: 0.5
        });
      }
    }

    return categorized;
  }

  async generateShortClips(videoPath: string, moments: ViralMoment[], duration: number = 30): Promise<string[]> {
    const outputPaths: string[] = [];
    const outputDir = path.join(process.cwd(), 'uploads', 'shorts');
    
    // Convert URL path to file system path if needed
    let actualVideoPath = videoPath;
    if (videoPath.startsWith('/api/upload/video/')) {
      const filename = videoPath.replace('/api/upload/video/', '');
      actualVideoPath = path.join(process.cwd(), 'uploads', filename);
      console.log('generateShortClips - Converted to file path:', actualVideoPath);
    }
    
    // Create output directory if it doesn't exist
    await fs.mkdir(outputDir, { recursive: true });

    for (let i = 0; i < moments.length; i++) {
      const moment = moments[i];
      const outputFilename = `shorts_clip_${i + 1}_${Date.now()}.mp4`;
      const outputPath = path.join(outputDir, outputFilename);

      try {
        await new Promise((resolve, reject) => {
          const ffmpegProcess = spawn('ffmpeg', [
            '-i', actualVideoPath,
            '-ss', moment.startTime.toString(),
            '-t', duration.toString(),
            '-c:v', 'libx264',
            '-c:a', 'aac',
            '-preset', 'fast',
            '-y',
            outputPath
          ]);

          let stderr = '';
          ffmpegProcess.stderr.on('data', (data) => {
            stderr += data.toString();
          });

          ffmpegProcess.on('close', (code) => {
            if (code === 0) {
              outputPaths.push(outputPath);
              resolve(null);
            } else {
              console.error('FFmpeg stderr:', stderr);
              reject(new Error(`Clip generation failed with code ${code}`));
            }
          });
        });

        console.log(`Generated clip ${i + 1}: ${outputPath}`);
      } catch (error) {
        console.error(`Failed to generate clip ${i + 1}:`, error);
      }
    }

    return outputPaths;
  }
}