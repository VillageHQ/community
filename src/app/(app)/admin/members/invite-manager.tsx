"use client";

import { useState } from "react";

import { Card, CardDescription, CardTitle } from "@/components/ui/card";
import type { IssuedInvite } from "@/lib/invites/invite-api";

import { InviteForm } from "./invite-form";
import { InviteList } from "./invite-list";
import { LinkedinClaimCard } from "./linkedin-claim-card";
import { MemberManager } from "./member-manager";
import { WaitingMembers } from "./waiting-members";

const ISSUED_FROM = { form: "form", list: "list" } as const;

export const INVITE_SECTION_ID = "invite-someone";

type IssuedFrom = { from: (typeof ISSUED_FROM)[keyof typeof ISSUED_FROM]; invite: IssuedInvite };

type InviteManagerProps = { isEmailConfigured: boolean; viewerId: string; initialSearch: string };

export function InviteManager({ isEmailConfigured, viewerId, initialSearch }: InviteManagerProps) {
  const [issued, setIssued] = useState<IssuedFrom | null>(null);
  return (
    <div className="grid gap-6">
      <WaitingMembers isEmailConfigured={isEmailConfigured} />
      <MemberManager viewerId={viewerId} initialSearch={initialSearch} />
      <Card id={INVITE_SECTION_ID} className="grid scroll-mt-6 gap-4 sm:rounded-panel sm:p-7">
        <div className="grid gap-1.5">
          <CardTitle>Invite someone</CardTitle>
          <CardDescription>Their email becomes their account. Nobody else can use the link.</CardDescription>
        </div>
        <InviteForm
          isEmailConfigured={isEmailConfigured}
          issued={issued?.from === ISSUED_FROM.form ? issued.invite : null}
          onIssued={(invite) => setIssued({ from: ISSUED_FROM.form, invite })}
        />
      </Card>
      <InviteList
        isEmailConfigured={isEmailConfigured}
        issued={issued?.from === ISSUED_FROM.list ? issued.invite : null}
        onIssued={(invite) => setIssued({ from: ISSUED_FROM.list, invite })}
      />
      <LinkedinClaimCard />
    </div>
  );
}
