import { z } from "zod";

import { OUTCOME_PROMPT_AFTER_DAYS, OUTCOME_PROMPT_WINDOW_DAYS } from "./contract.ts";

// The outcome question's timing, set on the console's Intro log: the member who asked is asked "Did it help?" this
// many days after the intro. Stored as an instance setting; with none saved it is OUTCOME_PROMPT_AFTER_DAYS.
export const OUTCOME_DAYS = { default: OUTCOME_PROMPT_AFTER_DAYS, minimum: 1, maximum: 90 } as const;

export const OUTCOME_DAYS_SETTING = "intro_outcome_days";

// Intros older than the question's day plus this many days are never asked about, so a longer wait still leaves
// the same month to answer in (14 days + 31 = the old 45-day window).
export const OUTCOME_WINDOW_EXTRA_DAYS = OUTCOME_PROMPT_WINDOW_DAYS - OUTCOME_PROMPT_AFTER_DAYS;

export const outcomeDaysBodySchema = z.object({
  outcomeDays: z
    .number()
    .int("Use a whole number of days.")
    .min(OUTCOME_DAYS.minimum, `Choose at least ${OUTCOME_DAYS.minimum} day.`)
    .max(OUTCOME_DAYS.maximum, `Choose at most ${OUTCOME_DAYS.maximum} days.`),
});

export const outcomeDaysSchema = z.object({ outcomeDays: z.number().int() });

export function clampOutcomeDays(value: string | undefined) {
  const stored = Number.parseInt(value ?? "", 10);
  if (!Number.isInteger(stored)) return OUTCOME_DAYS.default;
  return Math.min(OUTCOME_DAYS.maximum, Math.max(OUTCOME_DAYS.minimum, stored));
}
