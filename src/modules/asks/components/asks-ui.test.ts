// @vitest-environment jsdom
import { notifyManager, QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { cleanup, fireEvent, render, screen } from "@testing-library/react";
import { createElement, type ReactNode } from "react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

import { ASK_API_ROUTES, ASK_CATEGORIES, ASK_KINDS, type AskBoardPage, type BoardAsk } from "@/modules/asks/contract";
import { askBoardQuery } from "@/modules/asks/queries";
import { MemberConversationSlotContext } from "@/modules/members/slots";

import { AskBoard } from "./ask-board";

const NOTE = "I know two who did exactly this.";

const ASK: BoardAsk = {
  id: "11111111-1111-4111-8111-111111111111",
  title: "Looking for a fractional CFO",
  detail: null,
  category: ASK_CATEGORIES.hire,
  kind: ASK_KINDS.ask,
  listedAt: "2026-11-05T12:00:00.000Z",
  author: { id: "maya", name: "Maya Okafor", title: null, company: null, avatarUrl: null },
  target: null,
  offerCount: 0,
  isMine: false,
  myOffer: null,
  answers: [],
  whyYou: null,
};

function toPage(asks: BoardAsk[], canIntro = false): AskBoardPage {
  return { asks, nextCursor: null, canIntro };
}

function respond(body: unknown) {
  return new Response(JSON.stringify(body), { headers: { "Content-Type": "application/json" } });
}

function renderBoard(asks: BoardAsk[], withMessages: boolean) {
  const queryClient = new QueryClient({ defaultOptions: { queries: { retry: false, staleTime: Number.POSITIVE_INFINITY } } });
  queryClient.setQueryData(askBoardQuery(null).queryKey, { pages: [toPage(asks)], pageParams: [null] });
  const board = createElement(AskBoard, { category: null, isViewerAdmin: false, onAsk: vi.fn(), onSeeEverything: vi.fn(), onSeeYourAsks: vi.fn() });
  const slot = (children: ReactNode) =>
    withMessages ? createElement(MemberConversationSlotContext.Provider, { value: ({ label }) => createElement("button", { type: "button" }, label) }, children) : children;
  render(createElement(QueryClientProvider, { client: queryClient }, slot(board)));
}

describe("the asks board", () => {
  afterEach(() => {
    cleanup();
    vi.unstubAllGlobals();
  });

  it("invites the first ask when the board is empty", () => {
    const onAsk = vi.fn();
    const queryClient = new QueryClient();
    queryClient.setQueryData(askBoardQuery(null).queryKey, { pages: [toPage([])], pageParams: [null] });
    render(
      createElement(
        QueryClientProvider,
        { client: queryClient },
        createElement(AskBoard, { category: null, isViewerAdmin: false, onAsk, onSeeEverything: vi.fn(), onSeeYourAsks: vi.fn() }),
      ),
    );

    fireEvent.click(screen.getByRole("button", { name: "Ask for something" }));

    expect(screen.getByRole("heading", { name: "Be the first to ask" })).toBeTruthy();
    expect(onAsk).toHaveBeenCalledOnce();
  });

  it("hides the help buttons on your own ask", () => {
    renderBoard([{ ...ASK, isMine: true }], true);

    expect(screen.queryByRole("button", { name: "I know someone" })).toBeNull();
    expect(screen.queryByRole("button", { name: "I've done this myself" })).toBeNull();
    expect(screen.getByRole("button", { name: "See who can help" })).toBeTruthy();
  });

  it("shows an update with no help buttons", () => {
    renderBoard([{ ...ASK, kind: ASK_KINDS.update, title: "We closed our first customer" }], true);

    expect(screen.getByText("Update")).toBeTruthy();
    expect(screen.queryByRole("button", { name: "I know someone" })).toBeNull();
  });

  describe("after an offer", () => {
    // Notifying at once lets the refreshed board unmount the form before the request settles, as a browser does.
    beforeEach(() => notifyManager.setScheduler((callback) => callback()));
    afterEach(() => notifyManager.setScheduler((callback) => setTimeout(callback, 0)));

    function stubOffer(isSentAsMessage: boolean) {
      vi.stubGlobal(
        "fetch",
        vi.fn(async (path: string) => {
          if (path === ASK_API_ROUTES.offer) return respond({ isSentAsMessage, wasAlreadyOffered: false });
          if (path === ASK_API_ROUTES.board) return respond(toPage([{ ...ASK, offerCount: 1, myOffer: { note: NOTE, createdAt: ASK.listedAt } }]));
          return respond({ newOffers: 0, asks: [], openCount: 0 });
        }),
      );
    }

    async function sendNote() {
      fireEvent.click(screen.getByRole("button", { name: "I know someone" }));
      fireEvent.change(screen.getByLabelText("How can you help Maya?"), { target: { value: NOTE } });
      fireEvent.click(screen.getByRole("button", { name: "Send my note" }));
      await screen.findByText("You offered to help");
    }

    it("still says where the note went once the refreshed board replaces the form", async () => {
      stubOffer(true);
      renderBoard([ASK], true);

      await sendNote();

      expect(await screen.findByText("We sent your note to Maya in Messages.")).toBeTruthy();
      expect(screen.getByRole("button", { name: "Open the conversation" })).toBeTruthy();
    });

    it("says the note waits on the ask, with no conversation button, when messages is off", async () => {
      stubOffer(false);
      renderBoard([ASK], false);

      await sendNote();

      expect(await screen.findByText(/We saved your note on Maya's ask/)).toBeTruthy();
      expect(screen.queryByRole("button", { name: "Open the conversation" })).toBeNull();
    });
  });
});
