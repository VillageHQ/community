import { randomUUID } from "node:crypto";

import { eq, like } from "drizzle-orm";
import { afterEach, beforeAll, beforeEach, describe, expect, it } from "vitest";

import { rateLimit, session, user } from "@/platform/database/auth-schema";
import { conversation, conversationReadCursor, directMessage, messageReport } from "@/modules/messages/schema";
import { memberBlock } from "@/modules/members/schema";
import { toConversationPair } from "@/modules/messages/rules-conversation-pair";
import {
  directMessageSchema,
  inboxSchema,
  MESSAGE_ERROR_CODES,
  MESSAGE_LIMITS,
  startedConversationSchema,
  threadChangesSchema,
  threadPageSchema,
  unreadCountSchema,
  type Inbox,
} from "@/modules/messages/contract";
import { MESSAGING_KINDS, MESSAGING_MAXIMUM_PER_MINUTE } from "@/modules/messages/limits";
import { clearDatabase, createTestDatabase } from "@/test/database";
import { seedMember } from "@/test/members";
import { seedConversation, seedMessages } from "@/test/messages";
import { createSignedInMember } from "@/test/signed-in-member";

import { POST as postBlock } from "@/app/api/messages/block/route";
import { POST as postChanges } from "@/app/api/messages/changes/route";
import { POST as postDelete } from "@/app/api/messages/delete/route";
import { POST as postRead } from "@/app/api/messages/read/route";
import { POST as postReport } from "@/app/api/messages/report/route";
import { POST as postInbox } from "@/app/api/messages/route";
import { POST as postSend } from "@/app/api/messages/send/route";
import { POST as postStart } from "@/app/api/messages/start/route";
import { POST as postThread } from "@/app/api/messages/thread/route";
import { POST as postUnreadCount } from "@/app/api/messages/unread-count/route";

const APP_URL = "http://localhost:3000";
const OK_STATUS = 200;
const UNAUTHORIZED_STATUS = 401;
const FORBIDDEN_STATUS = 403;
const NOT_FOUND_STATUS = 404;
const CONFLICT_STATUS = 409;
const PAYLOAD_TOO_LARGE_STATUS = 413;
const UNPROCESSABLE_STATUS = 422;
const TOO_MANY_REQUESTS_STATUS = 429;
const UNKNOWN_ID = "00000000-0000-4000-8000-000000000000";
const XSS_STRING = `<img src=x onerror=alert(1)><script>alert("x")</script>`;
const CONCURRENT_REQUESTS = 12;

type Member = Awaited<ReturnType<typeof createSignedInMember>>;
type Handler = (request: Request) => Promise<Response>;

function call(handler: Handler, member: Member | null, body: unknown, origin = APP_URL) {
  return handler(
    new Request(`${APP_URL}/api/messages`, {
      method: "POST",
      headers: { "Content-Type": "application/json", Origin: origin, ...(member ? { Cookie: member.cookie } : {}) },
      body: JSON.stringify(body),
    }),
  );
}

async function readJsonText(response: Response) {
  return response.text();
}

describe("direct messages", () => {
  const database = createTestDatabase();
  let alice: Member;
  let bob: Member;
  let carol: Member;
  let admin: Member;
  let conversationId: string;

  async function send(member: Member, body = "Hello there", targetId = conversationId, clientKey: string = randomUUID()) {
    const response = await call(postSend, member, { conversationId: targetId, clientKey, body });
    expect(response.status).toBe(OK_STATUS);
    return directMessageSchema.parse(await response.json());
  }

  async function readThread(member: Member, beforeSequence: number | null = null, targetId = conversationId) {
    const response = await call(postThread, member, { conversationId: targetId, beforeSequence });
    expect(response.status).toBe(OK_STATUS);
    return threadPageSchema.parse(await response.json());
  }

  async function readChanges(member: Member, afterRevision = 0, targetId = conversationId) {
    const response = await call(postChanges, member, { conversationId: targetId, afterRevision });
    expect(response.status).toBe(OK_STATUS);
    return threadChangesSchema.parse(await response.json());
  }

  async function readInbox(member: Member) {
    return inboxSchema.parse(await (await call(postInbox, member, {})).json()).conversations;
  }

  async function readUnread(member: Member) {
    return unreadCountSchema.parse(await (await call(postUnreadCount, member, {})).json()).unreadCount;
  }

  function block(blocker: Member, blocked: Member) {
    return call(postBlock, blocker, { memberId: blocked.userId, isBlocked: true });
  }

  beforeAll(async () => {
    await clearDatabase(database);
    alice = await createSignedInMember(database);
    bob = await createSignedInMember(database);
    carol = await createSignedInMember(database);
    admin = await createSignedInMember(database, "admin");
  });

  beforeEach(async () => {
    await database.delete(messageReport);
    await database.delete(conversation);
    await database.delete(memberBlock);
    await database.delete(rateLimit);
    conversationId = await seedConversation(database, alice.userId, bob.userId);
  });

  describe("access", () => {
    const ROUTES: [string, Handler, () => unknown][] = [
      ["reading the inbox", postInbox, () => ({})],
      ["reading the unread count", postUnreadCount, () => ({})],
      ["starting a conversation", postStart, () => ({ memberId: UNKNOWN_ID })],
      ["reading a thread", postThread, () => ({ conversationId: UNKNOWN_ID })],
      ["polling a thread", postChanges, () => ({ conversationId: UNKNOWN_ID, afterRevision: 0 })],
      ["sending", postSend, () => ({ conversationId: UNKNOWN_ID, clientKey: UNKNOWN_ID, body: "Hi" })],
      ["deleting", postDelete, () => ({ messageId: UNKNOWN_ID })],
      ["marking read", postRead, () => ({ conversationId: UNKNOWN_ID, sequence: 1 })],
      ["reporting", postReport, () => ({ messageId: UNKNOWN_ID })],
      ["blocking", postBlock, () => ({ memberId: UNKNOWN_ID, isBlocked: true })],
    ];

    it.each(ROUTES)("refuses a visitor %s", async (_name, handler, readBody) => {
      expect((await call(handler, null, readBody())).status).toBe(UNAUTHORIZED_STATUS);
    });

    it.each(ROUTES)("refuses another site's origin %s", async (_name, handler, readBody) => {
      expect((await call(handler, alice, readBody(), "https://evil.test")).status).toBe(FORBIDDEN_STATUS);
    });

    it.each(ROUTES)("refuses a banned member %s and ends their sessions", async (_name, handler, readBody) => {
      const banned = await createSignedInMember(database);
      await database.update(user).set({ banned: true }).where(eq(user.id, banned.userId));

      expect((await call(handler, banned, readBody())).status).toBe(UNAUTHORIZED_STATUS);
      expect(await database.select().from(session).where(eq(session.userId, banned.userId))).toEqual([]);
    });
  });

  describe("conversations", () => {
    it("returns the same conversation whichever member starts it", async () => {
      await database.delete(conversation);

      const fromAlice = startedConversationSchema.parse(await (await call(postStart, alice, { memberId: bob.userId })).json());
      const fromBob = startedConversationSchema.parse(await (await call(postStart, bob, { memberId: alice.userId })).json());

      expect(fromBob.conversationId).toBe(fromAlice.conversationId);
    });

    it("creates one conversation when both members start it at the same instant", async () => {
      await database.delete(conversation);

      const responses = await Promise.all(
        Array.from({ length: CONCURRENT_REQUESTS }, (_unused, position) =>
          position % 2 === 0
            ? call(postStart, alice, { memberId: bob.userId })
            : call(postStart, bob, { memberId: alice.userId }),
        ),
      );

      const ids = await Promise.all(responses.map(async (response) => startedConversationSchema.parse(await response.json()).conversationId));
      expect(new Set(ids).size).toBe(1);
      expect(await database.select().from(conversation)).toHaveLength(1);
    });

    it("refuses a conversation with yourself", async () => {
      const response = await call(postStart, alice, { memberId: alice.userId });

      expect(response.status).toBe(UNPROCESSABLE_STATUS);
      expect((await response.json()).code).toBe(MESSAGE_ERROR_CODES.ownConversation);
    });

    it("answers the same for an unknown member and a banned one", async () => {
      const banned = await createSignedInMember(database);
      await database.update(user).set({ banned: true }).where(eq(user.id, banned.userId));

      const unknownResponse = await call(postStart, alice, { memberId: UNKNOWN_ID });
      const bannedResponse = await call(postStart, alice, { memberId: banned.userId });

      expect(unknownResponse.status).toBe(NOT_FOUND_STATUS);
      expect(bannedResponse.status).toBe(NOT_FOUND_STATUS);
      expect(await readJsonText(bannedResponse)).toBe(await readJsonText(unknownResponse));
    });

    describe("in the database", () => {
      it("refuses a second row for the pair", async () => {
        await expect(database.insert(conversation).values(toConversationPair(alice.userId, bob.userId))).rejects.toThrow();
      });

      it("refuses a pair in the wrong order", async () => {
        const { memberLowId, memberHighId } = toConversationPair(alice.userId, carol.userId);

        await expect(
          database.insert(conversation).values({ memberLowId: memberHighId, memberHighId: memberLowId }),
        ).rejects.toThrow();
      });

      it("refuses a member paired with themselves", async () => {
        await expect(
          database.insert(conversation).values({ memberLowId: alice.userId, memberHighId: alice.userId }),
        ).rejects.toThrow();
      });

      it("orders mixed-case ids the same way as the application", async () => {
        const upperId = `Z${randomUUID()}`;
        const lowerId = `a${randomUUID()}`;
        await database.insert(user).values([
          { id: upperId, name: "Upper", email: `${upperId}@members.test`, emailVerified: true },
          { id: lowerId, name: "Lower", email: `${lowerId}@members.test`, emailVerified: true },
        ]);

        await expect(database.insert(conversation).values(toConversationPair(lowerId, upperId))).resolves.toBeDefined();

        await database.delete(user).where(eq(user.id, upperId));
        await database.delete(user).where(eq(user.id, lowerId));
      });
    });
  });

  describe("sending", () => {
    it("delivers a message to the other member", async () => {
      const sent = await send(alice, "Hello Bob");

      const { messages } = await readThread(bob);

      expect(messages.map(({ id, body, isMine }) => ({ id, body, isMine }))).toEqual([
        { id: sent.id, body: "Hello Bob", isMine: false },
      ]);
    });

    it("strips bidi controls and null bytes and trims the text", async () => {
      const sent = await send(alice, "  ‮hello\u0000 ⁦there⁩  ");

      expect(sent.body).toBe("hello there");
    });

    it("stores markup as plain text", async () => {
      expect((await send(alice, XSS_STRING)).body).toBe(XSS_STRING);
    });

    it("refuses a message with nothing visible in it", async () => {
      const response = await call(postSend, alice, { conversationId, clientKey: randomUUID(), body: " ‮\n " });

      expect(response.status).toBe(UNPROCESSABLE_STATUS);
    });

    it("accepts a message at the length cap", async () => {
      const sent = await send(alice, "a".repeat(MESSAGE_LIMITS.bodyLength));

      expect(sent.body).toHaveLength(MESSAGE_LIMITS.bodyLength);
    });

    it("refuses a message one character over the cap", async () => {
      const body = "a".repeat(MESSAGE_LIMITS.bodyLength + 1);

      const response = await call(postSend, alice, { conversationId, clientKey: randomUUID(), body });

      expect(response.status).toBe(UNPROCESSABLE_STATUS);
    });

    it("refuses an oversized request before reading it", async () => {
      const response = await call(postSend, alice, { conversationId, clientKey: randomUUID(), body: "a".repeat(20_000) });

      expect(response.status).toBe(PAYLOAD_TOO_LARGE_STATUS);
    });

    it("refuses a body over the cap in the database too", async () => {
      await expect(
        database.insert(directMessage).values({
          conversationId,
          senderId: alice.userId,
          clientKey: randomUUID(),
          body: "a".repeat(MESSAGE_LIMITS.bodyLength + 1),
          sequence: 1,
          revision: 1,
        }),
      ).rejects.toThrow();
    });

    it("refuses a live message without a body in the database", async () => {
      await expect(
        database.insert(directMessage).values({
          conversationId,
          senderId: alice.userId,
          clientKey: randomUUID(),
          body: null,
          sequence: 1,
          revision: 1,
        }),
      ).rejects.toThrow();
    });

    describe("idempotency", () => {
      it("returns the first message for a repeated key", async () => {
        const clientKey = randomUUID();

        const first = await send(alice, "Once", conversationId, clientKey);
        const second = await send(alice, "Once", conversationId, clientKey);

        expect(second.id).toBe(first.id);
        expect((await readThread(bob)).messages).toHaveLength(1);
      });

      it("creates one message when a double click races", async () => {
        const clientKey = randomUUID();

        const responses = await Promise.all(
          Array.from({ length: CONCURRENT_REQUESTS }, () => call(postSend, alice, { conversationId, clientKey, body: "Once" })),
        );

        const ids = await Promise.all(responses.map(async (response) => directMessageSchema.parse(await response.json()).id));
        expect(new Set(ids).size).toBe(1);
        expect(await database.select().from(directMessage)).toHaveLength(1);
        const [row] = await database.select({ lastRevision: conversation.lastRevision }).from(conversation).where(eq(conversation.id, conversationId));
        expect(row?.lastRevision).toBe(1);
      });

      it("keeps keys apart per sender", async () => {
        const clientKey = randomUUID();

        const fromAlice = await send(alice, "Alice", conversationId, clientKey);
        const fromBob = await send(bob, "Bob", conversationId, clientKey);

        expect(fromBob.id).not.toBe(fromAlice.id);
      });

      it("doesn't reveal another member's message through a reused key", async () => {
        const clientKey = randomUUID();
        await send(alice, "Private", conversationId, clientKey);

        const response = await call(postSend, carol, { conversationId, clientKey, body: "Guess" });

        expect(response.status).toBe(NOT_FOUND_STATUS);
        expect(await readJsonText(response)).not.toContain("Private");
      });
    });

    describe("rate limit", () => {
      it("answers 429 after the per-minute limit", async () => {
        const limit = MESSAGING_MAXIMUM_PER_MINUTE[MESSAGING_KINDS.send];
        for (let attempt = 0; attempt < limit; attempt += 1) await send(alice, `Message ${attempt}`);

        const response = await call(postSend, alice, { conversationId, clientKey: randomUUID(), body: "Too many" });

        expect(response.status).toBe(TOO_MANY_REQUESTS_STATUS);
        expect((await response.json()).code).toBe(MESSAGE_ERROR_CODES.tooFast);
      });

      it("still confirms a retried message once limited", async () => {
        const clientKey = randomUUID();
        const first = await send(alice, "First", conversationId, clientKey);
        const limit = MESSAGING_MAXIMUM_PER_MINUTE[MESSAGING_KINDS.send];
        for (let attempt = 1; attempt < limit; attempt += 1) await send(alice, `Message ${attempt}`);
        const limited = await call(postSend, alice, { conversationId, clientKey: randomUUID(), body: "Too many" });
        expect(limited.status).toBe(TOO_MANY_REQUESTS_STATUS);

        const retried = await send(alice, "First", conversationId, clientKey);

        expect(retried.id).toBe(first.id);
      });

      it("counts each member apart", async () => {
        const limit = MESSAGING_MAXIMUM_PER_MINUTE[MESSAGING_KINDS.send];
        for (let attempt = 0; attempt < limit; attempt += 1) await send(alice, `Message ${attempt}`);

        expect((await send(bob, "Still fine")).body).toBe("Still fine");
      });
    });
  });

  describe("pagination", () => {
    it("walks every older message once, newest page first, oldest first within a page", async () => {
      const total = MESSAGE_LIMITS.messagesPerPage * 2 + 5;
      const sequences = await seedMessages(database, { conversationId, senderId: alice.userId, count: total });

      const seen: number[][] = [];
      let cursor: number | null = null;
      do {
        const page: Awaited<ReturnType<typeof readThread>> = await readThread(bob, cursor);
        seen.push(page.messages.map(({ sequence }) => sequence));
        cursor = page.olderCursor;
      } while (cursor !== null);

      expect(seen.map((page) => page.length)).toEqual([MESSAGE_LIMITS.messagesPerPage, MESSAGE_LIMITS.messagesPerPage, 5]);
      expect(seen.flat().toSorted((first, second) => first - second)).toEqual(sequences);
      expect(seen[0]?.at(-1)).toBe(total);
      expect(seen[0]?.[0]).toBeLessThan(seen[0]?.at(-1) ?? 0);
    });

    it("keeps paging stable when new messages arrive in between", async () => {
      await seedMessages(database, { conversationId, senderId: alice.userId, count: MESSAGE_LIMITS.messagesPerPage + 1 });

      const { olderCursor } = await readThread(bob);
      await send(alice, "Arrives while paging");
      const older = await readThread(bob, olderCursor);

      expect(older.messages.map(({ sequence }) => sequence)).toEqual([1]);
      expect(older.olderCursor).toBeNull();
    });
  });

  describe("cursor bounds", () => {
    const TOO_LARGE = 2 ** 31;
    const LARGEST = TOO_LARGE - 1;

    it.each([
      ["paging older messages", postThread, () => ({ conversationId, beforeSequence: TOO_LARGE })],
      ["polling", postChanges, () => ({ conversationId, afterRevision: TOO_LARGE })],
      ["marking read", postRead, () => ({ conversationId, sequence: TOO_LARGE })],
    ] satisfies [string, Handler, () => unknown][])("refuses a cursor past a Postgres integer when %s", async (_name, handler, readBody) => {
      expect((await call(handler, alice, readBody())).status).toBe(UNPROCESSABLE_STATUS);
    });

    it("accepts the largest cursor Postgres can hold", async () => {
      await send(alice, "Hi");

      const page = await readThread(bob, LARGEST);

      expect(page.messages).toHaveLength(1);
      expect((await readChanges(bob, LARGEST)).messages).toEqual([]);
    });
  });

  describe("the polling limit", () => {
    const POLL_LIMIT = MESSAGING_MAXIMUM_PER_MINUTE[MESSAGING_KINDS.poll];
    const ROUTES: [string, Handler, () => unknown][] = [
      ["polling a thread", postChanges, () => ({ conversationId, afterRevision: 0 })],
      ["reading the inbox", postInbox, () => ({})],
      ["reading the unread count", postUnreadCount, () => ({})],
      ["reading a thread", postThread, () => ({ conversationId })],
    ];

    async function exhaustPollLimit(member: Member) {
      await database
        .insert(rateLimit)
        .values({ id: randomUUID(), key: `messages-poll|${member.userId}`, count: POLL_LIMIT, lastRequest: Date.now() });
    }

    it("leaves room for an open thread, the inbox and the badge in many tabs", () => {
      const THREAD_POLLS_PER_MINUTE = 15;
      const INBOX_AND_BADGE_POLLS_PER_MINUTE = 4;
      const TABS = 15;

      expect(POLL_LIMIT).toBeGreaterThan((THREAD_POLLS_PER_MINUTE + INBOX_AND_BADGE_POLLS_PER_MINUTE) * TABS);
    });

    it.each(ROUTES)("answers 429 when %s past the limit", async (_name, handler, readBody) => {
      await exhaustPollLimit(alice);

      const response = await call(handler, alice, readBody());

      expect(response.status).toBe(TOO_MANY_REQUESTS_STATUS);
      expect((await response.json()).code).toBe(MESSAGE_ERROR_CODES.tooFast);
    });

    it("counts each member apart, and doesn't stop sending", async () => {
      await exhaustPollLimit(alice);

      expect((await call(postUnreadCount, bob, {})).status).toBe(OK_STATUS);
      expect((await send(alice, "Still sending")).body).toBe("Still sending");
    });
  });

  describe("polling", () => {
    it("returns nothing when nothing changed", async () => {
      const { revision } = await readThread(bob);

      const changes = await readChanges(bob, revision);

      expect(changes.messages).toEqual([]);
      expect(changes.revision).toBe(revision);
      expect(changes.hasMore).toBe(false);
    });

    it("returns only what is new since the cursor", async () => {
      await send(alice, "Old");
      const { revision } = await readThread(bob);
      const fresh = await send(alice, "New");

      const changes = await readChanges(bob, revision);

      expect(changes.messages.map(({ id }) => id)).toEqual([fresh.id]);
      expect(changes.revision).toBeGreaterThan(revision);
    });

    it("reports a deletion as a change", async () => {
      const sent = await send(alice, "Regret");
      const { revision } = await readThread(bob);
      await call(postDelete, alice, { messageId: sent.id });

      const changes = await readChanges(bob, revision);

      expect(changes.messages).toHaveLength(1);
      expect(changes.messages[0]).toMatchObject({ id: sent.id, isDeleted: true, body: null });
    });

    it("pages a long gap, then catches up without losing anything", async () => {
      const total = MESSAGE_LIMITS.changesPerPoll + 3;
      await seedMessages(database, { conversationId, senderId: alice.userId, count: total });

      const firstPoll = await readChanges(bob, 0);
      const secondPoll = await readChanges(bob, firstPoll.revision);

      expect(firstPoll.messages).toHaveLength(MESSAGE_LIMITS.changesPerPoll);
      expect(firstPoll.hasMore).toBe(true);
      expect(secondPoll.messages).toHaveLength(3);
      expect(secondPoll.hasMore).toBe(false);
    });

    it("never skips a message under concurrent sends", async () => {
      const seenIds = new Set<string>();
      let revision = 0;
      const sends = Promise.all(
        Array.from({ length: CONCURRENT_REQUESTS }, (_unused, position) => send(position % 2 === 0 ? alice : bob, `Racing ${position}`)),
      );
      for (let poll = 0; poll < CONCURRENT_REQUESTS; poll += 1) {
        const changes = await readChanges(bob, revision);
        for (const { id } of changes.messages) seenIds.add(id);
        revision = changes.revision;
      }
      const sent = await sends;
      const lastChanges = await readChanges(bob, revision);
      for (const { id } of lastChanges.messages) seenIds.add(id);

      expect(seenIds.size).toBe(sent.length);
    });
  });

  describe("deleting", () => {
    it("shows both members a deleted message without its text", async () => {
      const sent = await send(alice, "Secret plan");

      const response = await call(postDelete, alice, { messageId: sent.id });

      expect(response.status).toBe(OK_STATUS);
      const [forBob] = (await readThread(bob)).messages;
      const [forAlice] = (await readThread(alice)).messages;
      expect(forBob).toMatchObject({ isDeleted: true, body: null });
      expect(forAlice).toMatchObject({ isDeleted: true, body: null });
    });

    it("erases the text from the database", async () => {
      const sent = await send(alice, "Secret plan");

      await call(postDelete, alice, { messageId: sent.id });

      const [row] = await database.select().from(directMessage).where(eq(directMessage.id, sent.id));
      expect(row?.body).toBeNull();
      expect(row?.deletedAt).toBeInstanceOf(Date);
    });

    it("refuses deleting the other member's message", async () => {
      const sent = await send(alice, "Mine");

      const response = await call(postDelete, bob, { messageId: sent.id });

      expect(response.status).toBe(FORBIDDEN_STATUS);
      expect((await readThread(bob)).messages[0]?.body).toBe("Mine");
    });

    it("answers the same when deleted twice", async () => {
      const sent = await send(alice, "Once");
      await call(postDelete, alice, { messageId: sent.id });

      const response = await call(postDelete, alice, { messageId: sent.id });

      expect(response.status).toBe(OK_STATUS);
      expect((await readChanges(bob, 0)).revision).toBe(2);
    });

    it("shows the deletion in the inbox preview", async () => {
      const sent = await send(alice, "Regret");
      await call(postDelete, alice, { messageId: sent.id });

      const [summary] = await readInbox(bob);

      expect(summary?.lastMessage).toMatchObject({ isDeleted: true, preview: null });
    });
  });

  describe("unread", () => {
    it("counts per conversation and in total, leaving out your own messages", async () => {
      const secondConversationId = await seedConversation(database, bob.userId, carol.userId);
      await send(alice, "One");
      await send(alice, "Two");
      await send(bob, "From Bob");
      await send(carol, "From Carol", secondConversationId);

      const inbox = await readInbox(bob);

      expect(await readUnread(bob)).toBe(3);
      expect(await readUnread(alice)).toBe(1);
      expect(Object.fromEntries(inbox.map(({ id, unreadCount }) => [id, unreadCount]))).toEqual({
        [conversationId]: 2,
        [secondConversationId]: 1,
      });
    });

    it("clears when the member reads the conversation", async () => {
      const sent = await send(alice, "Read me");

      const response = await call(postRead, bob, { conversationId, sequence: sent.sequence });

      expect(response.status).toBe(OK_STATUS);
      expect(await readUnread(bob)).toBe(0);
    });

    it("counts only what arrived after the read cursor", async () => {
      const first = await send(alice, "One");
      await call(postRead, bob, { conversationId, sequence: first.sequence });
      await send(alice, "Two");

      expect(await readUnread(bob)).toBe(1);
    });

    it("never moves the cursor backwards", async () => {
      await send(alice, "One");
      const second = await send(alice, "Two");
      await call(postRead, bob, { conversationId, sequence: second.sequence });

      await call(postRead, bob, { conversationId, sequence: 1 });

      expect(await readUnread(bob)).toBe(0);
      expect((await readThread(bob)).lastReadSequence).toBe(second.sequence);
    });

    it("caps the cursor at the newest message, so later messages still count", async () => {
      await send(alice, "One");
      await call(postRead, bob, { conversationId, sequence: 9_999 });
      await send(alice, "Two");

      expect(await readUnread(bob)).toBe(1);
    });

    it("drops a deleted message from the count", async () => {
      const sent = await send(alice, "Oops");
      await call(postDelete, alice, { messageId: sent.id });

      expect(await readUnread(bob)).toBe(0);
    });

    it("never sends the other member's read cursor to the client", async () => {
      const sent = await send(alice, "Read me");

      await call(postRead, bob, { conversationId, sequence: sent.sequence });

      const [threadText, changesText, inboxText] = await Promise.all([
        call(postThread, alice, { conversationId }).then(readJsonText),
        call(postChanges, alice, { conversationId, afterRevision: 0 }).then(readJsonText),
        call(postInbox, alice, {}).then(readJsonText),
      ]);
      for (const text of [threadText, changesText, inboxText]) expect(text).not.toMatch(/peerRead|readAt/);
      expect((await readThread(alice)).lastReadSequence).toBe(0);
    });

    it("keeps one read cursor per member", async () => {
      const sent = await send(alice, "Read me");

      await call(postRead, bob, { conversationId, sequence: sent.sequence });
      await call(postRead, bob, { conversationId, sequence: sent.sequence });

      expect(await database.select().from(conversationReadCursor)).toHaveLength(1);
    });
  });

  describe("privacy", () => {
    describe.each([
      ["a third member", () => carol],
      ["an admin", () => admin],
    ])("for %s", (_name, readOutsider) => {
      it("answers every conversation route the way it answers an unknown id", async () => {
        const sent = await send(alice, "Between us");
        const outsider = readOutsider();

        const attempts: [Handler, unknown, unknown][] = [
          [postThread, { conversationId }, { conversationId: UNKNOWN_ID }],
          [postThread, { conversationId, beforeSequence: 10 }, { conversationId: UNKNOWN_ID, beforeSequence: 10 }],
          [postChanges, { conversationId, afterRevision: 0 }, { conversationId: UNKNOWN_ID, afterRevision: 0 }],
          [postRead, { conversationId, sequence: 1 }, { conversationId: UNKNOWN_ID, sequence: 1 }],
          [
            postSend,
            { conversationId, clientKey: randomUUID(), body: "Let me in" },
            { conversationId: UNKNOWN_ID, clientKey: randomUUID(), body: "Let me in" },
          ],
          [postDelete, { messageId: sent.id }, { messageId: UNKNOWN_ID }],
          [postReport, { messageId: sent.id }, { messageId: UNKNOWN_ID }],
        ];

        for (const [handler, realBody, unknownBody] of attempts) {
          const realResponse = await call(handler, outsider, realBody);
          const unknownResponse = await call(handler, outsider, unknownBody);
          expect(realResponse.status).toBe(NOT_FOUND_STATUS);
          expect(unknownResponse.status).toBe(NOT_FOUND_STATUS);
          expect(await readJsonText(realResponse)).toBe(await readJsonText(unknownResponse));
        }
      });

      it("leaves the conversation untouched", async () => {
        const sent = await send(alice, "Between us");
        const outsider = readOutsider();

        await call(postSend, outsider, { conversationId, clientKey: randomUUID(), body: "Let me in" });
        await call(postDelete, outsider, { messageId: sent.id });
        await call(postRead, outsider, { conversationId, sequence: 1 });
        await call(postReport, outsider, { messageId: sent.id });

        expect((await readThread(bob)).messages.map(({ body }) => body)).toEqual(["Between us"]);
        expect(await database.select().from(messageReport)).toEqual([]);
        expect(await database.select().from(conversationReadCursor)).toEqual([]);
      });

      it("keeps the conversation out of their inbox and unread count", async () => {
        await send(alice, "Between us");
        const outsider = readOutsider();

        expect(await readInbox(outsider)).toEqual([]);
        expect(await readUnread(outsider)).toBe(0);
      });
    });

    it("never includes an email in any response", async () => {
      await database.update(user).set({ name: "Named Member" }).where(eq(user.id, bob.userId));
      const sent = await send(alice, "Hi");
      const responses = await Promise.all([
        call(postThread, bob, { conversationId }),
        call(postChanges, bob, { conversationId, afterRevision: 0 }),
        call(postInbox, bob, {}),
        call(postStart, bob, { memberId: alice.userId }),
        call(postSend, bob, { conversationId, clientKey: randomUUID(), body: "Hi back" }),
        call(postDelete, alice, { messageId: sent.id }),
      ]);

      for (const response of responses) {
        const text = await readJsonText(response);
        expect(text).not.toContain(alice.email);
        expect(text).not.toContain(bob.email);
        expect(text).not.toContain("@members.test");
      }
    });

    it("hides the other member's client key", async () => {
      await send(alice, "Hi");

      expect((await readThread(bob)).messages[0]?.clientKey).toBeNull();
      expect((await readThread(alice)).messages[0]?.clientKey).not.toBeNull();
    });
  });

  describe("blocking", () => {
    it("accepts a blocked member's message exactly as usual", async () => {
      await block(bob, alice);

      const response = await call(postSend, alice, { conversationId, clientKey: randomUUID(), body: "Hello?" });

      expect(response.status).toBe(OK_STATUS);
      expect(directMessageSchema.parse(await response.json())).toMatchObject({ body: "Hello?", isMine: true, isDeleted: false });
      expect((await readThread(alice)).messages.map(({ body }) => body)).toEqual(["Hello?"]);
    });

    it("keeps a blocked member's message from reaching the blocker", async () => {
      await block(bob, alice);
      const before = await readThread(bob);

      await send(alice, "Hello?");

      expect((await readThread(bob)).messages).toEqual([]);
      expect((await readChanges(bob, before.revision)).messages).toEqual([]);
      expect(await readInbox(bob)).toEqual([]);
      expect(await readUnread(bob)).toBe(0);
    });

    it("tells the blocked member nothing", async () => {
      await send(alice, "Before the block");
      await block(bob, alice);
      await send(alice, "After the block");

      const texts = await Promise.all([
        call(postThread, alice, { conversationId }).then(readJsonText),
        call(postChanges, alice, { conversationId, afterRevision: 0 }).then(readJsonText),
        call(postInbox, alice, {}).then(readJsonText),
      ]);

      for (const text of texts) expect(text).not.toMatch(/"isBlockedByMe":true|withheld/i);
      expect((await readThread(alice)).peer.isAvailable).toBe(true);
    });

    it("lets a blocked member open the conversation, without creating any message", async () => {
      await database.delete(conversation);
      await block(bob, alice);

      const response = await call(postStart, alice, { memberId: bob.userId });

      expect(response.status).toBe(OK_STATUS);
      expect(await database.select().from(directMessage)).toEqual([]);
      expect(await readInbox(bob)).toEqual([]);
    });

    it("tells the blocker who they blocked", async () => {
      await send(alice, "Hi");
      await block(bob, alice);

      expect((await readThread(bob)).isBlockedByMe).toBe(true);
      expect((await readInbox(bob))[0]?.isBlockedByMe).toBe(true);
    });

    it("refuses the blocker's own message until they unblock", async () => {
      await block(bob, alice);

      const refused = await call(postSend, bob, { conversationId, clientKey: randomUUID(), body: "Hi" });
      expect(refused.status).toBe(CONFLICT_STATUS);
      expect((await refused.json()).code).toBe(MESSAGE_ERROR_CODES.peerBlocked);

      await call(postBlock, bob, { memberId: alice.userId, isBlocked: false });
      expect((await send(bob, "Hi again")).body).toBe("Hi again");
    });

    it("keeps messages sent during a block hidden after an unblock", async () => {
      await block(bob, alice);
      await send(alice, "During the block");
      await call(postBlock, bob, { memberId: alice.userId, isBlocked: false });

      await send(alice, "After the block");

      expect((await readThread(bob)).messages.map(({ body }) => body)).toEqual(["After the block"]);
      expect(await readUnread(bob)).toBe(1);
    });

    it("keeps the blocker's read cursor below withheld messages", async () => {
      const visible = await send(alice, "Visible");
      await block(bob, alice);
      const withheld = await send(alice, "Withheld");

      await call(postRead, bob, { conversationId, sequence: withheld.sequence });

      expect((await readThread(bob)).lastReadSequence).toBe(visible.sequence);
    });

    it("shows a blocked sender nothing that changes when the blocker opens the thread", async () => {
      const visible = await send(alice, "Visible");
      await block(bob, alice);
      const withheld = await send(alice, "Withheld");
      const before = await call(postThread, alice, { conversationId }).then(readJsonText);

      await call(postRead, bob, { conversationId, sequence: withheld.sequence });
      await call(postRead, bob, { conversationId, sequence: visible.sequence });

      expect(await call(postThread, alice, { conversationId }).then(readJsonText)).toBe(before);
    });

    it("leaves the inbox order alone for the blocker", async () => {
      const secondConversationId = await seedConversation(database, bob.userId, carol.userId);
      await send(alice, "From Alice");
      await send(carol, "From Carol", secondConversationId);
      await block(bob, alice);

      await send(alice, "Withheld from Bob");

      const inbox = await readInbox(bob);
      expect(inbox.map(({ id }) => id)).toEqual([secondConversationId, conversationId]);
      expect(inbox[1]?.lastMessage.preview).toBe("From Alice");
    });

    it("refuses blocking yourself", async () => {
      expect((await block(alice, alice)).status).toBe(UNPROCESSABLE_STATUS);
    });

    it("refuses blocking an unknown member", async () => {
      const response = await call(postBlock, alice, { memberId: UNKNOWN_ID, isBlocked: true });

      expect(response.status).toBe(NOT_FOUND_STATUS);
    });

    it("stays one row when blocked twice", async () => {
      await block(bob, alice);
      await block(bob, alice);

      expect(await database.select().from(memberBlock)).toHaveLength(1);
    });
  });

  describe("reporting", () => {
    it("copies only the reported message", async () => {
      await send(alice, "Earlier and private");
      const reported = await send(alice, "This crosses a line");
      await send(alice, "Later and private");

      const response = await call(postReport, bob, { messageId: reported.id });

      expect(response.status).toBe(OK_STATUS);
      const rows = await database.select().from(messageReport);
      expect(rows).toHaveLength(1);
      expect(rows[0]).toMatchObject({
        messageId: reported.id,
        reporterId: bob.userId,
        reportedMemberId: alice.userId,
        messageBody: "This crosses a line",
      });
      expect(JSON.stringify(rows)).not.toContain("private");
    });

    it("records a double click once", async () => {
      const reported = await send(alice, "Report me");

      await Promise.all(Array.from({ length: CONCURRENT_REQUESTS }, () => call(postReport, bob, { messageId: reported.id })));

      expect(await database.select().from(messageReport)).toHaveLength(1);
    });

    it("marks the message reported for the reporter alone", async () => {
      const reported = await send(alice, "Report me");

      await call(postReport, bob, { messageId: reported.id });

      expect((await readThread(bob)).messages[0]?.isReported).toBe(true);
      expect((await readThread(alice)).messages[0]?.isReported).toBe(false);
    });

    it("refuses reporting your own message", async () => {
      const sent = await send(alice, "Mine");

      expect((await call(postReport, alice, { messageId: sent.id })).status).toBe(UNPROCESSABLE_STATUS);
    });

    it("refuses reporting a deleted message", async () => {
      const sent = await send(alice, "Gone");
      await call(postDelete, alice, { messageId: sent.id });

      expect((await call(postReport, bob, { messageId: sent.id })).status).toBe(CONFLICT_STATUS);
    });

    it("keeps the copy after the sender deletes the message", async () => {
      const reported = await send(alice, "Keep this copy");
      await call(postReport, bob, { messageId: reported.id });

      await call(postDelete, alice, { messageId: reported.id });

      const [row] = await database.select().from(messageReport).where(eq(messageReport.messageId, reported.id));
      expect(row?.messageBody).toBe("Keep this copy");
    });

    it("lets a blocker report what they received before blocking", async () => {
      const reported = await send(alice, "Report me");
      await block(bob, alice);

      expect((await call(postReport, bob, { messageId: reported.id })).status).toBe(OK_STATUS);
    });

    it("refuses a blocker reporting a message that never reached them", async () => {
      await block(bob, alice);
      const withheld = await send(alice, "Withheld");

      expect((await call(postReport, bob, { messageId: withheld.id })).status).toBe(NOT_FOUND_STATUS);
    });

    it("outlives both accounts", async () => {
      const sender = await createSignedInMember(database);
      const reporter = await createSignedInMember(database);
      const pairId = await seedConversation(database, sender.userId, reporter.userId);
      const reported = await send(sender, "Outlives us", pairId);
      await call(postReport, reporter, { messageId: reported.id });

      await database.delete(user).where(eq(user.id, sender.userId));
      await database.delete(user).where(eq(user.id, reporter.userId));

      const [row] = await database.select().from(messageReport);
      expect(row).toMatchObject({ messageBody: "Outlives us", messageId: null, reporterId: null, reportedMemberId: null });
    });
  });

  describe("banned members", () => {
    async function banBob(banExpires?: Date) {
      await database.update(user).set({ banned: true, banExpires }).where(eq(user.id, bob.userId));
    }

    async function unbanBob() {
      await database.update(user).set({ banned: false, banExpires: null }).where(eq(user.id, bob.userId));
    }

    it("refuses a message to a banned member, and shows they aren't available", async () => {
      await send(alice, "Before the ban");
      await banBob();
      try {
        const response = await call(postSend, alice, { conversationId, clientKey: randomUUID(), body: "Hello?" });

        expect(response.status).toBe(CONFLICT_STATUS);
        expect((await response.json()).code).toBe(MESSAGE_ERROR_CODES.peerUnavailable);
        expect((await readThread(alice)).peer.isAvailable).toBe(false);
        expect((await readChanges(alice, 0)).isPeerAvailable).toBe(false);
      } finally {
        await unbanBob();
      }
    });

    it("works again once a temporary ban ends", async () => {
      await banBob(new Date(Date.now() - 1000));
      try {
        expect((await send(alice, "Welcome back")).body).toBe("Welcome back");
        expect((await readThread(alice)).peer.isAvailable).toBe(true);
      } finally {
        await unbanBob();
      }
    });
  });

  describe("the inbox", () => {
    it("lists only conversations with a message, newest first, with a one-line preview", async () => {
      const silentId = await seedConversation(database, alice.userId, carol.userId);
      await send(alice, "first line\nsecond line");

      const inbox = await readInbox(alice);

      expect(inbox.map(({ id }) => id)).toEqual([conversationId]);
      expect(inbox[0]?.lastMessage).toMatchObject({ preview: "first line", isMine: true });
      expect(inbox.map(({ id }) => id)).not.toContain(silentId);
    });

    it("sorts by the latest message", async () => {
      const secondConversationId = await seedConversation(database, alice.userId, carol.userId);
      await seedMessages(database, { conversationId, senderId: bob.userId, count: 1, createdAt: new Date(Date.now() - 60_000) });
      await seedMessages(database, { conversationId: secondConversationId, senderId: carol.userId, count: 1 });

      expect((await readInbox(alice)).map(({ id }) => id)).toEqual([secondConversationId, conversationId]);
    });

    describe("pages", () => {
      async function seedConversations(count: number) {
        const peers = await Promise.all(Array.from({ length: count }, (_unused, position) => seedMember(database, { name: `Peer ${position}` })));
        for (const [position, peerId] of peers.entries()) {
          const pairId = await seedConversation(database, alice.userId, peerId);
          const createdAt = new Date(Date.now() - position * 60_000);
          await seedMessages(database, { conversationId: pairId, senderId: peerId, count: 1, createdAt });
        }
        return peers;
      }

      async function readAllPages(member: Member, search = "") {
        const pages: Inbox[] = [];
        let cursor: Inbox["nextCursor"] = null;
        do {
          const page: Inbox = inboxSchema.parse(await (await call(postInbox, member, { search, cursor })).json());
          pages.push(page);
          cursor = page.nextCursor;
        } while (cursor);
        return pages;
      }

      afterEach(async () => {
        await database.delete(user).where(like(user.email, "%@seeded.test"));
      });

      it("reaches every conversation, once each, newest first, past any one page", async () => {
        const total = MESSAGE_LIMITS.conversationsPerPage * 2 + 3;
        await seedConversations(total);

        const pages = await readAllPages(alice);
        const names = pages.flatMap(({ conversations }) => conversations.map(({ peer }) => peer.name));

        expect(pages).toHaveLength(3);
        expect(names).toHaveLength(total);
        expect(new Set(names).size).toBe(total);
        expect(names.slice(0, 2)).toEqual(["Peer 0", "Peer 1"]);
      });

      it("counts the same conversations in the pages and the badge", async () => {
        const total = MESSAGE_LIMITS.conversationsPerPage + 5;
        await seedConversations(total);

        const pages = await readAllPages(alice);
        const listedUnread = pages.flatMap(({ conversations }) => conversations).reduce((sum, { unreadCount }) => sum + unreadCount, 0);

        expect(listedUnread).toBe(total);
        expect(await readUnread(alice)).toBe(total);
      });

      it("keeps a banned member's thread reachable and read-only from a later page", async () => {
        const total = MESSAGE_LIMITS.conversationsPerPage + 2;
        const peers = await seedConversations(total);
        const oldestPeerId = peers.at(-1) ?? "";
        await database.update(user).set({ banned: true }).where(eq(user.id, oldestPeerId));

        const [, secondPage] = await readAllPages(alice);
        const summary = secondPage?.conversations.find(({ peer }) => peer.id === oldestPeerId);

        expect(summary?.peer.isAvailable).toBe(false);
        const thread = await readThread(alice, null, summary?.id);
        expect(thread.messages).toHaveLength(1);
        const refused = await call(postSend, alice, { conversationId: summary?.id, clientKey: randomUUID(), body: "Hello?" });
        expect(refused.status).toBe(CONFLICT_STATUS);
      });

      it("searches across every conversation, not only the loaded page", async () => {
        const total = MESSAGE_LIMITS.conversationsPerPage + 3;
        await seedConversations(total);

        const [firstPage] = await readAllPages(alice, `Peer ${total - 1}`);

        expect(firstPage?.conversations.map(({ peer }) => peer.name)).toEqual([`Peer ${total - 1}`]);
      });

      it("treats search wildcards as text", async () => {
        await seedConversations(2);

        const [firstPage] = await readAllPages(alice, "%");

        expect(firstPage?.conversations).toEqual([]);
      });
    });

    it("clips a very long preview", async () => {
      await send(alice, "a".repeat(MESSAGE_LIMITS.bodyLength));

      expect((await readInbox(bob))[0]?.lastMessage.preview).toHaveLength(MESSAGE_LIMITS.previewLength);
    });
  });

  describe("removing a member", () => {
    it("removes their conversations for good", async () => {
      const leaving = await createSignedInMember(database);
      const pairId = await seedConversation(database, alice.userId, leaving.userId);
      await seedMessages(database, { conversationId: pairId, senderId: leaving.userId, count: 2 });

      await database.delete(user).where(eq(user.id, leaving.userId));

      expect(await database.select().from(conversation).where(eq(conversation.id, pairId))).toEqual([]);
      expect(await database.select().from(directMessage).where(eq(directMessage.conversationId, pairId))).toEqual([]);
    });
  });
});
