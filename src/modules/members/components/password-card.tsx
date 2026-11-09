"use client";

import { useActionState } from "react";

import { FormError } from "@/components/form-error";
import { FormField } from "@/components/form-field";
import { Alert } from "@/components/ui/alert";
import { Button } from "@/components/ui/button";
import { MAXIMUM_PASSWORD_LENGTH, MINIMUM_PASSWORD_LENGTH } from "@/platform/auth/password-policy";
import { acknowledgedResponseSchema } from "@/platform/http/contract";
import { postRequest } from "@/platform/http/post-request";
import { API_ROUTES } from "@/platform/http/routes";

type AddState = { doneMessage: string | null; errorMessage: string | null };

const INITIAL_STATE: AddState = { doneMessage: null, errorMessage: null };

async function submitPassword(_previousState: AddState, formData: FormData): Promise<AddState> {
  try {
    const { message } = await postRequest(API_ROUTES.profilePassword, { password: String(formData.get("password")) }, acknowledgedResponseSchema);
    return { doneMessage: message, errorMessage: null };
  } catch (error) {
    return { doneMessage: null, errorMessage: error instanceof Error ? error.message : "That didn't work. Try again." };
  }
}

function AddPasswordForm() {
  const [state, formAction, isPending] = useActionState(submitPassword, INITIAL_STATE);
  if (state.doneMessage) return <Alert variant="success">{state.doneMessage}</Alert>;
  return (
    <form action={formAction} className="grid gap-4">
      <FormField
        name="password"
        label="New password"
        type="password"
        autoComplete="new-password"
        minLength={MINIMUM_PASSWORD_LENGTH}
        maxLength={MAXIMUM_PASSWORD_LENGTH}
        hint={`At least ${MINIMUM_PASSWORD_LENGTH} characters.`}
        required
      />
      <FormError message={state.errorMessage} />
      <div>
        <Button type="submit" disabled={isPending} className="max-sm:w-full">
          {isPending ? "Adding…" : "Add a password"}
        </Button>
      </div>
    </form>
  );
}

export function PasswordCard({ hasPassword, isLinkOn }: { hasPassword: boolean; isLinkOn: boolean }) {
  return (
    <section aria-labelledby="password-card-title" className="mt-5 grid gap-3 rounded-card bg-card p-5 shadow-panel sm:rounded-panel sm:p-7">
      <h2 id="password-card-title" className="type-h3">
        How you sign in
      </h2>
      {hasPassword ? (
        <p className="type-small text-foreground-soft">
          {isLinkOn ? "With your password, or with a link we email you." : "With your email and password."} To change your password, sign out and use
          Forgot your password.
        </p>
      ) : (
        <>
          <p className="type-small text-foreground-soft">
            You sign in with a link we email you. Add a password if you&apos;d also like to sign in without checking your email.
          </p>
          <AddPasswordForm />
        </>
      )}
    </section>
  );
}
