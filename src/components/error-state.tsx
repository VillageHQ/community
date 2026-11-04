import { CircleAlert, RotateCcw } from "lucide-react";
import type { ComponentProps, ReactNode } from "react";

import { Button } from "@/components/ui/button";

const RETRY_LABEL = "Try again";

export function RetryButton(props: ComponentProps<typeof Button>) {
  return (
    <Button type="button" size="lg" {...props}>
      <RotateCcw aria-hidden="true" />
      {RETRY_LABEL}
    </Button>
  );
}

type ErrorStateProps = {
  title: string;
  description: string;
  headingLevel?: "h1" | "h2" | "h3";
  children?: ReactNode;
};

export function ErrorState({ title, description, headingLevel: Heading = "h2", children }: ErrorStateProps) {
  return (
    <div data-slot="error-state" role="alert" className="flex flex-col items-center px-4 py-10 text-center sm:px-10 sm:py-14">
      <span className="mb-5 flex size-20 items-center justify-center rounded-full bg-destructive-soft text-destructive-text" aria-hidden="true">
        <CircleAlert className="size-9" />
      </span>
      <Heading className="type-h2">{title}</Heading>
      <p className="type-lead mt-2.5 max-w-[460px] text-foreground-soft">{description}</p>
      {children ? <div className="mt-6 grid justify-items-center gap-4">{children}</div> : null}
    </div>
  );
}
