import "server-only";

import type { Database } from "../../platform/database/client.ts";
import { readBranding } from "../../platform/branding/branding.ts";
import { readSettings } from "../../platform/settings/store.ts";
import { INSTANCE_SETTING_KEYS } from "../../platform/settings/schema.ts";
import { readAskNeedCounts } from "../asks/reads-report.ts";
import { readIntroReports, type ReportPeriod } from "../intros/reads-report.ts";
import { REPORT_PERIOD_KEYS, REPORT_PERIOD_ORDER, type ReportPeriodKey } from "./contract-partner-report.ts";
import { readCommunityHealth } from "./reads-health.ts";
import { readEnabledModuleIds } from "../../platform/modules/enablement.ts";
import { asksManifest } from "../asks/manifest.ts";
import { introsManifest } from "../intros/manifest.ts";
import { networkManifest } from "../network/manifest.ts";

const MONTHS_PER_QUARTER = 3;
const SHORT_DATE = new Intl.DateTimeFormat("en-GB", { day: "numeric", month: "short", year: "numeric", timeZone: "UTC" });

function readQuarterStart(year: number, quarter: number) {
  return new Date(Date.UTC(year, quarter * MONTHS_PER_QUARTER, 1));
}

function readQuarterName(start: Date) {
  return `Q${Math.floor(start.getUTCMonth() / MONTHS_PER_QUARTER) + 1} ${start.getUTCFullYear()}`;
}

export type LabelledPeriod = ReportPeriod & { key: ReportPeriodKey; label: string; range: string };

// Quarters are calendar quarters in UTC, so every admin, server and partner reads the same boundaries.
export function readReportPeriods(now: Date): Record<ReportPeriodKey, LabelledPeriod> {
  const quarter = Math.floor(now.getUTCMonth() / MONTHS_PER_QUARTER);
  const thisStart = readQuarterStart(now.getUTCFullYear(), quarter);
  const lastStart = readQuarterStart(now.getUTCFullYear(), quarter - 1);
  const lastDay = new Date(thisStart.getTime() - 1);
  return {
    [REPORT_PERIOD_KEYS.thisQuarter]: {
      key: REPORT_PERIOD_KEYS.thisQuarter,
      label: `${readQuarterName(thisStart)} so far`,
      range: `${SHORT_DATE.format(thisStart)} to ${SHORT_DATE.format(now)}`,
      from: thisStart,
      to: null,
    },
    [REPORT_PERIOD_KEYS.lastQuarter]: {
      key: REPORT_PERIOD_KEYS.lastQuarter,
      label: readQuarterName(lastStart),
      range: `${SHORT_DATE.format(lastStart)} to ${SHORT_DATE.format(lastDay)}`,
      from: lastStart,
      to: thisStart,
    },
    [REPORT_PERIOD_KEYS.sinceLaunch]: { key: REPORT_PERIOD_KEYS.sinceLaunch, label: "Since launch", range: `to ${SHORT_DATE.format(now)}`, from: null, to: null },
  };
}

type ReportOptions = { isIntrosOn: boolean; isAsksOn: boolean; isNetworkOn: boolean };

async function readNeedsByPeriod(database: Database, periods: Record<ReportPeriodKey, LabelledPeriod>) {
  const entries = await Promise.all(REPORT_PERIOD_ORDER.map(async (key) => [key, await readAskNeedCounts(database, periods[key])] as const));
  return Object.fromEntries(entries) as Record<ReportPeriodKey, Awaited<ReturnType<typeof readAskNeedCounts>>>;
}

export async function readReportOptions(database: Database): Promise<ReportOptions> {
  const enabled = await readEnabledModuleIds(database, [introsManifest, asksManifest, networkManifest]);
  return { isIntrosOn: enabled.has(introsManifest.id), isAsksOn: enabled.has(asksManifest.id), isNetworkOn: enabled.has(networkManifest.id) };
}

// The whole partner report, read once. The page, the CSV and the email are all drawn from this object, so a number
// can't differ between them.
export async function readPartnerReport(database: Database, now = new Date()) {
  const { isIntrosOn, isAsksOn, isNetworkOn } = await readReportOptions(database);
  const periods = readReportPeriods(now);
  const [community, intros, needs, branding] = await Promise.all([
    readCommunityHealth(database, now),
    isIntrosOn ? readIntroReports(database, periods) : null,
    isAsksOn ? readNeedsByPeriod(database, periods) : null,
    readBranding(database),
  ]);
  return {
    communityName: branding.name,
    generatedAt: now.toISOString(),
    periods: REPORT_PERIOD_ORDER.map((key) => periods[key]),
    community: { ...community, isNetworkOn },
    intros,
    needs,
  };
}

export type PartnerReport = Awaited<ReturnType<typeof readPartnerReport>>;

const RECIPIENT_SEPARATOR = "\n";

export async function readPartnerReportSettings(database: Database) {
  const settings = await readSettings(database, [INSTANCE_SETTING_KEYS.partnerReportRecipients, INSTANCE_SETTING_KEYS.partnerReportSharedAt]);
  const recipients = settings.get(INSTANCE_SETTING_KEYS.partnerReportRecipients);
  return {
    recipients: recipients ? recipients.split(RECIPIENT_SEPARATOR).filter(Boolean) : [],
    sharedAt: settings.get(INSTANCE_SETTING_KEYS.partnerReportSharedAt) ?? null,
  };
}

export function joinRecipients(recipients: readonly string[]) {
  return recipients.join(RECIPIENT_SEPARATOR);
}
