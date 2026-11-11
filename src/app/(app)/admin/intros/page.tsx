import { FileChartColumn } from "lucide-react";
import type { Metadata } from "next";
import Link from "next/link";

import { Button, ButtonRow } from "@/components/ui/button";
import { ChipCount, ChipRow, CHIP_CLASSES } from "@/components/ui/chip";
import { readBranding } from "@/platform/branding/branding";
import { getDatabase } from "@/platform/database/client";
import { ROUTES } from "@/platform/http/routes";
import { requireAdmin } from "@/platform/auth/session";
import { modulePage } from "@/platform/modules/module-page";

import { adminManifest } from "@/modules/admin/manifest";
import { parseConsolePeriod, readConsolePeriod } from "@/modules/admin/console-periods";
import { PeriodSwitch } from "@/modules/admin/components/period-switch";
import { IntroLogTable } from "@/modules/admin/components/intro-log-table";
import { AskAllowanceSetting, IntroLogCsvButton, OutcomeDaysSetting } from "@/modules/admin/components/intro-log-controls";
import { countIntroLog, INTRO_LOG_FILTER_LABELS, INTRO_LOG_FILTERS, parseIntroLogFilter, readIntroLog, type IntroLogFilter } from "@/modules/admin/reads-intro-log";
import { readWeeklyAllowance } from "@/modules/asks/reads";
import { OUTCOME_REMINDER_AFTER_DAYS } from "@/modules/intros/contract";
import { readOutcomeDays } from "@/modules/intros/reads-outcome-days";

export const metadata: Metadata = { title: "Intro log" };

type SearchParams = Promise<{ period?: string; f?: string }>;

const FILTER_ORDER = Object.values(INTRO_LOG_FILTERS) as IntroLogFilter[];

// Founderhall's Intro log: every intro asked in the period, its state and dates, the weekly allowance and the outcome
// question's timing. Admins see who asked whom; never the note.
export default modulePage(adminManifest, async function AdminIntroLogPage({ searchParams }: { searchParams: SearchParams }) {
  await requireAdmin();
  const { period: periodValue, f } = await searchParams;
  const period = readConsolePeriod(parseConsolePeriod(periodValue));
  const filter = parseIntroLogFilter(f);
  const database = getDatabase();
  const [rows, branding, weeklyAllowance, outcomeDays] = await Promise.all([
    readIntroLog(database, { from: period.from, to: period.to }),
    readBranding(database),
    readWeeklyAllowance(database),
    readOutcomeDays(database),
  ]);
  const counts = countIntroLog(rows);
  const shown = filter === INTRO_LOG_FILTERS.all ? rows : rows.filter((row) => row.filter === filter);

  return (
    <>
      <div className="fh-pagehead">
        <h1 className="fh-h1">Intro log</h1>
        <p className="fh-lede">Every intro asked for in {branding.name}, with its state and dates. The notes members write stay between the people in each intro.</p>
        <div className="fh-period">
          <PeriodSwitch basePath={ROUTES.adminIntroLog} current={period.param} extra={filter === INTRO_LOG_FILTERS.all ? "" : `&f=${filter}`} />
          <ButtonRow>
            <Button asChild variant="primary" size="sm">
              <Link href={`${ROUTES.adminReport}?period=${period.param}`}>
                <FileChartColumn aria-hidden="true" className="fh-i fh-xs" strokeWidth={1.5} />
                Partner report
              </Link>
            </Button>
            <IntroLogCsvButton period={period.param} />
          </ButtonRow>
        </div>
      </div>
      <ChipRow role="group" aria-label="Filter by state">
        {FILTER_ORDER.map((key) => (
          <Link key={key} className={CHIP_CLASSES} href={`${ROUTES.adminIntroLog}?period=${period.param}&f=${key}`} aria-pressed={filter === key}>
            {INTRO_LOG_FILTER_LABELS[key]} <ChipCount>{counts[key]}</ChipCount>
          </Link>
        ))}
      </ChipRow>
      <IntroLogTable rows={shown} hasAny={rows.length > 0} />
      <AskAllowanceSetting weeklyAllowance={weeklyAllowance} />
      <OutcomeDaysSetting outcomeDays={outcomeDays} reminderDays={OUTCOME_REMINDER_AFTER_DAYS} />
    </>
  );
});
