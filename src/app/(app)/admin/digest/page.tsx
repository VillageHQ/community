import type { Metadata } from "next";

import { FlashNote } from "@/components/flash";
import { PageHeader } from "@/components/page-header";
import { ASKS_ADMIN_PAGE } from "@/modules/asks/contract";
import { adminManifest } from "@/modules/admin/manifest";
import { requireAdmin } from "@/platform/auth/session";
import { readBranding } from "@/platform/branding/branding";
import { getDatabase } from "@/platform/database/client";
import { readResendConfig } from "@/platform/email/resend";
import { modulePage } from "@/platform/modules/module-page";
import { readReplyDomain } from "@/platform/weekly-email/tokens";
import { DigestMailText } from "@/shell/digest-mail-text";
import { DigestMemberPicker, DigestTestButton } from "@/shell/digest-preview-parts";
import { previewMemberDigest, readDigestMembers, SAMPLE_PREVIEW, TEST_SEND_OUTCOMES } from "@/shell/weekly-email";

export const metadata: Metadata = { title: "Digest preview" };

const FLASHES: Record<string, { text: string; isOk: boolean }> = {
  digesttest: { text: "Test digest sent to you.", isOk: true },
  [TEST_SEND_OUTCOMES.emailOff]: { text: "Mail is not set up, so the test digest was not sent. Set up Mail first.", isOk: false },
  [TEST_SEND_OUTCOMES.switchedOff]: { text: "You turned the weekly digest off in your email settings, so no test was sent. Turn it on to get one.", isOk: false },
};

type DigestPageProps = { searchParams: Promise<{ member?: string; m?: string }> };

// The fund's own address in From: "Northwind Founders <hello@…>".
function readFrom(community: string, fromAddress: string | null) {
  if (!fromAddress) return community;
  return fromAddress.includes("<") ? fromAddress : `${community} <${fromAddress}>`;
}

// Asks & digest › Preview (Founderhall's /admin/digest): the digest as it goes out, for any member, and a test send.
export default modulePage(adminManifest, async function AdminDigestPage({ searchParams }: DigestPageProps) {
  const admin = await requireAdmin();
  const { member, m } = await searchParams;
  const database = getDatabase();
  const [members, branding] = await Promise.all([readDigestMembers(database), readBranding(database)]);
  const requested = member && (member === SAMPLE_PREVIEW || members.some(({ id }) => id === member)) ? member : admin.id;
  const preview = (await previewMemberDigest(database, process.env, admin, requested)) ?? (await previewMemberDigest(database, process.env, admin, admin.id));
  const ownIsEmpty = requested === admin.id ? Boolean(preview?.isEmpty) : Boolean((await previewMemberDigest(database, process.env, admin, admin.id))?.isEmpty);
  const replyDomain = readReplyDomain(process.env);
  const from = readFrom(branding.name, readResendConfig(process.env)?.fromAddress ?? null);
  const flash = m ? FLASHES[m] : undefined;
  const choices = [...members.map(({ id, name }) => ({ id, label: name })), { id: SAMPLE_PREVIEW, label: "A made-up member" }];

  return (
    <>
      {flash ? <FlashNote kind={flash.isOk ? "ok" : "needs"}>{flash.text}</FlashNote> : null}
      <PageHeader
        back={{ href: ASKS_ADMIN_PAGE, label: "Asks & digest" }}
        title="The digest, as it goes out"
        description="Each member gets their own items. Pick a member to preview theirs: each link shows as a button, and buttons stay off in a preview. The test goes to you, with your own items, and its links and codes work."
      />
      <div className="fh-flow">
        <div>
          <DigestMemberPicker members={choices} selected={requested} />
          {preview ? (
            <div className="fh-mail mt-3.5">
              <div className="fh-mail-h">
                <div>
                  <span className="fh-k">From</span>
                  <span className="fh-v">{from}</span>
                </div>
                <div>
                  <span className="fh-k">To</span>
                  <span className="fh-v">{preview.recipientName}</span>
                </div>
                <div>
                  <span className="fh-k">Headers</span>
                  <span className="fh-v">List-Unsubscribe (one click){replyDomain ? ` · Reply-To reply+d…@${replyDomain}` : ""}</span>
                </div>
                <div className="fh-subj">{preview.subject}</div>
              </div>
              <div className="fh-mail-b">
                <DigestMailText text={preview.text} />
              </div>
            </div>
          ) : null}
        </div>
        <aside>
          <section className="fh-sheet">
            <h2 className="fh-h3">Send me a test digest</h2>
            <p className="fh-small mt-1.5">
              To {admin.email}, with your own items this week{ownIsEmpty ? " (even when there is nothing to answer)" : ""}.
            </p>
            <DigestTestButton />
            <p className="fh-small fh-muted mt-3">
              {replyDomain
                ? "Every item answers by link (a confirm page) or by replying with its code on the first line: HELP 1, SKIP 1, YES 2, NO 2 and your words."
                : "Every item answers by link (a confirm page). To let members answer by replying, set RESEND_REPLY_DOMAIN and point Resend’s webhook at this app."}
            </p>
          </section>
        </aside>
      </div>
    </>
  );
});
