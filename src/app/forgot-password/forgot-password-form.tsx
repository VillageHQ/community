"use client";

import { useActionState } from "react";

import { FormError } from "@/components/form-error";
import { FormField } from "@/components/form-field";
import { Alert } from "@/components/ui/alert";
import { Button } from "@/components/ui/button";
import { authClient } from "@/lib/auth-client";

const SENT_MESSAGE = "If that email has an account here, we sent a link to it. It works once and lasts one hour.";
const FAILED_MESSAGE = "We couldn't send that right now. Wait a minute and try again.";

type ForgotState = { sentMessage: string | null; errorMessage: string | null };

const INITIAL_STATE: ForgotState = { sentMessage: null, errorMessage: null };

async function requestReset(_previousState: ForgotState, formData: FormData): Promise<ForgotState> {
  const { error } = await authClient.requestPasswordReset({ email: String(formData.get("email")) });
  if (error) return { sentMessage: null, errorMessage: FAILED_MESSAGE };
  return { sentMessage: SENT_MESSAGE, errorMessage: null };
}

export function ForgotPasswordForm() {
  const [state, formAction, isPending] = useActionState(requestReset, INITIAL_STATE);
  return (
    <form action={formAction} className="grid gap-5">
      <FormField name="email" label="Your email" type="email" autoComplete="email" required />
      <FormError message={state.errorMessage} />
      {state.sentMessage ? <Alert variant="success">{state.sentMessage}</Alert> : null}
      <Button type="submit" size="lg" disabled={isPending}>
        {isPending ? "Sending…" : "Send me a link"}
      </Button>
    </form>
  );
}
