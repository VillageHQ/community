import { removeBidiControls } from "../safe-text.ts";
import type { DirectMessage } from "./message-api.ts";
import { formatMessageDay, readMessageDayKey } from "./message-time.ts";
import { keepUnconfirmedPending, PENDING_STATUSES, type PendingMessage } from "./thread-cache.ts";

const MAXIMUM_ANNOUNCED_MESSAGES = 3;
const MAXIMUM_ANNOUNCED_CHARACTERS = 280;

export type ThreadEntry = {
  key: string;
  isMine: boolean;
  body: string | null;
  createdAt: string;
  message: DirectMessage | null;
  pending: PendingMessage | null;
  dayLabel: string | null;
  isRunEnd: boolean;
};

type EntryDraft = Pick<ThreadEntry, "key" | "isMine" | "body" | "createdAt" | "message" | "pending">;

function fromMessage(message: DirectMessage): EntryDraft {
  return {
    key: message.clientKey ?? message.id,
    isMine: message.isMine,
    body: message.body,
    createdAt: message.createdAt,
    message,
    pending: null,
  };
}

function fromPending(pending: PendingMessage): EntryDraft {
  return { key: pending.clientKey, isMine: true, body: pending.body, createdAt: pending.createdAt, message: null, pending };
}

type ThreadEntryInput = {
  messages: DirectMessage[];
  pending: PendingMessage[];
  timeZone: string;
  now?: Date;
};

export function buildThreadEntries({ messages, pending, timeZone, now = new Date() }: ThreadEntryInput): ThreadEntry[] {
  const drafts = [...messages.map(fromMessage), ...keepUnconfirmedPending(pending, messages).map(fromPending)];

  return drafts.map((draft, position) => {
    const previous = drafts[position - 1];
    const next = drafts[position + 1];
    const dayKey = readMessageDayKey(draft.createdAt, timeZone);
    const isNewDay = !previous || readMessageDayKey(previous.createdAt, timeZone) !== dayKey;
    const isLastOfDay = !next || readMessageDayKey(next.createdAt, timeZone) !== dayKey;
    return {
      ...draft,
      dayLabel: isNewDay ? formatMessageDay(draft.createdAt, timeZone, now) : null,
      isRunEnd: !next || next.isMine !== draft.isMine || isLastOfDay,
    };
  });
}

export function isSending({ pending }: Pick<ThreadEntry, "pending">) {
  return pending?.status === PENDING_STATUSES.sending;
}

export function isFailed({ pending }: Pick<ThreadEntry, "pending">) {
  return pending?.status === PENDING_STATUSES.failed;
}

export function readNewestPeerSequence(messages: DirectMessage[]) {
  return messages.reduce((newest, { isMine, sequence }) => (isMine ? newest : Math.max(newest, sequence)), 0);
}

function clipForAnnouncement(body: string) {
  const clean = removeBidiControls(body);
  return clean.length > MAXIMUM_ANNOUNCED_CHARACTERS ? `${clean.slice(0, MAXIMUM_ANNOUNCED_CHARACTERS)}…` : clean;
}

export function describeNewMessages(messages: DirectMessage[], afterSequence: number, peerName: string) {
  const fresh = messages.filter(({ isMine, isDeleted, sequence }) => !isMine && !isDeleted && sequence > afterSequence);
  if (fresh.length === 0) return "";
  if (fresh.length > MAXIMUM_ANNOUNCED_MESSAGES) return `${fresh.length} new messages from ${peerName}.`;
  return `New from ${peerName}: ${fresh.map(({ body }) => clipForAnnouncement(body ?? "")).join(". ")}`;
}
