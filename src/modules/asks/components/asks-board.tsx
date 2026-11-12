import Link from "next/link";

import { EmptyState } from "@/components/empty-state";
import { FlashNote } from "@/components/flash";
import { PageHeader } from "@/components/page-header";
import { ChipCount, ChipRow, CHIP_CLASSES } from "@/components/ui/chip";
import { SearchBox } from "@/components/ui/search-box";
import { Stepper } from "@/components/ui/stepper";

import { ASK_BOARD_TABS, ASK_TABS, ASKS_PAGE, type AskAllowance, type AskTab } from "../contract";
import type { AskTabCounts, BoardPost } from "../reads-board";
import { AsksComposer } from "./asks-composer";
import { AskConsent, PostCard } from "./post-parts";

const EMPTY_ASKS = "No open asks yet. When a founder needs someone, the ask shows here and in Thursday’s digest.";

const EMPTY_TABS: Record<AskTab, { title: string; line: string }> = {
  [ASK_BOARD_TABS.open]: { title: "No open asks", line: EMPTY_ASKS },
  [ASK_BOARD_TABS.updates]: { title: "No updates yet", line: "Share a hire, a launch or a round in one line." },
  [ASK_BOARD_TABS.yours]: { title: "You haven’t posted yet", line: "Post an ask in one line above. It goes to the members who can help." },
  [ASK_BOARD_TABS.answered]: { title: "Nothing answered yet", line: "Answered asks stay here, searchable." },
};

type AsksBoardProps = {
  communityName: string;
  tab: AskTab;
  search: string | null;
  posts: BoardPost[];
  counts: AskTabCounts;
  allowance: AskAllowance;
  flash: string | null;
  draft: { body: string; target: string } | null;
  now: Date;
};

function toTabHref(tab: AskTab, search: string | null) {
  const params = new URLSearchParams({ tab });
  if (search) params.set("q", search);
  return `${ASKS_PAGE}?${params.toString()}`;
}

// Founderhall's Asks & updates (asksPage): head, then the composer, the archive search, the tabs and the posts in one
// column; "How asks work" in the right rail on a desktop.
export function AsksBoard({ communityName, tab, search, posts, counts, allowance, flash, draft, now }: AsksBoardProps) {
  return (
    <>
      {flash ? <FlashNote>{flash}</FlashNote> : null}
      <PageHeader
        title="Asks & updates"
        description={`Ask ${communityName} for a person, a hire or an answer. Each ask goes to the members who can help, and into Thursday’s digest.`}
      />
      <div className="fh-asks-grid">
        <div>
          <AsksComposer communityName={communityName} allowance={allowance} draft={draft} />
          <form method="get" action={ASKS_PAGE} role="search" className="fh-archive">
            <input type="hidden" name="tab" value={search ? "all" : tab} />
            <SearchBox name="q" defaultValue={search ?? ""} placeholder="Search every ask and its answers" aria-label="Search the archive" />
          </form>
          {search ? (
            <p className="fh-small fh-muted" style={{ margin: "12px 0 4px" }}>
              {posts.length} result{posts.length === 1 ? "" : "s"} in the archive for “{search}” · <Link href={ASKS_PAGE}>Clear</Link>
            </p>
          ) : (
            <ChipRow className="fh-tabs" aria-label="Asks">
              {ASK_TABS.map(([key, label]) => (
                <Link key={key} className={CHIP_CLASSES} href={toTabHref(key, null)} aria-pressed={tab === key}>
                  {label}
                  <ChipCount>{counts[key]}</ChipCount>
                </Link>
              ))}
            </ChipRow>
          )}
          <div className="fh-posts">
            {posts.length > 0 ? (
              posts.map((post) => <PostCard key={post.id} post={post} now={now} isYoursTab={tab === ASK_BOARD_TABS.yours} />)
            ) : (
              <div style={{ marginTop: 12 }}>
                {search ? (
                  <EmptyState title={`No ask matches “${search}”`} description="The archive covers every ask and its answers. Try fewer words." />
                ) : (
                  <EmptyState title={EMPTY_TABS[tab].title} description={EMPTY_TABS[tab].line} />
                )}
              </div>
            )}
          </div>
        </div>
        <aside className="fh-desk-only">
          <section className="fh-sheet">
            <h2 className="fh-h3">How asks work</h2>
            <Stepper
              className="mt-3.5"
              steps={[
                { key: "post", state: "done", title: "Post it in one line", detail: `${allowance.cap} asks a week, posts and intro asks together, so every one gets read.` },
                { key: "find", state: "done", title: "We find who can help", detail: "Members with a warm path, and members whose profile fits. They get an email and see it on Today." },
                { key: "help", state: "done", title: "“I can help”", detail: "Someone who knows the person starts an intro; someone who has done it answers here." },
                { key: "answered", state: "todo", title: "Answered", detail: "Mark it answered. It stays in the archive." },
              ]}
            />
            <AskConsent />
          </section>
        </aside>
      </div>
    </>
  );
}
