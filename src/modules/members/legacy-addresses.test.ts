import { createRequire } from "node:module";

import { describe, expect, it } from "vitest";

type PathToRegexp = {
  pathToRegexp: (source: string, keys: { name: string }[], options: object) => RegExp;
  compile: (path: string) => (params: object) => string;
};

// Next.js tries the redirects in order and takes the first match, with these path-to-regexp options.
async function resolveRedirect(path: string) {
  const { nextConfig } = await import("../../../next.config.mjs");
  const { pathToRegexp, compile } = createRequire(import.meta.url)("next/dist/compiled/path-to-regexp") as PathToRegexp;
  for (const rule of await nextConfig.redirects()) {
    const keys: { name: string }[] = [];
    const match = pathToRegexp(rule.source, keys, { strict: true, sensitive: false, delimiter: "/" }).exec(path);
    if (!match) continue;
    const params = Object.fromEntries(keys.map((key, position) => [key.name, match[position + 1]]));
    return { destination: compile(rule.destination)(params), permanent: rule.permanent };
  }
  return null;
}

describe("the old directory and profile addresses", () => {
  it.each([
    ["/members", "/directory"],
    ["/members/card", "/me"],
    ["/members/data", "/me/data"],
    ["/members/ada-123", "/people/ada-123"],
  ])("%s moves for good to %s", async (path, destination) => {
    expect(await resolveRedirect(path)).toEqual({ destination, permanent: true });
  });
});
