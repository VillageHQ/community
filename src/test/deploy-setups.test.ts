import { readFileSync } from "node:fs";
import { resolve } from "node:path";

import { describe, expect, it } from "vitest";

import { API_ROUTES } from "../platform/http/routes.ts";

const REPOSITORY_ROOT = resolve(import.meta.dirname, "../..");

function readRepositoryFile(file: string) {
  return readFileSync(resolve(REPOSITORY_ROOT, file), "utf8");
}

function readVercelButtonLinks(file: string) {
  return [...readRepositoryFile(file).matchAll(/https:\/\/vercel\.com\/new\/clone\?[^)"\s]+/g)].map(([link]) => new URL(link.replaceAll("&amp;", "&")));
}

// Every supported setup runs the timed jobs (weekly email, reminders, nightly tasks) without the owner adding anything.
describe("every deploy setup runs the timed jobs", () => {
  it("Vercel: a cron calls the tick endpoint, and both buttons ask for the CRON_SECRET it sends", () => {
    const { crons } = JSON.parse(readRepositoryFile("vercel.json")) as { crons: { path: string; schedule: string }[] };
    expect(crons).toEqual([expect.objectContaining({ path: API_ROUTES.jobsTick })]);
    // Vercel's free plan refuses a cron that runs more than once a day, so the button keeps working there.
    expect(crons[0]?.schedule).toMatch(/^\d+ \d+ \* \* \*$/);

    const links = [...readVercelButtonLinks("README.md"), ...readVercelButtonLinks("site/index.html")];
    expect(links).toHaveLength(2);
    for (const link of links) expect(link.searchParams.get("env")?.split(",")).toEqual(["SETUP_TOKEN", "CRON_SECRET"]);
  });

  it("DigitalOcean: the template switches on the self-tick on the port the app listens on", () => {
    const template = readRepositoryFile(".do/deploy.template.yaml");
    expect(template).toMatch(/- key: JOBS_SELF_TICK\n\s+scope: RUN_TIME\n\s+value: "true"/);
    expect(template).toMatch(/http_port: 8080/);
    expect(template).toMatch(/- key: PORT\n\s+scope: RUN_TIME\n\s+value: "8080"/);
  });

  it("own server: the installer's compose file switches on the self-tick", () => {
    expect(readRepositoryFile("deploy/vps/compose.yml")).toMatch(/JOBS_SELF_TICK: "true"/);
  });

  it("Railway: the maintainer's template notes set the self-tick", () => {
    expect(readRepositoryFile("README.md")).toMatch(/### Railway template[\s\S]*- `JOBS_SELF_TICK`: `true`/);
  });
});
