import { z } from "zod";

import { FILL_IN_BASES } from "./contract-fill-in.ts";

// Set up › Import members (CSV), ported from Founderhall's import page: one upload for a whole alumni list.
export const IMPORT_API_ROUTE = "/api/admin/invites/import";
// Set up › Sign-in links: a new invite link to copy, with no email.
export const INVITE_COPY_LINK_API_ROUTE = "/api/admin/invites/copy-link";
export const IMPORT_PARAMS = { invite: "invite", basis: "basis", termsDate: "termsDate" } as const;
export const IMPORT_SHOWN_PEOPLE = 8;
export const IMPORT_SHOWN_LINES = 12;

export const IMPORT_BASIS_ERRORS = {
  missing: "Choose how these members agreed to the profile fill-in.",
  date: "Pick the date your membership terms started saying this.",
} as const;

const ISO_DATE = /^\d{4}-\d{2}-\d{2}$/;

export type ImportBasis = { basis: typeof FILL_IN_BASES.terms; termsDate: string } | { basis: typeof FILL_IN_BASES.ask };

// The fill-in basis from the form: "ask" or "terms" with a real date no later than today. -> the basis, or the error.
export function readImportBasis(basis: string | null, termsDate: string | null, today = new Date()): ImportBasis | { error: string } {
  if (basis === FILL_IN_BASES.ask) return { basis };
  if (basis !== FILL_IN_BASES.terms) return { error: IMPORT_BASIS_ERRORS.missing };
  const date = termsDate ?? "";
  if (!ISO_DATE.test(date) || Number.isNaN(Date.parse(date)) || date > today.toISOString().slice(0, 10)) return { error: IMPORT_BASIS_ERRORS.date };
  return { basis, termsDate: date };
}

const importLineSchema = z.object({ line: z.number(), why: z.string() });

export const importResultSchema = z.object({
  importedCount: z.number(),
  // The first few imported, for the result sheet.
  imported: z.array(z.object({ email: z.string(), name: z.string().nullable(), company: z.string().nullable(), cohort: z.string().nullable() })),
  skippedCount: z.number(),
  problemCount: z.number(),
  // Rows that had an email, read or not.
  rowCount: z.number(),
  // Lines not imported (problems and skips), by line, the first few.
  notImported: z.array(importLineSchema),
  notImportedCount: z.number(),
  isEmailing: z.boolean(),
});

export type ImportResult = z.infer<typeof importResultSchema>;
