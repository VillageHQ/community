import { formatDayMonth } from "../text/format-date.ts";

// Set up › Settings › Plan: the plan sets the console's wording (Founderhall's planOf). A server is self-hosted
// unless the admin picks the managed plan; "Village sets up mail and the network by" is the date Village gave.
export const PLANS = { managed: "managed", selfHost: "self-host" } as const;
export type Plan = (typeof PLANS)[keyof typeof PLANS];
export const HOSTED_BY = { ourselves: "ourselves", managed: "managed" } as const;
export type HostedBy = (typeof HOSTED_BY)[keyof typeof HOSTED_BY];

// A real calendar day as YYYY-MM-DD (2026-02-30 is not).
export function isDay(text: string) {
  if (!/^\d{4}-\d{2}-\d{2}$/.test(text)) return false;
  const day = new Date(`${text}T00:00:00Z`);
  return !Number.isNaN(day.getTime()) && day.toISOString().slice(0, 10) === text;
}

const WEEKDAYS = ["Sun", "Mon", "Tue", "Wed", "Thu", "Fri", "Sat"];

// "Mon 10 Nov" from a YYYY-MM-DD day.
export function formatDayWord(text: string) {
  const day = new Date(`${text}T00:00:00Z`);
  return `${WEEKDAYS[day.getUTCDay()]} ${formatDayMonth(day)}`;
}

