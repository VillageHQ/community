import type { Metadata } from "next";
import { notFound } from "next/navigation";

import { BackLink } from "@/components/page-header";
import { Avatar } from "@/components/ui/avatar";
import { Pill } from "@/components/ui/pill";
import { getDatabase } from "@/platform/database/client";
import { ROUTES } from "@/platform/http/routes";
import { requireAdmin } from "@/platform/auth/session";
import { modulePage } from "@/platform/modules/module-page";

import { readAdminMember } from "@/modules/admin/reads-members";
import { formatShortDate } from "@/modules/admin/console-members";
import { MANAGE_TITLE_ID, MemberManage } from "@/modules/admin/components/member-manage";
import { adminManifest } from "@/modules/admin/manifest";

export const metadata: Metadata = { title: "Members" };

// One member's tools (Community-only): role, email, Village, LinkedIn, remove and delete, each as a sheet.
export default modulePage(adminManifest, async function AdminMemberPage({ params }: { params: Promise<{ memberId: string }> }) {
  const admin = await requireAdmin();
  const { memberId } = await params;
  const member = await readAdminMember(getDatabase(), memberId);
  if (!member) notFound();
  const status = member.isRemoved ? <Pill tone="declined">Removed</Pill> : member.isInVillageGroup ? <Pill tone="made">Connected</Pill> : <Pill tone="made">Joined</Pill>;
  return (
    <>
      <BackLink href={ROUTES.adminMembers}>Members</BackLink>
      <div className="fh-pagehead mt-2 flex items-center gap-4">
        <Avatar stableId={member.id} name={member.name} imageUrl={member.avatarUrl} sizePx={64} />
        <div className="min-w-0">
          <h1 id={MANAGE_TITLE_ID} tabIndex={-1} className="fh-h1 outline-none">
            {member.name}
          </h1>
          <p className="fh-lede">
            {member.email ?? "No email"}
            {member.isAdmin ? " · admin" : ""} · joined {formatShortDate(member.joinedAt)}
          </p>
        </div>
        <div className="ml-auto">{status}</div>
      </div>
      <MemberManage member={member} viewerId={admin.id} />
    </>
  );
});
