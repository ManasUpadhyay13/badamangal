import { addDays } from "date-fns";
import { formatInTimeZone, toZonedTime } from "date-fns-tz";

const TZ = "Asia/Kolkata";

export function todayIST(now: Date = new Date()): string {
  return formatInTimeZone(now, TZ, "yyyy-MM-dd");
}

export function istDateRange(now: Date = new Date()): { min: string; max: string } {
  const min = todayIST(now);
  const today = toZonedTime(now, TZ);
  const max = formatInTimeZone(addDays(today, 14), TZ, "yyyy-MM-dd");
  return { min, max };
}

export function isWithinSubmissionWindow(eventDate: string, now: Date = new Date()): boolean {
  const { min, max } = istDateRange(now);
  return eventDate >= min && eventDate <= max;
}

export function isHappeningNowIST(
  eventDate: string,
  startTime: string, // "HH:mm:ss"
  endTime: string,
  now: Date = new Date()
): boolean {
  const dateInIST = formatInTimeZone(now, TZ, "yyyy-MM-dd");
  if (dateInIST !== eventDate) return false;
  const hms = formatInTimeZone(now, TZ, "HH:mm:ss");
  return hms >= startTime && hms <= endTime;
}

export function formatTimeIST(hms: string): string {
  const [h, m] = hms.split(":").map(Number);
  const ampm = h >= 12 ? "PM" : "AM";
  const hh = h % 12 === 0 ? 12 : h % 12;
  const mm = m.toString().padStart(2, "0");
  return `${hh}:${mm} ${ampm}`;
}
