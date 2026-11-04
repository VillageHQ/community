import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { createElement } from "react";
import { renderToStaticMarkup } from "react-dom/server";
import { describe, expect, it } from "vitest";

import { NETWORK_STAGES } from "@/lib/village/network-api";

import { ConsentStep } from "./consent-step";
import { networkStatusQuery, readStatusPollInterval } from "./network-queries";

function renderConsent() {
  const html = renderToStaticMarkup(
    createElement(
      QueryClientProvider,
      { client: new QueryClient() },
      createElement(ConsentStep),
    ),
  );
  return html.replaceAll("&#x27;", "'").replaceAll(/<[^>]+>/g, "");
}

describe("the consent screen", () => {
  it("says the member's email goes to Village", () => {
    expect(renderConsent()).toContain("Your email address goes to Village");
  });

  it("says the network is shared with every current and future member", () => {
    expect(renderConsent()).toContain("every current and future member");
  });

  it("says what leaving does and doesn't undo", () => {
    expect(renderConsent()).toContain("You can leave the group from this page");
    expect(renderConsent()).toContain("can't unsee them");
  });

  it("says an admin's removal doesn't yet remove the member from the Village group", () => {
    expect(renderConsent()).toContain("doesn't yet remove you from the Village group");
  });
});

describe("status polling", () => {
  it.each([NETWORK_STAGES.needsSync, NETWORK_STAGES.syncing, NETWORK_STAGES.linkMismatch])(
    "keeps checking at %s, so the page moves on by itself",
    (stage) => {
      expect(readStatusPollInterval({ stage, isAdmin: false, sync: null })).toBeGreaterThan(0);
    },
  );

  it("stops once the member is ready", () => {
    expect(readStatusPollInterval({ stage: NETWORK_STAGES.ready, isAdmin: false, sync: null })).toBe(false);
  });

  it("stops in background tabs, so a hidden tab mints and fetches nothing", () => {
    expect(networkStatusQuery.refetchIntervalInBackground).toBe(false);
  });
});
