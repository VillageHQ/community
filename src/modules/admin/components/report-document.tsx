import { LogoTile } from "@/components/logo-tile";
import { Ledger } from "@/components/ui/figures";
import { Note } from "@/components/ui/note";

import { formatDayMonth } from "../console-periods";
import { hoursWord, medianTile, NO_ANSWER_DAYS, OTHER_CONNECTORS, readConnectorRows, REPORT_FOOT, RESULT_ROWS, type BreakdownRow, type ReportStats } from "../report-stats";

const percentOf = (part: number, whole: number) => (whole ? `${Math.round((part / whole) * 100)}%` : undefined);
const barOf = (part: number, whole: number) => (part / Math.max(whole, 1)) * 100;

type Column = { label: string; key: "asked" | "yes" | "made" | "declined" | "noAnswer" | "open" };

const CONNECTOR_COLUMNS: Column[] = [
  { label: "Asked", key: "asked" },
  { label: "Yes", key: "yes" },
  { label: "Introduced", key: "made" },
];
const BREAKDOWN_COLUMNS: Column[] = [
  { label: "Asked", key: "asked" },
  { label: "Made", key: "made" },
  { label: "Declined", key: "declined" },
  { label: "No answer", key: "noAnswer" },
  { label: "Open", key: "open" },
];

function Table({ first, columns, rows }: { first: string; columns: Column[]; rows: readonly BreakdownRow[] }) {
  return (
    <table className="fh-tbl">
      <thead>
        <tr>
          <th>{first}</th>
          {columns.map(({ label }) => (
            <th key={label} className="fh-n">
              {label}
            </th>
          ))}
        </tr>
      </thead>
      <tbody>
        {rows.map((row) => (
          <tr key={row.name}>
            <td>
              <span className="fh-serif">{row.name}</span>
              {row.isCredited === false ? <small className="fh-muted block">not named to partners</small> : null}
            </td>
            {columns.map(({ key }) => (
              <td key={key} className="fh-n">
                {row[key]}
              </td>
            ))}
          </tr>
        ))}
      </tbody>
    </table>
  );
}

type BreakdownProps = { title: string; first: string; columns: Column[]; rows: readonly BreakdownRow[]; empty?: string };

function Breakdown({ title, first, columns, rows, empty }: BreakdownProps) {
  return (
    <div>
      <h2>{title}</h2>
      {rows.length > 0 || !empty ? <Table first={first} columns={columns} rows={rows} /> : <p className="fh-small fh-muted">{empty}</p>}
    </div>
  );
}

function Outcomes({ report }: { report: ReportStats }) {
  const { intros: stats } = report;
  const rows: { label: string; note: string | null; value: string }[] = [
    ...Object.entries(RESULT_ROWS).map(([key, label]) => ({ label, note: null, value: String(stats.results[key as keyof typeof stats.results]) })),
    {
      label: "Found it helpful",
      note: stats.answered ? `${stats.notReally} not really, ${stats.tooEarly} too early to say` : null,
      value: stats.answered ? `${stats.helpful} of ${stats.answered} who answered` : "no answers yet",
    },
    ...(stats.pending
      ? [{ label: "Pending", note: `introduced less than ${stats.outcomeDays} days ago; asked at ${stats.outcomeDays} days`, value: `${stats.pending} pending` }]
      : []),
  ];
  return (
    <section className="fh-outcomes" aria-labelledby="outcomes-h">
      <div className="fh-ohead">
        <h2 id="outcomes-h">What came of the intros</h2>
        <span>asked {stats.outcomeDays} days after each intro</span>
      </div>
      {rows.map(({ label, note, value }) => (
        <div key={label} className="fh-orow">
          <span>
            {label}
            {note ? <small>{note}</small> : null}
          </span>
          <b>{value}</b>
        </div>
      ))}
      <p className="fh-oline">
        One line for the partner meeting: <b>{report.summary}</b>
      </p>
    </section>
  );
}

function AsksAndUpdates({ asks }: { asks: NonNullable<ReportStats["asks"]> }) {
  return (
    <>
      <h2>Asks &amp; updates</h2>
      <div className="fh-kv">
        <div>
          <b>{asks.posted}</b>
          <span>asks posted</span>
        </div>
        <div className="fh-good">
          <b>{asks.answered}</b>
          <span>answered</span>
        </div>
        <div>
          <b>{asks.open}</b>
          <span>still open</span>
        </div>
        <div>
          <b>{hoursWord(asks.medianHours)}</b>
          <span>median time to first help</span>
        </div>
      </div>
      <p className="fh-small mt-2.5">
        {asks.helped} asks got an offer of help from a member; {asks.intros} intro{asks.intros === 1 ? "" : "s"} started from an ask, {asks.introsMade} made.
      </p>
    </>
  );
}

type ReportDocumentProps = { report: ReportStats; preparedBy: string; logo: Parameters<typeof LogoTile>[0]["logo"]; now?: Date };

// Founderhall's partner report (crop report-document.png): a printable paper document with an Ink rule on top.
export function ReportDocument({ report, preparedBy, logo, now = new Date() }: ReportDocumentProps) {
  const { intros: stats, asks, period } = report;
  return (
    <article className="fh-report">
      <div className="fh-report-brand">
        <LogoTile name={report.communityName} logo={logo} sizePx={28} className="ml-0 text-[11px]" />
        <b>{report.communityName}</b>
        <span>
          Partner report
          <br />
          {period.range}
        </span>
      </div>
      <h1 className="fh-h1">{report.title}</h1>
      <p className="fh-by">
        Prepared by {preparedBy} · {formatDayMonth(now)} · from the intro log
      </p>
      <div className="fh-kv">
        <div>
          <b>{stats.asked}</b>
          <span>intros asked for</span>
        </div>
        <div className="fh-good">
          <b>{stats.made}</b>
          <span>introduced, both said yes</span>
        </div>
        <div className="fh-good">
          <b>{stats.answered ? stats.helpful : "–"}</b>
          <span>found it helpful{stats.answered ? `, ${stats.helpful} of ${stats.answered}` : ", no answers yet"}</span>
        </div>
        <div>
          <b>{medianTile(stats.medianDays)}</b>
          <span>median from ask to intro</span>
        </div>
      </div>
      <Outcomes report={report} />
      <h2>Every step, counted</h2>
      <Ledger
        rows={[
          { label: "Asked for an intro", value: stats.asked, percent: barOf(stats.asked, stats.asked) },
          { label: "Connector said yes", value: stats.connectorYes, share: percentOf(stats.connectorYes, stats.asked), percent: barOf(stats.connectorYes, stats.asked), tone: "yes" },
          { label: "Target said yes", value: stats.made, share: percentOf(stats.made, stats.connectorYes), percent: barOf(stats.made, stats.asked), tone: "yes" },
          { label: <b>Introduced</b>, value: stats.made, percent: barOf(stats.made, stats.asked), tone: "made", hasBookmark: true },
          {
            label: "Declined",
            note: `${stats.declinedConnector} at the connector, ${stats.declinedTarget} by the person asked for`,
            value: stats.declined,
            percent: barOf(stats.declined, stats.asked),
            tone: "declined",
          },
          {
            label: `No answer in ${NO_ANSWER_DAYS} days`,
            note: `${stats.expiredConnector} at the connector, ${stats.expiredTarget} with the person asked for`,
            value: stats.noAnswer,
            percent: barOf(stats.noAnswer, stats.asked),
            tone: "declined",
          },
          {
            label: "Still open",
            note: `${stats.openConnector} with the connector, ${stats.openTarget} with the target`,
            value: stats.open,
            percent: barOf(stats.open, stats.asked),
            tone: "open",
          },
        ]}
      />
      <div className="fh-two">
        <div>
          {/* The admin's view names every connector (the owner's decision); the printed copy, the CSV and the partner
              email name only those who turned on "Credit me in reports". */}
          <div className="fh-no-print">
            <Breakdown title="Top connectors" first="Member" columns={CONNECTOR_COLUMNS} rows={readConnectorRows(stats, { everyone: true })} empty="No connectors yet." />
            <p className="fh-small fh-muted mt-2">
              Partners see a name only when that member turned on “Credit me in reports” on Your data. Everyone else is counted under {OTHER_CONNECTORS}, also in the
              PDF, the CSV and the email.
            </p>
          </div>
          <div className="fh-print-only">
            <Breakdown title="Top connectors" first="Member" columns={CONNECTOR_COLUMNS} rows={readConnectorRows(stats)} empty="No connectors yet." />
          </div>
        </div>
        <Breakdown title="By sector" first="Sector" columns={BREAKDOWN_COLUMNS} rows={stats.sectors} empty="No sectors yet." />
      </div>
      <div className="fh-two" id="breakdown">
        <Breakdown title="By what the founder needed" first="Need" columns={BREAKDOWN_COLUMNS} rows={stats.needs} />
        <Breakdown title="By cohort" first="Cohort" columns={BREAKDOWN_COLUMNS} rows={stats.cohorts} empty="No intros yet." />
      </div>
      <h2>The no’s, too</h2>
      <p className="fh-small">
        {stats.declinedConnector} declined by the connector and {stats.declinedTarget} by the person asked for; {stats.noAnswer} had no answer in {NO_ANSWER_DAYS}{" "}
        days and are not counted as declines. {stats.withdrawn} withdrawn by the asker. {stats.open} still open. Declines carry no reason, by design.
      </p>
      {stats.asked ? null : <Note className="mt-4">No intros in this period yet. The report fills in from the intro log as members ask for intros.</Note>}
      {asks ? <AsksAndUpdates asks={asks} /> : null}
      <p className="fh-foot">{REPORT_FOOT}</p>
    </article>
  );
}
