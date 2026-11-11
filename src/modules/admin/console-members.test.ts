import { describe, expect, it } from "vitest";

import { countConsoleMembers, matchesConsoleSearch, readRoleAndCompany, readWhen, sortConsoleMembers, type ConsoleMember } from "./console-members";

function person(overrides: Partial<ConsoleMember>): ConsoleMember {
  return {
    id: "m1",
    kind: "member",
    name: "Ada Okafor",
    email: "ada@example.test",
    avatarUrl: null,
    isAdmin: false,
    title: "Founder",
    company: "Gridwise",
    companyLogoUrl: null,
    location: "Lagos",
    state: "joined",
    since: "2026-09-26T10:00:00.000Z",
    isNeedsLook: false,
    deleteRequestedAt: null,
    ...overrides,
  };
}

describe("the console's Members table", () => {
  const everyone = [
    person({ id: "a", name: "Ada Okafor", state: "connected" }),
    person({ id: "m", name: "Maya Ortiz", isAdmin: true }),
    person({ id: "r", name: "Rex Removed", state: "removed" }),
    person({ id: "i", kind: "invite", name: null, email: "nadia@example.test", title: null, company: null, state: "invited", since: "2026-11-10T00:00:00.000Z" }),
  ];

  it("counts Founderhall's filters, leaving removed members to their own", () => {
    expect(countConsoleMembers(everyone)).toMatchObject({ all: 3, invited: 1, joined: 1, connected: 1, admins: 1, delete: 0, removed: 1 });
  });

  it("finds people by name, email, company or city", () => {
    expect(matchesConsoleSearch(everyone[0]!, "gridwise")).toBe(true);
    expect(matchesConsoleSearch(everyone[0]!, "lagos")).toBe(true);
    expect(matchesConsoleSearch(everyone[3]!, "NADIA")).toBe(true);
    expect(matchesConsoleSearch(everyone[0]!, "zebra")).toBe(false);
  });

  it("lists members by name, then the people invited", () => {
    expect(sortConsoleMembers([everyone[3]!, everyone[1]!, everyone[0]!]).map(({ id }) => id)).toEqual(["a", "m", "i"]);
  });

  it("reads the When and Role and company cells in Founderhall's words", () => {
    expect(readWhen(everyone[0]!)).toBe("joined 26 Sep");
    expect(readWhen(everyone[3]!)).toBe("invited 10 Nov");
    expect(readRoleAndCompany(everyone[0]!)).toBe("Founder, Gridwise");
    expect(readRoleAndCompany(everyone[3]!)).toBeNull();
  });
});
