import { z } from "zod";

export const VILLAGE_KEY_STATUSES = {
  missing: "missing",
  sealed: "sealed",
  plain: "plain",
  sealFailed: "seal_failed",
  tokenMissing: "token_missing",
  tokenDifferent: "token_different",
  damaged: "damaged",
  unavailable: "unavailable",
} as const;

export type VillageKeyStatus = (typeof VILLAGE_KEY_STATUSES)[keyof typeof VILLAGE_KEY_STATUSES];

export const DAILY_LOOKUP_LIMITS = { default: 50, minimum: 1, maximum: 500 } as const;

export const dailyLimitBodySchema = z.object({
  limit: z
    .number("Enter a whole number.")
    .int("Enter a whole number.")
    .min(DAILY_LOOKUP_LIMITS.minimum, `Use at least ${DAILY_LOOKUP_LIMITS.minimum} lookup a day.`)
    .max(DAILY_LOOKUP_LIMITS.maximum, `Use ${DAILY_LOOKUP_LIMITS.maximum} lookups a day or fewer.`),
});
