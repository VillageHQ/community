import { z } from "zod";

import { feedTextSchema } from "../../platform/text/text-schema.ts";

export const JOB_BOARD_PAGES = {
  board: "/jobs",
  yours: "/jobs/yours",
  admin: "/admin/jobs",
  public: "/public/jobs",
} as const;

export const JOB_BOARD_PAGE_TITLES = {
  board: "Jobs",
  yours: "Your company's jobs",
  admin: "Admin · Jobs",
  public: "Jobs",
} as const;

export const JOB_BOARD_API_PREFIX = "/api/job-board";
export const JOB_BOARD_ADMIN_API_PREFIX = "/api/admin/jobs";

export const JOB_BOARD_API_ROUTES = {
  link: "/api/job-board/sources/link",
  manual: "/api/job-board/sources/manual",
  pull: "/api/job-board/sources/pull",
  hide: "/api/job-board/sources/hide",
  remove: "/api/job-board/sources/remove",
  addJob: "/api/job-board/jobs/add",
  removeJob: "/api/job-board/jobs/remove",
  embed: "/api/job-board/embed",
  widgetScript: "/api/job-board/widget.js",
  frameScript: "/api/job-board/frame.js",
  publicSwitch: "/api/admin/jobs/public",
} as const;

// The query parameter that filters a board to one company, on every board and in the widget.
export const COMPANY_PARAM = "company";

export const JOB_BOARD_LIMITS = {
  sourcesPerMember: 5,
  jobsPerSource: 500,
  manualJobsPerSource: 50,
  companyLength: 120,
  linkLength: 500,
  titleLength: 200,
  locationLength: 160,
  departmentLength: 120,
  errorLength: 300,
  pullEveryMinutes: 60,
  pullNowEverySeconds: 60,
  sourcesPerTick: 20,
} as const;

// The 12 hiring tools with a public job feed that needs no key, and "manual" for jobs added by hand.
export const FEED_TOOLS = {
  greenhouse: { label: "Greenhouse", example: "https://boards.greenhouse.io/yourcompany" },
  lever: { label: "Lever", example: "https://jobs.lever.co/yourcompany" },
  ashby: { label: "Ashby", example: "https://jobs.ashbyhq.com/yourcompany" },
  workable: { label: "Workable", example: "https://apply.workable.com/yourcompany" },
  smartrecruiters: { label: "SmartRecruiters", example: "https://careers.smartrecruiters.com/YourCompany" },
  recruitee: { label: "Recruitee", example: "https://yourcompany.recruitee.com" },
  breezy: { label: "Breezy HR", example: "https://yourcompany.breezy.hr" },
  rippling: { label: "Rippling", example: "https://ats.rippling.com/yourcompany/jobs" },
  teamtailor: { label: "Teamtailor", example: "https://yourcompany.teamtailor.com" },
  bamboohr: { label: "BambooHR", example: "https://yourcompany.bamboohr.com/careers" },
  personio: { label: "Personio", example: "https://yourcompany.jobs.personio.de" },
  jobvite: { label: "Jobvite", example: "https://app.jobvite.com/CompanyJobs/Xml.aspx?c=YourCompanyId" },
} as const;

export type FeedTool = keyof typeof FEED_TOOLS;

export const MANUAL_TOOL = "manual";
export const SOURCE_TOOLS = [...(Object.keys(FEED_TOOLS) as FeedTool[]), MANUAL_TOOL] as const;
export type SourceTool = FeedTool | typeof MANUAL_TOOL;

export function isFeedTool(tool: string): tool is FeedTool {
  return Object.hasOwn(FEED_TOOLS, tool);
}

export function readToolLabel(tool: string) {
  return isFeedTool(tool) ? FEED_TOOLS[tool].label : "Added by hand";
}

export const PUBLIC_BOARD_SETTING = "job_board_public";

export const JOB_BOARD_ERROR_CODES = {
  sourceNotFound: "job_source_not_found",
  jobNotFound: "job_not_found",
  notALink: "job_link_unknown",
  sourceLimit: "job_source_limit",
  manualLimit: "job_manual_limit",
  tooSoon: "job_pull_too_soon",
  notManual: "job_source_not_manual",
} as const;

const httpLinkSchema = z
  .string()
  .trim()
  .max(JOB_BOARD_LIMITS.linkLength, `Keep the link under ${JOB_BOARD_LIMITS.linkLength} characters.`)
  .refine((value) => {
    try {
      const url = new URL(value);
      return url.protocol === "https:" || url.protocol === "http:";
    } catch {
      return false;
    }
  }, "Paste a full link that starts with https://.");

const sourceIdSchema = z.uuid({ error: "That source isn't there anymore." });

export const linkSourceBodySchema = z.object({
  company: feedTextSchema("the company's name", JOB_BOARD_LIMITS.companyLength),
  link: z.string({ error: "Paste your careers link first." }).trim().min(1, "Paste your careers link first.").max(JOB_BOARD_LIMITS.linkLength),
});

export const manualSourceBodySchema = z.object({
  company: feedTextSchema("the company's name", JOB_BOARD_LIMITS.companyLength),
});

export const sourceBodySchema = z.object({ sourceId: sourceIdSchema });

export const hideSourceBodySchema = z.object({ sourceId: sourceIdSchema, hidden: z.boolean() });

export const addJobBodySchema = z.object({
  sourceId: sourceIdSchema,
  title: feedTextSchema("the job's title", JOB_BOARD_LIMITS.titleLength),
  location: z.string().trim().max(JOB_BOARD_LIMITS.locationLength, `Keep the location under ${JOB_BOARD_LIMITS.locationLength} characters.`).default(""),
  url: httpLinkSchema,
});

export const removeJobBodySchema = z.object({ sourceId: sourceIdSchema, jobId: z.uuid({ error: "That job isn't there anymore." }) });

export const publicSwitchBodySchema = z.object({ isPublic: z.boolean() });

export const messageResponseSchema = z.object({ message: z.string() });

export type BoardJob = {
  id: string;
  title: string;
  location: string;
  department: string;
  url: string;
  postedAt: string | null;
  company: string;
  companySlug: string;
  memberId: string;
  memberName: string;
};

export type PublicJob = Pick<BoardJob, "id" | "title" | "location" | "url" | "company" | "companySlug">;

export type BoardCompany = { slug: string; name: string; jobCount: number };

export type SourceJob = { id: string; title: string; location: string; url: string; isManual: boolean };

export type JobSourceView = {
  id: string;
  company: string;
  companySlug: string;
  tool: string;
  toolLabel: string;
  slug: string | null;
  sourceUrl: string | null;
  hidden: boolean;
  lastPulledAt: string | null;
  lastError: string | null;
  jobCount: number;
  memberId: string;
  memberName: string;
};

// "Ledgerline Ltd." -> "ledgerline-ltd": the company's part of ?company=.
export function toCompanySlug(name: string) {
  const slug = name
    .normalize("NFKD")
    .replace(/[̀-ͯ]/g, "")
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-+|-+$/g, "")
    .slice(0, 60);
  if (slug) return slug;
  // A name with no Latin letters or digits still gets its own filter.
  let hash = 0;
  for (const character of name) hash = (hash * 31 + (character.codePointAt(0) ?? 0)) >>> 0;
  return `company-${hash.toString(36)}`;
}
