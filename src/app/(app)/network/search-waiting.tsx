"use client";

import { Clock } from "lucide-react";
import Link from "next/link";
import { useEffect, useState } from "react";

import type { ConstellationPerson } from "@/components/constellation";
import { LoadingThread } from "@/components/loading-state";
import { Button } from "@/components/ui/button";
import { ROUTES } from "@/lib/routes";

const SECOND_MS = 1000;
const SECONDS_PER_MINUTE = 60;
const TWO_DIGITS = 2;
const MINIMUM_MEMBERS_TO_COUNT = 2;

const WAITING_NOTES = [
  { fromSeconds: 100, note: "This one is a long search. If it reaches two minutes, we'll stop and let you know. Fewer words usually help." },
  { fromSeconds: 45, note: "Still looking. Long waits are normal here, and nothing has gone wrong." },
  { fromSeconds: 0, note: "Searches often take a minute or more, because Village checks everyone's connections." },
];

function readElapsedSeconds(startedAtMs: number) {
  return Math.max(0, Math.floor((Date.now() - startedAtMs) / SECOND_MS));
}

export function formatElapsed(totalSeconds: number) {
  const minutes = Math.floor(totalSeconds / SECONDS_PER_MINUTE);
  const seconds = String(totalSeconds % SECONDS_PER_MINUTE).padStart(TWO_DIGITS, "0");
  return `${minutes}:${seconds}`;
}

export function readWaitingNote(elapsedSeconds: number) {
  return WAITING_NOTES.find(({ fromSeconds }) => elapsedSeconds >= fromSeconds)?.note ?? "";
}

function readWaitingTitle(sharingMemberCount: number) {
  if (sharingMemberCount < MINIMUM_MEMBERS_TO_COUNT) return "Looking through your community's networks";
  return `Looking through ${sharingMemberCount} members' networks`;
}

function useElapsedSeconds(startedAtMs: number) {
  const [elapsedSeconds, setElapsedSeconds] = useState(() => readElapsedSeconds(startedAtMs));
  useEffect(() => {
    const interval = setInterval(() => setElapsedSeconds(readElapsedSeconds(startedAtMs)), SECOND_MS);
    return () => clearInterval(interval);
  }, [startedAtMs]);
  return elapsedSeconds;
}

type SearchWaitingProps = {
  prompt: string;
  startedAtMs: number;
  person: ConstellationPerson;
  sharingMemberCount: number;
};

export function SearchWaiting({ prompt, startedAtMs, person, sharingMemberCount }: SearchWaitingProps) {
  const elapsedSeconds = useElapsedSeconds(startedAtMs);

  return (
    <section
      aria-label="Search in progress"
      data-slot="search-waiting"
      className="flex flex-col items-center rounded-card bg-card px-card-phone py-9 text-center shadow-panel sm:rounded-panel sm:p-10"
    >
      <LoadingThread person={person} />
      <div role="status" aria-live="polite" className="grid justify-items-center">
        <h2 className="type-h2">{readWaitingTitle(sharingMemberCount)}</h2>
        <p className="type-lead mt-2 max-w-[520px] wrap-anywhere text-foreground-soft">&ldquo;{prompt}&rdquo;</p>
        <p className="type-body mt-4 max-w-[480px] text-foreground-soft">{readWaitingNote(elapsedSeconds)}</p>
      </div>
      <p aria-hidden="true" className="type-small mt-4 inline-flex min-h-8 items-center gap-2 rounded-full bg-muted px-3.5 font-semibold text-foreground-soft tabular-nums">
        <Clock className="size-4" />
        {formatElapsed(elapsedSeconds)} so far
      </p>
      <Button asChild variant="outline" size="lg" className="mt-6 h-auto">
        <Link href={ROUTES.feed}>Keep browsing. We&apos;ll tell you when it&apos;s ready.</Link>
      </Button>
    </section>
  );
}
