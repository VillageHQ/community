import { Clock, HeartHandshake } from "lucide-react";
import type { Metadata } from "next";
import { headers } from "next/headers";
import Link from "next/link";
import type { ReactNode } from "react";

import { EmptyState } from "@/components/empty-state";
import { CommunityNote, SplitLayout } from "@/components/split-layout";
import { Button } from "@/components/ui/button";
import { AnsweredMessage, ConsentAnswerPanel } from "@/modules/intros/components/consent-answer-panel";
import { introsManifest } from "@/modules/intros/manifest";
import { CONSENT_VIEWS, readConsentView } from "@/modules/intros/reads-consent";
import { readActiveSession } from "@/platform/auth/active-session";
import { readBrandingForPage } from "@/platform/branding/branding";
import { PAGE_TITLES } from "@/platform/branding/page-metadata";
import { getDatabase } from "@/platform/database/client";
import { readFirstName } from "@/platform/design/avatar-identity";
import { ROUTES } from "@/platform/http/routes";
import { modulePage } from "@/platform/modules/module-page";

export const dynamic = "force-dynamic";

export const metadata: Metadata = { title: PAGE_TITLES.introConsent, robots: { index: false, follow: false } };

const CLOSED_LINK_MESSAGES = {
  [CONSENT_VIEWS.closed]: { title: "This link isn't open any more", description: "It may have been answered already, or the intro request has closed. There's nothing you need to do." },
  [CONSENT_VIEWS.tooManyTries]: { title: "Too many tries", description: "Wait a minute and try this link again." },
};

function CenteredMessage({ children }: { children: ReactNode }) {
  return <div className="flex min-h-[60dvh] items-center justify-center lg:min-h-[calc(100dvh-140px)]">{children}</div>;
}

export default modulePage(introsManifest, async function IntroConsentPage({ params }: { params: Promise<{ token: string }> }) {
  const { token } = await params;
  const requestHeaders = await headers();
  const community = await readBrandingForPage();
  const consent = await readConsentView(
    {
      database: getDatabase(),
      environment: process.env,
      headers: requestHeaders,
      readViewerId: async () => (await readActiveSession(requestHeaders))?.user.id ?? null,
    },
    token,
  );
  const note = <CommunityNote community={community}>A private community, where people only meet when they both say yes.</CommunityNote>;

  if (consent.view === CONSENT_VIEWS.closed || consent.view === CONSENT_VIEWS.tooManyTries) {
    return (
      <SplitLayout community={community} note={note}>
        <CenteredMessage>
          <EmptyState headingLevel="h1" icon={Clock} {...CLOSED_LINK_MESSAGES[consent.view]} />
        </CenteredMessage>
      </SplitLayout>
    );
  }

  if (consent.view === CONSENT_VIEWS.notForYou) {
    const targetFirst = readFirstName(consent.targetName);
    return (
      <SplitLayout community={community} note={note}>
        <CenteredMessage>
          <EmptyState
            headingLevel="h1"
            icon={HeartHandshake}
            title={`This link is for ${targetFirst}`}
            description={`We didn't change anything. Send it to ${targetFirst} and they can answer in a few seconds.`}
          >
            <Button asChild size="lg">
              <Link href={ROUTES.intros}>Back to your intros</Link>
            </Button>
          </EmptyState>
        </CenteredMessage>
      </SplitLayout>
    );
  }

  if (consent.view === CONSENT_VIEWS.answered) {
    return (
      <SplitLayout community={community} note={note}>
        <AnsweredMessage
          answer={consent.answer}
          isRepeat
          names={{ ...consent, joinsByEmail: false }}
          communityName={community.name}
          hasStoppedAllSince={consent.hasStoppedAllSince}
        />
      </SplitLayout>
    );
  }

  return (
    <SplitLayout community={community} note={note} people={[{ id: consent.requesterName, name: consent.requesterName }]}>
      <ConsentAnswerPanel token={token} communityName={community.name} consent={consent} />
    </SplitLayout>
  );
});
