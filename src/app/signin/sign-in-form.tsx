"use client";

import Link from "next/link";
import { useActionState, type Ref } from "react";

import { Field } from "@/components/form-field";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { useFocusOnFailure } from "@/components/use-focus-on-failure";
import { authClient } from "@/platform/auth/auth-client";
import { ROUTES } from "@/platform/http/routes";

type SignInState = { errorMessage: string | null; email: string };

const INITIAL_STATE: SignInState = { errorMessage: null, email: "" };
const ERROR_ID = "sign-in-error";
const FALLBACK_ERROR_MESSAGE = "We could not sign you in. Try again.";
const WRONG_PASSWORD_MESSAGE = "That email and password don’t match. Try again.";
const UNAUTHORIZED_STATUS = 401;

async function signIn(returnPath: string, formData: FormData): Promise<SignInState> {
  const email = String(formData.get("email"));
  const { error } = await authClient.signIn.email({
    email,
    password: String(formData.get("password")),
  });
  if (error) return { errorMessage: error.status === UNAUTHORIZED_STATUS ? WRONG_PASSWORD_MESSAGE : (error.message ?? FALLBACK_ERROR_MESSAGE), email };

  window.location.assign(returnPath);
  return INITIAL_STATE;
}

type SignInFieldsProps = { state: SignInState; passwordRef?: Ref<HTMLInputElement>; onEmailChange?: (email: string) => void };

// Community keeps passwords (Founderhall has none): the same fields as the link form, with Founderhall's field parts.
export function SignInFields({ state, passwordRef, onEmailChange }: SignInFieldsProps) {
  const hasError = Boolean(state.errorMessage);
  const describedByError = hasError ? ERROR_ID : undefined;
  return (
    <>
      <Field htmlFor="email" label="Your email">
        <Input
          id="email"
          name="email"
          type="email"
          autoComplete="email"
          inputMode="email"
          placeholder="you@example.com"
          defaultValue={state.email}
          onChange={onEmailChange ? (event) => onEmailChange(event.target.value) : undefined}
          aria-invalid={hasError || undefined}
          aria-describedby={describedByError}
          required
        />
      </Field>
      <Field htmlFor="password" label="Password" error={state.errorMessage ? <span id={ERROR_ID}>{state.errorMessage}</span> : null} className="fh-field">
        <Input
          ref={passwordRef}
          id="password"
          name="password"
          type="password"
          autoComplete="current-password"
          aria-invalid={hasError || undefined}
          aria-describedby={describedByError}
          required
        />
      </Field>
    </>
  );
}

type SignInFormProps = { returnPath?: string | null; initialEmail?: string; onEmailChange?: (email: string) => void };

export function SignInForm({ returnPath = ROUTES.landing, initialEmail = "", onEmailChange }: SignInFormProps) {
  const [state, formAction, isPending] = useActionState(
    (_previousState: SignInState, formData: FormData) => signIn(returnPath ?? ROUTES.landing, formData),
    { ...INITIAL_STATE, email: initialEmail },
  );
  const passwordRef = useFocusOnFailure(state);

  return (
    <form action={formAction} className="fh-field" noValidate={false}>
      <SignInFields state={state} passwordRef={passwordRef} onEmailChange={onEmailChange} />
      <Button type="submit" width="block" disabled={isPending} className="mt-[14px]">
        {isPending ? "Signing in…" : "Sign in"}
      </Button>
      <p className="fh-small mt-3">
        <Link href={ROUTES.forgotPassword}>Forgot your password?</Link>
      </p>
    </form>
  );
}
