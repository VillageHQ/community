import { Check } from "lucide-react";
import type { ReactNode } from "react";

type CheckboxCardProps = { id: string; name: string; children: ReactNode };

export function CheckboxCard({ id, name, children }: CheckboxCardProps) {
  return (
    <label
      htmlFor={id}
      className="flex min-h-16 items-center gap-3.5 rounded-field px-card-phone py-2.5 text-base leading-[22px] font-bold shadow-[inset_0_0_0_1.5px_var(--input)] has-checked:shadow-[inset_0_0_0_2.5px_var(--brand-emphasis)]"
    >
      <span className="relative grid size-[30px] shrink-0 place-items-center">
        <input
          id={id}
          name={name}
          type="checkbox"
          required
          className="peer size-[30px] appearance-none rounded-[10px] bg-card shadow-[inset_0_0_0_2px_var(--input)] checked:bg-primary checked:shadow-[inset_0_0_0_2px_var(--brand-edge)]"
        />
        <Check
          aria-hidden="true"
          strokeWidth={3.5}
          className="pointer-events-none absolute size-icon-small text-primary-foreground opacity-0 peer-checked:opacity-100"
        />
      </span>
      <span className="min-w-0">{children}</span>
    </label>
  );
}
