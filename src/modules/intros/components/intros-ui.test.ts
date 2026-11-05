// @vitest-environment jsdom
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { cleanup, fireEvent, render, screen, waitFor } from "@testing-library/react";
import { createElement, type ReactElement } from "react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

import { INTRO_ACTIONS, INTRO_ROLES, INTRO_STATES, type Intro, type IntroBoard } from "@/modules/intros/contract";
import { introBoardQuery } from "@/modules/intros/queries";
import { API_ROUTES } from "@/platform/http/routes";

import { MessagesSlotProvider } from "@/modules/messages/components/messages-slot-provider";

import { AskForYouCard } from "./ask-for-you-card";
import { IntroBoardView } from "./intro-board";
import { YourAskCard } from "./your-ask-card";

vi.mock("next/navigation", () => ({ useRouter: () => ({ push: vi.fn() }) }));

const TIMESTAMP = "2026-11-05T10:00:00.000Z";
const EXPIRY = "2026-11-19T10:00:00.000Z";
const NOTE = "I'd like to talk about freight pricing.";

const AMARA = { id: "amara", name: "Amara Osei", headline: "Founder, Tidewell", linkedinSlug: "amara-osei", avatarUrl: null, isAvailable: true };
const JONAS = { id: "jonas", name: "Jonas Lindqvist", headline: "CTO, Ledgerline", linkedinSlug: "jonas-lindqvist", avatarUrl: null, isAvailable: true };

function makeIntro(overrides: Partial<Intro> = {}): Intro {
  return {
    id: "11111111-1111-4111-8111-111111111111",
    state: INTRO_STATES.requested,
    viewerRole: INTRO_ROLES.introducer,
    note: NOTE,
    reason: "Both worked at Corvane Logistics.",
    declineReason: null,
    hasUpdate: false,
    createdAt: TIMESTAMP,
    acceptedAt: null,
    closedAt: null,
    expiresAt: EXPIRY,
    target: { name: "Clara Bergström", headline: null, linkedinSlug: "clara-bergstrom" },
    requester: AMARA,
    introducer: JONAS,
    ...overrides,
  };
}

function renderWithClient(element: ReactElement, board?: IntroBoard) {
  const queryClient = new QueryClient({ defaultOptions: { queries: { retry: false, staleTime: Number.POSITIVE_INFINITY } } });
  if (board) queryClient.setQueryData(introBoardQuery().queryKey, board);
  return render(createElement(QueryClientProvider, { client: queryClient }, createElement(MessagesSlotProvider, null, element)));
}

function makeBoard(overrides: Partial<IntroBoard> = {}): IntroBoard {
  return { asksForYou: [], yourAsks: [], counts: { waitingOnYou: 0, updates: 0 }, ...overrides };
}

describe("the intro screens", () => {
  let posts: { path: string; body: unknown }[];

  beforeEach(() => {
    posts = [];
    vi.stubGlobal(
      "fetch",
      vi.fn(async (path: string, init?: RequestInit) => {
        posts.push({ path, body: JSON.parse(String(init?.body ?? "{}")) });
        const response = path === API_ROUTES.introCounts ? { waitingOnYou: 0, updates: 0 } : makeIntro();
        return new Response(JSON.stringify(response), { headers: { "Content-Type": "application/json" } });
      }),
    );
  });

  afterEach(() => {
    cleanup();
    vi.unstubAllGlobals();
  });

  describe("the introducer's card", () => {
    it("shows who asks, for whom, the note and both big answers", () => {
      renderWithClient(createElement(AskForYouCard, { intro: makeIntro() }));

      expect(screen.getByRole("link", { name: "Amara Osei" })).toBeTruthy();
      expect(screen.getByRole("link", { name: /Clara Bergström/ })).toBeTruthy();
      expect(screen.getByText(NOTE)).toBeTruthy();
      expect(screen.getByRole("button", { name: "Accept Amara's ask" })).toBeTruthy();
      expect(screen.getByRole("button", { name: "Decline Amara's ask" })).toBeTruthy();
    });

    it("sends an accept", async () => {
      renderWithClient(createElement(AskForYouCard, { intro: makeIntro() }));

      fireEvent.click(screen.getByRole("button", { name: "Accept Amara's ask" }));

      await waitFor(() => expect(posts.some(({ path }) => path === API_ROUTES.introTransition)).toBe(true));
      expect(posts.find(({ path }) => path === API_ROUTES.introTransition)?.body).toMatchObject({ action: INTRO_ACTIONS.accept });
    });

    it("declines without asking for a reason first", async () => {
      renderWithClient(createElement(AskForYouCard, { intro: makeIntro() }));

      fireEvent.click(screen.getByRole("button", { name: "Decline Amara's ask" }));
      expect(screen.getByText(/No need to explain/)).toBeTruthy();
      fireEvent.click(screen.getByRole("button", { name: "Pass on this one" }));

      await waitFor(() => expect(posts.some(({ path }) => path === API_ROUTES.introTransition)).toBe(true));
      expect(posts.find(({ path }) => path === API_ROUTES.introTransition)?.body).toMatchObject({ action: INTRO_ACTIONS.decline, reason: null });
    });

    it("says the decline reason stays private to them", () => {
      renderWithClient(createElement(AskForYouCard, { intro: makeIntro() }));

      fireEvent.click(screen.getByRole("button", { name: "Decline Amara's ask" }));

      expect(screen.getByText(/Private to you. Amara never sees this/)).toBeTruthy();
    });

    it("shows them their private note after declining", () => {
      renderWithClient(
        createElement(AskForYouCard, { intro: makeIntro({ state: INTRO_STATES.declined, closedAt: TIMESTAMP, declineReason: "I barely know them." }) }),
      );

      expect(screen.getByText(/Your private note: "I barely know them."/)).toBeTruthy();
    });

    it("explains kindly what happens if an accepted ask isn't finished", () => {
      renderWithClient(createElement(AskForYouCard, { intro: makeIntro({ state: INTRO_STATES.accepted, acceptedAt: TIMESTAMP }) }));

      expect(screen.getByText(/No rush. If you don't get to it by Nov 19, the ask closes on its own and Amara sees that it closed./)).toBeTruthy();
    });

    it("gives a forwardable blurb and says plainly that the portal contacts nobody", () => {
      renderWithClient(createElement(AskForYouCard, { intro: makeIntro({ state: INTRO_STATES.accepted, acceptedAt: TIMESTAMP }) }));

      expect(screen.getByText(/doesn't have Clara's email/)).toBeTruthy();
      expect(screen.getByText(/asked me for an intro to you/)).toBeTruthy();
      expect(screen.getByRole("button", { name: "Copy the note" })).toBeTruthy();
      expect(screen.getByRole("button", { name: "Mark as introduced" })).toBeTruthy();
    });

    it("always offers the existing messages thread", () => {
      renderWithClient(createElement(AskForYouCard, { intro: makeIntro() }));

      expect(screen.getByRole("button", { name: "Message Amara Osei" })).toBeTruthy();
    });

    it("renders a note's markup as plain text", () => {
      const markup = "<img src=x onerror=alert(1)>";
      const { container } = renderWithClient(createElement(AskForYouCard, { intro: makeIntro({ note: markup }) }));

      expect(container.querySelector("img[src='x']")).toBeNull();
      expect(screen.getByText(markup)).toBeTruthy();
    });
  });

  describe("the requester's card", () => {
    const requesterIntro = { viewerRole: INTRO_ROLES.requester };

    it("shows a timeline and the promise while requested", () => {
      renderWithClient(createElement(YourAskCard, { intro: makeIntro(requesterIntro) }));

      expect(screen.getByRole("list", { name: "What's happened so far" })).toBeTruthy();
      expect(screen.getByText(/Jonas reads your note first. Clara hears nothing unless they say yes./)).toBeTruthy();
      expect(screen.getByRole("button", { name: "Withdraw my ask" })).toBeTruthy();
    });

    it("confirms before withdrawing", async () => {
      renderWithClient(createElement(YourAskCard, { intro: makeIntro(requesterIntro) }));

      fireEvent.click(screen.getByRole("button", { name: "Withdraw my ask" }));
      expect(posts.some(({ path }) => path === API_ROUTES.introTransition)).toBe(false);
      fireEvent.click(screen.getByRole("button", { name: "Withdraw my ask" }));

      await waitFor(() => expect(posts.some(({ path }) => path === API_ROUTES.introTransition)).toBe(true));
    });

    it("offers the conversation and no withdraw once accepted", () => {
      renderWithClient(createElement(YourAskCard, { intro: makeIntro({ ...requesterIntro, state: INTRO_STATES.accepted, acceptedAt: TIMESTAMP }) }));

      expect(screen.getByRole("button", { name: "Message Jonas Lindqvist" })).toBeTruthy();
      expect(screen.queryByRole("button", { name: "Withdraw my ask" })).toBeNull();
    });

    it("shows a kind message after a decline, and nothing about why", () => {
      renderWithClient(createElement(YourAskCard, { intro: makeIntro({ ...requesterIntro, state: INTRO_STATES.declined, closedAt: TIMESTAMP }) }));

      expect(screen.getByText(/Jonas can't help with this one/)).toBeTruthy();
      expect(screen.getByText(/Clara heard nothing about it/)).toBeTruthy();
    });

    it("hides the message button when the introducer isn't available", () => {
      renderWithClient(createElement(YourAskCard, { intro: makeIntro({ ...requesterIntro, introducer: { ...JONAS, isAvailable: false } }) }));

      expect(screen.queryByRole("button", { name: /Message/ })).toBeNull();
    });
  });

  describe("the intros page", () => {
    it("opens on the asks waiting for you, with their count", () => {
      renderWithClient(createElement(IntroBoardView), makeBoard({ asksForYou: [makeIntro()], counts: { waitingOnYou: 1, updates: 0 } }));

      expect(screen.getByRole("button", { name: /Asks for you/ }).getAttribute("aria-pressed")).toBe("true");
      expect(screen.getByRole("button", { name: /Asks for you/ }).textContent).toContain("1");
      expect(screen.getByRole("heading", { name: "Waiting on you" })).toBeTruthy();
    });

    it("opens on your asks when nothing waits and there's news", async () => {
      const intro = makeIntro({ viewerRole: INTRO_ROLES.requester, state: INTRO_STATES.accepted, hasUpdate: true, acceptedAt: TIMESTAMP });
      renderWithClient(createElement(IntroBoardView), makeBoard({ yourAsks: [intro], counts: { waitingOnYou: 0, updates: 1 } }));

      expect(screen.getByRole("button", { name: /Your asks/ }).getAttribute("aria-pressed")).toBe("true");
      await waitFor(() => expect(posts.some(({ path }) => path === API_ROUTES.introSeen)).toBe(true));
    });

    it("invites a first search when empty", () => {
      renderWithClient(createElement(IntroBoardView), makeBoard());

      expect(screen.getByRole("heading", { name: "Your first intro is one search away" })).toBeTruthy();
      expect(screen.getByRole("link", { name: "Find someone to meet" }).getAttribute("href")).toBe("/network");
    });

    it("says truthfully who may read the note", () => {
      renderWithClient(createElement(IntroBoardView), makeBoard());

      expect(screen.getByText(/reads it first, and may share it with the person you want to meet/)).toBeTruthy();
      expect(screen.queryByText(/Only that member reads it/)).toBeNull();
    });

    it("explains what happens when nobody has asked yet", () => {
      renderWithClient(createElement(IntroBoardView), makeBoard());

      fireEvent.click(screen.getByRole("button", { name: /Asks for you/ }));

      expect(screen.getByRole("heading", { name: "Nobody's asked you for an intro yet" })).toBeTruthy();
    });

    it("keeps closed asks short, linking to the full story", () => {
      const closed = makeIntro({ state: INTRO_STATES.completed, closedAt: TIMESTAMP, acceptedAt: TIMESTAMP });
      renderWithClient(createElement(IntroBoardView), makeBoard({ asksForYou: [closed] }));

      expect(screen.getByRole("heading", { name: "Earlier" })).toBeTruthy();
      expect(screen.getByRole("link", { name: /Amara Osei's ask/ }).getAttribute("href")).toBe(`/intros/${closed.id}`);
      expect(screen.queryByText(NOTE)).toBeNull();
    });
  });
});
