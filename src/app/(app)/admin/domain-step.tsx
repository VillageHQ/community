"use client";

import { Check } from "lucide-react";
import { useActionState } from "react";

import { CopyButton } from "@/components/copy-button";
import { FormError } from "@/components/form-error";
import { Button } from "@/components/ui/button";
import { API_ROUTES, ROUTES } from "@/lib/routes";
import { acknowledgedResponseSchema } from "@/lib/village/network-api";
import { postNetworkRequest } from "@/lib/village/post-network-request";

type DomainState = { errorMessage: string | null };

const INITIAL_STATE: DomainState = { errorMessage: null };

async function confirmDomain(): Promise<DomainState> {
  try {
    await postNetworkRequest(API_ROUTES.setupDomain, { confirmed: true }, acknowledgedResponseSchema);
    window.location.assign(ROUTES.admin);
    return INITIAL_STATE;
  } catch (error) {
    return { errorMessage: error instanceof Error ? error.message : "Saving failed. Try again." };
  }
}

export function DomainStep({ domain, isDone }: { domain: string; isDone: boolean }) {
  const [state, formAction, isPending] = useActionState(confirmDomain, INITIAL_STATE);

  return (
    <>
      <p className="text-foreground-soft">
        Village needs to know this site&apos;s address before its sync popup can work here. In Village, open Platform
        Settings and enter this exact domain:
      </p>
      <div className="flex flex-wrap items-center gap-3 rounded-[28px] bg-muted py-1.5 pr-1.5 pl-[18px]">
        <code className="min-w-0 flex-1 font-sans font-bold break-all">{domain}</code>
        <CopyButton text={domain} label="Copy domain" />
      </div>
      <FormError message={state.errorMessage} />
      {isDone ? null : (
        <form action={formAction}>
          <Button type="submit" disabled={isPending}>
            <Check aria-hidden="true" />
            {isPending ? "Saving…" : "I've added it"}
          </Button>
        </form>
      )}
    </>
  );
}
