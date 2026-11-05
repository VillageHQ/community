"use client";

import Link from "next/link";
import { useActionState } from "react";

import { FormError } from "@/components/form-error";
import { FormField } from "@/components/form-field";
import { Alert } from "@/components/ui/alert";
import { Button } from "@/components/ui/button";
import { authClient } from "@/platform/auth/auth-client";
import { MAXIMUM_PASSWORD_LENGTH, MINIMUM_PASSWORD_LENGTH } from "@/platform/auth/password-policy";
import { ROUTES } from "@/platform/http/routes";

const FAILED_MESSAGE = "This link expired or was already used. Ask for a new one.";

type ResetState = { isDone: boolean; errorMessage: string | null };

const INITIAL_STATE: ResetState = { isDone: false, errorMessage: null };

async function submitReset(token: string, formData: FormData): Promise<ResetState> {
  const { error } = await authClient.resetPassword({ token, newPassword: String(formData.get("newPassword")) });
  if (error) return { isDone: false, errorMessage: FAILED_MESSAGE };
  return { isDone: true, errorMessage: null };
}

export function ResetPasswordForm({ token }: { token: string }) {
  const [state, formAction, isPending] = useActionState((_previousState: ResetState, formData: FormData) => submitReset(token, formData), INITIAL_STATE);
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
