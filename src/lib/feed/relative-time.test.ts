import { describe, expect, it } from "vitest";

import { formatRelativeTime } from "./relative-time";

const NOW = Date.parse("2026-03-15T12:00:00.000Z");
const MINUTE_MS = 60_000;
const HOUR_MS = 60 * MINUTE_MS;
const DAY_MS = 24 * HOUR_MS;

function formatAgo(elapsedMs: number) {
  return formatRelativeTime(new Date(NOW - elapsedMs).toISOString(), NOW);
}

describe("relative time", () => {
  it.each([
    ["seconds", 30_000, "Just now"],
    ["a clock running slightly ahead", -5_000, "Just now"],
    ["minutes", 45 * MINUTE_MS, "45m"],
    ["hours", 2 * HOUR_MS, "2h"],
    ["about a day", 30 * HOUR_MS, "Yesterday"],
    ["several days", 3 * DAY_MS, "3d"],
    ["more than a week", 10 * DAY_MS, "Mar 5"],
  ])("reads %s", (_name, elapsedMs, expected) => {
    expect(formatAgo(elapsedMs)).toBe(expected);
  });
});
