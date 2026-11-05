export type StatRow = { value: number | string; label: string; note?: string };

export function StatRows({ rows }: { rows: StatRow[] }) {
  return (
    <dl className="grid gap-2.5">
      {rows.map(({ value, label, note }) => (
        <div key={label} className="flex items-center gap-4 rounded-field bg-muted px-4 py-3">
          <dd className="type-h2 min-w-14 text-right tabular-nums">{value}</dd>
          <dt className="min-w-0">
            <span className="type-label block">{label}</span>
            {note ? <span className="type-small block text-foreground-soft">{note}</span> : null}
          </dt>
        </div>
      ))}
    </dl>
  );
}
