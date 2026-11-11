import type { ConsolePeriod } from "./console-periods.ts";
import { OUTCOME_WORDS, type IntroLogRow } from "./reads-intro-log.ts";

// The Intro log as a CSV: states and dates, never a note. Names follow ADMIN_SEES_INTRO_NAMES like the page.

const FORMULA_START = /^[=+\-@\t\r]/;
const NEEDS_QUOTES = /[",\n\r]/;

function toCell(value: string | null) {
  const text = value ?? "";
  const safe = FORMULA_START.test(text) ? `'${text}` : text;
  return NEEDS_QUOTES.test(safe) || safe !== text ? `"${safe.replaceAll('"', '""')}"` : safe;
}

function toDay(date: Date | null) {
  return date ? date.toISOString().slice(0, 10) : null;
}

const HEAD = ["asked_at", "asker", "target", "target_company", "connector", "state", "answered_at", "introduced_at", "outcome"];

export function renderIntroLogCsv(rows: readonly IntroLogRow[]) {
  const lines = rows.map((row) =>
    [toDay(row.askedAt), row.asker, row.target, row.targetCompany, row.connector, row.stateWord, toDay(row.answeredAt), toDay(row.introducedAt), row.outcome ? OUTCOME_WORDS[row.outcome] : null]
      .map(toCell)
      .join(","),
  );
  return `${[HEAD.join(","), ...lines].join("\r\n")}\r\n`;
}

export function readIntroLogFileName(period: ConsolePeriod) {
  return `intros-${period.label.replace(/\s+/g, "-").toLowerCase()}.csv`;
}
