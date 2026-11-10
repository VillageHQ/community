import { afterAll, beforeEach, describe, expect, it } from "vitest";

import { POST as postRemove } from "@/app/api/admin/perks/remove/route";
import { POST as postSave } from "@/app/api/admin/perks/route";
import { parsePerksEmbed, PERKS_REFUSED_MESSAGE } from "@/modules/perks/contract";
import { perksManifest } from "@/modules/perks/manifest";
import { readPerksUrl } from "@/modules/perks/service";
import { saveModuleState } from "@/platform/modules/enablement";
import { clearDatabase, createTestDatabase } from "@/test/database";
import { createSignedInMember } from "@/test/signed-in-member";

const APP_URL = "http://localhost:3000";
const MARKETPLACE = "https://northwind.builtfirst.com/perks?embed=1&theme=light";

describe("reading a BuiltFirst embed code", () => {
  it("keeps only the iframe's https src on builtfirst.com", () => {
    const code = `<div><script src="https://evil.example/x.js"></script><iframe class="x" src="https://northwind.builtfirst.com/perks?embed=1&amp;theme=light" onload="steal()"></iframe></div>`;

    expect(parsePerksEmbed(code)).toEqual({ url: MARKETPLACE });
  });

  it("takes a bare BuiltFirst address and the apex domain", () => {
    expect(parsePerksEmbed("https://builtfirst.com/m/northwind")).toEqual({ url: "https://builtfirst.com/m/northwind" });
  });

  it.each([
    ['<iframe src="https://evil.example/perks"></iframe>'],
    ['<iframe src="https://builtfirst.com.evil.example/perks"></iframe>'],
    ['<iframe src="https://evilbuiltfirst.com/perks"></iframe>'],
    ['<iframe src="http://northwind.builtfirst.com/perks"></iframe>'],
    ['<iframe src="https://user:pass@northwind.builtfirst.com/"></iframe>'],
    ['<iframe src="https://northwind.builtfirst.com:8443/"></iframe>'],
    ['<iframe src="javascript:alert(1)"></iframe>'],
    ["<script>alert(1)</script>"],
    ["<iframe></iframe>"],
    [""],
  ])("refuses %s", (code) => {
    expect(parsePerksEmbed(code)).toEqual({ error: PERKS_REFUSED_MESSAGE });
  });
});

describe("the perks admin", () => {
  const database = createTestDatabase();

  beforeEach(async () => {
    await clearDatabase(database);
    await saveModuleState(database, perksManifest, true);
  });

  afterAll(async () => {
    await database.$client.end();
  });

  function call(handler: (request: Request) => Promise<Response>, cookie: string, body: unknown) {
    return handler(
      new Request(`${APP_URL}/api/admin/perks`, { method: "POST", headers: { "content-type": "application/json", origin: APP_URL, cookie }, body: JSON.stringify(body) }),
    );
  }

  it("saves only the address, refuses other code and removes it", async () => {
    const { cookie } = await createSignedInMember(database, "admin");

    const refused = await call(postSave, cookie, { code: '<iframe src="https://evil.example/"></iframe>' });
    expect(refused.status).toBe(422);
    expect(await readPerksUrl(database)).toBeNull();

    expect((await call(postSave, cookie, { code: `<iframe src="${MARKETPLACE}"></iframe>` })).status).toBe(200);
    expect(await readPerksUrl(database)).toBe(MARKETPLACE);

    expect((await call(postRemove, cookie, {})).status).toBe(200);
    expect(await readPerksUrl(database)).toBeNull();
  });

  it("is for admins only", async () => {
    const { cookie } = await createSignedInMember(database);

    expect((await call(postSave, cookie, { code: MARKETPLACE })).status).toBe(403);
  });
});
