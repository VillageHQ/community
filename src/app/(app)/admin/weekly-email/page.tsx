import { CalendarClock, Mail, MailX } from "lucide-react";
import type { Metadata } from "next";
import Link from "next/link";

import { CHIP_CLASSES } from "@/components/ui/chip";
import { CardDescription } from "@/components/ui/card";
import { Tag } from "@/components/ui/tag";
import { SettingCard } from "@/modules/admin/components/setting-card";
import { WeeklyScheduleForm, WeeklyTestButton } from "@/modules/admin/components/weekly-email-controls";
import { adminManifest } from "@/modules/admin/manifest";
import { requireAdmin } from "@/platform/auth/session";
import { PAGE_TITLES } from "@/platform/branding/page-metadata";
import { getDatabase } from "@/platform/database/client";
import { readResendConfig } from "@/platform/email/resend";
import { ROUTES } from "@/platform/http/routes";
import { modulePage } from "@/platform/modules/module-page";
import { describeSchedule, readLocalParts, readNextSend, WEEKDAYS } from "@/platform/weekly-email/schedule";
import { readWeeklySchedule } from "@/platform/weekly-email/schedule-store";
import { readReplyDomain } from "@/platform/weekly-email/tokens";
import { AdminSection } from "@/shell/admin-section";
import { previewWeeklyEmail, WEEKLY_PREVIEW_SOURCES, type WeeklyPreviewSource } from "@/shell/weekly-email";

export const metadata: Metadata = { title: PAGE_TITLES.adminWeeklyEmail };

type WeeklyEmailPageProps = { searchParams: Promise<{ preview?: string }> };

const PREVIEW_CHOICES: { source: WeeklyPreviewSource; label: string }[] = [
  { source: WEEKLY_PREVIEW_SOURCES.mine, label: "My week" },
  { source: WEEKLY_PREVIEW_SOURCES.sample, label: "A made-up member" },
];

function readSource(value: string | undefined): WeeklyPreviewSource {
  return value === WEEKLY_PREVIEW_SOURCES.sample ? WEEKLY_PREVIEW_SOURCES.sample : WEEKLY_PREVIEW_SOURCES.mine;
}

function readTimeZones() {
  return Intl.supportedValuesOf("timeZone");
}

function describeNextSend(at: Date, timeZone: string) {
  const local = readLocalParts(at, timeZone);
  return `${WEEKDAYS[local.weekday] ?? ""} ${local.date}, ${String(local.hour).padStart(2, "0")}:00 ${timeZone}`;
}

export default modulePage(adminManifest, async function AdminWeeklyEmailPage({ searchParams }: WeeklyEmailPageProps) {
  const admin = await requireAdmin();
  const source = readSource((await searchParams).preview);
  const database = getDatabase();
  const [schedule, preview] = await Promise.all([readWeeklySchedule(database), previewWeeklyEmail(database, process.env, admin, source)]);
  const isEmailOn = readResendConfig(process.env) !== null;
  const canReply = readReplyDomain(process.env) !== null;
  const nextSend = readNextSend(new Date(), schedule);

  return (
    <AdminSection title="Weekly email" description="One email a week to each member, with only what needs them.">
      <div className="grid items-start gap-5 lg:grid-cols-[minmax(0,1fr)_340px]">
        <SettingCard
          title="Preview"
          tag={
            <Tag tone={isEmailOn ? "sage" : "gold"}>
              {isEmailOn ? <Mail aria-hidden="true" /> : <MailX aria-hidden="true" />}
              {isEmailOn ? "Email on" : "Email off"}
            </Tag>
          }
        >
          <CardDescription>
            Built from your own week or from a made-up member, never from another member&apos;s. Its buttons only open the app.
          </CardDescription>
          <nav aria-label="Preview as" className="flex flex-wrap gap-2">
            {PREVIEW_CHOICES.map((choice) => (
              <Link
                key={choice.source}
                href={`${ROUTES.adminWeeklyEmail}?preview=${choice.source}`}
                aria-current={choice.source === source ? "page" : undefined}
                className={CHIP_CLASSES}
              >
                {choice.label}
              </Link>
            ))}
          </nav>
          {preview.isEmpty ? (
            <p className="type-small rounded-field bg-muted px-4 py-3 text-foreground-soft">
              Nothing needs {source === WEEKLY_PREVIEW_SOURCES.mine ? "you" : "this member"} this week, so this email wouldn&apos;t be sent.
            </p>
          ) : null}
          <p className="type-small wrap-anywhere">
            <span className="font-bold">Subject:</span> {preview.subject}
          </p>
          <iframe
            title="Weekly email preview"
            sandbox=""
            srcDoc={preview.html}
            className="h-[560px] w-full rounded-field bg-white shadow-[inset_0_0_0_1.5px_var(--input)]"
          />
          <details className="type-small">
            <summary className="cursor-pointer font-bold">Plain text version</summary>
            <pre className="mt-2 rounded-field bg-muted p-4 whitespace-pre-wrap wrap-anywhere">{preview.text}</pre>
          </details>
        </SettingCard>
        <div className="grid gap-5">
          <SettingCard
            title="When it goes out"
            tag={
              <Tag>
                <CalendarClock aria-hidden="true" />
                {describeSchedule(schedule)}
              </Tag>
            }
          >
            {nextSend ? <CardDescription>Next: {describeNextSend(nextSend.at, schedule.timeZone)}.</CardDescription> : null}
            <WeeklyScheduleForm schedule={schedule} timeZones={readTimeZones()} />
          </SettingCard>
          <SettingCard title="Try it" tag={null}>
            <CardDescription>
              Sends your own week to your own address, with working links{canReply ? " and reply codes" : ""}.
            </CardDescription>
            <WeeklyTestButton />
          </SettingCard>
          <SettingCard title="How members answer" tag={null}>
            <ul className="type-small grid list-disc gap-1.5 pl-5 text-foreground-soft">
              <li>Members with nothing to answer get no email that week.</li>
              <li>Each item has buttons that open a page to confirm. Opening the link alone changes nothing.</li>
              {canReply ? (
                <li>Members can also reply with codes like HELP 1 or NO 2 on the first lines. Each item is answered once.</li>
              ) : (
                <li>
                  To let members answer by replying, set <code className="font-bold">RESEND_REPLY_DOMAIN</code> to a domain Resend receives email on, and
                  point Resend&apos;s webhook at this app.
                </li>
              )}
              <li>Each member can turn it off from their card or from the email.</li>
            </ul>
          </SettingCard>
        </div>
      </div>
    </AdminSection>
  );
});
