import { z } from "zod";

import { DAILY_LOOKUP_LIMITS, MONTHLY_CREDIT_CAPS } from "../../platform/village/contract.ts";
import { villageSettingsBodySchema } from "./contract-village-settings.ts";

// Admin › Village › "Limits and switches" (Founderhall's form): one Save for the caps, where search starts, the
// service email, who can introduce, what members read on the connect screen and the nightly fill-in.
// The Connection sheet's words for the two keys (the fields, and the lines once they are saved).
export const SECRET_KEY_HINT = "From Village Platform Admin › Settings › API keys. Stays on this server, sealed in the database.";
export const PUBLIC_KEY_HINT = "For Village’s sync screen in members’ browsers.";

export const MAXIMUM_DATA_REGION_LENGTH = 80;
export const MAXIMUM_DPA_URL_LENGTH = 300;

const wholeNumber = (minimum: number, maximum: number, unit: string) =>
  z.coerce
    .number("Enter a whole number.")
    .int("Enter a whole number.")
    .min(minimum, `Use at least ${minimum.toLocaleString("en-US")} ${unit}.`)
    .max(maximum, `Use ${maximum.toLocaleString("en-US")} ${unit} or fewer.`);

export const villageLimitsBodySchema = villageSettingsBodySchema.and(
  z.object({
    cap: wholeNumber(MONTHLY_CREDIT_CAPS.minimum, MONTHLY_CREDIT_CAPS.maximum, "lookups a month"),
    dailyLimit: wholeNumber(DAILY_LOOKUP_LIMITS.minimum, DAILY_LOOKUP_LIMITS.maximum, "lookups a day"),
    dataRegion: z.string().trim().max(MAXIMUM_DATA_REGION_LENGTH, `Keep it under ${MAXIMUM_DATA_REGION_LENGTH} characters.`),
    dpaUrl: z
      .string()
      .trim()
      .max(MAXIMUM_DPA_URL_LENGTH)
      .refine((url) => url === "" || /^https:\/\/[^\s]+$/i.test(url), "Use a link that starts with https://."),
    isNightlyFillInOn: z.boolean(),
  }),
);

export type VillageLimitsBody = z.infer<typeof villageLimitsBodySchema>;

// "Fill in profiles every night" is on until an admin turns it off.
export const NIGHTLY_FILL_IN = { on: "on", off: "off" } as const;

export const VILLAGE_LIMITS_API = "/api/admin/village/limits";
