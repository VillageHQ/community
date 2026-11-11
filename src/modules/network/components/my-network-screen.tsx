"use client";

import { useMutation, useQueryClient, useSuspenseQuery } from "@tanstack/react-query";
import { openSyncModal } from "@villagehq/sdk";
import { Clock, KeyRound, Link2, RefreshCw, ShieldAlert } from "lucide-react";
import Link from "next/link";
import { useState, type ReactNode } from "react";

import { FormError } from "@/components/form-error";
import { BackLink } from "@/components/page-header";
import { QueryBoundary } from "@/components/query-boundary";
import { Button } from "@/components/ui/button";
import { Note } from "@/components/ui/note";
import { Pill } from "@/components/ui/pill";
import { acknowledgedResponseSchema } from "@/platform/http/contract";
import { postRequest } from "@/platform/http/post-request";
import { API_ROUTES, ROUTES } from "@/platform/http/routes";
import { NETWORK_STAGES, syncTokenSchema, type NetworkStatus } from "@/modules/network/contract";
import { networkStatusQuery } from "@/modules/network/queries";
import { toMembersOf } from "@/modules/network/rules-search-words";

import { LeaveGroup } from "./leave-group";
import { LinkedinForm } from "./linkedin-step";
import { NetworkFailure } from "./network-failure";

const CONSENT_FIELD = "pooling";

export type MyNetworkScreenProps = {
  communityName: string;
  // "In EU, Frankfurt." or "Ask Northwind Founders where the data is processed: privacy@…" (Your data's data home).
  processedLine: ReactNode;
  // When the member joined the group: their sync finished.
  connectedAtLabel: string | null;
  myProfileHref: string;
  emailConfirmation: ReactNode;
  // The admin's last Village check of this member, when there is one.
  villageLine: ReactNode;
  // Their name here can't match their LinkedIn, so members can't find them as a way in.
  needsFullName: boolean;
};

async function openVillageSync(appUrl: string) {
  const { token } = await postRequest(API_ROUTES.networkSyncToken, {}, syncTokenSchema);
  await openSyncModal({ token, appUrl });
}

function recordConsent() {
  return postRequest(API_ROUTES.networkConsent, { acknowledged: true }, acknowledgedResponseSchema);
}

// Members see "what members see", where it is processed and who introduces whom before anything leaves this site.
function ConnectStart({ status, communityName, processedLine }: { status: NetworkStatus } & Pick<MyNetworkScreenProps, "communityName" | "processedLine">) {
  const queryClient = useQueryClient();
  const members = toMembersOf(communityName);
  const connectMutation = useMutation({
    mutationFn: async () => {
      await recordConsent();
      const fresh = await queryClient.fetchQuery({ ...networkStatusQuery, staleTime: 0 });
      if (fresh.sync && fresh.stage === NETWORK_STAGES.needsSync) await openVillageSync(fresh.sync.appUrl);
    },
    onSettled: () => queryClient.invalidateQueries({ queryKey: networkStatusQuery.queryKey }),
  });
  const needsLinkedin = status.stage === NETWORK_STAGES.needsLinkedin;
  return (
    <section className="fh-sheet fh-section fh-trust">
      <div>
        <h2 className="fh-h3">What members see</h2>
        <p>Only that you know someone, and one word: Knows, Met or Close. Never how, and never your contact list.</p>
      </div>
      <div>
        <h2 className="fh-h3">Where it is processed</h2>
        <p>{processedLine}</p>
      </div>
      <div>
        <h2 className="fh-h3">Who introduces whom</h2>
        <p>Nobody is introduced without saying yes. You get every ask first.</p>
      </div>
      {needsLinkedin ? (
        <div>
          <h2 className="fh-h3">Your LinkedIn</h2>
          <p>Members find you as a way in by your LinkedIn profile. Add its link first.</p>
          <div className="mt-3">
            <LinkedinForm submitLabel="Save" onSaved={() => queryClient.invalidateQueries({ queryKey: networkStatusQuery.queryKey })} />
          </div>
        </div>
      ) : (
        <form
          onSubmit={(event) => {
            event.preventDefault();
            connectMutation.mutate();
          }}
        >
          <FormError message={connectMutation.error?.message ?? null} />
          <label className="fh-consent">
            <input
              type="checkbox"
              name={CONSENT_FIELD}
              value="1"
              required
              style={{ accentColor: "var(--fund)", width: 18, height: 18, flex: "none", marginTop: 1 }}
            />
            <span>Let {members} ask me for intros to people I know</span>
          </label>
          <p className="fh-small fh-muted" style={{ marginTop: 6 }}>
            Connecting shares your network with {members}, so tick it to go on. You can stop sharing any time.
          </p>
          <div className="fh-btn-row" style={{ marginTop: 14 }}>
            <Button type="submit" width="block" disabled={connectMutation.isPending}>
              {connectMutation.isPending ? "Opening Village…" : "Connect Google (read-only, 1 minute)"}
            </Button>
          </div>
          <p className="fh-small fh-muted" style={{ marginTop: 10 }}>
            LinkedIn too? Later, on a laptop: it needs Village’s Chrome extension.
          </p>
        </form>
      )}
    </section>
  );
}

function SyncSheet({ status, connectedAtLabel, myProfileHref }: { status: NetworkStatus } & Pick<MyNetworkScreenProps, "connectedAtLabel" | "myProfileHref">) {
  const queryClient = useQueryClient();
  const syncMutation = useMutation({
    mutationFn: openVillageSync,
    onSettled: () => queryClient.invalidateQueries({ queryKey: networkStatusQuery.queryKey }),
  });
  const isDone = status.stage === NETWORK_STAGES.ready;
  return (
    <section className="fh-sheet fh-section">
      <div className="fh-sheet-head">
        <h2 className="fh-h3">Sync</h2>
        {isDone ? <Pill tone="made">Done</Pill> : <Pill tone="open">Waiting for the sync</Pill>}
      </div>
      <div className="fh-meter" style={{ marginTop: 12 }}>
        <div className="fh-track">
          <i className={isDone ? undefined : "fh-indeterminate"} style={{ ["--w" as string]: isDone ? "100%" : "35%" }} />
        </div>
      </div>
      <p className="fh-small" style={{ marginTop: 10 }} role="status">
        {isDone ? (connectedAtLabel ? `Finished ${connectedAtLabel}.` : "Finished.") : "Checking every few seconds. Google usually takes a minute or two."}
      </p>
      {isDone ? (
        <div className="fh-btn-row" style={{ marginTop: 14 }}>
          <Button asChild>
            <Link href={ROUTES.network}>Search your network</Link>
          </Button>
          <Button asChild variant="secondary">
            <Link href={myProfileHref}>Back to my profile</Link>
          </Button>
        </div>
      ) : status.sync ? (
        <>
          <FormError message={syncMutation.error?.message ?? null} />
          <div className="fh-btn-row" style={{ marginTop: 14 }}>
            <Button type="button" disabled={syncMutation.isPending} onClick={() => status.sync && syncMutation.mutate(status.sync.appUrl)}>
              <Link2 aria-hidden="true" />
              Sync network
            </Button>
          </div>
          <p className="fh-small fh-muted" style={{ marginTop: 8 }}>
            This opens Village’s own screen. Allow popups for this site if your browser asks.
          </p>
        </>
      ) : null}
    </section>
  );
}

// Community's own settings for a connected member: the LinkedIn profile Village matches, and leaving the group.
function NetworkSettings() {
  const queryClient = useQueryClient();
  const [isOpen, setIsOpen] = useState(false);
  return (
    <details className="mt-4" open={isOpen} onToggle={(event) => setIsOpen(event.currentTarget.open)}>
      <summary className="fh-linkbtn cursor-pointer">Change my LinkedIn or stop sharing</summary>
      <div className="fh-sheet mt-3 grid gap-5">
        <div className="grid gap-2">
          <h2 className="fh-h3">Change your LinkedIn profile</h2>
          <LinkedinForm submitLabel="Save" onSaved={() => queryClient.invalidateQueries({ queryKey: networkStatusQuery.queryKey })} />
        </div>
        <div className="grid gap-2">
          <h2 className="fh-h3">Leave the group</h2>
          <p className="fh-small fh-muted">Stops sharing your network. You can still search what others share.</p>
          <LeaveGroup />
        </div>
      </div>
    </details>
  );
}

const PRIVACY_LINE =
  "Members who search can see that you know a person and ask you for an intro. They can’t download your contacts, see how you know them beyond a warmth word, or reach anyone without your yes.";

function readStageNote(status: NetworkStatus, communityName: string): ReactNode {
  switch (status.stage) {
    case NETWORK_STAGES.notConfigured:
      return <Note icon={KeyRound}>Not available yet: {communityName} hasn’t switched on network search.</Note>;
    case NETWORK_STAGES.awaitingGroup:
      return <Note icon={Clock}>The community group isn’t ready yet: an admin creates it first. Check back soon.</Note>;
    case NETWORK_STAGES.needsGroupCreation:
      return (
        <Note icon={Clock}>
          Your network is synced. Create the community group so members can join: <Link href={ROUTES.adminSetup}>Admin setup</Link>.
        </Note>
      );
    case NETWORK_STAGES.linkMismatch:
      return (
        <Note kind="needs" icon={ShieldAlert}>
          The Village account linked to you uses a different email from your account here. An admin approves it before you can share or search
          your network{status.isAdmin ? <>: open Manage on your row in <Link href={ROUTES.adminMembers}>Members</Link>.</> : "."}
        </Note>
      );
    default:
      return null;
  }
}

function CurrentNetwork(props: MyNetworkScreenProps) {
  const { communityName } = props;
  const { data: status } = useSuspenseQuery(networkStatusQuery);
  const isDone = status.stage === NETWORK_STAGES.ready;
  const isSyncing = status.stage === NETWORK_STAGES.needsSync || status.stage === NETWORK_STAGES.syncing;
  const isStart = status.stage === NETWORK_STAGES.needsConsent || status.stage === NETWORK_STAGES.needsLinkedin;
  if (isDone || isSyncing) {
    return (
      <>
        <h1 className="fh-h1">{isDone ? "Your network is connected" : "Connect your network"}</h1>
        <p className="fh-lede">
          {isDone
            ? `Search now covers the people you know and ${communityName} members can ask you for intros to them.`
            : "Last step: connect Google (read-only) on Village’s own screen. LinkedIn can wait for a laptop: it needs Village’s Chrome extension."}
        </p>
        <SyncSheet status={status} connectedAtLabel={props.connectedAtLabel} myProfileHref={props.myProfileHref} />
        <p className="fh-small fh-muted" style={{ marginTop: 14 }}>
          {PRIVACY_LINE}
        </p>
        {isDone && props.needsFullName ? (
          <Note className="mt-3.5">
            Members see you as a way in when your name here matches your LinkedIn. Add your first and last name, or ask an admin to confirm your LinkedIn.{" "}
            <Link href={props.myProfileHref}>Edit your card</Link>
          </Note>
        ) : null}
        {props.villageLine}
        {isDone ? <NetworkSettings /> : null}
      </>
    );
  }
  return (
    <>
      <h1 className="fh-h1">Let {toMembersOf(communityName)} find who you know</h1>
      <p className="fh-lede">
        Village, the network service behind this portal, reads the <b>names</b> in your Google contacts and calendar. Never the content of an email.
      </p>
      {status.stage === NETWORK_STAGES.needsEmailConfirmation ? <div className="fh-section">{props.emailConfirmation}</div> : null}
      {isStart ? <ConnectStart status={status} communityName={communityName} processedLine={props.processedLine} /> : null}
      {isStart ? null : <div className="fh-section">{readStageNote(status, communityName)}</div>}
    </>
  );
}

// Founderhall's My network (/me/network): before connecting, the three answers and the connect button; while syncing,
// the sync meter; after, "Your network is connected".
export function MyNetworkScreen(props: MyNetworkScreenProps) {
  return (
    <>
      <BackLink href={props.myProfileHref}>My profile</BackLink>
      <div className="fh-narrow">
        <QueryBoundary loadingMessage="Checking your network…" failure={NetworkFailure}>
          <CurrentNetwork {...props} />
        </QueryBoundary>
      </div>
    </>
  );
}
