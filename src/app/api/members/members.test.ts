import { beforeEach, describe, expect, it } from "vitest";

import { memberTag } from "@/database/members-schema";
import { DIRECTORY_PAGE_SIZE, readMemberNeighbours, readNewMembers } from "@/lib/members/directory";
import { directorySchema } from "@/lib/members/profile-api";
import { clearDatabase, createTestDatabase } from "@/test/database";
import { seedMember } from "@/test/members";
import { createSignedInMember } from "@/test/signed-in-member";

import { POST as postDirectory } from "./directory/route";

const APP_URL = "http://localhost:3000";
const OK_STATUS = 200;
const UNAUTHORIZED_STATUS = 401;
const FORBIDDEN_STATUS = 403;
const UNPROCESSABLE_STATUS = 422;
const DAY_MS = 24 * 60 * 60 * 1000;

type Member = Awaited<ReturnType<typeof createSignedInMember>>;

describe("the member directory", () => {
  const database = createTestDatabase();
  let viewer: Member;

  function request(member: Member | null, body: unknown, origin = APP_URL) {
    return postDirectory(
      new Request(`${APP_URL}/api/members/directory`, {
        method: "POST",
        headers: { "Content-Type": "application/json", Origin: origin, ...(member ? { Cookie: member.cookie } : {}) },
        body: JSON.stringify(body),
      }),
    );
  }

  async function search(body: unknown) {
    return directorySchema.parse(await (await request(viewer, body)).json());
  }

  async function searchNames(body: unknown) {
    const { members } = await search(body);
    return members.map(({ name }) => name);
  }

  beforeEach(async () => {
    await clearDatabase(database);
    viewer = await createSignedInMember(database);
  });

  describe("access", () => {
    it("refuses a visitor", async () => {
      expect((await request(null, {})).status).toBe(UNAUTHORIZED_STATUS);
    });

    it("refuses another site's origin", async () => {
      expect((await request(viewer, {}, "https://evil.test")).status).toBe(FORBIDDEN_STATUS);
    });

    it("answers a signed-in member", async () => {
      expect((await request(viewer, {})).status).toBe(OK_STATUS);
    });

    it("never includes anyone's email", async () => {
      await seedMember(database, { name: "Noor Haddad" });

      const text = await (await request(viewer, {})).text();

      expect(text).not.toContain("@");
    });
  });

  describe("who appears", () => {
    it("leaves out a banned member", async () => {
      await seedMember(database, { name: "Banned Ben", banned: true });

      expect(await searchNames({})).not.toContain("Banned Ben");
    });

    it("includes a member whose ban has run out", async () => {
      await seedMember(database, { name: "Past Pat", banned: true, banExpires: new Date(Date.now() - DAY_MS) });

      expect(await searchNames({})).toContain("Past Pat");
    });

    it("leaves out a member whose temporary ban is still running", async () => {
      await seedMember(database, { name: "Temp Tess", banned: true, banExpires: new Date(Date.now() + DAY_MS) });

      expect(await searchNames({})).not.toContain("Temp Tess");
    });

    it("includes someone with no card yet, with no photo, so initials show", async () => {
      const { members } = await search({ search: "Test Member" });

      expect(members[0]).toMatchObject({ avatarUrl: null, title: null, company: null, tags: [] });
    });

    it("counts only members who can appear", async () => {
      await seedMember(database, { name: "Noor" });
      await seedMember(database, { name: "Banned Ben", banned: true });

      expect((await search({})).memberCount).toBe(2);
    });
  });

  describe("search", () => {
    beforeEach(async () => {
      await seedMember(database, { name: "Noor Haddad", company: "Kindling Health", tags: ["Healthtech"] });
      await seedMember(database, { name: "Jonas Lindqvist", company: "Ledgerline", canHelpWith: "Usage pricing", tags: ["Fintech"] });
    });

    it("finds by name, whatever the case", async () => {
      expect(await searchNames({ search: "NOOR" })).toEqual(["Noor Haddad"]);
    });

    it("finds by company", async () => {
      expect(await searchNames({ search: "ledger" })).toEqual(["Jonas Lindqvist"]);
    });

    it("finds by tag", async () => {
      expect(await searchNames({ search: "healthtech" })).toEqual(["Noor Haddad"]);
    });

    it("finds by what they can help with", async () => {
      expect(await searchNames({ search: "pricing" })).toEqual(["Jonas Lindqvist"]);
    });

    it("treats wildcards as plain text", async () => {
      expect(await searchNames({ search: "%" })).toEqual([]);
      expect(await searchNames({ search: "N_or" })).toEqual([]);
      expect(await searchNames({ search: "\\" })).toEqual([]);
    });

    it("finds a literal percent sign", async () => {
      await seedMember(database, { name: "Priya", company: "100% Coffee" });

      expect(await searchNames({ search: "100%" })).toEqual(["Priya"]);
    });

    it("treats SQL as plain text", async () => {
      expect(await searchNames({ search: "' or '1'='1" })).toEqual([]);
      expect(await searchNames({})).toContain("Noor Haddad");
    });

    it("ignores a NUL byte instead of failing", async () => {
      const response = await request(viewer, { search: "No\0or" });

      expect(response.status).toBe(OK_STATUS);
      expect(await searchNames({ search: "No\0or" })).toEqual(["Noor Haddad"]);
    });

    it("refuses an overlong search", async () => {
      expect((await request(viewer, { search: "x".repeat(81) })).status).toBe(UNPROCESSABLE_STATUS);
    });
  });

  describe("filtering by tag", () => {
    it("matches the whole tag, whatever the case", async () => {
      await seedMember(database, { name: "Noor", tags: ["Fintech"] });
      await seedMember(database, { name: "Jonas", tags: ["Fintech Ops"] });

      expect(await searchNames({ tag: "fintech" })).toEqual(["Noor"]);
    });

    it("offers the most used tags as filters", async () => {
      await seedMember(database, { name: "Noor", tags: ["Climate", "Fintech"] });
      await seedMember(database, { name: "Jonas", tags: ["fintech"] });

      const { popularTags } = await search({});

      expect(popularTags.map(({ value }) => value)).toEqual(["fintech", "climate"]);
    });

    it("offers no filter that only a banned member has", async () => {
      await seedMember(database, { name: "Banned Ben", banned: true, tags: ["Secret"] });

      expect((await search({})).popularTags).toEqual([]);
      expect(await database.select().from(memberTag)).toHaveLength(1);
    });
  });

  describe("pagination", () => {
    beforeEach(async () => {
      for (let position = 0; position < DIRECTORY_PAGE_SIZE; position += 1) {
        await seedMember(database, { name: `Person ${String(position).padStart(2, "0")}` });
      }
    });

    it("splits members across pages", async () => {
      const first = await search({ page: 1 });
      const second = await search({ page: 2 });

      expect(first.members).toHaveLength(DIRECTORY_PAGE_SIZE);
      expect(second.members).toHaveLength(1);
      expect(first.pageCount).toBe(2);
      expect(first.matchCount).toBe(DIRECTORY_PAGE_SIZE + 1);
    });

    it("lands on the last page when asked for one past the end", async () => {
      const directory = await search({ page: 99 });

      expect(directory.page).toBe(2);
      expect(directory.members).toHaveLength(1);
    });
  });

  describe("faces on the welcome screen", () => {
    it("shows real members, not the newcomer or anyone banned", async () => {
      await seedMember(database, { name: "Noor" });
      await seedMember(database, { name: "Banned Ben", banned: true });

      const neighbours = await readMemberNeighbours(database, viewer.userId);

      expect(neighbours.map(({ name }) => name)).toEqual(["Noor"]);
    });
  });

  describe("new members on Home", () => {
    it("counts this week's arrivals, not the viewer, older members or banned ones", async () => {
      await seedMember(database, { name: "New Noor", company: "Kindling" });
      await seedMember(database, { name: "Old Otto", createdAt: new Date(Date.now() - 8 * DAY_MS) });
      await seedMember(database, { name: "Banned Ben", banned: true });

      const { newCount, newMembers } = await readNewMembers(database, viewer.userId);

      expect(newCount).toBe(1);
      expect(newMembers.map(({ name }) => name)).toEqual(["New Noor"]);
      expect(newMembers[0]?.company).toBe("Kindling");
    });

    it("reports no invented numbers in an empty community", async () => {
      expect(await readNewMembers(database, viewer.userId)).toEqual({ newCount: 0, newMembers: [] });
    });
  });
});
