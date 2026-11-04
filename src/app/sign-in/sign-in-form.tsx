"use client";

import { useActionState } from "react";

import { FormError } from "@/components/form-error";
import { FormField } from "@/components/form-field";
import { Button } from "@/components/ui/button";
import { authClient } from "@/lib/auth-client";
import { ROUTES } from "@/lib/routes";

type SignInState = { errorMessage: string | null; email: string };

const INITIAL_STATE: SignInState = { errorMessage: null, email: "" };
const FALLBACK_ERROR_MESSAGE = "We could not sign you in. Try again.";

async function signIn(_previousState: SignInState, formData: FormData): Promise<SignInState> {
  const email = String(formData.get("email"));
  const { error } = await authClient.signIn.email({
    email,
    password: String(formData.get("password")),
  });
  if (error) return { errorMessage: error.message ?? FALLBACK_ERROR_MESSAGE, email };

  window.location.assign(ROUTES.home);
  return INITIAL_STATE;
}

export function SignInForm() {
  const [state, formAction, isPending] = useActionState(signIn, INITIAL_STATE);

  return (
    <form action={formAction} className="grid gap-4">
      <FormError message={state.errorMessage} />
      <FormField
        name="email"
        label="Email"
        type="email"
        autoComplete="email"
        defaultValue={state.email}
        required
      />
      <FormField
        name="password"
        label="Password"
        type="password"
        autoComplete="current-password"
        required
      />
      <Button type="submit" disabled={isPending}>
        {isPending ? "Signing in…" : "Sign in"}
      </Button>
    </form>
  );
}
