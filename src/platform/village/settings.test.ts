import { eq } from "drizzle-orm";
import { afterAll, afterEach, beforeEach, describe, expect, it, vi } from "vitest";

import { POST as readNetworkStatus } from "@/app/api/network/status/route";
import { NETWORK_STAGES } from "@/modules/network/contract";
import { readSetupProgress, SETUP_STEPS } from "@/shell/admin-setup";
import { createSignedInMember } from "@/test/signed-in-member";

import { clearDatabase, createTestDatabase } from "../../test/database.ts";
import { INSTANCE_SETTING_KEYS, instanceSettings } from "../settings/schema.ts";
import { KEY_STORAGE, VILLAGE_KEY_STATUSES } from "./contract.ts";
import { readKeyStorage, readVillageKeyState, readVillageKeys, saveVillageKeys, sealStoredPlaintext, sealVillageSecretOnBoot } from "./settings.ts";

const APP_URL = "http://localhost:3000";
const TOKEN = "a-strong-setup-token-with-more-than-32-characters";
const NEW_TOKEN = "another-strong-setup-token-with-more-than-32-characters";
const WEAK_TOKEN = "change-me";
const SETTINGS_LOADS = 5;
const CONCURRENT_READERS = 20;
const LATER_MS = 6 * 60 * 1000;
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

      expect(state.status).toBe(VILLAGE_KEY_STATUSES.tokenDifferent);
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

      expect((await readVillageKeyState(database)).status).toBe(VILLAGE_KEY_STATUSES.tokenMissing);
    });

    it("seals the secret once a usable token appears", async () => {
      await saveVillageKeys(database, KEYS);
      vi.stubEnv("SETUP_TOKEN", TOKEN);

      expect(await readVillageKeys(database)).toEqual(KEYS);
      expect(await readStoredSecret()).not.toContain(KEYS.secretKey);
    });
  });

  describe("when sealing can't write", () => {
    function failingUpdates() {
      const update = vi.fn(() => {
        throw new Error("The database is read-only.");
      });
      const failing = new Proxy(database, { get: (target, property) => (property === "update" ? update : Reflect.get(target, property)) });
      return { failing, update };
    }

    function uniquePlaintextKeys() {
      return { ...KEYS, secretKey: `sk_${crypto.randomUUID()}` };
    }

    async function storeKeys(keys: typeof KEYS) {
      await database.insert(instanceSettings).values([
        { key: INSTANCE_SETTING_KEYS.villagePublicKey, value: keys.publicKey },
        { key: INSTANCE_SETTING_KEYS.villageSecretKey, value: keys.secretKey },
      ]);
    }

    it("says it's unsealed, because the row still is", async () => {
      const keys = uniquePlaintextKeys();
      await storeKeys(keys);
      const { failing } = failingUpdates();

      const state = await readVillageKeyState(failing);

      expect(state.status).toBe(VILLAGE_KEY_STATUSES.sealFailed);
      expect(state.keys).toEqual(keys);
      expect(await readStoredSecret()).toBe(keys.secretKey);
    });

    it("tries once, however many times the page loads", async () => {
      const keys = uniquePlaintextKeys();
      await storeKeys(keys);
      const { failing, update } = failingUpdates();

      for (const _load of Array.from({ length: SETTINGS_LOADS })) await readVillageKeyState(failing);

      expect(update).toHaveBeenCalledTimes(1);
    });

    it("makes one attempt for readers at the same moment", async () => {
      const keys = uniquePlaintextKeys();
      await storeKeys(keys);
      const { failing, update } = failingUpdates();

      await Promise.all(Array.from({ length: CONCURRENT_READERS }, () => readVillageKeys(failing)));

      expect(update).toHaveBeenCalledTimes(1);
    });

    it("tries again later", async () => {
      const keys = uniquePlaintextKeys();
      await storeKeys(keys);
      await readVillageKeyState(failingUpdates().failing);
      vi.spyOn(Date, "now").mockReturnValue(Date.now() + LATER_MS);

      expect((await readVillageKeyState(database)).status).toBe(VILLAGE_KEY_STATUSES.sealed);
      expect(await readStoredSecret()).not.toContain(keys.secretKey);
    });
  });

  it("makes one attempt for callers at the same moment", async () => {
    let finishUpdate = () => {};
    const updateFinished = new Promise<void>((resolve) => {
      finishUpdate = resolve;
    });
    const update = vi.fn(() => ({
      set: () => ({
        where: () => ({
          returning: async () => {
            await updateFinished;
            return [{ key: INSTANCE_SETTING_KEYS.villageSecretKey }];
          },
        }),
      }),
    }));
    const gated = new Proxy(database, { get: (target, property) => (property === "update" ? update : Reflect.get(target, property)) });
    const plaintext = `sk_${crypto.randomUUID()}`;

    const attempts = Array.from({ length: CONCURRENT_READERS }, () => sealStoredPlaintext(gated, plaintext, TOKEN));
    finishUpdate();

    expect(await Promise.all(attempts)).toEqual(Array.from({ length: CONCURRENT_READERS }, () => true));
    expect(update).toHaveBeenCalledTimes(1);
  });

  describe("a stored value that looks sealed but isn't readable", () => {
    it.each(["sealed.v2.a.b.c", "sealed.key-from-somewhere"])("calls %s damaged with no token too", async (value) => {
      vi.stubEnv("SETUP_TOKEN", "");
      await database.insert(instanceSettings).values([
        { key: INSTANCE_SETTING_KEYS.villagePublicKey, value: KEYS.publicKey },
        { key: INSTANCE_SETTING_KEYS.villageSecretKey, value },
      ]);

      expect((await readVillageKeyState(database)).status).toBe(VILLAGE_KEY_STATUSES.damaged);
    });

    it.each(["sealed.v2.a.b.c", "sealed.key-from-somewhere"])("fails closed for %s, and leaves it alone", async (value) => {
      await database.insert(instanceSettings).values([
        { key: INSTANCE_SETTING_KEYS.villagePublicKey, value: KEYS.publicKey },
        { key: INSTANCE_SETTING_KEYS.villageSecretKey, value },
      ]);

      const state = await readVillageKeyState(database);

      expect(state.status).toBe(VILLAGE_KEY_STATUSES.damaged);
      expect(state.keys).toBeNull();
      expect(await readStoredSecret()).toBe(value);
    });
  });

  describe("saving a key that looks sealed", () => {
    const LOOKALIKE = { ...KEYS, secretKey: "sealed.key-from-somewhere" };

    it("round-trips with a token", async () => {
      await saveVillageKeys(database, LOOKALIKE);

      expect(await readVillageKeys(database)).toEqual(LOOKALIKE);
    });

    it("is refused without one, because it would read as sealed", async () => {
      vi.stubEnv("SETUP_TOKEN", "");

      await expect(saveVillageKeys(database, LOOKALIKE)).rejects.toThrow("setup token");
      expect(await readStoredSecret()).toBeNull();
    });
  });

  describe.each([
    ["shares production's database", { VERCEL_ENV: "preview" }],
    ["sets MIGRATE_ON_PREVIEW, which can't say whether the database is shared", { VERCEL_ENV: "preview", MIGRATE_ON_PREVIEW: "true" }],
  ])("on a preview that %s", (_name, previewEnvironment) => {
    const PREVIEW = { ...previewEnvironment, SETUP_TOKEN: NEW_TOKEN };

    it("leaves a plaintext secret alone, so its token can't lock production out", async () => {
      await storePlaintextKeys();

      const state = await readVillageKeyState(database, PREVIEW);

      expect(state).toEqual({ status: VILLAGE_KEY_STATUSES.preview, publicKey: KEYS.publicKey, keys: KEYS });
      expect(await readStoredSecret()).toBe(KEYS.secretKey);
    });

    it("refuses to save keys, so production can still read them", async () => {
      await saveVillageKeys(database, KEYS);
      const sealed = await readStoredSecret();

      await expect(saveVillageKeys(database, { ...KEYS, secretKey: "sk_from_preview" }, PREVIEW)).rejects.toThrow("live site");
      expect(await readStoredSecret()).toBe(sealed);
      expect(await readVillageKeys(database)).toEqual(KEYS);
    });

    it("says it's a preview, not that the token changed", async () => {
      await saveVillageKeys(database, KEYS);

      expect((await readVillageKeyState(database, PREVIEW)).status).toBe(VILLAGE_KEY_STATUSES.preview);
    });

    it("tells the form a save would be refused", () => {
      expect(readKeyStorage(PREVIEW)).toBe(KEY_STORAGE.refused);
    });
  });

  it("tells the form a save without a token is stored unencrypted", () => {
    expect(readKeyStorage({ SETUP_TOKEN: "" })).toBe(KEY_STORAGE.unencrypted);
    expect(readKeyStorage({ SETUP_TOKEN: TOKEN })).toBe(KEY_STORAGE.sealed);
  });

  describe("at boot", () => {
    it("seals a plaintext secret, whatever the toggles say", async () => {
      await storePlaintextKeys();

      await sealVillageSecretOnBoot(database);

      expect(await readStoredSecret()).not.toContain(KEYS.secretKey);
    });

    it("changes nothing the second time", async () => {
      await storePlaintextKeys();
      await sealVillageSecretOnBoot(database);
      const sealed = await readStoredSecret();

      await sealVillageSecretOnBoot(database);

      expect(await readStoredSecret()).toBe(sealed);
    });

    it("doesn't stop the server when the database fails", async () => {
      const broken = new Proxy(database, {
        get: (target, property) => {
          if (property === "select") throw new Error("The database is down.");
          return Reflect.get(target, property);
        },
      });

      await expect(sealVillageSecretOnBoot(broken)).resolves.toBeUndefined();
    });
  });

  it("reports nothing saved", async () => {
    expect(await readVillageKeyState(database)).toEqual({ status: VILLAGE_KEY_STATUSES.missing, publicKey: null, keys: null });
  });
});
