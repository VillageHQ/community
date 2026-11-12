import { Mail } from "lucide-react";
import type { Metadata } from "next";

import { FlashNote } from "@/components/flash";
import { Button } from "@/components/ui/button";
import { Pill } from "@/components/ui/pill";
import { getDatabase } from "@/platform/database/client";
import { readBranding } from "@/platform/branding/branding";
import { readResendConfig } from "@/platform/email/resend";
import { readEnabledModuleIds } from "@/platform/modules/enablement";
import { requireAdmin } from "@/platform/auth/session";
import { modulePage } from "@/platform/modules/module-page";

import { formatShortDate } from "@/modules/admin/console-members";
import { readInviterSignature, readListedInvites } from "@/modules/admin/reads-members";
import { readInviteFlash, INVITE_FLASH_PARAM } from "@/modules/admin/components/invite-flashes";
import { InviteEmailPreview } from "@/modules/admin/components/invite-email-preview";
import { InviteResendButton } from "@/modules/admin/components/invite-resend-button";
import { InviteRevokeLink } from "@/modules/admin/components/invite-revoke-link";
import { InviteSheet } from "@/modules/admin/components/invite-sheet";
import { readFillInSettings } from "@/modules/members/service-fill-in";
import { networkManifest } from "@/modules/network/manifest";
import { adminManifest } from "@/modules/admin/manifest";

export const metadata: Metadata = { title: "Invites" };

// Founderhall's Invites: paste many people at once, the profile fill-in's consent, who is still waiting to sign in,
// and the email that goes out. Community-only: Revoke, and expired and revoked invites stay listed, marked, with Resend.
export default modulePage(adminManifest, async function AdminInvitesPage({ searchParams }: { searchParams: Promise<Record<string, string | undefined>> }) {
  const admin = await requireAdmin();
  const flash = readInviteFlash((await searchParams)[INVITE_FLASH_PARAM]);
  const database = getDatabase();
  const [branding, invites, signature, fillIn, enabled] = await Promise.all([
    readBranding(database),
    readListedInvites(database),
    readInviterSignature(database, admin.id),
    readFillInSettings(database),
    readEnabledModuleIds(database, [networkManifest]),
  ]);
  const mail = readResendConfig(process.env);
  const community = branding.name;

  return (
    <>
      {flash ? <FlashNote>{flash}</FlashNote> : null}
      <div className="fh-pagehead">
        <h1 className="fh-h1">Invites</h1>
        <p className="fh-lede">{community} is invite-only. Each invite link works once, for 14 days, and only for the email it went to.</p>
      </div>
      <div className="fh-grid">
        <InviteSheet
          community={community}
          inviterName={signature.name}
          inviterRole={signature.role}
          isEmailOn={mail !== null}
          isFillInShown={enabled.has(networkManifest.id)}
          savedBasis={fillIn.basis}
          savedTermsDate={fillIn.termsDate}
        >
          <h2 className="fh-h3 mt-6">Waiting to sign in</h2>
          {invites.length > 0 ? (
            <div className="fh-rows mt-2.5">
              {invites.map((invite) => (
                <div key={invite.id} className="fh-r">
                  <span className="inline-flex size-7 items-center justify-center rounded-full bg-vellum">
                    <Mail aria-hidden="true" className="size-3.5" strokeWidth={1.5} />
                  </span>
                  <div className="fh-who">
                    <b>{invite.name || invite.email}</b>
                    {/* The address on one line, cut with "…" on a narrow phone, as Founderhall's: never split mid-word. The dates
                        get their own line, so a long address can't hide when the link ended, and wrap rather than being
                        cut where Resend and Revoke leave the row narrow (about 1034 px). */}
                    <span title={invite.email}>{invite.email}</span>
                    {/* The Revoked or Expired pill leads the dates, so it never takes the name's room on a narrow row. */}
                    <span className="whitespace-normal!">
                      {invite.isRevoked ? (
                        <Pill tone="declined" className="mr-1.5 inline-flex! align-[1px]">
                          Revoked
                        </Pill>
                      ) : invite.isExpired ? (
                        <Pill tone="needs" className="mr-1.5 inline-flex! align-[1px]">
                          Expired
                        </Pill>
                      ) : null}
                      Sent {formatShortDate(invite.createdAt.toISOString())},{" "}
                      {invite.revokedAt
                        ? `revoked ${formatShortDate(invite.revokedAt.toISOString())}`
                        : `${invite.isExpired ? "ended" : "ends"} ${formatShortDate(invite.expiresAt.toISOString())}`}
                    </span>
                  </div>
                  <div className="fh-end lg:flex-row! lg:items-center!">
                    <InviteResendButton inviteId={invite.id} />
                    {/* A revoked row keeps Revoke's place, so every Resend lines up. */}
                    {invite.isRevoked ? (
                      <Button type="button" variant="quiet" size="sm" aria-hidden="true" tabIndex={-1} className="invisible max-lg:hidden">
                        Revoke
                      </Button>
                    ) : (
                      <InviteRevokeLink inviteId={invite.id} email={invite.email} />
                    )}
                  </div>
                </div>
              ))}
            </div>
          ) : (
            <p className="fh-small fh-muted mt-2">No open invites.</p>
          )}
        </InviteSheet>
        <section className="fh-c5">
          <InviteEmailPreview community={community} from={mail?.fromAddress ?? community} inviterName={signature.name} inviterRole={signature.role} />
          <p className="fh-small fh-muted mt-2.5">The email that goes out. Plain text, from your community’s name.</p>
        </section>
      </div>
    </>
  );
});
