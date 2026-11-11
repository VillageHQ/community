import { promises as dnsPromises } from "node:dns";

import { DNS_CHECK_STATUSES, type DnsCheck, type DnsCheckLine, type DnsRecord } from "./dns-check-contract.ts";

export { DNS_CHECK_STATUSES };

// The email setup check: live DNS lookups for the records Resend needs on the sending domain. Each line says whether the
// record is there, what was found, and the record to add when it isn't. The resolver is passed in, so tests use a stub
// and never touch real DNS.

export type TxtResolver = { resolveTxt: (name: string) => Promise<string[][]>; resolveMx?: (name: string) => Promise<{ exchange: string; priority: number }[]> };

// What Set up › Mail adds: the DKIM selector the mail service signs with, and the subdomain replies come back to.
export type DnsCheckOptions = { dkimSelector?: string; replyDomain?: string | null };

const LOOKUP_TIMEOUT_MS = 5_000;
const NOT_FOUND_CODES = new Set(["ENODATA", "ENOTFOUND", "ENONAME", "NXDOMAIN"]);
const MAXIMUM_SHOWN_LENGTH = 80;
// Resend sends from a "send." subdomain through Amazon SES, and signs with the "resend" DKIM selector.
const RESEND_SPF_INCLUDE = "amazonses.com";
const SPF_START = /^v=spf1\b/i;
const DMARC_START = /^v=DMARC1\b/i;
const DKIM_KEY = /(^|;)\s*p=[A-Za-z0-9+/=]{20,}/;
const DOMAIN_SHAPE = /^(?=.{1,253}$)([a-z0-9](?:[a-z0-9-]{0,61}[a-z0-9])?\.)+[a-z]{2,63}$/;

// "Northwind <hello@mail.example.com>" or "hello@mail.example.com" → "mail.example.com".
export function readSendingDomain(fromAddress: string) {
  const address = fromAddress.match(/<([^>]+)>/)?.[1] ?? fromAddress;
  const domain = address.trim().split("@").at(1)?.toLowerCase().replace(/\.$/, "") ?? "";
  return DOMAIN_SHAPE.test(domain) ? domain : null;
}

// Two-part suffixes like co.uk or com.au: the registered domain is then the last three labels.
const SECOND_LEVEL_SUFFIX = /^(?:ac|co|com|edu|gov|net|org|ltd|plc|or|ne|go)$/;

// mail.example.com → example.com, mail.example.co.uk → example.co.uk: where DMARC's fallback looks. Good enough
// without a public-suffix list, and the sending domain itself is always checked first.
export function readParentDomain(domain: string) {
  const labels = domain.split(".");
  const isTwoPartSuffix = labels.length >= 3 && labels.at(-1)!.length === 2 && SECOND_LEVEL_SUFFIX.test(labels.at(-2)!);
  return labels.slice(isTwoPartSuffix ? -3 : -2).join(".");
}

function shorten(text: string) {
  return text.length > MAXIMUM_SHOWN_LENGTH ? `${text.slice(0, MAXIMUM_SHOWN_LENGTH)}…` : text;
}

function withTimeout<Value>(promise: Promise<Value>) {
  let timer: ReturnType<typeof setTimeout> | undefined;
  const timeout = new Promise<never>((_, reject) => {
    timer = setTimeout(() => reject(Object.assign(new Error("The lookup took too long."), { code: "ETIMEOUT" })), LOOKUP_TIMEOUT_MS);
  });
  return Promise.race([promise, timeout]).finally(() => clearTimeout(timer));
}

type TxtAnswer = { isAnswered: true; records: string[] } | { isAnswered: false; reason: string };

async function readTxt(resolver: TxtResolver, name: string): Promise<TxtAnswer> {
  try {
    const rows = await withTimeout(resolver.resolveTxt(name));
    return { isAnswered: true, records: rows.map((parts) => parts.join("")) };
  } catch (error) {
    const code = typeof error === "object" && error !== null && "code" in error ? String(error.code) : "";
    if (NOT_FOUND_CODES.has(code)) return { isAnswered: true, records: [] };
    return { isAnswered: false, reason: code || "no answer" };
  }
}

function couldNotLook(key: DnsCheckLine["key"], label: string, name: string, reason: string, toAdd: DnsRecord): DnsCheckLine {
  return { key, label, status: DNS_CHECK_STATUSES.unknown, found: `We couldn't look up ${name} (${reason}). Try again in a minute.`, toAdd };
}

async function checkSpf(resolver: TxtResolver, domain: string): Promise<DnsCheckLine> {
  const name = `send.${domain}`;
  const toAdd: DnsRecord = { type: "TXT", name, value: `v=spf1 include:${RESEND_SPF_INCLUDE} ~all` };
  const answer = await readTxt(resolver, name);
  if (!answer.isAnswered) return couldNotLook("spf", "SPF", name, answer.reason, toAdd);
  const records = answer.records.filter((record) => SPF_START.test(record.trim()));
  if (records.length > 1) {
    return { key: "spf", label: "SPF", status: DNS_CHECK_STATUSES.missing, found: `${name} has ${records.length} SPF records. Only one is allowed: merge them into one.`, toAdd };
  }
  const [record] = records;
  if (!record) return { key: "spf", label: "SPF", status: DNS_CHECK_STATUSES.missing, found: `No SPF record on ${name}.`, toAdd };
  if (!record.toLowerCase().includes(`include:${RESEND_SPF_INCLUDE}`)) {
    return { key: "spf", label: "SPF", status: DNS_CHECK_STATUSES.missing, found: `${name} has SPF, but not Resend's: ${shorten(record)}`, toAdd };
  }
  return { key: "spf", label: "SPF", status: DNS_CHECK_STATUSES.ok, found: `${name}: ${shorten(record)}`, toAdd: null };
}

async function checkDkim(resolver: TxtResolver, domain: string, selector: string): Promise<DnsCheckLine> {
  const name = `${selector}._domainkey.${domain}`;
  const toAdd: DnsRecord = { type: "TXT", name, value: "p=… (copy the whole value Resend shows for this domain)" };
  const answer = await readTxt(resolver, name);
  if (!answer.isAnswered) return couldNotLook("dkim", "DKIM", name, answer.reason, toAdd);
  const record = answer.records.find((candidate) => DKIM_KEY.test(candidate));
  if (!record) {
    const found = answer.records.length > 0 ? `${name} has no public key (p=).` : `No DKIM key at ${name}.`;
    return { key: "dkim", label: "DKIM", status: DNS_CHECK_STATUSES.missing, found, toAdd };
  }
  return { key: "dkim", label: "DKIM", status: DNS_CHECK_STATUSES.ok, found: `${name}: ${shorten(record)}`, toAdd: null };
}

async function checkDmarc(resolver: TxtResolver, domain: string): Promise<DnsCheckLine> {
  const parent = readParentDomain(domain);
  const toAdd: DnsRecord = { type: "TXT", name: `_dmarc.${parent}`, value: "v=DMARC1; p=none;" };
  const names = parent === domain ? [`_dmarc.${domain}`] : [`_dmarc.${domain}`, `_dmarc.${parent}`];
  for (const name of names) {
    const answer = await readTxt(resolver, name);
    if (!answer.isAnswered) return couldNotLook("dmarc", "DMARC", name, answer.reason, toAdd);
    const record = answer.records.find((candidate) => DMARC_START.test(candidate.trim()));
    if (record) return { key: "dmarc", label: "DMARC", status: DNS_CHECK_STATUSES.ok, found: `${name}: ${shorten(record)}`, toAdd: null };
  }
  return { key: "dmarc", label: "DMARC", status: DNS_CHECK_STATUSES.missing, found: `No DMARC record on ${names.join(" or ")}.`, toAdd };
}

// Resend receives replies on the reply domain: its MX record points at Resend's inbound servers.
const RESEND_INBOUND_MX = "inbound-smtp.us-east-1.amazonaws.com";

async function checkReplyMx(resolver: TxtResolver, name: string): Promise<DnsCheckLine> {
  const toAdd: DnsRecord = { type: "MX", name, value: `10 ${RESEND_INBOUND_MX} (or the MX Resend shows for receiving)` };
  if (!resolver.resolveMx) return couldNotLook("mx", "Reply MX", name, "no MX lookups here", toAdd);
  try {
    const records = await withTimeout(resolver.resolveMx(name));
    if (records.length === 0) return { key: "mx", label: "Reply MX", status: DNS_CHECK_STATUSES.missing, found: `No MX record on ${name}.`, toAdd };
    const found = records.toSorted((first, second) => first.priority - second.priority).map(({ exchange, priority }) => `${priority} ${exchange}`).join(", ");
    return { key: "mx", label: "Reply MX", status: DNS_CHECK_STATUSES.ok, found: `${name}: ${shorten(found)}`, toAdd: null };
  } catch (error) {
    const code = typeof error === "object" && error !== null && "code" in error ? String(error.code) : "";
    if (NOT_FOUND_CODES.has(code)) return { key: "mx", label: "Reply MX", status: DNS_CHECK_STATUSES.missing, found: `No MX record on ${name}.`, toAdd };
    return couldNotLook("mx", "Reply MX", name, code || "no answer", toAdd);
  }
}

export async function checkSendingDomain(domain: string, resolver: TxtResolver = dnsPromises, now = new Date(), { dkimSelector = "resend", replyDomain = null }: DnsCheckOptions = {}): Promise<DnsCheck> {
  const checks = [checkSpf(resolver, domain), checkDkim(resolver, domain, dkimSelector || "resend"), checkDmarc(resolver, domain)];
  if (replyDomain) checks.push(checkReplyMx(resolver, replyDomain));
  const lines = await Promise.all(checks);
  return { domain, checkedAt: now.toISOString(), lines };
}
