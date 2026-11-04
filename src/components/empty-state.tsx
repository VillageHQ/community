import { Search, UserRound, type LucideIcon } from "lucide-react";
import type { ReactNode } from "react";

function EmptyStateArt({ icon: Icon }: { icon: LucideIcon }) {
  return (
    <div className="relative mb-5 h-[120px] w-[225px]" aria-hidden="true">
      <svg viewBox="0 0 225 120" fill="none" className="absolute inset-0 size-full">
        <path
          d="M52 60C90 22 135 98 172 60"
          stroke="var(--brand-emphasis)"
          strokeWidth="3"
          strokeLinecap="round"
          strokeDasharray="1 10"
        />
        <circle
          cx="172"
          cy="60"
          r="32"
          fill="var(--accent)"
          stroke="var(--brand-emphasis)"
          strokeWidth="2.5"
          strokeDasharray="6 8"
          strokeLinecap="round"
        />
      </svg>
      <span className="absolute top-[28px] left-[20px] flex size-16 items-center justify-center rounded-full bg-[var(--tint-a-bg)] text-[var(--tint-a-fg)]">
        <UserRound className="size-8" />
      </span>
      <Icon className="absolute top-[47px] left-[159px] size-[26px] text-brand-emphasis" />
    </div>
  );
}

type EmptyStateProps = {
  title: string;
  description: string;
  icon?: LucideIcon;
  headingLevel?: "h1" | "h2" | "h3";
  children?: ReactNode;
};

export function EmptyState({
  title,
  description,
  icon = Search,
  headingLevel: Heading = "h2",
  children,
}: EmptyStateProps) {
  return (
    <div data-slot="empty-state" className="flex flex-col items-center px-4 py-10 text-center sm:px-10 sm:py-14">
      <EmptyStateArt icon={icon} />
      <Heading className="type-h2">{title}</Heading>
      <p className="type-lead mt-2.5 max-w-[440px] text-foreground-soft">{description}</p>
      {children ? <div className="mt-6 flex flex-col items-center gap-2">{children}</div> : null}
    </div>
  );
}
