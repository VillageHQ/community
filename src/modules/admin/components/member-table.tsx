import Link from "next/link";
import type { ReactNode } from "react";

import { CompanyLogo } from "@/components/company-name";
import { Avatar } from "@/components/ui/avatar";
import { Pill } from "@/components/ui/pill";
import { ROUTES } from "@/platform/http/routes";

import { formatShortDate, readRoleAndCompany, readWhen, STATUS_PILLS, type ConsoleMember } from "../console-members";
import { InviteResendButton } from "./invite-resend-button";

// One row of Founderhall's members table (crop row-member-admin.png): avatar · name and email · role and company ·
// when · status. A member's row opens their Manage page; an invited person's row has Resend.
function MemberRow({ member }: { member: ConsoleMember }) {
  const name = member.name || member.email || "Someone";
  const roleAndCompany = readRoleAndCompany(member);
  const when = readWhen(member);
  const pill = member.deleteRequestedAt ? (
    <Pill tone="needs">Asked to delete {formatShortDate(member.deleteRequestedAt)}</Pill>
  ) : member.isNeedsLook ? (
    <Pill tone="needs">Needs a look</Pill>
  ) : (
    <Pill tone={STATUS_PILLS[member.state].tone}>{STATUS_PILLS[member.state].label}</Pill>
  );
  const content = (
    <>
      <Avatar stableId={member.id} name={name} imageUrl={member.avatarUrl} />
      <div className="fh-who">
        <b>{name}</b>
        <span>
          {member.email}
          {member.isAdmin ? " · admin" : ""}
        </span>
      </div>
      <div className="fh-c-aud">
        {roleAndCompany ? (
          <>
            <CompanyLogo url={member.companyLogoUrl} className="fh-colog" />
            {roleAndCompany}
          </>
        ) : (
          <span className="fh-muted">No profile yet</span>
        )}
      </div>
      <div className="fh-c-status fh-muted">{when}</div>
      <div className="fh-end">
        {pill}
        {member.kind === "invite" ? <InviteResendButton inviteId={member.id} /> : <small className="fh-phone-only">{when}</small>}
      </div>
    </>
  );
  return member.kind === "member" ? (
    <Link href={`${ROUTES.adminMembers}/${member.id}`} className="fh-r">
      {content}
    </Link>
  ) : (
    <div className="fh-r">{content}</div>
  );
}

// The table's head shows even when a filter or search finds nobody; `empty` takes the rows' place then.
export function MemberTable({ members, empty }: { members: readonly ConsoleMember[]; empty: ReactNode }) {
  return (
    <>
      <div className="fh-memhead fh-desk-only" aria-hidden="true">
        <span />
        <span>Member</span>
        <span>Role and company</span>
        <span>When</span>
        <span>Status</span>
      </div>
      {members.length > 0 ? (
        <div className="fh-rows fh-members-rows fh-wide">
          {members.map((member) => (
            <MemberRow key={`${member.kind}-${member.id}`} member={member} />
          ))}
        </div>
      ) : (
        <div className="mt-3">{empty}</div>
      )}
    </>
  );
}
