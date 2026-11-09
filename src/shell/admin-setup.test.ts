import { describe, expect, it } from "vitest";

import { describeSetupProgress, parseSetupStep, SETUP_STEPS } from "./admin-setup";

const NOTHING_DONE = { isBrandSaved: false, hasKeys: false, hasGroup: false, hasInvite: false, hasSharedReport: false };

describe("setup progress", () => {
  it("starts with branding for a new admin", () => {
    const progress = describeSetupProgress(NOTHING_DONE);

    expect(progress.currentStepId).toBe(SETUP_STEPS.brand);
    expect(progress.doneCount).toBe(0);
    expect(progress.isComplete).toBe(false);
  });

  it("moves to the first unfinished step", () => {
    const progress = describeSetupProgress({ ...NOTHING_DONE, isBrandSaved: true });

    expect(progress.currentStepId).toBe(SETUP_STEPS.keys);
    expect(progress.doneCount).toBe(1);
  });

  it("goes straight from branding to the Village keys, with no domain step", () => {
    const progress = describeSetupProgress(NOTHING_DONE);

    expect(progress.steps.map(({ id }) => id)).toEqual([SETUP_STEPS.brand, SETUP_STEPS.keys, SETUP_STEPS.group, SETUP_STEPS.invite, SETUP_STEPS.report]);
  });

  it("completes once every step is done", () => {
    const progress = describeSetupProgress({ isBrandSaved: true, hasKeys: true, hasGroup: true, hasInvite: true, hasSharedReport: true });

    expect(progress.currentStepId).toBeNull();
    expect(progress.stepsLeft).toBe(0);
    expect(progress.isComplete).toBe(true);
  });

  it("moves to inviting members once the group exists", () => {
    const progress = describeSetupProgress({ ...NOTHING_DONE, isBrandSaved: true, hasKeys: true, hasGroup: true });

    expect(progress.currentStepId).toBe(SETUP_STEPS.invite);
    expect(progress.isComplete).toBe(false);
  });

  it("ends with the first partner report", () => {
    const progress = describeSetupProgress({ isBrandSaved: true, hasKeys: true, hasGroup: true, hasInvite: true, hasSharedReport: false });

    expect(progress.currentStepId).toBe(SETUP_STEPS.report);
    expect(progress.isComplete).toBe(false);
  });

  it("ignores an unknown step in the URL", () => {
    expect(parseSetupStep("<script>")).toBeNull();
    expect(parseSetupStep(SETUP_STEPS.keys)).toBe(SETUP_STEPS.keys);
  });
});
