"use client";

import { useSuspenseInfiniteQuery } from "@tanstack/react-query";
import { cn } from "cn";
import { Flag, Pencil, SendHorizontal, Trash2 } from "lucide-react";
import { useRef, useState } from "react";

import { FormError } from "@/components/form-error";
import { QueryBoundary } from "@/components/query-boundary";
import { FEED_REPORT_TARGETS, FEED_LIMITS, type Comment, type Post } from "@/modules/feed/contract";
import { Alert } from "@/components/ui/alert";
import { Avatar } from "@/components/ui/avatar";
import { Button } from "@/components/ui/button";
import { Textarea } from "@/components/ui/textarea";
import { readFirstName } from "@/platform/design/avatar-identity";
import { hasWholeThread } from "@/modules/feed/rules-cache";

import { ConfirmAction } from "@/components/confirm-action";
import { AuthorName, readRemovedAuthorLabel } from "./author-name";
import { LengthCounter, submitOnCommandEnter, submitWithoutReload } from "./composer";
import { ConfirmDelete } from "@/components/confirm-delete";
import { ContentMenu, type ContentAction } from "@/components/content-menu";
import { useFeedContext, type FeedViewer } from "./feed-context";
import {
  ADMIN_DELETE_NOTE,
  FEED_AVATAR_SIZES,
  REPORT_NOTE,
  SURFACE_TONE_CLASSES,
  toPostElementId,
  toReplyInputId,
  type SurfaceTone,
} from "./feed-display";
import { commentsQuery } from "@/modules/feed/queries";
import { RelativeTime } from "./relative-time";
import { RichText } from "@/components/rich-text";
import { useCreateComment, useDeleteComment, useEditComment, useReportFeedContent } from "./use-feed-mutations";

const COMMENT_MODES = { reading: "reading", editing: "editing", confirmingDelete: "confirmingDelete", confirmingReport: "confirmingReport" } as const;

type CommentMode = (typeof COMMENT_MODES)[keyof typeof COMMENT_MODES];

function readCommentMenuLabel(comment: Comment, viewer: FeedViewer) {
  if (comment.author.id === viewer.id) return "Actions for your reply";
  return `Actions for ${comment.author.name}'s reply`;
}

function readDeleteMessage(comment: Comment, viewer: FeedViewer) {
  if (!viewer.isAdmin) return "Delete this reply? It's gone for good.";
  const subject = comment.author.id === viewer.id ? "your" : `${comment.author.name}'s`;
  return `Delete ${subject} reply for everyone? ${ADMIN_DELETE_NOTE}`;
}

function moveFocusAfterDeletedReply(postId: string) {
  const target = document.getElementById(toReplyInputId(postId)) ?? document.getElementById(toPostElementId(postId));
  target?.focus();
}

type CommentHandlers = { onEdit: () => void; onDelete: () => void; onReport: () => void };

function readCommentActions(comment: Comment, viewer: FeedViewer, { onEdit, onDelete, onReport }: CommentHandlers): ContentAction[] {
  const isAuthor = comment.author.id === viewer.id;
  if (!isAuthor && !viewer.isAdmin) return [{ id: "report", label: "Report", icon: Flag, onSelect: onReport, movesFocus: true }];
  const deleteAction = { id: "delete", label: "Delete", icon: Trash2, onSelect: onDelete, movesFocus: true };
  if (!isAuthor) return [deleteAction];
  return [{ id: "edit", label: "Edit", icon: Pencil, onSelect: onEdit, movesFocus: true }, deleteAction];
}

type CommentEditorProps = { comment: Comment; onDone: () => void; toneClass: string };

function CommentEditor({ comment, onDone, toneClass }: CommentEditorProps) {
  const [body, setBody] = useState(comment.body);
  const editComment = useEditComment(comment.postId);
  return (
    <form
      className="grid gap-2.5"
      onSubmit={(event) =>
        submitWithoutReload(event, () => editComment.mutate({ commentId: comment.id, body }, { onSuccess: onDone }))
      }
    >
      <Textarea
        autoFocus
        value={body}
        aria-label="Edit your reply"
        className={cn("min-h-20 resize-none shadow-none field-sizing-content focus:shadow-none", toneClass)}
        onChange={(event) => setBody(event.target.value)}
        onKeyDown={submitOnCommandEnter}
      />
      <LengthCounter length={body.length} maximumLength={FEED_LIMITS.commentLength} />
      <FormError message={editComment.error?.message ?? null} />
      <div className="flex flex-wrap gap-2">
        <Button type="submit" size="sm" disabled={editComment.isPending}>
          {editComment.isPending ? "Saving…" : "Save"}
        </Button>
        <Button type="button" variant="quiet" size="sm" onClick={onDone}>
          Cancel
        </Button>
      </div>
    </form>
  );
}

type CommentRowProps = { comment: Comment; tone: SurfaceTone };

function CommentRow({ comment, tone }: CommentRowProps) {
  const { viewer, announce } = useFeedContext();
  const [mode, setMode] = useState<CommentMode>(COMMENT_MODES.reading);
  const menuTriggerRef = useRef<HTMLButtonElement>(null);
  const deleteComment = useDeleteComment(comment.postId, () => {
    announce("Reply deleted.");
    moveFocusAfterDeletedReply(comment.postId);
  });
  const reportComment = useReportFeedContent();
  const { author } = comment;
  const toneClass = SURFACE_TONE_CLASSES[tone];

  return (
    <li className="flex items-start gap-3">
      <Avatar stableId={author.id} name={author.name} imageUrl={author.avatarUrl} sizePx={FEED_AVATAR_SIZES.comment} />
      <div className="min-w-0 flex-1">
        {mode === COMMENT_MODES.editing ? (
          <CommentEditor
            comment={comment}
            toneClass={toneClass}
            onDone={() => {
              setMode(COMMENT_MODES.reading);
              menuTriggerRef.current?.focus();
            }}
          />
        ) : (
          <div className={cn("rounded-input px-[18px] py-3", toneClass)}>
            <div className="type-small font-bold">
              <AuthorName author={author} />{" "}
              <span className="font-medium text-muted-foreground">
                · <RelativeTime timestamp={comment.createdAt} />
                {comment.editedAt ? " · edited" : null}
                {author.isBanned ? ` · ${readRemovedAuthorLabel(viewer.isAdmin).toLowerCase()}` : null}
              </span>
            </div>
            <RichText text={comment.body} className="type-note" />
          </div>
        )}
        {mode === COMMENT_MODES.confirmingDelete ? (
          <ConfirmDelete
            message={readDeleteMessage(comment, viewer)}
            isPending={deleteComment.isPending}
            errorMessage={deleteComment.error?.message ?? null}
            onConfirm={() => deleteComment.mutate(comment.id)}
            onCancel={() => {
              setMode(COMMENT_MODES.reading);
              menuTriggerRef.current?.focus();
            }}
          />
        ) : null}
        {reportComment.data ? (
          <Alert role="none" className="mt-2">
            {reportComment.data.message}
          </Alert>
        ) : null}
        {mode === COMMENT_MODES.confirmingReport ? (
          <div className="mt-2">
            <ConfirmAction
              message={`Report this reply? ${REPORT_NOTE}`}
              confirmLabel="Report"
              pendingLabel="Reporting…"
              cancelLabel="Keep it"
              isPending={reportComment.isPending}
              errorMessage={reportComment.error?.message ?? null}
              onCancel={() => {
                setMode(COMMENT_MODES.reading);
                menuTriggerRef.current?.focus();
              }}
              onConfirm={() =>
                reportComment.mutate(
                  { targetType: FEED_REPORT_TARGETS.comment, targetId: comment.id },
                  {
                    onSuccess: ({ message }) => {
                      announce(message);
                      setMode(COMMENT_MODES.reading);
                      menuTriggerRef.current?.focus();
                    },
                  },
                )
              }
            />
          </div>
        ) : null}
      </div>
      <ContentMenu
        label={readCommentMenuLabel(comment, viewer)}
        triggerRef={menuTriggerRef}
        actions={readCommentActions(comment, viewer, {
          onEdit: () => setMode(COMMENT_MODES.editing),
          onDelete: () => setMode(COMMENT_MODES.confirmingDelete),
          onReport: () => setMode(COMMENT_MODES.confirmingReport),
        })}
      />
    </li>
  );
}

function FullThread({ postId, tone }: { postId: string; tone: SurfaceTone }) {
  const thread = useSuspenseInfiniteQuery(commentsQuery(postId));
  const comments = thread.data.pages.flatMap((page) => page.comments);
  return (
    <>
      <ul className="grid gap-3">
        {comments.map((comment) => (
          <CommentRow key={comment.id} comment={comment} tone={tone} />
        ))}
      </ul>
      {thread.isFetchNextPageError ? <FormError message={thread.error?.message ?? null} /> : null}
      {thread.hasNextPage ? (
        <Button
          type="button"
          variant="quiet"
          size="sm"
          className="justify-self-start"
          disabled={thread.isFetchingNextPage}
          onClick={() => thread.fetchNextPage()}
        >
          {thread.isFetchingNextPage ? "Loading replies…" : "Show more replies"}
        </Button>
      ) : null}
    </>
  );
}

function ThreadLoading() {
  return (
    <p role="status" className="type-small rounded-input bg-muted px-[18px] py-3 text-foreground-soft">
      Gathering the replies…
    </p>
  );
}

type ReplyFormProps = { post: Post; onReplied?: () => void };

function ReplyForm({ post, onReplied }: ReplyFormProps) {
  const { viewer, announce } = useFeedContext();
  const [body, setBody] = useState("");
  const createComment = useCreateComment(post.id);
  return (
    <form
      className="grid gap-2"
      onSubmit={(event) =>
        submitWithoutReload(event, () =>
          createComment.mutate(
            { postId: post.id, body },
            {
              onSuccess: () => {
                setBody("");
                onReplied?.();
                announce("Your reply is live.");
              },
            },
          ),
        )
      }
    >
      <div className="flex items-center gap-3">
        <Avatar stableId={viewer.id} name={viewer.name} imageUrl={viewer.avatarUrl} sizePx={FEED_AVATAR_SIZES.comment} />
        <Textarea
          id={toReplyInputId(post.id)}
          rows={1}
          value={body}
          aria-label={`Reply to ${readFirstName(post.author.name)}`}
          aria-invalid={createComment.isError}
          placeholder="Write a reply"
          className="type-note max-h-48 min-h-12 flex-1 resize-none py-3 field-sizing-content"
          onChange={(event) => setBody(event.target.value)}
          onKeyDown={submitOnCommandEnter}
        />
        <Button type="submit" size="icon-lg" aria-label="Send reply" disabled={createComment.isPending}>
          <SendHorizontal aria-hidden="true" />
        </Button>
      </div>
      <LengthCounter length={body.length} maximumLength={FEED_LIMITS.commentLength} />
      <FormError message={createComment.error?.message ?? null} />
    </form>
  );
}

function ThreadReplies({ post, tone }: { post: Post; tone: SurfaceTone }) {
  if (!hasWholeThread(post)) {
    return (
      <QueryBoundary loadingMessage="Gathering the replies…" fallback={<ThreadLoading />}>
        <FullThread postId={post.id} tone={tone} />
      </QueryBoundary>
    );
  }
  if (post.inlineComments.length === 0) return null;
  return (
    <ul className="grid gap-3">
      {post.inlineComments.map((comment) => (
        <CommentRow key={comment.id} comment={comment} tone={tone} />
      ))}
    </ul>
  );
}

type CommentThreadProps = { post: Post; tone: SurfaceTone; onReplied?: () => void; isReadOnly?: boolean };

export function CommentThread({ post, tone, onReplied, isReadOnly = false }: CommentThreadProps) {
  return (
    <div className="mt-[18px] grid gap-3 border-t pt-[18px]">
      <ThreadReplies post={post} tone={tone} />
      {isReadOnly ? null : <ReplyForm post={post} onReplied={onReplied} />}
    </div>
  );
}
