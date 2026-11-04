"use client";

import { useMutation, useQueryClient } from "@tanstack/react-query";

import { FormError } from "@/components/form-error";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { API_ROUTES } from "@/lib/routes";
import { acknowledgedResponseSchema } from "@/lib/village/network-api";
import { postNetworkRequest } from "@/lib/village/post-network-request";

import { NETWORK_QUERY_KEYS } from "./network-queries";

const CONSENT_FIELD_ID = "sharing-consent";

function recordConsent(formData: FormData) {
  return postNetworkRequest(
    API_ROUTES.networkConsent,
    { acknowledged: formData.get(CONSENT_FIELD_ID) === "on" },
    acknowledgedResponseSchema,
  );
}

export function ConsentStep() {
  const queryClient = useQueryClient();
  const consentMutation = useMutation({
    mutationFn: recordConsent,
    onSuccess: () => queryClient.invalidateQueries({ queryKey: [NETWORK_QUERY_KEYS.status] }),
  });

  return (
    <Card>
      <CardHeader>
        <CardTitle>
          <h2>Share your network to join</h2>
        </CardTitle>
        <CardDescription>Read this before you connect Village.</CardDescription>
      </CardHeader>
      <CardContent>
        <form action={consentMutation.mutate} className="grid gap-4">
          <FormError message={consentMutation.error?.message ?? null} />
          <ul className="list-disc space-y-1 pl-4 text-sm">
            <li>
              Your email address goes to Village, the company that runs network search for this
              community.
            </li>
            <li>
              Joining shares your Village network with{" "}
              <strong>every current and future member</strong> of this community. They can find
              your contacts and ask you for introductions.
            </li>
            <li>You gain access to the networks of the other members in return.</li>
            <li>
              You can leave the group from this page. That stops sharing with the group, but people
              who already saw your contacts can&apos;t unsee them.
            </li>
            <li>
              An admin removing you from this site doesn&apos;t yet remove you from the Village
              group. Leave the group first if you plan to go.
            </li>
          </ul>
          <label htmlFor={CONSENT_FIELD_ID} className="flex items-start gap-2 text-sm">
            <input id={CONSENT_FIELD_ID} name={CONSENT_FIELD_ID} type="checkbox" required className="mt-1" />
            I understand and want to share my network with this community.
          </label>
          <Button type="submit" disabled={consentMutation.isPending}>
            {consentMutation.isPending ? "Saving…" : "Agree and continue"}
          </Button>
        </form>
      </CardContent>
    </Card>
  );
}
