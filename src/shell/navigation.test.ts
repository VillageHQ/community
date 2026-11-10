import { readdirSync, statSync } from "node:fs";
import { resolve } from "node:path";

import { describe, expect, it } from "vitest";

import { NAVIGATION_SECTIONS } from "@/platform/modules/manifest";

import { NAVIGATION, selectNavigationItems } from "./navigation";
import { describeBadge, describeNavigationBadge, isNavigationItemActive, NAVIGATION_BADGES } from "./navigation-rules";
import { ROUTES } from "@/platform/http/routes";

const APP_GROUP = resolve(import.meta.dirname, "../app/(app)");

function hasPage(href: string) {
  const directory = resolve(APP_GROUP, `.${href}`);
  return readdirSync(directory).includes("page.tsx") && statSync(directory).isDirectory();
}

describe("the navigation", () => {
  it("lists only routes with a page", () => {
    for (const { href } of NAVIGATION) {
      expect(hasPage(href)).toBe(true);
    }
  });

  it("lists every primary module in registry order", () => {
    const labels = selectNavigationItems(NAVIGATION_SECTIONS.primary, false).map(({ label }) => label);

    expect(labels).toEqual(["Feed", "Messages", "Members", "Network", "Intros", "Asks", "Jobs"]);
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

  it("describes the intros badge in plain words", () => {
    expect(describeNavigationBadge(NAVIGATION_BADGES.intros, 1)).toBe("1 intro needs a look");
    expect(describeNavigationBadge(NAVIGATION_BADGES.intros, 2)).toBe("2 intros need a look");
  });

  it("describes the asks badge as new offers", () => {
    expect(describeNavigationBadge(NAVIGATION_BADGES.asks, 1)).toBe("1 new offer of help");
    expect(describeNavigationBadge(NAVIGATION_BADGES.asks, 3)).toBe("3 new offers of help");
  });

  it("describes the messages badge as unread messages", () => {
    expect(describeNavigationBadge(NAVIGATION_BADGES.messages, 1)).toBe("1 unread message");
    expect(describeNavigationBadge(NAVIGATION_BADGES.messages, 4)).toBe("4 unread messages");
  });
});
