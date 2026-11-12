import { redirect } from "next/navigation";

import { JOB_BOARD_PAGES } from "@/modules/job-board/contract";
import { jobBoardManifest } from "@/modules/job-board/manifest";
import { modulePage } from "@/platform/modules/module-page";

// Founderhall keeps a founder's job tools in the "Our jobs" sheet on My profile; the old page forwards there.
export default modulePage(jobBoardManifest, async function YourJobsPage() {
  redirect(JOB_BOARD_PAGES.ours);
});
