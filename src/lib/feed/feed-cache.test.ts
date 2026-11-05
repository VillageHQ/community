import { describe, expect, it } from "vitest";

import { POST_TYPES, REACTIONS, type Comment, type FeedPage, type Post } from "./feed-api";
import {
  addComment,
  changeReaction,
  hasWholeThread,
  keepFirstPage,
  prependPost,
  readPinnedPosts,
  readTimelinePosts,
  removeComment,
  removePost,
  replaceComment,
  updatePost,
} from "./feed-cache";

const TIMESTAMP = "2026-01-01T00:00:00.000Z";
const AUTHOR = { id: "author", name: "Noor", title: null, company: null, avatarUrl: null, isBanned: false };

function makePost(id: string, overrides: Partial<Post> = {}): Post {
  return {
    id,
    type: POST_TYPES.plain,
    body: id,
    createdAt: TIMESTAMP,
    editedAt: null,
    author: AUTHOR,
    pin: null,
    reactions: [],
    commentCount: 0,
    inlineComments: [],
    ...overrides,
  };
}

function makeComment(id: string, body = id): Comment {
  return { id, postId: "first", body, createdAt: TIMESTAMP, editedAt: null, author: AUTHOR };
}

function makePage(overrides: Partial<FeedPage> = {}): FeedPage {
  return { pinnedPosts: [], posts: [], nextCursor: null, newestPostAt: null, ...overrides };
}

describe("reaction changes", () => {
  it("adds the viewer's reaction to an empty post", () => {
    expect(changeReaction([], REACTIONS.heart, true)).toEqual([{ reaction: REACTIONS.heart, count: 1, isMine: true }]);
  });

  it("adds to an existing count", () => {
    const reactions = [{ reaction: REACTIONS.heart, count: 4, isMine: false }];

    expect(changeReaction(reactions, REACTIONS.heart, true)).toEqual([{ reaction: REACTIONS.heart, count: 5, isMine: true }]);
  });

  it("takes the viewer's reaction away", () => {
    const reactions = [{ reaction: REACTIONS.heart, count: 5, isMine: true }];

    expect(changeReaction(reactions, REACTIONS.heart, false)).toEqual([{ reaction: REACTIONS.heart, count: 4, isMine: false }]);
  });

  it("drops a reaction nobody holds any more", () => {
    const reactions = [{ reaction: REACTIONS.heart, count: 1, isMine: true }];

    expect(changeReaction(reactions, REACTIONS.heart, false)).toEqual([]);
  });

  it("can't double count a reaction the viewer already holds", () => {
    const reactions = [{ reaction: REACTIONS.heart, count: 5, isMine: true }];

    expect(changeReaction(reactions, REACTIONS.heart, true)).toEqual(reactions);
  });

  it("rolls back exactly by applying the opposite change", () => {
    const reactions = [
      { reaction: REACTIONS.heart, count: 5, isMine: false },
      { reaction: REACTIONS.idea, count: 1, isMine: true },
    ];

    const optimistic = changeReaction(reactions, REACTIONS.heart, true);
    const rolledBack = changeReaction(optimistic, REACTIONS.heart, false);

    expect(rolledBack).toHaveLength(2);
    expect(rolledBack).toEqual(expect.arrayContaining(reactions));
  });

  it("rolls back a first reaction to nothing", () => {
    const optimistic = changeReaction([], REACTIONS.rocket, true);

    expect(changeReaction(optimistic, REACTIONS.rocket, false)).toEqual([]);
  });
});

describe("the timeline cache", () => {
  const timeline = {
    pages: [
      makePage({ pinnedPosts: [makePost("pinned")], posts: [makePost("first")] }),
      makePage({ posts: [makePost("second")] }),
    ],
    pageParams: [null, { createdAt: TIMESTAMP, id: "first" }],
  };

  it("puts a new post at the top, under the pins", () => {
    const updated = prependPost(timeline, makePost("new"));

    expect(readTimelinePosts(updated).map(({ id }) => id)).toEqual(["new", "first", "second"]);
    expect(readPinnedPosts(updated).map(({ id }) => id)).toEqual(["pinned"]);
  });

  it("updates a post on any page", () => {
    const updated = updatePost(timeline, "second", (post) => ({ ...post, body: "changed" }));

    expect(readTimelinePosts(updated)[1]?.body).toBe("changed");
  });

  it("updates a pinned post", () => {
    const updated = updatePost(timeline, "pinned", (post) => ({ ...post, body: "changed" }));

    expect(readPinnedPosts(updated)[0]?.body).toBe("changed");
  });

  it("removes a post from any page", () => {
    expect(readTimelinePosts(removePost(timeline, "second")).map(({ id }) => id)).toEqual(["first"]);
    expect(readPinnedPosts(removePost(timeline, "pinned"))).toEqual([]);
  });

  it("drops later pages when going back to the top", () => {
    const updated = keepFirstPage(timeline);

    expect(updated.pages).toHaveLength(1);
    expect(updated.pageParams).toEqual([null]);
  });

  it("shows a post only once if it was pinned after being paged in", () => {
    const stale = {
      pages: [makePage({ pinnedPosts: [makePost("both")] }), makePage({ posts: [makePost("both"), makePost("other")] })],
      pageParams: [null, null],
    };

    expect(readTimelinePosts(stale).map(({ id }) => id)).toEqual(["other"]);
  });

  it("shows a post only once if it appears on two pages", () => {
    const stale = {
      pages: [makePage({ posts: [makePost("both")] }), makePage({ posts: [makePost("both")] })],
      pageParams: [null, null],
    };

    expect(readTimelinePosts(stale).map(({ id }) => id)).toEqual(["both"]);
  });
});

describe("comments in the cache", () => {
  it("appends to a thread the post already holds whole", () => {
    const post = makePost("first", { commentCount: 1, inlineComments: [makeComment("a")] });

    const updated = addComment(post, makeComment("b"));

    expect(updated.commentCount).toBe(2);
    expect(updated.inlineComments.map(({ id }) => id)).toEqual(["a", "b"]);
    expect(hasWholeThread(updated)).toBe(true);
  });

  it("only counts a reply on a thread that loads on demand", () => {
    const post = makePost("first", { commentCount: 3, inlineComments: [] });

    const updated = addComment(post, makeComment("d"));

    expect(updated.commentCount).toBe(4);
    expect(updated.inlineComments).toEqual([]);
    expect(hasWholeThread(updated)).toBe(false);
  });

  it("replaces an edited reply", () => {
    const post = makePost("first", { commentCount: 1, inlineComments: [makeComment("a", "old")] });

    expect(replaceComment(post, makeComment("a", "new")).inlineComments[0]?.body).toBe("new");
  });

  it("removes a reply and its count", () => {
    const post = makePost("first", { commentCount: 1, inlineComments: [makeComment("a")] });

    expect(removeComment(post, "a")).toMatchObject({ commentCount: 0, inlineComments: [] });
  });

  it("never counts below zero", () => {
    expect(removeComment(makePost("first"), "a").commentCount).toBe(0);
  });
});
