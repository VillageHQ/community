import "server-only";

import { AUDIT_ACTIONS } from "../../platform/audit/actions.ts";
import { withAdminTransaction } from "../../platform/audit/admin-transaction.ts";
import { recordAdminAction } from "../../platform/audit/record.ts";
import type { Database, DatabaseOrTransaction } from "../../platform/database/client.ts";
import type { RequestContext } from "../../platform/http/request-context.ts";
import { logError } from "../../platform/observability/route-logging.ts";
import { INSTANCE_SETTING_KEYS } from "../../platform/settings/schema.ts";
import { readSettings, saveSettings } from "../../platform/settings/store.ts";
import { readDailyLookupLimit, readMonthlyCreditCap, saveDailyLookupLimit, saveMonthlyCreditCap } from "../../platform/village/settings.ts";
import { NIGHTLY_FILL_IN, type VillageLimitsBody } from "./contract-village-admin.ts";
import type { FillInRun } from "./service-fill-in.ts";
import { setVillageSearchSettings } from "./service-settings.ts";

// The last profile fill-in run, for Admin › Village ("Last run … : 12 checked, 9 found …").
const FILL_IN_LAST_RUN_KEY = "village_fill_in_last_run";

export const FILL_IN_TRIGGERS = { admin: "by an admin", nightly: "nightly" } as const;

export type FillInTrigger = (typeof FILL_IN_TRIGGERS)[keyof typeof FILL_IN_TRIGGERS];

export type FillInLastRun = FillInRun & { finishedAt: string; trigger: FillInTrigger };

export type VillageAdminSettings = { dataRegion: string; dpaUrl: string; isNightlyFillInOn: boolean };

export async function readVillageAdminSettings(database: DatabaseOrTransaction): Promise<VillageAdminSettings> {
  const settings = await readSettings(database, [INSTANCE_SETTING_KEYS.villageDataRegion, INSTANCE_SETTING_KEYS.villageDpaUrl, INSTANCE_SETTING_KEYS.villageFillInNightly]);
  return {
    dataRegion: settings.get(INSTANCE_SETTING_KEYS.villageDataRegion) ?? "",
    dpaUrl: settings.get(INSTANCE_SETTING_KEYS.villageDpaUrl) ?? "",
    isNightlyFillInOn: settings.get(INSTANCE_SETTING_KEYS.villageFillInNightly) !== NIGHTLY_FILL_IN.off,
  };
}

export async function isNightlyFillInOn(database: DatabaseOrTransaction) {
  return (await readVillageAdminSettings(database)).isNightlyFillInOn;
}

function describeChanges(before: VillageAdminSettings, after: VillageAdminSettings) {
  const changes = [];
  if (before.dataRegion !== after.dataRegion) changes.push(`data region ${after.dataRegion || "blank"}`);
  if (before.dpaUrl !== after.dpaUrl) changes.push(`data agreement ${after.dpaUrl || "blank"}`);
  if (before.isNightlyFillInOn !== after.isNightlyFillInOn) changes.push(`nightly fill-in ${after.isNightlyFillInOn ? "on" : "off"}`);
  return changes.join(", ");
}

// One Save, as in Founderhall. Each part keeps its own audit line; a part that didn't change writes none.
export async function saveVillageLimits(context: RequestContext, body: VillageLimitsBody) {
  const { database, member } = context;
  const [cap, dailyLimit, before] = await Promise.all([readMonthlyCreditCap(database), readDailyLookupLimit(database), readVillageAdminSettings(database)]);
  await setVillageSearchSettings(context, body);
  const after: VillageAdminSettings = { dataRegion: body.dataRegion, dpaUrl: body.dpaUrl, isNightlyFillInOn: body.isNightlyFillInOn };
  await withAdminTransaction(database, member.id, async (transaction) => {
    if (body.cap !== cap) {
      await saveMonthlyCreditCap(transaction, body.cap);
      await recordAdminAction(transaction, member.id, { action: AUDIT_ACTIONS.monthlyCapChanged, detail: String(body.cap) });
    }
    if (body.dailyLimit !== dailyLimit) {
      await saveDailyLookupLimit(transaction, body.dailyLimit);
      await recordAdminAction(transaction, member.id, { action: AUDIT_ACTIONS.dailyLimitChanged, detail: String(body.dailyLimit) });
    }
    const changes = describeChanges(before, after);
    if (!changes) return;
    await saveSettings(transaction, {
      [INSTANCE_SETTING_KEYS.villageDataRegion]: after.dataRegion,
      [INSTANCE_SETTING_KEYS.villageDpaUrl]: after.dpaUrl,
      [INSTANCE_SETTING_KEYS.villageFillInNightly]: after.isNightlyFillInOn ? NIGHTLY_FILL_IN.on : NIGHTLY_FILL_IN.off,
    });
    await recordAdminAction(transaction, member.id, { action: AUDIT_ACTIONS.villageSettingsChanged, detail: changes });
  });
}

export async function readFillInLastRun(database: Database): Promise<FillInLastRun | null> {
  const stored = (await readSettings(database, [FILL_IN_LAST_RUN_KEY])).get(FILL_IN_LAST_RUN_KEY);
  if (!stored) return null;
  try {
    return JSON.parse(stored) as FillInLastRun;
  } catch {
    return null;
  }
}

// Bookkeeping for the admin page: it must never fail the run it describes. A night with nobody due isn't a run.
export async function recordFillInRun(database: Database, run: FillInRun, trigger: FillInTrigger, finishedAt = new Date()) {
  if (trigger === FILL_IN_TRIGGERS.nightly && run.checked === 0 && run.stoppedBy === null) return;
  try {
    const lastRun: FillInLastRun = { ...run, finishedAt: finishedAt.toISOString(), trigger };
    await saveSettings(database, { [FILL_IN_LAST_RUN_KEY]: JSON.stringify(lastRun) });
  } catch (error) {
    logError("village-fill-in", error);
  }
}
