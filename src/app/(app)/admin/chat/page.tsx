import { CircleAlert, ExternalLink } from "lucide-react";
import type { Metadata } from "next";

import { CopyButton } from "@/components/copy-button";
import { CardDescription } from "@/components/ui/card";
import { Tag } from "@/components/ui/tag";
import { SettingCard } from "@/modules/admin/components/setting-card";
import { ChatControls, DiscordConnectForm, SlackChannelForm, SlackConnectForm } from "@/modules/chat/components/chat-forms";
import { CHAT_KINDS, toDiscordInviteLink, type ChatConnectionView } from "@/modules/chat/contract";
import { chatManifest } from "@/modules/chat/manifest";
import { buildSlackManifest, composeAskPost, composeWeekPost } from "@/modules/chat/rules";
import { listSlackChannels, readChatConnection } from "@/modules/chat/service";
import { CHAT_SECRET_STORAGE, readChatSecretStorage } from "@/modules/chat/service-secrets";
import { requireAdmin } from "@/platform/auth/session";
import { readBranding } from "@/platform/branding/branding";
import { PAGE_TITLES } from "@/platform/branding/page-metadata";
import { getDatabase } from "@/platform/database/client";
import { resolveAppUrl } from "@/platform/http/app-url";
import { modulePage } from "@/platform/modules/module-page";
import { formatDateAndTimeUtc } from "@/platform/text/format-date";
import { describeSchedule } from "@/platform/weekly-email/schedule";
import { readWeeklySchedule } from "@/platform/weekly-email/schedule-store";
import { AdminSection } from "@/shell/admin-section";

export const metadata: Metadata = { title: PAGE_TITLES.adminChat };

function StatusTag({ connection }: { connection: ChatConnectionView | null }) {
  if (!connection) return <Tag>Not connected</Tag>;
  if (connection.needsAttention) return <Tag tone="destructive">Needs a look</Tag>;
  if (connection.isPaused) return <Tag tone="gold">Paused</Tag>;
  return <Tag tone="sage">{connection.channelId ? "Posting" : "Pick a channel"}</Tag>;
}

function ErrorNote({ text }: { text: string }) {
  return (
    <p role="alert" className="type-small flex gap-2 rounded-field bg-destructive-soft px-4 py-3 text-destructive-text">
      <CircleAlert aria-hidden="true" className="mt-0.5 size-4 shrink-0" />
      <span className="wrap-anywhere">{text}</span>
    </p>
  );
}

function LastPost({ connection }: { connection: ChatConnectionView }) {
  const last = connection.lastPostAt ? `Last post ${formatDateAndTimeUtc(connection.lastPostAt)}.` : "Nothing posted yet.";
  return (
    <>
      <p className="type-small text-foreground-soft">
        {last}
        {connection.isPaused ? " Posting is paused." : ""}
      </p>
      {connection.needsAttention && connection.lastError ? (
        <ErrorNote text={`${connection.lastError}${connection.lastErrorAt ? ` (${formatDateAndTimeUtc(connection.lastErrorAt)})` : ""}`} />
      ) : null}
    </>
  );
}

function ExternalLinkText({ href, children }: { href: string; children: string }) {
  return (
    <a href={href} target="_blank" rel="noreferrer" className="inline-flex items-center gap-1 font-bold text-brand-emphasis underline hover:no-underline">
      {children}
      <ExternalLink aria-hidden="true" className="size-3.5" />
      <span className="sr-only"> (opens in a new tab)</span>
    </a>
  );
}

function SlackManifest({ manifestJson, isOpen }: { manifestJson: string; isOpen: boolean }) {
  return (
    <details open={isOpen} className="type-small grid gap-2">
      <summary className="cursor-pointer font-bold">The Slack app&apos;s manifest</summary>
      <pre className="mt-2 max-h-72 overflow-auto rounded-field bg-muted p-4 text-[13px] wrap-anywhere whitespace-pre-wrap">{manifestJson}</pre>
      <div className="mt-2">
        <CopyButton text={manifestJson} label="Copy the manifest" />
      </div>
    </details>
  );
}

type SlackCardProps = { connection: ChatConnectionView | null; manifestJson: string; createUrl: string };

async function SlackCard({ connection, manifestJson, createUrl }: SlackCardProps) {
  const listing = connection ? await listSlackChannels(getDatabase(), process.env) : null;
  return (
    <SettingCard title="Slack" tag={<StatusTag connection={connection} />}>
      {connection ? (
        <>
          <CardDescription>
            Workspace <span className="font-bold text-foreground">{connection.accountName}</span>
            {connection.channelName ? (
              <>
                , posting to <span className="font-bold text-foreground">#{connection.channelName}</span>
              </>
            ) : (
              ", no channel yet"
            )}
            . Members can post an ask by typing /ask in Slack.
          </CardDescription>
          <LastPost connection={connection} />
          {listing?.error ? <ErrorNote text={`Couldn't list the channels: ${listing.error}`} /> : <SlackChannelForm channels={listing?.channels ?? []} channelId={connection.channelId} />}
          <ChatControls kind={CHAT_KINDS.slack} name="Slack" isPaused={connection.isPaused} hasChannel={connection.channelId !== null} />
          <SlackManifest manifestJson={manifestJson} isOpen={false} />
          <details className="type-small">
            <summary className="cursor-pointer font-bold">Paste a new token or signing secret</summary>
            <div className="mt-3">
              <SlackConnectForm isConnected />
            </div>
          </details>
        </>
      ) : (
        <>
          <ol className="type-small grid list-decimal gap-2 pl-5 text-foreground-soft">
            <li>
              <span className="font-bold text-foreground">Create the Slack app from the manifest.</span> <ExternalLinkText href={createUrl}>Open Slack with it filled in</ExternalLinkText>,
              choose your workspace and create it. Or paste the manifest below at api.slack.com/apps, Create New App, From a manifest.
            </li>
            <li>
              <span className="font-bold text-foreground">Install it to your workspace</span> from the app&apos;s Install App page.
            </li>
            <li>
              <span className="font-bold text-foreground">Paste two values here:</span> the bot token and the signing secret.
            </li>
          </ol>
          <SlackManifest manifestJson={manifestJson} isOpen />
          <SlackConnectForm isConnected={false} />
        </>
      )}
    </SettingCard>
  );
}

function DiscordCard({ connection }: { connection: ChatConnectionView | null }) {
  return (
    <SettingCard title="Discord" tag={<StatusTag connection={connection} />}>
      {connection ? (
        <>
          <CardDescription>
            Bot <span className="font-bold text-foreground">{connection.accountName}</span>
            {connection.channelName ? (
              <>
                , posting to <span className="font-bold text-foreground">#{connection.channelName}</span>
              </>
            ) : null}
            .
          </CardDescription>
          {connection.accountId ? (
            <p className="type-small text-foreground-soft">
              <span className="font-bold text-foreground">Invite the bot to your server:</span>{" "}
              <ExternalLinkText href={toDiscordInviteLink(connection.accountId)}>open the invite link</ExternalLinkText>. It asks for Send Messages and Embed Links, nothing else.
            </p>
          ) : null}
          <LastPost connection={connection} />
          <ChatControls kind={CHAT_KINDS.discord} name="Discord" isPaused={connection.isPaused} hasChannel={connection.channelId !== null} />
          <details className="type-small">
            <summary className="cursor-pointer font-bold">Change the channel or the token</summary>
            <div className="mt-3">
              <DiscordConnectForm isConnected channelId={connection.channelId} />
            </div>
          </details>
        </>
      ) : (
        <>
          <ol className="type-small grid list-decimal gap-2 pl-5 text-foreground-soft">
            <li>
              <span className="font-bold text-foreground">Create a bot</span> at{" "}
              <ExternalLinkText href="https://discord.com/developers/applications">discord.com/developers/applications</ExternalLinkText>: New Application, then Bot, Reset
              Token, and copy the token.
            </li>
            <li>
              <span className="font-bold text-foreground">Paste the token and the channel id here.</span> This page then shows the link that invites the bot to your server.
            </li>
          </ol>
          <DiscordConnectForm isConnected={false} channelId={null} />
        </>
      )}
    </SettingCard>
  );
}

function SamplePost({ text }: { text: string }) {
  return <p className="type-small rounded-field bg-muted px-4 py-3 whitespace-pre-wrap wrap-anywhere">{text}</p>;
}

function StorageNote({ storage }: { storage: ReturnType<typeof readChatSecretStorage> }) {
  if (storage === CHAT_SECRET_STORAGE.sealed) return <CardDescription>Tokens stay on this site, sealed in the database with your setup token.</CardDescription>;
  if (storage === CHAT_SECRET_STORAGE.refused) return <ErrorNote text="This is a preview. Connect Slack and Discord on your live site." />;
  return <ErrorNote text="This site has no setup token, so tokens would be saved unencrypted. Add SETUP_TOKEN on your host first." />;
}

export default modulePage(chatManifest, async function AdminChatPage() {
  await requireAdmin();
  const database = getDatabase();
  const [slack, discord, branding, schedule] = await Promise.all([
    readChatConnection(database, CHAT_KINDS.slack),
    readChatConnection(database, CHAT_KINDS.discord),
    readBranding(database),
    readWeeklySchedule(database),
  ]);
  const appUrl = resolveAppUrl(process.env);
  const manifest = buildSlackManifest(branding.name, appUrl);
  const createUrl = `https://api.slack.com/apps?new_app=1&manifest_json=${encodeURIComponent(JSON.stringify(manifest))}`;
  const askSample = composeAskPost(CHAT_KINDS.discord, {
    community: branding.name,
    authorName: "Priya",
    title: "An intro to a head of procurement at a US hospital group",
    url: `${appUrl}/asks`,
  });
  const weekSample = composeWeekPost(CHAT_KINDS.discord, { community: branding.name, introsMade: 3, openAsks: 5, url: `${appUrl}/asks` });

  return (
    <AdminSection title="Slack and Discord" description="Post new asks and a weekly line to your community's Slack or Discord. Every post links back here.">
      <div className="grid items-start gap-5 lg:grid-cols-[minmax(0,1fr)_340px]">
        <div className="grid gap-5">
          <SlackCard connection={slack} manifestJson={JSON.stringify(manifest, null, 2)} createUrl={createUrl} />
          <DiscordCard connection={discord} />
        </div>
        <div className="grid gap-5">
          <SettingCard title="What gets posted" tag={null}>
            <CardDescription>A new ask, as soon as a member posts it:</CardDescription>
            <SamplePost text={askSample} />
            <CardDescription>Each week, after the weekly email ({describeSchedule(schedule)}), with example numbers:</CardDescription>
            <SamplePost text={weekSample} />
            <ul className="type-small grid list-disc gap-1.5 pl-5 text-foreground-soft">
              <li>Only the ask&apos;s title and the author&apos;s first name. Updates, answers and offers stay in the app.</li>
              <li>Asks by members who blocked someone, or were blocked, aren&apos;t posted.</li>
              <li>Connecting or turning posting back on never posts older asks.</li>
            </ul>
          </SettingCard>
          <SettingCard title="Your tokens" tag={null}>
            <StorageNote storage={readChatSecretStorage(process.env)} />
          </SettingCard>
        </div>
      </div>
    </AdminSection>
  );
});
