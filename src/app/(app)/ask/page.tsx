import type { Metadata } from "next";
import { Suspense } from "react";

import { Note } from "@/components/ui/note";
import { requireMember } from "@/platform/auth/session";
import { readBrandingForPage } from "@/platform/branding/branding";
import { PAGE_TITLES } from "@/platform/branding/page-metadata";
import { getDatabase } from "@/platform/database/client";
import { createRequestContext } from "@/platform/http/request-context";
import { modulePage } from "@/platform/modules/module-page";
import { introsManifest } from "@/modules/intros/manifest";
import { readAvatarUrl } from "@/modules/members/service-profile";
import { describeAllowanceUsed, readAskAllowance } from "@/shell/ask-helpers";
import { GuidedRail, GuidedSummary, NEEDS, NeedStep, PathStep, readNeed, StepDots, toGuidedHref, WhoStep, type GuidedStep } from "@/shell/guided-ask";
import { readAskerProfile, readIntroConnectorCard, readOneStepAsk } from "@/shell/intro-ask";
import { AllowanceLine, NoteAskForm } from "@/shell/intro-ask-forms";
import { draftNoteParts } from "@/shell/intro-ask-note";

export const metadata: Metadata = { title: PAGE_TITLES.introAsk };

// A whole search can take a while; the path step streams in under the steps.
export const maxDuration = 130;

type GuidedAskPageProps = { searchParams: Promise<Record<string, string | string[] | undefined>> };

function readParam(value: string | string[] | undefined) {
  return typeof value === "string" ? value.trim() : "";
}

// Founderhall's guided ask: what you need, who, the best way in, the note. Intros stays lit.
export default modulePage(introsManifest, async function GuidedAskPage({ searchParams }: GuidedAskPageProps) {
  const member = await requireMember();
  const database = getDatabase();
  const params = await searchParams;
  const need = readNeed(readParam(params.need));
  const who = readParam(params.who).slice(0, 160);
  const company = readParam(params.company).slice(0, 120);
  const via = readParam(params.via);
  const targetSlug = readParam(params.target).toLowerCase();
  const isEditing = readParam(params.edit) === "1";
  const step: GuidedStep = !need ? "need" : !who || isEditing ? "who" : !via || !targetSlug ? "path" : "note";

  const [allowance, branding, avatarUrl] = await Promise.all([readAskAllowance(database, member.id), readBrandingForPage(), readAvatarUrl(database, member.id)]);
  const context = createRequestContext(database, process.env, member, 125_000);
  const communityName = branding.name;

  const rows: { label: string; value: string; change: string }[] = [];
  if (need && step !== "need") rows.push({ label: "You need", value: NEEDS[need].label.toLowerCase(), change: toGuidedHref({}) });
  if (need && who && (step === "path" || step === "note")) rows.push({ label: "Who", value: [who, company].filter(Boolean).join(" at "), change: toGuidedHref({ need, who, company, edit: "1" }) });

  let main = null;
  if (step === "need" || !need) {
    main = <NeedStep />;
  } else if (step === "who") {
    main = <WhoStep need={need} who={who} company={company} />;
  } else if (step === "path") {
    main = (
      <Suspense fallback={<Note className="mt-3.5">Finding the best way in…</Note>}>
        <PathStep context={context} need={need} who={who} company={company} viewer={{ id: member.id, name: member.name, imageUrl: avatarUrl }} communityName={communityName} />
      </Suspense>
    );
  } else {
    const [connector, ask, asker] = await Promise.all([
      readIntroConnectorCard(database, via, member.id),
      readOneStepAsk(context, targetSlug, via),
      readAskerProfile(database, member.id),
    ]);
    const personName = readParam(params.person) || ask?.targetName || "";
    if (connector) rows.push({ label: "Through", value: connector.name, change: toGuidedHref({ need, who, company }) });
    if (!connector || !ask) {
      main = <Note kind="needs">That way in is no longer there. Find the best way in again.</Note>;
    } else {
      const connectorFirst = connector.name.split(" ")[0] ?? connector.name;
      const personFirst = personName.split(" ")[0] ?? personName;
      const blockedReason = !connector.canBeAsked ? `${connector.name} has paused intro asks.` : allowance.left === 0 ? describeAllowanceUsed(allowance) : null;
      main = (
        <>
          <h1 className="fh-h1">Write your forwardable note</h1>
          <p className="fh-lede">
            {connectorFirst} forwards it to {personFirst} as it is. We drafted it from your profile; change anything.
          </p>
          <NoteAskForm
            connector={{ id: connector.id, name: connector.name, about: [connector.title, connector.company].filter(Boolean).join(", "), avatarUrl: connector.avatarUrl, companyLogoUrl: connector.companyLogoUrl }}
            viewerName={member.name}
            communityName={communityName}
            parts={draftNoteParts(asker, { targetName: personName, targetCompany: readParam(params.pcompany) || null })}
            blockedReason={blockedReason}
            target={{ name: personName, role: readParam(params.title), company: readParam(params.pcompany), slug: targetSlug }}
            connectorSlug={ask.connectorSlug}
          />
        </>
      );
    }
  }

  return (
    <div className="fh-guided">
      <div>
        <AllowanceLine allowance={allowance} />
        <StepDots step={step} />
        <GuidedSummary rows={rows} />
        {main}
      </div>
      <aside className="fh-desk-only">
        <GuidedRail step={step} communityName={communityName} />
      </aside>
    </div>
  );
});
