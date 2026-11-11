// @vitest-environment jsdom
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { act, cleanup, fireEvent, render, screen, waitFor, within } from "@testing-library/react";
import { createElement } from "react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

import { MESSAGE_LIMITS, type DirectMessage, type ThreadChanges, type ThreadPage } from "@/modules/messages/contract";
import { pendingMessagesQuery, threadQuery } from "@/modules/messages/queries";
import { API_ROUTES } from "@/platform/http/routes";

import { Thread } from "./thread";

const CONVERSATION_ID = "11111111-1111-4111-8111-111111111111";
const CREATED_AT = new Date().toISOString();
const SERVER_ERROR_STATUS = 500;
const NOOR = { id: "noor", name: "Noor Haddad", title: "Founder", company: "Kindling", avatarUrl: null, isAvailable: true };
const SEND_NAME = "Send";

function makeMessage(sequence: number, overrides: Partial<DirectMessage> = {}): DirectMessage {
  return {
    id: `00000000-0000-4000-8000-${String(sequence).padStart(12, "0")}`,
    isMine: false,
    body: `Message ${sequence}`,
    isDeleted: false,
    isReported: false,
    isViaEmail: false,
    sequence,
    clientKey: null,
    createdAt: CREATED_AT,
    ...overrides,
  };
}

function makePage(messages: DirectMessage[], overrides: Partial<ThreadPage> = {}): ThreadPage {
  return {
    conversationId: CONVERSATION_ID,
    peer: NOOR,
    isBlockedByMe: false,
    messages,
    olderCursor: null,
    revision: messages.at(-1)?.sequence ?? 0,
    lastReadSequence: messages.at(-1)?.sequence ?? 0,
    ...overrides,
  };
}

const NO_CHANGES: ThreadChanges = {
  messages: [],
  revision: 0,
  hasMore: false,
  isBlockedByMe: false,
  isPeerAvailable: true,
};

type ApiResponder = (body: Record<string, unknown>) => { status?: number; json: unknown } | Promise<never>;

const DEFAULT_RESPONDERS: Record<string, ApiResponder> = {
  [API_ROUTES.messageChanges]: () => ({ json: NO_CHANGES }),
  [API_ROUTES.messageRead]: ({ sequence }) => ({ json: { lastReadSequence: sequence } }),
  [API_ROUTES.messageUnreadCount]: () => ({ json: { unreadCount: 0 } }),
  [API_ROUTES.messages]: () => ({ json: { conversations: [], nextCursor: null } }),
};

function toResponse({ status = 200, json }: { status?: number; json: unknown }) {
  return new Response(JSON.stringify(json), { status, headers: { "Content-Type": "application/json" } });
}

function stubApi(responders: Record<string, ApiResponder> = {}) {
  const allResponders = { ...DEFAULT_RESPONDERS, ...responders };
  const fetchStub = vi.fn(async (path: string, init?: RequestInit) => {
    const respond = allResponders[path];
    if (!respond) throw new Error(`Unexpected request to ${path}`);
    return toResponse(await respond(JSON.parse(String(init?.body))));
  });
  vi.stubGlobal("fetch", fetchStub);
  return fetchStub;
}

function readRequests(fetchStub: ReturnType<typeof stubApi>, path: string) {
  return fetchStub.mock.calls.filter(([calledPath]) => calledPath === path).map(([, init]) => JSON.parse(String(init?.body)));
}

function renderThread(pages: ThreadPage[]) {
  const queryClient = new QueryClient({ defaultOptions: { queries: { retry: false } } });
  queryClient.setQueryData(threadQuery(CONVERSATION_ID).queryKey, {
    pages,
    pageParams: pages.map((_page, position) => (position === 0 ? null : pages[position - 1]?.olderCursor)),
  });
  render(createElement(QueryClientProvider, { client: queryClient }, createElement(Thread, { conversationId: CONVERSATION_ID, communityName: "Northwind Founders" })));
  return queryClient;
}

function typeMessage(text: string) {
  fireEvent.change(screen.getByRole("textbox", { name: "Write a message" }), { target: { value: text } });
}

function readAnnouncer() {
  return document.querySelector("[data-slot=new-message-announcer]")?.textContent ?? "";
}

function clickSend() {
  fireEvent.click(screen.getByRole("button", { name: SEND_NAME }));
}

describe("the thread on screen", () => {
  beforeEach(() => {
    vi.stubGlobal(
      "ResizeObserver",
      class {
        observe() {}
        disconnect() {}
      },
    );
    vi.stubGlobal("matchMedia", (query: string) => ({ matches: query === "(pointer: fine)" }));
    stubApi();
  });

  afterEach(() => {
    cleanup();
    vi.unstubAllGlobals();
  });

  describe("sending", () => {
    it("shows the message at once, before the server answers", async () => {
      stubApi({ [API_ROUTES.messageSend]: () => new Promise<never>(() => undefined) });
      renderThread([makePage([])]);

      typeMessage("On its way");
      clickSend();

      expect(await screen.findByText("On its way")).toBeTruthy();
      expect(await screen.findByText("Sending…")).toBeTruthy();
    });

    it("clears the field, so a double click sends once", async () => {
      const fetchStub = stubApi({
        [API_ROUTES.messageSend]: ({ clientKey, body }) => ({
          json: makeMessage(1, { isMine: true, clientKey: String(clientKey), body: String(body) }),
        }),
      });
      renderThread([makePage([])]);

      typeMessage("Only once");
      clickSend();
      clickSend();

      await screen.findByText("Only once");
      await waitFor(() => expect(readRequests(fetchStub, API_ROUTES.messageSend)).toHaveLength(1));
    });

    it("sends on Enter and adds a line on Shift and Enter", async () => {
      const fetchStub = stubApi({
        [API_ROUTES.messageSend]: ({ clientKey, body }) => ({
          json: makeMessage(1, { isMine: true, clientKey: String(clientKey), body: String(body) }),
        }),
      });
      renderThread([makePage([])]);
      const field = screen.getByRole("textbox", { name: "Write a message" });

      typeMessage("Hello");
      fireEvent.keyDown(field, { key: "Enter", shiftKey: true });
      expect(readRequests(fetchStub, API_ROUTES.messageSend)).toHaveLength(0);

      fireEvent.keyDown(field, { key: "Enter" });
      await waitFor(() => expect(readRequests(fetchStub, API_ROUTES.messageSend)).toHaveLength(1));
    });

    it("refuses a blank message", () => {
      const fetchStub = stubApi();
      renderThread([makePage([])]);

      typeMessage("   \n  ");
      clickSend();

      expect(readRequests(fetchStub, API_ROUTES.messageSend)).toEqual([]);
    });

    it("explains when a message runs over the cap, and sends nothing", () => {
      const fetchStub = stubApi();
      renderThread([makePage([])]);

      typeMessage("a".repeat(MESSAGE_LIMITS.bodyLength + 1));
      clickSend();

      expect(screen.getByRole("alert").textContent).toContain("under 4,000 characters");
      expect(readRequests(fetchStub, API_ROUTES.messageSend)).toEqual([]);
      expect(screen.getByText("1 over")).toBeTruthy();
    });

    describe("when it fails", () => {
      it("says so, and retries with the same idempotency key", async () => {
        let attempts = 0;
        const fetchStub = stubApi({
          [API_ROUTES.messageSend]: ({ clientKey, body }) => {
            attempts += 1;
            if (attempts === 1) return { status: SERVER_ERROR_STATUS, json: { message: "Try again in a moment." } };
            return { json: makeMessage(1, { isMine: true, clientKey: String(clientKey), body: String(body) }) };
          },
        });
        renderThread([makePage([])]);

        typeMessage("Keep trying");
        clickSend();

        expect((await screen.findByRole("alert")).textContent).toContain("Not sent. Try again in a moment.");

        fireEvent.click(screen.getByRole("button", { name: "Try again" }));

        await waitFor(() => expect(screen.queryByRole("alert")).toBeNull());
        const [first, second] = readRequests(fetchStub, API_ROUTES.messageSend);
        expect(second.clientKey).toBe(first.clientKey);
        expect(screen.getAllByText("Keep trying")).toHaveLength(1);
      });

      it("discards the failed message on request", async () => {
        stubApi({ [API_ROUTES.messageSend]: () => ({ status: SERVER_ERROR_STATUS, json: { message: "No." } }) });
        renderThread([makePage([])]);

        typeMessage("Never mind");
        clickSend();
        await screen.findByRole("alert");

        fireEvent.click(screen.getByRole("button", { name: "Discard" }));

        await waitFor(() => expect(screen.queryByText("Never mind")).toBeNull());
      });

      it("drops the failure when a poll shows the message did land", async () => {
        const queryClient = renderThread([makePage([])]);
        const clientKey = "33333333-3333-4333-8333-333333333333";

        act(() => {
          queryClient.setQueryData(pendingMessagesQuery(CONVERSATION_ID).queryKey, [
            { clientKey, body: "Landed", status: "failed", failureMessage: "Offline", createdAt: CREATED_AT },
          ]);
        });
        expect(await screen.findByRole("alert")).toBeTruthy();

        act(() => {
          queryClient.setQueryData(threadQuery(CONVERSATION_ID).queryKey, (thread) =>
            thread
              ? { ...thread, pages: [makePage([makeMessage(1, { isMine: true, clientKey, body: "Landed" })])] }
              : thread,
          );
        });

        await waitFor(() => expect(screen.queryByRole("alert")).toBeNull());
        expect(screen.getAllByText("Landed")).toHaveLength(1);
      });
    });
  });

  describe("message text", () => {
    it("renders markup as text and makes no script link", () => {
      renderThread([makePage([makeMessage(1, { body: `<img src=x onerror=alert(1)> javascript:alert(1) https://example.com/safe` })])]);

      const log = screen.getByRole("group", { name: "Messages with Noor Haddad" });
      expect(log.querySelector("img[src=x]")).toBeNull();
      expect(within(log).getByRole("link").getAttribute("href")).toBe("https://example.com/safe");
      expect(within(log).getByRole("link").getAttribute("rel")).toBe("noopener noreferrer");
      expect(log.textContent).toContain("<img src=x onerror=alert(1)>");
    });

    it("drops a right-to-left override from a stored message", () => {
      renderThread([makePage([makeMessage(1, { body: "‮https://evil.test/moc.elgoog" })])]);

      expect(screen.getByRole("group", { name: "Messages with Noor Haddad" }).textContent).not.toContain("‮");
    });

    it("collapses a long message until asked", () => {
      renderThread([makePage([makeMessage(1, { body: `first\n${"filler\n".repeat(200)}last line` })])]);

      expect(screen.queryByText(/last line/)).toBeNull();

      fireEvent.click(screen.getByRole("button", { name: "Show more" }));

      expect(screen.getByText(/last line/)).toBeTruthy();
    });

    it("shows a deleted message without its text", () => {
      renderThread([makePage([makeMessage(1, { isDeleted: true, body: null })])]);

      expect(screen.getByText(/Message deleted/)).toBeTruthy();
    });

    it("offers no options on a deleted message", () => {
      renderThread([makePage([makeMessage(1, { isDeleted: true, body: null })])]);

      expect(screen.queryByRole("button", { name: /Report Noor's message/ })).toBeNull();
    });
  });

  describe("the live region", () => {
    it("starts empty, so opening a conversation announces nothing", () => {
      renderThread([makePage([makeMessage(1), makeMessage(2)])]);

      expect(readAnnouncer()).toBe("");
    });

    it("announces a message that arrives by polling", async () => {
      const queryClient = renderThread([makePage([makeMessage(1)])]);

      act(() => {
        queryClient.setQueryData(threadQuery(CONVERSATION_ID).queryKey, (thread) =>
          thread ? { ...thread, pages: [makePage([makeMessage(1), makeMessage(2, { body: "Fresh news" })])] } : thread,
        );
      });

      await waitFor(() => expect(readAnnouncer()).toBe("New from Noor Haddad: Fresh news"));
    });

    it("stays silent when older messages load", async () => {
      const newestPage = makePage([makeMessage(31)], { olderCursor: 31 });
      const fetchStub = stubApi({
        [API_ROUTES.messageThread]: () => ({ json: makePage([makeMessage(30, { body: "Ancient history" })]) }),
      });
      renderThread([newestPage]);

      fireEvent.click(screen.getByRole("button", { name: "Show older messages" }));

      expect(await screen.findByText("Ancient history")).toBeTruthy();
      expect(readAnnouncer()).toBe("");
      expect(readRequests(fetchStub, API_ROUTES.messageThread)[0]).toMatchObject({ beforeSequence: 31 });
    });

    it("isn't the message list itself, so older messages can't reach it", () => {
      renderThread([makePage([makeMessage(1)])]);

      const log = screen.getByRole("group", { name: "Messages with Noor Haddad" });
      expect(log.getAttribute("aria-live")).toBeNull();
      expect(log.getAttribute("role")).not.toBe("log");
    });
  });

  describe("reading", () => {
    it("marks the conversation read when it opens", async () => {
      const fetchStub = stubApi();
      renderThread([makePage([makeMessage(1), makeMessage(2)], { lastReadSequence: 0 })]);

      await waitFor(() => expect(readRequests(fetchStub, API_ROUTES.messageRead)).toEqual([{ conversationId: CONVERSATION_ID, sequence: 2 }]));
    });

    it("doesn't mark it read when nothing is new", async () => {
      const fetchStub = stubApi();
      renderThread([makePage([makeMessage(1)], { lastReadSequence: 1 })]);

      await waitFor(() => expect(readRequests(fetchStub, API_ROUTES.messageChanges).length).toBeGreaterThan(0));
      expect(readRequests(fetchStub, API_ROUTES.messageRead)).toEqual([]);
    });

    it("waits until the tab is visible", async () => {
      vi.spyOn(document, "visibilityState", "get").mockReturnValue("hidden");
      const fetchStub = stubApi();
      renderThread([makePage([makeMessage(1)], { lastReadSequence: 0 })]);

      expect(readRequests(fetchStub, API_ROUTES.messageRead)).toEqual([]);

      vi.spyOn(document, "visibilityState", "get").mockReturnValue("visible");
      fireEvent(document, new Event("visibilitychange"));

      await waitFor(() => expect(readRequests(fetchStub, API_ROUTES.messageRead)).toHaveLength(1));
      vi.restoreAllMocks();
    });

    it("never shows whether the other member read your message", () => {
      renderThread([makePage([makeMessage(1, { isMine: true })])]);

      expect(screen.queryByText(/^Read /)).toBeNull();
    });
  });

  describe("polling", () => {
    it("asks only for what changed after the cursor", async () => {
      const fetchStub = stubApi();
      renderThread([makePage([makeMessage(7)], { revision: 9 })]);

      await waitFor(() =>
        expect(readRequests(fetchStub, API_ROUTES.messageChanges)[0]).toEqual({ conversationId: CONVERSATION_ID, afterRevision: 9 }),
      );
    });

    it("says when the server can't be reached, and keeps the messages", async () => {
      stubApi({ [API_ROUTES.messageChanges]: () => ({ status: SERVER_ERROR_STATUS, json: { message: "Down" } }) });
      renderThread([makePage([makeMessage(1)])]);

      expect(await screen.findByText(/can't reach the server/)).toBeTruthy();
      expect(screen.getByText("Message 1")).toBeTruthy();
    });
  });

  describe("blocking", () => {
    it("replaces the composer and offers an unblock", () => {
      renderThread([makePage([makeMessage(1)], { isBlockedByMe: true })]);

      expect(screen.queryByRole("textbox")).toBeNull();
      expect(screen.getByRole("button", { name: "Unblock Noor" })).toBeTruthy();
    });
  });

  describe("an unavailable member", () => {
    it("replaces the composer and removes the profile links", () => {
      renderThread([makePage([makeMessage(1)], { peer: { ...NOOR, isAvailable: false } })]);

      expect(screen.queryByRole("textbox")).toBeNull();
      expect(screen.getByText(/isn't available right now/)).toBeTruthy();
      expect(screen.queryByRole("link", { name: /View profile/ })).toBeNull();
    });
  });

  describe("privacy", () => {
    it("says, in Founderhall's words, that admins can't read it", () => {
      renderThread([makePage([makeMessage(1)])]);

      expect(screen.getByText("Replies by email land here too. Northwind Founders’ admins can’t read messages in the portal.")).toBeTruthy();
    });

    it("marks a message that came as an email reply", () => {
      renderThread([makePage([makeMessage(1, { isViaEmail: true }), makeMessage(2)])]);

      expect(screen.getAllByText("by email")).toHaveLength(1);
    });

    describe("reporting", () => {
      async function openReportPanel() {
        fireEvent.click(screen.getByRole("button", { name: "Report Noor's message" }));
      }

      it("says the report is saved, says what's shared, and promises no review", async () => {
        renderThread([makePage([makeMessage(1)])]);

        await openReportPanel();

        const copy = (await screen.findByText(/Report this message\?/)).textContent;
        expect(copy).toContain("saved for this community's admins");
        expect(copy).toContain("nothing else from this conversation");
        expect(copy).not.toMatch(/will review|immediately|right away/i);
      });

      it("marks the message reported without claiming anyone has seen it", async () => {
        stubApi({ [API_ROUTES.messageReport]: () => ({ json: { message: "Reported." } }) });
        renderThread([makePage([makeMessage(1)])]);

        await openReportPanel();
        fireEvent.click(await screen.findByRole("button", { name: "Report" }));

        expect(await screen.findByText(/ · reported$/)).toBeTruthy();
        expect(screen.getByText("Report saved for this community's admins.")).toBeTruthy();
      });
    });
  });
});
