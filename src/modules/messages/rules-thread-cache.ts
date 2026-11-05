import type { DirectMessage, Inbox, ThreadChanges, ThreadPage } from "./contract.ts";

export type ThreadPages = { pages: ThreadPage[]; pageParams: unknown[] };
export type InboxPages = { pages: Inbox[]; pageParams: unknown[] };

export const PENDING_STATUSES = { sending: "sending", failed: "failed" } as const;

type PendingStatus = (typeof PENDING_STATUSES)[keyof typeof PENDING_STATUSES];

export type PendingMessage = {
  clientKey: string;
  body: string;
  status: PendingStatus;
  failureMessage: string | null;
  createdAt: string;
};

export function readThreadMessages(thread: ThreadPages) {
  return thread.pages.flatMap(({ messages }) => messages).toSorted((first, second) => first.sequence - second.sequence);
}

function readOldestLoadedSequence(thread: ThreadPages) {
  const oldestPage = thread.pages.at(-1);
  if (!oldestPage || oldestPage.olderCursor === null) return 0;
  return oldestPage.olderCursor;
}

function replaceKnownMessages(page: ThreadPage, changesById: Map<string, DirectMessage>) {
  return { ...page, messages: page.messages.map((message) => changesById.get(message.id) ?? message) };
}

export function mergeMessages(thread: ThreadPages, changedMessages: DirectMessage[]): ThreadPages {
  const [newestPage, ...olderPages] = thread.pages;
  if (!newestPage) return thread;

  const changesById = new Map(changedMessages.map((message) => [message.id, message]));
  const knownIds = new Set(thread.pages.flatMap(({ messages }) => messages.map(({ id }) => id)));
  const oldestLoadedSequence = readOldestLoadedSequence(thread);
  const newMessages = changedMessages.filter(({ id, sequence }) => !knownIds.has(id) && sequence >= oldestLoadedSequence);
  const updatedNewestPage = replaceKnownMessages(newestPage, changesById);

  return {
    ...thread,
    pages: [
      {
        ...updatedNewestPage,
        messages: [...updatedNewestPage.messages, ...newMessages].toSorted((first, second) => first.sequence - second.sequence),
      },
      ...olderPages.map((page) => replaceKnownMessages(page, changesById)),
    ],
  };
}

export function applyThreadChanges(thread: ThreadPages, changes: ThreadChanges): ThreadPages {
  const merged = mergeMessages(thread, changes.messages);
  const [newestPage, ...olderPages] = merged.pages;
  if (!newestPage) return merged;

  return {
    ...merged,
    pages: [
      {
        ...newestPage,
        revision: Math.max(newestPage.revision, changes.revision),
        isBlockedByMe: changes.isBlockedByMe,
        peer: { ...newestPage.peer, isAvailable: changes.isPeerAvailable },
      },
      ...olderPages,
    ],
  };
}

export function updateNewestPage(thread: ThreadPages, update: (page: ThreadPage) => ThreadPage): ThreadPages {
  const [newestPage, ...olderPages] = thread.pages;
  if (!newestPage) return thread;
  return { ...thread, pages: [update(newestPage), ...olderPages] };
}

export function keepUnconfirmedPending(pending: PendingMessage[], confirmed: DirectMessage[]) {
  const confirmedKeys = new Set(confirmed.flatMap(({ clientKey }) => (clientKey ? [clientKey] : [])));
  return pending.filter(({ clientKey }) => !confirmedKeys.has(clientKey));
}

export function addPending(pending: PendingMessage[], message: PendingMessage) {
  return [...pending.filter(({ clientKey }) => clientKey !== message.clientKey), message];
}

export function removePending(pending: PendingMessage[], clientKey: string) {
  return pending.filter((message) => message.clientKey !== clientKey);
}

export function failPending(pending: PendingMessage[], clientKey: string, failureMessage: string) {
  return pending.map((message) =>
    message.clientKey === clientKey ? { ...message, status: PENDING_STATUSES.failed, failureMessage } : message,
  );
}

export function clearConversationUnread(inbox: InboxPages, conversationId: string): InboxPages {
  return {
    ...inbox,
    pages: inbox.pages.map((page) => ({
      ...page,
      conversations: page.conversations.map((summary) =>
        summary.id === conversationId ? { ...summary, unreadCount: 0 } : summary,
      ),
    })),
  };
}

export function readInboxConversations(inbox: InboxPages) {
  const seenIds = new Set<string>();
  return inbox.pages
    .flatMap(({ conversations }) => conversations)
    .filter(({ id }) => {
      if (seenIds.has(id)) return false;
      seenIds.add(id);
      return true;
    });
}
