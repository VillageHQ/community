"use client";

import { Lock } from "lucide-react";
import type { ReactNode } from "react";

import type { Intro } from "@/modules/intros/contract";
import { readIntroPromise } from "@/modules/intros/copy";
import { IntroOtherPathsSlotContext } from "@/modules/intros/slots";
import { ConnectorSlotsContext, type ConnectorSlotProps } from "@/modules/network/slots";

import { ConnectorAsk } from "./intro-connector-ask";
import { OtherPaths } from "./intro-other-paths";

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

function renderOtherPaths(intro: Intro) {
  return <OtherPaths intro={intro} />;
}

// Joins intros and network while both are on: network's ask slots on paths, and intros' "who else can help".
export function IntrosConnectorProvider({ children }: { children: ReactNode }) {
  return (
    <ConnectorSlotsContext.Provider value={CONNECTOR_SLOTS}>
      <IntroOtherPathsSlotContext.Provider value={renderOtherPaths}>{children}</IntroOtherPathsSlotContext.Provider>
    </ConnectorSlotsContext.Provider>
  );
}
