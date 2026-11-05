import { getDatabase } from "@/platform/database/client";
import { getAuth } from "@/platform/auth/auth";
import { MAXIMUM_JSON_BODY_BYTES, withBodyLimit } from "@/platform/http/body-limit";
import { acceptFieldsBodySchema, acceptTokenBodySchema, INVITE_ERROR_CODES } from "@/lib/invites/invite-api";
import { sendEmailConfirmation } from "@/lib/invites/email-confirmation";
import { recordFailedInviteAttempt } from "@/lib/invites/invite-attempts";
import { INVITE_STATES, type InviteState } from "@/lib/invites/invite-state";
import { INVITE_UNUSABLE_COPY, INVITE_INVALID_COPY } from "@/lib/invites/invite-copy";
import { acceptInvite, readInviteByToken } from "@/lib/invites/invites";
import { readJsonBody } from "@/platform/http/read-json-body";
import { logError, withRouteLogging } from "@/platform/observability/route-logging";
import { hasTrustedOrigin, readSessionMember } from "@/platform/http/member-route";
import { NETWORK_ERROR_CODES } from "@/lib/village/network-api";

const CREATED_STATUS = 201;
const FORBIDDEN_STATUS = 403;
const NOT_FOUND_STATUS = 404;
const CONFLICT_STATUS = 409;
const GONE_STATUS = 410;
const UNPROCESSABLE_STATUS = 422;
const TOO_MANY_REQUESTS_STATUS = 429;

function respondMessage(status: number, code: string, message: string) {
  return Response.json({ code, message }, { status });
}

async function respondToUnusableLink(request: Request, failure: () => Response) {
  const { isLimited } = await recordFailedInviteAttempt(getDatabase(), request, process.env);
  if (!isLimited) return failure();
  return respondMessage(
    TOO_MANY_REQUESTS_STATUS,
    INVITE_ERROR_CODES.rateLimited,
    "Too many tries with this link. Wait a minute and try again.",
  );
}

function respondInvalidLink() {
  return respondMessage(NOT_FOUND_STATUS, INVITE_ERROR_CODES.invalidLink, INVITE_INVALID_COPY.description);
}

function respondUnusableInvite(state: Exclude<InviteState, typeof INVITE_STATES.pending>) {
  const { title, description } = INVITE_UNUSABLE_COPY[state];
  return respondMessage(GONE_STATUS, INVITE_ERROR_CODES.unusable, `${title}. ${description}`);
}

async function signInNewMember(request: Request, email: string, password: string) {
  try {
    const auth = await getAuth();
    const { headers } = await auth.api.signInEmail({
      body: { email, password },
      headers: request.headers,
      returnHeaders: true,
    });
    return headers.getSetCookie();
  } catch (error) {
    logError("invite-accept-sign-in", error);
    return [];
  }
}

function respondAccepted(cookies: string[]) {
  const headers = new Headers({ "Content-Type": "application/json" });
  for (const cookie of cookies) headers.append("Set-Cookie", cookie);
  return new Response(JSON.stringify({ isSignedIn: cookies.length > 0 }), { status: CREATED_STATUS, headers });
}

export const POST = withRouteLogging(
  "invite-accept",
  withBodyLimit(MAXIMUM_JSON_BODY_BYTES, async (request) => {
    if (!hasTrustedOrigin(request)) {
      return respondMessage(FORBIDDEN_STATUS, NETWORK_ERROR_CODES.forbiddenOrigin, "This request came from another site.");
    }

    const database = getDatabase();
    const body = await readJsonBody(request);
    const submitted = acceptTokenBodySchema.safeParse(body);
    const invite = submitted.success ? await readInviteByToken(database, submitted.data.token) : null;
    if (!submitted.success || !invite) return respondToUnusableLink(request, respondInvalidLink);
    if (invite.state !== INVITE_STATES.pending) {
      const { state } = invite;
      return respondToUnusableLink(request, () => respondUnusableInvite(state));
    }

    if (await readSessionMember(request)) {
      return respondMessage(CONFLICT_STATUS, INVITE_ERROR_CODES.signedIn, "Sign out first, then open this link again.");
    }

    const fields = acceptFieldsBodySchema.safeParse(body);
    if (!fields.success) {
      return respondMessage(
        UNPROCESSABLE_STATUS,
        NETWORK_ERROR_CODES.invalidRequest,
        fields.error.issues[0]?.message ?? "The form is invalid.",
      );
    }

    const accepted = await acceptInvite(database, submitted.data.token, fields.data);
    if (!accepted) return respondToUnusableLink(request, () => respondUnusableInvite(INVITE_STATES.accepted));

    const cookies = await signInNewMember(request, accepted.email, fields.data.password);
    await sendEmailConfirmation(database, process.env, {
      id: accepted.userId,
      name: fields.data.name,
      email: accepted.email,
    });
    return respondAccepted(cookies);
  }),
);
