import { GoogleGenerativeAI } from '@google/generative-ai';
import fs from 'fs';
import path from 'path';

const genAI = new GoogleGenerativeAI(process.env.GEMINI_API_KEY);

async function testTranscriptExtraction() {
  try {
    console.log('🧪 Testing direct transcript extraction...');
    
    // Find the most recent video file
    const uploadsDir = '../uploads';
    const files = fs.readdirSync(uploadsDir)
      .filter(f => f.endsWith('.mp4'))
      .map(f => ({
        name: f,
        time: fs.statSync(path.join(uploadsDir, f)).mtime
      }))
      .sort((a, b) => b.time - a.time);
    
    if (files.length === 0) {
      console.log('❌ No video files found in uploads');
      return;
    }
    
    const videoFile = files[0].name;
    console.log(`📹 Testing with video: ${videoFile}`);
    
    const videoPath = path.join(uploadsDir, videoFile);
    const videoData = fs.readFileSync(videoPath);
    const base64Video = videoData.toString('base64');
    
    const model = genAI.getGenerativeModel({ model: 'gemini-1.5-flash' });
    
    const prompt = `
AUDIO TRANSCRIPT EXTRACTION TEST
Extract ALL spoken words from this video audio. Be extremely thorough.

CRITICAL: Look for words like "stupid", "crazy", "don't", "be", brand names, casual speech.

Return JSON format:
{
  "hasAudio": true/false,
  "fullText": "complete transcript",
  "segments": [
    {"start": 0, "end": 10, "text": "spoken words here"}
  ]
}

Be comprehensive - don't miss any spoken content.`;

    console.log('🎧 Sending request to Gemini...');
    const result = await model.generateContent([
      {
        inlineData: {
          data: base64Video,
          mimeType: 'video/mp4'
        }
      },
      prompt
    ]);

    const response = result.response.text();
    console.log('📝 Raw Gemini response:');
    console.log(response);
    
    // Try to parse JSON
    try {
      const cleanResponse = response.replace(/```json\n?/g, '').replace(/```\n?/g, '').trim();
      const parsed = JSON.parse(cleanResponse);
      console.log('\n✅ Parsed transcript data:');
      console.log('Has audio:', parsed.hasAudio);
      console.log('Full text:', parsed.fullText);
      console.log('Segments count:', parsed.segments?.length || 0);
      
      if (parsed.segments && parsed.segments.length > 0) {
        console.log('\n📋 First few segments:');
        parsed.segments.slice(0, 3).forEach((seg, i) => {
          console.log(`${i+1}. ${seg.start}s-${seg.end}s: "${seg.text}"`);
        });
      }
      
      // Check for "stupid"
      const hasStupid = parsed.fullText?.toLowerCase().includes('stupid') || 
                       parsed.segments?.some(s => s.text?.toLowerCase().includes('stupid'));
      console.log('\n🎯 Contains "stupid":', hasStupid);
      
    } catch (parseError) {
      console.log('❌ Failed to parse JSON:', parseError.message);
    }
    
  } catch (error) {
    console.error('❌ Test failed:', error);
  }
}

testTranscriptExtraction();