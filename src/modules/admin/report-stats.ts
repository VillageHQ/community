import { ASK_CATEGORIES, type AskCategory } from "../asks/contract.ts";
import { INTRO_OUTCOMES, INTRO_RESULTS, INTRO_STATES, OPEN_INTRO_STATES, type IntroResult } from "../intros/contract.ts";
import type { ConsolePeriod } from "./console-periods.ts";

// The partner report's numbers for one period (Founderhall's report, on Community's intros). The page, the CSV and
// the email are all drawn from one ReportStats, so a number can't differ between them. Counts only: the only names
// are connectors. What leaves the app (the email, the CSV, the printed page) names only connectors who turned on
// "Credit me in reports" (`connectors`); the admin's page in the app names every connector (`allConnectors`).

export type ReportIntroRow = {
  state: string;
  createdAt: Date;
  acceptedAt: Date | null;
  askedTargetAt: Date | null;
  targetAgreedAt: Date | null;
  closedAt: Date | null;
  outcome: string | null;
  outcomeResults: readonly string[] | null;
  // The connector: a key that groups their intros, their name, and whether they may be named outside the app (an
  // active member who turned on "Credit me in reports").
  connectorKey: string;
  connectorName: string | null;
  connectorCredited: boolean;
  sector: string | null;
  cohort: string | null;
  // What the founder needed: the category of the ask the intro started from, if any.
  need: AskCategory | null;
};

export type AskStats = { posted: number; answered: number; open: number; helped: number; medianHours: number | null; intros: number; introsMade: number };

// `declined` is a real no; `noAnswer` is an ask that closed after NO_ANSWER_DAYS with no answer. Every ask lands in
// exactly one of made, declined, noAnswer, withdrawn or open, so a row adds up.
export type BreakdownRow = { name: string; asked: number; yes: number; made: number; declined: number; noAnswer: number; open: number; isCredited?: boolean };

export const RESULT_ROWS: Record<IntroResult, string> = {
  [INTRO_RESULTS.customer]: "A customer conversation started",
  [INTRO_RESULTS.hire]: "A hire",
  [INTRO_RESULTS.investor]: "An investor meeting",
};

const RESULT_WORDS: Record<IntroResult, readonly [string, string]> = {
  [INTRO_RESULTS.customer]: ["customer conversation started", "customer conversations started"],
  [INTRO_RESULTS.hire]: ["hire", "hires"],
  [INTRO_RESULTS.investor]: ["investor meeting", "investor meetings"],
};

// Founderhall's needs. Community's asks map onto them: advice is an expert; an intro ask or anything else is other.
export const NEED_LABELS = { customer: "Customer", hire: "Hire", investor: "Investor", expert: "Expert", other: "Other" } as const;

const NEED_OF_CATEGORY: Record<AskCategory, keyof typeof NEED_LABELS> = {
  [ASK_CATEGORIES.customer]: "customer",
  [ASK_CATEGORIES.hire]: "hire",
  [ASK_CATEGORIES.advice]: "expert",
  [ASK_CATEGORIES.intro]: "other",
  [ASK_CATEGORIES.other]: "other",
};

export const TOP_CONNECTORS = 5;
export const OTHER_CONNECTORS = "Other connectors";
export const NO_SECTOR = "Not set";
export const NO_COHORT = "No cohort";
// An ask the connector or the person asked for never answered closes after this many days.
export const NO_ANSWER_DAYS = 7;

const DAY_MS = 24 * 60 * 60 * 1000;
const OPEN_STATES: readonly string[] = OPEN_INTRO_STATES;
const CONNECTOR_OPEN: readonly string[] = [INTRO_STATES.requested, INTRO_STATES.accepted, INTRO_STATES.targetAgreed];

function median(values: number[]) {
  if (values.length === 0) return null;
  const sorted = values.toSorted((first, second) => first - second);
  const middle = Math.floor(sorted.length / 2);
  return sorted.length % 2 ? sorted[middle]! : (sorted[middle - 1]! + sorted[middle]!) / 2;
}

const percent = (part: number, whole: number) => (whole ? Math.round((part / whole) * 100) : 0);

const saidYes = (row: ReportIntroRow) => row.acceptedAt !== null || row.askedTargetAt !== null;
const isMade = (row: ReportIntroRow) => row.state === INTRO_STATES.completed;
const isDeclined = (row: ReportIntroRow) => row.state === INTRO_STATES.declined || row.state === INTRO_STATES.targetDeclined;
const isNoAnswer = (row: ReportIntroRow) => row.state === INTRO_STATES.expired;
const isOpen = (row: ReportIntroRow) => OPEN_STATES.includes(row.state);
const expiredAtTarget = (row: ReportIntroRow) => row.state === INTRO_STATES.expired && row.askedTargetAt !== null && row.targetAgreedAt === null;

const emptyRow = (name: string): BreakdownRow => ({ name, asked: 0, yes: 0, made: 0, declined: 0, noAnswer: 0, open: 0 });

function groupBy(rows: readonly ReportIntroRow[], keyOf: (row: ReportIntroRow) => string | null) {
  const groups = new Map<string, BreakdownRow>();
  for (const row of rows) {
    const name = keyOf(row);
    if (name === null) continue;
    const group = groups.get(name) ?? emptyRow(name);
    group.asked += 1;
    if (saidYes(row)) group.yes += 1;
    if (isMade(row)) group.made += 1;
    if (isDeclined(row)) group.declined += 1;
    if (isNoAnswer(row)) group.noAnswer += 1;
    if (isOpen(row)) group.open += 1;
    groups.set(name, group);
  }
  return [...groups.values()];
}

const byAsked = (first: BreakdownRow, second: BreakdownRow) => second.asked - first.asked || first.name.localeCompare(second.name);

// Top connectors, most intros first, at most five; everyone else counted together on one line. `creditedOnly` (what
// leaves the app) names only connectors who turned on "Credit me in reports"; the rest are only part of the count.
function readConnectors(rows: readonly ReportIntroRow[], { creditedOnly }: { creditedOnly: boolean }) {
  const groups = groupBy(
    rows.filter(({ connectorName, connectorCredited }) => connectorName !== null && (connectorCredited || !creditedOnly)),
    ({ connectorKey }) => connectorKey,
  ).map((group) => {
    const first = rows.find(({ connectorKey }) => connectorKey === group.name)!;
    return { key: group.name, row: { ...group, name: first.connectorName!, isCredited: first.connectorCredited } };
  });
  groups.sort(({ row: first }, { row: second }) => second.made - first.made || second.yes - first.yes || first.name.localeCompare(second.name));
  const shown = groups.slice(0, TOP_CONNECTORS);
  const shownKeys = new Set(shown.map(({ key }) => key));
  const others = groupBy(
    rows.filter(({ connectorKey }) => !shownKeys.has(connectorKey)),
    () => OTHER_CONNECTORS,
  )[0];
  return { named: shown.map(({ row }) => row), others: others ?? null };
}

function readNeeds(rows: readonly ReportIntroRow[]) {
  const groups = groupBy(rows, ({ need }) => NEED_LABELS[need ? NEED_OF_CATEGORY[need] : "other"]);
  return Object.values(NEED_LABELS).map((name) => groups.find((group) => group.name === name) ?? emptyRow(name));
}

function readCohorts(rows: readonly ReportIntroRow[]) {
  const labels = new Map<string, string>();
  const groups = groupBy(rows, ({ cohort }) => {
    const label = cohort?.trim();
    if (!label) return NO_COHORT;
    const key = label.toLowerCase();
    if (!labels.has(key)) labels.set(key, label);
    return labels.get(key)!;
  });
  return groups.sort((first, second) => Number(first.name === NO_COHORT) - Number(second.name === NO_COHORT) || byAsked(first, second));
}

export function computeReportStats(rows: readonly ReportIntroRow[], { now = new Date(), outcomeDays }: { now?: Date; outcomeDays: number }) {
  const count = (test: (row: ReportIntroRow) => boolean) => rows.filter(test).length;
  const helpful = count(({ outcome }) => outcome === INTRO_OUTCOMES.helped);
  const notReally = count(({ outcome }) => outcome === INTRO_OUTCOMES.notHelped);
  const tooEarly = count(({ outcome }) => outcome === INTRO_OUTCOMES.notYet);
  const results = Object.fromEntries(
    Object.values(INTRO_RESULTS).map((result) => [result, count(({ outcomeResults }) => (outcomeResults ?? []).includes(result))]),
  ) as Record<IntroResult, number>;
  const stats = {
    asked: rows.length,
    connectorYes: count(saidYes),
    made: count(isMade),
    declinedConnector: count(({ state }) => state === INTRO_STATES.declined),
    expiredConnector: count((row) => row.state === INTRO_STATES.expired && !expiredAtTarget(row)),
    declinedTarget: count(({ state }) => state === INTRO_STATES.targetDeclined),
    expiredTarget: count(expiredAtTarget),
    openConnector: count(({ state }) => CONNECTOR_OPEN.includes(state)),
    openTarget: count(({ state }) => state === INTRO_STATES.askingTarget),
    withdrawn: count(({ state }) => state === INTRO_STATES.withdrawn),
    helpful,
    notReally,
    tooEarly,
    answered: helpful + notReally + tooEarly,
    results,
    outcomeDays,
    pending: count((row) => isMade(row) && row.outcome === null && row.closedAt !== null && now.getTime() - row.closedAt.getTime() < outcomeDays * DAY_MS),
    medianDays: median(rows.filter((row) => isMade(row) && row.closedAt).map((row) => (row.closedAt!.getTime() - row.createdAt.getTime()) / DAY_MS)),
    connectors: readConnectors(rows, { creditedOnly: true }),
    allConnectors: readConnectors(rows, { creditedOnly: false }),
    sectors: groupBy(rows, ({ sector }) => sector?.trim() || NO_SECTOR).sort(byAsked),
    needs: readNeeds(rows),
    cohorts: readCohorts(rows),
  };
  return { ...stats, declined: count(isDeclined), noAnswer: count(isNoAnswer), open: count(isOpen) };
}

export type IntroStats = ReturnType<typeof computeReportStats>;

export type ReportStats = { communityName: string; period: ConsolePeriod; intros: IntroStats; asks: AskStats | null; summary: string; title: string };

const many = (count: number, [one, more]: readonly [string, string]) => `${count} ${count === 1 ? one : more}`;
const roundTenth = (value: number) => Math.round(value * 10) / 10;
const daysWord = (days: number) => {
  const rounded = roundTenth(days);
  return `${rounded} day${rounded === 1 ? "" : "s"}`;
};

// "22 hours", "under an hour", "2.5 days"; "–" before any help.
export function hoursWord(hours: number | null) {
  if (hours === null) return "–";
  if (hours < 1) return "under an hour";
  if (hours < 48) {
    const rounded = Math.round(hours);
    return `${rounded} hour${rounded === 1 ? "" : "s"}`;
  }
  return `${roundTenth(hours / 24)} days`;
}

// The KPI tile: "2 days", or "–" before any intro.
export function medianTile(days: number | null) {
  return days === null ? "–" : `${roundTenth(days)} days`;
}

// One line for the partner meeting. A period that holds the community's first ask reads "in the first N weeks" (up
// to 12); otherwise the period's name.
export function readSummaryLine(stats: IntroStats, period: ConsolePeriod, { firstAskAt, now = new Date() }: { firstAskAt: Date | null; now?: Date }) {
  const end = Math.min(now.getTime(), period.to ? period.to.getTime() : Number.POSITIVE_INFINITY);
  const holdsLaunch = firstAskAt !== null && (!period.from || firstAskAt >= period.from) && firstAskAt.getTime() < end;
  const weeks = holdsLaunch ? Math.max(1, Math.round((end - firstAskAt.getTime()) / (7 * DAY_MS))) : null;
  const when = weeks !== null && weeks <= 12 ? `in the first ${weeks === 1 ? "week" : `${weeks} weeks`}` : period.param === "all" ? "since launch" : `in ${period.label}`;
  if (!stats.asked) return `No intros asked for yet ${when}.`;
  const parts = [`${many(stats.asked, ["ask", "asks"])} and ${many(stats.made, ["intro", "intros"])} made ${when}`];
  if (stats.medianDays !== null) parts.push(`median ${daysWord(stats.medianDays)} from ask to intro`);
  for (const result of Object.values(INTRO_RESULTS)) if (stats.results[result]) parts.push(many(stats.results[result], RESULT_WORDS[result]));
  if (stats.pending) parts.push(many(stats.pending, ["outcome pending", "outcomes pending"]));
  return `${parts.join(", ")}.`;
}

const NAME_SUFFIX = /\s+(Founders|Network|Community)$/i;

// "Northwind intros, Q4 2026 to date: 6 asked, 3 made, 0 declined" (the page's title and the email's subject). No-answer
// expiries are not declines.
export function readReportTitle(communityName: string, period: ConsolePeriod, stats: IntroStats) {
  return `${communityName.replace(NAME_SUFFIX, "")} intros, ${period.label}: ${stats.asked} asked, ${stats.made} made, ${stats.declined} declined`;
}

export const REPORT_FOOT = "Names, states and dates only. The notes members write stay between the people in each intro. Nobody is introduced without saying yes.";

function breakdownLines(rows: readonly BreakdownRow[]) {
  return rows.map(
    (row) =>
      `  ${row.name}: ${row.asked} asked, ${row.made} introduced${row.declined ? `, ${row.declined} declined` : ""}${row.noAnswer ? `, ${row.noAnswer} no answer` : ""}${row.open ? `, ${row.open} open` : ""}`,
  );
}

// The partner copy's connectors (credited names only), or with `everyone` the admin's own view in the app.
export function readConnectorRows(stats: IntroStats, { everyone = false }: { everyone?: boolean } = {}) {
  const connectors = everyone ? stats.allConnectors : stats.connectors;
  return [...connectors.named, ...(connectors.others ? [connectors.others] : [])];
}

// The report as plain lines (the email's body), Founderhall's words.
export function readReportLines({ intros: stats, asks, summary }: ReportStats) {
  const connectors = readConnectorRows(stats);
  return [
    summary,
    "",
    `Asked for an intro: ${stats.asked}`,
    `Connector said yes: ${stats.connectorYes}${stats.asked ? ` (${percent(stats.connectorYes, stats.asked)}%)` : ""}`,
    `Introduced (both said yes): ${stats.made}${stats.connectorYes ? ` (${percent(stats.made, stats.connectorYes)}% of the connector yeses)` : ""}`,
    `Declined: ${stats.declined} (${stats.declinedConnector} at the connector, ${stats.declinedTarget} by the person asked for)`,
    `No answer in ${NO_ANSWER_DAYS} days: ${stats.noAnswer} (${stats.expiredConnector} at the connector, ${stats.expiredTarget} with the person asked for)`,
    ...(stats.withdrawn ? [`Withdrawn by the asker: ${stats.withdrawn}`] : []),
    `Still open: ${stats.open}`,
    `Median days from ask to intro: ${stats.medianDays === null ? "–" : roundTenth(stats.medianDays)}`,
    "",
    "What came of the intros:",
    ...Object.values(INTRO_RESULTS).map((result) => `  ${RESULT_ROWS[result]}: ${stats.results[result]}`),
    `  Found it helpful: ${stats.answered ? `${stats.helpful} of ${stats.answered} who answered (${percent(stats.helpful, stats.answered)}%)` : "no answers yet"}`,
    ...(stats.pending ? [`  Pending: ${stats.pending} (introduced less than ${stats.outcomeDays} days ago; asked at ${stats.outcomeDays} days)`] : []),
    ...(connectors.length ? ["", "Top connectors:", ...connectors.map((row) => `  ${row.name}: ${row.made} introduced, ${row.yes} yes of ${row.asked} asked`)] : []),
    "",
    "By what the founder needed:",
    ...breakdownLines(stats.needs),
    ...(stats.cohorts.length ? ["", "By cohort:", ...breakdownLines(stats.cohorts)] : []),
    ...(asks
      ? [
          "",
          "Asks & updates:",
          `  Asks posted: ${asks.posted} (${asks.answered} answered, ${asks.open} still open)`,
          `  Median time to first help: ${hoursWord(asks.medianHours)}`,
          `  Intros started from asks: ${asks.intros} (${asks.introsMade} made)`,
        ]
      : []),
  ];
}

// Founderhall's partner-report email: the subject is the report's title; the body is plain text.
export function renderReportEmailText(report: ReportStats, note: string | null) {
  return [
    ...(note ? [note, ""] : []),
    `${report.communityName}, partner report, ${report.period.label}`,
    "",
    ...readReportLines(report),
    "",
    REPORT_FOOT,
    "",
    `Sent by ${report.communityName} via its member portal.`,
  ].join("\n");
}

// The email's HTML part carries the same plain text, so both parts say the same words.
export function renderReportEmailHtml(text: string) {
  const escaped = text.replaceAll("&", "&amp;").replaceAll("<", "&lt;").replaceAll(">", "&gt;").replaceAll('"', "&quot;");
  return `<div style="font-family:Arial,sans-serif;font-size:15px;line-height:22px;color:#1B2420;white-space:pre-wrap;max-width:640px">${escaped}</div>`;
}

export type ReportValue = number | string | null;

// A cell that starts like a formula is quoted, so a spreadsheet shows it as text instead of running it.
const FORMULA_START = /^[=+\-@\t\r]/;
const NEEDS_QUOTES = /[",\n\r]/;

function toCsvCell(value: ReportValue) {
  const text = value === null ? "" : String(value);
  const safe = typeof value === "string" && FORMULA_START.test(text) ? `'${text}` : text;
  return NEEDS_QUOTES.test(safe) || safe !== text ? `"${safe.replaceAll('"', '""')}"` : safe;
}

const toCsvLine = (cells: readonly ReportValue[]) => cells.map(toCsvCell).join(",");

// The CSV: the period's numbers (measure, value), then each breakdown (group, asked, yes, introduced, declined,
// open), then the community as of today (`communityRows`, Community's own counts). Counts only.
export function renderReportCsv(report: ReportStats, communityRows: readonly { label: string; value: ReportValue }[] = []) {
  const { intros: stats, asks } = report;
  const measures: [string, string, ReportValue][] = [
    ["Intros", "Asked for an intro", stats.asked],
    ["Intros", "Connector said yes", stats.connectorYes],
    ["Intros", "Introduced", stats.made],
    ["Intros", "Declined at the connector", stats.declinedConnector],
    ["Intros", "Declined by the person asked for", stats.declinedTarget],
    ["Intros", `No answer in ${NO_ANSWER_DAYS} days`, stats.noAnswer],
    ["Intros", "Withdrawn by the asker", stats.withdrawn],
    ["Intros", "Still open", stats.open],
    ["Intros", "Median days from ask to intro", stats.medianDays === null ? null : roundTenth(stats.medianDays)],
    ...Object.values(INTRO_RESULTS).map((result): [string, string, ReportValue] => ["What came of the intros", RESULT_ROWS[result], stats.results[result]]),
    ["What came of the intros", "Found it helpful", stats.helpful],
    ["What came of the intros", "Answered", stats.answered],
    ["What came of the intros", "Pending", stats.pending],
    ...(asks
      ? ([
          ["Asks & updates", "Asks posted", asks.posted],
          ["Asks & updates", "Answered", asks.answered],
          ["Asks & updates", "Still open", asks.open],
          ["Asks & updates", "Median hours to first help", asks.medianHours === null ? null : roundTenth(asks.medianHours)],
          ["Asks & updates", "Intros started from asks", asks.intros],
          ["Asks & updates", "Intros made from asks", asks.introsMade],
        ] as [string, string, ReportValue][])
      : []),
  ];
  const breakdowns: [string, readonly BreakdownRow[]][] = [
    ["Top connectors", readConnectorRows(stats)],
    ["By sector", stats.sectors],
    ["By what the founder needed", stats.needs],
    ["By cohort", stats.cohorts],
  ];
  const lines = [
    toCsvLine(["section", "measure", report.period.label]),
    ...measures.map((cells) => toCsvLine(cells)),
    "",
    toCsvLine(["breakdown", "group", "asked", "yes", "introduced", "declined", "no answer", "open"]),
    ...breakdowns.flatMap(([title, rows]) => rows.map((row) => toCsvLine([title, row.name, row.asked, row.yes, row.made, row.declined, row.noAnswer, row.open]))),
    ...(communityRows.length ? ["", toCsvLine(["section", "measure", "As of today"]), ...communityRows.map(({ label, value }) => toCsvLine(["Community", label, value]))] : []),
  ];
  return `${lines.join("\r\n")}\r\n`;
}
