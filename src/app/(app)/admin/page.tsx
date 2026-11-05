import type { Metadata } from "next";
import { redirect } from "next/navigation";

import { ProgressTrack } from "@/components/progress-track";
import { getDatabase } from "@/platform/database/client";
import { parseSetupStep, readSetupProgress, SETUP_STEP_NAMES, SETUP_STEPS, type SetupProgress } from "@/shell/admin-setup";
import { readBranding } from "@/platform/branding/branding";
import { PAGE_TITLES } from "@/platform/branding/page-metadata";
import { ROUTES } from "@/platform/http/routes";
import { requireAdmin } from "@/platform/auth/session";

import { AdminSection } from "@/shell/admin-section";
import { AdminBrandCard, SetupChecklist } from "@/shell/setup-checklist";
import { adminManifest } from "@/modules/admin/manifest";
import { modulePage } from "@/platform/modules/module-page";

const NEXT_STEP_AFTER_SETUP = "invite more members whenever you like";

function readStepsLeftSentence(stepsLeft: number) {
  const steps = stepsLeft === 1 ? "One step" : `${stepsLeft} steps`;
  return `${steps} left. Your progress saves as you go.`;
}

function readNextStepName({ currentStepId }: SetupProgress) {
  return currentStepId ? SETUP_STEP_NAMES[currentStepId] : NEXT_STEP_AFTER_SETUP;
}

export const metadata: Metadata = { title: PAGE_TITLES.admin };

export default modulePage(adminManifest, async function AdminPage({ searchParams }: { searchParams: Promise<{ step?: string }> }) {
  const admin = await requireAdmin();
  const { step } = await searchParams;

  const database = getDatabase();
  const [progress, branding] = await Promise.all([readSetupProgress(database, process.env), readBranding(database)]);
  const requestedStepId = parseSetupStep(step, progress.steps.map(({ id }) => id));
  if (progress.isComplete) redirect(requestedStepId ? `${ROUTES.adminSettings}?step=${requestedStepId}` : ROUTES.adminMembers);

  const openStepId = requestedStepId ?? progress.currentStepId;
  const isBrandCurrent = progress.currentStepId === SETUP_STEPS.brand;
  const community = branding.isSaved ? branding.name : "your community";

  return (
    <AdminSection title={`Let's get ${community} ready`} description={readStepsLeftSentence(progress.stepsLeft)}>
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
        <div className={isBrandCurrent ? "lg:col-start-1 lg:row-start-1" : undefined}>
          <SetupChecklist database={database} admin={admin} progress={progress} openStepId={openStepId} basePath={ROUTES.admin} />
        </div>
        {isBrandCurrent ? null : <AdminBrandCard branding={branding} isCurrentStep={false} />}
      </div>
    </AdminSection>
  );
});
