"use client";

import { useMutation, useQueryClient } from "@tanstack/react-query";
import { useState } from "react";

import { FormError } from "@/components/form-error";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { API_ROUTES } from "@/lib/routes";
import { acknowledgedResponseSchema } from "@/lib/village/network-api";
import { postNetworkRequest } from "@/lib/village/post-network-request";

function leaveGroup() {
  return postNetworkRequest(
    API_ROUTES.networkLeave,
    { confirmed: true },
    acknowledgedResponseSchema,
  );
}

export function LeaveGroup() {
  const queryClient = useQueryClient();
  const [isConfirming, setIsConfirming] = useState(false);
  const leaveMutation = useMutation({
    mutationFn: leaveGroup,
    onSuccess: () => queryClient.resetQueries(),
  });

  return (
    <Card>
      <CardHeader>
        <CardTitle>
          <h2>Leave the group</h2>
        </CardTitle>
      </CardHeader>
      <CardContent className="grid gap-4 text-sm">
        <FormError message={leaveMutation.error?.message ?? null} />
        {isConfirming ? (
          <>
            <p>
              You lose access to other members&apos; networks, and they lose access to yours. People
              who already saw your contacts can&apos;t unsee them. Your Village account stays linked
              to this site. To rejoin, you agree to share again.
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
      </CardContent>
    </Card>
  );
}
