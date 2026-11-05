import type { Metadata } from "next";
import { ArrowLeft } from "lucide-react";
import Link from "next/link";
import { notFound } from "next/navigation";

import { PageHeader } from "@/components/page-header";
import { Button } from "@/components/ui/button";
import { getDatabase } from "@/platform/database/client";
import { PAGE_TITLES } from "@/platform/branding/page-metadata";
import { readMemberProfile } from "@/modules/members/service-profile";
import { ROUTES } from "@/platform/http/routes";
import { requireMember } from "@/platform/auth/session";

import { CardForm } from "@/modules/members/components/card-form";
import { membersManifest } from "@/modules/members/manifest";
import { LeaveGroupCard } from "@/modules/network/components/leave-group-card";
import { networkManifest } from "@/modules/network/manifest";
import { readIsInVillageGroup } from "@/modules/network/reads-progress";
import { isModuleEnabled } from "@/platform/modules/enablement";
import { modulePage } from "@/platform/modules/module-page";

export const metadata: Metadata = { title: PAGE_TITLES.editCard };

export default modulePage(membersManifest, async function EditCardPage() {
  const member = await requireMember();
  const database = getDatabase();
  const profile = await readMemberProfile(database, member.id);
  if (!profile) notFound();

  const isNetworkOn = await isModuleEnabled(database, networkManifest);
  const showsLeaveCard = !isNetworkOn && (await readIsInVillageGroup(database, member.id));

  return (
    <div className="mx-auto max-w-[720px]">
      <PageHeader
        title="Your card"
        description="This is how members find you. Your email stays private."
        action={
          <Button asChild variant="quiet" size="sm">
            <Link href={`${ROUTES.members}/${member.id}`}>
              <ArrowLeft aria-hidden="true" />
              View my profile
            </Link>
          </Button>
        }
      />
      <div className="rounded-card bg-card p-5 shadow-panel sm:rounded-panel sm:p-7">
        <CardForm profile={profile} />
      </div>
      {showsLeaveCard ? <LeaveGroupCard /> : null}
    </div>
  );
});
