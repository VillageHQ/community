import { z } from "zod";

import { CONNECTOR_ERROR_CODES, CONNECTOR_LIMITS } from "../network/contract.ts";
import { feedTextSchema } from "../../platform/text/text-schema.ts";
import { removeBidiControls, removeNullBytes } from "../../platform/text/safe-text.ts";

export const INTRO_LIFETIME_DAYS = 14;
export const TARGET_ANSWER_MINIMUM_DAYS = 7;
export const OUTCOME_PROMPT_AFTER_DAYS = 14;
export const OUTCOME_REMINDER_AFTER_DAYS = 3;
// The one reminder to the person asked, this many days after the app last emailed them.
export const TARGET_REMINDER_AFTER_DAYS = 4;
export const OUTCOME_PROMPT_WINDOW_DAYS = 45;
export const CONSENT_TOKEN_MAXIMUM_LENGTH = 128;

export const INTRO_LIMITS = {
  noteLength: 1000,
  declineReasonLength: 500,
  nameLength: CONNECTOR_LIMITS.nameLength,
  headlineLength: CONNECTOR_LIMITS.headlineLength,
  reasonLength: CONNECTOR_LIMITS.reasonLength,
  slugLength: 200,
  emailLength: 254,
  shownPerList: 100,
  shownInRail: 2,
} as const;

export const INTRO_STATES = {
  requested: "requested",
  accepted: "accepted",
  declined: "declined",
  withdrawn: "withdrawn",
  completed: "completed",
  expired: "expired",
  askingTarget: "asking_target",
  targetAgreed: "target_agreed",
  targetDeclined: "target_declined",
} as const;

export type IntroState = (typeof INTRO_STATES)[keyof typeof INTRO_STATES];

const introStateSchema = z.enum(INTRO_STATES);

export const INTRO_TRANSITIONS: Record<IntroState, readonly IntroState[]> = {
  [INTRO_STATES.requested]: [INTRO_STATES.askingTarget, INTRO_STATES.declined, INTRO_STATES.withdrawn, INTRO_STATES.expired],
  [INTRO_STATES.accepted]: [INTRO_STATES.completed, INTRO_STATES.expired],
  [INTRO_STATES.askingTarget]: [INTRO_STATES.targetAgreed, INTRO_STATES.targetDeclined, INTRO_STATES.declined, INTRO_STATES.withdrawn, INTRO_STATES.expired],
  [INTRO_STATES.targetAgreed]: [INTRO_STATES.completed, INTRO_STATES.expired],
  [INTRO_STATES.declined]: [],
  [INTRO_STATES.withdrawn]: [],
  [INTRO_STATES.completed]: [],
  [INTRO_STATES.expired]: [],
  [INTRO_STATES.targetDeclined]: [],
};

const ALL_INTRO_STATES = Object.values(INTRO_STATES);

export function readStatesLeadingTo(nextState: IntroState) {
  return ALL_INTRO_STATES.filter((state) => INTRO_TRANSITIONS[state].includes(nextState));
}

export const OPEN_INTRO_STATES = ALL_INTRO_STATES.filter((state) => INTRO_TRANSITIONS[state].length > 0);

export const STATES_WAITING_ON_INTRODUCER = [INTRO_STATES.requested, INTRO_STATES.accepted, INTRO_STATES.targetAgreed];

export type RequesterIntroState = Exclude<IntroState, typeof INTRO_STATES.askingTarget | typeof INTRO_STATES.targetDeclined>;

export const REQUESTER_STATES: Record<IntroState, RequesterIntroState> = {
  [INTRO_STATES.requested]: INTRO_STATES.requested,
  [INTRO_STATES.accepted]: INTRO_STATES.accepted,
  [INTRO_STATES.declined]: INTRO_STATES.declined,
  [INTRO_STATES.withdrawn]: INTRO_STATES.withdrawn,
  [INTRO_STATES.completed]: INTRO_STATES.completed,
  [INTRO_STATES.expired]: INTRO_STATES.expired,
  [INTRO_STATES.askingTarget]: INTRO_STATES.requested,
  [INTRO_STATES.targetAgreed]: INTRO_STATES.targetAgreed,
  [INTRO_STATES.targetDeclined]: INTRO_STATES.declined,
};

export function readRequesterState(state: string) {
  return REQUESTER_STATES[introStateSchema.parse(state)];
}

export const INTRO_ROLES = { requester: "requester", introducer: "introducer" } as const;

export type IntroRole = (typeof INTRO_ROLES)[keyof typeof INTRO_ROLES];

export const INTRO_ACTIONS = { accept: "accept", decline: "decline", withdraw: "withdraw", complete: "complete" } as const;

export type IntroAction = (typeof INTRO_ACTIONS)[keyof typeof INTRO_ACTIONS];

export const INTRO_ACTION_RULES: Record<IntroAction, { nextState: IntroState; actor: IntroRole }> = {
  [INTRO_ACTIONS.accept]: { nextState: INTRO_STATES.askingTarget, actor: INTRO_ROLES.introducer },
  [INTRO_ACTIONS.decline]: { nextState: INTRO_STATES.declined, actor: INTRO_ROLES.introducer },
  [INTRO_ACTIONS.withdraw]: { nextState: INTRO_STATES.withdrawn, actor: INTRO_ROLES.requester },
  [INTRO_ACTIONS.complete]: { nextState: INTRO_STATES.completed, actor: INTRO_ROLES.introducer },
};

export const INTRO_DECLINE_KINDS = { notThisTime: "not_this_time", doNotKnowThem: "do_not_know_them" } as const;

export type IntroDeclineKind = (typeof INTRO_DECLINE_KINDS)[keyof typeof INTRO_DECLINE_KINDS];

export const INTRO_OUTCOMES = { helped: "helped", notYet: "not_yet", notHelped: "not_helped" } as const;

export type IntroOutcome = (typeof INTRO_OUTCOMES)[keyof typeof INTRO_OUTCOMES];

// What came of an intro that helped, ticked by the requester with their answer. Admins only ever see totals.
export const INTRO_RESULTS = { customer: "customer", hire: "hire", investor: "investor" } as const;

export type IntroResult = (typeof INTRO_RESULTS)[keyof typeof INTRO_RESULTS];

export const CONSENT_ANSWERS = { yes: "yes", noThanks: "no_thanks", stopAllAsks: "stop_all_asks" } as const;

export type ConsentAnswer = (typeof CONSENT_ANSWERS)[keyof typeof CONSENT_ANSWERS];

export const INTRO_ERROR_CODES = {
  notFound: "intro_not_found",
  changed: "intro_changed",
  duplicate: "intro_duplicate",
  notConnector: "intro_not_connector",
  pathsStale: "intro_paths_stale",
  targetUnknown: "intro_target_unknown",
  ownTarget: CONNECTOR_ERROR_CODES.ownTarget,
  blockedByYou: "intro_blocked_by_you",
  tooFast: "intro_too_fast",
  consentLinkClosed: "intro_consent_link_closed",
  consentLinkNotForYou: "intro_consent_link_not_for_you",
  consentTooManyTries: "intro_consent_too_many_tries",
  targetEmailRefused: "intro_target_email_refused",
  targetEmailFailed: "intro_target_email_failed",
  connectorBusy: "intro_connector_busy",
  notJoined: "intro_not_joined",
  targetRefuses: "intro_target_refuses",
} as const;

const slugSchema = z.string().trim().toLowerCase().min(1).max(INTRO_LIMITS.slugLength);

export const introNoteSchema = feedTextSchema("your note", INTRO_LIMITS.noteLength);

export const declineReasonSchema = z
  .string()
  .overwrite(removeNullBytes)
  .overwrite(removeBidiControls)
  .trim()
  .max(INTRO_LIMITS.declineReasonLength, `Keep your reason under ${INTRO_LIMITS.declineReasonLength} characters.`)
  .transform((reason) => reason || null);

export const createIntroBodySchema = z.object({
  targetSlug: slugSchema,
  connectorSlug: slugSchema,
  note: introNoteSchema,
});

export const introIdBodySchema = z.object({ introId: z.uuid() });

export const introTransitionBodySchema = z.discriminatedUnion("action", [
  z.object({ introId: z.uuid(), action: z.literal(INTRO_ACTIONS.accept) }),
  z.object({ introId: z.uuid(), action: z.literal(INTRO_ACTIONS.withdraw) }),
  z.object({ introId: z.uuid(), action: z.literal(INTRO_ACTIONS.complete) }),
  z.object({
    introId: z.uuid(),
    action: z.literal(INTRO_ACTIONS.decline),
    reason: declineReasonSchema.default(null),
    kind: z.enum(INTRO_DECLINE_KINDS).default(INTRO_DECLINE_KINDS.notThisTime),
  }),
]);

export const introOutcomeBodySchema = z
  .object({
    introId: z.uuid(),
    outcome: z.enum(INTRO_OUTCOMES),
    results: z.array(z.enum(INTRO_RESULTS)).max(Object.keys(INTRO_RESULTS).length).default([]),
  })
  .transform(({ results, ...body }) => ({ ...body, results: body.outcome === INTRO_OUTCOMES.helped ? [...new Set(results)] : [] }));

export const consentAnswerBodySchema = z.object({
  token: z.string().max(CONSENT_TOKEN_MAXIMUM_LENGTH),
  answer: z.enum(CONSENT_ANSWERS),
});

export const consentEmailBodySchema = z.object({
  introId: z.uuid(),
  token: z.string().max(CONSENT_TOKEN_MAXIMUM_LENGTH),
  targetEmail: z.email("Enter an email address, like clara@example.com.").trim().toLowerCase().max(INTRO_LIMITS.emailLength),
});

export const markIntrosSeenBodySchema = z.object({ introId: z.uuid().nullable().default(null) });

const timestampSchema = z.iso.datetime();

const introPersonSchema = z.object({
  id: z.string(),
  name: z.string(),
  headline: z.string().nullable(),
  linkedinSlug: z.string().nullable(),
  avatarUrl: z.string().nullable(),
  isAvailable: z.boolean(),
});

export const introSchema = z.object({
  id: z.uuid(),
  state: z.enum(INTRO_STATES),
  viewerRole: z.enum(INTRO_ROLES),
  note: z.string(),
  reason: z.string(),
  declineReason: z.string().nullable(),
  declineKind: z.enum(INTRO_DECLINE_KINDS).nullable(),
  hasUpdate: z.boolean(),
  createdAt: timestampSchema,
  acceptedAt: timestampSchema.nullable(),
  askedTargetAt: timestampSchema.nullable(),
  targetAgreedAt: timestampSchema.nullable(),
  outcome: z.enum(INTRO_OUTCOMES).nullable(),
  isOutcomeDue: z.boolean(),
  closedAt: timestampSchema.nullable(),
  expiresAt: timestampSchema,
  target: z.object({ name: z.string(), headline: z.string().nullable(), linkedinSlug: z.string() }),
  requester: introPersonSchema,
  introducer: introPersonSchema,
});

export const consentIssueSchema = z.object({ link: z.url(), token: z.string(), canEmailTarget: z.boolean() });

export const introWithConsentIssueSchema = introSchema.extend({ consentIssue: consentIssueSchema.nullable() });

export const consentAnswerResponseSchema = z.object({ answer: z.enum(CONSENT_ANSWERS), isRepeat: z.boolean() });

export const introCountsSchema = z.object({ waitingOnYou: z.number().int(), updates: z.number().int(), outcomesDue: z.number().int() });

export const introBoardSchema = z.object({
  asksForYou: z.array(introSchema),
  yourAsks: z.array(introSchema),
  counts: introCountsSchema,
});

export type Intro = z.infer<typeof introSchema>;
export type IntroBoard = z.infer<typeof introBoardSchema>;
export type IntroCounts = z.infer<typeof introCountsSchema>;
export type IntroPerson = z.infer<typeof introPersonSchema>;
export type CreateIntroBody = z.infer<typeof createIntroBodySchema>;
export type IntroTransitionBody = z.infer<typeof introTransitionBodySchema>;
export type IntroOutcomeBody = z.infer<typeof introOutcomeBodySchema>;
export type IntroOutcomeRequest = z.input<typeof introOutcomeBodySchema>;
export type ConsentAnswerBody = z.infer<typeof consentAnswerBodySchema>;
export type ConsentEmailBody = z.infer<typeof consentEmailBodySchema>;
export type ConsentIssue = z.infer<typeof consentIssueSchema>;

export function isOpenIntroState(state: IntroState) {
  return INTRO_TRANSITIONS[state].length > 0;
}
