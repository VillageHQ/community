import { z } from "zod";

import { feedTextSchema } from "../../platform/text/text-schema.ts";
import { removeBidiControls, removeNullBytes } from "../../platform/text/safe-text.ts";

export const INTRO_LIFETIME_DAYS = 14;

export const INTRO_LIMITS = {
  noteLength: 1000,
  declineReasonLength: 500,
  nameLength: 200,
  headlineLength: 300,
  reasonLength: 600,
  slugLength: 200,
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
} as const;

export type IntroState = (typeof INTRO_STATES)[keyof typeof INTRO_STATES];

export const INTRO_TRANSITIONS: Record<IntroState, readonly IntroState[]> = {
  [INTRO_STATES.requested]: [INTRO_STATES.accepted, INTRO_STATES.declined, INTRO_STATES.withdrawn, INTRO_STATES.expired],
  [INTRO_STATES.accepted]: [INTRO_STATES.completed, INTRO_STATES.expired],
  [INTRO_STATES.declined]: [],
  [INTRO_STATES.withdrawn]: [],
  [INTRO_STATES.completed]: [],
  [INTRO_STATES.expired]: [],
};

const ALL_INTRO_STATES = Object.values(INTRO_STATES);

export function readStatesLeadingTo(nextState: IntroState) {
  return ALL_INTRO_STATES.filter((state) => INTRO_TRANSITIONS[state].includes(nextState));
}

export const OPEN_INTRO_STATES = ALL_INTRO_STATES.filter((state) => INTRO_TRANSITIONS[state].length > 0);

export const INTRO_ROLES = { requester: "requester", introducer: "introducer" } as const;

export type IntroRole = (typeof INTRO_ROLES)[keyof typeof INTRO_ROLES];

export const INTRO_ACTIONS = { accept: "accept", decline: "decline", withdraw: "withdraw", complete: "complete" } as const;

export type IntroAction = (typeof INTRO_ACTIONS)[keyof typeof INTRO_ACTIONS];

export const INTRO_ACTION_RULES: Record<IntroAction, { nextState: IntroState; actor: IntroRole }> = {
  [INTRO_ACTIONS.accept]: { nextState: INTRO_STATES.accepted, actor: INTRO_ROLES.introducer },
  [INTRO_ACTIONS.decline]: { nextState: INTRO_STATES.declined, actor: INTRO_ROLES.introducer },
  [INTRO_ACTIONS.withdraw]: { nextState: INTRO_STATES.withdrawn, actor: INTRO_ROLES.requester },
  [INTRO_ACTIONS.complete]: { nextState: INTRO_STATES.completed, actor: INTRO_ROLES.introducer },
};

export const INTRO_ERROR_CODES = {
  notFound: "intro_not_found",
  changed: "intro_changed",
  duplicate: "intro_duplicate",
  notConnector: "intro_not_connector",
  pathsStale: "intro_paths_stale",
  targetUnknown: "intro_target_unknown",
  ownTarget: "intro_own_target",
  blockedByYou: "intro_blocked_by_you",
  tooFast: "intro_too_fast",
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
  z.object({ introId: z.uuid(), action: z.literal(INTRO_ACTIONS.decline), reason: declineReasonSchema.default(null) }),
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
  hasUpdate: z.boolean(),
  createdAt: timestampSchema,
  acceptedAt: timestampSchema.nullable(),
  closedAt: timestampSchema.nullable(),
  expiresAt: timestampSchema,
  target: z.object({ name: z.string(), headline: z.string().nullable(), linkedinSlug: z.string() }),
  requester: introPersonSchema,
  introducer: introPersonSchema,
});

export const introCountsSchema = z.object({ waitingOnYou: z.number().int(), updates: z.number().int() });

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

export function isOpenIntroState(state: IntroState) {
  return INTRO_TRANSITIONS[state].length > 0;
}
