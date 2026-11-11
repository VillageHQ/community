import { FileChartColumn, Plus, UserRoundPlus } from "lucide-react";
import Link from "next/link";

import { Avatar } from "@/components/ui/avatar";
import { Breakdown, KvTiles, Ledger, Meter, StatusChecklist, type CheckState } from "@/components/ui/figures";
import { Pill } from "@/components/ui/pill";
import { formatDayMonth } from "@/modules/admin/console-periods";
import { ASKS_ADMIN_PAGE } from "@/modules/asks/contract";
import { ROUTES } from "@/platform/http/routes";
import { VILLAGE_PLATFORM_LINKS } from "@/platform/village/links";
import type { AdminHomeItem } from "@/shell/admin-home";
import { ButtonLink, TextLink } from "@/shell/console-home-parts";
import { ResendInviteButton } from "@/shell/console-home-resend";
import type { ConsoleHome, IntroLedger } from "@/shell/console-home";

// The console's Home after launch (Founderhall's /admin): every intro counted, members, the latest of the intro log;
// beside them the network, lookups, asks and mail. Founderhall's parts and words.

const NUMBER = new Intl.NumberFormat("en-US");

function formatNumber(value: number) {
  return NUMBER.format(value);
}

function percentOf(part: number, whole: number) {
  return whole ? Math.round((part / whole) * 100) : 0;
}

function plural(count: number, one: string, many: string) {
  return count === 1 ? one : many;
}

// "Jonah Weiss" from jonah.weiss@example.com: an invite carries only the address.
export function readNameFromEmail(email: string) {
  const words = (email.split("@")[0] ?? "").split(/[._+-]+/).filter(Boolean);
  return words.length ? words.map((word) => word.charAt(0).toUpperCase() + word.slice(1)).join(" ") : email;
}

function IntroLedgerSheet({ ledger }: { ledger: IntroLedger }) {
  const max = Math.max(ledger.asked, 1);
  const bar = (value: number) => (value / max) * 100;
  return (
    <section className="fh-sheet" aria-labelledby="h-ledger">
      <div className="fh-sheet-head">
        <h2 className="fh-h3" id="h-ledger">
          Every intro, counted
        </h2>
        <TextLink href={ROUTES.adminReport}>Partner report</TextLink>
      </div>
      <Ledger
        rows={[
          { label: "Asked for an intro", value: formatNumber(ledger.asked), percent: bar(ledger.asked) },
          { label: "Connector said yes", value: formatNumber(ledger.connectorYes), share: ledger.asked ? `${percentOf(ledger.connectorYes, ledger.asked)}%` : undefined, percent: bar(ledger.connectorYes), tone: "yes" },
          { label: "Target said yes", value: formatNumber(ledger.made), share: ledger.connectorYes ? `${percentOf(ledger.made, ledger.connectorYes)}%` : undefined, percent: bar(ledger.made), tone: "yes" },
          { label: <b>Introduced</b>, value: formatNumber(ledger.made), percent: bar(ledger.made), tone: "made", hasBookmark: true },
          { label: "Declined", note: `${ledger.declinedByConnector} by connector, ${ledger.declinedByTarget} by target`, value: formatNumber(ledger.declined), percent: bar(ledger.declined), tone: "declined" },
          { label: "Still open", note: `${ledger.openWithConnector} with connector, ${ledger.openWithTarget} with target`, value: formatNumber(ledger.open), percent: bar(ledger.open), tone: "open" },
          {
            label: "Found it helpful",
            note: `${ledger.helpful} of ${ledger.answered} who answered`,
            value: ledger.answered ? `${percentOf(ledger.helpful, ledger.answered)}%` : "–",
            percent: percentOf(ledger.helpful, ledger.answered),
            tone: "helpful",
          },
        ]}
        foot={
          <>
            <span>Counted from the intro log.</span>
            <span>Nobody is introduced without saying yes.</span>
          </>
        }
      />
    </section>
  );
}

function MembersSheet({ members }: { members: ConsoleHome["members"] }) {
  return (
    <section className="fh-sheet">
      <div className="fh-sheet-head">
        <h2 className="fh-h3">Members</h2>
        <TextLink href={ROUTES.adminMembers}>All {formatNumber(members.joined + members.invited)}</TextLink>
      </div>
      <p className="fh-small">
        <b className="fh-num">{formatNumber(members.joined)}</b> joined · <b className="fh-num">{formatNumber(members.invited)}</b> invited, not signed in yet ·{" "}
        <b className="fh-num">{formatNumber(members.withProfile)}</b> with a profile
      </p>
      {members.waiting.length ? (
        <div className="fh-rows fh-members-rows" style={{ marginTop: 12 }}>
          {members.waiting.map(({ id, email }) => {
            const name = readNameFromEmail(email);
            return (
              <div key={id} className="fh-r">
                <Avatar stableId={id} name={name} />
                <div className="fh-who">
                  <b>{name}</b>
                  <span>{email}</span>
                </div>
                <div className="fh-end">
                  <Pill tone="open">Invited</Pill>
                  <ResendInviteButton inviteId={id} />
                </div>
              </div>
            );
          })}
        </div>
      ) : (
        <p className="fh-small fh-muted" style={{ marginTop: 10 }}>
          Nobody is waiting on an invite.
        </p>
      )}
      <div className="fh-btn-row" style={{ marginTop: 14 }}>
        <ButtonLink href={ROUTES.adminInvites} isSmall>
          <Plus aria-hidden="true" className="fh-i fh-xs" strokeWidth={1.5} />
          Add members
        </ButtonLink>
        <ButtonLink href="/admin/import" isSmall>
          Import a CSV
        </ButtonLink>
        <ButtonLink href={ROUTES.adminMembers} variant="quiet" isSmall>
          See all members
        </ButtonLink>
      </div>
    </section>
  );
}

function LatestIntrosSheet({ latest }: { latest: ConsoleHome["latest"] }) {
  return (
    <section className="fh-sheet">
      <div className="fh-sheet-head">
        <h2 className="fh-h3">Latest in the intro log</h2>
        <TextLink href={ROUTES.adminIntroLog}>Intro log</TextLink>
      </div>
      {latest.length ? (
        <div className="fh-rows">
          {latest.map((row) => (
            <div key={row.id} className="fh-r">
              <div className="fh-who">
                <b>{`${row.asker} → ${row.target}`}</b>
                <span>{`via ${row.connector} · ${row.stateWord}`}</span>
              </div>
              <div className="fh-end">
                <small>{formatDayMonth(row.askedAt)}</small>
              </div>
            </div>
          ))}
        </div>
      ) : (
        <div className="fh-empty">
          <h2 className="fh-h2">The intro log is empty</h2>
          <p>Each intro a member asks for lands here with its state and dates. The notes members write stay between the people in each intro.</p>
        </div>
      )}
    </section>
  );
}

function NetworkSheet({ network, joined, invited, isConfigured }: { network: NonNullable<ConsoleHome["network"]>; joined: number; invited: number; isConfigured: boolean }) {
  const share = percentOf(network.connected, joined);
  return (
    <section className="fh-sheet">
      <div className="fh-sheet-head">
        <h2 className="fh-h3">Members who connected their network</h2>
        <TextLink href={ROUTES.adminVillage}>Nudge</TextLink>
      </div>
      <Meter figure={formatNumber(network.connected)} figureNote={`of ${formatNumber(joined)} joined ${plural(joined, "member", "members")} · ${share}%`} percent={share} />
      <Breakdown
        items={[
          { label: "Sharing with the community", value: formatNumber(network.sharing) },
          { label: "Connected, not allowing asks", value: formatNumber(network.noAsks) },
          { label: "Still syncing", value: formatNumber(network.syncing) },
          { label: "Joined, not connected", value: formatNumber(Math.max(0, joined - network.connected - network.syncing)) },
          { label: "Invited, not signed in", value: formatNumber(invited) },
        ]}
      />
      <p className="fh-small fh-muted" style={{ marginTop: 12 }}>
        {isConfigured ? "Paths come from members who connect and agree to share. Each one makes search warmer for everyone." : "Village is not connected, so nobody can connect a network yet."}
      </p>
    </section>
  );
}

function LookupsSheet({ lookups }: { lookups: NonNullable<ConsoleHome["lookups"]> }) {
  const share = lookups.cap ? Math.min(100, (lookups.used / lookups.cap) * 100) : 0;
  return (
    <section className="fh-sheet">
      <div className="fh-sheet-head">
        <h2 className="fh-h3">Lookups this month</h2>
        <TextLink href={ROUTES.adminVillage}>Village settings</TextLink>
      </div>
      <Meter
        figure={formatNumber(lookups.used)}
        figureNote={lookups.isConfigured ? `lookups used this month, of ${formatNumber(lookups.cap)}` : "no Village key"}
        percent={share}
        mark={{ percent: 80, label: "80% warning" }}
        isInk
      />
      <Breakdown
        items={[
          { label: "Search", value: formatNumber(lookups.search) },
          { label: "Paths", value: formatNumber(lookups.paths) },
          { label: "Path checks", value: formatNumber(0) },
          { label: "Profile fill-in", value: formatNumber(lookups.fillIn) },
        ]}
      />
      {lookups.used >= lookups.cap ? (
        <div className="fh-note fh-needs" style={{ marginTop: 12 }}>
          <span>
            <b>The cap is reached.</b> Village calls are paused until the 1st, or until you raise the cap.
          </span>
        </div>
      ) : lookups.used >= lookups.cap * 0.8 ? (
        <div className="fh-note fh-needs" style={{ marginTop: 12 }}>
          <span>
            <b>{Math.round(share)}% of the cap is used.</b> Calls stop at {formatNumber(lookups.cap)}.
          </span>
        </div>
      ) : null}
      <p className="fh-small fh-muted" style={{ marginTop: 12 }}>
        {lookups.used ? `On pace for about ${formatNumber(lookups.pace)} this month. ` : ""}Counted by this portal for every lookup it makes;{" "}
        <a href={VILLAGE_PLATFORM_LINKS.usage} className="text-fund underline decoration-1 underline-offset-[3px] hover:text-fund-deep">
          Village’s own usage log
        </a>{" "}
        is the record. Each member can use up to {formatNumber(lookups.dailyLimit)} a day.
      </p>
    </section>
  );
}

function hoursWord(hours: number | null) {
  if (hours === null) return "–";
  if (hours < 1) return "under an hour";
  if (hours < 48) return `${Math.round(hours)} ${plural(Math.round(hours), "hour", "hours")}`;
  return `${Math.round((hours / 24) * 10) / 10} days`;
}

function AsksSheet({ asks }: { asks: NonNullable<ConsoleHome["asks"]> }) {
  return (
    <section className="fh-sheet">
      <div className="fh-sheet-head">
        <h2 className="fh-h3">Asks &amp; updates</h2>
        <TextLink href={ASKS_ADMIN_PAGE}>Asks &amp; digest</TextLink>
      </div>
      <KvTiles
        className="fh-askkv"
        tiles={[
          { value: formatNumber(asks.open), label: "open asks" },
          { value: formatNumber(asks.answered), label: "answered", isGood: true },
          { value: hoursWord(asks.medianHours), label: "median time to first help" },
          { value: formatNumber(asks.posted), label: `asks posted${asks.withHelpers ? `, ${formatNumber(asks.withHelpers)} with members who can help` : ""}` },
        ]}
      />
      <p className="fh-small fh-muted" style={{ marginTop: 10 }}>
        {`${formatNumber(asks.helped)} asks got an offer of help; ${formatNumber(asks.intros)} ${plural(asks.intros, "intro", "intros")} started from asks, ${formatNumber(asks.introsMade)} made. ${formatNumber(asks.updates)} ${plural(asks.updates, "update", "updates")}.`}
      </p>
    </section>
  );
}

function MailSheet({ mail }: { mail: ConsoleHome["mail"] }) {
  const recentState: CheckState = !mail.isSet ? "watch" : mail.failed ? "fail" : mail.sent ? "ok" : "watch";
  return (
    <section className="fh-sheet">
      <div className="fh-sheet-head">
        <h2 className="fh-h3">{mail.domain ? `Mail from ${mail.domain}` : "Mail"}</h2>
        <TextLink href={ROUTES.adminMail}>Mail checklist</TextLink>
      </div>
      <StatusChecklist
        items={[
          {
            key: "service",
            state: mail.isSet ? "ok" : "fail",
            title: "Mail service (Resend)",
            value: mail.isSet ? (mail.isDemo ? "Set: the demo keeps mail in its sending log" : "Set: Resend") : "Not set: invites show a link to copy",
            status: mail.isSet ? "set" : "not set",
          },
          { key: "domain", state: mail.address ? "ok" : "watch", title: "Sending domain", value: mail.address ?? "Not set (Settings)", status: mail.address ? "set" : "not set" },
          {
            key: "recent",
            state: recentState,
            title: "Recent sends",
            value: !mail.isSet ? "Nothing is sent while mail is off" : mail.sent + mail.failed ? `${mail.sent} sent, ${mail.failed} failed lately` : "Nothing sent yet",
            status: !mail.isSet ? "off" : mail.sent + mail.failed ? (mail.failed ? `${mail.failed} failed` : "pass") : "none yet",
          },
          { key: "dns", state: "watch", title: "SPF, DKIM and DMARC", value: "Run Mail › Check DNS now", status: "not checked yet" },
        ]}
      />
    </section>
  );
}

// What needs the admin (Community's own: reports waiting, people waiting for an OK, Village trouble, stuck intros):
// one note above the dashboard, each item a link.
function NeedsYouNote({ items }: { items: readonly AdminHomeItem[] }) {
  if (items.length === 0) return null;
  return (
    <div className="fh-note fh-needs" style={{ marginBottom: 16 }} data-testid="admin-home-needs-you">
      <span>
        {items.map(({ id, label, href }, index) => (
          <span key={id} data-item={id}>
            {index > 0 ? " · " : null}
            <Link href={href} className="underline decoration-1 underline-offset-[3px]">
              {label}
            </Link>
          </span>
        ))}
      </span>
    </div>
  );
}

type AdminHomeViewProps = { communityName: string; home: ConsoleHome; items: readonly AdminHomeItem[] };

export function AdminHomeView({ communityName, home, items }: AdminHomeViewProps) {
  const { ledger, members } = home;
  return (
    <>
      <div className="fh-pagehead">
        <h1 className="fh-h1" data-testid="admin-home-intros">
          <span className="fh-nw">{formatNumber(ledger.asked)} asked,</span> <span className="fh-nw">{formatNumber(ledger.made)} made,</span>{" "}
          <span className="fh-nw">{formatNumber(ledger.declined)} declined</span>
        </h1>
        <p className="fh-lede">
          {communityName} intros since launch.{" "}
          {ledger.asked ? `${formatNumber(ledger.open)} still open.` : "No intros yet: members ask for one from a member’s profile, and every one is counted here."}
        </p>
        <div className="fh-btn-row" style={{ marginTop: 14 }}>
          <ButtonLink href={ROUTES.adminReport} variant="primary" isSmall>
            <FileChartColumn aria-hidden="true" className="fh-i fh-xs" strokeWidth={1.5} />
            Partner report
          </ButtonLink>
          <ButtonLink href={ROUTES.adminInvites} isSmall>
            <UserRoundPlus aria-hidden="true" className="fh-i fh-xs" strokeWidth={1.5} />
            Invite members
          </ButtonLink>
        </div>
      </div>
      <NeedsYouNote items={items} />
      <div className="fh-grid fh-console-home">
        <div className="fh-c7 fh-stack">
          {home.isIntrosOn ? <IntroLedgerSheet ledger={ledger} /> : null}
          <MembersSheet members={members} />
          {home.isIntrosOn ? <LatestIntrosSheet latest={home.latest} /> : null}
        </div>
        <div className="fh-c5 fh-stack">
          {home.network ? <NetworkSheet network={home.network} joined={members.joined} invited={members.invited} isConfigured={home.lookups?.isConfigured ?? false} /> : null}
          {home.lookups ? <LookupsSheet lookups={home.lookups} /> : null}
          {home.asks ? <AsksSheet asks={home.asks} /> : null}
          <MailSheet mail={home.mail} />
        </div>
      </div>
    </>
  );
}
