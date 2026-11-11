import type { DatabaseOrTransaction } from "../database/client.ts";
import { INSTANCE_SETTING_KEYS } from "../settings/schema.ts";
import { readSettings } from "../settings/store.ts";
import { dnsCheckSchema, type DnsCheck } from "./dns-check-contract.ts";

// What the admin set on Set up › Settings (from name, sending domain) and Set up › Mail (DKIM selector, reply
// subdomain), and the last "Check DNS now". Empty means "not set": the sender then comes from RESEND_FROM_ADDRESS.
// The last DNS check is kept under its own key so Settings' mail checklist can show it.
export const MAIL_DNS_CHECK_KEY = "mail_dns_check";
export const DEFAULT_DKIM_SELECTOR = "resend";

const KEYS = {
  fromName: INSTANCE_SETTING_KEYS.mailFromName,
  domain: INSTANCE_SETTING_KEYS.mailDomain,
  dkimSelector: INSTANCE_SETTING_KEYS.mailDkimSelector,
  replyDomain: INSTANCE_SETTING_KEYS.mailReplyDomain,
  dnsCheck: MAIL_DNS_CHECK_KEY,
} as const;

export type MailSettings = { fromName: string; domain: string; dkimSelector: string; replyDomain: string; dnsCheck: DnsCheck | null };

function parseDnsCheck(text: string | undefined) {
  if (!text) return null;
  try {
    const parsed = dnsCheckSchema.safeParse(JSON.parse(text));
    return parsed.success ? parsed.data : null;
  } catch {
    return null;
  }
}

export async function readMailSettings(database: DatabaseOrTransaction): Promise<MailSettings> {
  const settings = await readSettings(database, Object.values(KEYS));
  return {
    fromName: settings.get(KEYS.fromName) ?? "",
    domain: settings.get(KEYS.domain) ?? "",
    dkimSelector: settings.get(KEYS.dkimSelector) ?? "",
    replyDomain: settings.get(KEYS.replyDomain) ?? "",
    dnsCheck: parseDnsCheck(settings.get(KEYS.dnsCheck)),
  };
}

// "Northwind <hello@mail.example.com>" → { name: "Northwind", address: "hello@mail.example.com" }.
export function splitFromAddress(fromAddress: string) {
  const match = fromAddress.match(/^\s*(.*?)\s*<([^>]+)>\s*$/);
  if (!match) return { name: "", address: fromAddress.trim() };
  return { name: match[1]!.replace(/^"|"$/g, ""), address: match[2]!.trim() };
}

// A display name may not carry characters that change the header: quotes, angle brackets, commas, line breaks.
function toDisplayName(name: string) {
  return name.replace(/[\r\n"<>,;\\]/g, " ").replace(/\s+/g, " ").trim();
}

// Who an email says it is from. A sending domain set in Settings sends from hello@ that domain, under the from name
// (or the community's name); a from name alone renames the host's sender; nothing set keeps the host's sender.
export function composeSenderAddress(hostFromAddress: string, { fromName, domain }: Pick<MailSettings, "fromName" | "domain">, communityName: string) {
  const host = splitFromAddress(hostFromAddress);
  const address = domain ? `hello@${domain}` : host.address;
  const name = toDisplayName(fromName || (domain ? communityName : host.name));
  return name ? `${name} <${address}>` : address;
}

// The domain mail goes out from: the one set in Settings, else the host's sender's.
export function readMailDomain(hostFromAddress: string | null, { domain }: Pick<MailSettings, "domain">) {
  if (domain) return domain;
  if (!hostFromAddress) return null;
  const address = splitFromAddress(hostFromAddress).address;
  return address.split("@").at(1)?.toLowerCase() || null;
}

// Where replies come back: the subdomain set on Mail, else the host's RESEND_REPLY_DOMAIN, else reply. on the
// registered domain (as Founderhall does), else the sending domain itself.
export function readMailReplyDomain(sendingDomain: string | null, hostReplyDomain: string | null, { replyDomain }: Pick<MailSettings, "replyDomain">, parentOf: (domain: string) => string) {
  if (replyDomain) return replyDomain;
  if (hostReplyDomain) return hostReplyDomain;
  if (!sendingDomain) return null;
  const parent = parentOf(sendingDomain);
  return parent === sendingDomain ? sendingDomain : `reply.${parent}`;
}
