"use client";

import { Check } from "lucide-react";
import { useActionState } from "react";

import { CopyButton } from "@/components/copy-button";
import { ExternalTextLink } from "@/components/external-text-link";
import { FormError } from "@/components/form-error";
import { Button } from "@/components/ui/button";
import { VILLAGE_PLATFORM_LINKS } from "@/lib/admin/settings-copy";
import { API_ROUTES } from "@/lib/routes";
import { acknowledgedResponseSchema } from "@/lib/village/network-api";
import { postNetworkRequest } from "@/lib/village/post-network-request";

type DomainState = { errorMessage: string | null };

const INITIAL_STATE: DomainState = { errorMessage: null };

async function confirmDomain(): Promise<DomainState> {
  try {
    await postNetworkRequest(API_ROUTES.setupDomain, { confirmed: true }, acknowledgedResponseSchema);
    window.location.assign(window.location.pathname);
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
        Village runs network search for your community, and it needs to know this site&apos;s address before its sync
        popup can work here. This takes a few minutes in Village&apos;s own site.
      </p>
      <ol className="grid list-decimal gap-2 pl-5 text-foreground-soft">
        <li>
          Open <ExternalTextLink href={VILLAGE_PLATFORM_LINKS.home}>Village&apos;s platform</ExternalTextLink> and choose{" "}
          <strong className="font-bold text-foreground">New developer account</strong>. You sign in with Google. If you
          already have one, choose <strong className="font-bold text-foreground">Login</strong>.
        </li>
        <li>
          Follow Village&apos;s <ExternalTextLink href={VILLAGE_PLATFORM_LINKS.checklist}>checklist</ExternalTextLink>. It
          asks for a payment method before your app can go live.
        </li>
        <li>
          Open <ExternalTextLink href={VILLAGE_PLATFORM_LINKS.appSettings}>App Settings</ExternalTextLink>. Set{" "}
          <strong className="font-bold text-foreground">Title</strong> to your community&apos;s name, because members see
          it in the popup. Paste this exact address under{" "}
          <strong className="font-bold text-foreground">Domain Name</strong>:
        </li>
      </ol>
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
