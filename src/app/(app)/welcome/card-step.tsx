import type { MemberProfile } from "@/lib/members/profile";
import { readFirstName } from "@/platform/design/avatar-identity";

import { CardForm } from "@/app/(app)/members/card/card-form";
import { JoinLayout } from "@/app/(app)/network/join-layout";
import { ONBOARDING_PILLS, OnboardingSteps } from "@/app/(app)/network/onboarding-steps";
import { readSharingSentence, type WelcomeContext } from "@/app/(app)/network/welcome-context";

function readMembersHereSentence(welcome: WelcomeContext, memberCount: number) {
  const otherMemberCount = memberCount - 1;
  if (otherMemberCount < 1) return readSharingSentence(welcome);
  if (otherMemberCount === 1) return "1 member is already here to meet you.";
  return `${otherMemberCount} members are already here, helping each other meet the right people.`;
}

type CardStepProps = { welcome: WelcomeContext; profile: MemberProfile; memberCount: number };

export function CardStep({ welcome, profile, memberCount }: CardStepProps) {
  return (
    <JoinLayout welcome={welcome}>
      <OnboardingSteps current={ONBOARDING_PILLS.card} />
      <h1 className="type-h1 lg:type-display">Welcome in, {readFirstName(welcome.member.name)}.</h1>
      <p className="type-lead mt-3 text-foreground-soft">{readMembersHereSentence(welcome, memberCount)}</p>
      <section
        aria-labelledby="card-title"
        className="mt-7 grid gap-5 rounded-card bg-card p-5 shadow-panel sm:rounded-panel sm:p-7"
      >
        <div className="grid gap-1.5">
          <h2 id="card-title" className="type-h2">
            Fill in your card
          </h2>
          <p className="text-foreground-soft">This is how members will find you. Everything here is optional.</p>
        </div>
        <CardForm profile={profile} isOnboarding />
      </section>
    </JoinLayout>
  );
}
