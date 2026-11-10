import "server-only";

import type { ModuleIntegration } from "@/platform/modules/integration";

import { introsManifest } from "./manifest";
import { expireDueIntros, readIntroBadgeCount, readIntroCounts } from "./reads";
import { sendDueOutcomeEmails } from "./outcome-email";
import { sendDueConnectorReminders, sendDueExpiryEmails } from "./quiet-intro-emails";
import { sendDueTargetReminders } from "./target-reminder";
import { stopOpenAsksOnBlock } from "./service-blocks";

export const introsModule: ModuleIntegration = {
  manifest: introsManifest,
  readNavigationBadge: async (database, memberId) => readIntroBadgeCount(await readIntroCounts(database, memberId)),
  onMemberBlocked: stopOpenAsksOnBlock,
  jobs: [
    {
      name: "intro-expiry",
      intervalMs: 15 * 60_000,
      run: async (database, environment) => {
        await expireDueIntros(database, null);
        await sendDueExpiryEmails(database, environment);
      },
    },
    { name: "intro-outcome-emails", intervalMs: 15 * 60_000, run: sendDueOutcomeEmails },
    { name: "intro-target-reminders", intervalMs: 15 * 60_000, run: (database, environment) => sendDueTargetReminders(database, environment) },
    { name: "intro-connector-reminders", intervalMs: 15 * 60_000, run: (database, environment) => sendDueConnectorReminders(database, environment) },
  ],
};
