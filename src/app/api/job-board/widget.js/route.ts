import { jobBoardRoutes } from "@/modules/job-board/routes";
import { SCRIPT_HEADERS, WIDGET_SCRIPT } from "@/modules/job-board/rules-widget";

export const GET = jobBoardRoutes.open("job-board-widget-script", async () => new Response(WIDGET_SCRIPT, { headers: SCRIPT_HEADERS }));
