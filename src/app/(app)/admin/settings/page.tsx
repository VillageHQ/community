import { ExternalLink, Mail, MailX, PackageCheck } from "lucide-react";
import type { Metadata } from "next";

import { ExternalTextLink } from "@/components/external-text-link";
import { Button } from "@/components/ui/button";
import { CardDescription } from "@/components/ui/card";
import { Tag } from "@/components/ui/tag";
import { getDatabase } from "@/platform/database/client";
import { SettingCard } from "@/modules/admin/components/setting-card";
import { VillageSecretCard } from "@/modules/admin/components/village-secret-card";
import { HOST_SETTINGS_GUIDE_URL, UPDATE_GUIDE_URL } from "@/modules/admin/copy";
import { readVillageKeyState } from "@/platform/village/settings";
import { parseSetupStep, readSetupProgress } from "@/shell/admin-setup";
import { APP_VERSION } from "@/platform/app-version";
import { readBranding } from "@/platform/branding/branding";
import { PAGE_TITLES } from "@/platform/branding/page-metadata";
import { readResendConfig, type ResendConfig } from "@/platform/email/resend";
import { readGivenUpEmails, type GivenUpEmail } from "@/platform/email/outbox-reads";
import { Alert } from "@/components/ui/alert";
import { ROUTES } from "@/platform/http/routes";
import { requireAdmin } from "@/platform/auth/session";

import { AdminSection } from "@/shell/admin-section";
import { AdminBrandCard, SetupChecklist } from "@/shell/setup-checklist";
import { adminManifest } from "@/modules/admin/manifest";
import { introsManifest } from "@/modules/intros/manifest";
import { messagesManifest } from "@/modules/messages/manifest";
import { networkManifest } from "@/modules/network/manifest";
import { readEnabledIds } from "@/shell/enabled-modules";
import { modulePage } from "@/platform/modules/module-page";

const EMAIL_ON_EFFECTS = [
  { text: "Invites go out by email, and you can still copy the link." },
  { text: "New members confirm their own email from a link we send." },
  { text: "Members can sign in with a link we email them, or with their password." },
  { text: "Introducers and requesters get a short email about intro requests.", moduleId: introsManifest.id },
  { text: "An introducer can have us email the person being introduced a private link to say yes or no.", moduleId: introsManifest.id },
  { text: "Members get an email for a new direct message, at most one per conversation every 15 minutes.", moduleId: messagesManifest.id },
  { text: "Members can turn off intro and message emails from their card or from any of those emails." },
  { text: "An email that fails is tried again for about five hours. If it still fails, you see it here." },
];

const RESEND_URL = "https://resend.com";

const EMAIL_OFF_EFFECTS = [
  { text: "You copy each invite link and send it yourself." },
  { text: "You confirm each new member by hand in Members." },
  { text: "Members sign in with their password only. Sign-in links need email." },
  { text: "They can't use network search until you do.", moduleId: networkManifest.id },
  { text: "Intro requests only show up as a badge in the app.", moduleId: introsManifest.id },
  { text: "Introducers send the yes-or-no link to the person being introduced themselves.", moduleId: introsManifest.id },
];

const PLATFORM_UPDATES = [
  { platform: "Railway", steps: "Railway tells you when a new version is out, and you choose when to apply it." },
  { platform: "Vercel", steps: "Pull the changes from VillageHQ/community into your copy on GitHub. Each push redeploys." },
  { platform: "DigitalOcean", steps: "Start a new deploy from your app's dashboard. It doesn't update by itself." },
];

type EmailEffect = { text: string; moduleId?: string };

function selectEffects(effects: readonly EmailEffect[], enabledIds: ReadonlySet<string>) {
  return effects.filter(({ moduleId }) => !moduleId || enabledIds.has(moduleId)).map(({ text }) => text);
}

function EffectList({ effects }: { effects: string[] }) {
  return (
    <ul className="type-small grid list-disc gap-1.5 pl-5 text-foreground-soft">
      {effects.map((effect) => (
        <li key={effect}>{effect}</li>
      ))}
    </ul>
  );
}

function EmailOn({ fromAddress, enabledIds }: { fromAddress: string; enabledIds: ReadonlySet<string> }) {
  return (
    <>
      <p className="type-small wrap-anywhere text-foreground-soft">
        Sending as <strong className="font-bold text-foreground">{fromAddress}</strong>. What that means:
      </p>
      <EffectList effects={selectEffects(EMAIL_ON_EFFECTS, enabledIds)} />
    </>
  );
}

function EmailOff({ enabledIds }: { enabledIds: ReadonlySet<string> }) {
  return (
    <>
      <p className="type-small text-foreground-soft">Everything still works without email. What changes:</p>
      <EffectList effects={selectEffects(EMAIL_OFF_EFFECTS, enabledIds)} />
      <p className="type-small text-foreground-soft">
        To turn it on, create a free <ExternalTextLink href={RESEND_URL}>Resend</ExternalTextLink> account and verify a
        domain you send from there. Then{" "}
        <ExternalTextLink href={HOST_SETTINGS_GUIDE_URL}>add two settings on your host</ExternalTextLink>:{" "}
        <code className="font-bold">RESEND_API_KEY</code>, the key from Resend, and{" "}
        <code className="font-bold">RESEND_FROM_ADDRESS</code>, the sender, like{" "}
        <code className="font-bold">Northwind &lt;hello@example.com&gt;</code>.
      </p>
    </>
  );
}

type GivenUp = { total: number; recent: GivenUpEmail[] };

// The sender retries each email for about five hours, then gives up. The admin hears about it here.
function GivenUpNotice({ givenUp }: { givenUp: GivenUp }) {
  if (givenUp.total === 0) return null;
  const count = givenUp.total === 1 ? "1 email" : `${givenUp.total} emails`;
  return (
    <Alert variant="destructive">
      <div className="grid gap-2">
        <p className="font-bold">{count} couldn&apos;t be sent this week</p>
        <p>We tried each one for about five hours. Check your Resend key and domain, then send again from where it started, like Resend on an invite.</p>
        <ul className="type-small grid gap-1">
          {givenUp.recent.map(({ id, toEmail, subject, lastError }) => (
            <li key={id} className="wrap-anywhere">
              {subject} to {toEmail}
              {lastError ? ` (${lastError})` : ""}
            </li>
          ))}
        </ul>
      </div>
    </Alert>
  );
}

function EmailCard({ config, enabledIds, givenUp }: { config: ResendConfig | null; enabledIds: ReadonlySet<string>; givenUp: GivenUp }) {
  const tag = config ? (
    <Tag tone="sage">
      <Mail aria-hidden="true" />
      On
    </Tag>
  ) : (
    <Tag tone="gold">
      <MailX aria-hidden="true" />
      Off
    </Tag>
  );
  return (
    <SettingCard title="Email" tag={tag}>
      <GivenUpNotice givenUp={givenUp} />
      {config ? <EmailOn fromAddress={config.fromAddress} enabledIds={enabledIds} /> : <EmailOff enabledIds={enabledIds} />}
    </SettingCard>
  );
}

function VersionCard() {
  return (
    <SettingCard
      title="Version and updates"
      tag={
        <Tag>
          <PackageCheck aria-hidden="true" />
          Version {APP_VERSION}
        </Tag>
      }
    >
      <CardDescription>Updates aren&apos;t automatic. How to get one depends on where you deployed:</CardDescription>
      <dl className="type-small grid gap-2.5">
        {PLATFORM_UPDATES.map(({ platform, steps }) => (
          <div key={platform} className="rounded-field bg-muted px-4 py-3">
            <dt className="font-bold">{platform}</dt>
            <dd className="text-foreground-soft">{steps}</dd>
          </div>
        ))}
      </dl>
      <div>
        <Button asChild variant="outline" className="max-sm:w-full">
          <a href={UPDATE_GUIDE_URL} target="_blank" rel="noreferrer">
            Read the update guide
            <ExternalLink aria-hidden="true" />
            <span className="sr-only"> (opens in a new tab)</span>
          </a>
        </Button>
      </div>
    </SettingCard>
  );
}

export const metadata: Metadata = { title: PAGE_TITLES.adminSettings };

export default modulePage(adminManifest, async function AdminSettingsPage({ searchParams }: { searchParams: Promise<{ step?: string }> }) {
  const admin = await requireAdmin();
  const { step } = await searchParams;
  const database = getDatabase();
  const [progress, branding, enabledIds, givenUp] = await Promise.all([
    readSetupProgress(database),
    readBranding(database),
    readEnabledIds(database),
    readGivenUpEmails(database),
  ]);
  const keyState = await readVillageKeyState(database);

  return (
    <AdminSection title="Settings" description="Come back to any part of setup, any time.">
      <div className="grid items-start gap-5 lg:grid-cols-[minmax(0,1fr)_312px]">
        <div className="grid gap-5">
          <SetupChecklist database={database} admin={admin} progress={progress} openStepId={parseSetupStep(step, progress.steps.map(({ id }) => id))} basePath={ROUTES.adminSettings} />
          <EmailCard config={readResendConfig(process.env)} enabledIds={enabledIds} givenUp={givenUp} />
          <VillageSecretCard status={keyState.status} isNetworkOn={enabledIds.has(networkManifest.id)} />
          <VersionCard />
        </div>
        <AdminBrandCard branding={branding} isCurrentStep={false} />
      </div>
    </AdminSection>
  );
});
