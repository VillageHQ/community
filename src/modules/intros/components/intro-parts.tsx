import { CalendarClock, Check, CircleSlash, Hourglass, Link2, MessageCircle, Send, Undo2, UserRoundCheck, type LucideIcon } from "lucide-react";
import Link from "next/link";
import type { ReactNode } from "react";

import { Avatar } from "@/components/ui/avatar";
import { Card } from "@/components/ui/card";
import { Tag } from "@/components/ui/tag";
import { readFirstName } from "@/platform/design/avatar-identity";
import { formatShortDate } from "@/platform/text/format-date";
import { INTRO_ROLES, INTRO_STATES, type Intro, type IntroPerson, type IntroState } from "@/modules/intros/contract";
import { ROUTES } from "@/platform/http/routes";

import { RichText } from "@/components/rich-text";
import { MemberConversationSlot } from "@/modules/members/slots";

export type HeadingLevel = "h1" | "h2" | "h3";

const PERSON_AVATAR_SIZE_PX = 52;
const CLOSED_ROW_AVATAR_SIZE_PX = 44;

type StatePresentation = { label: string; tone: "accent" | "neutral" | "sage" | "gold"; icon: LucideIcon };

const STATE_PRESENTATIONS: Record<IntroState, StatePresentation> = {
  [INTRO_STATES.requested]: { label: "Waiting for an answer", tone: "gold", icon: Hourglass },
  [INTRO_STATES.accepted]: { label: "Said yes", tone: "accent", icon: UserRoundCheck },
  [INTRO_STATES.askingTarget]: { label: "Waiting on their answer", tone: "gold", icon: Send },
  [INTRO_STATES.targetAgreed]: { label: "They said yes", tone: "accent", icon: UserRoundCheck },
  [INTRO_STATES.targetDeclined]: { label: "No thanks", tone: "neutral", icon: CircleSlash },
  [INTRO_STATES.completed]: { label: "Introduced", tone: "sage", icon: Check },
  [INTRO_STATES.declined]: { label: "Not this time", tone: "neutral", icon: CircleSlash },
  [INTRO_STATES.withdrawn]: { label: "Withdrawn", tone: "neutral", icon: Undo2 },
  [INTRO_STATES.expired]: { label: "Expired", tone: "neutral", icon: CalendarClock },
};

export function IntroStateTag({ state }: { state: IntroState }) {
  const { label, tone, icon: Icon } = STATE_PRESENTATIONS[state];
  return (
    <Tag tone={tone} className="font-bold">
      <Icon aria-hidden="true" />
      {label}
    </Tag>
  );
}

export function IntroPersonRow({ person, line }: { person: IntroPerson; line: string | null }) {
  return (
    <div className="flex items-center gap-3">
      <Avatar stableId={person.id} name={person.name} imageUrl={person.avatarUrl} sizePx={PERSON_AVATAR_SIZE_PX} />
      <div className="min-w-0">
        <Link href={`${ROUTES.people}/${person.id}`} className="type-label wrap-anywhere underline-offset-3 hover:underline">
          {person.name}
        </Link>
        {line ? <p className="type-small wrap-anywhere text-foreground-soft">{line}</p> : null}
      </div>
    </div>
  );
}

export function IntroNote({ label, note }: { label: string; note: string }) {
  return (
    <div className="rounded-field bg-muted p-4">
      <p className="type-micro mb-1.5 font-bold text-foreground-soft">{label}</p>
      <RichText text={note} className="type-body text-foreground" />
    </div>
  );
}

export function IntroReason({ reason }: { reason: string }) {
  return (
    <p className="flex gap-2.5 type-note text-foreground-soft">
      <Link2 aria-hidden="true" className="mt-[3px] size-icon-small shrink-0 text-brand-emphasis" />
      <span className="min-w-0 wrap-anywhere">{reason}</span>
    </p>
  );
}

export function IntroMessageButton({ person, isPrimary }: { person: IntroPerson; isPrimary: boolean }) {
  if (!person.isAvailable) return null;
  return (
    <MemberConversationSlot
      memberId={person.id}
      label={`Message ${readFirstName(person.name)}`}
      accessibleName={`Message ${person.name}`}
      variant={isPrimary ? "primary" : "outline"}
      size={isPrimary ? "lg" : "default"}
      className="w-full"
    />
  );
}

type TimelineEntry = { key: string; label: string; date: string | null; isDone: boolean; icon: LucideIcon };

const CLOSING_ENTRIES: Partial<Record<IntroState, { label: (intro: Intro) => string; icon: LucideIcon }>> = {
  [INTRO_STATES.declined]: { label: () => "Not this time", icon: CircleSlash },
  [INTRO_STATES.withdrawn]: { label: () => "You withdrew your intro request", icon: Undo2 },
  [INTRO_STATES.expired]: { label: () => "The intro request expired", icon: CalendarClock },
};

export function readTimeline(intro: Intro): TimelineEntry[] {
  const introducerFirst = readFirstName(intro.introducer.name);
  const targetFirst = readFirstName(intro.target.name);
  const entries: TimelineEntry[] = [
    { key: "asked", label: `You asked ${introducerFirst}`, date: intro.createdAt, isDone: true, icon: MessageCircle },
  ];
  const closing = CLOSING_ENTRIES[intro.state];
  if (intro.acceptedAt) {
    entries.push({ key: "accepted", label: `${introducerFirst} said yes`, date: intro.acceptedAt, isDone: true, icon: UserRoundCheck });
  }
  if (intro.targetAgreedAt) {
    entries.push({ key: "agreed", label: `${targetFirst} said yes`, date: intro.targetAgreedAt, isDone: true, icon: UserRoundCheck });
  }
  if (closing) {
    return [...entries, { key: "closed", label: closing.label(intro), date: intro.closedAt, isDone: true, icon: closing.icon }];
  }
  if (!intro.acceptedAt && !intro.targetAgreedAt) {
    entries.push({ key: "deciding", label: `${introducerFirst} and ${targetFirst} each get a say`, date: null, isDone: false, icon: UserRoundCheck });
  }
  entries.push({
    key: "introduced",
    label: `You and ${targetFirst} get connected`,
    date: intro.state === INTRO_STATES.completed ? intro.closedAt : null,
    isDone: intro.state === INTRO_STATES.completed,
    icon: Check,
  });
  return entries;
}

export function IntroTimeline({ intro }: { intro: Intro }) {
  return (
    <ol aria-label="What's happened so far" className="grid gap-3">
      {readTimeline(intro).map(({ key, label, date, isDone, icon: Icon }) => (
        <li key={key} className="flex items-center gap-3">
          <span
            aria-hidden="true"
            data-done={isDone}
            className="flex size-9 shrink-0 items-center justify-center rounded-full bg-muted text-muted-foreground data-[done=true]:bg-accent data-[done=true]:text-brand-emphasis"
          >
            <Icon className="size-[18px]" />
          </span>
          <span className="min-w-0">
            <span className={isDone ? "type-label wrap-anywhere" : "type-note wrap-anywhere text-foreground-soft"}>{label}</span>
            {date ? <span className="type-small block text-muted-foreground">{formatShortDate(date)}</span> : null}
            {isDone ? null : <span className="sr-only"> (not yet)</span>}
          </span>
        </li>
      ))}
    </ol>
  );
}

export function readIntroLinkLabel({ viewerRole, requester, target }: Intro) {
  return viewerRole === INTRO_ROLES.introducer
    ? `${requester.name}'s intro request for ${target.name}`
    : `Your intro request for ${target.name}`;
}

export function ClosedIntroRow({ intro }: { intro: Intro }) {
  const { id, viewerRole, requester, introducer, state, closedAt, hasUpdate } = intro;
  const person = viewerRole === INTRO_ROLES.introducer ? requester : introducer;
  return (
    <Link
      href={`${ROUTES.intros}/${id}`}
      className="flex min-h-[76px] flex-wrap items-center gap-3 rounded-field bg-card p-4 shadow-panel transition-transform duration-150 hover:-translate-y-px motion-reduce:transform-none"
    >
      <Avatar stableId={person.id} name={person.name} imageUrl={person.avatarUrl} sizePx={CLOSED_ROW_AVATAR_SIZE_PX} />
      <span className="min-w-0 flex-[1_1_180px]">
        <span className="type-label block wrap-anywhere">{readIntroLinkLabel(intro)}</span>
        {closedAt ? <span className="type-small block text-muted-foreground">{formatShortDate(closedAt)}</span> : null}
      </span>
      {hasUpdate ? <Tag tone="accent">New</Tag> : null}
      <IntroStateTag state={state} />
    </Link>
  );
}

export function IntroCardFrame({ id, label, children }: { id?: string; label: string; children: ReactNode }) {
  return (
    <article id={id} aria-label={label}>
      <Card className="grid gap-4 sm:rounded-panel">{children}</Card>
    </article>
  );
}
