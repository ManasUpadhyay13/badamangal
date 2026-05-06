import { describe, it, expect } from "vitest";
import {
  todayIST,
  istDateRange,
  isWithinSubmissionWindow,
  isHappeningNowIST,
  formatTimeIST,
} from "../../src/lib/ist/time";

describe("ist time helpers", () => {
  it("todayIST returns YYYY-MM-DD in IST", () => {
    // 2026-05-06 18:30 UTC = 2026-05-07 00:00 IST
    const at = new Date(Date.UTC(2026, 4, 6, 18, 30, 0));
    expect(todayIST(at)).toBe("2026-05-07");
  });

  it("istDateRange returns today through today+14", () => {
    const at = new Date(Date.UTC(2026, 4, 6, 6, 0, 0));
    const { min, max } = istDateRange(at);
    expect(min).toBe("2026-05-06");
    expect(max).toBe("2026-05-20");
  });

  it("isWithinSubmissionWindow accepts dates in [today, today+14] IST", () => {
    const now = new Date(Date.UTC(2026, 4, 6, 6, 0, 0));
    expect(isWithinSubmissionWindow("2026-05-06", now)).toBe(true);
    expect(isWithinSubmissionWindow("2026-05-20", now)).toBe(true);
    expect(isWithinSubmissionWindow("2026-05-21", now)).toBe(false);
    expect(isWithinSubmissionWindow("2026-05-05", now)).toBe(false);
  });

  it("isHappeningNowIST returns true when current IST is within event window", () => {
    // Event 2026-05-06 17:00–20:00 IST. Now = 2026-05-06 13:00 UTC = 18:30 IST.
    const now = new Date(Date.UTC(2026, 4, 6, 13, 0, 0));
    expect(isHappeningNowIST("2026-05-06", "17:00:00", "20:00:00", now)).toBe(true);
    // Now = 2026-05-06 06:00 UTC = 11:30 IST → before
    const before = new Date(Date.UTC(2026, 4, 6, 6, 0, 0));
    expect(isHappeningNowIST("2026-05-06", "17:00:00", "20:00:00", before)).toBe(false);
  });

  it("formatTimeIST formats HH:mm:ss as h:mm A", () => {
    expect(formatTimeIST("17:00:00")).toBe("5:00 PM");
    expect(formatTimeIST("09:05:00")).toBe("9:05 AM");
  });
});
