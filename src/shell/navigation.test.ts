import { readdirSync, statSync } from "node:fs";
import { resolve } from "node:path";

import { describe, expect, it } from "vitest";

import { NAVIGATION_SECTIONS } from "@/platform/modules/manifest";
import { ROUTES } from "@/platform/http/routes";

import { NAVIGATION, selectNavigationItems } from "./navigation";
import {
  CONSOLE_KEYS,
  describeBadge,
  describeNavigationBadge,
  isNavigationItemActive,
  MEMBER_KEYS,
  NAVIGATION_BADGES,
  readConsoleKey,
  readConsoleTabKey,
  readMemberKey,
  readMemberTabKey,
  readShellMode,
} from "./navigation-rules";

const APP_GROUP = resolve(import.meta.dirname, "../app/(app)");

function hasPage(href: string) {
  const directory = resolve(APP_GROUP, `.${href}`);
  return readdirSync(directory).includes("page.tsx") && statSync(directory).isDirectory();
}

const MEMBER_ITEMS = selectNavigationItems(NAVIGATION_SECTIONS.primary, false);

describe("the navigation", () => {
  it("lists only routes with a page", () => {
    for (const { href } of NAVIGATION) {
      expect(hasPage(href)).toBe(true);
    }
  });

  it("lists Founderhall's member menu in its order", () => {
    expect(MEMBER_ITEMS.map(({ label }) => label)).toEqual([
      "Today",
      "Asks & updates",
      // Community's feed, while it's on (Founderhall has none).
      "Feed",
      "Search",
      "Directory",
      "Jobs",
      "Intros",
      "Inbox",
      "Perks",
      "My profile",
    ]);
  });

  it("gives six of them a phone tab", () => {
    expect(MEMBER_ITEMS.flatMap(({ tabLabel }) => (tabLabel ? [tabLabel] : []))).toEqual(["Today", "Asks", "Search", "Directory", "Intros", "Inbox"]);
  });

  it("hides the console from members", () => {
    expect(selectNavigationItems(NAVIGATION_SECTIONS.admin, false)).toEqual([]);
  });

  it("lists Founderhall's console menu for admins", () => {
    const labels = selectNavigationItems(NAVIGATION_SECTIONS.admin, true).map(({ label }) => label);

    expect(labels).toEqual(["Home", "Partner report", "Intro log", "Members", "Invites", "Asks & digest", "Job board", "Set up"]);
  });

  it("hides a console item whose module is off", () => {
    const labels = selectNavigationItems(NAVIGATION_SECTIONS.admin, true, new Set(["members", "admin", "intros"])).map(({ label }) => label);

    expect(labels).toEqual(["Home", "Partner report", "Intro log", "Members", "Invites", "Set up"]);
  });

  describe("which item a page lights", () => {
    it("lights Today only on the root path", () => {
      expect(isNavigationItemActive(ROUTES.feed, ROUTES.feed)).toBe(true);
      expect(isNavigationItemActive(ROUTES.feed, ROUTES.network)).toBe(false);
    });

    it("doesn't match a path that only shares a prefix", () => {
      expect(isNavigationItemActive(ROUTES.admin, `${ROUTES.admin}-other`)).toBe(false);
    });

    it.each([
      [ROUTES.today, MEMBER_KEYS.today, MEMBER_KEYS.today],
      ["/members/abc", MEMBER_KEYS.directory, MEMBER_KEYS.directory],
      [ROUTES.editCard, MEMBER_KEYS.me, null],
      [ROUTES.yourData, MEMBER_KEYS.me, null],
      ["/jobs/yours", MEMBER_KEYS.jobs, MEMBER_KEYS.directory],
      ["/messages/123", MEMBER_KEYS.inbox, MEMBER_KEYS.inbox],
      [ROUTES.network, MEMBER_KEYS.search, MEMBER_KEYS.search],
      [ROUTES.welcome, null, null],
    ])("%s lights %s in the sidebar and %s on the phone", (pathname, sidebarKey, tabKey) => {
      expect(readMemberKey(pathname, MEMBER_ITEMS)).toBe(sidebarKey);
      expect(readMemberTabKey(pathname, MEMBER_ITEMS)).toBe(tabKey);
    });

    it.each([
      [ROUTES.admin, CONSOLE_KEYS.home, CONSOLE_KEYS.home],
      [ROUTES.adminReport, CONSOLE_KEYS.report, CONSOLE_KEYS.introLog],
      [ROUTES.adminIntroLog, CONSOLE_KEYS.introLog, CONSOLE_KEYS.introLog],
      [ROUTES.adminInvites, CONSOLE_KEYS.invites, CONSOLE_KEYS.members],
      ["/admin/jobs", CONSOLE_KEYS.jobs, CONSOLE_KEYS.members],
      [ROUTES.adminWeeklyEmail, CONSOLE_KEYS.asks, CONSOLE_KEYS.asks],
      [ROUTES.adminVillage, CONSOLE_KEYS.setup, CONSOLE_KEYS.setup],
      [ROUTES.adminMail, CONSOLE_KEYS.setup, CONSOLE_KEYS.setup],
      [ROUTES.adminImport, CONSOLE_KEYS.setup, CONSOLE_KEYS.setup],
      [ROUTES.adminLinks, CONSOLE_KEYS.setup, CONSOLE_KEYS.setup],
      [ROUTES.adminReports, CONSOLE_KEYS.setup, CONSOLE_KEYS.setup],
      [ROUTES.adminFeatures, CONSOLE_KEYS.setup, CONSOLE_KEYS.setup],
      [ROUTES.adminAuditLog, CONSOLE_KEYS.setup, CONSOLE_KEYS.setup],
      [ROUTES.adminSetup, CONSOLE_KEYS.setup, CONSOLE_KEYS.setup],
    ])("%s lights %s in the console and %s on the phone", (pathname, sidebarKey, tabKey) => {
      expect(readConsoleKey(pathname)).toBe(sidebarKey);
      expect(readConsoleTabKey(pathname)).toBe(tabKey);
    });

    it("shows the console only to an admin under /admin", () => {
      expect(readShellMode(ROUTES.adminMembers, true)).toBe("console");
      expect(readShellMode(ROUTES.feed, true)).toBe("member");
      expect(readShellMode(ROUTES.adminMembers, false)).toBe("member");
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
