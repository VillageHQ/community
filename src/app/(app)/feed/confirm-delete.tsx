import { FormError } from "@/components/form-error";
import { Button } from "@/components/ui/button";

type ConfirmDeleteProps = {
  message: string;
  isPending: boolean;
  errorMessage: string | null;
  onConfirm: () => void;
  onCancel: () => void;
};

export function ConfirmDelete({ message, isPending, errorMessage, onConfirm, onCancel }: ConfirmDeleteProps) {
  return (
    <div className="mt-3.5 grid gap-3 rounded-field bg-muted p-3.5">
      <p className="type-small text-foreground-soft">{message}</p>
      <FormError message={errorMessage} />
      <div className="flex flex-wrap gap-2">
        <Button type="button" variant="destructive" size="sm" disabled={isPending} onClick={onConfirm}>
          {isPending ? "Deleting…" : "Delete"}
        </Button>
        <Button type="button" variant="outline" size="sm" autoFocus onClick={onCancel}>
          Keep it
        </Button>
      </div>
    </div>
  );
}
