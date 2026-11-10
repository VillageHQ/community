import { z } from "zod";

// Where a member's network search looks, and who may be asked to introduce. Admins set these in Settings.
export const SEARCH_SCOPES = { network: "network", everyone: "everyone" } as const;
export const INTRODUCER_RULES = { allSharing: "all_sharing", chosen: "chosen" } as const;

export type SearchScope = (typeof SEARCH_SCOPES)[keyof typeof SEARCH_SCOPES];
export type IntroducerRule = (typeof INTRODUCER_RULES)[keyof typeof INTRODUCER_RULES];

export const MAXIMUM_CHOSEN_INTRODUCERS = 500;
const MAXIMUM_EMAIL_LENGTH = 254;
const MAXIMUM_ID_LENGTH = 100;

export const villageSettingsBodySchema = z
  .object({
    searchScope: z.enum([SEARCH_SCOPES.network, SEARCH_SCOPES.everyone]),
    introducers: z.enum([INTRODUCER_RULES.allSharing, INTRODUCER_RULES.chosen]),
    chosenIntroducerIds: z.array(z.string().min(1).max(MAXIMUM_ID_LENGTH)).max(MAXIMUM_CHOSEN_INTRODUCERS).transform((ids) => [...new Set(ids)]),
    serviceEmail: z
      .string()
      .trim()
      .toLowerCase()
      .max(MAXIMUM_EMAIL_LENGTH)
      .pipe(z.union([z.literal(""), z.email("Check the service email: it isn't an email address.")])),
  })
  .refine(({ introducers, chosenIntroducerIds }) => introducers !== INTRODUCER_RULES.chosen || chosenIntroducerIds.length > 0, {
    message: "Pick at least one member who can introduce, or let every member who shares their network introduce.",
    path: ["chosenIntroducerIds"],
  });

export type VillageSettingsBody = z.infer<typeof villageSettingsBodySchema>;
