import { readFileSync } from "node:fs";
import { resolve } from "node:path";

import { describe, expect, it } from "vitest";

import { readSourceFiles, REPOSITORY_ROOT } from "@/test/architecture/import-graph";

import { isRouteGone } from "./polling";
import { RequestFailure } from "./post-request";

const NOT_FOUND_STATUS = 404;
const SERVER_ERROR_STATUS = 500;
const POLL_OPTION_PATTERN = /refetchInterval:(?![^\n]*isRouteGone\()/;

function isProductionFile(file: string) {
  return !file.endsWith(".test.ts") && !file.startsWith("src/test/");
}

describe("polling", () => {
  it("stops once a route answers 404, because its module may be off", () => {
    expect(isRouteGone(new RequestFailure(NOT_FOUND_STATUS, "Not found."))).toBe(true);
  });

  it("carries on through other failures", () => {
    expect(isRouteGone(new RequestFailure(SERVER_ERROR_STATUS, "Try again."))).toBe(false);
  });

  it("carries on with no failure", () => {
    expect(isRouteGone(null)).toBe(false);
  });

  it("goes through this rule everywhere", () => {
    const unguarded = readSourceFiles()
      .filter(isProductionFile)
      .filter((file) => POLL_OPTION_PATTERN.test(readFileSync(resolve(REPOSITORY_ROOT, file), "utf8")));

    expect(unguarded).toEqual([]);
  });
});
