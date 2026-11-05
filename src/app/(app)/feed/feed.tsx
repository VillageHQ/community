"use client";

import { useQuery, useSuspenseInfiniteQuery } from "@tanstack/react-query";
import { ArrowUp, MessageCirclePlus, PartyPopper } from "lucide-react";
import { useState } from "react";

import { EmptyState } from "@/components/empty-state";
import { FormError } from "@/components/form-error";
import { QueryBoundary } from "@/components/query-boundary";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { readPinnedPosts, readTimelinePosts } from "@/lib/feed/feed-cache";
import { describeNewPosts } from "@/lib/feed/new-post-polling";

import { Composer, ComposerSheet, INLINE_COMPOSER_INPUT_ID } from "./composer";
import { FeedProvider, useFeedContext, type FeedViewer } from "./feed-context";
import { POSTS_REGION_ID } from "./feed-display";
import { feedQuery, newPostCountQuery } from "./feed-queries";
import { PostCard } from "./post-card";
import { useShowNewPosts } from "./use-feed-mutations";

const DESKTOP_MEDIA_QUERY = "(min-width: 1024px)";
const POSTS_HEADING_ID = "feed-posts-heading";

const EMPTY_FEED_COPY = {
  admin: {
    icon: PartyPopper,
    title: "Post a welcome",
    description: "Nobody has posted yet, and a hello from you sets the tone. Say what this community is for, then pin it.",
    action: "Write the welcome",
  },
  member: {
    icon: MessageCirclePlus,
    title: "Be the first to post",
    description: "Ask the room, share a win or offer a hand. Everyone here will see it.",
    action: "Write the first post",
  },
};

function startFirstPost(openSheet: () => void) {
  if (!window.matchMedia(DESKTOP_MEDIA_QUERY).matches) {
    openSheet();
    return;
  }
  document.getElementById(INLINE_COMPOSER_INPUT_ID)?.focus();
}

function EmptyFeed({ onStart }: { onStart: () => void }) {
  const { viewer } = useFeedContext();
  const { icon, title, description, action } = viewer.isAdmin ? EMPTY_FEED_COPY.admin : EMPTY_FEED_COPY.member;
  return (
    <div className="rounded-panel bg-card shadow-panel">
      <EmptyState icon={icon} title={title} description={description}>
        <Button type="button" size="lg" onClick={onStart}>
          {action}
        </Button>
      </EmptyState>
    </div>
  );
}

function NewPostsPill({ since }: { since: string | null }) {
  const { data } = useQuery(newPostCountQuery(since));
  const showNewPosts = useShowNewPosts();
  const newPostCount = data?.newPostCount ?? 0;
  return (
    <div role="status" className="pointer-events-none sticky top-[76px] z-10 flex justify-center empty:hidden lg:top-4">
      {newPostCount > 0 ? (
        <Button
          type="button"
          className="pointer-events-auto"
          disabled={showNewPosts.isPending}
          onClick={() =>
            showNewPosts.mutate(undefined, {
              onSuccess: () => {
                window.scrollTo({ top: 0 });
                document.getElementById(POSTS_REGION_ID)?.focus();
              },
            })
          }
        >
          <ArrowUp aria-hidden="true" />
          {`Show ${describeNewPosts(newPostCount)}`}
        </Button>
      ) : null}
    </div>
  );
}

function FeedTimeline() {
  const timeline = useSuspenseInfiniteQuery(feedQuery());
  const [isSheetOpen, setIsSheetOpen] = useState(false);
  const pinnedPosts = readPinnedPosts(timeline.data);
  const posts = readTimelinePosts(timeline.data);
  const isEmpty = pinnedPosts.length === 0 && posts.length === 0;

  return (
    <>
      <NewPostsPill since={timeline.data.pages[0]?.newestPostAt ?? null} />
      <section id={POSTS_REGION_ID} tabIndex={-1} aria-labelledby={POSTS_HEADING_ID} className="grid gap-5 outline-none">
        <h2 id={POSTS_HEADING_ID} className="sr-only">
          Posts
        </h2>
        {isEmpty ? <EmptyFeed onStart={() => startFirstPost(() => setIsSheetOpen(true))} /> : null}
        {pinnedPosts.map((post) => (
          <PostCard key={post.id} post={post} />
        ))}
        {posts.map((post) => (
          <PostCard key={post.id} post={post} />
        ))}
      </section>
      {timeline.isFetchNextPageError ? <FormError message={timeline.error?.message ?? null} /> : null}
      {timeline.hasNextPage ? (
        <Button
          type="button"
          variant="outline"
          size="lg"
          className="w-full"
          disabled={timeline.isFetchingNextPage}
          aria-busy={timeline.isFetchingNextPage}
          onClick={() => timeline.fetchNextPage()}
        >
          {timeline.isFetchingNextPage ? "Finding older posts…" : "Show older posts"}
        </Button>
      ) : null}
      {!isEmpty && !timeline.hasNextPage ? (
        <p className="type-small py-2 text-center text-muted-foreground">You&apos;re all caught up.</p>
      ) : null}
      <ComposerSheet isOpen={isSheetOpen} onOpenChange={setIsSheetOpen} isTriggerShown={!isEmpty} />
    </>
  );
}

export function Feed({ viewer }: { viewer: FeedViewer }) {
  return (
    <FeedProvider viewer={viewer}>
      <div className="grid gap-5">
        <Card className="p-5 max-lg:hidden sm:p-5">
          <Composer inputId={INLINE_COMPOSER_INPUT_ID} />
        </Card>
        <QueryBoundary loadingMessage="Gathering the latest posts…">
          <FeedTimeline />
        </QueryBoundary>
      </div>
    </FeedProvider>
  );
}
