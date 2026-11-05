"use client";

import { Flag, HandHelping, Inbox, Trash2, UsersRound } from "lucide-react";
import Link from "next/link";
import { useRef, useState, type FormEvent } from "react";

import { ConfirmAction } from "@/components/confirm-action";
import { ContentMenu, type ContentAction } from "@/components/content-menu";
import { FormError } from "@/components/form-error";
import { Alert } from "@/components/ui/alert";
import { Avatar } from "@/components/ui/avatar";
import { Button } from "@/components/ui/button";
import { Label } from "@/components/ui/label";
import { Tag } from "@/components/ui/tag";
import { Textarea } from "@/components/ui/textarea";
import { ASK_LIMITS, type BoardAsk, type OfferResult } from "@/modules/asks/contract";
import { describeAge } from "@/modules/asks/rules-time";
import { MemberConversationSlot } from "@/modules/members/slots";
import { readFirstName } from "@/platform/design/avatar-identity";
import { ROUTES } from "@/platform/http/routes";

import { ASK_AVATAR_SIZE_PX, CATEGORY_DISPLAY, describeOfferCount, readMemberLine } from "./ask-display";
import { CharactersLeft } from "./characters-left";
import { useOfferHelp, useRemoveAsk, useReportAsk } from "./use-ask-mutations";

const CARD_MODES = { reading: "reading", offering: "offering", confirmingReport: "confirmingReport", confirmingRemoval: "confirmingRemoval" } as const;

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

type BoardAskCardProps = { ask: BoardAsk; isViewerAdmin: boolean; onSeeYourAsks: () => void };

export function AskCard({ ask, isViewerAdmin, onSeeYourAsks }: BoardAskCardProps) {
  const [mode, setMode] = useState<CardMode>(CARD_MODES.reading);
  const [resultMessage, setResultMessage] = useState<string | null>(null);
  const menuTriggerRef = useRef<HTMLButtonElement>(null);
  const reportAsk = useReportAsk();
  const removeAsk = useRemoveAsk();
  const { label: categoryLabel, icon: CategoryIcon, tone } = CATEGORY_DISPLAY[ask.category];
  const memberLine = readMemberLine(ask.author);
  const canOffer = !ask.isMine && !ask.myOffer;

  const menuActions: ContentAction[] = [
    ...(ask.isMine ? [] : [{ id: "report", label: "Report this ask", icon: Flag, movesFocus: true, onSelect: () => setMode(CARD_MODES.confirmingReport) }]),
    ...(isViewerAdmin ? [{ id: "remove", label: "Remove this ask", icon: Trash2, movesFocus: true, onSelect: () => setMode(CARD_MODES.confirmingRemoval) }] : []),
  ];

  return (
    <article aria-label={`Ask from ${ask.author.name}: ${ask.title}`} className="grid gap-3.5 rounded-card-phone bg-card p-card-phone shadow-panel sm:rounded-card sm:p-6">
      <header className="flex items-start gap-3">
        <Avatar stableId={ask.author.id} name={ask.author.name} imageUrl={ask.author.avatarUrl} sizePx={ASK_AVATAR_SIZE_PX} />
        <div className="min-w-0 flex-1">
          <Link href={`${ROUTES.members}/${ask.author.id}`} className="type-label wrap-anywhere hover:underline">
            {ask.author.name}
          </Link>
          <p className="type-small wrap-anywhere text-muted-foreground">
            {memberLine ? `${memberLine} · ` : ""}
            <time dateTime={ask.listedAt} suppressHydrationWarning>
              Asked {describeAge(ask.listedAt)}
            </time>
          </p>
        </div>
        <ContentMenu label={`More actions for ${ask.title}`} actions={menuActions} triggerRef={menuTriggerRef} />
      </header>
      <div className="flex flex-wrap items-center gap-2">
        <Tag tone={tone}>
          <CategoryIcon aria-hidden="true" />
          {categoryLabel}
        </Tag>
        {ask.isMine ? <Tag tone="neutral">Your ask</Tag> : null}
      </div>
      <h3 className="type-h3 wrap-anywhere">{ask.title}</h3>
      {ask.detail ? <p className="wrap-anywhere whitespace-pre-wrap text-foreground-soft">{ask.detail}</p> : null}
      {mode === CARD_MODES.confirmingReport ? (
        <ConfirmAction
          message="Report this ask to your community's admins? They see a copy and who reported it. The person who asked isn't told."
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
          message="Remove this ask for everyone? Its offers go too. A copy stays in the audit log, and the person who asked isn't told."
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
      <MyOffer ask={ask} resultMessage={resultMessage} />
      {mode === CARD_MODES.offering && canOffer ? (
        <OfferForm
          ask={ask}
          onSent={(message) => {
            setResultMessage(message);
            setMode(CARD_MODES.reading);
          }}
          onCancel={() => setMode(CARD_MODES.reading)}
        />
      ) : null}
      {mode === CARD_MODES.offering && canOffer ? null : (
        <footer className="flex flex-wrap items-center justify-between gap-3">
          <p className="type-small flex items-center gap-2 font-semibold text-foreground-soft">
            <UsersRound aria-hidden="true" className="size-icon-small shrink-0" />
            {describeOfferCount(ask.offerCount)}
          </p>
          {canOffer ? (
            <Button type="button" size="lg" onClick={() => setMode(CARD_MODES.offering)} className="max-sm:w-full">
              <HandHelping aria-hidden="true" />
              I can help
            </Button>
          ) : null}
          {ask.isMine ? (
            <Button type="button" variant="soft" size="lg" onClick={onSeeYourAsks} className="max-sm:w-full">
              <Inbox aria-hidden="true" />
              See your offers
            </Button>
          ) : null}
        </footer>
      )}
    </article>
  );
}
