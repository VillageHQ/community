import type { Database } from "../platform/database/client.ts";
import { readBranding } from "../platform/branding/branding.ts";
import { hasOpenOrAcceptedInvite } from "../modules/members/service-invites.ts";
import { SETUP_STEPS, type SetupStepId } from "./admin-setup-steps.ts";
import { readVillageGroup } from "../modules/network/service-settings.ts";
import { readVillageKeys } from "../platform/village/settings.ts";

import { adminManifest } from "../modules/admin/manifest.ts";
import { membersManifest } from "../modules/members/manifest.ts";
import { networkManifest } from "../modules/network/manifest.ts";
import type { ModuleManifest } from "../platform/modules/manifest.ts";
import { readEnabledIds } from "./enabled-modules.ts";

export { SETUP_STEPS, type SetupStepId };

export type SetupFacts = {
  isBrandSaved: boolean;
  hasKeys: boolean;
  hasGroup: boolean;
  hasInvite: boolean;
};

const SETUP_STEP_OWNERS: Record<SetupStepId, ModuleManifest> = {
  [SETUP_STEPS.brand]: adminManifest,
  [SETUP_STEPS.keys]: networkManifest,
  [SETUP_STEPS.group]: networkManifest,
  [SETUP_STEPS.invite]: membersManifest,
};

const SETUP_STEP_ORDER: SetupStepId[] = [
  SETUP_STEPS.brand,
  SETUP_STEPS.keys,
  SETUP_STEPS.group,
  SETUP_STEPS.invite,
];

const SETUP_STEP_COMPLETION: Record<SetupStepId, (facts: SetupFacts) => boolean> = {
  [SETUP_STEPS.brand]: ({ isBrandSaved }) => isBrandSaved,
  [SETUP_STEPS.keys]: ({ hasKeys }) => hasKeys,
  [SETUP_STEPS.group]: ({ hasGroup }) => hasGroup,
  [SETUP_STEPS.invite]: ({ hasInvite }) => hasInvite,
};

export const SETUP_STEP_NAMES: Record<SetupStepId, string> = {
  [SETUP_STEPS.brand]: "brand your community",
  [SETUP_STEPS.keys]: "add your Village keys",
  [SETUP_STEPS.group]: "create the group",
  [SETUP_STEPS.invite]: "invite your first members",
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
  const [branding, keys, group, hasInvite] = await Promise.all([
    readBranding(database),
    isNetworkOn ? readVillageKeys(database) : null,
    isNetworkOn ? readVillageGroup(database) : null,
    hasOpenOrAcceptedInvite(database),
  ]);
  return describeSetupProgress(
    {
      isBrandSaved: branding.isSaved,
      hasKeys: Boolean(keys),
      hasGroup: Boolean(group),
      hasInvite,
    },
    SETUP_STEP_ORDER.filter((stepId) => enabledIds.has(SETUP_STEP_OWNERS[stepId].id)),
  );
}
