import { and, eq, isNull } from "drizzle-orm";

import { user } from "../database/auth-schema.ts";
import type { Database } from "../database/client.ts";
import { isActiveMember } from "../auth/member-status.ts";
import { MEMBER_ROLES } from "../auth/roles.ts";
import { pickOnAccent } from "../design/accent.ts";
import { escapeHtml } from "../email/email-text.ts";
import { EMAIL_KINDS } from "../email/kinds.ts";
import { queueEmail, readEmailBranding } from "../email/outbox.ts";
import type { Environment } from "../environment.ts";
import { resolveAppUrl } from "../http/app-url.ts";
import { ROUTES } from "../http/routes.ts";
import { NEAR_CAP_PERCENT } from "./contract.ts";
import { villageMonthlyUsage } from "./schema.ts";

export const CREDIT_WARNING_LEVELS = { nearCap: NEAR_CAP_PERCENT, atCap: 100 } as const;

export type CreditWarningLevel = (typeof CREDIT_WARNING_LEVELS)[keyof typeof CREDIT_WARNING_LEVELS];

type CreditWarning = { usageMonth: string; cap: number; level: CreditWarningLevel };

function renderCreditWarning({ cap, level }: CreditWarning, communityName: string, link: string, accentColor: string) {
  const isAtCap = level === CREDIT_WARNING_LEVELS.atCap;
  const capText = cap.toLocaleString("en-US");
  const subject = isAtCap
    ? `${communityName} reached its monthly Village credit cap`
    : `${communityName} has used ${level}% of this month's Village credits`;
  const body = isAtCap
    ? `${communityName} reached its cap of about ${capText} Village credits this month. Network search, intro paths and profile fill-in are paused until the 1st of next month (UTC), or until you raise the cap.`
    : `${communityName} has used about ${level}% of its ${capText} Village credits this month. Lookups stop at the cap. You can raise it on the Credits page.`;
  const note = "These are this site's own estimates. Village's usage page has the exact amount.";
  const action = "Open the Credits page";
  const html = [
    `<div style="font-family:Arial,sans-serif;font-size:16px;line-height:24px;color:#0c2427;max-width:520px;margin:0 auto;padding:24px">`,
    `<h1 style="font-size:24px;line-height:30px;margin:0 0 12px">${escapeHtml(isAtCap ? "Your monthly cap is used up" : "Credits are running low")}</h1>`,
    `<p style="margin:0 0 12px">${escapeHtml(body)}</p>`,
    `<p style="margin:0 0 24px;color:#4b5f62">${escapeHtml(note)}</p>`,
    `<a href="${escapeHtml(link)}" style="display:inline-block;padding:14px 28px;border-radius:999px;background:${accentColor};color:${pickOnAccent(accentColor)};font-weight:700;text-decoration:none">${escapeHtml(action)}</a>`,
    `</div>`,
  ].join("");
  return { subject, html, text: `${body}\n\n${note}\n\n${action}: ${link}` };
}

// Each level is claimed once a month by one conditional UPDATE, and its emails are queued in the
// same transaction, so parallel calls send one email per admin per level.
export async function warnAdminsAboutCredits(database: Database, environment: Environment, warning: CreditWarning) {
  const branding = await readEmailBranding(database, environment);
  const isAtCap = warning.level === CREDIT_WARNING_LEVELS.atCap;
  const claimedColumn = isAtCap ? villageMonthlyUsage.warnedAtCapAt : villageMonthlyUsage.warnedNearCapAt;
  const now = new Date();

  return database.transaction(async (transaction) => {
    const claimed = await transaction
      .update(villageMonthlyUsage)
      .set(isAtCap ? { warnedAtCapAt: now } : { warnedNearCapAt: now })
      .where(and(eq(villageMonthlyUsage.usageMonth, warning.usageMonth), isNull(claimedColumn)))
      .returning({ usageMonth: villageMonthlyUsage.usageMonth });
    if (claimed.length === 0 || !branding) return 0;

    const admins = await transaction
      .select({ id: user.id, email: user.email })
      .from(user)
      .where(and(eq(user.role, MEMBER_ROLES.admin), isActiveMember()));
    const link = `${resolveAppUrl(environment)}${ROUTES.adminCredits}`;
    const email = renderCreditWarning(warning, branding.name, link, branding.accentColor);
    for (const admin of admins) {
      await queueEmail(transaction, environment, {
        kind: EMAIL_KINDS.creditWarning,
        to: admin.email,
        memberId: admin.id,
        dedupeKey: `credit-warning-${warning.usageMonth}-${warning.level}-${admin.id}`,
        ...email,
      });
    }
    return admins.length;
  });
}
