import type { Metadata } from "next";
import Link from "next/link";

import { CommunityNote, SplitLayout } from "@/components/split-layout";
import { Alert } from "@/components/ui/alert";
import { Button } from "@/components/ui/button";
import { getDatabase } from "@/platform/database/client";
import { readBrandingForPage } from "@/platform/branding/branding";
import { PAGE_TITLES } from "@/platform/branding/page-metadata";
import { EMAIL_TOPIC_LABELS } from "@/platform/email/kinds";
import { UNSUBSCRIBE_PAGE_FIELD, readUnsubscribeToken } from "@/platform/email/unsubscribe";
import { API_ROUTES, ROUTES } from "@/platform/http/routes";
import { PLATFORM_MANIFEST } from "@/platform/modules/platform-manifest";
import { modulePage } from "@/platform/modules/module-page";

export const dynamic = "force-dynamic";

export const metadata: Metadata = { title: PAGE_TITLES.unsubscribe, robots: { index: false, follow: false } };

type UnsubscribePageProps = { searchParams: Promise<{ token?: string; done?: string }> };

function BadLink() {
  return (
    <>
      <h1 className="type-h1">This link doesn&apos;t work</h1>
      <p className="type-lead mt-4 text-foreground-soft">It may be cut short. Open it again from the email, or sign in and change your email settings on your card.</p>
    </>
  );
}

// Opening the link changes nothing: some mail scanners open every link. Only the button does.
export default modulePage(PLATFORM_MANIFEST, async function UnsubscribePage({ searchParams }: UnsubscribePageProps) {
  const { token = "", done } = await searchParams;
  const [community, target] = await Promise.all([readBrandingForPage(), readUnsubscribeToken(getDatabase(), process.env, token)]);
  const topic = target ? EMAIL_TOPIC_LABELS[target.topic] : null;

  return (
    <SplitLayout community={community} note={<CommunityNote community={community}>You choose what lands in your inbox.</CommunityNote>}>
      <div className="flex min-h-[60dvh] flex-col justify-center lg:min-h-[calc(100dvh-140px)]">
        {!topic ? (
          <BadLink />
        ) : done ? (
          <>
            <h1 className="type-h1">You&apos;re unsubscribed</h1>
            <Alert variant="success" className="mt-6">
              We won&apos;t email you about {topic.title.toLowerCase()} anymore. You still get account emails, like password resets.
            </Alert>
            <p className="mt-4 text-foreground-soft">Changed your mind? Turn it back on from your card in {community.name}.</p>
          </>
        ) : (
          <>
            <h1 className="type-h1">Stop emails about {topic.title.toLowerCase()}?</h1>
            <p className="type-lead mt-4 text-foreground-soft">{topic.description} You still get account emails, like password resets.</p>
            <form method="post" action={`${API_ROUTES.emailUnsubscribe}?token=${encodeURIComponent(token)}`} className="mt-7">
              <input type="hidden" name={UNSUBSCRIBE_PAGE_FIELD} value="1" />
              <Button type="submit" size="lg" className="max-sm:w-full">
                Unsubscribe
              </Button>
            </form>
          </>
        )}
        <div className="mt-5">
          <Button asChild variant="quiet">
            <Link href={ROUTES.editCard}>Go to my card</Link>
          </Button>
        </div>
      </div>
    </SplitLayout>
  );
});
