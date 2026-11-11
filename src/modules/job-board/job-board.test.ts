// The job board: link detection for every tool, each feed reader on a saved sample feed (src/test/fixtures/jobs),
// the pull through a local fake feed server, the boards, the widget and who may change what. Made-up people only;
// no real hiring tool is called.
import { readFileSync } from "node:fs";
import { createServer, type Server } from "node:http";
import type { AddressInfo } from "node:net";
import { resolve } from "node:path";

import { eq } from "drizzle-orm";
import { afterAll, beforeAll, beforeEach, describe, expect, it } from "vitest";

import { POST as postPublicSwitch } from "@/app/api/admin/jobs/public/route";
import { GET as getEmbed } from "@/app/api/job-board/embed/route";
import { GET as getFrameScript } from "@/app/api/job-board/frame.js/route";
import { POST as postAddJob } from "@/app/api/job-board/jobs/add/route";
import { POST as postRemoveJob } from "@/app/api/job-board/jobs/remove/route";
import { POST as postHide } from "@/app/api/job-board/sources/hide/route";
import { POST as postLink } from "@/app/api/job-board/sources/link/route";
import { POST as postManual } from "@/app/api/job-board/sources/manual/route";
import { POST as postPull } from "@/app/api/job-board/sources/pull/route";
import { POST as postRemove } from "@/app/api/job-board/sources/remove/route";
import { GET as getWidgetScript } from "@/app/api/job-board/widget.js/route";
import { POST as postDirectory } from "@/app/api/members/directory/route";
import PublicJobsPage from "@/app/public/jobs/page";
import { FEED_TOOLS, JOB_BOARD_LIMITS, type FeedTool } from "@/modules/job-board/contract";
import { jobBoardManifest } from "@/modules/job-board/manifest";
import { readAllSources, readBoardCompanies, readBoardJobs, readMemberSources } from "@/modules/job-board/reads";
import { readCompanyJobs, readNewJobs } from "@/modules/job-board/reads-hiring";
import type { Directory } from "@/modules/members/contract-profile";
import { detectBoard, parseFeed, TOOL_READERS } from "@/modules/job-board/rules-feeds";
import { jobPosting, jobSource } from "@/modules/job-board/schema";
import { memberProfile } from "@/modules/members/schema";
import { fetchBoard, pullDueSources } from "@/modules/job-board/service-pull";
import { user } from "@/platform/database/auth-schema";
import { saveModuleState } from "@/platform/modules/enablement";
import { clearDatabase, createTestDatabase } from "@/test/database";
import { createSignedInMember } from "@/test/signed-in-member";

const APP_URL = "http://localhost:3000";
const FAKE_FEED_PORT = 55511;
const FIXTURES = resolve(import.meta.dirname, "../../test/fixtures/jobs");
const NOT_FOUND_DIGEST = "NEXT_HTTP_ERROR_FALLBACK;404";
const FOUNDER_NAME = "Priya Example";
const HOUR_MS = 60 * 60_000;
const DAY_MS = 24 * HOUR_MS;

const LINKS: Record<FeedTool, [string, string][]> = {
  greenhouse: [
    ["https://boards.greenhouse.io/stripe", "stripe"],
    ["https://job-boards.greenhouse.io/acme-robotics/jobs/4012345", "acme-robotics"],
  ],
  lever: [
    ["https://jobs.lever.co/spotify", "spotify"],
    ["https://jobs.lever.co/acme/2a55d6c9-c564-443a-be3e-a3851db5a93b", "acme"],
  ],
  ashby: [
    ["https://jobs.ashbyhq.com/openai", "openai"],
    ["https://api.ashbyhq.com/posting-api/job-board/acme", "acme"],
  ],
  workable: [
    ["https://apply.workable.com/huggingface/", "huggingface"],
    ["https://apply.workable.com/api/v1/widget/accounts/acme", "acme"],
  ],
  smartrecruiters: [
    ["https://careers.smartrecruiters.com/BoschGroup", "BoschGroup"],
    ["https://jobs.smartrecruiters.com/Acme/744000159862638-engineer", "Acme"],
  ],
  recruitee: [
    ["https://bunq.recruitee.com/", "bunq"],
    ["https://acme.recruitee.com/o/backend-engineer", "acme"],
  ],
  breezy: [
    ["https://breezy.breezy.hr/", "breezy"],
    ["https://acme.breezy.hr/p/98323abf2296-engineer", "acme"],
  ],
  rippling: [
    ["https://ats.rippling.com/rippling/jobs", "rippling"],
    ["https://api.rippling.com/platform/api/ats/v1/board/acme/jobs", "acme"],
  ],
  teamtailor: [
    ["https://career.teamtailor.com/jobs", "career"],
    ["acme.teamtailor.com/jobs/8660969-designer", "acme"],
  ],
  bamboohr: [
    ["https://zillow.bamboohr.com/careers", "zillow"],
    ["https://acme.bamboohr.com/careers/15", "acme"],
  ],
  personio: [
    ["https://ottonova.jobs.personio.de/", "ottonova"],
    ["https://acme.jobs.personio.com/job/2573573", "acme"],
  ],
  jobvite: [
    ["https://app.jobvite.com/CompanyJobs/Xml.aspx?c=qX9aVfwX", "qX9aVfwX"],
    ["app.jobvite.com/companyjobs/xml.aspx?c=acme01", "acme01"],
  ],
};

const FIXTURE_FILES: Record<FeedTool, [string, string]> = {
  greenhouse: ["greenhouse-stripe.json", "stripe"],
  lever: ["lever-spotify.json", "spotify"],
  ashby: ["ashby-openai.json", "openai"],
  workable: ["workable-huggingface.json", "huggingface"],
  smartrecruiters: ["smartrecruiters-boschgroup.json", "BoschGroup"],
  recruitee: ["recruitee-bunq.json", "bunq"],
  breezy: ["breezy-breezy.json", "breezy"],
  rippling: ["rippling-rippling.json", "rippling"],
  teamtailor: ["teamtailor-career.json", "career"],
  bamboohr: ["bamboohr-zillow.json", "zillow"],
  personio: ["personio-ottonova.xml", "ottonova"],
  jobvite: ["jobvite-acme.xml", "acme01"],
};

function readFixture(tool: FeedTool) {
  return readFileSync(resolve(FIXTURES, FIXTURE_FILES[tool][0]), "utf8");
}

describe("the feed readers", () => {
  it.each(Object.entries(LINKS).flatMap(([tool, pairs]) => pairs.map(([link, slug]) => ({ tool, link, slug }))))("find $tool's board in $link", ({ tool, link, slug }) => {
    expect(detectBoard(link)).toMatchObject({ tool, slug, link: expect.stringMatching(/^https:\/\//) });
  });

  it.each([
    "https://cashwell.example/careers",
    "https://jobs.jobvite.com/acme/jobs",
    "https://acme.wd5.myworkdayjobs.com/careers",
    "https://www.recruitee.com/",
    "not a link",
    "javascript:alert(1)",
  ])("find no board in %s", (link) => {
    expect(detectBoard(link)).toBeNull();
  });

  it.each(Object.keys(FIXTURE_FILES) as FeedTool[])("read %s's sample feed into the common shape", (tool) => {
    const jobs = parseFeed(tool, readFixture(tool), FIXTURE_FILES[tool][1]);

    expect(jobs).toHaveLength(3);
    for (const job of jobs) {
      expect(Object.keys(job)).toEqual(["externalId", "title", "location", "department", "url", "postedAt"]);
      expect(job.externalId).not.toBe("");
      expect(job.title).not.toBe("");
      expect(job.url).toMatch(/^https:\/\//);
      expect(job.postedAt === null || !Number.isNaN(Date.parse(job.postedAt))).toBe(true);
    }
  });

  it("covers every tool the contract lists", () => {
    expect(Object.keys(TOOL_READERS).toSorted()).toEqual(Object.keys(FEED_TOOLS).toSorted());
    expect(Object.keys(FEED_TOOLS)).toHaveLength(12);
  });

  it("decodes XML entities", () => {
    expect(parseFeed("jobvite", readFixture("jobvite"), "acme01").map(({ title }) => title)).toContain("Product Designer & Researcher");
  });
});

// A fake feed server: /<tool>/ok-* serves that tool's sample feed, unless the slug is in `failing`.
const failing = new Set<string>();

function startFakeFeeds() {
  const server = createServer((request, response) => {
    const [, tool = "", slug = ""] = (request.url ?? "").split("?")[0]?.split("/") ?? [];
    if (failing.has(slug) || slug === "broken") {
      response.writeHead(500);
      response.end();
      return;
    }
    if (slug.startsWith("ok") && Object.hasOwn(FIXTURE_FILES, tool)) {
      response.writeHead(200, { "Content-Type": "application/json" });
      response.end(readFixture(tool as FeedTool));
      return;
    }
    if (slug === "big") {
      response.writeHead(200);
      response.end("[".padEnd(3 * 1024 * 1024, " "));
      return;
    }
    if (slug === "page") {
      response.writeHead(200, { "Content-Type": "text/html" });
      response.end("<!doctype html><title>Careers</title>");
      return;
    }
    if (slug === "slow") return;
    response.writeHead(404);
    response.end("not found");
  });
  return new Promise<Server>((done) => server.listen(FAKE_FEED_PORT, "127.0.0.1", () => done(server)));
}

type Member = Awaited<ReturnType<typeof createSignedInMember>>;
type Handler = (request: Request) => Promise<Response>;

function call(handler: Handler, member: Member | null, body: unknown = {}) {
  return handler(
    new Request(`${APP_URL}/api/job-board`, {
      method: "POST",
      headers: { "Content-Type": "application/json", Origin: APP_URL, ...(member ? { Cookie: member.cookie } : {}) },
      body: JSON.stringify(body),
    }),
  );
}

function visit(handler: Handler, path: string) {
  return handler(new Request(`${APP_URL}${path}`));
}

async function readDigest(rendering: Promise<unknown>) {
  try {
    await rendering;
    return null;
  } catch (error) {
    return typeof error === "object" && error !== null && "digest" in error ? error.digest : null;
  }
}

describe("the job board", () => {
  const database = createTestDatabase();
  let feeds: Server;
  let founder: Member;
  let other: Member;
  let admin: Member;
  let feedOrigin: string;

  beforeAll(async () => {
    feeds = await startFakeFeeds();
    feedOrigin = `http://127.0.0.1:${(feeds.address() as AddressInfo).port}`;
    process.env.JOB_FEEDS_FAKE_ORIGIN = feedOrigin;
  });

  afterAll(async () => {
    delete process.env.JOB_FEEDS_FAKE_ORIGIN;
    feeds.closeAllConnections();
    await new Promise((done) => feeds.close(done));
    await database.$client.end();
  });

  beforeEach(async () => {
    failing.clear();
    await clearDatabase(database);
    await saveModuleState(database, jobBoardManifest, true);
    [founder, other, admin] = await Promise.all([createSignedInMember(database), createSignedInMember(database), createSignedInMember(database, "admin")]);
    await database.update(user).set({ name: FOUNDER_NAME }).where(eq(user.id, founder.userId));
    await database.insert(memberProfile).values([
      { userId: founder.userId, company: "Stripe Example" },
      { userId: other.userId, company: "Ledgerline" },
    ]);
  });

  async function linkGreenhouse(slug = "ok-stripe") {
    const response = await call(postLink, founder, { company: "Stripe Example", link: `https://boards.greenhouse.io/${slug}` });
    expect(response.status).toBe(200);
    const [source] = await readMemberSources(database, founder.userId);
    if (!source) throw new Error("no source");
    return { source, body: (await response.json()) as { ok: boolean; message: string } };
  }

  it("shows a linked Greenhouse board's jobs on the members' board and in the widget", async () => {
    const { body } = await linkGreenhouse();

    expect(body).toMatchObject({ ok: true, message: expect.stringContaining("3 open jobs") });
    const jobs = await readBoardJobs(database, null);
    expect(jobs.map(({ title }) => title)).toEqual(expect.arrayContaining(["Abuse Investigator"]));
    expect(jobs).toHaveLength(3);
    expect(jobs[0]).toMatchObject({ company: "Stripe Example", companySlug: "stripe-example", memberName: FOUNDER_NAME });

    await call(postPublicSwitch, admin, { isPublic: true });
    const embed = await visit(getEmbed, "/api/job-board/embed");
    const html = await embed.text();

    expect(embed.status).toBe(200);
    expect(html).toContain("Abuse Investigator");
    expect(html).toContain("Stripe Example");
    expect(html).not.toContain(FOUNDER_NAME);
    expect(embed.headers.get("Content-Security-Policy")).toContain("frame-ancestors *");
    expect(embed.headers.get("Set-Cookie")).toBeNull();
  });

  it("filters every board by company", async () => {
    await linkGreenhouse();
    const manual = await call(postManual, other, { company: "Ledgerline" });
    const { id } = (await manual.json()) as { id: string };
    await call(postAddJob, other, { sourceId: id, title: "Founding designer", location: "London", url: "https://ledgerline.example/jobs/1" });
    await call(postPublicSwitch, admin, { isPublic: true });

    expect((await readBoardCompanies(database)).map(({ name, jobCount }) => [name, jobCount])).toEqual([
      ["Ledgerline", 1],
      ["Stripe Example", 3],
    ]);
    expect((await readBoardJobs(database, "ledgerline")).map(({ title }) => title)).toEqual(["Founding designer"]);
    const widget = await (await visit(getEmbed, "/api/job-board/embed?company=ledgerline")).text();
    expect(widget).toContain("Founding designer");
    expect(widget).not.toContain("Abuse Investigator");
  });

  it("keeps the old jobs and shows a plain error when a feed breaks", async () => {
    const { source } = await linkGreenhouse("ok-flaky");
    failing.add("ok-flaky");
    await database.update(jobSource).set({ lastPulledAt: new Date(Date.now() - 2 * HOUR_MS) }).where(eq(jobSource.id, source.id));

    expect(await pullDueSources(database, process.env)).toEqual({ pulled: 0, failed: 1 });
    const [broken] = await readMemberSources(database, founder.userId);
    expect(broken).toMatchObject({ jobCount: 3, lastError: "Greenhouse answered with an error (500). We try again next hour." });
    expect(await readBoardJobs(database, null)).toHaveLength(3);
  });

  it("keeps hand-added jobs through a pull, and pulls each board at most once an hour", async () => {
    const { source } = await linkGreenhouse();
    await call(postAddJob, founder, { sourceId: source.id, title: "Founding designer", location: "", url: "https://stripe.example/jobs/1" });

    expect(await pullDueSources(database, process.env)).toEqual({ pulled: 0, failed: 0 });
    await database.update(jobSource).set({ lastPulledAt: new Date(Date.now() - 2 * HOUR_MS) }).where(eq(jobSource.id, source.id));
    expect(await pullDueSources(database, process.env)).toEqual({ pulled: 1, failed: 0 });
    expect(await readBoardJobs(database, null)).toHaveLength(4);
  });

  it("says in plain words when a board doesn't exist, or the link isn't one", async () => {
    const { body } = await linkGreenhouse("gone");
    expect(body).toEqual({ id: expect.any(String), ok: false, message: 'Linked Greenhouse, but: No Greenhouse board called "gone". Check the link, or the board\'s name in it.' });

    const response = await call(postLink, founder, { company: "Cashwell", link: "https://cashwell.example/careers" });
    expect(response.status).toBe(422);
    expect(await response.json()).toMatchObject({ message: expect.stringContaining("We couldn't find a job board in that link") });
  });

  it("stops reading a feed that is too slow, too big or a web page", async () => {
    await expect(fetchBoard("lever", "slow", { url: `${feedOrigin}/lever/slow`, timeoutMs: 300 })).rejects.toThrow("Lever didn't answer within 1 second.");
    await expect(fetchBoard("lever", "big", { url: `${feedOrigin}/lever/big` })).rejects.toThrow("larger than we read (2 MB)");
    await expect(fetchBoard("lever", "page", { url: `${feedOrigin}/lever/page` })).rejects.toThrow('No Lever board called "page"');
  });

  it("lets only the founder remove or add by hand, and an admin pull and hide", async () => {
    const { source } = await linkGreenhouse();
    const sourceBody = { sourceId: source.id };

    expect((await call(postRemove, other, sourceBody)).status).toBe(404);
    expect((await call(postHide, other, { ...sourceBody, hidden: true })).status).toBe(404);
    expect((await call(postPull, other, sourceBody)).status).toBe(404);
    expect((await call(postAddJob, admin, { ...sourceBody, title: "Spam", url: "https://spam.example" })).status).toBe(404);
    expect((await call(postRemove, admin, sourceBody)).status).toBe(404);

    expect((await call(postPull, admin, sourceBody)).status).toBe(429);
    await database.update(jobSource).set({ lastPulledAt: new Date(Date.now() - HOUR_MS) }).where(eq(jobSource.id, source.id));
    expect(await (await call(postPull, admin, sourceBody)).json()).toEqual({ ok: true, message: "Pulled. 3 open jobs." });
    expect((await call(postHide, admin, { ...sourceBody, hidden: true })).status).toBe(200);
    expect(await readBoardJobs(database, null)).toEqual([]);
    expect((await readAllSources(database))[0]).toMatchObject({ hidden: true, memberName: FOUNDER_NAME });

    expect((await call(postRemove, founder, sourceBody)).status).toBe(200);
    expect(await readAllSources(database)).toEqual([]);
  });

  it("keeps an admin's Hide: only an admin shows the jobs again", async () => {
    const { source } = await linkGreenhouse();
    const sourceBody = { sourceId: source.id };
    await call(postHide, admin, { ...sourceBody, hidden: true });

    const answer = await call(postHide, founder, { ...sourceBody, hidden: false });
    expect(answer.status).toBe(403);
    expect(await answer.json()).toMatchObject({ message: "An admin hid these jobs, so only an admin can show them again." });
    expect((await call(postHide, founder, { ...sourceBody, hidden: true })).status).toBe(200);
    expect((await readMemberSources(database, founder.userId))[0]).toMatchObject({ hidden: true, hiddenByAdmin: true });

    expect((await call(postHide, admin, { ...sourceBody, hidden: false })).status).toBe(200);
    expect((await readMemberSources(database, founder.userId))[0]).toMatchObject({ hidden: false, hiddenByAdmin: false });
    expect((await call(postHide, founder, { ...sourceBody, hidden: true })).status).toBe(200);
    expect((await call(postHide, founder, { ...sourceBody, hidden: false })).status).toBe(200);
  });

  it("saves the careers link as a clean https:// address, never as typed", async () => {
    await call(postLink, founder, { company: "Stripe Example", link: "boards.greenhouse.io/ok-noscheme" });
    await call(postLink, founder, { company: "Stripe Example", link: "javascript:alert(document.domain);'@boards.greenhouse.io/ok-tricky?'" });

    const links = (await readMemberSources(database, founder.userId)).map(({ sourceUrl }) => sourceUrl);
    expect(links).toHaveLength(2);
    for (const link of links) expect(link).toMatch(/^https:\/\/boards\.greenhouse\.io\//);
    expect(links.join(" ")).not.toContain("javascript");
  });

  it("removes only hand-added jobs, and only the founder's", async () => {
    const manual = (await (await call(postManual, founder, { company: "Stripe Example" })).json()) as { id: string };
    await call(postAddJob, founder, { sourceId: manual.id, title: "Founding designer", url: "https://ledgerline.example/jobs/1" });
    const [job] = await readBoardJobs(database, null);
    if (!job) throw new Error("no job");

    expect((await call(postRemoveJob, other, { sourceId: manual.id, jobId: job.id })).status).toBe(404);
    expect((await call(postRemoveJob, founder, { sourceId: manual.id, jobId: job.id })).status).toBe(200);
    expect(await readBoardJobs(database, null)).toEqual([]);
  });

  it("refuses a hand-added job whose link isn't a web address", async () => {
    const manual = (await (await call(postManual, founder, { company: "Stripe Example" })).json()) as { id: string };

    expect((await call(postAddJob, founder, { sourceId: manual.id, title: "Designer", url: "javascript:alert(1)" })).status).toBe(422);
  });

  it(`stops at ${JOB_BOARD_LIMITS.sourcesPerMember} sources a member`, async () => {
    for (let index = 0; index < JOB_BOARD_LIMITS.sourcesPerMember; index += 1) await call(postManual, founder, { company: "Stripe Example" });

    expect((await call(postManual, founder, { company: "Stripe Example" })).status).toBe(409);
  });

  it("takes each careers link once, so no job shows twice, even after two quick clicks", async () => {
    await linkGreenhouse();
    const again = await call(postLink, founder, { company: "Stripe Example", link: "https://boards.greenhouse.io/ok-stripe/" });
    expect(again.status).toBe(409);
    expect(await again.json()).toMatchObject({ code: "job_link_taken", message: "This careers link is already on the board, for Stripe Example." });
    const byAdmin = await call(postLink, admin, { company: "Anyone", link: "https://job-boards.greenhouse.io/ok-stripe" });
    expect(byAdmin.status).toBe(409);

    const twice = await Promise.all([1, 2].map(() => call(postLink, founder, { company: "Stripe Example", link: "https://jobs.lever.co/ok-twice" })));
    expect(twice.map(({ status }) => status).sort()).toEqual([200, 409]);
    expect(await readAllSources(database)).toHaveLength(2);
    expect(await readBoardJobs(database, null)).toHaveLength(6);
  });

  it("lets a founder add jobs only for the company on their card, and an admin for any", async () => {
    const elsewhere = await call(postLink, founder, { company: "Gridwise", link: "https://boards.greenhouse.io/ok-gridwise" });
    expect(elsewhere.status).toBe(403);
    expect(await elsewhere.json()).toMatchObject({ code: "job_company_not_yours", message: expect.stringContaining("Stripe Example") });
    expect((await call(postManual, founder, { company: "Gridwise" })).status).toBe(403);
    expect((await call(postLink, founder, { company: "  stripe   EXAMPLE ", link: "https://boards.greenhouse.io/ok-own" })).status).toBe(200);
    expect((await readMemberSources(database, founder.userId)).map(({ company }) => company)).toEqual(["Stripe Example"]);

    await database.update(memberProfile).set({ company: null }).where(eq(memberProfile.userId, other.userId));
    const noCompany = await call(postManual, other, { company: "Ledgerline" });
    expect(noCompany.status).toBe(403);
    expect(await noCompany.json()).toMatchObject({ code: "job_company_missing" });

    expect((await call(postLink, admin, { company: "Gridwise", link: "https://boards.greenhouse.io/ok-gridwise" })).status).toBe(200);
    expect((await call(postManual, admin, { company: "Tallyhealth" })).status).toBe(200);
  });

  it("takes a banned founder's jobs off every board", async () => {
    await linkGreenhouse();
    await database.update(user).set({ banned: true }).where(eq(user.id, founder.userId));

    expect(await readBoardJobs(database, null)).toEqual([]);
  });

  it("keeps the public board and the widget off until an admin turns them on", async () => {
    await linkGreenhouse();

    expect((await visit(getEmbed, "/api/job-board/embed")).status).toBe(404);
    expect(await readDigest(PublicJobsPage({ searchParams: Promise.resolve({}) }))).toBe(NOT_FOUND_DIGEST);
    expect((await call(postPublicSwitch, founder, { isPublic: true })).status).toBe(403);

    await call(postPublicSwitch, admin, { isPublic: true });
    const page = JSON.stringify(await PublicJobsPage({ searchParams: Promise.resolve({}) }));
    expect(page).toContain("Abuse Investigator");
    expect(page).not.toContain(FOUNDER_NAME);
    expect(page).not.toContain(founder.userId);

    await call(postPublicSwitch, admin, { isPublic: false });
    expect((await visit(getEmbed, "/api/job-board/embed")).status).toBe(404);
  });

  it("serves the widget scripts", async () => {
    const widget = await visit(getWidgetScript, "/api/job-board/widget.js");
    const frame = await visit(getFrameScript, "/api/job-board/frame.js");

    expect(widget.headers.get("Content-Type")).toContain("text/javascript");
    expect(await widget.text()).toContain("/api/job-board/embed");
    expect(await frame.text()).toContain("size_updated");
  });

  it("answers 404 everywhere when the module is off", async () => {
    await linkGreenhouse();
    await call(postPublicSwitch, admin, { isPublic: true });
    await saveModuleState(database, jobBoardManifest, false);

    expect((await visit(getEmbed, "/api/job-board/embed")).status).toBe(404);
    expect((await visit(getWidgetScript, "/api/job-board/widget.js")).status).toBe(404);
    expect(await readDigest(PublicJobsPage({ searchParams: Promise.resolve({}) }))).toBe(NOT_FOUND_DIGEST);
  });

  it("shows a company's jobs on its members' profiles, as a Hiring chip and filter in the directory, and nothing when off", async () => {
    await linkGreenhouse();
    const colleague = await createSignedInMember(database);
    await database.insert(memberProfile).values({ userId: colleague.userId, company: " STRIPE example " });

    const profileJobs = await readCompanyJobs(database, "stripe example");
    expect(profileJobs).toMatchObject({ total: 3, companySlug: "stripe-example" });
    expect(profileJobs.jobs[0]?.url).toMatch(/^https:\/\//);
    expect(await readCompanyJobs(database, "Ledgerline")).toEqual({ jobs: [], total: 0, companySlug: null });

    const hiring = (await (await call(postDirectory, other, { hiring: true })).json()) as Directory;
    expect(hiring.isHiringShown).toBe(true);
    expect(hiring.members.map(({ id, hiringJobCount }) => [id, hiringJobCount]).sort()).toEqual([[colleague.userId, 3], [founder.userId, 3]].sort());

    await saveModuleState(database, jobBoardManifest, false);
    const off = (await (await call(postDirectory, other, { hiring: true })).json()) as Directory;
    expect(off.isHiringShown).toBe(false);
    expect(off.matchCount).toBe(4);
    expect(off.members.every(({ hiringJobCount }) => hiringJobCount === 0)).toBe(true);
  });

  it("counts a job as new this week when it was posted, or first seen without a date, in the last 7 days", async () => {
    const { source } = await linkGreenhouse();
    const [first] = await database.select({ id: jobPosting.id }).from(jobPosting).where(eq(jobPosting.sourceId, source.id)).limit(1);
    await database.update(jobPosting).set({ postedAt: new Date(Date.now() - 30 * DAY_MS), firstSeenAt: new Date(Date.now() - 30 * DAY_MS) }).where(eq(jobPosting.sourceId, source.id));
    await database.update(jobPosting).set({ postedAt: null, firstSeenAt: new Date(Date.now() - 2 * DAY_MS) }).where(eq(jobPosting.id, first?.id ?? ""));
    const manual = await call(postManual, other, { company: "Ledgerline" });
    const { id } = (await manual.json()) as { id: string };
    await call(postAddJob, other, { sourceId: id, title: "Founding designer", location: "London", url: "https://ledgerline.example/jobs/1" });

    const newJobs = await readNewJobs(database);
    expect(newJobs.total).toBe(2);
    expect(newJobs.jobs.map(({ company }) => company).sort()).toEqual(["Ledgerline", "Stripe Example"]);

    await database.update(user).set({ banned: true }).where(eq(user.id, other.userId));
    expect((await readNewJobs(database)).total).toBe(1);
  });
});
