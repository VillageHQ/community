import type { ReactNode } from "react";
import Link from "next/link";

import { StepRow, type StepState, STEP_STATES } from "@/components/step-row";
import { Button } from "@/components/ui/button";
import type { Database } from "@/platform/database/client";
import { SETUP_STEPS, type SetupProgress, type SetupStepId } from "@/shell/admin-setup";
import { SETUP_STEP_COPY } from "@/shell/admin-setup-copy";
import { resolveAppUrl } from "@/platform/http/app-url";
import { readBranding, type Branding } from "@/platform/branding/branding";
import { readResendConfig } from "@/platform/email/resend";
import { createRequestContext, type SessionMember } from "@/platform/http/request-context";
import { readVillageGroupReadiness } from "@/modules/network/service";
import { readVillageGroup, type VillageGroup } from "@/modules/network/service-settings";
import { readVillageKeys, type VillageKeys } from "@/platform/village/settings";

import { BrandCard } from "@/modules/admin/components/brand-card";
import { BRAND_NAME_INPUT_ID } from "@/modules/admin/components/brand-fields";
import { DomainStep } from "@/modules/network/components/domain-step";
import { GroupForm } from "@/modules/network/components/group-form";
import { KeysForm } from "@/modules/network/components/keys-form";
import { InviteStep } from "@/modules/members/components/invite-step";

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
  group: VillageGroup | null;
  domain: string;
  isDone: boolean;
  isVillageReachable: boolean;
  isSynced: boolean;
  isEmailConfigured: boolean;
};

const STEP_BODIES: Partial<Record<SetupStepId, (facts: StepBodyFacts) => ReactNode>> = {
  [SETUP_STEPS.domain]: ({ domain, isDone }) => <DomainStep domain={domain} isDone={isDone} />,
  [SETUP_STEPS.keys]: ({ keys }) => <KeysForm savedPublicKey={keys?.publicKey ?? ""} hasSavedKeys={Boolean(keys)} />,
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
  const [branding, keys, group] = await Promise.all([readBranding(database), readVillageKeys(database), readVillageGroup(database)]);
  const context = createRequestContext(database, process.env, admin);
  const { villageUser, isVillageReachable } =
    openStepId === SETUP_STEPS.group ? await readAdminUserSafely(context) : { villageUser: null, isVillageReachable: true };
  const domain = new URL(resolveAppUrl(process.env)).hostname;
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
              ? (STEP_BODIES[id]?.({ branding, keys, group, domain, isDone, isVillageReachable, isSynced: Boolean(villageUser?.isSyncComplete), isEmailConfigured }) ?? null)
              : null}
          </StepRow>
        );
      })}
    </ol>
  );
}
