import { GoogleGenAI, Type } from "@google/genai";

const ai = new GoogleGenAI({ apiKey: process.env.GEMINI_API_KEY || '' });

export interface EnrichedMetadata {
  name: string;
  artist: string;
  album: string;
  lyrics: string;
  lyricLines: { time: number; text: string }[];
  description: string;
}

export async function enrichSongMetadata(query: string, artist?: string): Promise<EnrichedMetadata | null> {
  if (!process.env.GEMINI_API_KEY) return null;

  try {
    const response = await ai.models.generateContent({
      model: "gemini-3-flash-preview",
      contents: `Search for the official, accurate lyrics for: "${query}"${artist ? ` by ${artist}` : ''}. 
      Reference high-quality sources like readdork.com or Genius to ensure every word is correct.
      
      Provide:
      1. Official song name, artist, and album.
      2. Full lyrics with precise TIMESTAMPS in seconds for EVERY line.
      3. A short, vivid visual description for an album cover.
      
      IMPORTANT: Estimates must be realistic. Most songs start lyrics between 5-20 seconds.
      Structure the lyricLines as a clean array of {time, text} objects.`,
      config: {
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
    // For gemini-2.5-flash-image, we should not include responseMimeType or responseSchema in config
    const response = await ai.models.generateContent({
      model: 'gemini-2.5-flash-image',
      contents: {
        parts: [
          {
            text: `High-quality, artistic, minimalistic digital art for a music album cover. 
            Style: Modern, aesthetic, evocative. 
            Song: "${songName}". 
            Vibe description: ${description}. 
            Do NOT include any text, letters, or numbers on the image. Just the art.`,
          },
        ],
      },
      config: {
        imageConfig: {
          aspectRatio: "1:1",
        },
      },
    });

    const candidates = (response as any).candidates;
    if (candidates && candidates[0]?.content?.parts) {
      for (const part of candidates[0].content.parts) {
        if (part.inlineData?.data) {
          return `data:image/png;base64,${part.inlineData.data}`;
        }
      }
    }
  } catch (error) {
    console.error("Image Generation failed:", error);
  }
  return null;
}
