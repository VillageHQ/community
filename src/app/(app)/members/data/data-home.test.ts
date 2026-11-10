import { eq } from "drizzle-orm";
import { isValidElement, type ReactElement, type ReactNode } from "react";
import { renderToStaticMarkup } from "react-dom/server";
import { afterAll, beforeEach, describe, expect, it, vi } from "vitest";

import { POST as postDataHome } from "@/app/api/admin/data-home/route";
import { AUDIT_ACTIONS } from "@/platform/audit/actions";
import { adminAuditEntry } from "@/platform/audit/schema";
import { readDataHome } from "@/platform/settings/data-home";
import { clearDatabase, createTestDatabase } from "@/test/database";
import { createSignedInMember } from "@/test/signed-in-member";

import YourDataPage from "./page";

const session = vi.hoisted(() => ({ cookie: "" }));

vi.mock("next/headers", () => ({ headers: async () => new Headers({ cookie: session.cookie }) }));

const APP_URL = "http://localhost:3000";
const FILLED = { location: "EU, Frankfurt, a made-up host", contactName: "Data protection lead", contactEmail: "Privacy@Example.com" };

type Member = Awaited<ReturnType<typeof createSignedInMember>>;

function save(member: Member, body: unknown) {
  return postDataHome(
    new Request(`${APP_URL}/api/admin/data-home`, {
      method: "POST",
      headers: { "Content-Type": "application/json", Origin: APP_URL, Cookie: member.cookie },
      body: JSON.stringify(body),
    }),
  );
}

function findByName(node: ReactNode, name: string): ReactElement | null {
  if (Array.isArray(node)) return node.map((child) => findByName(child, name)).find(Boolean) ?? null;
  if (!isValidElement<{ children?: ReactNode }>(node)) return null;
  if (typeof node.type === "function" && node.type.name === name) return node;
  return findByName(node.props.children, name);
}

async function readYourDataText(member: Member) {
  session.cookie = member.cookie;
  const facts = findByName(await YourDataPage(), "DataHomeFacts");
  return facts ? renderToStaticMarkup(facts) : "";
}

describe("where the data is kept, and whom to ask", () => {
  const database = createTestDatabase();
  let admin: Member;
  let member: Member;

  beforeEach(async () => {
    await clearDatabase(database);
    admin = await createSignedInMember(database, "admin");
    member = await createSignedInMember(database);
  });

  afterAll(async () => {
    await database.$client.end();
  });

  it("shows members exactly what the admin saved, and audits the change", async () => {
    expect((await save(admin, FILLED)).status).toBe(200);

    expect(await readDataHome(database)).toEqual({
      location: FILLED.location,
      contact: { name: FILLED.contactName, email: "privacy@example.com" },
    });
    const html = await readYourDataText(member);
    expect(html).toContain("EU, Frankfurt, a made-up host");
    expect(html).toContain("Data protection lead");
    expect(html).toContain('href="mailto:privacy@example.com"');
    expect(await database.select().from(adminAuditEntry).where(eq(adminAuditEntry.action, AUDIT_ACTIONS.dataHomeSaved))).toHaveLength(1);
  });

  it("shows nothing about it when neither is set, or once both are cleared", async () => {
    expect(await readYourDataText(member)).toBe("");

    await save(admin, FILLED);
    await save(admin, { location: " ", contactName: "", contactEmail: "" });

    expect(await readDataHome(database)).toEqual({ location: null, contact: null });
    expect(await readYourDataText(member)).toBe("");
  });

  it("shows one without the other", async () => {
    await save(admin, { location: "", contactName: "", contactEmail: "privacy@example.com" });

    const html = await readYourDataText(member);
    expect(html).not.toContain("Where the data is kept");
    expect(html).toContain("Write to");
  });

  it("refuses a bad email, or a name with no email, in plain words", async () => {
    const badEmail = await save(admin, { ...FILLED, contactEmail: "not-an-email" });
    expect(badEmail.status).toBe(422);
    expect(JSON.stringify(await badEmail.json())).toContain("Check the contact email: it isn't an email address.");

    const nameOnly = await save(admin, { ...FILLED, contactEmail: "" });
    expect(nameOnly.status).toBe(422);
    expect(JSON.stringify(await nameOnly.json())).toContain("Add an email for data requests, or clear the contact's name.");

    expect(await readDataHome(database)).toEqual({ location: null, contact: null });
  });

  it("is for admins only", async () => {
    expect((await save(member, FILLED)).status).toBe(403);
    expect(await readDataHome(database)).toEqual({ location: null, contact: null });
  });
});
