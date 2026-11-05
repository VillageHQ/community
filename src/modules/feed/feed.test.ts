import { eq, isNotNull, like } from "drizzle-orm";
import { beforeAll, beforeEach, describe, expect, it } from "vitest";

import { rateLimit, session, user } from "@/platform/database/auth-schema";
import { comment, moderationRecord, post, reaction } from "@/modules/feed/schema";
import {
  commentPageSchema,
  commentSchema,
  FEED_ERROR_CODES,
  FEED_LIMITS,
  feedPageSchema,
  MODERATION_TARGETS,
  newPostCountSchema,
  POST_TYPES,
  postSchema,
  REACTIONS,
  reactionsResponseSchema,
} from "@/modules/feed/contract";
import { MAXIMUM_PER_MINUTE, POSTING_KINDS } from "@/modules/feed/limits";
import { clearDatabase, createTestDatabase } from "@/test/database";
import { seedComment, seedPost } from "@/test/feed";
import { seedMember } from "@/test/members";
import { createSignedInMember } from "@/test/signed-in-member";

import { POST as postCommentDelete } from "@/app/api/feed/comments/delete/route";
import { POST as postCommentEdit } from "@/app/api/feed/comments/edit/route";
import { POST as postCommentList } from "@/app/api/feed/comments/list/route";
import { POST as postCommentCreate } from "@/app/api/feed/comments/route";
import { POST as postNewCount } from "@/app/api/feed/new-count/route";
import { POST as postPostDelete } from "@/app/api/feed/posts/delete/route";
import { POST as postPostEdit } from "@/app/api/feed/posts/edit/route";
import { POST as postPostPin } from "@/app/api/feed/posts/pin/route";
import { POST as postPostReaction } from "@/app/api/feed/posts/reaction/route";
import { POST as postPostCreate } from "@/app/api/feed/posts/route";
import { POST as postFeedPage } from "@/app/api/feed/route";

const APP_URL = "http://localhost:3000";
const OK_STATUS = 200;
const UNAUTHORIZED_STATUS = 401;
const FORBIDDEN_STATUS = 403;
const NOT_FOUND_STATUS = 404;
const CONFLICT_STATUS = 409;
const PAYLOAD_TOO_LARGE_STATUS = 413;
const UNPROCESSABLE_STATUS = 422;
const TOO_MANY_REQUESTS_STATUS = 429;
const DAY_MS = 24 * 60 * 60 * 1000;
const XSS_STRING = `<img src=x onerror=alert(1)><script>alert("x")</script>`;
const UNKNOWN_ID = "00000000-0000-4000-8000-000000000000";
const TEST_MEMBER_NAME = "Test Member";

type Member = Awaited<ReturnType<typeof createSignedInMember>>;
type Handler = (request: Request) => Promise<Response>;

function call(handler: Handler, member: Member | null, body: unknown, origin = APP_URL) {
  return handler(
    new Request(`${APP_URL}/api/feed`, {
      method: "POST",
      headers: { "Content-Type": "application/json", Origin: origin, ...(member ? { Cookie: member.cookie } : {}) },
      body: JSON.stringify(body),
    }),
  );
}

describe("the feed", () => {
  const database = createTestDatabase();
  let author: Member;
  let other: Member;
  let admin: Member;

  async function readPage(member: Member, cursor: unknown = null) {
    return feedPageSchema.parse(await (await call(postFeedPage, member, { cursor })).json());
  }

  async function createPost(member: Member, body = "Hello, room", type: string = POST_TYPES.plain) {
    return postSchema.parse(await (await call(postPostCreate, member, { body, type })).json());
  }

  async function readPostRow(postId: string) {
    const [row] = await database.select().from(post).where(eq(post.id, postId));
    return row;
  }

  async function readReactions(member: Member, postId: string, reactionName: string = REACTIONS.heart) {
    const response = await call(postPostReaction, member, { postId, reaction: reactionName, isActive: true });
    return reactionsResponseSchema.parse(await response.json()).reactions;
  }

  beforeAll(async () => {
    await clearDatabase(database);
    author = await createSignedInMember(database);
    other = await createSignedInMember(database);
    admin = await createSignedInMember(database, "admin");
  });

  beforeEach(async () => {
    await database.delete(post);
    await database.delete(moderationRecord);
    await database.delete(rateLimit);
    await database.update(user).set({ name: TEST_MEMBER_NAME, emailVerified: true });
  });

  describe("access", () => {
    const ROUTES: [string, Handler, () => unknown][] = [
      ["reading the feed", postFeedPage, () => ({})],
      ["checking for new posts", postNewCount, () => ({ since: null })],
      ["creating a post", postPostCreate, () => ({ body: "Hi" })],
      ["editing a post", postPostEdit, () => ({ postId: UNKNOWN_ID, type: POST_TYPES.ask, body: "Hi" })],
      ["deleting a post", postPostDelete, () => ({ postId: UNKNOWN_ID })],
      ["pinning a post", postPostPin, () => ({ postId: UNKNOWN_ID, isPinned: true })],
      ["reacting", postPostReaction, () => ({ postId: UNKNOWN_ID, reaction: REACTIONS.heart, isActive: true })],
      ["reading replies", postCommentList, () => ({ postId: UNKNOWN_ID })],
      ["replying", postCommentCreate, () => ({ postId: UNKNOWN_ID, body: "Hi" })],
      ["editing a reply", postCommentEdit, () => ({ commentId: UNKNOWN_ID, body: "Hi" })],
      ["deleting a reply", postCommentDelete, () => ({ commentId: UNKNOWN_ID })],
    ];

    it.each(ROUTES)("refuses a visitor %s", async (_name, handler, readBody) => {
      expect((await call(handler, null, readBody())).status).toBe(UNAUTHORIZED_STATUS);
    });

    it.each(ROUTES)("refuses another site's origin %s", async (_name, handler, readBody) => {
      expect((await call(handler, author, readBody(), "https://evil.test")).status).toBe(FORBIDDEN_STATUS);
    });

    it.each(ROUTES)("refuses a banned member %s and ends their sessions", async (_name, handler, readBody) => {
      const banned = await createSignedInMember(database);
      await database.update(user).set({ banned: true }).where(eq(user.id, banned.userId));

      expect((await call(handler, banned, readBody())).status).toBe(UNAUTHORIZED_STATUS);
      expect(await database.select().from(session).where(eq(session.userId, banned.userId))).toEqual([]);
    });

    it("keeps the session of a member whose temporary ban has run out", async () => {
      const returning = await createSignedInMember(database);
      await database
        .update(user)
        .set({ banned: true, banExpires: new Date(Date.now() - DAY_MS) })
        .where(eq(user.id, returning.userId));

      expect((await call(postFeedPage, returning, {})).status).toBe(OK_STATUS);
    });

    it("refuses a member whose temporary ban is still running", async () => {
      const banned = await createSignedInMember(database);
      await database
        .update(user)
        .set({ banned: true, banExpires: new Date(Date.now() + DAY_MS) })
        .where(eq(user.id, banned.userId));

      expect((await call(postFeedPage, banned, {})).status).toBe(UNAUTHORIZED_STATUS);
    });

    it("lets an unverified account read, post, reply and react", async () => {
      await database.update(user).set({ emailVerified: false }).where(eq(user.id, other.userId));

      const created = await call(postPostCreate, other, { body: "Not confirmed yet" });
      const { id: postId } = postSchema.parse(await created.json());

      expect(created.status).toBe(OK_STATUS);
      expect((await call(postFeedPage, other, {})).status).toBe(OK_STATUS);
      expect((await call(postCommentCreate, other, { postId, body: "Me too" })).status).toBe(OK_STATUS);
      expect((await readReactions(other, postId))[0]?.count).toBe(1);
    });

    it("never includes anyone's email", async () => {
      const { id: postId } = await createPost(author);
      await call(postCommentCreate, other, { postId, body: "Reply" });

      const text = await (await call(postFeedPage, admin, {})).text();

      expect(text).not.toContain(author.email);
      expect(text).not.toContain(other.email);
    });
  });

  describe("posts", () => {
    it("publishes a post with its type and author", async () => {
      const created = await createPost(author, "Who knows usage pricing?", POST_TYPES.ask);

      const { posts } = await readPage(other);

      expect(posts.map(({ id }) => id)).toEqual([created.id]);
      expect(posts[0]).toMatchObject({
        type: POST_TYPES.ask,
        body: "Who knows usage pricing?",
        editedAt: null,
        pin: null,
        author: { id: author.userId, name: TEST_MEMBER_NAME },
      });
    });

    it("defaults to a plain post", async () => {
      const response = await call(postPostCreate, author, { body: "Hi" });

      expect(postSchema.parse(await response.json()).type).toBe(POST_TYPES.plain);
    });

    it("attributes a post to the session, not to anything in the body", async () => {
      const response = await call(postPostCreate, author, { body: "Hi", authorId: other.userId });

      expect(postSchema.parse(await response.json()).author.id).toBe(author.userId);
    });

    it("refuses an unknown type", async () => {
      expect((await call(postPostCreate, author, { body: "Hi", type: "event" })).status).toBe(UNPROCESSABLE_STATUS);
    });

    it("strips bidirectional controls on save", async () => {
      const { body } = await createPost(author, "\u202Ehttps://evil.test/\u202Emoc.elgoog");

      expect(body).toBe("https://evil.test/moc.elgoog");
    });

    it("refuses a post of only bidirectional controls", async () => {
      expect((await call(postPostCreate, author, { body: "\u202E\u2066" })).status).toBe(UNPROCESSABLE_STATUS);
    });

    it("stores markup as the text the member typed", async () => {
      const { id } = await createPost(author, XSS_STRING);

      expect((await readPostRow(id))?.body).toBe(XSS_STRING);
    });

    it("strips null bytes and spare blank lines", async () => {
      const { body } = await createPost(author, "One\0\n\n\n\n\nTwo");

      expect(body).toBe("One\n\nTwo");
    });

    describe("length", () => {
      it("accepts a post at the cap", async () => {
        const response = await call(postPostCreate, author, { body: "a".repeat(FEED_LIMITS.postLength) });

        expect(response.status).toBe(OK_STATUS);
      });

      it("refuses a post over the cap", async () => {
        const response = await call(postPostCreate, author, { body: "a".repeat(FEED_LIMITS.postLength + 1) });

        expect(response.status).toBe(UNPROCESSABLE_STATUS);
        expect(await database.select().from(post)).toEqual([]);
      });

      it("refuses a body past the request limit before reading it", async () => {
        const response = await call(postPostCreate, author, { body: "a".repeat(32 * 1024) });

        expect(response.status).toBe(PAYLOAD_TOO_LARGE_STATUS);
      });

      it.each([["spaces", "   \n  "], ["a zero-width space", "​"], ["nothing", ""]])("refuses a post of %s", async (_name, body) => {
        expect((await call(postPostCreate, author, { body })).status).toBe(UNPROCESSABLE_STATUS);
      });

      it("keeps the cap in the database too", async () => {
        const tooLong = "a".repeat(FEED_LIMITS.postLength + 1);

        await expect(seedPost(database, { authorId: author.userId, body: tooLong })).rejects.toThrow();
      });
    });

    describe("editing", () => {
      it("saves the author's change and marks it edited", async () => {
        const { id } = await createPost(author, "First draft");

        const response = await call(postPostEdit, author, { postId: id, body: "Second draft", type: POST_TYPES.win });
        const edited = postSchema.parse(await response.json());

        expect(edited).toMatchObject({ body: "Second draft", type: POST_TYPES.win });
        expect(edited.editedAt).not.toBeNull();
      });

      it("unpins a member's post when they change it", async () => {
        const { id } = await createPost(author, "Approved words");
        await call(postPostPin, admin, { postId: id, isPinned: true });

        const response = await call(postPostEdit, author, { postId: id, body: "Different words", type: POST_TYPES.plain });

        expect(postSchema.parse(await response.json()).pin).toBeNull();
        expect(await readPostRow(id)).toMatchObject({ pinnedAt: null, pinnedByUserId: null });
      });

      it("keeps a member's post pinned when nothing changed", async () => {
        const { id } = await createPost(author, "Approved words");
        await call(postPostPin, admin, { postId: id, isPinned: true });

        await call(postPostEdit, author, { postId: id, body: "Approved words", type: POST_TYPES.plain });

        expect((await readPostRow(id))?.pinnedAt).not.toBeNull();
      });

      it("keeps an admin's own post pinned when they change it", async () => {
        const { id } = await createPost(admin, "First words");
        await call(postPostPin, admin, { postId: id, isPinned: true });

        const response = await call(postPostEdit, admin, { postId: id, body: "Better words", type: POST_TYPES.plain });

        expect(postSchema.parse(await response.json()).pin).not.toBeNull();
      });

      it("adds no edited marker when nothing changed", async () => {
        const { id } = await createPost(author, "Same", POST_TYPES.ask);

        const response = await call(postPostEdit, author, { postId: id, body: "Same", type: POST_TYPES.ask });

        expect(postSchema.parse(await response.json()).editedAt).toBeNull();
      });

      it("refuses someone else's post and changes nothing", async () => {
        const { id } = await createPost(author, "Mine");

        const response = await call(postPostEdit, other, { postId: id, body: "Hijacked", type: POST_TYPES.plain });

        expect(response.status).toBe(FORBIDDEN_STATUS);
        expect((await response.json()).code).toBe(FEED_ERROR_CODES.notYours);
        expect((await readPostRow(id))?.body).toBe("Mine");
      });

      it("refuses an admin editing someone else's post", async () => {
        const { id } = await createPost(author, "Mine");

        const response = await call(postPostEdit, admin, { postId: id, body: "Admin words", type: POST_TYPES.plain });

        expect(response.status).toBe(FORBIDDEN_STATUS);
        expect((await readPostRow(id))?.body).toBe("Mine");
      });

      it("enforces the cap", async () => {
        const { id } = await createPost(author, "Short");
        const body = "a".repeat(FEED_LIMITS.postLength + 1);

        expect((await call(postPostEdit, author, { postId: id, body, type: POST_TYPES.plain })).status).toBe(UNPROCESSABLE_STATUS);
      });

      it("answers 404 for a post that doesn't exist", async () => {
        const response = await call(postPostEdit, author, { postId: UNKNOWN_ID, body: "Hi", type: POST_TYPES.plain });

        expect(response.status).toBe(NOT_FOUND_STATUS);
      });

      it("answers 422 for an id that isn't one", async () => {
        const response = await call(postPostEdit, author, { postId: "1 or 1=1", body: "Hi", type: POST_TYPES.plain });

        expect(response.status).toBe(UNPROCESSABLE_STATUS);
      });
    });

    describe("deleting", () => {
      it("removes the author's own post and leaves no moderation record", async () => {
        const { id } = await createPost(author);

        expect((await call(postPostDelete, author, { postId: id })).status).toBe(OK_STATUS);
        expect(await readPostRow(id)).toBeUndefined();
        expect(await database.select().from(moderationRecord)).toEqual([]);
      });

      it("refuses someone else's post and keeps it", async () => {
        const { id } = await createPost(author);

        expect((await call(postPostDelete, other, { postId: id })).status).toBe(FORBIDDEN_STATUS);
        expect(await readPostRow(id)).toBeDefined();
      });

      it("removes the post's replies and reactions with it", async () => {
        const { id } = await createPost(author);
        await call(postCommentCreate, other, { postId: id, body: "Reply" });
        await readReactions(other, id);

        await call(postPostDelete, author, { postId: id });

        expect(await database.select().from(comment)).toEqual([]);
        expect(await database.select().from(reaction)).toEqual([]);
      });

      it("answers 404 the second time", async () => {
        const { id } = await createPost(author);
        await call(postPostDelete, author, { postId: id });

        expect((await call(postPostDelete, author, { postId: id })).status).toBe(NOT_FOUND_STATUS);
      });
    });
  });

  describe("moderation", () => {
    it("lets an admin delete any post and records who deleted what and when", async () => {
      await database.update(user).set({ name: "Priya Raman" }).where(eq(user.id, admin.userId));
      const before = Date.now();
      const { id } = await createPost(author, "Against the rules");
      await call(postCommentCreate, other, { postId: id, body: "Reply" });

      expect((await call(postPostDelete, admin, { postId: id })).status).toBe(OK_STATUS);

      const [record] = await database
        .select()
        .from(moderationRecord)
        .where(eq(moderationRecord.targetType, MODERATION_TARGETS.post));
      expect(await readPostRow(id)).toBeUndefined();
      expect(record).toMatchObject({
        targetType: MODERATION_TARGETS.post,
        targetId: id,
        targetAuthorId: author.userId,
        targetAuthorName: TEST_MEMBER_NAME,
        targetBody: "Against the rules",
        removedReplyCount: 1,
        deletedByUserId: admin.userId,
        deletedByName: "Priya Raman",
      });
      expect(record?.deletedAt.getTime()).toBeGreaterThanOrEqual(before - 1000);
    });

    it("keeps the text and author of each reply a post delete removes", async () => {
      const { id } = await createPost(author, "Against the rules");
      await call(postCommentCreate, other, { postId: id, body: "First reply" });
      await call(postCommentCreate, author, { postId: id, body: "Second reply" });

      await call(postPostDelete, admin, { postId: id });

      const records = await database
        .select()
        .from(moderationRecord)
        .where(eq(moderationRecord.targetType, MODERATION_TARGETS.comment));
      expect(records.map(({ targetBody }) => targetBody).toSorted()).toEqual(["First reply", "Second reply"]);
      expect(records.map(({ targetAuthorId }) => targetAuthorId).toSorted()).toEqual([author.userId, other.userId].toSorted());
      expect(records.every(({ parentPostId, deletedByUserId }) => parentPostId === id && deletedByUserId === admin.userId)).toBe(true);
    });

    it("lets an admin delete any reply and records it", async () => {
      const { id: postId } = await createPost(author);
      const commentId = await seedComment(database, { postId, authorId: other.userId, body: "Rude" });

      expect((await call(postCommentDelete, admin, { commentId })).status).toBe(OK_STATUS);

      const [record] = await database.select().from(moderationRecord);
      expect(record).toMatchObject({
        targetType: MODERATION_TARGETS.comment,
        targetId: commentId,
        targetAuthorId: other.userId,
        targetBody: "Rude",
        parentPostId: postId,
        deletedByUserId: admin.userId,
      });
    });

    it("records an admin deleting their own post too", async () => {
      const { id } = await createPost(admin);

      await call(postPostDelete, admin, { postId: id });

      expect(await database.select().from(moderationRecord)).toHaveLength(1);
    });

    it("keeps the record after the people involved are gone", async () => {
      const leavingAdmin = await createSignedInMember(database, "admin");
      const leavingAuthor = await createSignedInMember(database);
      const { id } = await createPost(leavingAuthor, "Against the rules");
      await call(postPostDelete, leavingAdmin, { postId: id });

      await database.delete(user).where(eq(user.id, leavingAdmin.userId));
      await database.delete(user).where(eq(user.id, leavingAuthor.userId));

      const [record] = await database.select().from(moderationRecord);
      expect(record).toMatchObject({ targetAuthorId: null, deletedByUserId: null, targetAuthorName: TEST_MEMBER_NAME });
    });

    it("writes one record when two admins delete at once", async () => {
      const secondAdmin = await createSignedInMember(database, "admin");
      const { id } = await createPost(author);

      const statuses = await Promise.all([
        call(postPostDelete, admin, { postId: id }),
        call(postPostDelete, secondAdmin, { postId: id }),
      ]);

      expect(statuses.map(({ status }) => status).toSorted()).toEqual([OK_STATUS, NOT_FOUND_STATUS]);
      expect(await database.select().from(moderationRecord)).toHaveLength(1);
    });
  });

  describe("replies", () => {
    it("adds a reply under a post", async () => {
      const { id: postId } = await createPost(author);

      const response = await call(postCommentCreate, other, { postId, body: "Happy to help" });

      expect(commentSchema.parse(await response.json())).toMatchObject({
        postId,
        body: "Happy to help",
        editedAt: null,
        author: { id: other.userId },
      });
      expect((await readPage(author)).posts[0]?.commentCount).toBe(1);
    });

    it("strips bidirectional controls on save", async () => {
      const { id: postId } = await createPost(author);

      const response = await call(postCommentCreate, other, { postId, body: "\u202Ereply" });

      expect(commentSchema.parse(await response.json()).body).toBe("reply");
    });

    it("stores markup as text", async () => {
      const { id: postId } = await createPost(author);

      const response = await call(postCommentCreate, other, { postId, body: XSS_STRING });

      expect(commentSchema.parse(await response.json()).body).toBe(XSS_STRING);
    });

    it("refuses a reply over the cap", async () => {
      const { id: postId } = await createPost(author);
      const body = "a".repeat(FEED_LIMITS.commentLength + 1);

      expect((await call(postCommentCreate, other, { postId, body })).status).toBe(UNPROCESSABLE_STATUS);
    });

    it("answers 404 for a post that doesn't exist", async () => {
      expect((await call(postCommentCreate, other, { postId: UNKNOWN_ID, body: "Hi" })).status).toBe(NOT_FOUND_STATUS);
    });

    it("sends short threads inline and leaves long ones to load on demand", async () => {
      const { id: shortId } = await createPost(author, "Short thread");
      const { id: longId } = await createPost(author, "Long thread");
      await seedComment(database, { postId: shortId, authorId: other.userId });
      for (let position = 0; position <= FEED_LIMITS.inlineComments; position += 1) {
        await seedComment(database, { postId: longId, authorId: other.userId });
      }

      const { posts } = await readPage(author);
      const short = posts.find(({ id }) => id === shortId);
      const long = posts.find(({ id }) => id === longId);

      expect(short).toMatchObject({ commentCount: 1 });
      expect(short?.inlineComments).toHaveLength(1);
      expect(long).toMatchObject({ commentCount: FEED_LIMITS.inlineComments + 1, inlineComments: [] });
    });

    it("pages through a long thread oldest first, with no gaps or repeats", async () => {
      const { id: postId } = await createPost(author);
      const sameMoment = new Date("2026-01-01T00:00:00.000Z");
      const total = FEED_LIMITS.commentsPerPage * 2 + 3;
      const seededIds = new Set<string>();
      for (let position = 0; position < total; position += 1) {
        seededIds.add(await seedComment(database, { postId, authorId: other.userId, createdAt: sameMoment }));
      }

      const seenIds: string[] = [];
      let cursor: unknown = null;
      let pageCount = 0;
      do {
        const response = await call(postCommentList, author, { postId, cursor });
        const page = commentPageSchema.parse(await response.json());
        seenIds.push(...page.comments.map(({ id }) => id));
        cursor = page.nextCursor;
        pageCount += 1;
      } while (cursor);

      expect(pageCount).toBe(3);
      expect(seenIds).toHaveLength(total);
      expect(new Set(seenIds)).toEqual(seededIds);
    });

    describe("editing", () => {
      it("saves the author's change and marks it edited", async () => {
        const { id: postId } = await createPost(author);
        const commentId = await seedComment(database, { postId, authorId: other.userId, body: "Old" });

        const response = await call(postCommentEdit, other, { commentId, body: "New" });
        const edited = commentSchema.parse(await response.json());

        expect(edited.body).toBe("New");
        expect(edited.editedAt).not.toBeNull();
      });

      it("adds no edited marker when nothing changed", async () => {
        const { id: postId } = await createPost(author);
        const commentId = await seedComment(database, { postId, authorId: other.userId, body: "Same" });

        const response = await call(postCommentEdit, other, { commentId, body: "Same" });

        expect(commentSchema.parse(await response.json()).editedAt).toBeNull();
      });

      it("refuses the post's author, who didn't write the reply", async () => {
        const { id: postId } = await createPost(author);
        const commentId = await seedComment(database, { postId, authorId: other.userId, body: "Mine" });

        expect((await call(postCommentEdit, author, { commentId, body: "Hijacked" })).status).toBe(FORBIDDEN_STATUS);
      });

      it("refuses an admin", async () => {
        const { id: postId } = await createPost(author);
        const commentId = await seedComment(database, { postId, authorId: other.userId, body: "Mine" });

        expect((await call(postCommentEdit, admin, { commentId, body: "Admin words" })).status).toBe(FORBIDDEN_STATUS);
      });
    });

    describe("deleting", () => {
      it("removes the author's own reply and leaves no record", async () => {
        const { id: postId } = await createPost(author);
        const commentId = await seedComment(database, { postId, authorId: other.userId });

        expect((await call(postCommentDelete, other, { commentId })).status).toBe(OK_STATUS);
        expect(await database.select().from(comment)).toEqual([]);
        expect(await database.select().from(moderationRecord)).toEqual([]);
      });

      it("refuses the post's author, who didn't write the reply", async () => {
        const { id: postId } = await createPost(author);
        const commentId = await seedComment(database, { postId, authorId: other.userId });

        expect((await call(postCommentDelete, author, { commentId })).status).toBe(FORBIDDEN_STATUS);
        expect(await database.select().from(comment)).toHaveLength(1);
      });
    });
  });

  describe("reactions", () => {
    it("adds a reaction and reports it as the viewer's", async () => {
      const { id } = await createPost(author);

      expect(await readReactions(other, id)).toEqual([{ reaction: REACTIONS.heart, count: 1, isMine: true }]);
    });

    it("removes a reaction", async () => {
      const { id: postId } = await createPost(author);
      await readReactions(other, postId);

      const response = await call(postPostReaction, other, { postId, reaction: REACTIONS.heart, isActive: false });

      expect(reactionsResponseSchema.parse(await response.json()).reactions).toEqual([]);
    });

    it("counts one per member however many times they send it", async () => {
      const { id } = await createPost(author);

      await readReactions(other, id);
      const reactions = await readReactions(other, id);

      expect(reactions[0]?.count).toBe(1);
    });

    it("counts one when the same member's requests land at once", async () => {
      const { id: postId } = await createPost(author);
      const body = { postId, reaction: REACTIONS.rocket, isActive: true };

      const responses = await Promise.all(Array.from({ length: 12 }, () => call(postPostReaction, other, body)));

      expect(responses.every(({ status }) => status === OK_STATUS)).toBe(true);
      expect(await database.select().from(reaction)).toHaveLength(1);
    });

    it("counts every member when different members react at once", async () => {
      const { id: postId } = await createPost(author);
      const body = { postId, reaction: REACTIONS.heart, isActive: true };

      await Promise.all([author, other, admin].map((member) => call(postPostReaction, member, body)));

      const { posts } = await readPage(author);
      expect(posts[0]?.reactions).toEqual([{ reaction: REACTIONS.heart, count: 3, isMine: true }]);
    });

    it("keeps different reactions apart", async () => {
      const { id } = await createPost(author);

      await readReactions(other, id, REACTIONS.heart);
      const reactions = await readReactions(other, id, REACTIONS.idea);

      expect(reactions.map(({ reaction: kind }) => kind).toSorted()).toEqual([REACTIONS.heart, REACTIONS.idea].toSorted());
    });

    it("reports isMine per viewer", async () => {
      const { id } = await createPost(author);
      await readReactions(other, id);

      const { posts } = await readPage(author);

      expect(posts[0]?.reactions[0]).toMatchObject({ count: 1, isMine: false });
    });

    it("refuses a reaction outside the fixed set", async () => {
      const { id: postId } = await createPost(author);
      const response = await call(postPostReaction, other, { postId, reaction: "angry", isActive: true });

      expect(response.status).toBe(UNPROCESSABLE_STATUS);
    });

    it("answers 404 for a post that doesn't exist", async () => {
      const response = await call(postPostReaction, other, { postId: UNKNOWN_ID, reaction: REACTIONS.heart, isActive: true });

      expect(response.status).toBe(NOT_FOUND_STATUS);
    });

    it("has a unique constraint behind it", async () => {
      const { id: postId } = await createPost(author);
      const row = { postId, userId: other.userId, reaction: REACTIONS.heart };
      await database.insert(reaction).values(row);

      await expect(database.insert(reaction).values(row)).rejects.toThrow();
    });
  });

  describe("pinning", () => {
    it("refuses a member and changes nothing", async () => {
      const { id } = await createPost(author);

      const response = await call(postPostPin, author, { postId: id, isPinned: true });

      expect(response.status).toBe(FORBIDDEN_STATUS);
      expect((await readPostRow(id))?.pinnedAt).toBeNull();
    });

    it("refuses a member unpinning", async () => {
      const { id } = await createPost(author);
      await call(postPostPin, admin, { postId: id, isPinned: true });

      expect((await call(postPostPin, other, { postId: id, isPinned: false })).status).toBe(FORBIDDEN_STATUS);
      expect((await readPostRow(id))?.pinnedAt).not.toBeNull();
    });

    it("shows a pinned post first and names who pinned it", async () => {
      await database.update(user).set({ name: "Priya Raman" }).where(eq(user.id, admin.userId));
      const { id: olderId } = await createPost(author, "Older");
      const { id: newerId } = await createPost(author, "Newer");

      expect((await call(postPostPin, admin, { postId: olderId, isPinned: true })).status).toBe(OK_STATUS);

      const { pinnedPosts, posts } = await readPage(other);
      expect(pinnedPosts.map(({ id }) => id)).toEqual([olderId]);
      expect(pinnedPosts[0]?.pin?.pinnedByName).toBe("Priya Raman");
      expect(posts.map(({ id }) => id)).toEqual([newerId]);
    });

    it("returns an unpinned post to its place in time", async () => {
      const { id: olderId } = await createPost(author, "Older");
      const { id: newerId } = await createPost(author, "Newer");
      await call(postPostPin, admin, { postId: olderId, isPinned: true });

      await call(postPostPin, admin, { postId: olderId, isPinned: false });

      const { pinnedPosts, posts } = await readPage(other);
      expect(pinnedPosts).toEqual([]);
      expect(posts.map(({ id }) => id)).toEqual([newerId, olderId]);
    });

    it("keeps the first admin's name when a post is pinned twice", async () => {
      await database.update(user).set({ name: "First Admin" }).where(eq(user.id, admin.userId));
      const secondAdmin = await createSignedInMember(database, "admin");
      const { id } = await createPost(author);

      await call(postPostPin, admin, { postId: id, isPinned: true });
      await call(postPostPin, secondAdmin, { postId: id, isPinned: true });

      expect((await readPage(other)).pinnedPosts[0]?.pin?.pinnedByName).toBe("First Admin");
    });

    it("refuses a pin past the limit with a clear reason", async () => {
      for (let position = 0; position < FEED_LIMITS.pinnedPosts; position += 1) {
        const pinned = await createPost(author, `Pinned ${position}`);
        await call(postPostPin, admin, { postId: pinned.id, isPinned: true });
      }
      const { id } = await createPost(author, "One too many");

      const response = await call(postPostPin, admin, { postId: id, isPinned: true });

      expect(response.status).toBe(CONFLICT_STATUS);
      expect((await response.json()).code).toBe(FEED_ERROR_CODES.pinLimit);
    });

    it("answers 404 for a post that doesn't exist", async () => {
      expect((await call(postPostPin, admin, { postId: UNKNOWN_ID, isPinned: true })).status).toBe(NOT_FOUND_STATUS);
    });

    it("holds the limit when ten pins land at once", async () => {
      const postIds = await Promise.all(
        Array.from({ length: 10 }, () => seedPost(database, { authorId: author.userId })),
      );

      const responses = await Promise.all(postIds.map((postId) => call(postPostPin, admin, { postId, isPinned: true })));

      const pinned = await database.select().from(post).where(isNotNull(post.pinnedAt));
      expect(pinned).toHaveLength(FEED_LIMITS.pinnedPosts);
      expect(responses.filter(({ status }) => status === OK_STATUS)).toHaveLength(FEED_LIMITS.pinnedPosts);
    });

    it("counts pins on banned members' posts toward the limit", async () => {
      const bannedId = await seedMember(database, { name: "Banned Ben", banned: true });
      for (let position = 0; position < FEED_LIMITS.pinnedPosts; position += 1) {
        await seedPost(database, { authorId: bannedId, pinnedAt: new Date(), pinnedByUserId: admin.userId });
      }
      const { id } = await createPost(author, "One too many");

      expect((await call(postPostPin, admin, { postId: id, isPinned: true })).status).toBe(CONFLICT_STATUS);
    });

    it("lets an admin unpin a banned member's post, and refuses a new pin on one", async () => {
      const bannedId = await seedMember(database, { name: "Banned Ben", banned: true });
      const pinnedId = await seedPost(database, { authorId: bannedId, pinnedAt: new Date(), pinnedByUserId: admin.userId });
      const unpinnedId = await seedPost(database, { authorId: bannedId });

      expect((await call(postPostPin, admin, { postId: pinnedId, isPinned: false })).status).toBe(OK_STATUS);
      const refused = await call(postPostPin, admin, { postId: unpinnedId, isPinned: true });
      expect(refused.status).toBe(CONFLICT_STATUS);
      expect((await refused.json()).code).toBe(FEED_ERROR_CODES.authorBanned);
    });
  });

  describe("pagination", () => {
    it("walks every post newest first, with no gaps or repeats, even within one millisecond", async () => {
      const sameMoment = new Date("2026-01-01T00:00:00.000Z");
      const total = FEED_LIMITS.postsPerPage * 3 + 2;
      const seededIds = new Set<string>();
      for (let position = 0; position < total; position += 1) {
        seededIds.add(await seedPost(database, { authorId: author.userId, createdAt: sameMoment }));
      }

      const seenIds: string[] = [];
      let cursor: unknown = null;
      let pageCount = 0;
      do {
        const page = await readPage(other, cursor);
        seenIds.push(...page.posts.map(({ id }) => id));
        cursor = page.nextCursor;
        pageCount += 1;
      } while (cursor);

      expect(pageCount).toBe(4);
      expect(seenIds).toHaveLength(total);
      expect(new Set(seenIds)).toEqual(seededIds);
    });

    it("isn't thrown off by a post that arrives between pages", async () => {
      for (let position = 0; position < FEED_LIMITS.postsPerPage + 2; position += 1) {
        await seedPost(database, {
          authorId: author.userId,
          body: `Post ${position}`,
          createdAt: new Date(Date.UTC(2026, 0, 1, 0, position)),
        });
      }
      const firstPage = await readPage(other);
      await createPost(author, "Arrived in between");

      const secondPage = await readPage(other, firstPage.nextCursor);

      const firstIds = new Set(firstPage.posts.map(({ id }) => id));
      expect(secondPage.posts).toHaveLength(2);
      expect(secondPage.posts.some(({ id }) => firstIds.has(id))).toBe(false);
      expect(secondPage.posts.map(({ body }) => body)).toEqual(["Post 1", "Post 0"]);
    });

    it("sends pinned posts on the first page only", async () => {
      const { id } = await createPost(author, "Pinned");
      await call(postPostPin, admin, { postId: id, isPinned: true });
      for (let position = 0; position < FEED_LIMITS.postsPerPage + 1; position += 1) {
        await seedPost(database, { authorId: author.userId });
      }

      const firstPage = await readPage(other);
      const secondPage = await readPage(other, firstPage.nextCursor);

      expect(firstPage.pinnedPosts).toHaveLength(1);
      expect(secondPage.pinnedPosts).toEqual([]);
    });

    it("answers 422 for a cursor that isn't one", async () => {
      const response = await call(postFeedPage, other, { cursor: { createdAt: "yesterday", id: "1" } });

      expect(response.status).toBe(UNPROCESSABLE_STATUS);
    });
  });

  describe("the new posts check", () => {
    async function readNewCount(member: Member, since: string | null) {
      return newPostCountSchema.parse(await (await call(postNewCount, member, { since })).json()).newPostCount;
    }

    it("counts posts from others after the given time", async () => {
      const seenAt = new Date("2026-01-01T00:00:00.000Z");
      await seedPost(database, { authorId: author.userId, createdAt: seenAt });
      await seedPost(database, { authorId: author.userId, createdAt: new Date(seenAt.getTime() + 1) });

      expect(await readNewCount(other, seenAt.toISOString())).toBe(1);
    });

    it("skips the viewer's own posts", async () => {
      const seenAt = new Date("2026-01-01T00:00:00.000Z");
      await seedPost(database, { authorId: other.userId, createdAt: new Date(seenAt.getTime() + 1) });

      expect(await readNewCount(other, seenAt.toISOString())).toBe(0);
    });

    it("counts everything when the feed was empty", async () => {
      await seedPost(database, { authorId: author.userId });

      expect(await readNewCount(other, null)).toBe(1);
    });

    it("skips banned authors", async () => {
      const bannedId = await seedMember(database, { name: "Banned Ben", banned: true });
      await seedPost(database, { authorId: bannedId });

      expect(await readNewCount(other, null)).toBe(0);
    });

    it("reports the newest post seen, pinned or not", async () => {
      const newest = new Date("2026-02-01T00:00:00.000Z");
      await seedPost(database, { authorId: author.userId, createdAt: new Date("2026-01-01T00:00:00.000Z") });
      await seedPost(database, { authorId: author.userId, createdAt: newest, pinnedAt: new Date(), pinnedByUserId: admin.userId });

      expect((await readPage(other)).newestPostAt).toBe(newest.toISOString());
    });
  });

  describe("banned members' content", () => {
    let bannedId: string;

    beforeEach(async () => {
      bannedId = await seedMember(database, { name: "Banned Ben", banned: true });
    });

    it("leaves out their posts", async () => {
      await seedPost(database, { authorId: bannedId });

      expect((await readPage(other)).posts).toEqual([]);
    });

    it("brings their posts back when a temporary ban runs out", async () => {
      await seedPost(database, { authorId: bannedId });
      await database.update(user).set({ banExpires: new Date(Date.now() - DAY_MS) }).where(eq(user.id, bannedId));

      expect((await readPage(other)).posts).toHaveLength(1);
    });

    it("leaves out their replies, from the list and the count", async () => {
      const { id: postId } = await createPost(author);
      await seedComment(database, { postId, authorId: bannedId, body: "From beyond" });

      const { posts } = await readPage(other);
      const thread = commentPageSchema.parse(await (await call(postCommentList, other, { postId })).json());

      expect(posts[0]).toMatchObject({ commentCount: 0, inlineComments: [] });
      expect(thread.comments).toEqual([]);
    });

    it("answers 404 for the replies under their post", async () => {
      const postId = await seedPost(database, { authorId: bannedId });
      await seedComment(database, { postId, authorId: other.userId });

      expect((await call(postCommentList, other, { postId })).status).toBe(NOT_FOUND_STATUS);
    });

    it("leaves out their reactions from the count", async () => {
      const { id: postId } = await createPost(author);
      await database.insert(reaction).values({ postId, userId: bannedId, reaction: REACTIONS.heart });

      expect((await readPage(other)).posts[0]?.reactions).toEqual([]);
    });

    it("drops the name of a banned admin who pinned a post", async () => {
      await seedPost(database, { authorId: author.userId, pinnedAt: new Date(), pinnedByUserId: bannedId });

      expect((await readPage(other)).pinnedPosts[0]?.pin?.pinnedByName).toBeNull();
    });

    describe("for admins", () => {
      it("shows their posts, marked banned", async () => {
        const postId = await seedPost(database, { authorId: bannedId });

        const { posts } = await readPage(admin);

        expect(posts.map(({ id }) => id)).toEqual([postId]);
        expect(posts[0]?.author.isBanned).toBe(true);
      });

      it("shows their replies, in the count and the thread", async () => {
        const { id: postId } = await createPost(author);
        const commentId = await seedComment(database, { postId, authorId: bannedId });

        const { posts } = await readPage(admin);
        const thread = commentPageSchema.parse(await (await call(postCommentList, admin, { postId })).json());

        expect(posts[0]?.commentCount).toBe(1);
        expect(posts[0]?.inlineComments[0]?.author.isBanned).toBe(true);
        expect(thread.comments.map(({ id }) => id)).toEqual([commentId]);
      });

      it("deletes their post for good, even when a temporary ban ends", async () => {
        const postId = await seedPost(database, { authorId: bannedId, body: "Against the rules" });

        expect((await call(postPostDelete, admin, { postId })).status).toBe(OK_STATUS);
        await database.update(user).set({ banExpires: new Date(Date.now() - DAY_MS) }).where(eq(user.id, bannedId));

        expect((await readPage(other)).posts).toEqual([]);
        expect((await database.select().from(moderationRecord))[0]).toMatchObject({ targetId: postId, targetAuthorId: bannedId });
      });

      it("deletes their reply", async () => {
        const { id: postId } = await createPost(author);
        const commentId = await seedComment(database, { postId, authorId: bannedId });

        expect((await call(postCommentDelete, admin, { commentId })).status).toBe(OK_STATUS);
        expect(await database.select().from(comment)).toEqual([]);
      });

      it("still can't react to their post", async () => {
        const postId = await seedPost(database, { authorId: bannedId });
        const response = await call(postPostReaction, admin, { postId, reaction: REACTIONS.heart, isActive: true });

        expect(response.status).toBe(NOT_FOUND_STATUS);
      });
    });

    it("refuses a member deleting their post or reply", async () => {
      const postId = await seedPost(database, { authorId: bannedId });
      const commentId = await seedComment(database, { postId, authorId: bannedId });

      expect((await call(postPostDelete, other, { postId })).status).toBe(NOT_FOUND_STATUS);
      expect((await call(postCommentDelete, other, { commentId })).status).toBe(NOT_FOUND_STATUS);
    });

    it("answers 404 for a reaction on their post", async () => {
      const postId = await seedPost(database, { authorId: bannedId });
      const response = await call(postPostReaction, other, { postId, reaction: REACTIONS.heart, isActive: true });

      expect(response.status).toBe(NOT_FOUND_STATUS);
    });
  });

  describe("rate limits", () => {
    it("slows a member down after too many posts, per member", async () => {
      for (let position = 0; position < MAXIMUM_PER_MINUTE[POSTING_KINDS.post]; position += 1) {
        expect((await call(postPostCreate, author, { body: `Post ${position}` })).status).toBe(OK_STATUS);
      }

      const refused = await call(postPostCreate, author, { body: "One more" });

      expect(refused.status).toBe(TOO_MANY_REQUESTS_STATUS);
      expect((await refused.json()).code).toBe(FEED_ERROR_CODES.tooFast);
      expect((await call(postPostCreate, other, { body: "Someone else" })).status).toBe(OK_STATUS);
    });

    it("slows a member down after too many replies", async () => {
      const { id: postId } = await createPost(author);
      const attempts = MAXIMUM_PER_MINUTE[POSTING_KINDS.comment];
      for (let position = 0; position < attempts; position += 1) {
        await call(postCommentCreate, other, { postId, body: `Reply ${position}` });
      }

      expect((await call(postCommentCreate, other, { postId, body: "One more" })).status).toBe(TOO_MANY_REQUESTS_STATUS);
    });

    it("doesn't spend the limit on a refused body", async () => {
      for (let position = 0; position < MAXIMUM_PER_MINUTE[POSTING_KINDS.post] + 1; position += 1) {
        await call(postPostCreate, author, { body: "" });
      }

      expect((await call(postPostCreate, author, { body: "Still allowed" })).status).toBe(OK_STATUS);
    });

    it("keeps the limit in the database, so it holds across instances", async () => {
      await call(postPostCreate, author, { body: "Hi" });

      const rows = await database.select().from(rateLimit).where(like(rateLimit.key, "feed-post|%"));

      expect(rows).toHaveLength(1);
    });
  });
});
