// @vitest-environment jsdom
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { cleanup, fireEvent, render, screen, waitFor } from "@testing-library/react";
import { createElement, type ReactElement } from "react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

import { INTRO_ACTIONS, INTRO_DECLINE_KINDS, INTRO_OUTCOMES, INTRO_ROLES, INTRO_STATES, type ConsentIssue, type Intro, type IntroBoard } from "@/modules/intros/contract";
import { introBoardQuery, issuedConsentQuery } from "@/modules/intros/queries";
import { API_ROUTES } from "@/platform/http/routes";

import { MessagesSlotProvider } from "@/modules/messages/components/messages-slot-provider";
import { IntrosConnectorProvider } from "@/shell/intros-network-provider";

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
    declineKind: null,
    hasUpdate: false,
    createdAt: TIMESTAMP,
    acceptedAt: null,
    askedTargetAt: null,
    targetAgreedAt: null,
    outcome: null,
    isOutcomeDue: false,
    closedAt: null,
    expiresAt: EXPIRY,
    target: { name: "Clara Bergström", headline: null, linkedinSlug: "clara-bergstrom", isNamed: false },
    suggestedTargetEmail: null,
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
  return { asksForYou: [], yourAsks: [], counts: { waitingOnYou: 0, updates: 0, outcomesDue: 0 }, ...overrides };
}

describe("the intro screens", () => {
  let posts: { path: string; body: unknown }[];

  beforeEach(() => {
    posts = [];
    vi.stubGlobal(
      "fetch",
      vi.fn(async (path: string, init?: RequestInit) => {
        posts.push({ path, body: JSON.parse(String(init?.body ?? "{}")) });
        const response = path === API_ROUTES.introCounts ? { waitingOnYou: 0, updates: 0, outcomesDue: 0 } : { ...makeIntro(), consentIssue: null };
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
      expect(screen.getByRole("button", { name: "Yes, I'll ask Clara" })).toBeTruthy();
      expect(screen.getByRole("button", { name: "Not this time" })).toBeTruthy();
      expect(screen.getByRole("button", { name: "I don't know them well enough" })).toBeTruthy();
    });

    it("sends an accept", async () => {
      renderWithClient(createElement(AskForYouCard, { intro: makeIntro() }));

      fireEvent.click(screen.getByRole("button", { name: "Yes, I'll ask Clara" }));

      await waitFor(() => expect(posts.some(({ path }) => path === API_ROUTES.introTransition)).toBe(true));
      expect(posts.find(({ path }) => path === API_ROUTES.introTransition)?.body).toMatchObject({ action: INTRO_ACTIONS.accept });
    });

    it("declines without asking for a reason first", async () => {
      renderWithClient(createElement(AskForYouCard, { intro: makeIntro() }));

      fireEvent.click(screen.getByRole("button", { name: "Not this time" }));
      expect(screen.getByText(/No need to explain/)).toBeTruthy();
      fireEvent.click(screen.getByRole("button", { name: "Not this time" }));

      await waitFor(() => expect(posts.some(({ path }) => path === API_ROUTES.introTransition)).toBe(true));
      expect(posts.find(({ path }) => path === API_ROUTES.introTransition)?.body).toMatchObject({
        action: INTRO_ACTIONS.decline,
        reason: null,
        kind: INTRO_DECLINE_KINDS.notThisTime,
      });
    });

    it("remembers that they don't know the target well enough", async () => {
      renderWithClient(createElement(AskForYouCard, { intro: makeIntro() }));

      fireEvent.click(screen.getByRole("button", { name: "I don't know them well enough" }));
      fireEvent.click(screen.getByRole("button", { name: "I don't know them well enough" }));

      await waitFor(() => expect(posts.some(({ path }) => path === API_ROUTES.introTransition)).toBe(true));
      expect(posts.find(({ path }) => path === API_ROUTES.introTransition)?.body).toMatchObject({ kind: INTRO_DECLINE_KINDS.doNotKnowThem });
    });

    it("says the decline reason stays private to them", () => {
      renderWithClient(createElement(AskForYouCard, { intro: makeIntro() }));

      fireEvent.click(screen.getByRole("button", { name: "Not this time" }));

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

      expect(screen.getByText(/No rush. If you don't get to it by Nov 19, the intro request closes on its own and Amara sees that it closed./)).toBeTruthy();
    });

    it("gives a forwardable blurb and says plainly that the portal contacts nobody", () => {
      renderWithClient(createElement(AskForYouCard, { intro: makeIntro({ state: INTRO_STATES.accepted, acceptedAt: TIMESTAMP }) }));

      expect(screen.getByText(/doesn't have Clara's email/)).toBeTruthy();
      expect(screen.getByText(/asked me for an intro to you/)).toBeTruthy();
      expect(screen.getByRole("button", { name: "Copy the note" })).toBeTruthy();
      expect(screen.getByRole("button", { name: "Mark as introduced" })).toBeTruthy();
    });

    describe("while waiting on the target", () => {
      const askingTarget = { state: INTRO_STATES.askingTarget, askedTargetAt: TIMESTAMP };
      const CONSENT_ISSUE: ConsentIssue = { link: "https://community.test/meet/secret", token: "secret", canEmailTarget: false };

      function renderWithIssuedLink(canEmailTarget: boolean) {
        const queryClient = new QueryClient({ defaultOptions: { queries: { retry: false } } });
        const intro = makeIntro(askingTarget);
        const consentIssue: ConsentIssue = { ...CONSENT_ISSUE, canEmailTarget };
        queryClient.setQueryData(issuedConsentQuery(intro.id).queryKey, consentIssue);
        return render(createElement(QueryClientProvider, { client: queryClient }, createElement(MessagesSlotProvider, null, createElement(AskForYouCard, { intro }))));
      }

      it("hands over the link in a ready-made note", () => {
        renderWithIssuedLink(false);

        expect(screen.getByRole("heading", { name: "Now ask Clara" })).toBeTruthy();
        expect(screen.getByText(new RegExp(CONSENT_ISSUE.link))).toBeTruthy();
        expect(screen.getByRole("button", { name: "Copy the note" })).toBeTruthy();
        expect(screen.getByRole("button", { name: "Copy just the link" })).toBeTruthy();
      });

      it("offers no email form without email configured", () => {
        renderWithIssuedLink(false);

        expect(screen.queryByLabelText(/Clara's email/)).toBeNull();
      });

      it("offers an email form with email configured", () => {
        renderWithIssuedLink(true);

        expect(screen.getByLabelText(/Clara's email/)).toBeTruthy();
      });

      it("offers a new link after the old one left the screen", () => {
        renderWithClient(createElement(AskForYouCard, { intro: makeIntro(askingTarget) }));

        expect(screen.getByRole("button", { name: "Make a new link" })).toBeTruthy();
        expect(screen.queryByText(/asked me for an intro/)).toBeNull();
      });

      it("offers no way to mark it introduced", () => {
        renderWithClient(createElement(AskForYouCard, { intro: makeIntro(askingTarget) }));

        expect(screen.queryByRole("button", { name: "Mark as introduced" })).toBeNull();
      });
    });

    it("gives the message that joins them once the target said yes", () => {
      renderWithClient(createElement(AskForYouCard, { intro: makeIntro({ state: INTRO_STATES.targetAgreed, targetAgreedAt: TIMESTAMP }) }));

      expect(screen.getByRole("heading", { name: /Clara said yes/ })).toBeTruthy();
      expect(screen.getByText(/Clara, meet Amara/)).toBeTruthy();
      expect(screen.getByRole("button", { name: "Mark as introduced" })).toBeTruthy();
    });

    it("tells them the target said no thanks, and what the requester sees", () => {
      renderWithClient(createElement(AskForYouCard, { intro: makeIntro({ state: INTRO_STATES.targetDeclined, closedAt: TIMESTAMP }) }));

      expect(screen.getByText(/Clara said no thanks. Amara sees that this intro isn't happening, not who answered./)).toBeTruthy();
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
      expect(screen.getByRole("button", { name: "Withdraw my intro request" })).toBeTruthy();
    });

    it("confirms before withdrawing", async () => {
      renderWithClient(createElement(YourAskCard, { intro: makeIntro(requesterIntro) }));

      fireEvent.click(screen.getByRole("button", { name: "Withdraw my intro request" }));
      expect(posts.some(({ path }) => path === API_ROUTES.introTransition)).toBe(false);
      fireEvent.click(screen.getByRole("button", { name: "Withdraw my intro request" }));

      await waitFor(() => expect(posts.some(({ path }) => path === API_ROUTES.introTransition)).toBe(true));
    });

    it("offers no withdraw and tells the good news once the target said yes", () => {
      renderWithClient(createElement(YourAskCard, { intro: makeIntro({ ...requesterIntro, state: INTRO_STATES.targetAgreed, targetAgreedAt: TIMESTAMP }) }));

      expect(screen.getByText(/Clara said yes. Jonas will connect you both with one message./)).toBeTruthy();
      expect(screen.queryByRole("button", { name: "Withdraw my intro request" })).toBeNull();
    });

    it("offers the conversation and no withdraw once accepted", () => {
      renderWithClient(createElement(YourAskCard, { intro: makeIntro({ ...requesterIntro, state: INTRO_STATES.accepted, acceptedAt: TIMESTAMP }) }));

      expect(screen.getByRole("button", { name: "Message Jonas Lindqvist" })).toBeTruthy();
      expect(screen.queryByRole("button", { name: "Withdraw my intro request" })).toBeNull();
    });

    it("shows a kind message after a decline, and nothing about why", () => {
      renderWithClient(createElement(YourAskCard, { intro: makeIntro({ ...requesterIntro, state: INTRO_STATES.declined, closedAt: TIMESTAMP }) }));

      expect(screen.getByText(/This intro isn't happening this time/)).toBeTruthy();
      expect(screen.queryByText(/Jonas can't/)).toBeNull();
      expect(screen.queryByText(/Clara said/)).toBeNull();
    });

    it("offers other paths after a no, while search is on", () => {
      const intro = makeIntro({ ...requesterIntro, state: INTRO_STATES.declined, closedAt: TIMESTAMP });
      renderWithClient(createElement(IntrosConnectorProvider, null, createElement(YourAskCard, { intro })));

      expect(screen.getByRole("button", { name: "See who else can help" })).toBeTruthy();
    });

    it("offers no other paths for a person the asker named, or with search off", () => {
      const declined = { ...requesterIntro, state: INTRO_STATES.declined, closedAt: TIMESTAMP };
      const named = makeIntro({ ...declined, target: { name: "Clara Bergström", headline: "Corvane", linkedinSlug: null, isNamed: true } });
      renderWithClient(createElement(IntrosConnectorProvider, null, createElement(YourAskCard, { intro: named })));
      renderWithClient(createElement(YourAskCard, { intro: makeIntro(declined) }));

      expect(screen.queryByRole("button", { name: "See who else can help" })).toBeNull();
    });

    it("doesn't nudge them to message the connector after a no", () => {
      renderWithClient(createElement(YourAskCard, { intro: makeIntro({ ...requesterIntro, state: INTRO_STATES.declined, closedAt: TIMESTAMP }) }));

      expect(screen.queryByRole("button", { name: /Message/ })).toBeNull();
    });

    describe("the outcome prompt", () => {
      const dueIntro = { ...requesterIntro, state: INTRO_STATES.completed, closedAt: TIMESTAMP, targetAgreedAt: TIMESTAMP, isOutcomeDue: true };

      it("asks if it helped, with three big answers", () => {
        renderWithClient(createElement(YourAskCard, { intro: makeIntro(dueIntro) }));

        expect(screen.getByRole("heading", { name: "Did your intro to Clara help?" })).toBeTruthy();
        expect(screen.getByRole("button", { name: "Yes, it helped" })).toBeTruthy();
        expect(screen.getByRole("button", { name: "Not yet" })).toBeTruthy();
        expect(screen.getByRole("button", { name: "No" })).toBeTruthy();
      });

      it("sends the answer", async () => {
        renderWithClient(createElement(YourAskCard, { intro: makeIntro(dueIntro) }));

        fireEvent.click(screen.getByRole("button", { name: "Not yet" }));

        await waitFor(() => expect(posts.some(({ path }) => path === API_ROUTES.introOutcome)).toBe(true));
        expect(posts.find(({ path }) => path === API_ROUTES.introOutcome)?.body).toMatchObject({ outcome: INTRO_OUTCOMES.notYet });
      });

      it("stays away until it's due", () => {
        renderWithClient(createElement(YourAskCard, { intro: makeIntro({ ...dueIntro, isOutcomeDue: false }) }));

        expect(screen.queryByRole("heading", { name: /Did your intro/ })).toBeNull();
      });
    });

    it("hides the message button when the introducer isn't available", () => {
      renderWithClient(createElement(YourAskCard, { intro: makeIntro({ ...requesterIntro, introducer: { ...JONAS, isAvailable: false } }) }));

      expect(screen.queryByRole("button", { name: /Message/ })).toBeNull();
    });
  });

  describe("the intros page", () => {
    it("opens on the asks waiting for you, with their count", () => {
      renderWithClient(createElement(IntroBoardView), makeBoard({ asksForYou: [makeIntro()], counts: { waitingOnYou: 1, updates: 0, outcomesDue: 0 } }));

      expect(screen.getByRole("button", { name: /Intro requests for you/ }).getAttribute("aria-pressed")).toBe("true");
      expect(screen.getByRole("button", { name: /Intro requests for you/ }).textContent).toContain("1");
      expect(screen.getByRole("heading", { name: "Waiting on you" })).toBeTruthy();
    });

    it("opens on your asks when nothing waits and there's news", async () => {
      const intro = makeIntro({ viewerRole: INTRO_ROLES.requester, state: INTRO_STATES.accepted, hasUpdate: true, acceptedAt: TIMESTAMP });
      renderWithClient(createElement(IntroBoardView), makeBoard({ yourAsks: [intro], counts: { waitingOnYou: 0, updates: 1, outcomesDue: 0 } }));

      expect(screen.getByRole("button", { name: /Your intro requests/ }).getAttribute("aria-pressed")).toBe("true");
      await waitFor(() => expect(posts.some(({ path }) => path === API_ROUTES.introSeen)).toBe(true));
    });

    it("invites a first search when empty", () => {
      renderWithClient(createElement(IntroBoardView), makeBoard());

      expect(screen.getByRole("heading", { name: "Your first intro is one search away" })).toBeTruthy();
      expect(screen.getByRole("link", { name: "Find someone to meet" }).getAttribute("href")).toBe("/network");
    });

    it("says truthfully who may read the note", () => {
      renderWithClient(createElement(IntroBoardView), makeBoard());

      expect(screen.getByText(/reads it first, and the person you want to meet sees it only if that member says yes/)).toBeTruthy();
      expect(screen.queryByText(/Only that member reads it/)).toBeNull();
    });

    it("explains what happens when nobody has asked yet", () => {
      renderWithClient(createElement(IntroBoardView), makeBoard());

      fireEvent.click(screen.getByRole("button", { name: /Intro requests for you/ }));

      expect(screen.getByRole("heading", { name: "Nobody's asked you for an intro yet" })).toBeTruthy();
    });

    it("opens on your asks and shows the prompt when an outcome is due", () => {
      const intro = makeIntro({ viewerRole: INTRO_ROLES.requester, state: INTRO_STATES.completed, closedAt: TIMESTAMP, isOutcomeDue: true });
      renderWithClient(createElement(IntroBoardView), makeBoard({ yourAsks: [intro], counts: { waitingOnYou: 0, updates: 0, outcomesDue: 1 } }));

      expect(screen.getByRole("button", { name: /Your intro requests/ }).getAttribute("aria-pressed")).toBe("true");
      expect(screen.getByRole("heading", { name: "Did your intro to Clara help?" })).toBeTruthy();
    });

    it("splits what waits on you from what waits on the target", () => {
      const waiting = makeIntro();
      const asking = makeIntro({ id: "22222222-2222-4222-8222-222222222222", state: INTRO_STATES.askingTarget });
      renderWithClient(createElement(IntroBoardView), makeBoard({ asksForYou: [waiting, asking], counts: { waitingOnYou: 1, updates: 0, outcomesDue: 0 } }));

      expect(screen.getByRole("heading", { name: "Waiting on you" })).toBeTruthy();
      expect(screen.getByRole("heading", { name: "Waiting on their answer" })).toBeTruthy();
    });

    it("keeps closed asks short, linking to the full story", () => {
      const closed = makeIntro({ state: INTRO_STATES.completed, closedAt: TIMESTAMP, acceptedAt: TIMESTAMP });
      renderWithClient(createElement(IntroBoardView), makeBoard({ asksForYou: [closed] }));

      expect(screen.getByRole("heading", { name: "Earlier" })).toBeTruthy();
      expect(screen.getByRole("link", { name: /Amara Osei's intro request/ }).getAttribute("href")).toBe(`/intros/${closed.id}`);
      expect(screen.queryByText(NOTE)).toBeNull();
    });
  });
});
