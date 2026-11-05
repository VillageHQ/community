import type { Metadata } from "next";

import { Card, CardDescription, CardTitle } from "@/components/ui/card";
import { getDatabase } from "@/database/client";
import { readCommunityHealth } from "@/lib/admin/community-health";
import { PAGE_TITLES } from "@/lib/branding/page-metadata";
import { requireAdmin } from "@/lib/session";

import { AdminSection } from "../admin-section";
import { IntroCountsCard } from "../intro-counts-card";
import { StatRows } from "../stat-rows";

const ACTIVE_MEMBER_MEANING = "An active member posted, replied, reacted, sent a message or asked for an intro. Reading doesn't count, because this site doesn't track it.";

type CommunityHealth = Awaited<ReturnType<typeof readCommunityHealth>>;

function readInviteHeadline({ accepted, sent, acceptedPercent }: CommunityHealth["invites"]) {
  if (acceptedPercent === null) return "No invites sent yet.";
  return `${accepted} of ${sent} invites accepted, or ${acceptedPercent}%. Revoked invites don't count.`;
}

export const metadata: Metadata = { title: PAGE_TITLES.adminHealth };

export default async function AdminHealthPage() {
  await requireAdmin();
  const health = await readCommunityHealth(getDatabase());
  const { members, sharing, synced, windows, intros, invites } = health;

  return (
    <AdminSection title="Community health" description="Real counts from this community, as of right now.">
      <div className="grid items-start gap-5 lg:grid-cols-2">
        <Card className="grid gap-4">
          <CardTitle>People</CardTitle>
          <StatRows
            rows={[
              { value: members, label: "Members", note: "Everyone who can sign in today." },
              { value: sharing, label: "Agreed to share", note: "Said yes to sharing their network." },
              { value: synced, label: "Synced and in the group", note: "Their network is in the search." },
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

        <div className="lg:col-span-2">
          <IntroCountsCard counts={intros} />
        </div>
      </div>
    </AdminSection>
  );
}
