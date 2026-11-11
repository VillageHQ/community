import { describe, expect, it } from "vitest";

import { readSetupLede, readSetupRows, SETUP_ROW_STATES, type SetupFacts } from "./admin-setup-rows.ts";

const FRESH_INSTALL: SetupFacts = {
  isBrandSaved: false,
  isMailOn: false,
  hasSendingDomain: false,
  isNetworkOn: true,
  hasVillageKeys: false,
  isChatOn: true,
  isChatPosting: false,
  isPerksOn: true,
  isPerksShown: false,
  featuresOn: 8,
  openReports: 0,
};

function readStates(facts: SetupFacts) {
  return readSetupRows(facts).map(({ title, state }) => [title, state.kind === SETUP_ROW_STATES.done ? "Set up" : state.kind === SETUP_ROW_STATES.todo ? "Not yet" : state.text]);
}

describe("the Set up list", () => {
  it("lists Founderhall's plumbing pages, then Community's Features and Reports", () => {
    expect(readSetupRows(FRESH_INSTALL).map(({ title }) => title)).toEqual([
      "Settings",
      "Mail",
      "Village",
      "Import members",
      "Sign-in links",
      "Integrations",
      "Perks",
      "Audit log",
      "Features",
      "Reports",
    ]);
  });

  it("says what a fresh install still needs, in Founderhall's words", () => {
    expect(readStates(FRESH_INSTALL)).toEqual([
      ["Settings", "Not yet"],
      ["Mail", "Not yet"],
      ["Village", "Not yet"],
      ["Import members", "optional"],
      ["Sign-in links", "in use"],
      ["Integrations", "optional"],
      ["Perks", "optional"],
      ["Audit log", "always on"],
      ["Features", "8 on"],
      ["Reports", "none open"],
    ]);
    expect(readSetupRows(FRESH_INSTALL).find(({ key }) => key === "links")?.description).toBe(
      "While mail is off, invite and sign-in links wait here for you to copy and send.",
    );
  });

  it("marks each page set up once it is", () => {
    const states = readStates({ ...FRESH_INSTALL, isBrandSaved: true, isMailOn: true, hasSendingDomain: true, hasVillageKeys: true, isChatPosting: true, isPerksShown: true, openReports: 2 });
    expect(states.slice(0, 3).every(([, state]) => state === "Set up")).toBe(true);
    expect(states).toContainEqual(["Sign-in links", "not needed"]);
    expect(states).toContainEqual(["Integrations", "Set up"]);
    expect(states).toContainEqual(["Reports", "2 open"]);
  });

  it("sends a switched-off feature's row to the switch", () => {
    const rows = readSetupRows({ ...FRESH_INSTALL, isNetworkOn: false, isChatOn: false, isPerksOn: false });
    for (const key of ["village", "integrations", "perks"]) {
      const row = rows.find((candidate) => candidate.key === key);
      expect(row?.state).toEqual({ kind: SETUP_ROW_STATES.word, text: "off" });
      expect(row?.href).toBe("/admin/features");
    }
  });

  it("tells a managed fund it has nothing to paste", () => {
    expect(readSetupLede("Harbor Ventures", false)).toBe("The plumbing behind Harbor Ventures. Each page says in plain words what it needs.");
    expect(readSetupLede("Harbor Ventures", true)).toContain("nothing to paste");
  });
});
