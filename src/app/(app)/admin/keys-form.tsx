"use client";

import { ShieldCheck } from "lucide-react";
import { useActionState } from "react";

import { ExternalTextLink } from "@/components/external-text-link";
import { FormError } from "@/components/form-error";
import { FormField } from "@/components/form-field";
import { Button } from "@/components/ui/button";
import { useFocusOnFailure } from "@/components/use-focus-on-failure";
import { VILLAGE_PLATFORM_LINKS } from "@/lib/admin/settings-copy";
import { API_ROUTES } from "@/platform/http/routes";
import { acknowledgedResponseSchema } from "@/platform/http/contract";
import { postNetworkRequest } from "@/platform/http/post-request";

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
        Open <ExternalTextLink href={VILLAGE_PLATFORM_LINKS.apiKeys}>API Keys in Village</ExternalTextLink> and copy both
        keys here. We check them with Village before saving.
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
