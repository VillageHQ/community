import { z } from "zod";

export const DAILY_LOOKUP_LIMITS = { default: 50, minimum: 1, maximum: 500 } as const;

export const dailyLimitBodySchema = z.object({
  limit: z
    .number("Enter a whole number.")
    .int("Enter a whole number.")
    .min(DAILY_LOOKUP_LIMITS.minimum, `Use at least ${DAILY_LOOKUP_LIMITS.minimum} lookup a day.`)
    .max(DAILY_LOOKUP_LIMITS.maximum, `Use ${DAILY_LOOKUP_LIMITS.maximum} lookups a day or fewer.`),
});
