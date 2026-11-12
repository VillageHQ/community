import "server-only";

import { and, eq } from "drizzle-orm";

import { user } from "../../platform/database/auth-schema.ts";
import { readResendConfig } from "../../platform/email/resend.ts";
import { isReplyByEmailOn } from "../../platform/email/reply-address.ts";
import { removeBidiControls } from "../../platform/text/safe-text.ts";
import { readAnswerLink } from "./answer-links.ts";
import { INTRO_LINK_PURPOSES, INTRO_STATES } from "./contract.ts";
import { readWhyTheyWrote } from "./copy.ts";
import { readIntroForViewer } from "./reads.ts";
import { CONSENT_VIEWS, isLiveBetweenMembers, readConsentView, readLinkedIntro, readLiveConsentHash } from "./reads-consent.ts";
import { introRequest } from "./schema.ts";

// What `/i/<token>` shows: the connector's question, the person's question, or the outcome question, each from its
// own link; or "Nothing to do" once its step is over.
export const LINK_VIEWS = {
  connector: "connector",
  target: "target",
  outcome: "outcome",
  closed: "closed",
  tooManyTries: "too_many_tries",
  notForYou: "not_for_you",
} as const;

export const CLOSED_REASONS = { answered: "answered", withdrawn: "withdrawn", expired: "expired", unknown: "unknown" } as const;

type ClosedReason = (typeof CLOSED_REASONS)[keyof typeof CLOSED_REASONS];

type LinkViewContext = Parameters<typeof readConsentView>[0];

function closed(reason: ClosedReason, askerName = "") {
  return { view: LINK_VIEWS.closed, reason, askerName } as const;
}

function readClosedReason(state: string): ClosedReason {
  if (state === INTRO_STATES.withdrawn) return CLOSED_REASONS.withdrawn;
  if (state === INTRO_STATES.expired) return CLOSED_REASONS.expired;
  return CLOSED_REASONS.answered;
}

async function readConnectorView(context: LinkViewContext, introId: string) {
  const { database, environment } = context;
  const [row] = await database
    .select({ intro: introRequest, askerName: user.name })
    .from(introRequest)
    .innerJoin(user, eq(user.id, introRequest.requesterId))
    .where(eq(introRequest.id, introId));
  if (!row) return closed(CLOSED_REASONS.answered);
  const askerName = removeBidiControls(row.askerName);
  const [live] = await database
    .select({ id: introRequest.id })
    .from(introRequest)
    .where(and(eq(introRequest.id, introId), isLiveBetweenMembers(database, new Date())));
  if (row.intro.state !== INTRO_STATES.requested || !live) return closed(readClosedReason(row.intro.state), askerName);
  return {
    view: LINK_VIEWS.connector,
    askerName,
    connectorName: row.intro.introducerName,
    targetName: row.intro.targetName,
    note: row.intro.note,
    suggestedEmail: row.intro.suggestedTargetEmail,
    canEmail: readResendConfig(environment) !== null,
    copiesConnector: isReplyByEmailOn(environment),
  } as const;
}

async function readOutcomeView(context: LinkViewContext, introId: string) {
  const { database } = context;
  const [row] = await database.select({ requesterId: introRequest.requesterId }).from(introRequest).where(eq(introRequest.id, introId));
  if (!row) return closed(CLOSED_REASONS.answered);
  const intro = await readIntroForViewer(database, row.requesterId, introId);
  if (!intro || intro.state !== INTRO_STATES.completed || !intro.isOutcomeDue) return closed(CLOSED_REASONS.answered);
  return {
    view: LINK_VIEWS.outcome,
    connectorName: intro.introducer.name,
    targetName: intro.target.name,
    introducedAt: intro.closedAt,
  } as const;
}

export async function readIntroLinkView(context: LinkViewContext, token: string) {
  const link = await readAnswerLink(context.database, token);
  if (link?.purpose === INTRO_LINK_PURPOSES.connector) return readConnectorView(context, link.introId);
  if (link?.purpose === INTRO_LINK_PURPOSES.outcome) return readOutcomeView(context, link.introId);

  const consent = await readConsentView(context, token);
  if (consent.view === CONSENT_VIEWS.tooManyTries) return { view: LINK_VIEWS.tooManyTries } as const;
  if (consent.view === CONSENT_VIEWS.notForYou) return { view: LINK_VIEWS.notForYou, targetName: consent.targetName } as const;
  if (consent.view === CONSENT_VIEWS.open) {
    return {
      view: LINK_VIEWS.target,
      askerName: consent.requesterName,
      connectorName: consent.introducerName,
      targetName: consent.targetName,
      note: readWhyTheyWrote(consent.note, consent.introducerName, consent.targetName),
      joinsByEmail: consent.joinsByEmail,
      asksForEmail: consent.asksForEmail,
      copiesConnector: consent.copiesConnector,
    } as const;
  }
  // Closed or answered: say why, from the intro the link belongs to.
  const tokenHash = readLiveConsentHash(token);
  const linked = tokenHash ? await readLinkedIntro(context.database, tokenHash) : null;
  return closed(linked ? readClosedReason(linked.state) : CLOSED_REASONS.unknown);
}

export type IntroLinkView = Awaited<ReturnType<typeof readIntroLinkView>>;
