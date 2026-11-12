import type { Metadata } from "next";
import { notFound } from "next/navigation";
import { z } from "zod";

import { BackLink } from "@/components/page-header";
import { IntroThread } from "@/modules/intros/components/intro-thread";
import { readIntroTitle } from "@/modules/intros/components/intro-words";
import { INTRO_ROLES } from "@/modules/intros/contract";
import { introsManifest } from "@/modules/intros/manifest";
import { readIntroForViewer } from "@/modules/intros/reads";
import { INTRO_THREAD_AUTHORS } from "@/modules/intros/schema";
import { readIntroThreadForRequester } from "@/modules/intros/service-thread";
import { requireMember } from "@/platform/auth/session";
import { getDatabase } from "@/platform/database/client";
import { ROUTES } from "@/platform/http/routes";
import { modulePage } from "@/platform/modules/module-page";

export const metadata: Metadata = { title: "Intro thread" };

const introIdSchema = z.uuid();

// The intro thread: the replies to the introduction email, for the asker and the connector.
export default modulePage(introsManifest, async function IntroThreadPage({ params }: { params: Promise<{ introId: string }> }) {
  const member = await requireMember();
  const parsedId = introIdSchema.safeParse((await params).introId);
  if (!parsedId.success) notFound();
  const database = getDatabase();
  const intro = await readIntroForViewer(database, member.id, parsedId.data);
  if (!intro) notFound();
  const entries = await readIntroThreadForRequester(database, intro.id, member.id);
  if (!entries) notFound();
  const viewerAuthor = intro.viewerRole === INTRO_ROLES.requester ? INTRO_THREAD_AUTHORS.requester : INTRO_THREAD_AUTHORS.introducer;
  return (
    <>
      <BackLink href={`${ROUTES.intros}/${intro.id}`}>{readIntroTitle(intro)}</BackLink>
      <div className="fh-pagehead">
        <h1 className="fh-h1">{readIntroTitle(intro)}</h1>
      </div>
      <IntroThread entries={entries} names={{ requesterName: intro.requester.name, targetName: intro.target.name, introducerName: intro.introducer.name, viewerAuthor }} />
    </>
  );
});
