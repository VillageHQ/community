import { renderToStaticMarkup } from "react-dom/server";
import { beforeEach, describe, expect, it } from "vitest";

import { claimFirstAdmin } from "@/lib/first-admin";
import { ROUTES } from "@/lib/routes";
import { clearDatabase, createTestDatabase } from "@/test/database";

import SignInPage from "./page";

describe("the sign-in page", () => {
  const database = createTestDatabase();

  beforeEach(async () => {
    await clearDatabase(database);
    await claimFirstAdmin(database, {
      name: "Admin",
      email: "admin@example.test",
      password: "a-long-test-password",
    });
  });

  it("doesn't link to the closed sign-up page", async () => {
    const html = renderToStaticMarkup(await SignInPage());

    expect(html).not.toContain(ROUTES.signUp);
    expect(html).not.toContain("Need an account");
  });
});
