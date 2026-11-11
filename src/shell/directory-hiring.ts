import "server-only";

import { jobBoardManifest } from "@/modules/job-board/manifest";
import { companyJobCountColumn } from "@/modules/job-board/reads-hiring";
import type { HiringLookup } from "@/modules/members/reads-directory";
import type { Database } from "@/platform/database/client";
import { isModuleEnabled } from "@/platform/modules/enablement";

// The directory's "Hiring" chip and filter, while the job board is on. Members can't import the job board, so the
// directory's page and route pass this in.
export async function readHiringLookup(database: Database): Promise<HiringLookup | null> {
  if (!(await isModuleEnabled(database, jobBoardManifest))) return null;
  return { jobCountColumn: (company) => companyJobCountColumn(company) };
}
