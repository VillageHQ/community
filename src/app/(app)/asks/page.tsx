import type { Metadata } from "next";
import { permanentRedirect } from "next/navigation";

import { AsksBoard } from "@/modules/asks/components/asks-board";
import { ASK_BOARD_TABS, ASK_TABS, ASKS_PAGE, ASKS_PAGE_TITLE, ASK_LIMITS, readAskFlash, type AskTab } from "@/modules/asks/contract";
import { asksManifest } from "@/modules/asks/manifest";
import { readAsksPage } from "@/modules/asks/reads-board";
import { parseAskDraft } from "@/modules/asks/rules-board-url";
import { readBrandingForPage } from "@/platform/branding/branding";
import { requireMember } from "@/platform/auth/session";
import { getDatabase } from "@/platform/database/client";
import { modulePage } from "@/platform/modules/module-page";
import { readAskAllowance } from "@/shell/ask-helpers";

export const metadata: Metadata = { title: ASKS_PAGE_TITLE };

type SearchParams = Record<string, string | string[] | undefined>;
type AsksPageProps = { searchParams: Promise<SearchParams> };

const OLD_VIEWS: Record<string, AskTab> = { yours: ASK_BOARD_TABS.yours, answered: ASK_BOARD_TABS.answered, closed: ASK_BOARD_TABS.answered };

function readFirst(value: string | string[] | undefined) {
  return (Array.isArray(value) ? value[0] : value) ?? null;
}

function readTab(value: string | null): AskTab {
  return ASK_TABS.find(([key]) => key === value)?.[0] ?? ASK_BOARD_TABS.open;
}

export default modulePage(asksManifest, async function AsksPage({ searchParams }: AsksPageProps) {
  const params = await searchParams;
  // The old "Your asks" view and the Closed tab are tabs of the one board now.
  const oldView = readFirst(params.view);
  if (oldView && OLD_VIEWS[oldView]) permanentRedirect(`${ASKS_PAGE}?tab=${OLD_VIEWS[oldView]}`);

  const member = await requireMember();
  const database = getDatabase();
  const search = readFirst(params.q)?.replace(/\s+/g, " ").trim().slice(0, ASK_LIMITS.searchLength) || null;
  const tab = readTab(readFirst(params.tab));
  const draftBody = parseAskDraft(params);
  const now = new Date();
  const [community, allowance, { posts, counts }] = await Promise.all([
    readBrandingForPage(),
    readAskAllowance(database, member.id, now),
    readAsksPage(database, { viewerId: member.id, tab, search }, now),
  ]);

  return (
    <AsksBoard
      communityName={community.name}
      tab={tab}
      search={search}
      posts={posts}
      counts={counts}
      allowance={allowance}
      flash={readAskFlash(readFirst(params.m))}
      draft={draftBody ? { body: draftBody, target: "" } : null}
      now={now}
    />
  );
});
