"use client";

import { cn } from "cn";
import { useRef, useState, type RefObject } from "react";

import { ConfirmAction } from "@/components/confirm-action";
import { ConfirmDelete } from "@/components/confirm-delete";
import { RICH_TEXT_TONES, RichText } from "@/components/rich-text";
import { Button } from "@/components/ui/button";
import type { ConversationPeer, DirectMessage } from "@/modules/messages/contract";
import { isFailed, isSending, type ThreadEntry } from "@/modules/messages/rules-thread-entries";
import { readFirstName } from "@/platform/design/avatar-identity";
import { formatDayMonth } from "@/platform/text/day-month";

import { useDeleteMessage, useReportMessage } from "./use-message-mutations";

const DELETED_LABEL = "Message deleted";
const BY_EMAIL = "by email";
const PANELS = { delete: "delete", report: "report" } as const;

type Panel = (typeof PANELS)[keyof typeof PANELS];

type ThreadRowContext = {
  conversationId: string;
  peer: ConversationPeer;
  composerRef: RefObject<HTMLTextAreaElement | null>;
  onAnnounce: (status: string) => void;
};

function readWhen(entry: ThreadEntry) {
  if (isSending(entry)) return "Sending…";
  if (isFailed(entry)) return "Not sent";
  const day = formatDayMonth(entry.createdAt);
  return entry.message?.isReported ? `${day} · reported` : day;
}

type BubbleProps = {
  entry: ThreadEntry;
  peerName: string;
  action?: { label: string; accessibleName: string; onSelect: () => void };
  actionRef?: RefObject<HTMLButtonElement | null>;
};

// Founderhall's message (`.msg`, crop messages-bubbles.png): theirs on Leaf with a rule, yours on the fund tint at the
// right; under the words, who, the date and "by email" when it came as an email reply. Delete or Report is a quiet
// link there, shown on hover and focus (Community keeps both).
function Bubble({ entry, peerName, action, actionRef }: BubbleProps) {
  return (
    // A tap on a phone focuses the message, which shows its link.
    <div tabIndex={action ? 0 : undefined} className={cn("fh-msg group", entry.isMine && "fh-me", isFailed(entry) && "shadow-[inset_0_0_0_1px_var(--ribbon)]")}>
      <p className={cn(entry.body === null && "text-graphite italic")}>
        {entry.body === null ? DELETED_LABEL : <RichText text={entry.body} tone={RICH_TEXT_TONES.surface} />}
      </p>
      <small>
        <span>{entry.isMine ? "You" : peerName}</span>
        <span>{readWhen(entry)}</span>
        {entry.message?.isViaEmail ? <span className="fh-via">{BY_EMAIL}</span> : null}
        {action ? (
          <button
            ref={actionRef}
            type="button"
            aria-label={action.accessibleName}
            className="fh-linkbtn py-0 text-[11.5px] leading-[15px] opacity-0 group-hover:opacity-100 group-focus-within:opacity-100 focus-visible:opacity-100"
            onClick={action.onSelect}
          >
            {action.label}
          </button>
        ) : null}
      </small>
    </div>
  );
}

type ActionPanelProps = { conversationId: string; message: DirectMessage; onCancel: () => void; onDone: (status: string) => void };

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
  );
}

const ACTION_PANELS: Record<Panel, typeof DeletePanel> = { [PANELS.delete]: DeletePanel, [PANELS.report]: ReportPanel };

function ConfirmedRow({ entry, message, context }: { entry: ThreadEntry; message: DirectMessage; context: ThreadRowContext }) {
  const { conversationId, peer, composerRef, onAnnounce } = context;
  const [panel, setPanel] = useState<Panel | null>(null);
  const triggerRef = useRef<HTMLButtonElement>(null);
  const hasActions = !message.isDeleted && !message.isReported;
  const ownPanel = message.isMine ? PANELS.delete : PANELS.report;
  const ActionPanel = panel ? ACTION_PANELS[panel] : null;
  const label = message.isMine ? "Delete" : "Report";

  return (
    <>
      <Bubble
        entry={entry}
        peerName={peer.name}
        action={
          hasActions
            ? {
                label,
                accessibleName: `${label} ${message.isMine ? "your" : `${readFirstName(peer.name)}'s`} message`,
                onSelect: () => setPanel(ownPanel),
              }
            : undefined
        }
        actionRef={triggerRef}
      />
      {ActionPanel ? (
        <div className={cn("w-full max-w-[420px]", message.isMine && "self-end")}>
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
      <Bubble entry={entry} peerName={context.peer.name} />
      {pending && isFailed(entry) ? (
        <div className="grid justify-items-end gap-2 self-end">
          <p role="alert" className="fh-small text-right text-ribbon">
            Not sent. {pending.failureMessage}
          </p>
          <div className="fh-btn-row justify-end">
            <Button type="button" size="sm" onClick={() => onRetry(pending.clientKey, pending.body)}>
              Try again
            </Button>
            <Button type="button" variant="secondary" size="sm" onClick={() => onDiscard(pending.clientKey)}>
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
  return entry.message ? (
    <ConfirmedRow entry={entry} message={entry.message} context={context} />
  ) : (
    <PendingRow entry={entry} context={context} onRetry={onRetry} onDiscard={onDiscard} />
  );
}
