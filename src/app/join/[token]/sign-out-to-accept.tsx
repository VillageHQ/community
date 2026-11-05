"use client";

import { useMutation } from "@tanstack/react-query";

import { FormError } from "@/components/form-error";
import { QueryProvider } from "@/components/query-provider";
import { Button } from "@/components/ui/button";
import { signOutAndGoTo } from "@/lib/sign-out";

type SignOutToAcceptProps = { signedInName: string; path: string };

function SignOutButton({ signedInName, path }: SignOutToAcceptProps) {
  const signOutMutation = useMutation({ mutationFn: () => signOutAndGoTo(path) });
  return (
    <div className="grid gap-5">
      <h2 className="type-h3">You&apos;re signed in as {signedInName}</h2>
      <p className="text-foreground-soft">
        This invite creates a new account for someone else. Sign out first, then you can accept it here.
      </p>
      <FormError message={signOutMutation.error?.message ?? null} />
      <Button type="button" size="lg" disabled={signOutMutation.isPending} onClick={() => signOutMutation.mutate()}>
        {signOutMutation.isPending ? "Signing out…" : "Sign out and continue"}
      </Button>
    </div>
  );
}

export function SignOutToAccept(props: SignOutToAcceptProps) {
  return (
    <QueryProvider>
      <SignOutButton {...props} />
    </QueryProvider>
  );
}
