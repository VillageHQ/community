import type { ReactNode } from "react";

import { ExternalTextLink } from "@/components/external-text-link";
import { CardDescription } from "@/components/ui/card";
import { Tag } from "@/components/ui/tag";
import { VILLAGE_KEY_STATUSES, type VillageKeyStatus } from "@/platform/village/contract";

import { SETUP_TOKEN_GUIDE_URL } from "../copy";
import { SettingCard } from "./setting-card";

function readPasteAdvice(isNetworkOn: boolean) {
  return isNetworkOn ? "paste your keys again under Add your Village keys" : "turn on Network and paste your keys again";
}

type SecretCopy = { tag: ReactNode; description: (isNetworkOn: boolean) => ReactNode };

const NOT_SEALED_TAG = <Tag tone="gold">Not sealed</Tag>;
const NEEDS_ACTION_TAG = <Tag tone="gold">Needs your keys</Tag>;

const SECRET_COPY: Partial<Record<VillageKeyStatus, SecretCopy>> = {
  [VILLAGE_KEY_STATUSES.sealed]: {
    tag: <Tag tone="sage">Sealed</Tag>,
    description: () => "Your Village secret key is encrypted in the database with your setup token. If you change the token, you'll need the old one or your keys again.",
  },
  [VILLAGE_KEY_STATUSES.plain]: {
    tag: NOT_SEALED_TAG,
    description: () => (
      <>
        Your Village secret key is stored unencrypted, because this site has no usable setup token. <ExternalTextLink href={SETUP_TOKEN_GUIDE_URL}>Add one on your host</ExternalTextLink> and
        we&apos;ll seal it.
      </>
    ),
  },
  [VILLAGE_KEY_STATUSES.sealFailed]: {
    tag: NOT_SEALED_TAG,
    description: () => "Your Village secret key is still stored unencrypted, because we couldn't seal it. We'll keep trying. If this stays, check your database and your logs.",
  },
  [VILLAGE_KEY_STATUSES.tokenMissing]: {
    tag: NEEDS_ACTION_TAG,
    description: () => (
      <>
        This site has no setup token now, so we can&apos;t read your Village keys. <ExternalTextLink href={SETUP_TOKEN_GUIDE_URL}>Put SETUP_TOKEN back on your host</ExternalTextLink> and they&apos;ll
        work again. Keys pasted without it are stored unencrypted.
      </>
    ),
  },
  [VILLAGE_KEY_STATUSES.tokenDifferent]: {
    tag: NEEDS_ACTION_TAG,
    description: (isNetworkOn) => `Your setup token changed, so we can't read your Village keys. Put the old token back on your host, or ${readPasteAdvice(isNetworkOn)}.`,
  },
  [VILLAGE_KEY_STATUSES.damaged]: {
    tag: NEEDS_ACTION_TAG,
    description: (isNetworkOn) => `We can't read your saved Village keys. If you just went back to an older version, update again. Otherwise ${readPasteAdvice(isNetworkOn)}.`,
  },
  [VILLAGE_KEY_STATUSES.preview]: {
    tag: <Tag>Preview</Tag>,
    description: () => "This is a preview, which may share your live site's database, so it never seals or changes your Village keys. Your live site handles that.",
  },
  [VILLAGE_KEY_STATUSES.unavailable]: {
    tag: <Tag tone="gold">Try again soon</Tag>,
    description: () => "We couldn't read your Village keys just now. Reload this page in a moment. Your keys are safe, and you don't need to paste them.",
  },
};

export function VillageSecretCard({ status, isNetworkOn }: { status: VillageKeyStatus; isNetworkOn: boolean }) {
  const copy = SECRET_COPY[status];
  if (!copy) return null;
  return (
    <SettingCard title="Village secret key" tag={copy.tag}>
      <CardDescription>{copy.description(isNetworkOn)}</CardDescription>
    </SettingCard>
  );
}

// Settings' Village sheet: the same words as a line under the status, shown only when the key needs a look (it is
// not sealed, or can't be read). With Network off this is the one place an admin still learns about it.
export function VillageSecretLine({ status, isNetworkOn }: { status: VillageKeyStatus; isNetworkOn: boolean }) {
  const copy = SECRET_COPY[status];
  if (!copy || status === VILLAGE_KEY_STATUSES.sealed) return null;
  return (
    <p className="fh-small fh-muted" style={{ marginTop: 8 }}>
      <b>Village secret key:</b> {copy.description(isNetworkOn)}
    </p>
  );
}
