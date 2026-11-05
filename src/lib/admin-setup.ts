import type { Database } from "../platform/database/client.ts";
import { resolveAppUrl } from "../platform/http/app-url.ts";
import { readBranding } from "../platform/branding/branding.ts";
import { hasOpenOrAcceptedInvite } from "./invites/invites.ts";
import type { Environment } from "../platform/environment.ts";
import { SETUP_STEPS, type SetupStepId } from "./admin-setup-steps.ts";
import { readConfirmedVillageDomain, readVillageGroup, readVillageKeys } from "./village/settings.ts";

export { SETUP_STEPS, type SetupStepId };

export type SetupFacts = {
  isBrandSaved: boolean;
  isDomainConfirmed: boolean;
  hasKeys: boolean;
  hasGroup: boolean;
  hasInvite: boolean;
};

const SETUP_STEP_ORDER: SetupStepId[] = [
  SETUP_STEPS.brand,
  SETUP_STEPS.domain,
  SETUP_STEPS.keys,
  SETUP_STEPS.group,
  SETUP_STEPS.invite,
];

const SETUP_STEP_COMPLETION: Record<SetupStepId, (facts: SetupFacts) => boolean> = {
  [SETUP_STEPS.brand]: ({ isBrandSaved }) => isBrandSaved,
  [SETUP_STEPS.domain]: ({ isDomainConfirmed }) => isDomainConfirmed,
  [SETUP_STEPS.keys]: ({ hasKeys }) => hasKeys,
  [SETUP_STEPS.group]: ({ hasGroup }) => hasGroup,
  [SETUP_STEPS.invite]: ({ hasInvite }) => hasInvite,
};

export const SETUP_STEP_NAMES: Record<SetupStepId, string> = {
  [SETUP_STEPS.brand]: "brand your community",
  [SETUP_STEPS.domain]: "register your domain",
  [SETUP_STEPS.keys]: "add your Village keys",
  [SETUP_STEPS.group]: "create the group",
  [SETUP_STEPS.invite]: "invite your first members",
};

export function describeSetupProgress(facts: SetupFacts) {
  const steps = SETUP_STEP_ORDER.map((id) => ({ id, isDone: SETUP_STEP_COMPLETION[id](facts) }));
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

export function parseSetupStep(value: unknown): SetupStepId | null {
  return SETUP_STEP_ORDER.find((step) => step === value) ?? null;
}

export async function readSetupProgress(database: Database, environment: Environment) {
  const [branding, confirmedDomain, keys, group, hasInvite] = await Promise.all([
    readBranding(database),
    readConfirmedVillageDomain(database),
    readVillageKeys(database),
    readVillageGroup(database),
    hasOpenOrAcceptedInvite(database),
  ]);
  return describeSetupProgress({
    isBrandSaved: branding.isSaved,
    isDomainConfirmed: confirmedDomain === new URL(resolveAppUrl(environment)).hostname,
    hasKeys: Boolean(keys),
    hasGroup: Boolean(group),
    hasInvite,
  });
}
