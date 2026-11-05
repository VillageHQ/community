// @vitest-environment jsdom
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { cleanup, fireEvent, render, screen, waitFor, within } from "@testing-library/react";
import { createElement } from "react";
import { afterEach, describe, expect, it, vi } from "vitest";

import { ASK_API_ROUTES, ASKS_PAGE } from "@/modules/asks/contract";
import { asksManifest } from "@/modules/asks/manifest";
import { introsManifest } from "@/modules/intros/manifest";
import { messagesManifest } from "@/modules/messages/manifest";
import { networkManifest } from "@/modules/network/manifest";
import { API_ROUTES, ROUTES } from "@/platform/http/routes";

import { buildShellNavigation } from "./navigation";
import { SidebarNavigation, TabBar } from "./navigation-links";

const location = vi.hoisted(() => ({ pathname: "/" }));

vi.mock("next/navigation", () => ({ usePathname: () => location.pathname }));

function stubUnreadCount(unreadCount: number) {
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

describe("the messages badge", () => {
  afterEach(() => {
    cleanup();
    vi.unstubAllGlobals();
  });

  it("shows the unread count on the phone tab bar", () => {
    stubUnreadCount(3);
    renderWithClient(createElement(TabBar, { items: buildShellNavigation(), badges: { messages: 3 } }));

    const messagesTab = screen.getByRole("link", { name: /Messages/ });

    expect(within(messagesTab).getByRole("img", { name: "3 unread messages" }).textContent).toBe("3");
  });

  it("shows the unread count in the sidebar", () => {
    stubUnreadCount(1);
    renderWithClient(createElement(SidebarNavigation, { items: buildShellNavigation(), isAdmin: false, badges: { messages: 1 } }));

    expect(screen.getByRole("img", { name: "1 unread message" })).toBeTruthy();
  });

  it("shows nothing with no unread messages", () => {
    stubUnreadCount(0);
    renderWithClient(createElement(TabBar, { items: buildShellNavigation(), badges: { messages: 0 } }));

    expect(screen.queryByRole("img")).toBeNull();
  });

  it("follows the count the server reports", async () => {
    stubUnreadCount(4);
    const queryClient = renderWithClient(createElement(TabBar, { items: buildShellNavigation(), badges: { messages: 1 } }));

    await queryClient.invalidateQueries();

    await waitFor(() => expect(screen.getByRole("img", { name: "4 unread messages" })).toBeTruthy());
  });
});

describe("the phone tab bar", () => {
  const TWO_OVERFLOW_ENTRIES = { intros: 2, asks: 3 };

  afterEach(() => {
    cleanup();
    vi.unstubAllGlobals();
    location.pathname = ROUTES.feed;
  });

  function renderTabBar(enabledIds: readonly string[] | null, badges = {}) {
    stubUnreadCount(0);
    const items = enabledIds ? buildShellNavigation(new Set(enabledIds)) : buildShellNavigation();
    renderWithClient(createElement(TabBar, { items, badges }), Number.POSITIVE_INFINITY);
  }

  function readTabNames() {
    return Array.from(screen.getByRole("navigation", { name: "Main" }).children, (tab) => tab.textContent);
  }

  describe("with five items or fewer", () => {
    it("shows every item and no More entry", () => {
      renderTabBar(["feed", messagesManifest.id, "members", networkManifest.id, introsManifest.id, "admin"]);

      expect(readTabNames()).toEqual(["Feed", "Messages", "Members", "Network", "Intros"]);
    });

    it("keeps a community with only a few modules on as it was", () => {
      renderTabBar(["feed", "members", "admin"]);

      expect(readTabNames()).toEqual(["Feed", "Members"]);
      expect(screen.queryByRole("button", { name: "More" })).toBeNull();
    });
  });

  describe("with more than five items", () => {
    it("keeps four tabs and a More entry, five in all", () => {
      renderTabBar(null);

      expect(readTabNames()).toEqual(["Feed", "Messages", "Members", "Network", "More"]);
    });

    it("lists the rest in a sheet when opened", () => {
      renderTabBar(null);

      fireEvent.click(screen.getByRole("button", { name: "More" }));

      const sheet = within(screen.getByRole("dialog", { name: "More" }));
      expect(sheet.getByRole("link", { name: "Intros" }).getAttribute("href")).toBe(ROUTES.intros);
      expect(sheet.getByRole("link", { name: "Asks" }).getAttribute("href")).toBe(ASKS_PAGE);
    });

    it("adds up the badges of what it hides", () => {
      renderTabBar(null, TWO_OVERFLOW_ENTRIES);

      const more = screen.getByRole("button", { name: /More/ });

      expect(within(more).getByRole("img", { name: "5 need your attention" }).textContent).toBe("5");
    });

    it("describes each badge in the sheet", () => {
      renderTabBar(null, TWO_OVERFLOW_ENTRIES);

      fireEvent.click(screen.getByRole("button", { name: /More/ }));

      expect(screen.getByRole("img", { name: "3 new offers of help" })).toBeTruthy();
    });

    it("marks More as current on a page it holds", () => {
      location.pathname = ASKS_PAGE;
      renderTabBar(null);

      expect(screen.getByRole("button", { name: "More" }).getAttribute("aria-current")).toBe("page");
    });

    it("doesn't mark More as current on a page with its own tab", () => {
      renderTabBar(null);

      expect(screen.getByRole("button", { name: "More" }).getAttribute("aria-current")).toBeNull();
    });
  });

  it("counts Home as an item when the feed is off", () => {
    renderTabBar([messagesManifest.id, "members", networkManifest.id, introsManifest.id, asksManifest.id, "admin"]);

    expect(readTabNames()).toEqual(["Home", "Messages", "Members", "Network", "More"]);
  });
});
