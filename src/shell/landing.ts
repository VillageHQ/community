import { ROUTES } from "../platform/http/routes.ts";

type LandingFacts = { isOnboardingDone: boolean; isAdmin: boolean; isSetupComplete: boolean };

// Where `/start` (every sign-in's landing) sends someone: the welcome steps first, then a brand-new admin to setup
// until it's done, everyone else to the feed.
export function readLandingPath({ isOnboardingDone, isAdmin, isSetupComplete }: LandingFacts): string {
  if (!isOnboardingDone) return ROUTES.welcome;
  if (isAdmin && !isSetupComplete) return ROUTES.adminSetup;
  return ROUTES.feed;
}
