"use client";

import { useMutation } from "@tanstack/react-query";
import { RefreshCw } from "lucide-react";
import { useRouter } from "next/navigation";
import { useRef } from "react";

import { FormError } from "@/components/form-error";
import { Button } from "@/components/ui/button";
import { acknowledgedResponseSchema } from "@/platform/http/contract";
import { postRequest } from "@/platform/http/post-request";
import { API_ROUTES } from "@/platform/http/routes";

function runCheck() {
  return postRequest(API_ROUTES.villageCheck, {}, acknowledgedResponseSchema);
}

export function VillageCheckButton({ hasChecked }: { hasChecked: boolean }) {
  const router = useRouter();
  // A double-click would send two checks; the second always meets the once-a-minute limit.
  const isRunning = useRef(false);
  const check = useMutation({
    mutationFn: runCheck,
    onSuccess: () => router.refresh(),
    onSettled: () => {
      isRunning.current = false;
    },
  });
  function start() {
    if (isRunning.current) return;
    isRunning.current = true;
    check.mutate();
  }
  return (
    <div className="grid gap-2">
      <Button type="button" variant={hasChecked ? "outline" : "primary"} disabled={check.isPending} onClick={start} className="max-sm:w-full sm:justify-self-start">
        <RefreshCw aria-hidden="true" className={check.isPending ? "animate-spin motion-reduce:animate-none" : undefined} />
        {check.isPending ? "Asking Village…" : hasChecked ? "Check again" : "Check Village now"}
      </Button>
      <FormError message={check.error?.message ?? null} />
    </div>
  );
}
