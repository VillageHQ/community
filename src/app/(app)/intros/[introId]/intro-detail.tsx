"use client";

import { useSuspenseQuery } from "@tanstack/react-query";

import { INTRO_ROLES } from "@/lib/intros/intro-api";
import { introDetailQuery } from "@/lib/intros/intro-queries";

import { AskForYouCard } from "../ask-for-you-card";
import { useMarkIntrosSeen } from "../use-intro-actions";
import { YourAskCard } from "../your-ask-card";

export function IntroDetailView({ introId }: { introId: string }) {
  const { data: intro } = useSuspenseQuery(introDetailQuery(introId));
  useMarkIntrosSeen(intro.hasUpdate, intro.id);
  return intro.viewerRole === INTRO_ROLES.introducer ? (
    <AskForYouCard intro={intro} headingLevel="h1" />
  ) : (
    <YourAskCard intro={intro} headingLevel="h1" />
  );
}
