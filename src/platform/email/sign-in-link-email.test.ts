import { describe, expect, it } from "vitest";

import { renderSignInLinkEmail } from "./sign-in-link-email";

const LINK = "https://community.example/auth?token=abc";

// Founderhall's email, word for word (fh-reference copy/emails/email-signin-link.md).
describe("the sign-in link email", () => {
  const email = renderSignInLinkEmail({ link: LINK, communityName: "Northwind Founders" });

  it("has Founderhall's subject", () => {
    expect(email.subject).toBe("Your sign-in link for Northwind Founders");
  });

  it("has Founderhall's plain-text body", () => {
    expect(email.text).toBe(
      [
        "Hi,",
        "",
        "Open this link to sign in to Northwind Founders:",
        LINK,
        "",
        "It works once, for the next 15 minutes. If you did not ask for it, ignore this email.",
        "",
        "Sent by Northwind Founders via its member portal.",
      ].join("\n"),
    );
  });

  it("sends the same words as HTML, with no button", () => {
    expect(email.html).toContain("Open this link to sign in to Northwind Founders:");
    expect(email.html).toContain(`<a href="${LINK}">${LINK}</a>`);
    expect(email.html).not.toContain("border-radius");
  });

  it("escapes a community name that looks like HTML", () => {
    expect(renderSignInLinkEmail({ link: LINK, communityName: "<b>Fund</b>" }).html).not.toContain("<b>Fund");
  });
});
