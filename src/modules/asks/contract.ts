import { z } from "zod";

import { feedTextSchema } from "../../platform/text/text-schema.ts";

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
} as const;

export const ASK_CATEGORIES = { intro: "intro", hire: "hire", customer: "customer", advice: "advice", other: "other" } as const;
export const ASK_OUTCOMES = { solvedHere: "solved_here", solvedElsewhere: "solved_elsewhere", noLongerNeeded: "no_longer_needed" } as const;
export const ASK_STATES = { open: "open", expired: "expired", closed: "closed" } as const;
export const ASK_REPORT_TARGET = "ask";

export const ASK_ERROR_CODES = {
  notFound: "ask_not_found",
  openLimit: "ask_open_limit",
  closed: "ask_closed",
  ownAsk: "ask_own",
  tooEarlyToRenew: "ask_too_early_to_renew",
  tooFast: "ask_too_fast",
} as const;

const REPEATED_WHITESPACE = /\s+/g;

const timestampSchema = z.iso.datetime();
const askCategorySchema = z.enum(ASK_CATEGORIES, "Choose what kind of help you need.");
const askOutcomeSchema = z.enum(ASK_OUTCOMES, "Choose how this ask ended.");
const askTitleSchema = feedTextSchema("what you need", ASK_LIMITS.titleLength).overwrite((title) => title.replace(REPEATED_WHITESPACE, " "));
const askDetailSchema = feedTextSchema("the details", ASK_LIMITS.detailLength);
const offerNoteSchema = feedTextSchema("a short note", ASK_LIMITS.noteLength);

export const askCursorSchema = z.object({ listedAt: timestampSchema, id: z.uuid() });

export const askBoardBodySchema = z.object({
  category: z.enum(ASK_CATEGORIES).nullable().default(null),
  cursor: askCursorSchema.nullable().default(null),
});
export const createAskBodySchema = z.object({ title: askTitleSchema, detail: askDetailSchema.nullable().default(null), category: askCategorySchema });
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

export const boardAskSchema = z.object({
  id: z.uuid(),
  title: z.string(),
  detail: z.string().nullable(),
  category: z.enum(ASK_CATEGORIES),
  listedAt: timestampSchema,
  author: askMemberSchema,
  offerCount: z.number(),
  isMine: z.boolean(),
  myOffer: myOfferSchema.nullable(),
});

export const askBoardPageSchema = z.object({ asks: z.array(boardAskSchema), nextCursor: askCursorSchema.nullable() });

const offerSchema = z.object({
  id: z.uuid(),
  helper: askMemberSchema,
  note: z.string(),
  createdAt: timestampSchema,
  isNew: z.boolean(),
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
  offers: z.array(offerSchema),
});

export const ownAsksSchema = z.object({ asks: z.array(ownAskSchema), openCount: z.number() });
export const askCountsSchema = z.object({ newOffers: z.number() });
export const createdAskSchema = z.object({ id: z.uuid() });
export const offerResultSchema = z.object({ isSentAsMessage: z.boolean(), wasAlreadyOffered: z.boolean() });

export type AskCategory = z.infer<typeof askCategorySchema>;
export type AskOutcome = z.infer<typeof askOutcomeSchema>;
export type AskState = (typeof ASK_STATES)[keyof typeof ASK_STATES];
export type AskCursor = z.infer<typeof askCursorSchema>;
export type AskMember = z.infer<typeof askMemberSchema>;
export type BoardAsk = z.infer<typeof boardAskSchema>;
export type AskBoardPage = z.infer<typeof askBoardPageSchema>;
export type Offer = z.infer<typeof offerSchema>;
export type OwnAsk = z.infer<typeof ownAskSchema>;
export type OwnAsks = z.infer<typeof ownAsksSchema>;
export type CreateAskBody = z.output<typeof createAskBodySchema>;
export type AskDraft = Omit<CreateAskBody, "category"> & { category: AskCategory | null };
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
