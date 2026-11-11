import type { Metadata } from "next";

import { Card, SheetHead } from "@/components/ui/card";
import { Pill } from "@/components/ui/pill";
import { ASKS_PAGE } from "@/modules/asks/contract";
import { ChatControls, ChatErrorNote, DiscordConnectForm, SlackChannelForm, SlackConnectForm, SlackManifestBox } from "@/modules/chat/components/chat-forms";
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
import { ROUTES } from "@/platform/http/routes";
import { modulePage } from "@/platform/modules/module-page";
import { formatDayMonthTimeUtc } from "@/platform/text/format-date";
import { WEEKDAYS } from "@/platform/weekly-email/schedule";
import { readWeeklySchedule } from "@/platform/weekly-email/schedule-store";
import { AdminSection } from "@/shell/admin-section";

// Founderhall's Admin › Integrations (integrations/views.mjs): Slack and Discord on the left, what gets posted on the
// right. Every post links back to the portal.
export const metadata: Metadata = { title: PAGE_TITLES.adminIntegrations };

const SAMPLE_ASK = "An intro to a head of procurement at a US hospital group.";

// Connected, paused, or the last post failed.
function StatusPill({ connection }: { connection: ChatConnectionView | null }) {
  if (!connection) return <Pill tone="open">Not connected</Pill>;
  if (connection.needsAttention) return <Pill tone="needs">Needs attention</Pill>;
  if (connection.isPaused) return <Pill tone="open">Paused</Pill>;
  return <Pill tone="made">Connected</Pill>;
}

function StatusBlock({ connection }: { connection: ChatConnectionView }) {
  const last = connection.lastPostAt ? `Last post ${formatDayMonthTimeUtc(connection.lastPostAt)}.` : "Nothing posted yet.";
  return (
    <>
      <p className="fh-small fh-muted mt-2">
        {last}
        {connection.isPaused ? " Posting is switched off." : ""}
      </p>
      {connection.lastError ? (
        <ChatErrorNote>
          {connection.lastError}
          {connection.lastErrorAt ? ` (${formatDayMonthTimeUtc(connection.lastErrorAt)})` : ""}
        </ChatErrorNote>
      ) : null}
    </>
  );
}

function ExternalLink({ href, children }: { href: string; children: string }) {
  return (
    <a href={href} rel="noopener" target="_blank">
      {children}
    </a>
  );
}

// Community only: where the tokens are kept, when this server can't seal them.
function StorageNote() {
  const storage = readChatSecretStorage(process.env);
  if (storage === CHAT_SECRET_STORAGE.sealed) return null;
  if (storage === CHAT_SECRET_STORAGE.refused) return <ChatErrorNote>This is a preview. Connect Slack and Discord on your live site.</ChatErrorNote>;
  return <ChatErrorNote>This server has no setup token, so tokens would be saved unencrypted. Add SETUP_TOKEN on your host first.</ChatErrorNote>;
}

type SlackSheetProps = { connection: ChatConnectionView | null; manifestJson: string; createUrl: string };

async function SlackSheet({ connection, manifestJson, createUrl }: SlackSheetProps) {
  const head = <SheetHead title="Slack" link={<StatusPill connection={connection} />} />;
  if (!connection) {
    return (
      <Card id="slack" className="fh-sheet">
        {head}
        <ol className="fh-howto fh-small list-decimal">
          <li>
            <b>Create the Slack app from the manifest.</b> <ExternalLink href={createUrl}>Open Slack with the manifest filled in</ExternalLink>, choose your workspace, and create
            it. Or paste the manifest below at api.slack.com/apps › Create New App › From a manifest.
          </li>
          <li>
            <b>Install it to your workspace</b> (the app’s Install App page).
          </li>
          <li>
            <b>Paste two values here:</b> the Bot User OAuth Token (OAuth &amp; Permissions, starts with xoxb-) and the Signing Secret (Basic Information › App Credentials).
          </li>
        </ol>
        <SlackManifestBox manifestJson={manifestJson} isOpen />
        <StorageNote />
        <SlackConnectForm isConnected={false} />
      </Card>
    );
  }
  const listing = await listSlackChannels(getDatabase(), process.env);
  return (
    <Card id="slack" className="fh-sheet">
      {head}
      <p className="fh-small mt-2">
        Workspace <b>{connection.accountName ?? connection.accountId ?? ""}</b>
        {connection.channelName ? (
          <>
            {" "}
            · posting to <b>#{connection.channelName}</b>
          </>
        ) : (
          " · no channel yet"
        )}
        . Members can post an ask with <span className="font-mono text-[13px]">/ask</span>.
      </p>
      <StatusBlock connection={connection} />
      {listing.error ? <ChatErrorNote>Couldn’t list the channels: {listing.error}</ChatErrorNote> : <SlackChannelForm channels={listing.channels} channelId={connection.channelId} />}
      <ChatControls kind={CHAT_KINDS.slack} name="Slack" isPaused={connection.isPaused} hasChannel={connection.channelId !== null} />
      <SlackManifestBox manifestJson={manifestJson} isOpen={false} />
      <details className="mt-2.5">
        <summary className="fh-small cursor-pointer">Paste a new token or signing secret</summary>
        <SlackConnectForm isConnected />
      </details>
    </Card>
  );
}

function DiscordSheet({ connection }: { connection: ChatConnectionView | null }) {
  const head = <SheetHead title="Discord" link={<StatusPill connection={connection} />} />;
  if (!connection) {
    return (
      <Card id="discord" className="fh-sheet">
        {head}
        <ol className="fh-howto fh-small list-decimal">
          <li>
            <b>Create a bot</b> at <ExternalLink href="https://discord.com/developers/applications">discord.com/developers/applications</ExternalLink>: New Application, then Bot ›
            Reset Token, and copy the token.
          </li>
          <li>
            <b>Paste the token and the channel id here.</b> The page then shows the link that invites the bot to your server with the two permissions it needs: Send Messages
            and Embed Links.
          </li>
        </ol>
        <DiscordConnectForm isConnected={false} channelId={null} />
      </Card>
    );
  }
  return (
    <Card id="discord" className="fh-sheet">
      {head}
      <p className="fh-small mt-2">
        Bot <b>{connection.accountName ?? ""}</b>
        {connection.channelName ? (
          <>
            {" "}
            · posting to <b>#{connection.channelName}</b>
          </>
        ) : connection.channelId ? (
          <>
            {" "}
            · channel <span className="font-mono text-[13px]">{connection.channelId}</span>
          </>
        ) : (
          " · no channel yet"
        )}
        .
      </p>
      {connection.accountId ? (
        <p className="fh-small mt-2">
          <b>Invite the bot to your server:</b> <ExternalLink href={toDiscordInviteLink(connection.accountId)}>open the invite link</ExternalLink> (asks for Send Messages and Embed
          Links, nothing else).
        </p>
      ) : null}
      <StatusBlock connection={connection} />
      <ChatControls kind={CHAT_KINDS.discord} name="Discord" isPaused={connection.isPaused} hasChannel={connection.channelId !== null} />
      <details className="mt-2.5" open={!connection.channelName}>
        <summary className="fh-small cursor-pointer">Change the channel or the token</summary>
        <DiscordConnectForm isConnected channelId={connection.channelId} />
      </details>
    </Card>
  );
}

function WhatGetsPosted({ askSample, weekSample, digestDay }: { askSample: string; weekSample: string; digestDay: string }) {
  return (
    <Card className="fh-sheet">
      <h2 className="type-h3">What gets posted</h2>
      <p className="fh-small mt-1.5">
        <b>A new ask</b>, as soon as a member posts it:
      </p>
      <p className="fh-chatpost whitespace-pre-line">{askSample}</p>
      <p className="fh-small mt-2.5">
        <b>Each week</b>, with the {digestDay} digest: intros made in the last 7 days and asks open (example numbers):
      </p>
      <p className="fh-chatpost whitespace-pre-line">{weekSample}</p>
      <p className="fh-small fh-muted mt-2.5">
        Every post links back to the portal, so answers and intros stay here. Members hidden from the directory are posted as “a member”. Updates and comments are not posted.
      </p>
    </Card>
  );
}

export default modulePage(chatManifest, async function AdminIntegrationsPage() {
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
  const askSample = composeAskPost(CHAT_KINDS.discord, { community: branding.name, authorName: "Priya", title: SAMPLE_ASK, url: `${appUrl}${ASKS_PAGE}` });
  const weekSample = composeWeekPost(CHAT_KINDS.discord, { community: branding.name, introsMade: 3, openAsks: 5, url: `${appUrl}${ROUTES.admin}` });

  return (
    <AdminSection title="Integrations" description="Post new asks and a weekly line to your community’s Slack or Discord. Every post links back here.">
      <div className="fh-grid">
        <div className="fh-c7 fh-stack">
          <SlackSheet connection={slack} manifestJson={JSON.stringify(manifest, null, 2)} createUrl={createUrl} />
          <DiscordSheet connection={discord} />
        </div>
        <div className="fh-c5 fh-stack">
          <WhatGetsPosted askSample={askSample} weekSample={weekSample} digestDay={WEEKDAYS[schedule.weekday] ?? "Thursday"} />
        </div>
      </div>
    </AdminSection>
  );
});
