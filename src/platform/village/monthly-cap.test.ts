import { eq } from "drizzle-orm";
import { beforeEach, describe, expect, it } from "vitest";

import { clearDatabase, createTestDatabase } from "@/test/database";
import { createSignedInMember } from "@/test/signed-in-member";
import { FAKE_RESEND_API_KEY } from "@/test/fake-resend-server";
import { emailOutbox } from "../email/schema";
import { EMAIL_KINDS } from "../email/kinds";
import { memberDailyUsage, villageMonthlyUsage } from "./schema";
import { CREDIT_CALL_KINDS } from "./contract";
import { MonthlyCapReachedError, readMonthlyCreditUsage, withCreditCall } from "./credit-ledger";
import { saveMonthlyCreditCap } from "./settings";

const ENVIRONMENT = {
  APP_URL: "http://localhost:3000",
  RESEND_API_KEY: FAKE_RESEND_API_KEY,
  RESEND_FROM_ADDRESS: "Northwind <hello@example.com>",
  RESEND_API_URL: "http://127.0.0.1:9",
};

const PARALLEL_CALLS = 30;
const SEARCHES_UNDER_A_CAP_OF_100 = 9;

describe("the monthly credit cap", () => {
  const database = createTestDatabase();

  beforeEach(async () => {
    await clearDatabase(database);
    await database.delete(villageMonthlyUsage);
  });

  function spend(memberId: string | null, kind: (typeof CREDIT_CALL_KINDS)[keyof typeof CREDIT_CALL_KINDS] = CREDIT_CALL_KINDS.fillIn) {
    return withCreditCall({ database, environment: ENVIRONMENT, memberId }, kind, async () => "charged");
  }

  it("lets exactly the cap through when calls arrive at once", async () => {
    await saveMonthlyCreditCap(database, 20);

    const outcomes = await Promise.allSettled(Array.from({ length: PARALLEL_CALLS }, () => spend(null)));

    expect(outcomes.filter(({ status }) => status === "fulfilled")).toHaveLength(20);
    const refusals = outcomes.flatMap((outcome) => (outcome.status === "rejected" ? [outcome.reason] : []));
    expect(refusals).toHaveLength(10);
    expect(refusals.every((reason) => reason instanceof MonthlyCapReachedError)).toBe(true);
    expect((await readMonthlyCreditUsage(database)).credits).toBe(20);
  });

  it("blocks a search the cap can't fit, and leaves the member's day untouched", async () => {
    const member = await createSignedInMember(database);
    await saveMonthlyCreditCap(database, 100);

    for (let search = 0; search < SEARCHES_UNDER_A_CAP_OF_100; search += 1) await spend(member.userId, CREDIT_CALL_KINDS.search);
    await expect(spend(member.userId, CREDIT_CALL_KINDS.search)).rejects.toBeInstanceOf(MonthlyCapReachedError);

    expect((await readMonthlyCreditUsage(database)).credits).toBe(99);
    const [day] = await database.select().from(memberDailyUsage).where(eq(memberDailyUsage.userId, member.userId));
    expect(day?.callCount).toBe(SEARCHES_UNDER_A_CAP_OF_100);
  });

  it("gives the credits back when Village says nothing was charged", async () => {
    await saveMonthlyCreditCap(database, 20);

    await withCreditCall({ database, environment: ENVIRONMENT, memberId: null }, CREDIT_CALL_KINDS.fillIn, async () => null, (result) => result !== null);

    expect((await readMonthlyCreditUsage(database)).credits).toBe(0);
  });

  it("emails each admin once at 80% and once at 100%, even with parallel calls", async () => {
    const firstAdmin = await createSignedInMember(database, "admin");
    const secondAdmin = await createSignedInMember(database, "admin");
    await createSignedInMember(database);
    await saveMonthlyCreditCap(database, 20);

    await Promise.allSettled(Array.from({ length: PARALLEL_CALLS }, () => spend(null)));
    await Promise.allSettled(Array.from({ length: 5 }, () => spend(null)));

    const warnings = await database.select().from(emailOutbox).where(eq(emailOutbox.kind, EMAIL_KINDS.creditWarning));
    expect(warnings.map(({ toEmail }) => toEmail).toSorted()).toEqual([firstAdmin.email, firstAdmin.email, secondAdmin.email, secondAdmin.email].toSorted());
    expect(warnings.filter(({ subject }) => subject.includes("80%"))).toHaveLength(2);
    expect(warnings.filter(({ subject }) => subject.includes("reached its monthly"))).toHaveLength(2);
    const usage = await readMonthlyCreditUsage(database);
    expect(usage.warnedNearCapAt).toBeInstanceOf(Date);
    expect(usage.warnedAtCapAt).toBeInstanceOf(Date);
  });

  it("sends only the 80% email while under the cap", async () => {
    await createSignedInMember(database, "admin");
    await saveMonthlyCreditCap(database, 20);

    for (let call = 0; call < 17; call += 1) await spend(null);

    const warnings = await database.select().from(emailOutbox).where(eq(emailOutbox.kind, EMAIL_KINDS.creditWarning));
    expect(warnings.map(({ subject }) => subject)).toEqual([expect.stringContaining("80%")]);
  });

  it("sends no warning when a big call is refused while usage is still low", async () => {
    await createSignedInMember(database, "admin");
    await saveMonthlyCreditCap(database, 20);
    for (let call = 0; call < 10; call += 1) await spend(null);

    await expect(spend(null, CREDIT_CALL_KINDS.search)).rejects.toBeInstanceOf(MonthlyCapReachedError);

    expect(await database.select().from(emailOutbox).where(eq(emailOutbox.kind, EMAIL_KINDS.creditWarning))).toEqual([]);
    for (let call = 0; call < 6; call += 1) await spend(null);
    const warnings = await database.select().from(emailOutbox).where(eq(emailOutbox.kind, EMAIL_KINDS.creditWarning));
    expect(warnings.map(({ subject }) => subject)).toEqual([expect.stringContaining("80%")]);
  });
});
