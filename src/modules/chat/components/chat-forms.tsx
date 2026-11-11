"use client";

import { useMutation } from "@tanstack/react-query";
import { Copy, Send } from "lucide-react";
import { useRouter } from "next/navigation";
import { useState, type FormEvent, type ReactNode } from "react";

import { ConfirmAction } from "@/components/confirm-action";
import { FLASH_KINDS, useFlash } from "@/components/flash";
import { Field } from "@/components/form-field";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Note } from "@/components/ui/note";
import { Select } from "@/components/ui/select";
import { Textarea } from "@/components/ui/textarea";
import { acknowledgedResponseSchema } from "@/platform/http/contract";
import { postRequest } from "@/platform/http/post-request";

import { CHAT_API_ROUTES, type ChatKind, type SlackChannel } from "../contract";

// Founderhall's Integrations forms (integrations/views.mjs). After an action the page refreshes and a flash says what
// happened; a refusal shows on the card it belongs to.
const TEST_FAILED = "The test post didn’t go through. The reason is on the card.";
const SECRET_FIELD_CLASSES = "font-mono";

type ChatRequest = { path: string; body: unknown };

function useChatAction({ failedFlash }: { failedFlash?: string } = {}) {
  const router = useRouter();
  const flash = useFlash();
  return useMutation({
    mutationFn: ({ path, body }: ChatRequest) => postRequest(path, body, acknowledgedResponseSchema),
    onSuccess: ({ message }) => {
      flash(message);
      router.refresh();
    },
    onError: () => {
      if (failedFlash) flash(failedFlash, { kind: FLASH_KINDS.needs });
    },
  });
}

function readField(event: FormEvent<HTMLFormElement>, name: string) {
  return String(new FormData(event.currentTarget).get(name) ?? "");
}

// The card's own error line (`.note.needs`, role alert).
export function ChatErrorNote({ children }: { children: ReactNode }) {
  return (
    <Note kind="needs" role="alert" className="mt-3">
      <span className="wrap-anywhere">{children}</span>
    </Note>
  );
}

function ActionError({ action }: { action: { error: Error | null } }) {
  return action.error ? <ChatErrorNote>{action.error.message}</ChatErrorNote> : null;
}

const SLACK_TOKEN_FIELD = "slackToken";
const SLACK_SECRET_FIELD = "slackSigningSecret";

// Connect Slack (not connected), or "Paste a new token or signing secret" (connected).
export function SlackConnectForm({ isConnected }: { isConnected: boolean }) {
  const action = useChatAction();
  const idSuffix = isConnected ? "-again" : "";
  function submit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    action.mutate({
      path: CHAT_API_ROUTES.slackConnect,
      body: { token: readField(event, SLACK_TOKEN_FIELD), signingSecret: readField(event, SLACK_SECRET_FIELD) },
    });
  }
  return (
    <>
      <ActionError action={action} />
      <form onSubmit={submit} className={isConnected ? "mt-2" : "mt-3"}>
        <Field htmlFor={`${SLACK_TOKEN_FIELD}${idSuffix}`} label="Bot token" className="fh-field">
          <Input id={`${SLACK_TOKEN_FIELD}${idSuffix}`} name={SLACK_TOKEN_FIELD} type="password" autoComplete="off" placeholder="xoxb-…" required className={SECRET_FIELD_CLASSES} />
        </Field>
        <Field
          htmlFor={`${SLACK_SECRET_FIELD}${idSuffix}`}
          label="Signing secret"
          hint={isConnected ? undefined : "Checks that /ask really comes from your Slack. Both stay on this server, sealed in the database."}
          className="fh-field"
        >
          <Input id={`${SLACK_SECRET_FIELD}${idSuffix}`} name={SLACK_SECRET_FIELD} type="password" autoComplete="off" required className={SECRET_FIELD_CLASSES} />
        </Field>
        <div className={`fh-btn-row ${isConnected ? "mt-2.5" : "mt-3"}`}>
          <Button type="submit" variant={isConnected ? "secondary" : "primary"} size="sm" disabled={action.isPending}>
            {isConnected ? "Save" : "Connect Slack"}
          </Button>
        </div>
      </form>
    </>
  );
}

const SLACK_CHANNEL_FIELD = "slackChannel";

export function SlackChannelForm({ channels, channelId }: { channels: readonly SlackChannel[]; channelId: string | null }) {
  const action = useChatAction();
  function submit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    action.mutate({ path: CHAT_API_ROUTES.slackChannel, body: { channelId: readField(event, SLACK_CHANNEL_FIELD) } });
  }
  return (
    <>
      <ActionError action={action} />
      <form onSubmit={submit} className="mt-3">
        <Field
          htmlFor={SLACK_CHANNEL_FIELD}
          label="Post to"
          hint="Public channels. The bot posts only in a channel it was invited to: type /invite and the bot’s name in that channel."
          className="fh-field"
        >
          <Select id={SLACK_CHANNEL_FIELD} name={SLACK_CHANNEL_FIELD} required defaultValue={channelId ?? ""} aria-describedby={`${SLACK_CHANNEL_FIELD}-hint`}>
            {channelId ? null : <option value="">Pick a public channel</option>}
            {channels.map(({ id, name, isMember }) => (
              <option key={id} value={id}>
                #{name}
                {isMember ? "" : " (invite the bot first)"}
              </option>
            ))}
          </Select>
        </Field>
        <div className="fh-btn-row mt-2.5">
          <Button type="submit" size="sm" disabled={action.isPending}>
            Save the channel
          </Button>
        </div>
      </form>
    </>
  );
}

const DISCORD_TOKEN_FIELD = "discordToken";
const DISCORD_CHANNEL_FIELD = "discordChannel";

export function DiscordConnectForm({ isConnected, channelId }: { isConnected: boolean; channelId: string | null }) {
  const action = useChatAction();
  function submit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    action.mutate({
      path: CHAT_API_ROUTES.discordConnect,
      body: { token: readField(event, DISCORD_TOKEN_FIELD), channelId: readField(event, DISCORD_CHANNEL_FIELD) },
    });
  }
  return (
    <>
      <ActionError action={action} />
      <form onSubmit={submit} className="mt-3">
        <Field htmlFor={DISCORD_TOKEN_FIELD} label="Bot token" hint="Stays on this server, sealed in the database." className="fh-field">
          <Input
            id={DISCORD_TOKEN_FIELD}
            name={DISCORD_TOKEN_FIELD}
            type="password"
            autoComplete="off"
            required={!isConnected}
            placeholder={isConnected ? "Saved. Paste a new one to replace it" : undefined}
            aria-describedby={`${DISCORD_TOKEN_FIELD}-hint`}
            className={SECRET_FIELD_CLASSES}
          />
        </Field>
        <Field
          htmlFor={DISCORD_CHANNEL_FIELD}
          label="Channel id"
          hint="In Discord: User Settings › Advanced › Developer Mode on, then right-click the channel › Copy Channel ID."
          className="fh-field"
        >
          <Input
            id={DISCORD_CHANNEL_FIELD}
            name={DISCORD_CHANNEL_FIELD}
            inputMode="numeric"
            autoComplete="off"
            required
            defaultValue={channelId ?? ""}
            aria-describedby={`${DISCORD_CHANNEL_FIELD}-hint`}
            className={SECRET_FIELD_CLASSES}
          />
        </Field>
        <div className="fh-btn-row mt-2.5">
          <Button type="submit" size="sm" disabled={action.isPending}>
            {isConnected ? "Save" : "Connect Discord"}
          </Button>
        </div>
      </form>
    </>
  );
}

type ChatControlsProps = { kind: ChatKind; name: string; isPaused: boolean; hasChannel: boolean };

// Send a test post · Pause posting / Turn posting back on · Disconnect (asked once more, in place).
export function ChatControls({ kind, name, isPaused, hasChannel }: ChatControlsProps) {
  const action = useChatAction({ failedFlash: TEST_FAILED });
  const [isConfirming, setIsConfirming] = useState(false);
  if (isConfirming) {
    return (
      <div className="mt-3">
        <ConfirmAction
          message={`Disconnect ${name}? Its token is deleted from this server and nothing more is posted there.`}
          confirmLabel="Disconnect"
          pendingLabel="Disconnecting…"
          cancelLabel="Keep it"
          isPending={action.isPending}
          errorMessage={action.error?.message ?? null}
          onConfirm={() => action.mutate({ path: CHAT_API_ROUTES.disconnect, body: { kind } })}
          onCancel={() => setIsConfirming(false)}
        />
      </div>
    );
  }
  return (
    <>
      <div className="fh-btn-row mt-3">
        <Button type="button" variant="secondary" size="sm" disabled={!hasChannel || action.isPending} onClick={() => action.mutate({ path: CHAT_API_ROUTES.test, body: { kind } })}>
          <Send aria-hidden="true" />
          Send a test post
        </Button>
        <Button type="button" variant="quiet" size="sm" disabled={action.isPending} onClick={() => action.mutate({ path: CHAT_API_ROUTES.pause, body: { kind, isPaused: !isPaused } })}>
          {isPaused ? "Turn posting back on" : "Pause posting"}
        </Button>
        <Button
          type="button"
          variant="quiet"
          size="sm"
          disabled={action.isPending}
          onClick={() => {
            action.reset();
            setIsConfirming(true);
          }}
        >
          Disconnect
        </Button>
      </div>
      <ActionError action={action} />
    </>
  );
}

// The Slack app's manifest (`details.copybox`): open until Slack is connected, with a quiet Copy button.
export function SlackManifestBox({ manifestJson, isOpen }: { manifestJson: string; isOpen: boolean }) {
  const [wasCopied, setWasCopied] = useState(false);
  return (
    <details className="fh-copybox mt-2.5" open={isOpen}>
      <summary className="fh-small">The app’s manifest (JSON)</summary>
      <Textarea readOnly rows={12} aria-label="Slack app manifest" value={manifestJson} className="mt-2 min-h-[200px] px-2.5 py-1.5 font-mono text-[12px] leading-[17px]" />
      <Button
        type="button"
        variant="quiet"
        size="sm"
        onClick={async () => {
          await navigator.clipboard.writeText(manifestJson);
          setWasCopied(true);
        }}
      >
        <Copy aria-hidden="true" />
        <span aria-live="polite">{wasCopied ? "Copied" : "Copy"}</span>
      </Button>
    </details>
  );
}
