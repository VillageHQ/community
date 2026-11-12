import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { createElement, type ReactNode } from "react";
import { renderToStaticMarkup } from "react-dom/server";
import { afterAll, beforeEach, describe, expect, it, vi } from "vitest";

import { introsManifest } from "@/modules/intros/manifest";
import { MemberConversationSlot } from "@/modules/members/slots";
import { messagesManifest } from "@/modules/messages/manifest";
import { saveModuleState } from "@/platform/modules/enablement";
import { clearDatabase, createTestDatabase } from "@/test/database";
import { createSignedInMember } from "@/test/signed-in-member";

const session = vi.hoisted(() => ({ cookie: "" }));

vi.mock("next/headers", () => ({ headers: async () => new Headers({ cookie: session.cookie }) }));

vi.mock("next/navigation", async (importOriginal) => ({
  ...(await importOriginal<typeof import("next/navigation")>()),
  usePathname: () => "/",
  useRouter: () => ({ push: vi.fn(), refresh: vi.fn() }),
}));

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

  it("titles Today as Founderhall does", async () => {
    const { metadata } = await import("./today/page");

    expect(metadata.title).toBe("Today");
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

  it("answers 404 for the one-step intro ask with intros off", async () => {
    await saveModuleState(database, introsManifest, false);
    const { default: SearchAskPage } = await import("./search/ask/page");

    await expect(SearchAskPage({ searchParams: Promise.resolve({ target: "clara", via: "jonas" }) })).rejects.toThrow();
  });
});
