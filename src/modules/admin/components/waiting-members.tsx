"use client";

import { useQueryClient, useSuspenseQuery } from "@tanstack/react-query";
import { useRouter } from "next/navigation";

import { QueryBoundary } from "@/components/query-boundary";
import { Avatar } from "@/components/ui/avatar";
import { Button } from "@/components/ui/button";
import { networkManifest } from "@/modules/network/manifest";
import { useIsModuleEnabled } from "@/platform/modules/enabled-modules";
import type { WaitingMember } from "@/modules/members/contract-invites";

import { ConfirmDialog } from "@/modules/admin/components/confirm-dialog";

import { confirmMemberRequest, INVITE_QUERY_KEYS, waitingMembersQuery } from "@/modules/members/queries-invites";
import { ADMIN_MEMBER_QUERY_KEYS } from "@/modules/admin/queries-members";
import { ReclaimAction } from "./reclaim-action";

const WAITING_TITLE_ID = "waiting-title";
const EMAIL_CONFIGURED_NOTE = "We also emailed each of them a link. If it reached them, they'll leave this list by themselves.";

function useRefreshAfterConfirming() {
  const queryClient = useQueryClient();
  const router = useRouter();
  return () => {
    void Promise.all([INVITE_QUERY_KEYS.waiting, ADMIN_MEMBER_QUERY_KEYS.list].map((queryKey) => queryClient.invalidateQueries({ queryKey: [queryKey] })));
    router.refresh();
  };
}

function WaitingRow({ member }: { member: WaitingMember }) {
  const refresh = useRefreshAfterConfirming();
  const { id, name, email, avatarUrl, inviteId } = member;

  return (
    <div className="fh-r">
      <Avatar stableId={id} name={name} imageUrl={avatarUrl} />
      <div className="fh-who">
        <b>{name}</b>
        <span>{email}</span>
      </div>
      <div className="fh-end flex-row! flex-wrap items-center! justify-end">
        <ConfirmDialog
          trigger={
            <Button type="button" size="sm">
              Yes, this is them
              <span className="sr-only">: {name} owns {email}</span>
            </Button>
          }
          title={`Does ${name} really own this email?`}
          confirmLabel="Yes, this is them"
          pendingLabel="Confirming…"
          fallbackFocusId={WAITING_TITLE_ID}
          action={() => confirmMemberRequest(id)}
          onDone={refresh}
        >
          <p className="wrap-anywhere">
            Anyone holding an invite link could have used it. Confirm only if you recognize this person and {email} is theirs. This turns on network search for them.
          </p>
        </ConfirmDialog>
        {inviteId ? <ReclaimAction inviteId={inviteId} email={email} fallbackFocusId={WAITING_TITLE_ID} onReclaimed={refresh} /> : null}
      </div>
    </div>
  );
}

type WaitingMembersProps = { isEmailConfigured: boolean };

function WaitingList({ isEmailConfigured }: WaitingMembersProps) {
  const isNetworkOn = useIsModuleEnabled(networkManifest.id);
  const { data } = useSuspenseQuery(waitingMembersQuery);
  if (data.members.length === 0) return null;
  const hiddenCount = data.waitingCount - data.members.length;
  return (
    <section aria-labelledby={WAITING_TITLE_ID} className="fh-sheet mb-5">
      <h2 id={WAITING_TITLE_ID} tabIndex={-1} className="fh-h3 outline-none">
        Waiting for your OK ({data.waitingCount})
      </h2>
      <p className="fh-small fh-muted mt-1">
        These people accepted an invite, but anyone holding the link could have done that. Yes says this person really owns this email
        {isNetworkOn ? ", and turns on network search for them" : ""}. Only confirm someone you recognize.
        {isEmailConfigured ? ` ${EMAIL_CONFIGURED_NOTE}` : ""}
      </p>
      <div className="fh-rows mt-3">
        {data.members.map((member) => (
          <WaitingRow key={member.id} member={member} />
        ))}
      </div>
      {hiddenCount > 0 ? <p className="fh-small fh-muted mt-2">{hiddenCount} more will show up as you go through these.</p> : null}
    </section>
  );
}

export function WaitingMembers(props: WaitingMembersProps) {
  return (
    <QueryBoundary loadingMessage="Checking who's waiting…">
      <WaitingList {...props} />
    </QueryBoundary>
  );
}
