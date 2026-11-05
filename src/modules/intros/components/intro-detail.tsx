"use client";

import { useSuspenseQuery } from "@tanstack/react-query";

import { INTRO_ROLES } from "@/modules/intros/contract";
import { introDetailQuery } from "@/modules/intros/queries";

import { AskForYouCard } from "@/modules/intros/components/ask-for-you-card";
import { useMarkIntrosSeen } from "@/modules/intros/components/use-intro-actions";
import { YourAskCard } from "@/modules/intros/components/your-ask-card";

export function IntroDetailView({ introId }: { introId: string }) {
  const { data: intro } = useSuspenseQuery(introDetailQuery(introId));
  useMarkIntrosSeen(intro.hasUpdate, intro.id);
  return intro.viewerRole === INTRO_ROLES.introducer ? (
    <AskForYouCard intro={intro} headingLevel="h1" />
  ) : (
    <YourAskCard intro={intro} headingLevel="h1" />
  );
}
