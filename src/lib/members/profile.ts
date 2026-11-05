import "server-only";

import { and, eq } from "drizzle-orm";

import { user } from "../../database/auth-schema.ts";
import type { Database } from "../../database/client.ts";
import { memberAvatar, memberProfile, memberTag } from "../../database/members-schema.ts";
import { memberNetwork } from "../../database/village-schema.ts";
import type { ImageContentType } from "../image-rules.ts";
import { API_ROUTES } from "../routes.ts";
import { saveMemberLinkedinUrl, NetworkRequestError, type NetworkContext } from "../village/member-network.ts";
import { NETWORK_ERROR_CODES } from "../village/network-api.ts";
import { isActiveMember } from "./active-member.ts";
import { parseExternalUrl } from "./external-url.ts";
import { normalizeTag, type ProfileBody } from "./profile-api.ts";

const UNPROCESSABLE_STATUS = 422;
const NULL_BYTE = "\0";

export function toAvatarUrl(memberId: string, updatedAt: Date | null) {
  if (!updatedAt) return null;
  return `${API_ROUTES.members}/${encodeURIComponent(memberId)}/avatar?v=${updatedAt.getTime()}`;
}

async function readLinkedinSlugOf(database: Database, memberId: string) {
  const [network] = await database
    .select({ linkedinSlug: memberNetwork.linkedinSlug })
    .from(memberNetwork)
    .where(eq(memberNetwork.userId, memberId));
  return network?.linkedinSlug ?? null;
}

async function saveLinkedin(context: NetworkContext, linkedinUrl: string | undefined) {
  if (linkedinUrl === undefined) return;
  if (linkedinUrl) {
    await saveMemberLinkedinUrl(context, linkedinUrl);
    return;
  }
  if (!(await readLinkedinSlugOf(context.database, context.member.id))) return;
  throw new NetworkRequestError(
    UNPROCESSABLE_STATUS,
    NETWORK_ERROR_CODES.linkedinInvalid,
    "Network search matches you by your LinkedIn, so it can't be removed. You can change it to another profile.",
  );
}

export async function saveProfile(context: NetworkContext, body: ProfileBody) {
  const { database, member } = context;
  const { name, tags, linkedinUrl, ...cardFields } = body;
  await saveLinkedin(context, linkedinUrl);

  const now = new Date();
  await database.transaction(async (transaction) => {
    if (name) await transaction.update(user).set({ name }).where(eq(user.id, member.id));
    await transaction
      .insert(memberProfile)
      .values({ userId: member.id, ...cardFields, cardStepDoneAt: now, onboardingCompletedAt: now, updatedAt: now })
      .onConflictDoUpdate({ target: memberProfile.userId, set: { ...cardFields, updatedAt: now } });
    if (!tags) return;
    await transaction.delete(memberTag).where(eq(memberTag.userId, member.id));
    if (tags.length === 0) return;
    await transaction
      .insert(memberTag)
      .values(tags.map((tag) => ({ userId: member.id, tag, normalizedTag: normalizeTag(tag) })));
  });
}

export async function saveAvatar(
  database: Database,
  memberId: string,
  bytes: Buffer,
  contentType: ImageContentType,
) {
  const fields = { bytes, contentType, updatedAt: new Date() };
  await database
    .insert(memberAvatar)
    .values({ userId: memberId, ...fields })
    .onConflictDoUpdate({ target: memberAvatar.userId, set: fields });
}

export async function deleteAvatar(database: Database, memberId: string) {
  await database.delete(memberAvatar).where(eq(memberAvatar.userId, memberId));
}

export async function readAvatar(database: Database, memberId: string) {
  if (memberId.includes(NULL_BYTE)) return null;
  const [avatar] = await database
    .select({ bytes: memberAvatar.bytes, contentType: memberAvatar.contentType, updatedAt: memberAvatar.updatedAt })
    .from(memberAvatar)
    .innerJoin(user, eq(user.id, memberAvatar.userId))
    .where(and(eq(memberAvatar.userId, memberId), isActiveMember()));
  if (!avatar) return null;
  return { bytes: avatar.bytes, contentType: avatar.contentType, version: String(avatar.updatedAt.getTime()) };
}

export async function readAvatarUrl(database: Database, memberId: string) {
  const [avatar] = await database
    .select({ updatedAt: memberAvatar.updatedAt })
    .from(memberAvatar)
    .where(eq(memberAvatar.userId, memberId));
  return toAvatarUrl(memberId, avatar?.updatedAt ?? null);
}

export async function readMemberProfile(database: Database, memberId: string) {
  if (memberId.includes(NULL_BYTE)) return null;
  const [row] = await database
    .select({
      id: user.id,
      name: user.name,
      email: user.email,
      emailVerified: user.emailVerified,
      createdAt: user.createdAt,
      title: memberProfile.title,
      company: memberProfile.company,
      location: memberProfile.location,
      bio: memberProfile.bio,
      canHelpWith: memberProfile.canHelpWith,
      needs: memberProfile.needs,
      website: memberProfile.website,
      linkedinSlug: memberNetwork.linkedinSlug,
      linkedinConfirmedSlug: memberNetwork.linkedinConfirmedSlug,
      avatarUpdatedAt: memberAvatar.updatedAt,
    })
    .from(user)
    .leftJoin(memberProfile, eq(memberProfile.userId, user.id))
    .leftJoin(memberNetwork, eq(memberNetwork.userId, user.id))
    .leftJoin(memberAvatar, eq(memberAvatar.userId, user.id))
    .where(and(eq(user.id, memberId), isActiveMember()));
  if (!row) return null;

  const tags = await database
    .select({ tag: memberTag.tag })
    .from(memberTag)
    .where(eq(memberTag.userId, memberId))
    .orderBy(memberTag.tag);

  const { avatarUpdatedAt, website, linkedinConfirmedSlug, ...fields } = row;
  return {
    ...fields,
    isLinkedinConfirmed: fields.linkedinSlug !== null && linkedinConfirmedSlug === fields.linkedinSlug,
    website: website ? parseExternalUrl(website) : null,
    avatarUrl: toAvatarUrl(memberId, avatarUpdatedAt),
    tags: tags.map(({ tag }) => tag),
  };
}

export type MemberProfile = NonNullable<Awaited<ReturnType<typeof readMemberProfile>>>;

export function isCardFilledIn({ title, company, bio, canHelpWith }: Pick<MemberProfile, "title" | "company" | "bio" | "canHelpWith">) {
  return Boolean(title || company || bio || canHelpWith);
}
