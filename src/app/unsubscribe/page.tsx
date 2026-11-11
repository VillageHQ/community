import type { Metadata } from "next";

import { PublicPage } from "@/components/public-page";
import { Alert } from "@/components/ui/alert";
import { Button } from "@/components/ui/button";
import { getDatabase } from "@/platform/database/client";
import { readBrandingForPage } from "@/platform/branding/branding";
import { PAGE_TITLES } from "@/platform/branding/page-metadata";
import { EMAIL_TOPIC_LABELS } from "@/platform/email/kinds";
import { UNSUBSCRIBE_PAGE_FIELD, readOptedOutTopics, readUnsubscribeToken } from "@/platform/email/unsubscribe";
import { API_ROUTES, ROUTES } from "@/platform/http/routes";
import { PLATFORM_MANIFEST } from "@/platform/modules/platform-manifest";
import { modulePage } from "@/platform/modules/module-page";

export const dynamic = "force-dynamic";

export const metadata: Metadata = { title: PAGE_TITLES.unsubscribe, robots: { index: false, follow: false } };

type UnsubscribePageProps = { searchParams: Promise<{ token?: string; done?: string }> };

function BadLink() {
  return (
    <>
      <h1 className="fh-h2">This link doesn&apos;t work</h1>
      <p className="fh-lede">It may be cut short. Open it again from the email, or sign in and change your email settings on My profile.</p>
    </>
  );
}

// Opening the link changes nothing: some mail scanners open every link. Only the button does.
export default modulePage(PLATFORM_MANIFEST, async function UnsubscribePage({ searchParams }: UnsubscribePageProps) {
  const { token = "" } = await searchParams;
  const database = getDatabase();
  const [community, target] = await Promise.all([readBrandingForPage(), readUnsubscribeToken(database, process.env, token)]);
  const topic = target ? EMAIL_TOPIC_LABELS[target.topic] : null;
  const done = target ? (await readOptedOutTopics(database, target.memberId)).has(target.topic) : false;

  return (
    <PublicPage community={community}>
      {!topic ? (
        <BadLink />
      ) : done ? (
        <>
          <h1 className="fh-h2">You&apos;re unsubscribed</h1>
          <Alert variant="success" className="mt-4">
            We won&apos;t email you about {topic.title.toLowerCase()} anymore. You still get account emails, like password resets.
          </Alert>
          <p className="fh-small fh-muted mt-3">Changed your mind? Turn it back on from My profile in {community.name}.</p>
        </>
      ) : (
        <>
          <h1 className="fh-h2">Stop emails about {topic.title.toLowerCase()}?</h1>
          <p className="fh-lede">{topic.description} You still get account emails, like password resets.</p>
          <form method="post" action={`${API_ROUTES.emailUnsubscribe}?token=${encodeURIComponent(token)}`} className="mt-[18px]">
            <input type="hidden" name={UNSUBSCRIBE_PAGE_FIELD} value="1" />
            <Button type="submit" width="block">
              Unsubscribe
            </Button>
          </form>
        </>
      )}
      <p className="fh-small mt-4">
        <a href={ROUTES.editCard}>Go to My profile</a>
      </p>
    </PublicPage>
  );
});
