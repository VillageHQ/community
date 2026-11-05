"use client";

import { useMutation } from "@tanstack/react-query";
import type { FormEvent } from "react";

import { FormError } from "@/components/form-error";
import { FormField } from "@/components/form-field";
import { Alert } from "@/components/ui/alert";
import { Button } from "@/components/ui/button";
import { Card, CardDescription, CardTitle } from "@/components/ui/card";

import { clearLinkedinRequest } from "@/modules/members/queries-invites";

const LINKEDIN_FIELD = "claimedLinkedinUrl";

function readSubmittedUrl(event: FormEvent<HTMLFormElement>) {
  event.preventDefault();
  return String(new FormData(event.currentTarget).get(LINKEDIN_FIELD));
}

export function LinkedinClaimCard() {
  const clearMutation = useMutation({ mutationFn: clearLinkedinRequest });
  return (
    <Card className="grid gap-4 sm:rounded-panel sm:p-7">
      <div className="grid gap-1.5">
        <CardTitle>Free up a LinkedIn profile</CardTitle>
        <CardDescription>
          Each LinkedIn profile belongs to one member. If someone holds a profile that isn&apos;t theirs, paste it here.
          The real owner can then add it.
        </CardDescription>
      </div>
      <form onSubmit={(event) => clearMutation.mutate(readSubmittedUrl(event))} className="grid gap-4">
        <FormField
          name={LINKEDIN_FIELD}
          label="LinkedIn profile URL"
          type="url"
          autoComplete="off"
          placeholder="https://www.linkedin.com/in/their-name"
          required
        />
        <FormError message={clearMutation.error?.message ?? null} />
        {clearMutation.isSuccess ? <Alert variant="success">{clearMutation.data.message}</Alert> : null}
        <Button type="submit" variant="outline" disabled={clearMutation.isPending} className="max-sm:w-full sm:justify-self-start">
          {clearMutation.isPending ? "Clearing…" : "Clear this profile"}
        </Button>
      </form>
    </Card>
  );
}
