// @vitest-environment jsdom
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { cleanup, fireEvent, render, screen, waitFor, within } from "@testing-library/react";
import { createElement } from "react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

import type { ConversationSummary, InboxCursor } from "@/lib/messages/message-api";
import { inboxQuery } from "@/lib/messages/message-queries";
import { API_ROUTES, ROUTES } from "@/platform/http/routes";

import { ConversationList } from "./conversation-list";
import { NoConversationSelected } from "./no-conversation-selected";

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

function renderList(conversations: ConversationSummary[], activeConversationId: string | null = null, nextCursor: InboxCursor | null = null) {
  renderWithInbox(createElement(ConversationList, { activeConversationId }), conversations, nextCursor);
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

  it("links each conversation and marks the open one", () => {
    renderList([makeSummary(NOOR_ID, "Noor Haddad"), makeSummary(JONAS_ID, "Jonas Lindqvist")], NOOR_ID);

    const noor = screen.getByRole("link", { name: /Noor Haddad/ });
    expect(noor.getAttribute("href")).toBe(`${ROUTES.messages}/${NOOR_ID}`);
    expect(noor.getAttribute("aria-current")).toBe("true");
    expect(screen.getByRole("link", { name: /Jonas Lindqvist/ }).getAttribute("aria-current")).toBeNull();
  });

  it("shows the unread count on the conversation", () => {
    renderList([makeSummary(NOOR_ID, "Noor Haddad", { unreadCount: 2 })]);

    expect(within(screen.getByRole("link", { name: /Noor Haddad/ })).getByRole("img", { name: "2 unread messages" }).textContent).toBe("2");
  });

  it("marks your own last message and a deleted one", () => {
    renderList([
      makeSummary(NOOR_ID, "Noor Haddad", { lastMessage: { preview: "See you", isMine: true, isDeleted: false, createdAt: CREATED_AT } }),
      makeSummary(JONAS_ID, "Jonas Lindqvist", { lastMessage: { preview: null, isMine: false, isDeleted: true, createdAt: CREATED_AT } }),
    ]);

    expect(screen.getByText("You: See you")).toBeTruthy();
    expect(screen.getByText("Message deleted")).toBeTruthy();
  });

  it("labels someone you blocked, for you alone", () => {
    renderList([makeSummary(NOOR_ID, "Noor Haddad", { isBlockedByMe: true })]);

    expect(screen.getByText(/^Blocked\./)).toBeTruthy();
  });

  it("asks the server to narrow by name, and clears", async () => {
    const everyone = [makeSummary(NOOR_ID, "Noor Haddad"), makeSummary(JONAS_ID, "Jonas Lindqvist")];
    stubInbox(({ search }) => ({
      conversations: search ? everyone.filter(({ peer }) => peer.name.toLowerCase().includes(search)) : everyone,
      nextCursor: null,
    }));
    renderList(everyone);

    fireEvent.change(screen.getByRole("searchbox", { name: "Search people" }), { target: { value: "jonas" } });
    await waitFor(() => expect(screen.queryByRole("link", { name: /Noor Haddad/ })).toBeNull());

    fireEvent.click(screen.getByRole("button", { name: "Clear search" }));

    expect(await screen.findByRole("link", { name: /Noor Haddad/ })).toBeTruthy();
    expect(document.activeElement).toBe(screen.getByRole("searchbox", { name: "Search people" }));
  });

  it("says so when nobody matches, and keeps the search box", async () => {
    stubInbox(() => ({ conversations: [], nextCursor: null }));
    renderList([makeSummary(NOOR_ID, "Noor Haddad")]);

    fireEvent.change(screen.getByRole("searchbox", { name: "Search people" }), { target: { value: "zzz" } });

    expect(await screen.findByText("Nobody matches that.")).toBeTruthy();
    expect(screen.getByRole("searchbox", { name: "Search people" })).toBeTruthy();
  });

  describe("past the first page", () => {
    const NEXT_CURSOR = { lastMessageAt: CREATED_AT, conversationId: NOOR_ID };

    it("offers more, then loads them from the cursor and moves focus to the first new one", async () => {
      const fetchStub = stubInbox(() => ({ conversations: [makeSummary(JONAS_ID, "Jonas Lindqvist")], nextCursor: null }));
      renderList([makeSummary(NOOR_ID, "Noor Haddad")], null, NEXT_CURSOR);

      fireEvent.click(screen.getByRole("button", { name: "Show more conversations" }));

      const jonas = await screen.findByRole("link", { name: /Jonas Lindqvist/ });
      const [, init] = fetchStub.mock.calls.at(-1) ?? [];
      expect(JSON.parse(String(init?.body))).toEqual({ search: "", cursor: NEXT_CURSOR });
      await waitFor(() => expect(document.activeElement).toBe(jonas));
      expect(screen.queryByRole("button", { name: "Show more conversations" })).toBeNull();
    });

    it("lists a banned member's conversation", () => {
      renderList([makeSummary(NOOR_ID, "Noor Haddad", { peer: { id: "noor", name: "Noor Haddad", title: null, company: null, avatarUrl: null, isAvailable: false } })]);

      expect(screen.getByRole("link", { name: /Noor Haddad/ }).getAttribute("href")).toBe(`${ROUTES.messages}/${NOOR_ID}`);
    });
  });

  it("offers Members when there are no conversations", () => {
    renderList([]);

    expect(screen.getByRole("link", { name: "Meet the members" }).getAttribute("href")).toBe(ROUTES.members);
  });

  describe("the empty right pane", () => {
    it("offers Members when there are no conversations", () => {
      renderWithInbox(createElement(NoConversationSelected), []);

      expect(screen.getByRole("heading", { name: "No conversations yet" })).toBeTruthy();
      expect(screen.getByText(/whoever runs this community's database could read them/)).toBeTruthy();
    });

    it("asks you to pick one otherwise", () => {
      renderWithInbox(createElement(NoConversationSelected), [makeSummary(NOOR_ID, "Noor Haddad")]);

      expect(screen.getByRole("heading", { name: "Pick a conversation" })).toBeTruthy();
    });
  });
});
