"use client";

import { useMutation, useQueryClient, type QueryFilters } from "@tanstack/react-query";
import { useState } from "react";

import { Button } from "@/components/ui/button";
import { FormError } from "@/components/form-error";

import { ConfirmAction } from "@/components/confirm-action";

import { describeBlock } from "../contract-blocks";
import { setBlockRequest } from "../queries-blocks";

type BlockMemberButtonProps = { memberId: string; memberName: string; isBlocked: boolean; refreshesAfterChange: QueryFilters };

export function BlockMemberButton({ memberId, memberName, isBlocked: wasBlocked, refreshesAfterChange }: BlockMemberButtonProps) {
  const [isConfirming, setIsConfirming] = useState(false);
  const queryClient = useQueryClient();
  const setBlock = useMutation({
    mutationFn: (isBlocked: boolean) => setBlockRequest({ memberId, isBlocked }),
    onSuccess: () => queryClient.invalidateQueries(refreshesAfterChange),
  });
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
