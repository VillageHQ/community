"use client";

import { useMutation } from "@tanstack/react-query";
import { Pause, Play, Send, Unplug } from "lucide-react";
import { useRouter } from "next/navigation";
import { useState, type FormEvent, type ReactNode } from "react";

import { ConfirmAction } from "@/components/confirm-action";
import { FormError } from "@/components/form-error";
import { FormField } from "@/components/form-field";
import { Alert } from "@/components/ui/alert";
import { Button } from "@/components/ui/button";
import { Label } from "@/components/ui/label";
import { acknowledgedResponseSchema } from "@/platform/http/contract";
import { postRequest } from "@/platform/http/post-request";

import { CHAT_API_ROUTES, type ChatKind, type SlackChannel } from "../contract";

type ChatRequest = { path: string; body: unknown };

function useChatAction() {
  const router = useRouter();
  return useMutation({
    mutationFn: ({ path, body }: ChatRequest) => postRequest(path, body, acknowledgedResponseSchema),
    onSuccess: () => router.refresh(),
  });
}

function readField(event: FormEvent<HTMLFormElement>, name: string) {
  return String(new FormData(event.currentTarget).get(name) ?? "");
}

function ActionResult({ action }: { action: ReturnType<typeof useChatAction> }) {
  return (
    <>
      <FormError message={action.error?.message ?? null} />
      {action.isSuccess ? <Alert variant="success">{action.data.message}</Alert> : null}
    </>
  );
}

function SubmitButton({ isPending, children, pendingLabel }: { isPending: boolean; children: ReactNode; pendingLabel: string }) {
  return (
    <Button type="submit" disabled={isPending} className="max-sm:w-full sm:justify-self-start">
      {isPending ? pendingLabel : children}
    </Button>
  );
}

const SLACK_TOKEN_FIELD = "slackToken";
const SLACK_SECRET_FIELD = "slackSigningSecret";

export function SlackConnectForm({ isConnected }: { isConnected: boolean }) {
  const action = useChatAction();
  function submit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    action.mutate({
      path: CHAT_API_ROUTES.slackConnect,
      body: { token: readField(event, SLACK_TOKEN_FIELD), signingSecret: readField(event, SLACK_SECRET_FIELD) },
    });
  }
  return (
    <form onSubmit={submit} className="grid gap-4">
      <FormField name={SLACK_TOKEN_FIELD} label="Bot token" type="password" autoComplete="off" placeholder="xoxb-…" required hint="OAuth & Permissions, Bot User OAuth Token." />
      <FormField
        name={SLACK_SECRET_FIELD}
        label="Signing secret"
        type="password"
        autoComplete="off"
        required
        hint="Basic Information, App Credentials. It proves /ask really comes from your Slack."
      />
      <ActionResult action={action} />
      <SubmitButton isPending={action.isPending} pendingLabel="Checking with Slack…">
        {isConnected ? "Save the new token" : "Connect Slack"}
      </SubmitButton>
    </form>
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
    <form onSubmit={submit} className="grid gap-4">
      <div className="grid gap-2">
        <Label htmlFor={SLACK_CHANNEL_FIELD}>Post to</Label>
        <select
          id={SLACK_CHANNEL_FIELD}
          name={SLACK_CHANNEL_FIELD}
          required
          defaultValue={channelId ?? ""}
          aria-describedby={`${SLACK_CHANNEL_FIELD}-hint`}
          className="min-h-12 w-full rounded-field bg-card px-4 text-base shadow-[inset_0_0_0_1.5px_var(--input)]"
        >
          {channelId ? null : <option value="">Pick a public channel</option>}
          {channels.map(({ id, name, isMember }) => (
            <option key={id} value={id}>
              #{name}
              {isMember ? "" : " (invite the bot first)"}
            </option>
          ))}
        </select>
        <p id={`${SLACK_CHANNEL_FIELD}-hint`} className="type-small text-muted-foreground">
          Public channels. The bot posts only where it was invited: type /invite and the bot&apos;s name in that channel.
        </p>
      </div>
      <ActionResult action={action} />
      <SubmitButton isPending={action.isPending} pendingLabel="Saving…">
        Save the channel
      </SubmitButton>
    </form>
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
    <form onSubmit={submit} className="grid gap-4">
      <FormField
        name={DISCORD_TOKEN_FIELD}
        label="Bot token"
        type="password"
        autoComplete="off"
        required={!isConnected}
        placeholder={isConnected ? "Saved. Paste a new one to replace it" : undefined}
        hint="Your Discord application's Bot page, Reset Token."
      />
      <FormField
        name={DISCORD_CHANNEL_FIELD}
        label="Channel id"
        inputMode="numeric"
        autoComplete="off"
        required
        defaultValue={channelId ?? ""}
        hint="In Discord: User Settings, Advanced, Developer Mode on. Then right-click the channel and choose Copy Channel ID."
      />
      <ActionResult action={action} />
      <SubmitButton isPending={action.isPending} pendingLabel="Checking with Discord…">
        {isConnected ? "Save" : "Connect Discord"}
      </SubmitButton>
    </form>
  );
}

type ChatControlsProps = { kind: ChatKind; name: string; isPaused: boolean; hasChannel: boolean };

export function ChatControls({ kind, name, isPaused, hasChannel }: ChatControlsProps) {
  const action = useChatAction();
  const [isConfirming, setIsConfirming] = useState(false);
  if (isConfirming) {
    return (
      <ConfirmAction
        message={`Disconnect ${name}? Its token is deleted from this site and nothing more is posted there.`}
        confirmLabel="Disconnect"
        pendingLabel="Disconnecting…"
        cancelLabel="Keep it"
        isPending={action.isPending}
        errorMessage={action.error?.message ?? null}
        onConfirm={() => action.mutate({ path: CHAT_API_ROUTES.disconnect, body: { kind } })}
        onCancel={() => setIsConfirming(false)}
      />
    );
  }
  return (
    <div className="grid gap-3">
      <div className="flex flex-wrap gap-2">
        <Button
          type="button"
          variant="outline"
          size="sm"
          disabled={!hasChannel || action.isPending}
          onClick={() => action.mutate({ path: CHAT_API_ROUTES.test, body: { kind } })}
          className="max-sm:w-full"
        >
          <Send aria-hidden="true" />
          Send a test post
        </Button>
        <Button
          type="button"
          variant="quiet"
          size="sm"
          disabled={action.isPending}
          onClick={() => action.mutate({ path: CHAT_API_ROUTES.pause, body: { kind, isPaused: !isPaused } })}
          className="max-sm:w-full"
        >
          {isPaused ? <Play aria-hidden="true" /> : <Pause aria-hidden="true" />}
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
          className="max-sm:w-full"
        >
          <Unplug aria-hidden="true" />
          Disconnect
        </Button>
      </div>
      <ActionResult action={action} />
    </div>
  );
}
