import type { Metadata } from "next";

import { EmptyState } from "@/components/empty-state";
import { adminManifest } from "@/modules/admin/manifest";
import { WaitingLinkRow } from "@/modules/members/components/waiting-link-row";
import { readWaitingInviteLinks } from "@/modules/members/service-invite-links";
import { requireAdmin } from "@/platform/auth/session";
import { PAGE_TITLES } from "@/platform/branding/page-metadata";
import { getDatabase } from "@/platform/database/client";
import { readResendConfig } from "@/platform/email/resend";
import { modulePage } from "@/platform/modules/module-page";
import { AdminSection } from "@/shell/admin-section";

export const metadata: Metadata = { title: PAGE_TITLES.adminLinks };

const MAIL_OFF_LINE =
  "Mail is not set up on this portal, so invite and sign-in links are not emailed. Copy a link and send it to the person yourself. Once mail is set up (Set up › Mail), they are emailed.";
const MAIL_ON_LINE = "Links whose email failed to send. Copy one and send it yourself.";

const MONTHS = ["Jan", "Feb", "Mar", "Apr", "May", "Jun", "Jul", "Aug", "Sep", "Oct", "Nov", "Dec"];

// Founderhall's admin dates: "11 Nov 15:08 UTC".
function formatMoment(date: Date) {
  const time = `${String(date.getUTCHours()).padStart(2, "0")}:${String(date.getUTCMinutes()).padStart(2, "0")}`;
  return `${date.getUTCDate()} ${MONTHS[date.getUTCMonth()]} ${time} UTC`;
}

// Set up › Sign-in links: Founderhall's links page, for the invites a person can only get by hand.
export default modulePage(adminManifest, async function AdminLinksPage() {
  await requireAdmin();
  const isMailOn = readResendConfig(process.env) !== null;
  const links = await readWaitingInviteLinks(getDatabase(), { isMailOn });

  return (
    <AdminSection title="Sign-in links" description={isMailOn ? MAIL_ON_LINE : MAIL_OFF_LINE}>
      {links.length ? (
        <div className="fh-rows">
          {links.map(({ id, email, createdAt, expiresAt }) => (
            <WaitingLinkRow key={id} inviteId={id} email={email} detail={`Invite · made ${formatMoment(createdAt)} · ends ${formatMoment(expiresAt)}`} />
          ))}
        </div>
      ) : (
        <EmptyState title="No links waiting" description="Links show here when you invite someone or someone asks to sign in, until they are used or expire." />
      )}
      <p className="fh-small fh-muted" style={{ marginTop: 12 }}>
        Anyone with a link can sign in as that person, so send it only to them.
        {links.length ? " Copy makes a new link for that person; one sent before stops working." : null}
      </p>
    </AdminSection>
  );
});
