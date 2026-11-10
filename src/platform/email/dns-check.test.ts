import { describe, expect, it } from "vitest";

import { checkSendingDomain, readSendingDomain, type TxtResolver } from "./dns-check";

const NOW = new Date("2026-11-10T09:00:00Z");
const DKIM_VALUE = `p=${"MIGfMA0GCSqGSIb3DQEBAQUAA4GNADCBiQKBgQ".repeat(2)}`;

function notFound() {
  return Object.assign(new Error("queryTxt ENOTFOUND"), { code: "ENOTFOUND" });
}

// A local stand-in for DNS: the records it knows, and nothing else. No lookup leaves the machine.
function stubResolver(records: Record<string, string[]>, failing: Record<string, string> = {}): TxtResolver & { asked: string[] } {
  const asked: string[] = [];
  return {
    asked,
    async resolveTxt(name) {
      asked.push(name);
      if (failing[name]) throw Object.assign(new Error("lookup failed"), { code: failing[name] });
      const found = records[name];
      if (!found) throw notFound();
      // DNS may split a long TXT record into parts; they join back into one.
      return found.map((record) => [record.slice(0, 20), record.slice(20)]);
    },
  };
}

describe("the email setup check", () => {
  it("reads the domain from the sender", () => {
    expect(readSendingDomain("Northwind <hello@Mail.Example.com>")).toBe("mail.example.com");
    expect(readSendingDomain("hello@example.com")).toBe("example.com");
    expect(readSendingDomain("Northwind")).toBeNull();
    expect(readSendingDomain("a@b")).toBeNull();
  });

  it("shows every missing record, and the record to add", async () => {
    const check = await checkSendingDomain("mail.test-domain.example", stubResolver({}), NOW);

    expect(check).toMatchObject({ domain: "mail.test-domain.example", checkedAt: NOW.toISOString() });
    expect(check.lines.map(({ key, status }) => [key, status])).toEqual([
      ["spf", "missing"],
      ["dkim", "missing"],
      ["dmarc", "missing"],
    ]);
    expect(check.lines.map(({ toAdd }) => toAdd)).toEqual([
      { type: "TXT", name: "send.mail.test-domain.example", value: "v=spf1 include:amazonses.com ~all" },
      { type: "TXT", name: "resend._domainkey.mail.test-domain.example", value: expect.stringContaining("p=") },
      { type: "TXT", name: "_dmarc.test-domain.example", value: "v=DMARC1; p=none;" },
    ]);
  });

  it("passes a domain with all three, finding DMARC on the parent domain", async () => {
    const resolver = stubResolver({
      "send.mail.test-domain.example": ["v=spf1 include:amazonses.com ~all"],
      "resend._domainkey.mail.test-domain.example": [DKIM_VALUE],
      "_dmarc.test-domain.example": ["v=DMARC1; p=quarantine"],
    });

    const check = await checkSendingDomain("mail.test-domain.example", resolver, NOW);

    expect(check.lines.every(({ status, toAdd }) => status === "ok" && toAdd === null)).toBe(true);
    expect(resolver.asked).toEqual(expect.arrayContaining(["_dmarc.mail.test-domain.example", "_dmarc.test-domain.example"]));
  });

  it("flags an SPF record without Resend's include, and two SPF records", async () => {
    const other = await checkSendingDomain("example.com", stubResolver({ "send.example.com": ["v=spf1 include:_spf.google.com ~all"] }), NOW);
    const two = await checkSendingDomain("example.com", stubResolver({ "send.example.com": ["v=spf1 include:amazonses.com ~all", "v=spf1 -all"] }), NOW);

    expect(other.lines[0]).toMatchObject({ status: "missing", found: expect.stringContaining("not Resend's") });
    expect(two.lines[0]).toMatchObject({ status: "missing", found: expect.stringContaining("Only one is allowed") });
  });

  it("puts DMARC on the registered domain, never on a suffix like co.uk", async () => {
    const resolver = stubResolver({});

    const check = await checkSendingDomain("example.co.uk", resolver, NOW);
    const nested = await checkSendingDomain("mail.example.co.uk", resolver, NOW);

    expect(check.lines[2]?.toAdd?.name).toBe("_dmarc.example.co.uk");
    expect(nested.lines[2]?.toAdd?.name).toBe("_dmarc.example.co.uk");
    expect(resolver.asked).not.toContain("_dmarc.co.uk");
  });

  it("says when DNS didn't answer, instead of calling a record missing", async () => {
    const check = await checkSendingDomain("example.com", stubResolver({}, { "send.example.com": "ESERVFAIL" }), NOW);

    expect(check.lines[0]).toMatchObject({ status: "unknown", found: expect.stringContaining("ESERVFAIL") });
    expect(check.lines[0]?.toAdd).not.toBeNull();
  });
});
