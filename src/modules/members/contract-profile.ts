import { z } from "zod";

import { nameSchema } from "../../platform/auth/member-name.ts";
import { removeNullBytes } from "../../platform/text/safe-text.ts";
import { parseExternalUrl } from "./rules-external-url.ts";

// The directory's "updated" filter: cards saved within this many days.
export const UPDATED_WITHIN_DAYS = [7, 30, 90] as const;

export const PROFILE_LIMITS = {
  title: 80,
  company: 80,
  location: 80,
  stage: 80,
  sector: 80,
  cohort: 80,
  bio: 280,
  canHelpWith: 160,
  needs: 160,
  website: 200,
  linkedinUrl: 200,
  tag: 32,
  tags: 8,
  search: 80,
} as const;

function optionalText(label: string, maximumLength: number) {
  return z
    .string()
    .overwrite(removeNullBytes)
    .trim()
    .max(maximumLength, `Keep ${label} under ${maximumLength} characters.`)
    .transform((text) => text || null)
    .optional();
}

export function normalizeTag(tag: string) {
  return tag.trim().replace(/\s+/g, " ").toLowerCase();
}

function dedupeTags(tags: string[]) {
  const normalizedTags = tags.map(normalizeTag);
  return tags.filter((_tag, position) => normalizedTags.indexOf(normalizedTags[position] ?? "") === position);
}

const tagSchema = z
  .string()
  .overwrite(removeNullBytes)
  .trim()
  .transform((tag) => tag.replace(/\s+/g, " "))
  .pipe(z.string().min(1).max(PROFILE_LIMITS.tag, `Keep each tag under ${PROFILE_LIMITS.tag} characters.`));

export const profileBodySchema = z.object({
  name: nameSchema.optional(),
  title: optionalText("your role", PROFILE_LIMITS.title),
  company: optionalText("your company", PROFILE_LIMITS.company),
  location: optionalText("your location", PROFILE_LIMITS.location),
  stage: optionalText("your stage", PROFILE_LIMITS.stage),
  sector: optionalText("your sector", PROFILE_LIMITS.sector),
  cohort: optionalText("your cohort", PROFILE_LIMITS.cohort),
  bio: optionalText("your line about yourself", PROFILE_LIMITS.bio),
  canHelpWith: optionalText("what you can help with", PROFILE_LIMITS.canHelpWith),
  needs: optionalText("what you need", PROFILE_LIMITS.needs),
  website: z
    .string()
    .overwrite(removeNullBytes)
    .trim()
    .max(PROFILE_LIMITS.website, `Keep your website under ${PROFILE_LIMITS.website} characters.`)
    .transform((website, context) => {
      if (!website) return null;
      const externalUrl = parseExternalUrl(website);
      if (externalUrl) return externalUrl;
      context.addIssue({ code: "custom", message: "Use a full web address, like https://example.com." });
      return z.NEVER;
    })
    .optional(),
  linkedinUrl: z
    .string()
    .overwrite(removeNullBytes)
    .trim()
    .max(PROFILE_LIMITS.linkedinUrl, "This LinkedIn URL is too long.")
    .optional(),
  tags: z
    .array(tagSchema)
    .transform(dedupeTags)
    .pipe(z.array(z.string()).max(PROFILE_LIMITS.tags, `Keep it to ${PROFILE_LIMITS.tags} tags.`))
    .optional(),
});

export type ProfileBody = z.infer<typeof profileBodySchema>;

export const directoryFiltersSchema = z.object({
  search: z
    .string()
    .overwrite(removeNullBytes)
    .trim()
    .max(PROFILE_LIMITS.search, `Keep your search under ${PROFILE_LIMITS.search} characters.`)
    .default(""),
  tag: z.string().overwrite(removeNullBytes).trim().max(PROFILE_LIMITS.tag).default(""),
  stage: z.string().overwrite(removeNullBytes).trim().max(PROFILE_LIMITS.stage).default(""),
  sector: z.string().overwrite(removeNullBytes).trim().max(PROFILE_LIMITS.sector).default(""),
  cohort: z.string().overwrite(removeNullBytes).trim().max(PROFILE_LIMITS.cohort).default(""),
  // 0 is any time.
  updatedWithinDays: z.union([z.literal(0), ...UPDATED_WITHIN_DAYS.map((days) => z.literal(days))]).default(0),
  page: z.number().int().min(1).default(1),
});

export type DirectoryFilters = z.infer<typeof directoryFiltersSchema>;

export const directoryMemberSchema = z.object({
  id: z.string(),
  name: z.string(),
  title: z.string().nullable(),
  company: z.string().nullable(),
  canHelpWith: z.string().nullable(),
  stage: z.string().nullable(),
  sector: z.string().nullable(),
  cohort: z.string().nullable(),
  avatarUrl: z.string().nullable(),
  tags: z.array(z.string()),
});

export type DirectoryMember = z.infer<typeof directoryMemberSchema>;

export const directorySchema = z.object({
  members: z.array(directoryMemberSchema),
  matchCount: z.number(),
  memberCount: z.number(),
  page: z.number(),
  pageCount: z.number(),
  popularTags: z.array(z.object({ label: z.string(), value: z.string() })),
  // The values active members use, for the stage, sector and cohort filters.
  filterOptions: z.object({ stage: z.array(z.string()), sector: z.array(z.string()), cohort: z.array(z.string()) }),
});

export type Directory = z.infer<typeof directorySchema>;

export const ONBOARDING_STEPS = { card: "card", introAsks: "intro_asks", network: "network", done: "done" } as const;

export type OnboardingStep = (typeof ONBOARDING_STEPS)[keyof typeof ONBOARDING_STEPS];

export const onboardingBodySchema = z.object({ step: z.enum([ONBOARDING_STEPS.card, ONBOARDING_STEPS.network]) });
