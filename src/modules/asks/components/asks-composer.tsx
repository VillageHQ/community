"use client";

import { Clock, Hand, Megaphone, Search } from "lucide-react";
import { useRouter } from "next/navigation";
import { useState, type FormEvent } from "react";

import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { RequestFailure, postRequest } from "@/platform/http/post-request";

import { ASK_API_ROUTES, ASK_ERROR_CODES, ASK_KINDS, ASK_LIMITS, ASKS_PAGE, createdAskSchema, describeAllowance, toAskPage, type AskAllowance, type AskKind } from "../contract";
import { ICON } from "./post-parts";

type ComposerProps = { communityName: string; allowance: AskAllowance; draft?: { body: string; target: string } | null };

// Founderhall's composer (crop composer-ask.png): Ask | Update, one line and Post, "Who are you trying to reach?"
// folded away, then the week's allowance as pips. A post goes to its own page with the flash.
export function AsksComposer({ communityName, allowance, draft = null }: ComposerProps) {
  const router = useRouter();
  const [kind, setKind] = useState<AskKind>(ASK_KINDS.ask);
  const [error, setError] = useState<{ text: string; field: "body" | "cap" } | null>(null);
  const [isPending, setIsPending] = useState(false);
  const isUpdate = kind === ASK_KINDS.update;

  async function submit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    const form = new FormData(event.currentTarget);
    setIsPending(true);
    setError(null);
    try {
      const { id, helperCount } = await postRequest(
        ASK_API_ROUTES.create,
        {
          title: String(form.get("body") ?? ""),
          kind,
          targetText: isUpdate ? null : String(form.get("target") ?? ""),
          targetCompany: isUpdate ? null : String(form.get("company") ?? ""),
        },
        createdAskSchema,
      );
      router.push(isUpdate ? `${ASKS_PAGE}?tab=updates&m=updated` : `${toAskPage(id)}?m=${helperCount > 0 ? "posted" : "posted0"}`);
    } catch (failure) {
      const isCap = failure instanceof RequestFailure && failure.code === ASK_ERROR_CODES.allowanceUsed;
      setError({ text: failure instanceof Error ? failure.message : "Something went wrong. Try again.", field: isCap ? "cap" : "body" });
      setIsPending(false);
    }
  }

  return (
    <form method="post" className="fh-composer fh-sheet" id="compose" onSubmit={submit}>
      <div className="fh-seg fh-kind" role="radiogroup" aria-label="Kind of post">
        <label>
          <input type="radio" name="type" value={ASK_KINDS.ask} checked={!isUpdate} onChange={() => setKind(ASK_KINDS.ask)} />
          <span>
            <Hand {...ICON} />
            Ask
          </span>
        </label>
        <label>
          <input type="radio" name="type" value={ASK_KINDS.update} checked={isUpdate} onChange={() => setKind(ASK_KINDS.update)} />
          <span>
            <Megaphone {...ICON} />
            Update
          </span>
        </label>
      </div>
      <div className="fh-oneline">
        <label className="fh-sr" htmlFor="p-body">
          Your ask or update
        </label>
        <Input
          id="p-body"
          name="body"
          maxLength={ASK_LIMITS.titleLength}
          required
          defaultValue={draft?.body ?? ""}
          placeholder="What do you need?"
          aria-invalid={error?.field === "body" ? true : undefined}
        />
        <Button type="submit" disabled={isPending}>
          Post
        </Button>
      </div>
      {error?.field === "body" ? (
        <p className="fh-hint fh-err" role="alert">
          {error.text}
        </p>
      ) : null}
      <details className="fh-askonly fh-more" open={Boolean(draft?.target) || undefined}>
        <summary>
          <Search {...ICON} />
          Who are you trying to reach? <span className="fh-muted">Optional; it helps us find who can help</span>
        </summary>
        <div className="fh-pair">
          <div>
            <label className="fh-label fh-small" htmlFor="p-target">
              A person or a role
            </label>
            <Input id="p-target" name="target" maxLength={ASK_LIMITS.targetLength} defaultValue={draft?.target ?? ""} placeholder="e.g. Head of procurement at a US hospital" />
          </div>
          <div>
            <label className="fh-label fh-small" htmlFor="p-company">
              Company
            </label>
            <Input id="p-company" name="company" maxLength={ASK_LIMITS.companyLength} placeholder="e.g. Halcyon Health" />
          </div>
        </div>
      </details>
      <p className="fh-small fh-muted fh-askonly" style={{ marginTop: 10 }}>
        <span className="fh-pips">
          {Array.from({ length: allowance.cap }, (_unused, position) => (
            <i key={position} aria-hidden="true" className={position < allowance.left ? "fh-on" : undefined} />
          ))}
        </span>{" "}
        {describeAllowance(allowance)}. We check who in {communityName} can help, and tell them.
      </p>
      {error?.field === "cap" ? (
        <div className="fh-note fh-needs" role="alert" style={{ marginTop: 10 }}>
          <Clock aria-hidden="true" className="fh-i fh-s" strokeWidth={1.5} />
          <span>{error.text}</span>
        </div>
      ) : null}
    </form>
  );
}
