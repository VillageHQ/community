import { eq } from "drizzle-orm";
import { afterAll, beforeEach, describe, expect, it } from "vitest";

import { INSTANCE_SETTING_KEYS, instanceSettings } from "@/platform/settings/schema";
import { clearDatabase, createTestDatabase } from "@/test/database";
import { resolveAuthSecret } from "./auth-secret";

const CONCURRENT_INSTANCES = 20;
const GENERATED_SECRET_LENGTH = 64;

describe("resolveAuthSecret", () => {
  const database = createTestDatabase();

  beforeEach(async () => {
    await clearDatabase(database);
  });

  afterAll(async () => {
    await database.$client.end();
  });

  describe("with BETTER_AUTH_SECRET set", () => {
    it("returns it and stores nothing", async () => {
      const secret = await resolveAuthSecret(database, { BETTER_AUTH_SECRET: "from-environment" });
      const stored = await database.select().from(instanceSettings);

      expect(secret).toBe("from-environment");
      expect(stored).toEqual([]);
    });
  });

  describe("without BETTER_AUTH_SECRET", () => {
    it("generates a 256-bit secret", async () => {
      const secret = await resolveAuthSecret(database, {});

      expect(secret).toMatch(new RegExp(`^[0-9a-f]{${GENERATED_SECRET_LENGTH}}$`));
    });

    it("returns the stored secret on later boots", async () => {
      const firstBoot = await resolveAuthSecret(database, {});
      const secondBoot = await resolveAuthSecret(database, {});

      expect(secondBoot).toBe(firstBoot);
    });

    it("converges when instances boot concurrently", async () => {
      const instances = Array.from({ length: CONCURRENT_INSTANCES }, createTestDatabase);

      const secrets = await Promise.all(
        instances.map((instance) => resolveAuthSecret(instance, {})),
      );
      await Promise.all(instances.map((instance) => instance.$client.end()));

      const stored = await database
        .select({ value: instanceSettings.value })
        .from(instanceSettings)
        .where(eq(instanceSettings.key, INSTANCE_SETTING_KEYS.authSecret));

      expect(new Set(secrets).size).toBe(1);
      expect(stored).toEqual([{ value: secrets[0] }]);
    });
  });
});
