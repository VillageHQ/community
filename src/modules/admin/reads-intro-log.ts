import "server-only";

import { aliasedTable, and, desc, eq, gte, lt } from "drizzle-orm";

import { user } from "../../platform/database/auth-schema.ts";
import type { Database } from "../../platform/database/client.ts";
import { INTRO_OUTCOMES, INTRO_STATES, OPEN_INTRO_STATES, type IntroOutcome, type IntroState } from "../intros/contract.ts";
import { expireDueIntros } from "../intros/reads.ts";
import { introRequest } from "../intros/schema.ts";
import { ADMIN_SEES_INTRO_NAMES, HIDDEN_INTRO_NAMES } from "./intro-privacy.ts";

// The console's intro log (Founderhall's /admin/intros, Home's "Latest in the intro log"): one row per intro asked,
// with its state and dates. Never the note or the reason. Names load only while ADMIN_SEES_INTRO_NAMES is on;
// otherwise each reads as a placeholder, so who asked whom never leaves the database.

export const INTRO_LOG_FILTERS = { all: "all", open: "open", made: "made", declined: "declined", withdrawn: "withdrawn" } as const;

export type IntroLogFilter = (typeof INTRO_LOG_FILTERS)[keyof typeof INTRO_LOG_FILTERS];

export const INTRO_LOG_FILTER_LABELS: Record<IntroLogFilter, string> = {
  all: "All",
  open: "Open",
  made: "Introduced",
  declined: "Declined",
  withdrawn: "Withdrawn",
};

export function parseIntroLogFilter(value: unknown): IntroLogFilter {
  return typeof value === "string" && value in INTRO_LOG_FILTERS ? (value as IntroLogFilter) : INTRO_LOG_FILTERS.all;
}

export const INTRO_LOG_TONES = { made: "made", open: "open", declined: "declined" } as const;

export type IntroLogTone = (typeof INTRO_LOG_TONES)[keyof typeof INTRO_LOG_TONES];

export const OUTCOME_WORDS: Record<IntroOutcome, string> = {
  [INTRO_OUTCOMES.helped]: "helpful",
  [INTRO_OUTCOMES.notHelped]: "not really",
  [INTRO_OUTCOMES.notYet]: "too early to say",
};

export type IntroLogRow = {
  id: string;
  askedAt: Date;
  asker: string;
  target: string;
  // The target's company, from their headline ("VP Sales at Countwise" → "Countwise"); null when unknown.
  targetCompany: string | null;
  connector: string;
  state: IntroState;
  // Founderhall's word for the state: "with connector", "introduced", "declined by target"…
  stateWord: string;
  tone: IntroLogTone;
  filter: Exclude<IntroLogFilter, "all">;
  // When the connector answered (yes or no), when both were introduced, and the asker's answer, if any.
  answeredAt: Date | null;
  introducedAt: Date | null;
  outcome: IntroOutcome | null;
  isNamed: boolean;
};

const OPEN_STATES: readonly string[] = OPEN_INTRO_STATES;

function readStateWord(row: { state: IntroState; acceptedAt: Date | null; askedTargetAt: Date | null; targetAgreedAt: Date | null }) {
  switch (row.state) {
    case INTRO_STATES.requested:
    case INTRO_STATES.accepted:
    case INTRO_STATES.targetAgreed:
      return "with connector";
    case INTRO_STATES.askingTarget:
      return "with target";
    case INTRO_STATES.declined:
      return "declined by connector";
    case INTRO_STATES.targetDeclined:
      return "declined by target";
    case INTRO_STATES.completed:
      return "introduced";
    case INTRO_STATES.withdrawn:
      return "withdrawn";
    case INTRO_STATES.expired:
      return row.askedTargetAt && !row.targetAgreedAt ? "no answer from target" : "no answer from connector";
  }
}

function readFilter(state: IntroState): IntroLogRow["filter"] {
  if (state === INTRO_STATES.completed) return INTRO_LOG_FILTERS.made;
  if (state === INTRO_STATES.withdrawn) return INTRO_LOG_FILTERS.withdrawn;
  if (OPEN_STATES.includes(state)) return INTRO_LOG_FILTERS.open;
  return INTRO_LOG_FILTERS.declined;
}

const TONE_OF: Record<IntroLogRow["filter"], IntroLogTone> = { made: "made", open: "open", declined: "declined", withdrawn: "declined" };

const COMPANY_IN_HEADLINE = /\s(?:at|@)\s+(.+)$/i;

export function readCompanyFromHeadline(headline: string | null) {
  const company = headline?.match(COMPANY_IN_HEADLINE)?.[1]?.trim();
  return company ? company : null;
}

type IntroLogOptions = { from?: Date | null; to?: Date | null; limit?: number };

const requester = aliasedTable(user, "intro_log_requester");
const introducer = aliasedTable(user, "intro_log_introducer");

// Every intro asked in the period (withheld asks never reached anyone and are left out), newest first.
export async function readIntroLog(database: Database, { from = null, to = null, limit }: IntroLogOptions = {}): Promise<IntroLogRow[]> {
  await expireDueIntros(database, null);
  const where = and(eq(introRequest.isWithheld, false), from ? gte(introRequest.createdAt, from) : undefined, to ? lt(introRequest.createdAt, to) : undefined);
  const base = database
    .select({
      id: introRequest.id,
      createdAt: introRequest.createdAt,
      state: introRequest.state,
      acceptedAt: introRequest.acceptedAt,
      askedTargetAt: introRequest.askedTargetAt,
      targetAgreedAt: introRequest.targetAgreedAt,
      closedAt: introRequest.closedAt,
      outcome: introRequest.outcome,
      // Names only behind the switch: with it off, these read nothing.
      ...(ADMIN_SEES_INTRO_NAMES
        ? { askerName: requester.name, connectorName: introducer.name, targetName: introRequest.targetName, targetHeadline: introRequest.targetHeadline }
        : {}),
    })
    .from(introRequest)
    .leftJoin(requester, eq(requester.id, introRequest.requesterId))
    .leftJoin(introducer, eq(introducer.id, introRequest.introducerId))
    .where(where)
    .orderBy(desc(introRequest.createdAt), desc(introRequest.id));
  const rows = await (limit ? base.limit(limit) : base);
  return rows.map((row) => {
    const state = row.state as IntroState;
    const named = row as typeof row & { askerName?: string | null; connectorName?: string | null; targetName?: string; targetHeadline?: string | null };
    const filter = readFilter(state);
    const answeredAt = row.acceptedAt ?? row.askedTargetAt ?? (state === INTRO_STATES.declined ? row.closedAt : null);
    return {
      id: row.id,
      askedAt: row.createdAt,
      asker: ADMIN_SEES_INTRO_NAMES ? (named.askerName ?? "Deleted member") : HIDDEN_INTRO_NAMES.asker,
      target: ADMIN_SEES_INTRO_NAMES ? (named.targetName ?? "") : HIDDEN_INTRO_NAMES.target,
      targetCompany: ADMIN_SEES_INTRO_NAMES ? readCompanyFromHeadline(named.targetHeadline ?? null) : null,
      connector: ADMIN_SEES_INTRO_NAMES ? (named.connectorName ?? "") : HIDDEN_INTRO_NAMES.connector,
      state,
      stateWord: readStateWord({ state, acceptedAt: row.acceptedAt, askedTargetAt: row.askedTargetAt, targetAgreedAt: row.targetAgreedAt }),
      tone: TONE_OF[filter],
      filter,
      answeredAt,
      introducedAt: state === INTRO_STATES.completed ? row.closedAt : null,
      outcome: (row.outcome as IntroOutcome | null) ?? null,
      isNamed: ADMIN_SEES_INTRO_NAMES,
    };
  });
}

export function countIntroLog(rows: readonly IntroLogRow[]): Record<IntroLogFilter, number> {
  return {
    all: rows.length,
    open: rows.filter(({ filter }) => filter === INTRO_LOG_FILTERS.open).length,
    made: rows.filter(({ filter }) => filter === INTRO_LOG_FILTERS.made).length,
    declined: rows.filter(({ filter }) => filter === INTRO_LOG_FILTERS.declined).length,
    withdrawn: rows.filter(({ filter }) => filter === INTRO_LOG_FILTERS.withdrawn).length,
  };
}
