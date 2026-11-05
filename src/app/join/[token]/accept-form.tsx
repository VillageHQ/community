"use client";

import { useActionState } from "react";

import { FormError } from "@/components/form-error";
import { FormField } from "@/components/form-field";
import { Button } from "@/components/ui/button";
import { useFocusOnFailure } from "@/components/use-focus-on-failure";
import { acceptedInviteSchema } from "@/lib/invites/invite-api";
import { MAXIMUM_NAME_LENGTH } from "@/platform/auth/member-name";
import { MAXIMUM_PASSWORD_LENGTH, MINIMUM_PASSWORD_LENGTH } from "@/platform/auth/password-policy";
import { API_ROUTES, ROUTES } from "@/platform/http/routes";
import { postNetworkRequest } from "@/platform/http/post-request";

type AcceptState = { errorMessage: string | null; name: string };

const INITIAL_STATE: AcceptState = { errorMessage: null, name: "" };
const FALLBACK_ERROR_MESSAGE = "We couldn't create your account. Try again.";

async function submitAccept(token: string, formData: FormData): Promise<AcceptState> {
  const name = String(formData.get("name"));
  try {
    const { isSignedIn } = await postNetworkRequest(
      API_ROUTES.inviteAccept,
      { token, name, password: String(formData.get("password")) },
      acceptedInviteSchema,
    );
    window.location.assign(isSignedIn ? ROUTES.landing : ROUTES.signIn);
    return INITIAL_STATE;
  } catch (error) {
    return { errorMessage: error instanceof Error ? error.message : FALLBACK_ERROR_MESSAGE, name };
  }
}

export function AcceptForm({ token, email }: { token: string; email: string }) {
  const [state, formAction, isPending] = useActionState(
    (_previousState: AcceptState, formData: FormData) => submitAccept(token, formData),
    INITIAL_STATE,
  );
  const nameRef = useFocusOnFailure(state);

  return (
    <form action={formAction} className="grid gap-5">
      <FormError message={state.errorMessage} />
      <FormField
        name="email"
        label="Email"
        type="email"
        autoComplete="username"
        value={email}
        readOnly
        hint="Your invite is for this address, and it becomes your account email."
        className="bg-muted"
      />
      <FormField
        ref={nameRef}
        name="name"
        label="Your name"
        autoComplete="name"
        defaultValue={state.name}
        maxLength={MAXIMUM_NAME_LENGTH}
        required
      />
      <FormField
        name="password"
        label="Choose a password"
        type="password"
        autoComplete="new-password"
        minLength={MINIMUM_PASSWORD_LENGTH}
        maxLength={MAXIMUM_PASSWORD_LENGTH}
        hint={`At least ${MINIMUM_PASSWORD_LENGTH} characters.`}
        required
      />
      <Button type="submit" size="hero" disabled={isPending}>
        {isPending ? "Saving your seat…" : "Come on in"}
      </Button>
    </form>
  );
}
