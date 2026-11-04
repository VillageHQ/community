"use client";

import dynamic from "next/dynamic";

export const NetworkFlowLoader = dynamic(
  () => import("./network-flow").then(({ NetworkFlow }) => NetworkFlow),
  { ssr: false },
);
