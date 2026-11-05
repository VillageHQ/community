"use client";

import { cn } from "cn";
import { Flag, MessageCircle, Pencil, Pin, PinOff, Trash2 } from "lucide-react";
import { useEffect, useRef, useState, type ReactNode, type RefObject } from "react";
import { flushSync } from "react-dom";

import { FormError } from "@/components/form-error";
import { FEED_REPORT_TARGETS } from "@/lib/admin/admin-api";
import { Alert } from "@/components/ui/alert";
import { Avatar } from "@/components/ui/avatar";
import { Button } from "@/components/ui/button";
import { Tag } from "@/components/ui/tag";
import { Textarea } from "@/components/ui/textarea";
import { FEED_LIMITS, POST_TYPES, type Post, type PostType } from "@/lib/feed/feed-api";
import { splitAnnouncement } from "@/lib/feed/post-text";

import { AuthorName, BannedTag } from "./author-name";
import { CommentThread } from "./comment-thread";
import { LengthCounter, PostTypeChips, submitOnCommandEnter, submitWithoutReload } from "./composer";
import { ConfirmDelete } from "./confirm-delete";
import { ContentMenu, type ContentAction } from "./content-menu";
import { useFeedContext, type FeedViewer } from "./feed-context";
import {
  ADMIN_DELETE_NOTE,
  FEED_AVATAR_SIZES,
  POSTS_REGION_ID,
  REPORT_NOTE,
  POST_TYPE_DISPLAY,
  SURFACE_TONES,
  toPostElementId,
  toReplyInputId,
  type SurfaceTone,
} from "./feed-display";
import { ReactionBar } from "./reaction-bar";
import { RelativeTime } from "./relative-time";
import { RichText } from "./rich-text";
import { useDeletePost, useEditPost, usePinPost, useReportFeedContent } from "./use-feed-mutations";
import { ConfirmAction } from "../messages/confirm-action";

const POST_MODES = { reading: "reading", editing: "editing", confirmingDelete: "confirmingDelete", confirmingReport: "confirmingReport" } as const;

type PostMode = (typeof POST_MODES)[keyof typeof POST_MODES];

function focusElement(elementId: string) {
  document.getElementById(elementId)?.focus();
}

function PostTypeTag({ type }: { type: PostType }) {
  if (type === POST_TYPES.plain) return null;
  const { label, icon: Icon, tone } = POST_TYPE_DISPLAY[type];
  return (
    <Tag tone={tone} className="shrink-0">
      <Icon aria-hidden="true" />
      {label}
    </Tag>
  );
}

function PostEditor({ post, onDone }: { post: Post; onDone: () => void }) {
  const { viewer, announce, postAwaitingFocusRef } = useFeedContext();
  const [body, setBody] = useState(post.body);
  const [type, setType] = useState<PostType>(post.type);
  const editPost = useEditPost(Boolean(post.pin), () => {
    announce("Your post is updated and no longer pinned.");
    postAwaitingFocusRef.current = post.id;
  });
  return (
    <form
      className="mt-3.5 grid gap-3"
      onSubmit={(event) =>
        submitWithoutReload(event, () =>
          editPost.mutate(
            { postId: post.id, body, type },
            {
              onSuccess: () => {
                announce("Your post is updated.");
                onDone();
              },
            },
          ),
        )
      }
    >
      <Textarea
        autoFocus
        value={body}
        aria-label="Edit your post"
        aria-invalid={editPost.isError}
        className="type-lead max-h-96 min-h-28 resize-none bg-muted shadow-none field-sizing-content focus:shadow-none"
        onChange={(event) => setBody(event.target.value)}
        onKeyDown={submitOnCommandEnter}
      />
      <PostTypeChips type={type} onChange={setType} />
      <LengthCounter length={body.length} maximumLength={FEED_LIMITS.postLength} />
      {post.pin && !viewer.isAdmin ? (
        <p className="type-small text-foreground-soft">Saving changes unpins this post. An admin can pin it again.</p>
      ) : null}
      <FormError message={editPost.error?.message ?? null} />
      <div className="flex flex-wrap gap-2">
        <Button type="submit" disabled={editPost.isPending}>
          {editPost.isPending ? "Saving…" : "Save changes"}
        </Button>
        <Button type="button" variant="quiet" onClick={onDone}>
          Cancel
        </Button>
      </div>
    </form>
  );
}

function readMenuLabel(post: Post, viewer: FeedViewer) {
  if (post.author.id === viewer.id) return "Actions for your post";
  return `Actions for ${post.author.name}'s post`;
}

function readDeleteMessage(post: Post, viewer: FeedViewer) {
  const isAuthor = post.author.id === viewer.id;
  if (!viewer.isAdmin) return "Delete this post and its replies? It's gone for good.";
  const subject = isAuthor ? "your" : `${post.author.name}'s`;
  return `Delete ${subject} post and its replies for everyone? ${ADMIN_DELETE_NOTE}`;
}

type PostHandlers = { onEdit: () => void; onDelete: () => void; onTogglePin: () => void; onReport: () => void };

function readPostActions(post: Post, viewer: FeedViewer, { onEdit, onDelete, onTogglePin, onReport }: PostHandlers): ContentAction[] {
  const isAuthor = post.author.id === viewer.id;
  const actions: ContentAction[] = [];
  if (viewer.isAdmin && (post.pin || !post.author.isBanned)) {
    actions.push({
      id: "pin",
      label: post.pin ? "Unpin" : "Pin to the top",
      icon: post.pin ? PinOff : Pin,
      onSelect: onTogglePin,
      movesFocus: true,
    });
  }
  if (isAuthor) actions.push({ id: "edit", label: "Edit", icon: Pencil, onSelect: onEdit, movesFocus: true });
  if (isAuthor || viewer.isAdmin) {
    actions.push({ id: "delete", label: "Delete", icon: Trash2, onSelect: onDelete, movesFocus: true });
  }
  if (!isAuthor && !viewer.isAdmin) actions.push({ id: "report", label: "Report", icon: Flag, onSelect: onReport, movesFocus: true });
  return actions;
}

function readsInlineByDefault({ commentCount }: Post) {
  return commentCount > 0 && commentCount <= FEED_LIMITS.inlineComments;
}

function readReplyButtonLabel({ commentCount }: Post) {
  return commentCount > FEED_LIMITS.inlineComments ? `${commentCount} replies` : "Reply";
}

type PostMenuProps = {
  post: Post;
  triggerRef: RefObject<HTMLButtonElement | null>;
  onModeChange: (mode: PostMode) => void;
  onPinFailure: (message: string | null) => void;
};

function PostMenu({ post, triggerRef, onModeChange, onPinFailure }: PostMenuProps) {
  const { viewer, announce, postAwaitingFocusRef } = useFeedContext();
  const pinPost = usePinPost(() => {
    announce(post.pin ? "Post unpinned." : "Post pinned to the top.");
    postAwaitingFocusRef.current = post.id;
  });
  return (
    <ContentMenu
      label={readMenuLabel(post, viewer)}
      triggerRef={triggerRef}
      actions={readPostActions(post, viewer, {
        onEdit: () => onModeChange(POST_MODES.editing),
        onDelete: () => onModeChange(POST_MODES.confirmingDelete),
        onReport: () => onModeChange(POST_MODES.confirmingReport),
        onTogglePin: () => {
          onPinFailure(null);
          pinPost.mutate(
            { postId: post.id, isPinned: !post.pin },
            { onError: ({ message }) => onPinFailure(message) },
          );
        },
      })}
    />
  );
}

type RepliesProps = { post: Post; tone: SurfaceTone };

function Replies({ post, tone }: RepliesProps) {
  const [isThreadChosenOpen, setIsThreadChosenOpen] = useState<boolean | null>(readsInlineByDefault(post) ? true : null);
  const isThreadOpen = isThreadChosenOpen ?? readsInlineByDefault(post);
  const hasManyReplies = post.commentCount > FEED_LIMITS.inlineComments;
  if (post.author.isBanned) return post.commentCount > 0 ? <CommentThread post={post} tone={tone} isReadOnly /> : null;
  return (
    <>
      <ReactionBar post={post} tone={tone}>
        <Button
          type="button"
          size="sm"
          variant={hasManyReplies ? "quiet" : "soft"}
          aria-expanded={hasManyReplies ? isThreadOpen : undefined}
          className={tone === SURFACE_TONES.surface ? "bg-card text-brand-emphasis" : undefined}
          onClick={() => {
            if (hasManyReplies && isThreadOpen) {
              setIsThreadChosenOpen(false);
              return;
            }
            flushSync(() => setIsThreadChosenOpen(true));
            if (!hasManyReplies) focusElement(toReplyInputId(post.id));
          }}
        >
          <MessageCircle aria-hidden="true" />
          {readReplyButtonLabel(post)}
        </Button>
      </ReactionBar>
      {isThreadOpen ? <CommentThread post={post} tone={tone} onReplied={() => setIsThreadChosenOpen(true)} /> : null}
    </>
  );
}

type PostLayoutProps = { post: Post; menu: ReactNode; editor: ReactNode; footer: ReactNode };

function PinnedPostLayout({ post, menu, editor, footer }: PostLayoutProps) {
  const { viewer: { isAdmin: isViewerAdmin } } = useFeedContext();
  const { heading, body } = splitAnnouncement(post.body);
  const { author, pin } = post;
  return (
    <article
      id={toPostElementId(post.id)}
      tabIndex={-1}
      aria-label={`Pinned post by ${author.name}`}
      className="rounded-card-phone bg-accent p-card-phone sm:rounded-card sm:p-6"
    >
      <div className="flex items-center gap-2">
        <p className="type-small flex min-w-0 flex-1 items-center gap-2 font-bold text-brand-emphasis">
          <Pin aria-hidden="true" className="size-[17px] shrink-0" />
          {pin?.pinnedByName ? `Pinned by ${pin.pinnedByName}` : "Pinned"}
        </p>
        <BannedTag author={author} isViewerAdmin={isViewerAdmin} />
        <PostTypeTag type={post.type} />
        <div className="-my-1.5">{menu}</div>
      </div>
      {editor ?? (
        <>
          {heading ? <h3 className="type-h2 mt-2.5">{heading}</h3> : null}
          <RichText text={body} className={cn("type-lead text-foreground-soft", heading ? "mt-1.5" : "mt-2.5")} />
          <p className="type-small mt-3 text-foreground-soft">
            <AuthorName author={author} className="font-bold text-foreground" /> · <RelativeTime timestamp={post.createdAt} />
            {post.editedAt ? " · edited" : null}
          </p>
        </>
      )}
      {footer}
    </article>
  );
}

function PlainPostLayout({ post, menu, editor, footer }: PostLayoutProps) {
  const { viewer: { isAdmin: isViewerAdmin } } = useFeedContext();
  const { author } = post;
  const roleLine = [author.title, author.company].filter(Boolean).join(", ");
  const shortRole = author.company ?? author.title;
  return (
    <article
      id={toPostElementId(post.id)}
      tabIndex={-1}
      aria-label={`Post by ${author.name}`}
      className="rounded-card-phone bg-card p-card-phone text-card-foreground shadow-panel sm:rounded-card sm:p-6"
    >
      <div className="flex items-center gap-3 sm:gap-3.5">
        <Avatar stableId={author.id} name={author.name} imageUrl={author.avatarUrl} sizePx={FEED_AVATAR_SIZES.post} />
        <div className="min-w-0 flex-1">
          <h3 className="text-base leading-[22px] font-bold">
            <AuthorName author={author} />
          </h3>
          <p className="type-small text-muted-foreground">
            {roleLine ? <span className="max-sm:hidden">{roleLine} · </span> : null}
            {shortRole ? <span className="sm:hidden">{shortRole} · </span> : null}
            <RelativeTime timestamp={post.createdAt} />
            {post.editedAt ? " · edited" : null}
          </p>
        </div>
        <BannedTag author={author} isViewerAdmin={isViewerAdmin} />
        <PostTypeTag type={post.type} />
        {menu}
      </div>
      {editor ?? <RichText text={post.body} className="type-lead mt-3.5" />}
      {footer}
    </article>
  );
}

export function PostCard({ post }: { post: Post }) {
  const { viewer, announce, postAwaitingFocusRef } = useFeedContext();
  const [mode, setMode] = useState<PostMode>(POST_MODES.reading);
  const [pinFailure, setPinFailure] = useState<string | null>(null);
  const menuTriggerRef = useRef<HTMLButtonElement>(null);
  const deletePost = useDeletePost(() => {
    announce("Post deleted.");
    focusElement(POSTS_REGION_ID);
  });
  const reportPost = useReportFeedContent();
  const Layout = post.pin ? PinnedPostLayout : PlainPostLayout;

  useEffect(() => {
    if (postAwaitingFocusRef.current !== post.id) return;
    postAwaitingFocusRef.current = null;
    focusElement(toPostElementId(post.id));
  }, [post.id, post.pin, postAwaitingFocusRef]);

  return (
    <Layout
      post={post}
      menu={<PostMenu post={post} triggerRef={menuTriggerRef} onModeChange={setMode} onPinFailure={setPinFailure} />}
      editor={
        mode === POST_MODES.editing ? (
          <PostEditor
            post={post}
            onDone={() => {
              setMode(POST_MODES.reading);
              menuTriggerRef.current?.focus();
            }}
          />
        ) : null
      }
      footer={
        <>
          {mode === POST_MODES.confirmingDelete ? (
            <ConfirmDelete
              message={readDeleteMessage(post, viewer)}
              isPending={deletePost.isPending}
              errorMessage={deletePost.error?.message ?? null}
              onConfirm={() => deletePost.mutate(post.id)}
              onCancel={() => {
                setMode(POST_MODES.reading);
                menuTriggerRef.current?.focus();
              }}
            />
          ) : null}
          {reportPost.data ? (
            <Alert role="none" className="mt-3.5">
              {reportPost.data.message}
            </Alert>
          ) : null}
          {mode === POST_MODES.confirmingReport ? (
            <div className="mt-3.5">
              <ConfirmAction
                message={`Report this post? ${REPORT_NOTE}`}
                confirmLabel="Report"
                pendingLabel="Reporting…"
                cancelLabel="Keep it"
                isPending={reportPost.isPending}
                errorMessage={reportPost.error?.message ?? null}
                onCancel={() => {
                  setMode(POST_MODES.reading);
                  menuTriggerRef.current?.focus();
                }}
                onConfirm={() =>
                  reportPost.mutate(
                    { targetType: FEED_REPORT_TARGETS.post, targetId: post.id },
                    {
                      onSuccess: ({ message }) => {
                        announce(message);
                        setMode(POST_MODES.reading);
                        menuTriggerRef.current?.focus();
                      },
                    },
                  )
                }
              />
            </div>
          ) : null}
          {pinFailure ? (
            <div className="mt-3">
              <FormError message={pinFailure} />
            </div>
          ) : null}
          <Replies post={post} tone={post.pin ? SURFACE_TONES.surface : SURFACE_TONES.sunk} />
        </>
      }
    />
  );
}
