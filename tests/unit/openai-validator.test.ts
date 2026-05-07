import { describe, it, expect, vi, beforeEach } from "vitest";

vi.mock("@/lib/vision/client", () => ({
  visionModel: vi.fn(),
  MODEL_ID: "gpt-4o-mini",
}));

vi.mock("@/lib/vision/reference-cache", () => ({
  getReferenceImages: async () => [
    { name: "ref-1.jpg", data: "AAA", mimeType: "image/jpeg" },
    { name: "ref-2.jpg", data: "BBB", mimeType: "image/jpeg" },
    { name: "ref-3.jpg", data: "CCC", mimeType: "image/jpeg" },
  ],
}));

import { visionModel } from "@/lib/vision/client";
import { validatePhoto } from "../../src/lib/vision/validator";

function makeChatResponse(parsed: object) {
  return {
    choices: [{ message: { content: JSON.stringify(parsed) } }],
  };
}

describe("validatePhoto (OpenAI)", () => {
  beforeEach(() => {
    vi.resetAllMocks();
  });

  it("returns is_authentic=true when OpenAI says so", async () => {
    (visionModel as ReturnType<typeof vi.fn>).mockReturnValue({
      create: vi.fn().mockResolvedValue(
        makeChatResponse({
          is_authentic: true,
          confidence: "high",
          reason: "looks like a real bhandara",
        })
      ),
    });
    const result = await validatePhoto({ data: "ZZZ", mimeType: "image/jpeg" });
    expect(result.is_authentic).toBe(true);
    expect(result.confidence).toBe("high");
  });

  it("returns is_authentic=false with reason when OpenAI rejects", async () => {
    (visionModel as ReturnType<typeof vi.fn>).mockReturnValue({
      create: vi.fn().mockResolvedValue(
        makeChatResponse({
          is_authentic: false,
          confidence: "medium",
          reason: "appears to be a wedding feast, not a public bhandara",
        })
      ),
    });
    const result = await validatePhoto({ data: "ZZZ", mimeType: "image/jpeg" });
    expect(result.is_authentic).toBe(false);
    expect(result.reason).toMatch(/wedding/);
  });

  it("throws ValidationInfraError on timeout / SDK failure", async () => {
    (visionModel as ReturnType<typeof vi.fn>).mockReturnValue({
      create: vi.fn().mockRejectedValue(new Error("timeout")),
    });
    await expect(validatePhoto({ data: "ZZZ", mimeType: "image/jpeg" })).rejects.toThrow(
      /Vision/
    );
  });
});
