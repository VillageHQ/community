import { Link2 } from "lucide-react";

import { CopyButton } from "@/components/copy-button";
import { Alert } from "@/components/ui/alert";
import type { IssuedInvite } from "@/lib/invites/invite-api";
import { INVITE_EMAIL_STATUSES, INVITE_LIFETIME_DAYS, type InviteEmailStatus } from "@/lib/invites/invite-state";

const DELIVERY_SENTENCES: Record<InviteEmailStatus, (email: string) => string> = {
  [INVITE_EMAIL_STATUSES.sent]: (email) => `We emailed ${email}. You can also share this link yourself.`,
  [INVITE_EMAIL_STATUSES.failed]: (email) =>
    `We couldn't send the email, but the invite is safe. Copy this link and send it to ${email}.`,
  [INVITE_EMAIL_STATUSES.notSent]: (email) => `Copy this link and send it to ${email}.`,
};

export function IssuedLink({ issued }: { issued: IssuedInvite }) {
  const { invite, link, message } = issued;
  return (
    <div className="grid gap-3">
      <Alert variant={invite.emailStatus === INVITE_EMAIL_STATUSES.failed ? "destructive" : "success"}>
        {DELIVERY_SENTENCES[invite.emailStatus](invite.email)}
      </Alert>
      <div className="flex flex-wrap items-center gap-x-3 gap-y-2 rounded-input bg-muted p-1.5 pl-[18px] sm:rounded-full">
        <Link2 aria-hidden="true" className="size-icon-small shrink-0 text-muted-foreground" />
        <code className="type-small min-w-0 flex-[1_1_160px] truncate font-semibold text-foreground-soft">{link}</code>
        <CopyButton text={link} label="Copy link" />
      </div>
      <p className="type-small text-muted-foreground">
        {message} This link works once and lasts {INVITE_LIFETIME_DAYS} days. We only show it now, because we store a
        scrambled copy. Lost it? Get a new one from the list.
      </p>
    </div>
  );
}
