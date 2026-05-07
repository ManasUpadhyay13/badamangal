import { describe, it, expect } from "vitest";
import { directionsUrl } from "../../src/lib/geo/deep-link";

const IPHONE_UA =
  "Mozilla/5.0 (iPhone; CPU iPhone OS 17_0 like Mac OS X) AppleWebKit/605.1.15 (KHTML, like Gecko) Version/17.0 Mobile/15E148 Safari/604.1";
const ANDROID_UA =
  "Mozilla/5.0 (Linux; Android 14; Pixel 7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Mobile Safari/537.36";
const DESKTOP_UA =
  "Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36";

describe("directionsUrl", () => {
  it("returns comgooglemaps:// scheme on iOS", () => {
    const url = directionsUrl(
      { lat: 26.8467, lng: 80.9462, name: "Hanuman Mandir" },
      IPHONE_UA
    );
    expect(url).toMatch(/^comgooglemaps:\/\//);
    expect(url).toContain("daddr=26.8467,80.9462");
  });

  it("returns geo: intent on Android", () => {
    const url = directionsUrl(
      { lat: 26.8467, lng: 80.9462, name: "Hanuman Mandir" },
      ANDROID_UA
    );
    expect(url).toMatch(/^geo:26\.8467,80\.9462/);
    expect(url).toContain("Hanuman");
  });

  it("returns web URL on desktop / unknown", () => {
    const url = directionsUrl(
      { lat: 26.8467, lng: 80.9462, name: "Hanuman Mandir" },
      DESKTOP_UA
    );
    expect(url).toMatch(/^https:\/\/www\.google\.com\/maps\/dir\//);
    expect(url).toContain("destination=26.8467%2C80.9462");
  });

  it("falls back to web URL when UA is empty", () => {
    const url = directionsUrl({ lat: 1, lng: 2, name: "X" }, "");
    expect(url).toMatch(/^https:\/\/www\.google\.com\/maps\/dir\//);
  });
});
