import { NETWORK_STAGES } from "./contract.ts";

export const NETWORK_PROGRESS = {
  notConfigured: NETWORK_STAGES.notConfigured,
  needsEmailConfirmation: NETWORK_STAGES.needsEmailConfirmation,
  needsLinkedin: NETWORK_STAGES.needsLinkedin,
  awaitingGroup: NETWORK_STAGES.awaitingGroup,
  needsConsent: NETWORK_STAGES.needsConsent,
  needsApproval: NETWORK_STAGES.linkMismatch,
  finishingJoin: "finishing_join",
  ready: NETWORK_STAGES.ready,
} as const;

export type NetworkProgress = (typeof NETWORK_PROGRESS)[keyof typeof NETWORK_PROGRESS];
