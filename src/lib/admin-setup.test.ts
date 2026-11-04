import { describe, expect, it } from "vitest";

import { describeSetupProgress, parseSetupStep, SETUP_STEPS } from "./admin-setup";

const NOTHING_DONE = { isBrandSaved: false, isDomainConfirmed: false, hasKeys: false, hasGroup: false };

describe("setup progress", () => {
  it("starts with branding for a new admin", () => {
    const progress = describeSetupProgress(NOTHING_DONE);

    expect(progress.currentStepId).toBe(SETUP_STEPS.brand);
    expect(progress.doneCount).toBe(0);
    expect(progress.isComplete).toBe(false);
  });

  it("moves to the first unfinished step", () => {
    const progress = describeSetupProgress({ ...NOTHING_DONE, isBrandSaved: true, isDomainConfirmed: true });

    expect(progress.currentStepId).toBe(SETUP_STEPS.keys);
    expect(progress.doneCount).toBe(2);
  });

  it("reopens the domain step when it no longer matches, even with a group", () => {
    const progress = describeSetupProgress({ isBrandSaved: true, isDomainConfirmed: false, hasKeys: true, hasGroup: true });

    expect(progress.currentStepId).toBe(SETUP_STEPS.domain);
    expect(progress.isComplete).toBe(false);
  });

  it("completes once every step is done", () => {
    const progress = describeSetupProgress({ isBrandSaved: true, isDomainConfirmed: true, hasKeys: true, hasGroup: true });

    expect(progress.currentStepId).toBeNull();
    expect(progress.stepsLeft).toBe(0);
    expect(progress.isComplete).toBe(true);
  });

  it("ignores an unknown step in the URL", () => {
    expect(parseSetupStep("<script>")).toBeNull();
    expect(parseSetupStep(SETUP_STEPS.keys)).toBe(SETUP_STEPS.keys);
  });
});
