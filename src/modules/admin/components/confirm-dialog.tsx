"use client";

import { useMutation } from "@tanstack/react-query";
import { X } from "lucide-react";
import { Dialog } from "radix-ui";
import { useRef, useState, type ReactNode, type RefObject } from "react";

import { FormError } from "@/components/form-error";
import { Button } from "@/components/ui/button";

const CONFIRM_TONES = { primary: "primary", destructive: "destructive" } as const;

export const DIALOG_OVERLAY_CLASSES = "fixed inset-0 z-30 bg-[rgb(10_12_10/0.48)] data-[state=open]:animate-in data-[state=open]:fade-in-0";
export const DIALOG_CONTENT_CLASSES =
  "fixed inset-x-0 bottom-0 z-40 max-h-[92dvh] overflow-y-auto rounded-t-[32px] bg-card px-4 pt-5 pb-[max(env(safe-area-inset-bottom),24px)] data-[state=open]:animate-in data-[state=open]:slide-in-from-bottom sm:inset-x-auto sm:top-1/2 sm:bottom-auto sm:left-1/2 sm:w-full sm:max-w-[560px] sm:-translate-x-1/2 sm:-translate-y-1/2 sm:rounded-panel sm:p-7";

export type ConfirmDialogProps<Result> = {
  trigger: ReactNode;
  title: string;
  successTitle?: string;
  children: ReactNode;
  confirmLabel: string;
  pendingLabel: string;
  isDestructive?: boolean;
  isConfirmDisabled?: boolean;
  initialFocusRef?: RefObject<HTMLElement | null>;
  returnFocusRef?: RefObject<HTMLElement | null>;
  fallbackFocusId?: string;
  action: () => Promise<Result>;
  onDone?: (result: Result) => void;
  renderSuccess?: (result: Result) => ReactNode;
};

function focusFallback(fallbackFocusId: string | undefined) {
  if (fallbackFocusId) document.getElementById(fallbackFocusId)?.focus();
}

export function ConfirmDialog<Result>({
  trigger,
  title,
  successTitle,
  children,
  confirmLabel,
  pendingLabel,
  isDestructive = false,
  isConfirmDisabled = false,
  initialFocusRef,
  returnFocusRef,
  fallbackFocusId,
  action,
  onDone,
  renderSuccess,
}: ConfirmDialogProps<Result>) {
  const [isOpen, setIsOpen] = useState(false);
  const cancelRef = useRef<HTMLButtonElement>(null);
  const hasFinished = useRef(false);
  const mutation = useMutation({
    mutationFn: action,
    onSuccess: (result) => {
      if (renderSuccess) return;
      hasFinished.current = true;
      setIsOpen(false);
      onDone?.(result);
    },
  });
  const success = renderSuccess && mutation.data !== undefined ? renderSuccess(mutation.data) : null;

  return (
    <Dialog.Root
      open={isOpen}
      onOpenChange={(nextIsOpen) => {
        setIsOpen(nextIsOpen);
        if (nextIsOpen) mutation.reset();
        if (nextIsOpen || !renderSuccess || mutation.data === undefined) return;
        hasFinished.current = true;
        onDone?.(mutation.data);
      }}
    >
      <Dialog.Trigger asChild>{trigger}</Dialog.Trigger>
      <Dialog.Portal>
        <Dialog.Overlay className={DIALOG_OVERLAY_CLASSES} />
        <Dialog.Content
          aria-describedby={undefined}
          className={DIALOG_CONTENT_CLASSES}
          onOpenAutoFocus={(event) => {
            event.preventDefault();
            (initialFocusRef?.current ?? cancelRef.current)?.focus();
          }}
          onCloseAutoFocus={(event) => {
            if (!hasFinished.current) return;
            hasFinished.current = false;
            event.preventDefault();
            if (returnFocusRef?.current) returnFocusRef.current.focus();
            else focusFallback(fallbackFocusId);
          }}
        >
          <div className="grid gap-4">
            <div className="flex items-start justify-between gap-3">
              <Dialog.Title className="type-h2 min-w-0 wrap-anywhere">{success && successTitle ? successTitle : title}</Dialog.Title>
              <Dialog.Close asChild>
                <Button type="button" variant="quiet" size="icon" aria-label="Close" className="-mt-1 -mr-1 shrink-0">
                  <X aria-hidden="true" />
                </Button>
              </Dialog.Close>
            </div>
            {success ? (
              <>
                {success}
                <Dialog.Close asChild>
                  <Button type="button" size="lg">
                    Done
                  </Button>
                </Dialog.Close>
              </>
            ) : (
              <>
                <div className="grid gap-3 text-foreground-soft">{children}</div>
                <FormError message={mutation.error?.message ?? null} />
                <div className="flex flex-col gap-2 sm:flex-row-reverse sm:justify-start">
                  <Button
                    type="button"
                    size="lg"
                    variant={isDestructive ? CONFIRM_TONES.destructive : CONFIRM_TONES.primary}
                    disabled={mutation.isPending || isConfirmDisabled}
                    onClick={() => mutation.mutate()}
                  >
                    {mutation.isPending ? pendingLabel : confirmLabel}
                  </Button>
                  <Dialog.Close asChild>
                    <Button ref={cancelRef} type="button" size="lg" variant="outline">
                      Cancel
                    </Button>
                  </Dialog.Close>
                </div>
              </>
            )}
          </div>
        </Dialog.Content>
      </Dialog.Portal>
    </Dialog.Root>
  );
}
