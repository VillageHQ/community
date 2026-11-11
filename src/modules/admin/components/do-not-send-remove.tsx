"use client";

import { useRouter } from "next/navigation";

import { Button } from "@/components/ui/button";
import { acknowledgedResponseSchema } from "@/platform/http/contract";
import { postRequest } from "@/platform/http/post-request";
import { API_ROUTES } from "@/platform/http/routes";

import { ConfirmDialog } from "./confirm-dialog";

export function DoNotSendRemove({ email }: { email: string }) {
  const router = useRouter();
  return (
    <ConfirmDialog
      trigger={
        <Button type="button" variant="outline" size="sm">
          Remove<span className="sr-only"> {email}</span>
        </Button>
      }
      title="Take this address off the do-not-send list?"
      confirmLabel="Remove"
      pendingLabel="Removing…"
      action={() => postRequest(API_ROUTES.adminDoNotSend, { email }, acknowledgedResponseSchema)}
      onDone={() => router.refresh()}
    >
      <p className="wrap-anywhere text-foreground-soft">
        Optional email, like the weekly email and intro updates, goes to <strong className="text-foreground">{email}</strong> again. If it
        bounces or is marked as spam once more, it goes back on the list by itself.
      </p>
    </ConfirmDialog>
  );
}
