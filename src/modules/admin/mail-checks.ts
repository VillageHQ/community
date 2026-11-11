import { DNS_CHECK_STATUSES, type DnsCheck, type DnsCheckLine } from "../../platform/email/dns-check-contract.ts";
import { formatDayMonth } from "../../platform/text/format-date.ts";

// Founderhall's mail checklist (mailChecks): the mail service, the sending domain, recent sends and the last live DNS
// check, each with a value line and a status word. Settings shows it; Mail shows the DNS rows.
export const MAIL_CHECK_STATES = { pass: "ok", watch: "watch", fail: "fail" } as const;
export type MailCheckState = (typeof MAIL_CHECK_STATES)[keyof typeof MAIL_CHECK_STATES];
export type MailCheck = { key: string; label: string; state: MailCheckState; value: string; note: string };

// Community sends through Resend's API, not SMTP: the row says so.
export const MAIL_SERVICE_LABEL = "Mail service (Resend)";

export type MailCheckFacts = {
  mailService: string | null;
  isManaged: boolean;
  isDomainKnown: boolean;
  senderEmail: string;
  recentSends: { sent: number; failed: number };
  dnsCheck: DnsCheck | null;
};

export function readCheckedWord(status: DnsCheckLine["status"] | null, checkedAt: string | null) {
  if (!checkedAt) return "not checked yet";
  return `checked ${formatDayMonth(checkedAt)}: ${status === DNS_CHECK_STATUSES.ok ? "pass" : "fail"}`;
}

export function readDnsLineValue(line: DnsCheckLine) {
  return line.found;
}

export function toDnsCheckState(status: DnsCheckLine["status"]): MailCheckState {
  return status === DNS_CHECK_STATUSES.ok ? MAIL_CHECK_STATES.pass : MAIL_CHECK_STATES.fail;
}

function dnsRows(check: DnsCheck | null): MailCheck[] {
  if (!check) return [{ key: "dns", label: "SPF, DKIM and DMARC", state: MAIL_CHECK_STATES.watch, value: "Run Mail › Check DNS now", note: readCheckedWord(null, null) }];
  return check.lines.map((line) => ({ key: line.key, label: line.label, state: toDnsCheckState(line.status), value: readDnsLineValue(line), note: readCheckedWord(line.status, check.checkedAt) }));
}

export function readMailChecks({ mailService, isManaged, isDomainKnown, senderEmail, recentSends, dnsCheck }: MailCheckFacts): MailCheck[] {
  const isOn = mailService !== null;
  const { sent, failed } = recentSends;
  const hasSends = sent + failed > 0;
  return [
    {
      key: "service",
      label: MAIL_SERVICE_LABEL,
      state: isOn ? MAIL_CHECK_STATES.pass : MAIL_CHECK_STATES.fail,
      value: isOn ? `Set: ${mailService}` : isManaged ? "Village sets this up for you" : "Not set: links wait on Sign-in links",
      note: isOn ? "set" : "not set",
    },
    {
      key: "domain",
      label: "Sending domain",
      state: isDomainKnown ? MAIL_CHECK_STATES.pass : MAIL_CHECK_STATES.watch,
      value: isDomainKnown ? senderEmail : isManaged ? "Village sets this up for you" : "Not set (Settings)",
      note: isDomainKnown ? "set" : "not set",
    },
    {
      key: "sends",
      label: "Recent sends",
      state: !isOn ? MAIL_CHECK_STATES.watch : failed ? MAIL_CHECK_STATES.fail : sent ? MAIL_CHECK_STATES.pass : MAIL_CHECK_STATES.watch,
      value: !isOn ? "Nothing is sent while mail is off" : hasSends ? `${sent} sent, ${failed} failed lately` : "Nothing sent yet",
      note: !isOn ? "off" : hasSends ? (failed ? `${failed} failed` : "pass") : "none yet",
    },
    ...dnsRows(dnsCheck),
  ];
}
