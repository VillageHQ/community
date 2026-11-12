import { eq } from "drizzle-orm";

import type { DatabaseOrTransaction } from "../../platform/database/client.ts";
import type { Environment } from "../../platform/environment.ts";
import { resolveAppUrl } from "../../platform/http/app-url.ts";
import { ROUTES } from "../../platform/http/routes.ts";
import { createInviteToken, hashInviteToken } from "../members/service-invite-token.ts";
import { CONSENT_TOKEN_MAXIMUM_LENGTH, type IntroLinkPurpose } from "./contract.ts";
import { introAnswerLink } from "./schema.ts";

// Links that answer without signing in (the connector's, the asker's outcome link). 32 random bytes, kept only as a
// SHA-256 hash. Each email makes its own; every link for the same step works while that step is open.
export async function issueAnswerLink(connection: DatabaseOrTransaction, introId: string, purpose: IntroLinkPurpose) {
  const token = createInviteToken();
  await connection.insert(introAnswerLink).values({ tokenHash: hashInviteToken(token), introId, purpose });
  return token;
}

export function readAnswerLinkUrl(environment: Environment, token: string) {
  return `${resolveAppUrl(environment)}${ROUTES.introConsent}/${token}`;
}

export async function readAnswerLink(connection: DatabaseOrTransaction, token: string) {
  if (!token || token.length > CONSENT_TOKEN_MAXIMUM_LENGTH) return null;
  const [link] = await connection
    .select({ introId: introAnswerLink.introId, purpose: introAnswerLink.purpose })
    .from(introAnswerLink)
    .where(eq(introAnswerLink.tokenHash, hashInviteToken(token)));
  return link ? { introId: link.introId, purpose: link.purpose as IntroLinkPurpose } : null;
}
