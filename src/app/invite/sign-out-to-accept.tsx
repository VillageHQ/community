"use client";

import { useMutation } from "@tanstack/react-query";

import { QueryProvider } from "@/components/query-provider";
import { Button } from "@/components/ui/button";
import { Note } from "@/components/ui/note";
import { signOutAndGoTo } from "@/platform/auth/sign-out";

type SignOutToAcceptProps = { signedInName: string; path: string };

// Community-only: someone already signed in on this device opens another person's invite.
function SignOutButton({ signedInName, path }: SignOutToAcceptProps) {
  const signOutMutation = useMutation({ mutationFn: () => signOutAndGoTo(path) });
  return (
    <div className="mt-[18px]">
      <Note>
        You’re signed in as {signedInName}. This invite makes a new account for someone else: sign out first, then accept it here.
      </Note>
      {signOutMutation.error ? (
        <Note kind="needs" role="alert" className="mt-3">
          {signOutMutation.error.message}
        </Note>
      ) : null}
      <Button type="button" width="block" className="mt-4" disabled={signOutMutation.isPending} onClick={() => signOutMutation.mutate()}>
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
