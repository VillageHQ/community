import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { createElement } from "react";
import { renderToStaticMarkup } from "react-dom/server";
import { describe, expect, it } from "vitest";

import { ROUTES } from "@/lib/routes";
import { NETWORK_STAGES } from "@/lib/village/network-api";

import { ConsentStep } from "./consent-step";
import { networkStatusQuery, readStatusPollInterval } from "./network-queries";

const WELCOME = {
  community: { name: "Northwind", descriptor: "Founder community", logo: null },
  member: { id: "member-1", name: "Amara Osei" },
  neighbours: [{ id: "member-2", name: "Jonas Lindqvist" }],
  sharingMemberCount: 3,
  notNowHref: ROUTES.home,
};

function renderMarkup() {
  return renderToStaticMarkup(
    createElement(
      QueryClientProvider,
      { client: new QueryClient() },
      createElement(ConsentStep, { welcome: WELCOME }),
    ),
  );
}

function renderConsent() {
  return renderMarkup().replaceAll("&#x27;", "'").replaceAll(/<[^>]+>/g, " ").replaceAll(/\s+/g, " ");
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

  it("says members can find contacts and ask for introductions", () => {
    expect(renderConsent()).toContain("They can find your contacts and ask you for introductions");
  });

  it("says the member gains access to the other networks", () => {
    expect(renderConsent()).toContain("You gain access to the networks of the other members");
  });

  it("lets a member skip sharing and come back later", () => {
    const markup = renderMarkup();

    expect(markup).toContain("Not now");
    expect(markup).toContain(`href="${ROUTES.home}"`);
    expect(renderConsent()).toContain("you can come back here from Network any time");
  });

  it("makes no promise about approving intros, which don't exist yet", () => {
    expect(renderConsent()).not.toMatch(/yes or no to every intro/i);
  });

  it("states real member counts, never invented ones", () => {
    expect(renderConsent()).toContain("3 members are already here");
  });

  it("needs explicit agreement before sharing", () => {
    expect(renderMarkup()).toMatch(/<input[^>]*type="checkbox"[^>]*required/);
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
