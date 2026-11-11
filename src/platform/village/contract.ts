import { z } from "zod";

// The longest name, headline and reason the app keeps for a person on a Village path (an intro ask copies them).
export const CONNECTOR_LIMITS = { nameLength: 200, headlineLength: 300, reasonLength: 600 } as const;

export const CONNECTOR_ERROR_CODES = { ownTarget: "intro_own_target" } as const;

export const VILLAGE_KEY_STATUSES = {
  missing: "missing",
  sealed: "sealed",
  plain: "plain",
  sealFailed: "seal_failed",
  tokenMissing: "token_missing",
  tokenDifferent: "token_different",
  damaged: "damaged",
  unavailable: "unavailable",
  preview: "preview",
} as const;

export type VillageKeyStatus = (typeof VILLAGE_KEY_STATUSES)[keyof typeof VILLAGE_KEY_STATUSES];

export const KEY_STORAGE = { sealed: "sealed", unencrypted: "unencrypted", refused: "refused" } as const;

export type KeyStorage = (typeof KEY_STORAGE)[keyof typeof KEY_STORAGE];

export const DAILY_LOOKUP_LIMITS = { default: 50, minimum: 1, maximum: 500 } as const;

export const dailyLimitBodySchema = z.object({
  limit: z
    .number("Enter a whole number.")
    .int("Enter a whole number.")
    .min(DAILY_LOOKUP_LIMITS.minimum, `Use at least ${DAILY_LOOKUP_LIMITS.minimum} lookup a day.`)
    .max(DAILY_LOOKUP_LIMITS.maximum, `Use ${DAILY_LOOKUP_LIMITS.maximum} lookups a day or fewer.`),
});

export const MONTHLY_CREDIT_CAPS = { default: 7500, minimum: 10, maximum: 1_000_000 } as const;

export const monthlyCapBodySchema = z.object({
  cap: z
    .number("Enter a whole number.")
    .int("Enter a whole number.")
    .min(MONTHLY_CREDIT_CAPS.minimum, `Use at least ${MONTHLY_CREDIT_CAPS.minimum} credits a month.`)
    .max(MONTHLY_CREDIT_CAPS.maximum, `Use ${MONTHLY_CREDIT_CAPS.maximum.toLocaleString("en-US")} credits a month or fewer.`),
});

// What this site counts for each paid call. Village's own usage page is the bill.
export const CREDIT_CALL_KINDS = { search: "search", path: "path", fillIn: "fill_in" } as const;

export type CreditCallKind = (typeof CREDIT_CALL_KINDS)[keyof typeof CREDIT_CALL_KINDS];

export const ESTIMATED_CREDITS: Record<CreditCallKind, number> = {
  [CREDIT_CALL_KINDS.search]: 11,
  [CREDIT_CALL_KINDS.path]: 5,
  [CREDIT_CALL_KINDS.fillIn]: 1,
};

export const USD_PER_CREDIT = 0.02;

// The share of the monthly cap at which admins get the early warning.
export const NEAR_CAP_PERCENT = 80;
