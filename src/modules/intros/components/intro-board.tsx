"use client";

import { useSuspenseQuery } from "@tanstack/react-query";
import { Handshake, Inbox, Search } from "lucide-react";
import Link from "next/link";
import { useState, type ReactNode } from "react";

import { EmptyState } from "@/components/empty-state";
import { Button } from "@/components/ui/button";
import { Chip } from "@/components/ui/chip";
import { isOpenIntroState, type Intro } from "@/modules/intros/contract";
import { introBoardQuery } from "@/modules/intros/queries";
import { ROUTES } from "@/platform/http/routes";

import { AskForYouCard } from "./ask-for-you-card";
import { ClosedIntroRow } from "./intro-parts";
import { useMarkIntrosSeen } from "./use-intro-actions";
import { YourAskCard } from "./your-ask-card";

const INTRO_VIEWS = { asksForYou: "asks-for-you", yourAsks: "your-asks" } as const;

type IntroView = (typeof INTRO_VIEWS)[keyof typeof INTRO_VIEWS];

const HOW_INTROS_WORK = [
  "Search for someone and see which member knows them, and why.",
  "Write a note. That member reads it first, and may share it with the person you want to meet.",
  "They say yes or no. The person you want to meet hears nothing unless they say yes.",
  "On a yes, the member makes the intro themselves. This community contacts nobody on your behalf.",
];

function HowIntrosWork() {
  return (
    <details className="w-full max-w-[460px] text-left">
      <summary className="mx-auto flex min-h-12 w-fit cursor-pointer items-center rounded-full px-6 font-bold text-foreground-soft hover:bg-muted hover:text-foreground">
        See how intros work
      </summary>
      <ol className="mt-3 grid list-decimal gap-2 rounded-field bg-muted py-4 pr-4 pl-9 type-note text-foreground-soft">
        {HOW_INTROS_WORK.map((step) => (
          <li key={step}>{step}</li>
        ))}
      </ol>
    </details>
  );
}

function EmptyYourAsks() {
  return (
    <div className="rounded-panel bg-card shadow-panel">
      <EmptyState
        icon={Handshake}
        title="Your first intro is one search away"
        description="Tell us who you want to meet. We'll show you which member knows them, and why."
      >
        <Button asChild size="lg">
          <Link href={ROUTES.network}>
            <Search aria-hidden="true" />
            Find someone to meet
          </Link>
        </Button>
        <HowIntrosWork />
      </EmptyState>
    </div>
  );
}

function EmptyAsksForYou() {
  return (
    <div className="rounded-panel bg-card shadow-panel">
      <EmptyState
        icon={Inbox}
        title="Nobody's asked you for an intro yet"
        description="When a member asks, it lands here first. You read their note and say yes or no, and nobody else is told."
      >
        <HowIntrosWork />
      </EmptyState>
    </div>
  );
}

type IntroSectionProps = { title: string; intros: Intro[]; renderCard: (intro: Intro) => ReactNode };

function IntroSection({ title, intros, renderCard }: IntroSectionProps) {
  if (intros.length === 0) return null;
  return (
    <section aria-label={title} className="grid gap-4">
      <h2 className="type-h3">{title}</h2>
      <ul className="grid gap-4">
        {intros.map((intro) => (
          <li key={intro.id}>{renderCard(intro)}</li>
        ))}
      </ul>
    </section>
  );
}

function renderClosedIntro(intro: Intro) {
  return <ClosedIntroRow intro={intro} />;
}

function renderAskForYou(intro: Intro) {
  return <AskForYouCard intro={intro} />;
}

function renderYourAsk(intro: Intro) {
  return <YourAskCard intro={intro} />;
}

function splitOpenFirst(intros: Intro[]) {
  return {
    open: intros.filter(({ state }) => isOpenIntroState(state)),
    closed: intros.filter(({ state }) => !isOpenIntroState(state)),
  };
}

function AsksForYou({ intros }: { intros: Intro[] }) {
  if (intros.length === 0) return <EmptyAsksForYou />;
  const { open, closed } = splitOpenFirst(intros);
  return (
    <div className="grid gap-7">
      <IntroSection title="Waiting on you" intros={open} renderCard={renderAskForYou} />
      <IntroSection title="Earlier" intros={closed} renderCard={renderClosedIntro} />
    </div>
  );
}

function YourAsks({ intros, hasUpdates }: { intros: Intro[]; hasUpdates: boolean }) {
  useMarkIntrosSeen(hasUpdates, null);
  if (intros.length === 0) return <EmptyYourAsks />;
  const { open, closed } = splitOpenFirst(intros);
  return (
    <div className="grid gap-7">
      <IntroSection title="In progress" intros={open} renderCard={renderYourAsk} />
      <IntroSection title="Earlier" intros={closed} renderCard={renderClosedIntro} />
    </div>
  );
}

function CountBubble({ count, description }: { count: number; description: string }) {
  if (count === 0) return null;
  return (
    <span className="ml-0.5 inline-flex h-6 min-w-6 items-center justify-center rounded-full bg-primary px-1.5 text-[13px] font-bold text-primary-foreground">
      {count}
      <span className="sr-only"> {description}</span>
    </span>
  );
}

function readInitialView(asksForYouCount: number, waitingOnYou: number, updates: number): IntroView {
  if (waitingOnYou > 0) return INTRO_VIEWS.asksForYou;
  if (updates > 0 || asksForYouCount === 0) return INTRO_VIEWS.yourAsks;
  return INTRO_VIEWS.asksForYou;
}

export function IntroBoardView() {
  const { data: board } = useSuspenseQuery(introBoardQuery());
  const { waitingOnYou, updates } = board.counts;
  const [view, setView] = useState<IntroView>(readInitialView(board.asksForYou.length, waitingOnYou, updates));

  return (
    <div className="grid gap-5">
      <div role="group" aria-label="Filter intros" className="flex flex-wrap gap-2">
        <Chip isPressed={view === INTRO_VIEWS.asksForYou} onClick={() => setView(INTRO_VIEWS.asksForYou)}>
          Asks for you
          <CountBubble count={waitingOnYou} description="waiting on you" />
        </Chip>
        <Chip isPressed={view === INTRO_VIEWS.yourAsks} onClick={() => setView(INTRO_VIEWS.yourAsks)}>
          Your asks
          <CountBubble count={updates} description="with news" />
        </Chip>
      </div>
      {view === INTRO_VIEWS.asksForYou ? (
        <AsksForYou intros={board.asksForYou} />
      ) : (
        <YourAsks intros={board.yourAsks} hasUpdates={updates > 0} />
      )}
    </div>
  );
}
