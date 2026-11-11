import type { Metadata } from "next";
import { notFound } from "next/navigation";
import { z } from "zod";

import { IntroPage } from "@/modules/intros/components/intro-page";
import { readIntroTitle } from "@/modules/intros/components/intro-words";
import { introsManifest } from "@/modules/intros/manifest";
import { markIntrosSeen, readIntroForViewer } from "@/modules/intros/reads";
import { readIntroThreadForRequester } from "@/modules/intros/service-thread";
import { IntroOtherPathsSlot } from "@/modules/intros/slots";
import { networkManifest } from "@/modules/network/manifest";
import { requireMember } from "@/platform/auth/session";
import { readBrandingForPage } from "@/platform/branding/branding";
import { getDatabase } from "@/platform/database/client";
import { readResendConfig } from "@/platform/email/resend";
import { isModuleEnabled } from "@/platform/modules/enablement";
import { modulePage } from "@/platform/modules/module-page";

const introIdSchema = z.uuid();

type Params = { params: Promise<{ introId: string }> };

async function readViewedIntro({ params }: Params) {
  const member = await requireMember();
  const parsedId = introIdSchema.safeParse((await params).introId);
  if (!parsedId.success) notFound();
  const intro = await readIntroForViewer(getDatabase(), member.id, parsedId.data);
  if (!intro) notFound();
  return { member, intro };
}

export async function generateMetadata(props: Params): Promise<Metadata> {
  const { intro } = await readViewedIntro(props);
  return { title: readIntroTitle(intro) };
}

export default modulePage(introsManifest, async function IntroDetailPage(props: Params) {
  const { member, intro } = await readViewedIntro(props);
  const database = getDatabase();
  const [community, thread, hasSearch] = await Promise.all([
    readBrandingForPage(),
    readIntroThreadForRequester(database, intro.id, member.id),
    isModuleEnabled(database, networkManifest),
  ]);
  if (intro.hasUpdate) await markIntrosSeen(database, member.id, intro.id);
  return (
    <IntroPage
      intro={intro}
      community={community.name}
      canEmail={readResendConfig(process.env) !== null}
      hasSearch={hasSearch}
      hasThread={thread !== null}
      otherPaths={<IntroOtherPathsSlot intro={intro} />}
    />
  );
});
