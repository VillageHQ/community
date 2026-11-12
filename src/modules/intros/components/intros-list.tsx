import Link from "next/link";
import type { ReactNode } from "react";

import { Avatar } from "@/components/ui/avatar";
import { Pill } from "@/components/ui/pill";
import { Row, Rows } from "@/components/ui/rows";
import { AllowancePips } from "@/components/ui/search-box";
import { ROUTES } from "@/platform/http/routes";
import { formatDayMonth } from "@/platform/text/format-date";

import { STATES_WAITING_ON_INTRODUCER, type Intro, type IntroBoard, type IntroForTarget } from "../contract";
import { TargetMemberAsk } from "./target-member-ask";
import { CONSENT_LINE, readPartOfPill, readStatusPill, readTargetCompany } from "./intro-words";

export type IntroAllowance = { left: number; cap: number };

const ALLOWANCE_NOTE = "Asks you post and intro asks share it. Declined, expired and withdrawn intro asks come back.";

function describeAllowance({ left, cap }: IntroAllowance) {
  return `${left} of ${cap} asks left this week`;
}

// Founderhall's allowance line (allowanceLine()): the pips and words, then the small note beside them.
export function AllowanceLine({ allowance }: { allowance: IntroAllowance }) {
  return (
    <div className="fh-allow">
      <AllowancePips left={allowance.left} total={allowance.cap} label={describeAllowance(allowance)} />
      <span className="fh-small fh-muted">{ALLOWANCE_NOTE}</span>
    </div>
  );
}

function Section({ title, children }: { title: string; children: ReactNode }) {
  return (
    <section className="fh-section">
      <div className="fh-section-head">
        <h2 className="fh-h3">{title}</h2>
      </div>
      {children}
    </section>
  );
}

const href = (intro: Intro) => `${ROUTES.intros}/${intro.id}`;

const isWaitingOnYou = (intro: Intro) => (STATES_WAITING_ON_INTRODUCER as readonly string[]).includes(intro.state);

function WaitingRow({ intro }: { intro: Intro }) {
  return (
    <Row
      href={href(intro)}
      start={<Avatar stableId={intro.requester.id} name={intro.requester.name} imageUrl={intro.requester.avatarUrl} />}
      title={`${intro.requester.name} asks you for an intro to ${intro.target.name}`}
      detail={`asked ${formatDayMonth(intro.createdAt)}`}
      end={<Pill tone="needs">Answer</Pill>}
    />
  );
}

function YourAskRow({ intro }: { intro: Intro }) {
  const pill = readStatusPill(intro);
  const company = readTargetCompany(intro);
  return (
    <Row
      href={href(intro)}
      start={<Avatar stableId={intro.id} name={intro.target.name} />}
      title={`${intro.target.name} via ${intro.introducer.name}`}
      detail={[company, `asked ${formatDayMonth(intro.createdAt)}`].filter(Boolean).join(" · ")}
      end={<Pill tone={pill.tone}>{pill.label}</Pill>}
    />
  );
}

function PartOfRow({ intro }: { intro: Intro }) {
  const pill = readPartOfPill(intro);
  return (
    <Row
      href={href(intro)}
      start={<Avatar stableId={intro.requester.id} name={intro.requester.name} imageUrl={intro.requester.avatarUrl} />}
      title={`${intro.requester.name} → ${intro.target.name}`}
      detail={`asked ${formatDayMonth(intro.createdAt)}`}
      end={<Pill tone={pill.tone}>{pill.label}</Pill>}
    />
  );
}

// Founderhall's "Your intros" (introsPage()): the page head, the allowance line, "Waiting for your answer", "Your
// asks" and "Asks you were part of", as ruled rows that open each intro.
const AGO = new Intl.RelativeTimeFormat("en", { numeric: "auto" });

function describeAskedAgo(at: string, now: Date) {
  const days = Math.round((now.getTime() - new Date(at).getTime()) / 86_400_000);
  return AGO.format(-Math.max(0, days), "day");
}

// `forYou`: intros where this member is the person asked for (INTRO-06); they answer here too.
export function IntrosList({ board, allowance, forYou = [], now = new Date() }: { board: IntroBoard; allowance: IntroAllowance; forYou?: IntroForTarget[]; now?: Date }) {
  const toAnswer = board.asksForYou.filter(isWaitingOnYou);
  const partOf = board.asksForYou.filter((intro) => !isWaitingOnYou(intro));
  return (
    <>
      <div className="fh-pagehead">
        <h1 className="fh-h1">Your intros</h1>
        <p className="fh-lede">Ask a member for an intro from their profile. {CONSENT_LINE}</p>
      </div>
      <AllowanceLine allowance={allowance} />
      {toAnswer.length + forYou.length > 0 ? (
        <Section title="Waiting for your answer">
          {forYou.map((intro) => (
            <TargetMemberAsk key={intro.id} intro={intro} ago={describeAskedAgo(intro.createdAt, now)} />
          ))}
          {toAnswer.length > 0 ? (
            <Rows>
              {toAnswer.map((intro) => (
                <WaitingRow key={intro.id} intro={intro} />
              ))}
            </Rows>
          ) : null}
        </Section>
      ) : null}
      <Section title="Your asks">
        {board.yourAsks.length > 0 ? (
          <Rows>
            {board.yourAsks.map((intro) => (
              <YourAskRow key={intro.id} intro={intro} />
            ))}
          </Rows>
        ) : (
          <div data-slot="empty-state" className="fh-empty">
            <h2 className="fh-h2">No asks yet</h2>
            <p>
              Open a member’s profile in the <Link href={ROUTES.members}>directory</Link> and choose “Ask for an intro”. {describeAllowance(allowance)}.
            </p>
          </div>
        )}
      </Section>
      {partOf.length > 0 ? (
        <Section title="Asks you were part of">
          <Rows>
            {partOf.map((intro) => (
              <PartOfRow key={intro.id} intro={intro} />
            ))}
          </Rows>
        </Section>
      ) : null}
    </>
  );
}
