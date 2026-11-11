import { CircleCheck, EyeOff } from "lucide-react";
import type { Metadata } from "next";

import { Card } from "@/components/ui/card";
import { adminManifest } from "@/modules/admin/manifest";
import { PERKS_PAGE } from "@/modules/perks/contract";
import { PerksForm } from "@/modules/perks/components/perks-form";
import { PerksFrame } from "@/modules/perks/components/perks-frame";
import { perksManifest } from "@/modules/perks/manifest";
import { readPerksUrl } from "@/modules/perks/service";
import { requireAdmin } from "@/platform/auth/session";
import { readBranding } from "@/platform/branding/branding";
import { PAGE_TITLES } from "@/platform/branding/page-metadata";
import { getDatabase } from "@/platform/database/client";
import { isDemoMode } from "@/platform/demo/mode";
import { modulePage } from "@/platform/modules/module-page";
import { AdminSection } from "@/shell/admin-section";
import { readEnabledIds } from "@/shell/enabled-modules";

export const metadata: Metadata = { title: PAGE_TITLES.adminPerks };

// The demo shows made-up deals without a marketplace (Community only).
const DEMO_STATUS = "Demo: members see a made-up list of deals at /perks. A real community pastes its BuiltFirst embed code here.";

function readStatus(url: string | null, isShown: boolean, isDemo: boolean) {
  if (!url && isShown && isDemo) return DEMO_STATUS;
  if (!url) return "No marketplace yet: members don’t see Perks.";
  return isShown ? "Members see Perks: on Today, in the menu and at /perks." : "Saved, but switched off: members don’t see Perks.";
}

// Founderhall's Admin › Perks (lib/perks.mjs). The page belongs to the admin module so it stays open while Perks is
// off: its switch is what turns Perks on. The preview frames BuiltFirst too, so this page shares /perks's
// Content-Security-Policy (next.config.mjs).
export default modulePage(adminManifest, async function AdminPerksPage() {
  await requireAdmin();
  const database = getDatabase();
  const [url, enabledIds, branding] = await Promise.all([readPerksUrl(database), readEnabledIds(database), readBranding(database)]);
  const isShown = enabledIds.has(perksManifest.id);
  const isOn = url !== null && isShown;
  const StatusIcon = isOn ? CircleCheck : EyeOff;

  return (
    <AdminSection title="Perks" description={`Show your BuiltFirst perks marketplace inside the portal, in ${branding.name}’s name.`}>
      <div className="fh-grid">
        <div className="fh-c7 fh-stack">
          <PerksForm savedUrl={url} isShown={isShown} />
        </div>
        <div className="fh-c5 fh-stack">
          <Card className="fh-sheet">
            <h2 className="type-h3">Status</h2>
            <p className="fh-small mt-2">
              <StatusIcon aria-hidden="true" className="fh-i fh-xs inline align-[-2px]" strokeWidth={1.5} /> {readStatus(url, isShown, isDemoMode(process.env))}
              {isOn ? (
                <>
                  {" "}
                  {/* A full page load, so /perks's own Content-Security-Policy header applies. */}
                  <a href={PERKS_PAGE}>Open the member page</a>
                </>
              ) : null}
            </p>
          </Card>
          <Card className="fh-sheet">
            <h2 className="type-h3">Preview</h2>
            {url ? (
              <PerksFrame url={url} title="Perks preview" isPreview />
            ) : (
              <p className="fh-small fh-muted mt-1.5">
                Paste the embed code to see your marketplace here. No BuiltFirst account yet? BuiltFirst runs the marketplace and its deals; you open it on builtfirst.com.
              </p>
            )}
            <p className="fh-small fh-muted mt-2">BuiltFirst may ask members to sign in with a BuiltFirst account.</p>
          </Card>
        </div>
      </div>
    </AdminSection>
  );
});
