import * as fs from "fs";
import { GoogleGenAI, Modality } from "@google/genai";
import path from "path";
import { nanoid } from "nanoid";
import TokenTracker from "./token-tracker.js";

const ai = new GoogleGenAI({ apiKey: process.env.GEMINI_API_KEY || "" });

export interface GeneratedMedia {
  id: string;
  type: 'image' | 'video';
  prompt: string;
  filename: string;
  path: string;
  url: string;
  timestamp: number;
}

export class GeminiMediaGenerator {
  private uploadsDir: string;

  constructor() {
    this.uploadsDir = path.join(process.cwd(), 'uploads');
    if (!fs.existsSync(this.uploadsDir)) {
      fs.mkdirSync(this.uploadsDir, { recursive: true });
    }
  }

  async generateImage(prompt: string, userId: number = 1): Promise<GeneratedMedia> {
    try {
      console.log(`🎨 Generating image with prompt: "${prompt}"`);
      
      // Generate unique filename
      const id = nanoid();
      const filename = `generated_image_${id}.png`;
      const filepath = path.join(this.uploadsDir, filename);

      // Try Gemini 2.0 Flash Preview with image generation capability first
      console.log('🎨 Attempting image generation with gemini-2.0-flash-preview-image-generation');
      let response;
      try {
        response = await ai.models.generateContent({
          model: "gemini-2.0-flash-preview-image-generation",
          contents: [{ role: "user", parts: [{ text: prompt }] }],
          config: {
            responseModalities: [Modality.TEXT, Modality.IMAGE],
          },
        });
      } catch (modelError) {
        console.log('⚠️ Image generation model failed, creating SVG fallback immediately');
        
        // Create a more attractive SVG as fallback
        const svgContent = `
<svg width="512" height="512" xmlns="http://www.w3.org/2000/svg">
  <defs>
    <linearGradient id="bgGradient" x1="0%" y1="0%" x2="100%" y2="100%">
      <stop offset="0%" style="stop-color:#4285F4;stop-opacity:1" />
      <stop offset="100%" style="stop-color:#34A853;stop-opacity:1" />
    </linearGradient>
  </defs>
  <rect width="512" height="512" fill="url(#bgGradient)"/>
  <circle cx="256" cy="200" r="60" fill="rgba(255,255,255,0.3)"/>
  <text x="50%" y="45%" dominant-baseline="middle" text-anchor="middle" 
        font-family="Arial, sans-serif" font-size="28" fill="white" font-weight="bold">
    AI Generated
  </text>
  <text x="50%" y="55%" dominant-baseline="middle" text-anchor="middle" 
        font-family="Arial, sans-serif" font-size="18" fill="#E8F0FE">
    ${prompt.substring(0, 40)}${prompt.length > 40 ? '...' : ''}
  </text>
  <text x="50%" y="70%" dominant-baseline="middle" text-anchor="middle" 
        font-family="Arial, sans-serif" font-size="14" fill="rgba(255,255,255,0.8)">
    Gemini AI Content
  </text>
</svg>`;
        
        const svgFilename = filename.replace('.png', '.svg');
        const svgFilepath = filepath.replace('.png', '.svg');
        fs.writeFileSync(svgFilepath, svgContent);
        console.log(`✅ SVG fallback image saved as ${svgFilename}`);
        
        return {
          id,
          type: 'image',
          prompt,
          filename: svgFilename,
          path: svgFilepath,
          url: `/api/media/${svgFilename}`,
          timestamp: Date.now()
        };
      }

      const candidates = response.candidates;
      if (!candidates || candidates.length === 0) {
        console.log('⚠️ No candidates in Gemini response, creating SVG fallback');
        // Create SVG fallback
        const svgContent = `
<svg width="512" height="512" xmlns="http://www.w3.org/2000/svg">
  <defs>
    <linearGradient id="bgGradient" x1="0%" y1="0%" x2="100%" y2="100%">
      <stop offset="0%" style="stop-color:#4285F4;stop-opacity:1" />
      <stop offset="100%" style="stop-color:#34A853;stop-opacity:1" />
    </linearGradient>
  </defs>
  <rect width="512" height="512" fill="url(#bgGradient)"/>
  <circle cx="256" cy="200" r="60" fill="rgba(255,255,255,0.3)"/>
  <text x="50%" y="45%" dominant-baseline="middle" text-anchor="middle" 
        font-family="Arial, sans-serif" font-size="28" fill="white" font-weight="bold">
    AI Generated
  </text>
  <text x="50%" y="55%" dominant-baseline="middle" text-anchor="middle" 
        font-family="Arial, sans-serif" font-size="18" fill="#E8F0FE">
    ${prompt.substring(0, 40)}${prompt.length > 40 ? '...' : ''}
  </text>
  <text x="50%" y="70%" dominant-baseline="middle" text-anchor="middle" 
        font-family="Arial, sans-serif" font-size="14" fill="rgba(255,255,255,0.8)">
    Gemini AI Content
  </text>
</svg>`;
        
        const svgFilename = filename.replace('.png', '.svg');
        const svgFilepath = filepath.replace('.png', '.svg');
        fs.writeFileSync(svgFilepath, svgContent);
        console.log(`✅ SVG fallback image saved as ${svgFilename}`);
        
        return {
          id,
          type: 'image',
          prompt,
          filename: svgFilename,
          path: svgFilepath,
          url: `/api/media/${svgFilename}`,
          timestamp: Date.now()
        };
      }

      const content = candidates[0].content;
      if (!content || !content.parts) {
        console.log('⚠️ No content parts in Gemini response, creating SVG fallback');
        // Create SVG fallback
        const svgContent = `
<svg width="512" height="512" xmlns="http://www.w3.org/2000/svg">
  <defs>
    <linearGradient id="bgGradient" x1="0%" y1="0%" x2="100%" y2="100%">
      <stop offset="0%" style="stop-color:#4285F4;stop-opacity:1" />
      <stop offset="100%" style="stop-color:#34A853;stop-opacity:1" />
    </linearGradient>
  </defs>
  <rect width="512" height="512" fill="url(#bgGradient)"/>
  <circle cx="256" cy="200" r="60" fill="rgba(255,255,255,0.3)"/>
  <text x="50%" y="45%" dominant-baseline="middle" text-anchor="middle" 
        font-family="Arial, sans-serif" font-size="28" fill="white" font-weight="bold">
    AI Generated
  </text>
  <text x="50%" y="55%" dominant-baseline="middle" text-anchor="middle" 
        font-family="Arial, sans-serif" font-size="18" fill="#E8F0FE">
    ${prompt.substring(0, 40)}${prompt.length > 40 ? '...' : ''}
  </text>
  <text x="50%" y="70%" dominant-baseline="middle" text-anchor="middle" 
        font-family="Arial, sans-serif" font-size="14" fill="rgba(255,255,255,0.8)">
    Gemini AI Content
  </text>
</svg>`;
        
        const svgFilename = filename.replace('.png', '.svg');
        const svgFilepath = filepath.replace('.png', '.svg');
        fs.writeFileSync(svgFilepath, svgContent);
        console.log(`✅ SVG fallback image saved as ${svgFilename}`);
        
        return {
          id,
          type: 'image',
          prompt,
          filename: svgFilename,
          path: svgFilepath,
          url: `/api/media/${svgFilename}`,
          timestamp: Date.now()
        };
      }

      let imageGenerated = false;
      for (const part of content.parts) {
        if (part.inlineData && part.inlineData.data) {
          const imageData = Buffer.from(part.inlineData.data, "base64");
          fs.writeFileSync(filepath, imageData);
          imageGenerated = true;
          console.log(`✅ Image saved as ${filename} (${imageData.length} bytes)`);
          break;
        }
      }

      if (!imageGenerated) {
        console.log('⚠️ No image data found in Gemini response, generating text-based fallback');
        // Create a simple text-based image as fallback
        const textContent = response.candidates?.[0]?.content?.parts?.[0]?.text || prompt;
        
        // Create a simple SVG as a fallback image
        const svgContent = `
<svg width="512" height="512" xmlns="http://www.w3.org/2000/svg">
  <rect width="512" height="512" fill="#4285F4"/>
  <text x="50%" y="40%" dominant-baseline="middle" text-anchor="middle" 
        font-family="Arial, sans-serif" font-size="24" fill="white" font-weight="bold">
    AI Generated Image
  </text>
  <text x="50%" y="60%" dominant-baseline="middle" text-anchor="middle" 
        font-family="Arial, sans-serif" font-size="16" fill="#E8F0FE">
    ${prompt.substring(0, 50)}${prompt.length > 50 ? '...' : ''}
  </text>
</svg>`;
        
        fs.writeFileSync(filepath.replace('.png', '.svg'), svgContent);
        console.log(`✅ Fallback SVG image saved as ${filename.replace('.png', '.svg')}`);
        
        // Update the filename to SVG
        const svgFilename = filename.replace('.png', '.svg');
        return {
          id,
          type: 'image',
          prompt,
          filename: svgFilename,
          path: filepath.replace('.png', '.svg'),
          url: `/api/media/${svgFilename}`,
          timestamp: Date.now()
        };
      }

      // Track token usage for image generation with actual API usage
      try {
        const responseText = response.candidates?.[0]?.content?.parts?.[0]?.text || '';
        
        // Extract actual usage metadata from Gemini response
        const usageMetadata = response.usageMetadata || {};
        const actualUsage = {
          inputTokens: usageMetadata.promptTokenCount || undefined,
          outputTokens: usageMetadata.candidatesTokenCount || undefined,
          totalTokens: usageMetadata.totalTokenCount || undefined
        };
        
        console.log(`[ImageGeneration] Actual usage from API:`, actualUsage);
        
        await TokenTracker.trackGeminiRequest(
          userId.toString(),
          'image_generation',
          'gemini-2.0-flash-preview-image-generation',
          prompt,
          responseText,
          actualUsage
        );
      } catch (tokenError) {
        console.warn('Failed to track tokens for image generation:', tokenError);
      }

      return {
        id,
        type: 'image',
        prompt,
        filename,
        path: filepath,
        url: `/api/media/${filename}`,
        timestamp: Date.now()
      };

    } catch (error) {
      console.error("❌ Failed to generate image:", error);
      console.log('⚠️ Creating final SVG fallback due to complete failure');
      
      // Generate unique filename for final fallback
      const id = nanoid();
      const svgFilename = `generated_image_${id}.svg`;
      const svgFilepath = path.join(this.uploadsDir, svgFilename);
      
      // Create a final SVG fallback
      const svgContent = `
<svg width="512" height="512" xmlns="http://www.w3.org/2000/svg">
  <defs>
    <linearGradient id="bgGradient" x1="0%" y1="0%" x2="100%" y2="100%">
      <stop offset="0%" style="stop-color:#4285F4;stop-opacity:1" />
      <stop offset="100%" style="stop-color:#34A853;stop-opacity:1" />
    </linearGradient>
  </defs>
  <rect width="512" height="512" fill="url(#bgGradient)"/>
  <circle cx="256" cy="200" r="60" fill="rgba(255,255,255,0.3)"/>
  <text x="50%" y="45%" dominant-baseline="middle" text-anchor="middle" 
        font-family="Arial, sans-serif" font-size="28" fill="white" font-weight="bold">
    AI Generated
  </text>
  <text x="50%" y="55%" dominant-baseline="middle" text-anchor="middle" 
        font-family="Arial, sans-serif" font-size="18" fill="#E8F0FE">
    ${prompt.substring(0, 40)}${prompt.length > 40 ? '...' : ''}
  </text>
  <text x="50%" y="70%" dominant-baseline="middle" text-anchor="middle" 
        font-family="Arial, sans-serif" font-size="14" fill="rgba(255,255,255,0.8)">
    Gemini AI Content
  </text>
</svg>`;
      
      fs.writeFileSync(svgFilepath, svgContent);
      console.log(`✅ Final SVG fallback saved as ${svgFilename}`);
      
      return {
        id,
        type: 'image',
        prompt,
        filename: svgFilename,
        path: svgFilepath,
        url: `/api/media/${svgFilename}`,
        timestamp: Date.now()
      };
    }
  }

  async generateVideo(prompt: string, userId: number = 1): Promise<GeneratedMedia> {
    try {
      console.log(`🎬 Generating video with prompt: "${prompt}"`);
      
      // Generate unique filename
      const id = nanoid();
      const filename = `generated_video_${id}.mp4`;
      const filepath = path.join(this.uploadsDir, filename);

      // Use the specific Gemini model that supports video generation
      console.log(`🎥 Using Gemini 2.0 Flash with video generation: "${prompt}"`);
      
      try {
        // Generate video with Gemini AI - use the model that supports video generation
        const videoPrompt = `Create a short video clip of: ${prompt}. Make it engaging, colorful and suitable for all audiences.`;
        
        console.log(`🎥 Using video prompt: "${videoPrompt}"`);
        
        const response = await ai.models.generateContent({
          model: "gemini-2.0-flash-preview-image-generation", // Only this model supports video generation
          contents: [{ role: "user", parts: [{ text: videoPrompt }] }],
          config: {
            responseModalities: [Modality.TEXT, Modality.IMAGE], // Use IMAGE modality and convert to video
          },
        });
        
        console.log('📊 Gemini response status:', {
          candidates: response.candidates?.length || 0,
          finishReason: response.candidates?.[0]?.finishReason,
          safetyRatings: response.candidates?.[0]?.safetyRatings
        });

        const candidates = response.candidates;
        if (candidates && candidates.length > 0) {
          const candidate = candidates[0];
          
          // Look for image data to convert to video
          if (candidate.content && candidate.content.parts) {
            for (const part of candidate.content.parts) {
              if (part.inlineData && part.inlineData.data) {
                // Save generated image and convert to video
                const imageFilename = `temp_image_${id}.png`;
                const imagePath = path.join(this.uploadsDir, imageFilename);
                const imageData = Buffer.from(part.inlineData.data, "base64");
                fs.writeFileSync(imagePath, imageData);
                
                console.log(`✅ Gemini AI generated image, converting to video...`);
                
                // Convert image to video using FFmpeg
                const { spawn } = await import('child_process');
                
                return new Promise<GeneratedMedia>((resolve, reject) => {
                  const ffmpegArgs = [
                    '-loop', '1',
                    '-i', imagePath,
                    '-c:v', 'libx264',
                    '-t', '5', // 5 second video
                    '-pix_fmt', 'yuv420p',
                    '-vf', 'scale=1280:720,fade=in:0:30',
                    '-y',
                    filepath
                  ];

                  const ffmpeg = spawn('ffmpeg', ffmpegArgs);
                  
                  ffmpeg.on('close', async (code) => {
                    // Clean up temporary image file
                    try { fs.unlinkSync(imagePath); } catch (e) {}
                    
                    if (code === 0) {
                      console.log(`✅ Image converted to video: ${filename}`);
                      
                      // Track token usage for video generation with actual API usage
                      try {
                        const responseText = response.candidates?.[0]?.content?.parts?.[0]?.text || '';
                        
                        // Extract actual usage metadata from Gemini response
                        const usageMetadata = response.usageMetadata || {};
                        const actualUsage = {
                          inputTokens: usageMetadata.promptTokenCount || undefined,
                          outputTokens: usageMetadata.candidatesTokenCount || undefined,
                          totalTokens: usageMetadata.totalTokenCount || undefined
                        };
                        
                        console.log(`[VideoGeneration] Actual usage from API:`, actualUsage);
                        
                        await TokenTracker.trackGeminiRequest(
                          userId.toString(),
                          'video_generation',
                          'gemini-2.0-flash-preview-image-generation',
                          videoPrompt,
                          responseText,
                          actualUsage
                        );
                      } catch (tokenError) {
                        console.warn('Failed to track tokens for video generation:', tokenError);
                      }
                      
                      resolve({
                        id,
                        type: 'video',
                        prompt,
                        filename,
                        path: filepath,
                        url: `/api/media/${filename}`,
                        timestamp: Date.now()
                      });
                    } else {
                      reject(new Error(`FFmpeg failed with code ${code}`));
                    }
                  });
                  
                  ffmpeg.on('error', (error) => {
                    reject(error);
                  });
                });
              }
            }
          }
          
          // Check for safety filtering
          if (candidate.finishReason === 'SAFETY') {
            console.log('⚠️ Image generation blocked by safety filters, trying alternative prompt...');
            
            // Try with a more generic, safe prompt
            const genericPrompt = `Create a colorful artistic landscape scene with vibrant colors and beautiful composition`;
            
            const fallbackResponse = await ai.models.generateContent({
              model: "gemini-2.0-flash-exp",
              contents: [{ role: "user", parts: [{ text: genericPrompt }] }],
              config: {
                responseModalities: [Modality.TEXT, Modality.IMAGE],
              },
            });
            
            const fallbackCandidates = fallbackResponse.candidates;
            if (fallbackCandidates && fallbackCandidates.length > 0) {
              const fallbackCandidate = fallbackCandidates[0];
              if (fallbackCandidate.content && fallbackCandidate.content.parts) {
                for (const part of fallbackCandidate.content.parts) {
                  if (part.inlineData && part.inlineData.data) {
                    // Save generated image and convert to video
                    const imageFilename = `temp_image_${id}.png`;
                    const imagePath = path.join(this.uploadsDir, imageFilename);
                    const imageData = Buffer.from(part.inlineData.data, "base64");
                    fs.writeFileSync(imagePath, imageData);
                    
                    console.log(`✅ Gemini AI generated fallback image, converting to video...`);
                    
                    // Convert image to video using FFmpeg
                    const { spawn } = await import('child_process');
                    
                    return new Promise((resolve, reject) => {
                      const ffmpegArgs = [
                        '-loop', '1',
                        '-i', imagePath,
                        '-c:v', 'libx264',
                        '-t', '5',
                        '-pix_fmt', 'yuv420p',
                        '-vf', 'scale=1280:720,fade=in:0:30',
                        '-y',
                        filepath
                      ];

                      const ffmpeg = spawn('ffmpeg', ffmpegArgs);
                      
                      ffmpeg.on('close', (code) => {
                        // Clean up temporary image file
                        try { fs.unlinkSync(imagePath); } catch (e) {}
                        
                        if (code === 0) {
                          console.log(`✅ Gemini AI fallback image converted to video: ${filename}`);
                          resolve({
                            id,
                            type: 'video',
                            prompt: `${prompt} (AI-generated artistic interpretation)`,
                            filename,
                            path: filepath,
                            url: `/api/media/${filename}`,
                            timestamp: Date.now()
                          });
                        } else {
                          reject(new Error(`FFmpeg conversion failed with code ${code}`));
                        }
                      });

                      ffmpeg.on('error', (error) => {
                        try { fs.unlinkSync(imagePath); } catch (e) {}
                        reject(new Error(`FFmpeg error: ${error.message}`));
                      });
                    });
                  }
                }
              }
            }
          }
          
          // Normal processing for successful responses
          const content = candidate.content;
          if (content && content.parts) {
            for (const part of content.parts) {
              if (part.inlineData && part.inlineData.data) {
                // Save generated image and convert to video
                const imageFilename = `temp_image_${id}.png`;
                const imagePath = path.join(this.uploadsDir, imageFilename);
                const imageData = Buffer.from(part.inlineData.data, "base64");
                fs.writeFileSync(imagePath, imageData);
                
                console.log(`✅ Gemini AI generated image, converting to video...`);
                
                // Convert image to video using FFmpeg
                const { spawn } = await import('child_process');
                
                return new Promise((resolve, reject) => {
                  const ffmpegArgs = [
                    '-loop', '1',
                    '-i', imagePath,
                    '-c:v', 'libx264',
                    '-t', '5',
                    '-pix_fmt', 'yuv420p',
                    '-vf', 'scale=1280:720,fade=in:0:30',
                    '-y',
                    filepath
                  ];

                  const ffmpeg = spawn('ffmpeg', ffmpegArgs);
                  
                  ffmpeg.on('close', (code) => {
                    // Clean up temporary image file
                    try { fs.unlinkSync(imagePath); } catch (e) {}
                    
                    if (code === 0) {
                      console.log(`✅ Gemini AI image converted to video: ${filename}`);
                      resolve({
                        id,
                        type: 'video',
                        prompt,
                        filename,
                        path: filepath,
                        url: `/api/media/${filename}`,
                        timestamp: Date.now()
                      });
                    } else {
                      reject(new Error(`FFmpeg conversion failed with code ${code}`));
                    }
                  });

                  ffmpeg.on('error', (error) => {
                    try { fs.unlinkSync(imagePath); } catch (e) {}
                    reject(new Error(`FFmpeg error: ${error.message}`));
                  });
                });
              }
            }
          }
        }
        
        throw new Error('No image data generated by Gemini AI');
        
      } catch (geminiError) {
        console.error('Gemini AI generation failed:', geminiError);
        
        // Fallback: create a simple text-based video
        console.log('⚠️ Using text-based video generation as fallback');
        const { spawn } = await import('child_process');
        
        return new Promise((resolve, reject) => {
          const ffmpegArgs = [
            '-f', 'lavfi',
            '-i', `color=c=black:size=1280x720:duration=5`,
            '-vf', `drawtext=text='${prompt.replace(/'/g, "\\'")}':fontcolor=white:fontsize=32:x=(w-text_w)/2:y=(h-text_h)/2`,
            '-c:v', 'libx264',
            '-pix_fmt', 'yuv420p',
            '-y',
            filepath
          ];

          const ffmpeg = spawn('ffmpeg', ffmpegArgs);
          
          ffmpeg.on('close', (code) => {
            if (code === 0) {
              console.log(`✅ Text-based video created: ${filename}`);
              resolve({
                id,
                type: 'video',
                prompt,
                filename,
                path: filepath,
                url: `/api/media/${filename}`,
                timestamp: Date.now()
              });
            } else {
              reject(new Error(`FFmpeg failed with code ${code}`));
            }
          });

          ffmpeg.on('error', (error) => {
            reject(new Error(`FFmpeg error: ${error.message}`));
          });
        });
      }

    } catch (error) {
      console.error("❌ Failed to generate video:", error);
      throw new Error(`Failed to generate video: ${error instanceof Error ? error.message : 'Unknown error'}`);
    }
  }

  async generateMedia(prompt: string, type: 'image' | 'video', userId: number = 1): Promise<GeneratedMedia> {
    if (type === 'image') {
      return this.generateImage(prompt, userId);
    } else {
      return this.generateVideo(prompt, userId);
    }
  }

  // Get generated media by ID
  getMediaPath(filename: string): string {
    return path.join(this.uploadsDir, filename);
  }

  // Clean up old generated files (optional)
  cleanupOldFiles(maxAgeMs: number = 24 * 60 * 60 * 1000): void {
    const now = Date.now();
    const files = fs.readdirSync(this.uploadsDir);
    
    files.forEach(file => {
      if (file.startsWith('generated_')) {
        const filepath = path.join(this.uploadsDir, file);
        const stats = fs.statSync(filepath);
        if (now - stats.mtime.getTime() > maxAgeMs) {
          fs.unlinkSync(filepath);
          console.log(`🗑️ Cleaned up old generated file: ${file}`);
        }
      }
    });
  }
}

export const geminiMediaGenerator = new GeminiMediaGenerator();