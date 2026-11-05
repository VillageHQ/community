"use client";

import { createContext, useContext, type ReactNode } from "react";

import type { ConstellationPerson } from "@/components/constellation";

import type { Connector } from "./contract";

export type ConnectorSlotProps = {
  connector: Connector;
  isTop: boolean;
  targetSlug: string;
  targetName: string;
  viewer: ConstellationPerson;
};

type ConnectorSlots = {
  renderAsk: (props: ConnectorSlotProps) => ReactNode;
  renderPromise: (connectorName: string, targetName: string) => ReactNode;
};

export const ConnectorSlotsContext = createContext<ConnectorSlots | null>(null);

export function ConnectorAskSlot(props: ConnectorSlotProps) {
  const slots = useContext(ConnectorSlotsContext);
  return slots ? slots.renderAsk(props) : null;
}

export function ConnectorPromiseSlot({ connectorName, targetName }: { connectorName: string; targetName: string }) {
  const slots = useContext(ConnectorSlotsContext);
  return slots ? slots.renderPromise(connectorName, targetName) : null;
}
