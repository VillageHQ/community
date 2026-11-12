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

async function submitAccept(token: string, emailedMark: string | null): Promise<AcceptState> {
  try {
    const body = emailedMark ? { token, emailed: emailedMark } : { token };
    const { isSignedIn } = await postRequest(API_ROUTES.inviteAccept, body, acceptedInviteSchema);
    window.location.assign(isSignedIn ? ROUTES.landing : ROUTES.signIn);
    return INITIAL_STATE;
  } catch (error) {
    return { errorMessage: error instanceof Error ? error.message : FALLBACK_ERROR_MESSAGE };
  }
}

// Founderhall's invite confirm form: one full-width button. The welcome steps ask the name next. emailedMark comes from
// the emailed link (absent on a copied one) and lets the join confirm the address.
export function AcceptForm({ token, emailedMark }: { token: string; emailedMark: string | null }) {
  const [state, formAction, isPending] = useActionState(() => submitAccept(token, emailedMark), INITIAL_STATE);
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
