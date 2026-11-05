import Link from "next/link";

import { ProgressTrack } from "@/components/progress-track";
import { Button } from "@/components/ui/button";
import { Card, CardTitle } from "@/components/ui/card";
import type { NextStep } from "@/shell/next-steps";

export function NextStepCard({ nextStep }: { nextStep: NextStep }) {
  const { icon: Icon, kicker, title, description, action, progress } = nextStep;
  return (
    <Card className="sm:p-5">
      <p className="type-micro flex items-center gap-2 font-bold text-brand-emphasis">
        <Icon aria-hidden="true" className="size-icon-small shrink-0" />
        {kicker}
      </p>
      <CardTitle className="mt-1.5">{title}</CardTitle>
      <p className="type-small mt-1.5 text-foreground-soft">{description}</p>
      {progress ? (
        <div className="mt-3.5">
          <ProgressTrack {...progress} />
        </div>
      ) : null}
      {action ? (
        <Button asChild className="mt-3.5 w-full">
          <Link href={action.href}>{action.label}</Link>
        </Button>
      ) : null}
    </Card>
  );
}
