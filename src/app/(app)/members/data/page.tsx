import type { Metadata } from "next";
import { ArrowLeft } from "lucide-react";
import Link from "next/link";
import { eq } from "drizzle-orm";
import type { ReactNode } from "react";

import { PageHeader } from "@/components/page-header";
import { Button } from "@/components/ui/button";
import { getDatabase } from "@/platform/database/client";
import { PAGE_TITLES } from "@/platform/branding/page-metadata";
import { readBrandingForPage } from "@/platform/branding/branding";
import { ROUTES } from "@/platform/http/routes";
import { requireMember } from "@/platform/auth/session";
import { isAdminMember } from "@/platform/auth/roles";
import { readEnabledModuleIds } from "@/platform/modules/enablement";
import { modulePage } from "@/platform/modules/module-page";
import { formatLongDate } from "@/platform/text/format-date";
import { CHOICE_PLACE_WORDS, MESSAGE_POLICIES } from "@/modules/members/contract-privacy";
import { FILL_IN_BASES } from "@/modules/members/contract-fill-in";
import { memberNetwork } from "@/modules/members/schema";
import { membersManifest } from "@/modules/members/manifest";
import { readLookupState, type LookupState } from "@/modules/members/service-fill-in";
import { readPrivacy, type MemberPrivacy } from "@/modules/members/service-privacy";
import { readReportCredit } from "@/modules/members/service-report-credit";
import { YourDataSwitches } from "@/modules/members/components/your-data-switches";
import { DeleteAccountCard, ExportCard } from "@/modules/members/components/your-data-actions";
import { asksManifest } from "@/modules/asks/manifest";
import { feedManifest } from "@/modules/feed/manifest";
import { introsManifest } from "@/modules/intros/manifest";
import { messagesManifest } from "@/modules/messages/manifest";
import { networkManifest } from "@/modules/network/manifest";
import { VillageDisclosure } from "@/modules/network/components/village-disclosure";
import { DarkModeRow } from "@/shell/user-menu";
import { readDataHome } from "@/platform/settings/data-home";
import { isDataHomeSet, type DataHome } from "@/platform/settings/data-home-api";

export const metadata: Metadata = { title: PAGE_TITLES.yourData };

type SharingDates = { sharingConsentedAt: Date | null; groupJoinedAt: Date | null; villageLinkedAt: Date | null };

function Panel({ titleId, title, children }: { titleId: string; title: string; children: ReactNode }) {
  return (
    <section aria-labelledby={titleId} className="grid gap-3 rounded-card bg-card p-5 shadow-panel sm:rounded-panel sm:p-7">
      <h2 id={titleId} className="type-h3">
        {title}
      </h2>
      {children}
    </section>
  );
}

function Facts({ items }: { items: { term: string; detail: string }[] }) {
  return (
    <dl className="grid gap-3">
      {items.map(({ term, detail }) => (
        <div key={term} className="grid gap-0.5">
          <dt className="font-bold">{term}</dt>
          <dd className="type-small text-foreground-soft">{detail}</dd>
        </div>
      ))}
    </dl>
  );
}

// Shown only when an admin filled it in, word for word.
function DataHomeFacts({ dataHome: { location, contact } }: { dataHome: DataHome }) {
  if (!isDataHomeSet({ location, contact })) return null;
  return (
    <dl className="grid gap-3 border-t border-border pt-3">
      {location ? (
        <div className="grid gap-0.5">
          <dt className="font-bold">Where the data is kept</dt>
          <dd className="type-small wrap-anywhere text-foreground-soft">As the admins describe it: {location}</dd>
        </div>
      ) : null}
      {contact ? (
        <div className="grid gap-0.5">
          <dt className="font-bold">Questions or requests about your data</dt>
          <dd className="type-small wrap-anywhere text-foreground-soft">
            {contact.name ? `${contact.name}, at ` : "Write to "}
            <a className="font-bold text-foreground underline underline-offset-2" href={`mailto:${contact.email}`}>
              {contact.email}
            </a>
          </dd>
        </div>
      ) : null}
    </dl>
  );
}

type Enabled = { isFeedOn: boolean; isAsksOn: boolean; isIntrosOn: boolean; isMessagesOn: boolean; isNetworkOn: boolean };

function readStoredItems(communityName: string, { isFeedOn, isAsksOn, isIntrosOn, isMessagesOn, isNetworkOn }: Enabled) {
  return [
    { term: "Your card", detail: "Your name, your own words, photo and tags, any lines filled in from public profiles, and your choices on this page." },
    { term: "Your email address", detail: "Only admins see it. It is how you sign in and how we email you." },
    ...(isFeedOn ? [{ term: "Your posts and replies", detail: "In the feed, for members to read." }] : []),
    ...(isAsksOn ? [{ term: "Your asks, answers and offers", detail: "Asks and answers are for members to read. An offer is only for the person who asked." }] : []),
    ...(isIntrosOn
      ? [{ term: "Your intros", detail: "Who asked whom, the states and dates, and the note. Only the people in an intro see its note. Admins see counts, not names." }]
      : []),
    ...(isMessagesOn ? [{ term: "Your messages", detail: "Only you and the other member read them. Admins see one only if someone reports it." }] : []),
    ...(isNetworkOn ? [{ term: "Your network link", detail: "Your LinkedIn address and the dates you joined network search. Your contacts are never stored here." }] : []),
    { term: "Sign-ins and admin actions", detail: "Your sign-in sessions, and a log of what admins changed." },
    { term: "Where it lives", detail: `In ${communityName}'s own database, run by its admins. Nothing here is sold or shared for ads.` },
  ];
}

function readFillInLine(lookup: LookupState) {
  if (!lookup.basis) return "Off in this community: nothing is looked up.";
  if (lookup.refusedAt) return `You said no on ${formatLongDate(lookup.refusedAt)}. Nothing is filled in.`;
  if (lookup.consentedAt) return `You said yes on ${formatLongDate(lookup.consentedAt)}.`;
  if (lookup.basis === FILL_IN_BASES.terms) return `The community's membership terms${lookup.termsDate ? ` of ${formatLongDate(lookup.termsDate)}` : ""} cover it. You can switch it off below.`;
  return "Not answered yet: nothing is filled in until you say yes.";
}

function readIntroAsksLine(privacy: MemberPrivacy) {
  if (privacy.acceptsIntroAsks === null) return "Not answered yet. Members can still ask you, as before.";
  const answer = privacy.acceptsIntroAsks ? "Yes" : "No";
  const when = privacy.introAsksAnsweredAt ? ` on ${formatLongDate(privacy.introAsksAnsweredAt)}` : "";
  const where = privacy.introAsksAnsweredPlace ? `, ${CHOICE_PLACE_WORDS[privacy.introAsksAnsweredPlace]}` : "";
  return `${answer}${when}${where}.`;
}

function readSharingLine(sharing: SharingDates | undefined) {
  if (sharing?.groupJoinedAt) return `Shared with the community since ${formatLongDate(sharing.groupJoinedAt)}.`;
  if (sharing?.sharingConsentedAt) return `You agreed on ${formatLongDate(sharing.sharingConsentedAt)}. Not shared yet.`;
  return "Never shared.";
}

function readConsentItems(enabled: Enabled, privacy: MemberPrivacy, lookup: LookupState, sharing: SharingDates | undefined, isReportCreditOn: boolean) {
  return [
    { term: "Profile fill-in", detail: readFillInLine(lookup) },
    ...(enabled.isNetworkOn ? [{ term: "Sharing your network", detail: readSharingLine(sharing) }] : []),
    ...(enabled.isIntrosOn ? [{ term: "Accept intro asks", detail: readIntroAsksLine(privacy) }] : []),
    ...(enabled.isIntrosOn ? [{ term: "Credit in partner reports", detail: isReportCreditOn ? "On: you can be named among top connectors." : "Off: you are only part of a count." }] : []),
    {
      term: "Directory",
      detail: privacy.isHidden
        ? `Hidden${privacy.hiddenChangedAt ? ` since ${formatLongDate(privacy.hiddenChangedAt)}` : ""}.`
        : `Listed${privacy.hiddenChangedAt ? ` again since ${formatLongDate(privacy.hiddenChangedAt)}` : ""}.`,
    },
    ...(enabled.isMessagesOn
      ? [
          {
            term: "Who can message you",
            detail: `${privacy.messagePolicy === MESSAGE_POLICIES.introduced ? "Only people you were introduced to" : "Anyone in the community"}${privacy.messagePolicyChangedAt ? `, since ${formatLongDate(privacy.messagePolicyChangedAt)}` : ""}.`,
          },
        ]
      : []),
  ];
}

export default modulePage(membersManifest, async function YourDataPage() {
  const member = await requireMember();
  const database = getDatabase();
  const enabledIds = await readEnabledModuleIds(database, [feedManifest, asksManifest, introsManifest, messagesManifest, networkManifest]);
  const [isFeedOn, isAsksOn, isIntrosOn, isMessagesOn, isNetworkOn] = [feedManifest, asksManifest, introsManifest, messagesManifest, networkManifest].map(({ id }) =>
    enabledIds.has(id),
  ) as [boolean, boolean, boolean, boolean, boolean];
  const enabled = { isFeedOn, isAsksOn, isIntrosOn, isMessagesOn, isNetworkOn };
  const [privacy, lookup, [sharing], isReportCreditOn, branding, dataHome] = await Promise.all([
    readPrivacy(database, member.id),
    readLookupState(database, member.id),
    database
      .select({ sharingConsentedAt: memberNetwork.sharingConsentedAt, groupJoinedAt: memberNetwork.groupJoinedAt, villageLinkedAt: memberNetwork.villageLinkedAt })
      .from(memberNetwork)
      .where(eq(memberNetwork.userId, member.id)),
    readReportCredit(database, member.id),
    readBrandingForPage(),
    readDataHome(database),
  ]);

  return (
    <div className="mx-auto grid max-w-[720px] gap-5">
      <PageHeader
        title="Your data"
        description={`What ${branding.name} keeps about you, where it lives, and what you can switch off.`}
        action={
          <Button asChild variant="quiet" size="sm">
            <Link href={ROUTES.editCard}>
              <ArrowLeft aria-hidden="true" />
              Your card
            </Link>
          </Button>
        }
      />
      <Panel titleId="stored-title" title="What is stored, and where">
        <Facts items={readStoredItems(branding.name, enabled)} />
        <DataHomeFacts dataHome={dataHome} />
      </Panel>
      {isNetworkOn ? (
        <VillageDisclosure isFillInOn={lookup.isAllowed} />
      ) : (
        <Panel titleId="village-title" title="What Village receives">
          <p className="type-small text-foreground-soft">Nothing while network search is off. Village never gets your messages, posts, asks, intro notes or card.</p>
        </Panel>
      )}
      <Panel titleId="consent-title" title="Your consent record">
        <Facts items={readConsentItems(enabled, privacy, lookup, sharing, isReportCreditOn)} />
      </Panel>
      <YourDataSwitches
        isHidden={privacy.isHidden}
        messagePolicy={privacy.messagePolicy}
        acceptsIntroAsks={privacy.acceptsIntroAsks}
        isMessagesOn={isMessagesOn}
        isIntrosOn={isIntrosOn}
        lookup={lookup.basis ? { isAllowed: lookup.isAllowed } : null}
        sharing={isNetworkOn ? { isSharing: Boolean(sharing?.groupJoinedAt), since: sharing?.groupJoinedAt ? formatLongDate(sharing.groupJoinedAt) : null } : null}
      />
      <Panel titleId="display-title" title="On this device">
        <DarkModeRow />
      </Panel>
      <ExportCard />
      <DeleteAccountCard communityName={branding.name} isAdmin={isAdminMember(member)} />
    </div>
  );
});
