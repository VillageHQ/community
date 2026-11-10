import type { Database } from "../platform/database/client.ts";
import { readBranding } from "../platform/branding/branding.ts";
import { hasOpenOrAcceptedInvite } from "../modules/members/service-invites.ts";
import { SETUP_STEPS, type SetupStepId } from "./admin-setup-steps.ts";
import { readVillageGroup } from "../modules/network/service-settings.ts";
import { readVillageKeys } from "../platform/village/settings.ts";
import { readPartnerReportSettings } from "../modules/admin/reads-partner-report.ts";

import { adminManifest } from "../modules/admin/manifest.ts";
import { membersManifest } from "../modules/members/manifest.ts";
import { networkManifest } from "../modules/network/manifest.ts";
import type { ModuleManifest } from "../platform/modules/manifest.ts";
import { readEnabledIds } from "./enabled-modules.ts";
import { asksManifest } from "../modules/asks/manifest.ts";
import { chatManifest } from "../modules/chat/manifest.ts";
import { CHAT_KINDS } from "../modules/chat/contract.ts";
import { readChatConnection } from "../modules/chat/service.ts";

export { SETUP_STEPS, type SetupStepId };

export type SetupFacts = {
  isBrandSaved: boolean;
  hasKeys: boolean;
  hasGroup: boolean;
  hasInvite: boolean;
  hasSharedReport: boolean;
};

const SETUP_STEP_OWNERS: Record<SetupStepId, ModuleManifest> = {
  [SETUP_STEPS.brand]: adminManifest,
  [SETUP_STEPS.keys]: networkManifest,
  [SETUP_STEPS.group]: networkManifest,
  [SETUP_STEPS.invite]: membersManifest,
  [SETUP_STEPS.report]: adminManifest,
};

const SETUP_STEP_ORDER: SetupStepId[] = [
  SETUP_STEPS.brand,
  SETUP_STEPS.keys,
  SETUP_STEPS.group,
  SETUP_STEPS.invite,
  SETUP_STEPS.report,
];

const SETUP_STEP_COMPLETION: Record<SetupStepId, (facts: SetupFacts) => boolean> = {
  [SETUP_STEPS.brand]: ({ isBrandSaved }) => isBrandSaved,
  [SETUP_STEPS.keys]: ({ hasKeys }) => hasKeys,
  [SETUP_STEPS.group]: ({ hasGroup }) => hasGroup,
  [SETUP_STEPS.invite]: ({ hasInvite }) => hasInvite,
  [SETUP_STEPS.report]: ({ hasSharedReport }) => hasSharedReport,
};

export const SETUP_STEP_NAMES: Record<SetupStepId, string> = {
  [SETUP_STEPS.brand]: "brand your community",
  [SETUP_STEPS.keys]: "add your Village keys",
  [SETUP_STEPS.group]: "create the group",
  [SETUP_STEPS.invite]: "invite your first members",
  [SETUP_STEPS.report]: "send your first partner report",
};

export function describeSetupProgress(facts: SetupFacts, stepIds: readonly SetupStepId[] = SETUP_STEP_ORDER) {
  const steps = stepIds.map((id) => ({ id, isDone: SETUP_STEP_COMPLETION[id](facts) }));
  const doneCount = steps.filter(({ isDone }) => isDone).length;
  const currentStepId = steps.find(({ isDone }) => !isDone)?.id ?? null;
  return {
    steps,
    doneCount,
    totalCount: steps.length,
    stepsLeft: steps.length - doneCount,
    currentStepId,
    isComplete: currentStepId === null,
  };
}

export type SetupProgress = ReturnType<typeof describeSetupProgress>;

export function parseSetupStep(value: unknown, stepIds: readonly SetupStepId[] = SETUP_STEP_ORDER): SetupStepId | null {
  return stepIds.find((step) => step === value) ?? null;
}

export async function readSetupProgress(database: Database) {
  const enabledIds = await readEnabledIds(database);
  const isNetworkOn = enabledIds.has(networkManifest.id);
  const [branding, keys, group, hasInvite, reportSettings] = await Promise.all([
    readBranding(database),
    isNetworkOn ? readVillageKeys(database) : null,
    isNetworkOn ? readVillageGroup(database) : null,
    hasOpenOrAcceptedInvite(database),
    readPartnerReportSettings(database),
  ]);
  return describeSetupProgress(
    {
      isBrandSaved: branding.isSaved,
      hasKeys: Boolean(keys),
      hasGroup: Boolean(group),
      hasInvite,
      hasSharedReport: reportSettings.sharedAt !== null,
    },
    SETUP_STEP_ORDER.filter((stepId) => enabledIds.has(SETUP_STEP_OWNERS[stepId].id)),
  );
}

// Steps an admin may take, shown after the others. They never count toward "setup complete".
export const OPTIONAL_SETUP_STEPS = { chat: "chat" } as const;

export type OptionalSetupStep = { id: (typeof OPTIONAL_SETUP_STEPS)[keyof typeof OPTIONAL_SETUP_STEPS]; isDone: boolean; isModuleOn: boolean };

// "Post new asks to your Slack": offered while Asks is on. Done once Slack posts to a channel.
export async function readOptionalSetupSteps(database: Database): Promise<OptionalSetupStep[]> {
  const enabledIds = await readEnabledIds(database);
  if (!enabledIds.has(asksManifest.id)) return [];
  const isModuleOn = enabledIds.has(chatManifest.id);
  const slack = isModuleOn ? await readChatConnection(database, CHAT_KINDS.slack) : null;
  return [{ id: OPTIONAL_SETUP_STEPS.chat, isDone: Boolean(slack?.channelId), isModuleOn }];
}
