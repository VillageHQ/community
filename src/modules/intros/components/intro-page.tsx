import { Inbox, Pencil, Search } from "lucide-react";
import Link from "next/link";
import type { ReactNode } from "react";

import { BackLink } from "@/components/page-header";
import { Button } from "@/components/ui/button";
import { Pill } from "@/components/ui/pill";
import { Stepper } from "@/components/ui/stepper";
import { ROUTES } from "@/platform/http/routes";
import { formatDayMonth } from "@/platform/text/format-date";

import { INTRO_ROLES, INTRO_STATES, type Intro } from "../contract";
import { ConnectorFollowUp, ReportNote } from "./connector-follow-up";
import { ConnectorAnswer, FlashOnArrival, MessageAsker, OutcomeSheet, WithdrawAsk } from "./intro-page-actions";
import {
  isMade,
  isOpen,
  readIntroLede,
  readIntroTitle,
  readNames,
  readNoteLabel,
  readPrivacyLine,
  readStatusPill,
  readTrackerSteps,
  readWithdrawHint,
} from "./intro-words";

const ICON = { "aria-hidden": true, className: "fh-i fh-xs", strokeWidth: 1.5 } as const;

type IntroPageProps = {
  intro: Intro;
  community: string;
  // The community sends email, so a yes asks the person by email.
  canEmail: boolean;
  // Search is on: "Find another way in" also offers it.
  hasSearch: boolean;
  hasThread: boolean;
  // "Who else can help" after a closed path ask (Community's, while Network is on).
  otherPaths?: ReactNode;
};

function ThreadButton({ introId }: { introId: string }) {
  return (
    <Button asChild variant="secondary" size="sm">
      <Link href={`${ROUTES.intros}/${introId}/thread`}>
        <Inbox {...ICON} />
        Open the intro thread
      </Link>
    </Button>
  );
}

function AskerMain({ intro, community, hasSearch, hasThread, otherPaths }: IntroPageProps) {
  const { targetFirst } = readNames(intro);
  const made = isMade(intro);
  const open = isOpen(intro);
  return (
    <>
      <Stepper steps={readTrackerSteps(intro, community)} />
      {open ? <WithdrawAsk introId={intro.id} hint={readWithdrawHint(intro)} /> : null}
      {made ? (
        <>
          <div className="fh-section fh-btn-row">{hasThread ? <ThreadButton introId={intro.id} /> : null}</div>
          {intro.isOutcomeDue || intro.outcome ? <OutcomeSheet intro={intro} targetFirst={targetFirst} /> : null}
        </>
      ) : null}
      {!open && !made ? (
        <>
          <div className="fh-note fh-section">
            <Search aria-hidden="true" className="fh-i fh-s" strokeWidth={1.5} />
            <span>
              Find another way in: <Link href={ROUTES.members}>the directory</Link>
              {hasSearch ? (
                <>
                  {" "}
                  or <Link href={ROUTES.network}>search</Link>
                </>
              ) : null}
              .
            </span>
          </div>
          {otherPaths}
        </>
      ) : null}
    </>
  );
}

function readAnsweredOn(intro: Intro) {
  const answeredAt = intro.askedTargetAt ?? intro.acceptedAt ?? intro.closedAt;
  return answeredAt ? `You answered on ${formatDayMonth(answeredAt)}.` : null;
}

function ConnectorMain({ intro, community, canEmail, hasThread }: IntroPageProps) {
  if (intro.state === INTRO_STATES.requested) return <ConnectorAnswer intro={intro} community={community} canEmail={canEmail} />;
  const pill = readStatusPill(intro);
  const answeredOn = readAnsweredOn(intro);
  return (
    <>
      <p>
        <Pill tone={pill.tone}>{pill.label}</Pill>
      </p>
      {answeredOn ? <p className="fh-small fh-muted mt-2">{answeredOn}</p> : null}
      <div className="fh-section empty:hidden">
        <ConnectorFollowUp intro={intro} />
      </div>
      {isMade(intro) && hasThread ? (
        <div className="fh-section">
          <ThreadButton introId={intro.id} />
        </div>
      ) : null}
    </>
  );
}

// One intro (Founderhall's introPage()): back link, title and pill, the lede, then two columns: the asker's tracker or
// the connector's answer, and the note.
export function IntroPage(props: IntroPageProps) {
  const { intro, community } = props;
  const pill = readStatusPill(intro);
  const isConnector = intro.viewerRole === INTRO_ROLES.introducer;
  return (
    <>
      <FlashOnArrival />
      <BackLink href={ROUTES.intros}>Your intros</BackLink>
      <div className="fh-pagehead">
        <div className="flex flex-wrap items-start justify-between gap-3">
          <h1 className="fh-h1">{readIntroTitle(intro)}</h1>
          <Pill tone={pill.tone}>{pill.label}</Pill>
        </div>
        <p className="fh-lede">{readIntroLede(intro)}</p>
      </div>
      <div className="fh-flow">
        <div>{isConnector ? <ConnectorMain {...props} /> : <AskerMain {...props} />}</div>
        <section className="fh-sheet">
          <div className="fh-source">
            <Pencil {...ICON} />
            {readNoteLabel(intro)}
          </div>
          <p className="fh-notetext">{intro.note}</p>
          <p className="fh-small fh-muted mt-2.5">{readPrivacyLine(community)}</p>
          {isConnector ? (
            <div className="fh-btn-row mt-2.5">
              <ReportNote intro={intro} />
              <MessageAsker person={intro.requester} />
            </div>
          ) : null}
        </section>
      </div>
    </>
  );
}
