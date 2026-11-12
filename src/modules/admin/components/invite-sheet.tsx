"use client";

import { useMutation } from "@tanstack/react-query";
import { Copy, Mail, Send } from "lucide-react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { useId, useRef, useState, type ReactNode } from "react";

import { Button, ButtonRow } from "@/components/ui/button";
import { OptionCard } from "@/components/ui/checkbox-card";
import { Note } from "@/components/ui/note";
import { BULK_INVITE_FORMATS, MAXIMUM_LISTED_INVITES, parseInviteList, type BulkInviteResult } from "@/modules/members/contract-bulk-invites";
import { FILL_IN_BASES, type FillInBasis } from "@/modules/members/contract-fill-in";
import { readInviteWords } from "@/modules/members/contract-invite-email";
import { createBulkInvitesRequest } from "@/modules/members/queries-invites";
import { API_ROUTES, ROUTES } from "@/platform/http/routes";
import { acknowledgedResponseSchema } from "@/platform/http/contract";
import { postRequest } from "@/platform/http/post-request";

// Founderhall's Import members and Mail pages (Set up). Invites only link to them.
const IMPORT_PAGE = "/admin/import";
const MAIL_PAGE = ROUTES.adminMail;

const EMPTY_MESSAGE = "Paste at least one email address.";
const TERMS_DATE_MESSAGE = "Pick the date your terms started saying this.";

type SentLink = BulkInviteResult["links"][number];

type Outcome = { isOk: boolean; summary: string; lines: string[]; links: SentLink[] };

function readOutcome(result: BulkInviteResult): Outcome {
  const invited = result.invitedCount + result.renewedCount;
  const lines = [...result.skipped.map(({ email, why }) => `${email}: ${why}`), ...result.problems.map(({ text, why }) => `${text}: ${why}`)];
  const how = !result.isEmailOn && invited > 0 ? " Mail is not set up: send their links yourself below." : "";
  const summary =
    invited > 0
      ? `${invited} invited.${how}${lines.length ? ` ${lines.length} skipped:` : ""}`
      : lines.length
        ? `Nobody new to invite. ${lines.length} skipped:`
        : EMPTY_MESSAGE;
  return { isOk: invited > 0, summary, lines: lines.slice(0, 8), links: result.links };
}

// No line holds an email address: Founderhall's "Paste at least one email address." (a list over the limit goes to
// the server, which says so).
function isNothingToInvite(text: string) {
  if (!text.trim()) return true;
  try {
    const { people, skipped } = parseInviteList(text);
    return people.length + skipped.length === 0;
  } catch {
    return false;
  }
}

type Signature = { community: string; inviterName: string; inviterRole: string | null };

function mailtoFor(link: SentLink, signature: Signature) {
  const words = readInviteWords({ community: signature.community, inviteeName: link.name, inviterName: signature.inviterName, inviterRole: signature.inviterRole, apostrophe: "'" });
  const body = [words.hi, "", words.lead, "", `${words.how}:`, link.link, "", words.small, "", words.sign].join("\n");
  return `mailto:${encodeURIComponent(link.email).replace("%40", "@")}?subject=${encodeURIComponent(words.subject)}&body=${encodeURIComponent(body)}`;
}

// Founderhall's "Send the sign-in links yourself": one ready mail per founder, each with only their own link.
function SendYourself({ links, signature }: { links: SentLink[]; signature: Signature }) {
  const allId = useId();
  const [wasCopied, setWasCopied] = useState(false);
  const allLinks = links.map(({ email, link }) => `${email} ${link}`).join("\n");
  return (
    <div className="fh-copybox fh-sendself mt-3.5">
      <h3 className="fh-h3">{links.length === 1 ? "Send the sign-in link yourself" : `Send the ${links.length} sign-in links yourself`}</h3>
      <p className="fh-hint mt-1 mb-2.5">Each “Open in your email” starts one ready mail to one founder, with only their own link. A link works once, for 14 days.</p>
      <div className="fh-rows">
        {links.map((link) => (
          <div key={link.email} className="fh-r">
            <span className="fh-avatar fh-sm inline-flex size-7 items-center justify-center rounded-full bg-vellum">
              <Mail aria-hidden="true" className="size-3.5" strokeWidth={1.5} />
            </span>
            <div className="fh-who">
              <b>{link.name || link.email}</b>
              <span className="whitespace-normal! wrap-anywhere">{link.email}</span>
            </div>
            <div className="fh-end">
              <Button asChild size="sm" variant="secondary">
                <a href={mailtoFor(link, signature)}>
                  <Send aria-hidden="true" strokeWidth={1.5} />
                  Open in your email
                </a>
              </Button>
            </div>
          </div>
        ))}
      </div>
      <label className="fh-label mt-3.5" htmlFor={allId}>
        All links, one line per founder
      </label>
      <textarea className="fh-textarea fh-mono fh-copyfield" id={allId} readOnly value={allLinks} />
      <ButtonRow className="mt-2">
        <Button
          type="button"
          size="sm"
          variant="secondary"
          onClick={() => {
            void navigator.clipboard.writeText(allLinks).then(() => setWasCopied(true));
          }}
        >
          <Copy aria-hidden="true" strokeWidth={1.5} />
          <span aria-live="polite">{wasCopied ? "Copied" : "Copy all links"}</span>
        </Button>
      </ButtonRow>
      <p className="fh-small fh-muted mt-2">Anyone with a link can sign in as that person, so send each one only to them.</p>
    </div>
  );
}

type InviteSheetProps = Signature & {
  isEmailOn: boolean;
  // The profile fill-in's consent choice is Village's; it shows only while the network is on.
  isFillInShown: boolean;
  savedBasis: FillInBasis | null;
  savedTermsDate: string | null;
  // "Waiting to sign in", under the form.
  children?: ReactNode;
};

function readToday() {
  return new Date().toISOString().slice(0, 10);
}

// Founderhall's "Invite members" sheet: one box for many people, the profile fill-in's consent, Send invites.
export function InviteSheet({ community, inviterName, inviterRole, isEmailOn, isFillInShown, savedBasis, savedTermsDate, children }: InviteSheetProps) {
  const router = useRouter();
  const formRef = useRef<HTMLFormElement>(null);
  const [outcome, setOutcome] = useState<Outcome | null>(null);
  const [basisError, setBasisError] = useState<string | null>(null);
  const [failure, setFailure] = useState<string | null>(null);
  const signature = { community, inviterName, inviterRole };

  const send = useMutation({
    mutationFn: async ({ text, basis, termsDate }: { text: string; basis: FillInBasis; termsDate: string }) => {
      if (isFillInShown && (basis !== savedBasis || (basis === FILL_IN_BASES.terms && termsDate !== savedTermsDate))) {
        const body = basis === FILL_IN_BASES.terms ? { basis, termsDate } : { basis };
        await postRequest(API_ROUTES.adminFillIn, body, acknowledgedResponseSchema);
      }
      return createBulkInvitesRequest(BULK_INVITE_FORMATS.list, text);
    },
    onSuccess: (result) => {
      const next = readOutcome(result);
      setOutcome(next);
      if (next.isOk) formRef.current?.reset();
      router.refresh();
    },
    onError: (error) => setFailure(error.message),
  });

  return (
    <section className="fh-sheet fh-c7">
      <h2 className="fh-h3">Invite members</h2>
      <form
        ref={formRef}
        noValidate
        onSubmit={(event) => {
          event.preventDefault();
          setFailure(null);
          setBasisError(null);
          const data = new FormData(event.currentTarget);
          const text = String(data.get("emails") ?? "");
          const basis = (String(data.get("lookup_basis") ?? FILL_IN_BASES.ask) as FillInBasis) || FILL_IN_BASES.ask;
          const termsDate = String(data.get("lookup_basis_date") ?? "");
          if (isNothingToInvite(text)) {
            setOutcome({ isOk: false, summary: EMPTY_MESSAGE, lines: [], links: [] });
            return;
          }
          if (isFillInShown && basis === FILL_IN_BASES.terms && !termsDate) {
            setBasisError(TERMS_DATE_MESSAGE);
            return;
          }
          send.mutate({ text, basis, termsDate });
        }}
      >
        <label className="fh-label mt-2.5" htmlFor="invite-emails">
          Paste emails, one per line, or a CSV of name and email
        </label>
        <textarea
          className="fh-textarea min-h-[120px]"
          id="invite-emails"
          name="emails"
          maxLength={MAXIMUM_LISTED_INVITES * 400}
          placeholder={"e.g. ada.founder@example.com\nSam Lee, sam.lee@example.com"}
        />
        <p className="fh-hint">
          {isEmailOn ? (
            <>
              Up to {MAXIMUM_LISTED_INVITES} at a time. People who are already members are skipped. A whole alumni list? <Link href={IMPORT_PAGE}>Import members (CSV)</Link>.
            </>
          ) : (
            <>
              Mail is not set up, so invites are not emailed: send the sign-in links yourself in one click below, or copy them all. To email them from the portal, set up{" "}
              <Link href={MAIL_PAGE}>Mail</Link>.
            </>
          )}
        </p>

        {isFillInShown ? (
          <fieldset className="fh-basis mt-4 border-0 p-0" id="basis">
            <legend className="fh-label">Profile fill-in: how did these members agree?</legend>
            <p className="fh-hint mt-0 mb-2">Required. Profiles are filled in from public profiles only for members with a consent record. Saved for each member with today’s date and your name.</p>
            <div className="grid gap-2.5">
              <OptionCard
                id="basis-terms"
                name="lookup_basis"
                value={FILL_IN_BASES.terms}
                defaultChecked={savedBasis === FILL_IN_BASES.terms}
                title="Members agreed in our membership terms on"
                description={
                  <span className="mt-1.5 block">
                    <input
                      className="fh-input"
                      type="date"
                      name="lookup_basis_date"
                      defaultValue={savedTermsDate ?? ""}
                      max={readToday()}
                      aria-label="The date members agreed to the membership terms"
                    />
                  </span>
                }
              />
              <OptionCard
                id="basis-ask"
                name="lookup_basis"
                value={FILL_IN_BASES.ask}
                defaultChecked={savedBasis !== FILL_IN_BASES.terms}
                title="Ask each member at sign-in"
                isRecommended
                description="Nothing is filled in until they tick “Fill in my profile from public profiles”."
              />
            </div>
            {basisError ? (
              <p className="fh-hint fh-err" role="alert">
                {basisError}
              </p>
            ) : null}
          </fieldset>
        ) : null}

        {isEmailOn ? null : (
          <div className="fh-btn-stack mt-3.5">
            <Button type="submit" size="sm" variant="secondary">
              <Mail aria-hidden="true" strokeWidth={1.5} />
              Send from your email (one ready mail, each founder gets only their own link)
            </Button>
            <Button type="submit" size="sm" variant="quiet">
              <Copy aria-hidden="true" strokeWidth={1.5} />
              Copy all links
            </Button>
          </div>
        )}
        <ButtonRow className="mt-3">
          <Button type="submit" size="sm" disabled={send.isPending}>
            <Send aria-hidden="true" strokeWidth={1.5} />
            {send.isPending ? "Sending…" : "Send invites"}
          </Button>
        </ButtonRow>
      </form>

      {failure ? (
        <Note className="mt-3.5" role="alert">
          {failure}
        </Note>
      ) : outcome ? (
        <Note kind={outcome.isOk ? "ok" : "plain"} icon={null} className="mt-3.5" role="status">
          {outcome.summary}
          {outcome.lines.map((line) => (
            <span key={line}>
              <br />
              {line}
            </span>
          ))}
        </Note>
      ) : null}
      {outcome && outcome.links.length > 0 ? <SendYourself links={outcome.links} signature={signature} /> : null}
      {children}
    </section>
  );
}
