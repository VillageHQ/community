import "server-only";

import { INVITE_STATES } from "@/modules/members/contract-invite-state";
import { readInviteByToken } from "@/modules/members/service-invites";
import { readSignInLinkEmail } from "@/platform/auth/sign-in-link-verify";
import type { Database } from "@/platform/database/client";
import { ROUTES } from "@/platform/http/routes";

const MAXIMUM_TOKEN_LENGTH = 256;

// Founderhall answers a used, expired or unknown sign-in or invite link with 410 Gone; the page shows the words.
// Only reads: opening a link never uses it.
export async function isGoneLinkPage(database: Database, pathname: string, token: string | null) {
  if (pathname !== ROUTES.signInLink && pathname !== ROUTES.join) return false;
  if (!token || token.length > MAXIMUM_TOKEN_LENGTH) return true;
  if (pathname === ROUTES.signInLink) return (await readSignInLinkEmail(database, token)) === null;
  return (await readInviteByToken(database, token))?.state !== INVITE_STATES.pending;
}
