import { getSessionCookie } from "better-auth/cookies";
import { NextResponse, type NextRequest } from "next/server";

import { JOB_BOARD_PAGES } from "@/modules/job-board/contract";
import { getDatabase } from "@/platform/database/client";
import { isModulePageOff } from "@/shell/module-off-pages";

// Where a module's page would be when the admin turned it off. Nothing lives here, so the app's own
// "We can't find that page" answers, with a real 404.
const MODULE_OFF_PATH = "/_module-off";

// Founderhall serves both job boards at /jobs: a signed-in member gets the members' board, a visitor the public one
// (its page lives at /public/jobs, which redirects here; it sends a visitor to sign in while the board isn't public).
function readVisitorJobsPath(request: NextRequest) {
  if (request.nextUrl.pathname !== JOB_BOARD_PAGES.board) return null;
  return getSessionCookie(request) ? null : JOB_BOARD_PAGES.publicPage;
}

// Each module page also guards itself, but the shared loading screen has already sent 200 by then, so a page
// of a switched-off module is answered here, before rendering starts.
export async function proxy(request: NextRequest) {
  if (await isModulePageOff(getDatabase(), request.nextUrl.pathname)) return NextResponse.rewrite(new URL(MODULE_OFF_PATH, request.url));
  const visitorJobsPath = readVisitorJobsPath(request);
  if (!visitorJobsPath) return NextResponse.next();
  const target = request.nextUrl.clone();
  target.pathname = visitorJobsPath;
  return NextResponse.rewrite(target);
}

export const config = {
  matcher: [{ source: "/((?!api/|_next/|icon.svg|demo/).*)", missing: [{ type: "header", key: "next-router-prefetch" }] }],
};
