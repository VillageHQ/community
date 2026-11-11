"use client";

import { useActionState } from "react";

import { Button } from "@/components/ui/button";
import { Note } from "@/components/ui/note";
import { acceptedInviteSchema } from "@/modules/members/contract-invites";
import { API_ROUTES, ROUTES } from "@/platform/http/routes";
import { postRequest } from "@/platform/http/post-request";

type AcceptState = { errorMessage: string | null };

const INITIAL_STATE: AcceptState = { errorMessage: null };
const FALLBACK_ERROR_MESSAGE = "We couldn't let you in. Try again.";

async function submitAccept(token: string): Promise<AcceptState> {
  try {
    const { isSignedIn } = await postRequest(API_ROUTES.inviteAccept, { token }, acceptedInviteSchema);
    window.location.assign(isSignedIn ? ROUTES.landing : ROUTES.signIn);
    return INITIAL_STATE;
  } catch (error) {
    return { errorMessage: error instanceof Error ? error.message : FALLBACK_ERROR_MESSAGE };
  }
}

// Founderhall's invite confirm form: one full-width button. The welcome steps ask the name next.
export function AcceptForm({ token }: { token: string }) {
  const [state, formAction, isPending] = useActionState(() => submitAccept(token), INITIAL_STATE);
  return (
    <form action={formAction} className="mt-[18px]">
      {state.errorMessage ? (
        <Note kind="needs" role="alert" className="mb-3">
          {state.errorMessage}
        </Note>
      ) : null}
      <Button type="submit" width="block" disabled={isPending}>
        {isPending ? "Letting you in…" : "Accept and sign in"}
      </Button>
    </form>
  );
}
