import type { ComponentProps, ReactNode } from "react";

import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";

// Founderhall's field (crop form-field.png): a 600 14 label above, the field, a 13 px Graphite hint below, and an
// error line in Ribbon. Fields sit 16 px apart (`.field`).
type FieldProps = { htmlFor: string; label: ReactNode; hint?: ReactNode; error?: ReactNode; children: ReactNode; className?: string };

export function Field({ htmlFor, label, hint, error, children, className }: FieldProps) {
  return (
    <div data-slot="field" className={className}>
      <label htmlFor={htmlFor} className="fh-label">
        {label}
      </label>
      {children}
      {hint ? (
        <p id={`${htmlFor}-hint`} className="fh-hint">
          {hint}
        </p>
      ) : null}
      {error ? (
        <p id={`${htmlFor}-error`} role="alert" className="fh-hint fh-err">
          {error}
        </p>
      ) : null}
    </div>
  );
}

type FormFieldProps = ComponentProps<typeof Input> & { name: string; label: string; hint?: string };

export function FormField({ name, label, hint, ...inputProps }: FormFieldProps) {
  return (
    <Field htmlFor={name} label={label} hint={hint}>
      <Input id={name} name={name} aria-describedby={hint ? `${name}-hint` : undefined} {...inputProps} />
    </Field>
  );
}

type TextareaFieldProps = ComponentProps<typeof Textarea> & { name: string; label: string; hint?: string };

export function TextareaField({ name, label, hint, ...textareaProps }: TextareaFieldProps) {
  return (
    <Field htmlFor={name} label={label} hint={hint}>
      <Textarea id={name} name={name} aria-describedby={hint ? `${name}-hint` : undefined} {...textareaProps} />
    </Field>
  );
}
