import { z } from "zod";

import { PROFILE_LIMITS } from "../modules/members/contract-profile.ts";
import { MAXIMUM_NAME_LENGTH } from "../platform/auth/member-name.ts";
import { removeBidiControls, removeNullBytes } from "../platform/text/safe-text.ts";

// Founderhall's two welcome steps (views-member.mjs welcomePage): step 1 "Welcome to …" (who you are), step 2 "Your
// privacy". Shared by the pages, their forms and the two routes under /api/onboarding.
export const WELCOME_ERRORS = {
  name: "Add your name, so members know who you are.",
  questions: "Answer both questions; a line each is enough.",
} as const;

function answer(maximumLength: number, label: string) {
  return z
    .string()
    .overwrite(removeNullBytes)
    .trim()
    .min(1, WELCOME_ERRORS.questions)
    .max(maximumLength, `Keep ${label} under ${maximumLength} characters.`);
}

function detail(maximumLength: number, label: string) {
  return z
    .string()
    .overwrite(removeNullBytes)
    .trim()
    .max(maximumLength, `Keep ${label} under ${maximumLength} characters.`)
    .transform((text) => text || null);
}

// "What are you working on?" is the card's line about you (bio); "Who could you help with?" its can-help-with.
export const welcomeAboutBodySchema = z.object({
  name: z
    .string()
    .overwrite(removeNullBytes)
    .overwrite(removeBidiControls)
    .trim()
    .min(1, WELCOME_ERRORS.name)
    .max(MAXIMUM_NAME_LENGTH, `Keep your name under ${MAXIMUM_NAME_LENGTH} characters.`),
  workingOn: answer(PROFILE_LIMITS.bio, "what you work on"),
  canHelpWith: answer(PROFILE_LIMITS.canHelpWith, "who you could help"),
  role: detail(PROFILE_LIMITS.title, "your role"),
  company: detail(PROFILE_LIMITS.company, "your company"),
  city: detail(PROFILE_LIMITS.location, "your city"),
});

export type WelcomeAboutBody = z.infer<typeof welcomeAboutBodySchema>;

// Each switch is sent only when the page showed it: intro asks while intros are on, the lookup while fill-in is on.
export const welcomePrivacyBodySchema = z
  .object({
    isHidden: z.boolean(),
    acceptsIntroAsks: z.boolean().optional(),
    allowsLookup: z.boolean().optional(),
  })
  .strict();

export type WelcomePrivacyBody = z.infer<typeof welcomePrivacyBodySchema>;

export const welcomeDoneSchema = z.object({ next: z.string() });

export const WELCOME_DONE_FLASH = "You’re in. This is the directory.";
