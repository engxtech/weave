import OpenAI from "openai/index.mjs";
import axios from "axios";
import * as fs from "fs";
import path from 'path';
import { nanoid } from 'nanoid';
import { createClient } from "@deepgram/sdk";

const deepgram = createClient(process.env["DEEPGRAM_API_KEY"] || "");

const openai = new OpenAI({
  apiKey: process.env['OPENAI_API_KEY'],
});

interface ElevenLabsVoice {
  voice_id: string;
  name: string;
  category: string;
  description?: string;
}

interface AIShortRequest {
  script?: string;
  duration: number;
  voiceName: string;
  backgroundMusic?: string;
  style: 'viral' | 'educational' | 'story' | 'entertainment';
  prompt?: string;
  showSubtitles?: boolean;
  subtitleStyle?: string;
  subtitlePosition?: string;
}

interface AIShortResult {
  id: string;
  videoPath: string;
  audioPath: string;
  imagesPaths: string[];
  script: string;
  metadata: {
    duration: number;
    voiceName: string;
    style: string;
    createdAt: string;
  };
}

export class AIShortGenerator {
  private elevenApiKey: string;

  constructor(elevenApiKey: string) {
    this.elevenApiKey = elevenApiKey;
  }

  // Get all available ElevenLabs voices
  async getAvailableVoices(): Promise<ElevenLabsVoice[]> {
    try {
      const response = await fetch("https://api.elevenlabs.io/v1/voices", {
        method: "GET",
        headers: {
          "xi-api-key": this.elevenApiKey,
        },
      });

      if (!response.ok) {
        throw new Error(`HTTP error! status: ${response.status}`);
      }

      const data: any = await response.json();
      return data.voices.map((voice: any) => ({
        voice_id: voice.voice_id,
        name: voice.name,
        category: voice.category || 'General',
        description: voice.description
      }));
    } catch (error) {
      console.error('Failed to fetch ElevenLabs voices:', error);
      throw new Error('Failed to fetch available voices');
    }
  }

  // Get voice ID by name (based on Revideo example)
  async getVoiceByName(name: string): Promise<string | null> {
    const response = await fetch("https://api.elevenlabs.io/v1/voices", {
      method: "GET",
      headers: {
        "xi-api-key": this.elevenApiKey,
      },
    });

    if (!response.ok) {
      throw new Error(`HTTP error! status: ${response.status}`);
    }

    const data: any = await response.json();
    const voice = data.voices.find((voice: { name: string; voice_id: string }) => voice.name === name);
    return voice ? voice.voice_id : null;
  }

  // Generate script using OpenAI (based on user's default prompt)
  async getVideoScript(videoTopic: string): Promise<string> {
    const prompt = `Create a script for a youtube short. The script should be around 10 to 15 words long and be an interesting text about the provided topic, and it should start with a catchy headline, something like "Did you know that?" or "This will blow your mind". Remember that this is for a voiceover that should be read, so things like hashtags should not be included. Now write the script for the following topic: "${videoTopic}". Now return the script and nothing else, also no meta-information - ONLY THE VOICEOVER.`;

    const chatCompletion = await openai.chat.completions.create({
      messages: [{ role: 'user', content: prompt }],
      model: 'gpt-4o-mini',
    });

    const result = chatCompletion.choices[0].message.content;

    if (result) {
      return result;
    } else {
      throw new Error("returned text is null");
    }
  }

  // Generate image prompt from script (based on user's default prompt)
  async getImagePromptFromScript(script: string): Promise<string> {
    const prompt = `My goal is to create a Youtube Short based on the following script. To create a background image for the video, I am using a text-to-video AI model. Please write a short (not longer than a single sentence), suitable prompt for such a model based on this script: ${script}.\n\nNow return the prompt and nothing else.`;

    const chatCompletion = await openai.chat.completions.create({
      messages: [{ role: 'user', content: prompt }],
      model: 'gpt-4o-mini',
      temperature: 1.0 // high temperature for "creativeness"
    });

    const result = chatCompletion.choices[0].message.content;

    if (result) {
      return result;
    } else {
      throw new Error("returned text is null");
    }
  }

  // Generate audio using ElevenLabs (based on Revideo examples)
  async generateAudio(text: string, voiceName: string, savePath: string): Promise<void> {
    const data = {
      model_id: "eleven_multilingual_v2",
      text: text,
    };

    const voiceId = await this.getVoiceByName(voiceName);
    
    if (!voiceId) {
      throw new Error(`Voice "${voiceName}" not found`);
    }

    const response = await axios.post(`https://api.elevenlabs.io/v1/text-to-speech/${voiceId}`, data, {
      headers: {
        "Content-Type": "application/json",
        "xi-api-key": this.elevenApiKey,
      },
      responseType: "arraybuffer",
    });

    fs.writeFileSync(savePath, response.data);
  }

  // Get word timestamps using Deepgram (based on Revideo examples)
  async getWordTimestamps(audioFilePath: string) {
    const { result } = await deepgram.listen.prerecorded.transcribeFile(fs.readFileSync(audioFilePath), {
      model: "nova-2",
      smart_format: true,
    });

    if (result) {
      return result.results.channels[0].alternatives[0].words;
    } else {
      throw new Error("transcription result is null");
    }
  }

  // Generate multiple images using DALL-E (standard quality)
  async dalleGenerate(prompt: string, savePath: string, count: number = 3): Promise<string[]> {
    const imagePaths: string[] = [];
    
    // Generate multiple images in parallel for better performance
    const imagePromises = Array.from({ length: count }, async (_, index) => {
      const response = await openai.images.generate({
        model: "dall-e-3",
        prompt: prompt,
        size: "1024x1792", // 9:16 aspect ratio for portrait mode
        quality: "standard",
        n: 1,
      });

      if (!response.data || !response.data[0]) {
        throw new Error("No image generated");
      }

      const url = response.data[0].url;
      const responseImage = await axios.get(url || "", {
        responseType: "arraybuffer",
      });

      const buffer = Buffer.from(responseImage.data, "binary");
      const imageFileName = savePath.replace('.png', `_${index + 1}.png`);

      try {
        await fs.promises.writeFile(imageFileName, buffer);
        return imageFileName;
      } catch (error) {
        console.error("Error saving the file:", error);
        throw error;
      }
    });

    const results = await Promise.all(imagePromises);
    return results;
  }

  // Main generation function (following Revideo example workflow)
  async generateAIShort(request: AIShortRequest): Promise<AIShortResult> {
    console.log('=== AI SHORTS GENERATION START ===');
    console.log('Request:', request);

    try {
      // Step 1: Generate or use provided script
      let script = request.script;
      if (!script && request.prompt) {
        console.log('Generating script from prompt...');
        script = await this.getVideoScript(request.prompt);
      }
      
      if (!script) {
        throw new Error('No script provided or generated');
      }

      console.log('Generated script:', script);

      // Step 2: Generate image prompt and create multiple background images
      console.log('Generating multiple background images...');
      const imagePrompt = await this.getImagePromptFromScript(script);
      const backgroundImagePath = path.join('uploads', `ai_short_background_${nanoid()}.png`);
      const backgroundImages = await this.dalleGenerate(imagePrompt, backgroundImagePath, 3);
      console.log('Generated background images:', backgroundImages);

      // Step 3: Generate TTS audio
      console.log('Generating TTS audio...');
      const audioPath = path.join('uploads', `ai_short_audio_${nanoid()}.mp3`);
      await this.generateAudio(script, request.voiceName, audioPath);
      console.log('Generated audio path:', audioPath);

      // Step 4: Get word timestamps from Deepgram
      console.log('Getting word timestamps...');
      const wordTimestamps = await this.getWordTimestamps(audioPath);
      console.log('Generated word timestamps:', wordTimestamps?.length || 0, 'words');

      // Step 5: Create video using Revideo YouTube Shorts generator
      console.log('Creating video composition with Revideo...');
      const videoPath = path.join('uploads', `ai_short_video_${nanoid()}.mp4`);
      
      try {
        const { createRevideoYouTubeShortsGenerator } = await import('./revideo-youtube-shorts');
        const revideoGenerator = createRevideoYouTubeShortsGenerator();
        
        // Generate the YouTube Shorts scene using exact Revideo reference pattern
        const scenePath = await revideoGenerator.generateYouTubeShortsVideo(
          script,
          audioPath,
          backgroundImages[0], // Use first image for video generation
          wordTimestamps,
          videoPath
        );
        
        console.log('YouTube Shorts scene created following Revideo reference:', scenePath);
        
        // Create video with script-based timing - random durations with constraints
        const audioDuration = request.duration;
        const imageCount = backgroundImages.length;
        const minDuration = 2; // At least 2 seconds per image
        const maxDuration = Math.floor((audioDuration / imageCount) * 1.25); // At most duration/images * 1.25
        
        // Generate random durations for each image within constraints
        const segmentDurations: number[] = [];
        let totalUsed = 0;
        
        for (let i = 0; i < imageCount; i++) {
          const remainingTime = audioDuration - totalUsed;
          const remainingImages = imageCount - i;
          const maxAllowed = Math.min(maxDuration, remainingTime - (remainingImages - 1) * minDuration);
          
          const duration = Math.max(minDuration, Math.min(maxAllowed, 
            minDuration + Math.random() * (maxDuration - minDuration)
          ));
          
          segmentDurations.push(Math.floor(duration));
          totalUsed += Math.floor(duration);
        }
        
        // Adjust last segment to fill remaining time if needed
        const remaining = audioDuration - totalUsed;
        if (remaining > 0) {
          segmentDurations[segmentDurations.length - 1] += remaining;
        }
        
        console.log('Creating multi-image video with script-based timing...');
        console.log(`Audio duration: ${audioDuration}s, Images: ${imageCount}`);
        console.log(`Segment durations: ${segmentDurations.map((d, i) => `Image ${i+1}: ${d}s`).join(', ')}`);
        
        // Create individual video clips for each image and concatenate them
        const clipPaths: string[] = [];
        const tempDir = path.join('uploads', 'temp_clips');
        if (!fs.existsSync(tempDir)) {
          fs.mkdirSync(tempDir, { recursive: true });
        }
        
        // Create individual clips from each image with specific durations
        for (let i = 0; i < backgroundImages.length; i++) {
          const clipPath = path.join(tempDir, `clip_${i}_${nanoid()}.mp4`);
          clipPaths.push(clipPath);
          
          const clipDuration = segmentDurations[i];
          const clipCmd = `ffmpeg -loop 1 -i "${backgroundImages[i]}" -c:v libx264 -t ${clipDuration} -pix_fmt yuv420p -vf "scale=1080:1920:force_original_aspect_ratio=increase,crop=1080:1920,fps=30" -y "${clipPath}"`;
          
          await new Promise(async (resolve) => {
            const { exec } = await import('child_process');
            console.log(`Creating clip ${i + 1}/${backgroundImages.length} (${clipDuration}s): ${clipCmd}`);
            exec(clipCmd, (error: any, stdout: any, stderr: any) => {
              if (error) {
                console.error(`Clip ${i} creation error:`, error);
                console.error(`Clip ${i} stderr:`, stderr);
              } else {
                console.log(`Clip ${i + 1} created successfully (${clipDuration}s): ${clipPath}`);
              }
              resolve(null);
            });
          });
        }
        
        // Create concat list file
        const listPath = path.join(tempDir, `concat_list_${nanoid()}.txt`);
        const concatList = clipPaths.map(clipPath => `file '${path.resolve(clipPath)}'`).join('\n');
        fs.writeFileSync(listPath, concatList);
        
        // Concatenate all clips and add audio
        const ffmpegCmd = `ffmpeg -f concat -safe 0 -i "${listPath}" -i "${audioPath}" -c:v copy -c:a aac -shortest -y "${videoPath}"`;
        
        console.log('FFmpeg command for multi-image overlay:', ffmpegCmd);
        
        await new Promise(async (resolve, reject) => {
          const { exec } = await import('child_process');
          exec(ffmpegCmd, (error: any, stdout: any, stderr: any) => {
            if (error) {
              console.error('FFmpeg multi-image error:', error);
              console.error('FFmpeg stderr:', stderr);
              resolve(null);
            } else {
              console.log(`Multi-image video created successfully with ${backgroundImages.length} images displayed sequentially`);
              resolve(stdout);
            }
          });
        });
        
      } catch (error) {
        console.error('Revideo scene generation failed:', error);
        // Create a basic placeholder
        fs.writeFileSync(videoPath, '');
      }

      // Step 6: Add subtitles if requested
      if (request.showSubtitles && wordTimestamps && wordTimestamps.length > 0) {
        console.log('Adding subtitles to video...');
        
        try {
          const { DeepgramSubtitleGenerator } = await import('./deepgram-subtitle-generator');
          const subtitleGenerator = new DeepgramSubtitleGenerator();
          
          // Create subtitle segments from word timestamps  
          const subtitleSegments = wordTimestamps.map((word, index) => ({
            start: word.start,
            end: word.end,
            text: word.punctuated_word || word.word,
            words: [{
              word: word.punctuated_word || word.word,
              start: word.start,
              end: word.end,
              confidence: word.confidence || 1.0
            }]
          }));
          
          // Generate style settings based on selected style
          const styleSettings = subtitleGenerator.getStyleSettings(
            request.subtitleStyle || 'youtube_gaming',
            request.subtitlePosition || 'bottom'
          );
          
          // Create subtitled video
          const subtitledVideoPath = await subtitleGenerator.generateSubtitleVideo(
            videoPath,
            subtitleSegments,
            styleSettings
          );
          
          // Replace original video with subtitled version
          if (fs.existsSync(subtitledVideoPath)) {
            if (fs.existsSync(videoPath)) {
              fs.unlinkSync(videoPath);
            }
            fs.renameSync(subtitledVideoPath, videoPath);
            console.log('Subtitles added successfully to video');
          }
          
        } catch (subtitleError) {
          console.error('Failed to add subtitles:', subtitleError);
          // Continue without subtitles rather than failing completely
        }
      }

      const result: AIShortResult = {
        id: nanoid(),
        videoPath,
        audioPath,
        imagesPaths: backgroundImages,
        script,
        metadata: {
          duration: request.duration,
          voiceName: request.voiceName,
          style: request.style,
          createdAt: new Date().toISOString(),
        },
      };

      console.log('=== AI SHORTS GENERATION COMPLETE ===');
      return result;

    } catch (error) {
      console.error('AI Shorts generation failed:', error);
      throw error;
    }
  }
}

export function createAIShortGenerator(elevenApiKey: string): AIShortGenerator {
  return new AIShortGenerator(elevenApiKey);
}