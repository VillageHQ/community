"use client";

import { Pin, PinOff, Trash2 } from "lucide-react";
import { useRouter } from "next/navigation";
import { useState } from "react";

import { ConfirmAction } from "@/components/confirm-action";
import { FormError } from "@/components/form-error";
import { Button } from "@/components/ui/button";
import { describeAge } from "@/modules/asks/rules-time";

import { usePinAsk, useRemoveAsk } from "./use-ask-mutations";

export type AdminAskListItem = { id: string; title: string; authorName: string; listedAt: string; isPinned: boolean; isExpired: boolean };

function AdminAskRow({ item, canPin }: { item: AdminAskListItem; canPin: boolean }) {
  const router = useRouter();
  const [isConfirming, setIsConfirming] = useState(false);
  const pinAsk = usePinAsk(() => router.refresh());
  const removeAsk = useRemoveAsk();
  return (
    <li className="grid gap-2.5 rounded-field bg-muted p-3.5">
      <div className="min-w-0">
        <p className="type-label wrap-anywhere">{item.title}</p>
        <p className="type-small text-foreground-soft">
          {item.authorName} ·{" "}
          <time dateTime={item.listedAt} suppressHydrationWarning>
            {item.isExpired ? "came down after 30 days, still pinned" : `on the board ${describeAge(item.listedAt)}`}
          </time>
        </p>
      </div>
      {isConfirming ? (
        <ConfirmAction
          message="Remove this ask for everyone? Its offers and answers go too. A copy stays in the audit log, and the person who posted it isn't told."
          confirmLabel="Remove it"
          pendingLabel="Removing…"
          cancelLabel="Keep it"
          isPending={removeAsk.isPending}
          errorMessage={removeAsk.error?.message ?? null}
          onConfirm={() => removeAsk.mutate(item.id, { onSuccess: () => router.refresh() })}
          onCancel={() => setIsConfirming(false)}
        />
      ) : (
        <div className="flex flex-wrap gap-2">
          {item.isPinned || canPin ? (
            <Button
              type="button"
              variant="outline"
              disabled={pinAsk.isPending}
              aria-label={item.isPinned ? `Unpin "${item.title}"` : `Pin "${item.title}" to the top`}
              className="max-sm:w-full"
              onClick={() => pinAsk.mutate({ askId: item.id, isPinned: !item.isPinned })}>
              {item.isPinned ? <PinOff aria-hidden="true" /> : <Pin aria-hidden="true" />}
              {item.isPinned ? "Unpin" : "Pin to the top"}
            </Button>
          ) : null}
          <Button type="button" variant="quiet" aria-label={`Remove "${item.title}"`} className="max-sm:w-full" onClick={() => setIsConfirming(true)}>
            <Trash2 aria-hidden="true" />
            Remove
          </Button>
        </div>
      )}
      <FormError message={pinAsk.error?.message ?? null} />
    </li>
  );
}

// A short list of asks with the admin's pin and remove buttons. `canPin` is false once the pin limit is reached.
export function AdminAskList({ items, canPin, emptyText }: { items: AdminAskListItem[]; canPin: boolean; emptyText: string }) {
  if (items.length === 0) return <p className="type-small text-foreground-soft">{emptyText}</p>;
  return (
    <ul className="grid gap-2.5">
      {items.map((item) => (
        <AdminAskRow key={item.id} item={item} canPin={canPin} />
      ))}
    </ul>
  );
}
