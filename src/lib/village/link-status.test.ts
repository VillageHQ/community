import { describe, expect, it } from "vitest";

import { readVillageLinkState, VILLAGE_LINK_STATES, VILLAGE_LINK_TAGS } from "./link-status";

const NOTHING_KNOWN = { villageEmail: null, approvedVillageEmail: null, groupJoinedAt: null };
const JOINED_AT = new Date("2026-11-04T12:00:00Z");

function readTagLabel(facts: Parameters<typeof readVillageLinkState>[0]) {
  return VILLAGE_LINK_TAGS[readVillageLinkState(facts)].label;
}

describe("the Village link tag", () => {
  it("never calls a member who only consented linked", () => {
    expect(readVillageLinkState(NOTHING_KNOWN)).toBe(VILLAGE_LINK_STATES.notJoined);
    expect(readTagLabel(NOTHING_KNOWN)).toBe("Not joined yet");
  });

  it("flags a mismatch for review, even for a joined member", () => {
    expect(readTagLabel({ ...NOTHING_KNOWN, villageEmail: "other@example.test", groupJoinedAt: JOINED_AT })).toBe(
      "Needs your review",
    );
  });

  it("says an admin approved the pair", () => {
    expect(readTagLabel({ ...NOTHING_KNOWN, approvedVillageEmail: "other@example.test" })).toBe("Approved by an admin");
  });

  it("says a joined member is in the group", () => {
    expect(readTagLabel({ ...NOTHING_KNOWN, groupJoinedAt: JOINED_AT })).toBe("In the group");
  });
});
