"use client";

import Link from "next/link";
import { useState } from "react";

import { Button } from "@/components/ui/button";
import type { IssuedInvite } from "@/lib/invites/invite-api";
import { ROUTES } from "@/lib/routes";

import { InviteForm } from "./invite-form";

export function InviteStep({ isEmailConfigured }: { isEmailConfigured: boolean }) {
  const [issued, setIssued] = useState<IssuedInvite | null>(null);
  return (
    <>
      <InviteForm isEmailConfigured={isEmailConfigured} issued={issued} onIssued={setIssued} />
      <div>
        <Button asChild variant="link" size="sm">
          <Link href={ROUTES.adminMembers}>See all invites</Link>
        </Button>
      </div>
    </>
  );
}
