import { describe, expect, it } from "vitest";

import { describeJoinSteps, HOME_HEROES } from "./home-steps";
import { NETWORK_PROGRESS } from "./village/network-progress-stages";

const FORBIDDEN_CLAIMS = /yes or no to every intro|feed|messages|directory|\b\d{2,}\b/i;

function readStates(progress: Parameters<typeof describeJoinSteps>[0]) {
  return describeJoinSteps(progress).map(({ state }) => state);
}

describe("the home page's next steps", () => {
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
      const hero = HOME_HEROES[NETWORK_PROGRESS.needsApproval];

      expect(steps[2]?.description).toBe("Waiting for an admin to approve your Village account.");
      expect(hero.title).toBe("An admin needs to approve your Village account");
      expect(`${hero.title} ${hero.description}`).not.toMatch(/you're in|connect your village/i);
    });

    it("offers no action, because only an admin can act", () => {
      expect(HOME_HEROES[NETWORK_PROGRESS.needsApproval].action).toBeUndefined();
    });
  });

  it("marks nothing as next while the community isn't ready", () => {
    expect(readStates(NETWORK_PROGRESS.notConfigured)).toEqual(["todo", "todo", "todo", "todo"]);
  });

  it("offers no action a member can't take yet", () => {
    expect(HOME_HEROES[NETWORK_PROGRESS.notConfigured].action).toBeUndefined();
    expect(HOME_HEROES[NETWORK_PROGRESS.awaitingGroup].action).toBeUndefined();
  });

  it("makes no claim the app can't back", () => {
    const copy = Object.values(HOME_HEROES).map(({ title, description }) => `${title} ${description}`);

    expect(copy.join(" ")).not.toMatch(FORBIDDEN_CLAIMS);
  });
});
