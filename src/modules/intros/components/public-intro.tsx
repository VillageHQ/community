"use client";

import { useEffect, useState, type FormEvent, type ReactNode } from "react";

import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { ConsentLine } from "@/components/ui/note";
import { readFirstName } from "@/platform/design/avatar-identity";

import { CONSENT_ANSWERS, INTRO_LINK_PURPOSES, OUTCOME_CHOICES, TARGET_CHOICES, type OutcomeChoice } from "../contract";
import { answerByLinkRequest, answerConsentRequest } from "../queries";
import { DecisionForm } from "./intro-decision";
import { OUTCOME_LABELS, poss } from "./intro-words";

// Founderhall's public intro pages (decisionPage(), decisionDone(), optoutPage()): one card, the question, the note,
// the decision form. Answering swaps the card for its "done" words, as Founderhall's next page does.

type Done = { title: string; text: string; hasConsentLine: boolean };

const NOTHING_TO_DO: Done = { title: "Nothing to do", text: "This ask was already answered. Thank you.", hasConsentLine: false };

function DoneCard({ done }: { done: Done }) {
  useEffect(() => {
    document.title = document.title.replace(/^[^·]*·/, `${done.title} ·`);
  }, [done.title]);
  return (
    <>
      <h1 className="fh-h2">{done.title}</h1>
      <p className="fh-lede">{done.text}</p>
      {done.hasConsentLine ? (
        <div className="mt-3">
          <ConsentLine />
        </div>
      ) : null}
    </>
  );
}

function Question({ title, lede, note, children }: { title: string; lede: string; note: string | null; children: ReactNode }) {
  return (
    <>
      <h1 className="fh-h2">{title}</h1>
      <p className="fh-lede">{lede}</p>
      {note ? <div className="fh-quote fh-notetext">{note}</div> : null}
      {children}
    </>
  );
}

// copiesConnector: replies by email are on, so the introduction is one thread with the connector copied. Off, each side
// gets its own copy, and the words never say "copied".
type ConnectorFacts = { askerName: string; connectorName: string; targetName: string; note: string; suggestedEmail: string | null; canEmail: boolean; copiesConnector: boolean };

export function ConnectorLinkQuestion({ token, community, facts, initialChoice }: { token: string; community: string; facts: ConnectorFacts; initialChoice: string | null }) {
  const [done, setDone] = useState<Done | null>(null);
  if (done) return <DoneCard done={done} />;
  const askerFirst = readFirstName(facts.askerName);
  const targetFirst = readFirstName(facts.targetName) || "them";
  return (
    <Question title={`${readFirstName(facts.connectorName)}, would you introduce ${facts.askerName} to ${facts.targetName}?`} lede={`${facts.askerName} asked ${community} for an intro, through you.`} note={facts.note}>
      <DecisionForm
        onClosed={() => setDone(NOTHING_TO_DO)}
        legend="Would you introduce them?"
        initialChoice={initialChoice}
        choices={[
          { value: "yes", title: "Yes, introduce them", description: `We email ${targetFirst} once, from ${community}, in your name.` },
          { value: "not_now", title: "Not this time", description: `${askerFirst} is told you can’t make this one. Never why.` },
          { value: "dont_know", title: "I don’t know them well enough", description: `Same message to ${askerFirst}: you can’t make this one.` },
        ]}
        email={
          facts.canEmail
            ? { label: `${poss(targetFirst)} email, if you say yes`, hint: `Used for this one ask. ${targetFirst} sees ${poss(askerFirst)} address only if they say yes.`, initial: facts.suggestedEmail }
            : null
        }
        note={facts.note}
        submit={async ({ choice, targetEmail, note }) => {
          const { result } = await answerByLinkRequest({ purpose: INTRO_LINK_PURPOSES.connector, token, choice: choice as "yes" | "not_now" | "dont_know", targetEmail, note });
          setDone(
            result === "declined"
              ? { title: "Thanks for answering", text: `${askerFirst} is told you can’t make this one, never why. The ask goes back to ${askerFirst}.`, hasConsentLine: true }
              : {
                  title: "Thank you",
                  text: facts.canEmail
                    ? `We’ve asked ${targetFirst}, from ${community}, in your name. If ${targetFirst} says yes, ${facts.copiesConnector ? `one email introduces ${askerFirst} and ${targetFirst}, with you copied` : `we email ${askerFirst} and ${targetFirst} to introduce them`}.`
                    : `Next, ${targetFirst} needs to say yes too. Open the intro in the portal for the link to send them.`,
                  hasConsentLine: true,
                },
          );
        }}
      />
    </Question>
  );
}

type TargetFacts = { askerName: string; connectorName: string; targetName: string; note: string; joinsByEmail: boolean; asksForEmail: boolean; copiesConnector: boolean };

export function TargetLinkQuestion({ token, community, facts, initialChoice, optOutHref }: { token: string; community: string; facts: TargetFacts; initialChoice: string | null; optOutHref: string }) {
  const [done, setDone] = useState<Done | null>(null);
  const [email, setEmail] = useState("");
  if (done) return <DoneCard done={done} />;
  const askerFirst = readFirstName(facts.askerName);
  const connectorFirst = readFirstName(facts.connectorName);
  return (
    <Question title={`${facts.connectorName} would like to introduce you to ${facts.askerName}`} lede={`${connectorFirst} is a member of ${community}.`} note={facts.note}>
      <DecisionForm
        onClosed={() => setDone(NOTHING_TO_DO)}
        legend={`Would you like to meet ${askerFirst}?`}
        initialChoice={initialChoice}
        choices={[
          {
            value: TARGET_CHOICES.yes,
            title: "Yes, introduce us",
            description: facts.copiesConnector ? `One email to you and ${askerFirst}, with ${connectorFirst} copied.` : `We email you and ${askerFirst} to introduce you.`,
          },
          { value: TARGET_CHOICES.no, title: "No thanks", description: "Nobody is told why, and nothing more is sent." },
        ]}
        submit={async ({ choice }) => {
          const isYes = choice === TARGET_CHOICES.yes;
          const saved = await answerConsentRequest({
            token,
            answer: isYes ? CONSENT_ANSWERS.yes : CONSENT_ANSWERS.noThanks,
            ...(isYes && facts.asksForEmail && email.trim() ? { targetEmail: email.trim() } : {}),
          });
          // Answered already (another tab, another link): say there's nothing to do, never the choice just clicked.
          if (saved.isRepeat) {
            setDone(NOTHING_TO_DO);
            return;
          }
          const isJoinedByEmail = facts.joinsByEmail || (facts.asksForEmail && email.trim() !== "");
          setDone(
            saved.answer !== CONSENT_ANSWERS.yes
              ? { title: "Thanks for answering", text: "Nobody is told why, and nothing more is sent about this.", hasConsentLine: true }
              : isJoinedByEmail
                ? {
                    title: "You’re introduced",
                    text: facts.copiesConnector
                      ? `Check your email: one message to you and ${askerFirst}, with ${connectorFirst} copied. Reply to it to write to them.`
                      : `Check your email: we’ve introduced you to ${askerFirst}. Reply to it to write to ${askerFirst}.`,
                    hasConsentLine: true,
                  }
                : { title: "Thank you", text: `${connectorFirst} will introduce you and ${askerFirst} with one message.`, hasConsentLine: true },
          );
        }}
        after={
          facts.asksForEmail ? (
            // Community's forwarded link: the app has no address for them yet, so a yes asks for one.
            <div className="fh-field">
              <label className="fh-label" htmlFor="target-own-email">
                Your email, if you say yes
              </label>
              <Input id="target-own-email" type="email" autoComplete="email" value={email} onChange={(event) => setEmail(event.target.value)} placeholder="e.g. name@company.example" />
              <p className="fh-hint">Only for a yes: one email to you and {askerFirst}, then we delete your address.</p>
            </div>
          ) : null
        }
      />
      <p className="fh-small fh-muted mt-[18px]">
        <a href={optOutHref}>Don’t send me intro asks from {community}</a>
      </p>
    </Question>
  );
}

type OutcomeFacts = { connectorName: string; targetName: string; introducedOn: string };

export function OutcomeLinkQuestion({ token, facts, initialChoice }: { token: string; facts: OutcomeFacts; initialChoice: string | null }) {
  const [done, setDone] = useState<Done | null>(null);
  if (done) return <DoneCard done={done} />;
  const connectorFirst = readFirstName(facts.connectorName);
  return (
    <Question title={`Was the intro to ${facts.targetName} helpful?`} lede={`${facts.connectorName} introduced you ${facts.introducedOn}.`} note={null}>
      <DecisionForm
        onClosed={() => setDone(NOTHING_TO_DO)}
        legend="Your answer"
        initialChoice={initialChoice ?? OUTCOME_CHOICES.helpful}
        withResults
        hasConsentLine={false}
        choices={[
          { value: OUTCOME_CHOICES.helpful, title: OUTCOME_LABELS.helpful, description: `${connectorFirst} gets a thank-you.` },
          { value: OUTCOME_CHOICES.notReally, title: OUTCOME_LABELS.not_really, description: "Counted, never shared with names." },
          { value: OUTCOME_CHOICES.tooEarly, title: OUTCOME_LABELS.too_early, description: "Counted; change it later from Your intros." },
        ]}
        submit={async ({ choice, results }) => {
          await answerByLinkRequest({
            purpose: INTRO_LINK_PURPOSES.outcome,
            token,
            outcome: choice as OutcomeChoice,
            results: results.filter((result): result is "customer" | "hire" | "investor" => ["customer", "hire", "investor"].includes(result)),
          });
          setDone({ title: "Thank you", text: "Noted. It helps the community see which intros work.", hasConsentLine: true });
        }}
      />
    </Question>
  );
}

// "Stop intro asks from Northwind Founders?" One button; any ask waiting for them closes, and nobody is told why.
export function OptOutQuestion({ token, community, email }: { token: string; community: string; email: string }) {
  const [state, setState] = useState<"idle" | "pending" | "done">("idle");
  const [error, setError] = useState<string | null>(null);
  if (state === "done") {
    return <DoneCard done={{ title: "Done", text: `${community} won’t send intro asks to ${email} again. Members aren’t told why an ask didn’t happen.`, hasConsentLine: false }} />;
  }
  async function onSubmit(event: FormEvent) {
    event.preventDefault();
    setState("pending");
    try {
      await answerConsentRequest({ token, answer: CONSENT_ANSWERS.stopAllAsks });
      setState("done");
    } catch (failure) {
      setError(failure instanceof Error ? failure.message : "That didn't work. Try again.");
      setState("idle");
    }
  }
  return (
    <>
      <h1 className="fh-h2">Stop intro asks from {community}?</h1>
      <p className="fh-lede">We won’t send intro asks to {email} again. Any ask waiting for you now closes, and nobody is told why.</p>
      <form onSubmit={onSubmit} className="mt-4">
        {error ? (
          <div className="fh-note fh-needs mb-3" role="alert">
            <span>{error}</span>
          </div>
        ) : null}
        <Button type="submit" width="block" disabled={state === "pending"}>
          Don’t send me intro asks
        </Button>
      </form>
    </>
  );
}
