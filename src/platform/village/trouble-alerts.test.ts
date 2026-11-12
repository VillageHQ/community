import { VillageError } from "@villagehq/sdk";
import { eq } from "drizzle-orm";
import { afterAll, afterEach, beforeEach, describe, expect, it, vi } from "vitest";

import { readAdminTabFacts } from "@/shell/admin-badges";
import { ADMIN_HOME_ITEMS, readAdminHomeItems } from "@/shell/admin-home";
import { clearDatabase, createTestDatabase } from "@/test/database";
import { FAKE_RESEND_API_KEY } from "@/test/fake-resend-server";
import { createSignedInMember } from "@/test/signed-in-member";
import { EMAIL_KINDS } from "../email/kinds";
import { emailOutbox } from "../email/schema";
import { ROUTES } from "../http/routes";
import { INSTANCE_SETTING_KEYS, instanceSettings } from "../settings/schema";
import { recordVillageOutcome } from "./health";
import { respondToVillageError } from "./route-errors";
import { clearVillageOutOfCredits } from "./settings";
import { VILLAGE_ALERT_EVERY_MS } from "./trouble-alerts";

const OUT_OF_CREDITS = new VillageError({ code: "out_of_credits", message: "402" });
const DOWN = new VillageError({ code: "server", message: "500" });
const KEYS = new VillageError({ code: "unauthorized", message: "401" });

describe("telling admins when Village stops working (NET-09)", () => {
  const database = createTestDatabase();

  async function alerts() {
    return database.select({ to: emailOutbox.toEmail, subject: emailOutbox.subject }).from(emailOutbox).where(eq(emailOutbox.kind, EMAIL_KINDS.villageAlert));
  }

  async function ageAlert(key: string) {
    await database
      .update(instanceSettings)
      .set({ updatedAt: new Date(Date.now() - VILLAGE_ALERT_EVERY_MS - 60_000) })
      .where(eq(instanceSettings.key, key));
  }

  beforeEach(async () => {
    await clearDatabase(database);
    vi.stubEnv("APP_URL", "http://localhost:3000");
    vi.stubEnv("RESEND_API_KEY", FAKE_RESEND_API_KEY);
    vi.stubEnv("RESEND_FROM_ADDRESS", "Northwind <hello@example.com>");
    vi.stubEnv("RESEND_API_URL", "http://127.0.0.1:9");
  });

  afterEach(() => {
    vi.unstubAllEnvs();
  });

  afterAll(async () => {
    await database.$client.end();
  });

  it("emails each admin once when the credits run out, however many searches hit it", async () => {
    const admin = await createSignedInMember(database, "admin");
    await createSignedInMember(database);

    for (let search = 0; search < 5; search += 1) {
      const response = await respondToVillageError(database, OUT_OF_CREDITS);
      expect(response?.status).toBe(502);
    }

    const sent = await alerts();
    expect(sent).toHaveLength(1);
    expect(sent[0]).toMatchObject({ to: admin.email, subject: expect.stringContaining("Village is out of credits") });
  });

  it("says so on the console's Home until a charged call works again", async () => {
    await respondToVillageError(database, OUT_OF_CREDITS);

    const creditItems = async () =>
      readAdminHomeItems(await readAdminTabFacts(database, process.env), { pendingInvites: 0, stuckIntros: 0, isNetworkOn: true }).filter(({ id }) => id === ADMIN_HOME_ITEMS.villageCredits);

    expect(await creditItems()).toEqual([expect.objectContaining({ href: ROUTES.adminVillage, isUrgent: true, label: "Village is out of credits: lookups are paused" })]);
    await clearVillageOutOfCredits(database);
    expect(await creditItems()).toEqual([]);
  });

  it("emails again for a new spell only after a day, so a flapping Village never floods the admins", async () => {
    await createSignedInMember(database, "admin");
    await respondToVillageError(database, OUT_OF_CREDITS);
    await clearVillageOutOfCredits(database);
    await respondToVillageError(database, OUT_OF_CREDITS);
    expect(await alerts()).toHaveLength(1);

    await clearVillageOutOfCredits(database);
    await ageAlert(INSTANCE_SETTING_KEYS.villageAlertedOutOfCreditsAt);
    await respondToVillageError(database, OUT_OF_CREDITS);
    expect(await alerts()).toHaveLength(2);
  });

  it("emails once when Village stops answering, and once more if it then refuses the keys", async () => {
    await createSignedInMember(database, "admin");

    await recordVillageOutcome(database, DOWN);
    await recordVillageOutcome(database, DOWN);
    await recordVillageOutcome(database, DOWN);
    expect((await alerts()).map(({ subject }) => subject)).toEqual([expect.stringContaining("Village isn't answering")]);

    await recordVillageOutcome(database, KEYS);
    expect(await alerts()).toHaveLength(2);

    // Back up, then down again the same day: the console says so, but no second email.
    await recordVillageOutcome(database, null);
    await recordVillageOutcome(database, DOWN);
    expect(await alerts()).toHaveLength(2);
  });

  it("sends nothing while email is off, and the console still says so", async () => {
    vi.stubEnv("RESEND_API_KEY", "");
    await createSignedInMember(database, "admin");

    await respondToVillageError(database, OUT_OF_CREDITS);

    expect(await alerts()).toEqual([]);
    expect((await readAdminTabFacts(database, process.env)).villageOutOfCreditsAt).not.toBeNull();
  });
});
