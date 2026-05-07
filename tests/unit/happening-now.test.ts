import { describe, it, expect } from "vitest";
import { deriveTimingLabel } from "../../src/lib/ist/happening";

describe("deriveTimingLabel", () => {
  it('returns "Happening now" when in window', () => {
    // 2026-05-06 13:00 UTC = 18:30 IST
    const now = new Date(Date.UTC(2026, 4, 6, 13, 0, 0));
    const label = deriveTimingLabel(
      { event_date: "2026-05-06", start_time: "17:00:00", end_time: "20:00:00" },
      now
    );
    expect(label).toBe("Happening now");
  });

  it('returns "Starting at h:mm A" when same day, before start', () => {
    const now = new Date(Date.UTC(2026, 4, 6, 6, 0, 0)); // 11:30 IST
    const label = deriveTimingLabel(
      { event_date: "2026-05-06", start_time: "17:00:00", end_time: "20:00:00" },
      now
    );
    expect(label).toBe("Starting at 5:00 PM");
  });

  it('returns "Tomorrow h:mm A" when event is the next IST day', () => {
    const now = new Date(Date.UTC(2026, 4, 6, 6, 0, 0)); // 2026-05-06 11:30 IST
    const label = deriveTimingLabel(
      { event_date: "2026-05-07", start_time: "17:00:00", end_time: "20:00:00" },
      now
    );
    expect(label).toBe("Tomorrow 5:00 PM");
  });

  it('returns "DD MMM, h:mm A" for events further away', () => {
    const now = new Date(Date.UTC(2026, 4, 6, 6, 0, 0));
    const label = deriveTimingLabel(
      { event_date: "2026-05-12", start_time: "18:30:00", end_time: "21:00:00" },
      now
    );
    expect(label).toBe("12 May, 6:30 PM");
  });
});
