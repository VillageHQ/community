import type { Metadata } from "next";
import { headers } from "next/headers";
import Link from "next/link";

import { PublicPage } from "@/components/public-page";
import { introsManifest } from "@/modules/intros/manifest";
import { ConnectorLinkQuestion, OutcomeLinkQuestion, TargetLinkQuestion } from "@/modules/intros/components/public-intro";
import { CLOSED_REASONS, LINK_VIEWS, readIntroLinkView, type IntroLinkView } from "@/modules/intros/reads-links";
import { readActiveSession } from "@/platform/auth/active-session";
import { readBrandingForPage } from "@/platform/branding/branding";
import { getDatabase } from "@/platform/database/client";
import { readFirstName } from "@/platform/design/avatar-identity";
import { ROUTES } from "@/platform/http/routes";
import { modulePage } from "@/platform/modules/module-page";
import { formatDayMonth } from "@/platform/text/format-date";

export const dynamic = "force-dynamic";

type Props = { params: Promise<{ token: string }>; searchParams: Promise<{ a?: string | string[] }> };

async function readView({ params }: Props) {
  const { token } = await params;
  const requestHeaders = await headers();
  const view = await readIntroLinkView(
    {
      database: getDatabase(),
      environment: process.env,
      headers: requestHeaders,
      readViewerId: async () => (await readActiveSession(requestHeaders))?.user.id ?? null,
    },
    token,
  );
  return { token, view };
}

function readTitle(view: IntroLinkView) {
  if (view.view === LINK_VIEWS.outcome) return "Was it helpful?";
  if (view.view === LINK_VIEWS.connector || view.view === LINK_VIEWS.target) return "An intro ask";
  if (view.view === LINK_VIEWS.tooManyTries) return "Too many tries";
  if (view.view === LINK_VIEWS.notForYou) return "This link is for someone else";
  return "Nothing to do";
}

export async function generateMetadata(props: Props): Promise<Metadata> {
  const { view } = await readView(props);
  return { title: readTitle(view), robots: { index: false, follow: false } };
}

function readClosedText(view: Extract<IntroLinkView, { view: "closed" }>) {
  if (view.reason === CLOSED_REASONS.withdrawn) return `${readFirstName(view.askerName)} withdrew this ask. There’s nothing to do.`;
  if (view.reason === CLOSED_REASONS.expired) return "This ask closed after 7 days with no answer. There’s nothing to do.";
  return "This ask was already answered. Thank you.";
}

// Founderhall's `/i/<token>`: the connector's, the person's or the asker's outcome question, from the email's links.
// A GET only reads; `?a=yes` picks the answer, and the button sends it.
export default modulePage(introsManifest, async function IntroLinkPage(props: Props) {
  const [{ token, view }, community, { a }] = await Promise.all([readView(props), readBrandingForPage(), props.searchParams]);
  const initialChoice = typeof a === "string" ? a : null;
  const card = (() => {
    switch (view.view) {
      case LINK_VIEWS.connector:
        return <ConnectorLinkQuestion token={token} community={community.name} facts={view} initialChoice={initialChoice} />;
      case LINK_VIEWS.target:
        return <TargetLinkQuestion token={token} community={community.name} facts={view} initialChoice={initialChoice} optOutHref={`${ROUTES.introOptOut}/${token}`} />;
      case LINK_VIEWS.outcome:
        return (
          <OutcomeLinkQuestion
            token={token}
            facts={{ connectorName: view.connectorName, targetName: view.targetName, introducedOn: view.introducedAt ? formatDayMonth(view.introducedAt) : "" }}
            initialChoice={initialChoice}
          />
        );
      case LINK_VIEWS.tooManyTries:
        return (
          <>
            <h1 className="fh-h2">Too many tries</h1>
            <p className="fh-lede">Wait a minute and try this link again.</p>
          </>
        );
      case LINK_VIEWS.notForYou:
        return (
          <>
            <h1 className="fh-h2">This link is for {readFirstName(view.targetName)}</h1>
            <p className="fh-lede">
              We didn’t change anything. Send it to {readFirstName(view.targetName)} and they can answer in a few seconds. <Link href={ROUTES.intros}>Your intros</Link>.
            </p>
          </>
        );
      case LINK_VIEWS.closed:
        return (
          <>
            <h1 className="fh-h2">Nothing to do</h1>
            <p className="fh-lede">{readClosedText(view)}</p>
          </>
        );
    }
  })();
  return <PublicPage community={community}>{card}</PublicPage>;
});
