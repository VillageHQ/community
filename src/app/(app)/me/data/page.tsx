import type { Metadata } from "next";
import { Check, RefreshCw, ShieldCheck } from "lucide-react";
import { eq } from "drizzle-orm";
import type { ReactNode } from "react";

import { BackLink } from "@/components/page-header";
import { getDatabase } from "@/platform/database/client";
import { PAGE_TITLES } from "@/platform/branding/page-metadata";
import { readBrandingForPage } from "@/platform/branding/branding";
import { ROUTES } from "@/platform/http/routes";
import { isAdminMember } from "@/platform/auth/roles";
import { requireMember } from "@/platform/auth/session";
import { readEnabledModuleIds } from "@/platform/modules/enablement";
import { modulePage } from "@/platform/modules/module-page";
import { formatDay, formatDayMonth } from "@/platform/text/format-date";
import { CHOICE_PLACE_WORDS } from "@/modules/members/contract-privacy";
import { FILL_IN_BASES, FILL_IN_FIELDS, LOOKUP_STATUSES } from "@/modules/members/contract-fill-in";
import { memberNetwork } from "@/modules/members/schema";
import { membersManifest } from "@/modules/members/manifest";
import { toPossessive } from "@/modules/members/rules-words";
import { readFilledLines, readLookupState, type LookupState } from "@/modules/members/service-fill-in";
import { readPrivacy, type MemberPrivacy } from "@/modules/members/service-privacy";
import { readReportCredit } from "@/modules/members/service-report-credit";
import { ShareNetworkSheet, SwitchesSheet, type ShareState } from "@/modules/members/components/your-data-switches";
import { DeleteAccountSheet, ExportSheet } from "@/modules/members/components/your-data-actions";
import { asksManifest } from "@/modules/asks/manifest";
import { feedManifest } from "@/modules/feed/manifest";
import { introsManifest } from "@/modules/intros/manifest";
import { messagesManifest } from "@/modules/messages/manifest";
import { networkManifest } from "@/modules/network/manifest";
import { DarkModeRow } from "@/shell/user-menu";
import { readDataHome } from "@/platform/settings/data-home";

export const metadata: Metadata = { title: PAGE_TITLES.yourData };

type NetworkDates = { sharingConsentedAt: Date | null; groupJoinedAt: Date | null; villageLinkedAt: Date | null };

function Item({ term, children }: { term: ReactNode; children?: ReactNode }) {
  return (
    <li>
      <span>
        <b>{term}</b>
        {children}
      </span>
    </li>
  );
}

function RecordRow({ term, detail }: { term: string; detail: string }) {
  return (
    <li>
      <span>
        <b>{term}</b>
      </span>
      <span>{detail}</span>
    </li>
  );
}

// Where the data is kept and whom to ask, only when an admin filled them in (Settings), word for word.
function HostingLine({ communityName, location }: { communityName: string; location: string | null }) {
  if (!location) return null;
  return (
    <>
      {" "}
      <b>
        Hosted by {communityName}, {location}.
      </b>
    </>
  );
}

function DataQuestionsLine({ contactEmail }: { contactEmail: string | null }) {
  if (!contactEmail) return null;
  return (
    <p className="fh-small mt-2.5">
      Questions about your data: <a href={`mailto:${contactEmail}`}>{contactEmail}</a>
    </p>
  );
}

// The fill-in part of the consent record: the member's own yes, and the basis the admins recorded.
function readFillInRecord(lookup: LookupState, communityName: string) {
  if (lookup.refusedAt) return { lines: ["Switched off: nothing is filled in."], hasConsent: false };
  const lines: string[] = [];
  if (lookup.consentedAt) lines.push(`You agreed on ${formatDayMonth(lookup.consentedAt)}.`);
  if (lookup.basis === FILL_IN_BASES.terms) {
    lines.push(`${communityName} recorded that you agreed in its membership terms${lookup.termsDate ? ` on ${formatDay(lookup.termsDate)}` : ""}.`);
  }
  if (lines.length === 0) return { lines: ["Not yet: nothing was filled in."], hasConsent: false };
  return { lines, hasConsent: true };
}

function readLastFilledIn(lookup: LookupState) {
  if (!lookup.lookedUpAt) return "not yet";
  if (lookup.status === LOOKUP_STATUSES.found) return formatDayMonth(lookup.lookedUpAt);
  return `looked up ${formatDayMonth(lookup.lookedUpAt)}, nothing found`;
}

function readSharingDetail(network: NetworkDates | undefined) {
  if (network?.groupJoinedAt) return `since ${formatDayMonth(network.groupJoinedAt)}`;
  if (network?.sharingConsentedAt) return `agreed ${formatDayMonth(network.sharingConsentedAt)}`;
  return "never";
}

function readIntroAsksDetail(privacy: MemberPrivacy) {
  if (privacy.acceptsIntroAsks === null) return "not answered: members can ask you";
  const answer = privacy.acceptsIntroAsks ? "yes" : "no";
  const when = privacy.introAsksAnsweredAt ? `, ${formatDayMonth(privacy.introAsksAnsweredAt)}` : "";
  const where = privacy.introAsksAnsweredPlace ? `, ${CHOICE_PLACE_WORDS[privacy.introAsksAnsweredPlace]}` : "";
  return `${answer}${when}${where}`;
}

function readShareState(network: NetworkDates | undefined): ShareState {
  if (network?.groupJoinedAt) return { kind: "sharing" };
  if (network?.villageLinkedAt) return { kind: "connected" };
  return { kind: "not_connected" };
}

// Founderhall's Your data (member-me-data): what is stored and where, what the lookup service receives, the consent
// record, the switches, the export and the real delete.
export default modulePage(membersManifest, async function YourDataPage() {
  const member = await requireMember();
  const database = getDatabase();
  const enabledIds = await readEnabledModuleIds(database, [feedManifest, asksManifest, introsManifest, messagesManifest, networkManifest]);
  const [isFeedOn, isAsksOn, isIntrosOn, isMessagesOn, isNetworkOn] = [feedManifest, asksManifest, introsManifest, messagesManifest, networkManifest].map(({ id }) =>
    enabledIds.has(id),
  ) as [boolean, boolean, boolean, boolean, boolean];
  const [privacy, lookup, lines, [network], isReportCreditOn, branding, dataHome] = await Promise.all([
    readPrivacy(database, member.id),
    readLookupState(database, member.id),
    readFilledLines(database, member.id),
    database
      .select({ sharingConsentedAt: memberNetwork.sharingConsentedAt, groupJoinedAt: memberNetwork.groupJoinedAt, villageLinkedAt: memberNetwork.villageLinkedAt })
      .from(memberNetwork)
      .where(eq(memberNetwork.userId, member.id)),
    readReportCredit(database, member.id),
    readBrandingForPage(),
    readDataHome(database),
  ]);
  const community = branding.name;
  const fillInRecord = readFillInRecord(lookup, community);
  const hasPicture = !lookup.refusedAt && lines.some((line) => line.field === FILL_IN_FIELDS.face && line.value);

  return (
    <>
      <BackLink href={ROUTES.editCard}>My profile</BackLink>
      <header data-slot="page-header" className="fh-pagehead">
        <h1 className="fh-h1">Your data</h1>
        <p className="fh-lede">What {community} keeps about you in this portal, where it lives, and what you can switch off.</p>
      </header>
      <div className="fh-prof fh-section">
        <div className="fh-stack">
          <section className="fh-sheet" aria-labelledby="stored-title">
            <h2 id="stored-title" className="fh-h3 flex items-center gap-1.5">
              <ShieldCheck aria-hidden="true" className="fh-i fh-s" strokeWidth={1.5} /> What is stored, and where
            </h2>
            <p className="fh-small mt-2">
              Everything below lives in this community’s own database.
              <HostingLine communityName={community} location={dataHome.location} />
            </p>
            <ul className="fh-hist fh-small mt-2">
              <Item term="Your profile:"> your name, your own words, the lines filled in from public profiles, and your privacy choices.</Item>
              {isAsksOn || isFeedOn ? <Item term="Your asks and answers"> in Asks &amp; updates.</Item> : null}
              {isIntrosOn ? (
                <Item term="Your intros:"> who asked whom, the states and dates, and the note. Only the people in an intro see its note; admins see names, states and dates.</Item>
              ) : null}
              {isMessagesOn ? <Item term="Your messages.">{` ${toPossessive(community)} admins can’t read them in the portal.`}</Item> : null}
              <Item term="Your email address"> (only admins see it), and a log of sign-ins and changes.</Item>
            </ul>
            <DataQuestionsLine contactEmail={dataHome.contact?.email ?? null} />
          </section>

          <section className="fh-sheet" aria-labelledby="lookup-title">
            <h2 id="lookup-title" className="fh-h3 flex items-center gap-1.5">
              <RefreshCw aria-hidden="true" className="fh-i fh-s" strokeWidth={1.5} /> What the lookup service receives
            </h2>
            {isNetworkOn || lookup.basis ? (
              <>
                <ul className="fh-hist fh-small mt-2">
                  <Item term="For the profile fill-in:">
                    {" "}
                    your email address (the one you were invited with) and, once it is known, your LinkedIn address for refreshes. The service may pass an email it doesn’t
                    know to its own data provider to find its owner. It sends back your role, company, city and past roles.
                  </Item>
                  {isNetworkOn ? (
                    <>
                      <Item term="When you connect your network:">
                        {" "}
                        your email address and a member number, so the service can make your account. You connect Google and LinkedIn on its own screen; it never reads email
                        content.
                      </Item>
                      <Item term="When you search:"> what you type, to find people and paths.</Item>
                    </>
                  ) : null}
                </ul>
                <p className="fh-small fh-muted mt-2">Your contact list is never stored in this portal.</p>
              </>
            ) : (
              <p className="fh-small mt-2">Nothing while network search and the profile fill-in are off. It never gets your messages, asks, intro notes or profile.</p>
            )}
          </section>

          <section className="fh-sheet" id="consent" aria-labelledby="consent-title">
            <h2 id="consent-title" className="fh-h3 flex items-center gap-1.5">
              <Check aria-hidden="true" className="fh-i fh-s" strokeWidth={1.5} /> Your consent record
            </h2>
            <ul className="fh-hist fh-small mt-2">
              <li className="fh-wide">
                <span>
                  <b>Profile fill-in</b>
                </span>
                {fillInRecord.lines.map((line) => (
                  <span key={line} className="fh-rec">
                    {line}
                  </span>
                ))}
              </li>
              {fillInRecord.hasConsent ? <RecordRow term="Last filled in" detail={readLastFilledIn(lookup)} /> : null}
              {hasPicture ? (
                <li className="fh-wide">
                  <span>
                    <b>Your picture</b>
                  </span>
                  <span className="fh-rec fh-muted">From your public profile, shown to members only. “Don’t look me up” removes it.</span>
                </li>
              ) : null}
              {isNetworkOn ? (
                <>
                  <RecordRow term="Network connected" detail={network?.villageLinkedAt ? formatDayMonth(network.villageLinkedAt) : "never"} />
                  <RecordRow term="Sharing your network with members" detail={readSharingDetail(network)} />
                </>
              ) : null}
              {isIntrosOn ? <RecordRow term="Members can ask you for intros" detail={readIntroAsksDetail(privacy)} /> : null}
              {isIntrosOn ? <RecordRow term="Named in partner reports" detail={isReportCreditOn ? "on" : "off: you are only part of a count"} /> : null}
            </ul>
          </section>
        </div>

        <div className="fh-stack">
          <SwitchesSheet
            communityName={community}
            isHidden={privacy.isHidden}
            messagePolicy={privacy.messagePolicy}
            isMessagesOn={isMessagesOn}
            lookup={lookup.basis ? { isAllowed: lookup.isAllowed } : null}
            deviceRow={<DarkModeRow />}
          />
          {isNetworkOn ? <ShareNetworkSheet state={readShareState(network)} /> : null}
          <ExportSheet />
          <DeleteAccountSheet communityName={community} isAdmin={isAdminMember(member)} />
        </div>
      </div>
    </>
  );
});
