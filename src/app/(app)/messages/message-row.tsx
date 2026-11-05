"use client";

import { cn } from "cn";
import { Flag, Trash2 } from "lucide-react";
import { useRef, useState, type ReactNode, type RefObject } from "react";

import { Avatar } from "@/components/ui/avatar";
import { Button } from "@/components/ui/button";
import { readFirstName } from "@/platform/design/avatar-identity";
import type { ConversationPeer, DirectMessage } from "@/lib/messages/message-api";
import { formatMessageTime } from "@/lib/messages/message-time";
import { isFailed, isSending, type ThreadEntry } from "@/lib/messages/thread-entries";

import { ConfirmDelete } from "@/app/(app)/feed/confirm-delete";
import { ContentMenu, type ContentAction } from "@/app/(app)/feed/content-menu";
import { RICH_TEXT_TONES, RichText } from "@/app/(app)/feed/rich-text";
import { ConfirmAction } from "./confirm-action";
import { useDeleteMessage, useReportMessage } from "./use-message-mutations";

const BUBBLE_AVATAR_SIZE_PX = 36;
const DELETED_LABEL = "Message deleted";
const PANELS = { delete: "delete", report: "report" } as const;

type Panel = (typeof PANELS)[keyof typeof PANELS];

type ThreadRowContext = {
  conversationId: string;
  peer: ConversationPeer;
  timeZone: string;
  composerRef: RefObject<HTMLTextAreaElement | null>;
  onAnnounce: (status: string) => void;
};

function readEntryMeta(entry: ThreadEntry, timeZone: string) {
  if (isSending(entry)) return "Sending…";
  if (isFailed(entry)) return null;
  const sentAt = formatMessageTime(entry.createdAt, timeZone);
  if (entry.message?.isReported) return `Reported · ${sentAt}`;
  return entry.isRunEnd ? sentAt : null;
}

function readBubbleTone(entry: ThreadEntry) {
  if (entry.message?.isDeleted) return "bg-transparent text-muted-foreground shadow-[inset_0_0_0_1.5px_var(--input)]";
  if (isFailed(entry)) {
    return "rounded-br-lg bg-destructive-soft text-destructive-text shadow-[inset_0_0_0_1.5px_var(--destructive-text)]";
  }
  if (entry.isMine) return "rounded-br-lg bg-primary text-primary-foreground shadow-[inset_0_0_0_1.5px_var(--brand-edge)]";
  return "rounded-bl-lg bg-muted text-foreground";
}

function Bubble({ entry, peerName, timeZone }: { entry: ThreadEntry; peerName: string; timeZone: string }) {
  const usesAccentText = entry.isMine && !isFailed(entry) && !entry.message?.isDeleted;
  return (
    <div className={cn("type-body min-w-0 rounded-[24px] px-[18px] py-3", readBubbleTone(entry))}>
      <span className="sr-only">
        {entry.isMine ? "You" : peerName}, {formatMessageTime(entry.createdAt, timeZone)}:{" "}
      </span>
      {entry.body === null ? (
        DELETED_LABEL
      ) : (
        <RichText text={entry.body} tone={usesAccentText ? RICH_TEXT_TONES.accent : RICH_TEXT_TONES.surface} />
      )}
    </div>
  );
}

type BubbleLineProps = { entry: ThreadEntry; peer: ConversationPeer; timeZone: string; menu?: ReactNode };

function BubbleLine({ entry, peer, timeZone, menu }: BubbleLineProps) {
  const meta = readEntryMeta(entry, timeZone);
  return (
    <>
      <div className={cn("group flex items-end gap-2", entry.isMine && "flex-row-reverse")}>
        {entry.isMine ? null : entry.isRunEnd ? (
          <Avatar stableId={peer.id} name={peer.name} imageUrl={peer.avatarUrl} sizePx={BUBBLE_AVATAR_SIZE_PX} className="mb-0.5" />
        ) : (
          <span aria-hidden="true" className="w-9 shrink-0" />
        )}
        <div className="flex max-w-[76%] min-w-0 lg:max-w-[70%]">
          <Bubble entry={entry} peerName={peer.name} timeZone={timeZone} />
        </div>
        {menu ? <div data-slot="message-menu">{menu}</div> : null}
      </div>
      {meta ? (
        <p className={cn("type-micro mt-1 font-medium text-muted-foreground", entry.isMine ? "mr-1 text-right" : "ml-12")}>{meta}</p>
      ) : null}
    </>
  );
}

type ActionPanelProps = {
  conversationId: string;
  message: DirectMessage;
  onCancel: () => void;
  onDone: (status: string) => void;
};

function DeletePanel({ conversationId, message, onCancel, onDone }: ActionPanelProps) {
  const deleteMessage = useDeleteMessage(conversationId);
  return (
    <ConfirmDelete
      message="Delete this message? You'll both see “Message deleted” instead."
      isPending={deleteMessage.isPending}
      errorMessage={deleteMessage.error?.message ?? null}
      onCancel={onCancel}
      onConfirm={() => deleteMessage.mutate(message.id, { onSuccess: () => onDone("Message deleted.") })}
    />
  );
}

function ReportPanel({ conversationId, message, onCancel, onDone }: ActionPanelProps) {
  const reportMessage = useReportMessage(conversationId, message);
  return (
    <div className="mt-3.5">
      <ConfirmAction
        message="Report this message? It's saved for this community's admins. They'll be able to see this message, who sent it and that you reported it, and nothing else from this conversation."
        confirmLabel="Report"
        pendingLabel="Reporting…"
        cancelLabel="Keep it"
        isPending={reportMessage.isPending}
        errorMessage={reportMessage.error?.message ?? null}
        onCancel={onCancel}
        onConfirm={() => reportMessage.mutate(undefined, { onSuccess: () => onDone("Report saved for this community's admins.") })}
      />
    </div>
  );
}

const ACTION_PANELS: Record<Panel, typeof DeletePanel> = { [PANELS.delete]: DeletePanel, [PANELS.report]: ReportPanel };

function ConfirmedRow({ entry, message, context }: { entry: ThreadEntry; message: DirectMessage; context: ThreadRowContext }) {
  const { conversationId, peer, timeZone, composerRef, onAnnounce } = context;
  const [panel, setPanel] = useState<Panel | null>(null);
  const triggerRef = useRef<HTMLButtonElement>(null);
  const hasActions = !message.isDeleted && !message.isReported;
  const action: Pick<ContentAction, "id" | "label" | "icon"> = message.isMine
    ? { id: PANELS.delete, label: "Delete", icon: Trash2 }
    : { id: PANELS.report, label: "Report", icon: Flag };
  const ActionPanel = panel ? ACTION_PANELS[panel] : null;

  return (
    <>
      <BubbleLine
        entry={entry}
        peer={peer}
        timeZone={timeZone}
        menu={
          hasActions ? (
            <ContentMenu
              label={`Options for ${message.isMine ? "your" : `${readFirstName(peer.name)}'s`} message`}
              triggerRef={triggerRef}
              actions={[{ ...action, movesFocus: true, onSelect: () => setPanel(message.isMine ? PANELS.delete : PANELS.report) }]}
            />
          ) : null
        }
      />
      {ActionPanel ? (
        <div className={cn("mt-1 max-w-[420px]", message.isMine ? "ml-auto" : "ml-11")}>
          <ActionPanel
            conversationId={conversationId}
            message={message}
            onCancel={() => {
              setPanel(null);
              triggerRef.current?.focus();
            }}
            onDone={(status) => {
              setPanel(null);
              onAnnounce(status);
              composerRef.current?.focus();
            }}
          />
        </div>
      ) : null}
    </>
  );
}

type PendingRowProps = {
  entry: ThreadEntry;
  context: ThreadRowContext;
  onRetry: (clientKey: string, body: string) => void;
  onDiscard: (clientKey: string) => void;
};

function PendingRow({ entry, context, onRetry, onDiscard }: PendingRowProps) {
  const { pending } = entry;
  return (
    <>
      <BubbleLine entry={entry} peer={context.peer} timeZone={context.timeZone} />
      {pending && isFailed(entry) ? (
        <div className="mt-1.5 ml-auto grid max-w-[420px] justify-items-end gap-2">
          <p role="alert" className="type-small text-right font-semibold text-destructive-text">
            Not sent. {pending.failureMessage}
          </p>
          <div className="flex flex-wrap justify-end gap-2">
            <Button type="button" size="sm" onClick={() => onRetry(pending.clientKey, pending.body)}>
              Try again
            </Button>
            <Button type="button" variant="outline" size="sm" onClick={() => onDiscard(pending.clientKey)}>
              Discard
            </Button>
          </div>
        </div>
      ) : null}
    </>
  );
}

type MessageRowProps = Omit<PendingRowProps, "entry"> & { entry: ThreadEntry };

export function MessageRow({ entry, context, onRetry, onDiscard }: MessageRowProps) {
  return (
    <li data-message-key={entry.key}>
      {entry.dayLabel ? <p className="type-micro py-3 text-center font-bold text-muted-foreground">{entry.dayLabel}</p> : null}
      {entry.message ? (
        <ConfirmedRow entry={entry} message={entry.message} context={context} />
      ) : (
        <PendingRow entry={entry} context={context} onRetry={onRetry} onDiscard={onDiscard} />
      )}
    </li>
  );
}
