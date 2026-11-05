import { renderToStaticMarkup } from "react-dom/server";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

import { clearDatabase, createTestDatabase } from "@/test/database";

import SetupPage from "./page";

describe("the setup page", () => {
  const database = createTestDatabase();

  beforeEach(async () => {
    await clearDatabase(database);
  });

  afterEach(() => {
    vi.unstubAllEnvs();
  });

  describe("without a usable setup token", () => {
    beforeEach(() => {
      vi.stubEnv("SETUP_TOKEN", "change-me");
    });

    it.each([
      ["Vercel", "Settings, then Environment Variables"],
      ["Railway", "your service, then Variables"],
      ["DigitalOcean", "App-Level Environment Variables"],
    ])("says where the setting lives on %s", async (_host, path) => {
      expect(renderToStaticMarkup(await SetupPage())).toContain(path);
    });

    it("offers a generator to someone without a password manager", async () => {
      expect(renderToStaticMarkup(await SetupPage())).toContain("1password.com/password-generator");
    });
  });
});
