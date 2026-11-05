"use client";

import { useState } from "react";

import { Card, CardDescription, CardTitle } from "@/components/ui/card";
import type { IssuedInvite } from "@/lib/invites/invite-api";

import { InviteForm } from "./invite-form";
import { InviteList } from "./invite-list";
import { LinkedinClaimCard } from "./linkedin-claim-card";
import { WaitingMembers } from "./waiting-members";

const ISSUED_FROM = { form: "form", list: "list" } as const;

type IssuedFrom = { from: (typeof ISSUED_FROM)[keyof typeof ISSUED_FROM]; invite: IssuedInvite };

export function InviteManager({ isEmailConfigured }: { isEmailConfigured: boolean }) {
  const [issued, setIssued] = useState<IssuedFrom | null>(null);
  const showReplacementInvite = (invite: IssuedInvite) => setIssued({ from: ISSUED_FROM.form, invite });
  return (
    <div className="grid gap-6">
      <WaitingMembers isEmailConfigured={isEmailConfigured} onReclaimed={showReplacementInvite} />
      <Card className="grid gap-4 sm:rounded-panel sm:p-7">
        <div className="grid gap-1.5">
          <CardTitle>Invite someone</CardTitle>
          <CardDescription>Their email becomes their account. Nobody else can use the link.</CardDescription>
        </div>
        <InviteForm
          isEmailConfigured={isEmailConfigured}
          issued={issued?.from === ISSUED_FROM.form ? issued.invite : null}
          onIssued={showReplacementInvite}
        />
      </Card>
      <InviteList
        isEmailConfigured={isEmailConfigured}
        issued={issued?.from === ISSUED_FROM.list ? issued.invite : null}
        onIssued={(invite) => setIssued({ from: ISSUED_FROM.list, invite })}
        onReclaimed={showReplacementInvite}
      />
      <LinkedinClaimCard />
    </div>
  );
}
