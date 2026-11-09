import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { createElement, type ReactNode } from "react";
import { renderToStaticMarkup } from "react-dom/server";
import { afterAll, beforeEach, describe, expect, it, vi } from "vitest";

import { feedManifest } from "@/modules/feed/manifest";
import { introsManifest } from "@/modules/intros/manifest";
import { MemberConversationSlot } from "@/modules/members/slots";
import { messagesManifest } from "@/modules/messages/manifest";
import { PAGE_TITLES } from "@/platform/branding/page-metadata";
import { saveModuleState } from "@/platform/modules/enablement";
import { clearDatabase, createTestDatabase } from "@/test/database";
import { createSignedInMember } from "@/test/signed-in-member";

const session = vi.hoisted(() => ({ cookie: "" }));

const CONNECTOR = {
  name: "Jonas Lindqvist",
  headline: null,
  linkedinSlug: "jonas-lindqvist",
  reason: "Both worked at Corvane Logistics.",
  throughName: null,
  member: { id: "jonas", avatarUrl: null },
  openAsk: null,
};

vi.mock("next/headers", () => ({ headers: async () => new Headers({ cookie: session.cookie }) }));

vi.mock("next/navigation", async (importOriginal) => ({
  ...(await importOriginal<typeof import("next/navigation")>()),
  usePathname: () => "/",
  useRouter: () => ({ push: vi.fn(), refresh: vi.fn() }),
}));

vi.mock("@/modules/network/components/network-flow-loader", async () => {
  const { ConnectorCard } = await import("@/modules/network/components/connector-card");
  return {
    NetworkFlowLoader: () =>
      createElement(ConnectorCard, { connector: CONNECTOR, isTop: true, targetSlug: "clara", targetName: "Clara Bergström", viewer: { id: "amara", name: "Amara Osei" } }),
  };
});

function renderTree(tree: ReactNode) {
  return renderToStaticMarkup(createElement(QueryClientProvider, { client: new QueryClient() }, tree));
}

describe("the slots in the app", () => {
  const database = createTestDatabase();

  beforeEach(async () => {
    await clearDatabase(database);
    session.cookie = (await createSignedInMember(database)).cookie;
  });

  afterAll(async () => {
    await database.$client.end();
  });

  describe("the home page title", () => {
    it("says Feed with the feed on", async () => {
      await saveModuleState(database, feedManifest, true);
      const { generateMetadata } = await import("./page");

      expect((await generateMetadata()).title).toBe(PAGE_TITLES.feed);
    });

    it("says Home with the feed off", async () => {
      await saveModuleState(database, feedManifest, false);
      const { generateMetadata } = await import("./page");

      expect((await generateMetadata()).title).toBe(PAGE_TITLES.home);
    });
  });

  it("gives every page in the app the Message button", async () => {
    const { default: AppLayout } = await import("./layout");
    const slot = createElement(MemberConversationSlot, { memberId: "jonas", label: "Message", accessibleName: "Message Jonas" });

    expect(renderTree(await AppLayout({ children: slot }))).toContain("Message Jonas");
  });

  it("hides the Message button with messages off", async () => {
    await saveModuleState(database, messagesManifest, false);
    const { default: AppLayout } = await import("./layout");
    const slot = createElement(MemberConversationSlot, { memberId: "jonas", label: "Message", accessibleName: "Message Jonas" });

    expect(renderTree(await AppLayout({ children: slot }))).not.toContain("Message Jonas");
  });

  it("hides the intro ask with intros off", async () => {
    await saveModuleState(database, introsManifest, false);
    const { default: NetworkPage } = await import("./network/page");

    expect(renderTree(await NetworkPage())).not.toContain("Ask Jonas for an intro");
  });

  it("gives the network page the intro ask", async () => {
    const { default: NetworkPage } = await import("./network/page");

    expect(renderTree(await NetworkPage())).toContain("Ask Jonas for an intro");
  });
});
