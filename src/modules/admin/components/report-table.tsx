import { Card, CardDescription, CardTitle } from "@/components/ui/card";
import { formatReportValue, type ReportSection } from "@/modules/admin/partner-report-rows";

// One section of the partner report. The page, the CSV and the email render the same rows.
export function ReportTable({ section, headings }: { section: ReportSection; headings: readonly { label: string; range: string }[] }) {
  const titleId = `report-${section.id}`;
  return (
    <Card className="grid gap-3">
      <div className="grid gap-1.5">
        <CardTitle id={titleId}>{section.title}</CardTitle>
        <CardDescription>{section.description}</CardDescription>
      </div>
      <div className="-mx-1 overflow-x-auto">
        <table aria-labelledby={titleId} className="w-full border-collapse text-left">
          <thead>
            <tr className="type-small text-foreground-soft">
              <th scope="col" className="px-1 py-2 font-normal">
                <span className="sr-only">Measure</span>
              </th>
              {headings.map(({ label, range }) => (
                <th key={label} scope="col" className="px-1.5 py-2 text-right align-bottom leading-tight font-bold text-foreground">
                  {label}
                  {range ? <span className="hidden font-normal text-foreground-soft sm:block">{range}</span> : null}
                </th>
              ))}
            </tr>
          </thead>
          <tbody>
            {section.rows.map(({ label, note, values, isStrong }) => (
              <tr key={label} className="border-t border-border">
                <th scope="row" className={`min-w-32 px-1 py-2.5 align-top ${isStrong ? "font-bold" : "font-normal"}`}>
                  <span className="block break-words">{label}</span>
                  {note ? <span className="type-small block text-foreground-soft">{note}</span> : null}
                </th>
                {values.map((value, index) => (
                  <td key={headings[index]?.label ?? index} className={`px-1.5 py-2.5 text-right align-top tabular-nums ${isStrong ? "font-bold" : ""}`}>
                    {formatReportValue(value)}
                  </td>
                ))}
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </Card>
  );
}
