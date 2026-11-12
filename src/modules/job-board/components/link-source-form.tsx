"use client";

import { RefreshCw } from "lucide-react";
import Link from "next/link";
import { useState } from "react";

import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Note } from "@/components/ui/note";
import { Select } from "@/components/ui/select";
import { ROUTES } from "@/platform/http/routes";

import { FEED_TOOLS, isFeedTool, JOB_BOARD_API_ROUTES, JOB_BOARD_LIMITS } from "../contract";
import { useJobAction } from "./use-job-action";

// Founderhall's tool list: every tool with a public feed, then the ones without (their jobs are added by hand).
const NO_FEED_TOOLS = { workday: "Workday", icims: "iCIMS", other: "Another tool, or none" } as const;
const DEFAULT_TOOL = "greenhouse";

// Founderhall's "Our jobs" form (ourJobsSection's addForm): Company and Hiring tool side by side, the careers link, then
// "Pull our jobs". A tool with a feed links the board (the app finds the board in the link, whichever tool it is on);
// a tool without one starts a company whose jobs are added by hand. A founder shares jobs only for the company on
// their card, so for them the company can't be changed.
export function LinkSourceForm({ defaultCompany, isCompanyFixed }: { defaultCompany: string; isCompanyFixed: boolean }) {
  const [company, setCompany] = useState(defaultCompany);
  const [tool, setTool] = useState<string>(DEFAULT_TOOL);
  const [link, setLink] = useState("");
  const linkTool = useJobAction<{ company: string; link: string }>(JOB_BOARD_API_ROUTES.link, { onDone: () => setLink("") });
  const byHand = useJobAction<{ company: string }>(JOB_BOARD_API_ROUTES.manual);
  const isBusy = linkTool.isPending || byHand.isPending;
  const done = linkTool.data ?? byHand.data ?? null;
  const error = linkTool.error?.message ?? byHand.error?.message ?? null;
  if (isCompanyFixed && defaultCompany.trim() === "") {
    return (
      <p className="fh-small mt-3">
        Add your company to <Link href={ROUTES.editCard}>your card</Link> first. Then you can share its jobs here.
      </p>
    );
  }
  const example = isFeedTool(tool) ? FEED_TOOLS[tool].example : FEED_TOOLS[DEFAULT_TOOL].example;
  return (
    <form
      className="mt-3"
      onSubmit={(event) => {
        event.preventDefault();
        linkTool.reset();
        byHand.reset();
        // A tool without a feed and no link: jobs by hand. Any link is tried as a board, as Founderhall does.
        if (!isFeedTool(tool) && link.trim() === "") byHand.mutate({ company });
        else linkTool.mutate({ company, link });
      }}
    >
      {error ? (
        <Note kind="needs" role="alert" className="mb-3">
          {error}
        </Note>
      ) : null}
      <div className="fh-pair">
        <div>
          <label className="fh-label fh-small" htmlFor="oj-company">
            Company
          </label>
          <Input id="oj-company" value={company} maxLength={JOB_BOARD_LIMITS.companyLength} onChange={(event) => setCompany(event.target.value)} autoComplete="organization" readOnly={isCompanyFixed} required />
        </div>
        <div>
          <label className="fh-label fh-small" htmlFor="oj-tool">
            Hiring tool
          </label>
          <Select id="oj-tool" value={tool} onChange={(event) => setTool(event.target.value)}>
            {Object.entries(FEED_TOOLS).map(([key, { label }]) => (
              <option key={key} value={key}>
                {label}
              </option>
            ))}
            {Object.entries(NO_FEED_TOOLS).map(([key, label]) => (
              <option key={key} value={key}>
                {label}
              </option>
            ))}
          </Select>
        </div>
      </div>
      <div className="fh-field">
        <label className="fh-label fh-small" htmlFor="oj-link">
          Careers link
        </label>
        <Input
          id="oj-link"
          value={link}
          maxLength={JOB_BOARD_LIMITS.linkLength}
          onChange={(event) => setLink(event.target.value)}
          placeholder={`e.g. ${example}`}
          inputMode="url"
          aria-invalid={linkTool.error ? true : undefined}
          aria-describedby="oj-link-help"
        />
        <p id="oj-link-help" className="fh-hint">
          Paste your careers page or job board link. We find the board in it and pull your open jobs every hour. No key needed. Workday, iCIMS or another tool: add jobs by hand, or just link your careers page.
        </p>
      </div>
      {done ? (
        <Note kind={done.ok === false ? "needs" : "ok"} role="status" className="mt-3">
          {done.message}
        </Note>
      ) : null}
      <div className="fh-btn-row" style={{ marginTop: 12 }}>
        <Button type="submit" size="sm" disabled={isBusy}>
          <RefreshCw aria-hidden="true" className={linkTool.isPending ? "animate-spin" : undefined} />
          {isBusy ? "Pulling…" : "Pull our jobs"}
        </Button>
      </div>
    </form>
  );
}
