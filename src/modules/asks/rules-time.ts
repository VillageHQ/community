import { formatShortDate } from "../../platform/text/format-date.ts";

const HOUR_MS = 60 * 60 * 1000;
const DAY_MS = 24 * HOUR_MS;

export function describeAge(timestamp: string, now = Date.now()) {
  const elapsedMs = now - new Date(timestamp).getTime();
  if (elapsedMs < HOUR_MS) return "just now";
  if (elapsedMs < DAY_MS) return "today";
  const days = Math.floor(elapsedMs / DAY_MS);
  return days === 1 ? "yesterday" : `${days} days ago`;
}

export function describeTimeLeft(expiresAt: string, now = Date.now()) {
  const leftMs = new Date(expiresAt).getTime() - now;
  if (leftMs <= 0) return `Came down on ${formatShortDate(expiresAt)}`;
  const days = Math.ceil(leftMs / DAY_MS);
  return days === 1 ? "Comes down within a day" : `${days} days left on the board`;
}
