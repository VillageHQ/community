import { EmptyState } from "@/components/empty-state";
import { Pill } from "@/components/ui/pill";

import { formatDayMonth } from "../console-periods";
import { OUTCOME_WORDS, type IntroLogRow } from "../reads-intro-log";

// Founderhall's intro log (crop intro-log-table.png): a 6-column ledger on desktop (Asked · Asked by · For an intro
// to · Through · State · Then); on a phone each row is one line "Asker → Target via Connector", its pill, and the dates.

function readTarget({ target, targetCompany }: IntroLogRow) {
  return targetCompany ? `${target} (${targetCompany})` : target;
}

function readThen({ answeredAt, introducedAt, outcome }: IntroLogRow) {
  return [
    answeredAt ? `answered ${formatDayMonth(answeredAt)}` : null,
    introducedAt ? `introduced ${formatDayMonth(introducedAt)}` : null,
    outcome ? `outcome: ${OUTCOME_WORDS[outcome]}` : null,
  ]
    .filter(Boolean)
    .join(" · ");
}

function LogRow({ row }: { row: IntroLogRow }) {
  const then = readThen(row);
  const pill = <Pill tone={row.tone}>{row.stateWord}</Pill>;
  return (
    <div className="fh-logrow" data-state={row.filter}>
      <span className="fh-cell">{formatDayMonth(row.askedAt)}</span>
      <span className="fh-cell">
        <b>{row.asker}</b>
      </span>
      <span className="fh-cell">{readTarget(row)}</span>
      <span className="fh-cell">{row.connector}</span>
      <span className="fh-cell">{pill}</span>
      <span className="fh-cell fh-then fh-muted">{then || "–"}</span>
      <div className="fh-m-line">
        <b>{row.asker}</b> → <b>{row.target}</b>
        {row.targetCompany ? ` (${row.targetCompany})` : ""} via {row.connector}
      </div>
      <div className="fh-m-st">{pill}</div>
      <div className="fh-m-meta">
        <span>asked {formatDayMonth(row.askedAt)}</span>
        {then ? <span>{then}</span> : null}
      </div>
    </div>
  );
}

export function IntroLogTable({ rows, hasAny }: { rows: readonly IntroLogRow[]; hasAny: boolean }) {
  return (
    <div className="fh-introlog">
      <div className="fh-loghead mt-4">
        <span>Asked</span>
        <span>Asked by</span>
        <span>For an intro to</span>
        <span>Through</span>
        <span>State</span>
        <span>Then</span>
      </div>
      {rows.length > 0 ? (
        <div className="fh-logs">
          {rows.map((row) => (
            <LogRow key={row.id} row={row} />
          ))}
        </div>
      ) : (
        <div className="mt-3">
          <EmptyState title={hasAny ? "Nothing in this filter" : "No intros in this period"} description="Each intro a member asks for lands here with its state and dates." />
        </div>
      )}
    </div>
  );
}
