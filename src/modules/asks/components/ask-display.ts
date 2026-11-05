import { Handshake, Lightbulb, MessageCircleQuestion, Store, UserPlus, type LucideIcon } from "lucide-react";

import { ASK_CATEGORIES, ASK_OUTCOMES, type AskCategory, type AskOutcome } from "@/modules/asks/contract";

type CategoryDisplay = { label: string; filterLabel: string; icon: LucideIcon; tone: "accent" | "gold" | "sage" | "neutral" };

export const CATEGORY_DISPLAY: Record<AskCategory, CategoryDisplay> = {
  [ASK_CATEGORIES.intro]: { label: "Intro", filterLabel: "Intros", icon: Handshake, tone: "accent" },
  [ASK_CATEGORIES.hire]: { label: "Hire", filterLabel: "Hires", icon: UserPlus, tone: "sage" },
  [ASK_CATEGORIES.customer]: { label: "Customer", filterLabel: "Customers", icon: Store, tone: "gold" },
  [ASK_CATEGORIES.advice]: { label: "Advice", filterLabel: "Advice", icon: Lightbulb, tone: "accent" },
  [ASK_CATEGORIES.other]: { label: "Other", filterLabel: "Other", icon: MessageCircleQuestion, tone: "neutral" },
};

export const CATEGORIES = Object.values(ASK_CATEGORIES);

export const OUTCOME_LABELS: Record<AskOutcome, string> = {
  [ASK_OUTCOMES.solvedHere]: "Someone here helped",
  [ASK_OUTCOMES.solvedElsewhere]: "I solved it elsewhere",
  [ASK_OUTCOMES.noLongerNeeded]: "I don't need it anymore",
};

export const OUTCOMES = Object.values(ASK_OUTCOMES);

export const ASK_AVATAR_SIZE_PX = 48;
export const OFFER_AVATAR_SIZE_PX = 44;

export function describeOfferCount(count: number) {
  if (count === 0) return "Nobody has offered yet";
  return count === 1 ? "1 person offered" : `${count} people offered`;
}

export function readMemberLine({ title, company }: { title: string | null; company: string | null }) {
  return [title, company].filter(Boolean).join(", ");
}
