import "server-only";

import { and, eq } from "drizzle-orm";

import { user } from "../../platform/database/auth-schema.ts";
import type { Database } from "../../platform/database/client.ts";
import { memberAvatar, memberProfile, memberTag, memberNetwork } from "./schema.ts";
import type { ImageContentType } from "../../platform/image-rules.ts";
import { saveMemberLinkedinUrl } from "./service-linkedin.ts";
import { RequestError } from "../../platform/http/request-error.ts";
import { type RequestContext } from "../../platform/http/request-context.ts";
import { MEMBER_ERROR_CODES } from "./contract-linkedin.ts";
import { isActiveMember } from "../../platform/auth/member-status.ts";
import { parseExternalUrl } from "./rules-external-url.ts";
import { normalizeTag, type ProfileBody } from "./contract-profile.ts";
import { readShownCard } from "./rules-fill-in.ts";
import { readShownFillIn } from "./service-fill-in.ts";
import { filledFaceColumn, toAvatarUrl, toShownFaceUrl } from "./reads-pictures.ts";

const UNPROCESSABLE_STATUS = 422;
const NULL_BYTE = "\0";

export { toAvatarUrl };

async function readLinkedinSlugOf(database: Database, memberId: string) {
  const [network] = await database
    .select({ linkedinSlug: memberNetwork.linkedinSlug })
    .from(memberNetwork)
    .where(eq(memberNetwork.userId, memberId));
  return network?.linkedinSlug ?? null;
}

async function saveLinkedin(context: RequestContext, linkedinUrl: string | undefined) {
  if (linkedinUrl === undefined) return;
  if (linkedinUrl) {
    await saveMemberLinkedinUrl(context, linkedinUrl);
    return;
  }
  if (!(await readLinkedinSlugOf(context.database, context.member.id))) return;
  throw new RequestError(
    UNPROCESSABLE_STATUS,
    MEMBER_ERROR_CODES.linkedinInvalid,
    "Members recognize you by your LinkedIn, so it can't be removed. You can change it to another profile.",
  );
}

export async function saveProfile(context: RequestContext, body: ProfileBody) {
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

// The face every screen draws for the member: their uploaded photo, else the face public profiles found.
export async function readAvatarUrl(database: Database, memberId: string) {
  const [row] = await database
    .select({ updatedAt: memberAvatar.updatedAt, filledFace: filledFaceColumn(user.id) })
    .from(user)
    .leftJoin(memberAvatar, eq(memberAvatar.userId, user.id))
    .where(eq(user.id, memberId));
  return toShownFaceUrl(memberId, row?.updatedAt ?? null, row?.filledFace ?? null);
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
      stage: memberProfile.stage,
      sector: memberProfile.sector,
      cohort: memberProfile.cohort,
      bio: memberProfile.bio,
      canHelpWith: memberProfile.canHelpWith,
      needs: memberProfile.needs,
      website: memberProfile.website,
      profileUpdatedAt: memberProfile.updatedAt,
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

  const [tags, shownFillIn] = await Promise.all([
    database.select({ tag: memberTag.tag }).from(memberTag).where(eq(memberTag.userId, memberId)).orderBy(memberTag.tag),
    readShownFillIn(database, memberId),
  ]);

  const { avatarUpdatedAt, website, linkedinConfirmedSlug, profileUpdatedAt, ...fields } = row;
  const avatarUrl = toAvatarUrl(memberId, avatarUpdatedAt);
  return {
    ...fields,
    isLinkedinConfirmed: fields.linkedinSlug !== null && linkedinConfirmedSlug === fields.linkedinSlug,
    website: website ? parseExternalUrl(website) : null,
    avatarUrl,
    // "Fresh as of": when they last saved their own words; never saved = when they joined.
    freshAt: profileUpdatedAt ?? fields.createdAt,
    tags: tags.map(({ tag }) => tag),
    // What others see: the member's own words, with filled-in lines only where they wrote nothing.
    shown: readShownCard({ title: fields.title, company: fields.company, location: fields.location, avatarUrl }, shownFillIn),
  };
}

export type MemberProfile = NonNullable<Awaited<ReturnType<typeof readMemberProfile>>>;

export function isCardFilledIn({ title, company, bio, canHelpWith }: Pick<MemberProfile, "title" | "company" | "bio" | "canHelpWith">) {
  return Boolean(title || company || bio || canHelpWith);
}
