import { RefreshCw } from "lucide-react";
import Link from "next/link";

import { ROUTES } from "@/platform/http/routes";
import { formatDayMonth } from "@/platform/text/format-date";
import { FILL_IN_FIELD_LABELS, FILL_IN_FIELDS, readPastRoles, toRoleYears, type FillInField, type FilledLine } from "@/modules/members/contract-fill-in";

import { FilledLineActions, PastRolesToggle } from "./filled-line-actions";

// Founderhall's "Filled in from public profiles" sheet (views villageSection): Role, Company and City with their
// dates, then Past roles. On My profile each line has Correct and Hide, and the past roles hide as one.

export const WORDED_LINE_FIELDS: readonly FillInField[] = [FILL_IN_FIELDS.title, FILL_IN_FIELDS.company, FILL_IN_FIELDS.location];


type FilledLinesSheetProps = {
  lines: readonly FilledLine[];
  refreshedAt: string | null;
  // My profile: Correct and Hide, hidden lines struck through, and the note under the list.
  isOwn: boolean;
  // Fields where the member's own words show instead (My profile only).
  ownWordsFields?: readonly FillInField[];
  // Shown instead of the lines ("Nothing filled in from public profiles yet.").
  emptyNote: string | null;
  // "You asked not to be looked up": the note links Your data.
  isRefused?: boolean;
};

export function FilledLinesSheet({ lines, refreshedAt, isOwn, ownWordsFields = [], emptyNote, isRefused = false }: FilledLinesSheetProps) {
  const shown = lines.filter((line) => isOwn || !line.isHidden);
  const wordedLines = WORDED_LINE_FIELDS.flatMap((field) => shown.filter((line) => line.field === field));
  const pastRolesLine = shown.find((line) => line.field === FILL_IN_FIELDS.pastRoles);
  const pastRoles = readPastRoles(pastRolesLine?.value);
  const isEmpty = wordedLines.length === 0 && pastRoles.length === 0;
  return (
    <section className="fh-sheet" id="village-lines" aria-label="Filled in from public profiles">
      <div className="fh-source">
        <RefreshCw aria-hidden="true" className="fh-i fh-xs" strokeWidth={1.5} />
        <span>Filled in from public profiles{refreshedAt && !isRefused && !emptyNote ? ` · refreshed ${formatDayMonth(refreshedAt)}` : ""}</span>
      </div>
      {isRefused ? (
        <p className="fh-small fh-muted">
          You asked not to be looked up on public profiles, so nothing is filled in. <Link href={ROUTES.yourData}>Your data</Link>
        </p>
      ) : emptyNote ? (
        <p className="fh-small fh-muted">{emptyNote}</p>
      ) : (
        <>
          {wordedLines.length > 0 ? (
            <ul className="fh-hist">
              {wordedLines.map((line) => (
                <li key={line.field} className={line.isHidden ? "fh-hidden-field" : undefined}>
                  <span>
                    <b>{FILL_IN_FIELD_LABELS[line.field]}</b>: {line.value}
                    {isOwn && ownWordsFields.includes(line.field) ? <span className="fh-small fh-muted"> (your own words show instead)</span> : null}
                  </span>
                  <span>{formatDayMonth(line.filledAt)}</span>
                  {isOwn ? <FilledLineActions field={line.field} isHidden={line.isHidden} /> : null}
                </li>
              ))}
            </ul>
          ) : null}
          {pastRoles.length > 0 ? (
            <>
              <p className="fh-label mt-3">Past roles</p>
              <ul className="fh-hist">
                {pastRoles.map((role, position) => (
                  <li key={`${role.title}-${position}`} className={pastRolesLine?.isHidden ? "fh-hidden-field" : undefined}>
                    <span>
                      <b>{role.title}</b>
                      {role.company ? `, ${role.company}` : ""}
                    </span>
                    <span>{toRoleYears(role)}</span>
                  </li>
                ))}
              </ul>
            </>
          ) : null}
          {isOwn && pastRolesLine ? <PastRolesToggle isHidden={pastRolesLine.isHidden} /> : null}
          {isOwn ? (
            <p className="fh-small fh-muted mt-2">Correct a line by writing your own words above; they always win. Hidden lines stay hidden when the profile refreshes.</p>
          ) : null}
          {isEmpty ? <p className="fh-small fh-muted">Nothing to show.</p> : null}
        </>
      )}
    </section>
  );
}
