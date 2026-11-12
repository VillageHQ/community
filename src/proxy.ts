import { getSessionCookie } from "better-auth/cookies";
import { NextResponse, type NextRequest } from "next/server";

import { JOB_BOARD_PAGES } from "@/modules/job-board/contract";
import { getDatabase } from "@/platform/database/client";
import { resolveAppUrl } from "@/platform/http/app-url";
import { ROUTES } from "@/platform/http/routes";
import { addStrictTransport } from "@/platform/http/strict-transport";
import { isGoneLinkPage } from "@/shell/gone-links";
import { isModulePageOff } from "@/shell/module-off-pages";

// Where a module's page would be when the admin turned it off. Nothing lives here, so the app's own
// "We can't find that page" answers, with a real 404.
const MODULE_OFF_PATH = "/_module-off";
const NOT_FOUND_STATUS = 404;
const OK_STATUS = 200;
const GONE_STATUS = 410;
const GONE_MARK = "gone";
const RSC_HEADER = "rsc";
const IN_APP_FETCH_TIMEOUT_MS = 5000;
// The same for a signed-in member, inside the app's frame (src/app/(app)/not-here/).
const MODULE_OFF_IN_APP_PATH = `${ROUTES.notHere}/_module-off`;

// Founderhall serves both job boards at /jobs: a signed-in member gets the members' board, a visitor the public one
// (its page lives at /public/board; the old /public/jobs redirects here). While the board isn't public, a visitor is sent to sign in.
function readVisitorJobsPath(request: NextRequest) {
  if (request.nextUrl.pathname !== JOB_BOARD_PAGES.board) return null;
  return getSessionCookie(request) ? null : JOB_BOARD_PAGES.publicPage;
}

// A full page load gets the in-app 404 page fetched here and answered with a real 404; a navigation inside the app (an
// RSC request) just goes there.
async function answerInAppNotFound(request: NextRequest) {
  const target = new URL(MODULE_OFF_IN_APP_PATH, request.url);
  if (request.headers.get(RSC_HEADER)) return NextResponse.rewrite(target);
  // Fetched from the app's own address, never from the request's Host header.
  const page = await fetch(new URL(MODULE_OFF_IN_APP_PATH, resolveAppUrl(process.env)), { headers: { cookie: request.headers.get("cookie") ?? "", accept: "text/html" }, redirect: "manual", signal: AbortSignal.timeout(IN_APP_FETCH_TIMEOUT_MS) }).catch(() => null);
  // No page (a timeout, a signed-out cookie): the plain rewrite still shows the right words.
  if (page?.status !== OK_STATUS) return NextResponse.rewrite(target);
  return new NextResponse(page.body, { status: NOT_FOUND_STATUS, headers: { "content-type": page.headers.get("content-type") ?? "text/html; charset=utf-8", "cache-control": "no-store" } });
}

// A rewrite can't carry a status, so the bad-link page is fetched here, marked so it isn't checked again, and
// answered with 410. The visitor's own headers go along, so the page's rate limit counts their address.
async function answerGoneLink(request: NextRequest) {
  const target = new URL(`${request.nextUrl.pathname}${request.nextUrl.search}`, resolveAppUrl(process.env));
  target.searchParams.set(GONE_MARK, "1");
  const headers = new Headers(request.headers);
  headers.delete("host");
  headers.set("accept", "text/html");
  const page = await fetch(target, { headers, redirect: "manual", signal: AbortSignal.timeout(IN_APP_FETCH_TIMEOUT_MS) }).catch(() => null);
  if (page?.status !== OK_STATUS) return NextResponse.next();
  return new NextResponse(page.body, { status: GONE_STATUS, headers: { "content-type": page.headers.get("content-type") ?? "text/html; charset=utf-8", "cache-control": "no-store" } });
}

// Every answer from here carries Strict-Transport-Security when the app runs on https (platform/http/strict-transport.ts).
export async function proxy(request: NextRequest) {
  return addStrictTransport(await routePage(request), process.env);
}

// Each module page also guards itself; a page of a switched-off module is answered here, before rendering starts.
async function routePage(request: NextRequest) {
  const { pathname, searchParams } = request.nextUrl;
  if (!request.headers.get(RSC_HEADER) && !searchParams.has(GONE_MARK) && (await isGoneLinkPage(getDatabase(), pathname, searchParams.get("token")))) {
    return answerGoneLink(request);
  }
  if (await isModulePageOff(getDatabase(), request.nextUrl.pathname)) {
    if (!getSessionCookie(request)) return NextResponse.rewrite(new URL(MODULE_OFF_PATH, request.url));
    return answerInAppNotFound(request);
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
