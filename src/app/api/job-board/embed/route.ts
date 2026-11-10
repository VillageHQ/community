import { COMPANY_PARAM } from "@/modules/job-board/contract";
import { isPublicBoardOn, readPublicJobs } from "@/modules/job-board/reads";
import { jobBoardRoutes } from "@/modules/job-board/routes";
import { EMBED_HEADERS, renderEmbedPage } from "@/modules/job-board/rules-widget";
import { readBrandingForPage } from "@/platform/branding/branding";
import { getDatabase } from "@/platform/database/client";

const NOT_FOUND_STATUS = 404;

// The frame the website widget shows. It reads no session and sets no cookie, so it is the same for every visitor.
export const GET = jobBoardRoutes.open("job-board-embed", async (request: Request) => {
  const database = getDatabase();
  if (!(await isPublicBoardOn(database))) return new Response("Not found.", { status: NOT_FOUND_STATUS, headers: { ...EMBED_HEADERS, "Content-Type": "text/plain; charset=utf-8" } });
  const company = new URL(request.url).searchParams.get(COMPANY_PARAM)?.trim() || null;
  const [jobs, community] = await Promise.all([readPublicJobs(database, company), readBrandingForPage()]);
  return new Response(renderEmbedPage({ title: `Jobs at ${community.name} companies`, jobs }), { headers: EMBED_HEADERS });
});
