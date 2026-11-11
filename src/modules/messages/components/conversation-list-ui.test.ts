// @vitest-environment jsdom
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { cleanup, fireEvent, render, screen, waitFor, within } from "@testing-library/react";
import { createElement } from "react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

import type { ConversationSummary, InboxCursor } from "@/modules/messages/contract";
import { inboxQuery } from "@/modules/messages/queries";
import { API_ROUTES, ROUTES } from "@/platform/http/routes";

import { ConversationList } from "./conversation-list";

const CREATED_AT = new Date().toISOString();
const NOOR_ID = "11111111-1111-4111-8111-111111111111";
const JONAS_ID = "22222222-2222-4222-8222-222222222222";

function makeSummary(id: string, name: string, overrides: Partial<ConversationSummary> = {}): ConversationSummary {
  return {
    id,
    peer: { id: name, name, title: null, company: null, avatarUrl: null, isAvailable: true },
    isBlockedByMe: false,
    unreadCount: 0,
    lastMessage: { preview: `Hello from ${name}`, isMine: false, isDeleted: false, createdAt: CREATED_AT },
    ...overrides,
  };
}

function renderWithInbox(
  element: ReturnType<typeof createElement>,
  conversations: ConversationSummary[],
  nextCursor: InboxCursor | null = null,
) {
  const queryClient = new QueryClient({ defaultOptions: { queries: { retry: false } } });
  queryClient.setQueryData(inboxQuery().queryKey, { pages: [{ conversations, nextCursor }], pageParams: [null] });
  render(createElement(QueryClientProvider, { client: queryClient }, element));
}

function renderList(conversations: ConversationSummary[], nextCursor: InboxCursor | null = null) {
  renderWithInbox(createElement(ConversationList), conversations, nextCursor);
}

function stubInbox(respond: (body: { search: string; cursor: InboxCursor | null }) => { conversations: ConversationSummary[]; nextCursor: InboxCursor | null }) {
  const fetchStub = vi.fn(async (path: string, init?: RequestInit) => {
    if (path !== API_ROUTES.messages) throw new Error(`Unexpected request to ${path}`);
    return new Response(JSON.stringify(respond(JSON.parse(String(init?.body)))), { headers: { "Content-Type": "application/json" } });
  });
  vi.stubGlobal("fetch", fetchStub);
  return fetchStub;
}

describe("the conversation list", () => {
  beforeEach(() => {
    stubInbox(() => ({ conversations: [], nextCursor: null }));
  });

  afterEach(() => {
    cleanup();
    vi.unstubAllGlobals();
  });

  it("links each conversation to its thread in the Inbox, with Founderhall's date", () => {
    renderList([makeSummary(NOOR_ID, "Noor Haddad"), makeSummary(JONAS_ID, "Jonas Lindqvist", { lastMessage: { preview: "Hi", isMine: false, isDeleted: false, createdAt: "2026-11-09T10:00:00.000Z" } })]);

    expect(screen.getByRole("link", { name: /Noor Haddad/ }).getAttribute("href")).toBe(`${ROUTES.messages}/${NOOR_ID}`);
    expect(within(screen.getByRole("link", { name: /Jonas Lindqvist/ })).getByText("9 Nov")).toBeTruthy();
  });

  it("marks a conversation with something unread", () => {
    renderList([makeSummary(NOOR_ID, "Noor Haddad", { unreadCount: 2 })]);

    const noor = screen.getByRole("link", { name: /Noor Haddad, 2 unread messages/ });
    expect(noor.className).toContain("fh-unread");
  });

  it("shows the last line, and a deleted one", () => {
    renderList([
      makeSummary(NOOR_ID, "Noor Haddad", { lastMessage: { preview: "See you\nThursday", isMine: true, isDeleted: false, createdAt: CREATED_AT } }),
      makeSummary(JONAS_ID, "Jonas Lindqvist", { lastMessage: { preview: null, isMine: false, isDeleted: true, createdAt: CREATED_AT } }),
    ]);

    expect(screen.getByText("See you")).toBeTruthy();
    expect(screen.getByText("Message deleted")).toBeTruthy();
  });

  it("labels someone you blocked, for you alone", () => {
    renderList([makeSummary(NOOR_ID, "Noor Haddad", { isBlockedByMe: true })]);

    expect(screen.getByText(/^Blocked\./)).toBeTruthy();
  });

  it("has no search box on a short inbox, as Founderhall", () => {
    renderList([makeSummary(NOOR_ID, "Noor Haddad")]);

    expect(screen.queryByRole("searchbox")).toBeNull();
  });

  describe("past the first page", () => {
    const NEXT_CURSOR = { lastMessageAt: CREATED_AT, conversationId: NOOR_ID };

    it("offers more, then loads them from the cursor and moves focus to the first new one", async () => {
      const fetchStub = stubInbox(() => ({ conversations: [makeSummary(JONAS_ID, "Jonas Lindqvist")], nextCursor: null }));
      renderList([makeSummary(NOOR_ID, "Noor Haddad")], NEXT_CURSOR);

      fireEvent.click(screen.getByRole("button", { name: "More" }));

      const jonas = await screen.findByRole("link", { name: /Jonas Lindqvist/ });
      const [, init] = fetchStub.mock.calls.at(-1) ?? [];
      expect(JSON.parse(String(init?.body))).toEqual({ search: "", cursor: NEXT_CURSOR });
      await waitFor(() => expect(document.activeElement).toBe(jonas));
      expect(screen.queryByRole("button", { name: "More" })).toBeNull();
    });

    it("keeps a search box on a long inbox, which asks the server to narrow by name", async () => {
      const everyone = [makeSummary(NOOR_ID, "Noor Haddad"), makeSummary(JONAS_ID, "Jonas Lindqvist")];
      stubInbox(({ search }) => ({
        conversations: search ? everyone.filter(({ peer }) => peer.name.toLowerCase().includes(search)) : everyone,
        nextCursor: null,
      }));
      renderList(everyone, NEXT_CURSOR);

      fireEvent.change(screen.getByRole("searchbox", { name: "Search people" }), { target: { value: "jonas" } });
      await waitFor(() => expect(screen.queryByRole("link", { name: /Noor Haddad/ })).toBeNull());

      fireEvent.change(screen.getByRole("searchbox", { name: "Search people" }), { target: { value: "zzz" } });
      expect(await screen.findByText("Nobody matches that.")).toBeTruthy();
    });

    it("lists a banned member's conversation", () => {
      renderList([makeSummary(NOOR_ID, "Noor Haddad", { peer: { id: "noor", name: "Noor Haddad", title: null, company: null, avatarUrl: null, isAvailable: false } })]);

      expect(screen.getByRole("link", { name: /Noor Haddad/ }).getAttribute("href")).toBe(`${ROUTES.messages}/${NOOR_ID}`);
    });
  });

  it("shows Founderhall's empty inbox, linking the directory", () => {
    renderList([]);

    expect(screen.getByRole("heading", { name: "No messages yet" })).toBeTruthy();
    expect(screen.getByRole("link", { name: "directory" }).getAttribute("href")).toBe(ROUTES.members);
  });
});
