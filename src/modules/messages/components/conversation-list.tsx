"use client";

import { useSuspenseInfiniteQuery } from "@tanstack/react-query";
import { cn } from "cn";
import Link from "next/link";
import { useDeferredValue, useEffect, useState } from "react";

import { FormError } from "@/components/form-error";
import { QueryBoundary } from "@/components/query-boundary";
import { Avatar } from "@/components/ui/avatar";
import { Button } from "@/components/ui/button";
import { SearchBox } from "@/components/ui/search-box";
import { useDebouncedValue } from "@/components/use-debounced-value";
import { MESSAGE_LIMITS, type ConversationSummary, describeUnreadMessages } from "@/modules/messages/contract";
import { INBOX_EMPTY } from "@/modules/messages/copy";
import { inboxQuery } from "@/modules/messages/queries";
import { readInboxConversations } from "@/modules/messages/rules-thread-cache";
import { ROUTES } from "@/platform/http/routes";
import { formatDayMonth } from "@/platform/text/day-month";

import { requestThreadFocus, takeInboxFocusRequest, THREAD_FOCUS_TARGETS, toConversationLinkId } from "./thread-focus";

const SEARCH_INPUT_ID = "conversation-search";
const DELETED_PREVIEW = "Message deleted";
const SEARCH_DEBOUNCE_MS = 250;
const NO_MATCH_MESSAGE = "Nobody matches that.";

function readPreview({ preview, isDeleted }: ConversationSummary["lastMessage"]) {
  const text = isDeleted ? DELETED_PREVIEW : (preview ?? "");
  return text.split("\n")[0] ?? "";
}

// Founderhall's thread row (`.threads .r`): avatar, serif name, the last line, the date on the right; a dot after the
// name while something is unread.
function ConversationRow({ summary }: { summary: ConversationSummary }) {
  const { id, peer, lastMessage, unreadCount, isBlockedByMe } = summary;
  const hasUnread = unreadCount > 0;
  return (
    <Link
      id={toConversationLinkId(id)}
      data-conversation-link
      href={`${ROUTES.messages}/${id}`}
      onClick={() => requestThreadFocus(THREAD_FOCUS_TARGETS.heading)}
      className={cn("fh-r", hasUnread && "fh-unread")}
    >
      <Avatar stableId={peer.id} name={peer.name} imageUrl={peer.avatarUrl} />
      <span className="fh-who">
        <b>
          {peer.name}
          {hasUnread ? <span className="sr-only">, {describeUnreadMessages(unreadCount)}</span> : null}
        </b>
        <span>
          {isBlockedByMe ? "Blocked. " : null}
          {readPreview(lastMessage)}
        </span>
      </span>
      <span className="fh-end">
        <small>
          <time dateTime={lastMessage.createdAt}>{formatDayMonth(lastMessage.createdAt)}</time>
        </small>
      </span>
    </Link>
  );
}

// Founderhall's empty inbox: the dashed empty state, its line linking the directory.
function NoConversations() {
  return (
    <div data-slot="empty-state" className="fh-empty">
      <h2 className="fh-h2">{INBOX_EMPTY.title}</h2>
      <p>
        {INBOX_EMPTY.before}
        <Link href={ROUTES.members}>{INBOX_EMPTY.link}</Link>
        {INBOX_EMPTY.after}
      </p>
    </div>
  );
}

function focusConversationAt(position: number) {
  document.querySelectorAll<HTMLElement>("[data-conversation-link]")[position]?.focus();
}

function ConversationRows() {
  const [search, setSearch] = useState("");
  const appliedSearch = useDeferredValue(useDebouncedValue(search, SEARCH_DEBOUNCE_MS));
  const inbox = useSuspenseInfiniteQuery(inboxQuery(appliedSearch.trim()));
  const conversations = readInboxConversations(inbox.data);
  const isSearching = Boolean(search.trim() || appliedSearch.trim());
  const hasNoMatch = conversations.length === 0 && isSearching;
  // Founderhall's inbox has no search. Community keeps it for a long inbox only: more than one page of conversations.
  const [isLong] = useState(inbox.hasNextPage);

  useEffect(() => {
    const conversationId = takeInboxFocusRequest();
    if (!conversationId) return;
    document.getElementById(toConversationLinkId(conversationId))?.focus();
  }, []);

  if (conversations.length === 0 && !isSearching) return <NoConversations />;

  return (
    <>
      {isLong || isSearching ? (
        <div role="search" className="mb-3.5">
          <label htmlFor={SEARCH_INPUT_ID} className="sr-only">
            Search people
          </label>
          <SearchBox
            id={SEARCH_INPUT_ID}
            value={search}
            maxLength={MESSAGE_LIMITS.searchLength}
            placeholder="Search people"
            autoComplete="off"
            onChange={(event) => setSearch(event.target.value)}
          />
        </div>
      ) : null}
      <p role="status" className={cn("fh-small fh-muted mb-2", !hasNoMatch && "sr-only")}>
        {hasNoMatch ? NO_MATCH_MESSAGE : null}
      </p>
      {conversations.length > 0 ? (
        <div className="fh-rows fh-threads">
          {conversations.map((summary) => (
            <ConversationRow key={summary.id} summary={summary} />
          ))}
        </div>
      ) : null}
      {inbox.isFetchNextPageError ? <FormError message={inbox.error?.message ?? null} /> : null}
      {inbox.hasNextPage ? (
        <Button
          type="button"
          variant="quiet"
          size="sm"
          className="mt-3"
          aria-busy={inbox.isFetchingNextPage}
          onClick={async () => {
            if (inbox.isFetchingNextPage) return;
            await inbox.fetchNextPage();
            requestAnimationFrame(() => focusConversationAt(conversations.length));
          }}
        >
          {inbox.isFetchingNextPage ? "Finding more…" : "More"}
        </Button>
      ) : null}
    </>
  );
}

// The Inbox list (Founderhall's inboxPage): the rows, or the dashed empty state.
export function ConversationList() {
  return (
    <QueryBoundary loadingMessage="Gathering your conversations…">
      <ConversationRows />
    </QueryBoundary>
  );
}
