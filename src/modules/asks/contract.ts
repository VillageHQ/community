import { z } from "zod";

import { feedTextSchema } from "../../platform/text/text-schema.ts";
import { readLinkedinSlug } from "../members/contract-linkedin.ts";
import { removeBidiControls, removeNullBytes } from "../../platform/text/safe-text.ts";

export const ASKS_PAGE = "/asks";
export const ASKS_PAGE_TITLE = "Asks & updates";

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
  pin: "/api/asks/pin",
  reopen: "/api/asks/reopen",
  help: "/api/asks/help",
  status: "/api/asks/status",
} as const;

// One ask's page (Founderhall's /asks/<id>).
export function toAskPage(askId: string) {
  return `${ASKS_PAGE}/${askId}`;
}

export const ASKS_ADMIN_PAGE = "/admin/asks";

export const ASK_LIMITS = {
  // Founderhall's one line (POST_MAX).
  titleLength: 500,
  targetLength: 160,
  companyLength: 120,
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
  pinnedAsks: 3,
  searchLength: 120,
  adminOldestShown: 10,
} as const;

export const ASK_ALLOWANCE = { default: 5, minimum: 1, maximum: 100 } as const;
export const ASK_ALLOWANCE_SETTING = "asks_weekly_allowance";

export const ASK_KINDS = { ask: "ask", update: "update" } as const;
export const ASK_HELPER_REASONS = { path: "path", words: "words" } as const;
// How well a path helper knows the person, as Village names it.
export const ASK_WARMTHS = { close: "close", knows: "knows", met: "met" } as const;
// A public line under an ask. "I can help" leaves one saying how.
export const ASK_ANSWER_KINDS = { answer: "answer", knowSomeone: "know_someone", doneMyself: "done_myself" } as const;

export const ASK_CATEGORIES = { intro: "intro", hire: "hire", customer: "customer", advice: "advice", other: "other" } as const;
export const ASK_OUTCOMES = { solvedHere: "solved_here", solvedElsewhere: "solved_elsewhere", noLongerNeeded: "no_longer_needed" } as const;
export const ASK_STATES = { open: "open", expired: "expired", closed: "closed" } as const;
// The board's tabs, as Founderhall's Asks & updates: Open · Updates · Yours · Answered. Closed asks are the archive,
// under Answered. "closed" is kept for the older API.
export const ASK_BOARD_TABS = { open: "open", updates: "updates", yours: "yours", answered: "answered", closed: "closed" } as const;
export const ASK_TABS = [
  [ASK_BOARD_TABS.open, "Open"],
  [ASK_BOARD_TABS.updates, "Updates"],
  [ASK_BOARD_TABS.yours, "Yours"],
  [ASK_BOARD_TABS.answered, "Answered"],
] as const;
export type AskTab = (typeof ASK_TABS)[number][0];

// "I can help" on an ask (Founderhall's help form).
export const ASK_HELP_KINDS = { knowSomeone: "know_someone", doneMyself: "done_myself" } as const;
// What the ask's owner and an admin can do from the ask's page.
export const ASK_STATUS_ACTIONS = { answered: "answered", reopen: "reopen", pin: "pin", unpin: "unpin", close: "close", remove: "remove" } as const;

export const ASK_CONSENT = "Nobody is introduced without saying yes.";

// The note at the top of the page after an action (Founderhall's flash words, `?m=` on its pages).
export const ASK_FLASHES = {
  posted: "Posted. We told the members who can help.",
  posted0: "Posted. Nobody has a path yet; it goes into Thursday’s digest.",
  updated: "Update posted.",
  helped: "Thank you. They hear from you by email.",
  knows: "Thank you. They’re asked to write the note; you decide whether to forward it.",
  answered: "Marked answered. It stays in the archive.",
  reopen: "Reopened.",
  pin: "Pinned.",
  unpin: "Unpinned.",
  close: "Closed.",
  remove: "Removed. Members no longer see it.",
  commented: "Answer posted.",
  skipped: "Done. It won’t show for you again.",
  right: "Thank you. Marked as right.",
  hide: "Hidden. It stays hidden when your profile refreshes.",
  fix: "Saved in your own words.",
} as const;
export type AskFlash = keyof typeof ASK_FLASHES;

export function readAskFlash(value: unknown): string | null {
  return typeof value === "string" && Object.hasOwn(ASK_FLASHES, value) ? ASK_FLASHES[value as AskFlash] : null;
}

// "VP Supply Chain at a US hospital · Mercy Ridge Hospital": who the ask is trying to reach, in one line.
export function describeAskWho({ targetText, targetCompany, targetName = null }: { targetText: string | null; targetCompany: string | null; targetName?: string | null }) {
  if (targetText && targetCompany && !targetText.toLowerCase().includes(targetCompany.toLowerCase())) return `${targetText} · ${targetCompany}`;
  return targetText || targetCompany || targetName || "";
}

export type HelperReasonLine = { reason: string; why: string; personName: string | null; personTitle: string | null; warmth: string | null };

const FINAL_STOP = /\.$/;

// "You know Dana Morris well (VP Supply Chain at Mercy Ridge Hospital). Worked together at Mercy Ridge Hospital."
// or "Your profile says you can help with “…”." Only the helper reads it.
export function describeWhyYou({ reason, why, personName, personTitle, warmth }: HelperReasonLine) {
  if (reason === ASK_HELPER_REASONS.path && personName) {
    const verb = warmth === ASK_WARMTHS.met ? "You’ve met" : "You know";
    const how = why ? ` ${why.replace(FINAL_STOP, "")}.` : "";
    return `${verb} ${personName}${warmth === ASK_WARMTHS.close ? " well" : ""}${personTitle ? ` (${personTitle})` : ""}.${how}`;
  }
  const words = why.replace(FINAL_STOP, "");
  return `Your profile says you ${lowerFirst(words)}${/[.!?…]”?$/.test(words) ? "" : "."}`;
}

// "Knows Rosa Lindqvist (CTO at Halcyon Health)" or "Their profile says they can help with …": a helper, as others read it.
export function describeHelperLine({ reason, why, personName, personTitle }: HelperReasonLine) {
  if (reason === ASK_HELPER_REASONS.path && personName) return { knows: personName, title: personTitle };
  return { knows: null, title: `Their profile says they ${lowerFirst(why)}` };
}

function lowerFirst(text: string) {
  return text ? `${text.charAt(0).toLowerCase()}${text.slice(1)}` : text;
}

// "1 member can help", "2 members can help".
export function describeCanHelp(count: number) {
  return `${count} member${count === 1 ? "" : "s"} can help`;
}

export function describeAnswerCount(count: number) {
  return `${count} answer${count === 1 ? "" : "s"}`;
}

const DAY_MS = 86_400_000;
const HOUR_MS = 3_600_000;
const DAYS_BEFORE_A_DATE = 14;

// "just now", "3 hours ago", "yesterday", "5 days ago", then the date (Founderhall's ago()).
export function describeAgo(at: string | Date, now = new Date()) {
  const elapsed = now.getTime() - new Date(at).getTime();
  const days = Math.floor(elapsed / DAY_MS);
  if (days <= 0) {
    const hours = Math.floor(elapsed / HOUR_MS);
    return hours <= 0 ? "just now" : `${hours} hour${hours === 1 ? "" : "s"} ago`;
  }
  if (days === 1) return "yesterday";
  if (days < DAYS_BEFORE_A_DATE) return `${days} days ago`;
  return new Date(at).toLocaleDateString("en-GB", { day: "numeric", month: "short", timeZone: "UTC" });
}
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
  pinLimit: "ask_pin_limit",
  notOpen: "ask_not_open",
  notClosed: "ask_not_closed",
} as const;

const REPEATED_WHITESPACE = /\s+/g;

const timestampSchema = z.iso.datetime();
const askCategorySchema = z.enum(ASK_CATEGORIES, "Choose what kind of help you need.");
const askOutcomeSchema = z.enum(ASK_OUTCOMES, "Choose how this ask ended.");
const askDetailSchema = feedTextSchema("the details", ASK_LIMITS.detailLength);
const offerNoteSchema = feedTextSchema("a short note", ASK_LIMITS.noteLength);
const answerSchema = feedTextSchema("your answer", ASK_LIMITS.answerLength);
const askKindSchema = z.enum(ASK_KINDS);
const LINKEDIN_PROFILE_PREFIX = "https://www.linkedin.com/in/";
const LINKEDIN_INPUT_LENGTH = 300;
// A LinkedIn profile name: letters, digits, hyphens and underscores. Anything else is junk or a spoof.
const PROFILE_NAME_PATTERN = /^[\p{L}\p{N}_-]{2,100}$/u;

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
    if (!slug || !PROFILE_NAME_PATTERN.test(slug)) {
      context.addIssue({ code: "custom", message: "Paste their LinkedIn link, like https://www.linkedin.com/in/their-name." });
      return z.NEVER;
    }
    return slug.toLowerCase();
  });

export const askCursorSchema = z.object({ listedAt: timestampSchema, id: z.uuid() });

// Blank or spaces-only means no search.
export const askSearchSchema = z
  .string()
  .overwrite(removeNullBytes)
  .overwrite(removeBidiControls)
  .trim()
  .max(ASK_LIMITS.searchLength)
  .nullable()
  .default(null)
  .transform((value) => value || null);

export const askBoardBodySchema = z.object({
  tab: z.enum(ASK_BOARD_TABS).default(ASK_BOARD_TABS.open),
  search: askSearchSchema,
  category: z.enum(ASK_CATEGORIES).nullable().default(null),
  kind: askKindSchema.nullable().default(null),
  cursor: askCursorSchema.nullable().default(null),
});
export const pinAskBodySchema = z.object({ askId: z.uuid(), isPinned: z.boolean() });
const optionalLineSchema = (maximumLength: number) =>
  z
    .string()
    .overwrite(removeNullBytes)
    .overwrite(removeBidiControls)
    .transform((value) => value.replace(REPEATED_WHITESPACE, " ").trim().slice(0, maximumLength) || null)
    .nullable()
    .default(null);

const EMPTY_ASK = "Write your ask in a line: who or what you need.";

// The one line of an ask or update, with Founderhall's words for an empty or a long one.
export const askBodySchema = z
  .string({ error: EMPTY_ASK })
  .overwrite(removeNullBytes)
  .overwrite(removeBidiControls)
  .overwrite((value) => value.replace(REPEATED_WHITESPACE, " ").trim())
  .refine((value) => value.length > 0, EMPTY_ASK)
  .refine((value) => value.length <= ASK_LIMITS.titleLength, {
    error: (issue) => `That is ${String(issue.input).length} characters; keep it to ${ASK_LIMITS.titleLength}.`,
  });

export const createAskBodySchema = z.object({
  title: askBodySchema,
  detail: askDetailSchema.nullable().default(null),
  // Not asked any more: an ask that names who it's trying to reach is an intro, any other ask is advice.
  category: askCategorySchema.nullable().default(null),
  kind: askKindSchema.default(ASK_KINDS.ask),
  targetLinkedin: linkedinTargetSchema,
  targetText: optionalLineSchema(ASK_LIMITS.targetLength),
  targetCompany: optionalLineSchema(ASK_LIMITS.companyLength),
});

export const helpAskBodySchema = z.object({
  askId: z.uuid(),
  kind: z.enum(ASK_HELP_KINDS),
  person: optionalLineSchema(ASK_LIMITS.personNameLength),
  note: z
    .string()
    .overwrite(removeNullBytes)
    .overwrite(removeBidiControls)
    .overwrite((value) => value.replaceAll("\r\n", "\n").trim())
    .refine((value) => value.length <= ASK_LIMITS.answerLength, `Keep it to ${ASK_LIMITS.answerLength} characters.`)
    .default(""),
});
export const askStatusBodySchema = z.object({ askId: z.uuid(), action: z.enum(ASK_STATUS_ACTIONS) });
export const answerAskBodySchema = z.object({ askId: z.uuid(), body: answerSchema });
export const answerIdBodySchema = z.object({ answerId: z.uuid() });
export const knowSomeoneBodySchema = z.object({
  askId: z.uuid(),
  note: offerNoteSchema,
  targetLinkedin: linkedinTargetSchema,
  targetName: z.string().overwrite(removeNullBytes).overwrite(removeBidiControls).trim().max(ASK_LIMITS.personNameLength).nullable().default(null),
});
// `targetName`: for a helper found by profile words (no path), who the author would like to meet; it defaults to the
// person the ask names.
export const askHelperBodySchema = z.object({
  askId: z.uuid(),
  helperId: z.string().min(1).max(200),
  note: offerNoteSchema,
  targetName: z.string().trim().max(200).optional(),
});
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
  companyLogoUrl: z.string().nullable(),
});

const myOfferSchema = z.object({ note: z.string(), createdAt: timestampSchema });

const answerShapeSchema = z.object({
  id: z.uuid(),
  author: askMemberSchema,
  body: z.string(),
  kind: z.enum(ASK_ANSWER_KINDS),
  createdAt: timestampSchema,
  isMine: z.boolean(),
});
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
  state: z.enum(ASK_STATES),
  outcome: z.enum(ASK_OUTCOMES).nullable(),
  isPinned: z.boolean(),
  canReopen: z.boolean(),
});

export const askBoardPageSchema = z.object({
  asks: z.array(boardAskSchema),
  pinnedAsks: z.array(boardAskSchema),
  nextCursor: askCursorSchema.nullable(),
  canIntro: z.boolean(),
});

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
export type AskBoardTab = (typeof ASK_BOARD_TABS)[keyof typeof ASK_BOARD_TABS];
export type PinAskBody = z.infer<typeof pinAskBodySchema>;
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
export type HelpAskBody = z.output<typeof helpAskBodySchema>;
export type AskStatusBody = z.output<typeof askStatusBodySchema>;
export type AskStatusAction = AskStatusBody["action"];
export type AskHelpKind = HelpAskBody["kind"];
export type AskAnswerKind = (typeof ASK_ANSWER_KINDS)[keyof typeof ASK_ANSWER_KINDS];
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
