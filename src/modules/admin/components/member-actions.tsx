"use client";

import { Check, ExternalLink, Link2, LogOut, MailCheck, MailPlus, RotateCcw, ShieldCheck, ShieldOff, ShieldPlus, UserRoundX, Unlink } from "lucide-react";
import type { ReactNode, RefObject } from "react";

import { Button } from "@/components/ui/button";
import { networkManifest } from "@/modules/network/manifest";
import { useIsModuleEnabled } from "@/platform/modules/enabled-modules";
import { GROUP_DEPARTURE_OUTCOMES, VILLAGE_STATUSES, type VillageStatus } from "@/modules/network/contract";
import { type AdminMember } from "@/modules/admin/contract";
import { MEMBER_ROLES } from "@/platform/auth/roles";
import { readFirstName } from "@/platform/design/avatar-identity";

import { ConfirmDialog } from "@/modules/admin/components/confirm-dialog";
import { RemoveMemberDialog } from "@/modules/admin/components/remove-member-dialog";
import { clearLinkedinRequest, confirmLinkedinRequest, confirmMemberRequest } from "@/modules/members/queries-invites";
import { IssuedLink } from "@/modules/members/components/shared/issued-link";
import {
  approveVillageLinkRequest,
  leaveGroupRequest,
  reinviteMemberRequest,
  resetVillageLinkRequest,
  setMemberRoleRequest,
  unbanMemberRequest,
} from "@/modules/admin/queries-members";
import { ReclaimAction } from "./reclaim-action";

export const VILLAGE_STATUS_DETAILS: Record<VillageStatus, { label: string; tone: "neutral" | "accent" | "sage" | "gold"; meaning: string }> = {
  [VILLAGE_STATUSES.notShared]: { label: "Not shared", tone: "neutral", meaning: "They haven't agreed to share their network." },
  [VILLAGE_STATUSES.sharing]: { label: "Sharing", tone: "accent", meaning: "They agreed to share. They haven't connected Village yet, as far as this site has seen." },
  [VILLAGE_STATUSES.syncing]: { label: "Syncing", tone: "accent", meaning: "Their Village account is connected, and they haven't joined the group yet." },
  [VILLAGE_STATUSES.ready]: { label: "Ready", tone: "sage", meaning: "They're in the group. Their network is shared, and they can search everyone's." },
  [VILLAGE_STATUSES.blocked]: { label: "Blocked for approval", tone: "gold", meaning: "Their Village account uses a different email, so search is off until you decide." },
};

const REMOVED_VILLAGE_NOTE = "They were removed, so this site no longer uses their network or their link.";
const STALE_MEMBERSHIP_NOTE = "A link reset left their old Village account in the group, so that network stays shared until it leaves inside Village, or you remove this member.";

type ActionGroupProps = { title: string; note?: string; children?: ReactNode };

function ActionGroup({ title, note, children }: ActionGroupProps) {
  return (
    <section className="grid gap-2 rounded-field bg-muted p-4">
      <h3 className="type-label">{title}</h3>
      {note ? <p className="type-small wrap-anywhere text-foreground-soft">{note}</p> : null}
      {children ? <div className="mt-1 flex flex-wrap gap-2">{children}</div> : null}
    </section>
  );
}

export type MemberActionContext = {
  member: AdminMember;
  viewerId: string;
  manageButtonRef: RefObject<HTMLButtonElement | null>;
  fallbackFocusId: string;
  onDone: (message: string, isWarning?: boolean) => void;
};

type ActionButtonProps = { label: string; icon: ReactNode; variant?: "outline" | "soft" | "destructive" | "primary" };

function ActionButton({ label, icon, variant = "outline", ...triggerProps }: ActionButtonProps) {
  return (
    <Button type="button" size="default" variant={variant} className="max-sm:w-full" {...triggerProps}>
      {icon}
      {label}
    </Button>
  );
}

function RoleActions({ member, viewerId, manageButtonRef, fallbackFocusId, onDone }: MemberActionContext) {
  const { id, name, isAdmin, isEmailConfirmed } = member;
  const firstName = readFirstName(name);
  if (id === viewerId) return <ActionGroup title="Role" note="You're an admin. You can't change your own role, so ask another admin." />;
  if (isAdmin) {
    return (
      <ActionGroup title="Role" note={`${firstName} is an admin.`}>
        <ConfirmDialog
          trigger={<ActionButton label="Remove admin role" icon={<ShieldOff aria-hidden="true" />} />}
          title={`Remove ${name}'s admin role?`}
          confirmLabel="Yes, make them a member"
          pendingLabel="Changing…"
          returnFocusRef={manageButtonRef}
          fallbackFocusId={fallbackFocusId}
          action={() => setMemberRoleRequest({ memberId: id, role: MEMBER_ROLES.member })}
          onDone={({ message }) => onDone(message)}
        >
          <p>{firstName} keeps their account, but loses Admin right away. There must always be at least one admin, so this stops if nobody else is left.</p>
        </ConfirmDialog>
      </ActionGroup>
    );
  }
  return (
    <ActionGroup title="Role" note={isEmailConfirmed ? `${firstName} is a member.` : `Confirm ${firstName}'s email before making them an admin.`}>
      {isEmailConfirmed ? (
        <ConfirmDialog
          trigger={<ActionButton label="Make admin" icon={<ShieldPlus aria-hidden="true" />} />}
          title={`Make ${name} an admin?`}
          confirmLabel="Yes, make them an admin"
          pendingLabel="Changing…"
          returnFocusRef={manageButtonRef}
          fallbackFocusId={fallbackFocusId}
          action={() => setMemberRoleRequest({ memberId: id, role: MEMBER_ROLES.admin })}
          onDone={({ message }) => onDone(message)}
        >
          <p>
            {firstName} can manage members, read reported content, change Village keys and see every email address here. They can&apos;t read private messages or intros.
          </p>
        </ConfirmDialog>
      ) : null}
    </ActionGroup>
  );
}

function EmailActions({ member, manageButtonRef, fallbackFocusId, onDone }: MemberActionContext) {
  const { id, name, email, isEmailConfirmed, isAdmin, inviteId } = member;
  if (isEmailConfirmed && (isAdmin || !inviteId)) return null;
  return (
    <ActionGroup title="Email" note={isEmailConfirmed ? `${email} is confirmed.` : `${email} isn't confirmed. Network search stays off until it is.`}>
      {isEmailConfirmed ? null : (
        <ConfirmDialog
          trigger={<ActionButton label="Confirm their email" icon={<MailCheck aria-hidden="true" />} variant="soft" />}
          title={`Does ${name} really own this email?`}
          confirmLabel="Yes, this is them"
          pendingLabel="Confirming…"
          returnFocusRef={manageButtonRef}
          fallbackFocusId={fallbackFocusId}
          action={() => confirmMemberRequest(id)}
          onDone={({ message }) => onDone(message)}
        >
          <p className="wrap-anywhere">
            Anyone holding an invite link could have used it. Confirm only if you recognize this person and {email} is theirs. This turns on network search for them.
          </p>
        </ConfirmDialog>
      )}
      {inviteId && email && !isAdmin ? (
        <ReclaimAction
          inviteId={inviteId}
          email={email}
          returnFocusRef={manageButtonRef}
          fallbackFocusId={fallbackFocusId}
          onReclaimed={() => onDone(`We locked ${name}'s account and made a new invite for ${email}.`)}
        />
      ) : null}
    </ActionGroup>
  );
}

function VillageActions({ member, manageButtonRef, fallbackFocusId, onDone }: MemberActionContext) {
  const { id, name, email, villageStatus, pendingVillageEmail, hasVillageLink, hasStaleVillageMembership } = member;
  const firstName = readFirstName(name);
  const statusNote = member.isRemoved ? REMOVED_VILLAGE_NOTE : VILLAGE_STATUS_DETAILS[villageStatus].meaning;
  const isNetworkOn = useIsModuleEnabled(networkManifest.id);
  if (!hasVillageLink || !isNetworkOn) return <ActionGroup title="Village" note={hasStaleVillageMembership ? `${statusNote} ${STALE_MEMBERSHIP_NOTE}` : statusNote} />;
  return (
    <ActionGroup title="Village" note={hasStaleVillageMembership ? `${statusNote} ${STALE_MEMBERSHIP_NOTE}` : statusNote}>
      {pendingVillageEmail ? (
        <ConfirmDialog
          trigger={<ActionButton label="Approve this Village account" icon={<Check aria-hidden="true" />} variant="soft" />}
          title="Do both emails belong to the same person?"
          confirmLabel="Yes, approve this pair"
          pendingLabel="Approving…"
          returnFocusRef={manageButtonRef}
          fallbackFocusId={fallbackFocusId}
          action={() => approveVillageLinkRequest(id, pendingVillageEmail)}
          onDone={({ message }) => onDone(`${firstName}: ${message}`)}
        >
          <p className="wrap-anywhere">
            {name} ({email}) is linked to the Village account <strong className="font-bold text-foreground">{pendingVillageEmail}</strong>.
          </p>
          <p>Approve only if both belong to {firstName}. Otherwise they&apos;d see someone else&apos;s network, and that person would join the group without agreeing.</p>
        </ConfirmDialog>
      ) : null}
      <ConfirmDialog
        trigger={<ActionButton label="Reset Village link" icon={<RotateCcw aria-hidden="true" />} />}
        title={`Reset ${name}'s Village link?`}
        confirmLabel="Yes, reset the link"
        pendingLabel="Resetting…"
        isDestructive
        returnFocusRef={manageButtonRef}
        fallbackFocusId={fallbackFocusId}
        action={() => resetVillageLinkRequest(id)}
        onDone={({ message }) => onDone(`${firstName}: ${message}`)}
      >
        <p>This only changes this site. {firstName} gets a new ID, must agree and sync again, and loses their cached paths here.</p>
        <p>
          <strong className="font-bold text-foreground">It doesn&apos;t remove anything on Village&apos;s side.</strong> The old Village account stays in the group until it
          leaves inside Village, and Village won&apos;t link that same account to this site again yet. {firstName} must sync with a different one.
        </p>
      </ConfirmDialog>
    </ActionGroup>
  );
}

function LinkedinActions({ member, manageButtonRef, fallbackFocusId, onDone }: MemberActionContext) {
  const { id, name, linkedinUrl, isLinkedinConfirmed } = member;
  if (!linkedinUrl) return null;
  const firstName = readFirstName(name);
  return (
    <ActionGroup title="LinkedIn">
      <Button asChild variant="link" size="sm" className="basis-full justify-start text-left wrap-anywhere">
        <a href={linkedinUrl} target="_blank" rel="noopener noreferrer nofollow">
          <Link2 aria-hidden="true" />
          {linkedinUrl}
          <ExternalLink aria-hidden="true" className="size-3.5" />
          <span className="sr-only"> (opens in a new tab)</span>
        </a>
      </Button>
      {isLinkedinConfirmed ? null : (
        <ConfirmDialog
          trigger={<ActionButton label="Confirm this LinkedIn" icon={<ShieldCheck aria-hidden="true" />} />}
          title={`Is this really ${name}'s LinkedIn?`}
          confirmLabel="Yes, it's theirs"
          pendingLabel="Confirming…"
          returnFocusRef={manageButtonRef}
          fallbackFocusId={fallbackFocusId}
          action={() => confirmLinkedinRequest(id)}
          onDone={({ message }) => onDone(`${firstName}: ${message}`)}
        >
          <p>Members appear as a way in when their name here matches their LinkedIn. Confirm only if this profile really is theirs and the names differ.</p>
        </ConfirmDialog>
      )}
      <ConfirmDialog
        trigger={<ActionButton label="Clear their LinkedIn" icon={<Unlink aria-hidden="true" />} />}
        title={`Clear ${name}'s LinkedIn?`}
        confirmLabel="Yes, clear it"
        pendingLabel="Clearing…"
        returnFocusRef={manageButtonRef}
        fallbackFocusId={fallbackFocusId}
        action={() => clearLinkedinRequest(linkedinUrl)}
        onDone={({ message }) => onDone(message)}
      >
        <p>Each LinkedIn profile belongs to one member. Clearing it lets the real owner add it. {firstName} can add their own again.</p>
      </ConfirmDialog>
    </ActionGroup>
  );
}

function RemovalActions({ member, viewerId, manageButtonRef, fallbackFocusId, onDone }: MemberActionContext) {
  const { id, name, isRemoved, isReclaimed, isInVillageGroup, hasStaleVillageMembership, isAdmin } = member;
  const firstName = readFirstName(name);
  const isStillInGroup = isInVillageGroup || hasStaleVillageMembership;
  if (id === viewerId) return null;
  if (isReclaimed) return <ActionGroup title="Removed" note="This account's email is gone, so it can't come back." />;
  if (isRemoved) {
    return (
      <ActionGroup title="Removed" note={`${firstName} can't sign in. Unbanning lets them use their old password again, as a regular member.`}>
        <ConfirmDialog
          trigger={<ActionButton label="Unban" icon={<RotateCcw aria-hidden="true" />} variant="soft" />}
          title={`Unban ${name}?`}
          confirmLabel={`Yes, unban ${firstName}`}
          pendingLabel="Unbanning…"
          returnFocusRef={manageButtonRef}
          fallbackFocusId={fallbackFocusId}
          action={() => unbanMemberRequest(id)}
          onDone={({ message }) => onDone(message)}
        >
          <p>
            {firstName} can sign in again, and shows up in the directory. Posts you chose to keep stay. Posts you deleted don&apos;t come back. They return as a regular member, not
            an admin.
          </p>
        </ConfirmDialog>
        {member.email ? (
          <ConfirmDialog
            trigger={<ActionButton label="Invite them back as a new account" icon={<MailPlus aria-hidden="true" />} />}
            title={`Invite ${name} back as a new account?`}
            successTitle="Here's the new invite"
            confirmLabel="Yes, make a new invite"
            pendingLabel="Making it…"
            isDestructive
            returnFocusRef={manageButtonRef}
            fallbackFocusId={fallbackFocusId}
            action={() => reinviteMemberRequest(id)}
            onDone={() => onDone(`We made a new invite for ${member.email}.`)}
            renderSuccess={(issued) => <IssuedLink issued={issued} />}
          >
            <p className="wrap-anywhere">
              Use this if {firstName} lost their password and this site can&apos;t send email. It makes a new invite for {member.email}, and the old account can&apos;t come back after this.
            </p>
            <p>
              Their old private messages stay on the old account, and nobody can open them. Posts you kept stay under the old name. They set up their card and network again, and
              Village won&apos;t link the same Village account to this site again yet, so they&apos;d sync with a different one.
            </p>
          </ConfirmDialog>
        ) : null}
        {isStillInGroup && member.villageLeaveOutcome !== GROUP_DEPARTURE_OUTCOMES.left ? (
          <ConfirmDialog
            trigger={<ActionButton label="Try leaving the Village group again" icon={<LogOut aria-hidden="true" />} />}
            title={`Try taking ${name} out of the Village group?`}
            confirmLabel="Yes, try again"
            pendingLabel="Asking Village…"
            returnFocusRef={manageButtonRef}
            fallbackFocusId={fallbackFocusId}
            action={() => leaveGroupRequest(id)}
            onDone={({ message, isGroupLeaveIncomplete }) => onDone(message, isGroupLeaveIncomplete)}
          >
            <p>We ask Village to remove {firstName} from the group on their behalf, and tell you what it said. Anyone who already saw results through them can&apos;t unsee those.</p>
          </ConfirmDialog>
        ) : null}
      </ActionGroup>
    );
  }
  return (
    <ActionGroup title="Remove from this community">
      <RemoveMemberDialog
        member={{ id, name, isAdmin, isInVillageGroup: isStillInGroup }}
        trigger={<ActionButton label="Remove member" icon={<UserRoundX aria-hidden="true" />} variant="destructive" />}
        returnFocusRef={manageButtonRef}
        fallbackFocusId={fallbackFocusId}
        onDone={onDone}
      />
    </ActionGroup>
  );
}

export function MemberActions(context: MemberActionContext) {
  const { member } = context;
  const isNetworkOn = useIsModuleEnabled(networkManifest.id);
  return (
    <div className="grid gap-2.5 pt-1">
      {member.isRemoved ? null : <RoleActions {...context} />}
      {member.isRemoved ? null : <EmailActions {...context} />}
      {isNetworkOn || member.isInVillageGroup || member.hasStaleVillageMembership ? <VillageActions {...context} /> : null}
      {member.isRemoved ? null : <LinkedinActions {...context} />}
      <RemovalActions {...context} />
    </div>
  );
}
