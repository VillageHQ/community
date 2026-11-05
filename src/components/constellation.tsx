import { UserRound } from "lucide-react";

import { Avatar } from "@/components/ui/avatar";
import { readFirstName } from "@/platform/design/avatar-identity";

export type ConstellationPerson = { id: string; name: string; imageUrl?: string | null };

const CENTER = { left: 50, top: 50, sizePx: 108 };

const SLOTS = [
  { left: 19, top: 16, sizePx: 64 },
  { left: 76, top: 13, sizePx: 72 },
  { left: 14, top: 62, sizePx: 60 },
  { left: 88, top: 50, sizePx: 56 },
  { left: 69, top: 86, sizePx: 64 },
  { left: 32, top: 88, sizePx: 52 },
];

const THREADS = [
  "M50 50Q27.7 39.2 19 16",
  "M50 50Q69.475 36.05 76 13",
  "M50 50Q33.8 61.4 14 62",
  "M50 50Q69 44.3 88 50",
  "M50 50Q54.1 70.85 69 86",
  "M50 50Q45.75 71.25 32 88",
  "M19 16Q46.975 4.525 76 13",
  "M14 62Q18.45 78.15 32 88",
  "M76 13Q75.525 33.6 88 50",
];

const STAR_RING = "shadow-[0_0_0_4px_var(--primary),0_0_0_6px_color-mix(in_srgb,var(--primary-foreground)_40%,transparent)]";
const STAR_LABEL = "type-micro rounded-full bg-card px-2.5 py-0.5 font-bold whitespace-nowrap text-foreground";

function EmptyStar({ sizePx }: { sizePx: number }) {
  return (
    <span
      style={{ width: sizePx, height: sizePx }}
      className={`flex items-center justify-center rounded-full bg-[color-mix(in_srgb,var(--primary-foreground)_16%,var(--primary))] text-primary-foreground ${STAR_RING}`}
    >
      <UserRound className="size-1/2" strokeWidth={1.75} />
    </span>
  );
}

type ConstellationProps = { you?: ConstellationPerson; people?: ConstellationPerson[] };

export function Constellation({ you, people = [] }: ConstellationProps) {
  return (
    <div data-slot="constellation" aria-hidden="true" className="relative mx-[-8px] my-5 min-h-[420px] flex-1">
      <svg
        viewBox="0 0 100 100"
        fill="none"
        preserveAspectRatio="none"
        className="absolute inset-0 size-full text-primary-foreground opacity-50"
      >
        <g stroke="currentColor" strokeWidth="1.5" strokeLinecap="round">
          {THREADS.map((thread) => (
            <path key={thread} d={thread} vectorEffect="non-scaling-stroke" />
          ))}
        </g>
      </svg>
      <div
        style={{ left: `${CENTER.left}%`, top: `${CENTER.top}%` }}
        className="absolute flex -translate-x-1/2 -translate-y-1/2 flex-col items-center gap-1.5"
      >
        {you ? (
          <Avatar stableId={you.id} name={you.name} sizePx={CENTER.sizePx} className={STAR_RING} />
        ) : (
          <EmptyStar sizePx={CENTER.sizePx} />
        )}
        {you ? <span className={STAR_LABEL}>You</span> : null}
      </div>
      {SLOTS.map(({ left, top, sizePx }, position) => {
        const person = people[position];
        return (
          <div
            key={`${left}-${top}`}
            style={{ left: `${left}%`, top: `${top}%` }}
            className="absolute flex -translate-x-1/2 -translate-y-1/2 flex-col items-center gap-1.5"
          >
            {person ? (
              <Avatar stableId={person.id} name={person.name} sizePx={sizePx} className={STAR_RING} />
            ) : (
              <EmptyStar sizePx={sizePx} />
            )}
            {person ? <span className={STAR_LABEL}>{readFirstName(person.name)}</span> : null}
          </div>
        );
      })}
    </div>
  );
}
