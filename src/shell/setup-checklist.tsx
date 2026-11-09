import type { ReactNode } from "react";
import Link from "next/link";

import { StepRow, type StepState, STEP_STATES } from "@/components/step-row";
import { Button } from "@/components/ui/button";
import type { Database } from "@/platform/database/client";
import { SETUP_STEPS, type SetupProgress, type SetupStepId } from "@/shell/admin-setup";
import { SETUP_STEP_COPY } from "@/shell/admin-setup-copy";
import { readBranding, type Branding } from "@/platform/branding/branding";
import { readResendConfig } from "@/platform/email/resend";
import { createRequestContext, type SessionMember } from "@/platform/http/request-context";
import { readVillageGroupReadiness } from "@/modules/network/service";
import { readVillageGroup, type VillageGroup } from "@/modules/network/service-settings";
import { VILLAGE_KEY_STATUSES, type VillageKeyStatus } from "@/platform/village/contract";
import { readKeyStorage, readVillageKeyState, type VillageKeys } from "@/platform/village/settings";

import { RunWithoutVillage } from "@/modules/admin/components/run-without-village";
import { networkManifest } from "@/modules/network/manifest";
import { BrandCard } from "@/modules/admin/components/brand-card";
import { BRAND_NAME_INPUT_ID } from "@/modules/admin/components/brand-fields";
import { GroupForm } from "@/modules/network/components/group-form";
import { KeysForm } from "@/modules/network/components/keys-form";
import { InviteStep } from "@/modules/members/components/invite-step";
import { ReportStep } from "@/modules/admin/components/report-step";

function readStepState(isDone: boolean, isOpen: boolean): StepState {
  if (isOpen) return STEP_STATES.current;
  return isDone ? STEP_STATES.done : STEP_STATES.todo;
}

type StepActionProps = { stepId: SetupStepId; isDone: boolean; isOpen: boolean; basePath: string };

function StepAction({ stepId, isDone, isOpen, basePath }: StepActionProps) {
  const { manageLabel } = SETUP_STEP_COPY[stepId];
  if (stepId === SETUP_STEPS.brand) {
    return (
      <Button asChild size="sm" variant={isOpen ? "soft" : isDone ? "quiet" : "outline"}>
        <a href={`#${BRAND_NAME_INPUT_ID}`}>{isDone ? manageLabel : "Go to your brand"}</a>
      </Button>
    );
  }
  if (isOpen && isDone) {
    return (
      <Button asChild size="sm" variant="quiet">
        <Link href={basePath}>Close</Link>
      </Button>
    );
  }
  if (isOpen) return null;
  return (
    <Button asChild size="sm" variant={isDone ? "quiet" : "outline"}>
      <Link href={`${basePath}?step=${stepId}`}>{isDone ? manageLabel : "Start"}</Link>
    </Button>
  );
}

async function readAdminUserSafely(context: Parameters<typeof readVillageGroupReadiness>[0]) {
  try {
    return { villageUser: await readVillageGroupReadiness(context), isVillageReachable: true };
  } catch {
    return { villageUser: null, isVillageReachable: false };
  }
}

type StepBodyFacts = {
  branding: Branding;
  keys: VillageKeys | null;
  savedPublicKey: string;
  keyStatus: VillageKeyStatus;
  group: VillageGroup | null;
  isDone: boolean;
  isVillageReachable: boolean;
  isSynced: boolean;
  isEmailConfigured: boolean;
};

const STEP_BODIES: Partial<Record<SetupStepId, (facts: StepBodyFacts) => ReactNode>> = {
  [SETUP_STEPS.keys]: ({ keys, savedPublicKey, keyStatus }) => (
    <>
      <KeysForm savedPublicKey={savedPublicKey} hasSavedKeys={Boolean(keys)} keyStatus={keyStatus} keyStorage={readKeyStorage(process.env)} />
      {keys ? null : <RunWithoutVillage moduleId={networkManifest.id} />}
    </>
  ),
  [SETUP_STEPS.group]: ({ keys, group, isVillageReachable, isSynced, branding }) => (
    <GroupForm
      hasKeys={Boolean(keys)}
      hasGroup={Boolean(group)}
      isVillageReachable={isVillageReachable}
      isSynced={isSynced}
      defaultName={branding.isSaved ? branding.name : ""}
    />
  ),
  [SETUP_STEPS.invite]: ({ isEmailConfigured }) => <InviteStep isEmailConfigured={isEmailConfigured} />,
  [SETUP_STEPS.report]: ({ isDone }) => <ReportStep isDone={isDone} />,
};

export function AdminBrandCard({ branding, isCurrentStep }: { branding: Branding; isCurrentStep: boolean }) {
  return (
    <div className={isCurrentStep ? "lg:col-start-2 lg:row-start-1" : undefined}>
      <BrandCard
        name={branding.name}
        descriptor={branding.descriptor}
        accentColor={branding.accentColor}
        logo={branding.logo}
        isSaved={branding.isSaved}
        isCurrentStep={isCurrentStep}
      />
    </div>
  );
}

type SetupChecklistProps = {
  database: Database;
  admin: SessionMember;
  progress: SetupProgress;
  openStepId: SetupStepId | null;
  basePath: string;
};

export async function SetupChecklist({ database, admin, progress, openStepId, basePath }: SetupChecklistProps) {
  const isNetworkStepShown = progress.steps.some(({ id }) => id === SETUP_STEPS.keys);
  const [branding, keyState, group] = await Promise.all([
    readBranding(database),
    isNetworkStepShown ? readVillageKeyState(database) : null,
    isNetworkStepShown ? readVillageGroup(database) : null,
  ]);
  const keys = keyState?.keys ?? null;
  const savedPublicKey = keyState?.publicKey ?? "";
  const keyStatus = keyState?.status ?? VILLAGE_KEY_STATUSES.missing;
  const context = createRequestContext(database, process.env, admin);
  const { villageUser, isVillageReachable } =
    isNetworkStepShown && openStepId === SETUP_STEPS.group ? await readAdminUserSafely(context) : { villageUser: null, isVillageReachable: true };
  const isEmailConfigured = readResendConfig(process.env) !== null;

  return (
    <ol aria-label="Setup steps" className="grid gap-2.5">
      {progress.steps.map(({ id, isDone }, position) => {
        const isOpen = openStepId === id;
        const copy = SETUP_STEP_COPY[id];
        return (
          <StepRow
            key={id}
            state={readStepState(isDone, isOpen)}
            isDone={isDone}
            number={position + 1}
            title={copy.title}
            description={isDone ? copy.done : copy.todo}
            action={<StepAction stepId={id} isDone={isDone} isOpen={isOpen} basePath={basePath} />}
          >
            {isOpen
              ? (STEP_BODIES[id]?.({ branding, keys, savedPublicKey, keyStatus, group, isDone, isVillageReachable, isSynced: villageUser?.isSynced ?? false, isEmailConfigured }) ?? null)
              : null}
          </StepRow>
        );
      })}
    </ol>
  );
}
