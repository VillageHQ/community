import { Building2, Copy, Link2 } from "lucide-react";
import type { Metadata } from "next";

import { EmptyState } from "@/components/empty-state";
import { PageHeader } from "@/components/page-header";
import { COMPANY_PARAM, isFeedTool, JOB_BOARD_API_ROUTES, JOB_BOARD_PAGES, type JobSourceView } from "@/modules/job-board/contract";
import { jobBoardManifest } from "@/modules/job-board/manifest";
import { isPublicBoardOn, readAllSources } from "@/modules/job-board/reads";
import { readEmbedSnippets } from "@/modules/job-board/rules-widget";
import { requireAdmin } from "@/platform/auth/session";
import { readBrandingForPage } from "@/platform/branding/branding";
import { getDatabase } from "@/platform/database/client";
import { resolveAppUrl } from "@/platform/http/app-url";
import { modulePage } from "@/platform/modules/module-page";
import { CopyRow, PublicBoardForm, SourceRowActions } from "@/shell/admin-jobs-parts";

export const metadata: Metadata = { title: "Job board" };

const DATE_TIME = new Intl.DateTimeFormat("en-GB", { day: "numeric", month: "short", hour: "2-digit", minute: "2-digit", timeZone: "UTC" });

function plural(count: number, one: string, many = `${one}s`) {
  return `${count} ${count === 1 ? one : many}`;
}

function describeSource(source: JobSourceView) {
  const isFeed = isFeedTool(source.tool) && source.slug !== null;
  const state = !isFeed ? "jobs added by hand" : source.lastError ? source.lastError : source.lastPulledAt ? `pulled ${DATE_TIME.format(new Date(source.lastPulledAt))}` : "not pulled yet";
  return [plural(source.jobCount, "job"), source.hidden ? "hidden" : null, isFeed ? `${source.toolLabel} “${source.slug}”` : null, state, `added by ${source.memberName}`]
    .filter((part) => part !== null)
    .join(" · ");
}

const ICON = { "aria-hidden": true, className: "fh-i fh-s", strokeWidth: 1.5 } as const;

// Console › Job board (Founderhall's): the public board's switch and link, every linked board with Hide, and
// Community's website widget lines.
export default modulePage(jobBoardManifest, async function AdminJobsPage() {
  await requireAdmin();
  const database = getDatabase();
  const [isPublic, sources, community] = await Promise.all([isPublicBoardOn(database), readAllSources(database), readBrandingForPage()]);
  const appUrl = resolveAppUrl(process.env);
  const publicLink = `${appUrl}${JOB_BOARD_PAGES.public}`;
  const companyLink = `${publicLink}?${COMPANY_PARAM}=<company>`;
  const snippets = readEmbedSnippets(appUrl, community.name);
  const shown = sources.filter(({ hidden }) => !hidden);
  const openJobs = shown.reduce((total, { jobCount }) => total + jobCount, 0);
  const companies = new Set(shown.map(({ companySlug }) => companySlug)).size;
  const exampleCompany = sources[0]?.companySlug ?? "ledgerline";

  return (
    <>
      <PageHeader
        title="Job board"
        description={`${plural(openJobs, "open job")} at ${plural(companies, "company", "companies")}. Founders link their hiring tool on My profile; the portal pulls their open jobs every hour. Applications go to each company’s own page.`}
      />
      <div className="fh-grid">
        <section className="fh-sheet fh-c5" id="public">
          <h2 className="fh-h3">Public job board</h2>
          <PublicBoardForm isPublic={isPublic} />
          {isPublic ? (
            <>
              <p className="fh-label fh-small mt-4">The public link</p>
              <div className="fh-rows">
                <CopyRow value={publicLink} label="The public job board link" icon={<Link2 {...ICON} />} />
              </div>
              <p className="fh-small fh-muted mt-2">
                Each company also has its own page: {companyLink}.{" "}
                <a href={JOB_BOARD_PAGES.public} target="_blank" rel="noopener">
                  Open the public board
                </a>{" "}
                in a private window to see it as outsiders do.
              </p>
            </>
          ) : (
            <p className="fh-small fh-muted mt-3">Off: only signed-in members see the board. The public link shows “This board is not public”.</p>
          )}
        </section>
        <section className="fh-sheet fh-c7">
          <div className="fh-sheet-head">
            <h2 className="fh-h3">Linked boards</h2>
          </div>
          {sources.length > 0 ? (
            <>
              <div className="fh-rows fh-modrows fh-jobrows">
                {sources.map((source) => (
                  <div key={source.id} className="fh-r">
                    <span>
                      <Building2 {...ICON} />
                    </span>
                    <div className="fh-who">
                      <b>{source.company}</b>
                      <span className={source.lastError ? "fh-errtext" : undefined}>{describeSource(source)}</span>
                    </div>
                    <div className="fh-end">
                      <SourceRowActions sourceId={source.id} company={source.company} hidden={source.hidden} canPull={isFeedTool(source.tool) && source.slug !== null} />
                    </div>
                  </div>
                ))}
              </div>
              <p className="fh-small fh-muted mt-2.5">Hide takes a company off the board for members and the public; its founder sees it hidden on My profile.</p>
            </>
          ) : (
            <EmptyState title="No boards linked yet" description="Founders add their company’s jobs on My profile › Our jobs: they pick the hiring tool and paste the careers link." />
          )}
        </section>
        <section className="fh-sheet fh-c12" id="embed">
          <h2 className="fh-h3 flex items-center gap-1.5">
            <Link2 {...ICON} /> Embed on your site
          </h2>
          {isPublic ? (
            <>
              <p className="fh-small mt-1.5">
                Put the job board on your own website, in your name and colour. Paste one line where the board should show; it fits its height to the jobs. No cookies, no tracking.
              </p>
              <p className="fh-label fh-small mt-3.5">The script line</p>
              <div className="fh-rows">
                <CopyRow value={snippets.script} label="The script line for your website" icon={<Copy {...ICON} />} />
              </div>
              <p className="fh-small fh-muted mt-1.5">
                One company only: add <code>data-company=&quot;{exampleCompany}&quot;</code> (the end of its page’s link, {companyLink}).
              </p>
              <p className="fh-label fh-small mt-3.5">For sites that block scripts: the frame</p>
              <div className="fh-rows">
                <CopyRow value={snippets.frame} label="The frame for your website" icon={<Copy {...ICON} />} />
              </div>
              <p className="fh-small fh-muted mt-1.5">
                The frame keeps a fixed height (900 px); change it in the line if your board is shorter or longer.{" "}
                <a href={JOB_BOARD_API_ROUTES.embed} target="_blank" rel="noopener">
                  See what it shows
                </a>
                .
              </p>
            </>
          ) : (
            <p className="fh-small fh-muted mt-1.5">
              The public job board is off, so an embedded board shows only “This board is not public”. Switch it on above to put the board on your site.
            </p>
          )}
        </section>
      </div>
    </>
  );
});
