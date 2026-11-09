import { describe, expect, it } from "vitest";

import { ASK_CATEGORIES, ASK_KINDS, ASK_LIMITS, ASK_STATES, composeAskReportBody, composeOfferMessage, describeNewOffers } from "./contract";
import { ASK_VIEWS, parseAskBoardFilters, toAskBoardQueryString } from "./rules-board-url";
import { canRenewAsk, readAskState, readExpiresAt } from "./rules-state";
import { describeAge, describeTimeLeft } from "./rules-time";

const NOW = new Date("2026-11-05T12:00:00.000Z");
const DAY_MS = 24 * 60 * 60 * 1000;

function daysAgo(days: number) {
  return new Date(NOW.getTime() - days * DAY_MS);
}

describe("the state of an ask", () => {
  it("is open inside 30 days", () => {
    expect(readAskState({ listedAt: daysAgo(ASK_LIMITS.lifetimeDays - 1), closedAt: null }, NOW)).toBe(ASK_STATES.open);
  });

  it("is expired at exactly 30 days", () => {
    expect(readAskState({ listedAt: daysAgo(ASK_LIMITS.lifetimeDays), closedAt: null }, NOW)).toBe(ASK_STATES.expired);
  });

  it("is closed once closed, however old", () => {
    expect(readAskState({ listedAt: daysAgo(ASK_LIMITS.lifetimeDays + 5), closedAt: NOW }, NOW)).toBe(ASK_STATES.closed);
  });

  it("expires 30 days after its listing", () => {
    expect(readExpiresAt(NOW).getTime() - NOW.getTime()).toBe(ASK_LIMITS.lifetimeDays * DAY_MS);
  });
});

describe("renewing", () => {
  it("opens in the last days of an ask", () => {
    expect(canRenewAsk({ listedAt: daysAgo(ASK_LIMITS.lifetimeDays - ASK_LIMITS.renewableWithinDays), closedAt: null }, NOW)).toBe(true);
  });

  it("stays shut before that", () => {
    expect(canRenewAsk({ listedAt: daysAgo(ASK_LIMITS.lifetimeDays - ASK_LIMITS.renewableWithinDays - 1), closedAt: null }, NOW)).toBe(false);
  });

  it("stays open after expiry", () => {
    expect(canRenewAsk({ listedAt: daysAgo(ASK_LIMITS.lifetimeDays + 40), closedAt: null }, NOW)).toBe(true);
  });

  it("never applies to a closed ask", () => {
    expect(canRenewAsk({ listedAt: daysAgo(ASK_LIMITS.lifetimeDays + 1), closedAt: NOW }, NOW)).toBe(false);
  });
});

describe("age words", () => {
  it.each([
    [10 * 60 * 1000, "just now"],
    [5 * 60 * 60 * 1000, "today"],
    [DAY_MS + 1000, "yesterday"],
    [3 * DAY_MS + 1000, "3 days ago"],
  ])("describes %i ms as %s", (elapsedMs, words) => {
    expect(describeAge(new Date(NOW.getTime() - elapsedMs).toISOString(), NOW.getTime())).toBe(words);
  });

  it("counts the days left", () => {
    expect(describeTimeLeft(new Date(NOW.getTime() + 12 * DAY_MS).toISOString(), NOW.getTime())).toBe("12 days left on the board");
  });

  it("warns on the last day", () => {
    expect(describeTimeLeft(new Date(NOW.getTime() + DAY_MS / 2).toISOString(), NOW.getTime())).toBe("Comes down within a day");
  });

  it("names the date once it has come down", () => {
    expect(describeTimeLeft(daysAgo(2).toISOString(), NOW.getTime())).toBe("Came down on Nov 3");
  });
});

describe("the board URL", () => {
  it("defaults to every open ask", () => {
    expect(parseAskBoardFilters({})).toEqual({ view: ASK_VIEWS.board, category: null, kind: null });
  });

  it("reads a view and a category", () => {
    expect(parseAskBoardFilters({ view: "yours", category: "hire" })).toEqual({ view: ASK_VIEWS.yours, category: ASK_CATEGORIES.hire, kind: null });
  });

  it("ignores values it doesn't know", () => {
    expect(parseAskBoardFilters({ view: "<script>", category: "investor" })).toEqual({ view: ASK_VIEWS.board, category: null, kind: null });
  });

  it("round trips", () => {
    const filters = { view: ASK_VIEWS.board, category: ASK_CATEGORIES.advice, kind: null };

    expect(toAskBoardQueryString(filters)).toBe("?category=advice");
  });

  it("keeps the updates filter", () => {
    expect(parseAskBoardFilters({ kind: "update" })).toEqual({ view: ASK_VIEWS.board, category: null, kind: ASK_KINDS.update });
    expect(toAskBoardQueryString({ view: ASK_VIEWS.board, category: null, kind: ASK_KINDS.update })).toBe("?kind=update");
  });

  it("stays clean with no filters", () => {
    expect(toAskBoardQueryString({ view: ASK_VIEWS.board, category: null, kind: null })).toBe("");
  });
});

describe("the words", () => {
  it("names the ask in a message", () => {
    expect(composeOfferMessage("A CFO", "I know one.")).toBe('About your ask, "A CFO":\n\nI know one.');
  });

  it("joins title and detail for a report", () => {
    expect(composeAskReportBody("A CFO", "Soon.")).toBe("A CFO\n\nSoon.");
    expect(composeAskReportBody("A CFO", null)).toBe("A CFO");
  });

  it("uses correct grammar in the badge", () => {
    expect(describeNewOffers(1)).toBe("1 new offer of help");
    expect(describeNewOffers(2)).toBe("2 new offers of help");
  });
});
