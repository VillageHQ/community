import { describe, expect, it } from "vitest";

import {
  INTRO_ACTION_RULES,
  INTRO_STATES,
  INTRO_TRANSITIONS,
  OPEN_INTRO_STATES,
  isOpenIntroState,
  readRequesterState,
  readStatesLeadingTo,
  type IntroState,
} from "./contract";
import { composeConsentNote, composeForwardableBlurb, composeJoiningMessage, composeStarterNote, readConsentPromise, readIntroPromise, readNoteSharingLine } from "./copy";

describe("the intro state machine", () => {
  it("lets every action start only from a state that allows it", () => {
    for (const { nextState } of Object.values(INTRO_ACTION_RULES)) {
      expect(readStatesLeadingTo(nextState).length).toBeGreaterThan(0);
    }
  });

  it("has no way out of a closed state", () => {
    for (const state of [INTRO_STATES.declined, INTRO_STATES.withdrawn, INTRO_STATES.completed, INTRO_STATES.expired, INTRO_STATES.targetDeclined]) {
      expect(INTRO_TRANSITIONS[state]).toEqual([]);
      expect(isOpenIntroState(state)).toBe(false);
    }
  });

  it("treats every state still waiting on someone as open", () => {
    expect(OPEN_INTRO_STATES).toEqual([INTRO_STATES.requested, INTRO_STATES.accepted, INTRO_STATES.askingTarget, INTRO_STATES.targetAgreed]);
  });

  it("completes only from an old accepted ask or after the target's yes", () => {
    expect(readStatesLeadingTo(INTRO_STATES.completed)).toEqual([INTRO_STATES.accepted, INTRO_STATES.targetAgreed]);
  });

  it("withdraws only before the target said yes", () => {
    expect(readStatesLeadingTo(INTRO_STATES.withdrawn)).toEqual([INTRO_STATES.requested, INTRO_STATES.askingTarget]);
  });

  it("reaches the target's answers only from asking them", () => {
    expect(readStatesLeadingTo(INTRO_STATES.targetAgreed)).toEqual([INTRO_STATES.askingTarget]);
    expect(readStatesLeadingTo(INTRO_STATES.targetDeclined)).toEqual([INTRO_STATES.askingTarget]);
  });

  it("sends no new ask to the old accepted state", () => {
    expect(readStatesLeadingTo(INTRO_STATES.accepted)).toEqual([]);
  });

  describe("every move", () => {
    const LEGAL_MOVES: Record<IntroState, readonly IntroState[]> = {
      [INTRO_STATES.requested]: [INTRO_STATES.askingTarget, INTRO_STATES.declined, INTRO_STATES.withdrawn, INTRO_STATES.expired],
      [INTRO_STATES.accepted]: [INTRO_STATES.completed, INTRO_STATES.expired],
      [INTRO_STATES.askingTarget]: [INTRO_STATES.targetAgreed, INTRO_STATES.targetDeclined, INTRO_STATES.declined, INTRO_STATES.withdrawn, INTRO_STATES.expired],
      [INTRO_STATES.targetAgreed]: [INTRO_STATES.completed, INTRO_STATES.expired],
      [INTRO_STATES.declined]: [],
      [INTRO_STATES.withdrawn]: [],
      [INTRO_STATES.completed]: [],
      [INTRO_STATES.expired]: [],
      [INTRO_STATES.targetDeclined]: [],
    };
    const STATES = Object.values(INTRO_STATES);
    const MOVES = STATES.flatMap((from) => STATES.map((to) => ({ from, to })));

    it.each(MOVES)("from $from to $to is legal only if listed", ({ from, to }) => {
      expect(INTRO_TRANSITIONS[from].includes(to)).toBe(LEGAL_MOVES[from].includes(to));
    });
  });
});

describe("what a requester sees of each state", () => {
  it.each([
    [INTRO_STATES.requested, INTRO_STATES.requested],
    [INTRO_STATES.askingTarget, INTRO_STATES.requested],
    [INTRO_STATES.targetDeclined, INTRO_STATES.declined],
    [INTRO_STATES.declined, INTRO_STATES.declined],
    [INTRO_STATES.targetAgreed, INTRO_STATES.targetAgreed],
    [INTRO_STATES.completed, INTRO_STATES.completed],
  ])("shows %s as %s", (state, shown) => {
    expect(readRequesterState(state)).toBe(shown);
  });

  it("refuses a state it doesn't know", () => {
    expect(() => readRequesterState("made_up")).toThrow();
  });
});

describe("intro copy", () => {
  const PERSON = { id: "1", name: "Amara Osei", headline: "Founder, Tidewell", linkedinSlug: "amara-osei", avatarUrl: null, isAvailable: true };
  const INTRODUCER = { ...PERSON, id: "2", name: "Jonas Lindqvist" };
  const TARGET = { name: "Clara Bergström", headline: null, linkedinSlug: "clara", isNamed: false };

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

  it("says what the target sees before anyone sends anything", () => {
    expect(readNoteSharingLine("Jonas Lindqvist", "Clara Bergström")).toBe("If Jonas says yes, Clara sees your name, your role and your note, then decides.");
  });

  it("promises the target a say", () => {
    expect(readConsentPromise("Clara Bergström")).toBe("You're only introduced if Clara says yes too.");
  });

  describe("the note the connector forwards", () => {
    const LINK = "https://community.test/meet/secret-token";

    it("carries the private link and says either answer is fine", () => {
      const consentNote = composeConsentNote({ requester: PERSON, introducer: INTRODUCER, target: TARGET, note: "About freight pricing." }, LINK);

      expect(consentNote).toContain("Hi Clara,");
      expect(consentNote).toContain("About freight pricing.");
      expect(consentNote).toContain(LINK);
      expect(consentNote).toContain("Amara won't hear who said it");
      expect(consentNote).not.toContain("Would you like me to connect you");
    });

    it("drops the greeting meant for the connector", () => {
      const note = `${composeStarterNote("Jonas Lindqvist", "Clara Bergström")}We sell freight tools.`;

      expect(composeConsentNote({ requester: PERSON, introducer: INTRODUCER, target: TARGET, note }, LINK)).not.toContain("Hi Jonas");
    });
  });

  describe("the message that joins them", () => {
    it("names both and says the target agreed", () => {
      const message = composeJoiningMessage({ requester: PERSON, introducer: INTRODUCER, target: TARGET, note: "About freight pricing." });

      expect(message).toContain("Clara, meet Amara. Amara, meet Clara.");
      expect(message).toContain("you said yes");
      expect(message).toContain("About freight pricing.");
    });
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
