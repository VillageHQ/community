import { REPORT_PERIOD_KEYS, type ReportPeriodKey } from "./contract-partner-report.ts";

// The console's period switch (Founderhall's): "Q4 to date · Q3 · Since launch". The address carries Founderhall's
// words (?period=quarter|last|all); anything else reads as this quarter.
export const CONSOLE_PERIODS = { quarter: REPORT_PERIOD_KEYS.thisQuarter, last: REPORT_PERIOD_KEYS.lastQuarter, all: REPORT_PERIOD_KEYS.sinceLaunch } as const;

export type ConsolePeriodParam = keyof typeof CONSOLE_PERIODS;

export const CONSOLE_PERIOD_PARAMS = Object.keys(CONSOLE_PERIODS) as ConsolePeriodParam[];

export function parseConsolePeriod(value: unknown): ConsolePeriodParam {
  return typeof value === "string" && value in CONSOLE_PERIODS ? (value as ConsolePeriodParam) : "quarter";
}

export function readPeriodParam(key: ReportPeriodKey): ConsolePeriodParam {
  return CONSOLE_PERIOD_PARAMS.find((param) => CONSOLE_PERIODS[param] === key) ?? "quarter";
}

const MONTHS = ["Jan", "Feb", "Mar", "Apr", "May", "Jun", "Jul", "Aug", "Sep", "Oct", "Nov", "Dec"];

// "11 Nov": Founderhall's short date, in UTC like the report's quarters.
export function formatDayMonth(date: Date) {
  return `${date.getUTCDate()} ${MONTHS[date.getUTCMonth()]}`;
}

export type ConsolePeriod = {
  param: ConsolePeriodParam;
  key: ReportPeriodKey;
  // The switch's word: "Q4 to date", "Q3", "Since launch".
  short: string;
  // In titles: "Q4 2026 to date", "Q3 2026", "since launch".
  label: string;
  // On the report's brand line: "1 Oct – 11 Nov", "to 11 Nov".
  range: string;
  from: Date | null;
  to: Date | null;
};

const MONTHS_PER_QUARTER = 3;
const DAY_IN_MILLISECONDS = 24 * 60 * 60 * 1000;

// Quarters are calendar quarters in UTC, the same boundaries the partner report reads.
export function readConsolePeriod(param: ConsolePeriodParam, now = new Date()): ConsolePeriod {
  const year = now.getUTCFullYear();
  const quarter = Math.floor(now.getUTCMonth() / MONTHS_PER_QUARTER);
  const thisStart = new Date(Date.UTC(year, quarter * MONTHS_PER_QUARTER, 1));
  if (param === "last") {
    const from = new Date(Date.UTC(year, (quarter - 1) * MONTHS_PER_QUARTER, 1));
    const name = `Q${Math.floor(from.getUTCMonth() / MONTHS_PER_QUARTER) + 1}`;
    const lastDay = new Date(thisStart.getTime() - DAY_IN_MILLISECONDS);
    return { param, key: CONSOLE_PERIODS.last, short: name, label: `${name} ${from.getUTCFullYear()}`, range: `${formatDayMonth(from)} – ${formatDayMonth(lastDay)}`, from, to: thisStart };
  }
  if (param === "all") return { param, key: CONSOLE_PERIODS.all, short: "Since launch", label: "since launch", range: `to ${formatDayMonth(now)}`, from: null, to: null };
  const name = `Q${quarter + 1}`;
  return { param, key: CONSOLE_PERIODS.quarter, short: `${name} to date`, label: `${name} ${year} to date`, range: `${formatDayMonth(thisStart)} – ${formatDayMonth(now)}`, from: thisStart, to: null };
}

export function readConsolePeriods(now = new Date()) {
  return CONSOLE_PERIOD_PARAMS.map((param) => readConsolePeriod(param, now));
}
