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
  notNowHref: ROUTES.feed,
};

function renderMarkup(welcome: Parameters<typeof ConsentStep>[0]["welcome"] = WELCOME) {
  return renderToStaticMarkup(
    createElement(
      QueryClientProvider,
      { client: new QueryClient() },
      createElement(ConsentStep, { welcome }),
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
    expect(markup).toContain(`href="${ROUTES.feed}"`);
    expect(renderConsent()).toContain("you can come back here from Network any time");
  });

  it("promises a yes or no on every intro", () => {
    expect(renderConsent()).toContain("You say yes or no to every intro anyone asks you for.");
  });

  it("says being findable isn't controlled per intro", () => {
    expect(renderConsent()).toContain("That covers intros only.");
    expect(renderConsent()).toContain("Without asking you each time, members can find your contacts in search");
  });

  it("states real member counts, never invented ones", () => {
    expect(renderConsent()).toContain("3 members are already here");
  });

  it("needs explicit agreement before sharing", () => {
    expect(renderMarkup()).toMatch(/<input[^>]*type="checkbox"[^>]*required/);
  });
});

describe("the consent screen during onboarding", () => {
  const ONBOARDING_WELCOME = {
    ...WELCOME,
    isOnboarding: true,
    inviter: { id: "member-2", name: "Priya Raman", title: "Head of Platform" },
  };

  it("keeps Not now, as a button that records the choice", () => {
    expect(renderMarkup(ONBOARDING_WELCOME)).toMatch(/<button[^>]*>Not now<\/button>/);
  });

  it("keeps every disclosure", () => {
    const markup = renderMarkup(ONBOARDING_WELCOME);

    expect(markup).toContain("Your email address goes to Village");
    expect(markup).toContain("every current and future member");
    expect(markup).toMatch(/<input[^>]*type="checkbox"[^>]*required/);
  });

  it("shows the getting-started steps and who invited them", () => {
    const markup = renderMarkup(ONBOARDING_WELCOME);

    expect(markup).toContain("Your card");
    expect(markup).toContain("Priya Raman");
  });

  it("promises no step that doesn't exist", () => {
    expect(renderMarkup(ONBOARDING_WELCOME)).not.toContain("Say hello");
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
