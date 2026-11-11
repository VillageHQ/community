import type { Metadata } from "next";
import { notFound, redirect } from "next/navigation";

import { BackLink } from "@/components/page-header";
import { requireMember } from "@/platform/auth/session";
import { PAGE_TITLES } from "@/platform/branding/page-metadata";
import { getDatabase } from "@/platform/database/client";
import { createRequestContext } from "@/platform/http/request-context";
import { ROUTES } from "@/platform/http/routes";
import { isModuleEnabled } from "@/platform/modules/enablement";
import { modulePage } from "@/platform/modules/module-page";
import { introsManifest } from "@/modules/intros/manifest";
import { networkManifest } from "@/modules/network/manifest";
import { describeAllowanceUsed, readAskAllowance } from "@/shell/ask-helpers";
import { readAskerProfile, readIntroConnectorCard, readOneStepAsk } from "@/shell/intro-ask";
import { OneStepAskForm } from "@/shell/intro-ask-forms";
import { draftShortNote } from "@/shell/intro-ask-note";

export const metadata: Metadata = { title: PAGE_TITLES.introAsk };

type SearchAskPageProps = { searchParams: Promise<Record<string, string | string[] | undefined>> };

function readParam(value: string | string[] | undefined) {
  return typeof value === "string" ? value.trim() : "";
}

// Only back to a search: never a link elsewhere.
function readBack(value: string) {
  return value.startsWith(`${ROUTES.network}?`) || value === ROUTES.network ? value : ROUTES.network;
}

// "Ask Marcus to introduce you to Rosa Lindqvist": the one-step ask from a search result (Founderhall's
// oneStepAskPage). Search stays lit; the path comes from the asker's own search, saved for a day.
export default modulePage(networkManifest, async function SearchAskPage({ searchParams }: SearchAskPageProps) {
  const member = await requireMember();
  const database = getDatabase();
  if (!(await isModuleEnabled(database, introsManifest))) notFound();
  const params = await searchParams;
  const targetSlug = readParam(params.target).toLowerCase();
  const connectorId = readParam(params.via);
  const back = readBack(readParam(params.back));
  if (!targetSlug || !connectorId) redirect(back);

  const context = createRequestContext(database, process.env, member);
  const [ask, connector, asker, allowance] = await Promise.all([
    readOneStepAsk(context, targetSlug, connectorId),
    readIntroConnectorCard(database, connectorId, member.id),
    readAskerProfile(database, member.id),
    readAskAllowance(database, member.id),
  ]);
  if (!ask || !connector) redirect(back);

  const connectorFirst = connector.name.split(" ")[0] ?? connector.name;
  const targetFirst = ask.targetName.split(" ")[0] ?? ask.targetName;
  const blockedReason = !connector.canBeAsked ? `${connector.name} has paused intro asks.` : allowance.left === 0 ? describeAllowanceUsed(allowance) : null;
  return (
    <>
      <BackLink href={back}>Back to results</BackLink>
      <div className="fh-narrow">
        <h1 className="fh-h1" style={{ marginTop: 14 }}>
          Ask {connectorFirst} to introduce you to {ask.targetName}
        </h1>
        <p className="fh-lede">
          {connector.name} knows {targetFirst}
          {ask.targetAbout ? ` (${ask.targetAbout})` : ""}. {connectorFirst} sees your note first and says yes or no. {targetFirst} only hears about it if{" "}
          {connectorFirst} says yes.
        </p>
        <OneStepAskForm
          connectorName={connector.name}
          connectorSlug={ask.connectorSlug}
          targetSlug={targetSlug}
          targetName={ask.targetName}
          draftNote={draftShortNote(asker, { targetName: ask.targetName, targetCompany: ask.targetAbout?.split(", ").slice(1).join(", ") || null })}
          cap={allowance.cap}
          blockedReason={blockedReason}
        />
      </div>
    </>
  );
});
