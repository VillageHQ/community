import type { Metadata } from "next";
import type { ReactNode } from "react";
import Link from "next/link";

import { PageHeader } from "@/components/page-header";
import { ProgressTrack } from "@/components/progress-track";
import { StepRow, type StepState, STEP_STATES } from "@/components/step-row";
import { Button } from "@/components/ui/button";
import { Card, CardDescription, CardTitle } from "@/components/ui/card";
import { getDatabase } from "@/database/client";
import {
  parseSetupStep,
  readSetupProgress,
  SETUP_STEP_NAMES,
  SETUP_STEPS,
  type SetupProgress,
  type SetupStepId,
} from "@/lib/admin-setup";
import { SETUP_STEP_COPY } from "@/lib/admin-setup-copy";
import { resolveAppUrl } from "@/lib/app-url";
import { readBranding, type Branding } from "@/lib/branding/branding";
import { readResendConfig } from "@/lib/email/resend";
import { readConfirmationBadgeCount } from "@/lib/members/member-admin";
import { ROUTES } from "@/lib/routes";
import { requireAdmin } from "@/lib/session";
import {
  createNetworkContext,
  readVillageGroupReadiness,
  readVillageLinks,
} from "@/lib/village/member-network";
import { readVillageGroup, readVillageKeys, type VillageGroup, type VillageKeys } from "@/lib/village/settings";

import { AdminTabs } from "./admin-tabs";
import { BrandCard } from "./brand-card";
import { BRAND_NAME_INPUT_ID } from "./brand-fields";
import { DomainStep } from "./domain-step";
import { GroupForm } from "./group-form";
import { KeysForm } from "./keys-form";
import { InviteStep } from "./members/invite-step";
import { VillageLinks } from "./village-links";
import { PAGE_TITLES } from "@/lib/branding/page-metadata";

const NEXT_STEP_AFTER_SETUP = "invite more members whenever you like";

function toStepHref(stepId: SetupStepId) {
  return `${ROUTES.admin}?step=${stepId}`;
}

function readStepState(isDone: boolean, isOpen: boolean): StepState {
  if (isOpen) return STEP_STATES.current;
  return isDone ? STEP_STATES.done : STEP_STATES.todo;
}

function StepAction({ stepId, isDone, isOpen }: { stepId: SetupStepId; isDone: boolean; isOpen: boolean }) {
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
        <Link href={ROUTES.admin}>Close</Link>
      </Button>
    );
  }
  if (isOpen) return null;
  return (
    <Button asChild size="sm" variant={isDone ? "quiet" : "outline"}>
      <Link href={toStepHref(stepId)}>{isDone ? manageLabel : "Start"}</Link>
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

function readHeading(isComplete: boolean, name: string, isBrandSaved: boolean) {
  const community = isBrandSaved ? name : "your community";
  return isComplete ? `${community} is ready` : `Let's get ${community} ready`;
}

function readStepsLeftSentence(stepsLeft: number) {
  if (stepsLeft === 0) return "Everything's set. You can change any of this later.";
  const steps = stepsLeft === 1 ? "One step" : `${stepsLeft} steps`;
  return `${steps} left. Your progress saves as you go.`;
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

function StepBody({ stepId, facts }: { stepId: SetupStepId; facts: StepBodyFacts }) {
  return STEP_BODIES[stepId]?.(facts) ?? null;
}

function AdminBrandCard({ branding, isCurrentStep }: { branding: Branding; isCurrentStep: boolean }) {
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

function readNextStepName({ currentStepId }: SetupProgress) {
  return currentStepId ? SETUP_STEP_NAMES[currentStepId] : NEXT_STEP_AFTER_SETUP;
}

export const metadata: Metadata = { title: PAGE_TITLES.admin };

export default async function AdminPage({ searchParams }: { searchParams: Promise<{ step?: string }> }) {
  const admin = await requireAdmin();
  const { step } = await searchParams;

  const database = getDatabase();
  const [progress, branding, keys, group, villageLinks, confirmationBadgeCount] = await Promise.all([
    readSetupProgress(database, process.env),
    readBranding(database),
    readVillageKeys(database),
    readVillageGroup(database),
    readVillageLinks(database),
    readConfirmationBadgeCount(database, process.env),
  ]);
  const openStepId = parseSetupStep(step) ?? progress.currentStepId;
  const isGroupStepOpen = openStepId === SETUP_STEPS.group;
  const context = createNetworkContext(database, process.env, admin);
  const { villageUser, isVillageReachable } = isGroupStepOpen
    ? await readAdminUserSafely(context)
    : { villageUser: null, isVillageReachable: true };
  const domain = new URL(resolveAppUrl(process.env)).hostname;
  const isBrandCurrent = progress.currentStepId === SETUP_STEPS.brand;

  return (
    <>
      <PageHeader
        title={readHeading(progress.isComplete, branding.name, branding.isSaved)}
        description={readStepsLeftSentence(progress.stepsLeft)}
      />

      <AdminTabs membersBadgeCount={confirmationBadgeCount} />

      <section aria-label="Setup progress" className="mb-5 rounded-card bg-card p-5 shadow-panel sm:rounded-panel sm:px-7 sm:py-6">
        <div className="mb-3.5 flex flex-wrap items-baseline justify-between gap-x-3 gap-y-1">
          <h2 className="type-h3">
            {progress.doneCount} of {progress.totalCount} done
          </h2>
          <p className="type-small text-foreground-soft">Next: {readNextStepName(progress)}</p>
        </div>
        <ProgressTrack
          doneCount={progress.doneCount}
          totalCount={progress.totalCount}
          label={`${progress.doneCount} of ${progress.totalCount} setup steps done`}
        />
      </section>

      <div className="grid items-start gap-5 lg:grid-cols-[minmax(0,1fr)_312px]">
        {isBrandCurrent ? <AdminBrandCard branding={branding} isCurrentStep /> : null}
        <div className={isBrandCurrent ? "grid gap-5 lg:col-start-1 lg:row-start-1" : "grid gap-5"}>
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
                  action={<StepAction stepId={id} isDone={isDone} isOpen={isOpen} />}
                >
                  {isOpen ? (
                    <StepBody
                      stepId={id}
                      facts={{ branding, keys, group, domain, isDone, isVillageReachable, isSynced: Boolean(villageUser?.isSyncComplete), isEmailConfigured: readResendConfig(process.env) !== null }}
                    />
                  ) : null}
                </StepRow>
              );
            })}
          </ol>

          <Card className="grid gap-4">
            <div className="grid gap-1.5">
              <CardTitle>Village links</CardTitle>
              <CardDescription>Check which Village account each member linked.</CardDescription>
            </div>
            <VillageLinks links={villageLinks} />
          </Card>
        </div>
        {isBrandCurrent ? null : <AdminBrandCard branding={branding} isCurrentStep={false} />}
      </div>
    </>
  );
}
