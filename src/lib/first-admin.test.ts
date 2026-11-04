import { eq } from "drizzle-orm";
import { afterAll, beforeEach, describe, expect, it } from "vitest";

import { account, user } from "../database/auth-schema";
import { clearDatabase, createTestDatabase } from "../test/database";
import { claimFirstAdmin, isFirstAdminClaimed } from "./first-admin";

const CONCURRENT_CLAIMS = 10;
const FIRST_ADMIN = { name: "Ada", email: "Ada@Example.com", password: "correct-horse-battery" };

describe("claimFirstAdmin", () => {
  const database = createTestDatabase();

  beforeEach(async () => {
    await clearDatabase(database);
  });

  afterAll(async () => {
    await database.$client.end();
  });

  describe("on the first claim", () => {
    it("creates an admin with a credential account", async () => {
      const { claimed } = await claimFirstAdmin(database, FIRST_ADMIN);
      const [admin] = await database.select().from(user);
      const accounts = await database.select().from(account);

      expect(claimed).toBe(true);
      expect(admin?.role).toBe("admin");
      expect(admin?.email).toBe("ada@example.com");
      expect(accounts).toHaveLength(1);
      expect(accounts[0]?.providerId).toBe("credential");
      expect(accounts[0]?.password).not.toContain(FIRST_ADMIN.password);
      expect(await isFirstAdminClaimed(database)).toBe(true);
    });
  });

  describe("on a later claim", () => {
    it("refuses and creates nothing", async () => {
      await claimFirstAdmin(database, FIRST_ADMIN);

      const { claimed } = await claimFirstAdmin(database, {
        ...FIRST_ADMIN,
        email: "second@example.com",
      });
      const secondUser = await database
        .select()
        .from(user)
        .where(eq(user.email, "second@example.com"));

      expect(claimed).toBe(false);
      expect(secondUser).toEqual([]);
    });
  });

  describe("under concurrent claims", () => {
    it("lets exactly one succeed", async () => {
      const instances = Array.from({ length: CONCURRENT_CLAIMS }, createTestDatabase);

      const results = await Promise.all(
        instances.map((instance, position) =>
          claimFirstAdmin(instance, {
            ...FIRST_ADMIN,
            email: `claimant-${position}@example.com`,
          }),
        ),
      );
      await Promise.all(instances.map((instance) => instance.$client.end()));

      const users = await database.select().from(user);
      expect(results.filter(({ claimed }) => claimed)).toHaveLength(1);
      expect(users).toHaveLength(1);
    });
  });

  describe("when creating the user fails", () => {
    it("releases the claim so setup can be retried", async () => {
      await database.insert(user).values({
        id: "existing-user",
        name: "Existing",
        email: "ada@example.com",
      });

      await expect(claimFirstAdmin(database, FIRST_ADMIN)).rejects.toThrow();

      expect(await isFirstAdminClaimed(database)).toBe(false);
    });
  });
});
