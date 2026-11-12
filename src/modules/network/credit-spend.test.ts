import { afterAll, beforeEach, describe, expect, it } from "vitest";

import { readCreditSpend } from "@/modules/network/reads-village-admin";
import { CREDIT_CALL_KINDS } from "@/platform/village/contract";
import { villageCreditCall } from "@/platform/village/schema";
import { clearDatabase, createTestDatabase } from "@/test/database";
import { nameMember } from "@/test/intros";
import { createSignedInMember } from "@/test/signed-in-member";

const NOW = new Date("2026-11-12T15:00:00Z");
const at = (iso: string) => new Date(iso);

// NET-12: the admin sees credits per day and per member, not only the month's total.
describe("credits per day and per member", () => {
  const database = createTestDatabase();

  beforeEach(async () => {
    await clearDatabase(database);
    await database.delete(villageCreditCall);
  });

  afterAll(async () => {
    await database.$client.end();
  });

  it("sums the last 30 UTC days by day and by member, fill-in on its own line", async () => {
    const ada = await createSignedInMember(database);
    const sam = await createSignedInMember(database);
    await nameMember(database, ada.userId, "Ada Example");
    await nameMember(database, sam.userId, "Sam Example");
    await database.insert(villageCreditCall).values([
      { kind: CREDIT_CALL_KINDS.search, credits: 10, userId: ada.userId, calledAt: at("2026-11-12T09:00:00Z") },
      { kind: CREDIT_CALL_KINDS.path, credits: 2, userId: ada.userId, calledAt: at("2026-11-12T23:30:00Z") },
      { kind: CREDIT_CALL_KINDS.search, credits: 10, userId: sam.userId, calledAt: at("2026-11-11T23:59:00Z") },
      { kind: CREDIT_CALL_KINDS.fillIn, credits: 1, userId: null, calledAt: at("2026-11-11T03:00:00Z") },
      // Older than 30 days: left out.
      { kind: CREDIT_CALL_KINDS.search, credits: 10, userId: sam.userId, calledAt: at("2026-10-13T12:00:00Z") },
    ]);

    const spend = await readCreditSpend(database, NOW);

    expect(spend.days).toEqual([
      { day: "2026-11-12", credits: 12, lookups: 2 },
      { day: "2026-11-11", credits: 11, lookups: 2 },
    ]);
    expect(spend.members).toEqual([
      { id: ada.userId, name: "Ada Example", credits: 12, lookups: 2 },
      { id: sam.userId, name: "Sam Example", credits: 10, lookups: 1 },
      { id: "app", name: null, credits: 1, lookups: 1 },
    ]);
  });
});
