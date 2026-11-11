import type { Metadata } from "next";
import { notFound } from "next/navigation";

import { AskDetail } from "@/modules/asks/components/ask-detail";
import { readAskFlash } from "@/modules/asks/contract";
import { asksManifest } from "@/modules/asks/manifest";
import { readAskDetail, readAskMember } from "@/modules/asks/reads-board";
import { isAdminMember } from "@/platform/auth/roles";
import { requireMember } from "@/platform/auth/session";
import { getDatabase } from "@/platform/database/client";
import { modulePage } from "@/platform/modules/module-page";

type AskPageProps = { params: Promise<{ askId: string }>; searchParams: Promise<Record<string, string | string[] | undefined>> };

const UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;
const TITLE_LENGTH = 60;

async function readAsk(askId: string) {
  if (!UUID.test(askId)) return null;
  const member = await requireMember();
  const database = getDatabase();
  const [detail, viewer] = await Promise.all([readAskDetail(database, { viewerId: member.id, askId }), readAskMember(database, member.id)]);
  return detail && viewer ? { detail, viewer, member } : null;
}

export async function generateMetadata({ params }: AskPageProps): Promise<Metadata> {
  const found = await readAsk((await params).askId);
  return { title: found ? found.detail.post.body.slice(0, TITLE_LENGTH) : "Asks & updates" };
}

// Founderhall's one ask: who can help, the answers, "I can help", and the owner's buttons.
export default modulePage(asksManifest, async function AskPage({ params, searchParams }: AskPageProps) {
  const [{ askId }, query] = await Promise.all([params, searchParams]);
  const found = await readAsk(askId);
  if (!found) notFound();
  const flash = readAskFlash(Array.isArray(query.m) ? query.m[0] : query.m);
  return (
    <AskDetail detail={found.detail} viewer={found.viewer} isViewerAdmin={isAdminMember(found.member)} flash={flash} now={new Date()} />
  );
});
