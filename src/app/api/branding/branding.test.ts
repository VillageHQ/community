import { eq } from "drizzle-orm";
import { afterEach, beforeAll, beforeEach, describe, expect, it, vi } from "vitest";

import { communityBranding } from "@/platform/branding/schema";
import { INSTANCE_SETTING_KEYS, instanceSettings } from "@/platform/settings/schema";
import { readSetupProgress, SETUP_STEPS } from "@/lib/admin-setup";
import { DEFAULT_BRANDING, readBranding } from "@/platform/branding/branding";
import { MAXIMUM_LOGO_BYTES } from "@/platform/branding/logo-rules";
import { readConfirmedVillageDomain } from "@/lib/village/settings";
import { clearDatabase, createTestDatabase } from "@/test/database";
import { createSignedInMember } from "@/test/signed-in-member";

import { POST as postBranding } from "@/app/api/admin/branding/route";
import { POST as postDomain } from "@/app/api/admin/setup/domain/route";
import { DELETE as deleteLogoRoute, GET as getLogo, POST as postLogo } from "./logo/route";

const APP_URL = "http://localhost:3000";
const LOGO_URL = `${APP_URL}/api/branding/logo`;
const OK_STATUS = 200;
const NOT_MODIFIED_STATUS = 304;
const UNAUTHORIZED_STATUS = 401;
const FORBIDDEN_STATUS = 403;
const NOT_FOUND_STATUS = 404;
const TOO_LARGE_STATUS = 413;
const UNPROCESSABLE_STATUS = 422;

const PNG_BYTES = new Uint8Array([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a, 1, 2, 3]);
const JPEG_BYTES = new Uint8Array([0xff, 0xd8, 0xff, 0xe0, 1, 2, 3]);
const SVG_TEXT = '<svg xmlns="http://www.w3.org/2000/svg"><script>alert(1)</script></svg>';

type Member = Awaited<ReturnType<typeof createSignedInMember>>;

const VALID_BRAND = { name: "Northwind", descriptor: "Founder community", accentColor: "#2556E8" };

function jsonRequest(member: Member | null, body: unknown, origin = APP_URL) {
  return new Request(`${APP_URL}/api/admin/branding`, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      Origin: origin,
      ...(member ? { Cookie: member.cookie } : {}),
    },
    body: JSON.stringify(body),
  });
}

function logoRequest(member: Member | null, body: BodyInit, contentType = "image/png", origin = APP_URL) {
  return new Request(LOGO_URL, {
    method: "POST",
    headers: { "Content-Type": contentType, Origin: origin, ...(member ? { Cookie: member.cookie } : {}) },
    body,
  });
}

describe("branding", () => {
  const database = createTestDatabase();
  let admin: Member;
  let member: Member;

  beforeAll(async () => {
    await clearDatabase(database);
    admin = await createSignedInMember(database, "admin");
    member = await createSignedInMember(database);
  });

  beforeEach(async () => {
    await database.delete(communityBranding);
    await database.delete(instanceSettings).where(eq(instanceSettings.key, INSTANCE_SETTING_KEYS.villageDomainConfirmed));
  });

  afterEach(() => {
    vi.restoreAllMocks();
  });

  describe("saving the brand", () => {
    it("stores a valid brand and lowercases the accent", async () => {
      const response = await postBranding(jsonRequest(admin, VALID_BRAND));

      expect(response.status).toBe(OK_STATUS);
      expect(await readBranding(database)).toMatchObject({
        name: "Northwind",
        descriptor: "Founder community",
        accentColor: "#2556e8",
        isSaved: true,
      });
    });

    it("refuses a visitor", async () => {
      expect((await postBranding(jsonRequest(null, VALID_BRAND))).status).toBe(UNAUTHORIZED_STATUS);
    });

    it("refuses a member who isn't an admin", async () => {
      expect((await postBranding(jsonRequest(member, VALID_BRAND))).status).toBe(FORBIDDEN_STATUS);
    });

    it("refuses another site's origin", async () => {
      const response = await postBranding(jsonRequest(admin, VALID_BRAND, "https://evil.test"));

      expect(response.status).toBe(FORBIDDEN_STATUS);
    });

    it.each([
      "#000000;}body{display:none}",
      "</style><script>alert(1)</script>",
      "red",
      "#fff",
      "#00000g",
      "#000000\n",
    ])("refuses the accent %j without saving it", async (accentColor) => {
      const response = await postBranding(jsonRequest(admin, { ...VALID_BRAND, accentColor }));

      expect(response.status).toBe(UNPROCESSABLE_STATUS);
      expect(await readBranding(database)).toEqual(DEFAULT_BRANDING);
    });

    it("refuses a blank name", async () => {
      const response = await postBranding(jsonRequest(admin, { ...VALID_BRAND, name: "   " }));

      expect(response.status).toBe(UNPROCESSABLE_STATUS);
    });

    it("refuses a name that wouldn't fit", async () => {
      const response = await postBranding(jsonRequest(admin, { ...VALID_BRAND, name: "n".repeat(61) }));

      expect(response.status).toBe(UNPROCESSABLE_STATUS);
    });
  });

  describe("uploading a logo", () => {
    it("stores a PNG", async () => {
      const response = await postLogo(logoRequest(admin, PNG_BYTES));

      expect(response.status).toBe(OK_STATUS);
      expect((await readBranding(database)).logo?.url).toMatch(/^\/api\/branding\/logo\?v=\d+$/);
    });

    it("remembers the dark backdrop for a light mark on transparency", async () => {
      const request = new Request(`${LOGO_URL}?backdrop=dark`, {
        method: "POST",
        headers: { "Content-Type": "image/png", Origin: APP_URL, Cookie: admin.cookie },
        body: PNG_BYTES,
      });

      await postLogo(request);

      expect((await readBranding(database)).logo?.backdrop).toBe("dark");
    });

    it("keeps the brand unsaved, so uploading alone doesn't finish the step", async () => {
      await postLogo(logoRequest(admin, PNG_BYTES));

      expect((await readBranding(database)).isSaved).toBe(false);
    });

    it("refuses a visitor", async () => {
      expect((await postLogo(logoRequest(null, PNG_BYTES))).status).toBe(UNAUTHORIZED_STATUS);
    });

    it("refuses a member who isn't an admin", async () => {
      expect((await postLogo(logoRequest(member, PNG_BYTES))).status).toBe(FORBIDDEN_STATUS);
    });

    it("refuses another site's origin", async () => {
      const response = await postLogo(logoRequest(admin, PNG_BYTES, "image/png", "https://evil.test"));

      expect(response.status).toBe(FORBIDDEN_STATUS);
    });

    it.each([
      ["a visitor", null, APP_URL],
      ["another site", null, "https://evil.test"],
    ])("reads no body from %s", async (_name, requester, origin) => {
      const request = logoRequest(requester, new Uint8Array(MAXIMUM_LOGO_BYTES), "image/png", origin);

      const response = await postLogo(request);

      expect(response.status).toBeGreaterThanOrEqual(UNAUTHORIZED_STATUS);
      expect(request.bodyUsed).toBe(false);
    });

    it("reads no body from a member who isn't an admin", async () => {
      const request = logoRequest(member, new Uint8Array(MAXIMUM_LOGO_BYTES));

      expect((await postLogo(request)).status).toBe(FORBIDDEN_STATUS);
      expect(request.bodyUsed).toBe(false);
    });

    it("refuses an SVG, even labelled as a PNG", async () => {
      const response = await postLogo(logoRequest(admin, SVG_TEXT, "image/png"));

      expect(response.status).toBe(UNPROCESSABLE_STATUS);
      expect((await readBranding(database)).logo).toBeNull();
    });

    it("refuses an empty file", async () => {
      const response = await postLogo(logoRequest(admin, new Uint8Array()));

      expect(response.status).toBe(UNPROCESSABLE_STATUS);
    });

    it("refuses a file over the size cap", async () => {
      const oversized = new Uint8Array(MAXIMUM_LOGO_BYTES + 1);
      oversized.set(PNG_BYTES);

      const response = await postLogo(logoRequest(admin, oversized));

      expect(response.status).toBe(TOO_LARGE_STATUS);
      expect((await readBranding(database)).logo).toBeNull();
    });

    it("accepts a file exactly at the cap", async () => {
      const atCap = new Uint8Array(MAXIMUM_LOGO_BYTES);
      atCap.set(PNG_BYTES);

      expect((await postLogo(logoRequest(admin, atCap))).status).toBe(OK_STATUS);
    });

    it("removes a logo", async () => {
      await postLogo(logoRequest(admin, PNG_BYTES));

      const response = await deleteLogoRoute(
        new Request(LOGO_URL, { method: "DELETE", headers: { Origin: APP_URL, Cookie: admin.cookie } }),
      );

      expect(response.status).toBe(OK_STATUS);
      expect((await readBranding(database)).logo).toBeNull();
    });

    it("refuses removal by a member who isn't an admin", async () => {
      const response = await deleteLogoRoute(
        new Request(LOGO_URL, { method: "DELETE", headers: { Origin: APP_URL, Cookie: member.cookie } }),
      );

      expect(response.status).toBe(FORBIDDEN_STATUS);
    });
  });

  describe("serving the logo", () => {
    it("answers 404 before a logo exists", async () => {
      expect((await getLogo(new Request(LOGO_URL))).status).toBe(NOT_FOUND_STATUS);
    });

    it("serves the stored bytes under the detected type, not the uploaded label", async () => {
      await postLogo(logoRequest(admin, JPEG_BYTES, "image/png"));

      const response = await getLogo(new Request(LOGO_URL));

      expect(response.headers.get("Content-Type")).toBe("image/jpeg");
      expect(new Uint8Array(await response.arrayBuffer())).toEqual(JPEG_BYTES);
    });

    it("forbids sniffing", async () => {
      await postLogo(logoRequest(admin, PNG_BYTES));

      const { headers } = await getLogo(new Request(LOGO_URL));

      expect(headers.get("X-Content-Type-Options")).toBe("nosniff");
    });

    it("answers 304 when the browser already has this version", async () => {
      await postLogo(logoRequest(admin, PNG_BYTES));
      const entityTag = (await getLogo(new Request(LOGO_URL))).headers.get("ETag") ?? "";

      const response = await getLogo(new Request(LOGO_URL, { headers: { "If-None-Match": entityTag } }));

      expect(response.status).toBe(NOT_MODIFIED_STATUS);
    });
  });

  describe("confirming the domain", () => {
    it("records the current hostname", async () => {
      const response = await postDomain(jsonRequest(admin, { confirmed: true }));

      expect(response.status).toBe(OK_STATUS);
      expect(await readConfirmedVillageDomain(database)).toBe("localhost");
    });

    it("reopens the step when the site moves to another domain", async () => {
      await postDomain(jsonRequest(admin, { confirmed: true }));

      const domainIsDone = async (appUrl: string) => {
        const { steps } = await readSetupProgress(database, { APP_URL: appUrl });
        return steps.find(({ id }) => id === SETUP_STEPS.domain)?.isDone;
      };

      expect(await domainIsDone(APP_URL)).toBe(true);
      expect(await domainIsDone("https://community.example.test")).toBe(false);
    });

    it("needs the confirmation", async () => {
      expect((await postDomain(jsonRequest(admin, {}))).status).toBe(UNPROCESSABLE_STATUS);
    });

    it("refuses a member who isn't an admin", async () => {
      expect((await postDomain(jsonRequest(member, { confirmed: true }))).status).toBe(FORBIDDEN_STATUS);
    });
  });
});
