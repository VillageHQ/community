"use client";

import { useMutation, useQueryClient } from "@tanstack/react-query";
import { Send } from "lucide-react";
import { useRouter } from "next/navigation";
import { useState, type ReactNode } from "react";

import { CompanyLogo } from "@/components/company-name";
import { Avatar } from "@/components/ui/avatar";
import { Button } from "@/components/ui/button";
import { ConsentLine, Note } from "@/components/ui/note";
import { AllowancePips } from "@/components/ui/search-box";
import { Stepper } from "@/components/ui/stepper";
import { readFirstName } from "@/platform/design/avatar-identity";
import { ROUTES } from "@/platform/http/routes";
import { readPrivacyLine } from "@/modules/intros/components/intro-words";
import { createIntroRequest, INTRO_QUERY_KEYS } from "@/modules/intros/queries";

import { joinNoteParts, NOTE_MAXIMUM, type NoteParts } from "./intro-ask-note";

export const ASKED_FLASH_PARAM = "m";
export const ASKED_FLASH_VALUE = "asked";
const CONSENT = "Nobody is introduced without saying yes.";

export type AskAllowanceView = { left: number; cap: number };

function toAskedHref(introId: string) {
  return `${ROUTES.intros}/${introId}?${ASKED_FLASH_PARAM}=${ASKED_FLASH_VALUE}`;
}

// "3 of 5 asks left this week", as pips, and the one rule under it (Founderhall's allowanceLine).
export function AllowanceLine({ allowance }: { allowance: AskAllowanceView }) {
  const text = `${allowance.left} of ${allowance.cap} asks left this week`;
  return (
    <div className="fh-allow" aria-label={text}>
      <AllowancePips left={allowance.left} total={allowance.cap} label={text} />
      <span className="fh-small fh-muted">Asks you post and intro asks share it. Declined, expired and withdrawn intro asks come back.</span>
    </div>
  );
}

type HowItWorksProps = { connectorFirst: string; targetFirst: string; communityName: string; lifetimeDays: number; outcomeDays: number };

// The right rail of the ask from a profile: the five steps of an intro, the first one now.
export function HowAnIntroWorks({ connectorFirst, targetFirst, communityName, lifetimeDays, outcomeDays }: HowItWorksProps) {
  return (
    <section className="fh-sheet">
      <h2 className="fh-h3">How an intro works</h2>
      <Stepper
        className="mt-3.5"
        steps={[
          { key: "ask", state: "now", title: `You ask ${connectorFirst}`, detail: "With the note on the left. It uses one of your asks this week." },
          { key: "connector", state: "todo", title: `${connectorFirst} decides`, detail: `By email or here. ${lifetimeDays} days, then the ask closes and comes back to you.` },
          { key: "target", state: "todo", title: targetFirst ? `${targetFirst} decides` : "They decide", detail: `One email from ${communityName}, one reminder, ${lifetimeDays} days.` },
          { key: "introduced", state: "todo", title: "Introduced by email", detail: "Only when both said yes. Replies land in your Inbox too." },
          { key: "outcome", state: "todo", title: "Was it helpful?", detail: `One question, ${outcomeDays} days later.` },
        ]}
      />
    </section>
  );
}

function useAsk() {
  const router = useRouter();
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: createIntroRequest,
    onSuccess: async (intro) => {
      await queryClient.invalidateQueries({ queryKey: [INTRO_QUERY_KEYS.board] });
      router.push(toAskedHref(intro.id));
    },
  });
}

function ErrorNote({ message }: { message: string | null | undefined }) {
  if (!message) return null;
  return (
    <Note kind="needs" role="alert" className="mt-3.5">
      {message}
    </Note>
  );
}

type OneStepAskProps = {
  connectorName: string;
  connectorSlug: string;
  targetSlug: string;
  draftNote: string;
  cap: number;
  communityName: string;
  // Why the ask can't go now (the week's asks are used, the member paused asks), or null.
  blockedReason: string | null;
};

// The one-step ask from a search result: one note, the allowance in one line, one Send (Founderhall's oneStepAskPage).
export function OneStepAskForm({ connectorName, connectorSlug, targetSlug, draftNote, cap, communityName, blockedReason }: OneStepAskProps) {
  const [note, setNote] = useState(draftNote);
  const ask = useAsk();
  const connectorFirst = readFirstName(connectorName);
  return (
    <>
      <ErrorNote message={ask.error?.message ?? blockedReason} />
      <form
        className="fh-sheet fh-section"
        onSubmit={(event) => {
          event.preventDefault();
          ask.mutate({ targetSlug, connectorSlug, note });
        }}
      >
        <label className="fh-label" htmlFor="a-note">
          Your note to {connectorFirst}
        </label>
        <textarea className="fh-textarea" id="a-note" name="note" rows={5} maxLength={NOTE_MAXIMUM} required value={note} onChange={(event) => setNote(event.target.value)} />
        <p className="fh-small fh-muted" style={{ marginTop: 12 }}>
          {connectorFirst} gets this by email and in the portal. Up to {cap} ask{cap === 1 ? "" : "s"} a week per founder.
        </p>
        {/* The owner decided (2026-11-11): admins see who asked whom, and members are told where they ask. */}
        <p className="fh-small fh-muted mt-1.5">{readPrivacyLine(communityName)}</p>
        <div className="fh-send-row">
          <Button type="submit" width="block" disabled={blockedReason !== null || ask.isPending || ask.isSuccess}>
            Send to {connectorFirst}
          </Button>
        </div>
      </form>
    </>
  );
}

type Connector = { id: string; name: string; about: string; avatarUrl: string | null; companyLogoUrl: string | null };

type NoteAskProps = {
  connector: Connector;
  viewerName: string;
  communityName: string;
  parts: NoteParts;
  blockedReason: string | null;
  // The guided ask knows the person already; from a profile the asker names them.
  target: { name: string; role: string; company: string; slug: string | null } | null;
  connectorSlug?: string | null;
};

function NotePart({ id, label, placeholder, value, onChange }: { id: string; label: string; placeholder: string; value: string; onChange: (value: string) => void }) {
  return (
    <div className="fh-notepart">
      <label className="fh-label" htmlFor={id}>
        {label}
      </label>
      <textarea className="fh-textarea" id={id} rows={3} placeholder={placeholder} value={value} onChange={(event) => onChange(event.target.value)} />
    </div>
  );
}

function TargetField({ id, label, placeholder, value, onChange, isRequired = false }: { id: string; label: string; placeholder: string; value: string; onChange: (value: string) => void; isRequired?: boolean }) {
  return (
    <div>
      <label className="fh-label fh-small" htmlFor={id}>
        {label}
      </label>
      <input className="fh-input" id={id} maxLength={120} required={isRequired} placeholder={placeholder} value={value} onChange={(event) => onChange(event.target.value)} />
    </div>
  );
}

// The forwardable note in three parts, shown as the email the member gets (Founderhall's askPage and the guided ask's
// note step).
export function NoteAskForm({ connector, viewerName, communityName, parts: initialParts, blockedReason, target, connectorSlug }: NoteAskProps) {
  const [parts, setParts] = useState(initialParts);
  const [person, setPerson] = useState({ name: target?.name ?? "", role: target?.role ?? "", company: target?.company ?? "" });
  const [tooLong, setTooLong] = useState(false);
  const ask = useAsk();
  const connectorFirst = readFirstName(connector.name);
  const targetName = person.name.trim();
  const targetFirst = targetName ? readFirstName(targetName) : "";
  const note = joinNoteParts(parts);
  const total = note.length;
  const update = (part: keyof NoteParts) => (value: string) => setParts((current) => ({ ...current, [part]: value }));
  const submit = () => {
    if (total > NOTE_MAXIMUM) {
      setTooLong(true);
      return;
    }
    if (target?.slug && connectorSlug) {
      ask.mutate({ targetSlug: target.slug, connectorSlug, note });
      return;
    }
    ask.mutate({ connectorId: connector.id, target: { name: person.name, role: person.role, company: person.company, email: null, linkedin: null }, note });
  };
  return (
    <>
      <ErrorNote message={ask.error?.message ?? blockedReason} />
      <form
        className="fh-section"
        id="askform"
        onSubmit={(event) => {
          event.preventDefault();
          submit();
        }}
      >
        {target ? null : (
          <>
            <div className="fh-person">
              <span className="fh-k">Through</span>
              <Avatar stableId={connector.id} name={connector.name} imageUrl={connector.avatarUrl} sizePx={28} />
              <div>
                <b>{connector.name}</b>
                <span>
                  {/* No top nudge: Founderhall's logo sits on the line by its own -3px, so the card stays 2 px shorter. */}
                  <CompanyLogo url={connector.companyLogoUrl} className="fh-colog mt-0" />
                  {connector.about}
                </span>
              </div>
            </div>
            <p className="fh-label" style={{ marginTop: 18 }}>
              Who should {connectorFirst} introduce you to?
            </p>
            <div className="fh-pair">
              <TargetField id="t-name" label="Name" placeholder="e.g. Alex Rivera" isRequired value={person.name} onChange={(name) => setPerson((current) => ({ ...current, name }))} />
              <TargetField id="t-role" label="Role" placeholder="e.g. VP Procurement" value={person.role} onChange={(role) => setPerson((current) => ({ ...current, role }))} />
              <TargetField id="t-company" label="Company" placeholder="e.g. Halcyon Health" value={person.company} onChange={(company) => setPerson((current) => ({ ...current, company }))} />
            </div>
          </>
        )}
        <div className="fh-mail fh-compose" style={{ marginTop: target ? 0 : 18 }}>
          <div className="fh-mail-h">
            <div>
              <span className="fh-k">From</span>
              <span className="fh-v">
                {viewerName} via {communityName}
              </span>
            </div>
            <div>
              <span className="fh-k">To</span>
              <span className="fh-v">{connector.name}</span>
            </div>
            <div className="fh-subj">
              {connectorFirst}, would you introduce {viewerName} to {targetName || "…"}?
            </div>
          </div>
          <div className="fh-mail-b">
            <NotePart id="n-who" label="Who I am and what I do" placeholder={`e.g. I’m ${readFirstName(viewerName)}, founder of …`} value={parts.who} onChange={update("who")} />
            <NotePart id="n-why" label="Why this person, why now" placeholder="Why them, and why this week" value={parts.why} onChange={update("why")} />
            <NotePart id="n-proof" label="One proof point" placeholder="A number or a name that shows it works" value={parts.proof} onChange={update("proof")} />
            <div className="fh-composer-meter">
              <span>
                {targetFirst || "They"} hear{targetFirst ? "s" : ""} nothing unless {connectorFirst} says yes.
              </span>
              <span className={total > NOTE_MAXIMUM ? "fh-over" : undefined}>
                {total} of {NOTE_MAXIMUM} characters
              </span>
            </div>
            {tooLong && total > NOTE_MAXIMUM ? (
              <p className="fh-hint fh-err" role="alert">
                Keep the note under {NOTE_MAXIMUM} characters.
              </p>
            ) : null}
          </div>
        </div>
        <div style={{ marginTop: 12 }}>
          <ConsentLine>
            {`${connectorFirst} can say yes, not this time, or that they don’t know them well enough. If it’s a no, you’re told ${connectorFirst} can’t make this one, never why. ${CONSENT}`}
          </ConsentLine>
          {/* The owner decided (2026-11-11): admins see who asked whom, and members are told where they ask. */}
          <p className="fh-small fh-muted mt-1.5">{readPrivacyLine(communityName)}</p>
        </div>
        <div className="fh-send-row">
          <Button type="submit" width="block" disabled={blockedReason !== null || ask.isPending || ask.isSuccess}>
            <Send aria-hidden="true" />
            Ask {connectorFirst}
          </Button>
        </div>
      </form>
    </>
  );
}

// The two-column page of the ask from a profile: the form left, how an intro works right (desktop only).
export function FlowLayout({ children, rail }: { children: ReactNode; rail: ReactNode }) {
  return (
    <div className="fh-flow">
      <div>{children}</div>
      <aside className="fh-desk-only">{rail}</aside>
    </div>
  );
}
