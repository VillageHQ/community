import { cn } from "cn";
import { Check, Clock } from "lucide-react";
import type { CSSProperties, ReactNode } from "react";

// Founderhall's figures (design-system.md §3.9). Numbers are always sans and tabular.

// KV tiles (crop kv-tiles.png): 2 → 4 columns divided by 1 px rule lines; a 24/28 figure over a 13 px label.
export function KvTiles({ tiles, className }: { tiles: readonly { label: ReactNode; value: ReactNode; isGood?: boolean }[]; className?: string }) {
  return (
    <div data-slot="kv-tiles" className={cn("fh-kv", className)}>
      {tiles.map((tile, index) => (
        <div key={index} className={cn(tile.isGood && "fh-good")}>
          <b>{tile.value}</b>
          <span>{tile.label}</span>
        </div>
      ))}
    </div>
  );
}

export const LEDGER_TONES = { ink: "", yes: "yes", made: "made", declined: "declined", open: "open", helpful: "helpful" } as const;

export type LedgerTone = keyof typeof LEDGER_TONES;

type LedgerRow = {
  label: ReactNode;
  note?: ReactNode;
  value: ReactNode;
  // The % beside the figure.
  share?: ReactNode;
  // 0–100: the bar's length.
  percent: number;
  tone?: LedgerTone;
  // The Ribbon bookmark ("Introduced").
  hasBookmark?: boolean;
};

function Bookmark() {
  return (
    <svg className="fh-bookmark" viewBox="0 0 11 18" aria-hidden="true">
      <path d="M0 0h11v18l-5.5-4.2L0 18z" fill="currentColor" />
    </svg>
  );
}

// The ledger (crop ledger-bars.png): label | an 8–10 px bar | a big figure (+ a small %). Bar colours: Ink, the fund
// (said yes), Spine (made), Graphite (declined); open is hollow; helpful = a Spine bar and a Spine figure.
export function Ledger({ rows, foot }: { rows: readonly LedgerRow[]; foot?: ReactNode }) {
  return (
    <div data-slot="ledger" className="fh-ledger">
      {rows.map((row, index) => (
        <div key={index} className={cn("fh-lrow", row.tone && row.tone !== "ink" && `fh-${LEDGER_TONES[row.tone]}`, row.tone === "helpful" && "fh-made")}>
          <div className="fh-l">
            {row.hasBookmark ? <Bookmark /> : null}
            <b className="font-normal">{row.label}</b>
            {row.note ? <small>{row.note}</small> : null}
          </div>
          <div className="fh-bar">
            <i style={{ "--w": `${Math.max(0, Math.min(100, row.percent))}%` } as CSSProperties} />
          </div>
          <div className="fh-f">
            {row.value}
            {row.share ? <small>{row.share}</small> : null}
          </div>
        </div>
      ))}
      {foot ? <div className="fh-ledger-foot">{foot}</div> : null}
    </div>
  );
}

type MeterProps = {
  figure: ReactNode;
  figureNote?: ReactNode;
  percent: number;
  // A marker on the track with its label ("80% warning").
  mark?: { percent: number; label: string };
  isInk?: boolean;
};

// The meter (crop meter.png): a big figure line, then a 10 px track with a fund fill and an optional marker.
export function Meter({ figure, figureNote, percent, mark, isInk = false }: MeterProps) {
  return (
    <div data-slot="meter">
      <div className="fh-meter-fig">
        <b>{figure}</b>
        {figureNote ? <span>{figureNote}</span> : null}
      </div>
      <div className="fh-meter">
        <div className={cn("fh-track", isInk && "fh-ink")}>
          <i style={{ "--w": `${Math.max(0, Math.min(100, percent))}%` } as CSSProperties} />
          {mark ? (
            <span className="fh-mark" style={{ left: `${mark.percent}%` }}>
              <span>{mark.label}</span>
            </span>
          ) : null}
        </div>
      </div>
    </div>
  );
}

// The breakdown (crop breakdown.png): a 2-column list of label · figure over dotted rules.
export function Breakdown({ items }: { items: readonly { label: ReactNode; value: ReactNode }[] }) {
  return (
    <div data-slot="breakdown" className="fh-breakdown">
      {items.map((item, index) => (
        <div key={index}>
          <span>{item.label}</span>
          <b>{item.value}</b>
        </div>
      ))}
    </div>
  );
}

export const CHECK_STATES = { ok: "ok", watch: "watch", fail: "fail" } as const;

export type CheckState = keyof typeof CHECK_STATES;

const CHECK_ICONS = { ok: Check, watch: Clock, fail: Clock };

// The status checklist (crop checklist-status.png): a tick (ok / watch / fail), a line with its value under it, and
// a status word on the right.
export function StatusChecklist({ items }: { items: readonly { key: string; state: CheckState; title: ReactNode; value?: ReactNode; status?: ReactNode }[] }) {
  return (
    <ul data-slot="status-checklist" className="fh-checklist">
      {items.map((item) => {
        const Icon = CHECK_ICONS[item.state];
        return (
          <li key={item.key} className={cn(item.state !== "ok" && `fh-${item.state}`)}>
            <span className="fh-ck">
              <Icon aria-hidden="true" />
            </span>
            <span className="fh-t">
              {item.title}
              {item.value ? <span className="fh-v">{item.value}</span> : null}
            </span>
            {item.status ? <span className="fh-s">{item.status}</span> : null}
          </li>
        );
      })}
    </ul>
  );
}
