import { CircleCheck, EyeOff, KeyRound } from "lucide-react";
import type { ReactNode } from "react";

import { Breakdown, Meter } from "@/components/ui/figures";
import { Note } from "@/components/ui/note";
import { Pill } from "@/components/ui/pill";
import { formatDayMonth, formatDayMonthTimeUtc } from "@/platform/text/format-date";
import { VILLAGE_PLATFORM_LINKS } from "@/platform/village/links";

import { isConnectedStatus, MEMBER_CHECK_OUTCOMES, VILLAGE_CHECK_GROUP, VILLAGE_CHECK_KEYS } from "../contract-village-check";
import type { VillageCheckRead } from "../reads-village-check";
import { PUBLIC_KEY_HINT, SECRET_KEY_HINT } from "../contract-village-admin";
import type { readLookupsThisMonth, readNetworkReach } from "../reads-village-admin";
import type { FillInLastRun } from "../service-village-admin";

// Admin › Village (Founderhall's page, `village/views.mjs`): the parts with no form. The forms are in
// admin-village-forms.tsx; the page is src/app/(app)/admin/village/page.tsx.

const NUMBER = new Intl.NumberFormat("en-US");
const n = (value: number) => NUMBER.format(value);

// Where "Full pricing" goes: the source repository's README (Community has no pricing page of its own).
export const PRICING_URL = "https://github.com/VillageHQ/community#readme";

// The member-facing promise, word for word as members read it.
export const NETWORK_LINE =
  "Members who search can see that you know a person and ask you for an intro. They can’t download your contacts, see how you know them beyond a warmth word, or reach anyone without your yes.";

// Self-host honesty: what runs with no key, what needs a Village plan (Founderhall's `selfHostBox`).
export function SelfHostBox() {
  return (
    <section className="fh-sheet fh-selfhost" id="self-host">
      <h2 className="type-h3 flex items-center gap-1.5">
        <KeyRound aria-hidden="true" className="fh-i fh-s" strokeWidth={1.5} /> Running it yourself
      </h2>
      <p className="fh-small mt-2">
        <b>Works without any key:</b> directory, profiles members fill in, asks, intros between members, messages.
      </p>
      <p className="fh-small mt-1.5">
        <b>Needs a Village plan:</b> profile fill-in, warm paths, search beyond members.
      </p>
      <p className="fh-small mt-2.5">
        <CircleCheck aria-hidden="true" className="fh-i fh-xs inline" strokeWidth={1.5} /> <b>Managed plan:</b> Village sets up the mail domain and lookups for you in week 1.{" "}
        <a href={PRICING_URL}>Full pricing on the Founderhall site</a>
      </p>
    </section>
  );
}

const KEY_LINES: Record<string, string> = {
  [VILLAGE_CHECK_KEYS.rejected]: "Keys rejected: Village refused the secret key.",
  [VILLAGE_CHECK_KEYS.mismatched]: "The public key does not belong to this secret key’s app.",
  [VILLAGE_CHECK_KEYS.missing]: "No keys yet: add your Village keys first.",
  [VILLAGE_CHECK_KEYS.unreachable]: "Village didn’t answer, so the keys couldn’t be checked.",
};

function plural(count: number, one: string, many: string) {
  return `${count} ${count === 1 ? one : many}`;
}

function readGroupLine(check: NonNullable<VillageCheckRead["check"]>) {
  if (check.group === VILLAGE_CHECK_GROUP.found) return `The community group exists, with ${plural(check.groupMemberCount ?? 0, "member", "members")} in it.`;
  if (check.group === VILLAGE_CHECK_GROUP.missing) return "The community group wasn’t found: no member Village was asked about is in it.";
  if (check.group === VILLAGE_CHECK_GROUP.none) return "No community group yet.";
  return "";
}

// The last "Test the connection" (Community's Village check), as Founderhall's test note, with each member's answer.
export function ConnectionTestResult({ check, members }: Pick<VillageCheckRead, "check" | "members">) {
  if (!check) return null;
  const isOk = check.keys === VILLAGE_CHECK_KEYS.ok;
  const started = members.filter(({ outcome }) => outcome !== MEMBER_CHECK_OUTCOMES.notStarted);
  const connected = started.filter(({ isProvisioned, networkStatus }) => isProvisioned && isConnectedStatus(networkStatus)).length;
  const text = isOk ? "Connected to your Village app." : (KEY_LINES[check.keys ?? VILLAGE_CHECK_KEYS.unreachable] ?? KEY_LINES[VILLAGE_CHECK_KEYS.unreachable]);
  return (
    <>
      <Note kind={isOk ? "ok" : "needs"} className="mt-3">
        {text} {isOk ? `${readGroupLine(check)} ${connected} of ${plural(started.length, "member", "members")} who started have connected. ` : ""}
        <span className="fh-muted">Tested {formatDayMonthTimeUtc(check.checkedAt ?? check.startedAt)}.</span>
      </Note>
      {members.length > 0 ? (
        <details className="mt-2.5">
          <summary className="fh-small">What Village said about each member</summary>
          <ul className="fh-hist fh-small mt-1.5" aria-label="Members">
            {members.map((member) => (
              <li key={member.userId} data-member-check={member.email}>
                <span>
                  <b>{member.name}</b> · {member.email}
                </span>
                <span>{describeMemberCheck(member, isOk)}</span>
              </li>
            ))}
          </ul>
        </details>
      ) : null}
    </>
  );
}

function describeMemberCheck(member: VillageCheckRead["members"][number], areKeysOk: boolean) {
  if (member.outcome === MEMBER_CHECK_OUTCOMES.notStarted) return "hasn’t started connecting, so Village wasn’t asked";
  if (member.outcome === MEMBER_CHECK_OUTCOMES.unreachable) return areKeysOk ? "Village didn’t answer in time" : "not asked: the keys didn’t work";
  if (!member.isProvisioned) return "no Village user";
  const network = member.networkStatus === "needs_attention" ? "connected, needs to reconnect" : isConnectedStatus(member.networkStatus) ? "connected" : member.networkStatus === "syncing" ? "syncing" : "not connected";
  return `${network}, ${member.isInGroup ? "in the group" : "not in the group"}`;
}

export function FillInLastRunLine({ lastRun }: { lastRun: FillInLastRun | null }) {
  if (!lastRun) return <p className="fh-small fh-muted mt-2">Not run yet.</p>;
  const failed = lastRun.failed ? `, ${n(lastRun.failed)} failed` : "";
  const stopped = lastRun.stoppedBy ? `, stopped: ${lastRun.stoppedBy.replaceAll("_", " ")}` : "";
  return (
    <p className="fh-small fh-muted mt-2">
      Last run {formatDayMonthTimeUtc(lastRun.finishedAt)} ({lastRun.trigger}): {n(lastRun.checked)} checked, {n(lastRun.found)} found, {n(lastRun.notFound)} not found{failed}
      {stopped}.
    </p>
  );
}

export function WhatVillageSees() {
  const items: { key: string; lead: string; text: ReactNode }[] = [
    {
      key: "connects",
      lead: "When a member connects:",
      text: "their email and a portal number (a random ID), so Village can make their account under the community’s Village app. Village may bill your community per connected member. The price is not in Village’s docs yet.",
    },
    {
      key: "screen",
      lead: "On Village’s own screen",
      text: "the member connects Google (contacts and calendar attendees, read-only; Village never reads email content) and, on a desktop with Village’s Chrome extension, LinkedIn.",
    },
    {
      key: "shares",
      lead: "When a member agrees to share:",
      text: "they join the community’s Village group. Village’s docs say their contacts then become visible to every current and future member of the group, as paths. This portal shows only that a member can introduce someone, with a warmth word, and only through members who agreed.",
    },
    { key: "fill-in", lead: "Profile fill-in:", text: "each member’s email is looked up at Village. Village’s docs say an email it doesn’t know “is sent to Apollo.io to identify its owner”." },
    { key: "search", lead: "Search:", text: "what members type, and the LinkedIn addresses of the people found, to find paths." },
    {
      key: "never",
      lead: "Never stored here:",
      text: "anyone’s contact list. The portal keeps its members, their profile lines, the paths it showed for a day, and these credit counts.",
    },
  ];
  return (
    <section className="fh-sheet">
      <h2 className="type-h3">What Village sees</h2>
      <ul className="fh-hist fh-small">
        {items.map((item) => (
          <li key={item.key}>
            <span>
              <b>{item.lead}</b> {item.text}
            </span>
          </li>
        ))}
      </ul>
      <p className="fh-small fh-muted mt-2">What members are told: “{NETWORK_LINE}”</p>
    </section>
  );
}

type Lookups = Awaited<ReturnType<typeof readLookupsThisMonth>>;

type CreditMeterProps = {
  lookups: Lookups;
  used: number;
  cap: number;
  isConfigured: boolean;
  dailyLimit: number;
  outOfCreditsAt: string | null;
  now?: Date;
};

// "Lookups this month" (Founderhall's `creditMeter`): the month's credits against the cap, by kind, and the pace.
export function CreditMeter({ lookups, used, cap, isConfigured, dailyLimit, outOfCreditsAt, now = new Date() }: CreditMeterProps) {
  const share = cap ? Math.min(100, (used / cap) * 100) : 0;
  const day = now.getUTCDate();
  const days = new Date(Date.UTC(now.getUTCFullYear(), now.getUTCMonth() + 1, 0)).getUTCDate();
  const pace = used ? Math.round((used / day) * days) : 0;
  return (
    <>
      <div className="fh-sheet-head">
        <h2 className="type-h3">Lookups this month</h2>
      </div>
      <Meter
        figure={n(used)}
        figureNote={isConfigured ? `lookups used this month, of ${n(cap)}` : "no Village key"}
        percent={share}
        mark={{ percent: 80, label: "80% warning" }}
        isInk
      />
      <Breakdown
        items={[
          { label: "Search", value: n(lookups.search) },
          { label: "Paths", value: n(lookups.paths) },
          { label: "Path checks", value: n(0) },
          { label: "Profile fill-in", value: n(lookups.fillIn) },
        ]}
      />
      {used >= cap ? (
        <Note kind="needs" className="mt-3">
          <b>The cap is reached.</b> Village calls are paused until the 1st, or until you raise the cap.
        </Note>
      ) : used >= cap * 0.8 ? (
        <Note kind="needs" className="mt-3">
          <b>{Math.round(share)}% of the cap is used.</b> Calls stop at {n(cap)}.
        </Note>
      ) : null}
      {outOfCreditsAt ? (
        <Note kind="needs" className="mt-3">
          Village said the credits ran out on {formatDayMonth(outOfCreditsAt)}. <a href={VILLAGE_PLATFORM_LINKS.buyCredits}>Top up at Village</a>
        </Note>
      ) : null}
      <p className="fh-small fh-muted mt-3">
        {used ? `On pace for about ${n(pace)} this month. ` : ""}Counted by this portal for every lookup it makes; <a href={VILLAGE_PLATFORM_LINKS.usage}>Village’s own usage log</a> is the
        record. Each member can use up to {n(dailyLimit)} a day.
      </p>
    </>
  );
}

export function LatestLookups({ latest }: { latest: Lookups["latest"] }) {
  if (latest.length === 0) return null;
  return (
    <table className="fh-tbl mt-3.5">
      <thead>
        <tr>
          <th>Latest lookups</th>
          <th className="fh-n">Used</th>
        </tr>
      </thead>
      <tbody>
        {latest.map((lookup) => (
          <tr key={lookup.id}>
            <td>
              {lookup.label}
              <span className="fh-small fh-muted block">
                {formatDayMonthTimeUtc(lookup.calledAt)}
                {lookup.memberName ? ` · ${lookup.memberName}` : ""}
              </span>
            </td>
            <td className="fh-n">{n(lookup.credits)}</td>
          </tr>
        ))}
      </tbody>
    </table>
  );
}

type MemberUsage = { id: string; name: string; isRemoved: boolean; lookupsToday: number; searches: number; pathLookups: number };

// Community's per-member spend (the old Credits page), kept under the latest lookups.
export function LookupsPerMember({ members, windowDays }: { members: MemberUsage[]; windowDays: number }) {
  if (members.length === 0) return null;
  return (
    <details className="mt-3">
      <summary className="fh-small">Lookups per member, last {windowDays} days</summary>
      <table className="fh-tbl mt-2">
        <thead>
          <tr>
            <th>Member</th>
            <th className="fh-n">Today</th>
            <th className="fh-n">Searches</th>
            <th className="fh-n">Paths</th>
          </tr>
        </thead>
        <tbody>
          {members.map((member) => (
            <tr key={member.id}>
              <td>
                {member.name}
                {member.isRemoved ? <span className="fh-small fh-muted"> · removed</span> : null}
              </td>
              <td className="fh-n">{n(member.lookupsToday)}</td>
              <td className="fh-n">{n(member.searches)}</td>
              <td className="fh-n">{n(member.pathLookups)}</td>
            </tr>
          ))}
        </tbody>
      </table>
    </details>
  );
}

type Reach = Awaited<ReturnType<typeof readNetworkReach>>;

// "Members who connected their network" (Founderhall's `networkMeter`).
export function NetworkMeter({ reach, isConfigured }: { reach: Reach; isConfigured: boolean }) {
  return (
    <>
      <div className="fh-sheet-head">
        <h2 className="type-h3">Members who connected their network</h2>
      </div>
      <Meter figure={n(reach.connected)} figureNote={`of ${n(reach.joined)} joined member${reach.joined === 1 ? "" : "s"} · ${reach.percent}%`} percent={reach.percent} />
      <Breakdown
        items={[
          { label: "Sharing with the community", value: n(reach.sharing) },
          { label: "Connected, not allowing asks", value: n(reach.noAsks) },
          { label: "Still syncing", value: n(reach.syncing) },
          { label: "Joined, not connected", value: n(reach.notConnected) },
          { label: "Invited, not signed in", value: n(reach.invited) },
        ]}
      />
      <p className="fh-small fh-muted mt-3">
        {isConfigured
          ? "Paths come from members who connect and agree to share. Each one makes search warmer for everyone."
          : "Village is not connected, so nobody can connect a network yet."}
      </p>
    </>
  );
}

export function NudgeSentNote({ sentAt, nextAt, isNoAsks = false }: { sentAt: Date; nextAt: Date; isNoAsks?: boolean }) {
  return (
    <Note kind="ok" className="mt-3">
      {isNoAsks ? `Members not allowing asks were nudged ${formatDayMonthTimeUtc(sentAt)}.` : `Nudge sent ${formatDayMonthTimeUtc(sentAt)}.`} The next one is allowed from{" "}
      {formatDayMonth(nextAt)}.
    </Note>
  );
}

// Email off: a nudge can't go out. Community-only (Founderhall always has mail).
export function NudgeNeedsEmail() {
  return (
    <Note kind="needs" icon={EyeOff} className="mt-3">
      Nudges go by email. Set up Mail first.
    </Note>
  );
}

// "What this costs" (Founderhall's `costBox`): the two plans and their prices, word for word.
export function CostBox() {
  return (
    <section className="fh-sheet fh-costbox" id="cost">
      <h2 className="type-h3">What this costs</h2>
      <dl className="fh-costs">
        <div>
          <dt>Managed plan</dt>
          <dd>
            $1,000 a month billed yearly, or $1,200 month to month. Up to 500 members. 7,500 lookups a month included. Urgent issues answered within 2 business hours.
          </dd>
        </div>
        <div>
          <dt>Self-host</dt>
          <dd>
            Free. Lookups and warm paths use your own Village plan: 100 free a month, then about $0.02 a lookup credit (a search costs about 5, a path check 5).
          </dd>
        </div>
      </dl>
      <p className="fh-small fh-muted mt-2.5">A lookup is a profile fill-in, a search or a path check. The meter shows how many this month.</p>
      <p className="fh-small mt-2">
        <a href={PRICING_URL}>Full pricing on the Founderhall site</a>
      </p>
    </section>
  );
}

// Saved keys, as Founderhall shows keys it already has: a line each, no field (replacing them is under the address).
export function SavedKeyLines() {
  return (
    <>
      <div className="mt-3">
        <h3 className="fh-label">Secret key</h3>
        <p className="fh-hint">
          set on the server · <span className="text-ink">{SECRET_KEY_HINT}</span>
        </p>
      </div>
      <div className="mt-3">
        <h3 className="fh-label">Public key</h3>
        <p className="fh-hint">
          set on the server · <span className="text-ink">{PUBLIC_KEY_HINT}</span>
        </p>
      </div>
    </>
  );
}

export function ConnectionHead({ isConfigured }: { isConfigured: boolean }) {
  return (
    <div className="fh-sheet-head">
      <h2 className="type-h3">Connection</h2>
      <Pill tone={isConfigured ? "made" : "open"}>{isConfigured ? "Connected" : "Not connected"}</Pill>
    </div>
  );
}
