import type { PillTone } from "@/components/ui/pill";
import type { StepperState } from "@/components/ui/stepper";
import { readFirstName } from "@/platform/design/avatar-identity";
import { formatDayMonth } from "@/platform/text/format-date";

import { ADMINS_SEE_INTRO_NAMES, REQUESTER_SEES_WHO_ANSWERED, INTRO_OUTCOMES, INTRO_ROLES, INTRO_STATES, OUTCOME_CHOICES, type Intro, type IntroOutcome, type OutcomeChoice } from "../contract";
import { possessive, toRoleAndCompany } from "../email-copy";

// Founderhall's words for an intro's screens (intros/views.mjs), on Community's states.

export const CONSENT_LINE = "Nobody is introduced without saying yes.";

export const OUTCOME_LABELS: Record<OutcomeChoice, string> = {
  [OUTCOME_CHOICES.helpful]: "Helpful",
  [OUTCOME_CHOICES.notReally]: "Not really",
  [OUTCOME_CHOICES.tooEarly]: "Too early to say",
};

export const CHOICE_BY_OUTCOME: Record<IntroOutcome, OutcomeChoice> = {
  [INTRO_OUTCOMES.helped]: OUTCOME_CHOICES.helpful,
  [INTRO_OUTCOMES.notHelped]: OUTCOME_CHOICES.notReally,
  [INTRO_OUTCOMES.notYet]: OUTCOME_CHOICES.tooEarly,
};

// "What came of it?" Founderhall's four ticks; "Nothing yet" saves no result.
export const RESULT_LABELS = {
  customer: "A customer conversation started",
  hire: "A hire",
  investor: "An investor meeting",
  nothing: "Nothing yet",
} as const;

export const OUTCOME_DAYS = 14;

const MADE_STATES: readonly string[] = [INTRO_STATES.completed];
const OPEN_STATES: readonly string[] = [INTRO_STATES.requested, INTRO_STATES.accepted, INTRO_STATES.askingTarget, INTRO_STATES.targetAgreed];

export function isMade(intro: Pick<Intro, "state">) {
  return MADE_STATES.includes(intro.state);
}

export function isOpen(intro: Pick<Intro, "state">) {
  return OPEN_STATES.includes(intro.state);
}

export function poss(name: string) {
  return possessive(name, "’");
}

export function readNames(intro: Pick<Intro, "requester" | "introducer" | "target">) {
  return {
    asker: intro.requester.name,
    askerFirst: readFirstName(intro.requester.name),
    connector: intro.introducer.name,
    connectorFirst: readFirstName(intro.introducer.name),
    target: intro.target.name,
    targetFirst: readFirstName(intro.target.name) || "them",
  };
}

// "Sam ↔ Rosa, via Marcus"
export function readIntroTitle(intro: Pick<Intro, "requester" | "introducer" | "target">) {
  const { askerFirst, targetFirst, connectorFirst } = readNames(intro);
  return `${askerFirst} ↔ ${targetFirst}, via ${connectorFirst}`;
}

// Who the asker hears said no. Founderhall names the connector; with Community's rule (the asker can't tell whose no
// it was) nobody is named.
export function readWhoSaidNo(connectorFirst: string, isAsker: boolean) {
  return REQUESTER_SEES_WHO_ANSWERED || !isAsker ? connectorFirst : "They";
}

// The pill for an intro, from the asker's side. Declines are kind and carry no reason.
export function readStatusPill(intro: Pick<Intro, "state" | "outcome" | "requester" | "introducer" | "target" | "viewerRole">): { tone: PillTone; label: string } {
  const { connectorFirst, targetFirst } = readNames(intro);
  const whoSaidNo = readWhoSaidNo(connectorFirst, intro.viewerRole === INTRO_ROLES.requester);
  switch (intro.state) {
    case INTRO_STATES.requested:
    case INTRO_STATES.accepted:
    case INTRO_STATES.targetAgreed:
      return { tone: "open", label: `With ${connectorFirst}` };
    case INTRO_STATES.askingTarget:
      return { tone: "open", label: `With ${targetFirst}` };
    case INTRO_STATES.completed:
      return { tone: "made", label: intro.outcome === INTRO_OUTCOMES.helped ? "Introduced · helpful" : "Introduced" };
    case INTRO_STATES.declined:
      return { tone: "declined", label: `${whoSaidNo} can’t make this one` };
    case INTRO_STATES.targetDeclined:
      return { tone: "declined", label: `${targetFirst} can’t take this one` };
    case INTRO_STATES.expired:
      return { tone: "declined", label: "No answer" };
    case INTRO_STATES.withdrawn:
      return { tone: "declined", label: "Withdrawn" };
  }
}

// The state in Founderhall's intro-log words, for "Asks you were part of".
const STATE_WORDS: Record<string, string> = {
  [INTRO_STATES.requested]: "with connector",
  [INTRO_STATES.accepted]: "with connector",
  [INTRO_STATES.askingTarget]: "with target",
  [INTRO_STATES.targetAgreed]: "with connector",
  [INTRO_STATES.declined]: "declined by connector",
  [INTRO_STATES.targetDeclined]: "declined by target",
  [INTRO_STATES.expired]: "no answer",
  [INTRO_STATES.completed]: "introduced",
  [INTRO_STATES.withdrawn]: "withdrawn",
};

export function readPartOfPill(intro: Pick<Intro, "state">): { tone: PillTone; label: string } {
  const tone: PillTone = isMade(intro) ? "made" : isOpen(intro) ? "open" : "declined";
  return { tone, label: STATE_WORDS[intro.state] ?? intro.state };
}

// "CTO, Halcyon Health. Nobody is introduced without saying yes."
export function readIntroLede(intro: Pick<Intro, "target">) {
  const about = readTargetAbout(intro);
  return about ? `${about}. ${CONSENT_LINE}` : CONSENT_LINE;
}

// Founderhall writes "role, company"; Village's headlines say "role at company".
export function readTargetAbout(intro: Pick<Intro, "target">) {
  return toRoleAndCompany(intro.target.headline) ?? "";
}

// The company line of a "Your asks" row: the company in a "Role at Company" headline, else the headline.
export function readTargetCompany(intro: Pick<Intro, "target">) {
  const headline = intro.target.headline?.trim() ?? "";
  const atIndex = headline.lastIndexOf(" at ");
  if (atIndex >= 0) return headline.slice(atIndex + " at ".length);
  const commaIndex = headline.lastIndexOf(", ");
  return commaIndex >= 0 ? headline.slice(commaIndex + 2) : headline;
}

export function readPrivacyLine(community: string) {
  return ADMINS_SEE_INTRO_NAMES
    ? `Only the people in this intro see the note. ${poss(community)} admins see names, states and dates.`
    : `Only the people in this intro see the note. ${poss(community)} admins see counts, never names.`;
}

export function readNoteLabel(intro: Pick<Intro, "viewerRole" | "requester">) {
  const label = `${poss(readFirstName(intro.requester.name))} note`;
  return intro.viewerRole === INTRO_ROLES.requester ? `${label}, as sent` : label;
}

type TrackerStep = { key: string; state: StepperState; title: string; detail: string };

const date = (value: string | null) => (value ? formatDayMonth(value) : "");

// The asker's tracker (Founderhall's tracker()): asked · connector decides · person decides · introduced · helpful.
export function readTrackerSteps(intro: Intro, community: string): TrackerStep[] {
  const { connectorFirst: c, targetFirst: t } = readNames(intro);
  const state = intro.state;
  const steps: TrackerStep[] = [{ key: "asked", state: "done", title: `You asked ${c}`, detail: date(intro.createdAt) }];
  const wasTargetAsked = intro.askedTargetAt !== null;
  const isWaitingOnConnector = state === INTRO_STATES.requested || state === INTRO_STATES.accepted;

  if (isWaitingOnConnector) steps.push({ key: "connector", state: "now", title: `${c} decides`, detail: "By email or in the portal. The ask closes after 7 days with no answer." });
  else if (state === INTRO_STATES.declined) steps.push({ key: "connector", state: "no", title: `${readWhoSaidNo(c, true)} can’t make this one`, detail: `${date(intro.closedAt)}. Your ask is back.` });
  else if (state === INTRO_STATES.expired && !wasTargetAsked) steps.push({ key: "connector", state: "no", title: REQUESTER_SEES_WHO_ANSWERED ? `No answer from ${c}` : "No answer", detail: `Closed after 7 days, ${date(intro.closedAt)}. Your ask is back.` });
  else if (state === INTRO_STATES.withdrawn && !wasTargetAsked) steps.push({ key: "connector", state: "no", title: "You withdrew the ask", detail: `${date(intro.closedAt)}. Your ask is back.` });
  else steps.push({ key: "connector", state: "done", title: `${c} said yes and asked ${t}`, detail: date(intro.askedTargetAt) });

  if (wasTargetAsked || isWaitingOnConnector) {
    if (isWaitingOnConnector) steps.push({ key: "target", state: "todo", title: `${t} decides`, detail: "One email, one reminder after 4 days, then it closes at 7." });
    else if (state === INTRO_STATES.askingTarget) steps.push({ key: "target", state: "now", title: `${t} decides`, detail: `Asked ${date(intro.askedTargetAt)}. One reminder after 4 days, then it closes at 7.` });
    else if (state === INTRO_STATES.targetDeclined) steps.push({ key: "target", state: "no", title: `${t} can’t take this one`, detail: `${date(intro.closedAt)}. Your ask is back.` });
    else if (state === INTRO_STATES.expired) steps.push({ key: "target", state: "no", title: `No answer from ${t}`, detail: `Closed after 7 days, ${date(intro.closedAt)}. Your ask is back.` });
    else if (state === INTRO_STATES.withdrawn) steps.push({ key: "target", state: "no", title: "You withdrew the ask", detail: `${date(intro.closedAt)}. Your ask is back.` });
    else steps.push({ key: "target", state: "done", title: `${t} said yes`, detail: date(intro.targetAgreedAt) });
  }

  const made = isMade(intro);
  if (made || isOpen(intro)) {
    steps.push({
      key: "introduced",
      state: made ? "done" : "todo",
      title: `Introduced by email from ${community}`,
      detail: made ? date(intro.closedAt) : "Only when both have said yes",
    });
    const outcomeState: StepperState = intro.outcome ? "done" : intro.isOutcomeDue ? "now" : "todo";
    const outcomeDetail = intro.outcome
      ? `You said: ${OUTCOME_LABELS[CHOICE_BY_OUTCOME[intro.outcome]].toLowerCase()}`
      : intro.isOutcomeDue
        ? "Asked by email; answer below"
        : `Asked ${OUTCOME_DAYS} days after the intro`;
    steps.push({ key: "outcome", state: outcomeState, title: "Was it helpful?", detail: outcomeDetail });
  }
  return steps;
}

// "Marcus won’t be asked again, and the ask comes back to you."
export function readWithdrawHint(intro: Intro) {
  const { connectorFirst, targetFirst } = readNames(intro);
  const who = intro.state === INTRO_STATES.askingTarget ? `${connectorFirst} and ${targetFirst}` : connectorFirst;
  return `${who} won’t be asked again, and the ask comes back to you.`;
}

// The connector's three choices, each with its line.
export function readConnectorChoices(intro: Pick<Intro, "requester" | "introducer" | "target">, community: string) {
  const { askerFirst, targetFirst } = readNames(intro);
  return [
    { value: "yes", title: "Yes, introduce them", description: `We email ${targetFirst} once, from ${community}, in your name.` },
    { value: "not_now", title: "Not this time", description: `${askerFirst} is told you can’t make this one. Never why.` },
    { value: "dont_know", title: "I don’t know them well enough", description: `Same message to ${askerFirst}: you can’t make this one.` },
  ] as const;
}

export function readTargetEmailHint(intro: Pick<Intro, "requester" | "introducer" | "target">) {
  const { askerFirst, targetFirst } = readNames(intro);
  return `Used for this one ask. ${targetFirst} sees ${poss(askerFirst)} address only if they say yes.`;
}

export function readTargetEmailLabel(intro: Pick<Intro, "requester" | "introducer" | "target">) {
  return `${poss(readNames(intro).targetFirst)} email, if you say yes`;
}
