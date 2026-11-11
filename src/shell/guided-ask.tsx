import "server-only";

import { BookUser, Building2, ChevronRight, GraduationCap, Landmark, Search, UserPlus, type LucideIcon } from "lucide-react";
import Link from "next/link";

import { Avatar } from "@/components/ui/avatar";
import { Button } from "@/components/ui/button";
import { ConsentLine, Note } from "@/components/ui/note";
import { Stepper } from "@/components/ui/stepper";
import { Warmth } from "@/components/ui/tag";
import type { RequestContext } from "@/platform/http/request-context";
import { ROUTES } from "@/platform/http/routes";
import { isModuleEnabled } from "@/platform/modules/enablement";
import { toAskDraftHref } from "@/platform/modules/manifest";
import { INTRO_LIFETIME_DAYS } from "@/modules/intros/contract";
import { readOpenAsks } from "@/modules/intros/reads-open-asks";
import { networkManifest } from "@/modules/network/manifest";
import { SEARCH_WHERE, type NetworkSearchResult } from "@/modules/network/contract";
import { searchMemberNetwork } from "@/modules/network/service";

// The guided ask (Founderhall's /ask): what you need, who, the best way in, then the note. Each step is an address, so
// the back button and "Change" work without a script.

export const NEEDS = {
  customer: { label: "A customer", sub: "Someone who could buy from you", icon: Building2, ask: "a customer", examples: ["Head of procurement at a US hospital", "Halcyon Health", "a VP Finance at a mid-size bank"] },
  hire: { label: "A hire", sub: "Someone to join your team", icon: UserPlus, ask: "a hire", examples: ["a VP Sales who has sold to finance teams", "a plant manager in cement", "a former CFO"] },
  investor: { label: "An investor", sub: "A fund or angel for your next round", icon: Landmark, ask: "an investor", examples: ["seed investors in climate", "Greenline Climate Fund", "a fintech angel in London"] },
  expert: { label: "An expert", sub: "Someone who has solved this before", icon: GraduationCap, ask: "an expert", examples: ["a former CFO", "someone who has sold to the NHS", "an EU lending licence expert"] },
} as const satisfies Record<string, { label: string; sub: string; icon: LucideIcon; ask: string; examples: readonly string[] }>;

export type NeedKey = keyof typeof NEEDS;

export function readNeed(value: string | undefined): NeedKey | null {
  return value && value in NEEDS ? (value as NeedKey) : null;
}

export const GUIDED_STEPS = { need: 1, who: 2, path: 3, note: 4 } as const;
export type GuidedStep = keyof typeof GUIDED_STEPS;

export function toGuidedHref(params: Record<string, string | null | undefined>) {
  const entries = Object.entries(params).filter((entry): entry is [string, string] => typeof entry[1] === "string" && entry[1] !== "");
  return entries.length ? `${ROUTES.guidedAsk}?${new URLSearchParams(entries).toString()}` : ROUTES.guidedAsk;
}

export function StepDots({ step }: { step: GuidedStep }) {
  return (
    <div className="fh-steps-dots" aria-hidden="true">
      {[1, 2, 3, 4].map((position) => (
        <i key={position} className={position <= GUIDED_STEPS[step] ? "fh-on" : undefined} />
      ))}
    </div>
  );
}

export function GuidedSummary({ rows }: { rows: { label: string; value: string; change: string }[] }) {
  if (rows.length === 0) return null;
  return (
    <ol className="fh-gsteps">
      {rows.map(({ label, value, change }) => (
        <li key={label}>
          <span className="fh-k">{label}</span>
          <span className="fh-v">{value}</span>
          <Link href={change}>Change</Link>
        </li>
      ))}
    </ol>
  );
}

export function GuidedRail({ step, communityName }: { step: GuidedStep; communityName: string }) {
  return (
    <section className="fh-sheet">
      <h2 className="fh-h3">How an intro works</h2>
      <Stepper
        className="mt-3.5"
        steps={[
          { key: "ask", state: step === "note" ? "now" : "todo", title: "You ask a member", detail: "With a short note they can forward. It uses one of your asks this week." },
          { key: "connector", state: "todo", title: "They decide", detail: `By email or here. ${INTRO_LIFETIME_DAYS} days, then it closes and the ask comes back.` },
          { key: "person", state: "todo", title: "The person decides", detail: `One email from ${communityName}, one reminder.` },
          { key: "introduced", state: "todo", title: "Introduced by email", detail: "Only when both said yes." },
        ]}
      />
    </section>
  );
}

export function NeedStep() {
  return (
    <>
      <h1 className="fh-h1">What do you need?</h1>
      <div className="fh-needs">
        {Object.entries(NEEDS).map(([key, need]) => {
          const Icon = need.icon;
          return (
            <Link key={key} className="fh-needcard" href={toGuidedHref({ need: key })}>
              <span className="fh-ic">
                <Icon aria-hidden="true" className="fh-i" strokeWidth={1.5} />
              </span>
              <span>
                <b>{need.label}</b>
                <span>{need.sub}</span>
              </span>
              <ChevronRight aria-hidden="true" className="fh-i fh-s" strokeWidth={1.5} />
            </Link>
          );
        })}
      </div>
      <div style={{ marginTop: 12 }}>
        <ConsentLine>Nobody is introduced without saying yes. The member you go through decides first, then the person you want to meet.</ConsentLine>
      </div>
      <p className="fh-btn-row" style={{ marginTop: 18 }}>
        <Link href={ROUTES.network}>
          <Search aria-hidden="true" className="fh-i fh-xs" strokeWidth={1.5} />
          Search everyone
        </Link>
        <Link href={ROUTES.members}>
          <BookUser aria-hidden="true" className="fh-i fh-xs" strokeWidth={1.5} />
          Browse the directory
        </Link>
      </p>
    </>
  );
}

export function WhoStep({ need, who, company }: { need: NeedKey; who: string; company: string }) {
  const found = NEEDS[need];
  return (
    <>
      <h1 className="fh-h1">Who or what company?</h1>
      <p className="fh-lede">{found.sub}. A name, a role or a company.</p>
      <form method="get" action={ROUTES.guidedAsk} className="fh-section">
        <input type="hidden" name="need" value={need} />
        <label className="fh-label" htmlFor="g-who">
          Who are you trying to reach?
        </label>
        <input className="fh-input" id="g-who" name="who" maxLength={160} required defaultValue={who} placeholder={`e.g. ${found.examples[0]}`} />
        <div className="fh-field">
          <label className="fh-label fh-small" htmlFor="g-company">
            Company <span className="fh-muted">(optional)</span>
          </label>
          <input className="fh-input" id="g-company" name="company" maxLength={120} defaultValue={company} placeholder="e.g. Halcyon Health" />
        </div>
        <div className="fh-btn-row" style={{ marginTop: 14 }}>
          <Button type="submit">Find the best way in</Button>
        </div>
      </form>
      <div className="fh-examples">
        {found.examples.map((example) => (
          <Link key={example} className="fh-chip" href={toGuidedHref({ need, who: example })}>
            {example}
          </Link>
        ))}
      </div>
    </>
  );
}

type PathStepFacts = { context: RequestContext; need: NeedKey; who: string; company: string; viewer: { id: string; name: string; imageUrl: string | null }; communityName: string };

type SearchPerson = NetworkSearchResult["people"][number];

function readTitleAt(person: SearchPerson) {
  return [person.title, person.company].filter(Boolean).join(" at ");
}

function KnownBox({ known }: { known: SearchPerson[] }) {
  if (known.length === 0) return null;
  return (
    <section className="fh-sheet fh-known" style={{ marginTop: 16 }}>
      {known.slice(0, 3).map((person) => {
        const first = person.fullName.split(" ")[0] ?? person.fullName;
        const line = [person.fullName, readTitleAt(person)].filter(Boolean).join(", ");
        return (
          <div key={person.linkedinSlug ?? person.fullName} className="fh-person" style={{ marginTop: 6 }}>
            <Avatar stableId={person.linkedinSlug ?? person.fullName} name={person.fullName} imageUrl={person.imageUrl} sizePx={28} isOutside />
            <div>
              <b>You already know {first}: reach out yourself</b>
              <span>
                {line}
                {person.direct?.how ? ` · ${person.direct.how}` : null}
              </span>
            </div>
          </div>
        );
      })}
      <p className="fh-small fh-muted" style={{ marginTop: 10 }}>
        No intro needed, and no ask used.
      </p>
    </section>
  );
}

function NoPath({ need, who, company }: { need: NeedKey; who: string; company: string }) {
  const body = `Looking for ${NEEDS[need].ask}: ${[who, company].filter(Boolean).join(" at ")}`;
  return (
    <div className="fh-nopath">
      <div className="fh-sheet">
        <h2 className="fh-h3">Post it as an ask</h2>
        <p className="fh-small" style={{ marginTop: 6 }}>
          “{body}” goes to Asks &amp; updates and into the weekly digest, so members who know someone can say so.
        </p>
        <div className="fh-btn-row" style={{ marginTop: 12 }}>
          <Button asChild size="sm">
            <Link href={toAskDraftHref(body)}>Post it as an ask</Link>
          </Button>
        </div>
      </div>
    </div>
  );
}

const WARMTH_ORDER = ["close", "knows", "met"];

// "Marcus can introduce you to Rosa Lindqvist": the warmest way in through a member who shares, after the people the
// asker already knows. One search (the same lookups as Search, saved for 10 minutes).
export async function PathStep({ context, need, who, company, viewer, communityName }: PathStepFacts) {
  const query = [who, company].filter(Boolean).join(" at ");
  const isNetworkOn = await isModuleEnabled(context.database, networkManifest);
  let result: NetworkSearchResult | null = null;
  let error: string | null = null;
  if (isNetworkOn) {
    try {
      result = await searchMemberNetwork(context, query, SEARCH_WHERE.network, readOpenAsks);
    } catch (caught) {
      error = caught instanceof Error ? caught.message : "The network search didn’t answer. Try again in a minute.";
    }
  }
  if (error) {
    return (
      <>
        <h1 className="fh-h1">Finding the best way in</h1>
        <Note kind="needs" className="mt-3.5">
          {error}
        </Note>
        <NoPath need={need} who={who} company={company} />
      </>
    );
  }
  const people = result?.people ?? [];
  const known = people.filter(({ direct }) => direct !== null);
  const options = people
    .filter(({ direct, isMember }) => direct === null && !isMember)
    .flatMap((person) => person.paths.map((path) => ({ person, path })))
    .toSorted((first, second) => rank(first.path.warmth) - rank(second.path.warmth));
  const best = options[0];
  if (!best) {
    if (known.length > 0) {
      const first = known[0]?.fullName.split(" ")[0] ?? "";
      return (
        <>
          <h1 className="fh-h1">You already know {first}: reach out yourself</h1>
          <KnownBox known={known} />
          <p className="fh-small" style={{ marginTop: 16 }}>
            <Link href={ROUTES.members}>Browse the directory</Link> · <Link href={toGuidedHref({ need, edit: "1" })}>Ask for someone else</Link>
          </p>
        </>
      );
    }
    return (
      <>
        <h1 className="fh-h1">Nobody in {communityName} knows them yet</h1>
        <p className="fh-lede">
          {result === null
            ? `${communityName} hasn’t switched on network search, so there are no warm paths to search.`
            : `No member who shares their network has a path to ${query}.`}{" "}
          Two ways on, and neither uses an intro ask:
        </p>
        <NoPath need={need} who={who} company={company} />
      </>
    );
  }
  const { person, path } = best;
  const connectorFirst = path.name.split(" ")[0] ?? path.name;
  const personFirst = person.fullName.split(" ")[0] ?? person.fullName;
  const title = readTitleAt(person);
  const toNote = (option: { person: SearchPerson; path: typeof path }) =>
    toGuidedHref({ need, who, company, via: option.path.memberId, target: option.person.linkedinSlug, person: option.person.fullName, title: option.person.title, pcompany: option.person.company ?? company });
  const others = options.slice(1, 6);
  return (
    <>
      <KnownBox known={known} />
      <h1 className="fh-h1" style={known.length ? { marginTop: 18 } : undefined}>
        {connectorFirst} can introduce you to {person.fullName}
      </h1>
      <section className="fh-sheet fh-reco" style={{ marginTop: 16 }}>
        <div className="fh-path" aria-hidden="true">
          <Avatar stableId={viewer.id} name={viewer.name} imageUrl={viewer.imageUrl} sizePx={28} className="fh-avatar" />
          <span className="fh-seg-line" />
          <Avatar stableId={path.memberId} name={path.name} imageUrl={path.imageUrl} sizePx={28} className="fh-avatar" />
          <span className={path.warmth?.toLowerCase() === "met" ? "fh-seg-line fh-dash" : "fh-seg-line"} />
          <Avatar stableId={person.linkedinSlug ?? person.fullName} name={person.fullName} imageUrl={person.imageUrl} sizePx={28} isOutside className="fh-avatar" />
        </div>
        <div className="fh-pathnames fh-small">
          <span>You</span>
          <span>{connectorFirst}</span>
          <span>
            <b>{person.fullName}</b>
            {title ? (
              <>
                <br />
                {title}
              </>
            ) : null}
          </span>
        </div>
        <p className="fh-pathtext" style={{ marginTop: 12 }}>
          <b>Why {connectorFirst}:</b> {connectorFirst} knows {personFirst}
          {path.warmth ? (
            <>
              {" "}
              <Warmth isMet={path.warmth.toLowerCase() === "met"}>{path.warmth}</Warmth>
            </>
          ) : null}
        </p>
        <p className="fh-small fh-muted" style={{ marginTop: 6 }}>
          {path.name}
          {path.about ? `, ${path.about}` : ""}. {personFirst} hears nothing unless {connectorFirst} says yes.
        </p>
        <div className="fh-btn-row" style={{ marginTop: 14 }}>
          <Button asChild>
            <Link href={toNote(best)}>Write the note</Link>
          </Button>
        </div>
      </section>
      {others.length > 0 ? (
        <details className="fh-others" style={{ marginTop: 14 }}>
          <summary>
            See {others.length} other path{others.length === 1 ? "" : "s"}
          </summary>
          {others.map((option) => (
            <div key={`${option.path.memberId}-${option.person.linkedinSlug}`} className="fh-person" style={{ marginTop: 8 }}>
              <Avatar stableId={option.path.memberId} name={option.path.name} imageUrl={option.path.imageUrl} sizePx={28} />
              <div>
                <b>
                  {option.path.name} → {option.person.fullName}
                </b>
                <span>{option.path.warmth ?? "Knows them"}</span>
              </div>
              <Button asChild variant="secondary" size="sm" className="ml-auto">
                <Link href={toNote(option)}>Ask {option.path.name.split(" ")[0]} instead</Link>
              </Button>
            </div>
          ))}
        </details>
      ) : null}
      <p className="fh-small" style={{ marginTop: 16 }}>
        <Link href={ROUTES.members}>Browse the directory instead</Link>
      </p>
    </>
  );
}

function rank(warmth: string | null) {
  const position = WARMTH_ORDER.indexOf((warmth ?? "").toLowerCase());
  return position === -1 ? WARMTH_ORDER.length : position;
}
