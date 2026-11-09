import type { Metadata } from "next";

import { Card, CardDescription, CardTitle } from "@/components/ui/card";
import { getDatabase } from "@/platform/database/client";
import { readCommunityHealth } from "@/modules/admin/reads-health";
import { PAGE_TITLES } from "@/platform/branding/page-metadata";
import { requireAdmin } from "@/platform/auth/session";

import { AdminSection } from "@/shell/admin-section";
import { IntroCountsCard } from "@/modules/admin/components/intro-counts-card";
import { StatRows } from "@/modules/admin/components/stat-rows";
import { adminManifest } from "@/modules/admin/manifest";
import { introsManifest } from "@/modules/intros/manifest";
import { networkManifest } from "@/modules/network/manifest";
import { readEnabledIds } from "@/shell/enabled-modules";
import { readConnectMeter } from "@/modules/network/service-nudge";
import { ConnectNudgeButton } from "@/modules/network/components/connect-nudge-button";
import { UsageMeter } from "@/modules/network/components/usage-meter";
import { readResendConfig } from "@/platform/email/resend";
import { modulePage } from "@/platform/modules/module-page";

const ACTIVE_MEMBER_MEANING = "An active member posted, replied, reacted, sent a message or asked for an intro. Reading doesn't count, because this site doesn't track it.";

type CommunityHealth = Awaited<ReturnType<typeof readCommunityHealth>>;

function readInviteHeadline({ accepted, sent, acceptedPercent }: CommunityHealth["invites"]) {
  if (acceptedPercent === null) return "No invites sent yet.";
  return `${accepted} of ${sent} invites accepted, or ${acceptedPercent}%. Revoked invites don't count.`;
}

export const metadata: Metadata = { title: PAGE_TITLES.adminHealth };

function NetworkReachCard({ meter }: { meter: Awaited<ReturnType<typeof readConnectMeter>> }) {
  const { memberCount, connectedCount, unconnectedCount, nudgeableCount } = meter;
  return (
    <Card className="grid gap-4 lg:col-span-2">
      <div className="grid gap-1.5">
        <CardTitle>Who members can ask for intros</CardTitle>
        <CardDescription>
          Members who connected their network and share it with the community, so others can ask them for an intro. {unconnectedCount} haven&apos;t connected yet.
        </CardDescription>
      </div>
      <UsageMeter
        label="Connected and open to intro asks"
        value={connectedCount}
        maximum={Math.max(memberCount, 1)}
        valueText={`${connectedCount} of ${memberCount} members`}
      />
      <ConnectNudgeButton nudgeableCount={nudgeableCount} isEmailOn={readResendConfig(process.env) !== null} />
    </Card>
  );
}

export default modulePage(adminManifest, async function AdminHealthPage() {
  const admin = await requireAdmin();
  const database = getDatabase();
  const [health, enabledIds] = await Promise.all([readCommunityHealth(database), readEnabledIds(database)]);
  const isNetworkOn = enabledIds.has(networkManifest.id);
  const connectMeter = isNetworkOn ? await readConnectMeter(database, admin.id) : null;
  const { members, sharing, synced, windows, intros, invites } = health;

  return (
    <AdminSection title="Community health" description="Real counts from this community, as of right now.">
      <div className="grid items-start gap-5 lg:grid-cols-2">
        <Card className="grid gap-4">
          <CardTitle>People</CardTitle>
          <StatRows
            rows={[
              { value: members, label: "Members", note: "Everyone who can sign in today." },
              ...(isNetworkOn
                ? [
                    { value: sharing, label: "Agreed to share", note: "Said yes to sharing their network." },
                    { value: synced, label: "Synced and in the group", note: "Their network is in the search." },
                  ]
                : []),
            ]}
          />
        </Card>

        <Card className="grid gap-4">
          <div className="grid gap-1.5">
            <CardTitle>Invites</CardTitle>
            <CardDescription>{readInviteHeadline(invites)}</CardDescription>
          </div>
          <StatRows
            rows={[
              { value: invites.accepted, label: "Accepted" },
              { value: invites.pending, label: "Still waiting" },
              { value: invites.expired, label: "Expired", note: "You can send these people a new link." },
            ]}
          />
        </Card>

        {windows.map(({ days, posts, activeMembers }) => (
          <Card key={days} className="grid gap-4">
            <CardTitle>Last {days} days</CardTitle>
            <StatRows
              rows={[
                { value: posts, label: "Posts" },
                { value: activeMembers, label: "Active members" },
              ]}
            />
          </Card>
        ))}

        <p className="type-small px-1 text-foreground-soft lg:col-span-2">{ACTIVE_MEMBER_MEANING}</p>

        {connectMeter ? <NetworkReachCard meter={connectMeter} /> : null}

        {enabledIds.has(introsManifest.id) ? (
          <div className="lg:col-span-2">
            <IntroCountsCard counts={intros} />
          </div>
        ) : null}
      </div>
    </AdminSection>
  );
});
