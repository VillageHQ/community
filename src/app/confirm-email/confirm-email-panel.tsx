"use client";

import { useMutation } from "@tanstack/react-query";
import type { ReactNode } from "react";

import { FormError } from "@/components/form-error";
import { QueryProvider } from "@/components/query-provider";
import { Button } from "@/components/ui/button";
import { CONFIRMATION_VIEWS, type ConfirmationView } from "@/modules/members/contract-email-confirmation";
import { API_ROUTES, ROUTES } from "@/platform/http/routes";
import { signOutAndGoTo } from "@/platform/auth/sign-out";
import { acknowledgedResponseSchema } from "@/platform/http/contract";
import { postRequest } from "@/platform/http/post-request";

function confirmEmail(token: string) {
  return postRequest(API_ROUTES.networkConfirm, { token }, acknowledgedResponseSchema);
}

const INVALID_LINK_WITH_NETWORK = "It may have expired or been used already. If your email isn't confirmed yet, open Network to get a new link, or ask your admin to confirm you.";
const INVALID_LINK_WITHOUT_NETWORK = "It may have expired or been used already. If your email isn't confirmed yet, ask your admin to confirm it.";

// Founderhall's message card (a heading, a lede, one button row) inside the public page.
function Message({ title, description, children }: { title: string; description: string; children: ReactNode }) {
  return (
    <>
      <h1 className="fh-h2">{title}</h1>
      <p className="fh-lede">{description}</p>
      <div className="mt-4 grid gap-3">{children}</div>
    </>
  );
}

function InvalidLink({ isNetworkOn }: { isNetworkOn: boolean }) {
  return (
    <Message title="This link didn't work"
      description={isNetworkOn ? INVALID_LINK_WITH_NETWORK : INVALID_LINK_WITHOUT_NETWORK}
    >
      <Button asChild width="block">
        <a href={ROUTES.landing}>Continue</a>
      </Button>
    </Message>
  );
}

function WrongAccount({ accountName, path }: { accountName: string; path: string }) {
  const signOutMutation = useMutation({ mutationFn: () => signOutAndGoTo(path) });
  return (
    <Message title="This link is for another account"
      description={`You're signed in as ${accountName}. We didn't change anything. Sign out, then sign in to the account this link is for.`}
    >
      <FormError message={signOutMutation.error?.message ?? null} />
      <Button type="button" width="block" disabled={signOutMutation.isPending} onClick={() => signOutMutation.mutate()}>
        {signOutMutation.isPending ? "Signing out…" : "Sign out and continue"}
      </Button>
    </Message>
  );
}

type ConfirmAccountProps = { token: string; accountName: string; accountEmail: string; isNetworkOn: boolean };

function ConfirmAccount({ token, accountName, accountEmail, isNetworkOn }: ConfirmAccountProps) {
  const confirmMutation = useMutation({ mutationFn: confirmEmail });
  if (confirmMutation.isSuccess) {
    return (
      <Message title="Your email is confirmed"
        description={isNetworkOn ? "Thanks. Network search is open to you now." : "Thanks. You're all set."}
      >
        <Button asChild width="block">
          <a href={ROUTES.landing}>Continue</a>
        </Button>
      </Message>
    );
  }
  return (
    <Message title="Is this your email?"
      description={`${accountEmail} belongs to the account named ${accountName}. Confirm only if this account is yours.`}
    >
      <FormError message={confirmMutation.error?.message ?? null} />
      <Button type="button" width="block" disabled={confirmMutation.isPending} onClick={() => confirmMutation.mutate(token)}>
        {confirmMutation.isPending ? "Confirming…" : "Yes, confirm my email"}
      </Button>
    </Message>
  );
}

type ConfirmEmailPanelProps = Omit<ConfirmAccountProps, "isNetworkOn"> & { view: ConfirmationView; path: string; isNetworkOn: boolean };

export function ConfirmEmailPanel({ view, token, path, accountName, accountEmail, isNetworkOn }: ConfirmEmailPanelProps) {
  if (view === CONFIRMATION_VIEWS.invalid) return <InvalidLink isNetworkOn={isNetworkOn} />;
  return (
    <QueryProvider>
      {view === CONFIRMATION_VIEWS.wrongAccount ? (
        <WrongAccount accountName={accountName} path={path} />
      ) : (
        <ConfirmAccount token={token} accountName={accountName} accountEmail={accountEmail} isNetworkOn={isNetworkOn} />
      )}
    </QueryProvider>
  );
}
