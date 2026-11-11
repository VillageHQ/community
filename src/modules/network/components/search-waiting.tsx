"use client";

import { Clock } from "lucide-react";
import Link from "next/link";
import { useEffect, useState } from "react";

import { Button } from "@/components/ui/button";
import { ROUTES } from "@/platform/http/routes";

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

type SearchWaitingProps = { prompt: string; sharingMemberCount: number };

// A search takes up to two minutes (Village checks everyone's connections): a calm note where the results will be, with
// the time so far, and a way to keep browsing (a notice says when it is ready).
export function SearchWaiting({ prompt, sharingMemberCount }: SearchWaitingProps) {
  const [startedAtMs] = useState(() => Date.now());
  const elapsedSeconds = useElapsedSeconds(startedAtMs);
  return (
    <section aria-label="Search in progress" data-slot="search-waiting" className="fh-sheet mt-4">
      <div role="status" aria-live="polite">
        <h2 className="fh-h3">{readWaitingTitle(sharingMemberCount)}</h2>
        <p className="fh-small mt-1.5 wrap-anywhere">&ldquo;{prompt}&rdquo;</p>
        <p className="fh-small fh-muted mt-1.5">{readWaitingNote(elapsedSeconds)}</p>
      </div>
      <div className="fh-meter mt-3" aria-hidden="true">
        <div className="fh-track">
          <i className="fh-indeterminate" style={{ ["--w" as string]: "35%" }} />
        </div>
      </div>
      <p aria-hidden="true" className="fh-small fh-muted mt-2 inline-flex items-center gap-1.5 tabular-nums">
        <Clock className="fh-i fh-xs" strokeWidth={1.5} />
        {formatElapsed(elapsedSeconds)} so far
      </p>
      <div className="fh-btn-row mt-3">
        <Button asChild variant="quiet" size="sm">
          <Link href={ROUTES.feed}>Keep browsing. We&apos;ll tell you when it&apos;s ready.</Link>
        </Button>
      </div>
    </section>
  );
}
