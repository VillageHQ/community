import { describe, expect, it } from "vitest";

import { pickAvatarTint, readFirstName, readInitials } from "./avatar-identity";

describe("avatar initials", () => {
  it.each([
    ["Amara Osei", "AO"],
    ["Amara", "A"],
    ["Clara van der Berg", "CB"],
    ["  inès   moreau ", "IM"],
    ["", "?"],
    ["   ", "?"],
  ])("reads %j as %s", (name, initials) => {
    expect(readInitials(name)).toBe(initials);
  });

  it("keeps a whole emoji or astral letter together", () => {
    expect(readInitials("𝒜mara Osei")).toBe("𝒜O");
  });
});

describe("first names", () => {
  it("reads the first word of a full name", () => {
    expect(readFirstName("  Amara Osei")).toBe("Amara");
  });
});

describe("avatar tints", () => {
  it("stays the same for one member id", () => {
    expect(pickAvatarTint("member-1")).toBe(pickAvatarTint("member-1"));
  });

  it("spreads ids across several tints", () => {
    const tints = new Set(Array.from({ length: 50 }, (_unused, index) => pickAvatarTint(`member-${index}`)));

    expect(tints.size).toBeGreaterThan(3);
  });
});
