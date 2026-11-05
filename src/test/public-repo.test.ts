import { readFileSync } from "node:fs";
import { resolve } from "node:path";

import { describe, expect, it } from "vitest";

const PUBLIC_DOCS = ["README.md", ".env.example"];
const STAGING_HOST_PATTERN = /[a-z0-9.-]*(-stg|\.stg|staging)[a-z0-9.-]*\.village\.[a-z]+/i;

describe("the deploy buttons", () => {
  it("prompt for the setup token and nothing else, so email stays optional", () => {
    const readme = readFileSync(resolve(import.meta.dirname, "../../README.md"), "utf8");
    const template = readFileSync(resolve(import.meta.dirname, "../../.do/deploy.template.yaml"), "utf8");

    expect(readme).toContain("&env=SETUP_TOKEN&");
    expect(template).not.toContain("RESEND");
  });
});

describe("the public docs", () => {
  it.each(PUBLIC_DOCS)("keep staging hostnames out of %s", (file) => {
    const text = readFileSync(resolve(import.meta.dirname, "../..", file), "utf8");

    expect(text).not.toMatch(STAGING_HOST_PATTERN);
  });
});
