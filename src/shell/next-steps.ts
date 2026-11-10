import {
  ArrowRight,
  Clock,
  Link2,
  MailCheck,
  RefreshCw,
  ShieldAlert,
  ShieldCheck,
  UserRound,
  type LucideIcon,
} from "lucide-react";

import { STEP_STATES, type StepState } from "../components/step-row.tsx";
import { SETUP_STEP_NAMES, type SetupProgress } from "./admin-setup.ts";
import type { EmailConfirmationCopy } from "../modules/members/contract-email-confirmation-copy.ts";
import { ROUTES } from "../platform/http/routes.ts";
import { NETWORK_PROGRESS, type NetworkProgress } from "../modules/network/contract-progress.ts";

type NetworkStepCopy = {
  icon: LucideIcon;
  kicker: string;
  title: string;
  description: string;
  action?: string;
};

// A member whose network is ready gets no card: Today opens with the "Who do you want to meet?" search box instead.
type PendingNetworkProgress = Exclude<NetworkProgress, typeof NETWORK_PROGRESS.ready>;

export const NEXT_STEPS: Record<PendingNetworkProgress, NetworkStepCopy> = {
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
};

const JOIN_STEPS = [
  { title: "Add your LinkedIn", description: "So members recognize you in their intro paths." },
  { title: "Read the deal and share", description: "You decide. Nothing is shared until you say yes." },
  { title: "Sync with Village", description: "Connect your accounts in Village's sync window." },
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

export type NextStep = {
  icon: LucideIcon;
  kicker: string;
  title: string;
  description: string;
  action: { label: string; href: string } | null;
  progress: { doneCount: number; totalCount: number; label: string } | null;
  isUrgent: boolean;
};

type NextStepFacts = {
  setupProgress: SetupProgress | null;
  networkProgress: NetworkProgress | null;
  communityName: string;
  isCardFilled: boolean;
  confirmationCopy: EmailConfirmationCopy;
};

function describeAdminSetup({ doneCount, totalCount, currentStepId }: SetupProgress, communityName: string): NextStep {
  const nextStepName = currentStepId ? SETUP_STEP_NAMES[currentStepId] : null;
  return {
    icon: ShieldCheck,
    kicker: "Admin setup",
    title: `Let's get ${communityName} ready`,
    description: `${doneCount} of ${totalCount} done. Next: ${nextStepName}.`,
    action: { label: "Continue setup", href: ROUTES.adminSetup },
    progress: { doneCount, totalCount, label: `${doneCount} of ${totalCount} setup steps done` },
    isUrgent: true,
  };
}

const FINISH_CARD_STEP: NextStep = {
  icon: UserRound,
  kicker: "Your next step",
  title: "Finish your card",
  description: "Add your photo and what you can help with, so members can find you.",
  action: { label: "Finish my card", href: ROUTES.editCard },
  progress: null,
  isUrgent: true,
};

function readJoinProgress(progress: NetworkProgress) {
  if (progress === NETWORK_PROGRESS.ready || CURRENT_STEP_POSITION[progress] === undefined) return null;
  const steps = describeJoinSteps(progress);
  const doneCount = steps.filter(({ state }) => state === STEP_STATES.done).length;
  return { doneCount, totalCount: steps.length, label: `${doneCount} of ${steps.length} network steps done` };
}

function describeNetworkStep(progress: PendingNetworkProgress, confirmationCopy: EmailConfirmationCopy): NextStep {
  const step = NEXT_STEPS[progress];
  const { title, description } = progress === NETWORK_PROGRESS.needsEmailConfirmation ? confirmationCopy : step;
  return {
    icon: step.icon,
    kicker: step.kicker,
    title,
    description,
    action: step.action ? { label: step.action, href: ROUTES.network } : null,
    progress: readJoinProgress(progress),
    isUrgent: step.action !== undefined,
  };
}

export function selectNextSteps(facts: NextStepFacts): NextStep[] {
  const { setupProgress, networkProgress, communityName, isCardFilled, confirmationCopy } = facts;
  const hasOpenSetup = setupProgress && !setupProgress.isComplete;
  const pendingNetwork = networkProgress && networkProgress !== NETWORK_PROGRESS.ready ? networkProgress : null;
  const leadStep = hasOpenSetup
    ? describeAdminSetup(setupProgress, communityName)
    : pendingNetwork
      ? describeNetworkStep(pendingNetwork, confirmationCopy)
      : null;
  if (!leadStep) return isCardFilled ? [] : [FINISH_CARD_STEP];
  if (isCardFilled) return [leadStep];
  return leadStep.isUrgent ? [leadStep, FINISH_CARD_STEP] : [FINISH_CARD_STEP, leadStep];
}
