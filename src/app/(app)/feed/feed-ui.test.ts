// @vitest-environment jsdom
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { cleanup, fireEvent, render, screen, waitFor, within } from "@testing-library/react";
import { createElement } from "react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

import { POST_TYPES, REACTIONS, type FeedPage, type Post } from "@/lib/feed/feed-api";
import { API_ROUTES } from "@/lib/routes";

import { Feed } from "./feed";
import type { FeedViewer } from "./feed-context";
import { feedQuery } from "./feed-queries";

const TIMESTAMP = new Date().toISOString();
const SERVER_ERROR_STATUS = 500;
const POST_ID = "11111111-1111-4111-8111-111111111111";
const MEMBER: FeedViewer = { id: "member", name: "Noor Haddad", avatarUrl: null, isAdmin: false };
const ADMIN: FeedViewer = { id: "admin", name: "Priya Raman", avatarUrl: null, isAdmin: true };

function makePost(overrides: Partial<Post> = {}): Post {
  return {
    id: POST_ID,
    type: POST_TYPES.plain,
    body: "Who knows usage pricing?",
    createdAt: TIMESTAMP,
    editedAt: null,
    author: { id: "jonas", name: "Jonas Lindqvist", title: null, company: "Ledgerline", avatarUrl: null, isBanned: false },
    pin: null,
    reactions: [{ reaction: REACTIONS.heart, count: 2, isMine: false }],
    commentCount: 0,
    inlineComments: [],
    ...overrides,
  };
}

type ApiResponder = (body: unknown) => { status?: number; json: unknown };

function toResponse({ status = 200, json }: ReturnType<ApiResponder>) {
  return new Response(JSON.stringify(json), { status, headers: { "Content-Type": "application/json" } });
}

function stubApi(responders: Record<string, ApiResponder> = {}) {
  const fetchStub = vi.fn(async (path: string, init?: RequestInit) => {
    if (path === API_ROUTES.feedNewCount) return toResponse({ json: { newPostCount: 0 } });
    const respond = responders[path];
    if (!respond) throw new Error(`Unexpected request to ${path}`);
    return toResponse(respond(JSON.parse(String(init?.body))));
  });
  vi.stubGlobal("fetch", fetchStub);
  return fetchStub;
}

function renderFeed(viewer: FeedViewer, posts: Post[], pinnedPosts: Post[] = []) {
  const queryClient = new QueryClient({ defaultOptions: { queries: { retry: false } } });
  const page: FeedPage = { pinnedPosts, posts, nextCursor: null, newestPostAt: TIMESTAMP };
  queryClient.setQueryData(feedQuery().queryKey, { pages: [page], pageParams: [null] });
  render(createElement(QueryClientProvider, { client: queryClient }, createElement(Feed, { viewer })));
}

describe("the feed on screen", () => {
  beforeEach(() => {
    stubApi();
  });

  afterEach(() => {
    cleanup();
    vi.unstubAllGlobals();
  });

  describe("reacting", () => {
    it("moves the count at once, before the server answers", async () => {
      vi.stubGlobal(
        "fetch",
        vi.fn(async (path: string) => {
          if (path === API_ROUTES.feedNewCount) return toResponse({ json: { newPostCount: 0 } });
          return new Promise<Response>(() => undefined);
        }),
      );
      renderFeed(MEMBER, [makePost()]);

      fireEvent.click(screen.getByRole("button", { name: "Heart, 2" }));

      const optimistic = await screen.findByRole("button", { name: "Heart, 3" });
      expect(optimistic.getAttribute("aria-pressed")).toBe("true");
    });

    it("rolls back and says so when the server refuses", async () => {
      stubApi({
        [API_ROUTES.feedPostReaction]: () => ({ status: SERVER_ERROR_STATUS, json: { message: "Try again in a moment." } }),
      });
      renderFeed(MEMBER, [makePost()]);

      fireEvent.click(screen.getByRole("button", { name: "Heart, 2" }));

      expect(await screen.findByText(/That reaction didn't save/)).toBeTruthy();
      const rolledBack = screen.getByRole("button", { name: "Heart, 2" });
      expect(rolledBack.getAttribute("aria-pressed")).toBe("false");
    });

    it("trusts the server's count once it answers", async () => {
      stubApi({
        [API_ROUTES.feedPostReaction]: () => ({ json: { reactions: [{ reaction: REACTIONS.heart, count: 9, isMine: true }] } }),
      });
      renderFeed(MEMBER, [makePost()]);

      fireEvent.click(screen.getByRole("button", { name: "Heart, 2" }));

      expect(await screen.findByRole("button", { name: "Heart, 9" })).toBeTruthy();
    });
  });

  describe("post text", () => {
    it("renders markup as text and makes no javascript: link", () => {
      renderFeed(MEMBER, [makePost({ body: `<img src=x onerror=alert(1)> javascript:alert(1) https://example.com/safe` })]);

      const links = screen.getAllByRole("link").filter((link) => link.getAttribute("target") === "_blank");
      expect(links.map((link) => link.getAttribute("href"))).toEqual(["https://example.com/safe"]);
      expect(links[0]?.getAttribute("rel")).toBe("noopener noreferrer");
      expect(document.querySelector("article img")).toBeNull();
      expect(screen.getByText(/<img src=x onerror=alert\(1\)>/)).toBeTruthy();
    });

    it("drops a right-to-left override from an older post", () => {
      renderFeed(MEMBER, [makePost({ body: "\u202Ehttps://evil.test/moc.elgoog" })]);

      expect(document.querySelector("article")?.textContent).not.toContain("\u202E");
    });

    it("collapses a long post until asked, and collapses it again", () => {
      renderFeed(MEMBER, [makePost({ body: `first line\n${"filler\n".repeat(400)}last line` })]);

      expect(screen.queryByText(/last line/)).toBeNull();

      fireEvent.click(screen.getByRole("button", { name: "Show more" }));
      expect(screen.getByText(/last line/)).toBeTruthy();

      fireEvent.click(screen.getByRole("button", { name: "Show less" }));
      expect(screen.queryByText(/last line/)).toBeNull();
    });

    it("shows no control on a short post", () => {
      renderFeed(MEMBER, [makePost()]);

      expect(screen.queryByRole("button", { name: "Show more" })).toBeNull();
    });
  });

  describe("who can act", () => {
    it("offers a member only Report on someone else's post", () => {
      renderFeed(MEMBER, [makePost()]);

      fireEvent.pointerDown(screen.getByRole("button", { name: /Actions for/ }), { button: 0, ctrlKey: false });

      expect(screen.getAllByRole("menuitem").map((item) => item.textContent)).toEqual(["Report"]);
    });

    it("tells a member a kept post's author is no longer a member, without the word banned", () => {
      renderFeed(MEMBER, [makePost({ author: { ...makePost().author, isBanned: true } })]);

      expect(screen.getByText("No longer a member")).toBeTruthy();
      expect(screen.queryByText("Banned")).toBeNull();
    });

    it("offers a member actions on their own post", () => {
      renderFeed(MEMBER, [makePost({ author: { ...makePost().author, id: MEMBER.id, name: MEMBER.name } })]);

      expect(screen.getByRole("button", { name: "Actions for your post" })).toBeTruthy();
    });

    it("offers an admin actions on someone else's post", () => {
      renderFeed(ADMIN, [makePost()]);

      expect(screen.getByRole("button", { name: "Actions for Jonas Lindqvist's post" })).toBeTruthy();
    });

    it("shows an admin a banned member's post, read-only and marked", () => {
      renderFeed(ADMIN, [makePost({ author: { ...makePost().author, isBanned: true } })]);

      const post = within(screen.getByRole("article", { name: "Post by Jonas Lindqvist" }));
      expect(post.getByText("Banned")).toBeTruthy();
      expect(post.queryByRole("link", { name: "Jonas Lindqvist" })).toBeNull();
      expect(post.queryByRole("button", { name: "Add reaction" })).toBeNull();
      expect(post.queryByRole("button", { name: "Reply" })).toBeNull();
    });
  });

  describe("posting", () => {
    it("puts the new post in the feed and clears the box", async () => {
      const created = makePost({ id: "22222222-2222-4222-8222-222222222222", body: "Fresh off the press" });
      const fetchStub = stubApi({ [API_ROUTES.feedPosts]: () => ({ json: created }) });
      renderFeed(MEMBER, [makePost()]);

      const box = screen.getAllByRole("textbox", { name: "Write a post" })[0];
      if (!box) throw new Error("The composer is missing.");
      fireEvent.change(box, { target: { value: "Fresh off the press" } });
      fireEvent.click(within(screen.getByRole("form", { name: "New post" })).getByRole("button", { name: "Post" }));

      expect(await screen.findByText("Fresh off the press")).toBeTruthy();
      expect(fetchStub).toHaveBeenCalledWith(API_ROUTES.feedPosts, expect.anything());
      await waitFor(() => expect(box).toHaveProperty("value", ""));
    });

    it("keeps the draft and shows the server's reason on failure", async () => {
      stubApi({ [API_ROUTES.feedPosts]: () => ({ status: 429, json: { message: "You're posting fast." } }) });
      renderFeed(MEMBER, [makePost()]);

      const box = screen.getAllByRole("textbox", { name: "Write a post" })[0];
      if (!box) throw new Error("The composer is missing.");
      fireEvent.change(box, { target: { value: "One too many" } });
      fireEvent.click(within(screen.getByRole("form", { name: "New post" })).getByRole("button", { name: "Post" }));

      expect(await screen.findByText("You're posting fast.")).toBeTruthy();
      expect(box).toHaveProperty("value", "One too many");
    });
  });

  describe("an empty feed", () => {
    it("invites a member to post first", () => {
      renderFeed(MEMBER, []);

      expect(screen.getByRole("heading", { name: "Be the first to post" })).toBeTruthy();
    });

    it("nudges an admin to post a welcome", () => {
      renderFeed(ADMIN, []);

      expect(screen.getByRole("heading", { name: "Post a welcome" })).toBeTruthy();
    });
  });

  describe("deleting", () => {
    function openDelete() {
      const ownMenu = screen.queryByRole("button", { name: /Actions for your/ });
      fireEvent.pointerDown(ownMenu ?? screen.getByRole("button", { name: /Actions for/ }), { button: 0, ctrlKey: false });
      fireEvent.click(screen.getByRole("menuitem", { name: "Delete" }));
    }

    it("keeps the thread open, with focus in the reply field, after the only reply goes", async () => {
      stubApi({ [API_ROUTES.feedCommentDelete]: () => ({ json: { message: "Reply deleted." } }) });
      const reply = {
        id: "33333333-3333-4333-8333-333333333333",
        postId: POST_ID,
        body: "Only reply",
        createdAt: TIMESTAMP,
        editedAt: null,
        author: { ...makePost().author, id: MEMBER.id, name: MEMBER.name },
      };
      renderFeed(MEMBER, [makePost({ commentCount: 1, inlineComments: [reply] })]);

      openDelete();
      fireEvent.click(screen.getByRole("button", { name: "Delete" }));

      await waitFor(() => expect(screen.queryByText("Only reply")).toBeNull());
      expect(document.activeElement).toBe(screen.getByRole("textbox", { name: "Reply to Jonas" }));
    });

    it("tells a member their post is gone for good", () => {
      renderFeed(MEMBER, [makePost({ author: { ...makePost().author, id: MEMBER.id, name: MEMBER.name } })]);

      openDelete();

      expect(screen.getByText(/It's gone for good/)).toBeTruthy();
    });

    it("tells an admin a private record stays, even for their own post", () => {
      renderFeed(ADMIN, [makePost({ author: { ...makePost().author, id: ADMIN.id, name: ADMIN.name } })]);

      openDelete();

      expect(screen.getByText(/private record/)).toBeTruthy();
      expect(screen.queryByText(/gone for good/)).toBeNull();
    });
  });
});
