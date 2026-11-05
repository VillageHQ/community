import { readdirSync, statSync } from "node:fs";
import { resolve } from "node:path";

import { describe, expect, it } from "vitest";

import { describeBadge, isNavigationItemActive, NAVIGATION, NAVIGATION_SECTIONS, selectNavigationItems } from "./navigation";
import { ROUTES } from "./routes";

const APP_GROUP = resolve(import.meta.dirname, "../app/(app)");

function hasPage(href: string) {
  const directory = resolve(APP_GROUP, `.${href}`);
  return readdirSync(directory).includes("page.tsx") && statSync(directory).isDirectory();
}

describe("the navigation", () => {
  it("lists only routes with a page", () => {
    for (const { href } of Object.values(NAVIGATION)) {
      expect(hasPage(href)).toBe(true);
    }
  });

  it("shows members Feed, Members and Network", () => {
    const labels = selectNavigationItems(NAVIGATION_SECTIONS.primary, false).map(({ label }) => label);

    expect(labels).toEqual(["Feed", "Members", "Network"]);
  });

  it("hides Admin from members", () => {
    expect(selectNavigationItems(NAVIGATION_SECTIONS.admin, false)).toEqual([]);
  });

  it("shows Admin to admins", () => {
    const labels = selectNavigationItems(NAVIGATION_SECTIONS.admin, true).map(({ label }) => label);

    expect(labels).toEqual(["Admin"]);
  });

  describe("active state", () => {
    it("matches Feed only on the root path", () => {
      expect(isNavigationItemActive(ROUTES.feed, ROUTES.feed)).toBe(true);
      expect(isNavigationItemActive(ROUTES.feed, ROUTES.network)).toBe(false);
    });

    it("matches a section on its nested paths", () => {
      expect(isNavigationItemActive(ROUTES.admin, `${ROUTES.admin}/anything`)).toBe(true);
    });

    it("doesn't match a path that only shares a prefix", () => {
      expect(isNavigationItemActive(ROUTES.admin, `${ROUTES.admin}-other`)).toBe(false);
    });
  });

  it("describes badges for screen readers with correct grammar", () => {
    expect(describeBadge(1)).toBe("1 needs your attention");
    expect(describeBadge(3)).toBe("3 need your attention");
  });
});
