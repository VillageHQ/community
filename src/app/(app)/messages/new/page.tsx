import type { Metadata } from "next";
import Link from "next/link";
import { notFound, redirect } from "next/navigation";

import { PageHeader } from "@/components/page-header";
import { Button, ButtonRow } from "@/components/ui/button";
import { memberIdSchema } from "@/modules/members/contract-blocks";
import { NewThread } from "@/modules/messages/components/new-thread";
import { messagesManifest } from "@/modules/messages/manifest";
import { readNewMessageTarget } from "@/modules/messages/reads";
import { requireMember } from "@/platform/auth/session";
import { readBrandingForPage } from "@/platform/branding/branding";
import { PAGE_TITLES } from "@/platform/branding/page-metadata";
import { getDatabase } from "@/platform/database/client";
import { readFirstName } from "@/platform/design/avatar-identity";
import { ROUTES } from "@/platform/http/routes";
import { modulePage } from "@/platform/modules/module-page";
import { mayMessage } from "@/shell/message-policy";

type NewMessagePageProps = { searchParams: Promise<Record<string, string | string[] | undefined>> };

async function readTarget(searchParams: NewMessagePageProps["searchParams"]) {
  const member = await requireMember();
  const to = memberIdSchema.safeParse((await searchParams).to);
  if (!to.success || to.data === member.id) return null;
  const target = await readNewMessageTarget(getDatabase(), member.id, to.data);
  return target ? { viewerId: member.id, ...target } : null;
}

export async function generateMetadata({ searchParams }: NewMessagePageProps): Promise<Metadata> {
  const target = await readTarget(searchParams);
  return { title: target?.member.name ?? PAGE_TITLES.messages };
}

// Founderhall's "Message" button opens this page: an existing conversation opens in the Inbox; otherwise an empty thread
// whose first Send starts it. A member who takes messages only after an intro gets Founderhall's explanation.
export default modulePage(messagesManifest, async function NewMessagePage({ searchParams }: NewMessagePageProps) {
  const [target, community] = await Promise.all([readTarget(searchParams), readBrandingForPage()]);
  if (!target) notFound();
  if (target.conversationId) redirect(`${ROUTES.messages}/${target.conversationId}`);
  const { member } = target;
  const profileHref = `${ROUTES.members}/${member.id}`;

  if (!(await mayMessage(getDatabase(), target.viewerId, member.id))) {
    const firstName = readFirstName(member.name);
    return (
      <div className="max-w-[640px]">
        <PageHeader
          back={{ href: profileHref, label: member.name }}
          title={`${firstName} takes messages after an intro`}
          description={`${firstName} chose to hear only from people they were introduced to here. Ask a member who knows ${firstName} for an intro, or ask on Asks & updates.`}
        />
        <ButtonRow>
          <Button asChild>
            <Link href={ROUTES.network}>Ask for an intro</Link>
          </Button>
          <Button asChild variant="secondary">
            <Link href={profileHref}>Back to the profile</Link>
          </Button>
        </ButtonRow>
      </div>
    );
  }

  return <NewThread member={member} communityName={community.name} />;
});
