import type { LucideIcon } from "lucide-react";
import type { ReactNode } from "react";

type EmptyStateProps = {
  title: string;
  description: string;
  // Founderhall's empty state has no picture; the icon is kept so callers need not change.
  icon?: LucideIcon;
  headingLevel?: "h1" | "h2" | "h3";
  children?: ReactNode;
};

// Founderhall's empty state (crop empty-state-admin.png): Leaf, 1 px dashed border, radius 8, left-aligned; a 19/25
// serif title, one Graphite line, then usually one primary button and one quiet link.
export function EmptyState({ title, description, headingLevel: Heading = "h2", children }: EmptyStateProps) {
  return (
    <div data-slot="empty-state" className="fh-empty">
      <Heading className="fh-h2">{title}</Heading>
      <p className="wrap-anywhere">{description}</p>
      {children ? <div className="fh-btn-row mt-3.5">{children}</div> : null}
    </div>
  );
}
