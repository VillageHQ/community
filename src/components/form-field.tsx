import type { ComponentProps } from "react";

import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";

type FormFieldProps = ComponentProps<typeof Input> & { name: string; label: string; hint?: string };

export function FormField({ name, label, hint, ...inputProps }: FormFieldProps) {
  const hintId = `${name}-hint`;
  return (
    <div className="grid gap-2">
      <Label htmlFor={name}>{label}</Label>
      <Input id={name} name={name} aria-describedby={hint ? hintId : undefined} {...inputProps} />
      {hint ? (
        <p id={hintId} className="text-sm text-muted-foreground">
          {hint}
        </p>
      ) : null}
    </div>
  );
}
