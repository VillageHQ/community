import { z } from "zod";

import { feedTextSchema } from "../../platform/text/text-schema.ts";
import { readLinkedinSlug } from "../members/contract-linkedin.ts";

export const ASKS_PAGE = "/asks";
export const ASKS_PAGE_TITLE = "Asks";

export const ASK_API_ROUTES = {
  board: "/api/asks",
  own: "/api/asks/own",
  counts: "/api/asks/counts",
  create: "/api/asks/create",
  offer: "/api/asks/offer",
  close: "/api/asks/close",
  renew: "/api/asks/renew",
  seen: "/api/asks/seen",
  report: "/api/asks/report",
  remove: "/api/asks/remove",
  answer: "/api/asks/answer",
  reportAnswer: "/api/asks/report-answer",
  knowSomeone: "/api/asks/know-someone",
  askHelper: "/api/asks/ask-helper",
  allowance: "/api/asks/allowance",
} as const;

export const ASK_LIMITS = {
  titleLength: 120,
  detailLength: 1000,
  noteLength: 500,
  openPerMember: 5,
  lifetimeDays: 30,
  renewableWithinDays: 7,
  asksPerPage: 20,
  closedAsksShown: 20,
  answerLength: 1000,
  personNameLength: 120,
  wordHelpersPerAsk: 5,
  allowanceWindowDays: 7,
  connectorWeeklyCap: 10,
} as const;

export const ASK_ALLOWANCE = { default: 5, minimum: 1, maximum: 100 } as const;
export const ASK_ALLOWANCE_SETTING = "asks_weekly_allowance";

export const ASK_KINDS = { ask: "ask", update: "update" } as const;
export const ASK_HELPER_REASONS = { path: "path", words: "words" } as const;

export const ASK_CATEGORIES = { intro: "intro", hire: "hire", customer: "customer", advice: "advice", other: "other" } as const;
export const ASK_OUTCOMES = { solvedHere: "solved_here", solvedElsewhere: "solved_elsewhere", noLongerNeeded: "no_longer_needed" } as const;
export const ASK_STATES = { open: "open", expired: "expired", closed: "closed" } as const;
export const ASK_REPORT_TARGET = "ask";
export const ASK_ANSWER_REPORT_TARGET = "ask_answer";

export const ASK_ERROR_CODES = {
  notFound: "ask_not_found",
  openLimit: "ask_open_limit",
  closed: "ask_closed",
  ownAsk: "ask_own",
  tooEarlyToRenew: "ask_too_early_to_renew",
  tooFast: "ask_too_fast",
  allowanceUsed: "ask_allowance_used",
  notAnAsk: "ask_not_an_ask",
  answerNotFound: "ask_answer_not_found",
  introUnavailable: "ask_intro_unavailable",
  notHelper: "ask_not_helper",
} as const;

const REPEATED_WHITESPACE = /\s+/g;

const timestampSchema = z.iso.datetime();
const askCategorySchema = z.enum(ASK_CATEGORIES, "Choose what kind of help you need.");
const askOutcomeSchema = z.enum(ASK_OUTCOMES, "Choose how this ask ended.");
const askTitleSchema = feedTextSchema("what you need", ASK_LIMITS.titleLength).overwrite((title) => title.replace(REPEATED_WHITESPACE, " "));
const askDetailSchema = feedTextSchema("the details", ASK_LIMITS.detailLength);
const offerNoteSchema = feedTextSchema("a short note", ASK_LIMITS.noteLength);
const answerSchema = feedTextSchema("your answer", ASK_LIMITS.answerLength);
const askKindSchema = z.enum(ASK_KINDS);
const LINKEDIN_PROFILE_PREFIX = "https://www.linkedin.com/in/";
const LINKEDIN_INPUT_LENGTH = 300;

// A pasted LinkedIn link, or a bare profile name. Blank means the ask names nobody.
export const linkedinTargetSchema = z
  .string()
  .trim()
  .max(LINKEDIN_INPUT_LENGTH)
  .nullable()
  .default(null)
  .transform((value, context) => {
    if (!value) return null;
    const slug = readLinkedinSlug(value.includes("/") ? value : `${LINKEDIN_PROFILE_PREFIX}${value}`);
    if (!slug) {
      context.addIssue({ code: "custom", message: "Paste their LinkedIn link, like https://www.linkedin.com/in/their-name." });
      return z.NEVER;
    }
    return slug.toLowerCase();
  });

export const askCursorSchema = z.object({ listedAt: timestampSchema, id: z.uuid() });

export const askBoardBodySchema = z.object({
  category: z.enum(ASK_CATEGORIES).nullable().default(null),
  kind: askKindSchema.nullable().default(null),
  cursor: askCursorSchema.nullable().default(null),
});
export const createAskBodySchema = z.object({
  title: askTitleSchema,
  detail: askDetailSchema.nullable().default(null),
  category: askCategorySchema,
  kind: askKindSchema.default(ASK_KINDS.ask),
  targetLinkedin: linkedinTargetSchema,
});
export const answerAskBodySchema = z.object({ askId: z.uuid(), body: answerSchema });
export const answerIdBodySchema = z.object({ answerId: z.uuid() });
export const knowSomeoneBodySchema = z.object({
  askId: z.uuid(),
  note: offerNoteSchema,
  targetLinkedin: linkedinTargetSchema,
  targetName: z.string().trim().max(ASK_LIMITS.personNameLength).nullable().default(null),
});
export const askHelperBodySchema = z.object({ askId: z.uuid(), helperId: z.string().min(1).max(200), note: offerNoteSchema });
export const allowanceBodySchema = z.object({
  weeklyAllowance: z
    .number()
    .int()
    .min(ASK_ALLOWANCE.minimum, `Choose at least ${ASK_ALLOWANCE.minimum}.`)
    .max(ASK_ALLOWANCE.maximum, `Choose at most ${ASK_ALLOWANCE.maximum}.`),
});
export const offerHelpBodySchema = z.object({ askId: z.uuid(), note: offerNoteSchema });
export const closeAskBodySchema = z.object({ askId: z.uuid(), outcome: askOutcomeSchema });
export const askIdBodySchema = z.object({ askId: z.uuid() });

const askMemberSchema = z.object({
  id: z.string(),
  name: z.string(),
  title: z.string().nullable(),
  company: z.string().nullable(),
  avatarUrl: z.string().nullable(),
});

const myOfferSchema = z.object({ note: z.string(), createdAt: timestampSchema });

const answerShapeSchema = z.object({ id: z.uuid(), author: askMemberSchema, body: z.string(), createdAt: timestampSchema, isMine: z.boolean() });
const askTargetSchema = z.object({ linkedinSlug: z.string(), name: z.string().nullable() });
const helperReasonSchema = z.enum(ASK_HELPER_REASONS);

export const boardAskSchema = z.object({
  id: z.uuid(),
  title: z.string(),
  detail: z.string().nullable(),
  category: z.enum(ASK_CATEGORIES),
  kind: askKindSchema,
  listedAt: timestampSchema,
  author: askMemberSchema,
  target: askTargetSchema.nullable(),
  offerCount: z.number(),
  isMine: z.boolean(),
  myOffer: myOfferSchema.nullable(),
  answers: z.array(answerShapeSchema),
  whyYou: z.string().nullable(),
});

export const askBoardPageSchema = z.object({ asks: z.array(boardAskSchema), nextCursor: askCursorSchema.nullable(), canIntro: z.boolean() });

const offerSchema = z.object({
  id: z.uuid(),
  helper: askMemberSchema,
  note: z.string(),
  createdAt: timestampSchema,
  isNew: z.boolean(),
});

const helperSchema = z.object({
  helper: askMemberSchema,
  reason: helperReasonSchema,
  why: z.string(),
  canAskForIntro: z.boolean(),
});

export const ownAskSchema = z.object({
  id: z.uuid(),
  title: z.string(),
  detail: z.string().nullable(),
  category: z.enum(ASK_CATEGORIES),
  listedAt: timestampSchema,
  expiresAt: timestampSchema,
  state: z.enum(ASK_STATES),
  outcome: z.enum(ASK_OUTCOMES).nullable(),
  canRenew: z.boolean(),
  kind: askKindSchema,
  target: askTargetSchema.nullable(),
  offers: z.array(offerSchema),
  helpers: z.array(helperSchema),
  answers: z.array(answerShapeSchema),
});

export const askAllowanceSchema = z.object({ cap: z.number().int(), used: z.number().int(), left: z.number().int(), backAt: timestampSchema.nullable() });

export const ownAsksSchema = z.object({ asks: z.array(ownAskSchema), openCount: z.number(), allowance: askAllowanceSchema, canIntro: z.boolean() });
export const askCountsSchema = z.object({ newOffers: z.number() });
export const createdAskSchema = z.object({ id: z.uuid(), helperCount: z.number().int() });
export const offerResultSchema = z.object({ isSentAsMessage: z.boolean(), wasAlreadyOffered: z.boolean() });
export const createdAnswerSchema = z.object({ id: z.uuid(), wasAlreadyAnswered: z.boolean() });
export const createdIntroSchema = z.object({ introId: z.uuid() });
export const allowanceSettingSchema = z.object({ weeklyAllowance: z.number().int() });

export type AskCategory = z.infer<typeof askCategorySchema>;
export type AskOutcome = z.infer<typeof askOutcomeSchema>;
export type AskState = (typeof ASK_STATES)[keyof typeof ASK_STATES];
export type AskKind = (typeof ASK_KINDS)[keyof typeof ASK_KINDS];
export type AskHelperReason = (typeof ASK_HELPER_REASONS)[keyof typeof ASK_HELPER_REASONS];
export type AskAnswer = z.infer<typeof answerShapeSchema>;
export type AskHelper = z.infer<typeof helperSchema>;
export type AskAllowance = z.infer<typeof askAllowanceSchema>;
export type AnswerAskBody = z.infer<typeof answerAskBodySchema>;
export type KnowSomeoneBody = z.output<typeof knowSomeoneBodySchema>;
export type KnowSomeoneDraft = z.input<typeof knowSomeoneBodySchema>;
export type AskHelperBody = z.infer<typeof askHelperBodySchema>;
export type AskCursor = z.infer<typeof askCursorSchema>;
export type AskMember = z.infer<typeof askMemberSchema>;
export type BoardAsk = z.infer<typeof boardAskSchema>;
export type AskBoardPage = z.infer<typeof askBoardPageSchema>;
export type Offer = z.infer<typeof offerSchema>;
export type OwnAsk = z.infer<typeof ownAskSchema>;
export type OwnAsks = z.infer<typeof ownAsksSchema>;
export type CreateAskBody = z.output<typeof createAskBodySchema>;
export type AskDraft = Omit<CreateAskBody, "category" | "targetLinkedin"> & { category: AskCategory | null; targetLinkedin: string | null };
export type OfferHelpBody = z.infer<typeof offerHelpBodySchema>;
export type CloseAskBody = z.infer<typeof closeAskBodySchema>;
export type OfferResult = z.infer<typeof offerResultSchema>;

export function describeNewOffers(count: number) {
  return count === 1 ? "1 new offer of help" : `${count} new offers of help`;
}

export function composeOfferMessage(askTitle: string, note: string) {
  return `About your ask, "${askTitle}":\n\n${note}`;
}

export function composeAskReportBody(title: string, detail: string | null) {
  return detail ? `${title}\n\n${detail}` : title;
}

export function describeAllowance({ left, cap }: { left: number; cap: number }) {
  return `${left} of ${cap} asks left this week`;
}

export function composeAnswerReportBody(askTitle: string, body: string) {
  return `Answer on "${askTitle}":\n\n${body}`;
}
