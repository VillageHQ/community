import type { Metadata } from "next";

import { CopyButton } from "@/components/copy-button";
import { CardDescription } from "@/components/ui/card";
import { Tag } from "@/components/ui/tag";
import { SettingCard } from "@/modules/admin/components/setting-card";
import { PublicBoardSwitch } from "@/modules/job-board/components/public-switch";
import { SourceCard } from "@/modules/job-board/components/source-card";
import { COMPANY_PARAM, JOB_BOARD_PAGE_TITLES, JOB_BOARD_PAGES } from "@/modules/job-board/contract";
import { jobBoardManifest } from "@/modules/job-board/manifest";
import { isPublicBoardOn, readAllSources } from "@/modules/job-board/reads";
import { readEmbedSnippets } from "@/modules/job-board/rules-widget";
import { requireAdmin } from "@/platform/auth/session";
import { readBrandingForPage } from "@/platform/branding/branding";
import { getDatabase } from "@/platform/database/client";
import { resolveAppUrl } from "@/platform/http/app-url";
import { modulePage } from "@/platform/modules/module-page";
import { AdminSection } from "@/shell/admin-section";

export const metadata: Metadata = { title: JOB_BOARD_PAGE_TITLES.admin };

function Snippet({ label, code }: { label: string; code: string }) {
  return (
    <div className="grid gap-2">
      <div className="flex flex-wrap items-center justify-between gap-2">
        <p className="type-small font-bold">{label}</p>
        <CopyButton text={code} label="Copy" />
      </div>
      <pre className="type-small rounded-field bg-muted p-3 whitespace-pre-wrap wrap-anywhere">{code}</pre>
    </div>
  );
}

export default modulePage(jobBoardManifest, async function AdminJobsPage() {
  await requireAdmin();
  const database = getDatabase();
  const [isPublic, sources, community] = await Promise.all([isPublicBoardOn(database), readAllSources(database), readBrandingForPage()]);
  const appUrl = resolveAppUrl(process.env);
  const publicLink = `${appUrl}${JOB_BOARD_PAGES.public}`;
  const snippets = readEmbedSnippets(appUrl, community.name);
  const failing = sources.filter(({ lastError }) => lastError !== null).length;

  return (
    <AdminSection title="Jobs" description="The companies' open jobs, the public board and the widget for your website.">
      <div className="grid items-start gap-5 lg:grid-cols-[minmax(0,1fr)_380px]">
        <div className="grid gap-5">
          <div className="flex flex-wrap items-center gap-2">
            <h2 className="type-h3">Linked sources</h2>
            <Tag>{sources.length}</Tag>
            {failing > 0 ? <Tag tone="destructive">{failing} not pulling</Tag> : null}
          </div>
          {sources.length === 0 ? (
            <CardDescription>No company has linked its hiring tool yet. Members do it from Jobs › Your company&apos;s jobs.</CardDescription>
          ) : null}
          {sources.map((source) => (
            <SourceCard key={source.id} source={source} canRemove={false} showMember />
          ))}
        </div>
        <div className="grid gap-5">
          <SettingCard title="Public board" tag={<Tag tone={isPublic ? "sage" : "neutral"}>{isPublic ? "On" : "Off"}</Tag>}>
            <CardDescription>
              Shows only each job&apos;s company, title, location and apply link. Never members&apos; names. The website widget works only while this is on.
            </CardDescription>
            <PublicBoardSwitch isPublic={isPublic} />
            {isPublic ? <Snippet label="Link to the public board" code={publicLink} /> : null}
          </SettingCard>
          <SettingCard title="Put it on your website" tag={null}>
            <CardDescription>
              Paste this line where the board should appear. It adds a frame that sizes itself. No cookies, no tracking.
            </CardDescription>
            <Snippet label="Every company" code={snippets.script} />
            <Snippet label={`One company (use the name in ?${COMPANY_PARAM}= on the board)`} code={snippets.companyScript} />
            <Snippet label="If your site blocks scripts" code={snippets.frame} />
          </SettingCard>
        </div>
      </div>
    </AdminSection>
  );
});
