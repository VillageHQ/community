"use client";

import { useQueryClient, useSuspenseQuery } from "@tanstack/react-query";
import { CircleCheck } from "lucide-react";
import Link from "next/link";
import { Fragment, useEffect } from "react";

import { CompanyLogo } from "@/components/company-name";
import { Avatar } from "@/components/ui/avatar";
import { Button } from "@/components/ui/button";
import { Pill } from "@/components/ui/pill";
import { Warmth } from "@/components/ui/tag";
import { ROUTES } from "@/platform/http/routes";
import { toAskDraftHref } from "@/platform/modules/manifest";
import { SEARCH_WHERE, type NetworkSearchResult, type SearchMember, type SearchPath, type SearchWhere } from "@/modules/network/contract";
import { activeSearchQuery, networkSearchQuery } from "@/modules/network/queries";
import { readFirstWord, readPeopleCountLine, toPossessive, toReachPhrase } from "@/modules/network/rules-search-words";

import type { SearchScreenProps } from "./search-screen";

export type SearchViewer = { id: string; name: string; imageUrl: string | null };
type SearchPerson = NetworkSearchResult["people"][number];

const MORE_PATHS_FROM = 2;

function toAskHref({ person, path, query, scope }: { person: SearchPerson; path: SearchPath; query: string; scope: SearchWhere }) {
  const back = `${ROUTES.network}?${new URLSearchParams({ q: query, scope }).toString()}`;
  return `${ROUTES.searchAsk}?${new URLSearchParams({ target: person.linkedinSlug ?? "", via: path.memberId, back }).toString()}`;
}

function WarmthWord({ warmth }: { warmth: string | null }) {
  if (!warmth) return null;
  return (
    <>
      {" "}
      <Warmth isMet={warmth.toLowerCase() === "met"}>{warmth}</Warmth>
    </>
  );
}

function WorkLine({ title, company, city, logoUrl }: { title: string | null; company: string | null; city: string | null; logoUrl: string | null }) {
  const work = [title, company].filter(Boolean).join(", ");
  return (
    <p>
      <CompanyLogo url={logoUrl} className="fh-colog" />
      {work}
      {city ? ` · ${city}` : null}
    </p>
  );
}

function MemberRow({ member, communityName }: { member: SearchMember; communityName: string }) {
  const href = `${ROUTES.members}/${member.id}`;
  return (
    <article className="fh-result">
      <div className="fh-top">
        <Avatar stableId={member.id} name={member.name} imageUrl={member.avatarUrl} />
        <div className="fh-who">
          <Link href={href}>
            <span className="fh-name">{member.name}</span>
          </Link>
          <WorkLine title={member.title} company={member.company} city={member.city} logoUrl={member.companyLogoUrl} />
        </div>
        <Pill tone="plain">Member</Pill>
      </div>
      <p className="fh-pathtext" style={{ marginTop: 10 }}>
        Already in {communityName}. <Link href={href}>See {toPossessive(readFirstWord(member.name))} profile</Link>
      </p>
    </article>
  );
}

function PathPicture({ viewer, path, person }: { viewer: SearchViewer; path: SearchPath; person: SearchPerson }) {
  const isMet = path.warmth?.toLowerCase() === "met";
  return (
    <div className="fh-path" aria-hidden="true">
      <Avatar stableId={viewer.id} name={viewer.name} imageUrl={viewer.imageUrl} sizePx={28} className="fh-avatar" />
      <span className="fh-seg-line" />
      <Avatar stableId={path.memberId} name={path.name} imageUrl={path.imageUrl} sizePx={28} className="fh-avatar" />
      <span className={isMet ? "fh-seg-line fh-dash" : "fh-seg-line"} />
      <Avatar stableId={person.linkedinSlug ?? person.fullName} name={person.fullName} imageUrl={person.imageUrl} sizePx={28} isOutside className="fh-avatar" />
    </div>
  );
}

function PathRow({ viewer, person, path, more }: { viewer: SearchViewer; person: SearchPerson; path: SearchPath; more: number }) {
  return (
    <>
      <PathPicture viewer={viewer} path={path} person={person} />
      <p className="fh-pathtext">
        via <b>{path.name}</b>
        {path.about ? ` (${path.about})` : null}
        <WarmthWord warmth={path.warmth} />
        {more > 0 ? ` · +${more} more path${more > 1 ? "s" : ""}` : null}
      </p>
    </>
  );
}

type PersonRowProps = { person: SearchPerson; viewer: SearchViewer; communityName: string; canAskIntro: boolean; query: string; scope: SearchWhere };

function PersonRow({ person, viewer, communityName, canAskIntro, query, scope }: PersonRowProps) {
  const first = readFirstWord(person.fullName);
  const top = (
    <div className="fh-top">
      <Avatar stableId={person.linkedinSlug ?? person.fullName} name={person.fullName} imageUrl={person.imageUrl} isOutside />
      <div className="fh-who">
        <span className="fh-name">{person.fullName}</span>
        <WorkLine title={person.title ?? person.headline} company={person.company} city={person.city} logoUrl={person.companyLogoUrl} />
      </div>
    </div>
  );
  if (person.direct) {
    return (
      <article className="fh-result fh-known">
        {top}
        <p className="fh-pathtext" style={{ marginTop: 10 }}>
          <CircleCheck aria-hidden="true" className="fh-i fh-xs" strokeWidth={1.5} /> <b>You already know {first}: reach out yourself</b>
          {person.direct.how ? ` · ${person.direct.how}` : null}
          <WarmthWord warmth={person.direct.warmth} />
        </p>
        <p className="fh-small fh-muted" style={{ marginTop: 4 }}>
          No intro needed, and no ask used.
        </p>
      </article>
    );
  }
  const [best, second] = person.paths;
  if (!best) {
    return (
      <article className="fh-result">
        {top}
        <p className="fh-pathtext fh-muted" style={{ marginTop: 10 }}>
          Nobody in {communityName} who shares their network knows {first} yet.
        </p>
      </article>
    );
  }
  const extra = person.paths.length - MORE_PATHS_FROM;
  return (
    <article className="fh-result">
      {top}
      <PathRow viewer={viewer} person={person} path={best} more={second ? 0 : extra} />
      {second ? <PathRow viewer={viewer} person={person} path={second} more={extra} /> : null}
      {canAskIntro && person.linkedinSlug ? (
        <div className="fh-btn-row">
          <Button asChild size="sm">
            <Link href={toAskHref({ person, path: best, query, scope })}>Ask {readFirstWord(best.name)} for an intro</Link>
          </Button>
        </div>
      ) : null}
    </article>
  );
}

function NoPathCard({ query, scope, canAskCommunity, communityName, digestDay, isProfilesOnly }: { query: string; scope: SearchWhere; canAskCommunity: boolean; communityName: string; digestDay: string; isProfilesOnly: boolean }) {
  const everywhereHref = `${ROUTES.network}?${new URLSearchParams({ q: query, scope: SEARCH_WHERE.global }).toString()}`;
  return (
    <div className="fh-empty fh-nopath" style={{ marginTop: 16 }} role="status">
      <h2 className="fh-h2">
        Nobody in {communityName} knows {toReachPhrase(query)} yet
      </h2>
      {canAskCommunity ? (
        <>
          <p>Ask the whole community: the members most likely to help get it in {digestDay}’s digest, and anyone can reply “I can help”.</p>
          <div className="fh-btn-row" style={{ marginTop: 16 }}>
            <Button asChild>
              <Link href={toAskDraftHref(query)}>Ask the community</Link>
            </Button>
          </div>
        </>
      ) : null}
      {!isProfilesOnly && scope !== SEARCH_WHERE.global ? (
        <p style={{ marginTop: 10 }}>
          <Button asChild variant="quiet">
            <Link href={everywhereHref}>Search everywhere</Link>
          </Button>
        </p>
      ) : null}
    </div>
  );
}

function useMarkSearchSeen() {
  const queryClient = useQueryClient();
  useEffect(() => {
    queryClient.setQueryData(activeSearchQuery.queryKey, (active) => (active ? { ...active, wasSeen: true } : active));
  }, [queryClient]);
}

export function SearchResults({ query, scope, viewer, communityName, canAskIntro, canAskCommunity, digestDay }: SearchScreenProps & { query: string; scope: SearchWhere }) {
  const { data: result } = useSuspenseQuery(networkSearchQuery(query, scope));
  useMarkSearchSeen();
  const memberIds = new Set(result.members.map(({ id }) => id));
  const people = result.people.filter(({ isMember, memberId }) => !isMember || (memberId !== null && !memberIds.has(memberId)));
  const outside = people.filter(({ isMember }) => !isMember);
  const total = result.members.length + outside.length;
  if (total === 0) {
    return <NoPathCard query={query} scope={scope} canAskCommunity={canAskCommunity} communityName={communityName} digestDay={digestDay} isProfilesOnly={result.isProfilesOnly} />;
  }
  return (
    <>
      <p className="fh-small fh-muted" role="status" style={{ margin: "18px 0 6px" }}>
        {readPeopleCountLine({ count: total, communityName, isEverywhere: scope === SEARCH_WHERE.global, isProfilesOnly: result.isProfilesOnly, isCached: result.isCached })}
      </p>
      <div>
        {result.members.map((member) => (
          <MemberRow key={member.id} member={member} communityName={communityName} />
        ))}
        {outside.map((person, position) => (
          <Fragment key={person.linkedinSlug ?? `${person.fullName}-${position}`}>
            <PersonRow person={person} viewer={viewer} communityName={communityName} canAskIntro={canAskIntro} query={query} scope={scope} />
          </Fragment>
        ))}
      </div>
    </>
  );
}
