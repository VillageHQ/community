import type { Metadata } from "next";
import { MailPlus, ShieldCheck, UserRound } from "lucide-react";
import Link from "next/link";
import { redirect } from "next/navigation";

import { LogoTile } from "@/components/logo-tile";
import { PageHeader } from "@/components/page-header";
import { ProgressTrack } from "@/components/progress-track";
import { STEP_STATES, StepRow, type StepState } from "@/components/step-row";
import { Avatar } from "@/components/ui/avatar";
import { Button } from "@/components/ui/button";
import { Card, CardTitle } from "@/components/ui/card";
import { getDatabase } from "@/database/client";
import { readSetupProgress, SETUP_STEP_NAMES, type SetupProgress, type SetupStepId } from "@/lib/admin-setup";
import { SETUP_STEP_COPY } from "@/lib/admin-setup-copy";
import { readBrandingForPage } from "@/lib/branding/branding";
import { readResendConfig } from "@/lib/email/resend";
import { readPendingInviteCount } from "@/lib/invites/invites";
import { readActiveMemberCount, readNewMembers } from "@/lib/members/directory";
import { resolveOnboardingStep } from "@/lib/members/onboarding";
import { describeEmailConfirmation, type EmailConfirmationCopy } from "@/lib/members/email-confirmation-copy";
import { readWaitingMemberCount } from "@/lib/members/member-admin";
import { isCardFilledIn, readAvatarUrl, readMemberProfile } from "@/lib/members/profile";
import { ONBOARDING_STEPS } from "@/lib/members/profile-api";
import { readFirstName } from "@/lib/design/avatar-identity";
import { describeJoinSteps, HOME_HEROES } from "@/lib/home-steps";
import { ROUTES } from "@/lib/routes";
import { requireMember } from "@/lib/session";
import { isAdminMember } from "@/lib/village/member-network";
import { readNetworkProgress, readSharingMemberCount } from "@/lib/village/network-progress";
import { NETWORK_PROGRESS, type NetworkProgress } from "@/lib/village/network-progress-stages";
import { PAGE_TITLES } from "@/lib/branding/page-metadata";

const HERO_CLASSES = "rounded-card bg-accent p-card-phone sm:rounded-panel sm:p-8";
const HERO_KICKER_CLASSES = "type-small flex items-center gap-2 font-bold text-brand-emphasis";

function readSetupStepState(id: SetupStepId, isDone: boolean, { currentStepId }: SetupProgress): StepState {
  if (isDone) return STEP_STATES.done;
  return id === currentStepId ? STEP_STATES.current : STEP_STATES.todo;
}

function AdminSetupHero({ progress, communityName }: { progress: SetupProgress; communityName: string }) {
  const nextStep = progress.currentStepId ? SETUP_STEP_NAMES[progress.currentStepId] : null;
  return (
    <section aria-labelledby="home-hero-title" className={HERO_CLASSES}>
      <p className={HERO_KICKER_CLASSES}>
        <ShieldCheck aria-hidden="true" className="size-icon-small" />
        Admin setup
      </p>
      <h2 id="home-hero-title" className="type-h1 mt-2.5">
        Let&apos;s get {communityName} ready
      </h2>
      <p className="type-lead mt-2 text-foreground-soft">
        {progress.doneCount} of {progress.totalCount} done. Next: {nextStep}.
      </p>
      <div className="mt-5">
        <ProgressTrack
          doneCount={progress.doneCount}
          totalCount={progress.totalCount}
          label={`${progress.doneCount} of ${progress.totalCount} setup steps done`}
        />
      </div>
      <Button asChild size="hero" className="mt-6 max-sm:w-full">
        <Link href={ROUTES.admin}>Continue setup</Link>
      </Button>
    </section>
  );
}

type MemberHeroProps = { networkProgress: NetworkProgress; confirmationCopy: EmailConfirmationCopy };

function MemberHero({ networkProgress, confirmationCopy }: MemberHeroProps) {
  const hero = HOME_HEROES[networkProgress];
  const { icon: Icon, kicker, action } = hero;
  const { title, description } = networkProgress === NETWORK_PROGRESS.needsEmailConfirmation ? confirmationCopy : hero;
  return (
    <section aria-labelledby="home-hero-title" className={HERO_CLASSES}>
      <p className={HERO_KICKER_CLASSES}>
        <Icon aria-hidden="true" className="size-icon-small" />
        {kicker}
      </p>
      <h2 id="home-hero-title" className="type-h1 mt-2.5">
        {title}
      </h2>
      <p className="type-lead mt-2 max-w-[560px] text-foreground-soft">{description}</p>
      {action ? (
        <Button asChild size="hero" className="mt-6 max-sm:w-full">
          <Link href={ROUTES.network}>{action}</Link>
        </Button>
      ) : null}
    </section>
  );
}

function SetupSteps({ progress }: { progress: SetupProgress }) {
  return (
    <section aria-labelledby="home-steps-title">
      <h2 id="home-steps-title" className="type-h3 mb-3.5">
        Your next steps
      </h2>
      <ol className="grid gap-2.5">
        {progress.steps.map(({ id, isDone }, position) => (
          <StepRow
            key={id}
            state={readSetupStepState(id, isDone, progress)}
            number={position + 1}
            title={SETUP_STEP_COPY[id].title}
            description={isDone ? SETUP_STEP_COPY[id].done : SETUP_STEP_COPY[id].todo}
            action={
              <Button asChild size="sm" variant={isDone ? "quiet" : "outline"}>
                <Link href={`${ROUTES.admin}?step=${id}`}>{isDone ? SETUP_STEP_COPY[id].manageLabel : "Start"}</Link>
              </Button>
            }
          />
        ))}
      </ol>
    </section>
  );
}

const JOIN_STEPS_TITLES: Partial<Record<NetworkProgress, string>> = {
  [NETWORK_PROGRESS.ready]: "You've joined the network",
  [NETWORK_PROGRESS.notConfigured]: "How the network will work",
  [NETWORK_PROGRESS.awaitingGroup]: "How the network will work",
  [NETWORK_PROGRESS.needsEmailConfirmation]: "How the network will work",
};

function JoinSteps({ networkProgress }: { networkProgress: NetworkProgress }) {
  return (
    <section aria-labelledby="home-steps-title">
      <h2 id="home-steps-title" className="type-h3 mb-3.5">
        {JOIN_STEPS_TITLES[networkProgress] ?? "Your next steps"}
      </h2>
      <ol className="grid gap-2.5">
        {describeJoinSteps(networkProgress).map(({ title, description, number, state }) => (
          <StepRow key={title} state={state} number={number} title={title} description={description} />
        ))}
      </ol>
    </section>
  );
}

type NewMember = Awaited<ReturnType<typeof readNewMembers>>["newMembers"][number];

function NewMemberRow({ member }: { member: NewMember }) {
  const { id, name, title, company, avatarUrl } = member;
  return (
    <li className="grid gap-2.5">
      <div className="flex items-center gap-3">
        <Avatar stableId={id} name={name} imageUrl={avatarUrl} sizePx={44} />
        <div className="min-w-0">
          <div className="type-label">{name}</div>
          <div className="type-micro font-medium text-muted-foreground">{company ?? title ?? "New member"}</div>
        </div>
      </div>
      <Button asChild variant="soft" size="sm" className="w-full">
        <Link href={`${ROUTES.members}/${id}`} aria-label={`View profile of ${name}`}>
          View profile
        </Link>
      </Button>
    </li>
  );
}

function NewThisWeekCard({ newMembers }: { newMembers: NewMember[] }) {
  return (
    <Card className="sm:p-5">
      <CardTitle>New this week</CardTitle>
      {newMembers.length === 0 ? (
        <>
          <p className="type-small mt-2 text-foreground-soft">Nobody new this week. Everyone else is one tap away.</p>
          <Button asChild variant="outline" size="sm" className="mt-3.5 w-full">
            <Link href={ROUTES.members}>Meet the members</Link>
          </Button>
        </>
      ) : (
        <ul className="mt-3.5 grid gap-3.5">
          {newMembers.map((member) => (
            <NewMemberRow key={member.id} member={member} />
          ))}
        </ul>
      )}
    </Card>
  );
}

function CardNudge() {
  return (
    <section aria-labelledby="home-card-title" className="flex flex-wrap items-center gap-4 rounded-card bg-card p-card-phone shadow-panel sm:p-6">
      <span aria-hidden="true" className="flex size-12 shrink-0 items-center justify-center rounded-full bg-accent text-accent-foreground">
        <UserRound className="size-icon" />
      </span>
      <div className="min-w-0 flex-[1_1_240px]">
        <h2 id="home-card-title" className="type-h3">
          Finish your card
        </h2>
        <p className="type-small text-foreground-soft">Add your photo and what you can help with, so members can find you.</p>
      </div>
      <Button asChild size="lg" className="max-sm:w-full">
        <Link href={ROUTES.editCard}>Finish my card</Link>
      </Button>
    </section>
  );
}

function InvitesCard({ pendingCount, waitingCount }: { pendingCount: number; waitingCount: number }) {
  return (
    <Card className="sm:p-5">
      <CardTitle>Invites</CardTitle>
      <p className="type-small mt-2 text-foreground-soft">{readPendingInvitesSentence(pendingCount)}</p>
      {waitingCount > 0 ? (
        <p className="type-small mt-1 font-semibold text-foreground">{readWaitingSentence(waitingCount)}</p>
      ) : null}
      <Button asChild variant="outline" size="sm" className="mt-3.5 w-full">
        <Link href={ROUTES.adminMembers}>
          <MailPlus aria-hidden="true" />
          Manage invites
        </Link>
      </Button>
    </Card>
  );
}

function readPendingInvitesSentence(pendingCount: number) {
  if (pendingCount === 0) return "No invites are waiting on anyone.";
  return pendingCount === 1 ? "1 invite is waiting to be accepted." : `${pendingCount} invites are waiting to be accepted.`;
}

function readWaitingSentence(waitingCount: number) {
  return waitingCount === 1 ? "1 member is waiting for you to confirm them." : `${waitingCount} members are waiting for you to confirm them.`;
}

function readWeekSentence(newCount: number) {
  if (newCount === 0) return "Here's what's next.";
  return newCount === 1 ? "1 new member joined this week." : `${newCount} new members joined this week.`;
}

function readMemberCountSentence(memberCount: number) {
  return memberCount === 1 ? "1 member so far." : `${memberCount} members so far.`;
}

function readSharingSentence(memberCount: number) {
  if (memberCount === 0) return "Nobody is sharing a network here yet.";
  return memberCount === 1 ? "1 member shares their network here." : `${memberCount} members share their networks here.`;
}

export const metadata: Metadata = { title: PAGE_TITLES.home };

export default async function HomePage() {
  const member = await requireMember();
  const database = getDatabase();
  if ((await resolveOnboardingStep(database, member)) !== ONBOARDING_STEPS.done) redirect(ROUTES.welcome);

  const isAdmin = isAdminMember(member);
  const [
    community,
    networkProgress,
    sharingMemberCount,
    setupProgress,
    memberCount,
    { newCount, newMembers },
    profile,
    avatarUrl,
    pendingInviteCount,
    waitingMemberCount,
  ] = await Promise.all([
    readBrandingForPage(),
    readNetworkProgress(database, member),
    readSharingMemberCount(database),
    isAdmin ? readSetupProgress(database, process.env) : null,
    readActiveMemberCount(database),
    readNewMembers(database, member.id),
    readMemberProfile(database, member.id),
    readAvatarUrl(database, member.id),
    isAdmin ? readPendingInviteCount(database) : null,
    isAdmin ? readWaitingMemberCount(database) : 0,
  ]);
  const isSetupPending = setupProgress !== null && !setupProgress.isComplete;

  return (
    <>
      <PageHeader title={`Good to see you, ${readFirstName(member.name)}.`} description={readWeekSentence(newCount)} />
      <div className="grid items-start gap-5 lg:grid-cols-[minmax(0,1fr)_296px] lg:gap-7">
        <div className="grid gap-5">
          {isSetupPending ? (
            <AdminSetupHero
              progress={setupProgress}
              communityName={community.isSaved ? community.name : "your community"}
            />
          ) : (
            <MemberHero
              networkProgress={networkProgress}
              confirmationCopy={describeEmailConfirmation(community.isSaved ? community.name : "your admin", readResendConfig(process.env) !== null)}
            />
          )}
          {profile && isCardFilledIn(profile) ? null : <CardNudge />}
          {isSetupPending ? <SetupSteps progress={setupProgress} /> : <JoinSteps networkProgress={networkProgress} />}
        </div>
        <aside aria-label="About this community" className="grid gap-5">
          <NewThisWeekCard newMembers={newMembers} />
          {pendingInviteCount === null ? null : <InvitesCard pendingCount={pendingInviteCount} waitingCount={waitingMemberCount} />}
          <Card className="sm:p-5">
            <CardTitle>Your community</CardTitle>
            <div className="mt-3.5 flex items-center gap-3">
              <LogoTile name={community.name} logo={community.logo} />
              <div className="min-w-0">
                <div className="type-label">{community.name}</div>
                {community.descriptor ? (
                  <div className="type-micro font-medium text-muted-foreground">{community.descriptor}</div>
                ) : null}
              </div>
            </div>
            <p className="type-small mt-3.5 text-foreground-soft">
              {readMemberCountSentence(memberCount)} {readSharingSentence(sharingMemberCount)}
            </p>
          </Card>
          <Card className="sm:p-5">
            <CardTitle>Your account</CardTitle>
            <div className="mt-3.5 flex items-center gap-3">
              <Avatar stableId={member.id} name={member.name} imageUrl={avatarUrl} sizePx={44} />
              <dl className="min-w-0">
                <dt className="sr-only">Name</dt>
                <dd className="type-label">{member.name}</dd>
                <dt className="sr-only">Email</dt>
                <dd className="type-small wrap-anywhere text-muted-foreground">{member.email}</dd>
                <dt className="sr-only">Role</dt>
                <dd className="type-micro font-medium text-muted-foreground">{isAdmin ? "Admin" : "Member"}</dd>
              </dl>
            </div>
          </Card>
        </aside>
      </div>
    </>
  );
}
