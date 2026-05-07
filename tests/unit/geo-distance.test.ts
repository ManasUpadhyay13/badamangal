import { describe, it, expect } from "vitest";
import { formatDistance } from "../../src/lib/geo/distance";

describe("formatDistance", () => {
  it("renders metres under 1000", () => {
    expect(formatDistance(0)).toBe("Here");
    expect(formatDistance(80)).toBe("80 m away");
    expect(formatDistance(420)).toBe("420 m away");
  });

  it("renders kilometres at or above 1000", () => {
    expect(formatDistance(1000)).toBe("1.0 km away");
    expect(formatDistance(1234)).toBe("1.2 km away");
    expect(formatDistance(4999)).toBe("5.0 km away");
  });

  it("rounds metres to nearest 10 to avoid jitter", () => {
    expect(formatDistance(67)).toBe("70 m away");
    expect(formatDistance(102)).toBe("100 m away");
  });
});
