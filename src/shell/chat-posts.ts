import "server-only";

import { and, count, eq, gte } from "drizzle-orm";

import { ASK_KINDS, ASKS_PAGE } from "@/modules/asks/contract";
import { asksManifest } from "@/modules/asks/manifest";
import { isOpenAsk } from "@/modules/asks/reads";
import { readAsksForChat } from "@/modules/asks/reads-chat";
import { ask } from "@/modules/asks/schema";
import { chatManifest } from "@/modules/chat/manifest";
import { composeAskPost, composeWeekPost, readPostedName } from "@/modules/chat/rules";
import { postChatItems, readPostingChannels, type ChatItem } from "@/modules/chat/service-posts";
import { INTRO_STATES } from "@/modules/intros/contract";
import { introsManifest } from "@/modules/intros/manifest";
import { introRequest } from "@/modules/intros/schema";
import { isActiveMember } from "@/platform/auth/member-status";
import { readBranding } from "@/platform/branding/branding";
import { user } from "@/platform/database/auth-schema";
import type { Database } from "@/platform/database/client";
import type { Environment } from "@/platform/environment";
import { resolveAppUrl } from "@/platform/http/app-url";
import { ROUTES } from "@/platform/http/routes";
import { jobLease } from "@/platform/jobs/schema";
import { readCurrentWeek } from "@/platform/weekly-email/schedule";
import { readWeeklySchedule } from "@/platform/weekly-email/schedule-store";

import { readEnabledIds } from "./enabled-modules";

export const WEEKLY_EMAIL_JOB_NAME = "weekly-email";

const DAY_MS = 24 * 60 * 60 * 1000;
// An ask not posted within two days (the module was off, the channel was paused) is old news, so it's skipped.
const ASK_FRESHNESS_MS = 2 * DAY_MS;
const WEEK_MS = 7 * DAY_MS;

export const CHAT_REF_PREFIXES = { ask: "ask:", week: "week:" } as const;

async function readAskItems(database: Database, since: Date, community: string, appUrl: string, now: Date): Promise<ChatItem[]> {
  const asks = await readAsksForChat(database, since, now);
  return asks.map(({ id, title, createdAt, authorName, isAuthorListed }) => ({
    ref: `${CHAT_REF_PREFIXES.ask}${id}`,
    happenedAt: createdAt,
    compose: (kind) => composeAskPost(kind, { community, authorName: readPostedName(authorName, isAuthorListed), title, url: `${appUrl}${ASKS_PAGE}` }),
  }));
}

async function readWeeklyEmailFinishedAt(database: Database) {
  const [lease] = await database.select({ lastFinishedAt: jobLease.lastFinishedAt }).from(jobLease).where(eq(jobLease.name, WEEKLY_EMAIL_JOB_NAME));
  return lease?.lastFinishedAt ?? null;
}

async function readIntrosMade(database: Database, now: Date) {
  const [row] = await database
    .select({ made: count() })
    .from(introRequest)
    .where(and(eq(introRequest.state, INTRO_STATES.completed), eq(introRequest.isWithheld, false), gte(introRequest.closedAt, new Date(now.getTime() - WEEK_MS))));
  return row?.made ?? 0;
}

async function readOpenAskCount(database: Database, now: Date) {
  const [row] = await database
    .select({ open: count() })
    .from(ask)
    .innerJoin(user, eq(user.id, ask.authorId))
    .where(and(eq(ask.kind, ASK_KINDS.ask), isOpenAsk(now), isActiveMember(now)));
  return row?.open ?? 0;
}

// The weekly line: once the weekly email job has finished its run for this week, and only within a day of it.
async function readWeekItem(database: Database, enabledIds: ReadonlySet<string>, community: string, appUrl: string, now: Date): Promise<ChatItem | null> {
  const week = readCurrentWeek(now, await readWeeklySchedule(database));
  if (!week || now.getTime() - week.at.getTime() > DAY_MS) return null;
  const finishedAt = await readWeeklyEmailFinishedAt(database);
  if (!finishedAt || finishedAt < week.at) return null;
  const [introsMade, openAsks] = await Promise.all([
    enabledIds.has(introsManifest.id) ? readIntrosMade(database, now) : 0,
    enabledIds.has(asksManifest.id) ? readOpenAskCount(database, now) : 0,
  ]);
  return {
    ref: `${CHAT_REF_PREFIXES.week}${week.weekKey}`,
    happenedAt: week.at,
    compose: (kind) => composeWeekPost(kind, { community, introsMade, openAsks, url: `${appUrl}${ROUTES.admin}` }),
  };
}

// The timed job. It runs after the weekly email job in the same tick, so the weekly line follows the run.
export async function runChatPosts(database: Database, environment: Environment, now = new Date()) {
  const enabledIds = await readEnabledIds(database);
  if (!enabledIds.has(chatManifest.id)) return [];
  const channels = await readPostingChannels(database);
  if (channels.length === 0) return [];

  const earliest = Math.min(...channels.map(({ postsFromAt }) => postsFromAt.getTime()));
  const since = new Date(Math.max(earliest, now.getTime() - ASK_FRESHNESS_MS));
  const branding = await readBranding(database);
  const appUrl = resolveAppUrl(environment);
  const [askItems, weekItem] = await Promise.all([
    enabledIds.has(asksManifest.id) ? readAskItems(database, since, branding.name, appUrl, now) : [],
    readWeekItem(database, enabledIds, branding.name, appUrl, now),
  ]);
  return postChatItems(database, environment, weekItem ? [...askItems, weekItem] : askItems);
}

export const CHAT_POSTS_JOB_NAME = "chat-posts";
