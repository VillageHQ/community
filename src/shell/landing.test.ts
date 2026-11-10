import { describe, expect, it } from "vitest";

import { ROUTES } from "../platform/http/routes.ts";
import { readLandingPath } from "./landing.ts";

describe("readLandingPath", () => {
  it("sends unfinished welcome steps to the welcome page first, admin or not", () => {
    expect(readLandingPath({ isOnboardingDone: false, isAdmin: true, isSetupComplete: false })).toBe(ROUTES.welcome);
    expect(readLandingPath({ isOnboardingDone: false, isAdmin: false, isSetupComplete: true })).toBe(ROUTES.welcome);
  });

  it("sends an admin to setup while setup is unfinished, not to the admin home", () => {
    expect(readLandingPath({ isOnboardingDone: true, isAdmin: true, isSetupComplete: false })).toBe(ROUTES.adminSetup);
  });

  it("sends an admin whose setup is done, and every member, to the feed", () => {
    expect(readLandingPath({ isOnboardingDone: true, isAdmin: true, isSetupComplete: true })).toBe(ROUTES.feed);
    expect(readLandingPath({ isOnboardingDone: true, isAdmin: false, isSetupComplete: false })).toBe(ROUTES.feed);
  });
});
