"use client";

import { useActionState, type Ref } from "react";

import { FormError } from "@/components/form-error";
import { FormField } from "@/components/form-field";
import { Button } from "@/components/ui/button";
import { useFocusOnFailure } from "@/components/use-focus-on-failure";
import { authClient } from "@/lib/auth-client";
import { ROUTES } from "@/lib/routes";

type SignInState = { errorMessage: string | null; email: string };

const INITIAL_STATE: SignInState = { errorMessage: null, email: "" };
const ERROR_ID = "sign-in-error";
const FALLBACK_ERROR_MESSAGE = "We could not sign you in. Try again.";

async function signIn(_previousState: SignInState, formData: FormData): Promise<SignInState> {
  const email = String(formData.get("email"));
  const { error } = await authClient.signIn.email({
    email,
    password: String(formData.get("password")),
  });
  if (error) return { errorMessage: error.message ?? FALLBACK_ERROR_MESSAGE, email };

  window.location.assign(ROUTES.landing);
  return INITIAL_STATE;
}

type SignInFieldsProps = { state: SignInState; passwordRef?: Ref<HTMLInputElement> };

export function SignInFields({ state, passwordRef }: SignInFieldsProps) {
  const hasError = Boolean(state.errorMessage);
  const describedByError = hasError ? ERROR_ID : undefined;
  return (
    <>
      <FormError id={ERROR_ID} message={state.errorMessage} />
      <FormField
        name="email"
        label="Email"
        type="email"
        autoComplete="email"
        defaultValue={state.email}
        aria-invalid={hasError || undefined}
        aria-describedby={describedByError}
        required
      />
      <FormField
        ref={passwordRef}
        name="password"
        label="Password"
        type="password"
        autoComplete="current-password"
        aria-invalid={hasError || undefined}
        aria-describedby={describedByError}
        required
      />
    </>
  );
}

export function SignInForm() {
  const [state, formAction, isPending] = useActionState(signIn, INITIAL_STATE);
  const passwordRef = useFocusOnFailure(state);

  return (
    <form action={formAction} className="grid gap-5">
      <SignInFields state={state} passwordRef={passwordRef} />
      <Button type="submit" size="lg" disabled={isPending}>
        {isPending ? "Signing in…" : "Sign in"}
      </Button>
    </form>
  );
}
