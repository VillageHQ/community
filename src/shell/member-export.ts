import "server-only";

import { and, asc, eq, inArray, or } from "drizzle-orm";

import { ask, askAnswer, askOffer } from "@/modules/asks/schema";
import { comment, post, reaction } from "@/modules/feed/schema";
import { introRequest } from "@/modules/intros/schema";
import { jobPosting, jobSource } from "@/modules/job-board/schema";
import { readRequesterState } from "@/modules/intros/contract";
import { memberAvatar, memberBlock, memberFillIn, memberLookup, memberNetwork, memberProfile, memberTag } from "@/modules/members/schema";
import { readFillInSettings } from "@/modules/members/service-fill-in";
import { FILL_IN_FIELDS } from "@/modules/members/contract-fill-in";
import { isFilledLogoShown } from "@/modules/members/rules-fill-in";
import { readPrivacy } from "@/modules/members/service-privacy";
import { directMessage } from "@/modules/messages/schema";
import { adminAuditEntry } from "@/platform/audit/schema";
import { readBranding } from "@/platform/branding/branding";
import { user } from "@/platform/database/auth-schema";
import type { Database } from "@/platform/database/client";
import { emailOptOut } from "@/platform/email/schema";
import { weeklyEmail } from "@/platform/weekly-email/schema";

const EXPORT_VERSION = 1;

export function readExportFileName(now = new Date()) {
  return `my-data-${now.toISOString().slice(0, 10)}.json`;
}

// Intros they are part of. Their own words are in; another member's private note to them is not, only that it exists.
async function readIntros(database: Database, memberId: string) {
  const rows = await database
    .select({
      id: introRequest.id,
      requesterId: introRequest.requesterId,
      introducerId: introRequest.introducerId,
      requesterName: user.name,
      introducerName: introRequest.introducerName,
      targetName: introRequest.targetName,
      targetLinkedinSlug: introRequest.targetLinkedinSlug,
      note: introRequest.note,
      reason: introRequest.reason,
      state: introRequest.state,
      declineReason: introRequest.declineReason,
      outcome: introRequest.outcome,
      outcomeResults: introRequest.outcomeResults,
      createdAt: introRequest.createdAt,
      acceptedAt: introRequest.acceptedAt,
      closedAt: introRequest.closedAt,
    })
    .from(introRequest)
    .innerJoin(user, eq(user.id, introRequest.requesterId))
    // A withheld ask never reached its connector, so it isn't theirs to see.
    .where(or(eq(introRequest.requesterId, memberId), and(eq(introRequest.introducerId, memberId), eq(introRequest.isWithheld, false))))
    .orderBy(asc(introRequest.createdAt));
  return rows.map(({ requesterId, introducerId, requesterName, note, reason, declineReason, outcome, outcomeResults, ...intro }) =>
    requesterId === memberId
      ? // As the app shows it to whoever asked: no connector's private decline note, and no step the app keeps from them.
        { ...intro, state: readRequesterState(intro.state), yourRole: "asked", yourNote: note, reason, outcome, outcomeResults, introducerId }
      : { ...intro, yourRole: "connector", askedBy: requesterName, yourDeclineNote: declineReason },
  );
}

// Everything this community stores about one member, as they would want to take it with them. It never holds another
// member's email, private notes or messages.
type FilledInLine = { field: string; value: string; hiddenAt: Date | null };

function readPictureLinks(lines: readonly FilledInLine[], ownCompany: string | null, hasUploadedPhoto: boolean) {
  const line = (field: string) => lines.find((candidate) => candidate.field === field && candidate.value !== "");
  const face = line(FILL_IN_FIELDS.face);
  const logo = line(FILL_IN_FIELDS.companyLogo);
  const company = line(FILL_IN_FIELDS.company);
  return {
    face: face ? { url: face.value, isShown: face.hiddenAt === null && !hasUploadedPhoto } : null,
    companyLogo: logo
      ? { url: logo.value, isShown: logo.hiddenAt === null && isFilledLogoShown(ownCompany, company?.hiddenAt === null ? company.value : null) }
      : null,
  };
}

export async function readMemberExport(database: Database, memberId: string) {
  const [[account], branding, privacy, fillInSettings] = await Promise.all([
    database
      .select({ id: user.id, name: user.name, email: user.email, emailVerified: user.emailVerified, role: user.role, createdAt: user.createdAt })
      .from(user)
      .where(eq(user.id, memberId)),
    readBranding(database),
    readPrivacy(database, memberId),
    readFillInSettings(database),
  ]);
  const [profile] = await database.select().from(memberProfile).where(eq(memberProfile.userId, memberId));
  const jobSources = await database
    .select({ id: jobSource.id, company: jobSource.company, tool: jobSource.tool, sourceUrl: jobSource.sourceUrl, hidden: jobSource.hidden, createdAt: jobSource.createdAt })
    .from(jobSource)
    .where(eq(jobSource.memberId, memberId));
  const jobs = jobSources.length === 0
    ? []
    : await database
        .select({ sourceId: jobPosting.sourceId, title: jobPosting.title, location: jobPosting.location, url: jobPosting.url, isManual: jobPosting.isManual })
        .from(jobPosting)
        .where(inArray(jobPosting.sourceId, jobSources.map(({ id }) => id)));
  const [avatar] = await database.select().from(memberAvatar).where(eq(memberAvatar.userId, memberId));
  const [network] = await database.select().from(memberNetwork).where(eq(memberNetwork.userId, memberId));
  const [lookup] = await database.select().from(memberLookup).where(eq(memberLookup.userId, memberId));

  const [tags, filledIn, blocks, posts, replies, reactions, asks, offers, answers, intros, messages, optOuts, activity, weekly] = await Promise.all([
    database.select({ tag: memberTag.tag }).from(memberTag).where(eq(memberTag.userId, memberId)).orderBy(memberTag.tag),
    database.select({ field: memberFillIn.field, value: memberFillIn.value, filledAt: memberFillIn.filledAt, hiddenAt: memberFillIn.hiddenAt }).from(memberFillIn).where(eq(memberFillIn.userId, memberId)),
    database.select({ blockedMemberId: memberBlock.blockedId, createdAt: memberBlock.createdAt }).from(memberBlock).where(eq(memberBlock.blockerId, memberId)),
    database.select({ id: post.id, type: post.type, body: post.body, createdAt: post.createdAt, editedAt: post.editedAt }).from(post).where(eq(post.authorId, memberId)).orderBy(asc(post.createdAt)),
    database.select({ id: comment.id, postId: comment.postId, body: comment.body, createdAt: comment.createdAt }).from(comment).where(eq(comment.authorId, memberId)).orderBy(asc(comment.createdAt)),
    database.select({ postId: reaction.postId, reaction: reaction.reaction }).from(reaction).where(eq(reaction.userId, memberId)),
    database
      .select({ id: ask.id, kind: ask.kind, title: ask.title, detail: ask.detail, category: ask.category, targetName: ask.targetName, outcome: ask.outcome, createdAt: ask.createdAt, closedAt: ask.closedAt })
      .from(ask)
      .where(eq(ask.authorId, memberId))
      .orderBy(asc(ask.createdAt)),
    database.select({ askId: askOffer.askId, note: askOffer.note, createdAt: askOffer.createdAt }).from(askOffer).where(eq(askOffer.helperId, memberId)),
    database.select({ askId: askAnswer.askId, body: askAnswer.body, createdAt: askAnswer.createdAt }).from(askAnswer).where(eq(askAnswer.authorId, memberId)),
    readIntros(database, memberId),
    database
      .select({ conversationId: directMessage.conversationId, body: directMessage.body, createdAt: directMessage.createdAt, deletedAt: directMessage.deletedAt })
      .from(directMessage)
      .where(eq(directMessage.senderId, memberId))
      .orderBy(asc(directMessage.createdAt)),
    database.select({ topic: emailOptOut.topic, since: emailOptOut.createdAt }).from(emailOptOut).where(eq(emailOptOut.memberId, memberId)),
    database.select({ action: adminAuditEntry.action, at: adminAuditEntry.createdAt }).from(adminAuditEntry).where(eq(adminAuditEntry.actorId, memberId)).orderBy(asc(adminAuditEntry.createdAt)),
    database.select({ week: weeklyEmail.weekKey, status: weeklyEmail.status, sentAt: weeklyEmail.createdAt }).from(weeklyEmail).where(eq(weeklyEmail.memberId, memberId)),
  ]);

  return {
    format: { name: "community-member-export", version: EXPORT_VERSION },
    exportedAt: new Date().toISOString(),
    community: branding.name,
    account: account ?? null,
    profile: profile
      ? {
          title: profile.title,
          company: profile.company,
          location: profile.location,
          bio: profile.bio,
          canHelpWith: profile.canHelpWith,
          needs: profile.needs,
          website: profile.website,
          updatedAt: profile.updatedAt,
          onboardingCompletedAt: profile.onboardingCompletedAt,
        }
      : null,
    tags: tags.map(({ tag }) => tag),
    photo: avatar ? { contentType: avatar.contentType, updatedAt: avatar.updatedAt, dataBase64: Buffer.from(avatar.bytes).toString("base64") } : null,
    filledInFromPublicProfiles: filledIn,
    // The links to the pictures public profiles found, and whether each is on show.
    picturesFromPublicProfiles: readPictureLinks(filledIn, profile?.company ?? null, avatar !== undefined),
    privacy: {
      hiddenFromDirectory: privacy.isHidden,
      whoCanMessageMe: privacy.messagePolicy,
      acceptsIntroAsks: privacy.acceptsIntroAsks,
    },
    consent: {
      introAsks: { answer: privacy.acceptsIntroAsks, at: privacy.introAsksAnsweredAt, where: privacy.introAsksAnsweredPlace },
      profileFillIn: {
        communityBasis: fillInSettings.basis,
        termsDate: fillInSettings.termsDate,
        agreedAt: lookup?.consentedAt ?? null,
        refusedAt: lookup?.refusedAt ?? null,
        lastLookedUpAt: lookup?.lookedUpAt ?? null,
        lastLookupResult: lookup?.status ?? null,
      },
      networkSharing: { agreedAt: network?.sharingConsentedAt ?? null, joinedGroupAt: network?.groupJoinedAt ?? null, villageLinkedAt: network?.villageLinkedAt ?? null },
      creditInPartnerReports: profile?.creditInReports ?? false,
    },
    network: network ? { linkedinSlug: network.linkedinSlug, linkedinConfirmedSlug: network.linkedinConfirmedSlug, villageMemberNumber: network.villageExternalId } : null,
    blocks,
    posts,
    replies,
    reactions,
    asks,
    offersYouMade: offers,
    answersYouWrote: answers,
    intros,
    messagesYouSent: messages,
    emailTopicsTurnedOff: optOuts,
    weeklyEmails: weekly,
    hiringToolsYouLinked: jobSources,
    jobsFromYourHiringTools: jobs,
    yourActionsInTheAuditLog: activity,
  };
}
