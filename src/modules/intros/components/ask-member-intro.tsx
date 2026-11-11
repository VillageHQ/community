import { ArrowLeftRight } from "lucide-react";
import Link from "next/link";

import { Button } from "@/components/ui/button";
import { readFirstName } from "@/platform/design/avatar-identity";
import { ROUTES } from "@/platform/http/routes";

type AskMemberIntroProps = { connectorId: string; connectorName: string };

// "Ask for an intro via <name>" on a member's profile: opens the ask page, where the asker names the person. It needs
// no Village (Founderhall's profile actions).
export function AskMemberIntro({ connectorId, connectorName }: AskMemberIntroProps) {
  return (
    <Button asChild size="sm">
      <Link href={`${ROUTES.introAsk}?${new URLSearchParams({ via: connectorId }).toString()}`}>
        <ArrowLeftRight aria-hidden="true" />
        Ask for an intro via {readFirstName(connectorName)}
      </Link>
    </Button>
  );
}
