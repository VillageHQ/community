"use client";

import { ArrowRight } from "lucide-react";
import Link from "next/link";
import { usePathname, useSearchParams } from "next/navigation";

import { Button } from "@/components/ui/button";
import { Note } from "@/components/ui/note";
import { INTRO_STATES } from "@/modules/intros/contract";
import type { Connector } from "@/modules/network/contract";
import type { ConnectorSlotProps } from "@/modules/network/slots";
import { readFirstName } from "@/platform/design/avatar-identity";
import { ROUTES } from "@/platform/http/routes";

const OPEN_ASK_LABELS: Record<string, (firstName: string) => string> = {
  [INTRO_STATES.requested]: (firstName) => `You asked. Waiting on ${firstName}.`,
  [INTRO_STATES.accepted]: (firstName) => `${firstName} said yes.`,
  [INTRO_STATES.targetAgreed]: () => "They said yes. An intro is on its way.",
};

function OpenAskRow({ openAsk, firstName }: { openAsk: NonNullable<Connector["openAsk"]>; firstName: string }) {
  return (
    <Note kind="ok">
      {OPEN_ASK_LABELS[openAsk.state]?.(firstName)} <Link href={`${ROUTES.intros}/${openAsk.id}`}>See your intro request</Link>
    </Note>
  );
}

// The one-step ask page for this connector and person (Founderhall's "Ask Marcus for an intro"), back to here after.
export function toConnectorAskHref({ targetSlug, connectorId, back }: { targetSlug: string; connectorId: string; back: string }) {
  return `${ROUTES.searchAsk}?${new URLSearchParams({ target: targetSlug, via: connectorId, back }).toString()}`;
}

export function ConnectorAsk({ connector, isTop, targetSlug }: ConnectorSlotProps) {
  const pathname = usePathname();
  const searchParams = useSearchParams();
  const { linkedinSlug, name, openAsk, member } = connector;
  if (!linkedinSlug || !member) return null;
  const firstName = readFirstName(name);
  if (openAsk) return <OpenAskRow openAsk={openAsk} firstName={firstName} />;
  const query = searchParams.toString();
  const back = query ? `${pathname}?${query}` : pathname;
  return (
    <Button asChild size="sm" variant={isTop ? "primary" : "secondary"}>
      <Link href={toConnectorAskHref({ targetSlug, connectorId: member.id, back })}>
        Ask {firstName} for an intro
        {isTop ? <ArrowRight aria-hidden="true" /> : null}
      </Link>
    </Button>
  );
}
