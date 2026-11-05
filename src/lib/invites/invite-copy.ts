import { Clock, MailCheck, MailX, type LucideIcon } from "lucide-react";

import { INVITE_STATES, type InviteState } from "./invite-state.ts";

type UnusableInviteState = Exclude<InviteState, typeof INVITE_STATES.pending>;

export type InviteUnusableCopy = { title: string; description: string; icon: LucideIcon };

export const INVITE_UNUSABLE_COPY: Record<UnusableInviteState, InviteUnusableCopy> = {
  [INVITE_STATES.accepted]: {
    title: "This invite has already been used",
    description:
      "Each link works once. If you already have an account, sign in. If you didn't use this invite, tell your admin right away: they can sort it out and send you a new one.",
    icon: MailCheck,
  },
  [INVITE_STATES.expired]: {
    title: "This invite has expired",
    description: "Invites only last a little while, to keep this community safe. Ask for a fresh one and you'll be right in.",
    icon: Clock,
  },
  [INVITE_STATES.revoked]: {
    title: "This invite was withdrawn",
    description: "An admin cancelled this link. If you think that's a mistake, ask them for a new one.",
    icon: MailX,
  },
};

export const INVITE_INVALID_COPY: InviteUnusableCopy = {
  title: "We don't recognize this link",
  description: "It may be mistyped, or a newer invite may have replaced it. Check your latest invite, or ask for a new one.",
  icon: MailX,
};

export const INVITE_RATE_LIMITED_COPY: InviteUnusableCopy = {
  title: "Let's take a short break",
  description: "There have been too many tries from here. Wait a minute, then open your link again.",
  icon: Clock,
};
