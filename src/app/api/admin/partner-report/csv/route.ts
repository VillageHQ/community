import { z } from "zod";

import { readPartnerReportFileName, renderPartnerReportCsv } from "@/modules/admin/partner-report-rows";
import { readPartnerReport } from "@/modules/admin/reads-partner-report";
import { adminRoutes } from "@/modules/admin/routes";

export const POST = adminRoutes.member(
  "admin-partner-report-csv",
  z.object({}),
  async ({ database }) => {
    const report = await readPartnerReport(database);
    return new Response(renderPartnerReportCsv(report), {
      headers: {
        "Content-Type": "text/csv; charset=utf-8",
        "Content-Disposition": `attachment; filename="${readPartnerReportFileName(report)}"`,
        "Cache-Control": "no-store",
      },
    });
  },
  { adminOnly: true },
);
