import { Handshake } from "lucide-react";
import Link from "next/link";

import { EmptyState } from "@/components/empty-state";
import { Button } from "@/components/ui/button";
import { ROUTES } from "@/platform/http/routes";

export default function IntroNotFound() {
  return (
    <div className="rounded-panel bg-card shadow-panel">
      <EmptyState
        headingLevel="h1"
        icon={Handshake}
        title="This intro request isn't available"
        description="It may have been removed, or it belongs to someone else."
      >
        <Button asChild size="lg">
          <Link href={ROUTES.intros}>Back to your intros</Link>
        </Button>
      </EmptyState>
    </div>
  );
}
