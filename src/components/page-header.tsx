import type { ReactNode } from "react";

type PageHeaderProps = { title: string; description?: string; action?: ReactNode };

export function PageHeader({ title, description, action }: PageHeaderProps) {
  return (
    <header className="mb-5 flex flex-wrap items-end justify-between gap-x-6 gap-y-3 lg:mb-6">
      <div className="min-w-0">
        <h1 className="type-h1">{title}</h1>
        {description ? <p className="type-lead mt-1.5 text-foreground-soft">{description}</p> : null}
      </div>
      {action}
    </header>
  );
}
