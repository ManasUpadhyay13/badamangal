import { describe, it, expect, vi, beforeEach } from "vitest";

vi.mock("@/lib/gemini/client", () => ({
  geminiModel: vi.fn(),
  MODEL_ID: "gemini-2.5-flash",
}));

vi.mock("@/lib/gemini/reference-cache", () => ({
  getReferenceImages: async () => [
    { name: "ref-1.jpg", data: "AAA", mimeType: "image/jpeg" },
    { name: "ref-2.jpg", data: "BBB", mimeType: "image/jpeg" },
    { name: "ref-3.jpg", data: "CCC", mimeType: "image/jpeg" },
  ],
}));

import { geminiModel } from "@/lib/gemini/client";
import { validatePhoto } from "../../src/lib/gemini/validator";

describe("validatePhoto", () => {
  beforeEach(() => {
    vi.resetAllMocks();
  });

  it("returns is_authentic=true when Gemini says so", async () => {
    (geminiModel as ReturnType<typeof vi.fn>).mockReturnValue({
      generateContent: vi.fn().mockResolvedValue({
        response: {
          text: () =>
            JSON.stringify({
              is_authentic: true,
              confidence: "high",
              reason: "looks like a real bhandara",
            }),
        },
      }),
    });
    const result = await validatePhoto({ data: "ZZZ", mimeType: "image/jpeg" });
    expect(result.is_authentic).toBe(true);
    expect(result.confidence).toBe("high");
  });

  it("returns is_authentic=false with reason when Gemini rejects", async () => {
    (geminiModel as ReturnType<typeof vi.fn>).mockReturnValue({
      generateContent: vi.fn().mockResolvedValue({
        response: {
          text: () =>
            JSON.stringify({
              is_authentic: false,
              confidence: "medium",
              reason: "appears to be a wedding feast, not a public bhandara",
            }),
        },
      }),
    });
    const result = await validatePhoto({ data: "ZZZ", mimeType: "image/jpeg" });
    expect(result.is_authentic).toBe(false);
    expect(result.reason).toMatch(/wedding/);
  });

  it("throws ValidationInfraError on timeout / SDK failure", async () => {
    (geminiModel as ReturnType<typeof vi.fn>).mockReturnValue({
      generateContent: vi.fn().mockRejectedValue(new Error("timeout")),
    });
    await expect(validatePhoto({ data: "ZZZ", mimeType: "image/jpeg" })).rejects.toThrow(
      /Gemini/
    );
  });
});
