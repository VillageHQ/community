import { describe, expect, it } from "vitest";

import { renderEmailTest } from "@/platform/email/test-email";

describe("the mail test", () => {
  it("says Founderhall's plain words, with the address it was sent from", () => {
    const email = renderEmailTest("Northwind Founders", "Northwind Founders <intros@mail.northwind.example>");

    expect(email.subject).toBe("Test from Northwind Founders");
    expect(email.text).toBe(
      "This is a test from Northwind Founders' portal. If it reached your inbox (not spam), sending from intros@mail.northwind.example works.\n\nSent by Northwind Founders via its member portal.",
    );
    expect(email.html).toContain("Sent by Northwind Founders via its member portal.");
  });
});
