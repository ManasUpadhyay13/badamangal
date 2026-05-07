import type { ChatCompletion } from "openai/resources/chat/completions";
import { visionModel, MODEL_ID } from "@/lib/vision/client";
import { getReferenceImages } from "@/lib/vision/reference-cache";
import { VALIDATION_RUBRIC, RESPONSE_SCHEMA } from "@/lib/vision/rubric";

export type ValidationOutcome = {
  is_authentic: boolean;
  confidence: "low" | "medium" | "high";
  reason: string;
};

const TIMEOUT_MS = 15_000;

export class ValidationInfraError extends Error {
  constructor(cause: unknown) {
    super(`Vision call failed: ${cause instanceof Error ? cause.message : String(cause)}`);
    this.name = "ValidationInfraError";
  }
}

function dataUrl(data: string, mimeType: string): string {
  return `data:${mimeType};base64,${data}`;
}

export async function validatePhoto(input: {
  data: string;
  mimeType: string;
}): Promise<ValidationOutcome> {
  const refs = await getReferenceImages();
  const model = visionModel();

  const content = [
    { type: "text" as const, text: VALIDATION_RUBRIC },
    { type: "text" as const, text: "Reference images of authentic bhandara setups:" },
    ...refs.map((r) => ({
      type: "image_url" as const,
      image_url: { url: dataUrl(r.data, r.mimeType) },
    })),
    { type: "text" as const, text: "Now evaluate the following submitted image:" },
    {
      type: "image_url" as const,
      image_url: { url: dataUrl(input.data, input.mimeType) },
    },
  ];

  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), TIMEOUT_MS);

  try {
    const response = await model.create({
      model: MODEL_ID,
      messages: [{ role: "user", content }],
      response_format: {
        type: "json_schema",
        json_schema: {
          name: "validation",
          strict: true,
          schema: RESPONSE_SCHEMA as unknown as Record<string, unknown>,
        },
      },
      // @ts-expect-error: signal accepted by SDK at runtime even if types lag
      signal: controller.signal,
    });

    const completion = response as ChatCompletion;
    const raw = completion.choices?.[0]?.message?.content ?? "";
    if (!raw) throw new Error("Empty OpenAI response");

    const parsed = JSON.parse(raw) as ValidationOutcome;
    if (typeof parsed.is_authentic !== "boolean") {
      throw new Error("Malformed OpenAI response (missing is_authentic)");
    }
    return parsed;
  } catch (err) {
    throw new ValidationInfraError(err);
  } finally {
    clearTimeout(timer);
  }
}
