import { formatShortDate } from "../../platform/text/format-date.ts";

const MINUTE_MS = 60_000;
const HOUR_MS = 60 * MINUTE_MS;
const DAY_MS = 24 * HOUR_MS;
const DAYS_SHOWN_AS_DAYS = 7;

export function formatRelativeTime(timestamp: string, now = Date.now()) {
  const elapsedMs = now - new Date(timestamp).getTime();
  if (elapsedMs < MINUTE_MS) return "Just now";
  if (elapsedMs < HOUR_MS) return `${Math.floor(elapsedMs / MINUTE_MS)}m`;
  if (elapsedMs < DAY_MS) return `${Math.floor(elapsedMs / HOUR_MS)}h`;
  if (elapsedMs < 2 * DAY_MS) return "Yesterday";
  if (elapsedMs < DAYS_SHOWN_AS_DAYS * DAY_MS) return `${Math.floor(elapsedMs / DAY_MS)}d`;
  return formatShortDate(timestamp);
}
