import { createElement, type ReactNode } from "react";
import { renderToStaticMarkup } from "react-dom/server";
import { afterAll, beforeEach, describe, expect, it, vi } from "vitest";

import { CenteredPage } from "@/components/centered-page";
import { SplitLayout, VillageNote } from "@/components/split-layout";
import { networkManifest } from "@/modules/network/manifest";
import { saveModuleState } from "@/platform/modules/enablement";
import { clearDatabase, createTestDatabase } from "@/test/database";

const VILLAGE_MARK = "Network by Village";

vi.mock("next/headers", () => ({ cookies: async () => ({ get: () => undefined }) }));
vi.mock("./fonts", () => ({ figtree: { variable: "" }, figtreeExtended: { variable: "" } }));

const COMMUNITY = { name: "Northwind", descriptor: "", logo: null };

async function renderInRootLayout(page: ReactNode) {
  const { default: RootLayout } = await import("./layout");
  return renderToStaticMarkup(await RootLayout({ children: page }));
}

describe("the Village mark outside the app", () => {
  const database = createTestDatabase();
  const centeredPage = CenteredPage({ name: COMMUNITY.name, logo: null, children: "Hello" });
  const splitLayout = SplitLayout({ community: COMMUNITY, note: createElement(VillageNote), children: "Hello" });

  beforeEach(async () => {
    await clearDatabase(database);
  });

  afterAll(async () => {
    await database.$client.end();
  });

  it.each([
    ["a centered page", centeredPage],
    ["a split page", splitLayout],
  ])("shows on %s while network is on", async (_name, page) => {
    expect(await renderInRootLayout(page)).toContain(VILLAGE_MARK);
  });

  it.each([
    ["a centered page", centeredPage],
    ["a split page", splitLayout],
  ])("hides on %s with network off", async (_name, page) => {
    await saveModuleState(database, networkManifest, false);

    expect(await renderInRootLayout(page)).not.toContain(VILLAGE_MARK);
  });
});
