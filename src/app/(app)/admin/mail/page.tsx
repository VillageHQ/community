import type { Metadata } from "next";

import { Card, CardDescription, CardTitle } from "@/components/ui/card";
import { Tag } from "@/components/ui/tag";
import { getDatabase } from "@/platform/database/client";
import { requireAdmin } from "@/platform/auth/session";
import { PAGE_TITLES } from "@/platform/branding/page-metadata";
import { OUTBOX_STATUSES } from "@/platform/email/outbox";
import { modulePage } from "@/platform/modules/module-page";
import { formatDateAndTimeUtc } from "@/platform/text/format-date";
import { DoNotSendRemove } from "@/modules/admin/components/do-not-send-remove";
import { EMAIL_LOG_PAGE_SIZE } from "@/modules/admin/contract-email";
import { adminManifest } from "@/modules/admin/manifest";
import { readDoNotSendList, readEmailLog } from "@/modules/admin/reads-email";
import { AdminSection } from "@/shell/admin-section";

type EmailRow = Awaited<ReturnType<typeof readEmailLog>>[number];

const STATUS_TAGS: Record<string, { text: string; tone: "sage" | "gold" | "destructive" | "neutral" }> = {
  [OUTBOX_STATUSES.sent]: { text: "Sent", tone: "sage" },
  [OUTBOX_STATUSES.pending]: { text: "Waiting to send", tone: "neutral" },
  [OUTBOX_STATUSES.sending]: { text: "Sending", tone: "neutral" },
  [OUTBOX_STATUSES.failed]: { text: "Couldn't be sent", tone: "destructive" },
  [OUTBOX_STATUSES.skipped]: { text: "Not sent", tone: "gold" },
};

const REASONS: Record<string, string> = { bounced: "Bounced", complained: "Marked as spam" };

// "weekly_email" reads as "Weekly email".
function readKindLabel(kind: string) {
  const words = kind.replaceAll("_", " ");
  return words.charAt(0).toUpperCase() + words.slice(1);
}

function SentList({ emails }: { emails: EmailRow[] }) {
  if (emails.length === 0) return <CardDescription>No emails yet.</CardDescription>;
  return (
    <ul className="grid gap-2" aria-label="Sent emails">
      {emails.map(({ id, toEmail, kind, status, createdAt, finishedAt }) => {
        const tag = STATUS_TAGS[status] ?? { text: status, tone: "neutral" as const };
        return (
          <li key={id} className="grid gap-1.5 rounded-field bg-muted px-4 py-3 sm:grid-cols-[minmax(0,1fr)_auto] sm:items-center sm:gap-4">
            <p className="min-w-0 wrap-anywhere">
              <span className="type-label block">{toEmail}</span>
              <span className="type-small block text-foreground-soft">
                {readKindLabel(kind)} · {formatDateAndTimeUtc(finishedAt ?? createdAt)}
              </span>
            </p>
            <Tag tone={tag.tone} className="justify-self-start">
              {tag.text}
            </Tag>
          </li>
        );
      })}
    </ul>
  );
}

function DoNotSendList({ entries }: { entries: Awaited<ReturnType<typeof readDoNotSendList>> }) {
  if (entries.length === 0) return <CardDescription>Nobody is on it.</CardDescription>;
  return (
    <ul className="grid gap-2" aria-label="Do-not-send list">
      {entries.map(({ email, reason, createdAt }) => (
        <li key={email} className="flex flex-wrap items-center justify-between gap-3 rounded-field bg-muted px-4 py-3">
          <p className="min-w-0 wrap-anywhere">
            <span className="type-label block">{email}</span>
            <span className="type-small block text-foreground-soft">
              {REASONS[reason] ?? reason} · since {formatDateAndTimeUtc(createdAt)}
            </span>
          </p>
          <DoNotSendRemove email={email} />
        </li>
      ))}
    </ul>
  );
}

export const metadata: Metadata = { title: PAGE_TITLES.adminMail };

export default modulePage(adminManifest, async function AdminEmailPage() {
  await requireAdmin();
  const database = getDatabase();
  const [emails, doNotSend] = await Promise.all([readEmailLog(database), readDoNotSendList(database)]);
  return (
    <AdminSection title="Email" description="What the app sent, and the addresses it won't send optional email to.">
      <div className="grid items-start gap-5 lg:grid-cols-[minmax(0,1fr)_minmax(0,0.8fr)]">
        <Card className="grid gap-3">
          <CardTitle>Sent emails</CardTitle>
          <CardDescription>The latest {EMAIL_LOG_PAGE_SIZE}, newest first. Who, what and when; never what the email said.</CardDescription>
          <SentList emails={emails} />
        </Card>
        <Card className="grid gap-3">
          <CardTitle>Do-not-send list</CardTitle>
          <CardDescription>
            Addresses that bounced or marked an email as spam. They still get what they need to sign in, but no optional email. Remove one when the
            person asks, or the address works again.
          </CardDescription>
          <DoNotSendList entries={doNotSend} />
        </Card>
      </div>
    </AdminSection>
  );
});
