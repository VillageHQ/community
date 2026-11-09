"use client";

import { useSuspenseQuery } from "@tanstack/react-query";
import { Route, Search } from "lucide-react";
import Link from "next/link";
import { useState } from "react";

import { QueryBoundary } from "@/components/query-boundary";
import { Button } from "@/components/ui/button";
import type { Intro } from "@/modules/intros/contract";
import { networkPathsQuery } from "@/modules/network/queries";
import { readFirstName } from "@/platform/design/avatar-identity";
import { ROUTES } from "@/platform/http/routes";

import { ConnectorAsk } from "./connector-ask";
import { IntroReason } from "./intro-parts";

function FindSomeoneElse({ targetFirst }: { targetFirst: string }) {
  return (
    <div className="grid justify-items-start gap-2">
      <p className="type-note text-foreground-soft">Nobody else here can reach {targetFirst} right now. Someone else you&apos;d like to meet may be one search away.</p>
      <Button asChild variant="outline">
        <Link href={ROUTES.network}>
          <Search aria-hidden="true" />
          Search the network
        </Link>
      </Button>
    </div>
  );
}

function OtherConnectors({ intro }: { intro: Intro }) {
  const { target, introducer, requester } = intro;
  const targetFirst = readFirstName(target.name);
  const { data: paths } = useSuspenseQuery(networkPathsQuery(target.linkedinSlug));
  const others = paths.connectors.filter(({ member }) => member && member.id !== introducer.id);
  if (others.length === 0) return <FindSomeoneElse targetFirst={targetFirst} />;

  const viewer = { id: requester.id, name: requester.name, imageUrl: requester.avatarUrl };
  return (
    <div className="grid gap-3">
      <h2 className="type-h3">Others who can reach {targetFirst}</h2>
      <ul className="grid gap-3">
      {others.map((connector) => (
        <li key={connector.linkedinSlug ?? connector.name} className="grid gap-2.5 rounded-field bg-muted p-4">
          <p className="type-label wrap-anywhere">{connector.name}</p>
          <IntroReason reason={connector.reason} />
          <ConnectorAsk connector={connector} isTop={false} targetSlug={target.linkedinSlug} targetName={target.name} viewer={viewer} />
        </li>
      ))}
      </ul>
    </div>
  );
}

export function OtherPaths({ intro }: { intro: Intro }) {
  const [isLooking, setIsLooking] = useState(false);
  const targetFirst = readFirstName(intro.target.name);
  return (
    <section aria-label={`Other ways to reach ${targetFirst}`} className="grid gap-3">
      {isLooking ? (
        <QueryBoundary loadingMessage={`Looking for other ways to reach ${targetFirst}…`}>
          <OtherConnectors intro={intro} />
        </QueryBoundary>
      ) : (
        <Button type="button" size="lg" variant="soft" className="w-full" onClick={() => setIsLooking(true)}>
          <Route aria-hidden="true" />
          See who else can help
        </Button>
      )}
    </section>
  );
}
