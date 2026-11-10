// @vitest-environment jsdom
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { cleanup, fireEvent, render, screen, waitFor } from "@testing-library/react";
import { createElement } from "react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

import { API_ROUTES, ROUTES } from "@/platform/http/routes";

import { NetworkSearch } from "./network-search";
import { TodaySearchBox } from "./today-search-box";

const address = vi.hoisted(() => ({ params: new URLSearchParams(), replace: (_path: string, _options?: unknown) => {} }));

vi.mock("next/navigation", () => ({
  useRouter: () => ({ push: vi.fn(), refresh: vi.fn(), replace: address.replace }),
  useSearchParams: () => address.params,
}));

const SIX_MINUTES_MS = 6 * 60 * 1000;
const WELCOME = {
  community: { name: "Northwind", descriptor: "", logo: null },
  member: { id: "amara", name: "Amara Osei" },
  neighbours: [],
  sharingMemberCount: 3,
  notNowHref: ROUTES.feed,
};
const SEARCH_RESULT = {
  people: [{ fullName: "Clara Bergström", headline: "VP", linkedinSlug: "clara", isMember: false, memberId: null }],
  discardedOffNetworkResults: false,
  dailyLookupsLeft: 40,
};

function createClient() {
  return new QueryClient({ defaultOptions: { queries: { retry: false, refetchOnWindowFocus: false } } });
}

function renderSearch(client: QueryClient, welcome: Parameters<typeof NetworkSearch>[0]["welcome"] = WELCOME) {
  return render(createElement(QueryClientProvider, { client }, createElement(NetworkSearch, { welcome })));
}

async function searchOnce() {
  fireEvent.change(screen.getByLabelText("Describe who you want to meet"), { target: { value: "founders" } });
  fireEvent.click(screen.getByRole("button", { name: "Search" }));
  await waitFor(() => expect(screen.getByRole("heading", { name: "1 person in your network" })).toBeTruthy());
}

describe("network search", () => {
  let searchCalls: number;

  beforeEach(() => {
    searchCalls = 0;
    vi.stubGlobal("matchMedia", () => ({ matches: true, addEventListener: vi.fn(), removeEventListener: vi.fn() }));
    vi.stubGlobal(
      "fetch",
      vi.fn(async (path: string) => {
        if (path === API_ROUTES.networkSearch) searchCalls += 1;
        return new Response(JSON.stringify(SEARCH_RESULT), { headers: { "Content-Type": "application/json" } });
      }),
    );
  });

  afterEach(() => {
    cleanup();
    vi.useRealTimers();
    vi.unstubAllGlobals();
  });

  describe("spending credits", () => {
    it("spends nothing when the member returns long after a search", async () => {
      vi.useFakeTimers({ shouldAdvanceTime: true });
      const client = createClient();
      const { unmount } = renderSearch(client);
      await searchOnce();
      unmount();

      vi.advanceTimersByTime(SIX_MINUTES_MS);
      renderSearch(client);

      await waitFor(() => expect(screen.getByRole("heading", { name: "1 person in your network" })).toBeTruthy());
      expect(searchCalls).toBe(1);
    });

    it("spends nothing on focus or reconnect", async () => {
      const client = createClient();
      renderSearch(client);
      await searchOnce();

      window.dispatchEvent(new Event("visibilitychange"));
      window.dispatchEvent(new Event("online"));
      await client.refetchQueries({ type: "active", stale: true });

      expect(searchCalls).toBe(1);
    });

    it("runs only after the member presses Search", () => {
      renderSearch(createClient());

      expect(searchCalls).toBe(0);
    });

    it("runs Today's words once, then drops them from the address", async () => {
      const replaced: string[] = [];
      address.params = new URLSearchParams({ q: "founders" });
      address.replace = (path) => replaced.push(path);
      try {
        renderSearch(createClient());

        await waitFor(() => expect(screen.getByRole("heading", { name: "1 person in your network" })).toBeTruthy());
        expect(screen.getByLabelText<HTMLInputElement>("Describe who you want to meet").value).toBe("founders");
        expect(searchCalls).toBe(1);
        expect(replaced).toEqual([ROUTES.network]);
      } finally {
        address.params = new URLSearchParams();
        address.replace = () => {};
      }
    });
  });

  describe("a member whose name can't match their LinkedIn", () => {
    it("gets a gentle note with a next step", () => {
      renderSearch(createClient(), { ...WELCOME, needsFullName: true });

      expect(screen.getByText(/Add your first and last name, or ask an admin to confirm your LinkedIn/)).toBeTruthy();
      expect(screen.getByRole("link", { name: "Edit your card" }).getAttribute("href")).toBe(ROUTES.editCard);
    });

    it("sees nothing when their name is fine", () => {
      renderSearch(createClient());

      expect(screen.queryByRole("link", { name: "Edit your card" })).toBeNull();
    });
  });
});

describe("Today's search box", () => {
  afterEach(cleanup);

  it("sends its words to network search", () => {
    render(createElement(TodaySearchBox, { communityName: "Northwind" }));
    const form = screen.getByRole("search", { name: "Who do you want to meet?" });
    const field = screen.getByRole<HTMLInputElement>("textbox", { name: "Who do you want to meet?" });

    expect(form.getAttribute("action")).toBe(ROUTES.network);
    expect(form.getAttribute("method")).toBe("get");
    expect(field.name).toBe("q");
    expect(screen.getByRole("button", { name: "Find" })).toBeTruthy();
  });
});
