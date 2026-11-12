import { ArrowLeftRight, Building2, ChevronRight, Gift, Hand, Plus, RefreshCw } from "lucide-react";
import Link from "next/link";
import type { ReactNode } from "react";

import { EmptyState } from "@/components/empty-state";
import { FlashNote } from "@/components/flash";
import { PageHeader, SectionHead } from "@/components/page-header";
import { Avatar } from "@/components/ui/avatar";
import { SheetHead } from "@/components/ui/card";
import { Pill } from "@/components/ui/pill";
import { AllowancePips } from "@/components/ui/search-box";
import { ASKS_PAGE, describeAgo, describeAllowance, describeAnswerCount, describeCanHelp, toAskPage, type AskAllowance } from "@/modules/asks/contract";
import { TargetLine } from "@/modules/asks/components/post-parts";
import { INTRO_STATES, type Intro } from "@/modules/intros/contract";
import { JOB_BOARD_PAGES } from "@/modules/job-board/contract";
import { NewThisWeekCard } from "@/modules/members/components/new-this-week-card";
import { PERKS_PAGE } from "@/modules/perks/contract";
import { ROUTES } from "@/platform/http/routes";

import { NextStepCard } from "./next-step-card";
import type { NextStep } from "./next-steps";
import { FactButtons, NotThisWeekButton } from "./today-actions";
import type { TodayItems } from "./today";

export const TODAY_END_LINE = "That’s everything this week.";
// Founderhall's "Ask for an intro" opens its guided ask (/ask), which another build area adds. Until then it opens the
// network search, or the composer when search is off, so the main button never leads nowhere.
export const GUIDED_ASK_PAGE = "/ask";
const COMPOSE_PAGE = `${ASKS_PAGE}#compose`;
const ICON = { "aria-hidden": true, className: "fh-i fh-xs", strokeWidth: 1.5 } as const;
const SMALL_ICON = { "aria-hidden": true, className: "fh-i fh-s", strokeWidth: 1.5 } as const;

function firstWord(name: string) {
  return name.trim().split(/\s+/)[0] ?? name;
}

// "Sam’s", "James’" (Founderhall's poss()).
export function possessive(name: string) {
  return name.endsWith("s") ? `${name}’` : `${name}’s`;
}

function plural(count: number, one: string, many: string) {
  return count === 1 ? one : many;
}

// "CFO at Brightside Clinics" → "CFO, Brightside Clinics", as Founderhall writes a person's role.
function describeTargetAbout(headline: string | null) {
  return headline ? headline.replace(" at ", ", ") : "";
}

function describeIntroLine(intro: Intro) {
  const about = describeTargetAbout(intro.target.headline);
  if (intro.state === INTRO_STATES.requested) return `${intro.requester.name} asks you to introduce them to ${intro.target.name}${about ? ` (${about})` : ""}.`;
  return `${intro.target.name} said yes. Introduce ${firstWord(intro.requester.name)} to ${firstWord(intro.target.name)}.`;
}

type TodayPageProps = {
  today: TodayItems;
  memberName: string;
  communityName: string;
  digestDay: string;
  dateLabel: string;
  allowance: AskAllowance | null;
  perksCommunityName: string | null;
  openJobCount: number | null;
  nextSteps: readonly NextStep[];
  lookupQuestion: ReactNode;
  flash: string | null;
  now: Date;
  // Where "Ask for an intro" goes today (see GUIDED_ASK_PAGE).
  askIntroHref: string;
};

// Founderhall's Today (todayPage): what needs you in the main column (asks on your paths, intros waiting for your
// yes, lines to check), your own asks and the community's boards in the right rail.
export function TodayPage({ today, memberName, communityName, digestDay, dateLabel, allowance, perksCommunityName, openJobCount, nextSteps, lookupQuestion, flash, now, askIntroHref }: TodayPageProps) {
  const first = firstWord(memberName);
  const help = today.helpableAsks;
  const intros = [...today.introsToAnswer, ...today.introsToFinish];
  const facts = today.profileLines;
  const lead = help.length
    ? `You could help with ${help.length === 1 ? "this one" : `these ${help.length}`}`
    : intros.length
      ? `${first}, ${intros.length === 1 ? "one intro is" : `${intros.length} intros are`} waiting for your yes`
      : facts.length
        ? `${first}, is this right?`
        : "That’s everything this week";
  const plus = [
    help.length && intros.length ? `${intros.length === 1 ? "one intro" : `${intros.length} intros`} waiting for your yes` : null,
    (help.length || intros.length) && facts.length ? `${facts.length === 1 ? "one line" : `${facts.length} lines`} on your profile` : null,
  ].filter(Boolean);
  const isNothing = !help.length && !intros.length && !facts.length;
  const digest = possessive(digestDay);
  const mineCount = today.ownPosts.length + today.introsInMotion.length;

  return (
    <>
      {flash ? <FlashNote>{flash}</FlashNote> : null}
      <PageHeader
        eyebrow={`${dateLabel} · ${possessive(first)} week at ${communityName}`}
        title={lead}
        description={
          isNothing
            ? `Nothing needs you right now. New asks you could help with land here and in ${digest} digest.`
            : `${plus.length ? `Plus ${plus.join(" and ")}. ` : ""}Each item also works by replying to ${digest} email.`
        }
        action={
          <>
            <Link className="fh-btn fh-btn-ink fh-btn-sm" href={askIntroHref}>
              <ArrowLeftRight {...ICON} />
              Ask for an intro
            </Link>
            <Link className="fh-btn fh-btn-secondary fh-btn-sm" href={COMPOSE_PAGE}>
              <Plus {...ICON} />
              Post an ask
            </Link>
          </>
        }
      />
      <div className="fh-today">
        <div>
          {lookupQuestion}
          {help.length ? (
            <section className="fh-tsec">
              <SectionHead title={`${help.length} ${plural(help.length, "ask", "asks")} on your paths`} link={<Link href={ASKS_PAGE}>All asks</Link>} />
              {help.map((ask) => (
                <article key={ask.id} className="fh-titem" id={`ask-${ask.id}`}>
                  <div className="fh-ph">
                    <Avatar stableId={ask.author.id} name={ask.author.name} imageUrl={ask.author.avatarUrl} sizePx={28} />
                    <div>
                      <b>{ask.author.name}</b>
                      <span>{describeAgo(ask.createdAt, now)}</span>
                    </div>
                  </div>
                  <p className="fh-body">{ask.title}</p>
                  {ask.who ? <TargetLine who={ask.who} /> : null}
                  <p className="fh-why">
                    <b>Why you:</b> {ask.whyYou}
                  </p>
                  <div className="fh-btn-row">
                    <Link className="fh-btn fh-btn-primary" href={`${toAskPage(ask.id)}#help`}>
                      <Hand {...ICON} />I can help
                    </Link>
                    <NotThisWeekButton askId={ask.id} />
                  </div>
                </article>
              ))}
            </section>
          ) : null}
          {intros.length ? (
            <section className="fh-tsec">
              <SectionHead title="Waiting for your yes" link={<Link href={ROUTES.intros}>Your intros</Link>} />
              {intros.map((intro) => (
                <article key={intro.id} className="fh-titem">
                  <div className="fh-ph">
                    <Avatar stableId={intro.requester.id} name={intro.requester.name} imageUrl={intro.requester.avatarUrl} sizePx={28} />
                    <div>
                      <b>{describeIntroLine(intro)}</b>
                      <span>{`Asked ${describeAgo(intro.createdAt, now)}. ${firstWord(intro.target.name)} hears nothing unless you say yes.`}</span>
                    </div>
                  </div>
                  {intro.note ? <div className="fh-quote fh-notetext">{intro.note}</div> : null}
                  <div className="fh-btn-row">
                    <Link className="fh-btn fh-btn-primary" href={`${ROUTES.intros}/${intro.id}`}>
                      Answer
                    </Link>
                  </div>
                </article>
              ))}
            </section>
          ) : null}
          {facts.length ? (
            <section className="fh-tsec">
              <SectionHead title="Is this right?" link={<Link href={`${ROUTES.editCard}#village-lines`}>My profile</Link>} />
              <p className="fh-small fh-muted" style={{ margin: "-4px 0 10px" }}>
                We filled this in from public sources. Change anything; you decide what shows.
              </p>
              {facts.map((fact) => (
                <article key={fact.field} className="fh-titem fh-fact" id={`fact-${fact.field}`}>
                  <p className="fh-small fh-muted">
                    <RefreshCw {...ICON} className="fh-i fh-xs inline-block align-[-2px]" /> Filled in from public profiles · refreshed {new Date(fact.filledAt).toLocaleDateString("en-GB", { day: "numeric", month: "short" })}
                  </p>
                  <p className="fh-factline">
                    <b>{fact.label}</b> {fact.value}
                  </p>
                  <FactButtons field={fact.field} label={fact.label} value={fact.value} />
                </article>
              ))}
            </section>
          ) : null}
          {isNothing ? (
            <EmptyState title="That’s everything this week" description="Nothing to answer. When a member asks for someone you know, it shows here first.">
              <Link className="fh-btn fh-btn-secondary fh-btn-sm" href={ASKS_PAGE}>
                Browse the open asks
              </Link>
            </EmptyState>
          ) : null}
          {nextSteps.map((nextStep) => (
            <NextStepCard key={nextStep.title} nextStep={nextStep} />
          ))}
        </div>
        <aside>
          <section className="fh-sheet">
            <SheetHead title="Your asks in motion" link={<Link href={`${ASKS_PAGE}?tab=yours`}>Yours</Link>} />
            {allowance ? (
              <div className="fh-allow">
                <AllowancePips left={allowance.left} total={allowance.cap} label={describeAllowance(allowance)} />
                <span className="fh-small fh-muted">Asks you post and intro asks share it. Declined, expired and withdrawn intro asks come back.</span>
              </div>
            ) : null}
            {mineCount ? (
              <div className="fh-rows">
                {today.ownPosts.map((post) => (
                  <Link key={post.id} className="fh-r" href={toAskPage(post.id)}>
                    <Hand {...SMALL_ICON} />
                    <div className="fh-who">
                      <b className="fh-plain">{post.body}</b>
                      <span>{`${post.helperCount ? describeCanHelp(post.helperCount) : "No paths found yet"} · ${describeAnswerCount(post.answerCount)} · ${describeAgo(post.createdAt, now)}`}</span>
                    </div>
                    <div className="fh-end">
                      <Pill tone="open">Open</Pill>
                    </div>
                  </Link>
                ))}
                {today.introsInMotion.map((intro) => (
                  <Link key={intro.id} className="fh-r" href={`${ROUTES.intros}/${intro.id}`}>
                    <ArrowLeftRight {...SMALL_ICON} />
                    <div className="fh-who">
                      <b className="fh-plain">{`Intro to ${intro.target.name} via ${firstWord(intro.introducer.name)}`}</b>
                      <span>{`asked ${describeAgo(intro.createdAt, now)}`}</span>
                    </div>
                    <div className="fh-end">
                      <Pill tone="open">{intro.state === INTRO_STATES.requested ? `With ${firstWord(intro.introducer.name)}` : `With ${firstWord(intro.target.name)}`}</Pill>
                    </div>
                  </Link>
                ))}
              </div>
            ) : (
              <p className="fh-small fh-muted">
                Nothing in motion. <Link href={askIntroHref}>Ask for an intro</Link> or <Link href={COMPOSE_PAGE}>post an ask</Link>.
              </p>
            )}
          </section>
          {perksCommunityName ? (
            // A full page load, so /perks's own Content-Security-Policy header applies.
            <a className="fh-sheet fh-perks-card" href={PERKS_PAGE} style={{ marginTop: 14 }}>
              <Gift {...SMALL_ICON} />
              <span>
                <b>Perks</b>
                <span className="fh-small fh-muted">Deals for {perksCommunityName} founders</span>
              </span>
              <ChevronRight {...ICON} />
            </a>
          ) : null}
          {openJobCount !== null ? (
            <section className="fh-sheet" style={{ marginTop: 16 }}>
              <SheetHead
                title={
                  <>
                    <Building2 {...SMALL_ICON} className="fh-i fh-s inline-block align-[-3px]" /> Jobs
                  </>
                }
                link={<Link href={JOB_BOARD_PAGES.board}>The board</Link>}
              />
              <p className="fh-small">
                {openJobCount ? `${openJobCount} ${plural(openJobCount, "open job", "open jobs")} at ${communityName} companies.` : "No open jobs yet."} Hiring?{" "}
                <Link href={JOB_BOARD_PAGES.ours}>Add yours</Link>.
              </p>
            </section>
          ) : null}
          {today.newMembers.length > 0 ? (
            <div style={{ marginTop: 16 }}>
              <NewThisWeekCard newMembers={today.newMembers} />
            </div>
          ) : null}
          {isNothing ? null : (
            <p className="fh-small fh-muted" style={{ marginTop: 14 }}>
              {TODAY_END_LINE}
            </p>
          )}
        </aside>
      </div>
    </>
  );
}
