"use client";

import { ShieldCheck } from "lucide-react";
import { useActionState } from "react";

import { FormError } from "@/components/form-error";
import { FormField } from "@/components/form-field";
import { Button } from "@/components/ui/button";
import { useFocusOnFailure } from "@/components/use-focus-on-failure";
import { API_ROUTES } from "@/lib/routes";
import { acknowledgedResponseSchema } from "@/lib/village/network-api";
import { postNetworkRequest } from "@/lib/village/post-network-request";

type KeysState = { errorMessage: string | null };

const INITIAL_STATE: KeysState = { errorMessage: null };

async function submitKeys(_previousState: KeysState, formData: FormData): Promise<KeysState> {
  try {
    await postNetworkRequest(
      API_ROUTES.villageKeys,
      Object.fromEntries(formData),
      acknowledgedResponseSchema,
    );
    window.location.assign(window.location.pathname);
    return INITIAL_STATE;
  } catch (error) {
    return { errorMessage: error instanceof Error ? error.message : "Saving failed. Try again." };
  }
}

type KeysFormProps = { savedPublicKey: string; hasSavedKeys: boolean };

export function KeysForm({ savedPublicKey, hasSavedKeys }: KeysFormProps) {
  const [state, formAction, isPending] = useActionState(submitKeys, INITIAL_STATE);
  const publicKeyRef = useFocusOnFailure(state);

  return (
    <form action={formAction} className="grid gap-5">
      <p className="text-foreground-soft">
        You&apos;ll find both keys in Village&apos;s Platform Settings. We check them with Village before saving.
        {hasSavedKeys ? " Keys are saved. The secret key never leaves this server." : ""}
      </p>
      <FormError message={state.errorMessage} />
      <FormField
        ref={publicKeyRef}
        name="publicKey"
        label="Public key"
        autoComplete="off"
        defaultValue={savedPublicKey}
        required
      />
      <FormField
        name="secretKey"
        label="Secret key"
        type="password"
        autoComplete="off"
        hint={hasSavedKeys ? "Paste it again to replace the saved keys." : "It stays on this server."}
        required
      />
      <div>
        <Button type="submit" disabled={isPending}>
          <ShieldCheck aria-hidden="true" />
          {isPending ? "Checking keys…" : "Save keys"}
        </Button>
      </div>
    </form>
  );
}
