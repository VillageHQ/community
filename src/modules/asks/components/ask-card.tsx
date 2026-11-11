"use client";

import { BadgeCheck, CircleCheck, Flag, HandHelping, Hourglass, Inbox, Lightbulb, Megaphone, Pin, PinOff, RotateCcw, Sparkles, Trash2, UsersRound } from "lucide-react";
import Link from "next/link";
import { useRef, useState, type FormEvent } from "react";

import { ConfirmAction } from "@/components/confirm-action";
import { ContentMenu, type ContentAction } from "@/components/content-menu";
import { FormError } from "@/components/form-error";
import { Alert } from "@/components/ui/alert";
import { MemberLine } from "./member-line";
import { Avatar } from "@/components/ui/avatar";
import { Button } from "@/components/ui/button";
import { FormField } from "@/components/form-field";
import { Label } from "@/components/ui/label";
import { Tag } from "@/components/ui/tag";
import { Textarea } from "@/components/ui/textarea";
import { ASK_KINDS, ASK_LIMITS, ASK_STATES, type AskAnswer, type BoardAsk, type OfferResult } from "@/modules/asks/contract";
import { describeAge } from "@/modules/asks/rules-time";
import { MemberConversationSlot } from "@/modules/members/slots";
import { readFirstName } from "@/platform/design/avatar-identity";
import { ROUTES } from "@/platform/http/routes";

import { ASK_AVATAR_SIZE_PX, BOARD_OUTCOME_LABELS, CATEGORY_DISPLAY, describeOfferCount, readMemberLine } from "./ask-display";
import { CharactersLeft } from "./characters-left";
import { useAnswerAsk, useKnowSomeone, useOfferHelp, usePinAsk, useRemoveAsk, useReopenAsk, useReportAnswer, useReportAsk } from "./use-ask-mutations";

const CARD_MODES = {
  reading: "reading",
  offering: "offering",
  knowingSomeone: "knowingSomeone",
  answering: "answering",
  confirmingReport: "confirmingReport",
  confirmingRemoval: "confirmingRemoval",
} as const;
const ANSWER_AVATAR_SIZE_PX = 36;

type CardMode = (typeof CARD_MODES)[keyof typeof CARD_MODES];

function describeOfferResult(askerName: string, { isSentAsMessage, wasAlreadyOffered }: OfferResult) {
  const firstName = readFirstName(askerName);
  if (wasAlreadyOffered) return `You already offered to help ${firstName} with this one.`;
  return isSentAsMessage ? `We sent your note to ${firstName} in Messages.` : `We saved your note on ${firstName}'s ask. They'll see it next time they open Asks.`;
}

type OfferFormProps = { ask: BoardAsk; onSent: (message: string) => void; onCancel: () => void };

function OfferForm({ ask, onSent, onCancel }: OfferFormProps) {
  const [note, setNote] = useState("");
  const offerHelp = useOfferHelp((result) => onSent(describeOfferResult(ask.author.name, result)));
  const fieldId = `offer-note-${ask.id}`;

  function submit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    offerHelp.mutate({ askId: ask.id, note });
  }

  return (
    <form className="grid gap-3 rounded-field bg-muted p-4" onSubmit={submit}>
      <Label htmlFor={fieldId}>How can you help {readFirstName(ask.author.name)}?</Label>
      <Textarea
        id={fieldId}
        autoFocus
        rows={3}
        value={note}
        aria-invalid={offerHelp.isError}
        placeholder="A short note. Who you know, or what you've done that's like this."
        className="resize-none field-sizing-content"
        onChange={(event) => setNote(event.target.value)}
      />
      <CharactersLeft length={note.length} maximumLength={ASK_LIMITS.noteLength} />
      <FormError message={offerHelp.error?.message ?? null} />
      <div className="flex flex-wrap gap-2">
        <Button type="submit" size="lg" disabled={offerHelp.isPending} className="max-sm:w-full">
          {offerHelp.isPending ? "Sending…" : "Send my note"}
        </Button>
        <Button type="button" size="lg" variant="quiet" onClick={onCancel} className="max-sm:w-full">
          Not now
        </Button>
      </div>
    </form>
  );
}

function describeTarget(ask: BoardAsk) {
  if (!ask.target) return null;
  return ask.target.name ?? ask.target.linkedinSlug;
}

type KnowSomeoneFormProps = { ask: BoardAsk; onStarted: (introId: string) => void; onCancel: () => void };

// "I know someone": the helper becomes the connector of a two-sided intro. With a named person on the ask the helper
// can leave the person fields blank.
function KnowSomeoneForm({ ask, onStarted, onCancel }: KnowSomeoneFormProps) {
  const [note, setNote] = useState("");
  const [targetLinkedin, setTargetLinkedin] = useState("");
  const [targetName, setTargetName] = useState("");
  const knowSomeone = useKnowSomeone(onStarted);
  const named = describeTarget(ask);
  const firstName = readFirstName(ask.author.name);

  function submit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    knowSomeone.mutate({ askId: ask.id, note, targetLinkedin: targetLinkedin.trim() || null, targetName: targetName.trim() || null });
  }

  return (
    <form className="grid gap-3 rounded-field bg-muted p-4" onSubmit={submit}>
      <p className="type-small text-foreground-soft">
        {named
          ? `${firstName} wants to reach ${named}. If that's who you know, leave the two fields below blank.`
          : `Who do you know who could help ${firstName}?`}{" "}
        They hear nothing until they say yes.
      </p>
      <FormField
        name={`know-linkedin-${ask.id}`}
        label={named ? "Someone else? Their LinkedIn link" : "Their LinkedIn link"}
        placeholder="https://www.linkedin.com/in/their-name"
        autoComplete="off"
        inputMode="url"
        value={targetLinkedin}
        onChange={(event) => setTargetLinkedin(event.target.value)}
      />
      <FormField
        name={`know-name-${ask.id}`}
        label="Their name"
        autoComplete="off"
        maxLength={ASK_LIMITS.personNameLength}
        value={targetName}
        onChange={(event) => setTargetName(event.target.value)}
      />
      <Label htmlFor={`know-note-${ask.id}`}>A note for {firstName}</Label>
      <Textarea
        id={`know-note-${ask.id}`}
        rows={3}
        value={note}
        aria-invalid={knowSomeone.isError}
        placeholder="How you know them, and why they'd be a good fit."
        className="resize-none field-sizing-content"
        onChange={(event) => setNote(event.target.value)}
      />
      <CharactersLeft length={note.length} maximumLength={ASK_LIMITS.noteLength} />
      <FormError message={knowSomeone.error?.message ?? null} />
      <div className="flex flex-wrap gap-2">
        <Button type="submit" size="lg" disabled={knowSomeone.isPending} className="max-sm:w-full">
          {knowSomeone.isPending ? "Starting…" : "Start the intro"}
        </Button>
        <Button type="button" size="lg" variant="quiet" onClick={onCancel} className="max-sm:w-full">
          Not now
        </Button>
      </div>
    </form>
  );
}

type AnswerFormProps = { ask: BoardAsk; onAnswered: () => void; onCancel: () => void };

function AnswerForm({ ask, onAnswered, onCancel }: AnswerFormProps) {
  const [body, setBody] = useState("");
  const answerAsk = useAnswerAsk(onAnswered);
  const fieldId = `answer-${ask.id}`;

  function submit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    answerAsk.mutate({ askId: ask.id, body });
  }

  return (
    <form className="grid gap-3 rounded-field bg-muted p-4" onSubmit={submit}>
      <Label htmlFor={fieldId}>What worked for you?</Label>
      <Textarea
        id={fieldId}
        autoFocus
        rows={3}
        value={body}
        aria-invalid={answerAsk.isError}
        placeholder="What you did, what you'd do again, what to avoid. Everyone who sees this ask can read it."
        className="resize-none field-sizing-content"
        onChange={(event) => setBody(event.target.value)}
      />
      <CharactersLeft length={body.length} maximumLength={ASK_LIMITS.answerLength} />
      <FormError message={answerAsk.error?.message ?? null} />
      <div className="flex flex-wrap gap-2">
        <Button type="submit" size="lg" disabled={answerAsk.isPending} className="max-sm:w-full">
          {answerAsk.isPending ? "Posting…" : "Post my answer"}
        </Button>
        <Button type="button" size="lg" variant="quiet" onClick={onCancel} className="max-sm:w-full">
          Not now
        </Button>
      </div>
    </form>
  );
}

function AnswerItem({ answer }: { answer: AskAnswer }) {
  const [isConfirming, setIsConfirming] = useState(false);
  const [message, setMessage] = useState<string | null>(null);
  const reportAnswer = useReportAnswer();
  const menuTriggerRef = useRef<HTMLButtonElement>(null);
  const actions: ContentAction[] = answer.isMine
    ? []
    : [{ id: "report", label: "Report this answer", icon: Flag, movesFocus: true, onSelect: () => setIsConfirming(true) }];
  return (
    <li className="grid gap-2 rounded-field bg-muted p-3.5">
      <div className="flex items-start gap-2.5">
        <Avatar stableId={answer.author.id} name={answer.author.name} imageUrl={answer.author.avatarUrl} sizePx={ANSWER_AVATAR_SIZE_PX} />
        <div className="min-w-0 flex-1">
          <Link href={`${ROUTES.people}/${answer.author.id}`} className="type-label wrap-anywhere hover:underline">
            {answer.author.name}
          </Link>
          <p className="type-small text-muted-foreground">
            <time dateTime={answer.createdAt} suppressHydrationWarning>
              Done this · {describeAge(answer.createdAt)}
            </time>
          </p>
        </div>
        <ContentMenu label={`More actions for the answer from ${answer.author.name}`} actions={actions} triggerRef={menuTriggerRef} />
      </div>
      <p className="wrap-anywhere whitespace-pre-wrap">{answer.body}</p>
      {isConfirming ? (
        <ConfirmAction
          message="Report this answer to your community's admins? They see a copy and who reported it. Its author isn't told."
          confirmLabel="Report it"
          pendingLabel="Reporting…"
          cancelLabel="Keep it"
          isPending={reportAnswer.isPending}
          errorMessage={reportAnswer.error?.message ?? null}
          onConfirm={() =>
            reportAnswer.mutate(answer.id, {
              onSuccess: (result) => {
                setMessage(result.message);
                setIsConfirming(false);
              },
            })
          }
          onCancel={() => setIsConfirming(false)}
        />
      ) : null}
      {message ? (
        <Alert variant="success" role="none">
          {message}
        </Alert>
      ) : null}
    </li>
  );
}

function AnswerList({ answers }: { answers: AskAnswer[] }) {
  if (answers.length === 0) return null;
  return (
    <section aria-label="Answers from members who've done this" className="grid gap-2">
      <p className="type-small flex items-center gap-2 font-semibold text-foreground-soft">
        <Lightbulb aria-hidden="true" className="size-icon-small shrink-0" />
        {answers.length === 1 ? "1 member has done this" : `${answers.length} members have done this`}
      </p>
      <ul className="grid gap-2">
        {answers.map((answer) => (
          <AnswerItem key={answer.id} answer={answer} />
        ))}
      </ul>
    </section>
  );
}

function MyOffer({ ask, resultMessage }: { ask: BoardAsk; resultMessage: string | null }) {
  if (!ask.myOffer) return null;
  return (
    <div className="grid gap-3 rounded-field bg-accent p-4 text-accent-foreground">
      <p className="type-label flex items-center gap-2">
        <HandHelping aria-hidden="true" className="size-icon-small shrink-0" />
        You offered to help
      </p>
      <p className="type-small wrap-anywhere whitespace-pre-wrap">{ask.myOffer.note}</p>
      {resultMessage ? (
        <Alert variant="success" role="none">
          {resultMessage}
        </Alert>
      ) : null}
      <div className="flex flex-wrap gap-2 empty:hidden">
        <MemberConversationSlot memberId={ask.author.id} accessibleName={`Open your conversation with ${ask.author.name}`} label="Open the conversation" variant="outline" className="max-sm:w-full" />
      </div>
    </div>
  );
}

type BoardAskCardProps = { ask: BoardAsk; canIntro: boolean; isViewerAdmin: boolean; onSeeYourAsks: () => void };

function IntroStarted({ introId, ask }: { introId: string; ask: BoardAsk }) {
  return (
    <Alert variant="success" role="none">
      The intro is started, and we sent your note to {readFirstName(ask.author.name)}.{" "}
      <Link href={`${ROUTES.intros}/${introId}`} className="font-semibold underline">
        Make the link for the person you know
      </Link>
      , then send it to them.
    </Alert>
  );
}

export function AskCard({ ask, canIntro, isViewerAdmin, onSeeYourAsks }: BoardAskCardProps) {
  const [mode, setMode] = useState<CardMode>(CARD_MODES.reading);
  const [resultMessage, setResultMessage] = useState<string | null>(null);
  const [startedIntroId, setStartedIntroId] = useState<string | null>(null);
  const menuTriggerRef = useRef<HTMLButtonElement>(null);
  const reportAsk = useReportAsk();
  const removeAsk = useRemoveAsk();
  const pinAsk = usePinAsk(setResultMessage);
  const reopenAsk = useReopenAsk(setResultMessage);
  const isOpen = ask.state === ASK_STATES.open;
  const { label: categoryLabel, icon: CategoryIcon, tone } = CATEGORY_DISPLAY[ask.category];
  const memberLine = readMemberLine(ask.author);
  const isUpdate = ask.kind === ASK_KINDS.update;
  const noun = isUpdate ? "update" : "ask";
  const canOffer = isOpen && !isUpdate && !ask.isMine && !ask.myOffer;
  const canAnswer = isOpen && !isUpdate && !ask.isMine && !ask.answers.some(({ isMine }) => isMine);
  const isFormOpen = mode === CARD_MODES.offering || mode === CARD_MODES.knowingSomeone || mode === CARD_MODES.answering;
  const target = describeTarget(ask);
  const backToReading = () => setMode(CARD_MODES.reading);

  const menuActions: ContentAction[] = [
    ...(ask.isMine ? [] : [{ id: "report", label: `Report this ${noun}`, icon: Flag, movesFocus: true, onSelect: () => setMode(CARD_MODES.confirmingReport) }]),
    ...(isViewerAdmin && isOpen
      ? [
          {
            id: "pin",
            label: ask.isPinned ? "Unpin from the top" : "Pin to the top",
            icon: ask.isPinned ? PinOff : Pin,
            onSelect: () => pinAsk.mutate({ askId: ask.id, isPinned: !ask.isPinned }),
          },
        ]
      : []),
    ...(isViewerAdmin ? [{ id: "remove", label: `Remove this ${noun}`, icon: Trash2, movesFocus: true, onSelect: () => setMode(CARD_MODES.confirmingRemoval) }] : []),
  ];
  const actionError = pinAsk.error?.message ?? reopenAsk.error?.message ?? null;

  return (
    <article aria-label={`Ask from ${ask.author.name}: ${ask.title}`} className="grid gap-3.5 rounded-card-phone bg-card p-card-phone shadow-panel sm:rounded-card sm:p-6">
      <header className="flex items-start gap-3">
        <Avatar stableId={ask.author.id} name={ask.author.name} imageUrl={ask.author.avatarUrl} sizePx={ASK_AVATAR_SIZE_PX} />
        <div className="min-w-0 flex-1">
          <Link href={`${ROUTES.people}/${ask.author.id}`} className="type-label wrap-anywhere hover:underline">
            {ask.author.name}
          </Link>
          <p className="type-small wrap-anywhere text-muted-foreground">
            {memberLine ? (
              <>
                <MemberLine member={ask.author} />
                {" · "}
              </>
            ) : null}
            <time dateTime={ask.listedAt} suppressHydrationWarning>
              {isUpdate ? "Shared" : "Asked"} {describeAge(ask.listedAt)}
            </time>
          </p>
        </div>
        <ContentMenu label={`More actions for ${ask.title}`} actions={menuActions} triggerRef={menuTriggerRef} />
      </header>
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
        {ask.isPinned ? (
          <Tag tone="accent">
            <Pin aria-hidden="true" />
            Pinned
          </Tag>
        ) : null}
        {ask.state === ASK_STATES.closed && ask.outcome ? (
          <Tag tone="sage">
            <CircleCheck aria-hidden="true" />
            {BOARD_OUTCOME_LABELS[ask.outcome]}
          </Tag>
        ) : null}
        {ask.state === ASK_STATES.expired ? (
          <Tag tone="gold">
            <Hourglass aria-hidden="true" />
            Came down after 30 days
          </Tag>
        ) : null}
        {ask.isMine ? <Tag tone="neutral">Your {noun}</Tag> : null}
      </div>
      <h3 className="type-h3 wrap-anywhere">{ask.title}</h3>
      {ask.detail ? <p className="wrap-anywhere whitespace-pre-wrap text-foreground-soft">{ask.detail}</p> : null}
      {target ? (
        <p className="type-small wrap-anywhere text-foreground-soft">
          <span className="font-semibold">Wants to reach:</span> {target}
        </p>
      ) : null}
      {ask.whyYou && !ask.isMine ? (
        <p className="type-small flex items-start gap-2 rounded-field bg-accent p-3 text-accent-foreground">
          <Sparkles aria-hidden="true" className="mt-0.5 size-icon-small shrink-0" />
          <span className="wrap-anywhere">
            <span className="font-semibold">Why you&apos;re seeing this first:</span> {ask.whyYou}
          </span>
        </p>
      ) : null}
      <AnswerList answers={ask.answers} />
      {mode === CARD_MODES.confirmingReport ? (
        <ConfirmAction
          message={`Report this ${noun} to your community's admins? They see a copy and who reported it. The person who posted it isn't told.`}
          confirmLabel="Report it"
          pendingLabel="Reporting…"
          cancelLabel="Keep it"
          isPending={reportAsk.isPending}
          errorMessage={reportAsk.error?.message ?? null}
          onConfirm={() =>
            reportAsk.mutate(ask.id, {
              onSuccess: ({ message }) => {
                setResultMessage(message);
                setMode(CARD_MODES.reading);
              },
            })
          }
          onCancel={() => setMode(CARD_MODES.reading)}
        />
      ) : null}
      {mode === CARD_MODES.confirmingRemoval ? (
        <ConfirmAction
          message={`Remove this ${noun} for everyone? Its offers and answers go too. A copy stays in the audit log, and the person who posted it isn't told.`}
          confirmLabel="Remove it"
          pendingLabel="Removing…"
          cancelLabel="Keep it"
          isPending={removeAsk.isPending}
          errorMessage={removeAsk.error?.message ?? null}
          onConfirm={() => removeAsk.mutate(ask.id)}
          onCancel={() => setMode(CARD_MODES.reading)}
        />
      ) : null}
      {resultMessage && !ask.myOffer ? (
        <Alert variant="success" role="none">
          {resultMessage}
        </Alert>
      ) : null}
      <FormError message={actionError} />
      {startedIntroId ? <IntroStarted introId={startedIntroId} ask={ask} /> : null}
      <MyOffer ask={ask} resultMessage={startedIntroId ? null : resultMessage} />
      {mode === CARD_MODES.offering && canOffer ? (
        <OfferForm
          ask={ask}
          onSent={(message) => {
            setResultMessage(message);
            backToReading();
          }}
          onCancel={backToReading}
        />
      ) : null}
      {mode === CARD_MODES.knowingSomeone && canOffer ? (
        <KnowSomeoneForm
          ask={ask}
          onStarted={(introId) => {
            setStartedIntroId(introId);
            backToReading();
          }}
          onCancel={backToReading}
        />
      ) : null}
      {mode === CARD_MODES.answering && canAnswer ? <AnswerForm ask={ask} onAnswered={backToReading} onCancel={backToReading} /> : null}
      {ask.canReopen ? (
        <footer className="flex flex-wrap gap-2">
          <Button type="button" size="lg" variant="soft" disabled={reopenAsk.isPending} onClick={() => reopenAsk.mutate(ask.id)} className="max-sm:w-full">
            <RotateCcw aria-hidden="true" />
            {reopenAsk.isPending ? "Reopening…" : "Reopen this ask"}
          </Button>
        </footer>
      ) : null}
      {isUpdate || isFormOpen || !isOpen ? null : (
        <footer className="flex flex-wrap items-center justify-between gap-3">
          <p className="type-small flex items-center gap-2 font-semibold text-foreground-soft">
            <UsersRound aria-hidden="true" className="size-icon-small shrink-0" />
            {describeOfferCount(ask.offerCount)}
          </p>
          <div className="flex flex-wrap gap-2 max-sm:w-full empty:hidden">
            {canOffer ? (
              <Button type="button" size="lg" onClick={() => setMode(canIntro ? CARD_MODES.knowingSomeone : CARD_MODES.offering)} className="max-sm:w-full">
                <HandHelping aria-hidden="true" />
                I know someone
              </Button>
            ) : null}
            {canAnswer ? (
              <Button type="button" size="lg" variant="soft" onClick={() => setMode(CARD_MODES.answering)} className="max-sm:w-full">
                <BadgeCheck aria-hidden="true" />
                I&apos;ve done this myself
              </Button>
            ) : null}
            {ask.isMine ? (
              <Button type="button" variant="soft" size="lg" onClick={onSeeYourAsks} className="max-sm:w-full">
                <Inbox aria-hidden="true" />
                See who can help
              </Button>
            ) : null}
          </div>
        </footer>
      )}
    </article>
  );
}
