import { SegmentedLinks } from "@/components/ui/segmented";

import { readConsolePeriods, type ConsolePeriodParam } from "../console-periods";

// Founderhall's period switch on the Intro log and the partner report: "Q4 to date · Q3 · Since launch".
// `extra` keeps the page's other query (a log filter) on each link.
export function PeriodSwitch({ basePath, current, extra = "" }: { basePath: string; current: ConsolePeriodParam; extra?: string }) {
  return (
    <SegmentedLinks
      label="Period"
      links={readConsolePeriods().map(({ param, short }) => ({ href: `${basePath}?period=${param}${extra}`, label: short, isCurrent: param === current }))}
    />
  );
}
