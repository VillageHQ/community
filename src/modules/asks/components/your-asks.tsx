"use client";

import { useSuspenseQuery } from "@tanstack/react-query";
import { CheckCircle2, Clock3, Hourglass, Inbox, Plus, RefreshCw } from "lucide-react";
import Link from "next/link";
import { useState } from "react";

import { EmptyState } from "@/components/empty-state";
import { FormError } from "@/components/form-error";
import { Avatar } from "@/components/ui/avatar";
import { Button } from "@/components/ui/button";
import { Tag } from "@/components/ui/tag";
import { ASK_LIMITS, ASK_STATES, type AskState, type Offer, type OwnAsk } from "@/modules/asks/contract";
import { ownAsksQuery } from "@/modules/asks/queries";
import { describeAge, describeTimeLeft } from "@/modules/asks/rules-time";
import { MemberConversationSlot } from "@/modules/members/slots";
import { ROUTES } from "@/platform/http/routes";

import { CATEGORY_DISPLAY, describeOfferCount, OFFER_AVATAR_SIZE_PX, OUTCOME_LABELS, OUTCOMES, readMemberLine } from "./ask-display";
import { useCloseAsk, useMarkOffersSeen, useRenewAsk } from "./use-ask-mutations";

const SECTIONS: { state: AskState; title: string }[] = [
  { state: ASK_STATES.open, title: "On the board" },
  { state: ASK_STATES.expired, title: "Came down after 30 days" },
  { state: ASK_STATES.closed, title: "Closed" },
];

function OfferRow({ offer }: { offer: Offer }) {
  const { helper, note, createdAt, isNew } = offer;
  const memberLine = readMemberLine(helper);
  return (
    <li className="grid gap-2.5 rounded-field bg-muted p-4">
      <div className="flex items-start gap-3">
        <Avatar stableId={helper.id} name={helper.name} imageUrl={helper.avatarUrl} sizePx={OFFER_AVATAR_SIZE_PX} />
        <div className="min-w-0 flex-1">
          <div className="flex flex-wrap items-center gap-2">
            <Link href={`${ROUTES.members}/${helper.id}`} className="type-label wrap-anywhere hover:underline">
              {helper.name}
            </Link>
            {isNew ? <Tag tone="accent">New</Tag> : null}
          </div>
          <p className="type-small wrap-anywhere text-muted-foreground">
            {memberLine ? `${memberLine} · ` : ""}
            <time dateTime={createdAt} suppressHydrationWarning>
              Offered {describeAge(createdAt)}
            </time>
          </p>
        </div>
      </div>
      <p className="wrap-anywhere whitespace-pre-wrap">{note}</p>
      <div className="flex flex-wrap gap-2 empty:hidden">
        <MemberConversationSlot memberId={helper.id} accessibleName={`Message ${helper.name}`} label="Message" variant="outline" className="max-sm:w-full" />
      </div>
    </li>
  );
}

function CloseAskChoices({ askId, onCancel }: { askId: string; onCancel: () => void }) {
  const closeAsk = useCloseAsk();
  return (
    <div className="grid gap-3 rounded-field bg-muted p-4">
      <p className="type-label">How did it end?</p>
      <div className="grid gap-2 sm:flex sm:flex-wrap">
        {OUTCOMES.map((outcome) => (
          <Button key={outcome} type="button" variant="outline" disabled={closeAsk.isPending} onClick={() => closeAsk.mutate({ askId, outcome })}>
            {OUTCOME_LABELS[outcome]}
          </Button>
        ))}
        <Button type="button" variant="quiet" autoFocus onClick={onCancel}>
          Not now
        </Button>
      </div>
      <FormError message={closeAsk.error?.message ?? null} />
    </div>
  );
}

function StateTag({ ask }: { ask: OwnAsk }) {
  if (ask.state === ASK_STATES.closed && ask.outcome) {
    return (
      <Tag tone="sage">
        <CheckCircle2 aria-hidden="true" />
        {OUTCOME_LABELS[ask.outcome]}
      </Tag>
    );
  }
  return (
    <Tag tone={ask.state === ASK_STATES.open ? "neutral" : "gold"}>
      {ask.state === ASK_STATES.open ? <Clock3 aria-hidden="true" /> : <Hourglass aria-hidden="true" />}
      <span suppressHydrationWarning>{describeTimeLeft(ask.expiresAt)}</span>
    </Tag>
  );
}

function OwnAskCard({ ask }: { ask: OwnAsk }) {
  const [isClosing, setIsClosing] = useState(false);
  const renewAsk = useRenewAsk();
  const { label: categoryLabel, icon: CategoryIcon, tone } = CATEGORY_DISPLAY[ask.category];
  const isClosed = ask.state === ASK_STATES.closed;
  return (
    <article aria-label={`Your ask: ${ask.title}`} className="grid gap-3.5 rounded-card-phone bg-card p-card-phone shadow-panel sm:rounded-card sm:p-6">
      <div className="flex flex-wrap items-center gap-2">
        <Tag tone={tone}>
          <CategoryIcon aria-hidden="true" />
          {categoryLabel}
        </Tag>
        <StateTag ask={ask} />
      </div>
      <h3 className="type-h3 wrap-anywhere">{ask.title}</h3>
      {ask.detail ? <p className="wrap-anywhere whitespace-pre-wrap text-foreground-soft">{ask.detail}</p> : null}
      <section aria-label="Offers" className="grid gap-2.5">
        <p className="type-small font-semibold text-foreground-soft">{describeOfferCount(ask.offers.length)}</p>
        {ask.offers.length > 0 ? (
          <ul className="grid gap-2.5">
            {ask.offers.map((offer) => (
              <OfferRow key={offer.id} offer={offer} />
            ))}
          </ul>
        ) : null}
      </section>
      {isClosing ? <CloseAskChoices askId={ask.id} onCancel={() => setIsClosing(false)} /> : null}
      <FormError message={renewAsk.error?.message ?? null} />
      {isClosed || isClosing ? null : (
        <div className="flex flex-wrap gap-2">
          {ask.canRenew ? (
            <Button type="button" size="lg" disabled={renewAsk.isPending} className="max-sm:w-full" onClick={() => renewAsk.mutate(ask.id)}>
              <RefreshCw aria-hidden="true" />
              {renewAsk.isPending ? "Renewing…" : `Renew for ${ASK_LIMITS.lifetimeDays} days`}
            </Button>
          ) : null}
          <Button type="button" size="lg" variant="outline" className="max-sm:w-full" onClick={() => setIsClosing(true)}>
            <CheckCircle2 aria-hidden="true" />
            Close this ask
          </Button>
        </div>
      )}
    </article>
  );
}

function hasNewOffers(asks: readonly OwnAsk[]) {
  return asks.some(({ state, offers }) => state === ASK_STATES.open && offers.some(({ isNew }) => isNew));
}

export function YourAsks({ onAsk }: { onAsk: () => void }) {
  const { data } = useSuspenseQuery(ownAsksQuery());
  useMarkOffersSeen(hasNewOffers(data.asks));
  if (data.asks.length === 0) {
    return (
      <div className="rounded-panel bg-card shadow-panel">
        <EmptyState icon={Inbox} title="You haven't asked for anything yet" description="When you do, your ask and everyone who offers to help show up here.">
          <Button type="button" size="lg" onClick={onAsk}>
            <Plus aria-hidden="true" />
            Ask for something
          </Button>
        </EmptyState>
      </div>
    );
  }
  return (
    <div className="grid max-w-[760px] gap-7">
      {SECTIONS.map(({ state, title }) => {
        const asks = data.asks.filter((ask) => ask.state === state);
        if (asks.length === 0) return null;
        return (
          <section key={state} aria-label={title} className="grid gap-3.5">
            <h2 className="type-h3">{title}</h2>
            <ul className="grid gap-4">
              {asks.map((ask) => (
                <li key={ask.id}>
                  <OwnAskCard ask={ask} />
                </li>
              ))}
            </ul>
          </section>
        );
      })}
    </div>
  );
}
