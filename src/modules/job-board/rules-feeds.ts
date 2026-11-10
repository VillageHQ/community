// The hiring tools' public job feeds (no key). One reader per tool: find the board's name (the slug) in a link the
// founder pastes, build the feed's address, and map its jobs to one shape. Only the slug comes from the founder's
// link: the address fetched is always the tool's own feed host, so a pasted link never makes the app fetch an
// address of the founder's choosing.

import { FEED_TOOLS, isFeedTool, JOB_BOARD_LIMITS, type FeedTool } from "./contract.ts";

export type FeedJob = { externalId: string; title: string; location: string; department: string; url: string; postedAt: string | null };

type Json = Record<string, unknown>;

type ToolReader = {
  // The feed's host family: a redirect may only stay inside it.
  domain: string;
  maximumBytes?: number;
  slug: (url: URL) => string | null;
  url: (slug: string) => string;
  parse: (body: string, slug: string) => FeedJob[];
};

const SLUG = /^[A-Za-z0-9][A-Za-z0-9._-]{0,99}$/;
const RESERVED_SLUGS = /^(www|app|api|jobs|careers|embed|j|v0|v1)$/i;

function readSlug(value: string | null | undefined) {
  return value && SLUG.test(value) && !RESERVED_SLUGS.test(value) ? value : null;
}

function pathParts(url: URL) {
  return url.pathname.split("/").filter(Boolean);
}

function firstSegment(url: URL, hosts: readonly string[]) {
  return hosts.includes(url.hostname) ? readSlug(pathParts(url)[0]) : null;
}

function subdomainOf(url: URL, domain: string) {
  return url.hostname.endsWith(`.${domain}`) ? readSlug(url.hostname.slice(0, -domain.length - 1)) : null;
}

function segmentAfter(url: URL, host: string, after: readonly string[]) {
  if (url.hostname !== host) return null;
  const parts = pathParts(url);
  const index = parts.findIndex((_, start) => parts.slice(start, start + after.length).join("/") === after.join("/"));
  return index >= 0 ? readSlug(parts[index + after.length]) : null;
}

function toIsoDate(value: unknown) {
  if (value === null || value === undefined || value === "") return null;
  const date = new Date(typeof value === "number" ? value : String(value).replace(" UTC", "Z").replace(/^(\d{4}-\d{2}-\d{2}) /, "$1T"));
  return Number.isNaN(date.getTime()) ? null : date.toISOString();
}

function toText(value: unknown) {
  if (value === null || value === undefined) return "";
  if (typeof value === "string" || typeof value === "number" || typeof value === "boolean") return String(value).trim().replace(/\s+/g, " ");
  return "";
}

function joinParts(...values: unknown[]) {
  return [...new Set(values.map(toText).filter(Boolean))].join(", ");
}

function readField(value: unknown, key: string): unknown {
  return value && typeof value === "object" ? (value as Json)[key] : undefined;
}

function readList(value: unknown, key?: string): unknown[] {
  const list = key === undefined ? value : readField(value, key);
  if (!Array.isArray(list)) throw new SyntaxError("not a job list");
  return list;
}

function toJob(fields: { externalId: unknown; title: unknown; location?: unknown; department?: unknown; url: unknown; postedAt?: unknown }): FeedJob {
  const url = toText(fields.url);
  return {
    externalId: toText(fields.externalId).slice(0, 200),
    title: toText(fields.title).slice(0, JOB_BOARD_LIMITS.titleLength),
    location: toText(fields.location).slice(0, JOB_BOARD_LIMITS.locationLength),
    department: toText(fields.department).slice(0, JOB_BOARD_LIMITS.departmentLength),
    url: /^https?:\/\//i.test(url) ? url : "",
    postedAt: toIsoDate(fields.postedAt),
  };
}

// A small XML reader for the two XML feeds (Personio, Jobvite): <tag>text</tag>, entities decoded.
const XML_ENTITIES: Record<string, string> = { amp: "&", lt: "<", gt: ">", quot: '"', apos: "'" };

function xmlText(text: string) {
  return text
    .replace(/<!\[CDATA\[([\s\S]*?)\]\]>/g, "$1")
    .replace(/<[^>]+>/g, "")
    .replace(/&(amp|lt|gt|quot|apos|#\d+);/g, (_, key: string) => XML_ENTITIES[key] ?? String.fromCharCode(Number(key.slice(1))))
    .trim();
}

function xmlTag(block: string, tag: string) {
  const match = block.match(new RegExp(`<${tag}(?:\\s[^>]*)?>([\\s\\S]*?)</${tag}>`));
  return match?.[1] === undefined ? "" : xmlText(match[1]);
}

function xmlBlocks(xml: string, tag: string) {
  return xml.match(new RegExp(`<${tag}(?:\\s[^>]*)?>[\\s\\S]*?</${tag}>`, "g")) ?? [];
}

const GREENHOUSE_HOSTS = ["boards.greenhouse.io", "job-boards.greenhouse.io", "boards.eu.greenhouse.io", "job-boards.eu.greenhouse.io"];

export const TOOL_READERS: Record<FeedTool, ToolReader> = {
  greenhouse: {
    domain: "greenhouse.io",
    slug: (url) =>
      GREENHOUSE_HOSTS.includes(url.hostname) && url.pathname.startsWith("/embed/")
        ? readSlug(url.searchParams.get("for"))
        : (firstSegment(url, GREENHOUSE_HOSTS) ?? segmentAfter(url, "boards-api.greenhouse.io", ["v1", "boards"])),
    url: (slug) => `https://boards-api.greenhouse.io/v1/boards/${slug}/jobs`,
    parse: (body) =>
      readList(JSON.parse(body), "jobs").map((job) =>
        toJob({
          externalId: readField(job, "id"),
          title: readField(job, "title"),
          location: readField(readField(job, "location"), "name"),
          url: readField(job, "absolute_url"),
          postedAt: readField(job, "first_published") ?? readField(job, "updated_at"),
        }),
      ),
  },
  lever: {
    domain: "lever.co",
    slug: (url) => firstSegment(url, ["jobs.lever.co", "jobs.eu.lever.co"]) ?? segmentAfter(url, "api.lever.co", ["v0", "postings"]),
    url: (slug) => `https://api.lever.co/v0/postings/${slug}?mode=json`,
    parse: (body) =>
      readList(JSON.parse(body)).map((job) => {
        const categories = readField(job, "categories");
        return toJob({
          externalId: readField(job, "id"),
          title: readField(job, "text"),
          location: readField(categories, "location"),
          department: readField(categories, "department") || readField(categories, "team"),
          url: readField(job, "hostedUrl"),
          postedAt: readField(job, "createdAt"),
        });
      }),
  },
  ashby: {
    domain: "ashbyhq.com",
    maximumBytes: 20 * 1024 * 1024,
    slug: (url) => firstSegment(url, ["jobs.ashbyhq.com"]) ?? segmentAfter(url, "api.ashbyhq.com", ["posting-api", "job-board"]),
    url: (slug) => `https://api.ashbyhq.com/posting-api/job-board/${slug}`,
    parse: (body) =>
      readList(JSON.parse(body), "jobs")
        .filter((job) => readField(job, "isListed") !== false)
        .map((job) =>
          toJob({
            externalId: readField(job, "id"),
            title: readField(job, "title"),
            location: readField(job, "location"),
            department: readField(job, "department") || readField(job, "team"),
            url: readField(job, "jobUrl"),
            postedAt: readField(job, "publishedAt"),
          }),
        ),
  },
  workable: {
    domain: "workable.com",
    slug: (url) =>
      segmentAfter(url, "apply.workable.com", ["api", "v1", "widget", "accounts"]) ?? firstSegment(url, ["apply.workable.com"]) ?? subdomainOf(url, "workable.com"),
    url: (slug) => `https://apply.workable.com/api/v1/widget/accounts/${slug}`,
    parse: (body) =>
      readList(JSON.parse(body), "jobs").map((job) =>
        toJob({
          externalId: readField(job, "shortcode"),
          title: readField(job, "title"),
          location: readField(job, "telecommuting") && !readField(job, "city") ? "Remote" : joinParts(readField(job, "city"), readField(job, "country")),
          department: readField(job, "department"),
          url: readField(job, "url") || readField(job, "shortlink"),
          postedAt: readField(job, "published_on") ?? readField(job, "created_at"),
        }),
      ),
  },
  smartrecruiters: {
    domain: "smartrecruiters.com",
    slug: (url) => firstSegment(url, ["careers.smartrecruiters.com", "jobs.smartrecruiters.com"]) ?? segmentAfter(url, "api.smartrecruiters.com", ["v1", "companies"]),
    url: (slug) => `https://api.smartrecruiters.com/v1/companies/${slug}/postings`,
    parse: (body, slug) =>
      readList(JSON.parse(body), "content").map((job) => {
        const location = readField(job, "location");
        return toJob({
          externalId: readField(job, "id"),
          title: readField(job, "name"),
          location: readField(location, "fullLocation") || joinParts(readField(location, "city"), readField(location, "country")),
          department: readField(readField(job, "department"), "label") || readField(readField(job, "function"), "label"),
          url: `https://jobs.smartrecruiters.com/${slug}/${toText(readField(job, "id"))}`,
          postedAt: readField(job, "releasedDate"),
        });
      }),
  },
  recruitee: {
    domain: "recruitee.com",
    slug: (url) => subdomainOf(url, "recruitee.com"),
    url: (slug) => `https://${slug}.recruitee.com/api/offers`,
    parse: (body) =>
      readList(JSON.parse(body), "offers").map((job) =>
        toJob({
          externalId: readField(job, "id") || readField(job, "guid"),
          title: readField(job, "title") || readField(job, "sharing_title"),
          location: readField(job, "location") || joinParts(readField(job, "city"), readField(job, "country")),
          department: readField(job, "department"),
          url: readField(job, "careers_url"),
          postedAt: readField(job, "published_at") ?? readField(job, "created_at"),
        }),
      ),
  },
  breezy: {
    domain: "breezy.hr",
    slug: (url) => subdomainOf(url, "breezy.hr"),
    url: (slug) => `https://${slug}.breezy.hr/json`,
    parse: (body) =>
      readList(JSON.parse(body)).map((job) => {
        const location = readField(job, "location");
        return toJob({
          externalId: readField(job, "id"),
          title: readField(job, "name"),
          location: readField(location, "is_remote") ? "Remote" : readField(location, "name"),
          department: readField(job, "department"),
          url: readField(job, "url"),
          postedAt: readField(job, "published_date"),
        });
      }),
  },
  rippling: {
    domain: "rippling.com",
    slug: (url) => firstSegment(url, ["ats.rippling.com"]) ?? segmentAfter(url, "api.rippling.com", ["platform", "api", "ats", "v1", "board"]),
    url: (slug) => `https://api.rippling.com/platform/api/ats/v1/board/${slug}/jobs`,
    parse: (body) =>
      readList(JSON.parse(body)).map((job) =>
        toJob({
          externalId: readField(job, "uuid"),
          title: readField(job, "name"),
          location: readField(readField(job, "workLocation"), "label"),
          department: readField(readField(job, "department"), "label"),
          url: readField(job, "url"),
        }),
      ),
  },
  teamtailor: {
    domain: "teamtailor.com",
    slug: (url) => subdomainOf(url, "teamtailor.com"),
    url: (slug) => `https://${slug}.teamtailor.com/jobs.json`,
    parse: (body) =>
      readList(JSON.parse(body), "items").map((job) => {
        const posting = readField(job, "_jobposting") ?? {};
        const rawPlaces = readField(posting, "jobLocation");
        const places = (Array.isArray(rawPlaces) ? rawPlaces : rawPlaces ? [rawPlaces] : [])
          .map((place) => toText(readField(readField(place, "address"), "addressLocality")))
          .filter(Boolean);
        return toJob({
          externalId: readField(readField(posting, "identifier"), "value") || readField(job, "id"),
          title: readField(job, "title"),
          location: places.length > 0 ? [...new Set(places)].join(", ") : readField(posting, "jobLocationType") === "TELECOMMUTE" ? "Remote" : "",
          url: readField(job, "url"),
          postedAt: readField(job, "date_published") ?? readField(posting, "datePosted"),
        });
      }),
  },
  bamboohr: {
    domain: "bamboohr.com",
    slug: (url) => subdomainOf(url, "bamboohr.com"),
    url: (slug) => `https://${slug}.bamboohr.com/careers/list`,
    parse: (body, slug) =>
      readList(JSON.parse(body), "result").map((job) => {
        const location = readField(job, "location");
        return toJob({
          externalId: readField(job, "id"),
          title: readField(job, "jobOpeningName"),
          location: readField(job, "isRemote") ? "Remote" : joinParts(readField(location, "city"), readField(location, "state")),
          department: readField(job, "departmentLabel"),
          url: `https://${slug}.bamboohr.com/careers/${toText(readField(job, "id"))}`,
        });
      }),
  },
  personio: {
    domain: "personio.de",
    slug: (url) => subdomainOf(url, "jobs.personio.de") ?? subdomainOf(url, "jobs.personio.com"),
    url: (slug) => `https://${slug}.jobs.personio.de/xml?language=en`,
    parse: (body, slug) => {
      if (!/<workzag-jobs[\s>]/.test(body)) throw new SyntaxError("not a Personio feed");
      return xmlBlocks(body, "position").map((position) =>
        toJob({
          externalId: xmlTag(position, "id"),
          title: xmlTag(position, "name"),
          location: xmlTag(position, "office"),
          department: xmlTag(position, "department"),
          url: `https://${slug}.jobs.personio.de/job/${xmlTag(position, "id")}`,
          postedAt: xmlTag(position, "createdAt"),
        }),
      );
    },
  },
  jobvite: {
    // Only the XML feed a company switches on in Jobvite (its link carries ?c=<company id>). jobs.jobvite.com pages have no feed.
    domain: "jobvite.com",
    slug: (url) => (url.hostname === "app.jobvite.com" && /^\/companyjobs\/xml\.aspx$/i.test(url.pathname) ? readSlug(url.searchParams.get("c")) : null),
    url: (slug) => `https://app.jobvite.com/CompanyJobs/Xml.aspx?c=${slug}`,
    parse: (body) => {
      if (!/<result[\s>]/.test(body) && !/<job[\s>]/.test(body)) throw new SyntaxError("not a Jobvite feed");
      return xmlBlocks(body, "job").map((job) =>
        toJob({
          externalId: xmlTag(job, "id"),
          title: xmlTag(job, "title"),
          location: xmlTag(job, "location"),
          department: xmlTag(job, "category"),
          url: xmlTag(job, "detail-url") || xmlTag(job, "apply-url"),
          postedAt: xmlTag(job, "date"),
        }),
      );
    },
  },
};

function toUrl(raw: string) {
  const text = raw.trim();
  if (!text) return null;
  try {
    const url = new URL(/^https?:\/\//i.test(text) ? text : `https://${text}`);
    return url.hostname.includes(".") ? url : null;
  } catch {
    return null;
  }
}

// The first tool whose link this is, and the board's name in it.
export function detectBoard(raw: string): { tool: FeedTool; slug: string } | null {
  const url = toUrl(raw);
  if (!url) return null;
  for (const tool of Object.keys(TOOL_READERS) as FeedTool[]) {
    const slug = TOOL_READERS[tool].slug(url);
    if (slug) return { tool, slug };
  }
  return null;
}

// Jobvite's careers pages (jobs.jobvite.com) have no feed; only the XML feed link does.
export function isJobvitePage(raw: string) {
  const url = toUrl(raw);
  return url !== null && /(^|\.)jobvite\.com$/.test(url.hostname) && !TOOL_READERS.jobvite.slug(url);
}

export function readFeedUrl(tool: FeedTool, slug: string) {
  return TOOL_READERS[tool].url(encodeURIComponent(slug));
}

// Keeps the jobs with an id and a title, once each, up to the per-source limit.
export function parseFeed(tool: string, body: string, slug: string) {
  if (!isFeedTool(tool)) throw new SyntaxError("no feed");
  const seen = new Set<string>();
  const jobs: FeedJob[] = [];
  for (const job of TOOL_READERS[tool].parse(body, slug)) {
    if (!job.externalId || !job.title || seen.has(job.externalId)) continue;
    seen.add(job.externalId);
    jobs.push(job);
    if (jobs.length >= JOB_BOARD_LIMITS.jobsPerSource) break;
  }
  return jobs;
}

export function describeLinkProblem(raw: string) {
  if (isJobvitePage(raw)) {
    return "Jobvite has a public feed only when the company switches it on (Jobvite › Careers › XML feed). Paste that feed link, or add your jobs by hand.";
  }
  const tools = Object.values(FEED_TOOLS).map(({ label }) => label);
  return `We couldn't find a job board in that link. Paste the careers link from ${tools.slice(0, -1).join(", ")} or ${tools.at(-1) ?? ""}, or add your jobs by hand.`;
}
