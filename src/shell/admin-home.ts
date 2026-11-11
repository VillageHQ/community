import "server-only";

import type { Database } from "../platform/database/client.ts";
import type { Environment } from "../platform/environment.ts";
import { ROUTES } from "../platform/http/routes.ts";
import { VILLAGE_TROUBLES } from "../platform/village/health.ts";
import { INVITE_LIST_ID } from "../modules/admin/contract.ts";
import { readQuarterIntroLine } from "../modules/admin/reads-partner-report.ts";
import { CONNECTOR_REMINDER_AFTER_DAYS } from "../modules/intros/contract.ts";
import { introsManifest } from "../modules/intros/manifest.ts";
import { networkManifest } from "../modules/network/manifest.ts";
import { readStuckIntroCount } from "../modules/intros/reads-report.ts";
import { readInviteCounts } from "../modules/members/service-invites.ts";
import { readAdminTabFacts, type AdminTabFacts } from "./admin-badges.ts";
import { SETUP_STEPS } from "./admin-setup-steps.ts";
import { readEnabledIds } from "./enabled-modules.ts";

export const ADMIN_HOME_ITEMS = {
  setup: "setup",
  village: "village",
  reports: "reports",
  waitingMembers: "waiting-members",
  invites: "invites",
  stuckIntros: "stuck-intros",
} as const;

export type AdminHomeItem = { id: (typeof ADMIN_HOME_ITEMS)[keyof typeof ADMIN_HOME_ITEMS]; label: string; href: string; isUrgent: boolean };

type AdminHomeCounts = { pendingInvites: number; stuckIntros: number; isNetworkOn?: boolean };

// With network on, the Village item opens the Village check, which says what's wrong and links to the fix.
function readVillageHref(trouble: string | null, isNetworkOn: boolean) {
  if (isNetworkOn) return ROUTES.adminVillage;
  return trouble === VILLAGE_TROUBLES.keysRejected ? `${ROUTES.adminSettings}?step=${SETUP_STEPS.keys}` : ROUTES.adminVillage;
}

function plural(count: number, one: string, many: string) {
  return `${count} ${count === 1 ? one : many}`;
}

// What needs the admin, most urgent first. Every item is a count and a link; an item at zero is left out.
export function readAdminHomeItems(facts: AdminTabFacts, { pendingInvites, stuckIntros, isNetworkOn = false }: AdminHomeCounts): AdminHomeItem[] {
  const items: (AdminHomeItem | null)[] = [
    facts.villageTrouble
      ? {
          id: ADMIN_HOME_ITEMS.village,
          label: facts.villageTrouble.trouble === VILLAGE_TROUBLES.keysRejected ? "Village refused your keys" : "Village isn't answering",
          href: readVillageHref(facts.villageTrouble.trouble, isNetworkOn),
          isUrgent: true,
        }
      : null,
    facts.reportsBadge > 0
      ? { id: ADMIN_HOME_ITEMS.reports, label: `${plural(facts.reportsBadge, "report", "reports")} waiting`, href: ROUTES.adminReports, isUrgent: true }
      : null,
    facts.membersBadge > 0
      ? { id: ADMIN_HOME_ITEMS.waitingMembers, label: `${plural(facts.membersBadge, "person", "people")} waiting for your OK`, href: ROUTES.adminMembers, isUrgent: false }
      : null,
    pendingInvites > 0
      ? { id: ADMIN_HOME_ITEMS.invites, label: `${plural(pendingInvites, "invite", "invites")} not accepted yet`, href: `${ROUTES.adminMembers}#${INVITE_LIST_ID}`, isUrgent: false }
      : null,
    stuckIntros > 0
      ? { id: ADMIN_HOME_ITEMS.stuckIntros, label: `${plural(stuckIntros, "intro", "intros")} asked over ${CONNECTOR_REMINDER_AFTER_DAYS} days ago, still no answer`, href: ROUTES.adminReport, isUrgent: false }
      : null,
    facts.setupStepsLeft > 0
      ? { id: ADMIN_HOME_ITEMS.setup, label: `${plural(facts.setupStepsLeft, "setup step", "setup steps")} left`, href: ROUTES.adminSetup, isUrgent: false }
      : null,
  ];
  return items.filter((item) => item !== null);
}

export async function readAdminHome(database: Database, environment: Environment, now = new Date()) {
  const [facts, enabledIds, inviteCounts] = await Promise.all([readAdminTabFacts(database, environment), readEnabledIds(database), readInviteCounts(database, now)]);
  const isIntrosOn = enabledIds.has(introsManifest.id);
  // One after the other: both apply due expiries first, and the line must read the same rows the report would.
  const quarter = await readQuarterIntroLine(database, now);
  const stuckIntros = isIntrosOn ? await readStuckIntroCount(database, now) : 0;
  return { facts, quarter, items: readAdminHomeItems(facts, { pendingInvites: inviteCounts.pending, stuckIntros, isNetworkOn: enabledIds.has(networkManifest.id) }) };
}
