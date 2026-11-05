import { renderToStaticMarkup } from "react-dom/server";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

import { clearDatabase, createTestDatabase } from "@/test/database";

import ForgotPasswordPage from "./page";

describe("the forgot password page", () => {
  const database = createTestDatabase();

  beforeEach(async () => {
    await clearDatabase(database);
  });

  afterEach(() => {
    vi.unstubAllEnvs();
  });

  async function renderPage() {
    return renderToStaticMarkup(await ForgotPasswordPage());
  }

  describe("without email", () => {
    beforeEach(() => {
      vi.stubEnv("RESEND_API_KEY", "");
    });

    it("says plainly a member's way back makes a new account, and why an admin can't reset it", async () => {
      const page = await renderPage();

      expect(page).toContain("remove your account and invite you again");
      expect(page).toContain("creates a new account");
      expect(page).toContain("Your old private messages stay on the old account");
      expect(page).toContain("Nobody can set your password for you, not even an admin");
    });

    it("sends an admin to recovery with the setup token", async () => {
      const page = await renderPage();

      expect(page).toContain("I lost my admin password");
      expect(page).toContain('href="/recover-admin"');
    });
  });

  describe("with email", () => {
    beforeEach(() => {
      vi.stubEnv("RESEND_API_KEY", "key");
      vi.stubEnv("RESEND_FROM_ADDRESS", "Northwind <hello@example.test>");
    });

    it("offers the form, and not the token route", async () => {
      const page = await renderPage();

      expect(page).toContain("Send me a link");
      expect(page).not.toContain("recover-admin");
    });
  });
});
