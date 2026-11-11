import "server-only";

import { and, count, desc, inArray, isNull, max, sql } from "drizzle-orm";

import type { Database } from "../platform/database/client.ts";
import { REPORT_TARGETS } from "../modules/admin/contract.ts";
import { readReportPeriods } from "../modules/admin/reads-partner-report.ts";
import { contentReport } from "../modules/admin/schema.ts";
import { REPORT_PERIOD_KEYS } from "../modules/admin/contract-partner-report.ts";
import { readAskAdminCounts, readOldestUnansweredAsks, readPinnedAskLines } from "../modules/asks/reads-admin.ts";
import { readWeeklyAllowance } from "../modules/asks/reads.ts";

const REPORTED_SHOWN = 10;

// Open reports on asks and their answers, one line per reported thing, newest report first. The copy is the one the
// reports queue shows; removing from here resolves every open report on it, as the queue does.
async function readReportedAsks(database: Database) {
  const askTargets = [REPORT_TARGETS.ask, REPORT_TARGETS.askAnswer];
  const rows = await database
    .select({
      targetType: contentReport.targetType,
      targetId: contentReport.targetId,
      reportId: sql<string>`(array_agg(${contentReport.id} order by ${contentReport.createdAt} desc))[1]`,
      body: sql<string>`(array_agg(${contentReport.body} order by ${contentReport.createdAt} desc))[1]`,
      reportCount: count(),
      lastReportedAt: max(contentReport.createdAt),
    })
    .from(contentReport)
    .where(and(isNull(contentReport.resolvedAt), inArray(contentReport.targetType, askTargets)))
    .groupBy(contentReport.targetType, contentReport.targetId)
    .orderBy(desc(max(contentReport.createdAt)))
    .limit(REPORTED_SHOWN);
  return rows.map(({ targetType, reportId, body, reportCount, lastReportedAt }) => ({
    reportId,
    targetType: targetType === REPORT_TARGETS.askAnswer ? REPORT_TARGETS.askAnswer : REPORT_TARGETS.ask,
    body,
    reportCount,
    lastReportedAt: (lastReportedAt ?? new Date()).toISOString(),
  }));
}

export type ReportedAsk = Awaited<ReturnType<typeof readReportedAsks>>[number];

// Everything Admin › Asks shows. The quarter is the partner report's, so the two pages count the same asks.
export async function readAdminAsks(database: Database, now = new Date()) {
  const quarter = readReportPeriods(now)[REPORT_PERIOD_KEYS.thisQuarter];
  const [counts, oldest, pinned, reported, weeklyAllowance] = await Promise.all([
    readAskAdminCounts(database, quarter),
    readOldestUnansweredAsks(database, now),
    readPinnedAskLines(database, now),
    readReportedAsks(database),
    readWeeklyAllowance(database),
  ]);
  return { quarterLabel: quarter.label, counts, oldest, pinned, reported, weeklyAllowance };
}

export type AdminAsks = Awaited<ReturnType<typeof readAdminAsks>>;
