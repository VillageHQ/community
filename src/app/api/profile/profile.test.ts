import { eq } from "drizzle-orm";
import { beforeEach, describe, expect, it } from "vitest";

import { user } from "@/platform/database/auth-schema";
import { memberProfile, memberTag } from "@/database/members-schema";
import { memberNetwork } from "@/database/village-schema";
import { MAXIMUM_AVATAR_BYTES } from "@/lib/members/avatar-rules";
import { readAvatarUrl, readMemberProfile } from "@/lib/members/profile";
import { clearDatabase, createTestDatabase } from "@/test/database";
import { createSignedInMember } from "@/test/signed-in-member";

import { GET as getAvatar } from "@/app/api/members/[memberId]/avatar/route";
import { POST as postLinkedin } from "@/app/api/network/linkedin/route";
import { DELETE as deleteAvatarRoute, POST as postAvatar } from "./avatar/route";
import { POST as postProfile } from "./route";

const APP_URL = "http://localhost:3000";
const OK_STATUS = 200;
const NOT_MODIFIED_STATUS = 304;
const UNAUTHORIZED_STATUS = 401;
const FORBIDDEN_STATUS = 403;
const NOT_FOUND_STATUS = 404;
const CONFLICT_STATUS = 409;
const TOO_LARGE_STATUS = 413;
const UNPROCESSABLE_STATUS = 422;

const PNG_BYTES = new Uint8Array([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a, 1, 2, 3]);
const JPEG_BYTES = new Uint8Array([0xff, 0xd8, 0xff, 0xe0, 1, 2, 3]);
const SVG_TEXT = '<svg xmlns="http://www.w3.org/2000/svg"><script>alert(1)</script></svg>';

type Member = Awaited<ReturnType<typeof createSignedInMember>>;

describe("member profiles", () => {
  const database = createTestDatabase();
  let member: Member;
  let other: Member;

  function save(body: unknown, requester: Member | null = member, origin = APP_URL) {
    return postProfile(
      new Request(`${APP_URL}/api/profile`, {
        method: "POST",
        headers: { "Content-Type": "application/json", Origin: origin, ...(requester ? { Cookie: requester.cookie } : {}) },
        body: JSON.stringify(body),
      }),
    );
  }

  function avatarUpload(body: BodyInit, requester: Member | null = member, origin = APP_URL) {
    return new Request(`${APP_URL}/api/profile/avatar`, {
      method: "POST",
      headers: { "Content-Type": "image/png", Origin: origin, ...(requester ? { Cookie: requester.cookie } : {}) },
      body,
    });
  }

  function readAvatar(memberId: string, requester: Member | null = other, headers: Record<string, string> = {}) {
    return getAvatar(
      new Request(`${APP_URL}/api/members/${memberId}/avatar`, {
        headers: { ...(requester ? { Cookie: requester.cookie } : {}), ...headers },
      }),
      { params: Promise.resolve({ memberId }) },
    );
  }

  beforeEach(async () => {
    await clearDatabase(database);
    member = await createSignedInMember(database);
    other = await createSignedInMember(database);
  });

  describe("saving a card", () => {
    it("stores every field", async () => {
      const response = await save({
        name: "Amara Osei",
        title: "Founder",
        company: "Tidewell",
        location: "Lisbon",
        bio: "Tide power.",
        canHelpWith: "Grants",
        needs: "A CFO",
        website: "https://tidewell.example",
        tags: ["Climate"],
      });

      expect(response.status).toBe(OK_STATUS);
      expect(await readMemberProfile(database, member.userId)).toMatchObject({
        name: "Amara Osei",
        title: "Founder",
        company: "Tidewell",
        location: "Lisbon",
        bio: "Tide power.",
        canHelpWith: "Grants",
        needs: "A CFO",
        website: "https://tidewell.example/",
        tags: ["Climate"],
      });
    });

    it("clears a field saved blank", async () => {
      await save({ company: "Tidewell" });

      await save({ company: "   " });

      expect((await readMemberProfile(database, member.userId))?.company).toBeNull();
    });

    it("leaves a field alone when it isn't sent", async () => {
      await save({ company: "Tidewell" });

      await save({ title: "Founder" });

      expect(await readMemberProfile(database, member.userId)).toMatchObject({ company: "Tidewell", title: "Founder" });
    });

    it("refuses a blank name", async () => {
      expect((await save({ name: " " })).status).toBe(UNPROCESSABLE_STATUS);
    });

    it("refuses an overlong bio", async () => {
      expect((await save({ bio: "b".repeat(281) })).status).toBe(UNPROCESSABLE_STATUS);
    });

    it("can't change the account email or role", async () => {
      await save({ email: "new@example.test", role: "admin" });
      const [row] = await database.select().from(user).where(eq(user.id, member.userId));

      expect(row).toMatchObject({ email: member.email, role: "user" });
    });

    it("only changes the signed-in member", async () => {
      await save({ userId: other.userId, id: other.userId, company: "Tidewell" });

      expect((await readMemberProfile(database, other.userId))?.company).toBeNull();
      expect((await readMemberProfile(database, member.userId))?.company).toBe("Tidewell");
    });

    it("strips NUL bytes instead of failing", async () => {
      const response = await save({ company: "Tide\0well", name: "Am\0ara", tags: ["Cli\0mate"] });

      expect(response.status).toBe(OK_STATUS);
      expect(await readMemberProfile(database, member.userId)).toMatchObject({ company: "Tidewell", name: "Amara", tags: ["Climate"] });
    });

    it("refuses a visitor", async () => {
      expect((await save({ company: "x" }, null)).status).toBe(UNAUTHORIZED_STATUS);
    });

    it("refuses another site's origin", async () => {
      expect((await save({ company: "x" }, member, "https://evil.test")).status).toBe(FORBIDDEN_STATUS);
    });

    it("doesn't start onboarding for someone who was never in it", async () => {
      await save({ company: "Tidewell" });
      const [profile] = await database.select().from(memberProfile).where(eq(memberProfile.userId, member.userId));

      expect(profile?.onboardingCompletedAt).toBeInstanceOf(Date);
    });
  });

  describe("the website", () => {
    it.each(["javascript:alert(1)", "data:text/html,<script>alert(1)</script>", "ftp://example.com", "https://user:pass@example.com", "not a url"])(
      "refuses %s",
      async (website) => {
        const response = await save({ website });

        expect(response.status).toBe(UNPROCESSABLE_STATUS);
        expect((await readMemberProfile(database, member.userId))?.website).toBeNull();
      },
    );

    it("accepts http", async () => {
      await save({ website: "http://example.com/about" });

      expect((await readMemberProfile(database, member.userId))?.website).toBe("http://example.com/about");
    });

    it("assumes https without a scheme", async () => {
      await save({ website: "example.com" });

      expect((await readMemberProfile(database, member.userId))?.website).toBe("https://example.com/");
    });

    it("won't render a stored value that turned unsafe", async () => {
      await database
        .insert(memberProfile)
        .values({ userId: member.userId, website: "javascript:alert(1)" });

      expect((await readMemberProfile(database, member.userId))?.website).toBeNull();
    });
  });

  describe("tags", () => {
    it("drops duplicates, whatever the case", async () => {
      await save({ tags: ["Fintech", "fintech ", "Series  A"] });

      expect((await readMemberProfile(database, member.userId))?.tags).toEqual(["Fintech", "Series A"]);
    });

    it("replaces the old tags", async () => {
      await save({ tags: ["Fintech"] });

      await save({ tags: ["Climate"] });

      expect(await database.select().from(memberTag)).toMatchObject([{ tag: "Climate", normalizedTag: "climate" }]);
    });

    it("refuses too many", async () => {
      const response = await save({ tags: Array.from({ length: 9 }, (_unused, position) => `tag-${position}`) });

      expect(response.status).toBe(UNPROCESSABLE_STATUS);
    });
  });

  describe("LinkedIn", () => {
    async function readSlug(userId: string) {
      const [network] = await database.select().from(memberNetwork).where(eq(memberNetwork.userId, userId));
      return network?.linkedinSlug;
    }

    it("saves into the same slug field network search matches on", async () => {
      await save({ linkedinUrl: "https://www.linkedin.com/in/Amara-Osei/" });

      expect(await readSlug(member.userId)).toBe("amara-osei");
      expect((await readMemberProfile(database, member.userId))?.linkedinSlug).toBe("amara-osei");
    });

    it("refuses a profile another member holds, and saves nothing else", async () => {
      await save({ linkedinUrl: "https://www.linkedin.com/in/amara-osei" }, other);

      const response = await save({ linkedinUrl: "https://linkedin.com/in/amara-osei", company: "Tidewell" });

      expect(response.status).toBe(CONFLICT_STATUS);
      expect((await readMemberProfile(database, member.userId))?.company).toBeNull();
    });

    it("refuses a profile claimed through the network page", async () => {
      await postLinkedin(
        new Request(`${APP_URL}/api/network/linkedin`, {
          method: "POST",
          headers: { "Content-Type": "application/json", Origin: APP_URL, Cookie: other.cookie },
          body: JSON.stringify({ linkedinUrl: "https://www.linkedin.com/in/amara-osei" }),
        }),
      );

      expect((await save({ linkedinUrl: "https://www.linkedin.com/in/amara-osei" })).status).toBe(CONFLICT_STATUS);
    });

    it("refuses a slug hiding a NUL byte, without failing", async () => {
      expect((await save({ linkedinUrl: "https://www.linkedin.com/in/ama%00ra" })).status).toBe(UNPROCESSABLE_STATUS);
    });

    it("refuses a URL that isn't a LinkedIn profile", async () => {
      expect((await save({ linkedinUrl: "https://example.com/in/amara" })).status).toBe(UNPROCESSABLE_STATUS);
    });

    it("won't clear a saved slug, because network search depends on it", async () => {
      await save({ linkedinUrl: "https://www.linkedin.com/in/amara-osei" });

      const response = await save({ linkedinUrl: "" });

      expect(response.status).toBe(UNPROCESSABLE_STATUS);
      expect(await readSlug(member.userId)).toBe("amara-osei");
    });

    it("accepts a blank field from someone who never set one", async () => {
      expect((await save({ linkedinUrl: "", company: "Tidewell" })).status).toBe(OK_STATUS);
      expect(await readSlug(member.userId)).toBeUndefined();
    });
  });

  describe("uploading a photo", () => {
    it("stores a PNG, and points the profile at it", async () => {
      const response = await postAvatar(avatarUpload(PNG_BYTES));

      expect(response.status).toBe(OK_STATUS);
      expect(await readAvatarUrl(database, member.userId)).toMatch(/\/api\/members\/.+\/avatar\?v=\d+$/);
    });

    it("refuses an SVG, even labelled as a PNG", async () => {
      const response = await postAvatar(avatarUpload(SVG_TEXT));

      expect(response.status).toBe(UNPROCESSABLE_STATUS);
      expect(await readAvatarUrl(database, member.userId)).toBeNull();
    });

    it("refuses an empty file", async () => {
      expect((await postAvatar(avatarUpload(new Uint8Array()))).status).toBe(UNPROCESSABLE_STATUS);
    });

    it("refuses a file over the cap", async () => {
      const oversized = new Uint8Array(MAXIMUM_AVATAR_BYTES + 1);
      oversized.set(PNG_BYTES);

      expect((await postAvatar(avatarUpload(oversized))).status).toBe(TOO_LARGE_STATUS);
    });

    it("accepts a file exactly at the cap", async () => {
      const atCap = new Uint8Array(MAXIMUM_AVATAR_BYTES);
      atCap.set(PNG_BYTES);

      expect((await postAvatar(avatarUpload(atCap))).status).toBe(OK_STATUS);
    });

    it("reads no body from a visitor", async () => {
      const request = avatarUpload(PNG_BYTES, null);

      expect((await postAvatar(request)).status).toBe(UNAUTHORIZED_STATUS);
      expect(request.bodyUsed).toBe(false);
    });

    it("refuses another site's origin", async () => {
      expect((await postAvatar(avatarUpload(PNG_BYTES, member, "https://evil.test"))).status).toBe(FORBIDDEN_STATUS);
    });

    it("ignores the image field Better Auth lets members set, so nobody can inject a tracking URL", async () => {
      await database.update(user).set({ image: "https://evil.test/pixel.png" }).where(eq(user.id, member.userId));

      expect((await readMemberProfile(database, member.userId))?.avatarUrl).toBeNull();
      expect(await readAvatarUrl(database, member.userId)).toBeNull();
    });

    it("removes a photo", async () => {
      await postAvatar(avatarUpload(PNG_BYTES));

      const response = await deleteAvatarRoute(
        new Request(`${APP_URL}/api/profile/avatar`, { method: "DELETE", headers: { Origin: APP_URL, Cookie: member.cookie } }),
      );

      expect(response.status).toBe(OK_STATUS);
      expect(await readAvatarUrl(database, member.userId)).toBeNull();
    });
  });

  describe("reading a photo", () => {
    beforeEach(async () => {
      await postAvatar(avatarUpload(JPEG_BYTES));
    });

    it("serves another signed-in member the stored bytes under the detected type", async () => {
      const response = await readAvatar(member.userId);

      expect(response.headers.get("Content-Type")).toBe("image/jpeg");
      expect(new Uint8Array(await response.arrayBuffer())).toEqual(JPEG_BYTES);
    });

    it("refuses a visitor", async () => {
      expect((await readAvatar(member.userId, null)).status).toBe(UNAUTHORIZED_STATUS);
    });

    it("forbids sniffing and shared caches", async () => {
      const { headers } = await readAvatar(member.userId);

      expect(headers.get("X-Content-Type-Options")).toBe("nosniff");
      expect(headers.get("Cache-Control")).toContain("private");
    });

    it("answers 304 when the browser already has this version", async () => {
      const entityTag = (await readAvatar(member.userId)).headers.get("ETag") ?? "";

      const response = await readAvatar(member.userId, other, { "If-None-Match": entityTag });

      expect(response.status).toBe(NOT_MODIFIED_STATUS);
    });

    it("answers 404 for a banned member", async () => {
      await database.update(user).set({ banned: true }).where(eq(user.id, member.userId));

      expect((await readAvatar(member.userId)).status).toBe(NOT_FOUND_STATUS);
    });

    it("answers 404 for an id with a NUL byte", async () => {
      expect((await readAvatar("\0")).status).toBe(NOT_FOUND_STATUS);
    });

    it("answers 404 for someone with no photo", async () => {
      expect((await readAvatar(other.userId)).status).toBe(NOT_FOUND_STATUS);
    });
  });

  describe("viewing a profile", () => {
    it("finds nobody for a banned member", async () => {
      await database.update(user).set({ banned: true }).where(eq(user.id, member.userId));

      expect(await readMemberProfile(database, member.userId)).toBeNull();
    });

    it("finds nobody for an unknown id", async () => {
      expect(await readMemberProfile(database, "' or 1=1 --")).toBeNull();
    });
  });
});
