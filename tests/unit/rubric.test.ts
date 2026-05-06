import { describe, it, expect } from "vitest";
import { VALIDATION_RUBRIC, RESPONSE_SCHEMA } from "../../src/lib/gemini/rubric";

describe("rubric", () => {
  it("mentions key authentic markers", () => {
    expect(VALIDATION_RUBRIC).toMatch(/cooking vessels|kadhai|deg/i);
    expect(VALIDATION_RUBRIC).toMatch(/prasad|distribut/i);
    expect(VALIDATION_RUBRIC).toMatch(/temple|courtyard|pandal/i);
  });

  it("explicitly lists rejection categories", () => {
    expect(VALIDATION_RUBRIC.toLowerCase()).toContain("restaurant");
    expect(VALIDATION_RUBRIC.toLowerCase()).toContain("wedding");
    expect(VALIDATION_RUBRIC.toLowerCase()).toContain("stock photo");
  });

  it("response schema enforces is_authentic, confidence, reason", () => {
    expect(RESPONSE_SCHEMA.required).toEqual(["is_authentic", "confidence", "reason"]);
    expect(RESPONSE_SCHEMA.properties.confidence.enum).toEqual(["low", "medium", "high"]);
  });
});
