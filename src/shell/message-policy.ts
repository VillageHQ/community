import "server-only";

import { and, eq, inArray, isNotNull, or, sql } from "drizzle-orm";

import { introRequest } from "@/modules/intros/schema";
import { INTRO_STATES } from "@/modules/intros/contract";
import { MESSAGE_POLICIES, readEffectiveMessagePolicy } from "@/modules/members/contract-privacy";
import { memberNetwork } from "@/modules/members/schema";
import { readPrivacy } from "@/modules/members/service-privacy";
import type { MessagePermission } from "@/modules/messages/service";
import { conversation, directMessage } from "@/modules/messages/schema";
import { toConversationPair } from "@/modules/messages/rules-conversation-pair";
import { user } from "@/platform/database/auth-schema";
import type { DatabaseOrTransaction } from "@/platform/database/client";
import { MEMBER_ROLES } from "@/platform/auth/roles";

async function isAdmin(connection: DatabaseOrTransaction, memberId: string) {
  const [row] = await connection.select({ role: user.role }).from(user).where(eq(user.id, memberId));
  return row?.role === MEMBER_ROLES.admin;
}

// The recipient already wrote in this conversation, so the sender can always answer.
async function hasWrittenTo(connection: DatabaseOrTransaction, authorId: string, readerId: string) {
  const pair = toConversationPair(authorId, readerId);
  const [row] = await connection
    .select({ id: directMessage.id })
    .from(directMessage)
    .innerJoin(conversation, eq(conversation.id, directMessage.conversationId))
    .where(and(eq(conversation.memberLowId, pair.memberLowId), eq(conversation.memberHighId, pair.memberHighId), eq(directMessage.senderId, authorId)))
    .limit(1);
  return row !== undefined;
}

async function readSlugs(connection: DatabaseOrTransaction, memberId: string) {
  const [row] = await connection
    .select({ slug: memberNetwork.linkedinSlug, confirmedSlug: memberNetwork.linkedinConfirmedSlug })
    .from(memberNetwork)
    .where(eq(memberNetwork.userId, memberId));
  return [row?.slug, row?.confirmedSlug].filter((slug): slug is string => Boolean(slug));
}

// Two members were introduced here when one asked the other for an intro and the connector said yes, or when a
// completed intro reached one of them by their LinkedIn address.
export async function wereIntroduced(connection: DatabaseOrTransaction, firstId: string, secondId: string) {
  const connectorSaidYes = or(isNotNull(introRequest.acceptedAt), isNotNull(introRequest.askedTargetAt), eq(introRequest.state, INTRO_STATES.completed));
  const between = or(
    and(eq(introRequest.requesterId, firstId), eq(introRequest.introducerId, secondId)),
    and(eq(introRequest.requesterId, secondId), eq(introRequest.introducerId, firstId)),
  );
  const [firstSlugs, secondSlugs] = await Promise.all([readSlugs(connection, firstId), readSlugs(connection, secondId)]);
  const reached = (requesterId: string, targetSlugs: string[]) =>
    targetSlugs.length > 0 ? and(eq(introRequest.requesterId, requesterId), inArray(introRequest.targetLinkedinSlug, targetSlugs)) : sql`false`;
  const [row] = await connection
    .select({ id: introRequest.id })
    .from(introRequest)
    .where(
      or(
        and(between, connectorSaidYes),
        and(eq(introRequest.state, INTRO_STATES.completed), or(reached(firstId, secondSlugs), reached(secondId, firstSlugs))),
      ),
    )
    .limit(1);
  return row !== undefined;
}

// The recipient's "who can message me". Admins can always write, and anyone can answer a member who wrote first.
export const mayMessage: MessagePermission = async (connection, senderId, recipientId) => {
  const { messagePolicy } = await readPrivacy(connection, recipientId);
  if (readEffectiveMessagePolicy(messagePolicy) === MESSAGE_POLICIES.anyone) return true;
  if (await isAdmin(connection, senderId)) return true;
  if (await hasWrittenTo(connection, recipientId, senderId)) return true;
  return wereIntroduced(connection, senderId, recipientId);
};
