"use client";

import dynamic from "next/dynamic";

import { NetworkSkeleton } from "./network-skeleton";

export const NetworkFlowLoader = dynamic(
  () => import("./network-flow").then(({ NetworkFlow }) => NetworkFlow),
  { ssr: false, loading: NetworkSkeleton },
);
