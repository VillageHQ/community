const LOCALE = "en-US";
const DAY_MS = 24 * 60 * 60 * 1000;
const WEEKDAY_SPAN_DAYS = 7;

export const SERVER_TIME_ZONE = "UTC";

function toDayNumber(date: Date, timeZone: string) {
  const parts = new Intl.DateTimeFormat(LOCALE, { year: "numeric", month: "numeric", day: "numeric", timeZone }).formatToParts(date);
  const readPart = (type: string) => Number(parts.find((part) => part.type === type)?.value);
  return Math.floor(Date.UTC(readPart("year"), readPart("month") - 1, readPart("day")) / DAY_MS);
}

function readDaysAgo(timestamp: string, now: Date, timeZone: string) {
  return toDayNumber(now, timeZone) - toDayNumber(new Date(timestamp), timeZone);
}

function formatPart(timestamp: string, timeZone: string, format: Intl.DateTimeFormatOptions) {
  return new Intl.DateTimeFormat(LOCALE, { ...format, timeZone }).format(new Date(timestamp));
}

export function formatMessageTime(timestamp: string, timeZone: string) {
  return formatPart(timestamp, timeZone, { hour: "numeric", minute: "2-digit" });
}

export function formatConversationTime(timestamp: string, timeZone: string, now = new Date()) {
  const daysAgo = readDaysAgo(timestamp, now, timeZone);
  if (daysAgo <= 0) return formatMessageTime(timestamp, timeZone);
  if (daysAgo < WEEKDAY_SPAN_DAYS) return formatPart(timestamp, timeZone, { weekday: "short" });
  return formatPart(timestamp, timeZone, { month: "short", day: "numeric" });
}

export function formatMessageDay(timestamp: string, timeZone: string, now = new Date()) {
  const daysAgo = readDaysAgo(timestamp, now, timeZone);
  if (daysAgo <= 0) return "Today";
  if (daysAgo === 1) return "Yesterday";
  if (daysAgo < WEEKDAY_SPAN_DAYS) return formatPart(timestamp, timeZone, { weekday: "long" });
  return formatPart(timestamp, timeZone, { month: "short", day: "numeric" });
}

export function readMessageDayKey(timestamp: string, timeZone: string) {
  return String(toDayNumber(new Date(timestamp), timeZone));
}
