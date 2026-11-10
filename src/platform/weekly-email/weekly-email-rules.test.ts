import { describe, expect, it } from "vitest";

import { findMatchedWords, readWords } from "../../modules/asks/rules-help-match.ts";
import { parseReplyCodes, readEmailAddress } from "./reply-codes.ts";
import { parseWeeklySchedule, readCurrentWeek, readNextSend } from "./schedule.ts";

describe("the weekly schedule", () => {
  const thursdayNine = { weekday: 4, hour: 9, timeZone: "UTC" };

  it("names the week by the local date of its last send time", () => {
    expect(readCurrentWeek(new Date("2026-11-12T09:00:00Z"), thursdayNine)?.weekKey).toBe("2026-11-12");
    expect(readCurrentWeek(new Date("2026-11-18T23:59:00Z"), thursdayNine)?.weekKey).toBe("2026-11-12");
    expect(readCurrentWeek(new Date("2026-11-12T08:59:00Z"), thursdayNine)?.weekKey).toBe("2026-11-05");
  });

  it("meets the hour in a half-hour time zone, and across a clock change", () => {
    const india = { weekday: 4, hour: 9, timeZone: "Asia/Kolkata" };
    expect(readCurrentWeek(new Date("2026-11-12T03:30:00Z"), india)?.at.toISOString()).toBe("2026-11-12T03:30:00.000Z");
    const london = { weekday: 0, hour: 9, timeZone: "Europe/London" };
    expect(readNextSend(new Date("2026-03-28T12:00:00Z"), london)?.at.toISOString()).toBe("2026-03-29T08:00:00.000Z");
  });

  it("sends right after the gap on a day the clocks skip the set hour", () => {
    const newYork = { weekday: 0, hour: 2, timeZone: "America/New_York" };
    expect(readNextSend(new Date("2027-03-13T12:00:00Z"), newYork)?.at.toISOString()).toBe("2027-03-14T07:00:00.000Z");
    expect(readCurrentWeek(new Date("2027-03-14T08:00:00Z"), newYork)?.weekKey).toBe("2027-03-14");
  });

  it("falls back to Thursday 09:00 UTC, one field at a time", () => {
    expect(parseWeeklySchedule(new Map())).toEqual(thursdayNine);
    expect(parseWeeklySchedule(new Map([["weekly_email_hour", "17"], ["weekly_email_time_zone", "Not/AZone"]]))).toEqual({ ...thursdayNine, hour: 17 });
  });
});

describe("reply codes", () => {
  it("reads the codes at the top, one per line, and the words that go with them", () => {
    expect(parseReplyCodes("help 1 glad to\nSKIP #3\n\nThanks!\n\nOn Thu, Northwind wrote:\n> HELP 2")).toEqual([
      { code: "help", itemNumber: 1, words: "glad to" },
      { code: "skip", itemNumber: 3, words: "Thanks!" },
    ]);
  });

  it("reads nothing when the first line isn't a code", () => {
    expect(parseReplyCodes("Thanks for this!\nHELP 1")).toEqual([]);
    expect(parseReplyCodes("> HELP 1")).toEqual([]);
  });

  it("reads the sender's address from a display name", () => {
    expect(readEmailAddress("Hana Helper <Hana@Example.com>")).toBe("hana@example.com");
  });
});

describe("matching asks to helpers", () => {
  it("matches on shared words, singular or plural, never on common ones", () => {
    const words = readWords("Investors, hiring and help with intros");
    expect(findMatchedWords("Looking for an investor who can help", words)).toEqual(["investors"]);
    expect(findMatchedWords("Need help with anything", words)).toEqual([]);
  });

  it("drops everyday words and keeps real skills", () => {
    expect([...readWords("First hires, team help with anything")]).toEqual(["hires"]);
    expect(findMatchedWords("Our first team offsite", readWords("first team building"))).toEqual([]);
    expect(findMatchedWords("Pricing and fundraising advice", readWords("fundraising, pricing"))).toEqual(["fundraising", "pricing"]);
  });
});
