"use client";

import Link from "next/link";
import { useActionState } from "react";
import { z } from "zod";

import { FormError } from "@/components/form-error";
import { Alert } from "@/components/ui/alert";
import { Button } from "@/components/ui/button";
import { API_ROUTES, ROUTES } from "@/platform/http/routes";
import { postRequest } from "@/platform/http/post-request";

const signedInSchema = z.object({ isPasswordRemoved: z.boolean() });
const FAILED_MESSAGE = "This link didn't work. It may have expired or been used already. Ask for a new one.";

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

// A mail scanner that opens the link sees only this button. Nobody is signed in until a person presses it.
export function SignInLinkConfirm({ token }: { token: string }) {
  const [state, formAction, isPending] = useActionState(() => confirmSignIn(token), INITIAL_STATE);

  if (state.isPasswordRemoved) {
    return (
      <div className="grid gap-4">
        <Alert variant="success">
          You&apos;re signed in, and your email is confirmed. Your old password was set before this email was confirmed, so we removed it to keep the account
          safe. Add a new one on your card page whenever you like.
        </Alert>
        <Button asChild size="lg">
          <Link href={ROUTES.landing}>Continue</Link>
        </Button>
      </div>
    );
  }
  return (
    <form action={formAction} className="grid gap-5">
      <FormError message={state.errorMessage} />
      {state.errorMessage ? (
        <Button asChild size="lg">
          <Link href={ROUTES.signIn}>Ask for a new link</Link>
        </Button>
      ) : (
        <Button type="submit" size="lg" disabled={isPending}>
          {isPending ? "Signing in…" : "Sign me in"}
        </Button>
      )}
    </form>
  );
}
