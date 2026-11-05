"use client";

import { useRouter } from "next/navigation";

import { MAIN_CONTENT_ID } from "@/components/skip-link";
import { Button } from "@/components/ui/button";

import { setModuleStateRequest } from "../queries-modules";
import { ConfirmDialog } from "./confirm-dialog";

export function RunWithoutVillage({ moduleId }: { moduleId: string }) {
  const router = useRouter();
  return (
    <div className="mt-4 grid justify-items-start gap-2">
      <p className="type-small text-foreground-soft">No Village account? You can run this community without one.</p>
      <ConfirmDialog
        trigger={
          <Button type="button" variant="outline" size="lg" className="max-sm:w-full">
            Run without Village
          </Button>
        }
        title="Run without Village?"
        successTitle="You're running without Village"
        confirmLabel="Run without Village"
        pendingLabel="Turning off…"
        fallbackFocusId={MAIN_CONTENT_ID}
        action={() => setModuleStateRequest({ moduleId, isOn: false })}
        onDone={() => router.refresh()}
        renderSuccess={() => <p className="text-foreground-soft">Network and Intros are off, and setup no longer asks for Village. You can turn them on any time under Features.</p>}
      >
        <p>This turns off Network and Intros. Members can still post, message and find each other. You can turn them on any time under Features.</p>
      </ConfirmDialog>
    </div>
  );
}
