"use client";

import { useActionState } from "react";
import { z } from "zod";

import { Button, ButtonRow } from "@/components/ui/button";
import { Note } from "@/components/ui/note";
import { API_ROUTES, ROUTES } from "@/platform/http/routes";
import { postRequest } from "@/platform/http/post-request";

const signedInSchema = z.object({ isPasswordRemoved: z.boolean() });
const FAILED_MESSAGE = "That link doesn’t work any more. Sign-in links work once and last 15 minutes. Ask for a fresh sign-in link instead.";

type ConfirmState = { isPasswordRemoved: boolean; errorMessage: string | null };

const INITIAL_STATE: ConfirmState = { isPasswordRemoved: false, errorMessage: null };

async function confirmSignIn(token: string): Promise<ConfirmState> {
  try {
    const { isPasswordRemoved } = await postRequest(API_ROUTES.signInLink, { token }, signedInSchema, FAILED_MESSAGE);
    if (!isPasswordRemoved) window.location.assign(ROUTES.landing);
    return { isPasswordRemoved, errorMessage: null };
  } catch (error) {
    return { isPasswordRemoved: false, errorMessage: error instanceof Error ? error.message : FAILED_MESSAGE };
  }
}

// Founderhall's confirm form: one full-width Sign in button. Nobody is signed in until a person presses it.
export function SignInLinkConfirm({ token }: { token: string }) {
  const [state, formAction, isPending] = useActionState(() => confirmSignIn(token), INITIAL_STATE);

  // Community-only: an old password set before the address was confirmed is removed on the way in.
  if (state.isPasswordRemoved) {
    return (
      <div className="mt-[18px]">
        <Note kind="ok">
          You’re signed in, and your email is confirmed. Your old password was set before this email was confirmed, so we removed it to keep the account safe. Add a
          new one on My profile whenever you like.
        </Note>
        <ButtonRow className="mt-4">
          <Button asChild>
            <a href={ROUTES.landing}>Continue</a>
          </Button>
        </ButtonRow>
      </div>
    );
  }
  if (state.errorMessage) {
    return (
      <div className="mt-[18px]">
        <Note kind="needs" role="alert">
          {state.errorMessage}
        </Note>
        <ButtonRow className="mt-4">
          <Button asChild>
            <a href={ROUTES.signIn}>Get a new sign-in link</a>
          </Button>
        </ButtonRow>
      </div>
    );
  }
  return (
    <form action={formAction} className="mt-[18px]">
      <Button type="submit" width="block" disabled={isPending}>
        {isPending ? "Signing in…" : "Sign in"}
      </Button>
    </form>
  );
}
