import { describe, expect, it } from "vitest";

import { resolveMigrationPlan } from "./migration-plan";

const POOLED_URL = "postgres://pooled.example/app";
const UNPOOLED_URL = "postgres://direct.example/app";

describe("resolveMigrationPlan", () => {
  describe("choosing a connection", () => {
    it("prefers the unpooled URL", () => {
      expect(
        resolveMigrationPlan({ DATABASE_URL: POOLED_URL, DATABASE_URL_UNPOOLED: UNPOOLED_URL }),
      ).toEqual({ shouldRun: true, connectionString: UNPOOLED_URL });
    });

    it("falls back to DATABASE_URL", () => {
      expect(resolveMigrationPlan({ DATABASE_URL: POOLED_URL })).toEqual({
        shouldRun: true,
        connectionString: POOLED_URL,
      });
    });

    it("fails without any URL", () => {
      expect(() => resolveMigrationPlan({})).toThrow("DATABASE_URL");
    });
  });

  describe("on Vercel", () => {
    it("runs on production builds", () => {
      expect(
        resolveMigrationPlan({ VERCEL_ENV: "production", DATABASE_URL: POOLED_URL }).shouldRun,
      ).toBe(true);
    });

    it("skips preview builds by default", () => {
      expect(
        resolveMigrationPlan({ VERCEL_ENV: "preview", DATABASE_URL: POOLED_URL }).shouldRun,
      ).toBe(false);
    });

    it("runs on preview builds when enabled", () => {
      expect(
        resolveMigrationPlan({
          VERCEL_ENV: "preview",
          MIGRATE_ON_PREVIEW: "true",
          DATABASE_URL: POOLED_URL,
        }).shouldRun,
      ).toBe(true);
    });
  });
});
