import { z } from "zod";

import { getDatabase } from "@/database/client";
import { deleteLogo, readLogo, saveLogo } from "@/lib/branding/branding";
import {
  detectLogoContentType,
  LOGO_BACKDROP_PARAM,
  LOGO_TOO_LARGE_MESSAGE,
  LOGO_WRONG_TYPE_MESSAGE,
  MAXIMUM_LOGO_BYTES,
  parseLogoBackdrop,
} from "@/lib/branding/logo-rules";
import { withRouteLogging } from "@/lib/route-logging";
import { createAdminBinaryRoute, createMemberRoute } from "@/lib/village/member-route";

const NOT_MODIFIED_STATUS = 304;
const NOT_FOUND_STATUS = 404;
const UNPROCESSABLE_STATUS = 422;

const LOGO_RESPONSE_HEADERS = {
  "Cache-Control": "public, no-cache",
  "Content-Disposition": "inline",
  "Cross-Origin-Resource-Policy": "same-origin",
  "X-Content-Type-Options": "nosniff",
};

export const GET = withRouteLogging("branding-logo-read", async (request: Request) => {
  const logo = await readLogo(getDatabase());
  if (!logo) return Response.json({ message: "No logo." }, { status: NOT_FOUND_STATUS });

  const entityTag = `"${logo.version}"`;
  const headers = { ...LOGO_RESPONSE_HEADERS, ETag: entityTag };
  if (request.headers.get("if-none-match") === entityTag) {
    return new Response(null, { status: NOT_MODIFIED_STATUS, headers });
  }

  return new Response(new Uint8Array(logo.bytes), {
    headers: { ...headers, "Content-Type": logo.contentType, "Content-Length": String(logo.bytes.byteLength) },
  });
});

export const POST = createAdminBinaryRoute(
  "branding-logo-save",
  { maximumBytes: MAXIMUM_LOGO_BYTES, tooLargeMessage: LOGO_TOO_LARGE_MESSAGE },
  async ({ database }, bytes, request) => {
    const contentType = detectLogoContentType(bytes);
    if (!contentType) {
      return Response.json({ message: LOGO_WRONG_TYPE_MESSAGE }, { status: UNPROCESSABLE_STATUS });
    }

    const backdrop = parseLogoBackdrop(new URL(request.url).searchParams.get(LOGO_BACKDROP_PARAM));
    await saveLogo(database, { bytes, contentType, backdrop });
    return Response.json({ message: "Logo saved." });
  },
);

export const DELETE = createMemberRoute(
  "branding-logo-delete",
  z.unknown(),
  async ({ database }) => {
    await deleteLogo(database);
    return Response.json({ message: "Logo removed." });
  },
  { adminOnly: true },
);
