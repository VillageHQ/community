import { eq } from "drizzle-orm";

import { readBranding } from "../../platform/branding/branding.ts";
import { user } from "../../platform/database/auth-schema.ts";
import type { Database } from "../../platform/database/client.ts";
import { EMAIL_KINDS, type EmailKind } from "../../platform/email/kinds.ts";
import { cancelQueuedEmail, queueEmail } from "../../platform/email/outbox.ts";
import { sendQueuedEmailNow } from "../../platform/email/outbox-sender.ts";
import { resolveReplySigner } from "../../platform/email/reply-address.ts";
import { readResendConfig } from "../../platform/email/resend.ts";
import type { Environment } from "../../platform/environment.ts";
import { resolveAppUrl } from "../../platform/http/app-url.ts";
import { ROUTES } from "../../platform/http/routes.ts";
import { memberProfile } from "../members/schema.ts";
import { shownCompanyColumn } from "../members/reads-pictures.ts";
import { TARGET_CHOICES, type Intro } from "./contract.ts";
import { readWhyTheyWrote } from "./copy.ts";
import { renderIntroduction, renderTargetAsk, toRoleAndCompany, type IntroductionReader } from "./email-copy.ts";
import type { introRequest } from "./schema.ts";
import { introThreadReplyTo, openIntroThread } from "./service-thread.ts";

const IDEMPOTENCY_TOKEN_PREFIX_LENGTH = 16;

type OutsideEmail = { to: string; memberId: string | null; kind: EmailKind; dedupeKey: string; replyTo?: string; subject: string; text: string; html: string };

// One email through the outbox, sent now. Throws when it didn't go, and takes it back out of the queue, so the caller
// can undo its own claim without the timed sender sending it later anyway.
async function sendThroughOutbox(database: Database, environment: Environment, { replyTo, ...email }: OutsideEmail) {
  const queuedId = await queueEmail(database, environment, { ...email, replyTo: replyTo ?? null });
  if (!queuedId) throw new Error("The email wasn't queued.");
  if (await sendQueuedEmailNow(database, environment, queuedId)) return;
  await cancelQueuedEmail(database, queuedId);
  throw new Error("The email didn't go out.");
}

export type TargetAskFacts = {
  requesterName: string;
  requesterHeadline: string | null;
  introducerName: string;
  targetName: string;
  communityName: string;
  note: string;
};

// The person's page (`/i/<token>`) and their "stop intro asks" page (`/intro/optout/<token>`), from one consent token.
export function readConsentLinks(environment: Environment, token: string) {
  const appUrl = resolveAppUrl(environment);
  const page = `${appUrl}${ROUTES.introConsent}/${token}`;
  return { page, yes: `${page}?a=${TARGET_CHOICES.yes}`, no: `${page}?a=${TARGET_CHOICES.no}`, optOut: `${appUrl}${ROUTES.introOptOut}/${token}` };
}

export function renderConsentAskEmail(facts: TargetAskFacts, environment: Environment, token: string, isReminder = false) {
  const links = readConsentLinks(environment, token);
  return renderTargetAsk({
    community: facts.communityName,
    connector: facts.introducerName,
    asker: facts.requesterName,
    askerAbout: facts.requesterHeadline,
    target: facts.targetName,
    note: facts.note,
    links: { yes: links.yes, no: links.no },
    optOutLink: links.optOut,
    isReminder,
  });
}

export function renderTargetReminderEmail(facts: TargetAskFacts, environment: Environment, token: string) {
  return renderConsentAskEmail(facts, environment, token, true);
}

type ConsentAskRequest = { intro: Intro; token: string; targetEmail: string };

export async function sendConsentAskEmail(database: Database, environment: Environment, { intro, token, targetEmail }: ConsentAskRequest) {
  if (!readResendConfig(environment)) throw new Error("Email isn't configured.");
  const { name: communityName } = await readBranding(database);
  const facts = {
    requesterName: intro.requester.name,
    requesterHeadline: intro.requester.headline,
    introducerName: intro.introducer.name,
    targetName: intro.target.name,
    communityName,
    note: readWhyTheyWrote(intro.note, intro.introducer.name, intro.target.name),
  };
  await sendThroughOutbox(database, environment, {
    kind: EMAIL_KINDS.introTargetReminder,
    to: targetEmail,
    memberId: null,
    // One row per send: a later email to a corrected address is a new email, not a repeat of the first.
    dedupeKey: `intro-consent-${token.slice(0, IDEMPOTENCY_TOKEN_PREFIX_LENGTH)}-${Date.now()}`,
    ...renderConsentAskEmail(facts, environment, token),
  });
}

type JoiningFacts = {
  communityName: string;
  requesterName: string;
  requesterHeadline: string | null;
  requesterEmail: string;
  introducerName: string;
  targetName: string;
  targetHeadline: string | null;
  targetEmail: string;
  note: string;
};

// One copy of the introduction. The connector's copy never shows the asker's address: members never see each
// other's addresses.
export function renderJoiningEmail(facts: JoiningFacts, reader: IntroductionReader) {
  const isConnector = reader === "connector";
  return renderIntroduction(
    {
      community: facts.communityName,
      asker: facts.requesterName,
      askerAbout: facts.requesterHeadline,
      target: facts.targetName,
      targetAbout: facts.targetHeadline,
      connector: facts.introducerName,
      askerEmail: isConnector ? null : facts.requesterEmail,
      targetEmail: isConnector ? null : facts.targetEmail,
      note: facts.note,
    },
    reader,
  );
}

async function readMemberFacts(database: Database, memberId: string) {
  const [member] = await database
    .select({ email: user.email, title: memberProfile.title, company: shownCompanyColumn(user.id) })
    .from(user)
    .leftJoin(memberProfile, eq(memberProfile.userId, user.id))
    .where(eq(user.id, memberId));
  return member ?? null;
}

// The introduction, as Founderhall sends it: one email each to the asker, the person and the connector, whose replies
// run through the app's intro thread so everyone in it gets them. Without replies by email, the asker and the person
// each get a copy whose reply goes to the other; the connector then gets the app's notice instead. Returns whether the
// connector was copied.
export async function sendJoiningEmail(database: Database, environment: Environment, intro: typeof introRequest.$inferSelect, requesterName: string) {
  const config = readResendConfig(environment);
  if (!config || !intro.targetEmail) throw new Error("Email isn't configured.");
  const [requester, introducer] = await Promise.all([readMemberFacts(database, intro.requesterId), readMemberFacts(database, intro.introducerId)]);
  if (!requester) throw new Error("The requester is gone.");
  const { name: communityName } = await readBranding(database);
  const facts: JoiningFacts = {
    communityName,
    requesterName,
    requesterHeadline: [requester.title, requester.company].filter(Boolean).join(", ") || null,
    requesterEmail: requester.email,
    introducerName: intro.introducerName,
    targetName: intro.targetName,
    targetHeadline: toRoleAndCompany(intro.targetHeadline),
    targetEmail: intro.targetEmail,
    note: readWhyTheyWrote(intro.note, intro.introducerName, intro.targetName),
  };
  const signer = await resolveReplySigner(database, environment);
  if (!signer) {
    // Replies by email are off: each gets their own copy through the outbox, and a reply goes straight to the other.
    await sendThroughOutbox(database, environment, {
      kind: EMAIL_KINDS.introThread,
      to: intro.targetEmail,
      memberId: null,
      dedupeKey: `intro-joining-${intro.id}-target`,
      replyTo: requester.email,
      ...renderJoiningEmail(facts, "targetDirect"),
    });
    // The person has it, so the intro is made: a failed send to the asker stays queued for the timed sender.
    const askerCopy = await queueEmail(database, environment, {
      kind: EMAIL_KINDS.introThread,
      to: requester.email,
      memberId: intro.requesterId,
      dedupeKey: `intro-joining-${intro.id}-requester`,
      replyTo: intro.targetEmail,
      ...renderJoiningEmail(facts, "askerDirect"),
    });
    if (askerCopy) await sendQueuedEmailNow(database, environment, askerCopy);
    return { isConnectorCopied: false };
  }
  await openIntroThread(database, intro.id, intro.targetEmail);
  await sendThroughOutbox(database, environment, {
    kind: EMAIL_KINDS.introThread,
    to: intro.targetEmail,
    memberId: null,
    dedupeKey: `intro-joining-${intro.id}-target`,
    replyTo: introThreadReplyTo(signer, intro.id, { email: intro.targetEmail }),
    ...renderJoiningEmail(facts, "target"),
  });
  await sendThroughOutbox(database, environment, {
    kind: EMAIL_KINDS.introThread,
    to: requester.email,
    memberId: intro.requesterId,
    dedupeKey: `intro-joining-${intro.id}-requester`,
    replyTo: introThreadReplyTo(signer, intro.id, { memberId: intro.requesterId }),
    ...renderJoiningEmail(facts, "asker"),
  });
  if (!introducer) return { isConnectorCopied: false };
  await sendThroughOutbox(database, environment, {
    kind: EMAIL_KINDS.introThread,
    to: introducer.email,
    memberId: intro.introducerId,
    dedupeKey: `intro-joining-${intro.id}-introducer`,
    replyTo: introThreadReplyTo(signer, intro.id, { memberId: intro.introducerId }),
    ...renderJoiningEmail(facts, "connector"),
  });
  return { isConnectorCopied: true };
}
