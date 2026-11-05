import { describe, expect, it } from "vitest";

import {
  INTRO_ACTION_RULES,
  INTRO_STATES,
  INTRO_TRANSITIONS,
  OPEN_INTRO_STATES,
  isOpenIntroState,
  readStatesLeadingTo,
} from "./contract";
import { composeForwardableBlurb, composeStarterNote, readIntroPromise, readNoteSharingLine } from "./copy";

describe("the intro state machine", () => {
  it("lets every action start only from a state that allows it", () => {
    for (const { nextState } of Object.values(INTRO_ACTION_RULES)) {
      expect(readStatesLeadingTo(nextState).length).toBeGreaterThan(0);
    }
  });

  it("has no way out of a closed state", () => {
    for (const state of [INTRO_STATES.declined, INTRO_STATES.withdrawn, INTRO_STATES.completed, INTRO_STATES.expired]) {
      expect(INTRO_TRANSITIONS[state]).toEqual([]);
      expect(isOpenIntroState(state)).toBe(false);
    }
  });

  it("treats requested and accepted as the open states", () => {
    expect(OPEN_INTRO_STATES).toEqual([INTRO_STATES.requested, INTRO_STATES.accepted]);
  });

  it("completes only from accepted", () => {
    expect(readStatesLeadingTo(INTRO_STATES.completed)).toEqual([INTRO_STATES.accepted]);
  });

  it("withdraws only from requested", () => {
    expect(readStatesLeadingTo(INTRO_STATES.withdrawn)).toEqual([INTRO_STATES.requested]);
  });
});

describe("intro copy", () => {
  const PERSON = { id: "1", name: "Amara Osei", headline: "Founder, Tidewell", linkedinSlug: "amara-osei", avatarUrl: null, isAvailable: true };
  const INTRODUCER = { ...PERSON, id: "2", name: "Jonas Lindqvist" };
  const TARGET = { name: "Clara Bergström", headline: null, linkedinSlug: "clara" };

  it("makes the promise in the mockup's words", () => {
    expect(readIntroPromise("Jonas Lindqvist", "Clara Bergström")).toBe("Jonas reads your note first. Clara hears nothing unless they say yes.");
  });

  it("starts the note with a greeting and a question, never a fake detail", () => {
    const starter = composeStarterNote("Jonas Lindqvist", "Clara Bergström");

    expect(starter).toContain("Hi Jonas");
    expect(starter).toContain("introducing me to Clara");
  });

  it("builds a blurb the introducer can forward as is", () => {
    const blurb = composeForwardableBlurb({ requester: PERSON, introducer: INTRODUCER, target: TARGET, note: "About freight pricing." });

    expect(blurb).toContain("Hi Clara,");
    expect(blurb).toContain("Amara Osei (Founder, Tidewell) asked me for an intro");
    expect(blurb).toContain("About freight pricing.");
    expect(blurb).toContain("https://www.linkedin.com/in/amara-osei");
    expect(blurb).toContain("If not, no problem at all.");
  });

  it("forwards the requester's reason without the greeting meant for the introducer", () => {
    const note = `${composeStarterNote("Jonas Lindqvist", "Clara Bergström")}We sell freight tools.`;

    const blurb = composeForwardableBlurb({ requester: PERSON, introducer: INTRODUCER, target: TARGET, note });

    expect(blurb).not.toContain("Hi Jonas");
    expect(blurb).toContain("We sell freight tools.");
  });

  it("keeps a note the requester rewrote", () => {
    const blurb = composeForwardableBlurb({ requester: PERSON, introducer: INTRODUCER, target: TARGET, note: "Jonas, you know why." });

    expect(blurb).toContain("Jonas, you know why.");
  });

  it("strips bidirectional controls from the blurb", () => {
    const blurb = composeForwardableBlurb({
      requester: { ...PERSON, name: "Ama\u202Era Osei", headline: "Foun\u2066der" },
      introducer: INTRODUCER,
      target: { ...TARGET, name: "Cl\u202Eara B" },
      note: "Note\u202E",
    });

    expect(blurb).not.toMatch(/[\u202A-\u202E\u2066-\u2069]/);
  });

  it("warns that the note may reach the target", () => {
    expect(readNoteSharingLine("Jonas Lindqvist", "Clara Bergström")).toBe("If Jonas says yes, they may pass your note on to Clara.");
  });

  it("leaves out what it doesn't know", () => {
    const blurb = composeForwardableBlurb({
      requester: { ...PERSON, headline: null, linkedinSlug: null },
      introducer: INTRODUCER,
      target: TARGET,
      note: "Hi",
    });

    expect(blurb).toContain("Amara Osei asked me");
    expect(blurb).not.toContain("LinkedIn");
  });
});
