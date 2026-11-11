import { describe, expect, it } from "vitest";

import { readDnsCheckLine, readMailPageChecks } from "@/modules/admin/mail-checks";

const INBOUND = { isSet: true, address: "https://community.example/api/email/resend-webhook" };

describe("Set up › Mail's DNS checklist", () => {
  it("says nothing is emailed while the mail service is not set (first run)", () => {
    const checks = readMailPageChecks({ mailService: null, inbound: INBOUND, dnsCheck: null });

    expect(checks.map(({ key, state, value, note }) => [key, state, value, note])).toEqual([
      ["service", "fail", "Not set: nothing is emailed until the mail service is set on the server", "not set"],
      ["inbound", "ok", INBOUND.address, "set"],
      ["unsubscribe", "ok", "List-Unsubscribe and List-Unsubscribe-Post on every message email", "built in"],
    ]);
    expect(readDnsCheckLine(null)).toBe("Not checked yet. “Check DNS now” looks up SPF, DKIM, DMARC and the reply MX.");
  });

  it("shows the service, then each line of the last check with the record to add", () => {
    const toAdd = { type: "MX" as const, name: "reply.fund.example", value: "10 inbound.example" };
    const dnsCheck = {
      domain: "mail.fund.example",
      checkedAt: "2026-11-11T15:00:00.000Z",
      lines: [
        { key: "spf" as const, label: "SPF", status: "ok" as const, found: "send.mail.fund.example: v=spf1", toAdd: null },
        { key: "mx" as const, label: "Reply MX", status: "missing" as const, found: "No MX record on reply.fund.example.", toAdd },
      ],
    };

    const checks = readMailPageChecks({ mailService: "api.resend.com", inbound: { ...INBOUND, isSet: false }, dnsCheck });

    expect(checks.map(({ key, state, note }) => [key, state, note])).toEqual([
      ["service", "ok", "set"],
      ["inbound", "watch", "not set"],
      ["unsubscribe", "ok", "built in"],
      ["spf", "ok", "checked 11 Nov: pass"],
      ["mx", "fail", "checked 11 Nov: fail"],
    ]);
    expect(checks.at(-1)?.toAdd).toEqual(toAdd);
    expect(readDnsCheckLine(dnsCheck)).toContain("1 record needs a fix");
  });
});
