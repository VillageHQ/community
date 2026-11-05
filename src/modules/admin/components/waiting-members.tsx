"use client";

import { useQueryClient, useSuspenseQuery } from "@tanstack/react-query";
import { useRouter } from "next/navigation";

import { QueryBoundary } from "@/components/query-boundary";
import { Avatar } from "@/components/ui/avatar";
import { Button } from "@/components/ui/button";
import type { WaitingMember } from "@/modules/members/contract-invites";

import { ConfirmDialog } from "@/modules/admin/components/confirm-dialog";

import { confirmMemberRequest, INVITE_QUERY_KEYS, waitingMembersQuery } from "@/modules/members/queries-invites";
import { ADMIN_MEMBER_QUERY_KEYS } from "@/modules/admin/queries-members";
import { ReclaimAction } from "./reclaim-action";

const WAITING_AVATAR_SIZE_PX = 52;
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
    <li className="grid gap-3 rounded-card-phone bg-card p-4 shadow-[inset_0_0_0_2.5px_var(--brand-emphasis),var(--elevation-panel)] sm:rounded-card sm:px-5 sm:py-4">
      <div className="flex flex-wrap items-center gap-x-4 gap-y-3">
        <Avatar stableId={id} name={name} imageUrl={avatarUrl} sizePx={WAITING_AVATAR_SIZE_PX} />
        <div className="min-w-0 flex-[1_1_220px]">
          <div className="type-label">{name}</div>
          <div className="type-small wrap-anywhere text-muted-foreground">{email}</div>
        </div>
        <div className="flex flex-wrap items-center gap-2 max-sm:w-full">
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
    </li>
  );
}

type WaitingMembersProps = { isEmailConfigured: boolean };

function WaitingList({ isEmailConfigured }: WaitingMembersProps) {
  const { data } = useSuspenseQuery(waitingMembersQuery);
  if (data.members.length === 0) return null;
  const hiddenCount = data.waitingCount - data.members.length;
  return (
    <section aria-labelledby={WAITING_TITLE_ID} className="grid gap-3.5">
      <div className="grid gap-1.5">
        <h2 id={WAITING_TITLE_ID} tabIndex={-1} className="type-h2 outline-none">
          Waiting for approval ({data.waitingCount})
        </h2>
        <p className="text-foreground-soft">
          These people accepted an invite, but anyone holding the link could have done that. Yes says this person really
          owns this email, and turns on network search for them. Only confirm someone you recognize.
          {isEmailConfigured ? ` ${EMAIL_CONFIGURED_NOTE}` : ""}
        </p>
      </div>
      <ul className="grid gap-2.5">
        {data.members.map((member) => (
          <WaitingRow key={member.id} member={member} />
        ))}
      </ul>
      {hiddenCount > 0 ? (
        <p className="type-small text-muted-foreground">{hiddenCount} more will show up as you go through these.</p>
      ) : null}
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
