"use client";

import { useMutation, useQueryClient } from "@tanstack/react-query";
import { useState } from "react";

import { FormError } from "@/components/form-error";
import { Button } from "@/components/ui/button";
import { API_ROUTES } from "@/platform/http/routes";
import { acknowledgedResponseSchema } from "@/platform/http/contract";
import { postRequest } from "@/platform/http/post-request";

function leaveGroup() {
  return postRequest(
    API_ROUTES.networkLeave,
    { confirmed: true },
    acknowledgedResponseSchema,
  );
}

export function LeaveGroup({ onLeft }: { onLeft?: () => void }) {
  const queryClient = useQueryClient();
  const [isConfirming, setIsConfirming] = useState(false);
  const leaveMutation = useMutation({
    mutationFn: leaveGroup,
    onSuccess: async () => {
      await queryClient.resetQueries();
      onLeft?.();
    },
  });

  return (
    <div className="grid gap-4">
      <FormError message={leaveMutation.error?.message ?? null} />
      {isConfirming ? (
        <>
          <p className="type-small text-foreground-soft">
            Other members lose access to your network, and your searches cover only what they share. People who already saw
            your contacts can&apos;t unsee them. Your Village account stays linked to this site. To rejoin, you agree
            to share again.
          </p>
          <div className="flex flex-wrap gap-2">
            <Button
              type="button"
              variant="destructive"
              disabled={leaveMutation.isPending}
              onClick={() => leaveMutation.mutate()}
            >
              {leaveMutation.isPending ? "Leaving…" : "Yes, leave the group"}
            </Button>
            <Button type="button" variant="outline" onClick={() => setIsConfirming(false)}>
              Cancel
            </Button>
          </div>
        </>
      ) : (
        <div>
          <Button type="button" variant="outline" onClick={() => setIsConfirming(true)}>
            Leave the group
          </Button>
        </div>
      )}
    </div>
  );
}
