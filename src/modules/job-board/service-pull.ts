import "server-only";

import { and, asc, eq, isNotNull, isNull, lt, notInArray, or, sql } from "drizzle-orm";

import type { Database } from "@/platform/database/client";
import type { Environment } from "@/platform/environment";
import { logError } from "@/platform/observability/route-logging";

import { FEED_TOOLS, isFeedTool, JOB_BOARD_LIMITS, type FeedTool } from "./contract";
import { parseFeed, readFeedUrl, TOOL_READERS, type FeedJob } from "./rules-feeds";
import { jobPosting, jobSource } from "./schema";

const TIMEOUT_MS = 15_000;
const DEFAULT_MAXIMUM_BYTES = 2 * 1024 * 1024;
const BYTES_PER_MEGABYTE = 1024 * 1024;
const USER_AGENT = "Community job board (+https://github.com/VillageHQ/community)";
// For tests and local proof only: every feed is read from this origin instead of the tool's own host.
const FAKE_ORIGIN_VARIABLE = "JOB_FEEDS_FAKE_ORIGIN";
const UNKNOWN_PROBLEM = "Something went wrong reading the job list. We try again next hour.";

// A fetch problem, in words a founder understands.
export class FeedError extends Error {}

type FetchOptions = { fetch?: typeof fetch; url?: string; timeoutMs?: number; maximumBytes?: number };

export function readFeedAddress(environment: Environment, tool: FeedTool, slug: string) {
  const fakeOrigin = environment[FAKE_ORIGIN_VARIABLE];
  if (fakeOrigin && environment.NODE_ENV !== "production") return `${fakeOrigin.replace(/\/$/, "")}/${tool}/${encodeURIComponent(slug)}`;
  return readFeedUrl(tool, slug);
}

async function readCapped(response: Response, maximumBytes: number, label: string) {
  if (!response.body) return "";
  const reader = response.body.getReader();
  const chunks: Uint8Array[] = [];
  let size = 0;
  for (;;) {
    const { done, value } = await reader.read();
    if (done) break;
    size += value.length;
    if (size > maximumBytes) {
      await reader.cancel();
      throw new FeedError(`${label}'s job list is larger than we read (${Math.round(maximumBytes / BYTES_PER_MEGABYTE)} MB). Add your jobs by hand instead.`);
    }
    chunks.push(value);
  }
  return Buffer.concat(chunks).toString("utf8");
}

function isRedirect(status: number) {
  return status >= 300 && status < 400;
}

function isTimeout(error: unknown) {
  return error instanceof Error && (error.name === "TimeoutError" || error.name === "AbortError");
}

// Fetches and maps one board: 15 s, a 2 MB cap (Ashby 20 MB) read as a stream, one redirect inside the tool's domain.
export async function fetchBoard(tool: FeedTool, slug: string, options: FetchOptions = {}): Promise<FeedJob[]> {
  const reader = TOOL_READERS[tool];
  const { label } = FEED_TOOLS[tool];
  const doFetch = options.fetch ?? fetch;
  const timeoutMs = options.timeoutMs ?? TIMEOUT_MS;
  const maximumBytes = options.maximumBytes ?? reader.maximumBytes ?? DEFAULT_MAXIMUM_BYTES;
  const signal = AbortSignal.timeout(timeoutMs);
  const wholeSeconds = Math.max(1, Math.round(timeoutMs / 1000));
  const seconds = `${wholeSeconds} ${wholeSeconds === 1 ? "second" : "seconds"}`;
  const notFound = () => new FeedError(`No ${label} board called "${slug}". Check the link, or the board's name in it.`);
  const headers = { Accept: "application/json, application/xml;q=0.9, */*;q=0.5", "User-Agent": USER_AGENT };
  let url = options.url ?? readFeedUrl(tool, slug);
  let redirected = false;
  let response: Response;
  try {
    response = await doFetch(url, { redirect: "manual", signal, headers });
    if (isRedirect(response.status)) {
      const location = response.headers.get("location");
      let next: URL | null = null;
      try {
        next = location ? new URL(location, url) : null;
      } catch {
        next = null;
      }
      // A redirect to the tool's home page (BambooHR does this for a name it doesn't know) means no such board.
      const stays =
        next !== null &&
        (options.url ? next.host === new URL(url).host : next.protocol === "https:" && (next.hostname === reader.domain || next.hostname.endsWith(`.${reader.domain}`)));
      if (!next || !stays || next.pathname === "/" || next.hostname.startsWith("www.")) throw notFound();
      url = next.href;
      redirected = true;
      response = await doFetch(url, { redirect: "manual", signal, headers });
      if (isRedirect(response.status)) throw notFound();
    }
  } catch (error) {
    if (error instanceof FeedError) throw error;
    if (isTimeout(error)) throw new FeedError(`${label} didn't answer within ${seconds}. We try again next hour.`);
    throw new FeedError(`We couldn't reach ${label}. We try again next hour.`);
  }
  if (response.status === 404 || response.status === 410) {
    await response.body?.cancel();
    throw notFound();
  }
  if (!response.ok) {
    await response.body?.cancel();
    throw new FeedError(`${label} answered with an error (${response.status}). We try again next hour.`);
  }
  let text: string;
  try {
    text = await readCapped(response, maximumBytes, label);
  } catch (error) {
    if (error instanceof FeedError) throw error;
    throw new FeedError(isTimeout(error) ? `${label} didn't finish sending within ${seconds}. We try again next hour.` : `We couldn't read ${label}'s answer. We try again next hour.`);
  }
  try {
    return parseFeed(tool, text, slug);
  } catch {
    // An HTML page where a JSON feed should be is a board that doesn't exist.
    const isPage = /^\s*</.test(text) && tool !== "personio" && tool !== "jobvite";
    throw redirected || isPage ? notFound() : new FeedError(`${label} sent a job list we couldn't read. We try again next hour.`);
  }
}

// A pull that worked: the feed's jobs replace the pulled ones. Jobs added by hand stay.
async function savePull(database: Database, sourceId: string, jobs: readonly FeedJob[]) {
  await database.transaction(async (transaction) => {
    const now = new Date();
    if (jobs.length > 0) {
      await transaction
        .insert(jobPosting)
        .values(
          jobs.map((job) => ({
            sourceId,
            externalId: job.externalId,
            title: job.title,
            location: job.location,
            department: job.department,
            url: job.url,
            postedAt: job.postedAt ? new Date(job.postedAt) : null,
            isManual: false,
            updatedAt: now,
          })),
        )
        .onConflictDoUpdate({
          target: [jobPosting.sourceId, jobPosting.externalId],
          set: {
            title: sql`excluded.title`,
            location: sql`excluded.location`,
            department: sql`excluded.department`,
            url: sql`excluded.url`,
            postedAt: sql`excluded.posted_at`,
            updatedAt: sql`excluded.updated_at`,
          },
        });
    }
    const kept = jobs.map(({ externalId }) => externalId);
    const gone = and(eq(jobPosting.sourceId, sourceId), eq(jobPosting.isManual, false));
    await transaction.delete(jobPosting).where(kept.length > 0 ? and(gone, notInArray(jobPosting.externalId, kept)) : gone);
    await transaction.update(jobSource).set({ lastPulledAt: now, lastError: null }).where(eq(jobSource.id, sourceId));
  });
}

// A pull that failed: the jobs from the last good pull stay, and the problem is shown to the founder and the admin.
async function savePullError(database: Database, sourceId: string, message: string) {
  await database
    .update(jobSource)
    .set({ lastPulledAt: new Date(), lastError: message.slice(0, JOB_BOARD_LIMITS.errorLength) })
    .where(eq(jobSource.id, sourceId));
}

type PullableSource = { id: string; tool: string; slug: string | null };
export type PullOutcome = { ok: true; count: number } | { ok: false; error: string };

export async function pullSource(database: Database, environment: Environment, source: PullableSource, options: FetchOptions = {}): Promise<PullOutcome> {
  if (!isFeedTool(source.tool) || !source.slug) return { ok: true, count: 0 };
  try {
    const jobs = await fetchBoard(source.tool, source.slug, { url: readFeedAddress(environment, source.tool, source.slug), ...options });
    await savePull(database, source.id, jobs);
    return { ok: true, count: jobs.length };
  } catch (error) {
    const message = error instanceof FeedError ? error.message : UNKNOWN_PROBLEM;
    if (!(error instanceof FeedError)) logError("job-board-pull", error);
    await savePullError(database, source.id, message);
    return { ok: false, error: message };
  }
}

// Sources with a feed that no pull has touched for an hour, oldest first, a few per tick.
export async function pullDueSources(database: Database, environment: Environment, options: FetchOptions = {}) {
  const dueBefore = new Date(Date.now() - JOB_BOARD_LIMITS.pullEveryMinutes * 60_000);
  const due = await database
    .select({ id: jobSource.id, tool: jobSource.tool, slug: jobSource.slug })
    .from(jobSource)
    .where(and(isNotNull(jobSource.slug), or(isNull(jobSource.lastPulledAt), lt(jobSource.lastPulledAt, dueBefore))))
    .orderBy(sql`${jobSource.lastPulledAt} asc nulls first`, asc(jobSource.id))
    .limit(JOB_BOARD_LIMITS.sourcesPerTick);
  const summary = { pulled: 0, failed: 0 };
  for (const source of due) {
    const outcome = await pullSource(database, environment, source, options);
    if (outcome.ok) summary.pulled += 1;
    else summary.failed += 1;
  }
  return summary;
}

