import { z } from "zod";

import { readLinkedinSlug } from "../members/contract-linkedin.ts";
import { CONNECTOR_ERROR_CODES, CONNECTOR_LIMITS } from "../../platform/village/contract.ts";
import { feedTextSchema } from "../../platform/text/text-schema.ts";
import { removeBidiControls, removeNullBytes } from "../../platform/text/safe-text.ts";

// Each step (the connector, then the person asked) has 7 days, as on Founderhall.
export const INTRO_LIFETIME_DAYS = 7;
export const TARGET_ANSWER_MINIMUM_DAYS = 7;
export const OUTCOME_PROMPT_AFTER_DAYS = 14;
// Founderhall: the outcome question 14 days after the intro, one reminder 14 days after that.
export const OUTCOME_REMINDER_AFTER_DAYS = 14;
// The one reminder to the person asked, this many days after the app last emailed them.
export const TARGET_REMINDER_AFTER_DAYS = 4;
// The one reminder to a connector who hasn't answered, this many days after the ask.
export const CONNECTOR_REMINDER_AFTER_DAYS = 4;
// The asker's "closed without an answer" email goes only for asks that expired within this many days, so turning the
// email on never mails people about old asks.
export const EXPIRY_EMAIL_WINDOW_DAYS = 2;
export const OUTCOME_PROMPT_WINDOW_DAYS = 45;
export const CONSENT_TOKEN_MAXIMUM_LENGTH = 128;

// PENDING THE OWNER'S DECISION. Founderhall shows the asker who said no ("Marcus said yes and asked Rosa", "Rosa can't
// take this one"); Community never lets the asker tell the connector's no from the person's no. false keeps
// Community's rule: the asker sees the connector's step until the end, and every no reads as the connector's.
export const REQUESTER_SEES_WHO_ANSWERED = false;

// The connector's three answers, as Founderhall words them and as its email links carry them (`?a=yes`).
export const CONNECTOR_CHOICES = { yes: "yes", notNow: "not_now", dontKnow: "dont_know" } as const;

export type ConnectorChoice = (typeof CONNECTOR_CHOICES)[keyof typeof CONNECTOR_CHOICES];

// The person asked: yes or no thanks (`?a=yes`, `?a=no`).
export const TARGET_CHOICES = { yes: "yes", no: "no" } as const;

export type TargetChoice = (typeof TARGET_CHOICES)[keyof typeof TARGET_CHOICES];

// The asker's answer to "Was it helpful?" (`?a=helpful`).
export const OUTCOME_CHOICES = { helpful: "helpful", notReally: "not_really", tooEarly: "too_early" } as const;

export type OutcomeChoice = (typeof OUTCOME_CHOICES)[keyof typeof OUTCOME_CHOICES];

// A link that answers without signing in: the connector's (from the ask email) or the asker's outcome link.
export const INTRO_LINK_PURPOSES = { connector: "connector", outcome: "outcome" } as const;

export type IntroLinkPurpose = (typeof INTRO_LINK_PURPOSES)[keyof typeof INTRO_LINK_PURPOSES];

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
  threadMessageLength: 4000,
  // Replies between the asker and the person asked are passed on for this long after the introduction.
  threadDays: 90,
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

export const OUTCOME_BY_CHOICE: Record<OutcomeChoice, IntroOutcome> = {
  [OUTCOME_CHOICES.helpful]: INTRO_OUTCOMES.helped,
  [OUTCOME_CHOICES.notReally]: INTRO_OUTCOMES.notHelped,
  [OUTCOME_CHOICES.tooEarly]: INTRO_OUTCOMES.notYet,
};

// What came of an intro that helped, ticked by the requester with their answer. The partner report shows only totals.
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
  notIntroducer: "intro_not_introducer",
  targetRefuses: "intro_target_refuses",
  notTakingAsks: "intro_not_taking_asks",
  networkOff: "intro_network_off",
  targetEmailMissing: "intro_target_email_missing",
  noteInvalid: "intro_note_invalid",
} as const;

const slugSchema = z.string().trim().toLowerCase().min(1).max(INTRO_LIMITS.slugLength);

export const introNoteSchema = feedTextSchema("your note", INTRO_LIMITS.noteLength);

// An empty note may come as "", as null (what the browser sends) or not at all. All mean no note.
const declineReasonTextSchema = z
  .string()
  .overwrite(removeNullBytes)
  .overwrite(removeBidiControls)
  .trim()
  .max(INTRO_LIMITS.declineReasonLength, `Keep your reason under ${INTRO_LIMITS.declineReasonLength} characters.`)
  .transform((reason) => reason || null);

export const declineReasonSchema = z.union([z.null(), declineReasonTextSchema]);

// An ask through a Village path: the server reads the person and the connector from the member's own cached paths.
export const pathIntroBodySchema = z.object({
  targetSlug: slugSchema,
  connectorSlug: slugSchema,
  note: introNoteSchema,
});

const LINKEDIN_PROFILE_PREFIX = "https://www.linkedin.com/in/";
const LINKEDIN_INPUT_LENGTH = 300;
// A LinkedIn profile name: letters, digits, hyphens and underscores. Anything else is junk or a spoof.
const PROFILE_NAME_PATTERN = /^[\p{L}\p{N}_-]{2,100}$/u;
const REPEATED_WHITESPACE = /\s+/g;

function personTextSchema(label: string, maximumLength: number) {
  return z
    .string()
    .overwrite(removeNullBytes)
    .overwrite(removeBidiControls)
    .trim()
    .overwrite((value) => value.replace(REPEATED_WHITESPACE, " "))
    .min(1, `Add ${label}.`)
    .max(maximumLength, `Keep ${label} under ${maximumLength} characters.`);
}

// A pasted LinkedIn link, or a bare profile name. Blank means none.
const linkedinLinkSchema = z
  .string()
  .trim()
  .max(LINKEDIN_INPUT_LENGTH)
  .nullable()
  .default(null)
  .transform((value, context) => {
    if (!value) return null;
    const slug = readLinkedinSlug(value.includes("/") ? value : `${LINKEDIN_PROFILE_PREFIX}${value}`);
    if (!slug || !PROFILE_NAME_PATTERN.test(slug)) {
      context.addIssue({ code: "custom", message: "Paste their LinkedIn link, like https://www.linkedin.com/in/their-name." });
      return z.NEVER;
    }
    return slug.toLowerCase();
  });

const optionalEmailSchema = z
  .string()
  .trim()
  .nullable()
  .default(null)
  .transform((value) => value || null)
  .pipe(z.email("Enter an email address, like clara@example.com.").toLowerCase().max(INTRO_LIMITS.emailLength).nullable());

// Only the name is needed (Founderhall's "Who should Ada introduce you to?": Name, Role, Company).
function optionalPersonTextSchema(label: string, maximumLength: number) {
  return z
    .string()
    .overwrite(removeNullBytes)
    .overwrite(removeBidiControls)
    .trim()
    .overwrite((value) => value.replace(REPEATED_WHITESPACE, " "))
    .max(maximumLength, `Keep ${label} under ${maximumLength} characters.`)
    .default("");
}

export const namedTargetSchema = z.object({
  name: personTextSchema("their name", INTRO_LIMITS.nameLength),
  role: optionalPersonTextSchema("their role", INTRO_LIMITS.headlineLength),
  company: optionalPersonTextSchema("their company", INTRO_LIMITS.headlineLength),
  email: optionalEmailSchema,
  linkedin: linkedinLinkSchema,
});

// An ask from a member's profile: the asker names the person. No Village path, so it works with Village off.
export const namedIntroBodySchema = z.object({
  connectorId: z.string().trim().min(1).max(INTRO_LIMITS.slugLength),
  target: namedTargetSchema,
  note: introNoteSchema,
});

// A body with `connectorId` is a named ask; any other is a path ask. Picking the schema first keeps its own messages
// ("Paste their LinkedIn link…"), where a plain union would answer "Invalid input".
export const createIntroBodySchema = z.custom<z.input<typeof pathIntroBodySchema> | z.input<typeof namedIntroBodySchema>>().transform((body, context) => {
  const isNamed = typeof body === "object" && body !== null && "connectorId" in body;
  const parsed = isNamed ? namedIntroBodySchema.safeParse(body) : pathIntroBodySchema.safeParse(body);
  if (parsed.success) return parsed.data;
  for (const issue of parsed.error.issues) context.addIssue({ code: "custom", message: issue.message, path: issue.path });
  return z.NEVER;
});

const NAMED_TARGET_KEY_PREFIX = "~";

// The key that stands for a named person in `targetLinkedinSlug`: their LinkedIn slug when the asker gave one, so a
// "stop all asks" covers every ask for them, or else their name and company. Never their email.
export function readNamedTargetKey({ name, company, linkedin }: Pick<NamedTarget, "name" | "company" | "linkedin">) {
  if (linkedin) return linkedin;
  return `${NAMED_TARGET_KEY_PREFIX}${JSON.stringify([name.toLowerCase(), company.toLowerCase()])}`;
}

// A LinkedIn slug the app can link to, or null for a key made from a name.
export function readTargetLinkedinSlug(targetKey: string) {
  return targetKey.startsWith(NAMED_TARGET_KEY_PREFIX) ? null : targetKey;
}

export function isNamedIntroBody(body: CreateIntroBody): body is NamedIntroBody {
  return "connectorId" in body;
}

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

const targetEmailSchema = z.email("Enter an email address, like clara@example.com.").trim().toLowerCase().max(INTRO_LIMITS.emailLength);

// `targetEmail` comes with a yes on a forwarded link, when the app has no address for the person asked.
export const consentAnswerBodySchema = z.object({
  token: z.string().max(CONSENT_TOKEN_MAXIMUM_LENGTH),
  answer: z.enum(CONSENT_ANSWERS),
  targetEmail: targetEmailSchema.optional(),
});

export const consentEmailBodySchema = z.object({
  introId: z.uuid(),
  token: z.string().max(CONSENT_TOKEN_MAXIMUM_LENGTH),
  targetEmail: targetEmailSchema,
});

// The connector's answer, from the intro page or from the link in the ask email (no sign-in).
const connectorAnswerFields = {
  choice: z.enum(CONNECTOR_CHOICES),
  targetEmail: z
    .string()
    .trim()
    .max(INTRO_LIMITS.emailLength)
    .nullable()
    .default(null)
    .transform((value) => value?.toLowerCase() || null),
  // The note as the connector edited it before it goes on. Null or unchanged keeps the asker's note.
  note: z.string().max(INTRO_LIMITS.noteLength * 2).nullable().default(null),
  // Community's private note with a no: the connector's own, never shown to the asker.
  reason: declineReasonSchema.default(null),
};

export const connectorAnswerBodySchema = z.object({ introId: z.uuid(), ...connectorAnswerFields });

const outcomeLinkFields = {
  outcome: z.enum(OUTCOME_CHOICES),
  results: z.array(z.enum(INTRO_RESULTS)).max(Object.keys(INTRO_RESULTS).length).default([]),
};

// An answer through a link without signing in: the connector's, or the asker's outcome.
export const linkAnswerBodySchema = z.discriminatedUnion("purpose", [
  z.object({ purpose: z.literal(INTRO_LINK_PURPOSES.connector), token: z.string().max(CONSENT_TOKEN_MAXIMUM_LENGTH), ...connectorAnswerFields }),
  z.object({ purpose: z.literal(INTRO_LINK_PURPOSES.outcome), token: z.string().max(CONSENT_TOKEN_MAXIMUM_LENGTH), ...outcomeLinkFields }),
]);

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
  // `linkedinSlug` is null for a person the asker named without a LinkedIn link. `isNamed`: asked from a profile.
  target: z.object({ name: z.string(), headline: z.string().nullable(), linkedinSlug: z.string().nullable(), isNamed: z.boolean() }),
  // The address the asker typed for the person, while the ask is open: it fills in the connector's consent email.
  suggestedTargetEmail: z.string().nullable(),
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
export type PathIntroBody = z.infer<typeof pathIntroBodySchema>;
export type NamedIntroBody = z.infer<typeof namedIntroBodySchema>;
export type NamedTarget = z.infer<typeof namedTargetSchema>;
export type NamedIntroRequest = z.input<typeof namedIntroBodySchema>;
export type IntroTransitionBody = z.infer<typeof introTransitionBodySchema>;
export type IntroOutcomeBody = z.infer<typeof introOutcomeBodySchema>;
export type IntroOutcomeRequest = z.input<typeof introOutcomeBodySchema>;
export type ConsentAnswerBody = z.infer<typeof consentAnswerBodySchema>;
export type ConsentEmailBody = z.infer<typeof consentEmailBodySchema>;
export type ConsentIssue = z.infer<typeof consentIssueSchema>;
export type ConnectorAnswerBody = z.infer<typeof connectorAnswerBodySchema>;
export type ConnectorAnswerRequest = z.input<typeof connectorAnswerBodySchema>;
export type LinkAnswerBody = z.infer<typeof linkAnswerBodySchema>;
export type LinkAnswerRequest = z.input<typeof linkAnswerBodySchema>;

export function isOpenIntroState(state: IntroState) {
  return INTRO_TRANSITIONS[state].length > 0;
}
