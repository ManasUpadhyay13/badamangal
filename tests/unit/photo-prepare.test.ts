import { describe, it, expect } from "vitest";
import { isHeic, computeTargetDims } from "../../src/lib/photo/prepare";

describe("photo prepare helpers", () => {
  it("detects HEIC by extension", () => {
    expect(isHeic({ name: "IMG.heic", type: "" } as File)).toBe(true);
    expect(isHeic({ name: "IMG.HEIF", type: "" } as File)).toBe(true);
    expect(isHeic({ name: "x.jpg", type: "image/jpeg" } as File)).toBe(false);
  });

  it("detects HEIC by MIME type", () => {
    expect(isHeic({ name: "x", type: "image/heic" } as File)).toBe(true);
    expect(isHeic({ name: "x", type: "image/heif" } as File)).toBe(true);
  });

  it("computeTargetDims keeps within 1600 px on the long edge", () => {
    expect(computeTargetDims(3200, 2400, 1600)).toEqual({ width: 1600, height: 1200 });
    expect(computeTargetDims(2400, 3200, 1600)).toEqual({ width: 1200, height: 1600 });
    expect(computeTargetDims(800, 600, 1600)).toEqual({ width: 800, height: 600 });
  });
});
