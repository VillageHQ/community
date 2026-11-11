// @vitest-environment jsdom
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { cleanup, render, screen } from "@testing-library/react";
import { createElement, type ReactElement } from "react";
import { afterEach, describe, expect, it, vi } from "vitest";

import { INTRO_STATES } from "@/modules/intros/contract";
import type { Connector } from "@/modules/network/contract";

import { IntrosConnectorProvider } from "./intros-network-provider";
import { MessagesSlotProvider } from "@/modules/messages/components/messages-slot-provider";

import { ConnectorCard, OUTSIDE_COMMUNITY_LABEL } from "@/modules/network/components/connector-card";

vi.mock("next/navigation", () => ({
  useRouter: () => ({ push: vi.fn() }),
  usePathname: () => "/intros/22222222-2222-4222-8222-222222222222",
  useSearchParams: () => new URLSearchParams(),
}));

const INTRO_ID = "11111111-1111-4111-8111-111111111111";
const VIEWER = { id: "amara", name: "Amara Osei" };
const REASON = "Both worked at Corvane Logistics.";

const MEMBER_CONNECTOR: Connector = {
  name: "Jonas Lindqvist",
  headline: "CTO, Ledgerline",
  linkedinSlug: "jonas-lindqvist",
  reason: REASON,
  throughName: null,
  imageUrl: null,
  throughImageUrl: null,
  member: { id: "jonas", avatarUrl: null },
  openAsk: null,
};

const OUTSIDE_CONNECTOR: Connector = { ...MEMBER_CONNECTOR, name: "Sofia Weber", linkedinSlug: "sofia-weber", member: null };

function renderCard(connector: Connector, isTop = true) {
  const queryClient = new QueryClient({ defaultOptions: { queries: { retry: false } } });
  const element: ReactElement = createElement(ConnectorCard, {
    connector,
    isTop,
    targetSlug: "clara-bergstrom",
    targetName: "Clara Bergström",
    viewer: VIEWER,
  });
  return render(createElement(QueryClientProvider, { client: queryClient }, createElement(MessagesSlotProvider, null, createElement(IntrosConnectorProvider, null, element))));
}

describe("a connector", () => {
  afterEach(() => {
    cleanup();
    vi.unstubAllGlobals();
  });

  describe("inside the community", () => {
    it("shows who they are, the badge, the reason and the ask", () => {
      renderCard(MEMBER_CONNECTOR);

      expect(screen.getByRole("heading", { name: "Jonas Lindqvist" })).toBeTruthy();
      expect(screen.getByText("Community member")).toBeTruthy();
      expect(screen.getByText(REASON)).toBeTruthy();
      // The ask is its own page now (Founderhall's one-step ask), back to here after.
      const ask = new URL(screen.getByRole("link", { name: "Ask Jonas for an intro" }).getAttribute("href") ?? "", "https://example.com");
      expect(ask.pathname).toBe("/search/ask");
      expect(Object.fromEntries(ask.searchParams)).toEqual({ target: "clara-bergstrom", via: "jonas", back: "/intros/22222222-2222-4222-8222-222222222222" });
    });

    it("links to their profile and offers a message", () => {
      renderCard(MEMBER_CONNECTOR);

      expect(screen.getByRole("link", { name: "See Jonas Lindqvist's profile" }).getAttribute("href")).toBe("/members/jonas");
      expect(screen.getByRole("button", { name: "Message Jonas Lindqvist" })).toBeTruthy();
    });

    it("replaces the ask with a link once one is open", () => {
      renderCard({ ...MEMBER_CONNECTOR, openAsk: { id: INTRO_ID, state: INTRO_STATES.requested } });

      expect(screen.queryByRole("link", { name: /Ask Jonas/ })).toBeNull();
      expect(screen.getByText("You asked. Waiting on Jonas.")).toBeTruthy();
      expect(screen.getByRole("link", { name: /See your intro request/ }).getAttribute("href")).toBe(`/intros/${INTRO_ID}`);
    });
  });

  describe("outside the community", () => {
    it("is labeled, has no intro button and points to LinkedIn", () => {
      renderCard(OUTSIDE_CONNECTOR);

      expect(screen.getByText(OUTSIDE_COMMUNITY_LABEL)).toBeTruthy();
      expect(screen.queryByRole("button", { name: /Ask/ })).toBeNull();
      expect(screen.queryByRole("button", { name: /Message/ })).toBeNull();
      expect(screen.getByText(/ask directly on LinkedIn/)).toBeTruthy();
      expect(screen.getByRole("link", { name: /Sofia on LinkedIn/ }).getAttribute("href")).toBe("https://www.linkedin.com/in/sofia-weber");
    });

    it("still shows Village's reason", () => {
      renderCard(OUTSIDE_CONNECTOR);

      expect(screen.getByText(REASON)).toBeTruthy();
    });
  });
});
