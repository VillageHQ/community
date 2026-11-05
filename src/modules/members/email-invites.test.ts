import { describe, expect, it } from "vitest";

import { renderConfirmationEmail } from "./email-invites";

describe("the confirmation email", () => {
  it("promises no network search, because members can't know network is on", () => {
    const email = renderConfirmationEmail({ memberName: "Amara", communityName: "Northwind", link: "https://example.test/confirm", accentColor: "#0e7f88" });

    expect(JSON.stringify(email)).not.toMatch(/network search/i);
  });
});
