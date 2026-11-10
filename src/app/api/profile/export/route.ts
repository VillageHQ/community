import { z } from "zod";

import { membersRoutes } from "@/modules/members/routes";
import { readExportFileName, readMemberExport } from "@/shell/member-export";

export const POST = membersRoutes.member("profile-export", z.object({}).strict(), async ({ database, member }) => {
  const exported = await readMemberExport(database, member.id);
  return new Response(JSON.stringify(exported, null, 2), {
    headers: {
      "Content-Type": "application/json; charset=utf-8",
      "Content-Disposition": `attachment; filename="${readExportFileName()}"`,
      "Cache-Control": "no-store",
    },
  });
});
