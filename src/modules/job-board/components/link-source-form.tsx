"use client";

import Link from "next/link";
import { useState } from "react";

import { FormError } from "@/components/form-error";
import { Alert } from "@/components/ui/alert";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { ROUTES } from "@/platform/http/routes";

import { FEED_TOOLS, JOB_BOARD_API_ROUTES, JOB_BOARD_LIMITS } from "../contract";
import { useJobAction } from "./use-job-action";

const TOOL_NAMES = Object.values(FEED_TOOLS).map(({ label }) => label);

// A founder shares jobs only for the company on their card, so for them the company is fixed. An admin types any.
export function LinkSourceForm({ defaultCompany, isCompanyFixed }: { defaultCompany: string; isCompanyFixed: boolean }) {
  const [company, setCompany] = useState(defaultCompany);
  const [link, setLink] = useState("");
  const linkTool = useJobAction<{ company: string; link: string }>(JOB_BOARD_API_ROUTES.link, { onDone: () => setLink("") });
  const byHand = useJobAction<{ company: string }>(JOB_BOARD_API_ROUTES.manual);
  const isBusy = linkTool.isPending || byHand.isPending;
  const done = linkTool.data ?? byHand.data ?? null;
  if (isCompanyFixed && defaultCompany.trim() === "") {
    return (
      <p className="type-body text-foreground-soft">
        Add your company to <Link href={ROUTES.editCard} className="font-bold text-foreground underline underline-offset-4">your card</Link> first. Then you can share its jobs here.
      </p>
    );
  }
  return (
    <form
      className="grid gap-4"
      onSubmit={(event) => {
        event.preventDefault();
        byHand.reset();
        linkTool.mutate({ company, link });
      }}
    >
      <div className="grid gap-2">
        <Label htmlFor="job-company">Company</Label>
        <Input
          id="job-company"
          value={company}
          maxLength={JOB_BOARD_LIMITS.companyLength}
          onChange={(event) => setCompany(event.target.value)}
          autoComplete="organization"
          readOnly={isCompanyFixed}
          aria-describedby={isCompanyFixed ? "job-company-help" : undefined}
          required
        />
        {isCompanyFixed ? (
          <p id="job-company-help" className="type-small text-foreground-soft">
            From <Link href={ROUTES.editCard} className="underline underline-offset-4">your card</Link>. You share jobs for your own company.
          </p>
        ) : null}
      </div>
      <div className="grid gap-2">
        <Label htmlFor="job-link">Careers link</Label>
        <Input
          id="job-link"
          value={link}
          maxLength={JOB_BOARD_LIMITS.linkLength}
          onChange={(event) => setLink(event.target.value)}
          placeholder={FEED_TOOLS.greenhouse.example}
          inputMode="url"
          aria-describedby="job-link-help"
        />
        <p id="job-link-help" className="type-small text-foreground-soft">
          The link to your jobs page on {TOOL_NAMES.slice(0, -1).join(", ")} or {TOOL_NAMES.at(-1)}. We read its public job list every hour. No key needed.
        </p>
      </div>
      {done ? (
        <Alert variant={done.ok === false ? "info" : "success"} aria-live="polite">
          {done.message}
        </Alert>
      ) : null}
      <FormError message={linkTool.error?.message ?? byHand.error?.message ?? null} />
      <div className="flex flex-wrap gap-2">
        <Button type="submit" disabled={isBusy || link.trim() === ""} className="max-sm:w-full">
          {linkTool.isPending ? "Linking…" : "Link our hiring tool"}
        </Button>
        <Button
          type="button"
          variant="outline"
          disabled={isBusy}
          className="max-sm:w-full"
          onClick={() => {
            linkTool.reset();
            byHand.mutate({ company });
          }}
        >
          Add jobs by hand instead
        </Button>
      </div>
    </form>
  );
}
