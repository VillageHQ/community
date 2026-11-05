// @vitest-environment jsdom
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { cleanup, render, screen, waitFor, within } from "@testing-library/react";
import { createElement } from "react";
import { afterEach, describe, expect, it, vi } from "vitest";

import { API_ROUTES, ROUTES } from "@/platform/http/routes";

import { buildShellNavigation } from "./navigation";
import { SidebarNavigation, TabBar } from "./navigation-links";

vi.mock("next/navigation", () => ({ usePathname: () => ROUTES.feed }));

function stubUnreadCount(unreadCount: number) {
  vi.stubGlobal(
    "fetch",
    vi.fn(async (path: string) => {
      if (path === API_ROUTES.introCounts) {
        return new Response(JSON.stringify({ waitingOnYou: 0, updates: 0 }), { headers: { "Content-Type": "application/json" } });
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
