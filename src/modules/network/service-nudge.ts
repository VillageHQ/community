import "server-only";

import { and, count, eq, isNotNull, isNull, lt, ne, or, sql } from "drizzle-orm";

import { user } from "../../platform/database/auth-schema.ts";
import type { Database, DatabaseOrTransaction } from "../../platform/database/client.ts";
import { AUDIT_ACTIONS } from "../../platform/audit/actions.ts";
import { withAdminTransaction } from "../../platform/audit/admin-transaction.ts";
import { recordAdminAction } from "../../platform/audit/record.ts";
import { isActiveMember } from "../../platform/auth/member-status.ts";
import { readFirstName } from "../../platform/design/avatar-identity.ts";
import { escapeHtml, toSingleLine } from "../../platform/email/email-text.ts";
import { EMAIL_KINDS } from "../../platform/email/kinds.ts";
import { queueEmail, readEmailBranding, type EmailBranding } from "../../platform/email/outbox.ts";
import type { Environment } from "../../platform/environment.ts";
import { resolveAppUrl } from "../../platform/http/app-url.ts";
import type { RequestContext } from "../../platform/http/request-context.ts";
import { RequestError } from "../../platform/http/request-error.ts";
import { ROUTES } from "../../platform/http/routes.ts";
import { removeBidiControls } from "../../platform/text/safe-text.ts";
import { memberNetwork, memberPrivacy } from "../members/schema.ts";
import { NETWORK_ERROR_CODES } from "./contract.ts";
import { memberConnectNudge } from "./schema.ts";

export const NUDGE_INTERVAL_DAYS = 30;
const DAY_MS = 24 * 60 * 60 * 1000;
const CONFLICT_STATUS = 409;

function readNudgeCutoff(now: Date) {
  return new Date(now.getTime() - NUDGE_INTERVAL_DAYS * DAY_MS);
}

// Someone other members can actually ask: synced into the community group, a confirmed email, no
// Village account waiting for approval, and still a member. The same rules as intro paths.
function isConnectedAndAskable() {
  return and(
    isNotNull(memberNetwork.groupJoinedAt),
    isNull(memberNetwork.pendingVillageEmail),
    or(eq(user.emailVerified, true), eq(memberNetwork.approvedMemberEmail, sql`lower(${user.email})`)),
  );
}

function isUnconnected() {
  return isNull(memberNetwork.groupJoinedAt);
}

function isNudgeDue(now: Date) {
  return or(isNull(memberConnectNudge.lastSentAt), lt(memberConnectNudge.lastSentAt, readNudgeCutoff(now)));
}

export async function readConnectMeter(database: Database, adminId: string, now = new Date()) {
  const [row] = await database
    .select({
      memberCount: count(),
      connectedCount: sql<number>`count(*) filter (where ${isConnectedAndAskable()})`.mapWith(Number),
      nudgeableCount: sql<number>`count(*) filter (where ${and(isUnconnected(), ne(user.id, adminId), isNudgeDue(now))})`.mapWith(Number),
      unconnectedCount: sql<number>`count(*) filter (where ${isUnconnected()})`.mapWith(Number),
    })
    .from(user)
    .leftJoin(memberNetwork, eq(memberNetwork.userId, user.id))
    .leftJoin(memberConnectNudge, eq(memberConnectNudge.userId, user.id))
    .where(isActiveMember(now));
  return {
    memberCount: row?.memberCount ?? 0,
    connectedCount: row?.connectedCount ?? 0,
    unconnectedCount: row?.unconnectedCount ?? 0,
    nudgeableCount: row?.nudgeableCount ?? 0,
  };
}

// Founderhall's words (Admin › Village › Nudge): plain text first; the HTML part says the same.
export function renderConnectNudge(memberName: string, communityName: string, link: string, accentColor: string) {
  const firstName = readFirstName(toSingleLine(memberName));
  const community = toSingleLine(communityName);
  const subject = `Find warm paths through your own network and ${community}’`;
  const greeting = firstName ? `Hi ${firstName},` : "Hi,";
  const body = `Members of ${community} can connect their networks, so search finds people they can introduce each other to. Connect yours and the same search covers the people you know too.`;
  const promise = "Members who search can see that you know a person and ask you for an intro. They can’t download your contacts, see how you know them beyond a warmth word, or reach anyone without your yes.";
  const action = "Connect your network";
  const after = "It takes a couple of minutes on the network service’s own screen. You can disconnect any time.";
  const footer = `Sent by ${community} via its member portal.`;
  const html = [
    `<div style="font-family:Arial,sans-serif;font-size:16px;line-height:24px;color:#0c2427;max-width:520px;margin:0 auto;padding:24px">`,
    `<p style="margin:0 0 12px">${escapeHtml(greeting)}</p>`,
    `<p style="margin:0 0 12px">${escapeHtml(body)}</p>`,
    `<p style="margin:0 0 12px">${escapeHtml(promise)}</p>`,
    `<p style="margin:0 0 12px">${escapeHtml(action)}: <a href="${escapeHtml(link)}" style="color:${accentColor};font-weight:700">${escapeHtml(link)}</a></p>`,
    `<p style="margin:0 0 12px">${escapeHtml(after)}</p>`,
    `<p style="margin:0;color:#59625d;font-size:13px">${escapeHtml(footer)}</p>`,
    `</div>`,
  ].join("");
  const text = [greeting, body, promise, `${action}: ${link}`, after, footer].join("\n\n");
  return { subject, html, text };
}

// Claimed by one conditional upsert, so two admins clicking at once can't remind anyone twice.
async function claimNudge(transaction: DatabaseOrTransaction, memberId: string, now: Date) {
  const claimed = await transaction
    .insert(memberConnectNudge)
    .values({ userId: memberId, lastSentAt: now })
    .onConflictDoUpdate({
      target: memberConnectNudge.userId,
      set: { lastSentAt: now },
      setWhere: lt(memberConnectNudge.lastSentAt, readNudgeCutoff(now)),
    })
    .returning({ userId: memberConnectNudge.userId });
  return claimed.length > 0;
}

// Who a nudge goes to: members who haven't connected, or members who connected but don't take intro asks.
export const NUDGE_AUDIENCES = { unconnected: "unconnected", noAsks: "no_asks" } as const;

export type NudgeAudience = (typeof NUDGE_AUDIENCES)[keyof typeof NUDGE_AUDIENCES];

export function isInNudgeAudience(audience: NudgeAudience) {
  return audience === NUDGE_AUDIENCES.noAsks ? and(isNotNull(memberNetwork.groupJoinedAt), eq(memberPrivacy.acceptsIntroAsks, false)) : isUnconnected();
}

async function queueNudges(transaction: DatabaseOrTransaction, environment: Environment, branding: EmailBranding, adminId: string, now: Date, audience: NudgeAudience) {
  const members = await transaction
    .select({ id: user.id, name: user.name, email: user.email })
    .from(user)
    .leftJoin(memberNetwork, eq(memberNetwork.userId, user.id))
    .leftJoin(memberPrivacy, eq(memberPrivacy.userId, user.id))
    .leftJoin(memberConnectNudge, eq(memberConnectNudge.userId, user.id))
    .where(and(isActiveMember(now), isInNudgeAudience(audience), ne(user.id, adminId), isNudgeDue(now)));

  const link = `${resolveAppUrl(environment)}${ROUTES.network}`;
  let queuedCount = 0;
  for (const member of members) {
    if (!(await claimNudge(transaction, member.id, now))) continue;
    const queuedId = await queueEmail(transaction, environment, {
      kind: EMAIL_KINDS.connectNudge,
      to: member.email,
      memberId: member.id,
      dedupeKey: `connect-nudge-${member.id}-${now.toISOString()}`,
      ...renderConnectNudge(removeBidiControls(member.name), branding.name, link, branding.accentColor),
    });
    if (queuedId) queuedCount += 1;
  }
  return queuedCount;
}

export async function nudgeUnconnectedMembers({ database, environment, member }: RequestContext, now = new Date(), audience: NudgeAudience = NUDGE_AUDIENCES.unconnected) {
  const branding = await readEmailBranding(database, environment);
  if (!branding) {
    throw new RequestError(CONFLICT_STATUS, NETWORK_ERROR_CODES.notConfigured, "Reminders go by email. Turn on email in Settings first.");
  }
  return withAdminTransaction(database, member.id, async (transaction) => {
    const queuedCount = await queueNudges(transaction, environment, branding, member.id, now, audience);
    if (queuedCount > 0) {
      await recordAdminAction(transaction, member.id, {
        action: AUDIT_ACTIONS.connectNudgeSent,
        detail: `${queuedCount === 1 ? "1 member" : `${queuedCount} members`}${audience === NUDGE_AUDIENCES.noAsks ? " not allowing asks" : ""}`,
      });
    }
    return queuedCount;
  });
}
