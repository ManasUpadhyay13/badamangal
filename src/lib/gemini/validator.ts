import { geminiModel, MODEL_ID } from "@/lib/gemini/client";
import { getReferenceImages } from "@/lib/gemini/reference-cache";
import { VALIDATION_RUBRIC, RESPONSE_SCHEMA } from "@/lib/gemini/rubric";

export type ValidationOutcome = {
  is_authentic: boolean;
  confidence: "low" | "medium" | "high";
  reason: string;
};

const TIMEOUT_MS = 15_000;

export class ValidationInfraError extends Error {
  constructor(cause: unknown) {
    super(`Gemini call failed: ${cause instanceof Error ? cause.message : String(cause)}`);
    this.name = "ValidationInfraError";
  }
}

export async function validatePhoto(input: {
  data: string;
  mimeType: string;
}): Promise<ValidationOutcome> {
  const refs = await getReferenceImages();
  const model = geminiModel();

  const parts = [
    { text: VALIDATION_RUBRIC },
    { text: "Reference images of authentic bhandara setups:" },
    ...refs.map((r) => ({ inlineData: { data: r.data, mimeType: r.mimeType } })),
    { text: "Now evaluate the following submitted image:" },
    { inlineData: { data: input.data, mimeType: input.mimeType } },
  ];

  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), TIMEOUT_MS);

  try {
    const response = await model.generateContent({
      model: MODEL_ID,
      contents: [{ role: "user", parts }],
      config: {
        responseMimeType: "application/json",
        responseSchema: RESPONSE_SCHEMA as unknown as Record<string, unknown>,
        // @ts-expect-error abortSignal supported at SDK level
        abortSignal: controller.signal,
      },
    });

    type MaybeWithText = { response?: { text?: () => string } } & { text?: string };
    const r = response as unknown as MaybeWithText;
    const raw =
      typeof r.response?.text === "function" ? r.response.text() : (r.text ?? "");

    const parsed = JSON.parse(raw) as ValidationOutcome;
    if (typeof parsed.is_authentic !== "boolean") {
      throw new Error("Malformed Gemini response (missing is_authentic)");
    }
    return parsed;
  } catch (err) {
    throw new ValidationInfraError(err);
  } finally {
    clearTimeout(timer);
  }
}
