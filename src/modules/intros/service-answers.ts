import "server-only";

import { and, eq, inArray } from "drizzle-orm";
import { z } from "zod";

import { user } from "../../platform/database/auth-schema.ts";
import type { Database } from "../../platform/database/client.ts";
import { readFirstName } from "../../platform/design/avatar-identity.ts";
import { readResendConfig } from "../../platform/email/resend.ts";
import type { Environment } from "../../platform/environment.ts";
import { createRequestContext, type RequestContext } from "../../platform/http/request-context.ts";
import { RequestError } from "../../platform/http/request-error.ts";
import { readAnswerLink } from "./answer-links.ts";
import {
  CONNECTOR_CHOICES,
  INTRO_ACTIONS,
  INTRO_DECLINE_KINDS,
  INTRO_ERROR_CODES,
  INTRO_LINK_PURPOSES,
  INTRO_ROLES,
  INTRO_STATES,
  OUTCOME_BY_CHOICE,
  introNoteSchema,
  type ConnectorAnswerBody,
  type LinkAnswerBody,
} from "./contract.ts";
import { recordFailedConsentAttempt } from "./limits.ts";
import { readIntroForViewer } from "./reads.ts";
import { introRequest } from "./schema.ts";
import { emailConsentLink, introGoneError, recordIntroOutcome, transitionIntro } from "./service.ts";

const GONE_STATUS = 410;
const TOO_MANY_REQUESTS_STATUS = 429;
const UNPROCESSABLE_STATUS = 422;

const targetEmailSchema = z.email();

function normaliseNote(note: string | null) {
  return note === null ? null : note.replace(/\r\n/g, "\n").trim();
}

function fieldError(code: string, message: string) {
  return new RequestError(UNPROCESSABLE_STATUS, code, message);
}

// The address the connector gives must be the person's: not empty while the community sends email, a real address,
// and not the asker's or the connector's own.
async function readCheckedTargetEmail(database: Database, environment: Environment, introId: string, viewerId: string, typed: string | null) {
  const intro = await readIntroForViewer(database, viewerId, introId);
  if (!intro || intro.viewerRole !== INTRO_ROLES.introducer) throw introGoneError();
  const canEmail = readResendConfig(environment) !== null;
  const address = typed ?? intro.suggestedTargetEmail;
  if (!canEmail || intro.state !== INTRO_STATES.requested) return { intro, address: canEmail ? address : null };
  const targetFirst = readFirstName(intro.target.name);
  if (!address) throw fieldError(INTRO_ERROR_CODES.targetEmailMissing, `Add ${targetFirst}’s email, so we can ask them.`);
  if (!targetEmailSchema.safeParse(address).success) throw fieldError(INTRO_ERROR_CODES.targetEmailMissing, "Enter an email address, like name@company.example.");
  const [own] = await database
    .select({ id: user.id })
    .from(user)
    .where(and(inArray(user.id, [intro.requester.id, intro.introducer.id]), eq(user.email, address)));
  if (own) throw fieldError(INTRO_ERROR_CODES.targetEmailRefused, "That is not the target’s address.");
  return { intro, address };
}

// The connector answers in one step, as on Founderhall: yes (with the person's email, and the note as they edited
// it), not this time, or "I don't know them well enough". A yes asks the person by email at once; with no email in
// this community, the connector gets the link to send themselves (Community's way).
export async function answerAsConnector(context: RequestContext, { introId, choice, targetEmail, note, reason }: ConnectorAnswerBody) {
  if (choice !== CONNECTOR_CHOICES.yes) {
    const kind = choice === CONNECTOR_CHOICES.notNow ? INTRO_DECLINE_KINDS.notThisTime : INTRO_DECLINE_KINDS.doNotKnowThem;
    return transitionIntro(context, { introId, action: INTRO_ACTIONS.decline, reason, kind });
  }
  const { database, environment, member } = context;
  const { intro, address } = await readCheckedTargetEmail(database, environment, introId, member.id, targetEmail);

  const edited = normaliseNote(note);
  if (edited && edited !== intro.note.trim() && intro.state === INTRO_STATES.requested) {
    const parsed = introNoteSchema.safeParse(edited);
    if (!parsed.success) throw fieldError(INTRO_ERROR_CODES.noteInvalid, parsed.error.issues[0]?.message ?? "Check the note.");
    await database
      .update(introRequest)
      .set({ note: parsed.data })
      .where(and(eq(introRequest.id, introId), eq(introRequest.introducerId, member.id), eq(introRequest.state, INTRO_STATES.requested)));
  }

  const accepted = await transitionIntro(context, { introId, action: INTRO_ACTIONS.accept });
  if (address && accepted.consentIssue) {
    await emailConsentLink(context, { introId, token: accepted.consentIssue.token, targetEmail: address });
  }
  return accepted;
}

type LinkContext = { database: Database; environment: Environment; request: Request };

function closedLinkError() {
  return new RequestError(GONE_STATUS, INTRO_ERROR_CODES.consentLinkClosed, "This ask was already answered. Thank you.");
}

async function readLinkMember(database: Database, memberId: string) {
  const [member] = await database.select({ id: user.id, email: user.email, role: user.role }).from(user).where(eq(user.id, memberId));
  if (!member) throw closedLinkError();
  return member;
}

export const LINK_RESULTS = { askedTarget: "asked_target", declined: "declined", noted: "noted" } as const;

export type LinkResult = (typeof LINK_RESULTS)[keyof typeof LINK_RESULTS];

// A link from an email answers for the member it was sent to, without signing in. A token nobody issued counts toward
// the failed-try limit, like the person's consent link.
export async function answerByLink({ database, environment, request }: LinkContext, body: LinkAnswerBody): Promise<{ result: LinkResult }> {
  const link = await readAnswerLink(database, body.token);
  if (!link || link.purpose !== body.purpose) {
    const { isLimited } = await recordFailedConsentAttempt(database, request, environment);
    if (isLimited) throw new RequestError(TOO_MANY_REQUESTS_STATUS, INTRO_ERROR_CODES.consentTooManyTries, "Too many tries with this link. Wait a minute and try again.");
    throw closedLinkError();
  }
  const [intro] = await database
    .select({ requesterId: introRequest.requesterId, introducerId: introRequest.introducerId, state: introRequest.state })
    .from(introRequest)
    .where(eq(introRequest.id, link.introId));
  if (!intro) throw closedLinkError();

  if (body.purpose === INTRO_LINK_PURPOSES.connector) {
    if (intro.state !== INTRO_STATES.requested) throw closedLinkError();
    const context = createRequestContext(database, environment, await readLinkMember(database, intro.introducerId));
    const answered = await answerAsConnector(context, { introId: link.introId, choice: body.choice, targetEmail: body.targetEmail, note: body.note, reason: body.reason });
    return { result: answered.state === INTRO_STATES.declined ? LINK_RESULTS.declined : LINK_RESULTS.askedTarget };
  }

  const context = createRequestContext(database, environment, await readLinkMember(database, intro.requesterId));
  try {
    await recordIntroOutcome(context, { introId: link.introId, outcome: OUTCOME_BY_CHOICE[body.outcome], results: body.outcome === "helpful" ? body.results : [] });
  } catch (error) {
    if (error instanceof RequestError && error.code === INTRO_ERROR_CODES.changed) throw closedLinkError();
    throw error;
  }
  return { result: LINK_RESULTS.noted };
}
