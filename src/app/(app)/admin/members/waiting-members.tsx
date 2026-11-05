"use client";

import { useMutation, useQueryClient, useSuspenseQuery } from "@tanstack/react-query";
import { useRouter } from "next/navigation";

import { FormError } from "@/components/form-error";
import { QueryBoundary } from "@/components/query-boundary";
import { Avatar } from "@/components/ui/avatar";
import { Button } from "@/components/ui/button";
import type { IssuedInvite, WaitingMember } from "@/lib/invites/invite-api";

import { confirmMemberRequest, INVITE_QUERY_KEYS, waitingMembersQuery } from "./invite-queries";
import { ReclaimAction } from "./reclaim-action";

const WAITING_AVATAR_SIZE_PX = 52;
const EMAIL_CONFIGURED_NOTE = "We also emailed each of them a link. If it reached them, they'll leave this list by themselves.";

type WaitingRowProps = { member: WaitingMember; onReclaimed: (issued: IssuedInvite) => void };

function WaitingRow({ member, onReclaimed }: WaitingRowProps) {
  const queryClient = useQueryClient();
  const router = useRouter();
  const { id, name, email, avatarUrl, inviteId } = member;
  const confirmMutation = useMutation({
    mutationFn: confirmMemberRequest,
    onSuccess: async () => {
      await queryClient.invalidateQueries({ queryKey: [INVITE_QUERY_KEYS.waiting] });
      router.refresh();
    },
  });

  return (
    <li className="grid gap-3 rounded-card-phone bg-card p-4 shadow-[inset_0_0_0_2.5px_var(--brand-emphasis),var(--elevation-panel)] sm:rounded-card sm:px-5 sm:py-4">
      <div className="flex flex-wrap items-center gap-x-4 gap-y-3">
        <Avatar stableId={id} name={name} imageUrl={avatarUrl} sizePx={WAITING_AVATAR_SIZE_PX} />
        <div className="min-w-0 flex-[1_1_220px]">
          <div className="type-label">{name}</div>
          <div className="type-small wrap-anywhere text-muted-foreground">{email}</div>
        </div>
        <div className="flex flex-wrap items-center gap-2 max-sm:w-full">
          <Button
            type="button"
            size="sm"
            disabled={confirmMutation.isPending}
            onClick={() => confirmMutation.mutate(id)}
          >
            {confirmMutation.isPending ? "Confirming…" : "Yes, this is them"}
            <span className="sr-only">: {name} owns {email}</span>
          </Button>
          {inviteId ? <ReclaimAction inviteId={inviteId} email={email} onReclaimed={onReclaimed} /> : null}
        </div>
      </div>
      <FormError message={confirmMutation.error?.message ?? null} />
    </li>
  );
}

type WaitingMembersProps = { isEmailConfigured: boolean; onReclaimed: (issued: IssuedInvite) => void };

function WaitingList({ isEmailConfigured, onReclaimed }: WaitingMembersProps) {
  const { data } = useSuspenseQuery(waitingMembersQuery);
  if (data.members.length === 0) return null;
  const hiddenCount = data.waitingCount - data.members.length;
  return (
    <section aria-labelledby="waiting-title" className="grid gap-3.5">
      <div className="grid gap-1.5">
        <h2 id="waiting-title" className="type-h2">
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
          <WaitingRow key={member.id} member={member} onReclaimed={onReclaimed} />
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
