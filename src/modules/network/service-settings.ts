import "server-only";

import { and, asc, eq, isNotNull, or } from "drizzle-orm";

import { isActiveMember } from "../../platform/auth/member-status.ts";
import { user } from "../../platform/database/auth-schema.ts";
import { RequestError } from "../../platform/http/request-error.ts";
import { memberNetwork } from "../members/schema.ts";
import { INTRODUCER_RULES, SEARCH_SCOPES, type IntroducerRule, type SearchScope, type VillageSettingsBody } from "./contract-village-settings.ts";

import type { Database, DatabaseOrTransaction } from "../../platform/database/client.ts";
import { INSTANCE_SETTING_KEYS, instanceSettings } from "../../platform/settings/schema.ts";
import { readSettings, saveSettings } from "../../platform/settings/store.ts";
import type { RequestContext } from "../../platform/http/request-context.ts";
import { saveDailyLookupLimit, saveMonthlyCreditCap } from "../../platform/village/settings.ts";
import { AUDIT_ACTIONS } from "../../platform/audit/actions.ts";
import { withAdminTransaction } from "../../platform/audit/admin-transaction.ts";
import { recordAdminAction } from "../../platform/audit/record.ts";

const UNPROCESSABLE_STATUS = 422;

export type VillageGroup = { id: string; inviteLink: string };

export async function readVillageGroup(database: Database): Promise<VillageGroup | null> {
  const settings = await readSettings(database, [
    INSTANCE_SETTING_KEYS.villageGroupId,
    INSTANCE_SETTING_KEYS.villageGroupInviteLink,
  ]);
  const id = settings.get(INSTANCE_SETTING_KEYS.villageGroupId);
  const inviteLink = settings.get(INSTANCE_SETTING_KEYS.villageGroupInviteLink);
  if (!id || !inviteLink) return null;
  return { id, inviteLink };
}

export async function saveVillageGroup(database: DatabaseOrTransaction, group: VillageGroup) {
  await saveSettings(database, {
    [INSTANCE_SETTING_KEYS.villageGroupId]: group.id,
    [INSTANCE_SETTING_KEYS.villageGroupInviteLink]: group.inviteLink,
  });
}

export async function deleteVillageGroup(database: Database) {
  await database
    .delete(instanceSettings)
    .where(
      or(
        eq(instanceSettings.key, INSTANCE_SETTING_KEYS.villageGroupId),
        eq(instanceSettings.key, INSTANCE_SETTING_KEYS.villageGroupInviteLink),
      ),
    );
}

export function setDailyLookupLimit({ database, member }: RequestContext, limit: number) {
  return withAdminTransaction(database, member.id, async (transaction) => {
    await saveDailyLookupLimit(transaction, limit);
    await recordAdminAction(transaction, member.id, { action: AUDIT_ACTIONS.dailyLimitChanged, detail: String(limit) });
  });
}

export function setMonthlyCreditCap({ database, member }: RequestContext, cap: number) {
  return withAdminTransaction(database, member.id, async (transaction) => {
    await saveMonthlyCreditCap(transaction, cap);
    await recordAdminAction(transaction, member.id, { action: AUDIT_ACTIONS.monthlyCapChanged, detail: String(cap) });
  });
}

export type VillageSearchSettings = {
  searchScope: SearchScope;
  introducers: IntroducerRule;
  chosenIntroducerIds: string[];
  serviceEmail: string | null;
};

function readChosenIds(stored: string | undefined) {
  if (!stored) return [];
  try {
    const parsed: unknown = JSON.parse(stored);
    return Array.isArray(parsed) ? parsed.filter((id): id is string => typeof id === "string") : [];
  } catch {
    return [];
  }
}

// No stored choice is the default: search the members' networks, and every member who shares may introduce.
export async function readVillageSearchSettings(database: DatabaseOrTransaction): Promise<VillageSearchSettings> {
  const settings = await readSettings(database, [
    INSTANCE_SETTING_KEYS.villageSearchScope,
    INSTANCE_SETTING_KEYS.villageIntroducers,
    INSTANCE_SETTING_KEYS.villageChosenIntroducerIds,
    INSTANCE_SETTING_KEYS.villageServiceEmail,
  ]);
  return {
    searchScope: settings.get(INSTANCE_SETTING_KEYS.villageSearchScope) === SEARCH_SCOPES.everyone ? SEARCH_SCOPES.everyone : SEARCH_SCOPES.network,
    introducers: settings.get(INSTANCE_SETTING_KEYS.villageIntroducers) === INTRODUCER_RULES.chosen ? INTRODUCER_RULES.chosen : INTRODUCER_RULES.allSharing,
    chosenIntroducerIds: readChosenIds(settings.get(INSTANCE_SETTING_KEYS.villageChosenIntroducerIds)),
    serviceEmail: settings.get(INSTANCE_SETTING_KEYS.villageServiceEmail) || null,
  };
}

function describeSettings({ searchScope, introducers, chosenIntroducerIds, serviceEmail }: VillageSettingsBody) {
  const scope = searchScope === SEARCH_SCOPES.everyone ? "search everyone" : "search members' networks";
  const who = introducers === INTRODUCER_RULES.chosen ? `${chosenIntroducerIds.length} chosen introducers` : "every sharing member introduces";
  return `${scope}, ${who}, service email ${serviceEmail || "the first admin's"}`;
}

// Members who joined the group and share their network: the only ones an admin can choose as introducers.
export async function readSharingMembers(database: Database) {
  return database
    .select({ id: user.id, name: user.name })
    .from(memberNetwork)
    .innerJoin(user, eq(user.id, memberNetwork.userId))
    .where(and(isNotNull(memberNetwork.groupJoinedAt), isNotNull(memberNetwork.sharingConsentedAt), isActiveMember()))
    .orderBy(asc(user.name), asc(user.id));
}

export async function setVillageSearchSettings({ database, member }: RequestContext, body: VillageSettingsBody) {
  const sharingIds = new Set((await readSharingMembers(database)).map(({ id }) => id));
  const chosen = body.introducers === INTRODUCER_RULES.chosen ? body.chosenIntroducerIds.filter((id) => sharingIds.has(id)) : [];
  if (body.introducers === INTRODUCER_RULES.chosen && chosen.length === 0) {
    throw new RequestError(UNPROCESSABLE_STATUS, "village_settings_invalid", "Pick at least one member who shares their network.");
  }
  const saved = { ...body, chosenIntroducerIds: chosen };
  await withAdminTransaction(database, member.id, async (transaction) => {
    await saveSettings(transaction, {
      [INSTANCE_SETTING_KEYS.villageSearchScope]: saved.searchScope,
      [INSTANCE_SETTING_KEYS.villageIntroducers]: saved.introducers,
      [INSTANCE_SETTING_KEYS.villageChosenIntroducerIds]: JSON.stringify(saved.chosenIntroducerIds),
      [INSTANCE_SETTING_KEYS.villageServiceEmail]: saved.serviceEmail,
    });
    await recordAdminAction(transaction, member.id, { action: AUDIT_ACTIONS.villageSettingsChanged, detail: describeSettings(saved) });
  });
  return saved;
}
