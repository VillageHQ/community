import { describe, expect, it } from "vitest";

import { readWelcomePrivacyStart } from "./welcome-steps";

const NOT_ANSWERED = { isHidden: false, acceptsIntroAsks: null };

describe("the welcome privacy step's starting switches", () => {
  it("leaves the profile fill-in off until the member says yes", () => {
    expect(readWelcomePrivacyStart(NOT_ANSWERED, { consentedAt: null }).allowsLookup).toBe(false);
  });

  it("keeps a yes the member already gave", () => {
    expect(readWelcomePrivacyStart(NOT_ANSWERED, { consentedAt: new Date() }).allowsLookup).toBe(true);
  });

  it("starts intro asks on, as before", () => {
    expect(readWelcomePrivacyStart(NOT_ANSWERED, { consentedAt: null }).acceptsIntroAsks).toBe(true);
  });
});
