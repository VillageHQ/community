import { readFileSync } from "node:fs";
import { resolve } from "node:path";

import { describe, expect, it } from "vitest";

const PUBLIC_DOCS = ["README.md", ".env.example"];
const STAGING_HOST_PATTERN = /[a-z0-9.-]*(-stg|\.stg|staging)[a-z0-9.-]*\.village\.[a-z]+/i;

describe("the public docs", () => {
  it.each(PUBLIC_DOCS)("keep staging hostnames out of %s", (file) => {
    const text = readFileSync(resolve(import.meta.dirname, "../..", file), "utf8");

    expect(text).not.toMatch(STAGING_HOST_PATTERN);
  });
});
