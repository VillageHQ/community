"use client";

import { Plus } from "lucide-react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { useRef, useState, type FormEvent } from "react";

import { Avatar } from "@/components/ui/avatar";
import { Button } from "@/components/ui/button";
import { OptionCard } from "@/components/ui/checkbox-card";
import { KvTiles } from "@/components/ui/figures";
import { Pill } from "@/components/ui/pill";
import { ROUTES } from "@/platform/http/routes";
import { FILL_IN_BASES, type FillInBasis } from "@/modules/members/contract-fill-in";
import { IMPORT_API_ROUTE, IMPORT_PARAMS, importResultSchema, type ImportResult } from "@/modules/members/contract-import";

const FAILURE_MESSAGE = "The import didn't go through. Try again.";
const UNREACHABLE_MESSAGE = "We couldn't reach the server. Check your connection and try again.";
const ICON = { "aria-hidden": true, className: "fh-i fh-xs", strokeWidth: 1.5 } as const;

type Errors = { file?: string; basis?: string; form?: string };

function plural(count: number, word: string) {
  return `${count.toLocaleString("en-US")} ${word}`;
}

async function postImport(file: File, { invite, basis, termsDate }: { invite: boolean; basis: string; termsDate: string }) {
  const params = new URLSearchParams({ [IMPORT_PARAMS.basis]: basis });
  if (invite) params.set(IMPORT_PARAMS.invite, "1");
  if (basis === FILL_IN_BASES.terms) params.set(IMPORT_PARAMS.termsDate, termsDate);
  let response: Response;
  try {
    response = await fetch(`${IMPORT_API_ROUTE}?${params}`, { method: "POST", headers: { "Content-Type": "text/csv; charset=utf-8" }, body: file });
  } catch {
    return { errors: { form: UNREACHABLE_MESSAGE } satisfies Errors };
  }
  const body: unknown = await response.json().catch(() => null);
  if (response.ok) return { result: importResultSchema.parse(body) };
  const failure = (body ?? {}) as { field?: string; message?: string };
  const message = failure.message ?? FAILURE_MESSAGE;
  if (failure.field === IMPORT_PARAMS.basis) return { errors: { basis: message } satisfies Errors };
  if (failure.field === "file") return { errors: { file: message } satisfies Errors };
  return { errors: { form: message } satisfies Errors };
}

// Founderhall's import result (views-admin.mjs importPage): the counts, what happens next, the first people, and
// every line that was not imported.
function ImportResultSheet({ result }: { result: ImportResult }) {
  const more = result.importedCount - result.imported.length;
  const hiddenLines = result.notImportedCount - result.notImported.length;
  return (
    <section className="fh-sheet fh-c12" id="result" aria-live="polite">
      <div className="fh-sheet-head">
        <h2 className="fh-h3">{result.importedCount ? `${result.importedCount.toLocaleString("en-US")} imported` : "Nothing imported"}</h2>
        {result.importedCount ? <Link href={ROUTES.adminMembers}>See them in Members</Link> : null}
      </div>
      <KvTiles
        className="mt-2.5"
        tiles={[
          { value: result.importedCount.toLocaleString("en-US"), label: "new members", isGood: true },
          { value: result.skippedCount.toLocaleString("en-US"), label: "already members, skipped" },
          { value: result.problemCount.toLocaleString("en-US"), label: "lines not read" },
          { value: result.rowCount.toLocaleString("en-US"), label: "rows with an email" },
        ]}
      />
      {result.importedCount ? (
        <>
          <p className="fh-small mt-3">
            {result.isEmailing ? (
              "Their invites are going out now, one by one; each one shows in Mail’s sending log."
            ) : (
              <>
                No email went out. Their invite links wait on <Link href={ROUTES.adminLinks}>Sign-in links</Link> for you to send, or{" "}
                <Link href={ROUTES.adminInvites}>send their invites</Link> later.
              </>
            )}
          </p>
          <div className="fh-rows mt-3">
            {result.imported.map((person) => (
              <div key={person.email} className="fh-r">
                <Avatar stableId={person.email} name={person.name ?? person.email} />
                <div className="fh-who">
                  <b>{person.name ?? person.email}</b>
                  <span>{person.email}</span>
                </div>
                <div className="fh-end">
                  {person.company || person.cohort ? <small>{[person.company, person.cohort].filter(Boolean).join(" · ")}</small> : null}
                  <Pill tone="open">Invited</Pill>
                </div>
              </div>
            ))}
          </div>
          {more > 0 ? <p className="fh-small fh-muted mt-2">and {more.toLocaleString("en-US")} more.</p> : null}
        </>
      ) : null}
      {result.notImportedCount ? (
        <>
          <p className="fh-label mt-3.5">Not imported</p>
          <ul className="fh-hist fh-small">
            {result.notImported.map(({ line, why }, index) => (
              <li key={`${line}-${index}`}>
                <span>Line {line.toLocaleString("en-US")}</span>
                <span>{why}</span>
              </li>
            ))}
            {hiddenLines > 0 ? (
              <li>
                <span>…</span>
                <span>and {plural(hiddenLines, "more")}</span>
              </li>
            ) : null}
          </ul>
        </>
      ) : null}
    </section>
  );
}

type ImportMembersFormProps = { communityBasis: FillInBasis | null; communityTermsDate: string | null; today: string };

export function ImportMembersForm({ communityBasis, communityTermsDate, today }: ImportMembersFormProps) {
  const router = useRouter();
  const fileInput = useRef<HTMLInputElement>(null);
  const [basis, setBasis] = useState<FillInBasis>(communityBasis ?? FILL_IN_BASES.ask);
  const [termsDate, setTermsDate] = useState(communityTermsDate ?? "");
  const [errors, setErrors] = useState<Errors>({});
  const [result, setResult] = useState<ImportResult | null>(null);
  const [isPending, setIsPending] = useState(false);

  async function submit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    const form = new FormData(event.currentTarget);
    const file = fileInput.current?.files?.[0];
    if (!file) {
      setErrors({ file: "Choose your CSV file." });
      fileInput.current?.focus();
      return;
    }
    if (basis === FILL_IN_BASES.terms && !termsDate) {
      setErrors({ basis: "Pick the date your membership terms started saying this." });
      return;
    }
    setIsPending(true);
    setErrors({});
    const outcome = await postImport(file, { invite: form.get(IMPORT_PARAMS.invite) === "1", basis, termsDate });
    setIsPending(false);
    if ("errors" in outcome) {
      setErrors(outcome.errors ?? {});
      return;
    }
    setResult(outcome.result);
    if (fileInput.current) fileInput.current.value = "";
    router.refresh();
    requestAnimationFrame(() => document.getElementById("result")?.scrollIntoView({ block: "start" }));
  }

  return (
    <div className="fh-grid">
      {result ? <ImportResultSheet result={result} /> : null}
      <form className="fh-sheet fh-c7" noValidate onSubmit={submit}>
        <label className="fh-label" htmlFor="imp-file">
          Your CSV file
        </label>
        <input
          ref={fileInput}
          className="fh-input file:mr-1 file:rounded-[3px] file:border file:border-solid file:border-[#767676] file:bg-[#efefef] file:px-1.5 file:py-px file:text-ink"
          id="imp-file"
          name="file"
          type="file"
          accept=".csv,text/csv"
          required
          aria-invalid={errors.file ? true : undefined}
          aria-describedby={errors.file ? "imp-file-hint imp-file-error" : "imp-file-hint"}
        />
        <p className="fh-hint" id="imp-file-hint">
          A header row with name, email, company and cohort, in any order (export it from your spreadsheet or Airtable as CSV). Up to 20,000 rows.
        </p>
        {errors.file ? (
          <p className="fh-hint fh-err" id="imp-file-error" role="alert">
            {errors.file}
          </p>
        ) : null}
        <label className="fh-setrow fh-check mt-3">
          <div>
            <b>Email each person their invite now</b>
            <span>Off: they are added as invited, and their invite links wait on Sign-in links for you to send.</span>
          </div>
          <input type="checkbox" name={IMPORT_PARAMS.invite} value="1" className="fh-switch" />
        </label>
        <fieldset className="fh-basis" id="basis" style={{ border: 0, padding: 0, margin: "16px 0 0" }}>
          <legend className="fh-label px-0.5">Profile fill-in: how did these members agree?</legend>
          <p className="fh-hint" style={{ margin: "0 0 8px" }}>
            Required. Profiles are filled in from public profiles only for members with a consent record. Saved for the whole community, with today’s date and your
            name.
          </p>
          <OptionCard
            name="lookup_basis"
            id="imp-basis-terms"
            value={FILL_IN_BASES.terms}
            checked={basis === FILL_IN_BASES.terms}
            onChange={() => setBasis(FILL_IN_BASES.terms)}
            title="Members agreed in our membership terms on"
            description={
              <span style={{ marginTop: 6 }}>
                <input
                  className="fh-input"
                  type="date"
                  name="lookup_basis_date"
                  value={termsDate}
                  max={today}
                  onChange={(event) => {
                    setTermsDate(event.target.value);
                    setBasis(FILL_IN_BASES.terms);
                  }}
                  aria-label="The date members agreed to the membership terms"
                />
              </span>
            }
          />
          <OptionCard
            name="lookup_basis"
            id="imp-basis-ask"
            value={FILL_IN_BASES.ask}
            checked={basis === FILL_IN_BASES.ask}
            onChange={() => setBasis(FILL_IN_BASES.ask)}
            isRecommended
            title="Ask each member at sign-in"
            description="Nothing is filled in until they tick “Fill in my profile from public profiles”."
          />
          {errors.basis ? (
            <p className="fh-hint fh-err" id="basis-err" role="alert">
              {errors.basis}
            </p>
          ) : null}
        </fieldset>
        {errors.form ? (
          <p className="fh-hint fh-err" role="alert">
            {errors.form}
          </p>
        ) : null}
        <div className="fh-btn-row" style={{ marginTop: 14 }}>
          <Button size="sm" type="submit" disabled={isPending}>
            <Plus {...ICON} />
            {isPending ? "Importing…" : "Import members"}
          </Button>
        </div>
      </form>
      <section className="fh-sheet fh-c5">
        <h2 className="fh-h3">The columns</h2>
        <table className="fh-tbl" style={{ marginTop: 10 }}>
          <thead>
            <tr>
              <th>name</th>
              <th>email</th>
              <th>company</th>
              <th>cohort</th>
            </tr>
          </thead>
          <tbody>
            <tr>
              <td>Ada Founder</td>
              <td>ada@example.com</td>
              <td>Gridwise</td>
              <td>Fund III</td>
            </tr>
            <tr>
              <td>Sam Lee</td>
              <td>sam@example.com</td>
              <td>Tallyhealth</td>
              <td>Fund II</td>
            </tr>
          </tbody>
        </table>
        <p className="fh-small fh-muted" style={{ marginTop: 10 }}>
          Only email is required. Company and cohort fill in the profile; members can change them. Cohort powers the partner report’s breakdown and “You already know” in
          search.
        </p>
      </section>
    </div>
  );
}
