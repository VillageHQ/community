import type { Comment, FeedPage, Post, Reaction, ReactionCount } from "./feed-api.ts";

export type FeedTimeline = { pages: FeedPage[]; pageParams: unknown[] };

function mapPosts(timeline: FeedTimeline, update: (posts: Post[]) => Post[]) {
  return {
    ...timeline,
    pages: timeline.pages.map((page) => ({
      ...page,
      pinnedPosts: update(page.pinnedPosts),
      posts: update(page.posts),
    })),
  };
}

export function updatePost(timeline: FeedTimeline, postId: string, update: (post: Post) => Post) {
  return mapPosts(timeline, (posts) => posts.map((post) => (post.id === postId ? update(post) : post)));
}

export function removePost(timeline: FeedTimeline, postId: string) {
  return mapPosts(timeline, (posts) => posts.filter(({ id }) => id !== postId));
}

export function prependPost(timeline: FeedTimeline, post: Post) {
  const [firstPage, ...laterPages] = timeline.pages;
  if (!firstPage) return timeline;
  return { ...timeline, pages: [{ ...firstPage, posts: [post, ...firstPage.posts] }, ...laterPages] };
}

export function keepFirstPage(timeline: FeedTimeline) {
  return { ...timeline, pages: timeline.pages.slice(0, 1), pageParams: timeline.pageParams.slice(0, 1) };
}

export function readPinnedPosts(timeline: FeedTimeline) {
  return timeline.pages[0]?.pinnedPosts ?? [];
}

export function readTimelinePosts(timeline: FeedTimeline) {
  const seenIds = new Set(readPinnedPosts(timeline).map(({ id }) => id));
  return timeline.pages
    .flatMap(({ posts }) => posts)
    .filter(({ id }) => {
      if (seenIds.has(id)) return false;
      seenIds.add(id);
      return true;
    });
}

export function changeReaction(reactions: ReactionCount[], reaction: Reaction, isActive: boolean) {
  const current = reactions.find((entry) => entry.reaction === reaction);
  if (Boolean(current?.isMine) === isActive) return reactions;

  const others = reactions.filter((entry) => entry.reaction !== reaction);
  const count = (current?.count ?? 0) + (isActive ? 1 : -1);
  return count > 0 ? [...others, { reaction, count, isMine: isActive }] : others;
}

export function hasWholeThread({ inlineComments, commentCount }: Post) {
  return inlineComments.length === commentCount;
}

export function addComment(post: Post, comment: Comment) {
  return {
    ...post,
    commentCount: post.commentCount + 1,
    inlineComments: hasWholeThread(post) ? [...post.inlineComments, comment] : post.inlineComments,
  };
}

export function replaceComment(post: Post, comment: Comment) {
  return {
    ...post,
    inlineComments: post.inlineComments.map((current) => (current.id === comment.id ? comment : current)),
  };
}

export function removeComment(post: Post, commentId: string) {
  return {
    ...post,
    commentCount: Math.max(0, post.commentCount - 1),
    inlineComments: post.inlineComments.filter(({ id }) => id !== commentId),
  };
}
