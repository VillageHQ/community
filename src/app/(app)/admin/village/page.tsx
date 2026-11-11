import type { Metadata } from "next";

import { Note } from "@/components/ui/note";
import { readFillInSettings } from "@/modules/members/service-fill-in";
import { DAILY_LOOKUP_LIMITS, MONTHLY_CREDIT_CAPS, VILLAGE_KEY_STATUSES } from "@/platform/village/contract";
import {
  ConnectionHead,
  ConnectionTestResult,
  CostBox,
  CreditMeter,
  FillInLastRunLine,
  LatestLookups,
  LookupsPerMember,
  NetworkMeter,
  NudgeNeedsEmail,
  NudgeSentNote,
  SavedKeyLines,
  SelfHostBox,
  WhatVillageSees,
} from "@/modules/network/components/admin-village-sections";
import { FillInBasisForm, FillInNowButton, NudgeButton, TestConnectionButton, VillageKeysForm, VillageLimitsForm } from "@/modules/network/components/admin-village-forms";
import { GroupForm } from "@/modules/network/components/group-form";
import { networkManifest } from "@/modules/network/manifest";
import { readCreditUsage } from "@/modules/network/reads-credits";
import { readLookupsThisMonth, readNetworkReach, readNudgeStates } from "@/modules/network/reads-village-admin";
import { readVillageCheck } from "@/modules/network/reads-village-check";
import { readVillageGroupReadiness } from "@/modules/network/service";
import { readFirstAdminEmail } from "@/modules/network/service-fill-in";
import { readSharingMembers, readVillageGroup, readVillageSearchSettings } from "@/modules/network/service-settings";
import { readFillInLastRun, readVillageAdminSettings } from "@/modules/network/service-village-admin";
import { requireAdmin } from "@/platform/auth/session";
import { readBranding } from "@/platform/branding/branding";
import { PAGE_TITLES } from "@/platform/branding/page-metadata";
import { getDatabase, type Database } from "@/platform/database/client";
import { readResendConfig } from "@/platform/email/resend";
import { createRequestContext, type SessionMember } from "@/platform/http/request-context";
import { modulePage } from "@/platform/modules/module-page";
import { readMonthlyCreditUsage } from "@/platform/village/credit-ledger";
import { readDailyLookupLimit, readVillageKeyState, readVillageOutOfCreditsAt } from "@/platform/village/settings";
import { resolveVillageApiUrl, resolveVillageAppUrl } from "@/platform/village/urls";
import { AdminSection } from "@/shell/admin-section";

export const metadata: Metadata = { title: PAGE_TITLES.adminVillage };

const DEFAULT_VILLAGE_API_URL = "https://api.village.ai";

// Problems reading the saved keys (Community seals the secret with the setup token): said in the Connection sheet.
const KEY_PROBLEMS: Partial<Record<string, string>> = {
  [VILLAGE_KEY_STATUSES.plain]: "The secret key is stored unencrypted, because this site has no usable SETUP_TOKEN. Add one on your host and it is sealed.",
  [VILLAGE_KEY_STATUSES.sealFailed]: "The secret key is still stored unencrypted, because it couldn’t be sealed. It is tried again; if this stays, check the database and the logs.",
  [VILLAGE_KEY_STATUSES.tokenMissing]: "This site has no SETUP_TOKEN now, so the saved keys can’t be read. Put it back on your host, or paste the keys again.",
  [VILLAGE_KEY_STATUSES.tokenDifferent]: "The SETUP_TOKEN changed, so the saved keys can’t be read. Put the old token back on your host, or paste the keys again.",
  [VILLAGE_KEY_STATUSES.damaged]: "The saved keys can’t be read by this version. Paste them again.",
  [VILLAGE_KEY_STATUSES.unavailable]: "The saved keys couldn’t be read just now. Reload in a moment; nothing needs pasting.",
  [VILLAGE_KEY_STATUSES.preview]: "This is a preview, which may share the live site’s database, so it never changes the Village keys.",
};

// The group is made once, by an admin whose own network is synced (Community's setup step, kept here).
async function GroupStep({ database, admin, defaultName }: { database: Database; admin: SessionMember; defaultName: string }) {
  let readiness: { isSynced: boolean } | null = null;
  let isVillageReachable = true;
  try {
    readiness = await readVillageGroupReadiness(createRequestContext(database, process.env, admin));
  } catch {
    isVillageReachable = false;
  }
  return (
    <div className="mt-3.5 border-t border-rule pt-3.5">
      <h3 className="type-h3">The community group</h3>
      <div className="fh-small mt-2 grid gap-3">
        <GroupForm hasKeys hasGroup={false} isVillageReachable={isVillageReachable} isSynced={readiness?.isSynced ?? false} defaultName={defaultName} />
      </div>
    </div>
  );
}

export default modulePage(networkManifest, async function AdminVillagePage() {
  const admin = await requireAdmin();
  const database = getDatabase();
  const [branding, keyState, { check, members }, group, searchSettings, sharingMembers, firstAdminEmail, dailyLimit, adminSettings, fillIn, lastRun] = await Promise.all([
    readBranding(database),
    readVillageKeyState(database),
    readVillageCheck(database),
    readVillageGroup(database),
    readVillageSearchSettings(database),
    readSharingMembers(database),
    readFirstAdminEmail(database),
    readDailyLookupLimit(database),
    readVillageAdminSettings(database),
    readFillInSettings(database),
    readFillInLastRun(database),
  ]);
  const [month, lookups, outOfCreditsAt, reach, nudges, usage] = await Promise.all([
    readMonthlyCreditUsage(database),
    readLookupsThisMonth(database),
    readVillageOutOfCreditsAt(database),
    readNetworkReach(database),
    readNudgeStates(database, admin.id),
    readCreditUsage(database),
  ]);
  const isConfigured = keyState.keys !== null;
  const hasSavedKeys = keyState.status !== VILLAGE_KEY_STATUSES.missing;
  const keyProblem = KEY_PROBLEMS[keyState.status];
  // Keys this site can read show as Founderhall's "set on the server" lines; anything else keeps the fields open.
  const areKeysReadable = isConfigured && !keyProblem;
  const apiUrl = `${(resolveVillageApiUrl(process.env) ?? DEFAULT_VILLAGE_API_URL).replace(/\/+$/, "")}/v2`;
  const appUrl = resolveVillageAppUrl(process.env);
  const isEmailOn = readResendConfig(process.env) !== null;
  const communityName = branding.isSaved ? branding.name : "your community";
  const { unconnected, noAsks } = nudges;

  return (
    <AdminSection
      title="Village"
      description="Village fills in profiles, finds people, and finds who can introduce whom. Without a key, the directory, profiles and invites work on their own."
    >
      <div className="fh-grid">
        <div className="fh-c7 fh-stack">
          {isConfigured ? null : <SelfHostBox />}
          <section className="fh-sheet">
            <ConnectionHead isConfigured={isConfigured} />
            <p className="fh-small mt-2">
              {isConfigured
                ? `Village calls go to ${apiUrl}.`
                : "No Village key. The directory, profiles and invites work on their own; network search, intro paths and profile fill-in need a key."}
            </p>
            {keyProblem ? (
              <Note kind="needs" className="mt-3">
                {keyProblem}
              </Note>
            ) : null}
            <ConnectionTestResult check={check} members={members} />
            {areKeysReadable ? <SavedKeyLines /> : <VillageKeysForm hasSavedKeys={hasSavedKeys} />}
            {isConfigured ? <TestConnectionButton /> : null}
            <p className="fh-small fh-muted mt-2.5">
              Village’s address: <span className="fh-mono">{apiUrl}</span> · for the sync screen: <span className="fh-mono">{appUrl}</span>. Both are set on the server.
            </p>
            {areKeysReadable ? (
              <details className="mt-2.5">
                <summary className="fh-small">Replace the keys</summary>
                <VillageKeysForm hasSavedKeys />
              </details>
            ) : null}
            {isConfigured && !group ? <GroupStep database={database} admin={admin} defaultName={branding.isSaved ? branding.name : ""} /> : null}
          </section>

          <VillageLimitsForm
            values={{
              cap: month.cap,
              dailyLimit,
              searchScope: searchSettings.searchScope,
              serviceEmail: searchSettings.serviceEmail ?? "",
              introducers: searchSettings.introducers,
              chosenIntroducerIds: searchSettings.chosenIntroducerIds,
              dataRegion: adminSettings.dataRegion,
              dpaUrl: adminSettings.dpaUrl,
              isNightlyFillInOn: adminSettings.isNightlyFillInOn,
            }}
            sharingMembers={sharingMembers}
            defaultServiceEmail={firstAdminEmail}
            communityName={communityName}
            defaults={{ cap: MONTHLY_CREDIT_CAPS.default.toLocaleString("en-US"), dailyLimit: DAILY_LOOKUP_LIMITS.default }}
          />

          <section className="fh-sheet">
            <h2 className="type-h3">Profile fill-in</h2>
            <p className="fh-small mt-1.5">
              Role, company, city and past roles from public profiles, by each member’s email (1 lookup per person found). Members’ own words always win; they can hide any line, or
              switch lookups off for themselves on Your data.
            </p>
            <FillInLastRunLine lastRun={lastRun} />
            <FillInNowButton isDisabled={!isConfigured || fillIn.basis === null} />
            <FillInBasisForm basis={fillIn.basis} termsDate={fillIn.termsDate} />
          </section>

          <WhatVillageSees />
        </div>

        <div className="fh-c5 fh-stack">
          <section className="fh-sheet">
            <CreditMeter lookups={lookups} used={month.credits} cap={month.cap} isConfigured={isConfigured} dailyLimit={dailyLimit} outOfCreditsAt={outOfCreditsAt} />
            <LatestLookups latest={lookups.latest} />
            <LookupsPerMember members={usage.members} windowDays={usage.windowDays} />
          </section>

          <section className="fh-sheet" id="connect">
            <NetworkMeter reach={reach} isConfigured={isConfigured} />
            {!isConfigured ? null : !isEmailOn ? (
              <NudgeNeedsEmail />
            ) : unconnected.dueCount > 0 ? (
              <NudgeButton
                audience="unconnected"
                label={`Nudge ${unconnected.dueCount} member${unconnected.dueCount === 1 ? " who hasn’t" : "s who haven’t"} connected`}
                hint="One email each, at most once a month: what connecting gives them, and the line on what others see."
              />
            ) : unconnected.lastSentAt && unconnected.nextAllowedAt ? (
              <NudgeSentNote sentAt={unconnected.lastSentAt} nextAt={unconnected.nextAllowedAt} />
            ) : (
              <p className="fh-small fh-muted mt-3">Every joined member has connected.</p>
            )}
            {!isConfigured || !isEmailOn || noAsks.audienceCount === 0 ? null : noAsks.dueCount > 0 ? (
              <NudgeButton
                audience="no_asks"
                label={`Nudge ${noAsks.dueCount} member${noAsks.dueCount === 1 ? "" : "s"} not allowing asks`}
                hint="The same email, asking them to let members ask for intros. At most once a month."
              />
            ) : noAsks.lastSentAt && noAsks.nextAllowedAt ? (
              <NudgeSentNote sentAt={noAsks.lastSentAt} nextAt={noAsks.nextAllowedAt} isNoAsks />
            ) : null}
          </section>

          <CostBox />
        </div>
      </div>
    </AdminSection>
  );
});
