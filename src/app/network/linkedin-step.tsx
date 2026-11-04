"use client";

import { useMutation, useQueryClient } from "@tanstack/react-query";

import { FormError } from "@/components/form-error";
import { FormField } from "@/components/form-field";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { API_ROUTES } from "@/lib/routes";
import { acknowledgedResponseSchema } from "@/lib/village/network-api";
import { postNetworkRequest } from "@/lib/village/post-network-request";

import { NETWORK_QUERY_KEYS } from "./network-queries";

const LINKEDIN_FIELD = "linkedinUrl";

function saveLinkedinUrl(formData: FormData) {
  return postNetworkRequest(
    API_ROUTES.networkLinkedin,
    { linkedinUrl: String(formData.get(LINKEDIN_FIELD)) },
    acknowledgedResponseSchema,
  );
}

export function LinkedinStep() {
  const queryClient = useQueryClient();
  const saveMutation = useMutation({
    mutationFn: saveLinkedinUrl,
    onSuccess: () => queryClient.invalidateQueries({ queryKey: [NETWORK_QUERY_KEYS.status] }),
  });

  return (
    <Card>
      <CardHeader>
        <CardTitle>
          <h2>Add your LinkedIn profile</h2>
        </CardTitle>
        <CardDescription>
          Other members see a community badge when you appear in their introduction paths.
        </CardDescription>
      </CardHeader>
      <CardContent>
        <form action={saveMutation.mutate} className="grid gap-4">
          <FormError message={saveMutation.error?.message ?? null} />
          <FormField
            name={LINKEDIN_FIELD}
            label="LinkedIn profile URL"
            type="url"
            autoComplete="url"
            placeholder="https://www.linkedin.com/in/your-name"
            required
          />
          <Button type="submit" disabled={saveMutation.isPending}>
            {saveMutation.isPending ? "Saving…" : "Save"}
          </Button>
        </form>
      </CardContent>
    </Card>
  );
}
