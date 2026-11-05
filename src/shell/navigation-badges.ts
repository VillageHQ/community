import "server-only";

import type { Database } from "../platform/database/client.ts";
import type { Environment } from "../platform/environment.ts";
import { readAdminTabFacts } from "./admin-badges.ts";
import { NAVIGATION_BADGES, type NavigationBadgeCounts } from "./navigation-rules.ts";

export async function readNavigationBadges(database: Database, environment: Environment): Promise<NavigationBadgeCounts> {
  const { setupStepsLeft, membersBadge, reportsBadge, creditsBadge } = await readAdminTabFacts(database, environment);
  return { [NAVIGATION_BADGES.admin]: setupStepsLeft + membersBadge + reportsBadge + creditsBadge };
}
