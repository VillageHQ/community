import { z } from "zod";

import { feedTextSchema } from "../../platform/text/text-schema.ts";

export const PARTNER_REPORT_LIMITS = { recipients: 20, noteLength: 1000, emailLength: 254 } as const;

export const REPORT_PERIOD_KEYS = { thisQuarter: "thisQuarter", lastQuarter: "lastQuarter", sinceLaunch: "sinceLaunch" } as const;

export type ReportPeriodKey = (typeof REPORT_PERIOD_KEYS)[keyof typeof REPORT_PERIOD_KEYS];

export const REPORT_PERIOD_ORDER: readonly ReportPeriodKey[] = [REPORT_PERIOD_KEYS.thisQuarter, REPORT_PERIOD_KEYS.lastQuarter, REPORT_PERIOD_KEYS.sinceLaunch];

const ADDRESS_SEPARATORS = /[\s,;]+/;

const addressSchema = z.email("Check the addresses: one of them isn't an email address.").max(PARTNER_REPORT_LIMITS.emailLength);

// Addresses arrive as one box of text: commas, semicolons, spaces or new lines between them. Repeats count once.
export const partnerRecipientsSchema = z
  .string()
  .max(PARTNER_REPORT_LIMITS.recipients * (PARTNER_REPORT_LIMITS.emailLength + 2))
  .transform((text) => [...new Set(text.split(ADDRESS_SEPARATORS).map((address) => address.trim().toLowerCase()).filter(Boolean))])
  .pipe(
    z
      .array(addressSchema)
      .min(1, "Add at least one email address.")
      .max(PARTNER_REPORT_LIMITS.recipients, `Send to at most ${PARTNER_REPORT_LIMITS.recipients} addresses at a time.`),
  );

// An empty note is no note.
const partnerNoteSchema = z
  .string()
  .max(PARTNER_REPORT_LIMITS.noteLength * 2)
  .transform((note) => note.trim())
  .pipe(z.union([z.literal("").transform(() => null), feedTextSchema("your note", PARTNER_REPORT_LIMITS.noteLength)]))
  .nullable()
  .default(null);

// The console's period (Founderhall's ?period=quarter|last|all); anything else reads as this quarter.
const reportPeriodSchema = z.enum(["quarter", "last", "all"]).catch("quarter").default("quarter");

export const partnerReportCsvBodySchema = z.object({ period: reportPeriodSchema });

export const partnerReportPreviewBodySchema = z.object({ note: partnerNoteSchema, period: reportPeriodSchema });

export const partnerReportSendBodySchema = z.object({ recipients: partnerRecipientsSchema, note: partnerNoteSchema, period: reportPeriodSchema });

export const partnerReportPreviewSchema = z.object({ subject: z.string(), html: z.string(), text: z.string() });

export const partnerReportSentSchema = z.object({ queued: z.number().int(), skipped: z.array(z.string()) });

export type PartnerReportSendBody = z.infer<typeof partnerReportSendBodySchema>;
export type PartnerReportPreview = z.infer<typeof partnerReportPreviewSchema>;
export type PartnerReportSent = z.infer<typeof partnerReportSentSchema>;
