import { describe, expect, it } from "vitest";

import { renderConfirmationEmail, renderInviteEmail } from "./email-invites";
import { EMAIL_KINDS } from "../../platform/email/kinds";
import { queueEmail } from "../../platform/email/outbox";
import { INVITE_STATES, readInviteExpiry, readInviteState } from "./contract-invite-state";
import { createInviteToken, hashInviteToken, isInviteTokenShape } from "./service-invite-token";

const NOW = new Date("2026-11-04T12:00:00Z");
const LATER = new Date("2026-11-05T12:00:00Z");
const EARLIER = new Date("2026-11-03T12:00:00Z");
const OPEN = { acceptedAt: null, revokedAt: null };
const FACTS = {
  link: "https://community.example/join/token",
  inviterName: "Priya Raman",
  communityName: "Northwind",
  accentColor: "#0f7f86",
};

describe("invite state", () => {
  it("is pending before the expiry", () => {
    expect(readInviteState({ ...OPEN, expiresAt: LATER }, NOW)).toBe(INVITE_STATES.pending);
  });

  it("is expired at the exact expiry", () => {
    expect(readInviteState({ ...OPEN, expiresAt: NOW }, NOW)).toBe(INVITE_STATES.expired);
  });

  it("stays accepted after the expiry passes", () => {
    expect(readInviteState({ acceptedAt: EARLIER, revokedAt: null, expiresAt: EARLIER }, NOW)).toBe(INVITE_STATES.accepted);
  });

  it("stays revoked after the expiry passes", () => {
    expect(readInviteState({ acceptedAt: null, revokedAt: EARLIER, expiresAt: EARLIER }, NOW)).toBe(INVITE_STATES.revoked);
  });

  it("counts a reclaimed invite as revoked, even though someone accepted it", () => {
    expect(readInviteState({ acceptedAt: EARLIER, revokedAt: EARLIER, expiresAt: LATER }, NOW)).toBe(INVITE_STATES.revoked);
  });

  it("gives new invites two weeks", () => {
    expect(readInviteExpiry(NOW).toISOString()).toBe("2026-11-18T12:00:00.000Z");
  });
});

describe("invite tokens", () => {
  it("are long enough that guessing is hopeless, and all different", () => {
    const token = createInviteToken();

    expect(isInviteTokenShape(token)).toBe(true);
    expect(createInviteToken()).not.toBe(token);
  });

  it("hash to something other than themselves", () => {
    const token = createInviteToken();

    expect(hashInviteToken(token)).not.toContain(token);
    expect(hashInviteToken(token)).toHaveLength(64);
  });

  it("refuse anything that isn't token-shaped", () => {
    expect(isInviteTokenShape("../../etc/passwd")).toBe(false);
    expect(isInviteTokenShape("")).toBe(false);
  });
});

describe("the invite email", () => {
  it("names the inviter and the community, and carries the link", () => {
    const { subject, html, text } = renderInviteEmail(FACTS);

    expect(subject).toBe("Your place in Northwind");
    expect(html).toContain(FACTS.link);
    expect(text).toContain(FACTS.link);
  });

  it("reads Founderhall's invite word for word, signed by the inviter and their role", () => {
    const { text } = renderInviteEmail({ ...FACTS, communityName: "Northwind Founders", inviterName: "Maya Ortiz", inviterRole: "Head of Platform", inviteeName: "Nadia Cole" });

    expect(text).toBe(
      [
        "Hi Nadia,",
        "",
        "Maya Ortiz invited you to Northwind Founders: see who in Northwind Founders' circle can introduce you, and ask in one tap. Nobody is introduced without saying yes.",
        "",
        "Open this link to sign in. It answers two questions about you, then you are in:",
        FACTS.link,
        "",
        "The link works once and lasts 14 days.",
        "",
        "Maya Ortiz, Head of Platform, Northwind Founders",
        "",
        "If you did not expect this, ignore this email and nothing more is sent.",
        "",
        "Sent by Northwind Founders via its member portal.",
      ].join("\n"),
    );
  });

  it('says "Hi," when the invite has no name', () => {
    expect(renderInviteEmail(FACTS).text.startsWith("Hi,\n")).toBe(true);
  });

  it("escapes names in the HTML", () => {
    const { html } = renderInviteEmail({ ...FACTS, inviterName: '<img src=x onerror="alert(1)">' });

    expect(html).not.toContain("<img");
    expect(html).toContain("&lt;img");
  });

  it("keeps the subject on one line", () => {
    const { subject } = renderInviteEmail({ ...FACTS, inviterName: "Priya\r\nBcc: mallory@example.test" });

    expect(subject).not.toMatch(/[\r\n]/);
  });

  it("escapes the member's name in the confirmation email", () => {
    const { html } = renderConfirmationEmail({
      link: FACTS.link,
      memberName: "<img src=x>",
      communityName: "Northwind",
      accentColor: "#0f7f86",
    });

    expect(html).not.toContain("<img");
  });

  it("queues nothing when email isn't configured", async () => {
    const email = { kind: EMAIL_KINDS.invite, to: "amara@example.test", memberId: null, ...renderInviteEmail(FACTS) };

    // The connection is never touched, so a missing one proves no write was tried.
    expect(await queueEmail(undefined as never, {}, email)).toBeNull();
  });
});
