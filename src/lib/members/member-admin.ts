import "server-only";

import { and, count, eq, or, isNull, ne } from "drizzle-orm";

import { user } from "../../database/auth-schema.ts";
import type { Database } from "../../database/client.ts";
import { invite, memberAvatar } from "../../database/members-schema.ts";
import { memberNetwork } from "../../database/village-schema.ts";
import { readResendConfig } from "../email/resend.ts";
import type { Environment } from "../environment.ts";
import { INVITE_ERROR_CODES } from "../invites/invite-api.ts";
import { readLinkedinSlug } from "../village/linkedin-slug.ts";
import { NetworkRequestError, type NetworkContext } from "../village/member-network.ts";
import { NETWORK_ERROR_CODES } from "../village/network-api.ts";
import { isActiveMember } from "./active-member.ts";
import { toAvatarUrl } from "./profile.ts";

const NOT_FOUND_STATUS = 404;
const CONFLICT_STATUS = 409;
const UNPROCESSABLE_STATUS = 422;
const ADMIN_ROLE = "admin";
const MAXIMUM_WAITING_MEMBERS_SHOWN = 10;

function isWaitingForConfirmation() {
  return and(
    eq(user.emailVerified, false),
    isActiveMember(),
    or(isNull(user.role), ne(user.role, ADMIN_ROLE)),
  );
}

export async function readWaitingMembers(database: Database) {
  const rows = await database
    .select({
      id: user.id,
      name: user.name,
      email: user.email,
      avatarUpdatedAt: memberAvatar.updatedAt,
      inviteId: invite.id,
    })
    .from(user)
    .leftJoin(memberAvatar, eq(memberAvatar.userId, user.id))
    .leftJoin(invite, and(eq(invite.acceptedUserId, user.id), isNull(invite.revokedAt)))
    .where(isWaitingForConfirmation())
    .orderBy(user.createdAt, user.id)
    .limit(MAXIMUM_WAITING_MEMBERS_SHOWN);
  return rows.map(({ avatarUpdatedAt, ...member }) => ({
    ...member,
    avatarUrl: toAvatarUrl(member.id, avatarUpdatedAt),
  }));
}

export async function readWaitingMemberCount(database: Database) {
  const [row] = await database.select({ waitingCount: count() }).from(user).where(isWaitingForConfirmation());
  return row?.waitingCount ?? 0;
}

export async function readConfirmationBadgeCount(database: Database, environment: Environment) {
  return readResendConfig(environment) ? 0 : readWaitingMemberCount(database);
}

export async function confirmMemberEmail({ database }: NetworkContext, memberId: string) {
  const confirmed = await database
    .update(user)
    .set({ emailVerified: true })
    .where(and(eq(user.id, memberId), eq(user.emailVerified, false), isActiveMember()))
    .returning({ id: user.id });
  if (confirmed.length > 0) return;
  throw new NetworkRequestError(
    CONFLICT_STATUS,
    INVITE_ERROR_CODES.changed,
    "This member changed. Reload the page and check again.",
  );
}

export async function clearLinkedinClaim({ database }: NetworkContext, linkedinUrl: string) {
  const linkedinSlug = readLinkedinSlug(linkedinUrl);
  if (!linkedinSlug) {
    throw new NetworkRequestError(
      UNPROCESSABLE_STATUS,
      NETWORK_ERROR_CODES.linkedinInvalid,
      "Use a LinkedIn profile URL, like https://www.linkedin.com/in/their-name.",
    );
  }

  const [holder] = await database
    .select({ id: user.id, name: user.name })
    .from(memberNetwork)
    .innerJoin(user, eq(user.id, memberNetwork.userId))
    .where(eq(memberNetwork.linkedinSlug, linkedinSlug));
  if (!holder) {
    throw new NetworkRequestError(
      NOT_FOUND_STATUS,
      NETWORK_ERROR_CODES.memberNotFound,
      "Nobody here holds that LinkedIn profile.",
    );
  }

  await database.update(memberNetwork).set({ linkedinSlug: null }).where(eq(memberNetwork.userId, holder.id));
  return holder.name;
}
