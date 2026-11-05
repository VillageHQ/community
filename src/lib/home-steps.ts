import { ArrowRight, Clock, Link2, MailCheck, RefreshCw, Search, ShieldAlert, type LucideIcon } from "lucide-react";

import { STEP_STATES, type StepState } from "../components/step-row.tsx";
import { NETWORK_PROGRESS, type NetworkProgress } from "./village/network-progress-stages.ts";

type HomeHero = {
  icon: LucideIcon;
  kicker: string;
  title: string;
  description: string;
  action?: string;
};

export const HOME_HEROES: Record<NetworkProgress, HomeHero> = {
  [NETWORK_PROGRESS.notConfigured]: {
    icon: Clock,
    kicker: "Almost there",
    title: "Your admin is still setting things up",
    description: "Network search turns on once an admin connects this community to Village. There's nothing you need to do yet.",
  },
  [NETWORK_PROGRESS.needsEmailConfirmation]: {
    icon: MailCheck,
    kicker: "Almost there",
    title: "We need to confirm it's you",
    description: "Network search turns on once your email is confirmed. Everything else here is ready for you.",
    action: "See where things stand",
  },
  [NETWORK_PROGRESS.needsLinkedin]: {
    icon: Link2,
    kicker: "Your next step",
    title: "Start by adding your LinkedIn",
    description: "It takes a moment. Then we'll show you exactly what joining the network shares, and you decide.",
    action: "Add my LinkedIn",
  },
  [NETWORK_PROGRESS.awaitingGroup]: {
    icon: Clock,
    kicker: "Almost there",
    title: "The community group isn't ready",
    description: "An admin needs to create the group before you can join. Check back soon.",
  },
  [NETWORK_PROGRESS.needsConsent]: {
    icon: ArrowRight,
    kicker: "When you're ready",
    title: "Share your network to search everyone's",
    description: "Members who share can search each other's networks and see who can introduce them. Nothing is shared until you say yes.",
    action: "See the deal",
  },
  [NETWORK_PROGRESS.needsApproval]: {
    icon: ShieldAlert,
    kicker: "Waiting on an admin",
    title: "An admin needs to approve your Village account",
    description: "The Village account linked to you uses a different email from your account here. You can't join or search until an admin approves it. If you didn't mean to link that account, tell your admin.",
  },
  [NETWORK_PROGRESS.finishingJoin]: {
    icon: RefreshCw,
    kicker: "Your next step",
    title: "Finish syncing your network",
    description: "Connect your Village account so your network can join the search.",
    action: "Continue",
  },
  [NETWORK_PROGRESS.ready]: {
    icon: Search,
    kicker: "You're in",
    title: "Who do you want to meet?",
    description: "Search your community's shared networks and see who can introduce you, and why.",
    action: "Search the network",
  },
};

const JOIN_STEPS = [
  { title: "Add your LinkedIn", description: "So members recognize you in their intro paths." },
  { title: "Read the deal and share", description: "You decide. Nothing is shared until you say yes." },
  { title: "Sync with Village", description: "Connect your Village account in a popup." },
  { title: "Search the network", description: "Find people and see who can introduce you." },
];

const SYNC_STEP_POSITION = 2;
const APPROVAL_STEP_DESCRIPTION = "Waiting for an admin to approve your Village account.";

const CURRENT_STEP_POSITION: Partial<Record<NetworkProgress, number>> = {
  [NETWORK_PROGRESS.needsLinkedin]: 0,
  [NETWORK_PROGRESS.needsConsent]: 1,
  [NETWORK_PROGRESS.needsApproval]: SYNC_STEP_POSITION,
  [NETWORK_PROGRESS.finishingJoin]: SYNC_STEP_POSITION,
  [NETWORK_PROGRESS.ready]: 3,
};

function readJoinStepState(position: number, currentPosition: number | undefined): StepState {
  if (currentPosition === undefined) return STEP_STATES.todo;
  if (position < currentPosition) return STEP_STATES.done;
  return position === currentPosition ? STEP_STATES.current : STEP_STATES.todo;
}

export function describeJoinSteps(progress: NetworkProgress) {
  const currentPosition = CURRENT_STEP_POSITION[progress];
  return JOIN_STEPS.map((step, position) => ({
    ...step,
    description:
      progress === NETWORK_PROGRESS.needsApproval && position === SYNC_STEP_POSITION
        ? APPROVAL_STEP_DESCRIPTION
        : step.description,
    number: position + 1,
    state: readJoinStepState(position, currentPosition),
  }));
}
