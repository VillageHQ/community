import { introLogCsvBodySchema } from "@/modules/admin/contract-intro-log";
import { parseConsolePeriod, readConsolePeriod } from "@/modules/admin/console-periods";
import { readIntroLogFileName, renderIntroLogCsv } from "@/modules/admin/intro-log-csv";
import { readIntroLog } from "@/modules/admin/reads-intro-log";
import { adminRoutes } from "@/modules/admin/routes";

export const POST = adminRoutes.member(
  "admin-intro-log-csv",
  introLogCsvBodySchema,
  async ({ database }, { period: periodParam }) => {
    const period = readConsolePeriod(parseConsolePeriod(periodParam));
    const rows = await readIntroLog(database, { from: period.from, to: period.to });
    return new Response(renderIntroLogCsv(rows), {
      headers: {
        "Content-Type": "text/csv; charset=utf-8",
        "Content-Disposition": `attachment; filename="${readIntroLogFileName(period)}"`,
        "Cache-Control": "no-store",
      },
    });
  },
  { adminOnly: true },
);
