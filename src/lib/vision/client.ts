import OpenAI from "openai";
import { serverEnv } from "@/lib/env";

let cached: OpenAI | null = null;

export function openaiClient(): OpenAI {
  if (cached) return cached;
  cached = new OpenAI({ apiKey: serverEnv().OPENAI_API_KEY });
  return cached;
}

export const MODEL_ID = "gpt-4o-mini";

/** Thin wrapper exposing chat.completions.create. Mockable in tests. */
export function visionModel() {
  const ai = openaiClient();
  return {
    create: (request: Parameters<typeof ai.chat.completions.create>[0]) =>
      ai.chat.completions.create(request),
  };
}
