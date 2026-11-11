// @vitest-environment jsdom
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { cleanup, render, screen, waitFor } from "@testing-library/react";
import { createElement } from "react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

import { API_ROUTES, ROUTES } from "@/platform/http/routes";

import { SearchScreen, type SearchScreenProps } from "./search-screen";
import { TodaySearchBox } from "./today-search-box";

const address = vi.hoisted(() => ({ params: new URLSearchParams() }));

vi.mock("next/navigation", () => ({
  useRouter: () => ({ push: vi.fn(), refresh: vi.fn(), replace: vi.fn() }),
  useSearchParams: () => address.params,
}));

const PROPS: SearchScreenProps = {
  viewer: { id: "sam", name: "Sam Lee", imageUrl: null },
  communityName: "Northwind Founders",
  sharingMemberCount: 3,
  isConnected: true,
  isVillageOn: true,
  defaultScope: "network",
  canAskIntro: true,
  canAskCommunity: true,
  digestDay: "Thursday",
};

const PERSON = { headline: null, isMember: false, memberId: null, imageUrl: null, companyLogoUrl: null };
const RESULT = {
  query: "cto",
  scope: "network",
  people: [
    { ...PERSON, fullName: "Rosa Lindqvist", linkedinSlug: "rosa", title: "CTO", company: "Halcyon Health", city: "Boston", direct: null, paths: [{ memberId: "marcus", name: "Marcus Webb", about: "CTO, Brightwater Logistics", imageUrl: null, linkedinSlug: "marcus-webb", warmth: "Close" }] },
    { ...PERSON, fullName: "Alex Kim", linkedinSlug: "alex", title: "Head of Procurement", company: "Halcyon Health", city: "Boston", direct: { how: "Had meetings in 2025", warmth: "Close" }, paths: [] },
  ],
  members: [{ id: "marcus", name: "Marcus Webb", title: "CTO", company: "Brightwater Logistics", city: "Rotterdam", companyLogoUrl: null, avatarUrl: null }],
  discardedOffNetworkResults: false,
  dailyLookupsLeft: 40,
  includesOwnNetwork: true,
  isCached: false,
  isProfilesOnly: false,
};
const NO_RESULT = { ...RESULT, query: "zebra keeper in antarctica", people: [], members: [] };

function renderSearch(props: Partial<SearchScreenProps> = {}) {
  const client = new QueryClient({ defaultOptions: { queries: { retry: false, refetchOnWindowFocus: false } } });
  return render(createElement(QueryClientProvider, { client }, createElement(SearchScreen, { ...PROPS, ...props })));
}

describe("search", () => {
  let searchBodies: unknown[];
  let answer: unknown;

  beforeEach(() => {
    searchBodies = [];
    answer = RESULT;
    vi.stubGlobal(
      "fetch",
      vi.fn(async (path: string, init?: RequestInit) => {
        if (path === API_ROUTES.networkSearch) searchBodies.push(JSON.parse(String(init?.body ?? "{}")));
        return new Response(JSON.stringify(answer), { headers: { "Content-Type": "application/json" } });
      }),
    );
  });

  afterEach(() => {
    cleanup();
    address.params = new URLSearchParams();
    vi.unstubAllGlobals();
  });

  it("asks who you are trying to reach, and spends nothing before a search", () => {
    renderSearch({ isConnected: false });

    expect(screen.getByLabelText("Who are you trying to reach?")).toBeTruthy();
    expect(screen.getByRole("button", { name: "In our network" }).getAttribute("aria-pressed")).toBe("true");
    expect(screen.getByRole("button", { name: "seed investors in climate" })).toBeTruthy();
    expect(screen.getByText(/Paths come from 3 members who share their network so far/)).toBeTruthy();
    expect(screen.getByRole("link", { name: "Connect yours" }).getAttribute("href")).toBe(ROUTES.myNetwork);
    expect(searchBodies).toEqual([]);
  });

  it("searches the words in the address once, members first, then the paths", async () => {
    address.params = new URLSearchParams({ q: "cto", scope: "network" });
    renderSearch();

    await waitFor(() => expect(screen.getByText("3 people in reach through Northwind Founders")).toBeTruthy());
    expect(searchBodies).toEqual([{ prompt: "cto", scope: "network" }]);
    expect(screen.getByRole("link", { name: "See Marcus’ profile" }).getAttribute("href")).toBe(`${ROUTES.members}/marcus`);
    expect(screen.getAllByText("Close", { selector: ".fh-warm" })).toHaveLength(2);
    const ask = screen.getByRole("link", { name: "Ask Marcus for an intro" }).getAttribute("href") ?? "";
    expect(ask.startsWith(`${ROUTES.searchAsk}?`)).toBe(true);
    expect(new URL(ask, "https://example.com").searchParams.get("target")).toBe("rosa");
    expect(screen.getByText("You already know Alex: reach out yourself")).toBeTruthy();
    expect(screen.getByText("No intro needed, and no ask used.")).toBeTruthy();
  });

  it("offers no intro ask while intros are off", async () => {
    address.params = new URLSearchParams({ q: "cto" });
    renderSearch({ canAskIntro: false });

    await waitFor(() => expect(screen.getByText("Rosa Lindqvist")).toBeTruthy());
    expect(screen.queryByRole("link", { name: "Ask Marcus for an intro" })).toBeNull();
  });

  it("asks the whole community, or everywhere, when nobody knows them", async () => {
    answer = NO_RESULT;
    address.params = new URLSearchParams({ q: "zebra keeper in antarctica", scope: "network" });
    renderSearch();

    await waitFor(() => expect(screen.getByText("Nobody in Northwind Founders knows a zebra keeper in antarctica yet")).toBeTruthy());
    expect(screen.getByRole("link", { name: "Ask the community" })).toBeTruthy();
    expect(screen.getByRole("link", { name: "Search everywhere" }).getAttribute("href")).toContain("scope=global");
  });
});

describe("Today's search box", () => {
  afterEach(cleanup);

  it("sends its words to search", () => {
    render(createElement(TodaySearchBox, { communityName: "Northwind" }));
    const form = screen.getByRole("search", { name: "Who do you want to meet?" });
    const field = screen.getByRole<HTMLInputElement>("textbox", { name: "Who do you want to meet?" });

    expect(form.getAttribute("action")).toBe(ROUTES.network);
    expect(form.getAttribute("method")).toBe("get");
    expect(field.name).toBe("q");
    expect(screen.getByRole("button", { name: "Find" })).toBeTruthy();
  });
});
