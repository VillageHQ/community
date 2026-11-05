"use client";

import { useState } from "react";

import { Button } from "@/components/ui/button";
import { FormError } from "@/components/form-error";

import { ConfirmAction } from "./confirm-action";
import { describeBlock } from "./message-copy";
import { useSetBlock } from "./use-message-mutations";

type BlockMemberButtonProps = { memberId: string; memberName: string; isBlocked: boolean };

export function BlockMemberButton({ memberId, memberName, isBlocked: wasBlocked }: BlockMemberButtonProps) {
  const [isConfirming, setIsConfirming] = useState(false);
  const setBlock = useSetBlock(memberId, null);
  const isBlocked = setBlock.data?.isBlocked ?? wasBlocked;

  if (isConfirming) {
    return (
      <ConfirmAction
        message={describeBlock(memberName)}
        confirmLabel={`Block ${memberName}`}
        pendingLabel="Blocking…"
        cancelLabel="Never mind"
        isPending={setBlock.isPending}
        errorMessage={setBlock.error?.message ?? null}
        onCancel={() => setIsConfirming(false)}
        onConfirm={() => setBlock.mutate(true, { onSuccess: () => setIsConfirming(false) })}
      />
    );
  }

  return (
    <div className="grid justify-items-start gap-2">
      <Button
        type="button"
        variant="quiet"
        size="sm"
        disabled={setBlock.isPending}
        onClick={() => (isBlocked ? setBlock.mutate(false) : setIsConfirming(true))}
      >
        {isBlocked ? `Unblock ${memberName}` : `Block ${memberName}`}
      </Button>
      {isBlocked ? <p className="type-small px-1 text-muted-foreground">You blocked this member. They haven&apos;t been told.</p> : null}
      <FormError message={setBlock.error?.message ?? null} />
    </div>
  );
}
