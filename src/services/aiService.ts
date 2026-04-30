import { GoogleGenAI, Type } from "@google/genai";

const ai = new GoogleGenAI({ apiKey: process.env.GEMINI_API_KEY || '' });

export interface EnrichedMetadata {
  name: string;
  artist: string;
  album: string;
  lyrics: string;
  lyricLines: { time: number; text: string; duration?: number }[];
  description: string;
}

export async function enrichSongMetadata(query: string, artist?: string): Promise<EnrichedMetadata | null> {
  if (!process.env.GEMINI_API_KEY) return null;

  try {
    const response = await ai.models.generateContent({
      model: "gemini-3.1-pro-preview",
      contents: `Search for the official song metadata and complete lyrics for: "${query}"${artist ? ` by ${artist}` : ''}. 
      Use high-quality sources like Genius or Musixmatch to ensure accuracy.
      
      CRITICAL TIMING & ACCURACY REQUIREMENTS:
      1. Every line MUST have a start 'time' (seconds) and a 'duration' (seconds).
      2. The 'duration' must accurately reflect how long the character/artist takes to sing that specific line.
      3. For long musical interludes or instrumental starts (> 3 seconds), you MUST insert a line with text "[instrumental]" and appropriate duration.
      4. DO NOT hallucinate lyrics. If you cannot find them, return an empty array for lyricLines.
      5. The timing must follow the actual rhythm of the song. If the song has a slow tempo, durations should be larger.
      
      Provide:
      1. Official song name, artist, and album.
      2. Full lyrics with precise timestamps and durations for EVERY line.
      3. A short, vivid visual description for an album cover.`,
      config: {
        tools: [{ googleSearch: {} }],
        responseMimeType: "application/json",
        responseSchema: {
          type: Type.OBJECT,
          properties: {
            name: { type: Type.STRING },
            artist: { type: Type.STRING },
            album: { type: Type.STRING },
            lyrics: { type: Type.STRING },
            lyricLines: { 
              type: Type.ARRAY, 
              items: {
                type: Type.OBJECT,
                properties: {
                  time: { type: Type.NUMBER },
                  duration: { type: Type.NUMBER },
                  text: { type: Type.STRING }
                },
                required: ["time", "text"]
              }
            },
            description: { type: Type.STRING },
          },
          required: ["name", "artist", "album", "lyrics", "lyricLines", "description"],
        },
      },
    });

    if (response.text) {
      console.log("AI Enrichment Response:", response.text);
      return JSON.parse(response.text);
    }
  } catch (error) {
    console.error("AI Enrichment failed:", error);
  }
  return null;
}

export async function generateSongCover(description: string, songName: string): Promise<string | null> {
  if (!process.env.GEMINI_API_KEY) return null;

  try {
    console.log("Generating cover for:", songName, "with vibe:", description);
    const response = await ai.models.generateContent({
      model: 'gemini-3.1-flash-image-preview',
      contents: {
        parts: [
          {
            text: `High-quality professional album art for "${songName}". Vibe/Description: ${description}. Digital art style, symmetrical composition, vibrant. NO TEXT AT ALL.`,
          },
        ],
      },
      config: {
        imageConfig: {
          aspectRatio: "1:1",
          imageSize: "1K"
        },
      },
    });

    if (response.candidates?.[0]?.content?.parts) {
      for (const part of response.candidates[0].content.parts) {
        if (part.inlineData?.data) {
          console.log("Image generation success via inlineData!");
          return `data:image/png;base64,${part.inlineData.data}`;
        }
      }
    }
    
    console.warn("No image data found in response parts. Response structure:", JSON.stringify(response, (key, value) => {
        if (key === 'data' && typeof value === 'string' && value.length > 100) return value.substring(0, 50) + "...";
        return value;
    }, 2));

  } catch (error) {
    console.error("Image Generation failed:", error);
  }
  return null;
}
