// @vitest-environment jsdom
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { cleanup, fireEvent, render, screen, waitFor, within } from "@testing-library/react";
import { createElement, type ReactElement } from "react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

import { INTRO_STATES } from "@/lib/intros/intro-api";
import { API_ROUTES } from "@/lib/routes";
import type { Connector } from "@/lib/village/network-api";

import { ConnectorCard, OUTSIDE_COMMUNITY_LABEL } from "./connector-card";

vi.mock("next/navigation", () => ({ useRouter: () => ({ push: vi.fn() }) }));

const INTRO_ID = "11111111-1111-4111-8111-111111111111";
const VIEWER = { id: "amara", name: "Amara Osei" };
const REASON = "Both worked at Corvane Logistics.";

const MEMBER_CONNECTOR: Connector = {
  name: "Jonas Lindqvist",
  headline: "CTO, Ledgerline",
  linkedinSlug: "jonas-lindqvist",
  reason: REASON,
  throughName: null,
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
  return render(createElement(QueryClientProvider, { client: queryClient }, element));
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
      expect(screen.getByRole("button", { name: "Ask Jonas for an intro to Clara" }).textContent).toContain("Ask Jonas for an intro");
    });

    it("links to their profile and offers a message", () => {
      renderCard(MEMBER_CONNECTOR);

      expect(screen.getByRole("link", { name: "See Jonas Lindqvist's profile" }).getAttribute("href")).toBe("/members/jonas");
      expect(screen.getByRole("button", { name: "Message Jonas Lindqvist" })).toBeTruthy();
    });

    it("replaces the ask with a link once one is open", () => {
      renderCard({ ...MEMBER_CONNECTOR, openAsk: { id: INTRO_ID, state: INTRO_STATES.requested } });

      expect(screen.queryByRole("button", { name: /Ask Jonas/ })).toBeNull();
      expect(screen.getByText("You asked. Waiting on Jonas.")).toBeTruthy();
      expect(screen.getByRole("link", { name: /See your ask/ }).getAttribute("href")).toBe(`/intros/${INTRO_ID}`);
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

  describe("the ask dialog", () => {
    let posts: { path: string; body: unknown }[];

    beforeEach(() => {
      posts = [];
      vi.stubGlobal(
        "fetch",
        vi.fn(async (path: string, init?: RequestInit) => {
          posts.push({ path, body: JSON.parse(String(init?.body ?? "{}")) });
          return new Response(
            JSON.stringify({
              id: INTRO_ID,
              state: INTRO_STATES.requested,
              viewerRole: "requester",
              note: "note",
              reason: REASON,
              declineReason: null,
              hasUpdate: false,
              createdAt: "2026-11-05T10:00:00.000Z",
              acceptedAt: null,
              closedAt: null,
              expiresAt: "2026-11-19T10:00:00.000Z",
              target: { name: "Clara Bergström", headline: null, linkedinSlug: "clara-bergstrom" },
              requester: { id: "amara", name: "Amara Osei", headline: null, linkedinSlug: null, avatarUrl: null, isAvailable: true },
              introducer: { id: "jonas", name: "Jonas Lindqvist", headline: null, linkedinSlug: "jonas-lindqvist", avatarUrl: null, isAvailable: true },
            }),
            { headers: { "Content-Type": "application/json" } },
          );
        }),
      );
    });

    function openDialog() {
      renderCard(MEMBER_CONNECTOR);
      fireEvent.click(screen.getByRole("button", { name: "Ask Jonas for an intro to Clara" }));
      return screen.getByRole("dialog");
    }

    it("starts the note, shows what the introducer sees and makes the promise", () => {
      const dialog = openDialog();

      expect(within(dialog).getByRole<HTMLTextAreaElement>("textbox").value).toContain("Hi Jonas,");
      expect(within(dialog).getByRole("heading", { name: "What Jonas will see" })).toBeTruthy();
      expect(within(dialog).getByText(/Jonas reads your note first. Clara hears nothing unless they say yes./)).toBeTruthy();
    });

    it("warns the note may reach the target", () => {
      const dialog = openDialog();

      expect(within(dialog).getByText(/If Jonas says yes, they may pass your note on to Clara/)).toBeTruthy();
    });

    it("asks for a reason when the starter is left untouched", () => {
      const dialog = openDialog();

      fireEvent.click(within(dialog).getByRole("button", { name: /Send to Jonas/ }));

      expect(within(dialog).getByText(/Add a line about why/)).toBeTruthy();
      expect(posts).toEqual([]);
    });

    it("sends only the target, connector and note", async () => {
      const dialog = openDialog();
      const note = within(dialog).getByRole<HTMLTextAreaElement>("textbox");

      fireEvent.change(note, { target: { value: "We sell freight tools." } });
      fireEvent.click(within(dialog).getByRole("button", { name: /Send to Jonas/ }));

      await waitFor(() => expect(posts.some(({ path }) => path === API_ROUTES.introCreate)).toBe(true));
      expect(posts.find(({ path }) => path === API_ROUTES.introCreate)?.body).toEqual({
        targetSlug: "clara-bergstrom",
        connectorSlug: "jonas-lindqvist",
        note: "We sell freight tools.",
      });
      await waitFor(() => expect(screen.getByRole("heading", { name: "Your ask is on its way" })).toBeTruthy());
    });
  });
});
