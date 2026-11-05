import { execFileSync } from "node:child_process";
import { readFileSync } from "node:fs";
import { resolve } from "node:path";

import { describe, expect, it } from "vitest";

import { readSetupToken } from "../platform/secrets/setup-token.ts";

const REPOSITORY_ROOT = resolve(import.meta.dirname, "../..");
const THIS_FILE = "src/test/public-repo.test.ts";
const BINARY_FILE_PATTERN = /\.(png|jpe?g|webp|ico|woff2?)$/i;
const INTERNAL_PATTERNS = [
  /[a-z0-9.-]*(-stg|\.stg|staging)[a-z0-9.-]*\.village\.[a-z]+/i,
  /community-e2e/i,
  /E2E_VILLAGE/,
  /\/Users\/[a-z]/,
  /[a-z0-9._%+-]+@village\.do/i,
];

function readRepositoryFile(file: string) {
  return readFileSync(resolve(REPOSITORY_ROOT, file), "utf8");
}

function readTrackedTextFiles() {
  return execFileSync("git", ["ls-files"], { cwd: REPOSITORY_ROOT, encoding: "utf8" })
    .split("\n")
    .filter((file) => file && file !== THIS_FILE && !BINARY_FILE_PATTERN.test(file));
}

function readDigitalOceanSetupToken() {
  return readRepositoryFile(".do/deploy.template.yaml").match(/key: SETUP_TOKEN[\s\S]*?value: (\S+)/)?.[1];
}

describe("the deploy buttons", () => {
  it("prompt for the setup token and nothing else, so email stays optional", () => {
    expect(readRepositoryFile("README.md")).toContain("&env=SETUP_TOKEN&");
    expect(readRepositoryFile(".do/deploy.template.yaml")).not.toContain("RESEND");
  });

  it("hide Railway's button until its template exists", () => {
    const visibleReadme = readRepositoryFile("README.md").replace(/<!--[\s\S]*?-->/g, "");

    expect(visibleReadme).not.toContain("railway.com/new/template");
    expect(visibleReadme).toContain("Railway: coming soon");
  });
});

describe("the DigitalOcean template", () => {
  it("lists a setup token placeholder, because the button prompts only for listed values", () => {
    expect(readDigitalOceanSetupToken()).toBeTruthy();
  });

  it("uses a placeholder the app refuses, so nobody can leave it in place", () => {
    expect(readSetupToken({ SETUP_TOKEN: readDigitalOceanSetupToken() })).toBeNull();
  });

  it("asks for no scheduled jobs, workers or file storage", () => {
    const template = readRepositoryFile(".do/deploy.template.yaml");

    expect(template).not.toMatch(/^\s*(jobs|workers|functions):/m);
    expect(template).not.toMatch(/spaces|bucket/i);
  });
});

describe("the public repo", () => {
  it("keeps internal names out of every tracked file", () => {
    const filesWithInternalNames = readTrackedTextFiles().filter((file) => {
      const text = readRepositoryFile(file);
      return INTERNAL_PATTERNS.some((pattern) => pattern.test(text));
    });

    expect(filesWithInternalNames).toEqual([]);
  });

  it.each(["LICENSE", "CONTRIBUTING.md", "SECURITY.md"])("ships %s", (file) => {
    expect(readRepositoryFile(file).length).toBeGreaterThan(0);
  });

  it("uses the MIT License", () => {
    expect(readRepositoryFile("LICENSE")).toContain("MIT License");
  });
});
