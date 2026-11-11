import { Building2 } from "lucide-react";
import Link from "next/link";

import { JOB_BOARD_PAGES } from "../../contract";

// Founderhall's link to the board under the Directory's head (directoryJobsLink): how a phone reaches Jobs, which has
// no tab. `openJobs`: the open jobs on the board, shown in brackets when there are any.
export function DirectoryJobsLink({ openJobs }: { openJobs: number }) {
  return (
    <p className="fh-small mt-2 flex items-center gap-1.5">
      <Building2 aria-hidden="true" className="fh-i fh-xs" strokeWidth={1.5} />
      <Link href={JOB_BOARD_PAGES.board}>{`Jobs at member companies${openJobs > 0 ? ` (${openJobs.toLocaleString("en-US")})` : ""}`}</Link>
    </p>
  );
}
