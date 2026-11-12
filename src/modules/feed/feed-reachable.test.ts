import { createRequire } from "node:module";

import { eq } from "drizzle-orm";
import { describe, expect, it } from "vitest";

import { feedManifest } from "@/modules/feed/manifest";
import { isModuleEnabled, saveModuleState } from "@/platform/modules/enablement";
import { instanceSettings } from "@/platform/settings/schema";
import { createTestDatabase } from "@/test/database";

type PathToRegexp = { pathToRegexp: (source: string, keys: { name: string }[], options: object) => RegExp };

async function readRedirect(path: string) {
  const { nextConfig } = await import("../../../next.config.mjs");
  const { pathToRegexp } = createRequire(import.meta.url)("next/dist/compiled/path-to-regexp") as PathToRegexp;
  for (const rule of await nextConfig.redirects()) {
    if (pathToRegexp(rule.source, [], { strict: true, sensitive: false, delimiter: "/" }).test(path)) return rule.destination;
  }
  return null;
}

// The 2026-11-12 parity audit (FEED-01 to 06): the menu's Feed item landed on Today, so no member could see a post.
// The owner's call: the feed stays and is on wherever no admin chose; an admin's "off" is kept.
describe("the feed page", () => {
  const database = createTestDatabase();

  it("is not sent anywhere else", async () => {
    expect(await readRedirect("/feed")).toBeNull();
  });

  it("starts on where no admin chose, and keeps an admin's off", async () => {
    await database.delete(instanceSettings).where(eq(instanceSettings.key, `module_state:${feedManifest.id}`));
    expect(await isModuleEnabled(database, feedManifest)).toBe(true);
    await saveModuleState(database, feedManifest, false);
    expect(await isModuleEnabled(database, feedManifest)).toBe(false);
    await saveModuleState(database, feedManifest, true);
  });
});
