import { existsSync } from "node:fs";
import { join } from "node:path";

import { describe, expect, it } from "vitest";

import { DEMO_INVITEES, DEMO_OUTSIDERS, DEMO_PEOPLE, toDemoEmail } from "./people";
import { toDemoFaceUrl, toDemoLogoUrl } from "./pictures";
import { answerDemoVillage, DEMO_VILLAGE_KEYS } from "./village-answers";

const PUBLIC_DIRECTORY = join(import.meta.dirname, "..", "..", "..", "public");

function isBundled(url: string) {
  return existsSync(join(PUBLIC_DIRECTORY, url));
}

async function askDemoVillage(path: string, body: object) {
  const tokenResponse = await answerDemoVillage(
    new Request("https://village.demo.invalid/v2/auth/tokens", { method: "POST", body: JSON.stringify({ external_user_id: "1", email: "sam.lee@example.com", key: DEMO_VILLAGE_KEYS.secretKey }) }),
  );
  const { data: token } = (await tokenResponse.json()) as { data: { token: string } };
  const response = await answerDemoVillage(
    new Request(`https://village.demo.invalid${path}`, { method: "POST", headers: { authorization: `Bearer ${token.token}` }, body: JSON.stringify(body) }),
  );
  return { status: response.status, body: (await response.json()) as { data: Record<string, unknown> } };
}

describe("demo pictures", () => {
  it("bundles a portrait for every made-up person and a drawn mark for every made-up company", () => {
    const people = [...DEMO_PEOPLE, ...DEMO_INVITEES, ...DEMO_OUTSIDERS];
    expect(people.map(({ name }) => toDemoFaceUrl(name)).filter((url) => !isBundled(url))).toEqual([]);
    expect(people.map(({ company }) => toDemoLogoUrl(company)).filter((url) => !isBundled(url))).toEqual([]);
  });

  it("finds a demo member's public profile with their face and logo, and nobody else", async () => {
    const member = DEMO_PEOPLE.find(({ key }) => key === "priya.shah");
    if (!member) throw new Error("The demo has no Priya.");
    const found = await askDemoVillage("/v2/people/enrich/by-email", { email: toDemoEmail(member) });
    expect(found.status).toBe(200);
    expect(found.body.data).toMatchObject({ avatar: toDemoFaceUrl(member.name), work_relevant: { company: { image_url: toDemoLogoUrl(member.company) } } });
    expect((await askDemoVillage("/v2/people/enrich/by-email", { email: "someone@example.com" })).status).toBe(404);
  });
});

describe("old drawn-face links", () => {
  it("redirect to the portrait, so a demo seeded before the portraits keeps its faces until its reset", async () => {
    const { createRequire } = await import("node:module");
    const { nextConfig } = await import("../../../next.config.mjs");
    const { pathToRegexp, compile } = createRequire(import.meta.url)("next/dist/compiled/path-to-regexp") as {
      pathToRegexp: (source: string, keys: { name: string }[], options: object) => RegExp;
      compile: (path: string) => (params: object) => string;
    };
    const rule = (await nextConfig.redirects()).find(({ source }) => source.startsWith("/demo/faces/"));
    const keys: { name: string }[] = [];
    const match = pathToRegexp(rule?.source ?? "", keys, { strict: true, sensitive: false, delimiter: "/" }).exec("/demo/faces/sam-lee.svg");

    expect(match?.[1]).toBe("sam-lee");
    const destination = compile(rule?.destination ?? "")({ [keys[0]?.name ?? ""]: match?.[1] });
    expect(destination).toBe("/demo/faces/sam-lee.webp");
    expect(isBundled(destination)).toBe(true);
  });
});
