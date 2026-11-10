"use client";

import { useActionState } from "react";

import { FormError } from "@/components/form-error";
import { FormField } from "@/components/form-field";
import { Alert } from "@/components/ui/alert";
import { Button } from "@/components/ui/button";
import { authClient } from "@/platform/auth/auth-client";

// One answer for every address, known or not, so the form never tells who is a member.
export const SIGN_IN_LINK_SENT_MESSAGE = "If that email belongs to a member here, we sent a sign-in link to it. It works once and lasts 15 minutes.";
const TOO_MANY_MESSAGE = "Too many tries. Wait a minute and try again.";
const FAILED_MESSAGE = "We couldn't send that right now. Wait a minute and try again.";
const TOO_MANY_REQUESTS_STATUS = 429;

type LinkState = { sentMessage: string | null; errorMessage: string | null };

const INITIAL_STATE: LinkState = { sentMessage: null, errorMessage: null };

async function requestLink(_previousState: LinkState, formData: FormData): Promise<LinkState> {
  const { error } = await authClient.$fetch("/sign-in/magic-link", { method: "POST", body: { email: String(formData.get("email")).trim() } });
  if (!error) return { sentMessage: SIGN_IN_LINK_SENT_MESSAGE, errorMessage: null };
  return { sentMessage: null, errorMessage: error.status === TOO_MANY_REQUESTS_STATUS ? TOO_MANY_MESSAGE : FAILED_MESSAGE };
}

type SignInLinkFormProps = { initialEmail?: string; onEmailChange?: (email: string) => void };

export function SignInLinkForm({ initialEmail = "", onEmailChange }: SignInLinkFormProps) {
  const [state, formAction, isPending] = useActionState(requestLink, INITIAL_STATE);
  return (
    <form action={formAction} className="grid gap-5">
      <FormField
        name="email"
        label="Email"
        type="email"
        autoComplete="email"
        defaultValue={initialEmail}
        onChange={onEmailChange ? (event) => onEmailChange(event.target.value) : undefined}
        required
      />
      <FormError message={state.errorMessage} />
      {state.sentMessage ? <Alert variant="success">{state.sentMessage}</Alert> : null}
      <Button type="submit" size="lg" disabled={isPending}>
        {isPending ? "Sending…" : "Email me a sign-in link"}
      </Button>
    </form>
  );
}
