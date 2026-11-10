"use client";

import { useSuspenseQuery } from "@tanstack/react-query";
import { CheckCircle2, Clock3, Handshake, Hourglass, Inbox, Megaphone, Plus, RefreshCw, Sparkles } from "lucide-react";
import Link from "next/link";
import { useState, type FormEvent } from "react";

import { EmptyState } from "@/components/empty-state";
import { FormError } from "@/components/form-error";
import { FormField } from "@/components/form-field";
import { Alert } from "@/components/ui/alert";
import { MemberLine } from "./member-line";
import { Avatar } from "@/components/ui/avatar";
import { Button } from "@/components/ui/button";
import { Label } from "@/components/ui/label";
import { Tag } from "@/components/ui/tag";
import { Textarea } from "@/components/ui/textarea";
import {
  ASK_ALLOWANCE,
  ASK_KINDS,
  ASK_LIMITS,
  ASK_STATES,
  describeAllowance,
  type AskAllowance,
  type AskHelper,
  type AskState,
  type Offer,
  type OwnAsk,
} from "@/modules/asks/contract";
import { readFirstName } from "@/platform/design/avatar-identity";
import { ownAsksQuery } from "@/modules/asks/queries";
import { describeAge, describeTimeLeft } from "@/modules/asks/rules-time";
import { MemberConversationSlot } from "@/modules/members/slots";
import { ROUTES } from "@/platform/http/routes";

import { CATEGORY_DISPLAY, describeOfferCount, OFFER_AVATAR_SIZE_PX, OUTCOME_LABELS, OUTCOMES, readMemberLine } from "./ask-display";
import { CharactersLeft } from "./characters-left";
import { useAskHelper, useCloseAsk, useMarkOffersSeen, useRenewAsk, useSaveAllowance } from "./use-ask-mutations";

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
            {memberLine ? (
              <>
                <MemberLine member={helper} />
                {" · "}
              </>
            ) : null}
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

function AskHelperForm({ askId, helper, onDone }: { askId: string; helper: AskHelper; onDone: () => void }) {
  const [note, setNote] = useState("");
  const [introId, setIntroId] = useState<string | null>(null);
  const askHelper = useAskHelper(setIntroId);
  const fieldId = `ask-helper-${askId}-${helper.helper.id}`;
  const firstName = readFirstName(helper.helper.name);

  if (introId) {
    return (
      <Alert variant="success" role="none">
        We asked {firstName} for the intro.{" "}
        <Link href={`${ROUTES.intros}/${introId}`} className="font-semibold underline">
          Follow it on the Intros page
        </Link>
        .
      </Alert>
    );
  }

  function submit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    askHelper.mutate({ askId, helperId: helper.helper.id, note });
  }

  return (
    <form className="grid gap-3" onSubmit={submit}>
      <Label htmlFor={fieldId}>A note for {firstName}</Label>
      <Textarea
        id={fieldId}
        autoFocus
        rows={3}
        value={note}
        aria-invalid={askHelper.isError}
        placeholder="Why you'd like to meet them, in a line or two. The person you want to reach hears nothing unless they say yes."
        className="resize-none field-sizing-content"
        onChange={(event) => setNote(event.target.value)}
      />
      <CharactersLeft length={note.length} maximumLength={ASK_LIMITS.noteLength} />
      <FormError message={askHelper.error?.message ?? null} />
      <div className="flex flex-wrap gap-2">
        <Button type="submit" size="lg" disabled={askHelper.isPending} className="max-sm:w-full">
          {askHelper.isPending ? "Asking…" : `Ask ${firstName} for the intro`}
        </Button>
        <Button type="button" size="lg" variant="quiet" onClick={onDone} className="max-sm:w-full">
          Not now
        </Button>
      </div>
    </form>
  );
}

function HelperRow({ askId, helper, canIntro, isOpen }: { askId: string; helper: AskHelper; canIntro: boolean; isOpen: boolean }) {
  const [isAsking, setIsAsking] = useState(false);
  const person = helper.helper;
  const memberLine = readMemberLine(person);
  return (
    <li className="grid gap-2.5 rounded-field bg-muted p-4">
      <div className="flex items-start gap-3">
        <Avatar stableId={person.id} name={person.name} imageUrl={person.avatarUrl} sizePx={OFFER_AVATAR_SIZE_PX} />
        <div className="min-w-0 flex-1">
          <Link href={`${ROUTES.members}/${person.id}`} className="type-label wrap-anywhere hover:underline">
            {person.name}
          </Link>
          {memberLine ? (
            <p className="type-small wrap-anywhere text-muted-foreground">
              <MemberLine member={person} />
            </p>
          ) : null}
        </div>
      </div>
      <p className="type-small wrap-anywhere text-foreground-soft">{helper.why}</p>
      {isAsking ? (
        <AskHelperForm askId={askId} helper={helper} onDone={() => setIsAsking(false)} />
      ) : (
        <div className="flex flex-wrap gap-2 empty:hidden">
          {canIntro && isOpen && helper.canAskForIntro ? (
            <Button type="button" variant="outline" onClick={() => setIsAsking(true)} className="max-sm:w-full">
              <Handshake aria-hidden="true" />
              Ask for an intro
            </Button>
          ) : null}
          <MemberConversationSlot memberId={person.id} accessibleName={`Message ${person.name}`} label="Message" variant="outline" className="max-sm:w-full" />
        </div>
      )}
    </li>
  );
}

function HelpersSection({ ask, canIntro }: { ask: OwnAsk; canIntro: boolean }) {
  if (ask.helpers.length === 0) return null;
  return (
    <section aria-label="Members who may help" className="grid gap-2.5">
      <p className="type-small flex items-center gap-2 font-semibold text-foreground-soft">
        <Sparkles aria-hidden="true" className="size-icon-small shrink-0" />
        {ask.helpers.length === 1 ? "1 member may help. We emailed them once." : `${ask.helpers.length} members may help. We emailed each of them once.`}
      </p>
      <ul className="grid gap-2.5">
        {ask.helpers.map((helper) => (
          <HelperRow key={helper.helper.id} askId={ask.id} helper={helper} canIntro={canIntro} isOpen={ask.state === ASK_STATES.open} />
        ))}
      </ul>
    </section>
  );
}

function AnswersSection({ ask }: { ask: OwnAsk }) {
  if (ask.answers.length === 0) return null;
  return (
    <section aria-label="Answers" className="grid gap-2.5">
      <p className="type-small font-semibold text-foreground-soft">
        {ask.answers.length === 1 ? "1 member has done this" : `${ask.answers.length} members have done this`}
      </p>
      <ul className="grid gap-2.5">
        {ask.answers.map((answer) => (
          <li key={answer.id} className="grid gap-1.5 rounded-field bg-muted p-4">
            <Link href={`${ROUTES.members}/${answer.author.id}`} className="type-label wrap-anywhere hover:underline">
              {answer.author.name}
            </Link>
            <p className="wrap-anywhere whitespace-pre-wrap">{answer.body}</p>
          </li>
        ))}
      </ul>
    </section>
  );
}

function AllowanceSummary({ allowance }: { allowance: AskAllowance }) {
  return (
    <p className="type-small text-foreground-soft">
      {describeAllowance(allowance)}. Asks you post and intro asks share it. A declined, expired or withdrawn intro ask comes back.
    </p>
  );
}

const ALLOWANCE_FIELD = "weeklyAllowance";

function AllowanceSetting({ allowance }: { allowance: AskAllowance }) {
  const saveAllowance = useSaveAllowance();
  function submit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    saveAllowance.mutate(Number(new FormData(event.currentTarget).get(ALLOWANCE_FIELD)));
  }
  return (
    <section aria-label="Weekly ask allowance" className="grid gap-3 rounded-card-phone bg-card p-card-phone shadow-panel sm:rounded-card sm:p-6">
      <h2 className="type-h3">Weekly ask allowance</h2>
      <form className="grid gap-3" onSubmit={submit}>
        <FormField
          name={ALLOWANCE_FIELD}
          label="Asks per member, per week"
          type="number"
          inputMode="numeric"
          min={ASK_ALLOWANCE.minimum}
          max={ASK_ALLOWANCE.maximum}
          step={1}
          required
          defaultValue={allowance.cap}
          hint={`Admins only. Posted asks and intro asks share it. Any whole number from ${ASK_ALLOWANCE.minimum} to ${ASK_ALLOWANCE.maximum}. The default is ${ASK_ALLOWANCE.default}. Each member can also receive at most ${ASK_LIMITS.connectorWeeklyCap} intro asks a week.`}
        />
        <FormError message={saveAllowance.error?.message ?? null} />
        {saveAllowance.isSuccess ? (
          <Alert variant="success" role="none">
            Saved. Members now get {saveAllowance.data.weeklyAllowance} asks a week.
          </Alert>
        ) : null}
        <Button type="submit" disabled={saveAllowance.isPending} className="max-sm:w-full sm:justify-self-start">
          {saveAllowance.isPending ? "Saving…" : "Save the allowance"}
        </Button>
      </form>
    </section>
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

function OwnAskCard({ ask, canIntro }: { ask: OwnAsk; canIntro: boolean }) {
  const [isClosing, setIsClosing] = useState(false);
  const renewAsk = useRenewAsk();
  const { label: categoryLabel, icon: CategoryIcon, tone } = CATEGORY_DISPLAY[ask.category];
  const isClosed = ask.state === ASK_STATES.closed;
  const isUpdate = ask.kind === ASK_KINDS.update;
  return (
    <article aria-label={`Your ${isUpdate ? "update" : "ask"}: ${ask.title}`} className="grid gap-3.5 rounded-card-phone bg-card p-card-phone shadow-panel sm:rounded-card sm:p-6">
      <div className="flex flex-wrap items-center gap-2">
        {isUpdate ? (
          <Tag tone="gold">
            <Megaphone aria-hidden="true" />
            Update
          </Tag>
        ) : (
          <Tag tone={tone}>
            <CategoryIcon aria-hidden="true" />
            {categoryLabel}
          </Tag>
        )}
        <StateTag ask={ask} />
      </div>
      <h3 className="type-h3 wrap-anywhere">{ask.title}</h3>
      {ask.detail ? <p className="wrap-anywhere whitespace-pre-wrap text-foreground-soft">{ask.detail}</p> : null}
      {ask.target ? (
        <p className="type-small wrap-anywhere text-foreground-soft">
          <span className="font-semibold">Wants to reach:</span> {ask.target.name ?? ask.target.linkedinSlug}
        </p>
      ) : null}
      <HelpersSection ask={ask} canIntro={canIntro} />
      <AnswersSection ask={ask} />
      {isUpdate ? null : (
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
      )}
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

export function YourAsks({ onAsk, isViewerAdmin = false }: { onAsk: () => void; isViewerAdmin?: boolean }) {
  const { data } = useSuspenseQuery(ownAsksQuery());
  useMarkOffersSeen(hasNewOffers(data.asks));
  const setting = isViewerAdmin ? <AllowanceSetting allowance={data.allowance} /> : null;
  if (data.asks.length === 0) {
    return (
      <div className="grid max-w-[760px] gap-7">
      <div className="rounded-panel bg-card shadow-panel">
        <EmptyState icon={Inbox} title="You haven't asked for anything yet" description="When you do, your ask and everyone who offers to help show up here.">
          <Button type="button" size="lg" onClick={onAsk}>
            <Plus aria-hidden="true" />
            Ask for something
          </Button>
        </EmptyState>
      </div>
      {setting}
      </div>
    );
  }
  return (
    <div className="grid max-w-[760px] gap-7">
      <AllowanceSummary allowance={data.allowance} />
      {SECTIONS.map(({ state, title }) => {
        const asks = data.asks.filter((ask) => ask.state === state);
        if (asks.length === 0) return null;
        return (
          <section key={state} aria-label={title} className="grid gap-3.5">
            <h2 className="type-h3">{title}</h2>
            <ul className="grid gap-4">
              {asks.map((ask) => (
                <li key={ask.id}>
                  <OwnAskCard ask={ask} canIntro={data.canIntro} />
                </li>
              ))}
            </ul>
          </section>
        );
      })}
      {setting}
    </div>
  );
}
