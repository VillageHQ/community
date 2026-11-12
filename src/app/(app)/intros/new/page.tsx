import type { Metadata } from "next";
import { notFound } from "next/navigation";

import { BackLink } from "@/components/page-header";
import { requireMember } from "@/platform/auth/session";
import { readBrandingForPage } from "@/platform/branding/branding";
import { PAGE_TITLES } from "@/platform/branding/page-metadata";
import { getDatabase } from "@/platform/database/client";
import { ROUTES } from "@/platform/http/routes";
import { modulePage } from "@/platform/modules/module-page";
import { INTRO_LIFETIME_DAYS, OUTCOME_PROMPT_AFTER_DAYS } from "@/modules/intros/contract";
import { introsManifest } from "@/modules/intros/manifest";
import { describeAllowanceUsed, readAskAllowance } from "@/shell/ask-helpers";
import { readAskerProfile, readIntroConnectorCard } from "@/shell/intro-ask";
import { AllowanceLine, FlowLayout, HowAnIntroWorks, NoteAskForm } from "@/shell/intro-ask-forms";
import { draftNoteParts } from "@/shell/intro-ask-note";

export const metadata: Metadata = { title: PAGE_TITLES.introAsk };

type NewIntroPageProps = { searchParams: Promise<Record<string, string | string[] | undefined>> };

// "Write your forwardable note": the ask from a member's profile (Founderhall's /intros/new?via=…). The asker names the
// person; the note is drafted from their profile in three parts. Needs no Village.
export default modulePage(introsManifest, async function NewIntroPage({ searchParams }: NewIntroPageProps) {
  const member = await requireMember();
  const database = getDatabase();
  const params = await searchParams;
  const connectorId = typeof params.via === "string" ? params.via.trim() : "";
  if (!connectorId) notFound();
  const [connector, asker, allowance, branding] = await Promise.all([
    readIntroConnectorCard(database, connectorId, member.id),
    readAskerProfile(database, member.id),
    readAskAllowance(database, member.id),
    readBrandingForPage(),
  ]);
  if (!connector) notFound();
  const connectorFirst = connector.name.split(" ")[0] ?? connector.name;
  const blockedReason = !connector.canBeAsked ? `${connector.name} has paused intro asks.` : allowance.left === 0 ? describeAllowanceUsed(allowance) : null;
  return (
    <>
      <BackLink href={`${ROUTES.people}/${connector.id}`}>{connector.name}</BackLink>
      <FlowLayout
        rail={<HowAnIntroWorks connectorFirst={connectorFirst} targetFirst="" communityName={branding.name} lifetimeDays={INTRO_LIFETIME_DAYS} outcomeDays={OUTCOME_PROMPT_AFTER_DAYS} />}
      >
        <AllowanceLine allowance={allowance} />
        <h1 className="fh-h1" style={{ marginTop: 14 }}>
          Write your forwardable note
        </h1>
        <p className="fh-lede">{connectorFirst} forwards it to them as it is. We drafted it from your profile; change anything.</p>
        <NoteAskForm
          connector={{ id: connector.id, name: connector.name, about: [connector.title, connector.company].filter(Boolean).join(", "), avatarUrl: connector.avatarUrl, companyLogoUrl: connector.companyLogoUrl }}
          viewerName={member.name}
          communityName={branding.name}
          parts={draftNoteParts(asker, { targetName: "", targetCompany: null })}
          blockedReason={blockedReason}
          target={null}
        />
      </FlowLayout>
    </>
  );
});
