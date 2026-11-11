import { cn } from "cn";
import type { ComponentProps, ReactNode } from "react";

// Founderhall's option card (crops option-radio-card.png, decide-form.png): a radio or checkbox card, padding 14,
// rule border, radius 8, Leaf; a bold line and a 13.5 Graphite line; checked = fund border + inset fund ring.
type OptionCardProps = Omit<ComponentProps<"input">, "type" | "children"> & {
  type?: "radio" | "checkbox";
  title: ReactNode;
  description?: ReactNode;
  isRecommended?: boolean;
};

export function OptionCard({ type = "radio", title, description, isRecommended = false, className, id, ...inputProps }: OptionCardProps) {
  return (
    <label htmlFor={id} className={cn("fh-opt", className)}>
      <input id={id} type={type} {...inputProps} />
      <span>
        <b>
          {title}
          {isRecommended ? <em className="fh-tag fh-rec">Recommended</em> : null}
        </b>
        {description ? <span>{description}</span> : null}
      </span>
    </label>
  );
}

type CheckboxCardProps = { id: string; name: string; children: ReactNode };

// A required tick ("I agree…") as an option card.
export function CheckboxCard({ id, name, children }: CheckboxCardProps) {
  return (
    <label htmlFor={id} className="fh-opt items-center">
      <input id={id} name={name} type="checkbox" required className="mt-0!" />
      <span>
        <b>{children}</b>
      </span>
    </label>
  );
}
