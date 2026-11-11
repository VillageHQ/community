"use client";

import { Check, Pin, Send, X } from "lucide-react";
import { useRouter } from "next/navigation";
import { useState, type FormEvent, type ReactNode } from "react";

import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { acknowledgedResponseSchema } from "@/platform/http/contract";
import { postRequest } from "@/platform/http/post-request";

import { ASK_API_ROUTES, ASK_HELP_KINDS, ASK_LIMITS, ASK_STATUS_ACTIONS, ASKS_PAGE, createdAnswerSchema, createdIntroSchema, toAskPage, type AskStatusAction } from "../contract";
import { z } from "zod";

const anySchema = z.unknown();

function useAction() {
  const router = useRouter();
  const [error, setError] = useState<string | null>(null);
  const [isPending, setIsPending] = useState(false);
  // The page stays mounted when only its query changes, so a form clears itself once the action is done.
  async function run(action: () => Promise<string>, form?: HTMLFormElement) {
    setIsPending(true);
    setError(null);
    try {
      const next = await action();
      form?.reset();
      router.push(next);
      router.refresh();
    } catch (failure) {
      setError(failure instanceof Error ? failure.message : "Something went wrong. Try again.");
    } finally {
      setIsPending(false);
    }
  }
  return { error, isPending, run };
}

function ErrorNote({ children }: { children: ReactNode }) {
  return (
    <div className="fh-note fh-needs" role="alert" style={{ marginTop: 10 }}>
      <span>{children}</span>
    </div>
  );
}

// "Your answer" + Send under the answers (Founderhall's reply box, static).
export function AnswerForm({ askId }: { askId: string }) {
  const { error, isPending, run } = useAction();
  function submit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    const form = event.currentTarget;
    const body = String(new FormData(form).get("body") ?? "");
    void run(async () => {
      await postRequest(ASK_API_ROUTES.answer, { askId, body }, createdAnswerSchema);
      return `${toAskPage(askId)}?m=commented#answers`;
    }, form);
  }
  return (
    <>
      <form method="post" className="fh-reply fh-static" onSubmit={submit}>
        <label className="fh-sr" htmlFor="c-body">
          Your answer
        </label>
        <input className="fh-input" id="c-body" name="body" maxLength={ASK_LIMITS.answerLength} placeholder="Write an answer" required />
        <Button size="sm" type="submit" disabled={isPending} className="h-8 self-center">
          <Send aria-hidden="true" className="fh-i fh-xs" strokeWidth={1.5} />
          Send
        </Button>
      </form>
      {error ? <ErrorNote>{error}</ErrorNote> : null}
    </>
  );
}

// The "I can help" form in the rail: I know someone, or I've done this myself, with an optional name and line.
export function HelpForm({ askId, authorFirstName, defaultPerson }: { askId: string; authorFirstName: string; defaultPerson: string }) {
  const { error, isPending, run } = useAction();
  function submit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    const element = event.currentTarget;
    const form = new FormData(element);
    const kind = form.get("kind") === ASK_HELP_KINDS.doneMyself ? ASK_HELP_KINDS.doneMyself : ASK_HELP_KINDS.knowSomeone;
    void run(async () => {
      await postRequest(ASK_API_ROUTES.help, { askId, kind, person: String(form.get("person") ?? ""), note: String(form.get("note") ?? "") }, anySchema);
      return `${toAskPage(askId)}?m=${kind === ASK_HELP_KINDS.knowSomeone ? "knows" : "helped"}#answers`;
    }, element);
  }
  return (
    <>
      {error ? <ErrorNote>{error}</ErrorNote> : null}
      <form method="post" className="fh-decide" onSubmit={submit}>
        <fieldset className="fh-choices">
          <legend className="fh-sr">How can you help?</legend>
          <label className="fh-opt">
            <input type="radio" name="kind" value={ASK_HELP_KINDS.knowSomeone} defaultChecked />
            <span>
              <b>I know someone</b>
              <span>{authorFirstName} writes a note; you decide whether to forward it. Nobody is introduced without saying yes.</span>
            </span>
          </label>
          <label className="fh-opt">
            <input type="radio" name="kind" value={ASK_HELP_KINDS.doneMyself} />
            <span>
              <b>I’ve done this myself</b>
              <span>Your answer shows under the ask.</span>
            </span>
          </label>
        </fieldset>
        <div className="fh-field fh-ifknow">
          <label className="fh-label fh-small" htmlFor="h-person">
            Who do you know? <span className="fh-muted">(optional)</span>
          </label>
          <Input id="h-person" name="person" maxLength={ASK_LIMITS.personNameLength} defaultValue={defaultPerson} placeholder="Their name" />
        </div>
        <div className="fh-field">
          <label className="fh-label fh-small" htmlFor="h-note">
            A line for {authorFirstName} <span className="fh-muted">(optional)</span>
          </label>
          <Textarea id="h-note" name="note" rows={3} maxLength={ASK_LIMITS.answerLength} style={{ minHeight: 84 }} placeholder="How you know them, or what worked for you" />
        </div>
        <div className="fh-btn-row" style={{ marginTop: 12 }}>
          <Button type="submit" disabled={isPending}>
            Offer help
          </Button>
        </div>
      </form>
    </>
  );
}

type StatusButtonsProps = { askId: string; isOwn: boolean; isAsk: boolean; isOpen: boolean; isAdmin: boolean; isPinned: boolean };

// Founderhall's owner and admin buttons under the ask: Mark answered / Reopen; Pin, Close, Remove for an admin.
export function StatusButtons({ askId, isOwn, isAsk, isOpen, isAdmin, isPinned }: StatusButtonsProps) {
  const { error, isPending, run } = useAction();
  function act(action: AskStatusAction) {
    void run(async () => {
      await postRequest(ASK_API_ROUTES.status, { askId, action }, acknowledgedResponseSchema);
      return action === ASK_STATUS_ACTIONS.remove ? `${ASKS_PAGE}?m=remove` : `${toAskPage(askId)}?m=${action}`;
    });
  }
  const buttons: ReactNode[] = [];
  if (isOwn && isAsk && isOpen)
    buttons.push(
      <Button key="answered" variant="secondary" size="sm" disabled={isPending} onClick={() => act(ASK_STATUS_ACTIONS.answered)}>
        <Check aria-hidden="true" className="fh-i fh-xs" strokeWidth={1.5} />
        Mark answered
      </Button>,
    );
  if (isOwn && isAsk && !isOpen)
    buttons.push(
      <Button key="reopen" variant="secondary" size="sm" disabled={isPending} onClick={() => act(ASK_STATUS_ACTIONS.reopen)}>
        Reopen
      </Button>,
    );
  if (isAdmin)
    buttons.push(
      <Button key="pin" variant="quiet" size="sm" disabled={isPending} onClick={() => act(isPinned ? ASK_STATUS_ACTIONS.unpin : ASK_STATUS_ACTIONS.pin)}>
        <Pin aria-hidden="true" className="fh-i fh-xs" strokeWidth={1.5} />
        {isPinned ? "Unpin" : "Pin"}
      </Button>,
    );
  if (isAdmin && isOpen)
    buttons.push(
      <Button key="close" variant="quiet" size="sm" disabled={isPending} onClick={() => act(ASK_STATUS_ACTIONS.close)}>
        Close
      </Button>,
    );
  if (isAdmin)
    buttons.push(
      <Button key="remove" variant="quiet" size="sm" disabled={isPending} onClick={() => act(ASK_STATUS_ACTIONS.remove)}>
        <X aria-hidden="true" className="fh-i fh-xs" strokeWidth={1.5} />
        Remove
      </Button>,
    );
  if (buttons.length === 0) return null;
  return (
    <>
      <div className="fh-btn-row" style={{ marginTop: 14 }}>
        {buttons}
      </div>
      {error ? <ErrorNote>{error}</ErrorNote> : null}
    </>
  );
}

// "Ask Marcus for an intro": the note opens in place (Founderhall has no dialogs), and the ask goes to Marcus as an
// intro ask, using one of this week's asks.
export function AskViaButton({ askId, helper, canAsk }: { askId: string; helper: { id: string; firstName: string }; canAsk: boolean }) {
  const [isOpen, setIsOpen] = useState(false);
  const { error, isPending, run } = useAction();
  function submit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    const note = String(new FormData(event.currentTarget).get("note") ?? "");
    void run(async () => {
      const { introId } = await postRequest(ASK_API_ROUTES.askHelper, { askId, helperId: helper.id, note }, createdIntroSchema);
      return `/intros/${introId}`;
    });
  }
  return (
    <>
      <Button variant="ink" size="sm" disabled={!canAsk} aria-expanded={isOpen} onClick={() => setIsOpen((open) => !open)}>
        Ask {helper.firstName} for an intro
      </Button>
      {isOpen ? (
        <form className="w-full" onSubmit={submit}>
          <label className="fh-label fh-small" htmlFor={`via-${helper.id}`}>
            A note {helper.firstName} can forward
          </label>
          <Textarea id={`via-${helper.id}`} name="note" rows={3} maxLength={ASK_LIMITS.noteLength} required style={{ minHeight: 84 }} />
          <div className="fh-btn-row" style={{ marginTop: 8 }}>
            <Button size="sm" type="submit" disabled={isPending}>
              <Send aria-hidden="true" className="fh-i fh-xs" strokeWidth={1.5} />
              Ask {helper.firstName}
            </Button>
          </div>
          {error ? <ErrorNote>{error}</ErrorNote> : null}
        </form>
      ) : null}
    </>
  );
}

// Community's report, kept as Founderhall's quiet link with the question in place (no menu, no dialog).
export function ReportLink({ target, id, noun }: { target: "ask" | "answer"; id: string; noun: string }) {
  const router = useRouter();
  const [stage, setStage] = useState<"link" | "confirm" | "done">("link");
  const [error, setError] = useState<string | null>(null);
  async function report() {
    setError(null);
    try {
      if (target === "ask") await postRequest(ASK_API_ROUTES.report, { askId: id }, acknowledgedResponseSchema);
      else await postRequest(ASK_API_ROUTES.reportAnswer, { answerId: id }, acknowledgedResponseSchema);
      setStage("done");
      router.refresh();
    } catch (failure) {
      setError(failure instanceof Error ? failure.message : "Something went wrong. Try again.");
    }
  }
  if (stage === "done") return <p className="fh-small fh-muted">Reported. The admins see a copy.</p>;
  if (stage === "link") {
    return (
      <button type="button" className="fh-linkbtn" onClick={() => setStage("confirm")}>
        Report this {noun}
      </button>
    );
  }
  return (
    <div className="fh-note" style={{ marginTop: 8 }}>
      <span>
        Report this {noun} to your community’s admins? They see a copy and who reported it. The person who posted it isn’t told.
        <span className="fh-btn-row" style={{ marginTop: 8, display: "flex" }}>
          <Button size="sm" variant="secondary" onClick={() => void report()}>
            Report it
          </Button>
          <Button size="sm" variant="quiet" onClick={() => setStage("link")}>
            Cancel
          </Button>
        </span>
        {error ? <span role="alert">{error}</span> : null}
      </span>
    </div>
  );
}

// Community's renewal: an open ask near its 30 days goes back on the board for another 30.
export function RenewButton({ askId }: { askId: string }) {
  const { error, isPending, run } = useAction();
  return (
    <>
      <Button
        size="sm"
        variant="secondary"
        disabled={isPending}
        onClick={() =>
          void run(async () => {
            await postRequest(ASK_API_ROUTES.renew, { askId }, acknowledgedResponseSchema);
            return toAskPage(askId);
          })
        }
      >
        Renew for {ASK_LIMITS.lifetimeDays} days
      </Button>
      {error ? <ErrorNote>{error}</ErrorNote> : null}
    </>
  );
}
