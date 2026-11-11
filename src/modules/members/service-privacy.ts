import "server-only";

import { and, eq, sql } from "drizzle-orm";
import type { AnyPgColumn } from "drizzle-orm/pg-core";

import { user } from "../../platform/database/auth-schema.ts";
import type { Database, DatabaseOrTransaction } from "../../platform/database/client.ts";
import { AUDIT_ACTIONS } from "../../platform/audit/actions.ts";
import { recordAdminAction } from "../../platform/audit/record.ts";
import { MESSAGE_POLICIES, type ChoicePlace, type MessagePolicy, type PrivacyBody } from "./contract-privacy.ts";
import { memberPrivacy } from "./schema.ts";
import { INSTANCE_SETTING_KEYS } from "../../platform/settings/schema.ts";
import { readSettings } from "../../platform/settings/store.ts";

export type MemberPrivacy = {
  isHidden: boolean;
  messagePolicy: MessagePolicy;
  acceptsIntroAsks: boolean | null;
  introAsksAnsweredAt: Date | null;
  introAsksAnsweredPlace: ChoicePlace | null;
  hiddenChangedAt: Date | null;
  messagePolicyChangedAt: Date | null;
};

const DEFAULT_PRIVACY: MemberPrivacy = {
  isHidden: false,
  messagePolicy: MESSAGE_POLICIES.anyone,
  acceptsIntroAsks: null,
  introAsksAnsweredAt: null,
  introAsksAnsweredPlace: null,
  hiddenChangedAt: null,
  messagePolicyChangedAt: null,
};

// Who can message a member who never chose: the community's default from Set up › Settings (anyone, unless set).
export async function readCommunityMessagePolicy(database: DatabaseOrTransaction): Promise<MessagePolicy> {
  const value = (await readSettings(database, [INSTANCE_SETTING_KEYS.messagePolicyDefault])).get(INSTANCE_SETTING_KEYS.messagePolicyDefault);
  return value === MESSAGE_POLICIES.introduced ? MESSAGE_POLICIES.introduced : MESSAGE_POLICIES.anyone;
}

export async function readPrivacy(database: DatabaseOrTransaction, memberId: string): Promise<MemberPrivacy> {
  const [row] = await database.select().from(memberPrivacy).where(eq(memberPrivacy.userId, memberId));
  if (!row) return { ...DEFAULT_PRIVACY, messagePolicy: await readCommunityMessagePolicy(database) };
  return {
    isHidden: row.isHidden,
    // A member who never chose follows the community's default.
    messagePolicy: row.messagePolicyChangedAt === null ? await readCommunityMessagePolicy(database) : (row.messagePolicy as MessagePolicy),
    acceptsIntroAsks: row.acceptsIntroAsks,
    introAsksAnsweredAt: row.introAsksAnsweredAt,
    introAsksAnsweredPlace: row.introAsksAnsweredPlace as ChoicePlace | null,
    hiddenChangedAt: row.hiddenChangedAt,
    messagePolicyChangedAt: row.messagePolicyChangedAt,
  };
}

// One switch at a time, each with the date it last changed, for the member's consent record.
export async function savePrivacy(database: Database, memberId: string, body: Omit<PrivacyBody, "acceptsIntroAsks">) {
  const now = new Date();
  const changes = {
    ...(body.isHidden === undefined ? {} : { isHidden: body.isHidden, hiddenChangedAt: now }),
    ...(body.messagePolicy === undefined ? {} : { messagePolicy: body.messagePolicy, messagePolicyChangedAt: now }),
  };
  if (Object.keys(changes).length === 0) return;
  await database.insert(memberPrivacy).values({ userId: memberId, ...changes }).onConflictDoUpdate({ target: memberPrivacy.userId, set: changes });
}

// A member who never answered keeps the behaviour from before the question existed: they can be asked.
export async function readAcceptsIntroAsks(database: DatabaseOrTransaction, memberId: string) {
  const { acceptsIntroAsks } = await readPrivacy(database, memberId);
  return acceptsIntroAsks !== false;
}

export async function hasAnsweredIntroAsks(database: DatabaseOrTransaction, memberId: string) {
  return (await readPrivacy(database, memberId)).acceptsIntroAsks !== null;
}

// For directory-style lists: true unless the member chose "hide me from the directory".
export function isListedMember(memberId: AnyPgColumn = user.id) {
  return sql<boolean>`not exists (select 1 from ${memberPrivacy} where ${memberPrivacy.userId} = ${memberId} and ${memberPrivacy.isHidden})`;
}

export async function isHiddenMember(database: DatabaseOrTransaction, memberId: string) {
  const [row] = await database
    .select({ isHidden: memberPrivacy.isHidden })
    .from(memberPrivacy)
    .where(and(eq(memberPrivacy.userId, memberId), eq(memberPrivacy.isHidden, true)));
  return row !== undefined;
}

// "Accept intro asks" is a consent choice, so each answer also goes in the audit log, with no other detail.
export async function saveIntroAsksAnswer(database: Database, memberId: string, acceptsIntroAsks: boolean, place: ChoicePlace) {
  const now = new Date();
  const changes = { acceptsIntroAsks, introAsksAnsweredAt: now, introAsksAnsweredPlace: place };
  await database.transaction(async (transaction) => {
    await transaction.insert(memberPrivacy).values({ userId: memberId, ...changes }).onConflictDoUpdate({ target: memberPrivacy.userId, set: changes });
    await recordAdminAction(transaction, memberId, { action: AUDIT_ACTIONS.introAsksAnswered, targetMemberId: memberId, detail: acceptsIntroAsks ? "yes" : "no" });
  });
}
