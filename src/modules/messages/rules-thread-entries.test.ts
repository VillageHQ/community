import { describe, expect, it } from "vitest";

import type { DirectMessage } from "./contract";
import { formatConversationTime, formatMessageDay, formatMessageTime } from "./rules-time";
import { PENDING_STATUSES, type PendingMessage } from "./rules-thread-cache";
import { buildThreadEntries, describeNewMessages, readNewestPeerSequence } from "./rules-thread-entries";
import { toConversationPair } from "./rules-conversation-pair";
import { readInboxPollMs } from "@/platform/http/polling";
import {
  readThreadPollMs,
  THREAD_CATCH_UP_POLL_MS,
  THREAD_POLL_AFTER_FAILURE_MS,
  THREAD_POLL_MS,
} from "./rules-polling";

const TIME_ZONE = "America/Sao_Paulo";
const NOW = new Date("2026-11-05T15:00:00.000Z");
const TODAY = "2026-11-05T14:00:00.000Z";
const YESTERDAY = "2026-11-04T14:00:00.000Z";
const THREE_DAYS_AGO = "2026-11-02T14:00:00.000Z";
const LONG_AGO = "2026-10-20T14:00:00.000Z";

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
    createdAt: TODAY,
    ...overrides,
  };
}

function build(messages: DirectMessage[], pending: PendingMessage[] = []) {
  return buildThreadEntries({ messages, pending, timeZone: TIME_ZONE, now: NOW });
}

describe("thread entries", () => {
  describe("day labels", () => {
    it("label the first message of each day only", () => {
      const entries = build([
        makeMessage(1, { createdAt: YESTERDAY }),
        makeMessage(2, { createdAt: YESTERDAY }),
        makeMessage(3, { createdAt: TODAY }),
      ]);

      expect(entries.map(({ dayLabel }) => dayLabel)).toEqual(["Yesterday", null, "Today"]);
    });

    it("use the member's time zone, not the server's", () => {
      const lateEvening = "2026-11-05T02:00:00.000Z";

      expect(formatMessageDay(lateEvening, TIME_ZONE, NOW)).toBe("Yesterday");
      expect(formatMessageDay(lateEvening, "UTC", NOW)).toBe("Today");
    });

    it("name recent days and date older ones", () => {
      expect(formatMessageDay(THREE_DAYS_AGO, TIME_ZONE, NOW)).toBe("Monday");
      expect(formatMessageDay(LONG_AGO, TIME_ZONE, NOW)).toBe("Oct 20");
    });
  });

  describe("conversation times", () => {
    it("show a clock time today, a weekday this week and a date after that", () => {
      expect(formatConversationTime(TODAY, TIME_ZONE, NOW)).toBe(formatMessageTime(TODAY, TIME_ZONE));
      expect(formatConversationTime(THREE_DAYS_AGO, TIME_ZONE, NOW)).toBe("Mon");
      expect(formatConversationTime(LONG_AGO, TIME_ZONE, NOW)).toBe("Oct 20");
    });
  });

  describe("runs", () => {
    it("end when the sender changes", () => {
      const entries = build([makeMessage(1), makeMessage(2), makeMessage(3, { isMine: true })]);

      expect(entries.map(({ isRunEnd }) => isRunEnd)).toEqual([false, true, true]);
    });
  });

  describe("pending messages", () => {
    const PENDING: PendingMessage = {
      clientKey: "22222222-2222-4222-8222-222222222222",
      body: "On its way",
      status: PENDING_STATUSES.sending,
      failureMessage: null,
      createdAt: TODAY,
    };

    it("follow the confirmed messages", () => {
      expect(build([makeMessage(1)], [PENDING]).map(({ body }) => body)).toEqual(["Message 1", "On its way"]);
    });

    it("keep their key after the server confirms them, so the bubble doesn't remount", () => {
      const [pendingEntry] = build([], [PENDING]);
      const [confirmedEntry] = build([makeMessage(1, { isMine: true, clientKey: PENDING.clientKey })], [PENDING]);

      expect(confirmedEntry?.key).toBe(pendingEntry?.key);
    });

    it("disappear once confirmed", () => {
      const entries = build([makeMessage(1, { isMine: true, clientKey: PENDING.clientKey, body: "On its way" })], [PENDING]);

      expect(entries).toHaveLength(1);
      expect(entries[0]?.message).not.toBeNull();
    });
  });

  describe("announcements", () => {
    it("name the sender and only the new text", () => {
      const messages = [makeMessage(1, { body: "Old" }), makeMessage(2, { body: "Fresh" })];

      expect(describeNewMessages(messages, 1, "Noor")).toBe("New from Noor: Fresh");
    });

    it("leave out your own and deleted messages", () => {
      const messages = [makeMessage(2, { isMine: true }), makeMessage(3, { isDeleted: true, body: null })];

      expect(describeNewMessages(messages, 1, "Noor")).toBe("");
    });

    it("summarize a burst instead of reading it all", () => {
      const messages = [makeMessage(2), makeMessage(3), makeMessage(4), makeMessage(5)];

      expect(describeNewMessages(messages, 1, "Noor")).toBe("4 new messages from Noor.");
    });

    it("clip a long message and strip bidi controls", () => {
      const messages = [makeMessage(2, { body: `‮${"a".repeat(500)}` })];

      const announcement = describeNewMessages(messages, 1, "Noor");

      expect(announcement).not.toContain("‮");
      expect(announcement.length).toBeLessThan(320);
    });

    it("track only the other member's messages", () => {
      expect(readNewestPeerSequence([makeMessage(1), makeMessage(2, { isMine: true })])).toBe(1);
    });
  });
});

describe("the conversation pair", () => {
  it("comes out the same in either order", () => {
    expect(toConversationPair("b", "a")).toEqual(toConversationPair("a", "b"));
  });

  it("sorts by code unit, so case can't flip it", () => {
    expect(toConversationPair("a", "Z")).toEqual({ memberLowId: "Z", memberHighId: "a" });
  });
});

describe("message polling", () => {
  it("polls an open thread fast, and slows down after a failure", () => {
    expect(readThreadPollMs({ hasFailed: false, hasMore: false })).toBe(THREAD_POLL_MS);
    expect(readThreadPollMs({ hasFailed: true, hasMore: false })).toBe(THREAD_POLL_AFTER_FAILURE_MS);
  });

  it("catches up quickly when more changes are waiting", () => {
    expect(readThreadPollMs({ hasFailed: false, hasMore: true })).toBe(THREAD_CATCH_UP_POLL_MS);
  });

  it("polls everywhere else more slowly than an open thread", () => {
    expect(readInboxPollMs(false)).toBeGreaterThan(THREAD_POLL_MS);
    expect(readInboxPollMs(true)).toBeGreaterThan(readInboxPollMs(false));
  });
});
