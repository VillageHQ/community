"use client";

import Link from "next/link";
import { useActionState } from "react";

import { FormError } from "@/components/form-error";
import { FormField } from "@/components/form-field";
import { Alert } from "@/components/ui/alert";
import { Button } from "@/components/ui/button";
import { MAXIMUM_PASSWORD_LENGTH, MINIMUM_PASSWORD_LENGTH } from "@/platform/auth/password-policy";
import { API_ROUTES, ROUTES } from "@/platform/http/routes";
import { acknowledgedResponseSchema } from "@/platform/http/contract";
import { postNetworkRequest } from "@/platform/http/post-request";

type RecoverState = { isDone: boolean; errorMessage: string | null };

const INITIAL_STATE: RecoverState = { isDone: false, errorMessage: null };

async function submitRecovery(_previousState: RecoverState, formData: FormData): Promise<RecoverState> {
  try {
    await postNetworkRequest(API_ROUTES.recoverAdmin, Object.fromEntries(formData), acknowledgedResponseSchema);
    return { isDone: true, errorMessage: null };
  } catch (error) {
    return { isDone: false, errorMessage: error instanceof Error ? error.message : "That didn't work. Try again." };
  }
}

export function RecoverAdminForm() {
  const [state, formAction, isPending] = useActionState(submitRecovery, INITIAL_STATE);
  if (state.isDone) {
    return (
      <div className="grid gap-4">
        <Alert variant="success">Your password changed, and every device was signed out.</Alert>
        <Button asChild size="lg">
          <Link href={ROUTES.signIn}>Sign in</Link>
        </Button>
      </div>
    );
  }
  return (
    <form action={formAction} className="grid gap-5">
      <FormField name="token" label="Setup token" type="password" autoComplete="off" hint="The long password you set when you deployed. It's called SETUP_TOKEN in your host's settings." required />
      <FormField name="email" label="Your admin email" type="email" autoComplete="email" required />
      <FormField
        name="newPassword"
        label="Your new password"
        type="password"
        autoComplete="new-password"
        minLength={MINIMUM_PASSWORD_LENGTH}
        maxLength={MAXIMUM_PASSWORD_LENGTH}
        hint={`Use at least ${MINIMUM_PASSWORD_LENGTH} characters.`}
        required
      />
      <FormError message={state.errorMessage} />
      <Button type="submit" size="lg" disabled={isPending}>
        {isPending ? "Saving…" : "Save my new password"}
      </Button>
    </form>
  );
}
