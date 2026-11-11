import { getSessionCookie } from "better-auth/cookies";
import { NextResponse, type NextRequest } from "next/server";

import { JOB_BOARD_PAGES } from "@/modules/job-board/contract";
import { getDatabase } from "@/platform/database/client";
import { ROUTES } from "@/platform/http/routes";
import { isModulePageOff } from "@/shell/module-off-pages";

// Where a module's page would be when the admin turned it off. Nothing lives here, so the app's own
// "We can't find that page" answers, with a real 404.
const MODULE_OFF_PATH = "/_module-off";
// The same for a signed-in member, inside the app's frame (src/app/(app)/not-here/).
const MODULE_OFF_IN_APP_PATH = `${ROUTES.notHere}/_module-off`;

// Founderhall serves both job boards at /jobs: a signed-in member gets the members' board, a visitor the public one
// (its page lives at /public/board; the old /public/jobs redirects here). While the board isn't public, a visitor is sent to sign in.
function readVisitorJobsPath(request: NextRequest) {
  if (request.nextUrl.pathname !== JOB_BOARD_PAGES.board) return null;
  return getSessionCookie(request) ? null : JOB_BOARD_PAGES.publicPage;
}

// Each module page also guards itself, but the shared loading screen has already sent 200 by then, so a page
// of a switched-off module is answered here, before rendering starts.
export async function proxy(request: NextRequest) {
  if (await isModulePageOff(getDatabase(), request.nextUrl.pathname)) {
    return NextResponse.rewrite(new URL(getSessionCookie(request) ? MODULE_OFF_IN_APP_PATH : MODULE_OFF_PATH, request.url));
  }
  const visitorJobsPath = readVisitorJobsPath(request);
  if (!visitorJobsPath) return NextResponse.next();
  const target = request.nextUrl.clone();
  target.pathname = visitorJobsPath;
  return NextResponse.rewrite(target);
}

export const config = {
  matcher: [{ source: "/((?!api/|_next/|icon.svg|demo/).*)", missing: [{ type: "header", key: "next-router-prefetch" }] }],
};
