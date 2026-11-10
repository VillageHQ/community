import { z } from "zod";

// Lines the profile fill-in may write. Title, company and location sit under the member's own
// fields of the same name; their own words always win.
export const FILL_IN_FIELDS = {
  title: "title",
  company: "company",
  location: "location",
  headline: "headline",
  face: "face",
  companyLogo: "company_logo",
  companyDomain: "company_domain",
} as const;

export type FillInField = (typeof FILL_IN_FIELDS)[keyof typeof FILL_IN_FIELDS];

export const FILL_IN_FIELD_VALUES = Object.values(FILL_IN_FIELDS);

export const FILL_IN_FIELD_LABELS: Record<FillInField, string> = {
  [FILL_IN_FIELDS.title]: "Role",
  [FILL_IN_FIELDS.company]: "Company",
  [FILL_IN_FIELDS.location]: "Location",
  [FILL_IN_FIELDS.headline]: "Headline",
  [FILL_IN_FIELDS.face]: "Photo",
  [FILL_IN_FIELDS.companyLogo]: "Company logo",
  [FILL_IN_FIELDS.companyDomain]: "Company website",
};

// The legal basis an admin records before anyone is looked up. No basis means fill-in is off.
export const FILL_IN_BASES = { terms: "terms", ask: "ask" } as const;

export type FillInBasis = (typeof FILL_IN_BASES)[keyof typeof FILL_IN_BASES];

export const LOOKUP_STATUSES = { found: "found", notFound: "not_found", failed: "failed" } as const;

export type LookupStatus = (typeof LOOKUP_STATUSES)[keyof typeof LOOKUP_STATUSES];

export const FILL_IN_REFRESH_DAYS = 30;

export const FILL_IN_SOURCE_LABEL = "From public profiles";

const ISO_DATE = /^\d{4}-\d{2}-\d{2}$/;

export const fillInBasisBodySchema = z.discriminatedUnion("basis", [
  z.object({
    basis: z.literal(FILL_IN_BASES.terms),
    termsDate: z
      .string()
      .regex(ISO_DATE, "Pick the date your terms started saying this.")
      .refine((value) => !Number.isNaN(Date.parse(value)), "Pick a real date."),
  }),
  z.object({ basis: z.literal(FILL_IN_BASES.ask) }),
  z.object({ basis: z.literal("off") }),
]);

export type FillInBasisBody = z.infer<typeof fillInBasisBodySchema>;

export const lookupChoiceBodySchema = z.object({ allowsLookup: z.boolean() });

export const fillInVisibilityBodySchema = z.object({ field: z.enum(FILL_IN_FIELD_VALUES), isHidden: z.boolean() });

// Today asks a member to check the words public profiles put on their card this past week.
export const LINES_TO_CHECK_DAYS = 7;

export type LineToCheck = { field: FillInField; label: string; value: string };

export type FilledLine = { field: FillInField; value: string; filledAt: string; isHidden: boolean };
