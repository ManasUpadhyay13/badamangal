import { addDays, parseISO } from "date-fns";
import { formatInTimeZone, toZonedTime } from "date-fns-tz";
import { formatTimeIST, isHappeningNowIST, todayIST } from "./time";

const TZ = "Asia/Kolkata";

export type EventTiming = {
  event_date: string; // YYYY-MM-DD
  start_time: string; // HH:mm:ss
  end_time: string;
};

export function deriveTimingLabel(timing: EventTiming, now: Date = new Date()): string {
  if (isHappeningNowIST(timing.event_date, timing.start_time, timing.end_time, now)) {
    return "Happening now";
  }
  const today = todayIST(now);
  const tomorrow = formatInTimeZone(addDays(toZonedTime(now, TZ), 1), TZ, "yyyy-MM-dd");
  if (timing.event_date === today) {
    return `Starting at ${formatTimeIST(timing.start_time)}`;
  }
  if (timing.event_date === tomorrow) {
    return `Tomorrow ${formatTimeIST(timing.start_time)}`;
  }
  const date = parseISO(timing.event_date);
  return `${formatInTimeZone(date, TZ, "d MMM")}, ${formatTimeIST(timing.start_time)}`;
}
