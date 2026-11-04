"use client";

import { Link2 } from "lucide-react";
import { useActionState, useState } from "react";

import { FormError } from "@/components/form-error";
import { Avatar } from "@/components/ui/avatar";
import { Button } from "@/components/ui/button";
import { Tag } from "@/components/ui/tag";
import { API_ROUTES } from "@/lib/routes";
import { readVillageLinkState, VILLAGE_LINK_TAGS } from "@/lib/village/link-status";
import { acknowledgedResponseSchema } from "@/lib/village/network-api";
import { postNetworkRequest } from "@/lib/village/post-network-request";

type LinkActionState = { errorMessage: string | null };

const INITIAL_STATE: LinkActionState = { errorMessage: null };

async function submitLinkAction(path: string, body: Record<string, unknown>) {
  try {
    await postNetworkRequest(path, body, acknowledgedResponseSchema);
    window.location.reload();
    return INITIAL_STATE;
  } catch (error) {
    return { errorMessage: error instanceof Error ? error.message : "That failed. Try again." };
  }
}

function submitApproval(_previousState: LinkActionState, formData: FormData) {
  return submitLinkAction(API_ROUTES.villageLinks, Object.fromEntries(formData));
}

function submitReset(_previousState: LinkActionState, formData: FormData) {
  return submitLinkAction(API_ROUTES.villageLinkReset, {
    memberId: formData.get("memberId"),
    confirmed: true,
  });
}

export type VillageLink = {
  memberId: string;
  memberName: string;
  memberEmail: string;
  villageEmail: string | null;
  approvedVillageEmail: string | null;
  groupJoinedAt: Date | null;
};

function VillageLinkTag(facts: VillageLink) {
  const { label, tone } = VILLAGE_LINK_TAGS[readVillageLinkState(facts)];
  return <Tag tone={tone}>{label}</Tag>;
}

function ApproveLink({ memberId, villageEmail }: { memberId: string; villageEmail: string }) {
  const [state, formAction, isPending] = useActionState(submitApproval, INITIAL_STATE);

  return (
    <form action={formAction} className="grid gap-2">
      <FormError message={state.errorMessage} />
      <input type="hidden" name="memberId" value={memberId} />
      <input type="hidden" name="villageEmail" value={villageEmail} />
      <div>
        <Button type="submit" size="sm" variant="soft" disabled={isPending}>
          {isPending ? "Approving…" : "Approve this pair of emails"}
        </Button>
      </div>
    </form>
  );
}

function ResetLink({ memberId }: { memberId: string }) {
  const [isConfirming, setIsConfirming] = useState(false);
  const [state, formAction, isPending] = useActionState(submitReset, INITIAL_STATE);

  if (!isConfirming) {
    return (
      <div>
        <Button type="button" size="sm" variant="outline" onClick={() => setIsConfirming(true)}>
          Reset this member&apos;s Village link
        </Button>
      </div>
    );
  }

  return (
    <form action={formAction} className="type-small grid gap-3 rounded-field bg-muted p-4 text-foreground-soft">
      <FormError message={state.errorMessage} />
      <p>
        This only changes this site. The member gets a new ID, must agree and sync again, and loses
        their cached paths here.
      </p>
      <p>
        <strong className="font-bold text-foreground">It doesn&apos;t remove anything on Village&apos;s side.</strong>{" "}
        The old Village account stays linked to the old ID, and stays in the group until it leaves inside Village.
        Village won&apos;t link that same account to this site again yet, so the member must sync with a different
        one.
      </p>
      <input type="hidden" name="memberId" value={memberId} />
      <div className="flex flex-wrap gap-2">
        <Button type="submit" size="sm" variant="destructive" disabled={isPending}>
          {isPending ? "Resetting…" : "Yes, reset the link"}
        </Button>
        <Button type="button" size="sm" variant="outline" onClick={() => setIsConfirming(false)}>
          Cancel
        </Button>
      </div>
    </form>
  );
}

export function VillageLinks({ links }: { links: VillageLink[] }) {
  if (links.length === 0) {
    return (
      <p className="type-small flex items-center gap-3 rounded-field bg-muted p-4 text-foreground-soft">
        <Link2 aria-hidden="true" className="size-5 shrink-0" />
        No members have a Village link yet. They&apos;ll appear here once they do.
      </p>
    );
  }

  return (
    <>
      <p className="type-small text-foreground-soft">
        When emails don&apos;t match, approve only if both belong to the same person. Otherwise the
        member would see someone else&apos;s network, and that person would join the group without
        agreeing.
      </p>
      <ul className="grid gap-3">
        {links.map((link) => (
          <li key={link.memberId} className="grid gap-3 rounded-field p-4 shadow-[inset_0_0_0_1.5px_var(--border)]">
            <div className="flex flex-wrap items-center gap-3">
              <Avatar stableId={link.memberId} name={link.memberName} sizePx={44} />
              <div className="min-w-0 flex-[1_1_200px]">
                <div className="type-label wrap-anywhere">{link.memberName}</div>
                <div className="type-small wrap-anywhere text-muted-foreground">{link.memberEmail}</div>
              </div>
              <VillageLinkTag {...link} />
            </div>
            {link.villageEmail ? (
              <p className="type-small text-foreground-soft">
                {link.memberName} ({link.memberEmail}) is linked to the Village account{" "}
                <strong className="font-bold text-foreground">{link.villageEmail}</strong>.
              </p>
            ) : null}
            <div className="flex flex-wrap gap-2">
              {link.villageEmail ? <ApproveLink memberId={link.memberId} villageEmail={link.villageEmail} /> : null}
              <ResetLink memberId={link.memberId} />
            </div>
          </li>
        ))}
      </ul>
    </>
  );
}
