"use client";

import { useQuery, useSuspenseInfiniteQuery } from "@tanstack/react-query";
import { ArrowDown, ArrowLeft, Ban, Lock, MessageCircle } from "lucide-react";
import Link from "next/link";
import { useEffect, useRef, useState, type RefObject } from "react";

import { EmptyState } from "@/components/empty-state";
import { FormError } from "@/components/form-error";
import { QueryBoundary } from "@/components/query-boundary";
import { Avatar } from "@/components/ui/avatar";
import { Alert } from "@/components/ui/alert";
import { Button } from "@/components/ui/button";
import { usePageVisible } from "@/components/use-page-visible";
import { readFirstName } from "@/lib/design/avatar-identity";
import type { ConversationPeer, ThreadPage } from "@/lib/messages/message-api";
import { pendingMessagesQuery, threadChangesQuery, threadQuery } from "@/lib/messages/message-queries";
import { readThreadMessages } from "@/lib/messages/thread-cache";
import { buildThreadEntries, describeNewMessages, readNewestPeerSequence } from "@/lib/messages/thread-entries";
import { ROUTES } from "@/lib/routes";
import { RequestFailure } from "@/lib/village/post-network-request";

import { ContentMenu } from "../feed/content-menu";
import { ConfirmAction } from "./confirm-action";
import { describeBlock, describeThreadPrivacy } from "./message-copy";
import { MessageComposer } from "./message-composer";
import { MessageRow } from "./message-row";
import { PhoneMessagesHeading } from "./phone-messages-heading";
import { requestInboxFocus, takeThreadFocusRequest, THREAD_FOCUS_TARGETS } from "./thread-focus";
import { useBrowserTimeZone } from "./use-browser-time-zone";
import { useDiscardFailedMessage, useMarkRead, useSendMessage, useSetBlock } from "./use-message-mutations";
import { useThreadScroll } from "./use-thread-scroll";
import { useVisualViewportFit } from "./use-visual-viewport-fit";

const HEADER_AVATAR_SIZE_PX = 52;
const UNAUTHORIZED_STATUS = 401;
const NOT_FOUND_STATUS = 404;
const BLOCK_ACTION_ID = "block";

const POLL_FAILURE_EXITS: Partial<Record<number, string>> = {
  [UNAUTHORIZED_STATUS]: ROUTES.signIn,
  [NOT_FOUND_STATUS]: ROUTES.messages,
};

function readPollFailureExit(error: Error | null) {
  return error instanceof RequestFailure ? POLL_FAILURE_EXITS[error.status] : undefined;
}

function readPeerRole({ title, company }: ConversationPeer) {
  return [title, company].filter(Boolean).join(", ");
}

function PeerIdentity({ peer }: { peer: ConversationPeer }) {
  return (
    <>
      <Avatar stableId={peer.id} name={peer.name} imageUrl={peer.avatarUrl} sizePx={HEADER_AVATAR_SIZE_PX} />
      <span className="min-w-0">
        <span className="type-h3 block truncate">{peer.name}</span>
        {readPeerRole(peer) ? <span className="type-small block truncate text-muted-foreground">{readPeerRole(peer)}</span> : null}
      </span>
    </>
  );
}

type ThreadHeaderProps = {
  conversationId: string;
  peer: ConversationPeer;
  isBlockedByMe: boolean;
  headingRef: RefObject<HTMLHeadingElement | null>;
  onChooseBlock: () => void;
  onUnblock: () => void;
};

function ThreadHeader({ conversationId, peer, isBlockedByMe, headingRef, onChooseBlock, onUnblock }: ThreadHeaderProps) {
  const menuTriggerRef = useRef<HTMLButtonElement>(null);
  const profileHref = `${ROUTES.members}/${peer.id}`;
  return (
    <header className="flex min-h-20 items-center gap-2 border-b px-2 py-2.5 lg:gap-3.5 lg:px-7 lg:py-[18px]">
      <PhoneMessagesHeading />
      <Button asChild variant="quiet" size="icon" className="lg:hidden">
        <Link href={ROUTES.messages} aria-label="Back to conversations" onClick={() => requestInboxFocus(conversationId)}>
          <ArrowLeft aria-hidden="true" />
        </Link>
      </Button>
      <h2 ref={headingRef} tabIndex={-1} className="flex min-w-0 flex-1 items-center gap-3 outline-none lg:gap-3.5">
        {peer.isAvailable ? (
          <Link href={profileHref} className="flex min-w-0 items-center gap-3 rounded-field lg:gap-3.5">
            <PeerIdentity peer={peer} />
          </Link>
        ) : (
          <PeerIdentity peer={peer} />
        )}
      </h2>
      {peer.isAvailable ? (
        <Button asChild variant="outline" size="sm" className="max-lg:hidden">
          <Link href={profileHref} aria-label={`View profile of ${peer.name}`}>
            View profile
          </Link>
        </Button>
      ) : null}
      <ContentMenu
        label={`More options for this conversation with ${peer.name}`}
        triggerRef={menuTriggerRef}
        actions={[
          {
            id: BLOCK_ACTION_ID,
            label: isBlockedByMe ? `Unblock ${readFirstName(peer.name)}` : `Block ${readFirstName(peer.name)}`,
            icon: Ban,
            movesFocus: !isBlockedByMe,
            onSelect: isBlockedByMe ? onUnblock : onChooseBlock,
          },
        ]}
      />
    </header>
  );
}

function PrivacyNote({ peerName }: { peerName: string }) {
  return (
    <p className="type-small mx-auto mb-3 flex max-w-[520px] items-start gap-2.5 rounded-field bg-muted px-4 py-3 font-semibold text-foreground-soft">
      <Lock aria-hidden="true" className="mt-0.5 size-4 shrink-0" />
      {describeThreadPrivacy(peerName)}
    </p>
  );
}

function NewMessageAnnouncer({ page, messages }: { page: ThreadPage; messages: ThreadPage["messages"] }) {
  const newestPeerSequence = readNewestPeerSequence(messages);
  const [announced, setAnnounced] = useState({ sequence: newestPeerSequence, text: "" });
  if (newestPeerSequence > announced.sequence) {
    setAnnounced({
      sequence: newestPeerSequence,
      text: describeNewMessages(messages, announced.sequence, page.peer.name),
    });
  }
  return (
    <div role="status" aria-live="polite" data-slot="new-message-announcer" className="sr-only">
      {announced.text}
    </div>
  );
}

type ThreadStatus = { isBlockedByMe: boolean; isPeerAvailable: boolean };

function ComposerReplacement({ peerName, isBlockedByMe, isUnblocking, onUnblock }: { peerName: string; isBlockedByMe: boolean; isUnblocking: boolean; onUnblock: () => void }) {
  const firstName = readFirstName(peerName);
  if (!isBlockedByMe) {
    return (
      <div className="px-3 pt-2 pb-[max(env(safe-area-inset-bottom),12px)] lg:px-6 lg:pb-6">
        <Alert>{`${firstName} isn't available right now, so you can't send messages here.`}</Alert>
      </div>
    );
  }
  return (
    <div className="flex flex-wrap items-center justify-between gap-3 px-4 pt-2 pb-[max(env(safe-area-inset-bottom),12px)] lg:px-7 lg:pb-6">
      <p className="type-small min-w-0 flex-[1_1_240px] text-foreground-soft">
        {`You blocked ${firstName}. They haven't been told, and nothing they send reaches you.`}
      </p>
      <Button type="button" variant="outline" size="sm" disabled={isUnblocking} onClick={onUnblock}>
        {`Unblock ${firstName}`}
      </Button>
    </div>
  );
}

function canCompose({ isBlockedByMe, isPeerAvailable }: ThreadStatus) {
  return !isBlockedByMe && isPeerAvailable;
}

function createClientKey() {
  return crypto.randomUUID();
}

function usePollFailureExit(error: Error | null) {
  const exit = readPollFailureExit(error);
  useEffect(() => {
    if (exit) window.location.assign(exit);
  }, [exit]);
}

function ThreadView({ conversationId }: { conversationId: string }) {
  const thread = useSuspenseInfiniteQuery(threadQuery(conversationId));
  const changes = useQuery(threadChangesQuery(conversationId));
  const { data: pending } = useQuery(pendingMessagesQuery(conversationId));
  const timeZone = useBrowserTimeZone();
  const isVisible = usePageVisible();
  const [actionStatus, setActionStatus] = useState("");
  const [isConfirmingBlock, setIsConfirmingBlock] = useState(false);
  const headingRef = useRef<HTMLHeadingElement>(null);
  const composerRef = useRef<HTMLTextAreaElement>(null);
  const rootRef = useVisualViewportFit<HTMLElement>();
  const send = useSendMessage(conversationId);
  const discardFailed = useDiscardFailedMessage(conversationId);
  const { mutate: markRead } = useMarkRead(conversationId);

  const [newestPage] = thread.data.pages;
  const peerMemberId = newestPage?.peer.id ?? "";
  const setBlock = useSetBlock(peerMemberId, conversationId);
  const messages = readThreadMessages(thread.data);
  const entries = buildThreadEntries({ messages, pending: pending ?? [], timeZone });
  const newestPeerSequence = readNewestPeerSequence(messages);
  const lastReadSequence = newestPage?.lastReadSequence ?? 0;
  const newestEntry = entries.at(-1);
  const { containerRef, onScroll, rememberScrollPosition, scrollToNewest, hasUnseenMessages } = useThreadScroll({
    newestKey: newestEntry?.key ?? null,
    oldestKey: entries[0]?.key ?? null,
    isNewestMine: newestEntry?.isMine ?? false,
  });

  usePollFailureExit(changes.error);

  useEffect(() => {
    const target = takeThreadFocusRequest();
    if (target === THREAD_FOCUS_TARGETS.heading) headingRef.current?.focus();
    if (target === THREAD_FOCUS_TARGETS.composer) composerRef.current?.focus();
  }, []);

  useEffect(() => {
    if (isVisible && newestPeerSequence > lastReadSequence) markRead(newestPeerSequence);
  }, [isVisible, newestPeerSequence, lastReadSequence, markRead]);

  if (!newestPage) return null;
  const { peer, isBlockedByMe } = newestPage;
  const firstName = readFirstName(peer.name);

  return (
    <section
      ref={rootRef}
      data-phone-takeover
      aria-label={`Conversation with ${peer.name}`}
      className="flex h-full flex-col bg-card max-lg:fixed max-lg:inset-x-0 max-lg:top-0 max-lg:z-30 max-lg:h-dvh"
    >
      <ThreadHeader
        conversationId={conversationId}
        peer={peer}
        isBlockedByMe={isBlockedByMe}
        headingRef={headingRef}
        onChooseBlock={() => setIsConfirmingBlock(true)}
        onUnblock={() => setBlock.mutate(false, { onSuccess: () => setActionStatus(`Unblocked ${peer.name}.`) })}
      />
      {isConfirmingBlock ? (
        <div className="border-b p-3 lg:px-7">
          <ConfirmAction
            message={`Block ${peer.name}? ${describeBlock(peer.name)}`}
            confirmLabel={`Block ${firstName}`}
            pendingLabel="Blocking…"
            cancelLabel="Never mind"
            isPending={setBlock.isPending}
            errorMessage={setBlock.error?.message ?? null}
            onCancel={() => {
              setIsConfirmingBlock(false);
              headingRef.current?.focus();
            }}
            onConfirm={() =>
              setBlock.mutate(true, {
                onSuccess: () => {
                  setIsConfirmingBlock(false);
                  setActionStatus(`Blocked ${peer.name}.`);
                  headingRef.current?.focus();
                },
              })
            }
          />
        </div>
      ) : null}
      <div className="relative flex min-h-0 flex-1 flex-col">
        <div
          ref={containerRef}
          tabIndex={0}
          role="group"
          aria-label={`Messages with ${peer.name}`}
          onScroll={onScroll}
          className="relative flex min-h-0 flex-1 flex-col overflow-y-auto overscroll-contain px-3 py-4 outline-offset-[-3px] lg:px-7 lg:py-6"
        >
          <div className="mt-auto">
            {thread.hasNextPage ? (
              <div className="flex justify-center pb-4">
                <Button
                  type="button"
                  variant="outline"
                  aria-busy={thread.isFetchingNextPage}
                  onClick={() => {
                    if (thread.isFetchingNextPage) return;
                    rememberScrollPosition();
                    void thread.fetchNextPage();
                  }}
                >
                  {thread.isFetchingNextPage ? "Finding older messages…" : "Show older messages"}
                </Button>
              </div>
            ) : entries.length > 0 ? (
              <PrivacyNote peerName={peer.name} />
            ) : null}
            {thread.isFetchNextPageError ? <FormError message={thread.error?.message ?? null} /> : null}
            {entries.length === 0 ? (
              <EmptyState
                icon={MessageCircle}
                headingLevel="h3"
                title={`Say hi to ${firstName}`}
                description={describeThreadPrivacy(peer.name)}
              />
            ) : (
              <ol className="grid gap-2">
                {entries.map((entry) => (
                  <MessageRow
                    key={entry.key}
                    entry={entry}
                    context={{ conversationId, peer, timeZone, composerRef, onAnnounce: setActionStatus }}
                    onRetry={(clientKey, body) => send.mutate({ clientKey, body })}
                    onDiscard={(clientKey) => {
                      discardFailed(clientKey);
                      composerRef.current?.focus();
                    }}
                  />
                ))}
              </ol>
            )}
          </div>
        </div>
        {hasUnseenMessages ? (
          <div className="pointer-events-none absolute inset-x-0 bottom-3 flex justify-center">
            <Button type="button" size="sm" className="pointer-events-auto" onClick={scrollToNewest}>
              <ArrowDown aria-hidden="true" />
              New messages
            </Button>
          </div>
        ) : null}
      </div>
      <NewMessageAnnouncer page={newestPage} messages={messages} />
      <div role="status" className="sr-only">
        {actionStatus}
      </div>
      {changes.isError && !readPollFailureExit(changes.error) ? (
        <p role="status" className="type-small px-5 pt-2 text-center text-muted-foreground">
          We can&apos;t reach the server right now. New messages will show up when it&apos;s back.
        </p>
      ) : null}
      {canCompose({ isBlockedByMe, isPeerAvailable: peer.isAvailable }) ? (
        <MessageComposer
          peerName={peer.name}
          inputRef={composerRef}
          onSend={(body) => send.mutate({ clientKey: createClientKey(), body })}
        />
      ) : (
        <ComposerReplacement
          peerName={peer.name}
          isBlockedByMe={isBlockedByMe}
          isUnblocking={setBlock.isPending}
          onUnblock={() => setBlock.mutate(false, { onSuccess: () => setActionStatus(`Unblocked ${peer.name}.`) })}
        />
      )}
      {setBlock.error && !isConfirmingBlock ? <FormError message={setBlock.error.message} /> : null}
    </section>
  );
}

export function Thread({ conversationId }: { conversationId: string }) {
  return (
    <QueryBoundary loadingMessage="Opening your conversation…">
      <ThreadView key={conversationId} conversationId={conversationId} />
    </QueryBoundary>
  );
}
