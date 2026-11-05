import { FormError } from "@/components/form-error";
import { Button } from "@/components/ui/button";

type ConfirmActionProps = {
  message: string;
  confirmLabel: string;
  pendingLabel: string;
  cancelLabel: string;
  isPending: boolean;
  errorMessage: string | null;
  onConfirm: () => void;
  onCancel: () => void;
};

export function ConfirmAction({
  message,
  confirmLabel,
  pendingLabel,
  cancelLabel,
  isPending,
  errorMessage,
  onConfirm,
  onCancel,
}: ConfirmActionProps) {
  return (
    <div className="grid gap-3 rounded-field bg-muted p-3.5">
      <p className="type-small text-foreground-soft">{message}</p>
      <FormError message={errorMessage} />
      <div className="flex flex-wrap gap-2">
        <Button type="button" variant="destructive" size="sm" disabled={isPending} onClick={onConfirm}>
          {isPending ? pendingLabel : confirmLabel}
        </Button>
        <Button type="button" variant="outline" size="sm" autoFocus onClick={onCancel}>
          {cancelLabel}
        </Button>
      </div>
    </div>
  );
}
