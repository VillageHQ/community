import { cn } from "cn";
import { Search } from "lucide-react";
import type { ComponentProps } from "react";

// Founderhall's search box (crop search-box.png): a 52 px field, 16 px text, radius 10, the one shadow, the search
// icon inset at 14 px.
export function SearchBox({ className, ...inputProps }: Omit<ComponentProps<"input">, "type">) {
  return (
    <div data-slot="search-box" className={cn("fh-search", className)}>
      <Search aria-hidden="true" className="fh-i" strokeWidth={1.5} />
      <input type="search" className="fh-input" {...inputProps} />
    </div>
  );
}

// The 13 px Graphite line with an icon under a search ("Paths come from 3 members who share their network so far.").
export function StripLine({ className, ...props }: ComponentProps<"p">) {
  return <p data-slot="strip" className={cn("fh-strip", className)} {...props} />;
}

// The weekly allowance (crop pips-allowance.png): 11 px circles, filled Ink for each ask left, then "4 of 5 asks left this week".
export function AllowancePips({ left, total, label }: { left: number; total: number; label: string }) {
  return (
    <span data-slot="pips" className="fh-pips">
      {Array.from({ length: total }, (_unused, position) => (
        <i key={position} aria-hidden="true" className={cn(position < left && "fh-on")} />
      ))}
      <span>{label}</span>
    </span>
  );
}
