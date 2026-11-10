import { describe, expect, it } from "vitest";

import { SETUP_STEPS } from "./admin-setup-steps";
import { describeJoinSteps, NEXT_STEPS, selectNextSteps } from "./next-steps";
import { describeEmailConfirmation } from "@/modules/members/contract-email-confirmation-copy";
import { ROUTES } from "@/platform/http/routes";
import { NETWORK_PROGRESS } from "@/modules/network/contract-progress";

const FORBIDDEN_CLAIMS = /yes or no to every intro|feed|messages|directory|\b\d{2,}\b/i;

function readStates(progress: Parameters<typeof describeJoinSteps>[0]) {
  return describeJoinSteps(progress).map(({ state }) => state);
}

describe("the next steps", () => {
  it("points a new member at LinkedIn", () => {
    expect(readStates(NETWORK_PROGRESS.needsLinkedin)).toEqual(["current", "todo", "todo", "todo"]);
  });

  it("keeps sharing as the next step for a member who said not now", () => {
    expect(readStates(NETWORK_PROGRESS.needsConsent)).toEqual(["done", "current", "todo", "todo"]);
  });

  it("points a joined member at search", () => {
    expect(readStates(NETWORK_PROGRESS.ready)).toEqual(["done", "done", "done", "current"]);
  });

  describe("for a member blocked by a Village email mismatch", () => {
    it("asks for an admin's approval, not another sync", () => {
      const steps = describeJoinSteps(NETWORK_PROGRESS.needsApproval);
      const nextStep = NEXT_STEPS[NETWORK_PROGRESS.needsApproval];

      expect(steps[2]?.description).toBe("Waiting for an admin to approve your Village account.");
      expect(nextStep.title).toBe("An admin needs to approve your Village account");
      expect(`${nextStep.title} ${nextStep.description}`).not.toMatch(/you're in|connect your village/i);
    });

    it("offers no action, because only an admin can act", () => {
      expect(NEXT_STEPS[NETWORK_PROGRESS.needsApproval].action).toBeUndefined();
    });
  });

  it("marks nothing as next while the community isn't ready", () => {
    expect(readStates(NETWORK_PROGRESS.notConfigured)).toEqual(["todo", "todo", "todo", "todo"]);
  });

  it("offers no action a member can't take yet", () => {
    expect(NEXT_STEPS[NETWORK_PROGRESS.notConfigured].action).toBeUndefined();
    expect(NEXT_STEPS[NETWORK_PROGRESS.awaitingGroup].action).toBeUndefined();
  });

  describe("for a member whose email isn't confirmed", () => {
    it("waits on the fund by name when no email can be sent", () => {
      expect(describeEmailConfirmation("Northwind", false).title).toBe("Waiting for Northwind to confirm you");
    });

    it("points at the inbox when email is set up", () => {
      expect(describeEmailConfirmation("Northwind", true).title).toBe("Check your email to confirm it's you");
    });

    it("always offers somewhere to go", () => {
      expect(NEXT_STEPS[NETWORK_PROGRESS.needsEmailConfirmation].action).toBeDefined();
    });
  });

  it("makes no claim the app can't back", () => {
    const copy = Object.values(NEXT_STEPS).map(({ title, description }) => `${title} ${description}`);

    expect(copy.join(" ")).not.toMatch(FORBIDDEN_CLAIMS);
  });
});

describe("the next step card", () => {
  const CONFIRMATION = { title: "Check your email", description: "We sent a link." };
  const READY_FACTS = {
    setupProgress: null,
    networkProgress: NETWORK_PROGRESS.ready,
    communityName: "Northwind",
    isCardFilled: true,
    confirmationCopy: CONFIRMATION,
  };
  const PENDING_SETUP = {
    steps: [],
    doneCount: 1,
    totalCount: 4,
    stepsLeft: 3,
    currentStepId: SETUP_STEPS.keys,
    isComplete: false,
  };

  it("keeps admins on setup until it's done", () => {
    const [nextStep] = selectNextSteps({ ...READY_FACTS, setupProgress: PENDING_SETUP });

    expect(nextStep?.title).toBe("Let's get Northwind ready");
    expect(nextStep?.action?.href).toBe(ROUTES.admin);
    expect(nextStep?.progress).toMatchObject({ doneCount: 1, totalCount: 4 });
    expect(nextStep?.isUrgent).toBe(true);
  });

  it("moves an admin past finished setup, and leaves a ready network to Today's search box", () => {
    expect(selectNextSteps({ ...READY_FACTS, setupProgress: { ...PENDING_SETUP, isComplete: true } })).toEqual([]);
    expect(selectNextSteps({ ...READY_FACTS, isCardFilled: false }).map(({ title }) => title)).toEqual(["Finish your card"]);
  });

  it("shows an unfinished card alongside the network step", () => {
    const steps = selectNextSteps({ ...READY_FACTS, networkProgress: NETWORK_PROGRESS.needsLinkedin, isCardFilled: false });

    expect(steps.map(({ title }) => title)).toEqual([NEXT_STEPS[NETWORK_PROGRESS.needsLinkedin].title, "Finish your card"]);
    expect(steps[1]?.action?.href).toBe(ROUTES.editCard);
  });

  it("puts an unfinished card first when the network needs nothing from the member", () => {
    const steps = selectNextSteps({ ...READY_FACTS, networkProgress: NETWORK_PROGRESS.notConfigured, isCardFilled: false });

    expect(steps.map(({ title }) => title)).toEqual(["Finish your card", NEXT_STEPS[NETWORK_PROGRESS.notConfigured].title]);
  });

  it("shows an unfinished card alongside admin setup", () => {
    const steps = selectNextSteps({ ...READY_FACTS, setupProgress: PENDING_SETUP, isCardFilled: false });

    expect(steps.map(({ title }) => title)).toEqual(["Let's get Northwind ready", "Finish your card"]);
  });

  it("carries the network step's words, action and progress", () => {
    const [nextStep] = selectNextSteps({ ...READY_FACTS, networkProgress: NETWORK_PROGRESS.needsConsent });

    expect(nextStep?.title).toBe(NEXT_STEPS[NETWORK_PROGRESS.needsConsent].title);
    expect(nextStep?.action).toEqual({ label: "See the deal", href: ROUTES.network });
    expect(nextStep?.progress).toMatchObject({ doneCount: 1, totalCount: 4 });
  });

  it("offers no action when only an admin can act", () => {
    const [nextStep] = selectNextSteps({ ...READY_FACTS, networkProgress: NETWORK_PROGRESS.needsApproval });

    expect(nextStep?.action).toBeNull();
  });

  it("uses the confirmation copy for an unconfirmed email", () => {
    const [nextStep] = selectNextSteps({ ...READY_FACTS, networkProgress: NETWORK_PROGRESS.needsEmailConfirmation });

    expect(nextStep?.title).toBe(CONFIRMATION.title);
  });

  it("isn't urgent when there's nothing the member can do", () => {
    const [nextStep] = selectNextSteps({ ...READY_FACTS, networkProgress: NETWORK_PROGRESS.notConfigured });

    expect(nextStep?.isUrgent).toBe(false);
  });

  describe("with network off", () => {
    it("suggests nothing once the card is filled", () => {
      expect(selectNextSteps({ ...READY_FACTS, networkProgress: null })).toEqual([]);
    });

    it("still asks a member to finish their card", () => {
      const steps = selectNextSteps({ ...READY_FACTS, networkProgress: null, isCardFilled: false });

      expect(steps.map(({ title }) => title)).toEqual(["Finish your card"]);
    });
  });
});
