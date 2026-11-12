import "server-only";

import { and, eq, sql } from "drizzle-orm";

import { isActiveMember } from "../auth/member-status.ts";
import { MEMBER_ROLES } from "../auth/roles.ts";
import { user } from "../database/auth-schema.ts";
import type { Database } from "../database/client.ts";
import { pickOnAccent } from "../design/accent.ts";
import { escapeHtml } from "../email/email-text.ts";
import { EMAIL_KINDS } from "../email/kinds.ts";
import { queueEmail, readEmailBranding } from "../email/outbox.ts";
import type { Environment } from "../environment.ts";
import { resolveAppUrl } from "../http/app-url.ts";
import { ROUTES } from "../http/routes.ts";
import { logError } from "../observability/route-logging.ts";
import { INSTANCE_SETTING_KEYS, instanceSettings } from "../settings/schema.ts";

// One email to the admins when Village stops working for the community: out of credits, not answering, or refusing
// the keys. Each is sent once per spell of trouble (the caller passes only a new spell) and at most once a day, so a
// flapping Village never floods the admins. The console says the same on Home and Admin › Village.
export const VILLAGE_ALERTS = { outOfCredits: "out_of_credits", down: "down", keysRejected: "keys_rejected" } as const;

export type VillageAlert = (typeof VILLAGE_ALERTS)[keyof typeof VILLAGE_ALERTS];

const ALERTED_KEYS: Record<VillageAlert, string> = {
  [VILLAGE_ALERTS.outOfCredits]: INSTANCE_SETTING_KEYS.villageAlertedOutOfCreditsAt,
  [VILLAGE_ALERTS.down]: INSTANCE_SETTING_KEYS.villageAlertedDownAt,
  [VILLAGE_ALERTS.keysRejected]: INSTANCE_SETTING_KEYS.villageAlertedKeysRejectedAt,
};

export const VILLAGE_ALERT_EVERY_MS = 24 * 60 * 60 * 1000;

const WORDS: Record<VillageAlert, { subject: (name: string) => string; heading: string; body: (name: string) => string; action: string }> = {
  [VILLAGE_ALERTS.outOfCredits]: {
    subject: (name) => `${name}: Village is out of credits`,
    heading: "Village is out of credits",
    body: (name) =>
      `Village, the people-search service, says ${name}'s account has no credits left. Network search, intro paths and profile fill-in are paused, and members see "Lookups are paused" instead of an error. Everything else works. Top up at Village and lookups start again by themselves.`,
    action: "Open Admin › Village",
  },
  [VILLAGE_ALERTS.down]: {
    subject: (name) => `${name}: Village isn't answering`,
    heading: "Village isn't answering",
    body: (name) =>
      `Village, the people-search service, stopped answering ${name}'s calls. Network search and intro paths are paused, and members see "Search is unavailable right now" instead of an error. Everything else works. This clears by itself after the next call Village answers.`,
    action: "Open Admin › Village",
  },
  [VILLAGE_ALERTS.keysRejected]: {
    subject: (name) => `${name}: Village refused the keys`,
    heading: "Village refused this community's keys",
    body: (name) =>
      `Village, the people-search service, said no to ${name}'s keys. Network search and intro paths are paused, and members see "Search is unavailable right now" instead of an error. Everything else works. Check the Village keys in the console.`,
    action: "Check the Village keys",
  },
};

export function renderVillageAlert(alert: VillageAlert, communityName: string, link: string, accentColor: string) {
  const words = WORDS[alert];
  const body = words.body(communityName);
  const html = [
    `<div style="font-family:Arial,sans-serif;font-size:16px;line-height:24px;color:#0c2427;max-width:520px;margin:0 auto;padding:24px">`,
    `<h1 style="font-size:24px;line-height:30px;margin:0 0 12px">${escapeHtml(words.heading)}</h1>`,
    `<p style="margin:0 0 24px">${escapeHtml(body)}</p>`,
    `<a href="${escapeHtml(link)}" style="display:inline-block;padding:14px 28px;border-radius:999px;background:${accentColor};color:${pickOnAccent(accentColor)};font-weight:700;text-decoration:none">${escapeHtml(words.action)}</a>`,
    `</div>`,
  ].join("");
  return { subject: words.subject(communityName), html, text: `${body}\n\n${words.action}: ${link}` };
}

// Claims the alert (one conditional upsert: free, or last sent over a day ago) and queues one email per active admin
// in the same transaction, so parallel calls send it once. Returns how many emails were queued.
export async function alertAdminsAboutVillage(database: Database, alert: VillageAlert, environment: Environment = process.env, now = new Date()) {
  const branding = await readEmailBranding(database, environment);
  return database.transaction(async (transaction) => {
    const claimed = await transaction
      .insert(instanceSettings)
      .values({ key: ALERTED_KEYS[alert], value: now.toISOString(), updatedAt: now })
      .onConflictDoUpdate({
        target: instanceSettings.key,
        set: { value: sql`excluded.value`, updatedAt: now },
        where: sql`${instanceSettings.updatedAt} <= ${new Date(now.getTime() - VILLAGE_ALERT_EVERY_MS).toISOString()}`,
      })
      .returning({ key: instanceSettings.key });
    if (claimed.length === 0 || !branding) return 0;
    const admins = await transaction
      .select({ id: user.id, email: user.email })
      .from(user)
      .where(and(eq(user.role, MEMBER_ROLES.admin), isActiveMember()));
    const link = `${resolveAppUrl(environment)}${ROUTES.adminVillage}`;
    const email = renderVillageAlert(alert, branding.name, link, branding.accentColor);
    for (const admin of admins) {
      await queueEmail(transaction, environment, { kind: EMAIL_KINDS.villageAlert, to: admin.email, memberId: admin.id, dedupeKey: `village-alert-${alert}-${now.toISOString()}-${admin.id}`, ...email });
    }
    return admins.length;
  });
}

// For callers on a member's request: a failed alert never costs the member their answer.
export async function alertAdminsAboutVillageSafely(database: Database, alert: VillageAlert, environment?: Environment) {
  try {
    return await alertAdminsAboutVillage(database, alert, environment);
  } catch (error) {
    logError("village-alert", error);
    return 0;
  }
}
