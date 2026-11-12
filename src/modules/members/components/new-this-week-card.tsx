import Link from "next/link";

import { CompanyName } from "@/components/company-name";
import { Avatar } from "@/components/ui/avatar";
import { Button } from "@/components/ui/button";
import { Card, CardTitle } from "@/components/ui/card";
import type { readNewMembers } from "@/modules/members/reads-directory";
import { ROUTES } from "@/platform/http/routes";
import { MemberConversationSlot } from "@/modules/members/slots";

const RAIL_AVATAR_SIZE_PX = 44;

type NewMember = Awaited<ReturnType<typeof readNewMembers>>["newMembers"][number];

function NewMemberRow({ member }: { member: NewMember }) {
  const { id, name, title, company, avatarUrl, companyLogoUrl } = member;
  return (
    <li className="flex flex-wrap items-center gap-3">
      <Avatar stableId={id} name={name} imageUrl={avatarUrl} sizePx={RAIL_AVATAR_SIZE_PX} />
      <div className="min-w-0 flex-1">
        <Link href={`${ROUTES.people}/${id}`} className="type-label wrap-anywhere hover:underline">
          {name}
        </Link>
        <div className="type-micro font-medium wrap-anywhere text-muted-foreground">
          {company ? <CompanyName company={company} logoUrl={companyLogoUrl} logoSizePx={14} /> : (title ?? "New member")}
        </div>
      </div>
      <MemberConversationSlot
        memberId={id}
        label="Say hi"
        accessibleName={`Say hi to ${name}`}
        showsIcon={false}
        variant="soft"
        size="sm"
        className="px-4"
      />
    </li>
  );
}

export function NewThisWeekCard({ newMembers }: { newMembers: NewMember[] }) {
  return (
    <Card className="sm:p-5">
      <CardTitle>New this week</CardTitle>
      {newMembers.length === 0 ? (
        <>
          <p className="type-small mt-2 text-foreground-soft">Nobody new this week. Everyone else is one tap away.</p>
          <Button asChild variant="outline" size="sm" className="mt-3.5 w-full">
            <Link href={ROUTES.members}>Meet the members</Link>
          </Button>
        </>
      ) : (
        <ul className="mt-3.5 grid gap-3.5">
          {newMembers.map((member) => (
            <NewMemberRow key={member.id} member={member} />
          ))}
        </ul>
      )}
    </Card>
  );
}
