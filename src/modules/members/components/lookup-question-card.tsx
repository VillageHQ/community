"use client";

import { useMutation } from "@tanstack/react-query";
import { Sparkles } from "lucide-react";
import { useRouter } from "next/navigation";

import { FormError } from "@/components/form-error";
import { Button } from "@/components/ui/button";
import { acknowledgedResponseSchema } from "@/platform/http/contract";
import { postRequest } from "@/platform/http/post-request";
import { API_ROUTES } from "@/platform/http/routes";

export function saveLookupChoice(allowsLookup: boolean) {
  return postRequest(API_ROUTES.profileLookupChoice, { allowsLookup }, acknowledgedResponseSchema);
}

// Shown when the admin chose to ask each member, until this member answers.
export function LookupQuestionCard({ communityName }: { communityName: string }) {
  const router = useRouter();
  const choice = useMutation({ mutationFn: saveLookupChoice, onSuccess: () => router.refresh() });
  return (
    <section aria-labelledby="lookup-question-title" className="grid gap-3 rounded-card bg-card p-5 shadow-panel sm:rounded-panel sm:p-7">
      <h2 id="lookup-question-title" className="type-h3 flex items-center gap-2">
        <Sparkles aria-hidden="true" className="size-5 shrink-0 text-brand-emphasis" />
        Fill in your card from public profiles?
      </h2>
      <p className="text-foreground-soft">
        {communityName} can look up your public work profile through Village, using your email: your role, company, city and photo. Your own words always come first, and
        you can hide any line it fills in.
      </p>
      <div className="flex flex-wrap gap-2">
        <Button type="button" disabled={choice.isPending} onClick={() => choice.mutate(true)} className="max-sm:w-full">
          Yes, fill it in
        </Button>
        <Button type="button" variant="outline" disabled={choice.isPending} onClick={() => choice.mutate(false)} className="max-sm:w-full">
          No, don&apos;t look me up
        </Button>
      </div>
      <FormError message={choice.error?.message ?? null} />
    </section>
  );
}
