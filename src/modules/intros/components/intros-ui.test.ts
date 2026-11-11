// @vitest-environment jsdom
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { cleanup, fireEvent, render, screen, waitFor } from "@testing-library/react";
import { createElement, type ReactElement } from "react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

import { FlashProvider } from "@/components/flash";
import { INTRO_OUTCOMES, INTRO_ROLES, INTRO_STATES, type Intro, type IntroBoard } from "@/modules/intros/contract";
import { MessagesSlotProvider } from "@/modules/messages/components/messages-slot-provider";
import { API_ROUTES } from "@/platform/http/routes";

import { IntroPage } from "./intro-page";
import { IntrosList } from "./intros-list";

const router = vi.hoisted(() => ({ replace: vi.fn(), refresh: vi.fn(), push: vi.fn() }));
vi.mock("next/navigation", () => ({ useRouter: () => router, useSearchParams: () => new URLSearchParams(), usePathname: () => "/intros/x" }));

const COMMUNITY = "Northwind Founders";
const NOTE = "I’m Marcus, CTO of Brightwater Logistics.";

const SAM = { id: "sam", name: "Sam Lee", headline: "Co-founder & CEO, Tallyhealth", linkedinSlug: null, avatarUrl: null, isAvailable: true };
const MARCUS = { id: "marcus", name: "Marcus Webb", headline: "CTO, Brightwater Logistics", linkedinSlug: null, avatarUrl: null, isAvailable: true };

function makeIntro(overrides: Partial<Intro> = {}): Intro {
  return {
    id: "11111111-1111-4111-8111-111111111111",
    state: INTRO_STATES.requested,
    viewerRole: INTRO_ROLES.requester,
    note: NOTE,
    reason: "Worked together.",
    declineReason: null,
    declineKind: null,
    hasUpdate: false,
    createdAt: "2026-11-11T10:00:00.000Z",
    acceptedAt: null,
    askedTargetAt: null,
    targetAgreedAt: null,
    outcome: null,
    isOutcomeDue: false,
    closedAt: null,
    expiresAt: "2026-11-18T10:00:00.000Z",
    target: { name: "Rosa Lindqvist", headline: "CTO at Halcyon Health", linkedinSlug: null, isNamed: true },
    suggestedTargetEmail: null,
    requester: SAM,
    introducer: MARCUS,
    ...overrides,
  };
}

function renderInApp(element: ReactElement) {
  const queryClient = new QueryClient({ defaultOptions: { queries: { retry: false } } });
  return render(createElement(QueryClientProvider, { client: queryClient }, createElement(FlashProvider, null, createElement(MessagesSlotProvider, null, element))));
}

function makeBoard(overrides: Partial<IntroBoard> = {}): IntroBoard {
  return { asksForYou: [], yourAsks: [], counts: { waitingOnYou: 0, updates: 0, outcomesDue: 0 }, ...overrides };
}

describe("the intro screens (Founderhall's)", () => {
  let posts: { path: string; body: Record<string, unknown> }[];

  beforeEach(() => {
    posts = [];
    vi.stubGlobal(
      "fetch",
      vi.fn(async (path: string, init?: RequestInit) => {
        posts.push({ path, body: JSON.parse(String(init?.body ?? "{}")) });
        return new Response(JSON.stringify({ ...makeIntro(), consentIssue: null }), { headers: { "Content-Type": "application/json" } });
      }),
    );
  });

  afterEach(() => {
    cleanup();
    vi.unstubAllGlobals();
    vi.clearAllMocks();
  });

  describe("Your intros", () => {
    it("lists what waits for you and your asks as rows, with the allowance", () => {
      const waiting = makeIntro({ viewerRole: INTRO_ROLES.introducer, requester: MARCUS, introducer: SAM, target: { name: "Rachel Kim", headline: null, linkedinSlug: null, isNamed: true } });
      const mine = makeIntro({ id: "22222222-2222-4222-8222-222222222222", state: INTRO_STATES.completed, target: { name: "Alex Kim", headline: "Head of Procurement at Halcyon Health", linkedinSlug: null, isNamed: true }, introducer: { ...MARCUS, name: "Priya Shah" } });
      renderInApp(createElement(IntrosList, { board: makeBoard({ asksForYou: [waiting], yourAsks: [mine] }), allowance: { left: 4, cap: 5 } }));

      expect(screen.getByRole("heading", { level: 1, name: "Your intros" })).toBeTruthy();
      expect(screen.getByText("Ask a member for an intro from their profile. Nobody is introduced without saying yes.")).toBeTruthy();
      expect(screen.getByText("4 of 5 asks left this week")).toBeTruthy();
      expect(screen.getByRole("link", { name: /Marcus Webb asks you for an intro to Rachel Kim/ }).getAttribute("href")).toBe(`/intros/${waiting.id}`);
      expect(screen.getByText("Answer")).toBeTruthy();
      expect(screen.getByText("Alex Kim via Priya Shah")).toBeTruthy();
      expect(screen.getByText("Halcyon Health · asked 11 Nov")).toBeTruthy();
      expect(screen.getByText("Introduced")).toBeTruthy();
    });

    it("says how to ask when there's nothing yet", () => {
      renderInApp(createElement(IntrosList, { board: makeBoard(), allowance: { left: 5, cap: 5 } }));

      expect(screen.getByText("No asks yet")).toBeTruthy();
      expect(screen.queryByText("Waiting for your answer")).toBeNull();
      expect(screen.getByText(/choose “Ask for an intro”\. 5 of 5 asks left this week\./)).toBeTruthy();
    });
  });

  describe("the asker's tracker", () => {
    it("shows the steps ahead and withdraws the ask", async () => {
      renderInApp(createElement(IntroPage, { intro: makeIntro(), community: COMMUNITY, canEmail: true, hasThread: false }));

      expect(screen.getByRole("heading", { level: 1, name: "Sam ↔ Rosa, via Marcus" })).toBeTruthy();
      expect(screen.getByText("With Marcus")).toBeTruthy();
      expect(screen.getByText("CTO, Halcyon Health. Nobody is introduced without saying yes.")).toBeTruthy();
      for (const step of ["You asked Marcus", "Marcus decides", "Rosa decides", "Introduced by email from Northwind Founders", "Was it helpful?"]) {
        expect(screen.getByText(step)).toBeTruthy();
      }
      expect(screen.getByText("Sam’s note, as sent")).toBeTruthy();
      expect(screen.getByText("Marcus won’t be asked again, and the ask comes back to you.")).toBeTruthy();

      fireEvent.click(screen.getByRole("button", { name: "Withdraw my ask" }));

      await waitFor(() => expect(posts).toContainEqual({ path: API_ROUTES.introTransition, body: { introId: makeIntro().id, action: "withdraw" } }));
      await waitFor(() => expect(router.replace).toHaveBeenCalledWith("?m=withdrawn", { scroll: true }));
    });

    it("never names who said no, under Community's rule", () => {
      renderInApp(createElement(IntroPage, { intro: makeIntro({ state: INTRO_STATES.declined, closedAt: "2026-11-12T10:00:00.000Z" }), community: COMMUNITY, canEmail: true, hasThread: false }));

      expect(screen.getAllByText("They can’t make this one")).toHaveLength(2);
      expect(screen.queryByText(/Marcus can’t/)).toBeNull();
      expect(screen.getByText(/Find another way in:/)).toBeTruthy();
      expect(screen.queryByRole("link", { name: "search" })).toBeNull();
    });

    it("asks if it helped once that's due, and offers the thread", () => {
      const introduced = makeIntro({ state: INTRO_STATES.completed, askedTargetAt: "2026-11-11T11:00:00.000Z", targetAgreedAt: "2026-11-11T12:00:00.000Z", closedAt: "2026-11-11T12:00:00.000Z", isOutcomeDue: true });
      renderInApp(createElement(IntroPage, { intro: introduced, community: COMMUNITY, canEmail: true, hasThread: true }));

      expect(screen.getByText("Marcus said yes and asked Rosa")).toBeTruthy();
      expect(screen.getByText("Rosa said yes")).toBeTruthy();
      expect(screen.getByRole("link", { name: "Open the intro thread" }).getAttribute("href")).toBe(`/intros/${introduced.id}/thread`);
      expect(screen.getByRole("heading", { name: "Was the intro to Rosa helpful?" })).toBeTruthy();
      expect(screen.getByRole("button", { name: "Helpful" })).toBeTruthy();
    });

    it("marks the answer given", () => {
      const answered = makeIntro({ state: INTRO_STATES.completed, closedAt: "2026-11-11T12:00:00.000Z", outcome: INTRO_OUTCOMES.helped });
      renderInApp(createElement(IntroPage, { intro: answered, community: COMMUNITY, canEmail: true, hasThread: false }));

      expect(screen.getByText("You said: helpful")).toBeTruthy();
      expect(screen.getByText("Introduced · helpful")).toBeTruthy();
    });
  });

  describe("the connector's answer", () => {
    const asked = makeIntro({ viewerRole: INTRO_ROLES.introducer, requester: { ...MARCUS }, introducer: { ...SAM }, target: { name: "Rachel Kim", headline: "CFO at Brightside Clinics", linkedinSlug: null, isNamed: true } });

    it("shows Founderhall's three choices, the person's email and the note to edit", () => {
      renderInApp(createElement(IntroPage, { intro: asked, community: COMMUNITY, canEmail: true, hasThread: false }));

      expect(screen.getByText("Would you introduce them?")).toBeTruthy();
      expect(screen.getByText("We email Rachel once, from Northwind Founders, in your name.")).toBeTruthy();
      expect(screen.getByText("Marcus is told you can’t make this one. Never why.")).toBeTruthy();
      expect(screen.getByText("Same message to Marcus: you can’t make this one.")).toBeTruthy();
      expect(screen.getByLabelText("Rachel’s email, if you say yes")).toBeTruthy();
      expect(screen.getByText("Used for this one ask. Rachel sees Marcus’ address only if they say yes.")).toBeTruthy();
      expect(screen.getByText("Edit the note before it goes on")).toBeTruthy();
      expect(screen.getByText("Marcus’ note")).toBeTruthy();
      expect(screen.getByRole("button", { name: "Report this note" })).toBeTruthy();
    });

    it("sends the yes with the address and the edited note in one step", async () => {
      renderInApp(createElement(IntroPage, { intro: asked, community: COMMUNITY, canEmail: true, hasThread: false }));

      fireEvent.click(screen.getByLabelText(/Yes, introduce them/));
      fireEvent.change(screen.getByLabelText("Rachel’s email, if you say yes"), { target: { value: "rachel@brightside.example" } });
      fireEvent.click(screen.getByRole("button", { name: "Send my answer" }));

      await waitFor(() =>
        expect(posts).toContainEqual({
          path: API_ROUTES.introConnectorAnswer,
          body: { introId: asked.id, choice: "yes", targetEmail: "rachel@brightside.example", note: NOTE, reason: null },
        }),
      );
    });

    it("asks for an answer before sending", async () => {
      renderInApp(createElement(IntroPage, { intro: asked, community: COMMUNITY, canEmail: false, hasThread: false }));

      expect(screen.queryByLabelText("Rachel’s email, if you say yes")).toBeNull();
      fireEvent.click(screen.getByRole("button", { name: "Send my answer" }));

      expect(await screen.findByText("Pick an answer.")).toBeTruthy();
      expect(posts).toEqual([]);
    });
  });
});
