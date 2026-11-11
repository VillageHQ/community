"use client";

import { Check, Copy, Link2 } from "lucide-react";
import { useState } from "react";

import { Button } from "@/components/ui/button";
import { issuedInviteSchema } from "@/modules/members/contract-invites";
import { INVITE_COPY_LINK_API_ROUTE } from "@/modules/members/contract-import";
import { postRequest } from "@/platform/http/post-request";

const ICON = { "aria-hidden": true, className: "fh-i fh-xs", strokeWidth: 1.5 } as const;
const COPIED_RESET_MS = 2_000;

type WaitingLinkRowProps = { inviteId: string; email: string; detail: string };

// One row of Set up › Sign-in links. Only the hash of an invite token is kept, so Copy makes a new link for this
// person (the one before stops working, and nothing is emailed), shows it, and copies it.
export function WaitingLinkRow({ inviteId, email, detail }: WaitingLinkRowProps) {
  const [link, setLink] = useState<string | null>(null);
  const [wasCopied, setWasCopied] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [isPending, setIsPending] = useState(false);

  async function copy() {
    setError(null);
    let shown = link;
    if (!shown) {
      setIsPending(true);
      try {
        shown = (await postRequest(INVITE_COPY_LINK_API_ROUTE, { inviteId }, issuedInviteSchema)).link;
        setLink(shown);
      } catch (failure) {
        setError(failure instanceof Error ? failure.message : "That didn't work. Try again.");
        return;
      } finally {
        setIsPending(false);
      }
    }
    try {
      await navigator.clipboard.writeText(shown);
      setWasCopied(true);
      setTimeout(() => setWasCopied(false), COPIED_RESET_MS);
    } catch {
      // The link is on screen to copy by hand.
    }
  }

  return (
    <div className="fh-r fh-linkrow">
      <span className="fh-avatar fh-sm" style={{ background: "var(--vellum)" }}>
        <Link2 {...ICON} />
      </span>
      <div className="fh-who">
        <b>{email}</b>
        <span>{detail}</span>
        {link ? <input className="fh-input fh-mono fh-copyfield" readOnly value={link} aria-label={`Link for ${email}`} onFocus={(event) => event.target.select()} /> : null}
        {error ? (
          <p role="alert" className="fh-hint fh-err">
            {error}
          </p>
        ) : null}
      </div>
      <div className="fh-end">
        <Button type="button" variant="secondary" size="sm" onClick={copy} disabled={isPending}>
          {wasCopied ? <Check {...ICON} /> : <Copy {...ICON} />}
          <span aria-live="polite">{isPending ? "Making…" : wasCopied ? "Copied" : "Copy"}</span>
        </Button>
      </div>
    </div>
  );
}
