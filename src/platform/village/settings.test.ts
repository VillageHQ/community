import { eq } from "drizzle-orm";
import { afterAll, afterEach, beforeEach, describe, expect, it, vi } from "vitest";

import { POST as readNetworkStatus } from "@/app/api/network/status/route";
import { NETWORK_STAGES } from "@/modules/network/contract";
import { readSetupProgress, SETUP_STEPS } from "@/shell/admin-setup";
import { createSignedInMember } from "@/test/signed-in-member";

import { clearDatabase, createTestDatabase } from "../../test/database.ts";
import { INSTANCE_SETTING_KEYS, instanceSettings } from "../settings/schema.ts";
import { readVillageKeyState, readVillageKeys, saveVillageKeys, VILLAGE_KEY_STATUSES } from "./settings.ts";

const APP_URL = "http://localhost:3000";
const TOKEN = "a-strong-setup-token-with-more-than-32-characters";
const NEW_TOKEN = "another-strong-setup-token-with-more-than-32-characters";
const WEAK_TOKEN = "change-me";
const KEYS = { publicKey: "pk_test", secretKey: "sk_test_secret" };

describe("the Village keys at rest", () => {
  const database = createTestDatabase();

  async function readStoredSecret() {
    const [row] = await database.select({ value: instanceSettings.value }).from(instanceSettings).where(eq(instanceSettings.key, INSTANCE_SETTING_KEYS.villageSecretKey));
    return row?.value ?? null;
  }

  async function storePlaintextKeys() {
    await database.insert(instanceSettings).values([
      { key: INSTANCE_SETTING_KEYS.villagePublicKey, value: KEYS.publicKey },
      { key: INSTANCE_SETTING_KEYS.villageSecretKey, value: KEYS.secretKey },
    ]);
  }

  beforeEach(async () => {
    await clearDatabase(database);
    vi.spyOn(console, "error").mockImplementation(() => undefined);
    vi.stubEnv("SETUP_TOKEN", TOKEN);
  });

  afterEach(() => {
    vi.unstubAllEnvs();
    vi.restoreAllMocks();
  });

  afterAll(async () => {
    await database.$client.end();
  });

  describe("with a usable setup token", () => {
    it("stores the secret sealed and reads it back", async () => {
      await saveVillageKeys(database, KEYS);

      expect(await readStoredSecret()).not.toContain(KEYS.secretKey);
      expect(await readVillageKeys(database)).toEqual(KEYS);
    });

    it("leaves the public key readable", async () => {
      await saveVillageKeys(database, KEYS);

      const [row] = await database.select({ value: instanceSettings.value }).from(instanceSettings).where(eq(instanceSettings.key, INSTANCE_SETTING_KEYS.villagePublicKey));

      expect(row?.value).toBe(KEYS.publicKey);
    });

    it("seals an old plaintext secret on first read", async () => {
      await storePlaintextKeys();

      expect(await readVillageKeys(database)).toEqual(KEYS);
      expect(await readStoredSecret()).not.toContain(KEYS.secretKey);
      expect(await readVillageKeys(database)).toEqual(KEYS);
    });

    it("keeps working when two readers seal at once", async () => {
      await storePlaintextKeys();

      const [first, second] = await Promise.all([readVillageKeys(database), readVillageKeys(database)]);

      expect(first).toEqual(KEYS);
      expect(second).toEqual(KEYS);
      expect(await readVillageKeys(database)).toEqual(KEYS);
    });

    it("reports the secret as sealed", async () => {
      await saveVillageKeys(database, KEYS);

      expect((await readVillageKeyState(database)).status).toBe(VILLAGE_KEY_STATUSES.sealed);
    });
  });

  describe("after the setup token changes", () => {
    beforeEach(async () => {
      await saveVillageKeys(database, KEYS);
      vi.stubEnv("SETUP_TOKEN", NEW_TOKEN);
    });

    it("asks for the keys again instead of crashing", async () => {
      const state = await readVillageKeyState(database);

      expect(state.status).toBe(VILLAGE_KEY_STATUSES.unreadable);
      expect(state.keys).toBeNull();
      expect(state.publicKey).toBe(KEYS.publicKey);
    });

    it("tells a member their admin is still setting things up", async () => {
      const { cookie } = await createSignedInMember(database);

      const response = await readNetworkStatus(
        new Request(`${APP_URL}/api/network/status`, { method: "POST", headers: { origin: APP_URL, cookie, "content-type": "application/json" }, body: "{}" }),
      );

      expect(await response.json()).toMatchObject({ stage: NETWORK_STAGES.notConfigured });
    });

    it("reopens the keys step of setup", async () => {
      const { steps } = await readSetupProgress(database, { APP_URL });

      expect(steps.find(({ id }) => id === SETUP_STEPS.keys)?.isDone).toBe(false);
    });

    it("works again once they're pasted", async () => {
      await saveVillageKeys(database, KEYS);

      expect(await readVillageKeys(database)).toEqual(KEYS);
    });

    it("logs the problem without the secret", async () => {
      await readVillageKeys(database);

      expect(JSON.stringify(vi.mocked(console.error).mock.calls)).not.toContain(KEYS.secretKey);
    });

    it("works again if the old token comes back", async () => {
      vi.stubEnv("SETUP_TOKEN", TOKEN);

      expect(await readVillageKeys(database)).toEqual(KEYS);
    });
  });

  describe.each([
    ["missing", ""],
    ["weak", WEAK_TOKEN],
  ])("with a %s setup token", (_name, token) => {
    beforeEach(() => {
      vi.stubEnv("SETUP_TOKEN", token);
    });

    it("keeps working in plaintext and says so", async () => {
      await saveVillageKeys(database, KEYS);

      const state = await readVillageKeyState(database);

      expect(state.status).toBe(VILLAGE_KEY_STATUSES.plain);
      expect(state.keys).toEqual(KEYS);
      expect(await readStoredSecret()).toBe(KEYS.secretKey);
    });

    it("can't open a secret that was sealed before", async () => {
      vi.stubEnv("SETUP_TOKEN", TOKEN);
      await saveVillageKeys(database, KEYS);
      vi.stubEnv("SETUP_TOKEN", token);

      expect((await readVillageKeyState(database)).status).toBe(VILLAGE_KEY_STATUSES.unreadable);
    });

    it("seals the secret once a usable token appears", async () => {
      await saveVillageKeys(database, KEYS);
      vi.stubEnv("SETUP_TOKEN", TOKEN);

      expect(await readVillageKeys(database)).toEqual(KEYS);
      expect(await readStoredSecret()).not.toContain(KEYS.secretKey);
    });
  });

  it("reports nothing saved", async () => {
    expect(await readVillageKeyState(database)).toEqual({ status: VILLAGE_KEY_STATUSES.missing, publicKey: null, keys: null });
  });
});
