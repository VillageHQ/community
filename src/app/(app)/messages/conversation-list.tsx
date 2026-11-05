"use client";

import { useSuspenseInfiniteQuery } from "@tanstack/react-query";
import { cn } from "cn";
import { MessageCirclePlus, Search, Users, X } from "lucide-react";
import Link from "next/link";
import { useDeferredValue, useEffect, useState } from "react";

import { EmptyState } from "@/components/empty-state";
import { FormError } from "@/components/form-error";
import { QueryBoundary } from "@/components/query-boundary";
import { Avatar } from "@/components/ui/avatar";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { MESSAGE_LIMITS, type ConversationSummary } from "@/lib/messages/message-api";
import { inboxQuery } from "@/lib/messages/message-queries";
import { formatConversationTime } from "@/lib/messages/message-time";
import { readInboxConversations } from "@/lib/messages/thread-cache";
import { describeUnreadMessages } from "@/lib/navigation";
import { ROUTES } from "@/platform/http/routes";

import { ADMIN_PRIVACY_NOTE } from "./message-copy";
import { requestThreadFocus, takeInboxFocusRequest, THREAD_FOCUS_TARGETS, toConversationLinkId } from "./thread-focus";
import { useBrowserTimeZone } from "./use-browser-time-zone";
import { useDebouncedValue } from "./use-debounced-value";

const CONVERSATION_AVATAR_SIZE_PX = 52;
const SEARCH_INPUT_ID = "conversation-search";
const DELETED_PREVIEW = "Message deleted";
const OWN_PREVIEW_PREFIX = "You: ";
const SEARCH_DEBOUNCE_MS = 250;
const NO_MATCH_MESSAGE = "Nobody matches that.";

function readPreview({ preview, isMine, isDeleted }: ConversationSummary["lastMessage"]) {
  const text = isDeleted ? DELETED_PREVIEW : (preview ?? "");
  return isMine ? `${OWN_PREVIEW_PREFIX}${text}` : text;
}

type ConversationRowProps = { summary: ConversationSummary; isActive: boolean; timeZone: string };

function ConversationRow({ summary, isActive, timeZone }: ConversationRowProps) {
  const { id, peer, lastMessage, unreadCount, isBlockedByMe } = summary;
  const hasUnread = unreadCount > 0;
  return (
    <li>
      <Link
        id={toConversationLinkId(id)}
        data-conversation-link
        href={`${ROUTES.messages}/${id}`}
        aria-current={isActive ? "true" : undefined}
        onClick={() => requestThreadFocus(THREAD_FOCUS_TARGETS.heading)}
        className="flex min-h-20 items-center gap-3 rounded-field px-3 py-2.5 hover:bg-muted aria-[current=true]:bg-accent"
      >
        <Avatar stableId={peer.id} name={peer.name} imageUrl={peer.avatarUrl} sizePx={CONVERSATION_AVATAR_SIZE_PX} />
        <span className="min-w-0 flex-1">
          <span className="flex items-baseline justify-between gap-2">
            <span className="type-label truncate">{peer.name}</span>
            <time dateTime={lastMessage.createdAt} className="type-micro shrink-0 font-medium text-muted-foreground">
              {formatConversationTime(lastMessage.createdAt, timeZone)}
            </time>
          </span>
          <span className={cn("type-small block truncate", hasUnread ? "font-bold text-foreground" : "text-foreground-soft")}>
            {isBlockedByMe ? "Blocked. " : null}
            {readPreview(lastMessage)}
          </span>
        </span>
        {hasUnread ? (
          <span
            role="img"
            aria-label={describeUnreadMessages(unreadCount)}
            className="type-micro inline-flex h-[26px] min-w-[26px] shrink-0 items-center justify-center rounded-full bg-primary px-2 font-bold text-primary-foreground shadow-[inset_0_0_0_1px_var(--brand-edge)]"
          >
            {unreadCount}
          </span>
        ) : null}
      </Link>
    </li>
  );
}

function NoConversations() {
  return (
    <>
      <div className="lg:hidden">
        <EmptyState
          icon={Users}
          title="No conversations yet"
          description={`Say hi to someone in the community. ${ADMIN_PRIVACY_NOTE}`}
        >
          <Button asChild size="lg">
            <Link href={ROUTES.members}>Meet the members</Link>
          </Button>
        </EmptyState>
      </div>
      <p className="type-small px-4 py-3 text-muted-foreground max-lg:hidden">Your conversations will show up here.</p>
    </>
  );
}

function readSearchField() {
  return document.getElementById(SEARCH_INPUT_ID);
}

function focusConversationAt(position: number) {
  document.querySelectorAll<HTMLElement>("[data-conversation-link]")[position]?.focus();
}

function ConversationRows({ activeConversationId }: { activeConversationId: string | null }) {
  const [search, setSearch] = useState("");
  const appliedSearch = useDeferredValue(useDebouncedValue(search, SEARCH_DEBOUNCE_MS));
  const inbox = useSuspenseInfiniteQuery(inboxQuery(appliedSearch.trim()));
  const timeZone = useBrowserTimeZone();
  const conversations = readInboxConversations(inbox.data);
  const hasNoMatch = conversations.length === 0 && Boolean(search.trim() || appliedSearch.trim());

  useEffect(() => {
    if (activeConversationId) return;
    const conversationId = takeInboxFocusRequest();
    if (!conversationId) return;
    (document.getElementById(toConversationLinkId(conversationId)) ?? readSearchField())?.focus();
  }, [activeConversationId]);

  if (conversations.length === 0 && !hasNoMatch) return <NoConversations />;

  return (
    <>
      <div role="search" className="relative px-4 pb-3">
        <label htmlFor={SEARCH_INPUT_ID} className="sr-only">
          Search people
        </label>
        <Search aria-hidden="true" className="pointer-events-none absolute top-3.5 left-8 size-5 text-muted-foreground" />
        <Input
          id={SEARCH_INPUT_ID}
          type="search"
          value={search}
          maxLength={MESSAGE_LIMITS.searchLength}
          placeholder="Search people"
          autoComplete="off"
          className="min-h-12 pr-12 pl-12 [&::-webkit-search-cancel-button]:hidden"
          onChange={(event) => setSearch(event.target.value)}
        />
        {search ? (
          <Button
            type="button"
            variant="quiet"
            size="icon"
            aria-label="Clear search"
            className="absolute top-0.5 right-[18px]"
            onClick={() => {
              setSearch("");
              readSearchField()?.focus();
            }}
          >
            <X aria-hidden="true" />
          </Button>
        ) : null}
      </div>
      <p role="status" className={cn("type-small px-5 pb-2 text-muted-foreground", !hasNoMatch && "sr-only")}>
        {hasNoMatch ? NO_MATCH_MESSAGE : null}
      </p>
      <div className="px-2 pt-1.5 pb-3 lg:min-h-0 lg:flex-1 lg:overflow-y-auto">
        <ul className="grid gap-1">
          {conversations.map((summary) => (
            <ConversationRow key={summary.id} summary={summary} isActive={summary.id === activeConversationId} timeZone={timeZone} />
          ))}
        </ul>
        {inbox.isFetchNextPageError ? <FormError message={inbox.error?.message ?? null} /> : null}
        {inbox.hasNextPage ? (
          <Button
            type="button"
            variant="outline"
            className="mt-2 w-full"
            aria-busy={inbox.isFetchingNextPage}
            onClick={async () => {
              if (inbox.isFetchingNextPage) return;
              await inbox.fetchNextPage();
              requestAnimationFrame(() => focusConversationAt(conversations.length));
            }}
          >
            {inbox.isFetchingNextPage ? "Finding more…" : "Show more conversations"}
          </Button>
        ) : null}
      </div>
    </>
  );
}

export function ConversationList({ activeConversationId }: { activeConversationId: string | null }) {
  return (
    <div className="flex flex-col rounded-card-phone bg-card shadow-panel lg:h-full lg:rounded-none lg:border-r lg:bg-transparent lg:shadow-none">
      <div className="flex items-center justify-between gap-3 px-5 pt-5 pb-3 lg:pt-7 lg:pb-4">
        <h1 className="type-h1">Messages</h1>
        <Button asChild size="icon-lg" className="rounded-full">
          <Link href={ROUTES.members} aria-label="New message: choose a member">
            <MessageCirclePlus aria-hidden="true" />
          </Link>
        </Button>
      </div>
      <QueryBoundary loadingMessage="Gathering your conversations…">
        <ConversationRows activeConversationId={activeConversationId} />
      </QueryBoundary>
    </div>
  );
}
