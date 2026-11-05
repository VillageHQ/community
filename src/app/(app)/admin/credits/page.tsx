import { CircleAlert, ExternalLink } from "lucide-react";
import type { Metadata } from "next";
import type { ReactNode } from "react";

import { Button } from "@/components/ui/button";
import { Card, CardDescription, CardTitle } from "@/components/ui/card";
import { Tag } from "@/components/ui/tag";
import { getDatabase } from "@/platform/database/client";
import { CREDITS_PER_FULL_SEARCH, CREDITS_PER_PATH_LOOKUP, USD_PER_CREDIT } from "@/modules/network/contract";
import { describeCreditEstimate, estimateCreditCost, formatDollars, readCreditUsage } from "@/modules/network/reads-credits";
import { VILLAGE_PLATFORM_LINKS } from "@/platform/village/links";
import { PAGE_TITLES } from "@/platform/branding/page-metadata";
import { formatDateAndTimeUtc, formatLongDate } from "@/platform/text/format-date";
import { requireAdmin } from "@/platform/auth/session";
import { readDailyLookupLimit, readVillageOutOfCreditsAt } from "@/platform/village/settings";

import { AdminSection } from "@/app/(app)/admin/admin-section";
import { StatRows } from "@/app/(app)/admin/stat-rows";
import { DailyLimitForm } from "@/modules/network/components/daily-limit-form";

function ExternalButton({ href, children, isPrimary = false }: { href: string; children: ReactNode; isPrimary?: boolean }) {
  return (
    <Button asChild variant={isPrimary ? "primary" : "outline"} className="max-sm:w-full">
      <a href={href} target="_blank" rel="noreferrer">
        {children}
        <ExternalLink aria-hidden="true" />
        <span className="sr-only"> (opens in a new tab)</span>
      </a>
    </Button>
  );
}

function OutOfCreditsNotice({ outOfCreditsAt }: { outOfCreditsAt: string }) {
  return (
    <Card className="grid gap-3 shadow-[inset_0_0_0_2.5px_var(--destructive-text),var(--elevation-panel)]">
      <h2 className="type-h3 flex items-center gap-2 text-destructive-text">
        <CircleAlert aria-hidden="true" className="size-5 shrink-0" />
        Village says you&apos;re out of credits
      </h2>
      <p className="text-foreground-soft">
        A member&apos;s lookup was refused on {formatDateAndTimeUtc(outOfCreditsAt)} because this Village app has no credits left. Members see a friendly note, and network search
        and intro paths won&apos;t work until you buy more. This clears by itself after the next lookup that works.
      </p>
      <div>
        <ExternalButton href={VILLAGE_PLATFORM_LINKS.buyCredits} isPrimary>
          Buy credits on Village
        </ExternalButton>
      </div>
    </Card>
  );
}

type UsageTableProps = { caption: string; headers: string[]; rows: { key: string; cells: ReactNode[] }[] };

function UsageTable({ caption, headers, rows }: UsageTableProps) {
  return (
    <div className="overflow-x-auto rounded-field" tabIndex={0} role="region" aria-label={caption}>
      <table className="w-full border-separate border-spacing-0 text-left">
        <caption className="sr-only">{caption}</caption>
        <thead>
          <tr>
            {headers.map((header, position) => (
              <th key={header} scope="col" className={`type-small border-b border-border px-2 py-2.5 sm:px-3 font-bold text-foreground-soft ${position > 0 ? "text-right" : ""}`}>
                {header}
              </th>
            ))}
          </tr>
        </thead>
        <tbody>
          {rows.map(({ key, cells }) => (
            <tr key={key}>
              {cells.map((cell, position) => (
                <td key={position} className={`border-b border-border px-2 py-3 sm:px-3 ${position > 0 ? "text-right tabular-nums" : "font-semibold wrap-anywhere"}`}>
                  {cell}
                </td>
              ))}
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}

function EmptyUsage() {
  return <p className="type-small rounded-field bg-muted px-4 py-3.5 text-foreground-soft">No lookups yet. They&apos;ll appear here once members search the network.</p>;
}

export const metadata: Metadata = { title: PAGE_TITLES.adminCredits };

export default async function AdminCreditsPage() {
  await requireAdmin();
  const database = getDatabase();
  const [usage, limit, outOfCreditsAt] = await Promise.all([
    readCreditUsage(database),
    readDailyLookupLimit(database),
    readVillageOutOfCreditsAt(database),
  ]);
  const hiddenMemberCount = usage.spendingMemberCount - usage.members.length;

  return (
    <AdminSection title="Credits" description="What your members spent, and where to check your balance.">
      <div className="grid items-start gap-5 lg:grid-cols-2">
        {outOfCreditsAt ? (
          <div className="lg:col-span-2">
            <OutOfCreditsNotice outOfCreditsAt={outOfCreditsAt} />
          </div>
        ) : null}

        <Card className="grid gap-4">
          <div className="grid gap-1.5">
            <CardTitle>Last {usage.windowDays} days</CardTitle>
            <CardDescription>
              A lookup is one network search, or one set of intro paths this site hadn&apos;t already saved.
            </CardDescription>
          </div>
          <StatRows
            rows={[
              {
                value: usage.totalLookups.toLocaleString("en-US"),
                label: "Lookups",
                note: describeCreditEstimate({ searches: usage.totalSearches, pathLookups: usage.totalPathLookups }),
              },
              { value: usage.totalSearches.toLocaleString("en-US"), label: "Searches" },
              { value: usage.totalPathLookups.toLocaleString("en-US"), label: "Intro path lookups" },
              { value: usage.spendingMemberCount.toLocaleString("en-US"), label: "Members who used lookups" },
            ]}
          />
          <p className="type-small text-foreground-soft">
            This is an estimate, at ${USD_PER_CREDIT.toFixed(2)} a credit. It counts about {CREDITS_PER_FULL_SEARCH} credits for a full search and {CREDITS_PER_PATH_LOOKUP} for a set of
            intro paths. A search that finds fewer people costs less. Village&apos;s platform has the exact amount.
          </p>
        </Card>

        <Card className="grid gap-4">
          <div className="grid gap-1.5">
            <CardTitle>Your credit balance</CardTitle>
            <CardDescription>
              This site doesn&apos;t show your balance. You&apos;ll find it on Village&apos;s platform, along with your exact usage. Your community
              spends the credits of your Village app.
            </CardDescription>
          </div>
          <div className="flex flex-wrap gap-2">
            <ExternalButton href={VILLAGE_PLATFORM_LINKS.usage} isPrimary>
              See usage on Village
            </ExternalButton>
            <ExternalButton href={VILLAGE_PLATFORM_LINKS.buyCredits}>Buy credits</ExternalButton>
          </div>
        </Card>

        <Card className="grid gap-4 lg:col-span-2">
          <div className="grid gap-1.5">
            <CardTitle>Daily limit</CardTitle>
            <CardDescription>Stops one member from spending all your credits. Each member can use up to {limit} lookups a day right now.</CardDescription>
          </div>
          <DailyLimitForm currentLimit={limit} />
        </Card>

        <Card className="grid gap-4">
          <CardTitle>Lookups per day</CardTitle>
          {usage.days.length === 0 ? (
            <EmptyUsage />
          ) : (
            <UsageTable
              caption="Lookups per day, with an estimated cost"
              headers={["Day (UTC)", "Searches", "Paths", "Estimate"]}
              rows={usage.days.map(({ usageDate, searches, pathLookups }) => ({
                key: usageDate,
                cells: [formatLongDate(usageDate), searches, pathLookups, formatDollars(estimateCreditCost({ searches, pathLookups }).dollars)],
              }))}
            />
          )}
        </Card>

        <Card className="grid gap-4">
          <CardTitle>Lookups per member</CardTitle>
          {usage.members.length === 0 ? (
            <EmptyUsage />
          ) : (
            <UsageTable
              caption={`Lookups per member. Today, then searches and paths over the last ${usage.windowDays} days`}
              headers={["Member", "Today", "Searches", "Paths"]}
              rows={usage.members.map(({ id, name, isRemoved, lookupsToday, searches, pathLookups }) => ({
                key: id,
                cells: [
                  <span key="name" className="inline-flex flex-wrap items-center gap-2">
                    {name}
                    {isRemoved ? <Tag tone="destructive">Removed</Tag> : null}
                  </span>,
                  lookupsToday,
                  searches,
                  pathLookups,
                ],
              }))}
            />
          )}
          {hiddenMemberCount > 0 ? <p className="type-small text-foreground-soft">Showing the top {usage.members.length}. {hiddenMemberCount} more used fewer lookups.</p> : null}
        </Card>
      </div>
    </AdminSection>
  );
}
