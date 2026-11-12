import { getDatabase } from "@/platform/database/client";
import { getAuth } from "@/platform/auth/auth";
import { signInUnconfirmedMember, signInWithServerLink } from "@/platform/auth/server-link-sign-in";
import { MAXIMUM_JSON_BODY_BYTES, withBodyLimit } from "@/platform/http/body-limit";
import { acceptFieldsBodySchema, acceptTokenBodySchema, INVITE_ERROR_CODES } from "@/modules/members/contract-invites";
import { sendEmailConfirmation } from "@/modules/members/service-email-confirmation";
import { recordFailedInviteAttempt } from "@/modules/members/limits-invites";
import { INVITE_STATES, type InviteState } from "@/modules/members/contract-invite-state";
import { INVITE_UNUSABLE_COPY, INVITE_INVALID_COPY } from "@/modules/members/copy-invites";
import { acceptInvite, readInviteByToken } from "@/modules/members/service-invites";
import { isEmailedInvite } from "@/modules/members/service-invite-emailed";
import { readEmailBranding } from "@/platform/email/outbox";
import { sendQueuedEmailNow } from "@/platform/email/outbox-sender";
import { readJsonBody } from "@/platform/http/read-json-body";
import { logError } from "@/platform/observability/route-logging";
import { hasTrustedOrigin, readSessionMember } from "@/platform/http/member-route";
import { NETWORK_ERROR_CODES } from "@/modules/network/contract";
import { membersRoutes } from "@/modules/members/routes";
import { isDemoEmail, isDemoMode } from "@/platform/demo/mode";

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

// From the emailed link the address stays confirmed; from a copied link it goes back to unconfirmed.
async function signInWithoutPassword(request: Request, member: { id: string; email: string; isEmailConfirmed: boolean }) {
  try {
    const result = member.isEmailConfirmed
      ? await signInWithServerLink(getDatabase(), await getAuth(), request, member.email)
      : await signInUnconfirmedMember(getDatabase(), await getAuth(), request, member);
    return result.isSignedIn ? result.setCookies : [];
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

export const POST = membersRoutes.open(
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

    // Founderhall's "Accept and sign in" sends only the token. A name and a password (Community's older form) still work.
    const hasFields = typeof body === "object" && body !== null && "password" in body;
    const fields = hasFields ? acceptFieldsBodySchema.safeParse(body) : null;
    if (fields && !fields.success) {
      return respondMessage(
        UNPROCESSABLE_STATUS,
        NETWORK_ERROR_CODES.invalidRequest,
        fields.error.issues[0]?.message ?? "The form is invalid.",
      );
    }

    // A demo only ever holds made-up people: a real address here would stop the demo from starting next time.
    if (isDemoMode(process.env) && !isDemoEmail(invite.email)) {
      return respondMessage(FORBIDDEN_STATUS, INVITE_ERROR_CODES.unusable, "This is a demo, so only made-up example.com addresses can join.");
    }

    // Opened from the email that went to this address (the link's mark matches): the address is confirmed, so no second
    // "Confirm your email". A copied link has no mark and still asks (the owner's call, 2026-11-12).
    const isFromEmail = await isEmailedInvite(database, process.env, submitted.data.token, submitted.data.emailed);
    const notice = { environment: process.env, branding: await readEmailBranding(database, process.env) };
    const accepted = await acceptInvite(database, submitted.data.token, { account: fields?.data ?? null, isFromEmail, notice });
    if (!accepted) return respondToUnusableLink(request, () => respondUnusableInvite(INVITE_STATES.accepted));

    const cookies = fields?.data
      ? await signInNewMember(request, accepted.email, fields.data.password)
      : await signInWithoutPassword(request, { id: accepted.userId, email: accepted.email, isEmailConfirmed: accepted.isEmailConfirmed });
    if (!accepted.isEmailConfirmed) {
      await sendEmailConfirmation(database, process.env, {
        id: accepted.userId,
        name: accepted.name,
        email: accepted.email,
      });
    }
    // "Your invite was used. Wasn't you?" goes out now; the timed sender retries it if this try fails.
    await sendQueuedEmailNow(database, process.env, accepted.noticeEmailId);
    return respondAccepted(cookies);
  }),
);
