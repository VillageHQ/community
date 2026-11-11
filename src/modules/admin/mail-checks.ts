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

// Set up › Mail's DNS checklist (Founderhall's mailPage): the mail service, the inbound replies webhook and one-click
// unsubscribe, then each line of the last "Check DNS now" with the record to add when one is missing.
export type MailPageCheck = MailCheck & { toAdd: DnsCheckLine["toAdd"] };

export type MailPageFacts = { mailService: string | null; inbound: { isSet: boolean; address: string }; dnsCheck: DnsCheck | null };

export function readMailPageChecks({ mailService, inbound, dnsCheck }: MailPageFacts): MailPageCheck[] {
  return [
    mailService
      ? { key: "service", label: MAIL_SERVICE_LABEL, state: MAIL_CHECK_STATES.pass, value: `Set: ${mailService}`, note: "set", toAdd: null }
      : { key: "service", label: MAIL_SERVICE_LABEL, state: MAIL_CHECK_STATES.fail, value: "Not set: nothing is emailed until the mail service is set on the server", note: "not set", toAdd: null },
    {
      key: "inbound",
      label: "Inbound replies webhook",
      state: inbound.isSet ? MAIL_CHECK_STATES.pass : MAIL_CHECK_STATES.watch,
      value: inbound.address,
      note: inbound.isSet ? "set" : "not set",
      toAdd: null,
    },
    { key: "unsubscribe", label: "One-click unsubscribe", state: MAIL_CHECK_STATES.pass, value: "List-Unsubscribe and List-Unsubscribe-Post on every message email", note: "built in", toAdd: null },
    ...(dnsCheck?.lines ?? []).map((line) => ({
      key: line.key,
      label: line.label,
      state: toDnsCheckState(line.status),
      value: readDnsLineValue(line),
      note: readCheckedWord(line.status, dnsCheck?.checkedAt ?? null),
      toAdd: line.toAdd,
    })),
  ];
}

// The line under "DNS checklist".
export function readDnsCheckLine(check: DnsCheck | null) {
  const what = "“Check DNS now” looks up SPF, DKIM, DMARC and the reply MX.";
  if (!check) return `Not checked yet. ${what}`;
  const missing = check.lines.filter(({ status }) => status !== DNS_CHECK_STATUSES.ok).length;
  const result = missing === 0 ? "every record is there" : `${missing} ${missing === 1 ? "record needs" : "records need"} a fix (changes can take an hour to show)`;
  return `Checked ${formatDayMonth(check.checkedAt)} for ${check.domain}: ${result}. ${what}`;
}
