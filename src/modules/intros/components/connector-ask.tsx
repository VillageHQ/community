"use client";

import { ArrowRight, Lock } from "lucide-react";
import Link from "next/link";
import { useRef, type ReactNode, type RefObject } from "react";

import { Button } from "@/components/ui/button";
import { INTRO_STATES } from "@/modules/intros/contract";
import { readIntroPromise } from "@/modules/intros/copy";
import type { Connector } from "@/modules/network/contract";
import { ConnectorSlotsContext, type ConnectorSlotProps } from "@/modules/network/slots";
import { readFirstName } from "@/platform/design/avatar-identity";
import { ROUTES } from "@/platform/http/routes";

import { AskIntroDialog } from "./ask-intro-dialog";

const OPEN_ASK_LABELS: Record<string, (firstName: string) => string> = {
  [INTRO_STATES.requested]: (firstName) => `You asked. Waiting on ${firstName}.`,
  [INTRO_STATES.accepted]: (firstName) => `${firstName} said yes.`,
};

type OpenAskRowProps = {
  openAsk: NonNullable<Connector["openAsk"]>;
  firstName: string;
  linkRef: RefObject<HTMLAnchorElement | null>;
};

function OpenAskRow({ openAsk, firstName, linkRef }: OpenAskRowProps) {
  return (
    <div className="flex flex-wrap items-center justify-between gap-2 rounded-field bg-accent px-4 py-3">
      <p className="type-label text-accent-foreground">{OPEN_ASK_LABELS[openAsk.state]?.(firstName)}</p>
      <Button asChild variant="quiet" size="sm">
        <Link ref={linkRef} href={`${ROUTES.intros}/${openAsk.id}`}>
          See your ask
          <ArrowRight aria-hidden="true" />
        </Link>
      </Button>
    </div>
  );
}

function ConnectorAsk({ connector, isTop, targetSlug, targetName, viewer }: ConnectorSlotProps) {
  const { linkedinSlug, name, openAsk } = connector;
  const openAskLink = useRef<HTMLAnchorElement>(null);
  if (!linkedinSlug) return null;
  const firstName = readFirstName(name);
  const askLabel = isTop ? `Ask ${firstName} for an intro` : "Ask for an intro";
  const askName = `Ask ${firstName} for an intro to ${readFirstName(targetName)}`;

  return (
    <>
      {openAsk ? <OpenAskRow openAsk={openAsk} firstName={firstName} linkRef={openAskLink} /> : null}
      <AskIntroDialog
        connector={connector}
        connectorSlug={linkedinSlug}
        targetSlug={targetSlug}
        targetName={targetName}
        viewer={viewer}
        afterAskFocus={openAskLink}
        trigger={
          openAsk ? null : (
            <Button type="button" size={isTop ? "lg" : "default"} variant={isTop ? "primary" : "soft"} aria-label={askName} className="w-full">
              {askLabel}
              {isTop ? <ArrowRight aria-hidden="true" /> : null}
            </Button>
          )
        }
      />
    </>
  );
}

function renderAsk(props: ConnectorSlotProps) {
  return <ConnectorAsk {...props} />;
}

function renderPromise(connectorName: string, targetName: string) {
  return (
    <p className="type-small flex gap-2.5 text-foreground-soft">
      <Lock aria-hidden="true" className="mt-0.5 size-4 shrink-0" />
      <span>{readIntroPromise(connectorName, targetName)}</span>
    </p>
  );
}

const CONNECTOR_SLOTS = { renderAsk, renderPromise };

export function IntrosConnectorProvider({ children }: { children: ReactNode }) {
  return <ConnectorSlotsContext.Provider value={CONNECTOR_SLOTS}>{children}</ConnectorSlotsContext.Provider>;
}
