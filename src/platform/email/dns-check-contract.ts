import { z } from "zod";

export const DNS_CHECK_STATUSES = { ok: "ok", missing: "missing", unknown: "unknown" } as const;

export const dnsRecordSchema = z.object({ type: z.enum(["TXT", "MX"]), name: z.string(), value: z.string() });

export const dnsCheckLineSchema = z.object({
  key: z.enum(["spf", "dkim", "dmarc", "mx"]),
  label: z.string(),
  status: z.enum([DNS_CHECK_STATUSES.ok, DNS_CHECK_STATUSES.missing, DNS_CHECK_STATUSES.unknown]),
  found: z.string(),
  toAdd: dnsRecordSchema.nullable(),
});

export const dnsCheckSchema = z.object({ domain: z.string(), checkedAt: z.string(), lines: z.array(dnsCheckLineSchema) });

// What "Send a test to me" did (test-email.ts); here so the page can read it too.
export const EMAIL_TEST_OUTCOMES = { sent: "sent", queued: "queued", emailOff: "email_off" } as const;
export type EmailTestOutcome = (typeof EMAIL_TEST_OUTCOMES)[keyof typeof EMAIL_TEST_OUTCOMES];

export const emailTestResultSchema = z.object({ outcome: z.string(), message: z.string() });

export type DnsCheckStatus = z.infer<typeof dnsCheckLineSchema>["status"];
export type DnsRecord = z.infer<typeof dnsRecordSchema>;
export type DnsCheckLine = z.infer<typeof dnsCheckLineSchema>;
export type DnsCheck = z.infer<typeof dnsCheckSchema>;
