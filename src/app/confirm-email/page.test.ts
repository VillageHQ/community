import { eq } from "drizzle-orm";
import { beforeEach, describe, expect, it, vi } from "vitest";

import { session, user } from "@/database/auth-schema";
import { ROUTES } from "@/lib/routes";
import { clearDatabase, createTestDatabase } from "@/test/database";
import { createSignedInMember } from "@/test/signed-in-member";

import ConfirmEmailPage from "./page";

const requestCookie = vi.hoisted(() => ({ value: "" }));

vi.mock("next/headers", () => ({
  headers: async () => new Headers({ cookie: requestCookie.value }),
  cookies: async () => new Map(),
}));

describe("the email confirmation page", () => {
  const database = createTestDatabase();

  beforeEach(async () => {
    await clearDatabase(database);
  });

  it("sends a banned member to sign in, and ends their sessions", async () => {
    const member = await createSignedInMember(database);
    requestCookie.value = member.cookie;
    await database.update(user).set({ banned: true }).where(eq(user.id, member.userId));

    await expect(ConfirmEmailPage({ searchParams: Promise.resolve({ token: "any-token" }) })).rejects.toThrow(/NEXT_REDIRECT/);

    await expect(ConfirmEmailPage({ searchParams: Promise.resolve({ token: "any-token" }) })).rejects.toMatchObject({
      digest: expect.stringContaining(ROUTES.signIn),
    });
    expect(await database.select().from(session).where(eq(session.userId, member.userId))).toEqual([]);
  });
});
