"use client";

import { useActionState } from "react";

import { FormError } from "@/components/form-error";
import { FormField } from "@/components/form-field";
import { Button } from "@/components/ui/button";
import { useFocusOnFailure } from "@/components/use-focus-on-failure";
import { MAXIMUM_PASSWORD_LENGTH, MINIMUM_PASSWORD_LENGTH } from "@/lib/password-policy";
import { readResponseMessage } from "@/lib/read-response-message";
import { API_ROUTES, ROUTES } from "@/lib/routes";

type SetupState = { errorMessage: string | null; name: string; email: string };

const INITIAL_STATE: SetupState = { errorMessage: null, name: "", email: "" };
const FALLBACK_ERROR_MESSAGE = "Setup failed. Try again.";

async function submitSetup(_previousState: SetupState, formData: FormData): Promise<SetupState> {
  const response = await fetch(API_ROUTES.setup, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(Object.fromEntries(formData)),
  });
  if (!response.ok) {
    return {
      errorMessage: await readResponseMessage(response, FALLBACK_ERROR_MESSAGE),
      name: String(formData.get("name")),
      email: String(formData.get("email")),
    };
  }

  window.location.assign(ROUTES.signIn);
  return INITIAL_STATE;
}

export function SetupForm() {
  const [state, formAction, isPending] = useActionState(submitSetup, INITIAL_STATE);
  const tokenRef = useFocusOnFailure(state);

  return (
    <form action={formAction} className="grid gap-5">
      <FormError message={state.errorMessage} />
      <FormField
        ref={tokenRef}
        name="token"
        label="Setup token"
        type="password"
        autoComplete="off"
        hint="The SETUP_TOKEN value you chose at deploy time."
        required
      />
      <FormField
        name="name"
        label="Your name"
        autoComplete="name"
        defaultValue={state.name}
        required
      />
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
        autoComplete="new-password"
        minLength={MINIMUM_PASSWORD_LENGTH}
        maxLength={MAXIMUM_PASSWORD_LENGTH}
        hint={`At least ${MINIMUM_PASSWORD_LENGTH} characters.`}
        required
      />
      <Button type="submit" size="lg" disabled={isPending}>
        {isPending ? "Creating admin…" : "Create admin"}
      </Button>
    </form>
  );
}
