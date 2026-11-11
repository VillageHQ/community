import { z } from "zod";

import { CONSOLE_PERIOD_PARAMS } from "./console-periods.ts";

export const INTRO_LOG_API = { csv: "/api/admin/intro-log/csv", outcomeDays: "/api/admin/intro-log/outcome-days" } as const;

export const introLogCsvBodySchema = z.object({ period: z.enum(CONSOLE_PERIOD_PARAMS as [string, ...string[]]).default("quarter") });

// The flash after each save on the Intro log, Founderhall's words.
export const INTRO_LOG_FLASH = {
  limits: "Limits saved.",
  outcomeDays: "Saved. The outcome question follows that many days after each intro.",
} as const;
