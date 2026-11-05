export const THREAD_FOCUS_TARGETS = { heading: "heading", composer: "composer" } as const;

type ThreadFocusTarget = (typeof THREAD_FOCUS_TARGETS)[keyof typeof THREAD_FOCUS_TARGETS];

let requestedThreadFocus: ThreadFocusTarget | null = null;
let conversationToRefocus: string | null = null;

export function requestThreadFocus(target: ThreadFocusTarget) {
  requestedThreadFocus = target;
}

export function takeThreadFocusRequest() {
  const target = requestedThreadFocus;
  requestedThreadFocus = null;
  return target;
}

export function requestInboxFocus(conversationId: string) {
  conversationToRefocus = conversationId;
}

export function takeInboxFocusRequest() {
  const conversationId = conversationToRefocus;
  conversationToRefocus = null;
  return conversationId;
}

export function toConversationLinkId(conversationId: string) {
  return `conversation-${conversationId}`;
}
