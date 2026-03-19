import { GoogleGenAI, Type } from "@google/genai";
import { Track } from "../types";

const ai = new GoogleGenAI({ apiKey: process.env.GEMINI_API_KEY || "" });

export async function generateArtistRadio(currentTrack: Track): Promise<{ title: string; artist: string }[]> {
  const prompt = `Generate a list of 10 songs similar to "${currentTrack.title}" by ${currentTrack.artist}. 
  Provide the result as a JSON array of objects, each with "title" and "artist" fields. 
  Focus on the same genre and mood.`;

  const response = await ai.models.generateContent({
    model: "gemini-3-flash-preview",
    contents: prompt,
    config: {
      responseMimeType: "application/json",
      responseSchema: {
        type: Type.ARRAY,
        items: {
          type: Type.OBJECT,
          properties: {
            title: { type: Type.STRING },
            artist: { type: Type.STRING },
          },
          required: ["title", "artist"],
        },
      },
    },
  });

  try {
    const recommendations = JSON.parse(response.text || "[]");
    return recommendations;
  } catch (error) {
    console.error("Error parsing Gemini response:", error);
    return [];
  }
}
