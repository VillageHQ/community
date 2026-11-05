import { getDatabase } from "@/platform/database/client";
import { readAvatar } from "@/lib/members/profile";
import { withRouteLogging } from "@/platform/observability/route-logging";
import { readSessionMember } from "@/lib/village/member-route";

const NOT_MODIFIED_STATUS = 304;
const UNAUTHORIZED_STATUS = 401;
const NOT_FOUND_STATUS = 404;

const AVATAR_RESPONSE_HEADERS = {
  "Cache-Control": "private, no-cache",
  "Content-Disposition": "inline",
  "Cross-Origin-Resource-Policy": "same-origin",
  "X-Content-Type-Options": "nosniff",
};

export const GET = withRouteLogging(
  "member-avatar-read",
  async (request: Request, { params }: { params: Promise<{ memberId: string }> }) => {
    if (!(await readSessionMember(request))) {
      return Response.json({ message: "Sign in to continue." }, { status: UNAUTHORIZED_STATUS });
    }

    const { memberId } = await params;
    const avatar = await readAvatar(getDatabase(), memberId);
    if (!avatar) return Response.json({ message: "No photo." }, { status: NOT_FOUND_STATUS });

    const entityTag = `"${avatar.version}"`;
    const headers = { ...AVATAR_RESPONSE_HEADERS, ETag: entityTag };
    if (request.headers.get("if-none-match") === entityTag) {
      return new Response(null, { status: NOT_MODIFIED_STATUS, headers });
    }

    return new Response(new Uint8Array(avatar.bytes), {
      headers: { ...headers, "Content-Type": avatar.contentType, "Content-Length": String(avatar.bytes.byteLength) },
    });
  },
);
