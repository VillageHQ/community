import type { Database } from "../database/client.ts";
import { resolveAppUrl } from "./app-url.ts";
import { readBranding } from "./branding/branding.ts";
import type { Environment } from "./environment.ts";
import { SETUP_STEPS, type SetupStepId } from "./admin-setup-steps.ts";
import { readConfirmedVillageDomain, readVillageGroup, readVillageKeys } from "./village/settings.ts";

export { SETUP_STEPS, type SetupStepId };

export type SetupFacts = {
  isBrandSaved: boolean;
  isDomainConfirmed: boolean;
  hasKeys: boolean;
  hasGroup: boolean;
};

const SETUP_STEP_ORDER: SetupStepId[] = [SETUP_STEPS.brand, SETUP_STEPS.domain, SETUP_STEPS.keys, SETUP_STEPS.group];

const SETUP_STEP_COMPLETION: Record<SetupStepId, (facts: SetupFacts) => boolean> = {
  [SETUP_STEPS.brand]: ({ isBrandSaved }) => isBrandSaved,
  [SETUP_STEPS.domain]: ({ isDomainConfirmed }) => isDomainConfirmed,
  [SETUP_STEPS.keys]: ({ hasKeys }) => hasKeys,
  [SETUP_STEPS.group]: ({ hasGroup }) => hasGroup,
};

export const SETUP_STEP_NAMES: Record<SetupStepId, string> = {
  [SETUP_STEPS.brand]: "brand your community",
  [SETUP_STEPS.domain]: "register your domain",
  [SETUP_STEPS.keys]: "add your Village keys",
  [SETUP_STEPS.group]: "create the group",
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
  const [branding, confirmedDomain, keys, group] = await Promise.all([
    readBranding(database),
    readConfirmedVillageDomain(database),
    readVillageKeys(database),
    readVillageGroup(database),
  ]);
  return describeSetupProgress({
    isBrandSaved: branding.isSaved,
    isDomainConfirmed: confirmedDomain === new URL(resolveAppUrl(environment)).hostname,
    hasKeys: Boolean(keys),
    hasGroup: Boolean(group),
  });
}
