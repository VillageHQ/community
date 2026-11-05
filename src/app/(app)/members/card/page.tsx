import type { Metadata } from "next";
import { ArrowLeft } from "lucide-react";
import Link from "next/link";
import { notFound } from "next/navigation";

import { PageHeader } from "@/components/page-header";
import { Button } from "@/components/ui/button";
import { getDatabase } from "@/database/client";
import { PAGE_TITLES } from "@/lib/branding/page-metadata";
import { readMemberProfile } from "@/lib/members/profile";
import { ROUTES } from "@/lib/routes";
import { requireMember } from "@/lib/session";

import { CardForm } from "./card-form";

export const metadata: Metadata = { title: PAGE_TITLES.editCard };

export default async function EditCardPage() {
  const member = await requireMember();
  const profile = await readMemberProfile(getDatabase(), member.id);
  if (!profile) notFound();

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
    </div>
  );
}
