"use client";

import { HandHelping } from "lucide-react";
import Link from "next/link";

import { Button } from "@/components/ui/button";
import { useIsModuleEnabled } from "@/platform/modules/enabled-modules";
import { ASKS_MODULE_ID, toAskDraftHref } from "@/platform/modules/manifest";

const MAXIMUM_SUBJECT_LENGTH = 90;

function shorten(subject: string) {
  const line = subject.replace(/\s+/g, " ").trim();
  return line.length > MAXIMUM_SUBJECT_LENGTH ? `${line.slice(0, MAXIMUM_SUBJECT_LENGTH - 1).trimEnd()}…` : line;
}

export function readSearchAskDraft(prompt: string) {
  return `Does anyone know ${shorten(prompt)}?`;
}

export function readIntroAskDraft(targetName: string) {
  return `Looking for an intro to ${shorten(targetName)}`;
}

export function useCanAskCommunity() {
  return useIsModuleEnabled(ASKS_MODULE_ID);
}

// Opens the asks board with the ask already written, so an empty search isn't a dead end.
export function AskCommunityLink({ draft, size = "sm" }: { draft: string; size?: "sm" | "lg" }) {
  return (
    <Button asChild variant="soft" size={size}>
      <Link href={toAskDraftHref(draft)}>
        <HandHelping aria-hidden="true" />
        Ask the community
      </Link>
    </Button>
  );
}
