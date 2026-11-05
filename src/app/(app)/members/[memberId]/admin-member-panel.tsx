import { Mail, Settings2 } from "lucide-react";
import Link from "next/link";

import { Button } from "@/components/ui/button";
import { Card, CardTitle } from "@/components/ui/card";
import { Tag } from "@/components/ui/tag";
import { ROUTES } from "@/lib/routes";

type AdminMemberPanelProps = { email: string; isEmailConfirmed: boolean; isLinkedinConfirmed: boolean };

export function AdminMemberPanel({ email, isEmailConfirmed, isLinkedinConfirmed }: AdminMemberPanelProps) {
  return (
    <Card className="grid gap-3 bg-muted shadow-none">
      <CardTitle>Only admins see this</CardTitle>
      <div className="flex flex-wrap items-center gap-2">
        <p className="type-small flex items-center gap-2 wrap-anywhere text-foreground-soft">
          <Mail aria-hidden="true" className="size-icon-small shrink-0" />
          {email}
        </p>
        {isEmailConfirmed ? null : <Tag tone="gold">Email not confirmed</Tag>}
        {isLinkedinConfirmed ? <Tag tone="sage">LinkedIn confirmed</Tag> : null}
      </div>
      <div>
        <Button asChild variant="outline" className="max-sm:w-full">
          <Link href={`${ROUTES.adminMembers}?search=${encodeURIComponent(email)}`}>
            <Settings2 aria-hidden="true" />
            Manage this member
          </Link>
        </Button>
      </div>
    </Card>
  );
}
