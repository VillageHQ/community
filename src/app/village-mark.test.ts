import { createElement, type ReactNode } from "react";
import { renderToStaticMarkup } from "react-dom/server";
import { afterAll, beforeEach, describe, expect, it, vi } from "vitest";

import { CenteredPage } from "@/components/centered-page";
import { CommunityNote, SplitLayout, VillageNote } from "@/components/split-layout";
import { networkManifest } from "@/modules/network/manifest";
import { saveModuleState } from "@/platform/modules/enablement";
import { clearDatabase, createTestDatabase } from "@/test/database";

const VILLAGE_MARK = "Network by Village";

vi.mock("next/headers", () => ({ cookies: async () => ({ get: () => undefined }) }));
vi.mock("./fonts", () => ({ figtree: { variable: "" }, figtreeExtended: { variable: "" }, sourceSerif: { variable: "" } }));

const COMMUNITY = { name: "Northwind", descriptor: "", logo: null };

async function renderInRootLayout(page: ReactNode) {
  const { default: RootLayout } = await import("./layout");
  return renderToStaticMarkup(await RootLayout({ children: page }));
}

describe("the Village mark outside the app", () => {
  const database = createTestDatabase();
  const centeredPage = CenteredPage({ name: COMMUNITY.name, logo: null, children: "Hello" });
  const memberSplitPage = SplitLayout({ community: COMMUNITY, note: CommunityNote({ community: COMMUNITY, children: "Hi" }), children: "Hello" });
  const setupPage = SplitLayout({ community: COMMUNITY, note: createElement(VillageNote), children: "Hello" });

  beforeEach(async () => {
    await clearDatabase(database);
  });

  afterAll(async () => {
    await database.$client.end();
  });

  it.each([
    ["a centered page", centeredPage],
    ["a sign-in style page", memberSplitPage],
  ])("never shows on %s, which carries only the fund's name and the source link", async (_name, page) => {
    const html = await renderInRootLayout(page);
    expect(html).not.toContain(VILLAGE_MARK);
    expect(html).toContain("Source code (AGPL-3.0)");
    expect(html).toContain(COMMUNITY.name);
  });

  it("hides on the setup page with network off", async () => {
    await saveModuleState(database, networkManifest, false);

    expect(await renderInRootLayout(setupPage)).not.toContain(VILLAGE_MARK);
  });
});
