export { formatDayWord, HOSTED_BY, isDay, PLANS, type HostedBy, type Plan } from "./plan-api.ts";
import type { DatabaseOrTransaction } from "../database/client.ts";
import { HOSTED_BY, isDay, PLANS, type HostedBy, type Plan } from "./plan-api.ts";
import { INSTANCE_SETTING_KEYS } from "./schema.ts";
import { readSettings } from "./store.ts";

export type PlanSettings = { savedPlan: Plan | ""; plan: Plan; hostedBy: HostedBy; managedSetupBy: string };

export async function readPlanSettings(database: DatabaseOrTransaction): Promise<PlanSettings> {
  const settings = await readSettings(database, [INSTANCE_SETTING_KEYS.plan, INSTANCE_SETTING_KEYS.hostingBy, INSTANCE_SETTING_KEYS.managedSetupBy]);
  const saved = settings.get(INSTANCE_SETTING_KEYS.plan);
  const savedPlan = saved === PLANS.managed || saved === PLANS.selfHost ? saved : "";
  const managedSetupBy = settings.get(INSTANCE_SETTING_KEYS.managedSetupBy) ?? "";
  return {
    savedPlan,
    plan: savedPlan || PLANS.selfHost,
    hostedBy: settings.get(INSTANCE_SETTING_KEYS.hostingBy) === HOSTED_BY.managed ? HOSTED_BY.managed : HOSTED_BY.ourselves,
    managedSetupBy: isDay(managedSetupBy) ? managedSetupBy : "",
  };
}
