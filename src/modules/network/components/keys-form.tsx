"use client";

import { ShieldCheck } from "lucide-react";
import { useActionState } from "react";

import { ExternalTextLink } from "@/components/external-text-link";
import { FormError } from "@/components/form-error";
import { FormField } from "@/components/form-field";
import { Alert } from "@/components/ui/alert";
import { Button } from "@/components/ui/button";
import { useFocusOnFailure } from "@/components/use-focus-on-failure";
import { KEY_STORAGE, VILLAGE_KEY_STATUSES, type KeyStorage, type VillageKeyStatus } from "@/platform/village/contract";
import { VILLAGE_PLATFORM_LINKS } from "@/platform/village/links";
import { API_ROUTES } from "@/platform/http/routes";
import { acknowledgedResponseSchema } from "@/platform/http/contract";
import { postRequest } from "@/platform/http/post-request";

type KeysState = { errorMessage: string | null };

const INITIAL_STATE: KeysState = { errorMessage: null };

async function submitKeys(_previousState: KeysState, formData: FormData): Promise<KeysState> {
  try {
    await postRequest(
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

const KEY_NOTICES: Partial<Record<VillageKeyStatus, string>> = {
  [VILLAGE_KEY_STATUSES.tokenMissing]:
    "This site has no setup token now, so we can't read your Village keys. Put SETUP_TOKEN back on your host and they'll work again. If you paste your keys without it, they're stored unencrypted.",
  [VILLAGE_KEY_STATUSES.tokenDifferent]: "Your setup token changed, so we can't read your Village keys. Put the old token back on your host, or paste your keys again. Nothing else was lost.",
  [VILLAGE_KEY_STATUSES.damaged]: "We can't read your saved Village keys. If you just went back to an older version, update again. Otherwise paste your keys again.",
  [VILLAGE_KEY_STATUSES.unavailable]: "We couldn't read your Village keys just now. Reload this page in a moment. Your keys are safe, and you don't need to paste them.",
};

const STORAGE_NOTICES: Record<KeyStorage, string | null> = {
  [KEY_STORAGE.sealed]: null,
  [KEY_STORAGE.unencrypted]: "This site has no setup token, so keys you save here are stored unencrypted. Add SETUP_TOKEN on your host first if you want them sealed.",
  [KEY_STORAGE.refused]: "This is a preview, which may share your live site's database, so it can't change your Village keys. Save them on your live site.",
};

type KeysFormProps = { savedPublicKey: string; hasSavedKeys: boolean; keyStatus?: VillageKeyStatus; keyStorage?: KeyStorage };

export function KeysForm({ savedPublicKey, hasSavedKeys, keyStatus = VILLAGE_KEY_STATUSES.missing, keyStorage = KEY_STORAGE.sealed }: KeysFormProps) {
  const notice = KEY_NOTICES[keyStatus] ?? STORAGE_NOTICES[keyStorage];
  const [state, formAction, isPending] = useActionState(submitKeys, INITIAL_STATE);
  const publicKeyRef = useFocusOnFailure(state);

  return (
    <form action={formAction} className="grid gap-5">
      {notice ? <Alert>{notice}</Alert> : null}
      <p className="text-foreground-soft">
        Open <ExternalTextLink href={VILLAGE_PLATFORM_LINKS.apiKeys}>API Keys in Village</ExternalTextLink> and copy both
        keys here. We check them with Village before saving. In{" "}
        <ExternalTextLink href={VILLAGE_PLATFORM_LINKS.appSettings}>App Settings</ExternalTextLink>, set{" "}
        <strong className="font-bold text-foreground">Title</strong> to your community&apos;s name, because members see it
        when they sync.
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
