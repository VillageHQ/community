import { Search, UserRound } from "lucide-react";

import { Avatar } from "@/components/ui/avatar";
import { Skeleton } from "@/components/ui/skeleton";

const THREAD_NODE_SIZE_PX = 60;

type ThreadPerson = { id: string; name: string };

const THREAD_NODE_TONES = { accent: "bg-accent", surface: "bg-card" };

type LoadingThreadProps = { person?: ThreadPerson; nodeTone?: keyof typeof THREAD_NODE_TONES };

export function LoadingThread({ person, nodeTone = "accent" }: LoadingThreadProps) {
  return (
    <div
      aria-hidden="true"
      className="relative mb-6 flex h-[72px] w-full max-w-[340px] items-center justify-between text-brand-emphasis"
    >
      <svg viewBox="0 0 340 72" fill="none" preserveAspectRatio="none" className="absolute inset-0 size-full">
        <path d="M30 36H310" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeDasharray="1 8" />
      </svg>
      {person ? (
        <Avatar stableId={person.id} name={person.name} sizePx={THREAD_NODE_SIZE_PX} className="relative" />
      ) : (
        <span className={`relative flex size-[60px] items-center justify-center rounded-full ${THREAD_NODE_TONES[nodeTone]}`}>
          <UserRound className="size-[26px]" />
        </span>
      )}
      <span className="animate-walk absolute top-1/2 left-[46%] -mt-[7px] size-3.5 rounded-full bg-primary shadow-[0_0_0_2px_var(--card),0_0_0_3.5px_var(--brand-edge)]" />
      <span className={`relative flex size-[60px] items-center justify-center rounded-full ${THREAD_NODE_TONES[nodeTone]}`}>
        <Search className="size-[26px]" />
      </span>
    </div>
  );
}

export function PlaceholderRow() {
  return (
    <div
      aria-hidden="true"
      className="flex min-h-20 items-center gap-4 rounded-card-phone bg-card p-4 shadow-panel sm:rounded-card sm:px-5 sm:py-3.5"
    >
      <span className="size-10 shrink-0 rounded-full bg-muted" />
      <span className="grid min-w-0 flex-1 gap-2">
        <Skeleton className="h-4 w-2/5 rounded-full" />
        <Skeleton className="h-3 w-3/4 rounded-full" />
      </span>
    </div>
  );
}

export function LoadingPanel({ title }: { title: string }) {
  return (
    <div className="flex flex-col items-center rounded-card bg-accent px-card-phone py-9 text-center sm:rounded-panel sm:p-10">
      <LoadingThread nodeTone="surface" />
      <p className="type-h2">{title}</p>
    </div>
  );
}

type LoadingStateProps = { title: string; description?: string; person?: ThreadPerson };

export function LoadingState({ title, description, person }: LoadingStateProps) {
  return (
    <div
      role="status"
      data-slot="loading-state"
      className="flex flex-col items-center px-4 py-10 text-center sm:px-10 sm:py-14"
    >
      <LoadingThread person={person} />
      <p className="type-h2">{title}</p>
      {description ? <p className="type-lead mt-2.5 max-w-[440px] text-foreground-soft">{description}</p> : null}
    </div>
  );
}
