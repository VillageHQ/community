import { CircleCheck, EyeOff } from "lucide-react";
import type { Metadata } from "next";

import { CardDescription } from "@/components/ui/card";
import { Tag } from "@/components/ui/tag";
import { SettingCard } from "@/modules/admin/components/setting-card";
import { PERKS_PAGE } from "@/modules/perks/contract";
import { PerksForm } from "@/modules/perks/components/perks-form";
import { PerksFrame } from "@/modules/perks/components/perks-frame";
import { perksManifest } from "@/modules/perks/manifest";
import { readPerksUrl } from "@/modules/perks/service";
import { requireAdmin } from "@/platform/auth/session";
import { PAGE_TITLES } from "@/platform/branding/page-metadata";
import { getDatabase } from "@/platform/database/client";
import { isDemoMode } from "@/platform/demo/mode";
import { modulePage } from "@/platform/modules/module-page";
import { AdminSection } from "@/shell/admin-section";

export const metadata: Metadata = { title: PAGE_TITLES.adminPerks };

// The preview frames BuiltFirst too, so this page shares /perks's Content-Security-Policy (next.config.mjs).
export default modulePage(perksManifest, async function AdminPerksPage() {
  await requireAdmin();
  const url = await readPerksUrl(getDatabase());

  return (
    <AdminSection title="Perks" description="Show your BuiltFirst perks marketplace inside the app, in your community's name.">
      <div className="grid items-start gap-5 lg:grid-cols-2">
        <SettingCard
          title="Your marketplace"
          tag={
            <Tag tone={url ? "sage" : "neutral"}>
              {url ? <CircleCheck aria-hidden="true" /> : <EyeOff aria-hidden="true" />}
              {url ? "Members see it" : "Not set up"}
            </Tag>
          }
        >
          {url ? (
            <CardDescription>
              Members see Perks in the menu, on Today and at{" "}
              {/* A full page load, so /perks's own Content-Security-Policy header applies. */}
              <a href={PERKS_PAGE} className="font-bold text-brand-emphasis underline hover:no-underline">
                {PERKS_PAGE}
              </a>
              . Saved address: <span className="font-mono wrap-anywhere">{url}</span>
            </CardDescription>
          ) : isDemoMode(process.env) ? (
            <CardDescription>
              Demo: members see a made-up list of deals at{" "}
              <a href={PERKS_PAGE} className="font-bold text-brand-emphasis underline hover:no-underline">
                {PERKS_PAGE}
              </a>
              . A real community pastes its BuiltFirst embed code here.
            </CardDescription>
          ) : (
            <CardDescription>Members don&apos;t see Perks until you paste your BuiltFirst embed code.</CardDescription>
          )}
          <PerksForm hasMarketplace={url !== null} />
        </SettingCard>
        <SettingCard title="Preview" tag={null}>
          {url ? (
            <PerksFrame url={url} title="Perks preview" className="h-[520px]" />
          ) : (
            <CardDescription>
              Paste the embed code to see your marketplace here. No BuiltFirst account yet? BuiltFirst runs the marketplace and its deals; you set it up on builtfirst.com.
            </CardDescription>
          )}
        </SettingCard>
      </div>
    </AdminSection>
  );
});
