import { describe, expect, it } from "vitest";

import type { DirectMessage, ThreadChanges, ThreadPage } from "./contract";
import {
  addPending,
  applyThreadChanges,
  clearConversationUnread,
  failPending,
  keepUnconfirmedPending,
  mergeMessages,
  PENDING_STATUSES,
  readInboxConversations,
  readThreadMessages,
  removePending,
  type PendingMessage,
  type ThreadPages,
} from "./rules-thread-cache";

const CREATED_AT = "2026-11-05T12:00:00.000Z";

function makeMessage(sequence: number, overrides: Partial<DirectMessage> = {}): DirectMessage {
  return {
    id: `00000000-0000-4000-8000-${String(sequence).padStart(12, "0")}`,
    isMine: false,
    body: `Message ${sequence}`,
    isDeleted: false,
    isReported: false,
    sequence,
    clientKey: null,
    createdAt: CREATED_AT,
    ...overrides,
  };
}

function makePage(messages: DirectMessage[], overrides: Partial<ThreadPage> = {}): ThreadPage {
  return {
    conversationId: "11111111-1111-4111-8111-111111111111",
    peer: { id: "noor", name: "Noor Haddad", title: null, company: null, avatarUrl: null, isAvailable: true },
    isBlockedByMe: false,
    messages,
    olderCursor: null,
    revision: messages.at(-1)?.sequence ?? 0,
    lastReadSequence: 0,
    ...overrides,
  };
}

function makeThread(...pages: ThreadPage[]): ThreadPages {
  return { pages, pageParams: pages.map(() => null) };
}

function makePending(clientKey: string): PendingMessage {
  return { clientKey, body: "Hi", status: PENDING_STATUSES.sending, failureMessage: null, createdAt: CREATED_AT };
}

function readSequences(thread: ThreadPages) {
  return readThreadMessages(thread).map(({ sequence }) => sequence);
}

describe("the thread cache", () => {
  describe("merging", () => {
    it("adds a new message after the ones already loaded", () => {
      const thread = makeThread(makePage([makeMessage(1), makeMessage(2)]));

      expect(readSequences(mergeMessages(thread, [makeMessage(3)]))).toEqual([1, 2, 3]);
    });

    it("keeps one copy when the same message arrives twice", () => {
      const thread = makeThread(makePage([makeMessage(1)]));

      const merged = mergeMessages(mergeMessages(thread, [makeMessage(2)]), [makeMessage(2)]);

      expect(readSequences(merged)).toEqual([1, 2]);
    });

    it("puts messages that arrive out of order back in order", () => {
      const thread = makeThread(makePage([makeMessage(1)]));

      expect(readSequences(mergeMessages(thread, [makeMessage(3), makeMessage(2)]))).toEqual([1, 2, 3]);
    });

    it("replaces a deleted message on any loaded page", () => {
      const thread = makeThread(makePage([makeMessage(5)], { olderCursor: 5 }), makePage([makeMessage(4)]));

      const merged = mergeMessages(thread, [makeMessage(4, { isDeleted: true, body: null })]);

      expect(readThreadMessages(merged)[0]).toMatchObject({ sequence: 4, isDeleted: true, body: null });
    });

    it("leaves out a change to a message older than the loaded pages", () => {
      const thread = makeThread(makePage([makeMessage(50)], { olderCursor: 50 }));

      expect(readSequences(mergeMessages(thread, [makeMessage(2, { isDeleted: true, body: null })]))).toEqual([50]);
    });
  });

  describe("applying changes", () => {
    const CHANGES: ThreadChanges = {
      messages: [makeMessage(2)],
      revision: 7,
      hasMore: false,
      isBlockedByMe: true,
      isPeerAvailable: false,
    };

    it("moves the cursor and the conversation's state", () => {
      const [page] = applyThreadChanges(makeThread(makePage([makeMessage(1)])), CHANGES).pages;

      expect(page).toMatchObject({ revision: 7, isBlockedByMe: true });
      expect(page?.peer.isAvailable).toBe(false);
    });

    it("never moves the cursor backwards", () => {
      const thread = makeThread(makePage([makeMessage(1)], { revision: 9 }));

      expect(applyThreadChanges(thread, CHANGES).pages[0]?.revision).toBe(9);
    });
  });

  describe("pending messages", () => {
    it("drops a pending message once the server confirms its key", () => {
      const pending = [makePending("first"), makePending("second")];

      const remaining = keepUnconfirmedPending(pending, [makeMessage(1, { isMine: true, clientKey: "first" })]);

      expect(remaining.map(({ clientKey }) => clientKey)).toEqual(["second"]);
    });

    it("keeps one entry when a retry reuses a key", () => {
      const failed = failPending([makePending("first")], "first", "Offline");

      const retried = addPending(failed, makePending("first"));

      expect(retried).toHaveLength(1);
      expect(retried[0]?.status).toBe(PENDING_STATUSES.sending);
    });

    it("records why a send failed", () => {
      expect(failPending([makePending("first")], "first", "Offline")[0]).toMatchObject({
        status: PENDING_STATUSES.failed,
        failureMessage: "Offline",
      });
    });

    it("discards by key", () => {
      expect(removePending([makePending("first")], "first")).toEqual([]);
    });
  });

  describe("the inbox", () => {
    const SUMMARY = {
      id: "11111111-1111-4111-8111-111111111111",
      peer: { id: "noor", name: "Noor Haddad", title: null, company: null, avatarUrl: null, isAvailable: true },
      isBlockedByMe: false,
      unreadCount: 3,
      lastMessage: { preview: "Hi", isMine: false, isDeleted: false, createdAt: CREATED_AT },
    };

    it("clears one conversation's unread count on whichever page holds it", () => {
      const inbox = {
        pages: [
          { conversations: [], nextCursor: { lastMessageAt: CREATED_AT, conversationId: SUMMARY.id } },
          { conversations: [SUMMARY], nextCursor: null },
        ],
        pageParams: [null, null],
      };

      expect(readInboxConversations(clearConversationUnread(inbox, SUMMARY.id))[0]?.unreadCount).toBe(0);
    });

    it("lists a conversation once when it moves between pages", () => {
      const inbox = {
        pages: [
          { conversations: [SUMMARY], nextCursor: null },
          { conversations: [{ ...SUMMARY, unreadCount: 9 }], nextCursor: null },
        ],
        pageParams: [null, null],
      };

      expect(readInboxConversations(inbox)).toEqual([SUMMARY]);
    });
  });
});
