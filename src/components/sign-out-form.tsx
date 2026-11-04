"use client";

import { Button } from "@/components/ui/button";
import { authClient } from "@/lib/auth-client";
import { ROUTES } from "@/lib/routes";

async function signOut() {
  await authClient.signOut();
  window.location.assign(ROUTES.signIn);
}

export function SignOutForm() {
  return (
    <form action={signOut}>
      <Button type="submit" variant="outline">
        Sign out
      </Button>
    </form>
  );
}
