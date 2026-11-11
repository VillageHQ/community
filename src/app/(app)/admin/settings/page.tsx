import type { Metadata } from "next";
import Link from "next/link";

import { StatusChecklist } from "@/components/ui/figures";
import { APP_VERSION } from "@/platform/app-version";
import { requireAdmin } from "@/platform/auth/session";
import { readBranding } from "@/platform/branding/branding";
import { PAGE_TITLES } from "@/platform/branding/page-metadata";
import { getDatabase } from "@/platform/database/client";
import { ROUTES } from "@/platform/http/routes";
import { modulePage } from "@/platform/modules/module-page";
import { formatDayWord, PLANS, readPlanSettings } from "@/platform/settings/plan";
import { readVillageKeyState } from "@/platform/village/settings";
import { SettingsForm } from "@/modules/admin/components/settings-form";
import { VillageSecretLine } from "@/modules/admin/components/village-secret-card";
import { UPDATE_GUIDE_URL } from "@/modules/admin/copy";
import { readMailChecks } from "@/modules/admin/mail-checks";
import { adminManifest } from "@/modules/admin/manifest";
import { readMailOverview } from "@/modules/admin/reads-mail";
import { readSettingsValues } from "@/modules/admin/service-settings";
import { networkManifest } from "@/modules/network/manifest";
import { AdminSection } from "@/shell/admin-section";
import { readEnabledIds } from "@/shell/enabled-modules";

export const metadata: Metadata = { title: PAGE_TITLES.adminSettings };

// Community's own: how this copy gets a new version, which depends on where it was deployed.
const PLATFORM_UPDATES = [
  { platform: "Railway", steps: "Railway tells you when a new version is out, and you choose when to apply it." },
  { platform: "Vercel", steps: "Pull the changes from VillageHQ/community into your copy on GitHub. Each push redeploys." },
  { platform: "DigitalOcean", steps: "Start a new deploy from your app's dashboard. It doesn't update by itself." },
];

function VersionSheet() {
  return (
    <section className="fh-sheet">
      <h2 className="fh-h3">Version and updates</h2>
      <p className="fh-small" style={{ marginTop: 6 }}>
        Version <b className="fh-num">{APP_VERSION}</b>. Updates aren&apos;t automatic; how you get one depends on where you deployed.
      </p>
      <ul className="fh-hist fh-small" style={{ marginTop: 6 }}>
        {PLATFORM_UPDATES.map(({ platform, steps }) => (
          <li key={platform}>
            <span>
              <b>{platform}:</b> {steps}
            </span>
          </li>
        ))}
      </ul>
      <p className="fh-small" style={{ marginTop: 8 }}>
        <a href={UPDATE_GUIDE_URL} target="_blank" rel="noreferrer">
          Read the update guide
        </a>
      </p>
    </section>
  );
}

async function readVillageLine(isNetworkOn: boolean) {
  const { keys, status } = await readVillageKeyState(getDatabase());
  if (!isNetworkOn) return { text: "Switched off", href: ROUTES.adminFeatures, link: "Features", status };
  return { text: keys ? "Connected" : "Not connected", href: ROUTES.adminVillage, link: "Village settings", status };
}

export default modulePage(adminManifest, async function AdminSettingsPage() {
  await requireAdmin();
  const database = getDatabase();
  const [saved, branding, plan, mail, enabledIds] = await Promise.all([
    readSettingsValues(database),
    readBranding(database),
    readPlanSettings(database),
    readMailOverview(database, process.env),
    readEnabledIds(database),
  ]);
  const village = await readVillageLine(enabledIds.has(networkManifest.id));
  const checks = readMailChecks({
    mailService: mail.mailService,
    isManaged: plan.plan === PLANS.managed,
    isDomainKnown: mail.sendingDomain !== null,
    senderEmail: mail.senderEmail,
    recentSends: mail.recentSends,
    dnsCheck: mail.settings.dnsCheck,
  });

  const aside = (
    <>
      <section className="fh-sheet">
        <h2 className="fh-h3">Mail checklist</h2>
        <StatusChecklist items={checks.map(({ key, label, state, value, note }) => ({ key, state, title: label, value, status: note }))} />
      </section>
      <section className="fh-sheet">
        <h2 className="fh-h3">Village</h2>
        <p className="fh-small" style={{ marginTop: 6 }}>
          {village.text}. <Link href={village.href}>{village.link}</Link>
        </p>
        <VillageSecretLine status={village.status} isNetworkOn={village.link !== "Features"} />
      </section>
      <section className="fh-sheet">
        <h2 className="fh-h3">Audit log</h2>
        <p className="fh-small" style={{ marginTop: 6 }}>
          Every admin action, sign-in and privacy change. <Link href={ROUTES.adminAuditLog}>Open the audit log</Link>
        </p>
      </section>
      <VersionSheet />
    </>
  );

  return (
    <AdminSection title="Settings" description="Your community’s name, look and mail. Changes are written to the audit log.">
      <SettingsForm
        saved={saved}
        uploadedLogo={saved.logoUrl ? null : branding.logo}
        isMailOn={mail.isMailOn}
        serverPlan={PLANS.selfHost}
        managedBy={plan.managedSetupBy ? formatDayWord(plan.managedSetupBy) : null}
        aside={aside}
      />
    </AdminSection>
  );
});
