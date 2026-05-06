import { GoogleGenAI } from "@google/genai";
import { serverEnv } from "@/lib/env";

let cached: GoogleGenAI | null = null;

export function geminiClient(): GoogleGenAI {
  if (cached) return cached;
  cached = new GoogleGenAI({ apiKey: serverEnv().GEMINI_API_KEY });
  return cached;
}

export const MODEL_ID = "gemini-2.5-flash";

/** Thin wrapper exposing generateContent. Mockable in tests. */
export function geminiModel() {
  const ai = geminiClient();
  return {
    generateContent: (request: Parameters<typeof ai.models.generateContent>[0]) =>
      ai.models.generateContent(request),
  };
}
