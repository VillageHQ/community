"use client";

import Link from "next/link";
import { useActionState, useState, type Ref } from "react";

import { FormError } from "@/components/form-error";
import { FormField } from "@/components/form-field";
import { Button } from "@/components/ui/button";
import { useFocusOnFailure } from "@/components/use-focus-on-failure";
import { authClient } from "@/platform/auth/auth-client";
import { ROUTES } from "@/platform/http/routes";

import { SignInLinkForm } from "./sign-in-link-form";

type SignInState = { errorMessage: string | null; email: string };

const INITIAL_STATE: SignInState = { errorMessage: null, email: "" };
const ERROR_ID = "sign-in-error";
const FALLBACK_ERROR_MESSAGE = "We could not sign you in. Try again.";

async function signIn(returnPath: string, formData: FormData): Promise<SignInState> {
  const email = String(formData.get("email"));
  const { error } = await authClient.signIn.email({
    email,
    password: String(formData.get("password")),
  });
  if (error) return { errorMessage: error.message ?? FALLBACK_ERROR_MESSAGE, email };

  window.location.assign(returnPath);
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

export function SignInForm({ returnPath = ROUTES.landing }: { returnPath?: string | null }) {
  const [state, formAction, isPending] = useActionState(
    (_previousState: SignInState, formData: FormData) => signIn(returnPath ?? ROUTES.landing, formData),
    INITIAL_STATE,
  );
  const passwordRef = useFocusOnFailure(state);

  return (
    <form action={formAction} className="grid gap-5">
      <SignInFields state={state} passwordRef={passwordRef} />
      <Button type="submit" size="lg" disabled={isPending}>
        {isPending ? "Signing in…" : "Sign in"}
      </Button>
      <Button asChild variant="link" size="sm" className="justify-self-center">
        <Link href={ROUTES.forgotPassword}>Forgot your password?</Link>
      </Button>
    </form>
  );
}

// With email on, the emailed link comes first and the password form waits behind a button.
export function SignInChoice({ returnPath, isLinkOn }: { returnPath?: string | null; isLinkOn: boolean }) {
  const [isPasswordShown, setIsPasswordShown] = useState(false);
  if (!isLinkOn || isPasswordShown) {
    return (
      <div className="grid gap-5">
        <SignInForm returnPath={returnPath} />
        {isLinkOn ? (
          <Button type="button" variant="quiet" className="justify-self-center" onClick={() => setIsPasswordShown(false)}>
            Email me a sign-in link instead
          </Button>
        ) : null}
      </div>
    );
  }
  return (
    <div className="grid gap-5">
      <SignInLinkForm />
      <Button type="button" variant="quiet" className="justify-self-center font-medium underline underline-offset-2 hover:bg-transparent" onClick={() => setIsPasswordShown(true)}>
        Sign in with a password instead
      </Button>
    </div>
  );
}
