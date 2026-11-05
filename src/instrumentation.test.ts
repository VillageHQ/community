import { eq } from "drizzle-orm";
import { afterAll, afterEach, beforeEach, describe, expect, it, vi } from "vitest";

import { networkManifest } from "@/modules/network/manifest";
import { saveModuleState } from "@/platform/modules/enablement";
import { INSTANCE_SETTING_KEYS, instanceSettings } from "@/platform/settings/schema";
import { clearDatabase, createTestDatabase } from "@/test/database";

import { register } from "./instrumentation";

const TOKEN = "a-strong-setup-token-with-more-than-32-characters";
const PLAINTEXT_SECRET = "sk_plain_before_this_version";

describe("booting the server", () => {
  const database = createTestDatabase();

  beforeEach(async () => {
    await clearDatabase(database);
    vi.stubEnv("NEXT_RUNTIME", "nodejs");
    vi.stubEnv("SETUP_TOKEN", TOKEN);
    await database.insert(instanceSettings).values([
      { key: INSTANCE_SETTING_KEYS.villagePublicKey, value: "pk_plain" },
      { key: INSTANCE_SETTING_KEYS.villageSecretKey, value: PLAINTEXT_SECRET },
    ]);
  });

  afterEach(() => {
    vi.unstubAllEnvs();
  });

  afterAll(async () => {
    await database.$client.end();
  });

  it("seals a plaintext Village secret, even with Network off", async () => {
    await saveModuleState(database, networkManifest, false);

    await register();

    const [row] = await database.select({ value: instanceSettings.value }).from(instanceSettings).where(eq(instanceSettings.key, INSTANCE_SETTING_KEYS.villageSecretKey));
    expect(row?.value).not.toContain(PLAINTEXT_SECRET);
  });
});
