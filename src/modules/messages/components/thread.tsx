"use client";

import { useQuery, useSuspenseInfiniteQuery } from "@tanstack/react-query";
import { useEffect, useLayoutEffect, useRef, useState } from "react";

import { ConfirmAction } from "@/components/confirm-action";
import { FormError } from "@/components/form-error";
import { BackLink } from "@/components/page-header";
import { QueryBoundary } from "@/components/query-boundary";
import { Button } from "@/components/ui/button";
import { usePageVisible } from "@/components/use-page-visible";
import { describeBlock } from "@/modules/members/contract-blocks";
import type { ThreadPage } from "@/modules/messages/contract";
import { describeThreadLine, NEW_THREAD_LINE } from "@/modules/messages/copy";
import { pendingMessagesQuery, threadChangesQuery, threadQuery } from "@/modules/messages/queries";
import { readThreadMessages } from "@/modules/messages/rules-thread-cache";
import { buildThreadEntries, describeNewMessages, readNewestPeerSequence } from "@/modules/messages/rules-thread-entries";
import { readFirstName } from "@/platform/design/avatar-identity";
import { RequestFailure } from "@/platform/http/post-request";
import { ROUTES } from "@/platform/http/routes";

import { MessageComposer } from "./message-composer";
import { MessageRow } from "./message-row";
import { requestInboxFocus, takeThreadFocusRequest, THREAD_FOCUS_TARGETS } from "./thread-focus";
import { useBrowserTimeZone } from "./use-browser-time-zone";
import { useDiscardFailedMessage, useMarkRead, useSendMessage, useSetBlock } from "./use-message-mutations";

const UNAUTHORIZED_STATUS = 401;
const NOT_FOUND_STATUS = 404;

const POLL_FAILURE_EXITS: Partial<Record<number, string>> = {
  [UNAUTHORIZED_STATUS]: ROUTES.signIn,
  [NOT_FOUND_STATUS]: ROUTES.messages,
};

function readPollFailureExit(error: Error | null) {
  return error instanceof RequestFailure ? POLL_FAILURE_EXITS[error.status] : undefined;
}

function NewMessageAnnouncer({ page, messages }: { page: ThreadPage; messages: ThreadPage["messages"] }) {
  const newestPeerSequence = readNewestPeerSequence(messages);
  const [announced, setAnnounced] = useState({ sequence: newestPeerSequence, text: "" });
  if (newestPeerSequence > announced.sequence) {
    setAnnounced({ sequence: newestPeerSequence, text: describeNewMessages(messages, announced.sequence, page.peer.name) });
  }
  return (
    <div role="status" aria-live="polite" data-slot="new-message-announcer" className="sr-only">
      {announced.text}
    </div>
  );
}

function ComposerReplacement({ peerName, isBlockedByMe, isUnblocking, onUnblock }: { peerName: string; isBlockedByMe: boolean; isUnblocking: boolean; onUnblock: () => void }) {
  const firstName = readFirstName(peerName);
  if (!isBlockedByMe) {
    return <p className="fh-note mt-4">{`${firstName} isn't available right now, so you can't send messages here.`}</p>;
  }
  return (
    <div className="fh-note mt-4 flex flex-wrap items-center justify-between gap-3">
      <span className="min-w-0 flex-[1_1_240px]">{`You blocked ${firstName}. They haven't been told, and nothing they send reaches you.`}</span>
      <Button type="button" variant="secondary" size="sm" disabled={isUnblocking} onClick={onUnblock}>
        {`Unblock ${firstName}`}
      </Button>
    </div>
  );
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

// Founderhall's thread page (threadPage): "‹ Inbox", the name, one line, the messages, the reply box. Community keeps
// older messages, retries, delete, report and block (a quiet link at the foot).
function ThreadView({ conversationId, communityName }: { conversationId: string; communityName: string }) {
  const thread = useSuspenseInfiniteQuery(threadQuery(conversationId));
  const changes = useQuery(threadChangesQuery(conversationId));
  const { data: pending } = useQuery(pendingMessagesQuery(conversationId));
  const timeZone = useBrowserTimeZone();
  const isVisible = usePageVisible();
  const [actionStatus, setActionStatus] = useState("");
  const [isConfirmingBlock, setIsConfirmingBlock] = useState(false);
  const headingRef = useRef<HTMLHeadingElement>(null);
  const composerRef = useRef<HTMLTextAreaElement>(null);
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

  usePollFailureExit(changes.error);

  useEffect(() => {
    const target = takeThreadFocusRequest();
    if (target === THREAD_FOCUS_TARGETS.heading) headingRef.current?.focus();
    if (target === THREAD_FOCUS_TARGETS.composer) composerRef.current?.focus();
  }, []);

  // A message you send stays in sight above the reply box.
  const newestKey = newestEntry?.key ?? null;
  const isNewestMine = newestEntry?.isMine ?? false;
  useLayoutEffect(() => {
    if (isNewestMine) composerRef.current?.scrollIntoView?.({ block: "nearest" });
  }, [newestKey, isNewestMine]);

  useEffect(() => {
    if (isVisible && newestPeerSequence > lastReadSequence) markRead(newestPeerSequence);
  }, [isVisible, newestPeerSequence, lastReadSequence, markRead]);

  if (!newestPage) return null;
  const { peer, isBlockedByMe } = newestPage;
  const firstName = readFirstName(peer.name);
  const canCompose = !isBlockedByMe && peer.isAvailable;
  const unblock = () => setBlock.mutate(false, { onSuccess: () => setActionStatus(`Unblocked ${peer.name}.`) });

  return (
    <section aria-label={`Conversation with ${peer.name}`}>
      <BackLink href={ROUTES.messages}>
        <span onClick={() => requestInboxFocus(conversationId)}>Inbox</span>
      </BackLink>
      <div className="fh-pagehead">
        <h1 ref={headingRef} tabIndex={-1} className="fh-h2 outline-none">
          {peer.name}
        </h1>
        <p className="fh-small fh-muted">{describeThreadLine(communityName)}</p>
      </div>
      {thread.hasNextPage ? (
        <Button
          type="button"
          variant="quiet"
          size="sm"
          className="mb-2"
          aria-busy={thread.isFetchingNextPage}
          onClick={() => {
            if (!thread.isFetchingNextPage) void thread.fetchNextPage();
          }}
        >
          {thread.isFetchingNextPage ? "Finding older messages…" : "Show older messages"}
        </Button>
      ) : null}
      {thread.isFetchNextPageError ? <FormError message={thread.error?.message ?? null} /> : null}
      <div role="group" aria-label={`Messages with ${peer.name}`} className="fh-msgs">
        {entries.length === 0 ? <p className="fh-small fh-muted">{NEW_THREAD_LINE}</p> : null}
        {entries.map((entry) => (
          <MessageRow
            key={entry.key}
            entry={entry}
            context={{ conversationId, peer, composerRef, onAnnounce: setActionStatus }}
            onRetry={(clientKey, body) => send.mutate({ clientKey, body })}
            onDiscard={(clientKey) => {
              discardFailed(clientKey);
              composerRef.current?.focus();
            }}
          />
        ))}
      </div>
      <NewMessageAnnouncer page={newestPage} messages={messages} />
      <div role="status" className="sr-only">
        {actionStatus}
      </div>
      {changes.isError && !readPollFailureExit(changes.error) ? (
        <p role="status" className="fh-hint mt-3">
          We can&apos;t reach the server right now. New messages will show up when it&apos;s back.
        </p>
      ) : null}
      {canCompose ? (
        <MessageComposer peerName={peer.name} inputRef={composerRef} onSend={(body) => send.mutate({ clientKey: createClientKey(), body })} />
      ) : (
        <ComposerReplacement peerName={peer.name} isBlockedByMe={isBlockedByMe} isUnblocking={setBlock.isPending} onUnblock={unblock} />
      )}
      {isConfirmingBlock ? (
        <div className="mt-4">
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
      ) : !isBlockedByMe && peer.isAvailable ? (
        <div className="mt-6">
          <button type="button" className="fh-linkbtn" onClick={() => setIsConfirmingBlock(true)}>
            {`Block ${firstName}`}
          </button>
        </div>
      ) : null}
      {setBlock.error && !isConfirmingBlock ? <FormError message={setBlock.error.message} /> : null}
    </section>
  );
}

export function Thread({ conversationId, communityName }: { conversationId: string; communityName: string }) {
  return (
    <QueryBoundary loadingMessage="Opening your conversation…">
      <ThreadView key={conversationId} conversationId={conversationId} communityName={communityName} />
    </QueryBoundary>
  );
}
