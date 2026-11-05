"use client";

import { useMutation } from "@tanstack/react-query";
import { CircleCheck, Clock, MailCheck, UserRoundX } from "lucide-react";
import Link from "next/link";

import { EmptyState } from "@/components/empty-state";
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

function InvalidLink({ isNetworkOn }: { isNetworkOn: boolean }) {
  return (
    <EmptyState
      headingLevel="h1"
      icon={Clock}
      title="This link didn't work"
      description={isNetworkOn ? INVALID_LINK_WITH_NETWORK : INVALID_LINK_WITHOUT_NETWORK}
    >
      <Button asChild size="lg">
        <Link href={ROUTES.landing}>Continue</Link>
      </Button>
    </EmptyState>
  );
}

function WrongAccount({ accountName, path }: { accountName: string; path: string }) {
  const signOutMutation = useMutation({ mutationFn: () => signOutAndGoTo(path) });
  return (
    <EmptyState
      headingLevel="h1"
      icon={UserRoundX}
      title="This link is for another account"
      description={`You're signed in as ${accountName}. We didn't change anything. Sign out, then sign in to the account this link is for.`}
    >
      <FormError message={signOutMutation.error?.message ?? null} />
      <Button type="button" size="lg" disabled={signOutMutation.isPending} onClick={() => signOutMutation.mutate()}>
        {signOutMutation.isPending ? "Signing out…" : "Sign out and continue"}
      </Button>
    </EmptyState>
  );
}

type ConfirmAccountProps = { token: string; accountName: string; accountEmail: string; isNetworkOn: boolean };

function ConfirmAccount({ token, accountName, accountEmail, isNetworkOn }: ConfirmAccountProps) {
  const confirmMutation = useMutation({ mutationFn: confirmEmail });
  if (confirmMutation.isSuccess) {
    return (
      <EmptyState
        headingLevel="h1"
        icon={CircleCheck}
        title="Your email is confirmed"
        description={isNetworkOn ? "Thanks. Network search is open to you now." : "Thanks. You're all set."}
      >
        <Button asChild size="lg">
          <Link href={ROUTES.landing}>Continue</Link>
        </Button>
      </EmptyState>
    );
  }
  return (
    <EmptyState
      headingLevel="h1"
      icon={MailCheck}
      title="Is this your email?"
      description={`${accountEmail} belongs to the account named ${accountName}. Confirm only if this account is yours.`}
    >
      <FormError message={confirmMutation.error?.message ?? null} />
      <Button type="button" size="lg" disabled={confirmMutation.isPending} onClick={() => confirmMutation.mutate(token)}>
        {confirmMutation.isPending ? "Confirming…" : "Yes, confirm my email"}
      </Button>
    </EmptyState>
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
