import { NextResponse, type NextRequest } from "next/server";

import { getDatabase } from "@/platform/database/client";
import { isModulePageOff } from "@/shell/module-off-pages";

// Where a module's page would be when the admin turned it off. Nothing lives here, so the app's own
// "We can't find that page" answers, with a real 404.
const MODULE_OFF_PATH = "/_module-off";

// Each module page also guards itself, but the shared loading screen has already sent 200 by then, so a page
// of a switched-off module is answered here, before rendering starts.
export async function proxy(request: NextRequest) {
  if (!(await isModulePageOff(getDatabase(), request.nextUrl.pathname))) return NextResponse.next();
  return NextResponse.rewrite(new URL(MODULE_OFF_PATH, request.url));
}

export const config = {
  matcher: [{ source: "/((?!api/|_next/|icon.svg).*)", missing: [{ type: "header", key: "next-router-prefetch" }] }],
};
