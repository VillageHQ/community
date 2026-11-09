import { ASK_CATEGORIES, type AskCategory } from "../asks/contract.ts";
import { escapeHtml, toSingleLine } from "../../platform/email/email-text.ts";
import { TOP_CONNECTOR_LIMIT, type IntroReport } from "../intros/reads-report.ts";
import type { PartnerReport } from "./reads-partner-report.ts";

// Every line of the partner report, in order, built once from the one read. The page, the CSV and the email all
// render these rows, so the same number always has the same label and value everywhere.

export type ReportValue = number | string | null;

export type ReportRow = { label: string; note?: string; values: ReportValue[]; isStrong?: boolean };

export type ReportSection = { id: string; title: string; description: string; rows: ReportRow[] };

const NEED_LABELS: Record<AskCategory, string> = {
  [ASK_CATEGORIES.intro]: "Intros",
  [ASK_CATEGORIES.hire]: "Hires",
  [ASK_CATEGORIES.customer]: "Customers",
  [ASK_CATEGORIES.advice]: "Advice",
  [ASK_CATEGORIES.other]: "Other",
};

function introRow(intros: IntroReport[], label: string, read: (intro: IntroReport) => ReportValue, extra: Partial<ReportRow> = {}): ReportRow {
  return { label, values: intros.map(read), ...extra };
}

function readPercent(value: number | null) {
  return value === null ? null : `${value}%`;
}

type NamedConnector = { id: string; name: string };

function readIntroSections(intros: IntroReport[], namedConnectors: readonly NamedConnector[]): ReportSection[] {
  return [
    {
      id: "intros",
      title: "Intros",
      description: "Each period counts the intros asked for in it, so its lines add up: asked = introduced + declined + expired + withdrawn + still open.",
      rows: [
        introRow(intros, "Asked for", ({ asked }) => asked, { isStrong: true }),
        introRow(intros, "Connector said yes", ({ connectorSaidYes }) => connectorSaidYes),
        introRow(intros, "Person asked for said yes", ({ targetSaidYes }) => targetSaidYes),
        introRow(intros, "Introduced", ({ introduced }) => introduced, { isStrong: true }),
        introRow(intros, "Declined by the connector", ({ declinedByConnector }) => declinedByConnector),
        introRow(intros, "Declined by the person asked for", ({ declinedByTarget }) => declinedByTarget),
        introRow(intros, "Expired, connector never answered", ({ expiredAtConnector }) => expiredAtConnector, { note: "Not a decline. Includes asks closed because a member left." }),
        introRow(intros, "Expired, person asked for never answered", ({ expiredAtTarget }) => expiredAtTarget, { note: "Not a decline." }),
        introRow(intros, "Expired before the connector made the intro", ({ expiredBeforeIntro }) => expiredBeforeIntro, { note: "Not a decline. Both had said yes, or it predates asking the person." }),
        introRow(intros, "Withdrawn by the member who asked", ({ withdrawn }) => withdrawn),
        introRow(intros, "Still open", ({ open }) => open),
        introRow(intros, "Median days from ask to intro", ({ medianDaysToIntroduced }) => medianDaysToIntroduced),
      ],
    },
    {
      id: "outcomes",
      title: "What came of them",
      description: "About two weeks after an intro, the member who asked is asked if it helped. They can tick what came of it.",
      rows: [
        introRow(intros, "Said it helped", ({ helpedPercent }) => readPercent(helpedPercent), {
          isStrong: true,
          note: "Of the members who answered yes or no.",
        }),
        introRow(intros, "Yes, it helped", ({ helped }) => helped),
        introRow(intros, "No, it didn't", ({ notHelped }) => notHelped),
        introRow(intros, "Too early to say", ({ notYet }) => notYet),
        introRow(intros, "Not answered yet", ({ unanswered }) => unanswered),
        introRow(intros, "A customer conversation", ({ results }) => results.customer),
        introRow(intros, "A hire", ({ results }) => results.hire),
        introRow(intros, "An investor meeting", ({ results }) => results.investor),
      ],
    },
    {
      id: "connectors",
      title: "Top connectors",
      description: `Intros made, per connector. Only members who turned on "credit me in reports" are named, at most ${TOP_CONNECTOR_LIMIT}; everyone else is counted together.`,
      rows: [
        ...namedConnectors.map(({ id, name }) => introRow(intros, name, ({ connectors }) => connectors.named.find((connector) => connector.id === id)?.introduced ?? 0)),
        introRow(intros, "Other connectors, not named", ({ connectors }) => connectors.others.connectors),
        introRow(intros, "Intros made by them", ({ connectors }) => connectors.others.introduced),
      ],
    },
  ];
}

function readNeedSection(needs: NonNullable<PartnerReport["needs"]>, periods: PartnerReport["periods"]): ReportSection | null {
  const perPeriod = periods.map(({ key }) => needs[key]);
  const shown = Object.values(ASK_CATEGORIES).filter((category) => perPeriod.some((counts) => (counts.find((row) => row.category === category)?.posted ?? 0) > 0));
  if (shown.length === 0) return null;
  const read = (counts: (typeof perPeriod)[number], category: AskCategory) => counts.find((row) => row.category === category);
  return {
    id: "needs",
    title: "Asks by need",
    description: "What members asked the community for on the Asks board, and how many were solved here.",
    rows: shown.flatMap((category) => [
      { label: `${NEED_LABELS[category]}: asked`, values: perPeriod.map((counts) => read(counts, category)?.posted ?? 0) },
      { label: `${NEED_LABELS[category]}: solved here`, values: perPeriod.map((counts) => read(counts, category)?.solvedHere ?? 0) },
    ]),
  };
}

export function readPeriodSections(report: PartnerReport): ReportSection[] {
  const intros = report.intros ? readIntroSections(report.periods.map(({ key }) => report.intros!.periods[key]), report.intros.namedConnectors) : [];
  const needs = report.needs ? readNeedSection(report.needs, report.periods) : null;
  return [...intros, ...(needs ? [needs] : [])];
}

// The community's numbers today. They aren't per period: a count of members or invites is a snapshot.
export function readCommunitySection({ community }: PartnerReport): ReportSection {
  const { members, sharing, synced, invites, windows, isNetworkOn } = community;
  return {
    id: "community",
    title: "Community",
    description: "As of today. An active member posted, replied, reacted, sent a message or asked for an intro.",
    rows: [
      { label: "Members", values: [members], isStrong: true },
      ...(isNetworkOn
        ? [
            { label: "Agreed to share their network", values: [sharing] },
            { label: "Network synced", values: [synced] },
          ]
        : []),
      { label: "Invites accepted", values: [invites.accepted], note: invites.acceptedPercent === null ? undefined : `${invites.acceptedPercent}% of invites sent.` },
      { label: "Invites still waiting", values: [invites.pending] },
      { label: "Invites expired", values: [invites.expired] },
      ...windows.map(({ days, activeMembers }) => ({ label: `Active members, last ${days} days`, values: [activeMembers] })),
      ...windows.map(({ days, posts }) => ({ label: `Posts, last ${days} days`, values: [posts] })),
    ],
  };
}

export function formatReportValue(value: ReportValue) {
  return value === null ? "–" : String(value);
}

// A cell that starts like a formula is quoted, so a spreadsheet shows it as text instead of running it.
const FORMULA_START = /^[=+\-@\t\r]/;
const NEEDS_QUOTES = /[",\n\r]/;

function toCsvCell(value: ReportValue) {
  const text = value === null ? "" : String(value);
  const safe = typeof value === "string" && FORMULA_START.test(text) ? `'${text}` : text;
  return NEEDS_QUOTES.test(safe) || safe !== text ? `"${safe.replaceAll('"', '""')}"` : safe;
}

function toCsvLine(cells: ReportValue[]) {
  return cells.map(toCsvCell).join(",");
}

export function renderPartnerReportCsv(report: PartnerReport) {
  const community = readCommunitySection(report);
  const lines = [
    toCsvLine(["section", "measure", ...report.periods.map(({ label }) => label)]),
    ...readPeriodSections(report).flatMap(({ title, rows }) => rows.map(({ label, values }) => toCsvLine([title, label, ...values]))),
    "",
    toCsvLine(["section", "measure", `As of ${report.generatedAt.slice(0, 10)}`]),
    ...community.rows.map(({ label, values }) => toCsvLine([community.title, label, ...values])),
  ];
  return `${lines.join("\r\n")}\r\n`;
}

export function readPartnerReportFileName(report: PartnerReport) {
  const slug = toSingleLine(report.communityName).toLowerCase().replace(/[^a-z0-9]+/g, "-").replace(/^-|-$/g, "") || "community";
  return `${slug}-partner-report-${report.generatedAt.slice(0, 10)}.csv`;
}

const CELL_STYLE = "padding:6px 8px;border-bottom:1px solid #e3e8e7;text-align:right;white-space:nowrap";
const LABEL_STYLE = "padding:6px 8px;border-bottom:1px solid #e3e8e7;text-align:left";

function renderHtmlTable(section: ReportSection, headings: string[]) {
  const head = [`<th style="${LABEL_STYLE}"></th>`, ...headings.map((heading) => `<th style="${CELL_STYLE}">${escapeHtml(heading)}</th>`)].join("");
  const body = section.rows
    .map(({ label, values, isStrong }) => {
      const weight = isStrong ? "font-weight:700;" : "";
      const cells = values.map((value) => `<td style="${CELL_STYLE};${weight}">${escapeHtml(formatReportValue(value))}</td>`).join("");
      return `<tr><td style="${LABEL_STYLE};${weight}">${escapeHtml(label)}</td>${cells}</tr>`;
    })
    .join("");
  return [
    `<h2 style="font-size:18px;line-height:24px;margin:28px 0 4px">${escapeHtml(section.title)}</h2>`,
    `<p style="margin:0 0 8px;font-size:14px;line-height:20px;color:#566463">${escapeHtml(section.description)}</p>`,
    `<table style="border-collapse:collapse;width:100%;font-size:14px;line-height:20px"><thead><tr>${head}</tr></thead><tbody>${body}</tbody></table>`,
  ].join("");
}

function renderTextSection(section: ReportSection, headings: string[]) {
  const rows = section.rows.map(({ label, values }) => `${label}: ${values.map((value, index) => (headings.length > 1 ? `${formatReportValue(value)} (${headings[index]})` : formatReportValue(value))).join(", ")}`);
  return [section.title.toUpperCase(), ...rows].join("\n");
}

export function renderPartnerReportEmail(report: PartnerReport, { note, senderName }: { note: string | null; senderName: string }) {
  const community = toSingleLine(report.communityName);
  const sender = toSingleLine(senderName);
  const [current] = report.periods;
  const subject = `${community} partner report, ${current?.label ?? "today"}`;
  const headings = report.periods.map(({ label }) => label);
  const periodSections = readPeriodSections(report);
  const communitySection = readCommunitySection(report);
  const opening = `${sender} sent you the ${community} partner report. It holds counts only: who asked whom stays private.`;
  const html = [
    `<div style="font-family:Arial,sans-serif;font-size:16px;line-height:24px;color:#0c2427;max-width:640px;margin:0 auto;padding:24px">`,
    `<h1 style="font-size:24px;line-height:30px;margin:0 0 12px">${escapeHtml(community)} partner report</h1>`,
    `<p style="margin:0 0 12px">${escapeHtml(opening)}</p>`,
    note ? `<p style="margin:0 0 12px;padding:12px 16px;border-left:3px solid #c9d3d1;white-space:pre-line">${escapeHtml(note)}</p>` : "",
    ...periodSections.map((section) => renderHtmlTable(section, headings)),
    renderHtmlTable(communitySection, [`As of ${report.generatedAt.slice(0, 10)}`]),
    `</div>`,
  ].join("");
  const text = [
    opening,
    ...(note ? [note] : []),
    ...periodSections.map((section) => renderTextSection(section, headings)),
    renderTextSection(communitySection, [`As of ${report.generatedAt.slice(0, 10)}`]),
  ].join("\n\n");
  return { subject, html, text };
}
