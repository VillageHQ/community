import type { Metadata } from "next";

import { SelfHostBox } from "@/components/plumbing-notes";
import { StatusChecklist } from "@/components/ui/figures";
import { Pill, type PillTone } from "@/components/ui/pill";
import { requireAdmin } from "@/platform/auth/session";
import { PAGE_TITLES } from "@/platform/branding/page-metadata";
import { getDatabase } from "@/platform/database/client";
import { modulePage } from "@/platform/modules/module-page";
import { formatDayMonth, formatDayMonthTimeUtc } from "@/platform/text/format-date";
import { DoNotSendRemove } from "@/modules/admin/components/do-not-send-remove";
import { CheckDnsButton, MailDnsSettings } from "@/modules/admin/components/mail-forms";
import { readDnsCheckLine, readMailPageChecks, type MailPageCheck } from "@/modules/admin/mail-checks";
import { adminManifest } from "@/modules/admin/manifest";
import { MAIL_LOG_STATES, readMailOverview, type MailLogState, type MailOverview } from "@/modules/admin/reads-mail";
import { PRICING_URL } from "@/modules/network/components/admin-village-sections";
import { AdminSection } from "@/shell/admin-section";

export const metadata: Metadata = { title: PAGE_TITLES.adminMail };

const LOG_PILLS: Record<MailLogState, PillTone> = {
  [MAIL_LOG_STATES.sent]: "neutral",
  [MAIL_LOG_STATES.failed]: "needs",
  [MAIL_LOG_STATES.notSent]: "declined",
  [MAIL_LOG_STATES.waiting]: "open",
};

const SUPPRESSION_REASONS: Record<string, string> = { bounced: "Bounced", complained: "Marked as spam" };

// A ruled row with no avatar column: the subject (or address) over a 13 px line, a pill or button on the right.
const PLAIN_ROW = { gridTemplateColumns: "minmax(0,1fr) auto" };

function DnsLineValue({ value, toAdd }: Pick<MailPageCheck, "value" | "toAdd">) {
  return (
    <>
      {value}
      {toAdd ? (
        <span className="fh-mono mt-1 block">
          Add: {toAdd.type} {toAdd.name} {toAdd.value}
        </span>
      ) : null}
    </>
  );
}

function DnsChecklist({ mail }: { mail: MailOverview }) {
  const checks = readMailPageChecks({ mailService: mail.mailService, inbound: mail.inbound, dnsCheck: mail.settings.dnsCheck });
  return (
    <section className="fh-sheet">
      <div className="fh-sheet-head" style={{ alignItems: "center" }}>
        <h2 className="fh-h3">DNS checklist</h2>
        <CheckDnsButton />
      </div>
      <p className="fh-small fh-muted">{readDnsCheckLine(mail.settings.dnsCheck)}</p>
      <div style={{ marginTop: 8 }}>
        <StatusChecklist items={checks.map(({ key, state, label, value, note, toAdd }) => ({ key, state, title: label, value: <DnsLineValue value={value} toAdd={toAdd} />, status: note }))} />
      </div>
    </section>
  );
}

function LastThirtyDays({ counts }: { counts: MailOverview["lastThirtyDays"] }) {
  return (
    <section className="fh-sheet">
      <h2 className="fh-h3">Last 30 days</h2>
      <p className="fh-small" style={{ marginTop: 6 }}>
        <b>{counts.sent}</b> sent · <b>{counts.failed}</b> failed · <b>{counts.notSent}</b> not sent (on a do-not-send list) · <b>{counts.repliesIn}</b> replies in
      </p>
    </section>
  );
}

// Community's do-not-send list holds addresses that bounced or marked an email as spam; an admin can take one off.
function DoNotSendList({ entries }: { entries: MailOverview["suppressions"] }) {
  return (
    <section className="fh-sheet">
      <h2 className="fh-h3">Do-not-send list</h2>
      {entries.length === 0 ? (
        <p className="fh-small fh-muted" style={{ marginTop: 6 }}>
          Nobody yet. Addresses that bounce or mark an email as spam land here.
        </p>
      ) : (
        <div className="fh-rows" style={{ marginTop: 10 }} aria-label="Do-not-send list">
          {entries.map(({ email, reason, createdAt }) => (
            <div key={email} className="fh-r" style={PLAIN_ROW}>
              <span className="fh-who">
                <b className="fh-plain wrap-anywhere">{email}</b>
                <span>
                  {SUPPRESSION_REASONS[reason] ?? reason} · since {formatDayMonth(createdAt)}
                </span>
              </span>
              <span className="fh-end">
                <DoNotSendRemove email={email} />
              </span>
            </div>
          ))}
        </div>
      )}
    </section>
  );
}

function SendingLog({ mail }: { mail: MailOverview }) {
  return (
    <section className="fh-sheet fh-c12">
      <h2 className="fh-h3">Sending log</h2>
      {mail.log.length === 0 ? (
        <p className="fh-small fh-muted" style={{ marginTop: 6 }}>
          Nothing sent yet.
        </p>
      ) : (
        <div className="fh-rows" style={{ marginTop: 12 }} aria-label="Sending log">
          {mail.log.map(({ id, subject, toEmail, kind, state, at }) => (
            <div key={id} className="fh-r" style={PLAIN_ROW}>
              <span className="fh-who">
                <b className="fh-plain">{subject}</b>
                <span>
                  to {toEmail} from {mail.senderEmail} · {kind}
                </span>
              </span>
              <span className="fh-end">
                <Pill tone={LOG_PILLS[state]}>{state}</Pill>
                <small>{formatDayMonthTimeUtc(at)}</small>
              </span>
            </div>
          ))}
        </div>
      )}
      <p className="fh-small fh-muted" style={{ marginTop: 12 }}>
        Subjects and addresses only; message text is never kept in the log.
      </p>
    </section>
  );
}

// Set up › Mail (Founderhall's mailPage): who mail comes from, the DNS checklist, the DNS settings, a test, the last 30
// days, the do-not-send list and the sending log. Community sends every kind of email from one address.
export default modulePage(adminManifest, async function AdminMailPage() {
  await requireAdmin();
  const mail = await readMailOverview(getDatabase(), process.env);
  const sender = mail.senderEmail;
  return (
    <AdminSection
      title="Mail"
      description={`${mail.communityName} sends from its own domain: invites and sign-in links from ${sender}, intros from ${sender}, message emails from ${sender}. Replies come back through ${mail.replyDomain}.`}
    >
      <div className="fh-grid">
        <div className="fh-c7 fh-stack">
          <DnsChecklist mail={mail} />
        </div>
        <div className="fh-c5 fh-stack">
          <SelfHostBox pricingUrl={PRICING_URL} />
          <MailDnsSettings saved={{ dkimSelector: mail.settings.dkimSelector, replyDomain: mail.settings.replyDomain }} defaultReplyDomain={mail.defaultReplyDomain} />
          <LastThirtyDays counts={mail.lastThirtyDays} />
          <DoNotSendList entries={mail.suppressions} />
        </div>
        <SendingLog mail={mail} />
      </div>
    </AdminSection>
  );
});
