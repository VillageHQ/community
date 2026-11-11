import { and, eq, gt, notExists } from "drizzle-orm";
import { alias } from "drizzle-orm/pg-core";

import { user } from "../../platform/database/auth-schema.ts";
import type { Database, DatabaseOrTransaction } from "../../platform/database/client.ts";
import { describeAllowanceLeft, readWeeklyAllowanceFor } from "../../platform/allowance/weekly-allowance.ts";
import { introRequest } from "./schema.ts";
import { resolveAppUrl } from "../../platform/http/app-url.ts";
import { readFirstName } from "../../platform/design/avatar-identity.ts";
import { EMAIL_KINDS, type EmailKind } from "../../platform/email/kinds.ts";
import { queueEmail, readEmailBranding, type EmailBranding } from "../../platform/email/outbox.ts";
import { createReplyAddress, REPLY_KINDS, resolveReplySigner } from "../../platform/email/reply-address.ts";
import { sendQueuedEmailNow } from "../../platform/email/outbox-sender.ts";
import type { Environment } from "../../platform/environment.ts";
import { logError } from "../../platform/observability/route-logging.ts";
import { removeBidiControls } from "../../platform/text/safe-text.ts";
import { ROUTES } from "../../platform/http/routes.ts";
import { memberProfile } from "../members/schema.ts";
import { shownCompanyColumn } from "../members/reads-pictures.ts";
import { CONNECTOR_CHOICES, INTRO_LINK_PURPOSES, INTRO_STATES, OUTCOME_CHOICES, REQUESTER_SEES_WHO_ANSWERED } from "./contract.ts";
import {
  CONNECTOR_UPDATES,
  renderAskEnded,
  renderConnectorAsk,
  renderConnectorUpdate,
  renderOutcomeQuestion,
  renderPlainHtml,
  renderThanksToConnector,
  toRoleAndCompany,
  type ConnectorUpdate,
} from "./email-copy.ts";
import { issueAnswerLink, readAnswerLinkUrl } from "./answer-links.ts";

export const ASKED_EMAIL_COOLDOWN_MS = 24 * 60 * 60 * 1000;
const MILLISECONDS_PER_DAY = 86_400_000;

export const INTRO_EMAIL_EVENTS = {
  asked: "asked",
  declined: "declined",
  targetAgreed: "target_agreed",
  targetDeclined: "target_declined",
  joinNeeded: "join_needed",
  joined: "joined",
  outcomeAsked: "outcome_asked",
  outcomeReminder: "outcome_reminder",
  connectorReminder: "connector_reminder",
  expired: "expired",
  // To the connector: the asker withdrew, or the person asked never answered.
  withdrawn: "withdrawn",
  closedUnanswered: "closed_unanswered",
  // To the connector, when the asker said the intro helped.
  thanks: "thanks",
} as const;

export type IntroEmailEvent = (typeof INTRO_EMAIL_EVENTS)[keyof typeof INTRO_EMAIL_EVENTS];

type IntroEmailParticipants = { requesterId: string; introducerId: string };

const RECIPIENT_BY_EVENT: Record<IntroEmailEvent, keyof IntroEmailParticipants> = {
  [INTRO_EMAIL_EVENTS.asked]: "introducerId",
  [INTRO_EMAIL_EVENTS.declined]: "requesterId",
  [INTRO_EMAIL_EVENTS.targetAgreed]: "requesterId",
  [INTRO_EMAIL_EVENTS.targetDeclined]: "introducerId",
  [INTRO_EMAIL_EVENTS.joinNeeded]: "introducerId",
  [INTRO_EMAIL_EVENTS.joined]: "introducerId",
  [INTRO_EMAIL_EVENTS.outcomeAsked]: "requesterId",
  [INTRO_EMAIL_EVENTS.outcomeReminder]: "requesterId",
  [INTRO_EMAIL_EVENTS.connectorReminder]: "introducerId",
  [INTRO_EMAIL_EVENTS.expired]: "requesterId",
  [INTRO_EMAIL_EVENTS.withdrawn]: "introducerId",
  [INTRO_EMAIL_EVENTS.closedUnanswered]: "introducerId",
  [INTRO_EMAIL_EVENTS.thanks]: "introducerId",
};

const KIND_BY_EVENT: Record<IntroEmailEvent, EmailKind> = {
  [INTRO_EMAIL_EVENTS.asked]: EMAIL_KINDS.introAsked,
  [INTRO_EMAIL_EVENTS.declined]: EMAIL_KINDS.introDeclined,
  [INTRO_EMAIL_EVENTS.targetAgreed]: EMAIL_KINDS.introUpdate,
  [INTRO_EMAIL_EVENTS.targetDeclined]: EMAIL_KINDS.introUpdate,
  [INTRO_EMAIL_EVENTS.joinNeeded]: EMAIL_KINDS.introUpdate,
  [INTRO_EMAIL_EVENTS.joined]: EMAIL_KINDS.introUpdate,
  [INTRO_EMAIL_EVENTS.outcomeAsked]: EMAIL_KINDS.introUpdate,
  [INTRO_EMAIL_EVENTS.outcomeReminder]: EMAIL_KINDS.introUpdate,
  [INTRO_EMAIL_EVENTS.connectorReminder]: EMAIL_KINDS.introAsked,
  [INTRO_EMAIL_EVENTS.expired]: EMAIL_KINDS.introDeclined,
  [INTRO_EMAIL_EVENTS.withdrawn]: EMAIL_KINDS.introUpdate,
  [INTRO_EMAIL_EVENTS.closedUnanswered]: EMAIL_KINDS.introUpdate,
  [INTRO_EMAIL_EVENTS.thanks]: EMAIL_KINDS.introUpdate,
};

export type IntroEmailFacts = IntroEmailParticipants & { requesterName: string; introducerName: string; targetName: string; introId: string; event: IntroEmailEvent };

// The connector answers these by replying YES or NO, when replies are on.
const ANSWERABLE_BY_REPLY: readonly IntroEmailEvent[] = [INTRO_EMAIL_EVENTS.asked, INTRO_EMAIL_EVENTS.connectorReminder];

// Everything an intro email says, read inside the move's transaction.
async function readEmailFacts(connection: DatabaseOrTransaction, introId: string) {
  const [row] = await connection
    .select({
      requesterId: introRequest.requesterId,
      introducerId: introRequest.introducerId,
      introducerName: introRequest.introducerName,
      targetName: introRequest.targetName,
      targetHeadline: introRequest.targetHeadline,
      note: introRequest.note,
      state: introRequest.state,
      closedAt: introRequest.closedAt,
      isWithheld: introRequest.isWithheld,
      askedEmailAt: introRequest.askedEmailAt,
      requesterName: user.name,
      requesterTitle: memberProfile.title,
      requesterCompany: shownCompanyColumn(introRequest.requesterId),
    })
    .from(introRequest)
    .innerJoin(user, eq(user.id, introRequest.requesterId))
    .leftJoin(memberProfile, eq(memberProfile.userId, introRequest.requesterId))
    .where(eq(introRequest.id, introId));
  return row ?? null;
}

type EmailFacts = NonNullable<Awaited<ReturnType<typeof readEmailFacts>>>;

export function readRequesterAbout({ requesterTitle, requesterCompany }: Pick<EmailFacts, "requesterTitle" | "requesterCompany">) {
  return removeBidiControls([requesterTitle, requesterCompany].filter(Boolean).join(", ")) || null;
}

type RenderContext = {
  connection: DatabaseOrTransaction;
  environment: Environment;
  community: string;
  introId: string;
  facts: EmailFacts;
  canReply: boolean;
};

type RenderedEmail = { subject: string; text: string; html: string };

// The Community-only notices (no Founderhall email): the person said yes but the community sends no email, so the
// connector joins them by hand.
function renderLegacyNotice(lines: readonly string[], link: string): RenderedEmail {
  const text = [...lines.slice(1), link].join("\n\n");
  return { subject: lines[0] ?? "", text, html: renderPlainHtml(text) };
}

function readAppLink(environment: Environment, path: string) {
  return `${resolveAppUrl(environment)}${path}`;
}

async function renderConnectorAskFor({ connection, environment, community, introId, facts, canReply }: RenderContext, isReminder: boolean) {
  const token = await issueAnswerLink(connection, introId, INTRO_LINK_PURPOSES.connector);
  const link = readAnswerLinkUrl(environment, token);
  return renderConnectorAsk({
    community,
    asker: facts.requesterName,
    askerAbout: readRequesterAbout(facts),
    connector: facts.introducerName,
    target: facts.targetName,
    targetAbout: toRoleAndCompany(facts.targetHeadline),
    note: facts.note,
    links: { yes: `${link}?a=${CONNECTOR_CHOICES.yes}`, notNow: `${link}?a=${CONNECTOR_CHOICES.notNow}`, dontKnow: `${link}?a=${CONNECTOR_CHOICES.dontKnow}` },
    canReply,
    isReminder,
  });
}

async function renderOutcomeFor({ connection, environment, community, introId, facts }: RenderContext, isReminder: boolean) {
  const token = await issueAnswerLink(connection, introId, INTRO_LINK_PURPOSES.outcome);
  const link = readAnswerLinkUrl(environment, token);
  const introducedAt = facts.closedAt ?? new Date();
  return renderOutcomeQuestion({
    community,
    asker: facts.requesterName,
    target: facts.targetName,
    connector: facts.introducerName,
    links: { helpful: `${link}?a=${OUTCOME_CHOICES.helpful}`, notReally: `${link}?a=${OUTCOME_CHOICES.notReally}`, tooEarly: `${link}?a=${OUTCOME_CHOICES.tooEarly}` },
    daysAgo: Math.round((Date.now() - introducedAt.getTime()) / MILLISECONDS_PER_DAY),
    isReminder,
  });
}

// Who the asker hears said no: Founderhall names them; with Community's rule nobody is named.
function readWhoDeclined(facts: EmailFacts) {
  if (!REQUESTER_SEES_WHO_ANSWERED) return "They";
  return readFirstName(facts.state === INTRO_STATES.targetDeclined ? facts.targetName : facts.introducerName);
}

async function renderAskEndedFor({ connection, environment, community, facts }: RenderContext, isExpired: boolean) {
  const allowance = await readWeeklyAllowanceFor(connection, facts.requesterId);
  return renderAskEnded({
    community,
    asker: facts.requesterName,
    who: readWhoDeclined(facts),
    target: facts.targetName,
    allowanceLeft: allowance ? describeAllowanceLeft(allowance) : null,
    findLink: readAppLink(environment, ROUTES.members),
    isExpired,
  });
}

function renderUpdateFor({ community, facts }: RenderContext, kind: ConnectorUpdate) {
  return renderConnectorUpdate({ community, connector: facts.introducerName, asker: facts.requesterName, target: facts.targetName, kind });
}

const RENDERERS: Record<IntroEmailEvent, (context: RenderContext) => RenderedEmail | Promise<RenderedEmail>> = {
  [INTRO_EMAIL_EVENTS.asked]: (context) => renderConnectorAskFor(context, false),
  [INTRO_EMAIL_EVENTS.connectorReminder]: (context) => renderConnectorAskFor(context, true),
  [INTRO_EMAIL_EVENTS.declined]: (context) => renderAskEndedFor(context, false),
  [INTRO_EMAIL_EVENTS.expired]: (context) => renderAskEndedFor(context, true),
  [INTRO_EMAIL_EVENTS.targetDeclined]: (context) => renderUpdateFor(context, CONNECTOR_UPDATES.declined),
  [INTRO_EMAIL_EVENTS.withdrawn]: (context) => renderUpdateFor(context, CONNECTOR_UPDATES.withdrawn),
  [INTRO_EMAIL_EVENTS.closedUnanswered]: (context) => renderUpdateFor(context, CONNECTOR_UPDATES.expired),
  [INTRO_EMAIL_EVENTS.outcomeAsked]: (context) => renderOutcomeFor(context, false),
  [INTRO_EMAIL_EVENTS.outcomeReminder]: (context) => renderOutcomeFor(context, true),
  [INTRO_EMAIL_EVENTS.thanks]: ({ community, facts }) =>
    renderThanksToConnector({ community, connector: facts.introducerName, asker: facts.requesterName, target: facts.targetName }),
  [INTRO_EMAIL_EVENTS.targetAgreed]: ({ environment, introId, facts }) =>
    renderLegacyNotice(
      [`${readFirstName(facts.targetName)} said yes to your intro`, `${facts.targetName} said yes. ${readFirstName(facts.introducerName)} will connect you both with one message.`],
      readAppLink(environment, `${ROUTES.intros}/${introId}`),
    ),
  [INTRO_EMAIL_EVENTS.joinNeeded]: ({ environment, introId, facts }) =>
    renderLegacyNotice(
      [`${readFirstName(facts.targetName)} said yes`, `${facts.targetName} said yes to meeting ${facts.requesterName}. Send the message that joins them, then mark it as introduced.`],
      readAppLink(environment, `${ROUTES.intros}/${introId}`),
    ),
  [INTRO_EMAIL_EVENTS.joined]: ({ environment, introId, facts }) =>
    renderLegacyNotice(
      [`${readFirstName(facts.targetName)} said yes, and they're connected`, `${facts.targetName} said yes to meeting ${facts.requesterName}, so we emailed them both. Nothing more to do. Thank you.`],
      readAppLink(environment, `${ROUTES.intros}/${introId}`),
    ),
};

const recentAsk = alias(introRequest, "recent_ask");

async function claimAskedEmail(database: DatabaseOrTransaction, introId: string, { requesterId, introducerId }: IntroEmailParticipants) {
  const now = new Date();
  const recentlyEmailed = database
    .select({ id: recentAsk.id })
    .from(recentAsk)
    .where(
      and(
        eq(recentAsk.requesterId, requesterId),
        eq(recentAsk.introducerId, introducerId),
        gt(recentAsk.askedEmailAt, new Date(now.getTime() - ASKED_EMAIL_COOLDOWN_MS)),
      ),
    );
  const claimed = await database
    .update(introRequest)
    .set({ askedEmailAt: now })
    .where(and(eq(introRequest.id, introId), notExists(recentlyEmailed)))
    .returning({ id: introRequest.id });
  return claimed.length > 0;
}

// Call inside the transaction that makes the move. The cooldown stamp and the queued email are
// saved together, so an ask is never marked emailed without an email on its way. One email per
// intro and event: a repeat finds the row already queued.
export async function queueIntroEmail(
  transaction: DatabaseOrTransaction,
  environment: Environment,
  branding: EmailBranding | null,
  introId: string,
  event: IntroEmailEvent,
) {
  if (!branding) return null;

  const facts = await readEmailFacts(transaction, introId);
  if (!facts) return null;
  if (event === INTRO_EMAIL_EVENTS.asked && !(await claimAskedEmail(transaction, introId, facts))) return null;

  const recipientKey = RECIPIENT_BY_EVENT[event];
  // A withheld ask never reached the connector, so nothing about it does either.
  if (recipientKey === "introducerId" && facts.isWithheld) return null;
  // "Sam withdrew the ask" only to a connector who got the ask by email (the cooldown may have held it back).
  if (event === INTRO_EMAIL_EVENTS.withdrawn && !facts.askedEmailAt) return null;
  const recipientId = facts[recipientKey];
  const [recipient] = await transaction.select({ email: user.email }).from(user).where(eq(user.id, recipientId));
  if (!recipient) return null;

  const signer = ANSWERABLE_BY_REPLY.includes(event) ? await resolveReplySigner(transaction, environment) : null;
  const replyTo = signer ? createReplyAddress(signer, REPLY_KINDS.introAsk, introId, { memberId: recipientId }) : null;
  const rendered = await RENDERERS[event]({
    connection: transaction,
    environment,
    community: branding.name,
    introId,
    facts: { ...facts, requesterName: removeBidiControls(facts.requesterName) },
    canReply: replyTo !== null,
  });
  return queueEmail(transaction, environment, {
    kind: KIND_BY_EVENT[event],
    to: recipient.email,
    memberId: recipientId,
    dedupeKey: `intro-${event}-${introId}`,
    replyTo,
    ...rendered,
  });
}

// For moves that happen outside a member's request (a target's answer, the outcome emails).
// Resolves true once the email has gone out. A failed try stays queued, and the timed sender
// keeps trying it. Failures are logged, never thrown.
export async function deliverIntroEmail(database: Database, environment: Environment, facts: Pick<IntroEmailFacts, "introId" | "event"> & Partial<IntroEmailFacts>) {
  try {
    const branding = await readEmailBranding(database, environment);
    if (!branding) return false;
    const queuedId = await database.transaction((transaction) => queueIntroEmail(transaction, environment, branding, facts.introId, facts.event));
    return await sendQueuedEmailNow(database, environment, queuedId);
  } catch (error) {
    logError("intro-email", error);
    return false;
  }
}
