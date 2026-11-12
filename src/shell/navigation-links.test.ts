// @vitest-environment jsdom
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { cleanup, render, screen, waitFor, within } from "@testing-library/react";
import { createElement } from "react";
import { afterEach, describe, expect, it, vi } from "vitest";

import { ASK_API_ROUTES } from "@/modules/asks/contract";
import { introsManifest } from "@/modules/intros/manifest";
import { messagesManifest } from "@/modules/messages/manifest";
import { API_ROUTES, ROUTES } from "@/platform/http/routes";

import { readAdminTabs } from "./admin-tabs";
import type { AdminTabFacts } from "./admin-badges";
import { buildShellNavigation } from "./navigation";
import { FounderViewStrip, ModeSwitch, SidebarNavigation, TabBar } from "./navigation-links";
import { CONSOLE_KEYS } from "./navigation-rules";

const location = vi.hoisted(() => ({ pathname: "/" }));

vi.mock("next/navigation", () => ({ usePathname: () => location.pathname }));
// Marks the app's own links, so a test can tell them from a plain full-page link.
vi.mock("next/link", async () => {
  const { createElement: create } = await import("react");
  return { default: (props: Record<string, unknown>) => create("a", { ...props, "data-app-link": "" }) };
});

function stubCounts(unreadCount: number) {
  vi.stubGlobal(
    "fetch",
    vi.fn(async (path: string) => {
      if (path === API_ROUTES.introCounts) {
        return new Response(JSON.stringify({ waitingOnYou: 0, updates: 0 }), { headers: { "Content-Type": "application/json" } });
      }
      if (path === ASK_API_ROUTES.counts) {
        return new Response(JSON.stringify({ newOffers: 0 }), { headers: { "Content-Type": "application/json" } });
      }
      if (path !== API_ROUTES.messageUnreadCount) throw new Error(`Unexpected request to ${path}`);
      return new Response(JSON.stringify({ unreadCount }), { headers: { "Content-Type": "application/json" } });
    }),
  );
}

function renderWithClient(element: ReturnType<typeof createElement>, staleTime?: number) {
  const queryClient = new QueryClient({ defaultOptions: { queries: { retry: false, ...(staleTime === undefined ? {} : { staleTime }) } } });
  render(createElement(QueryClientProvider, { client: queryClient }, element));
  return queryClient;
}

type ShellPartOptions = { isAdmin?: boolean; enabledIds?: readonly string[]; badges?: Record<string, number> };

function renderShellPart(part: typeof TabBar | typeof SidebarNavigation, { isAdmin = false, enabledIds, badges = {} }: ShellPartOptions = {}) {
  stubCounts(0);
  const navigation = enabledIds ? buildShellNavigation(new Set(enabledIds), isAdmin) : buildShellNavigation(undefined, isAdmin);
  renderWithClient(createElement(part, { navigation, isAdmin, badges }), Number.POSITIVE_INFINITY);
}

function readNames(label: string) {
  return Array.from(screen.getByRole("navigation", { name: label }).querySelectorAll("a"), (link) => link.textContent);
}

afterEach(() => {
  cleanup();
  vi.unstubAllGlobals();
  location.pathname = ROUTES.feed;
});

describe("the phone tab bar", () => {
  it("shows a member Founderhall's six tabs, and Feed while the feed is on", () => {
    renderShellPart(TabBar);

    expect(readNames("Sections")).toEqual(["Today", "Asks", "Feed", "Search", "Directory", "Intros", "Inbox"]);
  });

  it("fits every tab in equal columns, as Founderhall's bar does", () => {
    renderShellPart(TabBar, { isAdmin: true });

    const bar = screen.getByRole("navigation", { name: "Sections" });
    expect(bar.style.gridTemplateColumns).toBe("repeat(8, 1fr)");
    expect(bar.dataset.count).toBe("8");
  });

  it("leaves out the tab of a module that is off", () => {
    renderShellPart(TabBar, { enabledIds: ["feed", messagesManifest.id, "members", introsManifest.id, "admin"] });

    expect(readNames("Sections")).toEqual(["Today", "Feed", "Directory", "Intros", "Inbox"]);
  });

  it("adds a Console tab for an admin on member pages", () => {
    renderShellPart(TabBar, { isAdmin: true });

    expect(readNames("Sections").at(-1)).toBe("Console");
  });

  it("shows the console's five tabs and a Founder tab in the console", () => {
    location.pathname = ROUTES.adminMembers;
    renderShellPart(TabBar, { isAdmin: true });

    expect(readNames("Sections")).toEqual(["Home", "Intros", "Asks", "Members", "Set up", "Founder"]);
    expect(screen.getByRole("link", { name: "Members" }).getAttribute("aria-current")).toBe("page");
  });

  it("lights Directory on the job board", () => {
    location.pathname = "/jobs";
    renderShellPart(TabBar);

    expect(screen.getByRole("link", { name: "Directory" }).getAttribute("aria-current")).toBe("page");
  });

  it("lights nothing on My profile", () => {
    location.pathname = ROUTES.editCard;
    renderShellPart(TabBar);

    expect(screen.getByRole("navigation", { name: "Sections" }).querySelector("[aria-current]")).toBeNull();
  });

  it("shows the intros count on the Intros tab", () => {
    renderShellPart(TabBar, { badges: { intros: 2 } });

    const introsTab = screen.getByRole("link", { name: /Intros/ });
    expect(within(introsTab).getByRole("img", { name: "2 intros need a look" }).textContent).toBe("2");
  });
});

describe("the sidebar", () => {
  it("lists the member menu under Members", () => {
    renderShellPart(SidebarNavigation);

    expect(screen.getByText("Members")).toBeTruthy();
    expect(readNames("Main")).toEqual(["Today", "Asks & updates", "Feed", "Search", "Directory", "Jobs", "Intros", "Inbox", "Perks", "My profile"]);
  });

  it("lists the console menu under Console on console pages", () => {
    location.pathname = ROUTES.adminVillage;
    renderShellPart(SidebarNavigation, { isAdmin: true });

    expect(screen.getByText("Console")).toBeTruthy();
    expect(screen.getByRole("link", { name: "Set up" }).getAttribute("aria-current")).toBe("page");
  });

  it("lights My profile, not Directory, on the profile editor", () => {
    location.pathname = ROUTES.editCard;
    renderShellPart(SidebarNavigation);

    expect(screen.getByRole("link", { name: "My profile" }).getAttribute("aria-current")).toBe("page");
    expect(screen.getByRole("link", { name: "Directory" }).getAttribute("aria-current")).toBeNull();
  });

  // Its page frames the marketplace under its own security policy, which only a full page load applies.
  it("loads the whole Perks page, while other entries navigate inside the app", () => {
    renderShellPart(SidebarNavigation);

    expect(screen.getByRole("link", { name: /Perks/ }).hasAttribute("data-app-link")).toBe(false);
    expect(screen.getByRole("link", { name: /Inbox/ }).hasAttribute("data-app-link")).toBe(true);
  });
});

describe("the messages badge", () => {
  it("shows the unread count in the sidebar", () => {
    stubCounts(1);
    renderWithClient(createElement(SidebarNavigation, { navigation: buildShellNavigation(), isAdmin: false, badges: { messages: 1 } }));

    expect(screen.getByRole("img", { name: "1 unread message" })).toBeTruthy();
  });

  it("follows the count the server reports", async () => {
    stubCounts(4);
    const queryClient = renderWithClient(createElement(TabBar, { navigation: buildShellNavigation(), isAdmin: false, badges: { messages: 1 } }));

    await queryClient.invalidateQueries();

    await waitFor(() => expect(screen.getByRole("img", { name: "4 unread messages" })).toBeTruthy());
  });
});

describe("the admin's two modes", () => {
  it("marks Console in the switch on console pages", () => {
    location.pathname = ROUTES.admin;
    render(createElement(ModeSwitch));

    expect(screen.getByRole("link", { name: "Console" }).getAttribute("aria-current")).toBe("true");
    expect(screen.getByRole("link", { name: "View as a founder" }).getAttribute("aria-current")).toBeNull();
  });

  it("shows the founder-view strip on member pages only", () => {
    render(createElement(FounderViewStrip, { name: "Maya Ortiz" }));
    expect(screen.getByText(/This is what members see. You are signed in as Maya Ortiz, an admin./)).toBeTruthy();
    cleanup();

    location.pathname = ROUTES.adminReport;
    render(createElement(FounderViewStrip, { name: "Maya Ortiz" }));
    expect(screen.queryByText(/Founder view/)).toBeNull();
  });
});

describe("the console's Community-only pages", () => {
  const FACTS = {
    setupStepsLeft: 1,
    membersBadge: 0,
    reportsBadge: 2,
    creditsBadge: 0,
    chatBadge: 0,
    isSetupComplete: false,
    hiddenTabHrefs: ["/admin/integrations"],
    villageTrouble: null,
  } as unknown as AdminTabFacts;

  it("leaves the plumbing pages to the Set up list", () => {
    expect(readAdminTabs(CONSOLE_KEYS.setup, FACTS)).toEqual([]);
  });

  it("keeps the weekly email beside Asks & digest", () => {
    expect(readAdminTabs(CONSOLE_KEYS.asks, FACTS).map(({ label }) => label)).toEqual(["Asks", "Weekly email"]);
  });

  it("adds nothing to pages with their own menu item", () => {
    expect(readAdminTabs(CONSOLE_KEYS.home, FACTS)).toEqual([]);
  });
});
